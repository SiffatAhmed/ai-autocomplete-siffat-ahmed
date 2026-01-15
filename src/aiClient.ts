import * as vscode from 'vscode';

export interface AIRequestOptions {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}

export interface AIResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class AIClient {
  private apiKeys: { claude?: string; gemini?: string };
  private claudeBaseUrl = 'https://api.anthropic.com/v1';
  private geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private retryCount = 0;
  private maxRetries = 1;
  private backoffMs = 300;
  private outputChannel: vscode.OutputChannel;

  constructor(apiKeys: { claude?: string; gemini?: string }) {
    this.apiKeys = apiKeys;
    this.outputChannel = vscode.window.createOutputChannel('AI Autocomplete');
  }

  /**
   * Request completion from AI API
   */
  async requestCompletion(
    options: AIRequestOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<AIResponse> {
    const isGemini = options.model.startsWith('gemini');

    if (isGemini) {
      if (!this.apiKeys.gemini) {
        throw new Error('Gemini API key not configured');
      }
      return this.requestGeminiCompletion(options, cancellationToken);
    } else {
      if (!this.apiKeys.claude) {
        throw new Error('Claude API key not configured');
      }
      return this.requestClaudeCompletion(options, cancellationToken);
    }
  }

  private async requestGeminiCompletion(
    options: AIRequestOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<AIResponse> {
    const timeoutMs = options.timeoutMs || 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let cancelled = false;

    const cancellationListener = cancellationToken?.onCancellationRequested(() => {
      cancelled = true;
      controller.abort();
    });

    try {
      if (cancelled) {
        throw new Error('Request cancelled');
      }

      const url = `${this.geminiBaseUrl}/${options.model}:generateContent?key=${this.apiKeys.gemini}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${options.systemPrompt}\n\n${options.userPrompt}`
            }]
          }],
          generationConfig: {
            temperature: options.temperature,
            maxOutputTokens: options.maxTokens,
          }
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        const errorMessage = errorData?.error?.message || response.statusText;
        throw new Error(`Gemini API Error: ${errorMessage}`);
      }

      this.retryCount = 0;
      const data = await response.json() as any;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        content,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount || 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        },
      };

    } catch (error) {
      if (cancelled) throw new Error('Request cancelled');
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Request timeout');
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cancellationListener?.dispose();
    }
  }

  private async requestClaudeCompletion(
    options: AIRequestOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<AIResponse> {
    const timeoutMs = options.timeoutMs || 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let cancelled = false;

    const cancellationListener = cancellationToken?.onCancellationRequested(() => {
      cancelled = true;
      controller.abort();
    });

    try {
      if (cancelled) {
        throw new Error('Request cancelled');
      }

      const response = await fetch(`${this.claudeBaseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKeys.claude!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: options.model,
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          system: options.systemPrompt,
          messages: [
            {
              role: 'user',
              content: options.userPrompt,
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        const errorMessage = errorData?.error?.message || response.statusText;

        if (response.status === 401) {
          throw new Error('Invalid Claude API key');
        }

        if (response.status === 429) {
          // Rate limited - exponential backoff
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            await this.delay(this.backoffMs * Math.pow(2, this.retryCount - 1));
            this.backoffMs = Math.min(this.backoffMs * 2, 2000);
            return this.requestClaudeCompletion(options, cancellationToken);
          }
          throw new Error('Rate limited by API');
        }

        throw new Error(`API Error: ${errorMessage}`);
      }

      this.retryCount = 0;
      const data = await response.json() as any;
      const content = data.content?.[0]?.text || '';

      return {
        content,
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
        },
      };

    } catch (error) {
      if (cancelled) throw new Error('Request cancelled');
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Request timeout');
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cancellationListener?.dispose();
    }
  }

  /**
   * Simple delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log message to output channel
   */
  log(message: string, level: 'info' | 'error' | 'warn' = 'info'): void {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = level.toUpperCase();
    this.outputChannel.appendLine(`[${timestamp}] ${prefix}: ${message}`);
  }

  /**
   * Show output channel
   */
  showOutput(): void {
    this.outputChannel.show();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}