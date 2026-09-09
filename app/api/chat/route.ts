/**
 * Central Chat API Route
 *
 * This route is intentionally kept thin.
 *
 * Flow:
 * Request
 *   ↓
 * Central AI Agent
 *   ↓
 * Existing tools / deterministic policy engine / LLM
 *   ↓
 * Standard frontend response
 */

import { NextRequest, NextResponse } from "next/server";

import { runCentralAgent } from "@/lib/ai/agent";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function uid(): string {
  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Persist a chat exchange (user + assistant messages) into the database so the
 * History page can list and restore real conversations.
 *
 * Creates the conversation row if it does not exist yet, then inserts both
 * messages and refreshes the conversation title + updated_at.
 */
async function persistChatExchange(
  conversationId: string,
  userMessage: string,
  aiMessage: any
): Promise<void> {
  if (!conversationId || conversationId === "default_session") return;
  const convId = Number(conversationId);
  if (!Number.isFinite(convId)) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO assistant_conversations (id, title)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [convId, (userMessage.slice(0, 40) || "New Conversation")]
    );
    await client.query(
      `INSERT INTO assistant_messages (conversation_id, role, content)
       VALUES ($1, 'user', $2)`,
      [convId, userMessage]
    );
    await client.query(
      `INSERT INTO assistant_messages (conversation_id, role, content)
       VALUES ($1, 'assistant', $2)`,
      [convId, aiMessage.content || ""]
    );
    await client.query(
      `UPDATE assistant_conversations
       SET title = $1, updated_at = NOW()
       WHERE id = $2`,
      [userMessage.slice(0, 40) || "New Conversation", convId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to persist chat exchange:", err);
  } finally {
    client.release();
  }
}

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const message = String(body?.message || "").trim();

    const conversationId =
      String(body?.conversation_id || "default_session").trim();

    const requestedModel =
      body?.model
        ? String(body.model).trim()
        : undefined;

    /* ---------------------------------------------------------------------- */
    /* Validate request                                                       */
    /* ---------------------------------------------------------------------- */

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Message is required",
        },
        {
          status: 400,
        }
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Central AI Agent                                                       */
    /* ---------------------------------------------------------------------- */

    const agentResult = await runCentralAgent({
      message,
      conversationId,
      model: requestedModel,
    });

    /* ---------------------------------------------------------------------- */
    /* Build AI message                                                      */
    /* ---------------------------------------------------------------------- */

    const aiMessage: any = {
      id: uid(),

      role: "ai",

      content: agentResult.reply,

      timestamp: nowISO(),
    };

    /*
     * Preserve the existing frontend contract.
     *
     * Your UI already expects:
     * - company_data
     * - company_query
     * - bank_data
     *
     * Therefore we keep those fields unchanged.
     */

    if (agentResult.companyData) {
      aiMessage.company_data = agentResult.companyData;
    }

    if (agentResult.companyQuery) {
      aiMessage.company_query = agentResult.companyQuery;
    }

    if (agentResult.bankData) {
      aiMessage.bank_data = agentResult.bankData;
    }

    /* ---------------------------------------------------------------------- */
    /* Persist to database so History can list / restore real conversations   */
    /* ---------------------------------------------------------------------- */

    persistChatExchange(conversationId, message, aiMessage).catch(() => {});

    /* ---------------------------------------------------------------------- */
    /* Return standard chat response                                          */
    /* ---------------------------------------------------------------------- */

    return NextResponse.json({
      success: true,

      conversation_id: conversationId,

      title:
        message.slice(0, 40) ||
        "New Conversation",

      ai_message: aiMessage,

      user_message: {
        id: uid(),

        role: "user",

        content: message,

        timestamp: nowISO(),
      },
    });
  } catch (error: any) {
    // Log the full runtime error to server logs for debugging.
    // The client always receives a safe, generic message.
    console.error(
      "Central Chat API error:",
      error?.message || error,
      error?.stack || ""
    );

    return NextResponse.json(
      {
        success: false,
        error: "Chat failed",
      },
      {
        status: 500,
      }
    );
  }
}