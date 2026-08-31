/**
 * Conversation detail API route stub.
 * Returns empty conversation data (client uses localStorage).
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Conversation detail routes are handled client-side via localStorage.
// This stub prevents 404s for /api/conversations/:id requests.
export async function GET(
  req: NextRequest,
  { params }: { params: { conversation_id: string } }
) {
  const id = params.conversation_id;
  return NextResponse.json({
    id,
    title: "New Conversation",
    pinned: false,
    messages: [],
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { conversation_id: string } }
) {
  return NextResponse.json({ success: true });
}
