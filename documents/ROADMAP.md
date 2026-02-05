# Product Roadmap: Claude Commit Message Generator

> Last updated: 2026-02-05

---

## Status Overview

| Status | Count |
|--------|-------|
| **Done** | 21 items |
| **Now** | 0 items |
| **Next** | 5 items |
| **Later** | 4 items |

**Current Version**: 0.0.7 (in development)

---

## Now (Current Focus)

All v1.0.0 items have been completed. Ready to start Next items.

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| - | No items currently in progress | - | - |

---

## Next (Up Next)

Items planned for the next development cycle.

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| GitHub Copilot Agent SDK support | Add GitHub Copilot as an alternative AI backend; user can configure provider in settings (Claude remains default) | **Not Started** | P1 |
| Provider abstraction layer | Create unified interface for AI providers to enable seamless switching between Claude and Copilot | **Not Started** | P1 |
| Model selection | Allow users to choose Claude model (Haiku for speed, Sonnet for quality) | **Not Started** | P1 |
| Keyboard shortcut | Add default keybinding (e.g., `Ctrl+Shift+G`) to trigger generation | **Not Started** | P1 |
| Token usage display | Show token count after generation for cost awareness | **Not Started** | P1 |
| Multi-repository support | Support workspaces with multiple git repos; let user pick which repo | **Not Started** | P2 |

---

## Later (Future Considerations)

Items on the horizon but not yet prioritized for active development.

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| Commit message body support | Option to generate multi-line commit messages with subject + body | **Not Started** | P1 |
| Streaming response | Show message as it generates for perceived speed | **Not Started** | P2 |
| PR description generation | Extend to generate GitHub/GitLab pull request descriptions | **Not Started** | P2 |
| Smart diff summarization | For large diffs, summarize file-level changes before sending to Claude | **Not Started** | P2 |

> **Note:** "Multiple message suggestions" has been effectively delivered via the split commit detection feature (v0.0.5), which presents multiple commit options when appropriate.

---

## Done (Completed)

Items shipped in previous releases.

| Item | Description | Version | Status |
|------|-------------|---------|--------|
| **Configurable timeout** | User can adjust timeout for slow network conditions | 0.0.7 | **Done** |
| **Configurable system prompt** | User can customize the system prompt for different conventions | 0.0.7 | **Done** |
| **Configurable user prompt** | User can customize how diff is presented to Claude | 0.0.7 | **Done** |
| **Split commit detection** | Detect unrelated changes and suggest splitting into multiple commits | 0.0.5 | **Done** |
| **Smart staging workflow** | QuickPick UI to select a commit; auto-stage only relevant files | 0.0.5 | **Done** |
| **Claude Agent SDK migration** | Replace CLI spawning with `@anthropic-ai/claude-agent-sdk` | 0.0.4 | **Done** |
| **Cancellable generation** | Users can abort generation via progress dialog cancel button | 0.0.4 | **Done** |
| **Improved error messages** | Auto-detect auth/installation issues with actionable guidance | 0.0.4 | **Done** |
| **Reduced timeout** | Lowered timeout from 60s to 30s | 0.0.4 | **Done** |
| Core commit message generation | Generate message from staged diff via Claude CLI | 0.0.1 | **Done** |
| SCM input box button | Sparkle button in SCM input box (proposed API) | 0.0.1 | **Done** |
| SCM title bar button | Fallback button in SCM header | 0.0.1 | **Done** |
| Progress notification | "Generating commit message..." indicator | 0.0.1 | **Done** |
| Error handling: no staged changes | Warning when no changes staged | 0.0.1 | **Done** |
| Error handling: no git repo | Error when no repository found | 0.0.1 | **Done** |
| 60-second timeout | Graceful timeout for unresponsive Claude | 0.0.1 | **Done** |
| Cross-platform support | Windows, macOS, and Linux compatibility | 0.0.1 | **Done** |
| Automated release workflow | CI/CD for marketplace publishing | 0.0.3 | **Done** |
| Repository metadata | Correct GitHub URL and package info | 0.0.3 | **Done** |

---

## Dependencies & Risks

