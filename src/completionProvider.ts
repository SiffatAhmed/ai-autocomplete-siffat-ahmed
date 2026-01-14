import * as vscode from 'vscode';
import { AIClient } from './aiClient';
import { LRUCache } from './cache';
import { ContextManager, CodeContext } from './contextManager';
import { ConfigManager, AIConfig } from './config';

export class AICompletionProvider implements vscode.InlineCompletionItemProvider {
  private aiClient: AIClient | null = null;
  private cache: LRUCache;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingRequests: Map<string, Promise<string>> = new Map();
  private lastRequestTime = 0;
  private notificationShown = false;
  private statusBar: vscode.StatusBarItem | null = null;
  private isFetching = false;

  constructor() {
    this.cache = new LRUCache(100, 300);
  }

  /**
   * Set status bar item for visual feedback
   */
  setStatusBar(statusBar: vscode.StatusBarItem): void {
    this.statusBar = statusBar;
  }

  /**
   * Update status bar to show fetching state
   */
  private updateStatusBar(): void {
    if (!this.statusBar) return;

    if (this.isFetching) {
      this.statusBar.text = '$(loading~spin) AI Autocomplete: Generating...';
      this.statusBar.tooltip = 'Generating code completion...';
      this.statusBar.show();
    } else {
      this.statusBar.text = '$(check) AI Autocomplete: Ready';
      this.statusBar.tooltip = 'AI Autocomplete ready. Press Ctrl+Shift+Space for completion';
      this.statusBar.show();
    }
  }

  /**
   * Initialize the provider with API key
   */
  init(apiKey: string): void {
    this.aiClient = new AIClient(apiKey);
  }

  /**
   * Main completion provider function
   */
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const config = await ConfigManager.getConfig();
    const isManualTrigger = context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;

    // Check if feature is enabled
    if (!config.enabled) {
      return undefined;
    }

    // Check if API is configured
    if (!this.aiClient || !config.apiKey) {
      if (!this.notificationShown) {
        vscode.window.showWarningMessage(
          'AI Autocomplete: API key not configured',
          'Set API Key'
        ).then((selection) => {
          if (selection === 'Set API Key') {
            vscode.commands.executeCommand('aiAutocomplete.setApiKey');
          }
        });
        this.notificationShown = true;
      }
      return undefined;
    }

