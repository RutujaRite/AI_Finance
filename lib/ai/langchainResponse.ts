// lib/ai/langchainResponse.ts

/**
 * Unified LangChain Response Generation Service for CreditWise AI.
 *
 * Implements LangChain Expression Language (LCEL) pipelines using ChatOpenAI
 * configured for OpenRouter, with native token streaming, structured messages,
 * and resilient model fallbacks.
 */

import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";

const DEFAULT_FALLBACK_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface LangChainChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  reasoningMaxTokens?: number;
  tools?: any[];
}

export interface ChatMessageInput {
  role: "system" | "user" | "assistant" | "ai" | "tool";
  content?: string | null;
  tool_call_id?: string;
  name?: string;
}

/**
 * Strips reasoning tokens or <think>...</think> preambles from model output.
 */
export function stripReasoningPreamble(text: string): string {
  if (!text) return "";
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  clean = clean.replace(/^(\s*thought:\s*[\s\S]*?\n\s*\n)+/i, "");
  return clean.trim();
}

/**
 * Normalizes user-specified or environment model slugs.
 */
export function normalizeModelSlug(rawModel?: string): string {
  if (!rawModel) return DEFAULT_FALLBACK_MODEL;
  const trimmed = rawModel.replace(/^["']|["']$/g, "").trim();
  if (
    !trimmed ||
    trimmed === "liquid/lfm-2.5-embedding-350m:free" ||
    trimmed === "Ling 3.0 Flash Fin" ||
    trimmed === "openrouter/auto" ||
    trimmed === "openrouter/free" ||
    trimmed === "deepseek/deepseek-flash-latest" ||
    trimmed === "deepseek/deepseek-v4-flash-latest" ||
    trimmed.includes("deepseek-v4")
  ) {
    return DEFAULT_FALLBACK_MODEL;
  }
  if (trimmed === "gpt-4o") return "openai/gpt-4o";
  if (trimmed === "gpt-4o-mini") return "openai/gpt-4o-mini";
  if (trimmed.includes("claude-3-5-sonnet") || trimmed.includes("claude-3.5-sonnet")) return "anthropic/claude-3.5-sonnet";
  if (trimmed.includes("claude-3-opus") || trimmed.includes("claude-3.opus")) return "anthropic/claude-3-opus";
  if (trimmed === "gemini-pro" || trimmed === "gemini-flash" || trimmed === "gemini-2.5-flash") {
    return "google/gemini-2.5-flash";
  }
  if (trimmed.includes("gemini-1.5-pro")) return "google/gemini-pro-1.5";
  if (trimmed === "llama-3.3-70b-versatile" || trimmed === "llama-3.3-70b") return "meta-llama/llama-3.3-70b-instruct";
  if (trimmed === "deepseek-r1" || trimmed === "deepseek/deepseek-r1") return "deepseek/deepseek-r1";
  if (trimmed === "deepseek-v3") return "deepseek/deepseek-chat";
  if (!trimmed.includes("/") && trimmed.startsWith("claude-")) return `anthropic/${trimmed}`;
  if (!trimmed.includes("/") && trimmed.startsWith("gpt-")) return `openai/${trimmed}`;
  if (!trimmed.includes("/") && trimmed.startsWith("llama-")) return `meta-llama/${trimmed}`;
  return trimmed;
}

/**
 * Converts generic message inputs or plain objects into LangChain BaseMessage instances.
 */
export function toLangChainMessages(
  inputs: Array<ChatMessageInput | BaseMessage>
): BaseMessage[] {
  return inputs.map((item) => {
    if (item instanceof BaseMessage) {
      return item;
    }
    const role = (item.role || "user").toLowerCase();
    const content = item.content ?? "";
    if (role === "system") {
      return new SystemMessage(content);
    }
    if (role === "assistant" || role === "ai") {
      return new AIMessage(content);
    }
    return new HumanMessage(content);
  });
}

/**
 * Instantiates a configured LangChain ChatOpenAI instance for OpenRouter.
 */
export function createLangChainChatModel(
  options?: LangChainChatOptions,
  modelOverride?: string
): ChatOpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const effectiveModel = normalizeModelSlug(
    modelOverride || options?.model || process.env.OPENROUTER_MODEL || DEFAULT_FALLBACK_MODEL
  );

  return new ChatOpenAI({
    apiKey,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
        "X-Title": "CreditWise AI",
      },
    },
    model: effectiveModel,
    temperature: options?.temperature ?? 0.2,
    maxTokens: options?.maxTokens ?? 600,
    modelKwargs: {
      reasoning: { max_tokens: options?.reasoningMaxTokens ?? 0 },
    },
  });
}

