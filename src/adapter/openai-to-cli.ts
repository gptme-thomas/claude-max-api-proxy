/**
 * Converts OpenAI chat request format to Claude CLI input
 */

import type { OpenAIChatRequest } from "../types/openai.js";

export type ClaudeModel = "opus" | "sonnet" | "haiku";

export interface CliInput {
  prompt: string;
  model: ClaudeModel;
  sessionId?: string;
  systemPrompt?: string;
}

const MODEL_MAP: Record<string, ClaudeModel> = {
  // Direct model names
  "claude-opus-4": "opus",
  "claude-sonnet-4": "sonnet",
  "claude-haiku-4": "haiku",
  // With provider prefix
  "claude-code-cli/claude-opus-4": "opus",
  "claude-code-cli/claude-sonnet-4": "sonnet",
  "claude-code-cli/claude-haiku-4": "haiku",
  // Aliases
  "opus": "opus",
  "sonnet": "sonnet",
  "haiku": "haiku",
};

/**
 * Extract Claude model alias from request model string
 */
export function extractModel(model: string): ClaudeModel {
  // Try direct lookup
  if (MODEL_MAP[model]) {
    return MODEL_MAP[model];
  }

  // Try stripping provider prefix
  const stripped = model.replace(/^claude-code-cli\//, "");
  if (MODEL_MAP[stripped]) {
    return MODEL_MAP[stripped];
  }

  // Default to opus (Claude Max subscription)
  return "opus";
}

/**
 * Separate system messages from conversation messages.
 *
 * System messages are extracted and concatenated into a single system prompt
 * string, which gets passed to Claude CLI via --system-prompt. This replaces
 * Claude Code's default system prompt, allowing the caller (e.g. gptme) to
 * control model behavior.
 *
 * Non-system messages are formatted into a prompt string for the CLI.
 */
export function convertMessages(messages: OpenAIChatRequest["messages"]): {
  prompt: string;
  systemPrompt?: string;
} {
  const systemParts: string[] = [];
  const promptParts: string[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        systemParts.push(msg.content);
        break;

      case "user":
        promptParts.push(msg.content);
        break;

      case "assistant":
        promptParts.push(`<previous_response>\n${msg.content}\n</previous_response>\n`);
        break;
    }
  }

  return {
    prompt: promptParts.join("\n").trim(),
    systemPrompt: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
  };
}

/**
 * Convert OpenAI chat request to CLI input format
 */
export function openaiToCli(request: OpenAIChatRequest): CliInput {
  const { prompt, systemPrompt } = convertMessages(request.messages);
  return {
    prompt,
    model: extractModel(request.model),
    sessionId: request.user, // Use OpenAI's user field for session mapping
    systemPrompt,
  };
}
