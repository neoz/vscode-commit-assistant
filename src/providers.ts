import * as vscode from 'vscode';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { execFileSync } from 'child_process';
import { z } from 'zod';

// Zod schemas for validating AI response
const CommitSuggestionSchema = z.object({
  message: z.string(),
  files: z.array(z.string()),
  reasoning: z.string()
});

const GenerateResponseSchema = z.object({
  suggest_split: z.boolean(),
  commits: z.array(CommitSuggestionSchema)
});

// Response types (inferred from schemas)
export type CommitSuggestion = z.infer<typeof CommitSuggestionSchema>;
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

/**
 * Result from commit message generation
 */
export interface GenerateResult {
  message: string;
  splitSuggested: boolean;
  commits: CommitSuggestion[];
}

/**
 * Configuration passed to providers
 */
export interface ProviderConfig {
  timeout: number;
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Provider type union
 */
export type ProviderType = 'claude' | 'vscode-lm';

/**
 * Interface for commit message providers
 */
export interface CommitProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  generateCommitMessage(
    diff: string,
    abortController: AbortController,
    config: ProviderConfig,
    logDebug: (msg: string, data?: unknown) => void
  ): Promise<GenerateResult>;
}

/**
 * Parse and validate the JSON response from AI using Zod schema
 */
