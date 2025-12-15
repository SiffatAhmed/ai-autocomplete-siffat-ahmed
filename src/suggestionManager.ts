import * as vscode from 'vscode';

interface PendingSuggestion {
  text: string;
  position: vscode.Position;
  editor: vscode.TextEditor;
}

export class SuggestionManager {
  private pendingSuggestion: PendingSuggestion | null = null;
  private decorationType: vscode.TextEditorDecorationType;
  private changeListener: vscode.Disposable | null = null;
  private selectionListener: vscode.Disposable | null = null;

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('editorGhostText.foreground'),
        fontStyle: 'italic',
      },
    });
  }

  /**
   * Show a suggestion as grey overlay text at the cursor position
   */
  showSuggestion(editor: vscode.TextEditor, suggestionText: string, position: vscode.Position): void {
    // Clear any previous suggestion
    this.clearSuggestion();

    // Store the pending suggestion
    this.pendingSuggestion = {
      text: suggestionText,
      position,
      editor,
    };

    // Update context key for keybindings
    vscode.commands.executeCommand('setContext', 'claudeSuggestionVisible', true);

    // Apply decoration
    this.renderDecoration();

    // Listen for document changes
    this.setupChangeListener();
    this.setupSelectionListener();
  }

  /**
   * Accept the current suggestion and insert it into the document
   */
  acceptSuggestion(): boolean {
    if (!this.pendingSuggestion) {
      return false;
    }

    const { editor, position, text } = this.pendingSuggestion;

    // Only accept if the editor is still active and the position matches
    if (vscode.window.activeTextEditor !== editor) {
      this.clearSuggestion();
      return false;
    }

    // Insert the text
    editor.edit((editBuilder) => {
      editBuilder.insert(position, text);
    }).then((success) => {
      if (success) {
        this.clearSuggestion();
      }
    });

    return true;
  }

  /**
   * Reject the current suggestion and remove it
   */
  rejectSuggestion(): boolean {
    if (!this.pendingSuggestion) {
      return false;
    }

    this.clearSuggestion();
    return true;
  }

  /**
   * Clear the current suggestion
   */
  private clearSuggestion(): void {
    if (this.pendingSuggestion) {
      const editor = this.pendingSuggestion.editor;
      // Clear decorations
      editor.setDecorations(this.decorationType, []);
      this.pendingSuggestion = null;
    }

    // Update context key
    vscode.commands.executeCommand('setContext', 'claudeSuggestionVisible', false);

    // Clean up listeners
    if (this.changeListener) {
      this.changeListener.dispose();
      this.changeListener = null;
    }
    if (this.selectionListener) {
      this.selectionListener.dispose();
      this.selectionListener = null;
    }
  }

  /**
   * Render the decoration for the suggestion
   */
  private renderDecoration(): void {
    if (!this.pendingSuggestion) {
      return;
    }

    const { editor, position, text } = this.pendingSuggestion;

    // Create range for decoration (at the cursor position)
    const range = new vscode.Range(position, position);

    // Set the decoration with the suggestion text
    editor.setDecorations(this.decorationType, [
      {
        range,
        renderOptions: {
          after: {
            contentText: text,
          },
        },
      },
    ]);
  }

  /**
   * Setup listener for document changes
   */
  private setupChangeListener(): void {
    this.changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (!this.pendingSuggestion) {
        return;
      }

      // Clear suggestion if the document changed (user started typing)
      if (event.document === this.pendingSuggestion.editor.document) {
        this.clearSuggestion();
      }
    });
  }

  /**
   * Setup listener for cursor/selection changes
   */
  private setupSelectionListener(): void {
    this.selectionListener = vscode.window.onDidChangeTextEditorSelection((event) => {
      if (!this.pendingSuggestion) {
        return;
      }

      // If cursor moved away from suggestion position, clear it
      if (event.textEditor === this.pendingSuggestion.editor) {
        const currentPos = event.textEditor.selection.active;
        const suggestionPos = this.pendingSuggestion.position;

        // If cursor is not at the suggestion position, clear the suggestion
        if (currentPos.line !== suggestionPos.line || currentPos.character !== suggestionPos.character) {
          this.clearSuggestion();
        }
      }
    });
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearSuggestion();
    this.decorationType.dispose();
  }
}
