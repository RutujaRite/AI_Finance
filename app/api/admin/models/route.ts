import { NextRequest, NextResponse } from "next/server";
import { verifyToken, isAdminUser } from "@/lib/auth";
import {
  getAllAiModels,
  getActiveModel,
  createAiModel,
  ModelCategory,
} from "@/lib/ai/modelRouter";

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

    return NextResponse.json({
      success: true,
      models,
      active,
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

/**
 * POST /api/admin/models
 * Creates a new custom model.
 * Body: { category, model_name, api_key, is_active }
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
