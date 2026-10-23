// app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getAgent,
  updateAgent,
  deleteAgent,
  getUserSubscription,
} from "@/lib/agent-studio/agentStore";
import {
  syncAgentToDb,
  deleteAgentFromDb,
  getAgentFromDb,
  setUserActiveAgent,
  clearUserActiveAgent,
} from "@/lib/agent-studio/dbStore";
import pool from "@/lib/db";
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

export async function GET(
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
    return NextResponse.json({
      success: true,
      agent,
      subscription: getUserSubscription(),
    });
  } catch (error: any) {
    console.error("[API_AGENT_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserId(req);
    const body = await req.json();

    if (body.status === "active" || body.applied_to_assistant === true || body.appliedToAssistant === true) {
      if (userId !== undefined) {
        await setUserActiveAgent(userId, id);
      }
    } else if (body.status === "draft" || body.status === "deactivated" || body.applied_to_assistant === false || body.appliedToAssistant === false) {
      if (userId !== undefined) {
        await clearUserActiveAgent(userId, id);
      }
    }

    if (body.supported_topics && !body.supportedTopics) {
      body.supportedTopics = body.supported_topics;
    }
    if (body.applied_to_assistant !== undefined && body.appliedToAssistant === undefined) {
      body.appliedToAssistant = body.applied_to_assistant;
    }

    const updated = updateAgent(id, body);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Agent not found or could not be updated" },
        { status: 404 }
      );
    }

    try {
      await syncAgentToDb(updated, userId);
    } catch (syncErr) {
      console.warn("[SYNC_AGENT_TO_DB_FAIL]", syncErr);
    }

    return NextResponse.json({
      success: true,
      agent: updated,
      message: "Agent updated successfully",
    });
  } catch (error: any) {
    console.error("[API_AGENT_PATCH_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserId(req);

    try {
      const countRes = await pool.query("SELECT COUNT(*) FROM agents");
      const totalCount = parseInt(countRes.rows[0]?.count || "0", 10);
      if (totalCount <= 1) {
        return NextResponse.json(
          { success: false, error: "At least one AI agent must remain in your workspace." },
          { status: 400 }
        );
      }
      const deleted = await deleteAgentFromDb(id, userId);
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: "Cannot delete agent: ownership verification failed." },
          { status: 403 }
        );
      }
    } catch (dbErr) {
      console.warn("[DELETE_AGENT_FROM_DB_WARN]", dbErr);
    }

    deleteAgent(id);
    return NextResponse.json({
      success: true,
      message: "Agent deleted successfully",
      subscription: getUserSubscription(),
    });
  } catch (error: any) {
    console.error("[API_AGENT_DELETE_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
