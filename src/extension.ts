import * as vscode from 'vscode';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { minimatch } from 'minimatch';
import {
  CommitProvider,
  CommitSuggestion,
  GenerateResult,
  ProviderConfig,
  ProviderType,
  createProvider
} from './providers';

// Output channel for debug logging
let outputChannel: vscode.OutputChannel;

// Split session state for step-by-step commit workflow
interface SplitSession {
  repo: Repository;
  commits: CommitSuggestion[];
  currentIndex: number;
  statusBarItem: vscode.StatusBarItem;
  commitListener: vscode.Disposable;
}

let activeSplitSession: SplitSession | null = null;

// Default system prompt for commit message generation
const DEFAULT_SYSTEM_PROMPT = `You are a Git commit message generator. Analyze the provided diff and generate commit messages following Conventional Commits specification.

## Rules
1. Format: <type>(<scope>): <description>
2. Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
3. Scope: Infer from semantic context; use file paths as hints when unclear (e.g., src/auth/ → auth). Omit if no clear scope.
4. Description: imperative mood, lowercase, no period, keep under 72 characters for the first line
5. No emojis

## Split Detection
If the diff contains multiple unrelated changes (different features, fixes, or concerns, .. etc), set suggest_split: true and provide separate commit messages.
Each file MUST appear in exactly one commit. Never assign the same file to multiple commits. If a file has mixed concerns, assign it to the most relevant commit.

## Output JSON
You MUST respond with valid JSON only, no other text:
{
  "suggest_split": boolean,
  "commits": [
    {
      "message": "feat(auth): add JWT token validation",
      "files": ["src/auth/jwt.ts"],
      "reasoning": "Brief explanation for logging"
    }
  ]
}`;

// Default user prompt template
const DEFAULT_USER_PROMPT = 'Analyze this git diff and generate commit message(s):\n\n```diff\n{diff}\n```';

/**
 * Extended QuickPickItem for commit suggestions
 */
interface CommitQuickPickItem extends vscode.QuickPickItem {
  commit?: CommitSuggestion;
  isStageAll?: boolean;
}

type SplitPickerResult =
  | { mode: 'single'; commit: CommitSuggestion }
  | { mode: 'all' }
  | undefined;

interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: Repository[];
}

interface RepositoryState {
  indexChanges: GitChange[];
  workingTreeChanges: GitChange[];
}

interface GitChange {
  uri: vscode.Uri;
  originalUri: vscode.Uri;
  renameUri: vscode.Uri | undefined;
  status: number;
}

interface Repository {
  inputBox: { value: string };
  diff(staged: boolean): Promise<string>;
  rootUri: vscode.Uri;
  state: RepositoryState;
  status(): Promise<void>;
  onDidCommit: vscode.Event<void>;
}

interface ExtensionConfig {
  timeout: number;
  prompt: string;
  userPrompt: string;
  excludePatterns: string[];
  provider: ProviderType;
  model: string;
}

// Default patterns for sensitive files that should not be sent to AI
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/.env*',
  '**/*.pem',
  '**/*.key',
  '**/*.p12',
  '**/*.pfx',
  '**/credentials*',
  '**/secrets*',
  '**/*secret*',
  '**/.ssh/*',
  '**/*.credentials'
];

function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('claude-commit');

  // Read prompts only from user settings (not workspace) to prevent prompt injection attacks.
  // Malicious repos could include .vscode/settings.json with attacker-controlled prompts.
  const inspectedPrompt = config.inspect<string>('prompt');
  const inspectedUserPrompt = config.inspect<string>('userPrompt');
  const inspectedExcludePatterns = config.inspect<string[]>('excludePatterns');

  const customPrompt = inspectedPrompt?.globalValue || '';
  const customUserPrompt = inspectedUserPrompt?.globalValue || '';
  // For excludePatterns, use user setting if set, otherwise use defaults.
  // Never allow workspace settings to reduce security protections.
  const excludePatterns = inspectedExcludePatterns?.globalValue ?? DEFAULT_EXCLUDE_PATTERNS;

  return {
    // timeout is safe to read from workspace (low risk)
    timeout: config.get<number>('timeout', 30000),
    prompt: customPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
    userPrompt: customUserPrompt.trim() || DEFAULT_USER_PROMPT,
    excludePatterns,
    // Provider settings (safe to read from workspace)
    provider: config.get<ProviderType>('provider', 'claude'),
    model: config.get<string>('model', 'haiku')
  };
}

