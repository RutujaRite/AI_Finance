import { NextRequest, NextResponse } from "next/server";
import { verifyToken, isAdminUser } from "@/lib/auth";
import {
  updateAiModel,
  deleteAiModel,
  ModelCategory,
} from "@/lib/ai/modelRouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/models/[id]
 * Updates an existing model's name, category, or API key.
 * If API key is blank/omitted, preserves the existing API key.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid ID", message: "Invalid model ID." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const model_name = body.model_name !== undefined ? String(body.model_name).trim() : undefined;
    const category = body.category ? (String(body.category).trim().toUpperCase() as ModelCategory) : undefined;
    const api_key = body.api_key !== undefined ? String(body.api_key).trim() : undefined;

    if (category && !["STT", "LLM", "TTS"].includes(category)) {
      return NextResponse.json(
        { success: false, error: "Invalid Category", message: "Category must be STT, LLM, or TTS." },
        { status: 400 }
      );
    }

    const updated = await updateAiModel(id, {
      model_name,
      category,
      api_key,
    });

    return NextResponse.json({
      success: true,
      message: `Model "${updated.model_name}" updated successfully.`,
      model: updated,
    });
  } catch (err: any) {
    console.error("PATCH /api/admin/models/[id] error:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Update Error", message: err?.message || "Failed to update model" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/models/[id]
 * Deletes a model.
 * Rejects deletion if model is active.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid ID", message: "Invalid model ID." },
        { status: 400 }
      );
    }

    await deleteAiModel(id);

    return NextResponse.json({
      success: true,
      message: "Model deleted successfully.",
    });
  } catch (err: any) {
    console.error("DELETE /api/admin/models/[id] error:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: "Delete Failed",
        message: err?.message || "Failed to delete model",
      },
      { status: 400 }
    );
  }
}
