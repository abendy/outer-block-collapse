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

        // Debug output
        console.log('Ignore patterns:', ignorePatterns);

        // Find outermost blocks
        const outerBlocks = findOuterBlocks(text, ignorePatterns);

        // Debug output
        console.log('Found blocks:', outerBlocks.length);

        // Collapse each block
        if (outerBlocks.length > 0) {
            collapseBlocks(editor, outerBlocks);
        }
    });

    context.subscriptions.push(disposable);
}

interface Block {
    start: number;
    end: number;
    startLine: number;
    endLine: number;
    ignored: boolean;
}

function shouldIgnoreLine(line: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(line.trim()));
}

function findOuterBlocks(text: string, ignorePatterns: string[]): Block[] {
    const blocks: Block[] = [];
    const stack: Block[] = [];
    let inString = false;
    let stringChar = '';
    let currentLevel = 0;

    // Convert patterns to RegExp
    const regexPatterns = ignorePatterns.map(pattern => new RegExp(pattern));

    // Split into lines for line number tracking
    const lines = text.split('\n');
    let currentLine = 0;
    let currentPos = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Track line numbers
        if (char === '\n') {
            currentLine++;
            currentPos = 0;
        } else {
            currentPos++;
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

        // Handle block starts
        if (char === '{' || char === '[' || char === '(') {
            const currentLineText = lines[currentLine];
            const isIgnored = shouldIgnoreLine(currentLineText, regexPatterns);

            const block: Block = {
                start: i,
                end: -1,
                startLine: currentLine,
                endLine: -1,
                ignored: isIgnored
            };

            if (currentLevel === 0 && !isIgnored) {
                blocks.push(block);
            }

            stack.push(block);
            currentLevel++;
        }

        // Handle block ends
        if (char === '}' || char === ']' || char === ')') {
            const block = stack.pop();
            currentLevel--;

            if (block) {
                block.end = i;
                block.endLine = currentLine;

                // Only consider it if it's an outermost block and not ignored
                if (currentLevel === 0 && !block.ignored) {
                    // Update the block in our blocks array
                    const existingBlock = blocks.find(b => b.start === block.start);
                    if (existingBlock) {
                        existingBlock.end = block.end;
                        existingBlock.endLine = block.endLine;
                    }
                }
            }
        }
    }

    // Filter out incomplete blocks and validate
    const validBlocks = blocks.filter(block => {
        // Must have both start and end
        if (block.end === -1 || block.endLine === -1) return false;

        // Must span multiple lines to be worth collapsing
        if (block.startLine === block.endLine) return false;

        // Must not be ignored
        if (block.ignored) return false;

        return true;
    });

    // Debug output
    console.log('Valid blocks:', validBlocks.map(b => ({
        startLine: b.startLine,
        endLine: b.endLine,
        ignored: b.ignored
    })));

    return validBlocks;
}

function collapseBlocks(editor: vscode.TextEditor, blocks: Block[]) {
    // Create selections for each block
    editor.selections = blocks.map(block => {
        const startPos = editor.document.positionAt(block.start);
        const endPos = editor.document.positionAt(block.end + 1);
        return new vscode.Selection(startPos, endPos);
    });

    // Use the fold command
    if (blocks.length > 0) {
        vscode.commands.executeCommand('editor.fold');
    }
}

export function deactivate() { }