export function activate(context: vscode.ExtensionContext) {
  // Initialize output channel for debug logging
  outputChannel = vscode.window.createOutputChannel('Claude Commit Assistant');
  context.subscriptions.push(outputChannel);

  const nextSplitCommand = vscode.commands.registerCommand('claude-commit.nextSplitCommit', async () => {
    if (!activeSplitSession) {
      return;
    }

    const session = activeSplitSession;
    const isLast = session.currentIndex >= session.commits.length - 1;

    const items: vscode.QuickPickItem[] = [];

    if (!isLast) {
      items.push({
        label: '$(debug-step-over) Skip to next commit',
        description: session.commits[session.currentIndex + 1].message
      });
    }

    items.push({
      label: '$(close) Cancel split session',
      description: 'Stop the step-by-step workflow'
    });

    const picked = await vscode.window.showQuickPick(items, {
      title: `Split commit ${session.currentIndex + 1}/${session.commits.length}`,
      placeHolder: 'Choose an action'
    });

    if (!picked) {
      return;
    }

    if (picked.label.includes('Cancel')) {
      cancelSplitSession();
      vscode.window.showInformationMessage('Split session cancelled.');
    } else {
      advanceSplitSession();
    }
  });
  context.subscriptions.push(nextSplitCommand);

  const command = vscode.commands.registerCommand('claude-commit.generate', async () => {
    // Cancel any active split session when re-generating
    cancelSplitSession();

    const gitExt = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExt) {
      vscode.window.showErrorMessage('Git extension not found');
      return;
    }

    const git = gitExt.exports.getAPI(1);
    const repo = git.repositories[0];
    if (!repo) {
      vscode.window.showErrorMessage('No git repository found');
      return;
    }

    const diff = await repo.diff(true);
    if (!diff.trim()) {
      vscode.window.showWarningMessage('No staged changes to commit');
      return;
    }

    const config = getConfig();

    // Filter out sensitive files before sending to AI
    const { filteredDiff, excludedFiles } = filterSensitiveDiff(diff, config.excludePatterns);

    if (excludedFiles.length > 0) {
      logDebug('Excluded sensitive files from diff', { excludedFiles });
      vscode.window.showWarningMessage(
        `Excluded ${excludedFiles.length} sensitive file(s): ${excludedFiles.join(', ')}`
      );
    }

    if (!filteredDiff.trim()) {
      vscode.window.showWarningMessage('All staged files were excluded as sensitive. Check excludePatterns setting.');
      return;
    }

    // Create provider based on config
    const provider = createProvider(config.provider, config.model);

    // Check provider availability
    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      if (config.provider === 'claude') {
        vscode.window.showErrorMessage(
          'Claude Code CLI is not installed or not found in PATH. Install from https://claude.ai/code'
        );
      } else {
        vscode.window.showErrorMessage(
          'VS Code Language Model is not available. Install GitHub Copilot or another LM provider.'
        );
      }
      return;
    }

    const abortController = new AbortController();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Generating commit message with ${provider.name}...`,
        cancellable: true
      },
      async (_progress, token) => {
        // Connect VS Code cancellation to AbortController
        const cancellationListener = token.onCancellationRequested(() => {
          abortController.abort();
        });

        try {
          const providerConfig: ProviderConfig = {
            timeout: config.timeout,
            systemPrompt: config.prompt,
            userPrompt: config.userPrompt
          };

          const result = await provider.generateCommitMessage(
            filteredDiff,
            abortController,
            providerConfig,
            logDebug
          );

          if (token.isCancellationRequested) {
            return;
          }

          if (result.splitSuggested && result.commits.length > 1) {
            // Handle split commit flow
            const selectedMessage = await handleSplitCommit(repo, result.commits, context);
            if (selectedMessage) {
              repo.inputBox.value = selectedMessage;
            }
          } else {
            // Single commit flow
            repo.inputBox.value = result.message;
          }
        } catch (err) {
          if (token.isCancellationRequested) {
            vscode.window.showInformationMessage('Commit message generation cancelled');
            return;
          }

          const errorMsg = err instanceof Error ? err.message : 'Unknown error';

          if (errorMsg.includes('timed out')) {
            vscode.window.showErrorMessage(
              'Commit message generation timed out. Try with fewer staged changes.'
            );
          } else {
            vscode.window.showErrorMessage(`Failed to generate commit message: ${errorMsg}`);
          }
        } finally {
          cancellationListener.dispose();
        }
      }
    );
  });

  context.subscriptions.push(command);
}

/**
 * Wait for VS Code Git extension to reflect expected staged files.
 * After modifying the git index directly (via execFileSync), VS Code's cached
 * state may be stale. This refreshes the state and verifies staged files match.
 * Supports cancellation via CancellationToken (throws on cancel).
 */
async function waitForStagingReady(
  repo: Repository,
  expectedFiles: string[],
  token?: vscode.CancellationToken,
  maxRetries: number = 10,
  intervalMs: number = 100
): Promise<void> {
  const expectedSet = new Set(expectedFiles.map(f => f.replace(/\\/g, '/')));

  for (let i = 0; i < maxRetries; i++) {
    if (token?.isCancellationRequested) {
      logDebug('Staging wait cancelled by user');
      throw new vscode.CancellationError();
    }

    await repo.status();
    const currentStaged = getStagedRelativePaths(repo);
    const currentSet = new Set(currentStaged);

    // Check that every expected file is staged and no extra files are staged
    const allExpectedStaged = [...expectedSet].every(f => currentSet.has(f));
    const noExtraStaged = currentStaged.every(f => expectedSet.has(f));

    if (allExpectedStaged && noExtraStaged) {
      logDebug('Staging verified', { attempt: i + 1, staged: currentStaged });
      return;
    }

    logDebug('Staging not yet ready, retrying...', {
      attempt: i + 1,
      expected: [...expectedSet],
      actual: currentStaged
    });

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  // Final attempt - force one more refresh
  await repo.status();
  logDebug('Staging wait exhausted, proceeding with current state');
}

/**
 * Log debug information to output channel
 */
function logDebug(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] ${message}`);
  if (data !== undefined) {
    outputChannel.appendLine(JSON.stringify(data, null, 2));
  }
}

