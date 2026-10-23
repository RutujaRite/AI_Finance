// lib/ai/intentRouting.ts
/**
 * Dynamic Intent Classification & Routing Layer
 *
 * Classifies incoming user queries into one of three primary retrieval modes:
 * 1. POLICY: Bank policies, loan rules, matrix rules, eligibility criteria, or lender parameters.
 * 2. AGENT_KNOWLEDGE: Custom agent instructions, rules, guardrails, or studio knowledge base rules.
 * 3. GENERAL: General financial questions, greetings, conversational follow-ups, or broad queries.
 */

import { resolveBankName, isKnownBankName } from "@/lib/dynamicEligibilityEngine";
import { isConstraintOnlyFollowUp } from "./conversationIntelligence";

export type QueryIntentMode = "POLICY" | "AGENT_KNOWLEDGE" | "GENERAL";
export type LoanProductCategory = "PERSONAL_LOAN" | "HOME_LOAN" | "BUSINESS_LOAN" | "EDUCATION_LOAN" | "GENERAL";

export interface IntentRoutingResult {
  intent: QueryIntentMode;
  loanCategory?: LoanProductCategory;
  isExplicitDemoRequest?: boolean;
  confidence: number;
  reason: string;
  detectedBank?: string;
  detectedBankId?: number;
  detectedPolicyFileId?: number;
  detectedKeywords?: string[];
  effectiveQuery?: string;
  isConstraintOnlyFollowUp?: boolean;
  activeParameter?: string;
}

export const BANK_TARGET_MAP: Record<string, { bankId: number; policyFileId: number; bankName: string }> = {
  "axis finance": { bankId: 15, policyFileId: 2, bankName: "Axis Finance" },
  "axis bank": { bankId: 14, policyFileId: 3, bankName: "Axis Bank" },
  "bandhan bank": { bankId: 16, policyFileId: 4, bankName: "Bandhan Bank" },
  "fibe": { bankId: 3, policyFileId: 1, bankName: "Fibe" },
  "finnable credit": { bankId: 17, policyFileId: 5, bankName: "Finnable Credit" },
  "hdfc bank": { bankId: 18, policyFileId: 6, bankName: "HDFC Bank" },
  "home loan services": { bankId: 19, policyFileId: 7, bankName: "Home Loan Services" },
  "icici bank": { bankId: 20, policyFileId: 8, bankName: "ICICI Bank" },
  "idfc first bank": { bankId: 21, policyFileId: 9, bankName: "IDFC FIRST Bank" },
  "indusind bank": { bankId: 22, policyFileId: 10, bankName: "IndusInd Bank" },
  "kotak mahindra bank": { bankId: 23, policyFileId: 11, bankName: "Kotak Mahindra Bank" },
  "l&t finance": { bankId: 8, policyFileId: 12, bankName: "L&T Finance" },
  "piramal finance": { bankId: 10, policyFileId: 13, bankName: "Piramal Finance" },
  "poonawalla fincorp": { bankId: 11, policyFileId: 14, bankName: "Poonawalla Fincorp" },
  "sbm bank india": { bankId: 9, policyFileId: 15, bankName: "SBM Bank India" },
  "smfg india credit": { bankId: 13, policyFileId: 16, bankName: "SMFG India Credit" },
  "tata capital": { bankId: 12, policyFileId: 17, bankName: "Tata Capital" },
  "utkarsh small finance bank": { bankId: 24, policyFileId: 18, bankName: "Utkarsh Small Finance Bank" },
  "yes bank": { bankId: 25, policyFileId: 19, bankName: "Yes Bank" },
  "aditya birla capital": { bankId: 1, policyFileId: 20, bankName: "Aditya Birla Capital" },
  "bajaj finserv": { bankId: 4, policyFileId: 21, bankName: "Bajaj Finserv" },
  "bajaj markets": { bankId: 5, policyFileId: 22, bankName: "Bajaj Markets" },
  "chola investment": { bankId: 2, policyFileId: 23, bankName: "Chola Investment" },
};

/**
 * Detects the specific loan product category to enforce strict product mapping and isolation.
 */
export function detectLoanCategory(query: string): LoanProductCategory {
  const text = (query || "").toLowerCase();
  if (/\b(?:home\s*loans?|housing\s*loans?|mortgage|property\s*loans?|\blap\b|loan\s*against\s*property|\bhl\b)\b/i.test(text)) {
    return "HOME_LOAN";
  }
  if (/\b(?:business\s*loans?|commercial\s*loans?|msme\s*loans?|sme\s*loans?|od\s*facility|overdraft)\b/i.test(text)) {
    return "BUSINESS_LOAN";
  }
  if (/\b(?:education\s*loans?|student\s*loans?|study\s*loans?|college\s*loans?)\b/i.test(text)) {
    return "EDUCATION_LOAN";
  }
  if (/\b(?:personal\s*loans?|instant\s*loans?|salary\s*loans?|unsecured\s*loans?|\bpl\b)\b/i.test(text)) {
    return "PERSONAL_LOAN";
  }
  // Default for bank policy queries where parameters (cibil, foir, salary, tenure) imply personal loan
  return "PERSONAL_LOAN";
}


