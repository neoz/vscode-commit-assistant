# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install          # Install dependencies
npm run compile      # Build TypeScript to out/
npm run watch        # Watch mode for development
```

## Testing the Extension

1. Open this folder in VS Code
2. Press F5 to launch Extension Development Host
3. The launch config enables the proposed `scm/inputBox` API

To package for distribution:
```bash
npm install -g @vscode/vsce
vsce package
```

## Architecture

This is a VS Code extension that generates git commit messages using AI providers (Claude or VS Code Language Models).

**File Structure:**
- `src/extension.ts` - VS Code integration, commands, UI, configuration
- `src/providers.ts` - Provider interface, ClaudeProvider, VSCodeLMProvider

**Flow:**
1. User clicks sparkle button in SCM view (title bar or input box)
2. Extension loads config (provider, model, prompts)
3. Creates provider via `createProvider(type, model)`
4. Checks `provider.isAvailable()` - shows error if unavailable
5. Gets staged diff via VS Code Git API (`repo.diff(true)`)
6. Filters sensitive files based on exclude patterns
7. Calls `provider.generateCommitMessage()` with prompt + diff
8. Parses JSON response via Zod schemas
9. If split suggested: shows QuickPick, stages selected files
10. Inserts message into commit input box

**Providers:**
- `ClaudeProvider` - Uses Claude Agent SDK, requires Claude Code CLI
- `VSCodeLMProvider` - Uses VS Code Language Model API (GitHub Copilot, etc.)

**Key Dependencies:**
- `vscode.git` extension (built-in)
- `@anthropic-ai/claude-agent-sdk` (bundled, for Claude provider)
- `vscode.lm` API (built-in VS Code 1.85+, for VS Code LM provider)

**Menu locations:**
- `scm/inputBox` - Proposed API, requires `--enable-proposed-api` flag
- `scm/title` - Stable fallback in SCM header bar

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `claude-commit.provider` | AI provider (`claude` or `vscode-lm`) | `claude` |
| `claude-commit.model` | Model (haiku/sonnet/opus or LM family) | `haiku` |
| `claude-commit.timeout` | Timeout in ms (5000-120000) | `30000` |
| `claude-commit.prompt` | Custom system prompt | (default prompt) |
| `claude-commit.userPrompt` | Custom user prompt with `{diff}` placeholder | (default prompt) |
| `claude-commit.excludePatterns` | Glob patterns for sensitive files | (env, keys, etc.) |
