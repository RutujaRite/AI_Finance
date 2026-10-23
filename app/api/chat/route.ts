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
import { getAgent, listAgents } from "@/lib/agent-studio/agentStore";
import { listAgentDocuments, recordConversationExchange, getActiveAgentFromDb, getAgentFromDb, getUserActiveAgent, getAppliedAgentsFromDb, recordTokenUsage } from "@/lib/agent-studio/dbStore";
import {
  selectRelevantDocuments,
  retrieveKnowledgeChunks,
  validateAgentResponse,
  buildConfiguredAgentPrompt,
  isKnowledgeBaseAgent,
} from "@/lib/agent-studio/ragEngine";
import { resolveActiveAgentForQuery, formatAgentGuidancePrompt } from "@/lib/agent-studio/agentRouter";
import { classifyRetrievalIntent } from "@/lib/ai/intentRouting";
import { performDualSourceRetrieval } from "@/lib/ai/dualSourceRag";
import {
  loadSessionVariables,
  extractVariableUpdatesFromText,
  persistUpdatedVariables,
  formatActiveVariablesPrompt,
} from "@/lib/ai/variableTracker";

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
      const parsedId = Number(payload.id);
      const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [parsedId]);
      if (userCheck.rowCount && userCheck.rowCount > 0) {
        return parsedId;
      }
    }
  } catch {}

  try {
    const fallbackRes = await pool.query("SELECT id FROM users ORDER BY id ASC LIMIT 1");
    if (fallbackRes.rows.length > 0) {
      return Number(fallbackRes.rows[0].id);
    }
  } catch {}

  return 1;
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

    // If client provided a non-numeric string id, check if it was previously mapped in assistant_conversation_states
    if (clientConvId && typeof clientConvId === "string") {
      const stateCheck = await client.query(
        `SELECT state FROM assistant_conversation_states WHERE conversation_id = $1`,
        [clientConvId]
      );
      if (stateCheck.rowCount && stateCheck.rowCount > 0) {
        const mappedId = Number(stateCheck.rows[0]?.state?.internal_conv_id);
        if (Number.isFinite(mappedId) && mappedId > 0) {
          return mappedId;
        }
      }
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
      String(body?.conversation_id || body?.conversationId || "").trim();

    // 0. Dynamic Key Resolution Pipeline:
    // Check PostgreSQL database for active configured credentials saved via AI Agent Studio,
    // then fall back to process.env.
    const { resolveDynamicApiKey, isOpenRouterAuthError, INVALID_KEY_USER_MESSAGE } = await import("@/lib/ai/keyResolution");
    await resolveDynamicApiKey();

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

    // 1. FULL SESSION MEMORY: Pass the entire current session chat history so the LLM never forgets context
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
      // Always pass the entire current session chat history to the LLM
      conversationHistory = priorRows.map((r: any) => ({
        role: r.role === "assistant" || r.role === "ai" ? "assistant" : "user",
        content: r.content,
      }));
    } catch (histErr) {
      console.warn("Could not load conversation history from DB:", histErr);
    }

    // 2. CONTEXT VARIABLE TRACKING: Automatically catch and update current values (salary, EMI, loan amount, CIBIL, etc.)
    const currentVars = await loadSessionVariables(conversationIdStr);
    const clientVars = (clientConvId && clientConvId !== conversationIdStr)
      ? await loadSessionVariables(clientConvId)
      : {};
    const mergedCurrentVars = { ...clientVars, ...currentVars };

    const varUpdates = extractVariableUpdatesFromText(message);
    const activeVars = await persistUpdatedVariables(conversationIdStr, varUpdates, mergedCurrentVars);

    // If client provided a custom string ID, also persist under clientConvId with mapped internal_conv_id
    if (clientConvId && clientConvId !== conversationIdStr) {
      await persistUpdatedVariables(clientConvId, varUpdates, mergedCurrentVars);
      try {
        await pool.query(
          `UPDATE assistant_conversation_states
           SET state = jsonb_set(COALESCE(state, '{}'::jsonb), '{internal_conv_id}', $1::jsonb)
           WHERE conversation_id = $2`,
          [JSON.stringify(convId), clientConvId]
        );
      } catch (_) {}
    }

    const activeVarsPrompt = formatActiveVariablesPrompt(activeVars);

    /* ---------------------------------------------------------------------- */
    /* Dynamic System Time (IST) & System Prompt Refactor                    */
    /* ---------------------------------------------------------------------- */

    // DYNAMIC SYSTEM TIME: Compute current Indian Standard Time (IST) dynamically on each request
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

    const shouldStream = body?.stream === true;

    // Check if specific agent was requested or resolve relevant active applied agent for this query
    const requestedAgentId = body?.agent_id || body?.agentId;
    let activeAgent: any = null;
    let isSpecializedRouted = false;

    if (requestedAgentId) {
      activeAgent = (await getAgentFromDb(requestedAgentId, userId)) || getAgent(requestedAgentId);
      isSpecializedRouted = Boolean(activeAgent && activeAgent.status === "active");
    } else {
      const appliedAgents = await getAppliedAgentsFromDb(userId);
      const routingDecision = resolveActiveAgentForQuery({
        userMessage: message,
        appliedAgents,
        conversationHistory,
        requestedAgentId,
      });
      activeAgent = routingDecision.selectedAgent;
      isSpecializedRouted = routingDecision.isSpecialized;
      if (routingDecision.selectedAgent) {
        console.log(
          `[AGENT_ROUTING] Query="${message.slice(0, 45)}" -> Routed to Agent "${routingDecision.selectedAgent.name}" (${routingDecision.reason})`
        );
      } else {
        console.log(
          `[AGENT_ROUTING] Query="${message.slice(0, 45)}" -> Default CreditWise Assistant (${routingDecision.reason})`
        );
      }
    }

    // Only apply active agent configuration if status is explicitly active
    const isAgentActive = Boolean(activeAgent && activeAgent.status === "active");

    if (isAgentActive && activeAgent.modes && activeAgent.modes.conversations === false) {
      const pausedReply = `Main AI Assistant Live Mode is currently paused for "${activeAgent.name}" in Agent Setup. To resume live conversations with this assistant, please enable 'Main AI Assistant Live' under Agent Modes in Setup.`;
      try {
        await pool.query(
          `INSERT INTO assistant_messages (conversation_id, role, content)
           VALUES ($1, 'assistant', $2)`,
          [convId, pausedReply]
        );
      } catch (_) {}

      if (shouldStream) {
        const encoder = new TextEncoder();
        const customStream = new TransformStream();
        const writer = customStream.writable.getWriter();
        (async () => {
          try {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "init", conversation_id: conversationIdStr })}\n\n`));
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "token", text: pausedReply })}\n\n`));
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: "done",
              message: {
                id: uid(),
                role: "ai",
                content: pausedReply,
                timestamp: nowISO(),
              },
            })}\n\n`));
          } catch (_) {
          } finally {
            await writer.close();
          }
        })();
        return new Response(customStream.readable, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      }

      return NextResponse.json({
        success: true,
        conversation_id: convId,
        message: {
          id: uid(),
          role: "ai",
          content: pausedReply,
          timestamp: nowISO(),
        },
      });
    }

    // 3. INTENT CLASSIFICATION & ROUTING LAYER:
    // Classify user query intent into POLICY, AGENT_KNOWLEDGE, or GENERAL before querying vector stores
    const retrievalRouting = classifyRetrievalIntent(message, {
      activeAgent,
      conversationHistory,
    });
    console.log(
      `[INTENT_ROUTING] Query="${message.slice(0, 45)}" | Mode=${retrievalRouting.intent} | Confidence=${retrievalRouting.confidence} | Reason="${retrievalRouting.reason}"`
    );

    // 4. DUAL-SOURCE POSTGRESQL VECTOR DB SEARCH:
    // - If POLICY: HNSW cosine similarity search across bank_policy_embeddings (23 Bank Policies)
    // - If AGENT_KNOWLEDGE: HNSW cosine similarity search across agent_knowledge_embeddings (strictly isolated by agentId)
    // - If GENERAL: Bypass strict vector document filtering and pass context directly to LLM
    const dualSourceResult = await performDualSourceRetrieval({
      query: message,
      routing: retrievalRouting,
      agentId: activeAgent?.id,
      topK: 4,
    });

    let agentKnowledgeResult: any = undefined;
    let relevantDocs: any[] = [];
    if (isAgentActive && isKnowledgeBaseAgent(activeAgent)) {
      try {
        const agentDocuments = await listAgentDocuments(activeAgent.id);
        relevantDocs = selectRelevantDocuments(message, agentDocuments, activeAgent);
        if (relevantDocs.length > 0) {
          agentKnowledgeResult = await retrieveKnowledgeChunks(message, relevantDocs, 4);
        }
      } catch (kErr) {
        console.warn("[AGENT_KNOWLEDGE_RETRIEVAL_WARN]", kErr);
      }
    }

    if (dualSourceResult.intent === "AGENT_KNOWLEDGE" && dualSourceResult.hasRelevantKnowledge) {
      if (!agentKnowledgeResult) {
        agentKnowledgeResult = {
          hasRelevantKnowledge: true,
          selectedDocuments: [],
          allRetrievedChunkIds: dualSourceResult.agentChunks.map((c) => c.id),
          groundingPrompt: dualSourceResult.groundingContext,
        };
      }
    }

    // 5. SYSTEM PROMPT & BEHAVIORAL GUIDANCE:
    // Foundational CreditWise prompt preserves all validated calculations, slot-parsing state machine, and verified policies.
    const foundationalSystemPrompt = getCreditWiseSystemPrompt(currentTime);

    // Specialized Agent Guidance Layer: Guides assistant behavior without replacing foundational business rules.
    const agentGuidanceContext = isAgentActive
      ? formatAgentGuidancePrompt(activeAgent, agentKnowledgeResult?.groundingPrompt)
      : "";

    const contextAdditions: string[] = [];
    if (activeVarsPrompt) {
      contextAdditions.push(activeVarsPrompt);
    }
    if (agentGuidanceContext) {
      contextAdditions.push(agentGuidanceContext);
    }
    if (
      dualSourceResult.hasRelevantKnowledge &&
      dualSourceResult.groundingContext &&
      !agentGuidanceContext.includes(dualSourceResult.groundingContext)
    ) {
      contextAdditions.push(dualSourceResult.groundingContext);
    }

    const systemPrompt = contextAdditions.length > 0
      ? `${foundationalSystemPrompt}\n\n${contextAdditions.join("\n\n")}`
      : foundationalSystemPrompt;

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
            activeAgent: isAgentActive ? activeAgent : undefined,
            agentKnowledgeResult,
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

          if (tokenCount > 0) {
            try {
              const approxPromptTokens = Math.max(15, Math.ceil(((systemPrompt || "").length + message.length) / 4));
              const completionTokens = tokenCount;
              await recordTokenUsage({
                agentId: isAgentActive ? activeAgent.id : "agent_loan_assistant",
                agentName: isAgentActive ? activeAgent.name : "CreditWise Assistant",
                modelName: requestedModel || process.env.OPENROUTER_MODEL || "openrouter/auto",
                promptTokens: approxPromptTokens,
                completionTokens: completionTokens,
                totalTokens: approxPromptTokens + completionTokens,
                source: "chat",
              });
            } catch (tErr) {
              console.warn("[TOKEN_LOG_WARN]", tErr);
            }
          }

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

          if (activeAgent) {
            recordConversationExchange({
              conversationId: conversationIdStr,
              agentId: activeAgent.id,
              userId,
              userMessage: message,
              assistantResponse: agentResult.reply || "",
              intent: "chat",
              toolsUsed: [],
              knowledgeDocumentsUsed: (agentKnowledgeResult?.selectedDocuments || []).map((sd: any) => ({
                id: sd.document.id,
                name: sd.document.name,
                chunkIds: sd.chunks.map((c: any) => c.id),
              })),
            }).catch((recErr) => console.warn("[RECORD_CONV_EXCHANGE_STREAM_ERR]", recErr));
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
          if (agentKnowledgeResult?.selectedDocuments?.length > 0) {
            aiMessage.used_knowledge_documents = agentKnowledgeResult.selectedDocuments.map((sd: any) => sd.document.name);
          }
          if (dualSourceResult?.sources?.length > 0) {
            aiMessage.used_knowledge_documents = Array.from(
              new Set([
                ...(aiMessage.used_knowledge_documents || []),
                ...dualSourceResult.sources.map((s) => s.name),
              ])
            );
          }
          aiMessage.retrieval_intent = retrievalRouting.intent;

          await sendEvent({
            type: "done",
            success: true,
            conversation_id: conversationIdStr,
            client_conversation_id: clientConvId || conversationIdStr,
            title: effectiveTitle,
            ai_message: aiMessage,
            message: aiMessage,
            retrieval_intent: retrievalRouting.intent,
          });
        } catch (streamErr: any) {
          console.error("Central Chat stream error:", streamErr);
          const errorMsg = isOpenRouterAuthError(streamErr)
            ? INVALID_KEY_USER_MESSAGE
            : (streamErr?.message || "Streaming failed");
          await sendEvent({
            type: "error",
            error: errorMsg,
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
      activeAgent: isAgentActive ? activeAgent : undefined,
      agentKnowledgeResult,
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

    if (agentKnowledgeResult?.selectedDocuments?.length > 0) {
      aiMessage.used_knowledge_documents = agentKnowledgeResult.selectedDocuments.map((sd: any) => sd.document.name);
    }
    if (dualSourceResult?.sources?.length > 0) {
      aiMessage.used_knowledge_documents = Array.from(
        new Set([
          ...(aiMessage.used_knowledge_documents || []),
          ...dualSourceResult.sources.map((s) => s.name),
        ])
      );
    }
    aiMessage.retrieval_intent = retrievalRouting.intent;

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

    if (activeAgent) {
      recordConversationExchange({
        conversationId: conversationIdStr,
        agentId: activeAgent.id,
        userId,
        userMessage: message,
        assistantResponse: agentResult.reply || "",
        intent: "chat",
        toolsUsed: [],
        knowledgeDocumentsUsed: (agentKnowledgeResult?.selectedDocuments || []).map((sd: any) => ({
          id: sd.document.id,
          name: sd.document.name,
          chunkIds: sd.chunks.map((c: any) => c.id),
        })),
      }).catch((recErr) => console.warn("[RECORD_CONV_EXCHANGE_NONSTREAM_ERR]", recErr));
    }

    /* ---------------------------------------------------------------------- */
    /* Return standard chat response with persistent conversation_id          */
    /* ---------------------------------------------------------------------- */

    return NextResponse.json({
      success: true,

      conversation_id: conversationIdStr,

      client_conversation_id: clientConvId || conversationIdStr,

      title: effectiveTitle || "Loan Assistant",

      ai_message: aiMessage,

      message: aiMessage,

      retrieval_intent: retrievalRouting.intent,

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

    const { isOpenRouterAuthError, INVALID_KEY_USER_MESSAGE } = await import("@/lib/ai/keyResolution");
    const isAuthErr = isOpenRouterAuthError(error);
    const errorMsg = isAuthErr
      ? INVALID_KEY_USER_MESSAGE
      : (error?.message || "Chat failed");

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      {
        status: isAuthErr ? 401 : 500,
      }
    );
  }
}
