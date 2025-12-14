# Getting Started with Claude Autocomplete

Welcome! You now have a fully functional VS Code extension that provides AI-powered code completions using Claude.

## 📋 Prerequisites

- VS Code version 1.85.0 or later
- Anthropic API key (get one at https://console.anthropic.com)
- Internet connection

## 🚀 5-Minute Quick Start

### Step 1: Install the Extension
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Click the `...` menu → "Install from VSIX..."
4. Select `claude-autocomplete-0.1.0.vsix` from this folder
5. Click Install

### Step 2: Get Your API Key
1. Visit https://console.anthropic.com
2. Sign in or create an account
3. Go to API Keys section
4. Click "Create API Key"
5. Copy the key (starts with `sk-ant-`)

### Step 3: Configure the Extension
1. Open Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Type: `Claude: Set API Key`
3. Paste your API key
4. Press Enter

### Step 4: Test It
1. Create a new JavaScript file: `test.js`
2. Type this code:
```javascript
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n =>
```
3. Wait ~1 second for the completion to appear
4. Press Tab or Enter to accept

✅ **You're done!** Completions now work automatically as you type.

## 📁 Project Files

```
claude-autocomplete/
├── src/                    # TypeScript source code
│   ├── extension.ts       # Main entry point
│   ├── completionProvider.ts
│   ├── claudeClient.ts
│   ├── contextManager.ts
│   ├── cache.ts
│   └── config.ts
├── out/                   # Compiled JavaScript
├── README.md              # Full documentation
├── INSTALLATION.md        # Detailed setup guide
├── CHANGELOG.md           # Version history
├── package.json           # Extension config
└── claude-autocomplete-0.1.0.vsix  # Ready to install
```

## 🎯 Supported Languages

- **JavaScript** - `.js`, `.mjs` files
- **TypeScript** - `.ts` files
- **JSX** - `.jsx` files
- **TSX** - `.tsx` files
- **Dart** - `.dart` files (great for Flutter!)

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Manual completion | Ctrl+Shift+Space (Cmd+Shift+Space on Mac) |
| Set API Key | (via Command Palette) |
| Toggle on/off | (via Command Palette) |

## 🔧 Available Commands

Open Command Palette (Ctrl+Shift+P) and type:

- `Claude: Set API Key` - Update or change your API key
- `Claude: Toggle Autocomplete` - Turn on/off
- `Claude: Clear Completion Cache` - Reset cached results
- `Claude: Trigger Completion Manually` - Get a suggestion now

## ⚙️ Configuration (Optional)

Open VS Code Settings (Ctrl+,) and search for "Claude Autocomplete":

**Most Important:**
- `claudeAutocomplete.apiKey` - Your API key (already set via command)
- `claudeAutocomplete.enabled` - Turn on/off (default: on)

**Performance Tuning:**
- `claudeAutocomplete.debounceDelay` - Wait time before requesting (default: 300ms)
  - Lower = faster but more API calls
  - Higher = fewer API calls but slower suggestions

**Quality Tuning:**
- `claudeAutocomplete.temperature` - Creativity level (default: 0.2)
  - 0 = exact, predictable completions
  - 1 = creative, varied completions
  - Keep at 0.2 for best code completions

**Advanced:**
- `claudeAutocomplete.maxTokens` - Max completion length (default: 300)
- `claudeAutocomplete.contextLinesBefore` - Context before cursor (default: 30)
- `claudeAutocomplete.contextLinesAfter` - Context after cursor (default: 10)

## 💡 Tips & Tricks

### 1. Get Better Completions
- Provide more context (write descriptive variable names)
- Include type annotations when using TypeScript
- Write clear code comments

### 2. Reduce API Costs
- Completions are cached (same code → free completion)
- Increase `debounceDelay` to wait longer between requests
- The cache resets every 5 minutes

### 3. Faster Completions
- Reduce `debounceDelay` if network is fast
- Decrease `contextLinesBefore` if working on small functions
- Use manual trigger (Ctrl+Shift+Space) to get immediate completion

### 4. Debugging
- Check output: View → Output → Select "Claude Autocomplete"
- Verify API key is valid by trying manual trigger
- Ensure language is supported (JS/TS/Dart only)

## ❓ Common Issues & Solutions

### "No completions appearing"
**Solution:**
1. Verify you're in a supported language (JS/TS/Dart)
2. Make sure you're typing in code (not comments)
3. Run `Claude: Set API Key` again to verify key is set
4. Check if `claudeAutocomplete.enabled` is true

### "API key not configured"
**Solution:**
1. Open Command Palette
2. Run `Claude: Set API Key`
3. Paste your API key from console.anthropic.com

### "Rate limited by API"
**Solution:**
- Slow down typing or increase `debounceDelay`
- Wait a minute, then continue
- Check your API usage at console.anthropic.com

### "Request timeout"
**Solution:**
- Check your internet connection
- Try again in a moment
- API might be temporarily slow

## 📊 Monitoring Costs

Visit https://console.anthropic.com/usage to see:
- Total tokens used
- API costs
- Usage timeline

**Typical costs:**
- 50 completions/hour × 500 input tokens = 25K tokens × $3/M = $0.075
- 50 completions/hour × 100 output tokens = 5K tokens × $15/M = $0.075
- **Total: ~$0.15/hour** (varies with usage)

## 🔐 Security & Privacy

- Your API key is stored **securely** in VS Code's encrypted settings
- Code context is sent to Anthropic's API for processing
- No telemetry or tracking
- Results are cached locally (not stored externally)
- You control all settings

## 📚 Full Documentation

For more detailed information, see:
- **README.md** - Complete feature documentation
- **INSTALLATION.md** - Detailed setup guide
- **CHANGELOG.md** - Version history
- **Anthropic Docs** - https://docs.anthropic.com

## 🐛 Troubleshooting

Check these in order:
1. ✅ API key is set (`Claude: Set API Key`)
2. ✅ Language is supported (JS/TS/Dart)
3. ✅ You're in code (not comment/string)
4. ✅ `claudeAutocomplete.enabled` is true
5. ✅ Internet connection is working
6. ✅ View output log: Output → "Claude Autocomplete"

## 🎓 Learning Examples

### JavaScript
```javascript
// Basic function
const greet = (name) =>
// Suggests: `return `Hello, ${name}!`;`

// Array operations
const items = ['apple', 'banana', 'cherry'];
const filtered = items.filter(item =>
// Suggests: `item.includes('a')`

// Promise handling
fetch('/api/data').then(res =>
// Suggests: `res.json()`
```

### TypeScript
```typescript
interface User {
  id: number;
  name: string;
}

function createUser(user: User):
// Suggests: `Promise<User>` or similar

const users: User[] = [];
users.sort((a, b) =>
// Suggests: `a.id - b.id`
```

### Dart/Flutter
```dart
class MyHomePage extends StatefulWidget {
  @override
  State<MyHomePage> createState() =>
  // Suggests: `_MyHomePageState();`

  ElevatedButton(
    onPressed: () =>
    // Suggests: `_incrementCounter(),`
```

## 🚢 Next Steps

1. ✅ Installation complete
2. ✅ API key configured
3. ✅ Test with sample code
4. 🎯 Adjust settings to your preference
5. 🚀 Enjoy enhanced coding with AI!

## 📞 Support

If you encounter issues:
1. Check this guide
2. Review README.md
3. Check output logs: View → Output → "Claude Autocomplete"
4. Verify API key at https://console.anthropic.com

---

**Happy coding! Let Claude help you write better code faster.** 🚀

Questions? Feedback? Check the official docs at https://docs.anthropic.com
