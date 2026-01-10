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
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1';
  private retryCount = 0;
  private maxRetries = 1;
  private backoffMs = 300;
  private outputChannel: vscode.OutputChannel;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.outputChannel = vscode.window.createOutputChannel('AI Autocomplete');
  }

  /**
   * Request completion from AI API
   */
  async requestCompletion(
    options: AIRequestOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

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

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
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
        const errorData = await response.json() as Record<string, unknown>;
        const errorMessage = (errorData?.error as Record<string, unknown>)?.message || response.statusText;

        if (response.status === 401) {
          throw new Error('Invalid API key');
        }

        if (response.status === 429) {
          // Rate limited - exponential backoff
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            await this.delay(this.backoffMs * Math.pow(2, this.retryCount - 1));
            this.backoffMs = Math.min(this.backoffMs * 2, 2000);
            return this.requestCompletion(options, cancellationToken);
          }
          throw new Error('Rate limited by API');
        }

        throw new Error(`API Error: ${errorMessage}`);
      }

      this.retryCount = 0;
      const data = await response.json() as Record<string, unknown>;
      const contentArray = (data.content as unknown[]) || [];
      const firstContent = (contentArray[0] as Record<string, unknown>) || {};
      const completion = (firstContent.text as string) || '';

      return {
        content: completion,
        usage: {
          inputTokens: ((data.usage as Record<string, unknown>)?.input_tokens as number) || 0,
          outputTokens: ((data.usage as Record<string, unknown>)?.output_tokens as number) || 0,
        },
      };
    } catch (error) {
      if (cancelled) {
        throw new Error('Request cancelled');
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }

      throw new Error('Unknown error occurred');
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