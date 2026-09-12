// lib/openrouter.js
/**
 * OpenRouter (LLM) integration for AI-powered conversations.
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function normalizeModelSlug(rawModel) {
  if (!rawModel) return "openrouter/auto";
  const trimmed = String(rawModel).replace(/^["']|["']$/g, "").trim();
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

async function openRouterChat(messages, tools, model) {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const effectiveModel = normalizeModelSlug(model || process.env.OPENROUTER_MODEL || "openrouter/auto");

  const makeReq = async (targetModel) => {
    const payload = {
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
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
    }

    return await res.json();
  };

  try {
    return await makeReq(effectiveModel);
  } catch (err) {
    const errMsg = String(err?.message || "");
    if (
      effectiveModel !== "openrouter/auto" &&
      (errMsg.includes("not a valid model") ||
        errMsg.includes("embedding model") ||
        errMsg.includes("404") ||
        errMsg.includes("400"))
    ) {
      try {
        return await makeReq("openrouter/auto");
      } catch (retryErr) {
        console.error("[OpenRouter JS] Retry failed:", retryErr);
      }
    }
    throw err;
  }
}

async function simpleOpenRouterChat(messages, model) {
  const response = await openRouterChat(messages, undefined, model);
  return response?.choices?.[0]?.message?.content || "";
}

function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function getOpenRouterModel() {
  return normalizeModelSlug(process.env.OPENROUTER_MODEL || "openrouter/auto");
}

module.exports = {
  openRouterChat,
  simpleOpenRouterChat,
  isOpenRouterConfigured,
  getOpenRouterModel,
  normalizeModelSlug,
};