/**
 * Regex patterns identifying AGENT_KNOWLEDGE intent:
 * Queries asking about agent setup, custom instructions, studio knowledge base, guardrails, or system persona.
 */
const AGENT_KNOWLEDGE_PATTERNS = [
  /\b(?:agent\s+instructions?|system\s+instructions?|system\s+prompt|prompt\s+instructions?)\b/i,
  /\b(?:agent\s+rules?|studio\s+rules?|agent\s+setup|agent\s+configuration)\b/i,
  /\b(?:guardrails?|guardrail\s+templates?|document\s+guardrails?|manual\s+guardrails?)\b/i,
  /\b(?:knowledge\s+base(?:\s+rules?)?|agent\s+knowledge(?:\s+base)?|studio\s+knowledge(?:\s+base)?|knowledge\s+documents?|knowledge\s+files?)\b/i,
  /\b(?:what\s+are\s+your\s+(?:instructions|rules|guardrails|guidelines|capabilities|limits))\b/i,
  /\b(?:what\s+rules\s+do\s+you\s+follow|what\s+guardrails\s+are\s+configured)\b/i,
  /\b(?:show\s+(?:me\s+)?(?:your\s+)?(?:guardrails|instructions|system\s+prompt|knowledge\s+base|rules))\b/i,
  /\b(?:uploaded\s+(?:knowledge\s+)?(?:documents?|files?)|knowledge\s+chunks?)\b/i,
  /\b(?:greeting_behavior_knowledge|behavior\s+knowledge)\b/i,
  /\b(?:configured\s+for\s+this\s+(?:agent|assistant)|custom\s+rules?|custom\s+instructions?)\b/i,
  /\b(?:who\s+configured\s+you|how\s+were\s+you\s+configured|what\s+is\s+your\s+role\s+in\s+studio)\b/i,
];

/**
 * Regex patterns identifying POLICY intent:
 * Bank policies, eligibility matrices, CIBIL cutoffs, lender rules, ROI, FOIR, documents, etc.
 */
const POLICY_KEYWORDS_REGEX =
  /\b(?:bank\s*polic(?:y|ies)|loan\s*polic(?:y|ies)|lender\s*polic(?:y|ies)|matrix\s*rules?|underwriting\s*rules?|lender\s*criteria|approval\s*criteria|rules?\s+and\s+guidelines?|policies|lending\s*rules?)\b/i;

const POLICY_SPECIFIC_PARAM_REGEX =
  /\b(?:cibil(?:\s*cutoff|\s*requirement|\s*score|\s*limit)?|foir|multiplier|nth|nmi|net\s*take\s*home|gross\s*salary|min(?:imum)?\s*salary|min(?:imum)?\s*income|max(?:imum)?\s*loan|loan\s*cap|tenure\s*(?:months|years|limit|max)|interest\s*rates?|roi|foreclosure\s*charges?|preclosure|part\s*payment|required\s*documents?|documents?\s*required|kyc\s*documents?|salary\s*slip|bank\s*statement|cat\s*[a-e]|super\s*cat|company\s*category|unlisted\s*company|work\s*experience|vintage|age\s*limit|min(?:imum)?\s*age|max(?:imum)?\s*age)\b/i;

const LOAN_ELIGIBILITY_QUERY_REGEX =
  /\b(?:check\s+(?:my\s+)?(?:loan\s+)?eligibility|am\s+i\s+eligible|can\s+i\s+get\s+a\s+loan|apply\s+for\s+(?:a\s+)?(?:personal\s+)?loan|evaluate\s+(?:my\s+)?loan|compare\s+(?:bank\s+)?policies|eligible\s+banks?|partner\s+banks?|which\s+banks?\s+(?:can\s+i|am\s+i|offer))\b/i;

/**
 * Regex patterns identifying GENERAL intent:
 * Greetings, small talk, general financial education, general questions outside specific policy matrices.
 */
const GREETING_REGEX =
  /^(?:hi|hello|hey|good\s*(?:morning|afternoon|evening|night)|howdy|greetings|namaste|sup|yo)(?:[\s,.!]+.*)?$/i;

