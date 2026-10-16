import { NextRequest, NextResponse } from "next/server";
import { verifyToken, isAdminUser } from "@/lib/auth";
import {
  getAllAiModels,
  getActiveModel,
  createAiModel,
  ModelCategory,
} from "@/lib/ai/modelRouter";
import { testAiModelById } from "@/lib/ai/modelHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/models
 * Returns all models, active models summary, category counts, and provider list.
 * Protected: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }
    if (!isAdminUser(payload)) {
      return NextResponse.json(
        { success: false, error: "Forbidden", message: "Admin access required" },
        { status: 403 }
      );
    }

    const models = await getAllAiModels();

    // Map active models per category
    const active = {
      STT: models.find((m) => m.category === "STT" && m.is_active) || null,
      LLM: models.find((m) => m.category === "LLM" && m.is_active) || null,
      TTS: models.find((m) => m.category === "TTS" && m.is_active) || null,
    };

    // Calculate category counts
    const counts = {
      ALL: models.length,
      STT: models.filter((m) => m.category === "STT").length,
      LLM: models.filter((m) => m.category === "LLM").length,
      TTS: models.filter((m) => m.category === "TTS").length,
    };

    // Distinct providers
    const providers = Array.from(new Set(models.map((m) => m.provider))).filter(Boolean);

    // Live health check on active LLM model key
    let activeHealth: Record<string, any> = {};
    if (active.LLM) {
      try {
        const h = await testAiModelById(active.LLM.id);
        activeHealth.LLM = h;
      } catch (err) {
        console.warn("[MODEL_HEALTH] Could not check active LLM health:", err);
      }
    }

    return NextResponse.json({
      success: true,
      models,
      active,
      active_health: activeHealth,
      counts,
      providers,
    });
  } catch (err: any) {
    console.error("GET /api/admin/models error:", err);
    return NextResponse.json(
      { success: false, error: "Server Error", message: err?.message || "Failed to fetch models" },
      { status: 500 }
    );
  }
}

import pool from "@/lib/db";

/**
 * POST /api/admin/models
 * Registers a new model in registered_models, or creates a custom engine in ai_models.
 * Protected: Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }
    if (!isAdminUser(payload)) {
      return NextResponse.json(
        { success: false, error: "Forbidden", message: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // Check if this is a Registered Model payload (name, model_id, purpose, provider)
    if (body.model_id || body.purpose || (body.name && !body.category)) {
      const name = String(body.name || "").trim();
      const modelId = String(body.model_id || body.model_name || "").trim();
      const provider = String(body.provider || "custom").toLowerCase().trim();
      const purpose = String(body.purpose || "General Chat").trim();
      const isDefault = Boolean(body.is_assistant_default || body.is_default);
      const routeViaGateway = body.route_via_gateway !== false;

      if (!name) {
        return NextResponse.json(
          { success: false, error: "Validation Error", message: "Model Display Name is required." },
          { status: 400 }
        );
      }
      if (!modelId) {
        return NextResponse.json(
          { success: false, error: "Validation Error", message: "Model Identifier (API slug) is required." },
          { status: 400 }
        );
      }

      const client = await pool.connect();
      try {
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

        if (isDefault) {
          await client.query(`UPDATE registered_models SET is_assistant_default = false`);
          try {
            await client.query(`UPDATE ai_models SET is_active = false, is_default = false WHERE category = 'LLM'`);
            await client.query(
              `INSERT INTO ai_models (category, model_name, provider, is_active, is_default, display_name, updated_at)
               VALUES ('LLM', $1, $2, true, true, $3, NOW())
               ON CONFLICT (id) DO NOTHING`,
              [modelId, provider, name]
            );
          } catch {}
        }

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
          [name, modelId, provider, purpose, isDefault, routeViaGateway]
        );

        return NextResponse.json({
          success: true,
          message: `Model "${name}" registered successfully.`,
          model: insertRes.rows[0],
        });
      } finally {
        client.release();
      }
    }

    // Legacy handler: { category, model_name, api_key, is_active }
    const category = String(body?.category || "").trim().toUpperCase() as ModelCategory;
    const model_name = String(body?.model_name || "").trim();
    const api_key = body?.api_key ? String(body.api_key).trim() : undefined;
    const is_active = Boolean(body?.is_active);

    if (!["STT", "LLM", "TTS"].includes(category)) {
      return NextResponse.json(
        { success: false, error: "Validation Error", message: "Category is required and must be STT, LLM, or TTS." },
        { status: 400 }
      );
    }

    if (!model_name) {
      return NextResponse.json(
        { success: false, error: "Validation Error", message: "Model Name is required." },
        { status: 400 }
      );
    }

    const newModel = await createAiModel({
      category,
      model_name,
      api_key,
      is_active,
    });

    return NextResponse.json({
      success: true,
      message: `Model "${newModel.model_name}" added successfully.`,
      model: newModel,
    });
  } catch (err: any) {
    console.error("POST /api/admin/models error:", err?.message || "Failed to create model");
    return NextResponse.json(
      { success: false, error: "Creation Error", message: err?.message || "Failed to create model" },
      { status: 400 }
    );
  }
}
