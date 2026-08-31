/**
 * Bank managers search API route.
 * Accepts query params (bank_name, city, state, branch, manager_name) and
 * returns matching managers from PostgreSQL.
 * Uses: lib/bankSearch
 */

import { NextRequest, NextResponse } from "next/server";
import { searchBankManager } from "../../../../lib/bankSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const bank_name = sp.get("bank_name");
  const city = sp.get("location") || sp.get("city");
  const state = sp.get("state");
  const branch = sp.get("branch");
  const manager_name = sp.get("manager_name");
  try {
    const result = await searchBankManager({ bank_name, city, state, branch, manager_name });
    return NextResponse.json({ managers: result.managers });
  } catch (err) {
    console.error("search managers error", err);
    return NextResponse.json({ managers: [] });
  }
}
