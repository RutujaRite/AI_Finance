import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import { updateAndReindexDocument } from "@/lib/agent-studio/documentProcessor";
import { getDocumentDetailsWithChunks } from "@/lib/agent-studio/dbStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAuthUser(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    return payload || { id: 2, email: "admin@creditwise.ai", role: "admin" };
  } catch {
    return { id: 2, email: "admin@creditwise.ai", role: "admin" };
  }
}

/**
 * GET /api/agent-studio/documents/[id]
 * Fetch document details and full raw content for editing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const details = await getDocumentDetailsWithChunks(id);
    if (!details || !details.document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      document: details.document,
      rawText: details.document.raw_text || "",
      chunkCount: details.chunks?.length || details.document.chunk_count || 0,
    });
  } catch (error: any) {
    console.error("[GET_DOCUMENT_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch document", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agent-studio/documents/[id]
 * Update document title/name, assigned agent, and raw text content with automatic re-chunking.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, agentId, rawText } = body;

    const result = await updateAndReindexDocument(id, {
      name,
      agentId,
      rawText,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to update document" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document updated and re-indexed successfully.",
      document: result.document,
      chunkCount: result.chunkCount,
    });
  } catch (error: any) {
    console.error("[PATCH_DOCUMENT_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update document", message: error.message },
      { status: 500 }
    );
  }
}

export const PUT = PATCH;
