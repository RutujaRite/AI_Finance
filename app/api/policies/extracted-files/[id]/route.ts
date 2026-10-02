import { NextRequest, NextResponse } from "next/server";
import {
  getAllMasterPolicies,
  getMasterPolicyText,
  saveMasterPolicyContent,
} from "@/lib/masterPolicies";
import pool from "@/lib/db";
import fs from "fs";
import path from "path";

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

    // 1. Check in master policies from policy-master-files directory
    const masterPolicies = getAllMasterPolicies();
    const matched = masterPolicies.find(
      (p) => p.attachment_id === fileId || p.bank_id === fileId || p.id === fileId
    );

    if (matched) {
      const text = getMasterPolicyText(matched.file_name);
      const dirPath = path.join(process.cwd(), "policy-master-files");
      let stats: fs.Stats | null = null;
      try {
        const fullPath = path.join(dirPath, matched.file_name);
        if (fs.existsSync(fullPath)) {
          stats = fs.statSync(fullPath);
        }
      } catch {}

      const sizeBytes = stats ? stats.size : Buffer.byteLength(text, "utf-8");

      return NextResponse.json({
        success: true,
        file: {
          id: matched.attachment_id || matched.bank_id,
          bank_id: matched.bank_id,
          bank_name: matched.bank_name,
          bank_code: matched.bank_code,
          file_name: matched.file_name,
          file_type: "text/plain",
          file_path: `/policy-master-files/${matched.file_name}`,
          file_size_bytes: sizeBytes,
          extracted_text: text,
          uploaded_at: stats ? stats.mtime.toISOString() : new Date().toISOString(),
        },
      });
    }

    // 2. Fallback to bank_policy_files DB table
    if (pool) {
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

      if (result.rows.length > 0) {
        return NextResponse.json({
          success: true,
          file: result.rows[0],
        });
      }
    }

    return NextResponse.json({ success: false, error: "Extracted policy file not found" }, { status: 404 });
  } catch (err) {
    console.error("Failed to fetch extracted policy file detail", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch extracted policy file" },
      { status: 500 }
    );
  }
}

// PUT /api/policies/extracted-files/[id] -> Save in-place changes to the existing .txt file
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id, 10);
    const body = await req.json();

    let targetFileName = body.file_name;
    const newContent = body.content ?? "";

    if (!targetFileName) {
      // Find from master policies by ID
      const masterPolicies = getAllMasterPolicies();
      const matched = masterPolicies.find(
        (p) => p.attachment_id === fileId || p.bank_id === fileId || p.id === fileId
      );
      if (matched) {
        targetFileName = matched.file_name;
      }
    }

    if (!targetFileName) {
      return NextResponse.json({ success: false, error: "File name is required" }, { status: 400 });
    }

    // Save directly to the existing .txt file without creating duplicate files
    const saveRes = saveMasterPolicyContent(targetFileName, newContent);

    return NextResponse.json({
      success: true,
      message: `Master policy file "${targetFileName}" saved successfully`,
      file_name: targetFileName,
      file_size_bytes: saveRes.byteSize,
    });
  } catch (err: any) {
    console.error("Failed to save master policy file content", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save file content" },
      { status: 500 }
    );
  }
}