/**
 * Show a QuickPick dialog for split commit suggestions.
 * Returns the selected commit, 'all' mode for step-by-step, or undefined if cancelled.
 */
async function showSplitCommitPicker(
  commits: CommitSuggestion[]
): Promise<SplitPickerResult> {
  const stageAllItem: CommitQuickPickItem = {
    label: `$(list-ordered) Stage all commits step by step`,
    description: `(${commits.length} commits)`,
    isStageAll: true
  };

  const separator: CommitQuickPickItem = {
    label: '',
    kind: vscode.QuickPickItemKind.Separator
  };

  const commitItems: CommitQuickPickItem[] = commits.map((commit) => ({
    label: `$(git-commit) ${commit.message}`,
    description: `${commit.files.length} file${commit.files.length !== 1 ? 's' : ''}`,
    detail: commit.files.join(', '),
    commit: commit
  }));

  const selected = await vscode.window.showQuickPick(
    [stageAllItem, separator, ...commitItems],
    {
      title: 'Select a commit to stage',
      placeHolder: 'Split into multiple commits. Pick one, or stage all step by step:',
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!selected) {
    return undefined;
  }

  if (selected.isStageAll) {
    return { mode: 'all' };
  }

  return { mode: 'single', commit: selected.commit! };
}

/**
 * Validate that a file path is safe to use with git commands.
 * Prevents path traversal and absolute path attacks from AI-generated responses.
 */
function isValidRelativePath(filePath: string): boolean {
  // Reject empty or whitespace-only paths
  if (!filePath || !filePath.trim()) {
    return false;
  }

  // Reject null bytes
  if (filePath.includes('\0')) {
    return false;
  }

  // Reject absolute paths (Unix: /path, Windows: C:\path or C:/path)
  if (filePath.startsWith('/') || /^[A-Za-z]:/.test(filePath)) {
    return false;
  }

  // Reject path traversal sequences
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.some(part => part === '..')) {
    return false;
  }

  return true;
}

/**
 * Parse a git diff into sections by file
 */
function parseDiffSections(diff: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = diff.split('\n');
  let currentFile = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    // Match diff header: "diff --git a/path b/path"
    const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
    if (diffMatch) {
      // Save previous section
      if (currentFile && currentContent.length > 0) {
        sections.set(currentFile, currentContent.join('\n'));
      }
      currentFile = diffMatch[2]; // Use the "b" path (destination)
      currentContent = [line];
    } else if (currentFile) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentFile && currentContent.length > 0) {
    sections.set(currentFile, currentContent.join('\n'));
  }

  return sections;
}

