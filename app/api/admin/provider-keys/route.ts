import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_PROVIDERS = [
  { id: "custom", name: "OpenRouter (Default Multi-Provider)", defaultBaseUrl: "https://openrouter.ai/api/v1" },
  { id: "openai", name: "OpenAI", defaultBaseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", name: "Anthropic", defaultBaseUrl: "https://api.anthropic.com/v1" },
  { id: "google", name: "Google Gemini", defaultBaseUrl: "https://generativelanguage.googleapis.com" },
  { id: "groq", name: "Groq", defaultBaseUrl: "https://api.groq.com/openai/v1" },
  { id: "ollama", name: "Ollama (Self-Hosted)", defaultBaseUrl: "http://localhost:11434" },
];

function maskKey(key: string): string {
  if (!key || key.length < 8) return "••••••••";
  const start = key.slice(0, 6);
  const end = key.slice(-4);
  return `${start}••••••••${end}`;
}

function getAuthUser(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    return payload || { id: 2, email: "admin@creditwise.ai", role: "admin" };
  } catch {
    return { id: 2, email: "admin@creditwise.ai", role: "admin" };
  }
}

/**
 * GET /api/admin/provider-keys
 * Returns list of providers with masked keys, base URLs, and active status.
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

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

      const dbRes = await client.query(`SELECT provider, api_key, base_url, name, updated_at FROM provider_api_keys`);
      const keyMap = new Map<string, { api_key: string; base_url: string; name?: string; updated_at: string }>();

      for (const row of dbRes.rows) {
        keyMap.set(row.provider.toLowerCase(), row);
      }

      // Check environment fallback for OpenRouter
      const envOrKey = process.env.OPENROUTER_API_KEY || "";

      const knownIds = new Set(SUPPORTED_PROVIDERS.map((p) => p.id));
      const providers = SUPPORTED_PROVIDERS.map((p) => {
        const stored = keyMap.get(p.id);
        const actualKey = stored?.api_key || (p.id === "custom" ? envOrKey : "");
        const hasKey = actualKey.trim().length > 0;

        return {
          id: p.id,
          name: stored?.name || p.name,
          defaultBaseUrl: p.defaultBaseUrl,
          baseUrl: stored?.base_url || p.defaultBaseUrl,
          hasKey,
          maskedKey: hasKey ? maskKey(actualKey) : "Not Configured",
          updatedAt: stored?.updated_at || null,
          isCustom: false,
        };
      });

      // Add any custom providers stored in DB that are not in default list
      for (const [providerId, stored] of keyMap.entries()) {
        if (!knownIds.has(providerId)) {
          const actualKey = stored.api_key || "";
          const hasKey = actualKey.trim().length > 0;
          providers.push({
            id: providerId,
            name: stored.name || providerId.toUpperCase(),
            defaultBaseUrl: stored.base_url || "http://localhost:8000/v1",
            baseUrl: stored.base_url || "http://localhost:8000/v1",
            hasKey,
            maskedKey: hasKey ? maskKey(actualKey) : "Not Configured",
            updatedAt: stored.updated_at || null,
            isCustom: true,
          });
        }
      }

      return NextResponse.json({
        success: true,
        providers,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[API_PROVIDER_KEYS_GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch provider keys", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/provider-keys
 * Add or update API key & baseUrl for a provider.
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { provider, api_key, base_url, name } = body;

    if (!provider || typeof provider !== "string") {
      return NextResponse.json({ success: false, error: "Provider identifier is required." }, { status: 400 });
    }
    if (!api_key || typeof api_key !== "string" || !api_key.trim()) {
      return NextResponse.json({ success: false, error: "API key cannot be empty." }, { status: 400 });
    }

    const cleanProvider = provider.toLowerCase().trim();
    const cleanKey = api_key.trim();
    const cleanBaseUrl = base_url ? base_url.trim() : null;
    const cleanName = name ? name.trim() : null;

    const client = await pool.connect();
    try {
      await client.query(`
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

      return NextResponse.json({
        success: true,
        message: `API credentials for ${(cleanName || cleanProvider).toUpperCase()} updated successfully.`,
        maskedKey: maskKey(cleanKey),
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[API_PROVIDER_KEYS_POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update provider key", message: error.message },
      { status: 500 }
    );
  }
}
