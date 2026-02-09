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
  private ollamaConfig?: { baseUrl: string; model: string };
  private claudeBaseUrl = 'https://api.anthropic.com/v1';
  private geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private retryCount = 0;
  private maxRetries = 1;
  private backoffMs = 300;
  private outputChannel: vscode.OutputChannel;

  constructor(apiKeys: { claude?: string; gemini?: string }, ollamaConfig?: { baseUrl: string; model: string }) {
    this.apiKeys = apiKeys;
    this.ollamaConfig = ollamaConfig;
    this.outputChannel = vscode.window.createOutputChannel('AI Autocomplete');
  }

  /**
   * Request completion from AI API
   */
  async requestCompletion(
    options: AIRequestOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<AIResponse> {
    const isGemini = options.model.toLowerCase().startsWith('gemini');
    const isOllama = options.model.toLowerCase().startsWith('ollama') || (this.ollamaConfig && options.model === this.ollamaConfig.model);

    this.log(`[AIClient] requestCompletion called. Model: ${options.model}, isOllama: ${isOllama}, isGemini: ${isGemini}`, 'info');
    this.log(`[AIClient] ollamaConfig present: ${!!this.ollamaConfig}`, 'info');

    if (isOllama) {
      if (!this.ollamaConfig) {
        throw new Error('Ollama not configured');
      }
      return this.requestOllamaCompletion(options, cancellationToken);
    } else if (isGemini) {
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

  private async requestOllamaCompletion(
    options: AIRequestOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<AIResponse> {
    const timeoutMs = options.timeoutMs || 60000;
    const startTime = Date.now();
    this.log(`Starting Ollama request with timeout: ${timeoutMs}ms`, 'info');

    let cancelled = false;
    const cancellationListener = cancellationToken?.onCancellationRequested(() => {
      cancelled = true;
    });

    try {
      if (cancelled) {
        throw new Error('Request cancelled');
      }

      // Use the model from options, or fallback to config if options model matches the generic "ollama" label
      const modelToUse = (options.model === 'ollama' && this.ollamaConfig) ? this.ollamaConfig.model : options.model;
      let baseUrl = this.ollamaConfig?.baseUrl || 'http://127.0.0.1:11434';

      // Fix for Node.js 17+ / VS Code fetch issues with localhost preferring IPv6
      if (baseUrl.includes('localhost')) {
        baseUrl = baseUrl.replace('localhost', '127.0.0.1');
      }

      this.log(`Ollama Request: ${baseUrl}/api/generate, Model: ${modelToUse}`, 'info');

      // Use Node.js http module instead of fetch (VS Code's fetch has issues with Ollama)
      const http = await import('http');
      const url = new URL(`${baseUrl}/api/generate`);

      const postData = JSON.stringify({
        model: modelToUse,
        prompt: `${options.systemPrompt}\n\n${options.userPrompt}`,
        stream: false,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
        }
      });

      const response = await new Promise<any>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout'));
        }, timeoutMs);

        const req = http.request({
          hostname: url.hostname,
          port: url.port || 11434,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: timeoutMs
        }, (res) => {
          clearTimeout(timeoutId);

          let data = '';
          res.on('data', (chunk) => {
            if (cancelled) {
              res.destroy();
              reject(new Error('Request cancelled'));
              return;
            }
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`Ollama API Error: ${res.statusCode} - ${data}`));
            } else {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error(`Failed to parse response: ${e}`));
              }
            }
          });
        });

        req.on('error', (err) => {
          clearTimeout(timeoutId);
          reject(err);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
      });

      this.retryCount = 0;
      const content = response.response || '';

      return {
        content,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`Ollama Request Failed after ${duration}ms. Cancelled: ${cancelled}`, 'error');

      if (error instanceof Error) {
        this.log(`Error: ${error.message}`, 'error');
      } else {
        this.log(`Unknown Error: ${JSON.stringify(error)}`, 'error');
      }

      if (cancelled) throw new Error('Request cancelled');
      throw error;
    } finally {
      cancellationListener?.dispose();
    }
  }

  private async requestGeminiCompletion(
    options: AIRequestOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<AIResponse> {
    const timeoutMs = options.timeoutMs || 60000;
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
      if (error instanceof Error && error.name === 'AbortError') throw new Error(`Request timeout ${error.message}`);
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
    const timeoutMs = options.timeoutMs || 60000;
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
          system: [
            {
              type: "text",
              text: options.systemPrompt,
              cache_control: { type: "ephemeral" }
            }
          ],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: options.userPrompt
                }
              ]
            }
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