/**
 * Get relative paths of all staged files from the VS Code Git API
 */
function getStagedRelativePaths(repo: Repository): string[] {
  return repo.state.indexChanges.map(change =>
    path.relative(repo.rootUri.fsPath, change.uri.fsPath).replace(/\\/g, '/')
  );
}

/**
 * Match AI-suggested file paths against actual staged files.
 * Handles exact match and case-insensitive match (for Windows).
 */
function resolveAiFilesToStaged(
  aiFiles: string[],
  stagedFiles: string[]
): { matched: string[]; unmatched: string[] } {
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const aiFile of aiFiles) {
    const normalized = aiFile.replace(/\\/g, '/');

    const exact = stagedFiles.find(f => f === normalized);
    if (exact) {
      matched.push(exact);
      continue;
    }

    const caseMatch = stagedFiles.find(f => f.toLowerCase() === normalized.toLowerCase());
    if (caseMatch) {
      matched.push(caseMatch);
      continue;
    }

    unmatched.push(aiFile);
  }

  return { matched, unmatched };
}

/**
 * Filter diff to remove sensitive files based on exclude patterns
 */
function filterSensitiveDiff(
  diff: string,
  excludePatterns: string[]
): { filteredDiff: string; excludedFiles: string[] } {
  const sections = parseDiffSections(diff);
  const excludedFiles: string[] = [];
  const includedSections: string[] = [];

  for (const [filePath, content] of sections) {
    const isExcluded = excludePatterns.some(pattern =>
      minimatch(filePath, pattern, { dot: true })
    );

    if (isExcluded) {
      excludedFiles.push(filePath);
    } else {
      includedSections.push(content);
    }
  }

  return {
    filteredDiff: includedSections.join('\n'),
    excludedFiles
  };
}

/**
 * Deduplicate files across split commits using a first-wins strategy.
 * If the same file appears in multiple commits, it stays in the first commit
 * and is removed from later ones. Commits left with 0 files are dropped.
 * Returns the cleaned commits and list of consolidated file descriptions.
 */
function deduplicateCommitFiles(
  commits: CommitSuggestion[]
): { commits: CommitSuggestion[]; consolidated: string[] } {
  const seen = new Set<string>();
  const consolidated: string[] = [];
  const result: CommitSuggestion[] = [];

  for (const commit of commits) {
    const uniqueFiles: string[] = [];

    for (const file of commit.files) {
      const normalized = file.replace(/\\/g, '/');
      if (seen.has(normalized)) {
        // File already claimed by an earlier commit
        const ownerCommit = result.find(c =>
          c.files.some(f => f.replace(/\\/g, '/') === normalized)
        );
        const ownerMsg = ownerCommit
          ? `"${ownerCommit.message}"`
          : 'an earlier commit';
        consolidated.push(`${file} -> ${ownerMsg}`);
      } else {
        seen.add(normalized);
        uniqueFiles.push(file);
      }
    }

    if (uniqueFiles.length > 0) {
      result.push({ ...commit, files: uniqueFiles });
    } else {
      logDebug('Dropped commit with no remaining files after dedup', {
        message: commit.message
      });
    }
  }

  return { commits: result, consolidated };
}

/**
 * Selectively unstage files not belonging to the selected commit.
 * Uses VS Code Git API to read staged state, validates AI paths against it,
 * then only unstages the complement (files NOT in the selected commit).
 */
