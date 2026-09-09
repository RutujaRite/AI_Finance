import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const result = await pool.query(`
      SELECT 
        bpf.id,
        bpf.bank_id,
        COALESCE(b.name, 'General Bank') AS bank_name,
        COALESCE(b.code, 'BANK') AS bank_code,
        bpf.file_name,
        bpf.file_type,
        bpf.file_path,
        bpf.file_size_bytes,
        LENGTH(COALESCE(bpf.extracted_text, '')) AS text_length,
        SUBSTRING(COALESCE(bpf.extracted_text, '') FROM 1 FOR 250) AS snippet,
        COALESCE(bpf.uploaded_at, bpf.extracted_at) AS uploaded_at
      FROM bank_policy_files bpf
      LEFT JOIN banks b ON b.id = bpf.bank_id
      ORDER BY b.name ASC, bpf.file_name ASC
    `);

    return NextResponse.json({
      success: true,
      files: result.rows,
    });
  } catch (err) {
    console.error("Failed to fetch extracted policy text files", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch extracted policy text files" },
      { status: 500 }
    );
  }
}
