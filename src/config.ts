import * as vscode from 'vscode';

export interface ClaudeConfig {
  apiKey: string;
  enabled: boolean;
  model: string;
  maxTokens: number;
  temperature: number;
  debounceDelay: number;
  contextLinesBefore: number;
  contextLinesAfter: number;
}

export class ConfigManager {
  private static readonly CONFIG_NAMESPACE = 'claudeAutocomplete';

  static getConfig(): ClaudeConfig {
    const config = vscode.workspace.getConfiguration(this.CONFIG_NAMESPACE);

    return {
      apiKey: config.get<string>('apiKey') || '',
      enabled: config.get<boolean>('enabled') ?? true,
      model: config.get<string>('model') || 'claude-sonnet-4-20250514',
      maxTokens: config.get<number>('maxTokens') || 300,
      temperature: config.get<number>('temperature') ?? 0.2,
      debounceDelay: config.get<number>('debounceDelay') || 300,
      contextLinesBefore: config.get<number>('contextLinesBefore') || 30,
      contextLinesAfter: config.get<number>('contextLinesAfter') || 10,
    };
  }

  static async setApiKey(apiKey: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_NAMESPACE);
    await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
  }

  static async toggleEnabled(): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_NAMESPACE);
    const currentState = config.get<boolean>('enabled') ?? true;
    await config.update('enabled', !currentState, vscode.ConfigurationTarget.Global);
  }

  static isConfigured(): boolean {
    const config = this.getConfig();
    return config.apiKey.length > 0;
  }

  static onConfigChange(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(this.CONFIG_NAMESPACE)) {
        callback();
      }
    });
  }
}
