// app/api/agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  listAgents,
  createAgent,
  getUserSubscription,
} from "@/lib/agent-studio/agentStore";
import { syncAgentToDb, loadAgentsFromDb } from "@/lib/agent-studio/dbStore";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getUserId(req: NextRequest): number | undefined {
  try {
    const token = req.cookies.get("token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    if (payload?.id && Number.isFinite(Number(payload.id))) {
      return Number(payload.id);
    }
  } catch {}
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    let agents = await loadAgentsFromDb(userId);
    if (!agents || agents.length === 0) {
      agents = listAgents();
      for (const a of agents) {
        await syncAgentToDb(a, userId);
      }
    }
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
    const userId = getUserId(req);
    const body = await req.json();
    const { name, description, purpose, goal, responseStyle, operationalMode, instructions, guardrails } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Agent name is required" },
        { status: 400 }
      );
    }

    const result = createAgent({
      name: name.trim(),
      description: (description || "").trim(),
      purpose: (purpose || goal || "").trim(),
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

    if (result.agent) {
      if (userId !== undefined) {
        result.agent.userId = userId;
      }
      if (operationalMode) {
        result.agent.operationalMode = operationalMode;
      }
      if (responseStyle) {
        result.agent.responseStyle = responseStyle;
      }
      if (instructions && typeof instructions === "object") {
        result.agent.instructions = { ...result.agent.instructions, ...instructions };
      }
      if (guardrails) {
        result.agent.manualGuardrails = typeof guardrails === "string" ? guardrails : "";
      }

      try {
        await syncAgentToDb(result.agent, userId);
      } catch (syncErr) {
        console.warn("[SYNC_NEW_AGENT_DB_WARN]", syncErr);
      }
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
