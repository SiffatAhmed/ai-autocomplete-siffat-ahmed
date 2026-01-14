import * as vscode from 'vscode';

export interface AIConfig {
  apiKey: string;
  enabled: boolean;
  model: string;
  temperature: number;
  debounceDelay: number;
}

export class ConfigManager {
  private static readonly CONFIG_NAMESPACE = 'aiAutocomplete';
  private static readonly API_KEY_SECRET = 'aiAutocomplete.apiKey';
  private static secretStorage: vscode.SecretStorage | null = null;

  static setSecretStorage(secretStorage: vscode.SecretStorage): void {
    this.secretStorage = secretStorage;
  }

  static async getConfig(): Promise<AIConfig> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_NAMESPACE);
    let apiKey = '';

    if (this.secretStorage) {
      apiKey = (await this.secretStorage.get(this.API_KEY_SECRET)) || '';
    }

    return {
      apiKey,
      enabled: config.get<boolean>('enabled') ?? true,
      model: config.get<string>('model') || 'claude-3-5-haiku-20241022',
      temperature: config.get<number>('temperature') ?? 0.2,
      debounceDelay: config.get<number>('debounceDelay') || 300,
    };
  }

  static async setApiKey(apiKey: string): Promise<void> {
    if (!this.secretStorage) {
      throw new Error('Secret storage not initialized');
    }
    await this.secretStorage.store(this.API_KEY_SECRET, apiKey);
  }

  static async setModel(model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_NAMESPACE);
    await config.update('model', model, vscode.ConfigurationTarget.Global);
  }

  static async setTemperature(temperature: number): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_NAMESPACE);
    await config.update('temperature', temperature, vscode.ConfigurationTarget.Global);
  }

  static async setDebounceDelay(delay: number): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_NAMESPACE);
    await config.update('debounceDelay', delay, vscode.ConfigurationTarget.Global);
  }

  static async toggleEnabled(): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_NAMESPACE);
    const currentState = config.get<boolean>('enabled') ?? true;
    await config.update('enabled', !currentState, vscode.ConfigurationTarget.Global);
  }

  static async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
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
