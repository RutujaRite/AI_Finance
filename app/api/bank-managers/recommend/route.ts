/**
 * Recommend bank managers API route.
 * Returns top 5 matching managers for a location/bank.
 * Uses: lib/bankSearch
 */

import { NextRequest, NextResponse } from "next/server";
import { searchBankManager } from "@/lib/bankSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const location = sp.get("location") || "";
  const bank_name = sp.get("bank_name") || "";
  try {
    const result = await searchBankManager({ bank_name, city: location });
    const managers = result.slice(0, 5);
    return NextResponse.json({ managers });
  } catch (err) {
    console.error("Recommend manager error", err);
    return NextResponse.json({ managers: [] });
  }
}
