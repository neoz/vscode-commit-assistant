# Feature Spec: Claude Commit Message Generator

## 1. Problem Statement

Developers spend significant time writing commit messages that accurately describe their changes. Crafting good commit messages that follow conventional commit format requires context-switching from coding to documentation, and often results in either overly terse messages ("fix bug") or inconsistent formatting across a team.

This problem affects all developers using VS Code with Git, occurring multiple times per day during active development. Poor commit messages create technical debt in the form of unclear git history, making code reviews, debugging, and onboarding harder.

**Evidence**: Conventional Commits has become an industry standard, yet manual adherence is inconsistent. AI-assisted writing tools have seen rapid adoption for documentation tasks.

---

## 2. Goals

| Goal | Metric | Target |
|------|--------|--------|
| Reduce time to write commit messages | Time from staging to commit | < 5 seconds (vs ~30 seconds manual) |
| Improve commit message quality | Messages following conventional commit format | > 95% adherence |
| High adoption among installers | Users who generate at least one message per week | > 60% weekly active rate |
| Seamless workflow integration | Users who complete commit after generation | > 80% completion rate |

---

## 3. Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Automatic commit without user review | Users must approve AI-generated messages for accountability |
| Multi-repository support | v1 focuses on single active repo; multi-repo adds complexity |
| Customizable AI model selection | Claude Code CLI handles model selection; extension stays simple |
| Commit message history/learning | Would require persistent storage and significantly increase scope |
| Integration with other Git clients | Focus on VS Code SCM view only |

---

## 4. User Stories

### Primary Flow
- **As a developer**, I want to generate a commit message from my staged changes with one click so that I can commit faster without context-switching to write descriptions.

- **As a developer**, I want the generated message to follow conventional commit format (type(scope): description) so that my commit history remains consistent and parseable.

- **As a developer**, I want to see a progress indicator while the message generates so that I know the extension is working.

### Configuration
- **As a developer**, I want to customize the prompt template so that I can adjust the style of generated messages to my team's conventions.

- **As a developer**, I want to limit the diff size sent to Claude so that I can control token usage for very large changesets.

### Error Handling
- **As a developer**, I want a clear error message when no changes are staged so that I understand why generation did not start.

- **As a developer**, I want a clear error message when Claude CLI is not installed so that I can fix my environment.

- **As a developer**, I want generation to timeout gracefully if Claude is unresponsive so that VS Code does not hang.

---

## 5. Requirements

### Must-Have (P0)

| Requirement | Acceptance Criteria |
|-------------|---------------------|
| Generate commit message from staged diff | Given staged changes exist, when user clicks sparkle button, then a commit message appears in the input box within 60 seconds |
| Access via SCM input box button | Button with sparkle icon appears in SCM input box when a git repo is open |
| Access via SCM title bar | Button appears in SCM title bar as fallback for environments without proposed API |
| Conventional commit format output | Generated messages match pattern `type(scope): description` |
| Progress notification | User sees "Generating commit message with Claude..." during generation |
| Error handling: no staged changes | Warning message "No staged changes to commit" when diff is empty |
| Error handling: no git repo | Error message "No git repository found" when no repo is active |
| Error handling: Claude CLI missing | Error message indicates Claude spawn failure |
| 60-second timeout | Generation aborts with "Claude timed out" after 60 seconds |
| Cross-platform support | Works on Windows (cmd), macOS (sh), and Linux (sh) |

### Nice-to-Have (P1)

| Requirement | Rationale |
|-------------|-----------|
| Configurable prompt template | Teams have different commit message conventions |
| Configurable max diff length | Large diffs may exceed token limits or slow generation |
| Cancellable generation | Users may want to abort a slow generation |
| Multi-repository support | Power users work with monorepos or multiple repos |

### Future Considerations (P2)

| Requirement | Notes |
|-------------|-------|
| Edit generated message inline before accepting | Requires UI beyond input box |
| Multiple message suggestions to choose from | Would require custom UI |
| Integration with GitHub/GitLab PR description generation | Separate but related feature |
| Commit message templates per project | Requires workspace-level config |

---

## 6. Success Metrics

### Leading Indicators (1-4 weeks post-launch)

| Metric | Measurement | Target |
|--------|-------------|--------|
| Install count | VS Code Marketplace | 500 installs in first month |
| Command invocations | Would require telemetry (not currently implemented) | N/A |
| Error rate | GitHub issues reporting errors | < 5% of users report errors |

### Lagging Indicators (1-3 months)

| Metric | Measurement | Target |
|--------|-------------|--------|
| Retention | Weekly active users / Total installs | > 30% |
| User satisfaction | Marketplace rating | > 4.0 stars |
| Uninstall rate | Marketplace analytics | < 40% |

---

## 7. Open Questions

| Question | Owner | Blocking? |
|----------|-------|-----------|
| Should we add telemetry to measure usage? | Product/Engineering | No |
| Should the extension bundle Claude CLI or require separate install? | Engineering | No (currently requires separate install) |
| Should we support commit message body (multi-line) in addition to subject? | Product | No (v1 focuses on subject line) |
| How should we handle very large diffs (>10k chars)? | Engineering | No (currently truncates with warning) |

---

## 8. Timeline Considerations

- **Dependency**: Requires Claude Code CLI to be installed and in PATH
- **API Dependency**: Uses VS Code proposed API `contribSourceControlInputBoxMenu` for optimal UX (SCM input box button); falls back to stable `scm/title` API
- **No hard deadlines**: This is an open-source community extension

---

## Technical Architecture Summary

```
[User clicks sparkle]
    -> [Get staged diff via vscode.git API]
    -> [Write prompt + diff to temp file]
    -> [Pipe to claude -p CLI]
    -> [Parse stdout]
    -> [Insert into repo.inputBox.value]
```

**Key Dependencies**:
- `vscode.git` extension (built-in)
- `claude` CLI in PATH
