// lib/openrouter.ts

/**
 * OpenRouter LLM Client
 *
 * Responsibilities:
 * - Connect to OpenRouter
 * - Send messages to the selected model
 * - Support AI tool/function calling
 *
 * IMPORTANT:
 * This file does NOT contain business logic.
 * Business tools are handled by lib/ai/tools.ts.
 */

const { OpenAI } = require("openai");

const OPENROUTER_BASE_URL =
  "https://openrouter.ai/api/v1";

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || "";

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "openrouter/free";

const openRouterClient = new OpenAI({
  baseURL: OPENROUTER_BASE_URL,
  apiKey: OPENROUTER_API_KEY,

  defaultHeaders: {
    "HTTP-Referer":
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000",

    "X-Title":
      "InCraax AI Financial Assistant",
  },
});

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export interface OpenRouterMessage {
  role:
    | "system"
    | "user"
    | "assistant"
    | "tool";

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

/* -------------------------------------------------------------------------- */
/* OPENROUTER CHAT                                                            */
/* -------------------------------------------------------------------------- */

export async function openRouterChat(
  messages: OpenRouterMessage[],
  tools?: OpenRouterTool[],
  model?: string
) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured."
    );
  }

  try {
    const request: any = {
      model: model || OPENROUTER_MODEL,

      messages,

      temperature: 0.1,
    };

    /*
     * Only send tools when tools are actually provided.
     */
    if (tools && tools.length > 0) {
      request.tools = tools;
      request.tool_choice = "auto";
    }

    const response =
      await openRouterClient.chat.completions.create(
        request
      );

    return response;
  } catch (error) {
    console.error(
      "[OpenRouter] API error:",
      error
    );

    throw new Error(
      `OpenRouter request failed: ${
        error instanceof Error
          ? error.message
          : "Unknown error"
      }`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* SIMPLE CHAT                                                                 */
/* -------------------------------------------------------------------------- */

export async function simpleOpenRouterChat(
  messages: OpenRouterMessage[],
  model?: string
) {
  const response = await openRouterChat(
    messages,
    undefined,
    model
  );

  return (
    response.choices?.[0]?.message?.content ||
    ""
  );
}

/* -------------------------------------------------------------------------- */
/* CONFIGURATION CHECK                                                        */
/* -------------------------------------------------------------------------- */

export function isOpenRouterConfigured(): boolean {
  return Boolean(OPENROUTER_API_KEY);
}

export function getOpenRouterModel(): string {
  return OPENROUTER_MODEL;
}