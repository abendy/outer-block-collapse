# Outer Block Collapse Extension

A VSCode extension that collapses all outermost code blocks (functions, arrays, objects) while keeping their inner content expanded. This helps you get a quick overview of your code structure while maintaining access to the implementation details.

## Features

- Collapses outermost code blocks (defined by {}, [], or () pairs)
- Preserves inner content expansion
- Handles nested blocks correctly
- Skips blocks within string literals and comments
- Works with any file type
- **Configurable ignore patterns:**
  - If a block's start line matches an ignore pattern (e.g., a class definition), that block is not collapsed.
  - Instead, its immediate child blocks (e.g., methods inside a class) are collapsed, while their inner content remains expanded.

### Example

Suppose you have this code and the ignore pattern is `^class`:

```js
class MyClass {
    methodOne() {
        // ...
    }
    methodTwo() {
        // ...
    }
}
```

- The class block is not collapsed.
- Both `methodOne` and `methodTwo` blocks are collapsed.
- Code inside those methods remains expanded.

## Configuration

You can configure which lines to ignore using regular expressions in your VSCode settings:

```json
{
  "outerBlockCollapse.ignorePatterns": [
    "^@",           // Ignore lines starting with @
    "^\\s*import ", // Ignore import statements
    "^class"         // Ignore class definitions (collapses methods inside instead)
  ]
}
```

By default, the extension ignores lines starting with `@` (common for decorators). You can add more patterns in your settings.json or through the Settings UI.

## Installation

### VSCode

1. Download the latest `.vsix` file from the releases
2. Open VSCode
3. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (Mac) to open the Extensions view
4. Click on the "..." (More Actions) menu
5. Select "Install from VSIX..."
6. Choose the downloaded .vsix file

## Usage

You can collapse outer blocks in two ways:

### Using Keyboard Shortcut

- Windows/Linux: Press `Ctrl+K Ctrl+0`
- Mac: Press `Cmd+K Cmd+0`

### Using Command Palette

1. Open any code file
2. Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Type "Collapse Outer Blocks" and select the command
4. The outermost blocks will be collapsed while inner content remains expanded

The keyboard shortcut was chosen to be similar to VSCode's built-in "Fold All" (`Ctrl+K Ctrl+0`), making it intuitive for users familiar with VSCode's folding shortcuts.

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- VSCode (for testing)

### Setup

Clone the repository:

```bash
git clone <your-repo-url>
cd outer-block-collapse
```

Install dependencies:

```bash
yarn install
```

Build the extension:

```bash
yarn run compile
```

### Testing in Development

1. Press F5 in VSCode to launch a new Extension Development Host window
2. Open a file with some nested blocks
3. Use the command palette to run "Collapse Outer Blocks"
4. Make changes to the code and press F5 to reload

### Creating a VSIX Package

Install vsce globally:

```bash
npm install -g @vscode/vsce
```

Package the extension:

```bash
vsce package
```

This will create a `.vsix` file in your directory that can be installed in VSCode.

### Project Structure

```text
outer-block-collapse/
  ├── package.json        # Extension manifest
  ├── tsconfig.json       # TypeScript configuration
  ├── README.md          # This file
  └── src/
      └── extension.ts    # Extension source code
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests (if available)
5. Submit a pull request

## Known Issues

- The extension currently doesn't handle language-specific block markers (like Python's indentation)
- Block detection is based on character matching and might not handle all edge cases in comments or strings
