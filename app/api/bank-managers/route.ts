/**
 * Bank managers list & creation API route.
 * GET: Returns matching active bank managers.
 * POST: Create/add a single bank manager record.
 * Uses: lib/bankSearch, lib/db, lib/auth
 */

import { NextRequest, NextResponse } from "next/server";
import { searchBankManager } from "@/lib/bankSearch";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await searchBankManager({});
    return NextResponse.json({ managers: result });
  } catch (err) {
    console.error("list managers error", err);
    return NextResponse.json({ managers: [] });
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { bank_name, branch_name, manager_name, mobile_number, email, city, state, address, branch_code } = body;

    if (!bank_name || !manager_name) {
      return NextResponse.json({ success: false, error: "Bank name and Manager name are required" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO bank_managers (bank_name, branch_name, manager_name, mobile_number, email, city, state, address, branch_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          bank_name,
          branch_name || "",
          manager_name,
          mobile_number || "",
          email || "",
          city || "",
          state || "",
          address || "",
          branch_code || "",
        ]
      );
      return NextResponse.json({ success: true, id: res.rows[0].id });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Create manager error", err);
    return NextResponse.json({ success: false, error: "Could not create manager record" }, { status: 500 });
  }
}
