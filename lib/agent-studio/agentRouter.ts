// lib/agent-studio/agentRouter.ts
/**
 * Lightweight Intent-Based Agent Studio Router
 * 
 * Routes incoming messages to the most relevant active and applied Agent Studio agent
 * without running extra LLM calls or disrupting existing central assistant business logic.
 * 
 * Follows Phases 5, 6, 7, and 8 of CreditWise specifications.
 */

import { Agent } from "./types";
import { detectLoanCategory } from "@/lib/ai/intentRouting";

export interface AgentRoutingOptions {
  userMessage: string;
  appliedAgents: Agent[];
  conversationHistory?: Array<{ role: string; content: string }>;
  requestedAgentId?: string;
}

export interface AgentRoutingDecision {
  selectedAgent: Agent | null;
  reason: string;
  isSpecialized: boolean;
  routingConfidence: number;
}

const PURE_GREETING_REGEX =
  /^(?:hi|hello|hey|good\s*(?:morning|afternoon|evening|night)|howdy|greetings|namaste|sup|yo|hola)(?:[\s,.!]+.*)?$/i;

const PLEASANTRY_REGEX =
  /^(?:thank\s*you|thanks|ok|okay|got\s*it|great|cool|awesome|bye|goodbye|see\s*you|sure|fine)(?:[\s,.!]+.*)?$/i;

const EDUCATION_LOAN_KEYWORDS = [
  "education loan",
  "educational loan",
  "student loan",
  "study loan",
  "study abroad",
  "higher education",
  "college fee",
  "college fees",
  "university fee",
  "tuition fee",
  "tuition fees",
  "course fee",
  "gre",
  "toefl",
  "ielts",
  "masters in",
  "bachelors in",
];

const COMPANY_CATEGORY_KEYWORDS = [
  "company category",
  "company categories",
  "company tier",
  "corporate tier",
  "employer category",
  "employer tier",
  "super cat",
  "cat a",
  "cat b",
  "cat c",
  "cat d",
  "listed company",
  "unlisted company",
  "category of",
  "tier of",
  "company listing",
  "is my company listed",
];

const HOME_LOAN_KEYWORDS = [
  "home loan",
  "housing loan",
  "mortgage",
  "property loan",
  "lap",
  "loan against property",
  "plot loan",
  "home construction loan",
];

export function isPureGreeting(text: string): boolean {
  const trimmed = (text || "").trim();
  if (!trimmed) return false;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 6) return false;
  return PURE_GREETING_REGEX.test(trimmed) || PLEASANTRY_REGEX.test(trimmed);
}

/**
 * Resolves the single most relevant active, applied agent for an incoming query.
 * Deterministic and zero-overhead: does NOT make separate LLM calls.
 */
