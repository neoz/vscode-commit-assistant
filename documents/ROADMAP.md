# Product Roadmap: Claude Commit Message Generator

> Last updated: 2026-02-01

---

## Status Overview

| Status | Count |
|--------|-------|
| **Done** | 16 items |
| **Now** | 0 items |
| **Next** | 4 items |
| **Later** | 5 items |

**Current Version**: 0.0.4

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
| Model selection | Allow users to choose Claude model (Haiku for speed, Sonnet for quality) | **Not Started** | P1 |
| Keyboard shortcut | Add default keybinding (e.g., `Ctrl+Shift+G`) to trigger generation | **Not Started** | P1 |
| Token usage display | Show token count after generation for cost awareness | **Not Started** | P1 |
| Multi-repository support | Support workspaces with multiple git repos; let user pick which repo | **Not Started** | P1 |

---

## Later (Future Considerations)

Items on the horizon but not yet prioritized for active development.

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| Commit message body support | Option to generate multi-line commit messages with subject + body | **Not Started** | P1 |
| Streaming response | Show message as it generates for perceived speed | **Not Started** | P2 |
| Multiple message suggestions | Generate 2-3 options and let user pick their preferred message | **Not Started** | P2 |
| PR description generation | Extend to generate GitHub/GitLab pull request descriptions | **Not Started** | P2 |
| Smart diff summarization | For large diffs, summarize file-level changes before sending to Claude | **Not Started** | P2 |

---

## Done (Completed)

Items shipped in previous releases.

| Item | Description | Version | Status |
|------|-------------|---------|--------|
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
| Configurable prompt template | User can customize the generation prompt | 0.0.2 | **Done** |
| Configurable max diff length | User can limit diff size sent to Claude | 0.0.2 | **Done** |
| Automated release workflow | CI/CD for marketplace publishing | 0.0.3 | **Done** |
| Repository metadata | Correct GitHub URL and package info | 0.0.3 | **Done** |

---

## Dependencies & Risks

### External Dependencies

| Dependency | Impact | Mitigation |
|------------|--------|------------|
| Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | Core generation functionality depends on SDK | Pin to stable version; monitor releases |
| Claude Code runtime | SDK delegates auth to Claude Code; must be installed | Document installation clearly in README |
| VS Code Proposed API (`scm/inputBox`) | Optimal UX requires enabling proposed API | Fallback to stable `scm/title` API works without flag |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SDK API breaking changes | Low | High | Pin to known-good SDK version; test with new versions |
| Claude Code auth changes | Low | Medium | Monitor Claude Code releases; update error handling |
| VS Code API deprecation | Low | Medium | Monitor VS Code release notes; proposed API may become stable |
| Large diff token limits | Medium | Medium | Already implemented truncation; smart summarization planned |

---

## Prioritization Rationale

**Now items**: v1.0.0 complete - SDK migration shipped with cancellation, better errors, and faster timeout.

**Next items** were selected based on:
- User control (model selection for cost/quality tradeoff)
- Discoverability (keyboard shortcut)
- Transparency (token usage display)
- Power user needs (multi-repo support)

**Later items** are deferred because:
- Lower priority than core improvements (commit body support)
- Require SDK features to be stable first (streaming)
- Require significant new UI (multiple suggestions)
- Separate feature scope (PR descriptions)

---

## Version Planning

| Version | Theme | Key Items | Status |
|---------|-------|-----------|--------|
| **0.0.4** | **SDK Migration** | Claude Agent SDK, cancellable generation, improved errors, 30s timeout | **Done** |
| 1.0.0 | Stable Release | Version bump for marketplace, no new features | **Planned** |
| 1.1.0 | User Control | Model selection, keyboard shortcut, token usage display | **Planned** |
| 1.2.0 | Power Users | Multi-repo support, commit body support | **Planned** |
| 2.0.0 | Enhanced UX | Streaming response, multiple suggestions, smart diff summarization | **Planned** |

---

## Changes This Update

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

| Aspect | Before (v0.x) | After (v0.0.4+) |
|--------|---------------|-----------------|
| Claude Code requirement | CLI must be in PATH | Same (SDK uses Claude Code runtime) |
| Generation speed | ~5-10 seconds | ~2-5 seconds (no process spawn) |
| Cancellation | Not supported | Supported via progress dialog |
| Timeout | 60 seconds | 30 seconds |
| Error messages | Generic CLI errors | Specific, actionable messages |

### Breaking Changes

- None for end users (same workflow, same button)
- Internal architecture change only
