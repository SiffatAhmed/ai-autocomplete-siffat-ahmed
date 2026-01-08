import * as vscode from 'vscode';

export interface CodeContext {
  codeBefore: string;
  codeAfter: string;
  filePath: string;
  languageId: string;
  cursorLine: number;
  cursorColumn: number;
}

export class ContextManager {
  /**
   * Extract code context around cursor position
   */
  static extractContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    contextLinesBefore: number,
    contextLinesAfter: number
  ): CodeContext {
    const totalLines = document.lineCount;
    const cursorLine = position.line;

    // Calculate range for context before cursor
    const startLine = Math.max(0, cursorLine - contextLinesBefore);
    const beforeLines: string[] = [];

    for (let i = startLine; i < cursorLine; i++) {
      beforeLines.push(document.lineAt(i).text);
    }

    // Calculate range for context after cursor
    const endLine = Math.min(totalLines - 1, cursorLine + contextLinesAfter);
    const afterLines: string[] = [];

    for (let i = cursorLine + 1; i <= endLine; i++) {
      afterLines.push(document.lineAt(i).text);
    }

    const codeBefore = beforeLines.join('\n');
    const codeAfter = afterLines.join('\n');

    return {
      codeBefore,
      codeAfter,
      filePath: document.fileName,
      languageId: document.languageId,
      cursorLine,
      cursorColumn: position.character,
    };
  }

  /**
   * Generate language-specific system prompt
   */
  static getSystemPrompt(languageId: string): string {
    switch (languageId) {
      case 'javascript':
      case 'javascriptreact':
        return `You are an expert JavaScript code completion assistant. Your task is to complete the code at the <CURSOR> position.

CRITICAL INSTRUCTIONS:
1. Return ONLY the code completion - no markdown, explanations, comments, or backticks
2. Complete one logical statement or expression (not entire functions)
3. Use variables, functions, and objects that are visible in the context above and below
4. Match the code style and conventions in the provided context
5. Use modern ES6+ syntax (arrow functions, const/let, destructuring)
6. Do not duplicate closing brackets/parentheses that already exist after <CURSOR>
7. Return the completion as plain text only`;

      case 'typescript':
      case 'typescriptreact':
        return `You are an expert TypeScript code completion assistant. Your task is to complete the code at the <CURSOR> position.

CRITICAL INSTRUCTIONS:
1. Return ONLY the code completion - no markdown, explanations, comments, or backticks
2. Complete one logical statement or expression (not entire functions)
3. Use variables, functions, objects, and types that are visible in the context above and below
4. Match the code style and conventions in the provided context
5. Use modern ES6+ syntax with proper TypeScript types
6. Do not duplicate closing brackets/parentheses that already exist after <CURSOR>
7. Infer types from context when helpful
8. Return the completion as plain text only`;

      case 'dart':
        return `You are an expert Dart code completion assistant. Your task is to complete the code at the <CURSOR> position.

CRITICAL INSTRUCTIONS:
1. Return ONLY the code completion - no markdown, explanations, comments, or backticks
2. Complete one logical statement or expression (not entire functions)
3. Use variables, functions, and objects that are visible in the context above and below
4. Match the code style and conventions in the provided context
5. Use Dart best practices (null safety, const constructors, proper typing)
6. Do not duplicate closing brackets/parentheses that already exist after <CURSOR>
7. Return the completion as plain text only`;

      default:
        return `Complete the code at <CURSOR>. Return ONLY the completion code as plain text, no explanations. Complete one logical expression using available variables and context. Do not add closing brackets/parentheses that already exist after the cursor.`;
    }
  }

  /**
   * Extract variable and function names from code
   */
  private static extractAvailableNames(code: string): { variables: string[]; functions: string[] } {
    const variables = new Set<string>();
    const functions = new Set<string>();

    // Match variable declarations (const, let, var, function names)
    const varMatches = code.match(/(?:const|let|var|function)\s+(\w+)/g) || [];
    varMatches.forEach((match) => {
      const name = match.replace(/(?:const|let|var|function)\s+/, '');
      if (match.includes('function')) {
        functions.add(name);
      } else {
        variables.add(name);
      }
    });

    // Match function declarations
    const funcMatches = code.match(/function\s+(\w+)/g) || [];
    funcMatches.forEach((match) => {
      const name = match.replace('function ', '');
      functions.add(name);
    });

    // Match arrow functions
    const arrowMatches = code.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g) || [];
    arrowMatches.forEach((match) => {
      const name = match.match(/(\w+)\s*=/)?.[1];
      if (name) {
        functions.add(name);
      }
    });

    // Match parameter names from function declarations
    const paramMatches = code.match(/\(([^)]*)\)/g) || [];
    paramMatches.forEach((match) => {
      const params = match.slice(1, -1).split(',');
      params.forEach((param) => {
        const name = param.trim().split(/[=:]/)[0].trim();
        if (name && /^\w+$/.test(name)) {
          variables.add(name);
        }
      });
    });

    return {
      variables: Array.from(variables),
      functions: Array.from(functions),
    };
  }

  /**
   * Build user prompt for completion request
   */
  static buildUserPrompt(context: CodeContext): string {
    const { codeBefore, codeAfter, filePath, languageId, cursorLine, cursorColumn } = context;
    const availableNames = this.extractAvailableNames(codeBefore);

    let prompt = `File: ${filePath}
Language: ${languageId}
Current line: ${cursorLine + 1}
Current column: ${cursorColumn + 1}

Available variables and functions in scope:
${availableNames.variables.length > 0 ? `Variables: ${availableNames.variables.join(', ')}` : 'Variables: none'}
${availableNames.functions.length > 0 ? `Functions: ${availableNames.functions.join(', ')}` : 'Functions: none'}

Code before cursor:
${codeBefore}
<CURSOR>
Code after cursor:
${codeAfter}

Complete the code at <CURSOR> using the available variables and functions. Output only the code completion.`;

    return prompt;
  }

  /**
   * Check if position is in a comment
   */
  static isInComment(document: vscode.TextDocument, position: vscode.Position): boolean {
    const line = document.lineAt(position.line).text;
    const beforeCursor = line.substring(0, position.character);

    // Simple check for single-line comments
    if (beforeCursor.includes('//')) {
      return true;
    }

    // Check for block comments (simplified)
    const textBefore = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    const openBlockComments = (textBefore.match(/\/\*/g) || []).length;
    const closeBlockComments = (textBefore.match(/\*\//g) || []).length;

    return openBlockComments > closeBlockComments;
  }

  /**
   * Check if position is in a string literal
   */
  static isInString(document: vscode.TextDocument, position: vscode.Position): boolean {
    const line = document.lineAt(position.line).text;
    const beforeCursor = line.substring(0, position.character);

    // Count quotes before cursor
    const singleQuotes = (beforeCursor.match(/'/g) || []).length;
    const doubleQuotes = (beforeCursor.match(/"/g) || []).length;
    const backticks = (beforeCursor.match(/`/g) || []).length;

    // Simple heuristic: if count is odd, we're inside a string
    return singleQuotes % 2 === 1 || doubleQuotes % 2 === 1 || backticks % 2 === 1;
  }

  /**
   * Get current line content up to cursor
   */
  static getCurrentLinePrefix(document: vscode.TextDocument, position: vscode.Position): string {
    const line = document.lineAt(position.line).text;
    return line.substring(0, position.character);
  }

  /**
   * Get current word being typed
   */
  static getCurrentWord(document: vscode.TextDocument, position: vscode.Position): string {
    const line = document.lineAt(position.line).text;
    let wordStart = position.character - 1;

    // Move back while character is word-like
    while (wordStart >= 0 && /[\w$]/.test(line[wordStart])) {
      wordStart--;
    }

    return line.substring(wordStart + 1, position.character);
  }

  /**
   * Check if should trigger completion
   */
  static shouldTriggerCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    languageId: string
  ): boolean {
    // Don't complete in comments or strings
    if (this.isInComment(document, position) || this.isInString(document, position)) {
      return false;
    }

    // Don't complete on empty lines
    const line = document.lineAt(position.line).text;
    const beforeCursor = line.substring(0, position.character);
    if (beforeCursor.trim().length === 0) {
      return false;
    }

    return true;
  }
}