### External Dependencies

| Dependency | Impact | Mitigation |
|------------|--------|------------|
| Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | Core generation functionality depends on SDK | Pin to stable version; monitor releases |
| Claude Code runtime | SDK delegates auth to Claude Code; must be installed | Document installation clearly in README |
| GitHub Copilot Agent SDK | Alternative AI provider for commit generation | Monitor GitHub Copilot API changes; maintain as optional dependency |
| VS Code Proposed API (`scm/inputBox`) | Optimal UX requires enabling proposed API | Fallback to stable `scm/title` API works without flag |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SDK API breaking changes | Low | High | Pin to known-good SDK version; test with new versions |
| Claude Code auth changes | Low | Medium | Monitor Claude Code releases; update error handling |
| GitHub Copilot API changes | Medium | Medium | Abstract provider interface to isolate changes; monitor GitHub releases |
| Multi-provider maintenance burden | Medium | Medium | Unified interface design; comprehensive test coverage for both providers |
| VS Code API deprecation | Low | Medium | Monitor VS Code release notes; proposed API may become stable |
| Large diff token limits | Medium | Medium | Already implemented truncation; smart summarization planned |

---

## Prioritization Rationale

**Now items**: v1.0.0 complete - SDK migration shipped with cancellation, better errors, and faster timeout.

**Next items** were selected based on:
- Provider flexibility (GitHub Copilot support for users without Claude Code)
- Architecture foundation (provider abstraction enables future AI backends)
- User control (model selection for cost/quality tradeoff)
- Discoverability (keyboard shortcut)
- Transparency (token usage display)

**Later items** are deferred because:
- Lower priority than core improvements (commit body support)
- Require SDK features to be stable first (streaming)
- Require significant new UI (multiple suggestions)
- Separate feature scope (PR descriptions)
- Multi-repo deprioritized in favor of provider support

---

## Version Planning

| Version | Theme | Key Items | Status |
|---------|-------|-----------|--------|
| **0.0.4** | **SDK Migration** | Claude Agent SDK, cancellable generation, improved errors, 30s timeout | **Done** |
| **0.0.5** | **Split Detection** | Split commit detection, staging workflow | **Done** |
| **0.0.6** | **Refinements** | Bug fixes, dependency updates | **Done** |
| **0.0.7** | **Configuration** | Configurable timeout, system prompt, user prompt | **In Progress** |
| 1.0.0 | Stable Release | Version bump for marketplace, documentation polish | **Planned** |
| 1.1.0 | Multi-Provider | GitHub Copilot Agent SDK support, provider abstraction layer | **Planned** |
| 1.2.0 | User Control | Model selection, keyboard shortcut, token usage display | **Planned** |
| 1.3.0 | Power Users | Multi-repo support, commit body support | **Planned** |
| 2.0.0 | Enhanced UX | Streaming response, smart diff summarization | **Planned** |

---

## GitHub Copilot Agent SDK Integration Plan

### Overview

Add GitHub Copilot as an alternative AI provider for commit message generation. Users can configure their preferred provider in VS Code settings, with Claude remaining the default for backward compatibility.

### Configuration Schema

```json
{
  "claude-commit.provider": {
    "type": "string",
    "enum": ["claude", "copilot"],
    "default": "claude",
    "description": "AI provider for commit message generation"
  },
  "claude-commit.copilot.model": {
    "type": "string",
    "default": "gpt-4",
    "description": "Model to use when Copilot provider is selected"
  }
}
```

### Architecture Changes

1. **Provider Interface**: Create `ICommitMessageProvider` interface with `generate(diff: string, config: ExtensionConfig): Promise<GenerateResult>`

2. **Provider Implementations**:
   - `ClaudeProvider`: Current implementation using Claude Agent SDK
   - `CopilotProvider`: New implementation using GitHub Copilot Agent SDK

3. **Provider Factory**: `getProvider(config: ExtensionConfig): ICommitMessageProvider` to instantiate the correct provider

### Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `@anthropic-ai/claude-agent-sdk` | Claude provider (existing) | Already bundled |
| GitHub Copilot Agent SDK | Copilot provider (new) | TBD - verify package name and availability |