export function resolveActiveAgentForQuery(
  options: AgentRoutingOptions
): AgentRoutingDecision {
  const { userMessage, appliedAgents, conversationHistory, requestedAgentId } = options;
  const text = (userMessage || "").trim();
  const lower = text.toLowerCase();

  // 1. If explicit agent requested by client (e.g. UI agent selector or test session)
  if (requestedAgentId) {
    const explicitMatch = appliedAgents.find(
      (a) => a.id === requestedAgentId && a.status === "active"
    );
    if (explicitMatch) {
      return {
        selectedAgent: explicitMatch,
        reason: `Explicitly requested agent: ${explicitMatch.name}`,
        isSpecialized: true,
        routingConfidence: 1.0,
      };
    }
  }

  // Filter only active and applied agents
  const eligibleAgents = (appliedAgents || []).filter((a) => {
    if (a.status !== "active") return false;
    const isApplied =
      a.appliedToAssistant === true ||
      (a.modes && a.modes.conversations === true);
    return isApplied;
  });

  if (eligibleAgents.length === 0) {
    return {
      selectedAgent: null,
      reason: "No active applied agents configured.",
      isSpecialized: false,
      routingConfidence: 1.0,
    };
  }

  // 2. Pure greetings & pleasantries -> Default assistant unless a dedicated Greeting Assistant is applied
  if (isPureGreeting(text)) {
    const greetingAgent = eligibleAgents.find((a) => {
      const name = (a.name || "").toLowerCase();
      const role = String(
        a.generalInstructions?.role || a.instructions?.agentRole || ""
      ).toLowerCase();
      const topics = (a.supportedTopics || []).map((t) => t.toLowerCase());
      return (
        name.includes("greeting") ||
        name.includes("welcome") ||
        role.includes("greeting") ||
        role.includes("welcome") ||
        topics.includes("greeting")
      );
    });

    if (greetingAgent) {
      return {
        selectedAgent: greetingAgent,
        reason: `Routed greeting to dedicated Greeting Assistant: ${greetingAgent.name}`,
        isSpecialized: true,
        routingConfidence: 0.95,
      };
    }

    // Default lightweight path for greetings
    return {
      selectedAgent: null,
      reason: "Pure greeting on default lightweight response path without specialized agent overhead.",
      isSpecialized: false,
      routingConfidence: 0.98,
    };
  }

  // 3. Education Loan routing
  const detectedCat = detectLoanCategory(text);
  const isEduQuery =
    detectedCat === "EDUCATION_LOAN" ||
    EDUCATION_LOAN_KEYWORDS.some((kw) => lower.includes(kw));

  if (isEduQuery) {
    const eduAgent = eligibleAgents.find((a) => {
      const name = (a.name || "").toLowerCase();
      const role = String(
        a.generalInstructions?.role || a.instructions?.agentRole || ""
      ).toLowerCase();
      const goal = (a.goal || "").toLowerCase();
      const topics = (a.supportedTopics || []).map((t) => t.toLowerCase());
      return (
        topics.some((t) => t.includes("education") || t.includes("student")) ||
        name.includes("education") ||
        name.includes("student") ||
        role.includes("education") ||
        role.includes("student") ||
        goal.includes("education loan")
      );
    });

    if (eduAgent) {
      return {
        selectedAgent: eduAgent,
        reason: `Matched Education Loan query to specialized agent: ${eduAgent.name}`,
        isSpecialized: true,
        routingConfidence: 0.95,
      };
    }
  }

  // 4. Company Category routing
  const isCompanyCategoryQuery =
    COMPANY_CATEGORY_KEYWORDS.some((kw) => lower.includes(kw)) ||
    (/\b(?:what\s+(?:is\s+)?(?:the\s+)?cat(?:egory)?|which\s+cat(?:egory)?|is\s+\w+\s+(?:cat\s*[a-e]|listed))\b/i.test(text));

  if (isCompanyCategoryQuery) {
    const compAgent = eligibleAgents.find((a) => {
      const name = (a.name || "").toLowerCase();
      const role = String(
        a.generalInstructions?.role || a.instructions?.agentRole || ""
      ).toLowerCase();
      const topics = (a.supportedTopics || []).map((t) => t.toLowerCase());
      return (
        topics.some((t) => t.includes("company") || t.includes("category")) ||
        name.includes("company") ||
        role.includes("company") ||
        name.includes("corporate") ||
        role.includes("corporate")
      );
    });

    if (compAgent) {
      return {
        selectedAgent: compAgent,
        reason: `Matched Company Category query to specialized agent: ${compAgent.name}`,
        isSpecialized: true,
        routingConfidence: 0.95,
      };
    }
  }

  // 5. Home Loan / Mortgage routing
  const isHomeLoanQuery =
    detectedCat === "HOME_LOAN" ||
    HOME_LOAN_KEYWORDS.some((kw) => lower.includes(kw));

  if (isHomeLoanQuery) {
    const homeLoanAgent = eligibleAgents.find((a) => {
      const name = (a.name || "").toLowerCase();
      const role = String(
        a.generalInstructions?.role || a.instructions?.agentRole || ""
      ).toLowerCase();
      const topics = (a.supportedTopics || []).map((t) => t.toLowerCase());
      return (
        topics.some((t) => t.includes("home") || t.includes("mortgage")) ||
        name.includes("home loan") ||
        name.includes("mortgage") ||
        role.includes("home loan") ||
        role.includes("mortgage")
      );
    });

    if (homeLoanAgent) {
      return {
        selectedAgent: homeLoanAgent,
        reason: `Matched Home Loan query to specialized agent: ${homeLoanAgent.name}`,
        isSpecialized: true,
        routingConfidence: 0.95,
      };
    }
  }

  // 6. Custom Supported Topics keyword matching
  for (const agent of eligibleAgents) {
    if (agent.supportedTopics && agent.supportedTopics.length > 0) {
      for (const topic of agent.supportedTopics) {
        const cleanTopic = topic.toLowerCase().trim();
        if (cleanTopic && lower.includes(cleanTopic)) {
          return {
            selectedAgent: agent,
            reason: `Matched agent custom supported topic: "${cleanTopic}"`,
            isSpecialized: true,
            routingConfidence: 0.9,
          };
        }
      }
    }
  }

  // 7. Contextual Thread Continuity:
  // If recent turns in conversation discussed education loans, keep the education loan agent active for follow-ups
  if (conversationHistory && conversationHistory.length >= 2) {
    const recentTurns = conversationHistory.slice(-6);
    const hasEduContext = recentTurns.some((t) =>
      /\b(?:education(?:al)?\s*loan|student\s*loan|study\s*loan|tuition|course\s*fee|moratorium|hdfc\s*credila|sbi\s*education|sbi\b)/i.test(t.content)
    );
    if (hasEduContext) {
      const eduAgent = eligibleAgents.find((a) => {
        const name = (a.name || "").toLowerCase();
        const topics = (a.supportedTopics || []).map((t) => t.toLowerCase());
        return name.includes("education") || topics.some((t) => t.includes("education"));
      });
      if (eduAgent) {
        const isFollowUp =
          text.split(/\s+/).length <= 25 &&
          !/^(check\s+my\s+loan|i\s+want\s+a\s+personal\s+loan|apply\s+personal\s+loan|start\s+new)\b/i.test(text);
        if (isFollowUp) {
          return {
            selectedAgent: eduAgent,
            reason: `Preserved conversation thread continuity for active agent: ${eduAgent.name}`,
            isSpecialized: true,
            routingConfidence: 0.95,
          };
        }
      }
    }

    const lastAssistantTurn = [...conversationHistory]
      .reverse()
      .find((t) => t.role === "assistant" || t.role === "ai");

    if (lastAssistantTurn && lastAssistantTurn.content) {
      const lastText = lastAssistantTurn.content.toLowerCase();
      for (const agent of eligibleAgents) {
        const agentNameLower = (agent.name || "").toLowerCase().trim();
        const nameWords = agentNameLower.split(/\s+/).filter((w) => w.length > 3);
        const nameMatches = nameWords.length > 0 && nameWords.some((w) => lastText.includes(w));
        if (
          agentNameLower &&
          agentNameLower !== "creditwise assistant" &&
          (lastText.includes(agentNameLower) || nameMatches)
        ) {
          // If the user's message is an ongoing inquiry / follow-up
          const isFollowUp =
            text.split(/\s+/).length <= 15 &&
            !/^(check\s+my\s+loan|i\s+want\s+a\s+personal\s+loan|apply\s+loan|start\s+new)\b/i.test(text);

          if (isFollowUp) {
            return {
              selectedAgent: agent,
              reason: `Preserved conversation thread continuity for active agent: ${agent.name}`,
              isSpecialized: true,
              routingConfidence: 0.88,
            };
          }
        }
      }
    }
  }

  // 7b. Applied Education Loan Agent Parameter Matching (e.g. SBI CIBIL/Docs or unuploaded bank queries)
  const eduAgent = eligibleAgents.find((a) => {
    const name = (a.name || "").toLowerCase();
    const topics = (a.supportedTopics || []).map((t) => t.toLowerCase());
    return name.includes("education") || topics.some((t) => t.includes("education"));
  });
  if (eduAgent) {
    const isEduParamQuery =
      /\b(?:education|student\s*loan|study|tuition|moratorium)\b/i.test(text) ||
      (/\b(?:sbi|moon\s*bank)\b/i.test(text) && /\b(?:interest|rate|cibil|document|documents|collateral|repayment)\b/i.test(text));
    if (isEduParamQuery) {
      return {
        selectedAgent: eduAgent,
        reason: `Matched education loan parameters to applied agent: ${eduAgent.name}`,
        isSpecialized: true,
        routingConfidence: 0.92,
      };
    }
  }

  // 8. General Loan / Underwriting Agent (if user is checking eligibility and an underwriter agent is applied)
  const isLoanEligibilityQuery =
    /\b(?:loan\s*eligib|check\s*eligib|am\s*i\s*eligible|personal\s*loan|need\s*loan|apply\s*for\s*loan|borrow\s*money|interest\s*rate|loan\s*amount)\b/i.test(text);

  if (isLoanEligibilityQuery) {
    const underwriterAgent = eligibleAgents.find((a) => {
      const name = (a.name || "").toLowerCase();
      const role = String(
        a.generalInstructions?.role || a.instructions?.agentRole || ""
      ).toLowerCase();
      // Exclude education-only or home-loan-only agents from capturing personal loan flow
      const isSpecificOther =
        name.includes("education") ||
        name.includes("mortgage") ||
        name.includes("home loan") ||
        name.includes("greeting");
      return (
        !isSpecificOther &&
        (name.includes("loan") ||
          name.includes("underwrit") ||
          role.includes("underwrit") ||
          role.includes("loan") ||
          name.includes("specialist"))
      );
    });

    if (underwriterAgent) {
      return {
        selectedAgent: underwriterAgent,
        reason: `Matched loan inquiry to active underwriter agent: ${underwriterAgent.name}`,
        isSpecialized: true,
        routingConfidence: 0.85,
      };
    }
  }

  // 9. Default: No specialized agent needed -> standard CreditWise Assistant handles the query
  return {
    selectedAgent: null,
    reason: "No specialized agent matched; using standard CreditWise Assistant without extra context.",
    isSpecialized: false,
    routingConfidence: 0.8,
  };
}

