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
import { verifyToken } from "@/lib/auth";

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
 * Resolves the authenticated user ID from the request auth token cookie.
 * Defaults to the primary active user (ID 2 / admin) if unauthenticated.
 */
async function getUserIdFromReq(req: NextRequest): Promise<number> {
  try {
    const token = req.cookies.get("token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    if (payload?.id && Number.isFinite(Number(payload.id))) {
      return Number(payload.id);
    }
  } catch {}
  return 2;
}

/**
 * Resolves an existing conversation in PostgreSQL or creates a new row with the
 * user's user_id, returning the integer conversation ID.
 */
async function resolveOrCreateConversation(
  userId: number,
  clientConvId: string,
  userMessage: string
): Promise<number> {
  const numId = Number(clientConvId);
  const client = await pool.connect();
  try {
    if (Number.isFinite(numId) && numId > 0) {
      const check = await client.query(
        `SELECT id FROM assistant_conversations WHERE id = $1`,
        [numId]
      );
      if (check.rowCount && check.rowCount > 0) {
        return numId;
      }
      // If client provided a specific numeric id not yet in DB, insert with user_id
      await client.query(
        `INSERT INTO assistant_conversations (id, user_id, title)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
        [numId, userId, userMessage.slice(0, 40) || "Loan Assistant"]
      );
      return numId;
    }

    // Create a new conversation row with sequence id
    const res = await client.query(
      `INSERT INTO assistant_conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id`,
      [userId, userMessage.slice(0, 40) || "Loan Assistant"]
    );
    return Number(res.rows[0].id);
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

    const clientConvId =
      String(body?.conversation_id || "").trim();

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
    /* Resolve User ID & Persistent Conversation in PostgreSQL                 */
    /* ---------------------------------------------------------------------- */

    const userId = await getUserIdFromReq(req);
    const convId = await resolveOrCreateConversation(userId, clientConvId, message);
    const conversationIdStr = String(convId);

    // Save the incoming user message to assistant_messages
    try {
      await pool.query(
        `INSERT INTO assistant_messages (conversation_id, role, content)
         VALUES ($1, 'user', $2)`,
        [convId, message]
      );
    } catch (msgErr) {
      console.error("Error saving user message to DB:", msgErr);
    }

    /* ---------------------------------------------------------------------- */
    /* Central AI Agent                                                       */
    /* ---------------------------------------------------------------------- */

    const agentResult = await runCentralAgent({
      message,
      conversationId: conversationIdStr,
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
     * Preserve the existing frontend contract:
     * - company_data
     * - company_query
     * - bank_data
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
    /* Persist AI message and update conversation metadata in PostgreSQL       */
    /* ---------------------------------------------------------------------- */

    try {
      await pool.query(
        `INSERT INTO assistant_messages (conversation_id, role, content)
         VALUES ($1, 'assistant', $2)`,
        [convId, agentResult.reply || ""]
      );
      await pool.query(
        `UPDATE assistant_conversations
         SET updated_at = NOW(),
             title = CASE WHEN title IS NULL OR title = 'Loan Assistant' OR title = 'New Conversation'
                          THEN $1 ELSE title END
         WHERE id = $2`,
        [message.slice(0, 40) || "Loan Assistant", convId]
      );
    } catch (saveErr) {
      console.error("Error persisting assistant response to DB:", saveErr);
    }

    /* ---------------------------------------------------------------------- */
    /* Return standard chat response with persistent conversation_id          */
    /* ---------------------------------------------------------------------- */

    return NextResponse.json({
      success: true,

      conversation_id: conversationIdStr,

      title:
        message.slice(0, 40) ||
        "Loan Assistant",

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