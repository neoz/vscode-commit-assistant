import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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
    // Truncate diff if too large (keep under 10KB for command line)
    const maxLen = 10000;
    const truncatedDiff = diff.length > maxLen
      ? diff.substring(0, maxLen) + '\n... (truncated)'
      : diff;

    // Write prompt + diff to temp file, then pipe to claude
    const inputFile = path.join(os.tmpdir(), `claude-input-${Date.now()}.txt`);
    const content = `Generate a conventional commit message for this diff. Output ONLY the commit message (format: type(scope): description). No explanation.

${truncatedDiff}`;
    fs.writeFileSync(inputFile, content);

    const isWindows = process.platform === 'win32';
    const proc = isWindows
      ? spawn('cmd', ['/c', `type "${inputFile}" | claude -p`], { shell: true, env: process.env })
      : spawn('sh', ['-c', `cat "${inputFile}" | claude -p`], { shell: true, env: process.env });

    // Store inputFile for cleanup
    const cleanup = () => { try { fs.unlinkSync(inputFile); } catch {} };

    let stdout = '';
    let stderr = '';

    // Timeout after 60 seconds
    const timeout = setTimeout(() => {
      proc.kill();
      cleanup();
      reject(new Error('Claude timed out'));
    }, 60000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      cleanup();

      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `claude exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

export function deactivate() {}
