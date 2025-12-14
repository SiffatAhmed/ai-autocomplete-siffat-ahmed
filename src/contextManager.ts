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
        return `You are an expert JavaScript code completion assistant. Complete the JavaScript code at <CURSOR>.
Return ONLY the completion without markdown, explanations, or comments.
Focus on modern ES6+ syntax, async/await patterns, and best practices.`;

      case 'typescript':
      case 'typescriptreact':
        return `You are an expert TypeScript code completion assistant. Complete the TypeScript code at <CURSOR>.
Return ONLY the completion without markdown, explanations, or comments.
Focus on type safety, modern ES6+ syntax, async/await patterns, and TypeScript idioms.`;

      case 'dart':
        return `You are an expert Dart code completion assistant. Complete the Dart code at <CURSOR>.
Return ONLY the completion without markdown, explanations, or comments.
Focus on Flutter widget patterns, null safety operators, async streams, and Dart idioms.`;

      default:
        return 'Complete the following code. Return only the completion without markdown or explanations.';
    }
  }

  /**
   * Build user prompt for completion request
   */
  static buildUserPrompt(context: CodeContext): string {
    const { codeBefore, codeAfter, filePath, languageId, cursorLine, cursorColumn } = context;

    return `File: ${filePath}
Language: ${languageId}
Current line: ${cursorLine + 1}
Current column: ${cursorColumn + 1}

Code before cursor:
${codeBefore}
<CURSOR>
Code after cursor:
${codeAfter}

Complete the code at <CURSOR>. Output only the code to insert, no markdown or explanation.`;
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
