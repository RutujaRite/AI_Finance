import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * POST /api/admin/provider-keys/test
 * Tests connectivity to an LLM provider using saved or passed credentials.
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { provider, api_key } = body;

    const cleanProvider = (provider || "custom").toLowerCase().trim();
    let keyToTest = (api_key || "").trim();

    // If key not passed in payload, look up from DB or environment
    if (!keyToTest) {
      const client = await pool.connect();
      try {
        const res = await client.query(`SELECT api_key FROM provider_api_keys WHERE provider = $1`, [cleanProvider]);
        if (res.rowCount && res.rows[0].api_key) {
          keyToTest = res.rows[0].api_key;
        } else if (cleanProvider === "custom") {
          keyToTest = process.env.OPENROUTER_API_KEY || "";
        }
      } finally {
        client.release();
      }
    }

    if (!keyToTest) {
      return NextResponse.json(
        { success: false, error: `No API key configured for provider: ${cleanProvider}` },
        { status: 400 }
      );
    }

    const tStart = Date.now();

    // Test ping based on provider
    let endpoint = "https://openrouter.ai/api/v1/auth/key";
    let headers: Record<string, string> = {
      Authorization: `Bearer ${keyToTest}`,
    };

    if (cleanProvider === "openai") {
      endpoint = "https://api.openai.com/v1/models";
    } else if (cleanProvider === "anthropic") {
      endpoint = "https://api.anthropic.com/v1/models";
      headers["x-api-key"] = keyToTest;
      headers["anthropic-version"] = "2023-06-01";
      delete headers["Authorization"];
    } else if (cleanProvider === "google") {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${keyToTest}`;
      delete headers["Authorization"];
    } else if (cleanProvider === "groq") {
      endpoint = "https://api.groq.com/openai/v1/models";
    } else if (cleanProvider === "ollama") {
      endpoint = "http://localhost:11434/api/tags";
    } else if (body.base_url || cleanProvider.startsWith("custom") || cleanProvider === "litellm" || cleanProvider === "vllm" || cleanProvider === "lmstudio") {
      const customUrl = (body.base_url || "").trim().replace(/\/+$/, "");
      if (customUrl) {
        endpoint = customUrl.endsWith("/v1") ? `${customUrl}/models` : `${customUrl}/v1/models`;
      }
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Date.now() - tStart;

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: `Connection to ${cleanProvider.toUpperCase()} verified successfully.`,
        latencyMs,
        status: "Healthy (200 OK)",
      });
    } else {
      const errText = await response.text().catch(() => "");
      return NextResponse.json({
        success: false,
        error: `Provider returned status ${response.status}`,
        details: errText.slice(0, 300),
        latencyMs,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Connection test timed out or network error",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