const PLEASANTRY_REGEX =
  /^(?:thank\s*you|thanks|ok|okay|got\s*it|great|cool|awesome|bye|goodbye|see\s*you|have\s*a\s*good\s*day|sure)(?:[\s,.!]+.*)?$/i;

const GENERAL_FINANCE_TOPIC_REGEX =
  /\b(?:what\s+is\s+(?:a\s+)?cibil|what\s+is\s+(?:an?\s+)?emi|how\s+is\s+(?:emi|cibil|interest)\s+calculated|compound\s+interest|simple\s+interest|how\s+to\s+improve\s+(?:my\s+)?credit\s*score|amortization\s*schedule|fixed\s+vs\s+floating|secured\s+vs\s+unsecured|what\s+is\s+(?:a\s+)?personal\s*loan|what\s+is\s+(?:a\s+)?credit\s*card|credit\s*utilization\s*ratio|debt\s*consolidation|budgeting\s*tips?|tax\s*benefits?\s*(?:under|on)?)\b/i;

/**
 * Classifies an incoming user query into POLICY, AGENT_KNOWLEDGE, or GENERAL.
 */
export function classifyRetrievalIntent(
  query: string,
  options?: {
    activeAgent?: any;
    conversationHistory?: Array<{ role: string; content: string }>;
  }
): IntentRoutingResult {
  const text = String(query || "").trim();
  const lower = text.toLowerCase();
  const loanCategory = detectLoanCategory(text);
  const isExplicitDemoRequest = /\b(?:demo|test\s*data|sample\s*data|fictional)\b/i.test(text);

  if (!text) {
    return {
      intent: "GENERAL",
      loanCategory,
      isExplicitDemoRequest: false,
      confidence: 1.0,
      reason: "Empty input defaults to GENERAL intent.",
    };
  }

  // 0. Constraint-Only Follow-Up & Intent Preservation (Failure B)
  // Phrases like "Use only verified personal loan master policy documents"
  // must inherit active lender and policy intent rather than triggering document checklist.
  if (isConstraintOnlyFollowUp(text)) {
    let priorBank: string | undefined = undefined;
    let priorBankId: number | undefined = undefined;
    let priorPolicyFileId: number | undefined = undefined;
    let priorQuery: string = text;
    let priorParam: string | undefined = undefined;

    if (options?.conversationHistory && Array.isArray(options.conversationHistory)) {
      for (let i = options.conversationHistory.length - 1; i >= 0; i--) {
        const turn = options.conversationHistory[i];
        if (turn.role === "user" && !isConstraintOnlyFollowUp(turn.content)) {
          priorQuery = turn.content;
          const bMatch = resolveBankName(turn.content);
          if (bMatch?.bankName) {
            priorBank = bMatch.bankName;
            const mapped = BANK_TARGET_MAP[bMatch.bankName.toLowerCase()];
            if (mapped) {
              priorBankId = mapped.bankId;
              priorPolicyFileId = mapped.policyFileId;
            }
          }
          if (/\b(?:salary|nth|income|nmi|net\s*take\s*home)\b/i.test(turn.content)) {
            priorParam = "salary";
          } else if (/\b(?:cibil|credit\s*score)\b/i.test(turn.content)) {
            priorParam = "cibil";
          }
          break;
        }
      }
    }

    return {
      intent: "POLICY",
      loanCategory: detectLoanCategory(text) || "PERSONAL_LOAN",
      isExplicitDemoRequest: false,
      confidence: 0.98,
      detectedBank: priorBank,
      detectedBankId: priorBankId,
      detectedPolicyFileId: priorPolicyFileId,
      effectiveQuery: priorQuery,
      isConstraintOnlyFollowUp: true,
      activeParameter: priorParam || "salary",
      reason: "Constraint-only follow-up preserved active policy intent and inherited attributes from prior conversation history.",
    };
  }

  // 1. Check for AGENT_KNOWLEDGE intent
  for (const pattern of AGENT_KNOWLEDGE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        intent: "AGENT_KNOWLEDGE",
        loanCategory,
        isExplicitDemoRequest,
        confidence: 0.95,
        reason: "Matched agent instructions, studio rules, guardrails, or knowledge base inquiry.",
      };
    }
  }

  // 2. Check for bank mention or specific bank policy lookup
  const resolvedBank = resolveBankName(text);
  const detectedBank = resolvedBank?.bankName;
  let detectedBankId: number | undefined = undefined;
  let detectedPolicyFileId: number | undefined = undefined;

  if (detectedBank) {
    const mapped = BANK_TARGET_MAP[detectedBank.toLowerCase()];
    if (mapped) {
      detectedBankId = mapped.bankId;
      detectedPolicyFileId = mapped.policyFileId;
    }

    // If a bank is detected and user is asking about policy/criteria/rules or has loan context
    if (
      POLICY_KEYWORDS_REGEX.test(text) ||
      POLICY_SPECIFIC_PARAM_REGEX.test(text) ||
      LOAN_ELIGIBILITY_QUERY_REGEX.test(text) ||
      /\b(?:criteria|rules?|guidelines?|polic(?:y|ies)|eligib\w*|rate|loan|personal|scheme|nth|salary|cibil|emi|tenure|age)\b/i.test(text)
    ) {
      return {
        intent: "POLICY",
        loanCategory,
        isExplicitDemoRequest,
        confidence: 0.95,
        detectedBank,
        detectedBankId,
        detectedPolicyFileId,
        reason: `Matched bank policy inquiry for lender: ${detectedBank}`,
      };
    }

    // Even if no specific param is named, query mentioning a bank + policy word is POLICY
    if (/\b(?:policy|policies|overview|details|features|requirements|guidelines?)\b/i.test(text)) {
      return {
        intent: "POLICY",
        loanCategory,
        isExplicitDemoRequest,
        confidence: 0.92,
        detectedBank,
        detectedBankId,
        detectedPolicyFileId,
        reason: `Matched general bank policy inquiry for lender: ${detectedBank}`,
      };
    }
  }

  // 3. Check for general policy matrix / eligibility rules without specific bank mention
  if (
    POLICY_KEYWORDS_REGEX.test(text) ||
    LOAN_ELIGIBILITY_QUERY_REGEX.test(text)
  ) {
    return {
      intent: "POLICY",
      loanCategory,
      isExplicitDemoRequest,
      confidence: 0.9,
      reason: "Matched loan eligibility, partner bank criteria, or policy matrix inquiry.",
    };
  }

  // Check if multiple policy specific parameters are asked
  const specificMatches = [
    POLICY_SPECIFIC_PARAM_REGEX.test(text),
    /\b(?:foreclosure|preclosure|foir|cibil\s*cutoff|super\s*cat|cat\s*[a-e]|multiplier)\b/i.test(text),
  ].filter(Boolean);

  if (specificMatches.length > 0 && /\b(?:loan|bank|lender|borrow|criteria|apply)\b/i.test(text)) {
    return {
      intent: "POLICY",
      loanCategory,
      isExplicitDemoRequest,
      confidence: 0.88,
      reason: "Matched lender policy parameters and lending terms.",
    };
  }

  // 4. Check for pure greetings & pleasantries -> GENERAL
  if (GREETING_REGEX.test(text) && text.split(/\s+/).length <= 6) {
    return {
      intent: "GENERAL",
      loanCategory,
      isExplicitDemoRequest,
      confidence: 0.98,
      reason: "Matched user greeting or opening pleasantry.",
    };
  }

  if (PLEASANTRY_REGEX.test(text) && text.split(/\s+/).length <= 5) {
    return {
      intent: "GENERAL",
      loanCategory,
      isExplicitDemoRequest,
      confidence: 0.95,
      reason: "Matched conversational acknowledgment or pleasantry.",
    };
  }

  // 5. Check for general financial education questions -> GENERAL
  if (GENERAL_FINANCE_TOPIC_REGEX.test(text)) {
    return {
      intent: "GENERAL",
      loanCategory,
      isExplicitDemoRequest,
      confidence: 0.92,
      reason: "Matched general financial concept or educational definition inquiry.",
    };
  }

  // 6. Conversational follow-ups (e.g. "why?", "tell me more", "how does that work?")
  const isConversationalFollowUp =
    /^(?:why|how|what\s+do\s+you\s+mean|tell\s+me\s+more|explain\s+more|can\s+you\s+elaborate|who\s+are\s+you|what\s+can\s+you\s+do)\??$/i.test(
      text.trim()
    );
  if (isConversationalFollowUp) {
    return {
      intent: "GENERAL",
      loanCategory,
      isExplicitDemoRequest,
      confidence: 0.9,
      reason: "Matched conversational follow-up or assistant capabilities question.",
    };
  }

  // 7. Check if policy terms are present in text
  if (POLICY_SPECIFIC_PARAM_REGEX.test(text)) {
    return {
      intent: "POLICY",
      loanCategory,
      isExplicitDemoRequest,
      confidence: 0.8,
      reason: "Contains bank policy parameter keywords.",
    };
  }

  // Default fallback to GENERAL
  return {
    intent: "GENERAL",
    loanCategory,
    isExplicitDemoRequest,
    confidence: 0.75,
    reason: "Broad query or general financial dialogue outside strict bank policy matrix.",
  };
}
