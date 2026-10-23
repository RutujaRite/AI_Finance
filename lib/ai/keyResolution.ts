/**
 * Unified Key Resolution Pipeline & Environment Synchronization for CreditWise AI
 *
 * Implements:
 * 1. Dynamic API key resolution:
 *    a) First, check PostgreSQL database for active configured credentials saved via AI Agent Studio
 *       (provider_api_keys table or active model in ai_models table).
 *    b) Second, fall back to process.env (e.g., OPENROUTER_API_KEY, GEMINI_API_KEY).
 * 2. Proper OpenRouter request headers:
 *    - Authorization: Bearer ${apiKey}
 *    - HTTP-Referer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
 *    - X-Title: 'CreditWise AI'
 * 3. Key sanitization (apiKey.trim(), stripping surrounding quotes)
 * 4. Error mapping: Map 401 / "User not found" to:
 *    "The saved OpenRouter API key is invalid or revoked. Please update your API key in AI Agent Studio Settings."
 * 5. Bidirectional synchronization: Writing active keys into .env.local and runtime process.env
 *    so backend services immediately pick up the active key without requiring a server restart.
 */

import fs from "fs";
import path from "path";
import pool from "@/lib/db";

export const INVALID_KEY_USER_MESSAGE =
  "The saved OpenRouter API key is invalid or revoked. Please update your API key in AI Agent Studio Settings.";

export interface ResolvedKeyInfo {
  apiKey: string;
  baseUrl?: string;
  provider: string;
  source: "database_provider_keys" | "database_ai_models" | "env" | "none";
}

// In-memory cache for dynamic key resolution (TTL 10 seconds for performance)
let cachedKeyInfo: ResolvedKeyInfo | null = null;
let lastKeyFetchTime = 0;
const KEY_CACHE_TTL_MS = 10000;

/**
 * Invalidates the in-memory key cache so next resolution queries the database fresh.
 */
export function invalidateKeyCache(): void {
  cachedKeyInfo = null;
  lastKeyFetchTime = 0;
}

/**
 * Strips whitespace, quotes, and newlines from an API key.
 */
export function sanitizeApiKey(key?: string | null): string {
  if (!key) return "";
  return String(key).trim().replace(/^["']+|["']+$/g, "").trim();
}

/**
 * Returns standard server-side OpenRouter request headers.
 */
export function getOpenRouterHeaders(apiKey: string): Record<string, string> {
  const cleanKey = sanitizeApiKey(apiKey);
  return {
    Authorization: `Bearer ${cleanKey}`,
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "CreditWise AI",
  };
}

/**
 * Checks whether an error from OpenRouter indicates an invalid/revoked key (401 / "User not found").
 */
export function isOpenRouterAuthError(err: any): boolean {
  if (!err) return false;
  const status = Number(err?.status || err?.http_status || err?.statusCode || err?.code);
  const msg = String(err?.message || err?.rawResponseBody || err?.error || err?.details || "").toLowerCase();

  if (status === 401) return true;
  if (msg.includes("user not found") || msg.includes("user_not_found")) return true;
  if (msg.includes("invalid api key") || msg.includes("invalid_api_key") || msg.includes("unauthorized")) return true;
  if (msg.includes("401") && (msg.includes("key") || msg.includes("auth") || msg.includes("openrouter"))) return true;
  return false;
}

/**
 * Formats an error into a user-friendly UI message, converting 401s into the required Studio prompt.
 */
export function formatOpenRouterError(err: any): string {
  if (isOpenRouterAuthError(err)) {
    return INVALID_KEY_USER_MESSAGE;
  }
  return err?.message || "An unexpected error occurred while communicating with the AI model.";
}

/**
 * Synchronously or safely updates/writes an active key into .env.local without requiring a server restart.
 */
export function syncKeyToEnvLocal(keyName: string, keyValue: string): void {
  try {
    const cleanKey = sanitizeApiKey(keyValue);
    const envPath = path.join(process.cwd(), ".env.local");
    let content = "";

    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf-8");
    }

    const regex = new RegExp(`^${keyName}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${keyName}=${cleanKey}`);
    } else {
      content = content.trimEnd() ? `${content.trimEnd()}\n${keyName}=${cleanKey}\n` : `${keyName}=${cleanKey}\n`;
    }

    fs.writeFileSync(envPath, content, "utf-8");
  } catch (err) {
    console.warn(`[syncKeyToEnvLocal] Notice: Could not write to .env.local:`, err);
  }
}

