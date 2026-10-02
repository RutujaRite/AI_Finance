import { NextRequest, NextResponse } from "next/server";
import { getAllMasterPolicies } from "@/lib/masterPolicies";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const masterPolicies = getAllMasterPolicies();
    const dirPath = path.join(process.cwd(), "policy-master-files");

    // Deduplicate by bank_id and bank_name to guarantee exactly ONE row per bank
    const seenBanks = new Set<string>();
    const uniquePolicies = masterPolicies.filter((p) => {
      const key = `${p.bank_id}_${p.bank_name.toLowerCase().trim()}`;
      if (seenBanks.has(key)) return false;
      seenBanks.add(key);
      return true;
    });

    const files = uniquePolicies.map((p, idx) => {
      let stats: fs.Stats | null = null;
      try {
        const fullPath = path.join(dirPath, p.file_name);
        if (fs.existsSync(fullPath)) {
          stats = fs.statSync(fullPath);
        }
      } catch (err) {
        console.warn(`Stat error for ${p.file_name}:`, err);
      }

      const text = p.attachment_extracted_text || "";
      const sizeBytes = stats ? stats.size : Buffer.byteLength(text, "utf-8");

      return {
        id: p.attachment_id || p.bank_id,
        file_id: p.attachment_id || p.bank_id,
        bank_id: p.bank_id,
        bank_name: p.bank_name,
        bank_code: p.bank_code,
        file_name: p.file_name,
        file_type: "text/plain",
        file_path: `/policy-master-files/${p.file_name}`,
        file_size_bytes: sizeBytes,
        text_length: text.length,
        snippet: text.substring(0, 250),
        extracted_text: text,
        uploaded_at: stats ? stats.mtime.toISOString() : new Date().toISOString(),
        loan_type: p.loan_type,
        status: p.status,
        min_cibil: p.min_cibil,
        max_cibil: p.max_cibil,
        min_salary: p.min_salary,
        max_salary: p.max_salary,
        min_age: p.min_age,
        max_age: p.max_age,
        min_loan_amount: p.min_loan_amount,
        max_loan_amount: p.max_loan_amount,
        min_tenure_months: p.min_tenure_months,
        max_tenure_months: p.max_tenure_months,
        foir_percent: p.foir_percent,
        roi: p.roi,
        processing_fee_percent: p.processing_fee_percent,
        policy_version: p.policy_version,
        employment_type: p.employment_type,
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
