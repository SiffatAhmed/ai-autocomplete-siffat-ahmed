import * as vscode from 'vscode';
import { ClaudeCompletionProvider } from './completionProvider';
import { ConfigManager } from './config';
import { SuggestionManager } from './suggestionManager';

let completionProvider: ClaudeCompletionProvider | null = null;
let configChangeDisposable: vscode.Disposable | null = null;
let suggestionManager: SuggestionManager | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Autocomplete extension activated');

  // Initialize completion provider
  completionProvider = new ClaudeCompletionProvider();

  // Initialize suggestion manager
  suggestionManager = new SuggestionManager();
  context.subscriptions.push(suggestionManager);

  // Create status bar item
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(check) Claude: Ready';
  statusBar.tooltip = 'Claude Autocomplete ready. Press Ctrl+Shift+Space for completion';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Attach status bar to completion provider
  completionProvider.setStatusBar(statusBar);

  // Get initial configuration
  const config = ConfigManager.getConfig();
  if (config.apiKey) {
    completionProvider.init(config.apiKey);
  }

  // Register inline completion provider for supported languages
  const supportedLanguages = [
    { language: 'javascript' },
    { language: 'typescript' },
    { language: 'javascriptreact' },
    { language: 'typescriptreact' },
    { language: 'dart' },
  ];

  const completionDisposable = vscode.languages.registerInlineCompletionItemProvider(
    supportedLanguages,
    completionProvider
  );

  context.subscriptions.push(completionDisposable);

  // Register commands
  const setApiKeyCommand = vscode.commands.registerCommand('claudeAutocomplete.setApiKey', async () => {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Anthropic API key',
      password: true,
      placeHolder: 'sk-ant-...',
    });

    if (apiKey) {
      try {
        await ConfigManager.setApiKey(apiKey);
        completionProvider?.init(apiKey);
        completionProvider?.resetNotificationFlag();
        vscode.window.showInformationMessage('Claude Autocomplete: API key configured successfully');
      } catch (error) {
        vscode.window.showErrorMessage('Failed to save API key');
      }
    }
  });

  const selectModelCommand = vscode.commands.registerCommand('claudeAutocomplete.selectModel', async () => {
    const models = [
      {
        label: 'Claude Opus 4.5 (Newest - $5/$25)',
        value: 'claude-opus-4-5-20251101',
        pricing: { input: '$5', output: '$25', cache5m: '$6.25', cache1h: '$10', cacheHit: '$0.50' }
      },
      {
        label: 'Claude Sonnet 4.5 (Recommended - $3/$15)',
        value: 'claude-sonnet-4-5-20250929',
        pricing: { input: '$3', output: '$15', cache5m: '$3.75', cache1h: '$6', cacheHit: '$0.30' }
      },
      {
        label: 'Claude Haiku 4.5 (Fast & Cheap - $1/$5)',
        value: 'claude-haiku-4-5-20251001',
        pricing: { input: '$1', output: '$5', cache5m: '$1.25', cache1h: '$2', cacheHit: '$0.10' }
      },
      {
        label: 'Claude Opus 4.1 (Legacy - $15/$75)',
        value: 'claude-opus-4-1-20250805',
        pricing: { input: '$15', output: '$75', cache5m: '$18.75', cache1h: '$30', cacheHit: '$1.50' }
      },
      {
        label: 'Claude Sonnet 4 (Legacy - $3/$15)',
        value: 'claude-sonnet-4-20250514',
        pricing: { input: '$3', output: '$15', cache5m: '$3.75', cache1h: '$6', cacheHit: '$0.30' }
      },
      {
        label: 'Claude Sonnet 3.7 (Legacy - $3/$15)',
        value: 'claude-3-7-sonnet-20250219',
        pricing: { input: '$3', output: '$15', cache5m: '$3.75', cache1h: '$6', cacheHit: '$0.30' }
      },
      {
        label: 'Claude Opus 4 (Legacy - $15/$75)',
        value: 'claude-opus-4-20250514',
        pricing: { input: '$15', output: '$75', cache5m: '$18.75', cache1h: '$30', cacheHit: '$1.50' }
      },
      {
        label: 'Claude Haiku 3.5 (Legacy - $0.80/$4)',
        value: 'claude-3-5-haiku-20241022',
        pricing: { input: '$0.80', output: '$4', cache5m: '$1', cache1h: '$1.60', cacheHit: '$0.08' }
      },
      {
        label: 'Claude Haiku 3 (Legacy - $0.25/$1.25)',
        value: 'claude-3-haiku-20240307',
        pricing: { input: '$0.25', output: '$1.25', cache5m: '$0.30', cache1h: '$0.50', cacheHit: '$0.03' }
      },
    ];

    const selected = await vscode.window.showQuickPick(models, {
      placeHolder: 'Select a Claude model',
      matchOnDescription: true,
    });

    if (selected) {
      try {
        await ConfigManager.setModel(selected.value);
        const message = `Claude Autocomplete: Using ${selected.label.split(' (')[0]}\n\nPricing per Million Tokens:\nInput: ${selected.pricing.input}\nOutput: ${selected.pricing.output}\n5m Cache Writes: ${selected.pricing.cache5m}\n1h Cache Writes: ${selected.pricing.cache1h}\nCache Hits: ${selected.pricing.cacheHit}`;
        vscode.window.showInformationMessage(message);
      } catch (error) {
        vscode.window.showErrorMessage('Failed to change model');
      }
    }
  });

  const toggleEnabledCommand = vscode.commands.registerCommand('claudeAutocomplete.toggleEnabled', async () => {
    try {
      await ConfigManager.toggleEnabled();
      const config = ConfigManager.getConfig();
      const status = config.enabled ? 'enabled' : 'disabled';
      vscode.window.showInformationMessage(`Claude Autocomplete: ${status}`);
    } catch (error) {
      vscode.window.showErrorMessage('Failed to toggle Claude Autocomplete');
    }
  });

  const clearCacheCommand = vscode.commands.registerCommand('claudeAutocomplete.clearCache', () => {
    if (completionProvider) {
      // Cache is cleared through provider disposal and recreation
      vscode.window.showInformationMessage('Claude Autocomplete: Cache cleared');
    }
  });

  const triggerCompletionCommand = vscode.commands.registerCommand('claudeAutocomplete.triggerCompletion', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Claude Autocomplete: No active editor');
      return;
    }

    const position = editor.selection.active;
    const document = editor.document;

    // Check if language is supported
    const supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'dart'];
    if (!supportedLanguages.includes(document.languageId)) {
      vscode.window.showWarningMessage(`Claude Autocomplete: Language "${document.languageId}" not supported. Supported: JavaScript, TypeScript, Dart`);
      return;
    }

    // Check if API key is configured
    const config = ConfigManager.getConfig();
    if (!config.apiKey) {
      const result = await vscode.window.showWarningMessage(
        'Claude Autocomplete: API key not configured',
        'Set API Key'
      );
      if (result === 'Set API Key') {
        await vscode.commands.executeCommand('claudeAutocomplete.setApiKey');
      }
      return;
    }

    // Request completion
    if (completionProvider) {
      try {
        const token = new vscode.CancellationTokenSource().token;
        const context: vscode.InlineCompletionContext = {
          triggerKind: vscode.InlineCompletionTriggerKind.Invoke,
          selectedCompletionInfo: undefined,
        };

        // Show progress while fetching
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Window,
            title: 'Claude: Generating completion...',
          },
          async () => {
            const items = await completionProvider!.provideInlineCompletionItems(
              document,
              position,
              context,
              token
            );

            if (items && items.length > 0) {
              // Show first completion as suggestion
              const item = items[0];
              const insertText = typeof item.insertText === 'string' ? item.insertText : item.insertText?.value || '';

              if (suggestionManager) {
                suggestionManager.showSuggestion(editor, insertText, position);
              }
            } else {
              vscode.window.showWarningMessage('Claude: No completions available. Check API key and try again.');
              // Show output channel for debugging
              completionProvider?.['claudeClient']?.showOutput?.();
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Claude: Completion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  });

  context.subscriptions.push(setApiKeyCommand);
  context.subscriptions.push(selectModelCommand);
  context.subscriptions.push(toggleEnabledCommand);
  context.subscriptions.push(clearCacheCommand);
  context.subscriptions.push(triggerCompletionCommand);

  // Add keyboard event handler for Tab to accept inline completion
  const acceptCompletionCommand = vscode.commands.registerCommand('claudeAutocomplete.acceptCompletion', async () => {
    // First try to accept our custom suggestion
    if (suggestionManager && suggestionManager.acceptSuggestion()) {
      return;
    }
    // If no custom suggestion, try to accept native inline suggestions
    await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
  });
  context.subscriptions.push(acceptCompletionCommand);

  // Add keyboard event handler for Escape to reject suggestion
  const rejectCompletionCommand = vscode.commands.registerCommand('claudeAutocomplete.rejectCompletion', async () => {
    if (suggestionManager) {
      suggestionManager.rejectSuggestion();
    }
  });
  context.subscriptions.push(rejectCompletionCommand);

  // Listen for configuration changes
  configChangeDisposable = ConfigManager.onConfigChange(() => {
    const config = ConfigManager.getConfig();
    if (config.apiKey && !completionProvider?.['claudeClient']) {
      completionProvider?.init(config.apiKey);
    }
  });

  context.subscriptions.push(configChangeDisposable);

  console.log('Claude Autocomplete extension fully initialized');
}

export function deactivate() {
  console.log('Claude Autocomplete extension deactivated');

  if (completionProvider) {
    completionProvider.dispose();
    completionProvider = null;
  }

  if (suggestionManager) {
    suggestionManager.dispose();
    suggestionManager = null;
  }

  if (configChangeDisposable) {
    configChangeDisposable.dispose();
    configChangeDisposable = null;
  }
}
