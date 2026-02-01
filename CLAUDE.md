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

This is a VS Code extension that generates git commit messages using the Claude Agent SDK.

**Flow:**
1. User clicks sparkle button in SCM view (title bar or input box)
2. Extension gets staged diff via VS Code Git API (`repo.diff(true)`)
3. Calls Claude Agent SDK `query()` with prompt + diff
4. Parses response and inserts result into commit input box

**Key files:**
- `src/extension.ts` - Single file containing all logic
- `package.json` - Extension manifest with command and menu contributions

**Dependencies:**
- Requires `vscode.git` extension (built-in)
- Requires Claude Code to be installed and authenticated (SDK delegates auth to Claude Code runtime)
- Uses `@anthropic-ai/claude-agent-sdk` for API calls

**Menu locations:**
- `scm/inputBox` - Proposed API, requires `--enable-proposed-api` flag
- `scm/title` - Stable fallback in SCM header bar
