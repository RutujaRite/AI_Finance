// app/api/agents/[id]/deactivate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { clearUserActiveAgent, getAgentFromDb, syncAgentToDb } from "@/lib/agent-studio/dbStore";
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

    if (userId !== undefined) {
      await clearUserActiveAgent(userId);
    }

    try {
      await pool.query(`UPDATE agents SET status = 'draft', updated_at = NOW() WHERE id = $1`, [id]);
    } catch (e) {
      console.warn("[DEACTIVATE_AGENT_DB_WARN]", e);
    }

    const updated = updateAgent(id, { status: "draft" });
    if (updated) {
      await syncAgentToDb(updated, userId);
    }

    return NextResponse.json({
      success: true,
      message: "Agent deactivated. Standard AI Assistant restored.",
    });
  } catch (error: any) {
    console.error("[API_AGENT_DEACTIVATE_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to deactivate agent" },
      { status: 500 }
    );
  }
}
