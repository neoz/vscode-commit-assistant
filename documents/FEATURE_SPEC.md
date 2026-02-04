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

### Split Commit Flow
- **As a developer**, I want Claude to detect when I have unrelated changes staged so that I can split them into atomic commits.

- **As a developer**, I want to pick from suggested commits via a QuickPick menu so that I can choose which commit to make first.

- **As a developer**, I want the extension to automatically stage only the relevant files for my selected commit so that I don't have to manually unstage/stage files.

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

### Must-Have (P0) - **All Completed in v0.0.6**

| Requirement | Acceptance Criteria | Status |
|-------------|---------------------|--------|
| Claude Agent SDK integration | Extension uses `@anthropic-ai/claude-agent-sdk` instead of spawning CLI process | **Done** |
| Generate commit message from staged diff | Given staged changes exist, when user clicks sparkle button, then a commit message appears in the input box within 30 seconds | **Done** |
| Access via SCM input box button | Button with sparkle icon appears in SCM input box when a git repo is open | **Done** |
| Access via SCM title bar | Button appears in SCM title bar as fallback for environments without proposed API | **Done** |
| Conventional commit format output | Generated messages match pattern `type(scope): description` | **Done** |
| Progress notification | User sees "Generating commit message..." during generation with cancel option | **Done** |
| Cancellable generation | User can cancel in-progress generation via progress dialog | **Done** |
| Error handling: no staged changes | Warning message "No staged changes to commit" when diff is empty | **Done** |
| Error handling: no git repo | Error message "No git repository found" when no repo is active | **Done** |
| Error handling: Claude Code not available | Error message with instructions to install/authenticate Claude Code | **Done** |
| Error handling: API errors | Clear messages for rate limits, network errors, authentication failures | **Done** |
| 30-second timeout | Generation aborts with timeout message after 30 seconds | **Done** |
| Cross-platform support | Works on Windows, macOS, and Linux | **Done** |
| Split commit detection | When diff contains unrelated changes, suggest splitting into multiple commits | **Done** |
| Smart staging workflow | QuickPick UI to select a commit; auto-stage only relevant files | **Done** |

### Nice-to-Have (P1)

| Requirement | Rationale | Status |
|-------------|-----------|--------|
| Configurable prompt template | Teams have different commit message conventions | **Done** (v0.0.2) |
| Configurable max diff length | Large diffs may exceed token limits or slow generation | **Done** (v0.0.2) |
| Model selection | Allow users to choose Claude model for cost/quality tradeoff | Not Started |
| Multi-repository support | Power users work with monorepos or multiple repos | Not Started |
| Token usage display | Show token count after generation for cost awareness | Not Started |

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
| What is the minimum Claude Agent SDK version required? | Engineering | **Resolved** - Using ^0.1.0 |
| Does the SDK support AbortController for cancellation? | Engineering | **Resolved** - Yes, via options.abortController |
| Should we add telemetry to measure usage? | Product/Engineering | Open |
| Should we support commit message body (multi-line) in addition to subject? | Product | Open (v1 focuses on subject line) |
| How should we handle very large diffs (>10k chars)? | Engineering | **Resolved** - Truncates with "... (truncated)" suffix |

---

## 8. Timeline Considerations

- **Dependency**: Requires Claude Code to be installed and authenticated (SDK delegates to Claude Code runtime)
- **API Dependency**: Uses VS Code proposed API `contribSourceControlInputBoxMenu` for optimal UX (SCM input box button); falls back to stable `scm/title` API
- **Migration**: This is a non-breaking change; CLI dependency is replaced with SDK but user setup remains similar
- **No hard deadlines**: This is an open-source community extension

---

## 9. Technical Architecture

### Current Architecture (SDK-based, v0.0.6)

```
[User clicks sparkle]
    -> [Get staged diff via vscode.git API]
    -> [Build prompt with system instructions + diff]
    -> [Call Claude Agent SDK query()]
    -> [Parse JSON response]
    -> [If split suggested: show QuickPick -> stage selected files]
    -> [Insert message into repo.inputBox.value]
```

**Benefits of SDK approach**:
- No process spawning overhead
- Cross-platform without shell commands
- Proper error types and handling
- AbortController support for cancellation
- Cleaner async/await flow

### JSON Response Format

The extension now uses a structured JSON response format for better parsing and split detection:

```json
{
  "suggest_split": boolean,
  "commits": [
    {
      "message": "feat(auth): add JWT token validation",
      "files": ["src/auth/jwt.ts"],
      "reasoning": "Brief explanation for logging"
    }
  ]
}
```

### SDK Integration

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

async function generateCommitMessage(diff: string, abortController: AbortController): Promise<GenerateResult> {
  const claudePath = findClaudeExecutable();

  for await (const message of query({
    prompt,
    options: {
      abortController,
      maxTurns: 1,
      allowedTools: [],
      pathToClaudeCodeExecutable: claudePath
    }
  })) {
    // Process streaming response
  }

  return { message, splitSuggested, commits };
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
