// app/api/admin/models/[id]/test/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, isAdminUser } from "@/lib/auth";
import { testAiModelById } from "@/lib/ai/modelHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/models/[id]/test
 * Tests whether a specific AI model's API key is valid, expired, out of credits, or active.
 * Protected: Admin only.
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

    const body = await req.json().catch(() => ({}));
    const overrideKey = body?.api_key ? String(body.api_key).trim() : undefined;

    const result = await testAiModelById(id, overrideKey);

    return NextResponse.json({
      success: true,
      test_result: result,
      is_operational: result.is_operational,
      status: result.status,
      message: result.message,
    });
  } catch (err: any) {
    console.error("POST /api/admin/models/[id]/test error:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: "Test Error",
        message: err?.message || "Failed to test AI model connection",
      },
      { status: 500 }
    );
  }
}
