# Product Roadmap: Claude Commit Message Generator

> Last updated: 2026-02-01

---

## Status Overview

| Status | Count |
|--------|-------|
| **Done** | 12 items |
| **Now** | 3 items |
| **Next** | 4 items |
| **Later** | 4 items |

**Current Version**: 0.0.3

---

## Now (Current Focus)

Items actively being worked on or ready to start immediately.

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| Cancellable generation | Allow users to abort slow generations via progress dialog | **Not Started** | P1 |
| Multi-repository support | Support workspaces with multiple git repos; let user pick which repo | **Not Started** | P1 |
| Improved error messages | Better detection and messaging when Claude CLI is not installed or not in PATH | **Not Started** | P1 |

---

## Next (Up Next)

Items planned for the next development cycle.

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| Commit message body support | Option to generate multi-line commit messages with subject + body | **Not Started** | P1 |
| Keyboard shortcut | Add default keybinding (e.g., `Ctrl+Shift+G`) to trigger generation | **Not Started** | P1 |
| Smart diff summarization | For large diffs, summarize file-level changes before sending to Claude | **Not Started** | P2 |
| Workspace-level settings | Support `.vscode/settings.json` overrides for prompt template per project | **Not Started** | P2 |

---

## Later (Future Considerations)

Items on the horizon but not yet prioritized for active development.

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| Multiple message suggestions | Generate 2-3 options and let user pick their preferred message | **Not Started** | P2 |
| PR description generation | Extend to generate GitHub/GitLab pull request descriptions | **Not Started** | P2 |
| Commit message templates | Pre-defined templates (conventional, gitmoji, custom) | **Not Started** | P2 |
| Usage analytics (opt-in) | Optional telemetry to understand feature adoption | **Not Started** | P2 |

---

## Done (Completed)

Items shipped in previous releases.

| Item | Description | Version | Status |
|------|-------------|---------|--------|
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
| Claude Code CLI | Extension requires CLI to be installed separately | Document installation clearly in README; consider future bundling |
| VS Code Proposed API (`scm/inputBox`) | Optimal UX requires enabling proposed API | Fallback to stable `scm/title` API works without flag |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Claude CLI breaking changes | Low | High | Pin to known-good CLI behavior; test with new versions |
| VS Code API deprecation | Low | Medium | Monitor VS Code release notes; proposed API may become stable |
| Large diff token limits | Medium | Medium | Already implemented truncation; smart summarization in Next phase |

---

## Prioritization Rationale

**Now items** were selected based on:
- User feedback potential (cancellable generation addresses frustration)
- Power user needs (multi-repo support)
- Adoption friction (better error messages reduce drop-off)

**Next items** were selected based on:
- Feature completeness (commit body support)
- Discoverability (keyboard shortcut)
- Quality improvements (smart diff summarization)

**Later items** are deferred because:
- Require significant new UI (multiple suggestions)
- Separate feature scope (PR descriptions)
- Need user research to validate demand (templates, analytics)

---

## Version Planning

| Version | Theme | Key Items |
|---------|-------|-----------|
| 0.1.0 | Polish & Reliability | Cancellable generation, improved errors, multi-repo |
| 0.2.0 | Enhanced Messages | Commit body support, keyboard shortcut |
| 0.3.0 | Smart Handling | Smart diff summarization, workspace settings |
| 1.0.0 | Feature Complete | Multiple suggestions, templates, stable release |
