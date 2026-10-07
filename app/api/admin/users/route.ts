/**
 * Admin users list API route.
 * Returns all users from PostgreSQL (admin only).
 * Uses: lib/db, lib/auth (verifyToken)
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { verifyToken, isAdminUser } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  if (!isAdminUser(payload)) {
    return NextResponse.json(
      { success: false, error: "Forbidden", message: "Admin privileges required" },
      { status: 403 }
    );
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT id, name, email, role, status, created_at, last_login FROM users ORDER BY created_at DESC"
    );
    return NextResponse.json({ users: res.rows });
  } catch (err: any) {
    console.error("list users error", err);
    return NextResponse.json({ users: [] });
  } finally {
    client.release();
  }
}