/**
 * Formats the specialized Agent Guidance Layer to be injected into the system prompt.
 * Keeps existing central business rules, calculations, and safety authoritative.
 */
export function formatAgentGuidancePrompt(
  agent: Agent,
  knowledgePrompt?: string
): string {
  const role =
    agent.generalInstructions?.role ||
    agent.instructions?.agentRole ||
    `${agent.name} Specialist`;
  const tone =
    (agent.generalInstructions as any)?.tone ||
    agent.instructions?.tone ||
    "Professional, transparent, and helpful";
  const style = agent.responseStyle || "balanced";
  const instructions =
    agent.instructions?.advancedPrompt ||
    agent.goal ||
    agent.instructions?.businessDescription ||
    "";
  const customRules =
    agent.generalInstructions?.customRules ||
    agent.instructions?.additionalInstructions ||
    "";
  const guardrails = agent.manualGuardrails || "";

  let section = `### 🤖 ACTIVE SPECIALIZED AGENT GUIDANCE: ${agent.name}\n`;
  section += `- Specialized Role: ${role}\n`;
  section += `- Tone & Manner: ${tone} (${style} response style)\n`;
  section += `- Operational Mode: ${agent.operationalMode || "standard"}\n`;

  if (instructions.trim()) {
    section += `- Agent Instructions & Objectives:\n${instructions.trim()}\n`;
  }
  if (customRules.trim()) {
    section += `- Custom Behavioral Directives:\n${customRules.trim()}\n`;
  }
  if (guardrails.trim()) {
    section += `- Agent Guardrails:\n${guardrails.trim()}\n`;
  }
  if (knowledgePrompt && knowledgePrompt.trim()) {
    section += `\n${knowledgePrompt.trim()}\n`;
  }

  section += `\n*Note: This specialized agent guides domain persona, tone, and specific knowledge context. The core business logic, verified calculations, eligibility evaluations, and safety rules remain authoritative.*`;

  return section;
}
