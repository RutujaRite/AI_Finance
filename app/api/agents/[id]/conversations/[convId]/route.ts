// app/api/agents/[id]/conversations/[convId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getConversationDetails } from "@/lib/agent-studio/dbStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; convId: string }> }
) {
  try {
    const { convId } = await params;
    const conversation = await getConversationDetails(convId);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error: any) {
    console.error("[GET_CONVERSATION_DETAIL_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch conversation details" },
      { status: 500 }
    );
  }
}
