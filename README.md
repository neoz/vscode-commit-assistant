# Claude Commit Message

A VS Code extension that generates git commit messages using AI. Supports [Claude Code](https://claude.ai/code) CLI or VS Code Language Models (GitHub Copilot, etc.).

## Prerequisites

**Option A: Claude Code (default)**
- [Claude Code CLI](https://claude.ai/code) installed and authenticated

**Option B: VS Code Language Models**
- GitHub Copilot or another VS Code Language Model provider
- VS Code 1.85.0 or higher

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

## Usage

1. Stage your changes (`git add`)
2. Click the sparkle icon in the Source Control view
3. Wait for AI to generate a commit message
4. Review and commit

### Split Commits

When the AI detects unrelated changes, it suggests splitting into multiple commits. You can:

- **Pick a single commit** to stage just that commit's files
- **Stage all step by step** to walk through each commit sequentially:
  1. The first commit's files are staged and its message is set
  2. A status bar item shows your progress (e.g., "Split 1/3 | Next: fix(api)...")
  3. After you commit, the next commit is automatically staged
  4. Click the status bar item to skip to the next commit or cancel the session
  5. Cancel at any point during staging via the progress dialog
  6. Repeat until all commits are done

The extension generates conventional commit messages in the format:
```
type(scope): description
```

### Switching Providers

To use VS Code Language Models instead of Claude:

1. Open VS Code Settings
2. Search for "claude-commit"
3. Set `Provider` to `vscode-lm`
4. Optionally set `Model` to your preferred model family (e.g., `gpt-4o`)

## Features

- **Multi-provider support**: Use Claude Code CLI or VS Code Language Models
- **Model selection**: Choose between Haiku (fast), Sonnet, or Opus for Claude
- **Split commit detection**: Suggests splitting unrelated changes into atomic commits
- **Step-by-step split commits**: Walk through all suggested commits sequentially with auto-advance
- **Cancellable split workflow**: Cancel staging or the entire split session at any point
- **Smart staging**: Auto-stages only relevant files for selected commit with verification
- **Sensitive file filtering**: Excludes .env, keys, and credentials from AI
- **Customizable prompts**: Adjust system/user prompts for your team's conventions
- **Progress indicator**: Shows generation status with cancel option
- **Cross-platform**: Works on Windows, macOS, and Linux

## Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `claude-commit.provider` | AI provider (`claude` or `vscode-lm`) | `claude` |
| `claude-commit.model` | Model to use (Claude: `haiku`/`sonnet`/`opus`, VS Code LM: model family) | `haiku` |
| `claude-commit.timeout` | Timeout in milliseconds (5000-120000) | `30000` |
| `claude-commit.prompt` | Custom system prompt (leave empty for default) | |
| `claude-commit.userPrompt` | Custom user prompt template with `{diff}` placeholder | |
| `claude-commit.excludePatterns` | Glob patterns for files to exclude from AI | `.env*`, `*.pem`, etc. |

## Requirements

- VS Code 1.85.0 or higher
- One of:
  - Claude Code CLI in PATH (for `claude` provider)
  - GitHub Copilot or other LM provider (for `vscode-lm` provider)

## Known Issues

- Large diffs may be slow to process
- VS Code LM provider requires an active Copilot subscription or compatible extension

## License

MIT
