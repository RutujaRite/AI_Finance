import { NextRequest, NextResponse } from "next/server";
import { verifyToken, isAdminUser } from "@/lib/auth";
import { activateModel } from "@/lib/ai/modelRouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/models/[id]/activate
 * Concurrency-safe atomic model activation.
 * Exactly one active model per category.
 */
export async function POST(
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

    const result = await activateModel(id);

    return NextResponse.json({
      success: true,
      message: `Model "${result.model.model_name}" activated for ${result.model.category}.`,
      model: result.model,
    });
  } catch (err: any) {
    console.error("POST /api/admin/models/[id]/activate error:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: "Activation Failed",
        message: err?.message || "Failed to activate model",
      },
      { status: 400 }
    );
  }
}
