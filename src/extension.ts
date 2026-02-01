import * as vscode from 'vscode';
import { query } from '@anthropic-ai/claude-agent-sdk';

interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: Repository[];
}

interface Repository {
  inputBox: { value: string };
  diff(staged: boolean): Promise<string>;
}

export function activate(context: vscode.ExtensionContext) {
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

    const abortController = new AbortController();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Generating commit message with Claude...',
        cancellable: true
      },
      async (_progress, token) => {
        // Connect VS Code cancellation to AbortController
        const cancellationListener = token.onCancellationRequested(() => {
          abortController.abort();
        });

        try {
          const message = await generateCommitMessage(diff, abortController);
          if (!token.isCancellationRequested) {
            repo.inputBox.value = message;
          }
        } catch (err) {
          if (token.isCancellationRequested) {
            vscode.window.showInformationMessage('Commit message generation cancelled');
            return;
          }

          const errorMsg = err instanceof Error ? err.message : 'Unknown error';

          // Auto-detect specific error types
          if (isAuthError(errorMsg)) {
            vscode.window.showErrorMessage(
              'Claude Code is not authenticated. Please run "claude" in your terminal to authenticate.'
            );
          } else if (isNotInstalledError(errorMsg)) {
            vscode.window.showErrorMessage(
              'Claude Code CLI is not installed. Install it from https://claude.ai/code'
            );
          } else if (errorMsg.includes('timed out')) {
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

function isAuthError(message: string): boolean {
  const authPatterns = [
    'authentication',
    'authenticated',
    'API key',
    'api_key',
    'unauthorized',
    'not logged in',
    'please login',
    'auth'
  ];
  const lowerMsg = message.toLowerCase();
  return authPatterns.some(pattern => lowerMsg.includes(pattern.toLowerCase()));
}

function isNotInstalledError(message: string): boolean {
  const notInstalledPatterns = [
    'not found',
    'ENOENT',
    'command not found',
    'not installed',
    'cannot find',
    'CLINotFoundError'
  ];
  const lowerMsg = message.toLowerCase();
  return notInstalledPatterns.some(pattern => lowerMsg.includes(pattern.toLowerCase()));
}

async function generateCommitMessage(
  diff: string,
  abortController: AbortController
): Promise<string> {
  const config = vscode.workspace.getConfiguration('claude-commit');
  const maxLen = config.get<number>('maxDiffLength', 10000);
  const promptTemplate = config.get<string>('promptTemplate',
    'Generate a conventional commit message for this diff. Output ONLY the commit message (format: type(scope): description). No explanation.');

  const truncatedDiff = diff.length > maxLen
    ? diff.substring(0, maxLen) + '\n... (truncated)'
    : diff;

  const prompt = `${promptTemplate}\n\n${truncatedDiff}`;

  // Set up timeout (30 seconds)
  const timeoutMs = 30000;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(new Error('Request timed out after 30 seconds'));
    }, timeoutMs);
  });

  const generatePromise = (async () => {
    let commitMessage = '';

    for await (const message of query({
      prompt,
      options: {
        abortController,
        maxTurns: 1,
        allowedTools: []
      }
    })) {
      // Check for abort
      if (abortController.signal.aborted) {
        throw new Error('Cancelled');
      }

      // Extract text from assistant messages
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if ('text' in block) {
            commitMessage += block.text;
          }
        }
      }

      // Handle final result
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          commitMessage = message.result || commitMessage;
        } else {
          const errors = message.errors?.join(', ') || 'Unknown error';
          throw new Error(`Generation failed: ${errors}`);
        }
      }
    }

    return commitMessage.trim();
  })();

  try {
    return await Promise.race([generatePromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function deactivate() {}
