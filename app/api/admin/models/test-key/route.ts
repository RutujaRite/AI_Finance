// app/api/admin/models/test-key/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, isAdminUser } from "@/lib/auth";
import { testOpenRouterKey } from "@/lib/ai/modelHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/models/test-key
 * Tests a custom API key and model name live before saving.
 * Body: { model_name: string, api_key: string }
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
    const model_name = String(body?.model_name || "google/gemini-2.5-flash").trim();
    const api_key = String(body?.api_key || process.env.OPENROUTER_API_KEY || "").trim();

    const result = await testOpenRouterKey(api_key, model_name);

    return NextResponse.json({
      success: true,
      test_result: result,
      is_operational: result.is_operational,
      status: result.status,
      message: result.message,
    });
  } catch (err: any) {
    console.error("POST /api/admin/models/test-key error:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: "Test Error",
        message: err?.message || "Failed to test API key",
      },
      { status: 500 }
    );
  }
}
