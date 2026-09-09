/**
 * Conversation detail API route.
 *
 * GET  /api/conversations/:id  -> returns the conversation metadata plus
 *                                  all of its messages (user + assistant),
 *                                  ordered by creation time.
 *
 * DELETE /api/conversations/:id -> deletes the conversation (cascades messages).
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedUserId(req: NextRequest): Promise<number | null> {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  return payload?.id ? Number(payload.id) : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversation_id: string }> }
) {
  const { conversation_id } = await params;
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const convId = Number(conversation_id);
  if (!Number.isFinite(convId)) {
    return NextResponse.json({ success: false, error: "Invalid conversation id" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const convRes = await client.query(
      `SELECT id, user_id, title, created_at, updated_at
       FROM assistant_conversations
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [convId, userId]
    );
    if (convRes.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    const conv = convRes.rows[0];

    const msgRes = await client.query(
      `SELECT id, role, content, created_at
       FROM assistant_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC, id ASC`,
      [convId]
    );

    return NextResponse.json({
      success: true,
      id: conv.id,
      user_id: conv.user_id,
      title: conv.title,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      messages: msgRes.rows.map((m: any) => ({
        id: String(m.id),
        role: m.role === "assistant" ? "ai" : "user",
        content: m.content,
        timestamp: m.created_at,
      })),
    });
  } catch (err: any) {
    console.error("Conversation detail error:", err);
    return NextResponse.json({ success: false, error: "Failed to load conversation" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ conversation_id: string }> }
) {
  const { conversation_id } = await params;
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const convId = Number(conversation_id);
  if (!Number.isFinite(convId)) {
    return NextResponse.json({ success: false, error: "Invalid conversation id" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `DELETE FROM assistant_conversations WHERE id = $1 AND user_id = $2`,
      [convId, userId]
    );
    return NextResponse.json({ success: true, conversation_id: convId });
  } catch (err: any) {
    console.error("Conversation delete error:", err);
    return NextResponse.json({ success: false, error: "Failed to delete conversation" }, { status: 500 });
  } finally {
    client.release();
  }
}