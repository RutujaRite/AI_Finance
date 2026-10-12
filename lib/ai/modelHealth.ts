/**
 * lib/ai/modelHealth.ts
 *
 * Diagnostic health checker for AI models and provider API keys.
 * Specifically checks OpenRouter key validity, expiration, credits, and live model responsiveness.
 */

import pool from "@/lib/db";
import { resolveProviderFromModel } from "./modelRouter";

export type KeyHealthStatus =
  | "active"
  | "expired"
  | "insufficient_credits"
  | "invalid_key"
  | "missing_key"
  | "rate_limited"
  | "error";

export interface ModelHealthResult {
  model_id?: number;
  model_name: string;
  provider: string;
  category?: string;
  is_operational: boolean;
  status: KeyHealthStatus;
  http_status?: number;
  message: string;
  remedy?: string;
  latency_ms?: number;
  key_details?: {
    is_free_tier?: boolean;
    expires_at?: string | null;
    free_requests_remaining?: number;
    total_credits?: number;
    has_custom_key?: boolean;
  };
  checked_at: string;
}

/**
 * Tests an OpenRouter API key and model combination.
 */
export async function testOpenRouterKey(
  apiKey: string,
  modelName: string
): Promise<ModelHealthResult> {
  const startTime = Date.now();
  const cleanKey = String(apiKey || "").trim();

  if (!cleanKey) {
    return {
      model_name: modelName,
      provider: "OpenRouter",
      is_operational: false,
      status: "missing_key",
      message: "No OpenRouter API key configured.",
      remedy: "Add your OPENROUTER_API_KEY in .env.local or enter a custom key.",
      checked_at: new Date().toISOString(),
    };
  }

  // 1. Check Key Authentication via https://openrouter.ai/api/v1/auth/key
  let keyData: any = null;
  try {
    const authRes = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        Authorization: `Bearer ${cleanKey}`,
      },
    });

    if (authRes.status === 401) {
      return {
        model_name: modelName,
        provider: "OpenRouter",
        is_operational: false,
        status: "expired",
        http_status: 401,
        message: "OpenRouter API Key has expired or is invalid (HTTP 401: Unauthorized).",
        remedy: "Generate a new API key at https://openrouter.ai/keys and update it in your configuration.",
        checked_at: new Date().toISOString(),
      };
    }

    if (authRes.ok) {
      const authJson = await authRes.json();
      keyData = authJson?.data || {};

      // Check explicit expiration date if provided by OpenRouter
      if (keyData.expires_at) {
        const expiryTime = new Date(keyData.expires_at).getTime();
        if (Number.isFinite(expiryTime) && expiryTime < Date.now()) {
          return {
            model_name: modelName,
            provider: "OpenRouter",
            is_operational: false,
            status: "expired",
            http_status: 401,
            message: `OpenRouter API Key expired on ${new Date(keyData.expires_at).toLocaleString()}.`,
            remedy: "Your API key has passed its expiration date. Create a new key at https://openrouter.ai/keys.",
            key_details: {
              expires_at: keyData.expires_at,
              is_free_tier: keyData.is_free_tier,
            },
            checked_at: new Date().toISOString(),
          };
        }
      }
    }
  } catch (err: any) {
    console.warn("[MODEL_HEALTH] auth/key request failed:", err?.message);
  }

  // 2. Perform a lightweight ping completion request to verify model execution
  try {
    const pingRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
        "X-Title": "CreditWise Health Check",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 3,
        temperature: 0,
      }),
    });

    const latency = Date.now() - startTime;
    const bodyText = await pingRes.text().catch(() => "");

    if (pingRes.ok) {
      return {
        model_name: modelName,
        provider: "OpenRouter",
        is_operational: true,
        status: "active",
        http_status: 200,
        latency_ms: latency,
        message: `Model is online and operational. Ping responded in ${latency}ms.`,
        key_details: {
          is_free_tier: keyData?.is_free_tier,
          expires_at: keyData?.expires_at,
          free_requests_remaining: keyData?.free_model_daily_requests?.remaining,
        },
        checked_at: new Date().toISOString(),
      };
    }

    if (pingRes.status === 402) {
      let errDetail = "Insufficient credits.";
      try {
        const parsed = JSON.parse(bodyText);
        errDetail = parsed?.error?.message || errDetail;
      } catch {}

      return {
        model_name: modelName,
        provider: "OpenRouter",
        is_operational: false,
        status: "insufficient_credits",
        http_status: 402,
        latency_ms: latency,
        message: `OpenRouter account has insufficient credits (HTTP 402: Payment Required). ${errDetail}`,
        remedy: "Add prepaid credits at https://openrouter.ai/settings/credits or select a free model (e.g., google/gemini-2.0-flash-exp:free).",
        key_details: {
          is_free_tier: keyData?.is_free_tier,
          expires_at: keyData?.expires_at,
        },
        checked_at: new Date().toISOString(),
      };
    }

    if (pingRes.status === 401) {
      return {
        model_name: modelName,
        provider: "OpenRouter",
        is_operational: false,
        status: "expired",
        http_status: 401,
        latency_ms: latency,
        message: "OpenRouter API Key has expired or is unauthorized (HTTP 401).",
        remedy: "Generate a new API key at https://openrouter.ai/keys and update your configuration.",
        checked_at: new Date().toISOString(),
      };
    }

    if (pingRes.status === 429) {
      return {
        model_name: modelName,
        provider: "OpenRouter",
        is_operational: false,
        status: "rate_limited",
        http_status: 429,
        latency_ms: latency,
        message: "OpenRouter rate limit reached (HTTP 429).",
        remedy: "Wait a few seconds or review rate limits at https://openrouter.ai/settings/limits.",
        checked_at: new Date().toISOString(),
      };
    }

    return {
      model_name: modelName,
      provider: "OpenRouter",
      is_operational: false,
      status: "error",
      http_status: pingRes.status,
      latency_ms: latency,
      message: `OpenRouter returned HTTP ${pingRes.status}: ${bodyText.slice(0, 160)}`,
      checked_at: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      model_name: modelName,
      provider: "OpenRouter",
      is_operational: false,
      status: "error",
      message: `Connection failed: ${err?.message || "Network error"}`,
      checked_at: new Date().toISOString(),
    };
  }
}

/**
 * Tests an AI model config by ID from the database or with a test API key override.
 */
export async function testAiModelById(
  modelId: number,
  overrideApiKey?: string
): Promise<ModelHealthResult> {
  const client = await pool.connect();
  let row: any = null;
  try {
    const res = await client.query(
      `SELECT id, category, model_name, provider, api_key, is_active FROM ai_models WHERE id = $1`,
      [modelId]
    );
    if (res.rowCount === 0) {
      return {
        model_id: modelId,
        model_name: "Unknown",
        provider: "Unknown",
        is_operational: false,
        status: "error",
        message: `Model with ID #${modelId} not found in database.`,
        checked_at: new Date().toISOString(),
      };
    }
    row = res.rows[0];
  } finally {
    client.release();
  }

  const effectiveKey = overrideApiKey || row.api_key || process.env.OPENROUTER_API_KEY || "";
  const provider = row.provider || resolveProviderFromModel(row.model_name);

  const result = await testOpenRouterKey(effectiveKey, row.model_name);
  return {
    ...result,
    model_id: row.id,
    category: row.category,
    provider,
    key_details: {
      ...result.key_details,
      has_custom_key: Boolean(overrideApiKey || row.api_key),
    },
  };
}
