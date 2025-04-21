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
        // Find blocks to collapse using indentation
        const blocksToCollapse = findBlocksToCollapseByIndentation(text, ignorePatterns);
        // Collapse blocks
        if (blocksToCollapse.length > 0) {
            collapseOuterBlocks(editor, blocksToCollapse);
        }
    });
    context.subscriptions.push(disposable);
}

interface Block {
    startLine: number;
    endLine: number;
    parent?: Block;
    children: Block[];
}

function buildIndentationBlockTree(lines: string[]): Block[] {
    const rootBlocks: Block[] = [];
    const stack: { block: Block; indent: number }[] = [];
    function getIndent(line: string) {
        // Count leading spaces or tabs
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue; // skip empty lines
        const indent = getIndent(line);
        // Ignore comment-only lines
        if (/^\s*#/.test(line)) continue;
        // Find parent block
        while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
            // Close the last block
            const finished = stack.pop();
            if (finished) finished.block.endLine = i - 1;
        }
        // Create new block
        const block: Block = {
            startLine: i,
            endLine: lines.length - 1, // will be updated when closed
            children: []
        };
        if (stack.length > 0) {
            block.parent = stack[stack.length - 1].block;
            stack[stack.length - 1].block.children.push(block);
        } else {
            rootBlocks.push(block);
        }
        stack.push({ block, indent });
    }
    // Close any remaining open blocks
    while (stack.length > 0) {
        const finished = stack.pop();
        if (finished) finished.block.endLine = lines.length - 1;
    }
    return rootBlocks;
}

function findBlocksToCollapseByIndentation(text: string, ignorePatterns: string[]): Block[] {
    const lines = text.split('\n');
    const rootBlocks = buildIndentationBlockTree(lines);
    const regexPatterns = ignorePatterns.map(pattern => new RegExp(pattern));
    const blocksToCollapse: Block[] = [];
    for (const block of rootBlocks) {
        const line = lines[block.startLine]?.trim() || '';
        const isIgnored = regexPatterns.some(re => re.test(line));
        if (isIgnored) {
            // Collapse immediate children only
            for (const child of block.children) {
                if (child.endLine > child.startLine) {
                    blocksToCollapse.push(child);
                }
            }
        } else {
            if (block.endLine > block.startLine) {
                blocksToCollapse.push(block);
            }
        }
    }
    return blocksToCollapse;
}

function collapseOuterBlocks(editor: vscode.TextEditor, blocks: Block[]) {
    if (blocks.length === 0) return;
    const originalSelections = editor.selections;
    const foldPromises = blocks.map(block => {
        // Fold the start line (VSCode folds by line, not by char)
        return vscode.commands.executeCommand('editor.fold', { selectionLines: [block.startLine] });
    });
    Promise.all(foldPromises).then(() => {
        editor.selections = originalSelections;
    });
}

export function deactivate() { }