function parseCommitResponse(response: string): GenerateResponse | null {
  try {
    let jsonStr = response.trim();

    // Remove markdown code block if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    return GenerateResponseSchema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Build the full prompt from config and diff
 */
function buildPrompt(config: ProviderConfig, diff: string): string {
  const userPrompt = config.userPrompt.replace('{diff}', diff);
  return `${config.systemPrompt}\n\n---\n\n${userPrompt}`;
}

/**
 * Run a promise with timeout, aborting if it exceeds the limit
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  abortController: AbortController
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(new Error(`Request timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Convert parsed response to GenerateResult
 */
function toGenerateResult(
  parsed: GenerateResponse | null,
  rawResponse: string,
  logDebug: (msg: string, data?: unknown) => void
): GenerateResult {
  if (!parsed) {
    logDebug('Failed to parse JSON, using raw response as fallback');
    return {
      message: rawResponse.trim(),
      splitSuggested: false,
      commits: []
    };
  }

  // Log reasoning for debugging
  for (const commit of parsed.commits) {
    logDebug(`Commit reasoning: ${commit.message}`, {
      files: commit.files,
      reasoning: commit.reasoning
    });
  }

  // Handle split suggestion
  if (parsed.suggest_split && parsed.commits.length > 1) {
    return {
      message: parsed.commits[0].message,
      splitSuggested: true,
      commits: parsed.commits
    };
  }

  return {
    message: parsed.commits[0]?.message || rawResponse.trim(),
    splitSuggested: false,
    commits: parsed.commits
  };
}

/**
 * Find the path to the Claude Code executable
 */
function findClaudeExecutable(): string | undefined {
  try {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'where' : 'which';
    const result = execFileSync(cmd, ['claude'], { encoding: 'utf-8' }).trim();
    const firstPath = result.split('\n')[0].trim();
    return firstPath || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Claude Agent SDK provider
 */
export class ClaudeProvider implements CommitProvider {
  readonly name = 'Claude';

  constructor(private model: string = 'sonnet') {}

  async isAvailable(): Promise<boolean> {
    return findClaudeExecutable() !== undefined;
  }

  async generateCommitMessage(
    diff: string,
    abortController: AbortController,
    config: ProviderConfig,
    logDebug: (msg: string, data?: unknown) => void
  ): Promise<GenerateResult> {
    const prompt = buildPrompt(config, diff);

    const generatePromise = (async () => {
      let rawResponse = '';

      const claudePath = findClaudeExecutable();
      if (!claudePath) {
        throw new Error('Claude Code CLI not found in PATH');
      }

      for await (const message of query({
        prompt,
        options: {
          abortController,
          maxTurns: 1,
          allowedTools: [],
          pathToClaudeCodeExecutable: claudePath,
          model: this.model
        }
      })) {
        if (abortController.signal.aborted) {
          throw new Error('Cancelled');
        }

        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if ('text' in block) {
              rawResponse += block.text;
            }
          }
        }

        if (message.type === 'result') {
          logDebug('Result received', { subtype: message.subtype });

          if (message.subtype === 'success') {
            rawResponse = message.result || rawResponse;
          } else if (message.subtype === 'error_max_turns') {
            logDebug('Max turns reached, using accumulated response');
          } else if (message.subtype === 'error_during_execution') {
            const errorMsg = 'errors' in message
              ? (message.errors as string[])?.join(', ')
              : 'Execution error';
            throw new Error(`Generation failed: ${errorMsg}`);
          } else {
            throw new Error(`Generation failed: ${message.subtype}`);
          }
        }
      }

      logDebug('Raw response from Claude', rawResponse);

      const parsed = parseCommitResponse(rawResponse);
      return toGenerateResult(parsed, rawResponse, logDebug);
    })();

    return withTimeout(generatePromise, config.timeout, abortController);
  }
}

/**
 * VS Code Language Model API provider
 */
export class VSCodeLMProvider implements CommitProvider {
  readonly name = 'VS Code Language Model';

  constructor(private modelFamily: string = 'gpt-4o') {}

  async isAvailable(): Promise<boolean> {
    if (!vscode.lm) {
      return false;
    }

    try {
      const models = await vscode.lm.selectChatModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }

  async generateCommitMessage(
    diff: string,
    abortController: AbortController,
    config: ProviderConfig,
    logDebug: (msg: string, data?: unknown) => void
  ): Promise<GenerateResult> {
    if (!vscode.lm) {
      throw new Error('VS Code Language Model API not available');
    }

    const fullPrompt = buildPrompt(config, diff);

    // Create cancellation token from AbortController
    const tokenSource = new vscode.CancellationTokenSource();
    const abortListener = () => tokenSource.cancel();
    abortController.signal.addEventListener('abort', abortListener);

    const generatePromise = (async () => {
      try {
        // Select model - try specific family first, then fall back to any available
        let models = await vscode.lm.selectChatModels({ family: this.modelFamily });

        if (models.length === 0) {
          logDebug(`No models found for family "${this.modelFamily}", trying any available model`);
          models = await vscode.lm.selectChatModels();
        }

        if (models.length === 0) {
          throw new Error('No language models available. Install GitHub Copilot or another LM provider.');
        }

        const model = models[0];
        logDebug('Using VS Code LM model', { id: model.id, name: model.name, family: model.family });

        const messages = [vscode.LanguageModelChatMessage.User(fullPrompt)];

        let rawResponse = '';

        try {
          const response = await model.sendRequest(messages, {}, tokenSource.token);

          for await (const fragment of response.text) {
            if (abortController.signal.aborted) {
              throw new Error('Cancelled');
            }
            rawResponse += fragment;
          }
        } catch (err) {
          if (err instanceof vscode.LanguageModelError) {
            throw new Error(`VS Code LM error: ${err.message}`);
          }
          throw err;
        }

        logDebug('Raw response from VS Code LM', rawResponse);

        const parsed = parseCommitResponse(rawResponse);
        return toGenerateResult(parsed, rawResponse, logDebug);
      } finally {
        abortController.signal.removeEventListener('abort', abortListener);
        tokenSource.dispose();
      }
    })();

    return withTimeout(generatePromise, config.timeout, abortController);
  }
}

/**
 * Create a provider instance based on type and model
 */
export function createProvider(
  providerType: ProviderType,
  model: string
): CommitProvider {
  switch (providerType) {
    case 'claude':
      return new ClaudeProvider(model);
    case 'vscode-lm':
      return new VSCodeLMProvider(model);
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}
