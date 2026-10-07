import { NextRequest, NextResponse } from "next/server";
import { verifyToken, isAdminUser } from "@/lib/auth";
import { restoreDefaultAiModels } from "@/lib/ai/modelRouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/models/restore-defaults
 * Restores predefined system defaults without deleting custom models.
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

    await restoreDefaultAiModels();

    return NextResponse.json({
      success: true,
      message: "System default models restored successfully.",
    });
  } catch (err: any) {
    console.error("POST /api/admin/models/restore-defaults error:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: "Restore Failed",
        message: err?.message || "Failed to restore defaults",
      },
      { status: 500 }
    );
  }
}
