// app/api/agents/[id]/knowledge/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getAgent,
  getUserSubscription,
  addKnowledgeFile,
  removeKnowledgeFile,
} from "@/lib/agent-studio/agentStore";
import {
  listAgentDocuments,
  saveDocumentConfiguration,
  deleteKnowledgeDocument,
  getAgentFromDb,
} from "@/lib/agent-studio/dbStore";
import { processDocumentFile } from "@/lib/agent-studio/documentProcessor";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "agent-knowledge");

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

// Allowed safe formats as specified in Section 2
const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "txt",
  "csv",
  "xls",
  "xlsx",
  "json",
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.cookies.get("token")?.value || req.cookies.get("auth_token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    const userId = payload?.id && Number.isFinite(Number(payload.id)) ? Number(payload.id) : undefined;

    const agent = (await getAgentFromDb(id, userId)) || (userId ? null : getAgent(id));
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found or access denied" },
        { status: 404 }
      );
    }

    const documents = await listAgentDocuments(id);
    return NextResponse.json({
      success: true,
      documents,
      count: documents.length,
      subscription: getUserSubscription(),
    });
  } catch (error: any) {
    console.error("[API_AGENT_KNOWLEDGE_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch knowledge documents" },
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
    const token = req.cookies.get("token")?.value || req.cookies.get("auth_token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    const userId = payload?.id && Number.isFinite(Number(payload.id)) ? Number(payload.id) : undefined;

    const agent = (await getAgentFromDb(id, userId)) || (userId ? null : getAgent(id));
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found or access denied" },
        { status: 404 }
      );
    }

    const subscription = getUserSubscription();
    const existingDocs = await listAgentDocuments(id);
    if (existingDocs.length >= subscription.maxKnowledgeFiles) {
      return NextResponse.json(
        {
          success: false,
          error: `Your ${subscription.plan.toUpperCase()} plan includes ${subscription.maxKnowledgeFiles} knowledge file(s). Upgrade your plan to add more.`,
          limitReached: true,
        },
        { status: 403 }
      );
    }

    let fileName = "";
    let fileBuffer: Buffer | null = null;
    let fileType = "pdf";
    let fileSizeStr = "1.0 MB";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: "No file provided in form data" },
          { status: 400 }
        );
      }

      fileName = file.name;
      const bytes = await file.arrayBuffer();
      fileBuffer = Buffer.from(bytes);
      const ext = path.extname(fileName).replace(".", "").toLowerCase();
      fileType = ext || "pdf";

      fileSizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;
    } else {
      // JSON body (e.g. simulated or metadata-driven upload)
      const body = await req.json();
      fileName = body.name || "Document.pdf";
      fileType = (body.type || path.extname(fileName).replace(".", "") || "pdf").toLowerCase();
      fileSizeStr = body.size || "1.5 MB";
      const sampleContent =
        body.content ||
        `Policy and eligibility reference document: ${fileName}.\nContains rules, terms, required KYC documents, and underwriting conditions.`;
      fileBuffer = Buffer.from(sampleContent, "utf-8");
    }

    const ext = fileType.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type (.${ext}). Supported formats: ${ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")}`,
        },
        { status: 400 }
      );
    }

    await ensureUploadDir();
    const safeDocId = `kdoc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const savedPath = path.join(UPLOAD_DIR, `${safeDocId}_${fileName}`);

    if (fileBuffer) {
      await fs.writeFile(savedPath, fileBuffer);
    }

    // Insert record into PostgreSQL database with user_id
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO knowledge_documents (
          id, agent_id, user_id, name, file_type, file_size, file_path, status, status_message, chunk_count, vector_status, is_active, uploaded_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROCESSING', 'Processing document...', 0, 'Pending', true, NOW(), NOW())`,
        [safeDocId, id, userId || null, fileName, ext, fileSizeStr, savedPath]
      );
    } finally {
      client.release();
    }

    // Also register in-memory store so UI remains fast
    addKnowledgeFile(id, {
      name: fileName,
      size: fileSizeStr,
      type: (["pdf", "docx", "txt", "csv", "xlsx"].includes(ext) ? ext : "pdf") as any,
    });

    // Execute Document Processing Pipeline (Extract -> Normalize -> Chunk -> Embed -> Index -> Mark Completed)
    if (fileBuffer) {
      try {
        await processDocumentFile(safeDocId, id, fileBuffer, fileName, ext);
      } catch (err) {
        console.error(`[DOCUMENT_PROCESSING_FAILED] ${safeDocId}:`, err);
      }
    }

    const updatedDocuments = await listAgentDocuments(id);
    const createdDoc = updatedDocuments.find((d) => d.id === safeDocId) || updatedDocuments[0];

    return NextResponse.json({
      success: true,
      document: createdDoc,
      documents: updatedDocuments,
      agent: getAgent(id),
      subscription: getUserSubscription(),
      message: "File uploaded successfully and processing started.",
    });
  } catch (error: any) {
    console.error("[API_AGENT_KNOWLEDGE_POST_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload knowledge document" },
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
    const body = await req.json();
    const { documentId, instructionText, whenToUse, whenNotToUse, guardrailText, isActive } =
      body;

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: "documentId is required" },
        { status: 400 }
      );
    }

    const updated = await saveDocumentConfiguration(documentId, id, {
      instructionText,
      whenToUse,
      whenNotToUse,
      guardrailText,
      isActive,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Failed to update document configuration" },
        { status: 500 }
      );
    }

    const documents = await listAgentDocuments(id);
    return NextResponse.json({
      success: true,
      documents,
      message: "Document configuration saved successfully",
    });
  } catch (error: any) {
    console.error("[API_AGENT_KNOWLEDGE_PATCH_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update document" },
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
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json(
        { success: false, error: "Document ID is required" },
        { status: 400 }
      );
    }

    await deleteKnowledgeDocument(docId);
    removeKnowledgeFile(id, docId);

    const documents = await listAgentDocuments(id);
    return NextResponse.json({
      success: true,
      documents,
      agent: getAgent(id),
      subscription: getUserSubscription(),
      message: "Document removed successfully",
    });
  } catch (error: any) {
    console.error("[API_AGENT_KNOWLEDGE_DELETE_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove knowledge document" },
      { status: 500 }
    );
  }
}
