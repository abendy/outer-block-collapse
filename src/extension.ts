import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('outer-block-collapse.collapse', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const text = document.getText();

        // Get ignore patterns from configuration
        const config = vscode.workspace.getConfiguration('outerBlockCollapse');
        const ignorePatterns = config.get<string[]>('ignorePatterns') || [];
        console.log('Ignore patterns:', ignorePatterns);

        // Find outermost blocks
        const outerBlocks = findOuterBlocks(text, ignorePatterns);
        console.log('Found blocks:', outerBlocks);

        // Collapse blocks
        if (outerBlocks.length > 0) {
            collapseOuterBlocks(editor, outerBlocks);
        }
    });

    context.subscriptions.push(disposable);
}

interface Block {
    start: number;
    end: number;
    startLine: number;
    endLine: number;
    content: string;
}

function findOuterBlocks(text: string, ignorePatterns: string[]): Block[] {
    const blocks: Block[] = [];
    const stack: { index: number, line: number }[] = [];
    let inString = false;
    let stringChar = '';

    // Convert patterns to RegExp
    const regexPatterns = ignorePatterns.map(pattern => new RegExp(pattern));

    // Track line numbers
    let currentLine = 0;
    const lines = text.split('\n');

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Update line count
        if (char === '\n') {
            currentLine++;
            continue;
        }

        // Handle string literals
        if ((char === '"' || char === "'" || char === '`') && text[i - 1] !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
            continue;
        }

        if (inString) continue;

        // Check if current line should be ignored
        const currentLineText = lines[currentLine];
        if (regexPatterns.some(pattern => pattern.test(currentLineText.trim()))) {
            continue;
        }

        // Handle block starts
        if (char === '{' || char === '[' || char === '(') {
            if (stack.length === 0) {
                // Only track outermost blocks
                stack.push({ index: i, line: currentLine });
            }
        }

        // Handle block ends
        if (char === '}' || char === ']' || char === ')') {
            if (stack.length === 1) {  // Only process outermost blocks
                const start = stack[0];
                const content = text.substring(start.index, i + 1);

                // Only add if block spans multiple lines
                if (currentLine > start.line) {
                    blocks.push({
                        start: start.index,
                        end: i,
                        startLine: start.line,
                        endLine: currentLine,
                        content: content
                    });
                }
            }
            if (stack.length > 0) {
                stack.pop();
            }
        }
    }

    return blocks;
}

function collapseOuterBlocks(editor: vscode.TextEditor, blocks: Block[]) {
    // Create a single selection for each outer block
    editor.selections = blocks.map(block => {
        const startPos = editor.document.positionAt(block.start);
        // Include the closing character in the selection
        const endPos = editor.document.positionAt(block.end + 1);
        return new vscode.Selection(startPos, endPos);
    });

    // Fold only the selected regions
    vscode.commands.executeCommand('editor.fold');
}

export function deactivate() { }