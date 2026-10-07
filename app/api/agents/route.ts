// app/api/agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  listAgents,
  createAgent,
  getUserSubscription,
} from "@/lib/agent-studio/agentStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agents = listAgents();
    const subscription = getUserSubscription();
    return NextResponse.json({
      success: true,
      agents,
      subscription,
    });
  } catch (error: any) {
    console.error("[API_AGENTS_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, purpose } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Agent name is required" },
        { status: 400 }
      );
    }

    const result = createAgent({
      name: name.trim(),
      description: (description || "").trim(),
      purpose: (purpose || "").trim(),
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          limitReached: result.limitReached || false,
        },
        { status: result.limitReached ? 403 : 400 }
      );
    }

    const subscription = getUserSubscription();
    return NextResponse.json({
      success: true,
      agent: result.agent,
      subscription,
    });
  } catch (error: any) {
    console.error("[API_AGENTS_POST_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
