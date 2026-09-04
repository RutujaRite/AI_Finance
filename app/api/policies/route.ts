import { NextRequest, NextResponse } from "next/server";
import pool from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status")?.trim().toLowerCase() || null;
    const bank_id = sp.get("bank_id") ? parseInt(sp.get("bank_id")!, 10) : null;

    if (sp.get("bank_id") && !Number.isInteger(bank_id)) {
      return NextResponse.json({ error: "Invalid bank_id" }, { status: 400 });
    }

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      conditions.push(`pr.status = $${params.length}`);
    }

    if (bank_id) {
      params.push(bank_id);
      conditions.push(`pv.bank_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `
      SELECT
        pr.id,
        b.id AS bank_id,
        b.name AS bank_name,
        b.code AS bank_code,
        pv.id AS policy_version_id,
        pv.version AS policy_version,
        pv.status AS version_status,
        pr.loan_type,
        pr.category,
        pr.min_cibil,
        pr.max_cibil,
        pr.min_salary,
        pr.max_salary,
        pr.employment_type,
        pr.min_age,
        pr.max_age,
        pr.min_loan_amount,
        pr.max_loan_amount,
        pr.min_tenure_months,
        pr.max_tenure_months,
        pr.foir_percent,
        pr.roi,
        pr.processing_fee_percent,
        pr.processing_fee_flat,
        pr.company_rules,
        pr.location_rules,
        pr.other_rules,
        pr.status,
        pa.id AS attachment_id,
        pa.file_name AS attachment_file_name,
        pa.file_path AS attachment_file_path,
        pa.extracted_text AS attachment_extracted_text
      FROM policy_rules pr
      JOIN policy_versions pv ON pv.id = pr.policy_version_id
      JOIN banks b ON b.id = pv.bank_id
      LEFT JOIN policy_attachments pa ON pa.policy_rule_id = pr.id
      ${where}
      ORDER BY b.name, pv.id DESC, pr.id DESC
      `,
      params
    );

    const bankIds = [...new Set(result.rows.map((row) => row.bank_id).filter(Boolean))];

    let inactiveFiles = new Set<string>();
    if (bankIds.length > 0) {
      const inactiveRes = await pool.query(
        `SELECT file_name FROM bank_policy_files WHERE bank_id = ANY($1::int[]) AND (metadata->>'is_active')::boolean = false`,
        [bankIds]
      );
      inactiveFiles = new Set(inactiveRes.rows.map((row) => row.file_name));
    }

    const filtered = result.rows.map((row) => {
      if (row.attachment_file_name && inactiveFiles.has(row.attachment_file_name)) {
        const clean = { ...row };
        clean.attachment_id = null;
        clean.attachment_file_name = null;
        clean.attachment_file_path = null;
        clean.attachment_extracted_text = null;
        return clean;
      }
      return row;
    });

    return NextResponse.json(filtered);
  } catch (err) {
    console.error("Failed to load policies", err);
    return NextResponse.json({ error: "Failed to load policies" }, { status: 500 });
  }
}
