// app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getAgent,
  updateAgent,
  deleteAgent,
  getUserSubscription,
} from "@/lib/agent-studio/agentStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await params;
    const agent = getAgent(id);
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = updateAgent(id, body);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Agent not found or could not be updated" },
        { status: 404 }
      );
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await params;
    const success = deleteAgent(id);
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Agent not found or cannot delete default agent" },
        { status: 400 }
      );
    }
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
