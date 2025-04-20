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
        // Find blocks to collapse
        const blocksToCollapse = findBlocksToCollapse(text, ignorePatterns);
        console.log('Blocks to collapse:', blocksToCollapse);
        // Collapse blocks
        if (blocksToCollapse.length > 0) {
            collapseOuterBlocks(editor, blocksToCollapse);
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
    parent?: Block;
    children?: Block[];
}

function findAllBlocks(text: string): Block[] {
    const blocks: Block[] = [];
    const stack: { index: number, line: number, char: string, block?: Block }[] = [];
    let inString = false;
    let stringChar = '';
    let inSingleLineComment = false;
    let inMultiLineComment = false;
    let currentLine = 0;
    const blockPairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
    const blockOpen = Object.keys(blockPairs);
    const blockClose = Object.values(blockPairs);
    const lineMap: number[] = [];
    for (let i = 0, l = 0; i < text.length; i++) {
        lineMap[i] = l;
        if (text[i] === '\n') l++;
    }
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const prevChar = i > 0 ? text[i - 1] : '';
        const nextChar = i < text.length - 1 ? text[i + 1] : '';
        if (char === '\n') {
            currentLine++;
            inSingleLineComment = false;
            continue;
        }
        if (!inString && !inSingleLineComment && !inMultiLineComment) {
            if (char === '/' && nextChar === '/') {
                inSingleLineComment = true;
                i++;
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
        if (!inString && (char === '"' || char === "'" || char === '`')) {
            inString = true;
            stringChar = char;
            continue;
        } else if (inString && char === stringChar && prevChar !== '\\') {
            inString = false;
            continue;
        }
        if (inString) continue;
        if (blockOpen.includes(char)) {
            const block: Block = {
                start: i,
                end: -1,
                startLine: lineMap[i],
                endLine: -1,
                content: '',
                children: []
            };
            if (stack.length > 0) {
                block.parent = stack[stack.length - 1].block;
                stack[stack.length - 1].block!.children!.push(block);
            }
            stack.push({ index: i, line: lineMap[i], char, block });
        }
        if (blockClose.includes(char)) {
            if (stack.length > 0) {
                const last = stack[stack.length - 1];
                if (blockPairs[last.char] === char) {
                    const block = last.block!;
                    block.end = i;
                    block.endLine = lineMap[i];
                    block.content = text.substring(block.start, i + 1);
                    if (!block.parent) blocks.push(block); // Only push root blocks here
                    stack.pop();
                }
            }
        }
    }
    return blocks;
}

function flattenBlocks(blocks: Block[]): Block[] {
    // Recursively flatten block tree
    let result: Block[] = [];
    for (const block of blocks) {
        result.push(block);
        if (block.children && block.children.length > 0) {
            result = result.concat(flattenBlocks(block.children));
        }
    }
    return result;
}

function findBlocksToCollapse(text: string, ignorePatterns: string[]): Block[] {
    const rootBlocks = findAllBlocks(text);
    const allBlocks = flattenBlocks(rootBlocks);
    const lines = text.split('\n');
    const regexPatterns = ignorePatterns.map(pattern => new RegExp(pattern));
    const ignoredBlocks = allBlocks.filter(block => {
        const line = lines[block.startLine]?.trim() || '';
        return regexPatterns.some(re => re.test(line));
    });
    const blocksToCollapse: Set<Block> = new Set();
    // For each ignored block, collapse its immediate children
    for (const ignored of ignoredBlocks) {
        if (ignored.children) {
            for (const child of ignored.children) {
                blocksToCollapse.add(child);
            }
        }
    }
    // For all root blocks not ignored or inside an ignored block, collapse them
    for (const block of rootBlocks) {
        // If this block is not ignored and not a descendant of an ignored block
        const isIgnored = ignoredBlocks.includes(block);
        if (!isIgnored) {
            blocksToCollapse.add(block);
        }
    }
    return Array.from(blocksToCollapse);
}

function collapseOuterBlocks(editor: vscode.TextEditor, blocks: Block[]) {
    if (blocks.length === 0) return;
    const originalSelections = editor.selections;
    const foldPromises = blocks.map(block => {
        const startPos = editor.document.positionAt(block.start);
        return vscode.commands.executeCommand('editor.fold', { selectionLines: [startPos.line] });
    });
    Promise.all(foldPromises).then(() => {
        editor.selections = originalSelections;
    });
}

export function deactivate() { }