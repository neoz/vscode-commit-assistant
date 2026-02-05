# Feature Spec: Claude Commit Message Generator

> **Current Version**: 1.1.0 | **Last Updated**: 2026-02-05

## 1. Problem Statement

Developers spend significant time writing commit messages that accurately describe their changes. Crafting good commit messages that follow conventional commit format requires context-switching from coding to documentation, and often results in either overly terse messages ("fix bug") or inconsistent formatting across a team.

This problem affects all developers using VS Code with Git, occurring multiple times per day during active development. Poor commit messages create technical debt in the form of unclear git history, making code reviews, debugging, and onboarding harder.

**Evidence**: Conventional Commits has become an industry standard, yet manual adherence is inconsistent. AI-assisted writing tools have seen rapid adoption for documentation tasks.

**Additional Problem (v1.1.0)**: Different developers have access to different AI tools. Some use Claude Code CLI, others have GitHub Copilot subscriptions. Forcing a single AI provider limits adoption and excludes users who prefer or only have access to alternative providers.

---

## 2. Goals

| Goal | Metric | Target |
|------|--------|--------|
| Reduce time to write commit messages | Time from staging to commit | < 5 seconds (vs ~30 seconds manual) |
| Improve commit message quality | Messages following conventional commit format | > 95% adherence |
| High adoption among installers | Users who generate at least one message per week | > 60% weekly active rate |
| Seamless workflow integration | Users who complete commit after generation | > 80% completion rate |
| Improved reliability | Successful generation rate | > 98% (vs CLI spawn issues) |
| Provider flexibility | Users able to use their preferred AI provider | 100% of supported providers work |
| Model cost control | Users can select cost-appropriate models | Haiku/Sonnet/Opus options available |

---

## 3. Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Automatic commit without user review | Users must approve AI-generated messages for accountability |
| Multi-repository support | v1 focuses on single active repo; multi-repo adds complexity |
| Custom authentication flow | Each provider handles its own auth (Claude Code CLI, VS Code LM) |
| Agentic file operations | Simple message generation does not require file editing capabilities |
| Commit message history/learning | Would require persistent storage and significantly increase scope |
| Integration with other Git clients | Focus on VS Code SCM view only |
| Auto-fallback between providers | Users should explicitly choose their provider; silent fallback could cause unexpected costs |
| Provider-specific prompt tuning | Same prompt works across providers; no per-provider customization |

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
- **As a developer**, I want to customize the system prompt so that I can adjust the style of generated messages to my team's conventions.

- **As a developer**, I want to customize the user prompt template so that I can control how the diff is presented to the AI.

- **As a developer**, I want to configure the timeout so that I can adjust for slow network conditions.

### Multi-Provider Support (v1.1.0)
- **As a developer with Claude Code**, I want to use Claude for commit message generation so that I get high-quality messages from my preferred AI.

- **As a developer with GitHub Copilot**, I want to use VS Code Language Models so that I can leverage my existing Copilot subscription without installing additional tools.

- **As a developer**, I want to choose which AI model to use so that I can balance cost vs quality (e.g., Haiku for speed, Sonnet for quality).

- **As a developer**, I want clear error messages when my selected provider is unavailable so that I know how to fix the issue.

- **As a developer**, I want the progress notification to show which provider is being used so that I know which AI is generating my message.

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

### Must-Have (P0) - **v1.1.0 Multi-Provider**

| Requirement | Acceptance Criteria | Status |
|-------------|---------------------|--------|
| Provider abstraction | Extension supports pluggable AI providers via `CommitProvider` interface | **Done** |
| Claude provider | Users can generate messages using Claude Agent SDK (default) | **Done** |
| VS Code LM provider | Users can generate messages using VS Code Language Model API (GitHub Copilot, etc.) | **Done** |
| Provider selection | Users can select provider via `claude-commit.provider` setting | **Done** |
| Model selection | Users can select model via `claude-commit.model` setting (haiku/sonnet/opus or LM family) | **Done** |
| Provider availability check | Extension checks if selected provider is available before generation | **Done** |
| Clear unavailability errors | When provider unavailable, show specific error with setup instructions | **Done** |
| Provider name in progress | Progress notification shows which provider is generating | **Done** |

### Nice-to-Have (P1)

| Requirement | Rationale | Status |
|-------------|-----------|--------|
| Configurable timeout | Users with slow connections may need longer timeout | **Done** (v0.0.7) |
| Configurable system prompt | Teams have different commit message conventions | **Done** (v0.0.7) |
| Configurable user prompt | Customize how diff is presented to AI | **Done** (v0.0.7) |
| Multi-repository support | Power users work with monorepos or multiple repos | Not Started |
| Token usage display | Show token count after generation for cost awareness | Not Started |
| Keyboard shortcut | Quick access via keybinding (e.g., Ctrl+Shift+G) | Not Started |

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
| Which VS Code LM API to use? | Engineering | **Resolved** - Using vscode.lm (Language Model API) |
| Should we auto-fallback between providers? | Product | **Resolved** - No, show clear error instead |
| Should we add telemetry to measure usage? | Product/Engineering | Open |
| Should we support commit message body (multi-line) in addition to subject? | Product | Open (v1 focuses on subject line) |
| How should we handle very large diffs (>10k chars)? | Engineering | **Resolved** - Truncates with "... (truncated)" suffix |
| Should model setting use user-friendly names or full IDs? | Engineering | **Resolved** - User-friendly (haiku/sonnet/opus) with pass-through for full IDs |

