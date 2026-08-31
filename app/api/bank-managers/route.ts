/**
 * Bank managers list API route.
 * Returns all active bank managers from PostgreSQL.
 * Uses: lib/bankSearch
 */

import { NextRequest, NextResponse } from "next/server";
import { searchBankManager } from "../../../lib/bankSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await searchBankManager();
    return NextResponse.json({ managers: result.managers });
  } catch (err) {
    console.error("list managers error", err);
    return NextResponse.json({ managers: [] });
  }
}
