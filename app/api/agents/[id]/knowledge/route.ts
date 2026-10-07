// app/api/agents/[id]/knowledge/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  addKnowledgeFile,
  removeKnowledgeFile,
  getAgent,
  getUserSubscription,
} from "@/lib/agent-studio/agentStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, size, type } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "File name is required" },
        { status: 400 }
      );
    }

    const fileType = (type || "pdf").toLowerCase();
    if (!["pdf", "docx", "txt"].includes(fileType)) {
      return NextResponse.json(
        { success: false, error: "Unsupported file type. Supported types: PDF, DOCX, TXT." },
        { status: 400 }
      );
    }

    const result = addKnowledgeFile(id, {
      name: name.trim(),
      size: size || "1.5 MB",
      type: fileType as "pdf" | "docx" | "txt",
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

    const updatedAgent = getAgent(id);
    return NextResponse.json({
      success: true,
      document: result.document,
      agent: updatedAgent,
      subscription: getUserSubscription(),
    });
  } catch (error: any) {
    console.error("[API_AGENT_KNOWLEDGE_POST_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload knowledge document" },
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
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json(
        { success: false, error: "Document ID is required" },
        { status: 400 }
      );
    }

    const result = removeKnowledgeFile(id, docId);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Failed to remove knowledge document" },
        { status: 400 }
      );
    }

    const updatedAgent = getAgent(id);
    return NextResponse.json({
      success: true,
      agent: updatedAgent,
      subscription: getUserSubscription(),
    });
  } catch (error: any) {
    console.error("[API_AGENT_KNOWLEDGE_DELETE_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove knowledge document" },
      { status: 500 }
    );
  }
}
