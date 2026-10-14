// app/api/agents/tokens/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getTokenUsageAnalytics,
  updateTokenSettings,
  clearTokenUsageLogs,
} from "@/lib/agent-studio/dbStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const data = await getTokenUsageAnalytics();
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    console.error("[API_TOKENS_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch token usage analytics" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { budgetTokens, alertThresholdPercent } = body;
    if (budgetTokens !== undefined && alertThresholdPercent !== undefined) {
      await updateTokenSettings(budgetTokens, alertThresholdPercent);
      return NextResponse.json({
        success: true,
        message: "Token budget settings updated successfully",
      });
    }
    return NextResponse.json(
      { success: false, error: "Missing required settings parameters" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[API_TOKENS_POST_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update token settings" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const success = await clearTokenUsageLogs();
    if (success) {
      return NextResponse.json({
        success: true,
        message: "Token usage logs cleared successfully",
      });
    }
    return NextResponse.json(
      { success: false, error: "Failed to clear logs" },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("[API_TOKENS_DELETE_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear token logs" },
      { status: 500 }
    );
  }
}
