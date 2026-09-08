import { NextRequest, NextResponse } from "next/server";
import { getResolvedMasterPolicies, getMasterPolicyText } from "@/lib/masterPolicies";
import pool from "@/lib/db";

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
