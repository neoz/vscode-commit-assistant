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
| Improved reliability | Successful generation rate | > 98% (vs CLI spawn issues) |

---

## 3. Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Automatic commit without user review | Users must approve AI-generated messages for accountability |
| Multi-repository support | v1 focuses on single active repo; multi-repo adds complexity |
| Custom authentication flow | Claude Code handles auth; extension delegates to its runtime |
| Agentic file operations | Simple message generation does not require file editing capabilities |
| Commit message history/learning | Would require persistent storage and significantly increase scope |
| Integration with other Git clients | Focus on VS Code SCM view only |

---

## 4. User Stories

### Primary Flow
- **As a developer**, I want to generate a commit message from my staged changes with one click so that I can commit faster without context-switching to write descriptions.

- **As a developer**, I want the generated message to follow conventional commit format (type(scope): description) so that my commit history remains consistent and parseable.

- **As a developer**, I want to see a progress indicator while the message generates so that I know the extension is working.

- **As a developer**, I want generation to be faster and more reliable than CLI spawning so that my workflow is not interrupted.

### Configuration
- **As a developer**, I want to customize the prompt template so that I can adjust the style of generated messages to my team's conventions.

- **As a developer**, I want to limit the diff size sent to Claude so that I can control token usage for very large changesets.

### Error Handling
- **As a developer**, I want a clear error message when no changes are staged so that I understand why generation did not start.

- **As a developer**, I want a clear error message when Claude Code is not installed or authenticated so that I can fix my environment.

- **As a developer**, I want generation to timeout gracefully if the API is unresponsive so that VS Code does not hang.

- **As a developer**, I want to be able to cancel an in-progress generation so that I can abort if it takes too long.

---

## 5. Requirements

### Must-Have (P0)

| Requirement | Acceptance Criteria |
|-------------|---------------------|
| Claude Agent SDK integration | Extension uses `@anthropic-ai/claude-agent-sdk` instead of spawning CLI process |
| Generate commit message from staged diff | Given staged changes exist, when user clicks sparkle button, then a commit message appears in the input box within 30 seconds |
| Access via SCM input box button | Button with sparkle icon appears in SCM input box when a git repo is open |
| Access via SCM title bar | Button appears in SCM title bar as fallback for environments without proposed API |
| Conventional commit format output | Generated messages match pattern `type(scope): description` |
| Progress notification | User sees "Generating commit message..." during generation with cancel option |
| Cancellable generation | User can cancel in-progress generation via progress dialog |
| Error handling: no staged changes | Warning message "No staged changes to commit" when diff is empty |
| Error handling: no git repo | Error message "No git repository found" when no repo is active |
| Error handling: Claude Code not available | Error message with instructions to install/authenticate Claude Code |
| Error handling: API errors | Clear messages for rate limits, network errors, authentication failures |
| 30-second timeout | Generation aborts with timeout message after 30 seconds |
| Cross-platform support | Works on Windows, macOS, and Linux |

### Nice-to-Have (P1)

| Requirement | Rationale |
|-------------|-----------|
| Configurable prompt template | Teams have different commit message conventions |
| Configurable max diff length | Large diffs may exceed token limits or slow generation |
| Model selection | Allow users to choose Claude model for cost/quality tradeoff |
| Multi-repository support | Power users work with monorepos or multiple repos |
| Token usage display | Show token count after generation for cost awareness |

### Future Considerations (P2)

| Requirement | Notes |
|-------------|-------|
| Edit generated message inline before accepting | Requires UI beyond input box |
| Multiple message suggestions to choose from | Would require custom UI |
| Streaming response | Show message as it generates for perceived speed |
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

| Question | Owner | Status |
|----------|-------|--------|
| What is the minimum Claude Agent SDK version required? | Engineering | Blocking |
| Does the SDK support AbortController for cancellation? | Engineering | Blocking |
| Should we add telemetry to measure usage? | Product/Engineering | No |
| Should we support commit message body (multi-line) in addition to subject? | Product | No (v1 focuses on subject line) |
| How should we handle very large diffs (>10k chars)? | Engineering | No (currently truncates with warning) |

---

## 8. Timeline Considerations

- **Dependency**: Requires Claude Code to be installed and authenticated (SDK delegates to Claude Code runtime)
- **API Dependency**: Uses VS Code proposed API `contribSourceControlInputBoxMenu` for optimal UX (SCM input box button); falls back to stable `scm/title` API
- **Migration**: This is a non-breaking change; CLI dependency is replaced with SDK but user setup remains similar
- **No hard deadlines**: This is an open-source community extension

---

## 9. Technical Architecture

### Current Architecture (CLI-based, v0.x)

```
[User clicks sparkle]
    -> [Get staged diff via vscode.git API]
    -> [Write prompt + diff to temp file]
    -> [Spawn: cmd /c type file | claude -p (Windows)]
    -> [Spawn: sh -c cat file | claude -p (Unix)]
    -> [Parse stdout]
    -> [Insert into repo.inputBox.value]
```

**Issues with CLI approach**:
- Process spawning overhead
- Platform-specific shell commands
- Temp file management
- Limited error handling from CLI output
- No cancellation support

### New Architecture (SDK-based, v1.0)

```
[User clicks sparkle]
    -> [Get staged diff via vscode.git API]
    -> [Create Claude Agent SDK session]
    -> [Send prompt + diff via SDK]
    -> [Receive response]
    -> [Insert into repo.inputBox.value]
```

**Benefits of SDK approach**:
- No process spawning overhead
- Cross-platform without shell commands
- Proper error types and handling
- AbortController support for cancellation
- Cleaner async/await flow

### SDK Integration

```typescript
import { Claude } from '@anthropic-ai/claude-agent-sdk';

async function generateCommitMessage(diff: string): Promise<string> {
  const claude = new Claude({
    // SDK uses Claude Code runtime for auth
  });

  const abortController = new AbortController();

  // Store for cancellation
  currentAbortController = abortController;

  const response = await claude.message({
    prompt: `${promptTemplate}\n\n${truncatedDiff}`,
    signal: abortController.signal,
  });

  return response.text;
}
```

### Configuration Schema (Updated)

```json
{
  "claude-commit.maxDiffLength": {
    "type": "number",
    "default": 10000,
    "description": "Maximum character length of diff to send to Claude"
  },
  "claude-commit.promptTemplate": {
    "type": "string",
    "default": "Generate a conventional commit message for this diff. Output ONLY the commit message (format: type(scope): description). No explanation.",
    "description": "Prompt template for generating commit messages"
  },
  "claude-commit.model": {
    "type": "string",
    "default": "claude-sonnet-4-5-20250929",
    "enum": ["claude-sonnet-4-5-20250929", "claude-haiku-3-5-20241022"],
    "description": "Claude model to use for generation (P1 feature)"
  }
}
```

**Key Dependencies**:
- `vscode.git` extension (built-in)
- `@anthropic-ai/claude-agent-sdk` (bundled)
- Claude Code installed and authenticated (runtime dependency)

---

## 10. Migration Notes

### For Users

- Claude Code CLI must still be installed and authenticated
- No changes to user workflow (same sparkle button)
- Faster and more reliable generation
- Cancellation now supported

### For Development

1. Add `@anthropic-ai/claude-agent-sdk` to dependencies
2. Replace `spawn` logic with SDK calls
3. Add AbortController for cancellation
4. Update error handling for SDK error types
5. Remove temp file creation/cleanup
6. Update timeout handling (SDK may have built-in)

### Breaking Changes

- None for end users
- Internal architecture change only
