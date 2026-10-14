// app/api/agents/[id]/test/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getAgent,
  checkAndIncrementMessageUsage,
  getUserSubscription,
} from "@/lib/agent-studio/agentStore";
import { runCentralAgent } from "@/lib/ai/agent";
import { openRouterChat } from "@/lib/openrouter";
import { listAgentDocuments, recordConversationExchange, getAgentFromDb, recordTokenUsage } from "@/lib/agent-studio/dbStore";
import {
  selectRelevantDocuments,
  retrieveKnowledgeChunks,
  validateAgentResponse,
  buildConfiguredAgentPrompt,
} from "@/lib/agent-studio/ragEngine";
import { getActiveLlmModelName } from "@/lib/ai/modelRouter";
import { verifyToken } from "@/lib/auth";
import { calculateEmi, formatEmiResult } from "@/lib/eligibilityWizard";
import { parseFinancialAmount } from "@/lib/dynamicEligibilityEngine";
import { generateKnowledgeGroundedReply } from "@/lib/agent-studio/groundedAnswerEngine";

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
    let recordedTokenUsage: any = null;

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

    // 4. Intent detection & RAG context setup
    const isLoanQuery = /loan|emi|cibil|credit|interest|eligib/i.test(cleanInput);
    const userRequestedNoDocs =
      /do not use (any )?(uploaded )?(documents|knowledge|files)/i.test(cleanInput) ||
      /without (using )?(any )?(uploaded )?(documents|knowledge|files)/i.test(cleanInput) ||
      /don't use (any )?(uploaded )?(documents|knowledge|files)/i.test(cleanInput);

    const currentTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const effectiveRagResult = userRequestedNoDocs
      ? { hasRelevantKnowledge: false, selectedDocuments: [], allRetrievedChunkIds: [], groundingPrompt: "" }
      : ragResult;

    // Check for EMI Calculation capability
    const isEmiCalcQuery =
      /(?:calculate\s+(?:the\s+)?emi|emi\s+for|what\s+is\s+(?:the\s+)?emi|compute\s+(?:the\s+)?emi)\b/i.test(cleanInput);

    let parsedPrincipal: number | undefined;
    let parsedRate: number | undefined;
    let parsedTenureMonths: number | undefined;

    if (agent.capabilities?.calculate_emi !== false && isEmiCalcQuery) {
      const curMatch = cleanInput.match(/(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|crores?))?)/i);
      const unitMatch = cleanInput.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|cr|crores?)\b/i);
      const loanMatch = cleanInput.match(/(?:loan|amount|borrow)\s*(?:of|for)?\s*(?:a\s*)?(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)/i);

      if (curMatch) {
        parsedPrincipal = parseFinancialAmount(curMatch[1]) || undefined;
      } else if (unitMatch) {
        parsedPrincipal = parseFinancialAmount(unitMatch[0]) || undefined;
      } else if (loanMatch) {
        parsedPrincipal = parseFinancialAmount(loanMatch[1]) || undefined;
      }
      const rateMatch = cleanInput.match(/(\d+(?:\.\d+)?)\s*%/);
      if (rateMatch) {
        parsedRate = parseFloat(rateMatch[1]);
      }
      const tenureYearMatch = cleanInput.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
      if (tenureYearMatch) {
        parsedTenureMonths = Math.round(parseFloat(tenureYearMatch[1]) * 12);
      } else {
        const monthMatch = cleanInput.match(/(\d+)\s*(?:months?|m\b)/i);
        if (monthMatch) {
          parsedTenureMonths = parseInt(monthMatch[1], 10);
        }
      }
    }

    if (
      agent.capabilities?.calculate_emi !== false &&
      isEmiCalcQuery &&
      parsedPrincipal &&
      parsedPrincipal > 0
    ) {
      const effectiveRate = parsedRate && parsedRate > 0 ? parsedRate : 10.5;
      const effectiveTenure = parsedTenureMonths && parsedTenureMonths > 0 ? parsedTenureMonths : 12;
      const monthlyEmi = calculateEmi(parsedPrincipal, effectiveRate, effectiveTenure);
      reply = formatEmiResult({ principal: parsedPrincipal, rate: effectiveRate, tenure: effectiveTenure }, monthlyEmi);
      knowledgeSource = "Financial Calculation Engine";
      toolsUsed.push("calculate_emi");
      pipeline.push({
        step: "Tool Execution",
        detail: `Executed emiCalculatorTool using standard financial formula for ₹${parsedPrincipal.toLocaleString("en-IN")} at ${effectiveRate}% over ${effectiveTenure} months.`,
      });
    } else {
      // Generate agent response using configured LLM
      let basePrompt = buildConfiguredAgentPrompt(agent, currentTime, effectiveRagResult);
      if (userRequestedNoDocs) {
        basePrompt += `\n\n### USER CONSTRAINT OVERRIDE:\nThe user explicitly instructed: "Do not use uploaded documents". Do NOT cite, reference, or use any uploaded documents or loan files. Answer the user query directly and accurately using your general knowledge and intelligence.`;
      }
      if (!isLoanQuery) {
        basePrompt += `\n\n### GENERAL QUERY DIRECTIVE:\nThis query is not a personal loan application or loan policy lookup. Answer the question directly and accurately using your general knowledge. Follow all user formatting requirements (such as exact bullet point counts). Do NOT force loan rules, TCS, or personal financial questionnaires into the response.`;
      }

      try {
        const chatMessages: any[] = [{ role: "system", content: basePrompt }];
        if (Array.isArray(history)) {
          for (const h of history.slice(-6)) {
            if (h && h.role && h.content) {
              chatMessages.push({ role: h.role, content: h.content });
            }
          }
        }
        chatMessages.push({ role: "user", content: cleanInput });

        const activeModelName = await getActiveLlmModelName();
        const llmRes = await openRouterChat(chatMessages, undefined, activeModelName);
        const generated = llmRes?.choices?.[0]?.message?.content;

        if (llmRes?.usage) {
          recordedTokenUsage = {
            promptTokens: Number(llmRes.usage.prompt_tokens || 0),
            completionTokens: Number(llmRes.usage.completion_tokens || 0),
            totalTokens: Number(llmRes.usage.total_tokens || 0),
            modelName: activeModelName,
          };
          await recordTokenUsage({
            agentId: agent.id,
            agentName: agent.name,
            modelName: activeModelName,
            promptTokens: recordedTokenUsage.promptTokens,
            completionTokens: recordedTokenUsage.completionTokens,
            totalTokens: recordedTokenUsage.totalTokens,
            source: "playground",
          });
        }

        if (generated && generated.trim()) {
          // Check if LLM emitted a tool call JSON for EMI Calculator
          let toolCallData: any = null;
          try {
            const trimmedGen = generated.trim();
            if (trimmedGen.startsWith("{") && trimmedGen.endsWith("}")) {
              const parsed = JSON.parse(trimmedGen);
              if (parsed.tool === "EMI Calculator" || parsed.tool === "calculate_emi") {
                toolCallData = parsed;
              }
            }
          } catch {}

          if (toolCallData && agent.capabilities?.calculate_emi !== false) {
            const tPrincipal = Number(toolCallData.parameters?.principal || 0);
            const tRate = Number(toolCallData.parameters?.annualRate ?? toolCallData.parameters?.rate ?? 10.5);
            const tTenure = Number(toolCallData.parameters?.tenureMonths ?? toolCallData.parameters?.tenure ?? 12);
            if (tPrincipal > 0) {
              const monthlyEmi = calculateEmi(tPrincipal, tRate, tTenure);
              reply = formatEmiResult({ principal: tPrincipal, rate: tRate, tenure: tTenure }, monthlyEmi);
              knowledgeSource = "Financial Calculation Engine";
              toolsUsed.push("calculate_emi");
              pipeline.push({
                step: "Tool Execution",
                detail: `Executed emiCalculatorTool via LLM tool call for ₹${tPrincipal.toLocaleString("en-IN")} at ${tRate}% over ${tTenure} months.`,
              });
            } else {
              reply = generated.trim();
            }
          } else {
            reply = generated.trim();
            if (!userRequestedNoDocs && effectiveRagResult.hasRelevantKnowledge && relevantDocs.length > 0) {
              knowledgeSource = relevantDocs.map((d) => d.name).join(", ");
              toolsUsed.push("Uploaded Knowledge Base RAG");
            } else {
              knowledgeSource = "General Knowledge";
            }
          }
        }
      } catch (llmErr: any) {
        console.warn("[STUDIO_TEST_OPENROUTER_ERROR]", llmErr);
        const errStr = String(llmErr?.message || "");
        const isRateLimit = errStr.includes("429") || errStr.toLowerCase().includes("rate limit");

        // Fallback to deterministic Knowledge-Grounded Synthesis if LLM rate limits (HTTP 429) or fails
        if (!userRequestedNoDocs && effectiveRagResult.hasRelevantKnowledge && relevantDocs.length > 0) {
          const allRetrievedChunks = effectiveRagResult.selectedDocuments.flatMap((d: any) => d.chunks || []);
          const groundedResult = generateKnowledgeGroundedReply(cleanInput, agent, relevantDocs, allRetrievedChunks);
          if (groundedResult && groundedResult.reply) {
            reply = groundedResult.reply;
            knowledgeSource = relevantDocs.map((d) => d.name).join(", ");
            toolsUsed.push("Uploaded Knowledge Base RAG");
            pipeline.push({
              step: "Knowledge-Grounded Synthesis (Fallback)",
              detail: `Synthesized answer directly from verified knowledge document (${knowledgeSource}) following LLM rate limit fallback.`,
            });
          }
        }

        if (!reply) {
          if (isRateLimit) {
            reply = "The OpenRouter daily free-tier limit (50 requests/day) has been reached for the configured API key. Please add credits to your OpenRouter account or configure an active model key under AI Model settings.";
          } else {
            const errMsg = llmErr?.message || "LLM request failed";
            reply = `[Error: Unable to generate response from configured AI model - ${errMsg}]. Please verify your API key and model configuration.`;
          }
        }
      }
    }

    if (!reply) {
      reply = "Unable to generate a response from the configured model. Please check the AI model configuration.";
    }

    // 5. Response Validation (Section 16)
    const validation = validateAgentResponse(
      reply,
      cleanInput,
      agent,
      effectiveRagResult.selectedDocuments
    );
    const finalReply = validation.sanitizedResponse;

    // 6. Record Conversation & Knowledge Usage in Database (Section 12 & 13)
    const convId = conversationId || `studio_conv_${agent.id}_${Date.now().toString().slice(-6)}`;
    const usedDocsMetadata = (!userRequestedNoDocs && effectiveRagResult.hasRelevantKnowledge)
      ? effectiveRagResult.selectedDocuments.map((ctx: any) => ({
          id: ctx.document.id,
          name: ctx.document.name,
          chunkIds: ctx.chunks.map((c: any) => c.id),
        }))
      : [];

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
      usedKnowledgeDocuments: usedDocsMetadata.map((d: any) => d.name),
      debug,
      tokenUsage: recordedTokenUsage,
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