/**
 * Unified Dynamic Key Resolution:
 * 1. Check PostgreSQL (provider_api_keys table, then active LLM in ai_models table)
 * 2. Fall back to process.env (OPENROUTER_API_KEY, GEMINI_API_KEY, etc.)
 */
export async function resolveDynamicApiKey(
  requestedProvider: string = "openrouter"
): Promise<ResolvedKeyInfo> {
  const normProvider = requestedProvider.toLowerCase().trim();
  const now = Date.now();

  // If cached and still fresh for this provider, return cache
  if (
    cachedKeyInfo &&
    cachedKeyInfo.apiKey &&
    now - lastKeyFetchTime < KEY_CACHE_TTL_MS &&
    (normProvider === "openrouter" || normProvider === "custom" || cachedKeyInfo.provider === normProvider)
  ) {
    return cachedKeyInfo;
  }

  // 1. Check PostgreSQL: provider_api_keys table
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS provider_api_keys (
          provider VARCHAR(50) PRIMARY KEY,
          api_key TEXT NOT NULL,
          base_url TEXT,
          name TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Search for specific provider or default OpenRouter (custom/openrouter)
      const isOpenRouterSearch = normProvider === "openrouter" || normProvider === "custom";
      const providerAliases = isOpenRouterSearch
        ? ["custom", "openrouter"]
        : [normProvider];

      const res = await client.query(
        isOpenRouterSearch
          ? `SELECT provider, api_key, base_url, updated_at
             FROM provider_api_keys
             WHERE (LOWER(provider) = ANY($1) OR api_key LIKE 'sk-or-%' OR base_url LIKE '%openrouter%')
               AND api_key IS NOT NULL AND TRIM(api_key) != ''
             ORDER BY 
               CASE WHEN api_key LIKE 'sk-or-%' THEN 0 ELSE 1 END,
               updated_at DESC
             LIMIT 1`
          : `SELECT provider, api_key, base_url, updated_at
             FROM provider_api_keys
             WHERE LOWER(provider) = ANY($1) AND api_key IS NOT NULL AND TRIM(api_key) != ''
             ORDER BY updated_at DESC
             LIMIT 1`,
        [providerAliases]
      );

      if (res.rowCount && res.rows[0]?.api_key) {
        const cleanKey = sanitizeApiKey(res.rows[0].api_key);
        if (cleanKey) {
          const info: ResolvedKeyInfo = {
            apiKey: cleanKey,
            baseUrl: res.rows[0].base_url || undefined,
            provider: res.rows[0].provider,
            source: "database_provider_keys",
          };

          // Synchronize runtime process.env
          if (isOpenRouterSearch || cleanKey.startsWith("sk-or-")) {
            process.env.OPENROUTER_API_KEY = cleanKey;
          }

          cachedKeyInfo = info;
          lastKeyFetchTime = now;
          return info;
        }
      }

      // 1b. Check PostgreSQL: ai_models table for active LLM
      const modelRes = await client.query(`
        SELECT id, category, model_name, provider, api_key, base_url, is_active
        FROM ai_models
        WHERE category = 'LLM' AND is_active = true AND api_key IS NOT NULL AND TRIM(api_key) != ''
        LIMIT 1
      `).catch(() => ({ rowCount: 0, rows: [] }));

      if (modelRes.rowCount && modelRes.rows[0]?.api_key) {
        const cleanKey = sanitizeApiKey(modelRes.rows[0].api_key);
        if (cleanKey) {
          const info: ResolvedKeyInfo = {
            apiKey: cleanKey,
            baseUrl: modelRes.rows[0].base_url || undefined,
            provider: modelRes.rows[0].provider || "OpenRouter",
            source: "database_ai_models",
          };

          if (normProvider === "openrouter" || normProvider === "custom") {
            process.env.OPENROUTER_API_KEY = cleanKey;
          }

          cachedKeyInfo = info;
          lastKeyFetchTime = now;
          return info;
        }
      }
    } finally {
      client.release();
    }
  } catch (dbErr) {
    console.warn("[resolveDynamicApiKey] PostgreSQL key check warning:", dbErr);
  }

  // 2. Fall back to process.env
  let envKey = "";
  if (normProvider === "google" || normProvider === "gemini") {
    envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  } else if (normProvider === "openai") {
    envKey = process.env.OPENAI_API_KEY || "";
  } else if (normProvider === "anthropic") {
    envKey = process.env.ANTHROPIC_API_KEY || "";
  } else {
    envKey = process.env.OPENROUTER_API_KEY || "";
  }

  const cleanEnvKey = sanitizeApiKey(envKey);
  if (cleanEnvKey) {
    const info: ResolvedKeyInfo = {
      apiKey: cleanEnvKey,
      provider: normProvider,
      source: "env",
    };
    cachedKeyInfo = info;
    lastKeyFetchTime = now;
    return info;
  }

  return {
    apiKey: "",
    provider: normProvider,
    source: "none",
  };
}