async function stageFilesForCommit(
  repo: Repository,
  filesToStage: string[],
  token?: vscode.CancellationToken
): Promise<void> {
  const cwd = repo.rootUri.fsPath;
  logDebug('Smart staging files', { cwd, filesToStage });

  // Validate paths to prevent path traversal from AI responses
  const validFiles = filesToStage.filter(f => {
    if (!isValidRelativePath(f)) {
      logDebug(`Rejected invalid file path: ${f}`);
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) {
    throw new Error('No valid file paths to stage');
  }

  // Read currently staged files from VS Code Git API
  const stagedFiles = getStagedRelativePaths(repo);
  logDebug('Currently staged files (from Git API)', { stagedFiles });

  // Match AI-suggested files against actual staged files
  const { matched, unmatched } = resolveAiFilesToStaged(validFiles, stagedFiles);

  if (unmatched.length > 0) {
    logDebug('AI suggested files not found in staged changes', { unmatched });
  }

  if (matched.length === 0) {
    throw new Error('None of the suggested files match currently staged changes');
  }

  logDebug('Matched files to keep staged', { matched });

  // Compute files to unstage (staged files NOT in the selected commit)
  const matchedSet = new Set(matched);
  const filesToUnstage = stagedFiles.filter(f => !matchedSet.has(f));

  if (filesToUnstage.length === 0) {
    logDebug('All staged files belong to selected commit, no unstaging needed');
    return;
  }

  logDebug('Selectively unstaging files', { filesToUnstage });

  // Selectively unstage only the files not in the selected commit
  // (VS Code Git API does not expose an unstage method, so we use git reset)
  try {
    execFileSync('git', ['reset', 'HEAD', '--', ...filesToUnstage], {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    logDebug('Selectively unstaged files', { count: filesToUnstage.length });
  } catch (err) {
    logDebug('Failed to selectively unstage files', err);
    throw new Error('Failed to update staging area');
  }

  // Wait for VS Code Git to reflect the new staging state before proceeding.
  // Without this, the user could commit before VS Code sees the correct staged files.
  await waitForStagingReady(repo, matched, token);
}

/**
 * Stage files by running `git add` for the given paths.
 * Used during step-by-step split sessions (commits 2+) where files are unstaged.
 * Waits for VS Code Git to reflect the staging before returning.
 */
async function stageFiles(repo: Repository, files: string[], token?: vscode.CancellationToken): Promise<void> {
  const cwd = repo.rootUri.fsPath;
  const validFiles = files.filter(f => {
    if (!isValidRelativePath(f)) {
      logDebug(`Rejected invalid file path: ${f}`);
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) {
    throw new Error('No valid file paths to stage');
  }

  try {
    execFileSync('git', ['add', '--', ...validFiles], {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    logDebug('Staged files', { files: validFiles });
  } catch (err) {
    logDebug('Failed to stage files', err);
    throw new Error('Failed to stage files');
  }

  // Wait for VS Code Git to reflect the staged files before allowing commit
  await waitForStagingReady(repo, validFiles, token);
}

/**
 * Update the status bar item to show current split session progress.
 */
function updateSplitStatusBar(session: SplitSession): void {
  const { commits, currentIndex, statusBarItem } = session;
  const current = currentIndex + 1;
  const total = commits.length;

  if (currentIndex < commits.length - 1) {
    const nextMsg = commits[currentIndex + 1].message;
    const truncated = nextMsg.length > 40 ? nextMsg.substring(0, 37) + '...' : nextMsg;
    statusBarItem.text = `$(git-commit) Split ${current}/${total} | Next: ${truncated}`;
    statusBarItem.tooltip = `Commit ${current} of ${total}. Click to advance to next commit.\nNext: ${nextMsg}`;
  } else {
    statusBarItem.text = `$(git-commit) Split ${current}/${total} (last)`;
    statusBarItem.tooltip = `Last commit (${current} of ${total}). Commit to finish.`;
  }
}

/**
 * Start a step-by-step split commit session.
 * Stages the first commit and sets up auto-advance on commit.
 */
async function startSplitSession(
  repo: Repository,
  commits: CommitSuggestion[],
  context: vscode.ExtensionContext,
  token?: vscode.CancellationToken
): Promise<void> {
  cancelSplitSession();

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'claude-commit.nextSplitCommit';
  context.subscriptions.push(statusBarItem);

  const commitListener = repo.onDidCommit(() => {
    advanceSplitSession();
  });
  context.subscriptions.push(commitListener);

  activeSplitSession = {
    repo,
    commits,
    currentIndex: 0,
    statusBarItem,
    commitListener
  };

  // Stage first commit using selective unstage (same as single-pick flow)
  await stageFilesForCommit(repo, commits[0].files, token);
  repo.inputBox.value = commits[0].message;

  updateSplitStatusBar(activeSplitSession);
  statusBarItem.show();

  logDebug('Split session started', { totalCommits: commits.length });
}

/**
 * Advance to the next commit in the split session.
 * Called automatically on commit or manually via status bar click.
 * Stages files and waits for VS Code Git to be ready before setting the commit message.
 * Shows a cancellable progress notification during staging.
 */
async function advanceSplitSession(): Promise<void> {
  if (!activeSplitSession) {
    return;
  }

  const session = activeSplitSession;
  session.currentIndex++;

  if (session.currentIndex >= session.commits.length) {
    // All commits done
    cancelSplitSession();
    vscode.window.showInformationMessage('Split commits complete!');
    logDebug('Split session complete');
    return;
  }

  const commit = session.commits[session.currentIndex];
  const stepLabel = `${session.currentIndex + 1}/${session.commits.length}`;

  // For commits 2+, files are unstaged (they were unstaged in step 1).
  // Stage the next batch with a cancellable progress notification.
  let cancelled = false;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Staging files for commit ${stepLabel}...`,
      cancellable: true
    },
    async (_progress, token) => {
      try {
        await stageFiles(session.repo, commit.files, token);
      } catch (err) {
        if (err instanceof vscode.CancellationError || token.isCancellationRequested) {
          cancelled = true;
          return;
        }
        const msg = err instanceof Error ? err.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to stage files for next commit: ${msg}`);
        cancelSplitSession();
        return;
      }
    }
  );

  if (cancelled) {
    cancelSplitSession();
    vscode.window.showInformationMessage('Split session cancelled.');
    logDebug('Split session cancelled by user during staging');
    return;
  }

  // Session may have been cancelled by error handler above
  if (!activeSplitSession) {
    return;
  }

  // Only set the commit message after staging is verified ready
  session.repo.inputBox.value = commit.message;
  updateSplitStatusBar(session);

  logDebug('Advanced split session', {
    index: session.currentIndex,
    message: commit.message
  });
}

/**
 * Cancel and clean up any active split session.
 */
function cancelSplitSession(): void {
  if (!activeSplitSession) {
    return;
  }

  activeSplitSession.statusBarItem.hide();
  activeSplitSession.statusBarItem.dispose();
  activeSplitSession.commitListener.dispose();
  activeSplitSession = null;

  logDebug('Split session cancelled/cleaned up');
}

/**
 * Handle the split commit workflow:
 * 1. Show QuickPick for user to select one commit or stage all step by step
 * 2. Selectively unstage/stage files as needed
 * 3. Return the commit message, or undefined if cancelled
 */
async function handleSplitCommit(
  repo: Repository,
  commits: CommitSuggestion[],
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  logDebug('Split suggested', { commitCount: commits.length });

  // Deduplicate files across commits (first-wins strategy)
  const dedup = deduplicateCommitFiles(commits);
  commits = dedup.commits;

  if (dedup.consolidated.length > 0) {
    logDebug('Deduplicated overlapping files across commits', {
      consolidated: dedup.consolidated
    });

    if (dedup.consolidated.length === 1) {
      const fileName = dedup.consolidated[0].split(' -> ')[0];
      vscode.window.showInformationMessage(
        `"${fileName}" appeared in multiple commits -- consolidated into its first referenced commit.`
      );
    } else {
      vscode.window.showInformationMessage(
        `${dedup.consolidated.length} files appeared in multiple commits -- consolidated into their first referenced commit.`
      );
    }
  }

  // If dedup reduced to a single commit, skip the split picker
  if (commits.length <= 1) {
    if (commits.length === 1) {
      return commits[0].message;
    }
    return undefined;
  }

  const result = await showSplitCommitPicker(commits);

  if (!result) {
    logDebug('User cancelled split commit selection');
    return undefined;
  }

  if (result.mode === 'all') {
    logDebug('User selected stage all step by step');

    let cancelled = false;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Staging files for first commit...',
        cancellable: true
      },
      async (_progress, token) => {
        try {
          await startSplitSession(repo, commits, context, token);
        } catch (err) {
          if (err instanceof vscode.CancellationError || token.isCancellationRequested) {
            cancelled = true;
            return;
          }
          throw err;
        }
      }
    );

    if (cancelled) {
      cancelSplitSession();
      vscode.window.showInformationMessage('Split session cancelled.');
      logDebug('Split session cancelled by user during initial staging');
    }

    // First commit message is already set by startSplitSession
    return undefined;
  }

  // Single commit mode
  logDebug('User selected commit', {
    message: result.commit.message,
    files: result.commit.files
  });

  let singleCancelled = false;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Staging files for selected commit...',
      cancellable: true
    },
    async (_progress, token) => {
      try {
        await stageFilesForCommit(repo, result.commit.files, token);
      } catch (err) {
        if (err instanceof vscode.CancellationError || token.isCancellationRequested) {
          singleCancelled = true;
          return;
        }
        throw err;
      }
    }
  );

  if (singleCancelled) {
    logDebug('Single commit staging cancelled by user');
    return undefined;
  }

  return result.commit.message;
}

export function deactivate() {
  cancelSplitSession();
}
