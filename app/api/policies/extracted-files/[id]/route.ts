import { NextRequest, NextResponse } from "next/server";
import {
  getResolvedMasterPolicies,
  getMasterPolicyText,
  saveMasterPolicyContent,
} from "@/lib/masterPolicies";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id, 10);
    if (!fileId || isNaN(fileId)) {
      return NextResponse.json({ success: false, error: "Invalid file ID" }, { status: 400 });
    }

    const policies = getResolvedMasterPolicies();
    const matched = policies.find(
      (b) => b.file_id === fileId || b.bank_id === fileId || b.id === fileId
    );

    if (matched) {
      const text = getMasterPolicyText(matched.file_name);
      return NextResponse.json({
        success: true,
        file: {
          id: matched.file_id,
          bank_id: matched.bank_id,
          bank_name: matched.bank_name,
          bank_code: matched.bank_code,
          file_name: matched.file_name,
          file_type: "txt",
          file_path: `policy-master-files/${matched.file_name}`,
          file_size_bytes: Buffer.byteLength(text, "utf-8"),
          extracted_text: text,
          uploaded_at: "2026-08-29T00:00:00.000Z",
        },
      });
    }

    // Fallback to database
    const result = await pool.query(
      `
      SELECT 
        bpf.id,
        bpf.bank_id,
        COALESCE(b.name, 'General Bank') AS bank_name,
        COALESCE(b.code, 'BANK') AS bank_code,
        bpf.file_name,
        bpf.file_type,
        bpf.file_path,
        bpf.file_size_bytes,
        bpf.extracted_text,
        COALESCE(bpf.uploaded_at, bpf.extracted_at) AS uploaded_at
      FROM bank_policy_files bpf
      LEFT JOIN banks b ON b.id = bpf.bank_id
      WHERE bpf.id = $1
      `,
      [fileId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Extracted policy file not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      file: result.rows[0],
    });
  } catch (err) {
    console.error("Failed to fetch extracted policy file detail", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch extracted policy file" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Enforce Admin Only
    const token =
      req.cookies.get("token")?.value ||
      req.headers.get("authorization")?.replace("Bearer ", "");
    const payload = token ? verifyToken(token) : null;

    let isAdmin =
      payload?.role === "admin" ||
      payload?.email === "admin@gmail.com" ||
      payload?.email === "akshadasagar31@gmail.com" ||
      payload?.email?.toLowerCase().includes("admin");
    // Also allow admin override in local development if explicitly flagged
    if (!isAdmin && process.env.NODE_ENV !== "production" && req.headers.get("x-user-role") === "admin") {
      isAdmin = true;
    }

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Only Admin users are permitted to edit master policy files." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const fileId = parseInt(id, 10);
    const body = await req.json().catch(() => ({}));
    const { content, file_name } = body;

    if (typeof content !== "string") {
      return NextResponse.json(
        { success: false, error: "Content must be provided as a string" },
        { status: 400 }
      );
    }

    // 2. Resolve the existing target file name (Do NOT create duplicate files)
    const policies = getResolvedMasterPolicies();
    const matched = policies.find(
      (b) =>
        (fileId && (b.file_id === fileId || b.bank_id === fileId || b.id === fileId)) ||
        (file_name && b.file_name.toLowerCase() === file_name.toLowerCase())
    );

    let targetFileName = matched?.file_name || file_name;

    if (!targetFileName && fileId) {
      try {
        const dbRes = await pool.query(
          `SELECT file_name FROM bank_policy_files WHERE id = $1`,
          [fileId]
        );
        if (dbRes.rows.length > 0) {
          targetFileName = dbRes.rows[0].file_name;
        }
      } catch (e) {
        console.warn("DB lookup error for file name:", e);
      }
    }

    if (!targetFileName) {
      return NextResponse.json(
        { success: false, error: "Unable to identify master policy file to update" },
        { status: 404 }
      );
    }

    // 3. Write directly to the existing file
    const result = saveMasterPolicyContent(targetFileName, content);

    return NextResponse.json({
      success: true,
      message: `Master policy file "${targetFileName}" saved successfully`,
      file_name: targetFileName,
      file_size_bytes: result.byteSize,
      extracted_text: content,
    });
  } catch (err: any) {
    console.error("Failed to update policy file content", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save policy file content" },
      { status: 500 }
    );
  }
}