/**
 * Saves or updates credentials securely in PostgreSQL AND updates .env.local + runtime state.
 */
export async function saveAndSyncCredential(params: {
  provider: string;
  apiKey: string;
  baseUrl?: string | null;
  name?: string | null;
}): Promise<{ success: boolean; maskedKey: string }> {
  const { provider, apiKey, baseUrl, name } = params;
  const cleanProvider = provider.toLowerCase().trim();
  const cleanKey = sanitizeApiKey(apiKey);
  const cleanBaseUrl = baseUrl ? baseUrl.trim() : null;
  const cleanName = name ? name.trim() : null;

  if (!cleanKey) {
    throw new Error("API key cannot be empty.");
  }

  // 1. Store securely in PostgreSQL
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS provider_api_keys (
        provider VARCHAR(50) PRIMARY KEY,
        api_key TEXT NOT NULL,
        base_url TEXT,
        name TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      ALTER TABLE provider_api_keys ADD COLUMN IF NOT EXISTS name TEXT;
    `);

    await client.query(
      `INSERT INTO provider_api_keys (provider, api_key, base_url, name, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (provider) DO UPDATE SET
         api_key = EXCLUDED.api_key,
         base_url = COALESCE(EXCLUDED.base_url, provider_api_keys.base_url),
         name = COALESCE(EXCLUDED.name, provider_api_keys.name),
         updated_at = NOW()`,
      [cleanProvider, cleanKey, cleanBaseUrl, cleanName]
    );
  } finally {
    client.release();
  }

  // 2. Synchronize runtime process.env immediately
  const isOpenRouterKey = cleanKey.startsWith("sk-or-") || Boolean(cleanBaseUrl?.includes("openrouter"));

  if (isOpenRouterKey || cleanProvider === "custom" || cleanProvider === "openrouter") {
    process.env.OPENROUTER_API_KEY = cleanKey;
    syncKeyToEnvLocal("OPENROUTER_API_KEY", cleanKey);

    // Also update custom provider row in DB and active LLM in ai_models so all services pick it up
    try {
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO provider_api_keys (provider, api_key, base_url, name, updated_at)
           VALUES ('custom', $1, $2, 'OpenRouter', NOW())
           ON CONFLICT (provider) DO UPDATE SET
             api_key = EXCLUDED.api_key,
             base_url = COALESCE(EXCLUDED.base_url, provider_api_keys.base_url),
             updated_at = NOW()`,
          [cleanKey, cleanBaseUrl || "https://openrouter.ai/api/v1"]
        );
        await client.query(
          `UPDATE ai_models SET api_key = $1, updated_at = NOW() WHERE category = 'LLM' AND is_active = true`,
          [cleanKey]
        );
      } finally {
        client.release();
      }
    } catch (dbSyncErr) {
      console.warn("[saveAndSyncCredential] DB sync notice:", dbSyncErr);
    }
  }

  if (cleanProvider === "google" || cleanProvider === "gemini") {
    process.env.GEMINI_API_KEY = cleanKey;
    syncKeyToEnvLocal("GEMINI_API_KEY", cleanKey);
  } else if (cleanProvider === "openai") {
    process.env.OPENAI_API_KEY = cleanKey;
    syncKeyToEnvLocal("OPENAI_API_KEY", cleanKey);
  } else if (cleanProvider === "anthropic") {
    process.env.ANTHROPIC_API_KEY = cleanKey;
    syncKeyToEnvLocal("ANTHROPIC_API_KEY", cleanKey);
  } else if (cleanProvider === "groq") {
    process.env.GROQ_API_KEY = cleanKey;
    syncKeyToEnvLocal("GROQ_API_KEY", cleanKey);
  }

  // 3. Invalidate caches
  invalidateKeyCache();

  const start = cleanKey.slice(0, 6);
  const end = cleanKey.slice(-4);
  const maskedKey = cleanKey.length >= 8 ? `${start}••••••••${end}` : "••••••••";

  return { success: true, maskedKey };
}
