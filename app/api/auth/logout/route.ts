/**
 * Logout API route.
 * Clears the JWT cookie by setting maxAge=0.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clear() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("token", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

export async function POST() {
  return clear();
}

export async function GET() {
  return clear();
}
