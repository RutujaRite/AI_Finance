/**
 * Conversations API route.
 *
 * GET  /api/conversations  -> list all conversations for the logged-in user,
 *                             newest first, with a preview of the latest message.
 * POST /api/conversations  -> create a new conversation.
 * PUT  /api/conversations/:id -> update conversation (title / pin).
 *
 * Conversation state is persisted in PostgreSQL (assistant_conversations +
 * assistant_messages). The in-memory Map below is kept only as a fallback so
 * the route never returns an empty list when the database is unavailable.
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory fallback (matches original Flask behavior).
const conversations = new Map<string, any>();

async function getAuthenticatedUserId(req: NextRequest): Promise<number | null> {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  return payload?.id ? Number(payload.id) : null;
}

function rowToConv(row: any) {
  return {
    id: String(row.id),
    title: row.title || "New Conversation",
    pinned: Boolean(row.pinned),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    preview: row.preview || "",
    messageCount: Number(row.message_count || 0),
  };
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT
         c.id,
         c.title,
         c.created_at,
         c.updated_at,
         COALESCE(
           (SELECT m.content
            FROM assistant_messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT 1),
           ''
         ) AS preview,
         (SELECT COUNT(*)
          FROM assistant_messages m
          WHERE m.conversation_id = c.id
         ) AS message_count
       FROM assistant_conversations c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC, c.created_at DESC, c.id DESC`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      conversations: res.rows.map(rowToConv),
    });
  } catch (err: any) {
    console.error("List conversations error:", err);
    // Fall back to in-memory store so the UI still works.
    const all = Array.from(conversations.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ success: true, conversations: all });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id, title, pinned } = body;

  const client = await pool.connect();
  try {
    let convRow: any;
    const convId = id ? Number(id) : NaN;
    if (Number.isFinite(convId)) {
      const res = await client.query(
        `INSERT INTO assistant_conversations (id, user_id, title)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
         RETURNING id, title, user_id, created_at, updated_at`,
        [convId, userId, title || "New Chat"]
      );
      convRow = res.rows[0];
    } else {
      const res = await client.query(
        `INSERT INTO assistant_conversations (user_id, title)
         VALUES ($1, $2)
         RETURNING id, title, user_id, created_at, updated_at`,
        [userId, title || "New Chat"]
      );
      convRow = res.rows[0];
    }

    // Clean any prior state for this conversation to prevent cross-session value bleed
    try {
      const { clearEligibilityState } = await import("@/lib/dynamicEligibilityEngine");
      await clearEligibilityState(String(convRow.id));
      await client.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [convRow.id]);
    } catch (cleanErr) {
      console.warn("Could not clear prior state for conversation:", cleanErr);
    }

    const conversationObj = {
      id: String(convRow.id),
      title: convRow.title || "New Chat",
      pinned: Boolean(pinned),
      createdAt: convRow.created_at,
      updatedAt: convRow.updated_at,
      preview: "",
      messageCount: 0,
    };

    return NextResponse.json({
      success: true,
      id: String(convRow.id),
      conversation: conversationObj,
    });
  } catch (err: any) {
    console.error("Create conversation error:", err);
    return NextResponse.json({ success: false, error: "Failed to create conversation" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, title, pinned } = body;
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  const convId = Number(id);
  const userId = await getAuthenticatedUserId(req);

  if (Number.isFinite(convId) && userId) {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE assistant_conversations
         SET title = COALESCE($1, title),
             updated_at = NOW()
         WHERE id = $2 AND user_id = $3`,
        [title || null, convId, userId]
      );
      return NextResponse.json({ success: true });
    } catch (err: any) {
      console.error("Update conversation error:", err);
    } finally {
      client.release();
    }
  }

  const existing = conversations.get(id);
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (title) existing.title = title;
  if (typeof pinned === "boolean") existing.pinned = pinned;
  conversations.set(id, existing);
  return NextResponse.json({ success: true });
}