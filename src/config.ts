import * as vscode from 'vscode';

export interface AIConfig {
  apiKey: string;
  claudeApiKey: string;
  geminiApiKey: string;
  enabled: boolean;
  model: string;
  temperature: number;
  debounceDelay: number;
}

export class ConfigManager {
  private static readonly CONFIG_NAMESPACE = 'aiAutocomplete';
  private static readonly CLAUDE_API_KEY_SECRET = 'aiAutocomplete.claudeApiKey';
  private static readonly GEMINI_API_KEY_SECRET = 'aiAutocomplete.geminiApiKey';
  private static readonly LEGACY_API_KEY_SECRET = 'aiAutocomplete.apiKey';
  private static secretStorage: vscode.SecretStorage | null = null;

  static setSecretStorage(secretStorage: vscode.SecretStorage): void {
    this.secretStorage = secretStorage;
  }

  static async getConfig(): Promise<AIConfig> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_NAMESPACE);
    let claudeApiKey = '';
    let geminiApiKey = '';

    if (this.secretStorage) {
      // Try new keys first
      claudeApiKey = (await this.secretStorage.get(this.CLAUDE_API_KEY_SECRET)) || '';
      geminiApiKey = (await this.secretStorage.get(this.GEMINI_API_KEY_SECRET)) || '';

      // Fallback to legacy key for Claude if new key not set
      if (!claudeApiKey) {
        const legacyKey = (await this.secretStorage.get(this.LEGACY_API_KEY_SECRET));
        if (legacyKey && legacyKey.startsWith('sk-ant')) {
          claudeApiKey = legacyKey;
          // Migrate legacy key
          await this.secretStorage.store(this.CLAUDE_API_KEY_SECRET, claudeApiKey);
          await this.secretStorage.delete(this.LEGACY_API_KEY_SECRET);
        }
      }
    }

    return {
      apiKey: claudeApiKey, // For backward compatibility
      claudeApiKey,
      geminiApiKey,
      enabled: config.get<boolean>('enabled') ?? true,
      model: config.get<string>('model') || 'claude-3-5-haiku-20241022',
      temperature: config.get<number>('temperature') ?? 0.2,
      debounceDelay: config.get<number>('debounceDelay') || 300,
    };
  }

  static async setClaudeApiKey(apiKey: string): Promise<void> {
    if (!this.secretStorage) {
      throw new Error('Secret storage not initialized');
    }
    await this.secretStorage.store(this.CLAUDE_API_KEY_SECRET, apiKey);
  }

  static async setGeminiApiKey(apiKey: string): Promise<void> {
    if (!this.secretStorage) {
      throw new Error('Secret storage not initialized');
    }
    await this.secretStorage.store(this.GEMINI_API_KEY_SECRET, apiKey);
  }

  // Legacy support
  static async setApiKey(apiKey: string): Promise<void> {
    await this.setClaudeApiKey(apiKey);
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
    return config.claudeApiKey.length > 0 || config.geminiApiKey.length > 0;
  }

  static onConfigChange(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(this.CONFIG_NAMESPACE)) {
        callback();
      }
    });
  }
}