### User Experience

- Default behavior unchanged (Claude)
- Users with GitHub Copilot subscription can switch to Copilot provider
- Error messages guide users to install/authenticate required provider
- Provider-specific model selection (Haiku/Sonnet for Claude, GPT models for Copilot)

### Migration Path

1. No breaking changes for existing users
2. New users can choose their preferred provider during setup
3. Documentation updated to cover both providers

---

## Changes This Update

### Roadmap Update (2026-02-05)

**New Items Added:**
- GitHub Copilot Agent SDK support (P1, Next)
- Provider abstraction layer (P1, Next)

**Reprioritized:**
- Multi-repository support moved from P1 to P2 (deferred in favor of provider support)

**New Dependencies:**
- GitHub Copilot Agent SDK (optional, for Copilot provider)

**New Risks:**
- GitHub Copilot API changes
- Multi-provider maintenance burden

**Version Planning Updated:**
- v1.1.0 now focused on Multi-Provider theme
- Subsequent versions shifted accordingly

### v0.0.7 Release (2026-02-04)

**Items Completed:**
- Configurable timeout (P1)
- Configurable system prompt (P1)
- Configurable user prompt (P1)

**Architecture Changes:**
- Added `ExtensionConfig` interface with `timeout`, `prompt`, `userPrompt`
- Added `getConfig()` function to read VS Code settings
- Config values are now passed to `generateCommitMessage()`
- Removed unused `maxDiffLength` and old `promptTemplate` settings

**Configuration Options:**
- `claude-commit.timeout`: Timeout in ms (5000-120000, default 30000)
- `claude-commit.prompt`: Custom system prompt (empty = use default)
- `claude-commit.userPrompt`: Custom user prompt with `{diff}` placeholder

### v0.0.6 Release (2026-02-04)

**Items Completed:**
- Split commit detection (P0)
- Smart staging workflow (P0)

**Architecture Changes:**
- Added JSON-based response format with structured commit suggestions
- Added `GenerateResponse` interface with `suggest_split` and `commits` array
- Each commit includes `message`, `files`, and `reasoning` fields
- Added QuickPick UI for selecting from multiple commit suggestions
- Added `stageFilesForCommit()` to handle selective staging

**User-Facing Improvements:**
- When staging unrelated changes, Claude now suggests splitting into atomic commits
- QuickPick menu displays each suggested commit with file count and list
- Selecting a commit automatically unstages all files and re-stages only relevant ones
- Debug logging in "Claude Commit Assistant" output channel

### v0.0.5 Release (2026-02-03)

**Items Completed:**
- Initial split commit detection implementation
- Staging workflow foundation

### v0.0.4 Release (2026-02-01)

**Items Completed:**
- Claude Agent SDK migration (P0)
- Cancellable generation (P0)
- Improved error messages (P1)
- Reduced timeout to 30s (P1)

**Architecture Changes:**
- Replaced `child_process.spawn` with `@anthropic-ai/claude-agent-sdk`
- Removed temp file creation/cleanup
- Removed platform-specific shell commands
- Added AbortController for cancellation
- Added auto-detection for auth and installation errors

**User-Facing Improvements:**
- Cancel button now works during generation
- Clearer error messages when Claude Code not installed/authenticated
- Faster timeout (30s vs 60s)
- Same workflow - no breaking changes

---

## Migration: v0.x to v1.0

### What Changes for Users

| Aspect | Before (v0.0.3) | After (v0.0.6) |
|--------|-----------------|----------------|
| Claude Code requirement | CLI must be in PATH | Same (SDK uses Claude Code runtime) |
| Generation speed | ~5-10 seconds | ~2-5 seconds (no process spawn) |
| Cancellation | Not supported | Supported via progress dialog |
| Timeout | 60 seconds | 30 seconds |
| Error messages | Generic CLI errors | Specific, actionable messages |
| Split detection | Not supported | Auto-detects unrelated changes |
| Staging workflow | Manual | Auto-stages files for selected commit |

### Breaking Changes

- None for end users (same workflow, same button)
- Internal architecture change only
