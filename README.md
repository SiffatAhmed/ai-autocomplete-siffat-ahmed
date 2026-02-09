# AI Autocomplete for VS Code

AI-powered inline code completions for JavaScript, TypeScript, and Dart (Bring your own API key).

## Features

- **Multiple AI Providers**: Claude (Anthropic), Gemini (Google), or Ollama (Local Models)
- **Inline Completions**: Get AI-powered code suggestions as you type
- **Language Support**: JavaScript, TypeScript, JSX, TSX, and Dart
- **Local AI Support**: Run models offline with Ollama - no API costs!
- **Smart Caching**: Reduces API calls with LRU cache
- **Throttling**: Prevents API spam with configurable debounce
- **Error Handling**: Graceful degradation with informative messages
- **Language-Aware**: Context-aware completions for each language

## Supported Languages

- JavaScript (`.js`, `.jsx`, `.mjs`)
- TypeScript (`.ts`, `.tsx`)
- Dart (`.dart`) - Great for Flutter development!

## Setup

Choose your preferred AI provider:

### Option 1: Local Models with Ollama (Recommended for Privacy & Cost)

**Why Ollama?**
- ✅ **100% Free** - No API costs
- ✅ **Privacy** - Your code never leaves your machine
- ✅ **Offline** - Works without internet
- ✅ **Fast** - 2-5 second response times on modern hardware

**Setup Steps:**

1. **Install Ollama**
   - Download from [ollama.ai](https://ollama.ai)
   - Windows: Run the installer
   - Mac: `brew install ollama`
   - Linux: `curl -fsSL https://ollama.ai/install.sh | sh`

2. **Pull a Model**
   ```bash
   # Lightweight model (recommended for autocomplete)
   ollama pull gemma3:1b
   
   # OR a more powerful model
   ollama pull deepseek-r1:8b
   ```

3. **Verify Ollama is Running**
   ```bash
   ollama list
   ```
   You should see your downloaded model(s)

4. **Configure Extension**
   - Open VS Code Command Palette (`Ctrl+Shift+P`)
   - Run `AI Autocomplete: Select Model`
   - Choose `Ollama (Local)`
   - Run `AI Autocomplete: Set Ollama Model`
   - Enter your model name (e.g., `gemma3:1b`)

**Recommended Models:**
- `gemma3:1b` - Fast, lightweight (1GB RAM)
- `qwen2.5-coder:1.5b` - Optimized for code (2GB RAM)
- `deepseek-r1:8b` - More accurate, slower (8GB RAM)

### Option 2: Claude API (Anthropic)

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to "API Keys" section
4. Create a new API key
5. Run `AI Autocomplete: Set API Key` in VS Code
6. Run `AI Autocomplete: Select Model` and choose a Claude model

### Option 3: Gemini API (Google)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Run `AI Autocomplete: Set API Key` in VS Code
4. Run `AI Autocomplete: Select Model` and choose a Gemini model

## Usage

### Automatic Completions

Completions appear automatically as you type in supported languages. The extension:

- Extracts context around your cursor
- Sends it to API
- Displays suggestions inline
- Caches results to minimize API calls

### Manual Trigger

Press `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on Mac) to manually request a completion.

### Commands

Available commands in the Command Palette:

- `AI Autocomplete: Set API Key` - Update your Claude/Gemini API key
- `AI Autocomplete: Select Model` - Choose AI provider (Claude, Gemini, or Ollama)
- `AI Autocomplete: Set Ollama Base URL` - Configure Ollama server URL (default: http://localhost:11434)
- `AI Autocomplete: Set Ollama Model` - Choose which local model to use
- `AI Autocomplete: Toggle Autocomplete` - Enable/disable the extension
- `AI Autocomplete: Set Temperature` - Adjust creativity (0=deterministic, 1=creative)
- `AI Autocomplete: Set Debounce Delay` - Change wait time before requesting (100-2000ms)
- `AI Autocomplete: Clear Completion Cache` - Clear cached completions
- `AI Autocomplete: Trigger Completion Manually` - Request a completion manually

## Configuration

Open Settings and search for "AI Autocomplete" to customize:

| Setting                          | Default                      | Description                                 |
| -------------------------------- | ---------------------------- | ------------------------------------------- |
| `aiAutocomplete.enabled`         | `true`                       | Enable/disable completions                  |
| `aiAutocomplete.model`           | `claude-3-5-haiku-20241022`  | Model to use (or "ollama" for local)        |
| `aiAutocomplete.ollamaBaseUrl`   | `http://localhost:11434`     | Ollama server URL                           |
| `aiAutocomplete.ollamaModel`     | `gemma3:1b`                  | Local Ollama model name                     |
| `aiAutocomplete.temperature`     | `0.2`                        | Determinism (0=exact, 1=creative)           |
| `aiAutocomplete.debounceDelay`   | `300`                        | Wait time (ms) before requesting (100-2000) |

## Cost Estimation

Based on Claude Sonnet 4 pricing:

- Input: $3 / million tokens
- Output: $15 / million tokens

Typical usage: **~$0.10-0.50 per hour** of active coding

Example:

- 50 completions/hour
- 500 input tokens average = 25,000 total input tokens
- 100 output tokens average = 5,000 total output tokens
- Cost: (25,000 × $3/M) + (5,000 × $15/M) ≈ $0.15

## Performance Notes

- **Request Throttling**: Max 1 request per 300ms to prevent API spam
- **Smart Caching**: 100-entry LRU cache with 5-minute TTL
- **Aggressive Filtering**: Only completes in code (not comments/strings)
- **Timeouts**: 5-second timeout per request to avoid blocking
- **Memory**: Uses <50MB memory typical usage

## Limitations

- Only works in supported languages (JS/TS/Dart)
- No completions in comments or string literals
- Requires network connection
- API key is stored in VS Code settings

## Troubleshooting

### "API key not configured"

- Run `AIAutocomplete: Set API Key` command
- Or add your key to VS Code settings

### "Rate limited by API"

- Reduce `debounceDelay` setting to decrease request frequency
- Wait a moment before continuing typing

### "Request timeout"

**For Ollama:**
- Ensure Ollama is running: `ollama list`
- Check if model is loaded: `ollama run <model-name> "test"`
- Verify base URL in settings (should be `http://localhost:11434` or `http://127.0.0.1:11434`)

**For Claude/Gemini:**
- The API took too long
- Check your internet connection
- Try again

### No completions appearing

- Ensure language is supported (JS/TS/Dart)
- Check you're not in a comment or string
- Verify API key is valid
- Check VS Code output channel: `AI Autocomplete`

## Privacy & Security

- Your API key is stored **securely** in VS Code's encrypted settings
- Code context is sent to Anthropic API for processing
- Results are cached locally (not stored externally)
- No telemetry or usage tracking

## License

MIT

## Support

For issues or questions:

1. Check the [troubleshooting section](#troubleshooting)
2. View logs in VS Code output channel: `AI Autocomplete`
3. File an issue [here](https://forms.gle/JuBJbX2LbTvPar9b6)

---

Made with ❤️ for developers who love AI-assisted coding
