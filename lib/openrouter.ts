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
    trimmed === "openrouter/free"
  ) {
    return "openrouter/auto";
  }
  if (trimmed === "gpt-4o") return "openai/gpt-4o";
  if (trimmed === "claude-3.5-sonnet") return "anthropic/claude-3.5-sonnet";
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

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY);
}

export function getOpenRouterModel(): string {
  return normalizeModelSlug(process.env.OPENROUTER_MODEL || OPENROUTER_MODEL);
}