// lib/openrouter.ts

/**
 * OpenRouter LLM Service powered by LangChain LCEL.
 *
 * Responsibilities:
 * - Unify response generation using LangChain (ChatOpenAI, BaseMessage, StringOutputParser)
 * - Provide native token streaming with real-time callbacks
 * - Graceful fallback to resilient models (nvidia/nemotron-3-super-120b-a12b:free)
 * - Retain backward-compatible interfaces for existing callers
 */

import {
  generateLangChainChatStream,
  generateLangChainChatResponse,
  normalizeModelSlug,
  stripReasoningPreamble,
  createLangChainChatModel,
  ChatMessageInput,
  LangChainChatOptions,
} from "./ai/langchainResponse";

export {
  generateLangChainChatStream,
  generateLangChainChatResponse,
  normalizeModelSlug,
  stripReasoningPreamble,
  createLangChainChatModel,
};

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: any[];
}

export interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

/**
 * Executes chat completion via LangChain LCEL, returning an OpenAI-compatible choices response.
 */
export async function openRouterChat(
  messages: OpenRouterMessage[],
  tools?: OpenRouterTool[],
  model?: string,
  options?: { signal?: AbortSignal; timeoutMs?: number; max_tokens?: number }
): Promise<any> {
  const content = await generateLangChainChatResponse(
    messages as ChatMessageInput[],
    {
      model,
      signal: options?.signal,
      maxTokens: options?.max_tokens,
      timeoutMs: options?.timeoutMs,
      tools,
    }
  );

  return {
    id: "lc-" + Date.now(),
    choices: [
      {
        message: {
          role: "assistant",
          content,
        },
        finish_reason: "stop",
      },
    ],
  };
}

/**
 * Executes non-streaming single-call response using LangChain LCEL.
 */
export async function simpleOpenRouterChat(
  messages: OpenRouterMessage[],
  model?: string,
  options?: { signal?: AbortSignal; timeoutMs?: number; max_tokens?: number }
): Promise<string> {
  return await generateLangChainChatResponse(
    messages as ChatMessageInput[],
    {
      model,
      signal: options?.signal,
      maxTokens: options?.max_tokens,
      timeoutMs: options?.timeoutMs,
    }
  );
}

/**
 * Executes a streaming chat completion request using LangChain native stream.
 * Invokes onToken(tokenChunk) in real-time as tokens are generated.
 */
export async function openRouterChatStream(
  messages: OpenRouterMessage[],
  onToken: (token: string) => void,
  options?: {
    model?: string;
    tools?: OpenRouterTool[];
    signal?: AbortSignal;
    temperature?: number;
    max_tokens?: number;
    reasoningMaxTokens?: number;
  }
): Promise<string> {
  return await generateLangChainChatStream(
    messages as ChatMessageInput[],
    onToken,
    {
      model: options?.model,
      signal: options?.signal,
      temperature: options?.temperature,
      maxTokens: options?.max_tokens,
      reasoningMaxTokens: options?.reasoningMaxTokens,
      tools: options?.tools,
    }
  );
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function getOpenRouterModel(): string {
  return normalizeModelSlug(process.env.OPENROUTER_MODEL || OPENROUTER_MODEL);
}