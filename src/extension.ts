import * as vscode from 'vscode';
import { spawn } from 'child_process';

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

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Generating commit message with Claude...',
        cancellable: false
      },
      async () => {
        try {
          const message = await generateCommitMessage(diff);
          repo.inputBox.value = message;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          vscode.window.showErrorMessage(`Failed to generate commit message: ${errorMsg}`);
        }
      }
    );
  });

  context.subscriptions.push(command);
}

function generateCommitMessage(diff: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', 'Generate a concise git commit message for the following diff. Output only the commit message, nothing else:'], {
      shell: true,
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `claude exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });

    // Pass diff via stdin to avoid command line length limits
    proc.stdin.write(diff);
    proc.stdin.end();
  });
}

export function deactivate() {}
