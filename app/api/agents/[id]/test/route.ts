// app/api/agents/[id]/test/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getAgent,
  checkAndIncrementMessageUsage,
  getUserSubscription,
} from "@/lib/agent-studio/agentStore";
import { runCentralAgent } from "@/lib/ai/agent";
import { openRouterChat } from "@/lib/openrouter";
import { listAgentDocuments, recordConversationExchange, getAgentFromDb } from "@/lib/agent-studio/dbStore";
import {
  selectRelevantDocuments,
  retrieveKnowledgeChunks,
  validateAgentResponse,
  buildConfiguredAgentPrompt,
} from "@/lib/agent-studio/ragEngine";
import { generateKnowledgeGroundedReply } from "@/lib/agent-studio/groundedAnswerEngine";

import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.cookies.get("token")?.value || req.cookies.get("auth_token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    const userId = payload?.id && Number.isFinite(Number(payload.id)) ? Number(payload.id) : undefined;

    const agent = (await getAgentFromDb(id, userId)) || (userId ? null : getAgent(id));
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found or access denied" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { message, history, conversationId } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message cannot be empty" },
        { status: 400 }
      );
    }

    // 0. Check if Test Agent Demo mode is enabled
    if (agent.modes && agent.modes.aiAgentMode === false) {
      return NextResponse.json(
        {
          success: false,
          error: "Test Agent Demo mode is disabled in Setup. Please enable 'Test Agent Demo' to test the AI agent on this playground.",
        },
        { status: 403 }
      );
    }

    // 1. Check & increment test message usage
    const usageCheck = checkAndIncrementMessageUsage(agent.id);

    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          limitReached: true,
          error: "You've reached your free testing limit.",
          usage: {
            messagesUsed: usageCheck.messagesUsed,
            maxMessages: usageCheck.maxMessages,
            remaining: usageCheck.remaining,
            limitReached: true,
            nearLimit: false,
          },
        },
        { status: 403 }
      );
    }

    const cleanInput = message.trim();
    let reply = "";
    let knowledgeSource = "Agent Knowledge Base";
    const toolsUsed: string[] = [];

    // 2. Fetch connected agent documents from Database (Section 10)
    const agentDocuments = await listAgentDocuments(agent.id);
    const relevantDocs = selectRelevantDocuments(cleanInput, agentDocuments);

    // 3. Perform RAG Retrieval against relevant documents
    const ragResult = await retrieveKnowledgeChunks(cleanInput, relevantDocs);

    // Build execution pipeline trace
    const pipeline = [
      { step: "Question", detail: `Received user query: "${cleanInput}"` },
      {
        step: "Intent",
        detail: `Evaluated against role "${agent.generalInstructions?.role || agent.instructions.agentRole}" (Style: ${agent.responseStyle}).`,
      },
      {
        step: "Knowledge Selection",
        detail:
          relevantDocs.length > 0
            ? `Identified ${relevantDocs.length} relevant document(s): ${relevantDocs.map((d) => d.name).join(", ")}.`
            : agentDocuments.length > 0
            ? "No specific document matched query filter; checking general knowledge."
            : "No uploaded documents; using general domain policies.",
      },
      {
        step: "Document Instructions",
        detail:
          relevantDocs.some((d) => d.instruction?.instructionText)
            ? `Applied document-specific instructions for ${relevantDocs.filter((d) => d.instruction).map((d) => d.name).join(", ")}.`
            : "Default document handling.",
      },
      {
        step: "Guardrails",
        detail: `Global guardrails active (Hallucination protection: ${agent.globalGuardrails?.preventHallucinations !== false ? "ON" : "OFF"}, System prompt shield: ON).`,
      },
      {
        step: "Tools / Capabilities",
        detail: `Active tools: ${Object.entries(agent.capabilities)
          .filter(([, v]) => v)
          .map(([k]) => k.replace(/_/g, " "))
          .join(", ") || "General LLM"}`,
      },
      { step: "Response Validation", detail: "Validated against anti-hallucination and security boundaries." },
    ];

    // 4. Generate agent response strictly grounded on the uploaded knowledge base as per instruction
    const hasUploadedDocs = agentDocuments.length > 0;
    const isLoanQuery = /loan|emi|cibil|credit|interest|eligib/i.test(cleanInput);

    if (hasUploadedDocs) {
      // Ground strictly on the uploaded knowledge documents
      const basePrompt = buildConfiguredAgentPrompt(agent, new Date().toLocaleString(), ragResult);
      const docNamesList = agentDocuments.map((d) => `"${d.name}"`).join(", ");
      const strictKnowledgePrompt = `${basePrompt}

### MANDATORY KNOWLEDGE BOUNDARY & TESTING INSTRUCTION:
1. You are running in the Test Agent Demo for "${agent.name}".
2. You must ONLY answer testing questions that are DIRECTLY RELATED to the uploaded knowledge base document(s): ${docNamesList}.
3. The uploaded knowledge base contains the ONLY authorized information you have access to.
4. If the user's query asks about anything NOT covered in or NOT related to the uploaded knowledge base (such as external banks, policies, or general topics not documented in ${docNamesList}):
   You MUST politely decline and respond:
   "Based on the uploaded knowledge base (${docNamesList}), this information is not covered. In this test demo, I am configured to only answer questions strictly related to the uploaded knowledge base as per your agent instructions. Please ask a question related to ${docNamesList}."
5. Never assume, fabricate, or incorporate external data outside the uploaded knowledge base.
6. Strictly adhere to the configured Agent Goal, Guardrails, and Persona at all times.`;

      try {
        const chatMessages: any[] = [{ role: "system", content: strictKnowledgePrompt }];
        if (Array.isArray(history)) {
          for (const h of history.slice(-6)) {
            chatMessages.push({ role: h.role, content: h.content });
          }
        }
        chatMessages.push({ role: "user", content: cleanInput });

        const llmRes = await openRouterChat(chatMessages, undefined, "openrouter/auto");
        const generated = llmRes?.choices?.[0]?.message?.content;
        if (generated && generated.trim()) {
          reply = generated.trim();
          knowledgeSource = relevantDocs.length > 0
            ? relevantDocs.map((d) => d.name).join(", ")
            : agentDocuments.map((d) => d.name).join(", ");
          toolsUsed.push("Uploaded Knowledge Base RAG");
        }
      } catch (llmErr) {
        console.warn("[STUDIO_TEST_OPENROUTER_FALLBACK]", llmErr);
      }

      const flattenedChunks = ragResult.selectedDocuments.flatMap((d) => d.chunks);
      const groundedEvaluation = generateKnowledgeGroundedReply(
        cleanInput,
        agent,
        agentDocuments,
        flattenedChunks
      );

      // If query is out of scope for the uploaded documents, enforce strict boundary
      if (!groundedEvaluation.isInScope) {
        reply = groundedEvaluation.reply;
        knowledgeSource = agentDocuments.map((d) => d.name).join(", ");
      } else if (!reply) {
        // Grounded fallback if LLM is offline or returned empty
        reply = groundedEvaluation.reply;
        knowledgeSource = agentDocuments.map((d) => d.name).join(", ");
        toolsUsed.push("Uploaded Knowledge Base RAG");
      }
    } else {
      // If no knowledge documents are uploaded yet, inform the user clearly
      const lower = cleanInput.toLowerCase();
      if (lower.startsWith("hi") || lower.startsWith("hello") || lower.startsWith("hey")) {
        reply = `Hello! I'm your **${agent.name}** 👋\n\nTo test my responses grounded in your specific policies, please upload a knowledge document (e.g. .txt, .pdf, .docx) under **AI Instructions**.\n\nMy currently configured goal is: *${agent.goal || agent.instructions?.businessDescription}*. How can I help you get started?`;
      } else {
        reply = `No knowledge base documents have been uploaded for **${agent.name}** yet.\n\nTo test my answers against your specific bank or organization policies, please upload your policy document under **AI Instructions**.\n\n*(Currently operating under agent instructions & goal: "${agent.goal || agent.instructions?.businessDescription}")*`;
      }
      knowledgeSource = "No documents uploaded";
    }

    // 5. Response Validation (Section 16)
    const validation = validateAgentResponse(
      reply,
      cleanInput,
      agent,
      ragResult.selectedDocuments
    );
    const finalReply = validation.sanitizedResponse;

    // 6. Record Conversation & Knowledge Usage in Database (Section 12 & 13)
    const convId = conversationId || `studio_conv_${agent.id}_${Date.now().toString().slice(-6)}`;
    const usedDocsMetadata = ragResult.selectedDocuments.map((ctx) => ({
      id: ctx.document.id,
      name: ctx.document.name,
      chunkIds: ctx.chunks.map((c) => c.id),
    }));

    recordConversationExchange({
      conversationId: convId,
      agentId: agent.id,
      userMessage: cleanInput,
      assistantResponse: finalReply,
      intent: isLoanQuery ? "loan_inquiry" : "general_inquiry",
      toolsUsed,
      knowledgeDocumentsUsed: usedDocsMetadata,
    }).catch((recErr) => {
      console.warn("[CONVERSATION_RECORDING_ERROR]", recErr);
    });

    const currentSub = getUserSubscription();

    const debug = {
      agentName: agent.name,
      operationalMode: agent.operationalMode || "standard",
      knowledgeFiles: agentDocuments.map((d) => d.name),
      chunksRetrieved: ragResult.selectedDocuments.flatMap((d) => d.chunks).length,
      documentInstructionsApplied: relevantDocs.some((d) => d.instruction?.instructionText),
      guardrailsApplied: true,
      toolsUsed,
      productionDataUsed: false,
    };

    return NextResponse.json({
      success: true,
      reply: finalReply,
      pipeline,
      knowledgeSource,
      conversationId: convId,
      usedKnowledgeDocuments: usedDocsMetadata.map((d) => d.name),
      debug,
      usage: {
        messagesUsed: usageCheck.messagesUsed,
        maxMessages: usageCheck.maxMessages,
        remaining: usageCheck.remaining,
        limitReached: usageCheck.limitReached,
        nearLimit: usageCheck.nearLimit,
      },
      subscription: currentSub,
    });
  } catch (error: any) {
    console.error("[API_AGENT_TEST_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to process test message" },
      { status: 500 }
    );
  }
}
