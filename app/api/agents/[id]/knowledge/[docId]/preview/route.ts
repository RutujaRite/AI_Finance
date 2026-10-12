// app/api/agents/[id]/knowledge/[docId]/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDocumentDetailsWithChunks } from "@/lib/agent-studio/dbStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const details = await getDocumentDetailsWithChunks(docId);
    if (!details) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      document: details.document,
      chunks: details.chunks,
    });
  } catch (error: any) {
    console.error("[PREVIEW_DOCUMENT_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to preview document" },
      { status: 500 }
    );
  }
}
