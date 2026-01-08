# AI Autocomplete for VS Code

AI-powered inline code completions for JavaScript, TypeScript, and Dart (Bring your own API key).

## Features

- **Inline Completions**: Get AI-powered code suggestions as you type
- **Language Support**: JavaScript, TypeScript, JSX, TSX, and Dart
- **Smart Caching**: Reduces API calls with LRU cache
- **Throttling**: Prevents API spam with configurable debounce
- **Error Handling**: Graceful degradation with informative messages
- **Language-Aware**: Context-aware completions for each language

## Supported Languages

- JavaScript (`.js`, `.jsx`, `.mjs`)
- TypeScript (`.ts`, `.tsx`)
- Dart (`.dart`) - Great for Flutter development!

## Setup

### 1. Get an API Key

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to "API Keys" section
4. Create a new API key

### 2. Configure the Extension

**Option A: Via Command Palette**

1. Open VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `AIAutoComplete: Set API Key`
3. Paste your API key when prompted

**Option B: Via Settings**

1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. Search for "AI Autocomplete"
3. Paste your API key in the `aiAutocomplete.apiKey` field

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

- `AI Autocomplete: Set API Key` - Update your API key
- `AI Autocomplete: Toggle Autocomplete` - Enable/disable the extension
- `AI Autocomplete: Clear Completion Cache` - Clear cached completions
- `AI Autocomplete: Trigger Completion Manually` - Request a completion manually

## Configuration

Open Settings and search for "AI Autocomplete" to customize:

| Setting                             | Default                    | Description                                 |
| ----------------------------------- | -------------------------- | ------------------------------------------- |
| `aiAutocomplete.enabled`            | `true`                     | Enable/disable completions                  |
| `aiAutocomplete.model`              | `claude-sonnet-4-20250514` | Model to use                                |
| `aiAutocomplete.maxTokens`          | `300`                      | Max tokens per completion (100-1000)        |
| `aiAutocomplete.temperature`        | `0.2`                      | Determinism (0=exact, 1=creative)           |
| `aiAutocomplete.debounceDelay`      | `300`                      | Wait time (ms) before requesting (100-2000) |
| `aiAutocomplete.contextLinesBefore` | `30`                       | Context lines before cursor (10-100)        |
| `aiAutocomplete.contextLinesAfter`  | `10`                       | Context lines after cursor (0-50)           |

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

- The API took too long (>5s)
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
