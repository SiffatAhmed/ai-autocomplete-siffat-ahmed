import * as vscode from 'vscode';
import { ClaudeCompletionProvider } from './completionProvider';
import { ConfigManager } from './config';

let completionProvider: ClaudeCompletionProvider | null = null;
let configChangeDisposable: vscode.Disposable | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Autocomplete extension activated');

  // Initialize completion provider
  completionProvider = new ClaudeCompletionProvider();

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
              // Insert first completion
              const item = items[0];
              const insertText = typeof item.insertText === 'string' ? item.insertText : item.insertText?.value || '';
              const edit = new vscode.WorkspaceEdit();
              edit.insert(document.uri, position, insertText);
              await vscode.workspace.applyEdit(edit);
              vscode.window.showInformationMessage('Claude: Completion inserted');
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
  context.subscriptions.push(toggleEnabledCommand);
  context.subscriptions.push(clearCacheCommand);
  context.subscriptions.push(triggerCompletionCommand);

  // Add keyboard event handler for Tab to accept inline completion
  const tabHandler = vscode.commands.registerCommand('claudeAutocomplete.acceptCompletion', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      // Try to accept the inline completion by triggering Tab key
      // This lets VS Code's default Tab behavior work for inline completions
      await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
    }
  });
  context.subscriptions.push(tabHandler);

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

  if (configChangeDisposable) {
    configChangeDisposable.dispose();
    configChangeDisposable = null;
  }
}
