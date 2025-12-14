# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-12-14

### Added
- Initial release of Claude Autocomplete extension
- Inline code completions for JavaScript, TypeScript, and Dart
- Support for JSX and TSX files
- Language-specific prompts and context extraction
- LRU cache with configurable TTL
- Request throttling and debouncing
- Configuration UI for API key and settings
- Manual trigger command (Ctrl+Shift+Space)
- Toggle enable/disable functionality
- Clear cache command
- Error handling with user notifications
- Rate limiting with exponential backoff
- Secure API key storage in VS Code settings
- Smart context extraction (30 lines before, 10 lines after)
- Detection of code/comment/string contexts

### Features
- **Core Functionality**
  - Automatic inline completions while typing
  - Manual completion trigger
  - Cache-based performance optimization

- **Configuration**
  - Configurable API key
  - Enable/disable toggle
  - Model selection
  - Max tokens control
  - Temperature setting
  - Debounce delay adjustment
  - Context window sizing

- **Language Support**
  - JavaScript (.js, .mjs)
  - JavaScript React (.jsx)
  - TypeScript (.ts)
  - TypeScript React (.tsx)
  - Dart (.dart)

### Performance
- ~300ms debounce to reduce API calls
- 100-entry LRU cache with 5-minute TTL
- 5-second request timeout
- Exponential backoff on rate limits

### Known Limitations
- No completions in comments or string literals
- Requires internet connection
- API key stored in plain settings (but VS Code encrypts it)
- Maximum context is limited to prevent token overflow
