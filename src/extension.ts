import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('outer-block-collapse.collapse', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const text = document.getText();

        // Find outermost blocks
        const outerBlocks = findOuterBlocks(text);

        // Collapse each block
        collapseBlocks(editor, outerBlocks);
    });

    context.subscriptions.push(disposable);
}

interface Block {
    start: number;
    end: number;
}

function findOuterBlocks(text: string): Block[] {
    const blocks: Block[] = [];
    const stack: number[] = [];
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

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

        // Handle block starts
        if (char === '{' || char === '[' || char === '(') {
            if (stack.length === 0) {
                // This is an outer block
                blocks.push({ start: i, end: -1 });
            }
            stack.push(i);
        }

        // Handle block ends
        if (char === '}' || char === ']' || char === ')') {
            const start = stack.pop();
            if (stack.length === 0 && start !== undefined) {
                // Find and update the corresponding outer block
                const block = blocks.find(b => b.start === start);
                if (block) {
                    block.end = i;
                }
            }
        }
    }

    return blocks.filter(block => block.end !== -1);
}

function collapseBlocks(editor: vscode.TextEditor, blocks: Block[]) {
    editor.selections = blocks.map(block => {
        const startPos = editor.document.positionAt(block.start);
        const endPos = editor.document.positionAt(block.end + 1);
        return new vscode.Selection(startPos, endPos);
    });

    // Execute fold command for all selections
    vscode.commands.executeCommand('editor.fold');
}

export function deactivate() { }