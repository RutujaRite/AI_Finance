// app/api/agents/subscription/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getUserSubscription,
  upgradePlan,
  resetStore,
  resetUsage,
} from "@/lib/agent-studio/agentStore";
import { PLAN_CONFIGS, PlanTier } from "@/lib/agent-studio/planLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const subscription = getUserSubscription();
    return NextResponse.json({
      success: true,
      subscription,
      plans: Object.values(PLAN_CONFIGS),
    });
  } catch (error: any) {
    console.error("[API_SUBSCRIPTION_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, reset, resetUsage: shouldResetUsage } = body;

    if (shouldResetUsage) {
      const resetSub = resetUsage();
      return NextResponse.json({
        success: true,
        subscription: resetSub,
        message: "Message counter reset to 0 for demo testing",
      });
    }

    if (reset) {
      const resetSub = resetStore();
      return NextResponse.json({
        success: true,
        subscription: resetSub,
        message: "Store reset to initial basic demo state",
      });
    }

    if (!plan || !["basic", "pro", "business"].includes(plan.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: "Invalid plan tier requested." },
        { status: 400 }
      );
    }

    const updatedSubscription = upgradePlan(plan.toLowerCase() as PlanTier);
    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
      message: `Successfully upgraded to ${updatedSubscription.plan.toUpperCase()} plan!`,
    });
  } catch (error: any) {
    console.error("[API_SUBSCRIPTION_POST_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to process upgrade" },
      { status: 500 }
    );
  }
}