    // Check supported languages
    const supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'dart'];
    if (!supportedLanguages.includes(document.languageId)) {
      return undefined;
    }

    // For manual triggers, skip the strict filtering - user explicitly wants a completion
    // For automatic triggers, apply stricter checks to avoid spam
    if (!isManualTrigger && !ContextManager.shouldTriggerCompletion(document, position, document.languageId)) {
      return undefined;
    }

    // Generate cache key
    const ctx = ContextManager.extractContext(
      document,
      position,
      30,
      30
    );
    const cacheKey = LRUCache.generateKey(ctx.codeBefore + ctx.codeAfter, `${position.line}:${position.character}`, document.languageId);

    // Check cache first
    const cachedCompletion = this.cache.get(cacheKey);
    if (cachedCompletion) {
      return this.formatCompletion(cachedCompletion);
    }

    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      try {
        const completion = await this.pendingRequests.get(cacheKey)!;
        return this.formatCompletion(completion);
      } catch {
        return undefined;
      }
    }

    // For manual triggers, execute immediately without debounce
    if (isManualTrigger) {
      try {
        this.isFetching = true;
        this.updateStatusBar();

        const requestPromise = this.requestCompletion(ctx, config, token) as Promise<string>;
        this.pendingRequests.set(cacheKey, requestPromise);

        const completion = await requestPromise;
        this.pendingRequests.delete(cacheKey);

        this.isFetching = false;
        this.updateStatusBar();

        if (completion) {
          this.cache.set(cacheKey, completion);
          this.lastRequestTime = Date.now();
          return this.formatCompletion(completion);
        } else {
          return undefined;
        }
      } catch (error) {
        this.pendingRequests.delete(cacheKey);
        this.isFetching = false;
        this.updateStatusBar();
        if (error instanceof Error) {
          this.aiClient?.log(`Manual trigger error: ${error.message}`, 'error');
        }
        return undefined;
      }
    }

    // For automatic triggers, apply debouncing
    const documentUri = document.uri.toString();
    const debounceKey = `${documentUri}:${position.line}:${position.character}`;

    return new Promise((resolve) => {
      // Clear previous debounce timer for this position
      const existingTimer = this.debounceTimers.get(debounceKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(async () => {
        this.debounceTimers.delete(debounceKey);

        // Check time since last request (throttle)
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < config.debounceDelay) {
          resolve(undefined);
          return;
        }

        try {
          this.isFetching = true;
          this.updateStatusBar();

          // Create request promise
          const requestPromise = this.requestCompletion(ctx, config, token) as Promise<string>;
          this.pendingRequests.set(cacheKey, requestPromise);

          const completion = await requestPromise;
          this.pendingRequests.delete(cacheKey);

          this.isFetching = false;
          this.updateStatusBar();

          if (completion) {
            this.cache.set(cacheKey, completion);
            this.lastRequestTime = Date.now();
            resolve(this.formatCompletion(completion));
          } else {
            resolve(undefined);
          }
        } catch (error) {
          this.pendingRequests.delete(cacheKey);
          this.isFetching = false;
          this.updateStatusBar();
          if (token.isCancellationRequested) {
            resolve(undefined);
          } else {
            if (error instanceof Error) {
              this.aiClient?.log(`Completion error: ${error.message}`, 'error');
            }
            resolve(undefined);
          }
        }
      }, config.debounceDelay);

      this.debounceTimers.set(debounceKey, timer);

      // Handle cancellation
      if (token.isCancellationRequested) {
        clearTimeout(timer);
        this.debounceTimers.delete(debounceKey);
        resolve(undefined);
      }

      token.onCancellationRequested(() => {
        clearTimeout(timer);
        this.debounceTimers.delete(debounceKey);
      });
    });
  }

  /**
   * Request completion from AI API
   */
  private async requestCompletion(
    context: CodeContext,
    config: AIConfig,
    token: vscode.CancellationToken
  ): Promise<string | null> {
    if (!this.aiClient) {
      return null;
    }

    try {
      const systemPrompt = ContextManager.getSystemPrompt(context.languageId);
      const userPrompt = ContextManager.buildUserPrompt(context);

      const response = await this.aiClient.requestCompletion(
        {
          model: config.model,
          maxTokens: 300,
          temperature: config.temperature,
          systemPrompt,
          userPrompt,
          timeoutMs: 5000,
        },
        token
      );

      // Clean up response
      let completion = response.content.trim();

      // Remove markdown code blocks if present
      if (completion.startsWith('```')) {
        completion = completion.replace(/^```[\s\S]*?\n/, '').replace(/\n```$/, '');
      }

      return completion || null;
    } catch (error) {
      if (error instanceof Error) {
        this.aiClient.log(`Completion error: ${error.message}`, 'error');
      }
      return null;
    }
  }

  /**
   * Format completion as VS Code completion item
   */
  private formatCompletion(completion: string): vscode.InlineCompletionItem[] {
    if (!completion) {
      return [];
    }

    return [
      new vscode.InlineCompletionItem(completion),
    ];
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingRequests.clear();
    this.cache.clear();
    if (this.aiClient) {
      this.aiClient.dispose();
    }
  }

  /**
   * Reset notification flag when API key is set
   */
  resetNotificationFlag(): void {
    this.notificationShown = false;
  }

  /**
   * Handle text document changes to trigger completions automatically
   */
  public handleDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
    // Run async operation without blocking
    this.handleDidChangeTextDocumentAsync(event).catch((error) => {
      console.error('Error in handleDidChangeTextDocument:', error);
    });
  }

  private async handleDidChangeTextDocumentAsync(event: vscode.TextDocumentChangeEvent): Promise<void> {
    const config = await ConfigManager.getConfig();
    if (!config.enabled) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === event.document) {
      const position = editor.selection.active;

      // Use ContextManager to decide if we should trigger
      if (ContextManager.shouldTriggerCompletion(editor.document, position, editor.document.languageId)) {
        // Include position in debounce key to handle multiple edits at different positions
        const debounceKey = `${editor.document.uri.toString()}:${position.line}:${position.character}`;

        // Clear previous timer for this position
        if (this.debounceTimers.has(debounceKey)) {
          clearTimeout(this.debounceTimers.get(debounceKey)!);
        }

        // Set new timer to trigger completion
        const timer = setTimeout(() => {
          if (vscode.window.activeTextEditor) {
            // Call provideInlineCompletionItems directly to get completions
            const context: vscode.InlineCompletionContext = {
              triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
              selectedCompletionInfo: undefined,
            };

            this.provideInlineCompletionItems(
              editor.document,
              position,
              context,
              new vscode.CancellationTokenSource().token
            ).catch((error) => {
              console.error('Error in automatic completion:', error);
            });
          }
          this.debounceTimers.delete(debounceKey);
        }, config.debounceDelay);

        this.debounceTimers.set(debounceKey, timer);
      }
    }
  }
}
