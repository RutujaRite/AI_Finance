// app/api/agents/[id]/activate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { setUserActiveAgent, getAgentFromDb, syncAgentToDb } from "@/lib/agent-studio/dbStore";
import { getAgent, updateAgent } from "@/lib/agent-studio/agentStore";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserId(req);

    const agent = (await getAgentFromDb(id, userId)) || getAgent(id);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }

    if (userId !== undefined) {
      await setUserActiveAgent(userId, id);
    }

    // Set status to active and applied_to_assistant in PostgreSQL
    try {
      await pool.query(
        `UPDATE agents SET status = 'active', applied_to_assistant = true, updated_at = NOW() WHERE id = $1`,
        [id]
      );
    } catch (e) {
      console.warn("[ACTIVATE_AGENT_DB_WARN]", e);
    }

    const updated = updateAgent(id, { status: "active", appliedToAssistant: true } as any);
    if (updated) {
      await syncAgentToDb(updated, userId);
    }

    return NextResponse.json({
      success: true,
      message: `Agent "${agent.name}" activated for your AI Assistant.`,
      activeAgentId: id,
    });
  } catch (error: any) {
    console.error("[API_AGENT_ACTIVATE_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to activate agent" },
      { status: 500 }
    );
  }
}
