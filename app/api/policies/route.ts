import { NextRequest, NextResponse } from "next/server";
import { getAllMasterPolicies } from "@/lib/masterPolicies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status")?.trim().toLowerCase() || null;
    const bank_id = sp.get("bank_id") ? parseInt(sp.get("bank_id")!, 10) : null;
    const search = sp.get("search")?.trim().toLowerCase() || null;
    const loan_type = sp.get("loan_type")?.trim().toLowerCase() || null;

    let rows = getAllMasterPolicies();

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
          r.supported_loan_types.some((t: string) => t.toLowerCase().includes(loan_type))
      );
    }

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Failed to load master policies", err);
    return NextResponse.json({ error: "Failed to load master policies" }, { status: 500 });
  }
}
