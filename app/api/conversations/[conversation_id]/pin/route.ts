/**
 * Pin conversation API route stub.
 * Accepts pin status (client uses localStorage).
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pin conversation route stub.
export async function POST(
  req: NextRequest,
  { params }: { params: { conversation_id: string } }
) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ success: true, pinned: body.pinned || false });
}
