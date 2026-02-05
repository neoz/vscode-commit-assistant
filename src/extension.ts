import * as vscode from 'vscode';
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

// Default system prompt for commit message generation
const DEFAULT_SYSTEM_PROMPT = `You are a Git commit message generator. Analyze the provided diff and generate commit messages following Conventional Commits specification.

## Rules
1. Format: <type>(<scope>): <description>
2. Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
3. Scope: Infer from semantic context; use file paths as hints when unclear (e.g., src/auth/ → auth). Omit if no clear scope.
4. Description: imperative mood, lowercase, no period, keep under 72 characters for the first line
5. No emojis
6. Group related changes into a single commit when same type and scope

## Split Detection
If the diff contains multiple unrelated changes (different features, fixes, or concerns), set suggest_split: true and provide separate commit messages.

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
  commit: CommitSuggestion;
}

interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: Repository[];
}

interface Repository {
  inputBox: { value: string };
  diff(staged: boolean): Promise<string>;
  rootUri: vscode.Uri;
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

  const command = vscode.commands.registerCommand('claude-commit.generate', async () => {
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
            const selectedMessage = await handleSplitCommit(repo, result.commits);
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
 * Show a QuickPick dialog for split commit suggestions
 * Returns the selected commit, or undefined if cancelled
 */
async function showSplitCommitPicker(
  commits: CommitSuggestion[]
): Promise<CommitSuggestion | undefined> {
  const items: CommitQuickPickItem[] = commits.map((commit) => ({
    label: `$(git-commit) ${commit.message}`,
    description: `${commit.files.length} file${commit.files.length !== 1 ? 's' : ''}`,
    detail: commit.files.join(', '),
    commit: commit
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: 'Select a commit to stage',
    placeHolder: 'Claude suggests splitting into multiple commits. Pick one to stage:',
    matchOnDescription: true,
    matchOnDetail: true
  });

  return selected?.commit;
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
 * Unstage all files, then stage only the files for the selected commit
 */
async function stageFilesForCommit(
  workspaceRoot: vscode.Uri,
  filesToStage: string[]
): Promise<void> {
  const cwd = workspaceRoot.fsPath;
  logDebug('Staging files', { cwd, filesToStage });

  // Validate and filter paths to prevent path traversal attacks
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

  logDebug('Valid files to stage', { validFiles });

  // Step 1: Unstage all currently staged files
  try {
    execFileSync('git', ['reset', 'HEAD'], { cwd, encoding: 'utf-8', stdio: 'pipe' });
    logDebug('Unstaged all files');
  } catch (err) {
    logDebug('Failed to unstage files (may be initial commit)', err);
  }

  // Step 2: Stage only the files for the selected commit
  for (const relativePath of validFiles) {
    try {
      // Use execFileSync to prevent command injection from AI-generated paths
      execFileSync('git', ['add', '--', relativePath], { cwd, encoding: 'utf-8', stdio: 'pipe' });
      logDebug(`Staged file: ${relativePath}`);
    } catch (err) {
      logDebug(`Failed to stage file: ${relativePath}`, err);
    }
  }
}

/**
 * Handle the split commit workflow:
 * 1. Show QuickPick for user to select one commit
 * 2. Unstage all files
 * 3. Stage only files for selected commit
 * 4. Return the commit message, or undefined if cancelled
 */
async function handleSplitCommit(
  repo: Repository,
  commits: CommitSuggestion[]
): Promise<string | undefined> {
  logDebug('Split suggested', { commitCount: commits.length });

  const selectedCommit = await showSplitCommitPicker(commits);

  if (!selectedCommit) {
    logDebug('User cancelled split commit selection');
    return undefined;
  }

  logDebug('User selected commit', {
    message: selectedCommit.message,
    files: selectedCommit.files
  });

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Staging files for selected commit...',
      cancellable: false
    },
    async () => {
      await stageFilesForCommit(repo.rootUri, selectedCommit.files);
    }
  );

  return selectedCommit.message;
}

export function deactivate() {}
