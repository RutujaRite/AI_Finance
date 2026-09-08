import { NextRequest, NextResponse } from "next/server";
import { getResolvedMasterPolicies, getMasterPolicyText } from "@/lib/masterPolicies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const policies = getResolvedMasterPolicies();
    const files = policies.map((b) => {
      const text = getMasterPolicyText(b.file_name);
      return {
        id: b.file_id,
        bank_id: b.bank_id,
        bank_name: b.bank_name,
        bank_code: b.bank_code,
        file_name: b.file_name,
        file_type: "txt",
        file_path: `policy-master-files/${b.file_name}`,
        file_size_bytes: Buffer.byteLength(text, "utf-8"),
        text_length: text.length,
        snippet: text.substring(0, 250),
        extracted_text: text,
        uploaded_at: "2026-08-29T00:00:00.000Z",
      };
    });

    return NextResponse.json({
      success: true,
      files,
    });
  } catch (err) {
    console.error("Failed to fetch extracted policy text files", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch extracted policy text files" },
      { status: 500 }
    );
  }
}
