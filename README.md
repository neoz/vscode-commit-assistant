# Claude Commit Message

A VS Code extension that generates git commit messages using [Claude Code](https://claude.ai/code) CLI.

## Prerequisites

- [Claude Code CLI](https://claude.ai/code) installed and authenticated
- Git repository

## Installation

### From VSIX

1. Download the `.vsix` file from releases
2. In VS Code, open Extensions (Ctrl+Shift+X)
3. Click `...` > "Install from VSIX..."
4. Select the downloaded file

### From Source

```bash
git clone https://github.com/neoz/claude-commit.git
cd claude-commit
npm install
npm run compile
```

Then press F5 in VS Code to launch Extension Development Host.

## Building VSIX

To package the extension for distribution:

```bash
npm install
npm run package
```

This creates `claude-commit-0.0.1.vsix` which can be shared and installed via "Install from VSIX..." in VS Code.

## Usage

1. Stage your changes (`git add`)
2. Click the sparkle icon in the Source Control view
3. Wait for Claude to generate a commit message
4. Review and commit

The extension generates conventional commit messages in the format:
```
type(scope): description
```

## Features

- Generates concise, conventional commit messages
- Works with staged changes only
- Shows progress indicator while generating
- 60 second timeout for large diffs
- Cross-platform support (Windows, macOS, Linux)

## Requirements

- VS Code 1.85.0 or higher
- Claude Code CLI in PATH

## Extension Settings

This extension has no configurable settings.

## Known Issues

- Large diffs (>10KB) are truncated before sending to Claude

## License

MIT
