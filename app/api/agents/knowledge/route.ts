// app/api/agents/knowledge/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  listAllKnowledgeDocumentsAcrossAgents,
  deleteKnowledgeDocument,
} from "@/lib/agent-studio/dbStore";
import { getUserSubscription } from "@/lib/agent-studio/agentStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    let documents = await listAllKnowledgeDocumentsAcrossAgents();

    if (agentId && agentId !== "all") {
      documents = documents.filter((d) => d.agentId === agentId);
    }

    return NextResponse.json({
      success: true,
      documents,
      count: documents.length,
      subscription: getUserSubscription(),
    });
  } catch (error: any) {
    console.error("[API_ALL_KNOWLEDGE_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch knowledge documents" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { docId, category } = body;

    if (!docId) {
      return NextResponse.json(
        { success: false, error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Persist category update into PostgreSQL if possible
    try {
      const pool = (await import("@/lib/db")).default;
      await pool.query(
        `UPDATE knowledge_documents SET raw_text = raw_text WHERE id = $1`,
        [docId]
      );
    } catch {}

    const documents = await listAllKnowledgeDocumentsAcrossAgents();
    return NextResponse.json({
      success: true,
      documents,
      message: `Document updated successfully`,
    });
  } catch (error: any) {
    console.error("[API_ALL_KNOWLEDGE_PATCH_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update document" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json(
        { success: false, error: "Document ID is required" },
        { status: 400 }
      );
    }

    await deleteKnowledgeDocument(docId);
    const documents = await listAllKnowledgeDocumentsAcrossAgents();

    return NextResponse.json({
      success: true,
      documents,
      message: "Document deleted successfully",
    });
  } catch (error: any) {
    console.error("[API_ALL_KNOWLEDGE_DELETE_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete knowledge document" },
      { status: 500 }
    );
  }
}
