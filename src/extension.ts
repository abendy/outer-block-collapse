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
    const stack: { index: number, line: number, char: string }[] = [];
    let inString = false;
    let stringChar = '';
    let inSingleLineComment = false;
    let inMultiLineComment = false;
    let currentLine = 0;
    const lines = text.split('\n');
    const blockPairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
    const blockOpen = Object.keys(blockPairs);
    const blockClose = Object.values(blockPairs);

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const prevChar = i > 0 ? text[i - 1] : '';
        const nextChar = i < text.length - 1 ? text[i + 1] : '';

        // Update line count
        if (char === '\n') {
            currentLine++;
            inSingleLineComment = false;
            continue;
        }

        // Handle comments
        if (!inString && !inSingleLineComment && !inMultiLineComment) {
            if (char === '/' && nextChar === '/') {
                inSingleLineComment = true;
                i++; // skip nextChar
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inMultiLineComment = true;
                i++;
                continue;
            }
        } else if (inMultiLineComment && char === '*' && nextChar === '/') {
            inMultiLineComment = false;
            i++;
            continue;
        }
        if (inSingleLineComment || inMultiLineComment) continue;

        // Handle string literals (basic, not perfect)
        if (!inString && (char === '"' || char === "'" || char === '`')) {
            inString = true;
            stringChar = char;
            continue;
        } else if (inString && char === stringChar && prevChar !== '\\') {
            inString = false;
            continue;
        }
        if (inString) continue;

        // Handle block starts
        if (blockOpen.includes(char)) {
            if (stack.length === 0) {
                stack.push({ index: i, line: currentLine, char });
            } else {
                stack.push({ index: i, line: currentLine, char });
            }
        }
        // Handle block ends
        if (blockClose.includes(char)) {
            if (stack.length > 0) {
                const last = stack[stack.length - 1];
                if (blockPairs[last.char] === char) {
                    if (stack.length === 1) { // Only root-level
                        const start = last;
                        const endLine = currentLine;
                        if (endLine > start.line) {
                            blocks.push({
                                start: start.index,
                                end: i,
                                startLine: start.line,
                                endLine: endLine,
                                content: text.substring(start.index, i + 1)
                            });
                        }
                    }
                    stack.pop();
                }
            }
        }
    }
    // Apply ignore patterns after block detection
    if (ignorePatterns.length > 0) {
        const regexPatterns = ignorePatterns.map(pattern => new RegExp(pattern));
        return blocks.filter(block => {
            const blockLines = block.content.split('\n').map(l => l.trim());
            return !blockLines.some(line => regexPatterns.some(re => re.test(line)));
        });
    }
    return blocks;
}

function collapseOuterBlocks(editor: vscode.TextEditor, blocks: Block[]) {
    if (blocks.length === 0) return;
    const originalSelections = editor.selections;
    const foldPromises = blocks.map(block => {
        const startPos = editor.document.positionAt(block.start);
        // Fold the start line (VSCode folds by line, not by char)
        return vscode.commands.executeCommand('editor.fold', { selectionLines: [startPos.line] });
    });
    Promise.all(foldPromises).then(() => {
        editor.selections = originalSelections;
    });
}

export function deactivate() { }