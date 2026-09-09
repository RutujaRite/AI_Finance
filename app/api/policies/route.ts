import { NextRequest, NextResponse } from "next/server";
import {
  getAllMasterPolicies,
  deleteBankMasterPolicy,
  updateBankMasterPolicy,
} from "@/lib/masterPolicies";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status")?.trim().toLowerCase() || null;
    const bank_id = sp.get("bank_id") ? parseInt(sp.get("bank_id")!, 10) : null;
    const search = sp.get("search")?.trim().toLowerCase() || null;
    const loan_type = sp.get("loan_type")?.trim().toLowerCase() || null;
    const getBanks = sp.get("banks") === "true";

    // If requesting banks list
    if (getBanks) {
      try {
        const banksRes = await pool.query(`SELECT id, name, code FROM banks ORDER BY name ASC`);
        return NextResponse.json({ success: true, banks: banksRes.rows });
      } catch {
        const fallbackBanks = getAllMasterPolicies().map((p) => ({
          id: p.bank_id,
          name: p.bank_name,
          code: p.bank_code,
        }));
        return NextResponse.json({ success: true, banks: fallbackBanks });
      }
    }

    // Return exactly ONE row per bank with one master text file
    let rows = getAllMasterPolicies();

    // Strict deduplication by bank_id and bank_name to guarantee exactly one row per bank
    const seenBankIds = new Set<string>();
    rows = rows.filter((r) => {
      const key = `${r.bank_id}_${r.bank_name.toLowerCase().trim()}`;
      if (seenBankIds.has(key)) return false;
      seenBankIds.add(key);
      return true;
    });

    if (bank_id) {
      rows = rows.filter((r) => r.bank_id === bank_id);
    }

    if (status && status !== "all") {
      rows = rows.filter((r) => r.status.toLowerCase() === status);
    }

    if (search) {
      rows = rows.filter(
        (r) =>
          r.bank_name.toLowerCase().includes(search) ||
          r.bank_code.toLowerCase().includes(search)
      );
    }

    if (loan_type && loan_type !== "all") {
      rows = rows.filter(
        (r) =>
          r.loan_type.toLowerCase().includes(loan_type) ||
          (Array.isArray(r.supported_loan_types) &&
            r.supported_loan_types.some((t: string) => t.toLowerCase().includes(loan_type)))
      );
    }

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Failed to load master policies", err);
    return NextResponse.json({ error: "Failed to load master policies" }, { status: 500 });
  }
}

// Fallback DELETE /api/policies?id=...&bank_id=...&file_name=...
export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const id = sp.get("id");
    const bankIdParam = sp.get("bank_id");
    const fileName = sp.get("file_name") || undefined;

    const bankId = parseInt(bankIdParam || id || "", 10);
    if (!bankId || isNaN(bankId)) {
      return NextResponse.json({ success: false, error: "Invalid bank or policy ID" }, { status: 400 });
    }

    const res = await deleteBankMasterPolicy(bankId, fileName);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Delete failed" }, { status: 500 });
  }
}