/**
 * Checks whether an error from OpenRouter/provider should trigger a model fallback retry.
 */
function isFallbackEligibleError(err: any): boolean {
  if (!err) return true;
  const msg = String(err?.message || "").toLowerCase();
  const status = err?.status || err?.code;
  // If the user deliberately aborted, do not fallback
  if (err?.name === "AbortError" || msg.includes("aborted")) {
    return false;
  }
  // Any upstream provider failure, bad payload/choices, 4xx/5xx, or network glitch should trigger fallback
  return true;
}

/**
 * Executes a streaming chat completion using LangChain LCEL (ChatOpenAI.pipe(StringOutputParser)).
 * Yields tokens in real-time to onToken callback and returns complete accumulated text.
 */
export async function generateLangChainChatStream(
  messages: Array<ChatMessageInput | BaseMessage>,
  onToken: (token: string) => void,
  options?: LangChainChatOptions
): Promise<string> {
  const baseMessages = toLangChainMessages(messages);
  const effectiveModel = normalizeModelSlug(
    options?.model || process.env.OPENROUTER_MODEL || DEFAULT_FALLBACK_MODEL
  );

  const execute = async (targetModel: string): Promise<string> => {
    const model = createLangChainChatModel(options, targetModel);
    const parser = new StringOutputParser();
    const chain = model.pipe(parser);

    const stream = await chain.stream(baseMessages, {
      signal: options?.signal,
    });

    let accumulated = "";
    for await (const chunk of stream) {
      if (options?.signal?.aborted) break;
      if (chunk) {
        accumulated += chunk;
        try {
          onToken(chunk);
        } catch (cbErr) {
          console.warn("[LangChainChatStream] onToken callback warning:", cbErr);
        }
      }
    }
    return stripReasoningPreamble(accumulated);
  };

  try {
    return await execute(effectiveModel);
  } catch (err: any) {
    if (options?.signal?.aborted) {
      return "";
    }
    if (effectiveModel !== DEFAULT_FALLBACK_MODEL && isFallbackEligibleError(err)) {
      console.warn(
        `[LangChainChatStream] Primary model ${effectiveModel} failed, retrying with fallback ${DEFAULT_FALLBACK_MODEL}...`
      );
      try {
        return await execute(DEFAULT_FALLBACK_MODEL);
      } catch (retryErr) {
        console.error(
          `[LangChainChatStream] Fallback retry with ${DEFAULT_FALLBACK_MODEL} failed:`,
          retryErr
        );
      }
    }
    throw err;
  }
}

/**
 * Executes a non-streaming single-call response using LangChain LCEL (ChatOpenAI.pipe(StringOutputParser)).
 * Returns the parsed, cleaned string reply.
 */
export async function generateLangChainChatResponse(
  messages: Array<ChatMessageInput | BaseMessage>,
  options?: LangChainChatOptions
): Promise<string> {
  const baseMessages = toLangChainMessages(messages);
  const effectiveModel = normalizeModelSlug(
    options?.model || process.env.OPENROUTER_MODEL || DEFAULT_FALLBACK_MODEL
  );

  const execute = async (targetModel: string): Promise<string> => {
    const model = createLangChainChatModel(options, targetModel);
    const parser = new StringOutputParser();
    const chain = model.pipe(parser);

    const response = await chain.invoke(baseMessages, {
      signal: options?.signal,
    });
    return stripReasoningPreamble(response || "");
  };

  try {
    return await execute(effectiveModel);
  } catch (err: any) {
    if (options?.signal?.aborted) {
      return "";
    }
    if (effectiveModel !== DEFAULT_FALLBACK_MODEL && isFallbackEligibleError(err)) {
      console.warn(
        `[LangChainChatResponse] Primary model ${effectiveModel} failed, retrying with fallback ${DEFAULT_FALLBACK_MODEL}...`
      );
      try {
        return await execute(DEFAULT_FALLBACK_MODEL);
      } catch (retryErr) {
        console.error(
          `[LangChainChatResponse] Fallback retry with ${DEFAULT_FALLBACK_MODEL} failed:`,
          retryErr
        );
      }
    }
    throw err;
  }
}
