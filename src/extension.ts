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

interface StackItem {
    index: number;
    ignored: boolean;
}

function findOuterBlocks(text: string): Block[] {
    const blocks: Block[] = [];
    const stack: StackItem[] = [];
    let inString = false;
    let stringChar = '';

    // Get ignore patterns from configuration
    const config = vscode.workspace.getConfiguration('outerBlockCollapse');
    const ignorePatterns = config.get<string[]>('ignorePatterns') || [];
    const regexPatterns = ignorePatterns.map(pattern => new RegExp(pattern));

    // Split text into lines for ignore pattern checking
    const lines = text.split('\n');
    const ignoredLineIndices = new Set<number>();

    // Find all lines that match ignore patterns
    lines.forEach((line, index) => {
        if (regexPatterns.some(pattern => pattern.test(line.trim()))) {
            ignoredLineIndices.add(index);
        }
    });

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
            // Get the line number for this character position
            const lineNumber = text.substring(0, i).split('\n').length - 1;
            const isIgnored = ignoredLineIndices.has(lineNumber);

            // Add to stack with ignored flag
            if (stack.length === 0 && !isIgnored) {
                // This is an outer block
                blocks.push({ start: i, end: -1 });
            }
            stack.push({ index: i, ignored: isIgnored });
        }

        // Handle block ends
        if (char === '}' || char === ']' || char === ')') {
            const lastItem = stack.pop();
            if (lastItem && !lastItem.ignored && stack.length === 0) {
                // Find and update the corresponding outer block
                const block = blocks.find(b => b.start === lastItem.index);
                if (block) {
                    block.end = i;
                }
            }
        }
    }

    return blocks.filter(block => block.end !== -1);
}

function collapseBlocks(editor: vscode.TextEditor, blocks: Block[]) {
    // Create folding ranges
    const foldingRanges = blocks.map(block => {
        const startPos = editor.document.positionAt(block.start);
        const endPos = editor.document.positionAt(block.end + 1);
        return new vscode.FoldingRange(startPos.line, endPos.line);
    });

    // Apply folding
    if (foldingRanges.length > 0) {
        vscode.commands.executeCommand('editor.fold', {
            selectionLines: foldingRanges.map(range => range.start)
        });
    }
}

export function deactivate() { }