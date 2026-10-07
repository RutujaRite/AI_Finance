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
import { getActiveLlmModelName } from "@/lib/ai/modelRouter";
import { getCreditWiseSystemPrompt } from "@/lib/ai/prompts";
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
        `SELECT id FROM assistant_conversations WHERE id = $1 AND user_id = $2`,
        [numId, userId]
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

    const rawMessage = String(body?.message || "").trim();
    // Truncate incoming user messages to a maximum of 2,000 characters (~500 tokens)
    const message = rawMessage.slice(0, 2000);

    const clientConvId =
      String(body?.conversation_id || "").trim();

    const activeLlm = await getActiveLlmModelName();
    const requestedModel =
      body?.model
        ? String(body.model).trim()
        : activeLlm;
    const selectionType = body?.company_selection?.type;
    const companySelectionAction =
      body?.company_selection && typeof body.company_selection === "object" &&
      (selectionType === "confirm" || selectionType === "retry" || selectionType === "select")
      ? {
          type: selectionType,
          companyId: body.company_selection.company_id,
          companyName: body.company_selection.company_name,
        }
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

    // Load recent conversation history (prior turns) to provide complete multi-turn context
    let conversationHistory: Array<{ role: string; content: string }> = [];
    try {
      const historyRes = await pool.query(
        `SELECT role, content FROM assistant_messages
         WHERE conversation_id = $1
         ORDER BY id ASC`,
        [convId]
      );
      // Exclude the message we just inserted so conversationHistory represents PRIOR turns
      const allRows = historyRes.rows;
      const priorRows = allRows.slice(0, -1);
      // Bound conversationHistory to the last 6 messages (3 turns) to minimize context and latency
      const recentRows = priorRows.slice(-6);
      conversationHistory = recentRows.map((r: any) => ({
        role: r.role === "assistant" || r.role === "ai" ? "assistant" : "user",
        content: r.content,
      }));
    } catch (histErr) {
      console.warn("Could not load conversation history from DB:", histErr);
    }

    /* ---------------------------------------------------------------------- */
    /* Dynamic System Time (IST) & System Prompt Refactor                    */
    /* ---------------------------------------------------------------------- */

    // 1. DYNAMIC SYSTEM TIME: Compute current Indian Standard Time (IST) dynamically on each request
    const currentTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // 2. SYSTEM PROMPT: Dynamic context, policy RAG rule, and important conversation rules
    const systemPrompt = getCreditWiseSystemPrompt(currentTime);

    /* ---------------------------------------------------------------------- */
    /* Central AI Agent & Server-Sent Events Streaming                        */
    /* ---------------------------------------------------------------------- */

    const shouldStream = body?.stream === true;

    if (shouldStream) {
      console.log(`[STREAM] Request received: convId=${conversationIdStr} message="${message.slice(0, 50)}"`);
      const encoder = new TextEncoder();
      const customStream = new TransformStream();
      const writer = customStream.writable.getWriter();

      let writeQueue = Promise.resolve();
      const sendEvent = (data: any) => {
        writeQueue = writeQueue.then(async () => {
          try {
            await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (wErr) {
            // Client disconnected or write closed
          }
        });
        return writeQueue;
      };

      (async () => {
        let tokenCount = 0;
        let isFirstToken = true;
        try {
          await sendEvent({ type: "init", conversation_id: conversationIdStr });

          const agentResult = await runCentralAgent({
            message,
            conversationId: conversationIdStr,
            conversationHistory,
            model: requestedModel,
            companySelectionAction,
            currentTime,
            systemPrompt,
            signal: req.signal,
            onToken: (token: string) => {
              if (token) {
                if (isFirstToken) {
                  console.log(`[STREAM] LLM stream started (first token received)`);
                  isFirstToken = false;
                }
                tokenCount++;
                if (tokenCount === 1 || tokenCount % 25 === 0) {
                  console.log(`[STREAM] Chunk received (count: ${tokenCount})`);
                }
                sendEvent({ type: "token", text: token });
              }
            },
          });

          console.log(`[STREAM] Stream completed: totalTokens=${tokenCount}`);

          let effectiveTitle = message.slice(0, 40) || "Loan Assistant";
          try {
            await pool.query(
              `INSERT INTO assistant_messages (conversation_id, role, content)
               VALUES ($1, 'assistant', $2)`,
              [convId, agentResult.reply || ""]
            );
            const titleRes = await pool.query(
              `UPDATE assistant_conversations
               SET updated_at = NOW(),
                   title = CASE WHEN title IS NULL OR title = 'Loan Assistant' OR title = 'New Conversation' OR title = 'New Chat'
                                THEN $1 ELSE title END
               WHERE id = $2
               RETURNING title`,
              [effectiveTitle, convId]
            );
            if (titleRes.rows.length > 0 && titleRes.rows[0].title) {
              effectiveTitle = titleRes.rows[0].title;
            }
            console.log(`[STREAM] Final response persisted`);
          } catch (saveErr) {
            console.error("Error persisting assistant response to DB:", saveErr);
          }

          const aiMessage: any = {
            id: uid(),
            role: "ai",
            content: agentResult.reply,
            timestamp: nowISO(),
          };

          if (agentResult.companyData) {
            aiMessage.company_data = agentResult.companyData;
          }
          if (agentResult.companyQuery) {
            aiMessage.company_query = agentResult.companyQuery;
          }
          if (agentResult.bankData) {
            aiMessage.bank_data = agentResult.bankData;
          }

          await sendEvent({
            type: "done",
            success: true,
            conversation_id: conversationIdStr,
            title: effectiveTitle,
            ai_message: aiMessage,
          });
        } catch (streamErr: any) {
          console.error("Central Chat stream error:", streamErr);
          await sendEvent({
            type: "error",
            error: streamErr?.message || "Streaming failed",
          });
        } finally {
          try {
            await writeQueue;
            await writer.close();
          } catch {}
        }
      })();

      return new Response(customStream.readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const agentResult = await runCentralAgent({
      message,
      conversationId: conversationIdStr,
      conversationHistory,
      model: requestedModel,
      companySelectionAction,
      currentTime,
      systemPrompt,
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

    let effectiveTitle = message.slice(0, 40) || "Loan Assistant";
    try {
      await pool.query(
        `INSERT INTO assistant_messages (conversation_id, role, content)
         VALUES ($1, 'assistant', $2)`,
        [convId, agentResult.reply || ""]
      );
      const titleRes = await pool.query(
        `UPDATE assistant_conversations
         SET updated_at = NOW(),
             title = CASE WHEN title IS NULL OR title = 'Loan Assistant' OR title = 'New Conversation' OR title = 'New Chat'
                          THEN $1 ELSE title END
         WHERE id = $2
         RETURNING title`,
        [effectiveTitle, convId]
      );
      if (titleRes.rows.length > 0 && titleRes.rows[0].title) {
        effectiveTitle = titleRes.rows[0].title;
      }
    } catch (saveErr) {
      console.error("Error persisting assistant response to DB:", saveErr);
    }

    /* ---------------------------------------------------------------------- */
    /* Return standard chat response with persistent conversation_id          */
    /* ---------------------------------------------------------------------- */

    return NextResponse.json({
      success: true,

      conversation_id: conversationIdStr,

      title: effectiveTitle || "Loan Assistant",

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
