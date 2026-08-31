/**
 * Conversations API route.
 * GET: list conversations.
 * POST: create conversation.
 * DELETE: delete conversation.
 * PUT: update conversation (pin).
 *
 * Note: conversation state is primarily stored in localStorage on the client.
 * These routes exist as stubs to match the original Flask API surface.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory conversation storage (matches original Flask behavior).
// These routes are stubbed to satisfy the Next.js app; conversation
// state is primarily stored in localStorage on the client.
const conversations = new Map<string, any>();

export async function GET(req: NextRequest) {
  const all = Array.from(conversations.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json({ conversations: all });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, title, pinned } = body;
  if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  conversations.set(id, {
    id,
    title: title || "New Conversation",
    pinned: pinned || false,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || searchParams.get("conversation_id");
  if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  conversations.delete(id);
  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, pinned } = body;
  if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  const existing = conversations.get(id);
  if (!existing) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  conversations.set(id, { ...existing, pinned: !!pinned });
  return NextResponse.json({ success: true, pinned: !!pinned });
}
