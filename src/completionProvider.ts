import * as vscode from 'vscode';
import { ClaudeClient } from './claudeClient';
import { LRUCache } from './cache';
import { ContextManager, CodeContext } from './contextManager';
import { ConfigManager, ClaudeConfig } from './config';

export class ClaudeCompletionProvider implements vscode.InlineCompletionItemProvider {
  private claudeClient: ClaudeClient | null = null;
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
      this.statusBar.text = '$(loading~spin) Claude: Generating...';
      this.statusBar.tooltip = 'Generating code completion...';
      this.statusBar.show();
    } else {
      this.statusBar.text = '$(check) Claude: Ready';
      this.statusBar.tooltip = 'Claude Autocomplete ready. Press Ctrl+Shift+Space for completion';
      this.statusBar.show();
    }
  }

  /**
   * Initialize the provider with API key
   */
  init(apiKey: string): void {
    this.claudeClient = new ClaudeClient(apiKey);
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
    const config = ConfigManager.getConfig();
    const isManualTrigger = context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;

    // Check if feature is enabled
    if (!config.enabled) {
      return undefined;
    }

    // Check if API is configured
    if (!this.claudeClient || !config.apiKey) {
      if (!this.notificationShown) {
        vscode.window.showWarningMessage(
          'Claude Autocomplete: API key not configured',
          'Set API Key'
        ).then((selection) => {
          if (selection === 'Set API Key') {
            vscode.commands.executeCommand('claudeAutocomplete.setApiKey');
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
      config.contextLinesBefore,
      config.contextLinesAfter
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
          this.claudeClient?.log(`Manual trigger error: ${error.message}`, 'error');
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
              this.claudeClient?.log(`Completion error: ${error.message}`, 'error');
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
   * Request completion from Claude API
   */
  private async requestCompletion(
    context: CodeContext,
    config: ClaudeConfig,
    token: vscode.CancellationToken
  ): Promise<string | null> {
    if (!this.claudeClient) {
      return null;
    }

    try {
      const systemPrompt = ContextManager.getSystemPrompt(context.languageId);
      const userPrompt = ContextManager.buildUserPrompt(context);

      const response = await this.claudeClient.requestCompletion(
        {
          model: config.model,
          maxTokens: config.maxTokens,
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
        this.claudeClient.log(`Completion error: ${error.message}`, 'error');
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
    if (this.claudeClient) {
      this.claudeClient.dispose();
    }
  }

  /**
   * Reset notification flag when API key is set
   */
  resetNotificationFlag(): void {
    this.notificationShown = false;
  }
}