---

## 8. Timeline Considerations

- **Dependency**: Requires either Claude Code CLI OR a VS Code Language Model provider (GitHub Copilot, etc.)
- **API Dependency**: Uses VS Code proposed API `contribSourceControlInputBoxMenu` for optimal UX (SCM input box button); falls back to stable `scm/title` API
- **VS Code Version**: VS Code Language Model API requires VS Code 1.85.0+
- **Migration**: Non-breaking change; Claude remains default, VS Code LM is opt-in via settings
- **No hard deadlines**: This is an open-source community extension

---

## 9. Technical Architecture

### Current Architecture (Multi-Provider, v1.1.0)

```
[User clicks sparkle]
    -> [Get staged diff via vscode.git API]
    -> [Load config: provider, model, prompts]
    -> [Create provider via createProvider(type, model)]
    -> [Check provider.isAvailable()]
    -> [If unavailable: show error and stop]
    -> [Build prompt with system instructions + diff]
    -> [Call provider.generateCommitMessage()]
    -> [Parse JSON response via Zod schemas]
    -> [If split suggested: show QuickPick -> stage selected files]
    -> [Insert message into repo.inputBox.value]
```

### File Structure

```
src/
  extension.ts    - VS Code integration, commands, UI, config
  providers.ts    - Provider interface, ClaudeProvider, VSCodeLMProvider
```

### Provider Interface

```typescript
interface CommitProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  generateCommitMessage(
    diff: string,
    abortController: AbortController,
    config: ProviderConfig,
    logDebug: (msg: string, data?: unknown) => void
  ): Promise<GenerateResult>;
}
```

### Supported Providers

| Provider | Implementation | Requirements |
|----------|---------------|--------------|
| `claude` | ClaudeProvider | Claude Code CLI installed and authenticated |
| `vscode-lm` | VSCodeLMProvider | VS Code 1.85+, GitHub Copilot or other LM provider |

### JSON Response Format

Both providers expect the same JSON response format:

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

### Configuration Schema (v1.1.0)

```json
{
  "claude-commit.provider": {
    "type": "string",
    "enum": ["claude", "vscode-lm"],
    "default": "claude",
    "description": "AI provider for commit message generation"
  },
  "claude-commit.model": {
    "type": "string",
    "default": "haiku",
    "description": "Model to use (Claude: haiku/sonnet/opus, VS Code LM: model family)"
  },
  "claude-commit.timeout": {
    "type": "number",
    "default": 30000,
    "minimum": 5000,
    "maximum": 120000,
    "description": "Timeout in milliseconds for commit message generation"
  },
  "claude-commit.prompt": {
    "type": "string",
    "default": "",
    "editPresentation": "multilineText",
    "description": "Custom system prompt. Leave empty for default."
  },
  "claude-commit.userPrompt": {
    "type": "string",
    "default": "",
    "editPresentation": "multilineText",
    "description": "Custom user prompt template. Use {diff} placeholder."
  }
}
```

### Model Mapping (Claude Provider)

| User-Friendly | Full Model ID |
|---------------|---------------|
| `haiku` | `claude-3-5-haiku-20241022` |
| `sonnet` | `claude-sonnet-4-20250514` |
| `opus` | `claude-opus-4-20250514` |
| (any other) | Passed through as-is |

**Key Dependencies**:
- `vscode.git` extension (built-in)
- `@anthropic-ai/claude-agent-sdk` (bundled, for Claude provider)
- `vscode.lm` API (built-in VS Code 1.85+, for VS Code LM provider)
- Claude Code CLI (runtime, only for Claude provider)
- GitHub Copilot or other LM extension (runtime, only for VS Code LM provider)

---

## 10. Migration Notes

### For Users (v1.0 -> v1.1)

- **No breaking changes** - Claude remains the default provider
- **New option**: Can now use VS Code Language Models (GitHub Copilot) instead of Claude
- **New setting**: `claude-commit.provider` to switch between `claude` and `vscode-lm`
- **New setting**: `claude-commit.model` to select specific model (haiku/sonnet/opus)
- Same sparkle button workflow

### Switching to VS Code LM Provider

1. Ensure you have GitHub Copilot or another VS Code LM provider installed
2. Open VS Code Settings
3. Set `claude-commit.provider` to `vscode-lm`
4. Optionally set `claude-commit.model` to your preferred model family (e.g., `gpt-4o`)

### For Development

**v1.1.0 Architecture Changes:**
1. Split `extension.ts` into two files: `extension.ts` and `providers.ts`
2. Created `CommitProvider` interface for provider abstraction
3. Implemented `ClaudeProvider` and `VSCodeLMProvider`
4. Added `createProvider()` factory function
5. Extracted shared helpers: `buildPrompt()`, `withTimeout()`
6. Updated config to include `provider` and `model` settings

### Breaking Changes

- None for end users
- Internal: `generateCommitMessage()` function moved to provider classes
