/**
 * Auth verify API route.
 * Validates JWT cookie and returns current user info.
 * Uses: lib/db, lib/auth (verifyToken)
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { verifyToken } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }
  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT id, name, email, role FROM users WHERE id = $1 LIMIT 1",
      [payload.id]
    );
    if (res.rowCount === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }
    const user = res.rows[0];
    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err: any) {
    console.error("auth verify error", err);
    return NextResponse.json({ success: false, error: "Verification failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
