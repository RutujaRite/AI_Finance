import { NextRequest, NextResponse } from "next/server";
import { verifyToken, isAdminUser } from "@/lib/auth";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolves user from auth cookie or defaults to admin (ID 2).
 */
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
 * GET /api/admin/registered-models
 * List all configured models, purpose tags, provider badges, assistant default, and mapped agents.
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      // Ensure table exists
      // Ensure table exists with route_via_gateway
      await client.query(`
        CREATE TABLE IF NOT EXISTS registered_models (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          model_id VARCHAR(255) NOT NULL UNIQUE,
          provider VARCHAR(50) NOT NULL,
          purpose VARCHAR(100) NOT NULL DEFAULT 'General Chat',
          is_assistant_default BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          route_via_gateway BOOLEAN DEFAULT true
        );
        ALTER TABLE registered_models ADD COLUMN IF NOT EXISTS route_via_gateway BOOLEAN DEFAULT true;
      `);

      // Fetch registered models
      const modelsRes = await client.query(`
        SELECT id, name, model_id, provider, purpose, is_assistant_default, created_at, COALESCE(route_via_gateway, true) as route_via_gateway
        FROM registered_models
        ORDER BY is_assistant_default DESC, created_at ASC
      `);

      // Fetch registered agents to determine bindings
      let agentsList: any[] = [];
      try {
        const agentsRes = await client.query(`
          SELECT id, name, operational_mode, status
          FROM agents
          ORDER BY name ASC
        `);
        agentsList = agentsRes.rows;
      } catch {}

      // Calculate agent usage mappings per model
      const enrichedModels = modelsRes.rows.map((model: any) => {
        const assignedAgents: string[] = [];

        if (model.is_assistant_default) {
          assignedAgents.push("CreditWise Primary Assistant", "Multi-Bank Eligibility Wizard", "CreditWise Guardrail");
        }

        if (model.purpose.includes("Complex Reasoning") || model.purpose.includes("Policy RAG")) {
          assignedAgents.push("HR Policy Assistant", "Policy RAG Engine");
        } else if (model.purpose.includes("Underwriting") || model.purpose.includes("Eligibility")) {
          assignedAgents.push("Loan Eligibility Specialist");
        } else if (model.purpose.includes("Fast Extraction") || model.purpose.includes("Guardrails")) {
          assignedAgents.push("Greeting Assistant", "Disavowal Filter");
        } else if (model.purpose.includes("Embeddings") || model.purpose.includes("Vector")) {
          assignedAgents.push("Semantic Vector Retriever");
        } else if (model.purpose.includes("General Chat")) {
          assignedAgents.push("General Financial QA");
        }

        // Deduplicate
        const uniqueAgents = Array.from(new Set(assignedAgents));

        return {
          ...model,
          assignedAgents: uniqueAgents,
          usageStatus: model.is_assistant_default
            ? "Active Assistant Default"
            : uniqueAgents.length > 0
            ? "Mapped to Specialized Agents"
            : "Standby",
        };
      });

      return NextResponse.json({
        success: true,
        models: enrichedModels,
        totalCount: enrichedModels.length,
        defaultModel: enrichedModels.find((m: any) => m.is_assistant_default) || null,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[API_REGISTERED_MODELS_GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch models", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/registered-models
 * Register a new model with provider, purpose, and default toggle.
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, model_id, provider, purpose, is_assistant_default } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Model display name is required." }, { status: 400 });
    }
    if (!model_id || !model_id.trim()) {
      return NextResponse.json({ success: false, error: "Model identifier string is required." }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanModelId = model_id.trim();
    const cleanProvider = (provider || "custom").toLowerCase().trim();
    const cleanPurpose = purpose || "General Chat";
    const isDefault = Boolean(is_assistant_default);

    const client = await pool.connect();
    try {
      if (isDefault) {
        // Reset existing default
        await client.query(`UPDATE registered_models SET is_assistant_default = false`);

        // Also synchronize system-wide active model in ai_models table
        try {
          await client.query(
            `UPDATE ai_models SET is_active = false, is_default = false WHERE category = 'LLM'`
          );
          await client.query(
            `INSERT INTO ai_models (category, model_name, provider, is_active, is_default, display_name, updated_at)
             VALUES ('LLM', $1, $2, true, true, $3, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [cleanModelId, cleanProvider, cleanName]
          );
        } catch {}
      }

      const routeViaGateway = body.route_via_gateway !== false;

      const insertRes = await client.query(
        `INSERT INTO registered_models (name, model_id, provider, purpose, is_assistant_default, route_via_gateway)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (model_id) DO UPDATE SET
           name = EXCLUDED.name,
           provider = EXCLUDED.provider,
           purpose = EXCLUDED.purpose,
           is_assistant_default = EXCLUDED.is_assistant_default,
           route_via_gateway = EXCLUDED.route_via_gateway
         RETURNING *`,
        [cleanName, cleanModelId, cleanProvider, cleanPurpose, isDefault, routeViaGateway]
      );

      return NextResponse.json({
        success: true,
        message: "Model registered successfully.",
        model: insertRes.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[API_REGISTERED_MODELS_POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to register model", message: error.message },
      { status: 500 }
    );
  }
}
