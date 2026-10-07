// lib/openrouter.ts

/**
 * OpenRouter LLM Client using native fetch.
 *
 * Responsibilities:
 * - Connect to OpenRouter
 * - Normalize model slugs
 * - Send chat completion requests
 * - Graceful fallback to openrouter/auto
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto";

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

export function normalizeModelSlug(rawModel?: string): string {
  if (!rawModel) return "openrouter/auto";
  const trimmed = rawModel.replace(/^["']|["']$/g, "").trim();
  if (
    !trimmed ||
    trimmed === "liquid/lfm-2.5-embedding-350m:free" ||
    trimmed === "Ling 3.0 Flash Fin" ||
    trimmed === "openrouter/free" ||
    trimmed === "deepseek/deepseek-flash-latest" ||
    trimmed === "deepseek/deepseek-v4-flash-latest" ||
    trimmed.includes("deepseek-v4")
  ) {
    return "openrouter/auto";
  }
  if (trimmed === "gpt-4o") return "openai/gpt-4o";
  if (trimmed === "claude-3.5-sonnet") return "anthropic/claude-3.5-sonnet";
  if (trimmed === "gemini-pro" || trimmed === "gemini-flash" || trimmed === "gemini-2.5-flash") {
    return "google/gemini-2.5-flash";
  }
  return trimmed;
}

export async function openRouterChat(
  messages: OpenRouterMessage[],
  tools?: OpenRouterTool[],
  model?: string
): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const effectiveModel = normalizeModelSlug(model || process.env.OPENROUTER_MODEL || OPENROUTER_MODEL);

  const makeRequest = async (targetModel: string) => {
    const payload: any = {
      model: targetModel,
      messages,
      temperature: 0.1,
      max_tokens: 500,
      reasoning: { max_tokens: 0 },
    };
    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
        "X-Title": "CreditWise AI",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`OpenRouter HTTP ${res.status}: ${errBody}`);
    }

    return await res.json();
  };

  try {
    return await makeRequest(effectiveModel);
  } catch (err: any) {
    const errMsg = String(err?.message || "");
    if (
      effectiveModel !== "openrouter/auto" &&
      (errMsg.includes("not a valid model") ||
        errMsg.includes("embedding model") ||
        errMsg.includes("404") ||
        errMsg.includes("400"))
    ) {
      try {
        return await makeRequest("openrouter/auto");
      } catch (retryErr) {
        console.error("[OpenRouter] Retry with openrouter/auto failed:", retryErr);
      }
    }
    throw err;
  }
}

export async function simpleOpenRouterChat(
  messages: OpenRouterMessage[],
  model?: string
): Promise<string> {
  const response = await openRouterChat(messages, undefined, model);
  return response?.choices?.[0]?.message?.content || "";
}

/**
 * Executes a streaming chat completion request against OpenRouter.
 * Parses SSE chunks incrementally and invokes onToken(delta) in real-time.
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
  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const effectiveModel = normalizeModelSlug(
    options?.model || process.env.OPENROUTER_MODEL || OPENROUTER_MODEL
  );

  const executeStream = async (targetModel: string): Promise<string> => {
    const payload: any = {
      model: targetModel,
      messages,
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.max_tokens ?? 500,
      stream: true,
      reasoning: { max_tokens: options?.reasoningMaxTokens ?? 0 },
    };
    if (options?.tools && options.tools.length > 0) {
      payload.tools = options.tools;
      payload.tool_choice = "auto";
    }

    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: options?.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
        "X-Title": "CreditWise AI",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`OpenRouter HTTP ${res.status}: ${errBody}`);
    }

    if (!res.body) {
      throw new Error("OpenRouter returned empty response body for streaming.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";
    let lineBuffer = "";

    try {
      while (true) {
        if (options?.signal?.aborted) {
          try { await reader.cancel(); } catch {}
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(dataStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              accumulatedText += deltaContent;
              try {
                onToken(deltaContent);
              } catch (cbErr) {
                console.warn("[OpenRouterStream] onToken callback warning:", cbErr);
              }
            }
          } catch (jsonErr) {
            // Ignore incomplete line parse
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch {}
    }

    return accumulatedText;
  };

  try {
    return await executeStream(effectiveModel);
  } catch (err: any) {
    if (options?.signal?.aborted) {
      return "";
    }
    const errMsg = String(err?.message || "");
    if (
      effectiveModel !== "openrouter/free" &&
      (errMsg.includes("429") ||
        errMsg.includes("RateLimit") ||
        errMsg.includes("rate-limited") ||
        errMsg.includes("not a valid model") ||
        errMsg.includes("404") ||
        errMsg.includes("400"))
    ) {
      console.warn(`[OpenRouterStream] Primary model ${effectiveModel} failed, retrying with openrouter/free...`);
      try {
        return await executeStream("openrouter/free");
      } catch (retryErr) {
        console.error("[OpenRouterStream] Fallback retry failed:", retryErr);
      }
    }
    throw err;
  }
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY);
}

export function getOpenRouterModel(): string {
  return normalizeModelSlug(process.env.OPENROUTER_MODEL || OPENROUTER_MODEL);
}