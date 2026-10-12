// app/api/agents/[id]/conversations/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  listAgentConversations,
  recordConversationExchange,
} from "@/lib/agent-studio/dbStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversations = await listAgentConversations(id);
    return NextResponse.json({
      success: true,
      conversations,
      count: conversations.length,
    });
  } catch (error: any) {
    console.error("[API_AGENT_CONVERSATIONS_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      conversationId,
      userMessage,
      assistantResponse,
      intent,
      toolsUsed,
      knowledgeDocumentsUsed,
    } = body;

    if (!userMessage || !assistantResponse) {
      return NextResponse.json(
        { success: false, error: "userMessage and assistantResponse are required" },
        { status: 400 }
      );
    }

    const convId = conversationId || `conv_${Date.now()}`;
    await recordConversationExchange({
      conversationId: convId,
      agentId: id,
      userMessage,
      assistantResponse,
      intent,
      toolsUsed,
      knowledgeDocumentsUsed,
    });

    return NextResponse.json({
      success: true,
      conversationId: convId,
      message: "Conversation exchange recorded successfully",
    });
  } catch (error: any) {
    console.error("[API_AGENT_CONVERSATIONS_POST_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to record conversation exchange" },
      { status: 500 }
    );
  }
}
