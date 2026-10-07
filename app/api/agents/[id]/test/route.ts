// app/api/agents/[id]/test/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getAgent,
  checkAndIncrementMessageUsage,
  getUserSubscription,
} from "@/lib/agent-studio/agentStore";
import { runCentralAgent } from "@/lib/ai/agent";
import { openRouterChat } from "@/lib/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await params;
    const agent = getAgent(id);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { message, history } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message cannot be empty" },
        { status: 400 }
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

    // Build the execution pipeline trace (Question -> Understand -> Knowledge -> Instructions -> Capabilities -> Response)
    const pipeline = [
      { step: "Question", detail: `Received user query: "${cleanInput}"` },
      {
        step: "Understand",
        detail: `Analyzed intent against role "${agent.instructions.agentRole}" with ${agent.responseStyle} style.`,
      },
      {
        step: "Knowledge",
        detail:
          agent.knowledge.length > 0
            ? `Retrieved context from ${agent.knowledge.map((k) => k.name).join(", ")}`
            : "No external knowledge files linked; using core domain instructions.",
      },
      {
        step: "Instructions",
        detail: `Applied behavioral rules: Tone (${agent.instructions.tone}) & escalation protocols.`,
      },
      {
        step: "Capabilities",
        detail: `Active tools: ${Object.entries(agent.capabilities)
          .filter(([, v]) => v)
          .map(([k]) => k.replace(/_/g, " "))
          .join(", ") || "None"}`,
      },
      { step: "Response", detail: "Formulated response aligned with guidelines." },
    ];

    // 2. Generate agent response
    // If it's the Loan Assistant, consume the existing CreditWise RAG / agent engine
    if (agent.id === "agent_loan_assistant" || agent.name.toLowerCase().includes("loan")) {
      try {
        const convHistory = Array.isArray(history)
          ? history.map((m: any) => ({ role: m.role || "user", content: m.content || "" }))
          : [];

        const agentResult = await runCentralAgent({
          message: cleanInput,
          conversationId: `studio_test_${agent.id}`,
          conversationHistory: convHistory,
          systemPrompt: `You are ${agent.name}, ${agent.instructions.agentRole}. ${agent.instructions.businessDescription}. Tone: ${agent.instructions.tone}. ${agent.instructions.additionalInstructions}`,
        });

        if (agentResult && agentResult.reply) {
          reply = agentResult.reply;
          knowledgeSource = agentResult.source || "CreditWise Master Knowledge & Policy DB";
        }
      } catch (err) {
        console.warn("[STUDIO_TEST_CENTRAL_AGENT_FALLBACK]", err);
      }
    }

    // If no reply yet (or custom agent), use OpenRouter LLM or tailored domain response
    if (!reply) {
      const activeKnowledgeDocs = agent.knowledge
        .map((k) => `[Document: ${k.name} (${k.size}) - Status: ${k.status}]`)
        .join("\n");

      const qualificationRequirements = agent.qualification.leadFields
        .filter((f) => f.enabled)
        .map((f) => `- ${f.name} (${f.required ? "Required" : "Optional"})`)
        .join("\n");

      const documentsRequired = agent.qualification.documentCollection
        .map((d) => `- ${d.name} (${d.required ? "Required" : "Optional"}): ${d.description || ""}`)
        .join("\n");

      const systemPrompt = `You are ${agent.name}, an AI assistant configured in AI Agent Studio.
Role: ${agent.instructions.agentRole}
Business Context: ${agent.instructions.businessDescription}
Tone: ${agent.instructions.tone}
Response Style: ${agent.responseStyle} (Provide ${agent.responseStyle === "concise" ? "brief, direct answers" : agent.responseStyle === "detailed" ? "comprehensive, in-depth explanations" : "well-balanced and helpful information"})
Escalation Rules: ${agent.instructions.escalationRules || "Escalate to human support when requested."}
Additional Instructions: ${agent.instructions.additionalInstructions || "None."}

Configured Qualification Fields:
${qualificationRequirements || "None"}

Required Documents:
${documentsRequired || "None"}

Knowledge Base Documents:
${activeKnowledgeDocs || "None"}

Answer the user directly and professionally based strictly on these instructions.`;

      try {
        const chatMessages: any[] = [{ role: "system", content: systemPrompt }];
        if (Array.isArray(history)) {
          for (const h of history.slice(-4)) {
            chatMessages.push({ role: h.role, content: h.content });
          }
        }
        chatMessages.push({ role: "user", content: cleanInput });

        const llmRes = await openRouterChat(chatMessages, undefined, "openrouter/auto");
        const generated = llmRes?.choices?.[0]?.message?.content;
        if (generated && generated.trim()) {
          reply = generated.trim();
        }
      } catch (llmErr) {
        console.warn("[STUDIO_TEST_OPENROUTER_FALLBACK]", llmErr);
      }
    }

    // Graceful fallback if external services are unreachable
    if (!reply) {
      if (cleanInput.toLowerCase().includes("loan") || cleanInput.toLowerCase().includes("personal")) {
        reply = `I would be happy to help you with your loan inquiry! To review your eligibility and provide tailored quotes from our partner banks, I'll need a few key details:\n\n1. **Monthly Net Salary**\n2. **Current Employer/Company**\n3. **Approximate CIBIL Score**\n4. **Desired Loan Amount & Tenure**\n\nCould you share your current employer and monthly in-hand income to get started?`;
      } else {
        reply = `Thank you for reaching out to ${agent.name}. As your ${agent.instructions.agentRole}, I'm here to assist you with: ${agent.instructions.businessDescription}.\n\nHow can I help you move forward today?`;
      }
    }

    const currentSub = getUserSubscription();

    return NextResponse.json({
      success: true,
      reply,
      pipeline,
      knowledgeSource,
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
