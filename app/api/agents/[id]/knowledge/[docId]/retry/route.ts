// app/api/agents/[id]/knowledge/[docId]/retry/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { processDocumentFile } from "@/lib/agent-studio/documentProcessor";
import fs from "fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params;
    const client = await pool.connect();
    let docRow: any = null;
    try {
      const res = await client.query(
        `SELECT * FROM knowledge_documents WHERE id = $1 AND agent_id = $2`,
        [docId, id]
      );
      if (res.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Document not found" },
          { status: 404 }
        );
      }
      docRow = res.rows[0];
    } finally {
      client.release();
    }

    let buffer: Buffer | null = null;
    if (docRow.file_path) {
      try {
        buffer = await fs.readFile(docRow.file_path);
      } catch {
        // Fallback to raw text if file on disk was removed
        if (docRow.raw_text) {
          buffer = Buffer.from(docRow.raw_text, "utf-8");
        }
      }
    }

    if (!buffer) {
      buffer = Buffer.from(`Retrying document extraction for ${docRow.name}`, "utf-8");
    }

    // Trigger processing
    processDocumentFile(docId, id, buffer, docRow.name, docRow.file_type).catch((err) => {
      console.error(`[RETRY_PROCESS_FAILED] ${docId}:`, err);
    });

    return NextResponse.json({
      success: true,
      message: "Retry initiated. Processing pipeline restarted.",
    });
  } catch (error: any) {
    console.error("[RETRY_DOCUMENT_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retry document" },
      { status: 500 }
    );
  }
}
