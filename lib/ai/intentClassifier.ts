import {
  parseFinancialAmount,
  extractCompanyCandidateFromText,
  extractCleanCompanyName,
  isPureGreeting,
  hasGreetingPrefix,
  stripGreetingPrefix,
  isCompanyInfoOrSearchIntent,
  isInvalidCompanyName,
  isLocationInput,
  extractTargetCompanyFromMessage,
  isMultiBankEligibilityQuery,
  isGeneralAssistanceQuery,
} from "@/lib/dynamicEligibilityEngine";

const getApiKey = () => process.env.OPENROUTER_API_KEY || "";
const getModel = () => (process.env.OPENROUTER_MODEL || "openrouter/free").replace(/^["']|["']$/g, "").trim();
const LLM_TIMEOUT_MS = 12000;

export type UserIntentType =
  | "GREETING"
  | "GENERAL_CONVERSATION"
  | "GENERAL_FINANCIAL_QUESTION"
  | "LOAN_PRODUCT_QUESTION"
  | "LOAN_ELIGIBILITY"
  | "BANK_POLICY_QUERY"
  | "POLICY_COMPARISON"
  | "COMPANY_SEARCH"
  | "COMPANY_FOLLOW_UP"
  | "BANK_MANAGER_SEARCH"
  | "BRANCH_SELECTION"
  | "EMI_CALCULATION"
  | "DOCUMENT_CHECKLIST"
  | "APPLICATION_PROCESS"
  | "OFFERS_AND_RATES"
  | "TEMPORARY_INTERRUPT"
  | "TOPIC_SWITCH"
  | "RESUME_TASK"
  | "CONVERSATION_CONTROL"
  | "OUT_OF_DOMAIN"
  // Legacy backward-compatibility aliases
  | "MULTI_BANK_ELIGIBILITY_CHECK"
  | "CALCULATION"
  | "GENERAL_INFORMATION"
  | "BANK_COMPARISON"
  | "CHANGING_DETAILS"
  | "GREETINGS"
  | "ANOTHER_TOPIC";

export type MessageType = "QUESTION" | "ANSWER" | "COMMAND" | "STATEMENT" | "MIXED";

export type ConversationAction =
  | "CONTINUE"              // Answering expected field or advancing flow
  | "TEMPORARY_INTERRUPT"   // Asking a side question mid-flow; expects eventual resumption
  | "TOPIC_SWITCH"          // Explicitly abandoning or shifting flow
  | "CORRECTION"            // Correcting previously submitted information
  | "RESUME"                // Explicit command to return to suspended task
  | "RESET"                 // Command to wipe session and restart
  | "NEW_TASK"              // Starting a brand new workflow
  | "NONE";                 // General remark, small talk, or greeting

export type MainUserGoal =
  | "PERSONAL_LOAN"
  | "EMI_CALCULATION"
  | "COMPANY_SEARCH"
  | "BANK_POLICY"
  | "BANK_COMPARISON"
  | "BANK_MANAGER_SEARCH"
  | "GENERAL_ASSISTANCE"
  | "UNKNOWN";

export function isQuestionMessage(text: string): boolean {
  if (!text) return false;
  const raw = text.trim();
  const lower = raw.toLowerCase().replace(/[?.,!]+$/, "");
  if (/\?$/.test(raw)) return true;
  if (/^(?:is|are|can|could|would|should|will|do|did|does|why|how|what|when|where|who|which)\b/i.test(lower)) return true;
  if (/^(?:tell\s+me|show\s+me|explain|compare|check\s+if)\b/i.test(lower)) return true;
  return false;
}

export function isBankComparisonQuery(
  message: string,
  recentHistory?: Array<{ role: string; content: string }>
): { isComparison: boolean; banks: string[] } {
  if (!message) return { isComparison: false, banks: [] };
  const lower = message.toLowerCase().trim();

  // Multi-bank eligibility or queries across all/partner lenders must NEVER be intercepted as a pairwise comparison
  if (
    isMultiBankEligibilityQuery(message) ||
    /\b(?:across\s+(?:all\s+|partner\s+)?banks|partner\s+banks?|all\s+partner\s+banks?|all\s+banks?|across\s+banks?)\b/i.test(lower) ||
    /\bwhich\s+bank\s+(?:has|offers|provides|accepts|requires|gives|features)\s+(?:the\s+)?(?:lowest|minimum|best|highest)\b/i.test(lower) ||
    /\b(?:lowest|minimum|highest|best)\s+(?:cibil|credit\s*score|salary|income|interest|roi|tenure|amount)\b/i.test(lower)
  ) {
    return { isComparison: false, banks: [] };
  }

  const comparisonKeywords = /\b(?:compare|comparison|versus|vs\.?|difference\s+between|how\s+do\s+they\s+compare|which\s+(?:one|bank)\s+is\s+better|which\s+is\s+better|are\s+both\s+(?:the\s+)?same|are\s+both\s+requirements\s+(?:the\s+)?same|is\s+(?:it|there)\s+any\s+difference|same\s+requirements?|differ\b|difference\b)\b/i;
  const hasComp = comparisonKeywords.test(lower) ||
    (/\b(?:both|two|2)\s+(?:banks?|lenders?|policies|requirements?|criteria)\b/i.test(lower) && /\b(?:same|different|difference|compare)\b/i.test(lower)) ||
    /^(?:are\s+both\s+(?:the\s+)?same\??|are\s+both\s+requirements\s+(?:the\s+)?same\??)$/i.test(lower);

  if (!hasComp) {
    return { isComparison: false, banks: [] };
  }

  const banksFound: string[] = [];
  const bankPatterns: Array<{ name: string; regex: RegExp }> = [
    { name: "Axis Finance", regex: /\b(?:axis\s*finance|afl)\b/i },
    { name: "Axis Bank", regex: /\b(?:axis\s*bank|\baxis\b(?!.*finance))\b/i },
    { name: "HDFC Bank", regex: /\bhdfc\b/i },
    { name: "ICICI Bank", regex: /\bicici\b/i },
    { name: "Kotak Mahindra Bank", regex: /\bkotak\b/i },
    { name: "Tata Capital", regex: /\btata\s*capital\b/i },
    { name: "Bajaj Finserv", regex: /\bbajaj\s*finserv\b/i },
    { name: "Bajaj Markets", regex: /\bbajaj\s*markets\b/i },
    { name: "IDFC FIRST Bank", regex: /\bidfc\b/i },
    { name: "IndusInd Bank", regex: /\bindusind\b/i },
    { name: "Bandhan Bank", regex: /\bbandhan\b/i },
    { name: "Yes Bank", regex: /\byes\s*bank\b/i },
    { name: "Piramal Finance", regex: /\bpiramal\b/i },
    { name: "Poonawalla Fincorp", regex: /\bpoonawalla\b/i },
    { name: "SMFG India Credit", regex: /\bsmfg\b/i },
    { name: "Finnable Credit", regex: /\bfinnable\b/i },
    { name: "Fibe (EarlySalary)", regex: /\bfibe\b/i },
    { name: "State Bank of India", regex: /\bsbi\b/i },
  ];

  for (const bp of bankPatterns) {
    if (bp.regex.test(lower)) {
      if (!banksFound.includes(bp.name)) {
        banksFound.push(bp.name);
      }
    }
  }

  // Look back in dialogue history ONLY if user explicitly refers to prior entities (both, these two, them, between them)
  // and fewer than 2 banks explicitly mentioned in current message
  const hasAnaphoricRef = /\b(?:both|these\s+two|the\s+two|between\s+them|either\s+of\s+them|them|they)\b/i.test(lower);
  if (banksFound.length < 2 && hasAnaphoricRef && recentHistory && recentHistory.length > 0) {
    const reversed = [...recentHistory].reverse();
    for (const msg of reversed) {
      const msgContent = msg.content || "";
      for (const bp of bankPatterns) {
        if (bp.regex.test(msgContent)) {
          if (!banksFound.includes(bp.name)) {
            banksFound.push(bp.name);
            if (banksFound.length >= 2) break;
          }
        }
      }
      if (banksFound.length >= 2) break;
    }
  }

  if (banksFound.length < 2) {
    return { isComparison: false, banks: banksFound };
  }

  return {
    isComparison: true,
    banks: banksFound,
  };
}

export interface ConfidenceScores {
  intentConfidence: number;   // 0.0 to 1.0 (Signal only, never bypasses validation)
  entityConfidence: number;   // 0.0 to 1.0
  stateConfidence: number;    // 0.0 to 1.0
}

export interface EntityCorrection {
  field: "monthlyIncome" | "loanAmount" | "tenureMonths" | "cibil" | "age" | "companyName" | "existingEmi";
  oldValue?: string | number;
  newValue: string | number;
  rawExpression: string;
}

export interface ExtractedEntities {
  companyName?: string;
  monthlyIncome?: number | string;
  loanAmount?: number | string;
  tenureMonths?: number | string;
  cibil?: number | string;
  existingEmi?: number | string;
  age?: number | string;
  interestRate?: number;
  employmentType?: string;
  loanType?: string;
  targetBank?: string;
  city?: string;
  changeFields?: string[];
  questionTopic?: string;
}

export interface StructuredNluResult {
  messageType: MessageType;
  primaryIntent: string;
  secondaryIntents: string[];
  conversationAction: ConversationAction;
  mainUserGoal: MainUserGoal;
  confidence: ConfidenceScores;
  entities: ExtractedEntities;
  corrections: EntityCorrection[];
  targetBank?: string;
  questionTopic?: string;
  clarificationRequired?: {
    isAmbiguous: boolean;
    reason: string;
    clarificationPrompt: string;
  };
  rawReasoning?: string;
}

export interface IntentClassificationResult {
  intent: UserIntentType;
  subIntent?: string;
  confidence: number;
  loanType: string;
  extracted: ExtractedEntities;
  rawResponse?: string;
}

export interface NluContext {
  isFlowActive?: boolean;
  expectedField?: string;
  existingApplicant?: any;
  recentMessages?: Array<{ role: string; content: string }>;
  activeFlow?: string;
  mainUserGoal?: string;
  taskStack?: any[];
  lastAssistantQuestion?: string;
}

/**
 * Strips reasoning tokens, thinking process preamble, or markdown fences emitted by LLMs.
 */
export function cleanLlmJsonOutput(raw: string): string {
  if (!raw) return "{}";
  let cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^Here('s| is) a thinking process[\s\S]*?\n\n/gi, "")
    .replace(/^Thinking Process:[\s\S]*?\n\n/gi, "")
    .replace(/^User Safety:[^\n]*\n+/gi, "")
    .trim();

  // Extract json markdown fence if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Find the first { and last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/**
 * Main Conversational Intelligence & Semantic NLU Engine.
 * Analyzes every user message semantically in multi-turn conversation context.
 * Interpretation layer ONLY: Never calls DB, calculates finance values, or mutates state.
 */
export async function analyzeConversationSemanticIntent(
  userMessage: string,
  context?: NluContext,
  modelOverride?: string
): Promise<StructuredNluResult> {
  const primaryModel = modelOverride || getModel();
  const messageText = String(userMessage || "").trim();

  if (!messageText) {
    return {
      messageType: "STATEMENT",
      primaryIntent: "GENERAL_ASSISTANCE",
      secondaryIntents: [],
      conversationAction: "NONE",
      mainUserGoal: (context?.mainUserGoal as MainUserGoal) || "UNKNOWN",
      confidence: { intentConfidence: 1.0, entityConfidence: 1.0, stateConfidence: 1.0 },
      entities: {},
      corrections: [],
    };
  }

  // Fast deterministic intercept for general assistance / capabilities queries (e.g. "how can u help me", "hoe can u help me", "what can you do")
  if (isGeneralAssistanceQuery(messageText)) {
    return {
      messageType: "QUESTION",
      primaryIntent: "GENERAL_ASSISTANCE",
      secondaryIntents: [],
      conversationAction: context?.isFlowActive ? "TEMPORARY_INTERRUPT" : "NONE",
      mainUserGoal: "GENERAL_ASSISTANCE",
      confidence: { intentConfidence: 1.0, entityConfidence: 1.0, stateConfidence: 1.0 },
      entities: {},
      corrections: [],
    };
  }

  // Fast deterministic intercept for bank policy comparison queries (e.g. "are both requirements the same?", "compare both banks policy")
  const compCheck = isBankComparisonQuery(messageText, context?.recentMessages);
  if (compCheck.isComparison) {
    return {
      messageType: "QUESTION",
      primaryIntent: "BANK_COMPARISON",
      secondaryIntents: compCheck.banks,
      conversationAction: context?.isFlowActive ? "TEMPORARY_INTERRUPT" : "NONE",
      mainUserGoal: "BANK_POLICY",
      confidence: { intentConfidence: 0.98, entityConfidence: 1.0, stateConfidence: 1.0 },
      entities: { targetBank: compCheck.banks.join(" vs ") },
      corrections: [],
    };
  }

  const systemInstruction =
    `You are the Conversational Intelligence & Semantic NLU Engine for CreditWise AI, a banking and loan intelligence platform.\n` +
    `Analyze the user's message semantically within the context of recent dialogue turns and current flow state.\n` +
    `Output STRICT JSON matching StructuredNluResult.\n\n` +
    `CORE RULES:\n` +
    `1. Message categories are NOT mutually exclusive. A single turn carries:\n` +
    `   - messageType: "QUESTION" | "ANSWER" | "COMMAND" | "STATEMENT" | "MIXED"\n` +
    `   - primaryIntent: e.g. "LOAN_ELIGIBILITY", "EMI_CALCULATION", "BANK_DOCUMENT_REQUIREMENTS", "BANK_POLICY", "BANK_COMPARISON", "BANK_MANAGER_SEARCH", "COMPANY_SEARCH", "CONCEPTUAL_FINANCIAL_QUESTION", "GENERAL_ASSISTANCE", "CONVERSATION_CONTROL", "OUT_OF_DOMAIN"\n` +
    `   - secondaryIntents: array of secondary intents if any (e.g. ["FOIR_EXPLANATION"])\n` +
    `   - conversationAction: "CONTINUE" | "TEMPORARY_INTERRUPT" | "TOPIC_SWITCH" | "CORRECTION" | "RESUME" | "RESET" | "NEW_TASK" | "NONE"\n` +
    `   - mainUserGoal: "PERSONAL_LOAN" | "EMI_CALCULATION" | "COMPANY_SEARCH" | "BANK_POLICY" | "BANK_MANAGER_SEARCH" | "GENERAL_ASSISTANCE" | "UNKNOWN"\n\n` +
    `2. Separate mainUserGoal from current user request:\n` +
    `   - "I want a personal loan, but first explain FOIR" -> mainUserGoal: "PERSONAL_LOAN", primaryIntent: "CONCEPTUAL_FINANCIAL_QUESTION", conversationAction: "TEMPORARY_INTERRUPT", questionTopic: "FOIR".\n` +
    `   - "Forget the loan, show TCS details" -> mainUserGoal: "COMPANY_SEARCH", primaryIntent: "COMPANY_SEARCH", conversationAction: "TOPIC_SWITCH".\n` +
    `   - "My salary is 45k, not 39k" -> conversationAction: "CORRECTION", corrections: [{ field: "monthlyIncome", newValue: 45000, rawExpression: "45k, not 39k" }].\n\n` +
    `3. QUESTION ≠ ENTITY UPDATE:\n` +
    `   - Questions containing numbers or financial words (e.g. "What salary is required for a ₹5 lakh loan?", "What CIBIL score is required?") must have messageType: "QUESTION". Do NOT extract loanAmount: 500000 or monthlyIncome as applicant values! "entities" MUST be empty {}\n\n` +
    `4. Context-aware Numeric Disambiguation (The "76" Principle):\n` +
    `   - If expected field is "cibil" and user sends "76": 76 is invalid for CIBIL (valid range 300-900). Do NOT extract as age or CIBIL. Set clarificationRequired: { isAmbiguous: true, reason: "CIBIL score out of range", clarificationPrompt: "CIBIL scores range from 300 to 900. Did you mean a different score?" }.\n` +
    `   - If expected field is "loanAmount" and user sends standalone "76": do NOT convert to 76k or 76L automatically. Set clarificationRequired: { isAmbiguous: true, reason: "Ambiguous loan amount scale", clarificationPrompt: "Could you please clarify if by 76 you mean ₹76 Lakhs or ₹76,000? (Personal loans typically start from ₹50,000)." }.\n` +
    `   - If expected field is "monthlyIncome" and user sends standalone "76": do NOT convert to 76k automatically. Set clarificationRequired: { isAmbiguous: true, reason: "Ambiguous salary scale", clarificationPrompt: "Could you please clarify if by 76 you mean ₹76,000/month?" }.\n` +
    `   - If unanchored (no expected field) and user sends "76": set clarificationRequired: { isAmbiguous: true, reason: "Unanchored number", clarificationPrompt: "Could you please clarify what 76 refers to — is it your age, tenure, or something else?" }.\n\n` +
    `5. Multi-Entity Extraction:\n` +
    `   - If the user provides multiple pieces of information (e.g. "I need 8 lakh for 5 years, salary is 40k and CIBIL is 760"), extract all mentioned entities in "entities".\n\n` +
    `6. Bank Policy & Document Inquiries:\n` +
    `   - "Which documents are required for HDFC?" -> primaryIntent: "BANK_DOCUMENT_REQUIREMENTS", targetBank: "HDFC Bank", conversationAction: "TEMPORARY_INTERRUPT" (if loan flow active).\n` +
    `   - "What is HDFC policy?" -> primaryIntent: "BANK_POLICY", targetBank: "HDFC Bank".\n\n` +
    `7. Conversation Controls:\n` +
    `   - "continue", "proceed", "next" -> conversationAction: "CONTINUE"\n` +
    `   - "resume", "go back to loan" -> conversationAction: "RESUME"\n` +
    `   - "cancel", "reset", "start over", "restart" -> conversationAction: "RESET"\n` +
    `   - "stop", "pause" -> conversationAction: "NONE", primaryIntent: "CONVERSATION_CONTROL"\n\n` +
    `Context:\n` +
    `- Flow Active: ${context?.isFlowActive ? "true" : "false"}\n` +
    `- Active Flow: ${context?.activeFlow || "IDLE"}\n` +
    `- Expected Field: ${context?.expectedField || "none"}\n` +
    `- Main Goal: ${context?.mainUserGoal || "UNKNOWN"}\n` +
    `- Known Profile: ${JSON.stringify(context?.existingApplicant || {})}\n\n` +
    `Return strictly valid JSON only in this exact format:\n` +
    `{\n` +
    `  "messageType": "QUESTION" | "ANSWER" | "COMMAND" | "STATEMENT" | "MIXED",\n` +
    `  "primaryIntent": "LOAN_ELIGIBILITY" | "EMI_CALCULATION" | "BANK_DOCUMENT_REQUIREMENTS" | "BANK_POLICY" | "BANK_MANAGER_SEARCH" | "COMPANY_SEARCH" | "CONCEPTUAL_FINANCIAL_QUESTION" | "GENERAL_ASSISTANCE" | "CONVERSATION_CONTROL" | "OUT_OF_DOMAIN",\n` +
    `  "secondaryIntents": [],\n` +
    `  "conversationAction": "CONTINUE" | "TEMPORARY_INTERRUPT" | "TOPIC_SWITCH" | "CORRECTION" | "RESUME" | "RESET" | "NEW_TASK" | "NONE",\n` +
    `  "mainUserGoal": "PERSONAL_LOAN" | "EMI_CALCULATION" | "COMPANY_SEARCH" | "BANK_POLICY" | "BANK_MANAGER_SEARCH" | "GENERAL_ASSISTANCE" | "UNKNOWN",\n` +
    `  "confidence": {\n` +
    `    "intentConfidence": 0.95,\n` +
    `    "entityConfidence": 0.95,\n` +
    `    "stateConfidence": 0.95\n` +
    `  },\n` +
    `  "entities": {\n` +
    `    "companyName": null,\n` +
    `    "monthlyIncome": null,\n` +
    `    "loanAmount": null,\n` +
    `    "tenureMonths": null,\n` +
    `    "cibil": null,\n` +
    `    "existingEmi": null,\n` +
    `    "age": null,\n` +
    `    "employmentType": null,\n` +
    `    "interestRate": null,\n` +
    `    "targetBank": null,\n` +
    `    "city": null,\n` +
    `    "changeFields": [],\n` +
    `    "questionTopic": null\n` +
    `  },\n` +
    `  "corrections": [],\n` +
    `  "targetBank": null,\n` +
    `  "questionTopic": null,\n` +
    `  "clarificationRequired": null\n` +
    `}`;

  const prompt: any[] = [{ role: "system", content: systemInstruction }];

  if (context?.recentMessages && context.recentMessages.length > 0) {
    const historySlice = context.recentMessages.slice(-6);
    for (const msg of historySlice) {
      if (msg.content && msg.content.trim()) {
        prompt.push({
          role: msg.role === "assistant" || msg.role === "ai" ? "assistant" : "user",
          content: msg.content.trim(),
        });
      }
    }
  }

  prompt.push({ role: "user", content: messageText });

  const apiKey = getApiKey();
  if (apiKey) {
    const rawEnv = getModel();
    const modelsToTry = [
      primaryModel && primaryModel !== "openrouter/auto" ? primaryModel : undefined,
      rawEnv && rawEnv !== "openrouter/auto" ? rawEnv : undefined,
      "openrouter/free",
      "inclusionai/ling-3.0-flash-sante:free",
      "google/gemma-4-26b-a4b-it:free",
    ].filter(Boolean) as string[];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "CreditWise AI",
          },
          body: JSON.stringify({
            model,
            max_tokens: 700,
            temperature: 0.1,
            messages: prompt,
          }),
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const choice = json.choices?.[0]?.message;
          let content = choice?.content || choice?.text || "";
          if (!content && choice?.reasoning && typeof choice.reasoning === "string") {
            const jm = choice.reasoning.match(/\{[\s\S]*\}/);
            if (jm) content = jm[0];
          }
          if (content) {
            let parsed: any = null;
            try {
              const cleaned = cleanLlmJsonOutput(content);
              parsed = JSON.parse(cleaned);
            } catch {}

            if (parsed && (parsed.primaryIntent || parsed.intent)) {
              const rawEntities = parsed.entities || parsed.extracted || {};
              const normalizedEntities: ExtractedEntities = { ...rawEntities };

              // Normalize numeric amounts
              if (normalizedEntities.monthlyIncome && typeof normalizedEntities.monthlyIncome === "string") {
                normalizedEntities.monthlyIncome = parseFinancialAmount(normalizedEntities.monthlyIncome) || undefined;
              }
              if (normalizedEntities.loanAmount && typeof normalizedEntities.loanAmount === "string") {
                normalizedEntities.loanAmount = parseFinancialAmount(normalizedEntities.loanAmount) || undefined;
              }
              if (normalizedEntities.existingEmi !== undefined && normalizedEntities.existingEmi !== null && typeof normalizedEntities.existingEmi === "string") {
                const pEmi = parseFinancialAmount(normalizedEntities.existingEmi);
                normalizedEntities.existingEmi = pEmi !== null ? pEmi : undefined;
              }
              if (normalizedEntities.tenureMonths && typeof normalizedEntities.tenureMonths === "string") {
                const pTen = parseInt(String(normalizedEntities.tenureMonths), 10);
                normalizedEntities.tenureMonths = !isNaN(pTen) ? pTen : undefined;
              }
              if (typeof normalizedEntities.tenureMonths === "number" && normalizedEntities.tenureMonths >= 1 && normalizedEntities.tenureMonths <= 7) {
                normalizedEntities.tenureMonths = normalizedEntities.tenureMonths * 12;
              }
              if (normalizedEntities.cibil !== undefined && normalizedEntities.cibil !== null && typeof normalizedEntities.cibil === "string") {
                const s = String(normalizedEntities.cibil).trim();
                if (/not\s*provided|unknown|not\s*sure|don'?t\s*know|na|n\/a|no\s*cibil|zero\s*credit/i.test(s)) {
                  normalizedEntities.cibil = 700;
                } else {
                  const pCib = parseInt(s, 10);
                  normalizedEntities.cibil = !isNaN(pCib) && pCib >= 300 && pCib <= 900 ? pCib : 700;
                }
              }
              if (typeof normalizedEntities.cibil === "number") {
                if (normalizedEntities.cibil < 300 || normalizedEntities.cibil > 900) {
                  normalizedEntities.cibil = undefined;
                }
              }
              if (normalizedEntities.age && typeof normalizedEntities.age === "string") {
                const pAge = parseInt(String(normalizedEntities.age), 10);
                normalizedEntities.age = !isNaN(pAge) ? pAge : undefined;
              }

              // QUESTION != ENTITY UPDATE guard
              const isMsgQuestion =
                parsed.messageType === "QUESTION" ||
                /^(?:what|which|how|who|where|why|can\s*(?:you|i)|could|is\s*there|does|tell\s*me|explain)\b/i.test(messageText.trim()) ||
                /\?$/.test(messageText.trim());

              if (isMsgQuestion) {
                normalizedEntities.monthlyIncome = undefined;
                normalizedEntities.loanAmount = undefined;
                normalizedEntities.cibil = undefined;
                normalizedEntities.tenureMonths = undefined;
                normalizedEntities.existingEmi = undefined;
                normalizedEntities.age = undefined;
              }

              // Context-aware "76" ambiguity guard on LLM output
              let clarification = parsed.clarificationRequired || undefined;
              const pureNumMatch = messageText.match(/^\s*(?:rs\.?|₹)?\s*(\d{1,8})\s*$/i);
              if (pureNumMatch) {
                const val = parseInt(pureNumMatch[1], 10);
                if (val > 0 && val <= 100) {
                  if (context?.expectedField === "cibil") {
                    clarification = {
                      isAmbiguous: true,
                      reason: "CIBIL score out of range (300-900)",
                      clarificationPrompt: "CIBIL scores range from 300 to 900. Did you mean a different score?",
                    };
                    normalizedEntities.cibil = undefined;
                  } else if (context?.expectedField === "loanAmount") {
                    clarification = {
                      isAmbiguous: true,
                      reason: "Ambiguous loan amount scale",
                      clarificationPrompt: `Could you please clarify if by **${val}** you mean **₹${val} Lakhs** or **₹${val},000**? (Personal loans typically start from ₹50,000).`,
                    };
                    normalizedEntities.loanAmount = undefined;
                  } else if (context?.expectedField === "monthlyIncome") {
                    clarification = {
                      isAmbiguous: true,
                      reason: "Ambiguous salary scale",
                      clarificationPrompt: `Could you please clarify if by **${val}** you mean **₹${val},000/month**?`,
                    };
                    normalizedEntities.monthlyIncome = undefined;
                  } else if (!context?.expectedField || context.expectedField === "companyName" || context.expectedField === "company") {
                    clarification = {
                      isAmbiguous: true,
                      reason: "Unanchored numeric input",
                      clarificationPrompt: `Could you please clarify what ${val} refers to — is it your age, tenure, or something else?`,
                    };
                  }
                }
              }

              const result: StructuredNluResult = {
                messageType: parsed.messageType || (isMsgQuestion ? "QUESTION" : "ANSWER"),
                primaryIntent: parsed.primaryIntent || parsed.intent || "GENERAL_ASSISTANCE",
                secondaryIntents: Array.isArray(parsed.secondaryIntents) ? parsed.secondaryIntents : [],
                conversationAction: parsed.conversationAction || (isMsgQuestion && context?.isFlowActive ? "TEMPORARY_INTERRUPT" : "CONTINUE"),
                mainUserGoal: parsed.mainUserGoal || (context?.mainUserGoal as MainUserGoal) || (context?.isFlowActive ? "PERSONAL_LOAN" : "UNKNOWN"),
                confidence: {
                  intentConfidence: parsed.confidence?.intentConfidence ?? (typeof parsed.confidence === "number" ? parsed.confidence : 0.95),
                  entityConfidence: parsed.confidence?.entityConfidence ?? 0.95,
                  stateConfidence: parsed.confidence?.stateConfidence ?? 0.95,
                },
                entities: normalizedEntities,
                corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
                targetBank: parsed.targetBank || normalizedEntities.targetBank || undefined,
                questionTopic: parsed.questionTopic || normalizedEntities.questionTopic || undefined,
                clarificationRequired: clarification,
                rawReasoning: content,
              };

              return result;
            }
          }
        }
      } catch (err: any) {
        console.warn(`LLM semantic NLU call with ${model} failed or timed out:`, err?.message || err);
      }
    }
  }

  // Resilient deterministic fallback parser
  return fallbackMultidimensionalNluParser(messageText, context);
}

/**
 * Backward-compatible wrapper for classifyIntentWithLLM.
 * Calls analyzeConversationSemanticIntent and maps to legacy IntentClassificationResult.
 */
export async function classifyIntentWithLLM(
  userMessage: string,
  context?: {
    isFlowActive?: boolean;
    expectedField?: string;
    existingApplicant?: any;
    recentMessages?: Array<{ role: string; content: string }>;
  },
  modelOverride?: string
): Promise<IntentClassificationResult> {
  const res = await analyzeConversationSemanticIntent(userMessage, context, modelOverride);
  return {
    intent: normalizeIntentName(res.primaryIntent),
    subIntent: res.questionTopic || (res.secondaryIntents.length > 0 ? res.secondaryIntents[0] : undefined),
    confidence: res.confidence.intentConfidence,
    loanType: "Personal Loan",
    extracted: res.entities,
    rawResponse: res.rawReasoning,
  };
}

/**
 * Normalizes any legacy or alternative intent names into the 6 canonical categories.
 */
function normalizeIntentName(raw: string): UserIntentType {
  const norm = String(raw || "").trim().toUpperCase();
  if (norm === "MULTI_BANK_ELIGIBILITY_CHECK" || norm === "MULTI_BANK_ELIGIBILITY") {
    return "MULTI_BANK_ELIGIBILITY_CHECK";
  }
  if (norm === "LOAN_ELIGIBILITY" || norm === "PERSONAL_LOAN_REQUEST" || norm === "PROVIDE_INFORMATION") {
    return "LOAN_ELIGIBILITY";
  }
  if (norm === "CALCULATION" || norm === "EMI_CALCULATION") {
    return "CALCULATION";
  }
  if (norm === "BANK_COMPARISON" || norm === "COMPARE_BANKS") {
    return "BANK_COMPARISON";
  }
  if (
    norm === "GENERAL_INFORMATION" ||
    norm === "GENERAL_ASSISTANCE" ||
    norm === "POLICY_INQUIRY" ||
    norm === "BANK_POLICY" ||
    norm === "BANK_MANAGER_SEARCH" ||
    norm === "COMPANY_SEARCH"
  ) {
    return "GENERAL_INFORMATION";
  }
  if (norm === "CHANGING_DETAILS") {
    return "CHANGING_DETAILS";
  }
  if (norm === "GREETINGS" || norm === "GREETING") {
    return "GREETINGS";
  }
  return "ANOTHER_TOPIC";
}

function isPersonalFieldMention(field: string, text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  switch (field) {
    case "cibil":
      return (
        /(?:cibil|credit\s*score|score\b|bureau)/i.test(lower) ||
        /\b[3-9]\d{2}\b/.test(lower)
      );
    case "monthlyIncome":
    case "salary":
      return /(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|nmi|nth|earning|earns?|makes?|\/mo|per\s*month)/i.test(lower);
    case "loanAmount":
      return /(?:loan|borrow|ticket|need|require|want)/i.test(lower) || /(?:rs\.?|₹)\s*\d+/i.test(lower) || /\b\d+\s*(?:lakhs?|lacs?|l\b|cr)/i.test(lower);
    case "tenureMonths":
    case "tenure":
      return /(?:tenure|duration|term|period)/i.test(lower) || /\b\d{1,2}\s*(?:years?|yrs?|months?)\b/i.test(lower);
    case "existingEmi":
    case "emi":
      return /(?:existing|current|other|ongoing)?\s*emi(?:s)?/i.test(lower) || /(?:no|zero|nil|0)\s*(?:existing\s*)?emi/i.test(lower) || /paying.*emi/i.test(lower);
    case "age":
      return /(?:age|aged)\b/i.test(lower) || /\b(?:years?\s*old|yr\s*old)\b/i.test(lower) || /(?:i\s*am|im)\s+\d{2}\b/i.test(lower);
    case "companyName":
      return (
        /(?:work\s+at|works\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is|company|firm|employer)\b/i.test(lower) ||
        Boolean(extractCompanyCandidateFromText(text))
      );
    default:
      return false;
  }
}

/**
 * Extracts entities from raw text when using the fallback parser.
 */
export function extractEntitiesFromText(
  text: string,
  context?: { isFlowActive?: boolean; expectedField?: string }
): ExtractedEntities {
  const extracted: ExtractedEntities = {};
  const norm = text.toLowerCase().trim();

  // 1. CIBIL score
  const cibilScoreMatch =
    text.match(/\b(?:cibil|credit\s*score|score)?\s*(?:is|to|=|:)?\s*([3-9]\d{2})\b/i) ||
    text.match(/\b([3-9]\d{2})\b/);
  if (cibilScoreMatch && (context?.expectedField === "cibil" || context?.expectedField === "cibilScore" || /(?:cibil|score|credit)/i.test(norm))) {
    const s = parseInt(cibilScoreMatch[1], 10);
    if (s >= 300 && s <= 900) {
      extracted.cibil = s;
    }
  } else if ((context?.expectedField === "cibil" || context?.expectedField === "cibilScore") && /unknown|not\s*sure|don'?t\s*know|never\s*checked|no\s*idea|no\s*cibil|zero\s*credit|employee.*no\s*cibil/i.test(norm)) {
    extracted.cibil = 700;
  } else if ((context?.expectedField === "cibil" || context?.expectedField === "cibilScore") && /\b(?:0|zero)\b/i.test(norm)) {
    extracted.cibil = 700;
  }

  // 2. Monthly Income
  const salMatch =
    text.match(
      /(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|in\s*hand|net\s*pay|earn(?:s|ing)?)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|hazar))?)\b/i
    ) ||
    text.match(
      /([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|hazar))?)\s*(?:per\s*month|\/month|\/mo|monthly|take\s*home|in\s*hand|salary|income)\b/i
    );
  if (salMatch) {
    const amt = parseFinancialAmount(salMatch[1]);
    if (amt !== null && amt >= 0) extracted.monthlyIncome = amt;
  } else if (context?.expectedField === "monthlyIncome") {
    if (/^(?:0\s*(?:rs|inr)?|rs\.?\s*0|zero|nil|none|nothing|0rs|0)$/i.test(norm)) {
      extracted.monthlyIncome = 0;
    } else {
      const amt = parseFinancialAmount(text);
      if (amt !== null && amt >= 0) extracted.monthlyIncome = amt;
    }
  }

  // 3. Loan Amount
  const loanMatch =
    text.match(
      /(?:personal\s*loan|loan\s*(?:amount|ticket|size)?)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|khoka))?)\b/i
    ) ||
    (!salMatch && text.match(/(?:borrow|need|want|require)\s*(?:a\s*(?:personal\s*)?loan\s*(?:of)?)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|khoka))?)\b/i)) ||
    text.match(/(?:rs\.?|₹)\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|khoka))?)\s*(?:loan)\b/i) ||
    text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|cr|crores?|peti|khoka)\s+(?:loan|borrow)/i);
  if (loanMatch) {
    const amt = parseFinancialAmount((loanMatch[1] || "") + ((loanMatch as any)[2] || ""));
    if (amt && amt >= 10000 && amt !== extracted.monthlyIncome) extracted.loanAmount = amt;
  } else if (context?.expectedField === "loanAmount") {
    const amt = parseFinancialAmount(text);
    if (amt && amt >= 10000 && amt !== extracted.monthlyIncome) extracted.loanAmount = amt;
  }

  // 4. Tenure
  const yrMatch = text.match(/\b(\d{1,2})\s*(?:years?|yrs?|yr|y\b|saal|sal)(?!\s*old)\b/i);
  if (yrMatch) {
    extracted.tenureMonths = parseInt(yrMatch[1], 10) * 12;
  } else {
    const moMatch = text.match(/\b(\d{1,3})\s*(?:months?|m\b)\b/i);
    if (moMatch) {
      extracted.tenureMonths = parseInt(moMatch[1], 10);
    } else if (context?.expectedField === "tenureMonths") {
      const numMatch = text.match(/\b(\d+)\b/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num >= 1 && num <= 7) extracted.tenureMonths = num * 12;
        else if (num >= 12 && num <= 360) extracted.tenureMonths = num;
      }
    }
  }

  // 5. Existing EMI
  if (/(?:no|0|zero|nil)\s*(?:existing\s*|current\s*|ongoing\s*)?(?:loan|emi|debt)s?|no\s*loans?|zero\s*debt|sab\s*clear|no\s*debt/i.test(norm)) {
    extracted.existingEmi = 0;
  } else if (context?.expectedField === "existingEmi" && /none|zero|0|nil|no|nope|0rs|rs\.?\s*0|0\s*emi|zero\s*debt|sab\s*clear|no\s*debt/i.test(norm)) {
    extracted.existingEmi = 0;
  } else {
    const emiMatch = text.match(
      /(?:existing\s*emi|ongoing\s*emi|current\s*emi|emi)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*k)?)\b/i
    );
    if (emiMatch) {
      const amt = parseFinancialAmount(emiMatch[1]);
      if (amt !== null && amt >= 0) extracted.existingEmi = amt;
    } else if (context?.expectedField === "existingEmi") {
      const amt = parseFinancialAmount(text);
      if (amt !== null && amt >= 0) extracted.existingEmi = amt;
    }
  }

  // 6. Age
  const ageMatch =
    text.match(/\b(?:i\s*am|age\s*(?:is|to|=|:)?)\s*(\d{1,2})\s*(?:years?\s*old|yrs?\s*old)?\b/i) ||
    text.match(/\b(\d{1,2})\s*(?:years?\s*old|yrs?\s*old)\b/i);
  if (ageMatch) {
    const a = parseInt(ageMatch[1], 10);
    if (a >= 18 && a <= 85) extracted.age = a;
  } else if (context?.expectedField === "age") {
    const numMatch = text.match(/\b(1[89]|[2-7]\d)\b/);
    if (numMatch) extracted.age = parseInt(numMatch[1], 10);
  }

  // 7. Employment Type & Status
  if (/(?:jobless|unemployed|no\s*job|without\s*(?:a\s*)?job|laid\s*off|not\s*working)\b/i.test(norm)) {
    extracted.employmentType = "Unemployed";
    extracted.monthlyIncome = 0;
  } else if (/(?:student|in\s*college|studying)\b/i.test(norm)) {
    extracted.employmentType = "Student";
    extracted.monthlyIncome = 0;
  } else if (/(?:self[\s-]*employed|freelanc|business(?!\s*loans?)|proprietor|partnership|partner(?!\s*(?:banks?|lenders?|financial|corporate))|doctor|trader)\b/i.test(norm)) {
    extracted.employmentType = "Self-Employed";
  }

  // 8. Company Name (strictly avoid assigning search intents, general assistance, employment status, locations, or zero answers as company)
  if (!isGeneralAssistanceQuery(text) && !isCompanyInfoOrSearchIntent(text) && !isInvalidCompanyName(text) && !isLocationInput(text)) {
    const compCandidate = extractCompanyCandidateFromText(text, context?.expectedField);
    if (compCandidate && !isCompanyInfoOrSearchIntent(compCandidate) && !isInvalidCompanyName(compCandidate) && !isLocationInput(compCandidate)) {
      extracted.companyName = compCandidate;
    } else if (context?.expectedField === "company" || context?.expectedField === "companyName") {
      const clean = extractCleanCompanyName(text) || text.replace(/^(?:i\s+)?(?:work\s+at|works\s+at|working\s+at|employed\s+at|company\s+is|employer\s+is|at)\s+/i, "").trim();
      if (clean.length >= 2 && !isInvalidCompanyName(clean) && !isLocationInput(clean) && !isCompanyInfoOrSearchIntent(clean)) {
        extracted.companyName = clean;
      }
    }
  }

  // 9. Bank name if mentioned in text (avoid matching "Tata" if part of "Tata Consultancy Services" or user's employer)
  const isTataCompany = /(?:tata\s*consultancy|\btcs\b)/i.test(text);
  const bankMatch = text.match(
    /\b(hdfc|icici|axis|sbi|kotak|bajaj|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|sbm|smfg|utkarsh|fibe|finnable|l&t|cholamandalam|aditya\s*birla|tata\s*capital)\b/i
  ) || (!isTataCompany ? text.match(/\b(tata)\b/i) : null);
  if (bankMatch && !isMultiBankEligibilityQuery(text)) {
    extracted.targetBank = bankMatch[1];
  }

  return extracted;
}

/**
 * Normalizes common bank nicknames to canonical display names.
 */
export function normalizeBankName(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("aditya") || s.includes("abfl") || s.includes("birla")) return "Aditya Birla Capital";
  if (s.includes("hdfc")) return "HDFC Bank";
  if (s.includes("icici")) return "ICICI Bank";
  if (s.includes("axis") && (s.includes("finance") || s.includes("afl"))) return "Axis Finance";
  if (s.includes("axis")) return "Axis Bank";
  if (s.includes("sbi") || s.includes("state bank")) return "SBI";
  if (s.includes("kotak")) return "Kotak Mahindra Bank";
  if (s.includes("bajaj") && (s.includes("market") || s.includes("bfl"))) return "Bajaj Markets";
  if (s.includes("bajaj")) return "Bajaj Finserv";
  if (s.includes("tata capital") || (s.includes("tata") && !s.includes("consultancy") && !s.includes("tcs"))) return "Tata Capital";
  if (s.includes("idfc")) return "IDFC FIRST Bank";
  if (s.includes("indusind")) return "IndusInd Bank";
  if (s.includes("bandhan")) return "Bandhan Bank";
  if (s.includes("yes")) return "Yes Bank";
  if (s.includes("piramal")) return "Piramal Finance";
  if (s.includes("poonawalla") || s.includes("poonawala")) return "Poonawalla Fincorp";
  if (s.includes("chola") || s.includes("cholamandalam")) return "Cholamandalam Investment & Finance";
  if (s.includes("smfg") || s.includes("fullerton")) return "SMFG India Credit";
  if (s.includes("fibe") || s.includes("earlysalary")) return "Fibe (EarlySalary)";
  if (s.includes("finnable")) return "Finnable Credit";
  if (s.includes("sbm")) return "SBM Bank India";
  if (s.includes("utkarsh")) return "Utkarsh Small Finance Bank";
  if (s.includes("home loan")) return "Home Loan Services";
  if (s.includes("l&t") || s.includes("ltf") || s.includes("lt finance")) return "L&T Finance";
  return raw;
}

/**
 * Resilient deterministic fallback parser returning StructuredNluResult.
 * Handles numbers, currency, salary, loan amount, tenure, CIBIL, age, yes/no, not sure,
 * resume/reset/cancel/switch commands, and strict QUESTION != ENTITY UPDATE guards.
 */
export function fallbackMultidimensionalNluParser(
  text: string,
  context?: NluContext
): StructuredNluResult {
  const norm = text.toLowerCase().trim();
  const strippedText = stripGreetingPrefix(text);
  const effectiveNorm = strippedText.toLowerCase().trim() || norm;

  // 1. Reset / Cancel commands
  if (/^(?:cancel|reset|restart|start\s*over|clear\s*(?:chat|session|all)?)\b/i.test(norm)) {
    return {
      messageType: "COMMAND",
      primaryIntent: "CONVERSATION_CONTROL",
      secondaryIntents: ["RESET"],
      conversationAction: "RESET",
      mainUserGoal: "UNKNOWN",
      confidence: { intentConfidence: 0.98, entityConfidence: 1.0, stateConfidence: 1.0 },
      entities: {},
      corrections: [],
    };
  }

  // 2. Resume commands
  if (/^(?:resume|go\s*back(?:\s*to\s*(?:the\s*)?loan)?|continue\s*(?:with\s*)?(?:the\s*)?loan|back\s*to\s*loan)\b/i.test(norm)) {
    return {
      messageType: "COMMAND",
      primaryIntent: "LOAN_ELIGIBILITY",
      secondaryIntents: ["RESUME"],
      conversationAction: "RESUME",
      mainUserGoal: "PERSONAL_LOAN",
      confidence: { intentConfidence: 0.98, entityConfidence: 1.0, stateConfidence: 1.0 },
      entities: {},
      corrections: [],
    };
  }

  // 3. Topic Switch commands
  if (/(?:i\s*changed\s*my\s*mind|change\s*my\s*mind|forget\s*(?:the\s*)?loan|leave\s*loan|switch\s*to|instead\s*of\s*loan|calculate\s*emi\s*instead|show\s*emi\s*instead)/i.test(norm)) {
    if (/(?:calculate|compute|show)?\s*emi/i.test(norm)) {
      return {
        messageType: "COMMAND",
        primaryIntent: "EMI_CALCULATION",
        secondaryIntents: ["TOPIC_SWITCH"],
        conversationAction: "TOPIC_SWITCH",
        mainUserGoal: "EMI_CALCULATION",
        confidence: { intentConfidence: 0.95, entityConfidence: 0.95, stateConfidence: 0.95 },
        entities: {},
        corrections: [],
      };
    }
  }
  if (isCompanyInfoOrSearchIntent(text) || /(?:forget\s*(?:the\s*)?loan|leave\s*loan|switch\s*to|show\s*(?:me\s*)?(?:the\s*)?company|company\s*details)/i.test(norm)) {
    const candidate = extractTargetCompanyFromMessage(text) || extractCompanyCandidateFromText(text);
    const cleanedCandidate = candidate ? candidate.replace(/^(?:show|details\s+for|info\s+on)\s+/i, "").replace(/\s+details\.?$/i, "").trim() : undefined;
    const compMatch = cleanedCandidate && !isCompanyInfoOrSearchIntent(cleanedCandidate) && !isInvalidCompanyName(cleanedCandidate) ? cleanedCandidate : undefined;
    const isExplicitAbandon = /(?:forget\s*(?:the\s*)?loan|leave\s*loan|cancel\s*loan|stop\s*loan|abandon)/i.test(norm);
    return {
      messageType: "COMMAND",
      primaryIntent: "COMPANY_SEARCH",
      secondaryIntents: ["COMPANY_SEARCH"],
      conversationAction: isExplicitAbandon ? "TOPIC_SWITCH" : (context?.isFlowActive ? "TEMPORARY_INTERRUPT" : "NEW_TASK"),
      mainUserGoal: isExplicitAbandon ? "COMPANY_SEARCH" : ((context?.mainUserGoal as MainUserGoal) || (context?.isFlowActive ? "PERSONAL_LOAN" : "COMPANY_SEARCH")),
      confidence: { intentConfidence: 0.95, entityConfidence: 0.95, stateConfidence: 0.95 },
      entities: compMatch ? { companyName: compMatch } : {},
      corrections: [],
    };
  }

  // 4. Pure Greetings
  if (isPureGreeting(text) || isPureGreeting(norm)) {
    return {
      messageType: "STATEMENT",
      primaryIntent: "GREETINGS",
      secondaryIntents: [],
      conversationAction: "NONE",
      mainUserGoal: (context?.mainUserGoal as MainUserGoal) || "UNKNOWN",
      confidence: { intentConfidence: 0.98, entityConfidence: 1.0, stateConfidence: 1.0 },
      entities: {},
      corrections: [],
    };
  }

  // 4b. General Assistance / Capabilities Query (e.g., "how can u help me", "hoe can u help me", "what can you do", "help me")
  if (isGeneralAssistanceQuery(text)) {
    return {
      messageType: "QUESTION",
      primaryIntent: "GENERAL_ASSISTANCE",
      secondaryIntents: [],
      conversationAction: context?.isFlowActive ? "TEMPORARY_INTERRUPT" : "NONE",
      mainUserGoal: "GENERAL_ASSISTANCE",
      confidence: { intentConfidence: 0.99, entityConfidence: 1.0, stateConfidence: 1.0 },
      entities: {},
      corrections: [],
    };
  }

  // 5. Corrections (e.g., "My salary is 45k, not 39k" or "salary 45k not 39k" or "change salary to 45k")
  const correctionMatch = text.match(
    /(?:my\s+)?(salary|income|loan(?:\s*amount)?|cibil|tenure|age|emi)\s*(?:is|=|:)?\s*([\w\d,.\s₹]+?)\s*(?:,\s*|\s+)not\s+([\w\d,.\s₹]+)/i
  ) || text.match(
    /(?:change|update|correct)\s+(?:my\s+)?(salary|income|loan(?:\s*amount)?|cibil|tenure|age|emi)\s*(?:to|=)?\s*([\w\d,.\s₹]+)/i
  );

  if (correctionMatch) {
    const rawField = correctionMatch[1].toLowerCase();
    const rawNewVal = correctionMatch[2].trim();
    const rawOldVal = correctionMatch[3] ? correctionMatch[3].trim() : undefined;

    let fieldName: EntityCorrection["field"] = "monthlyIncome";
    let parsedNewVal: any = rawNewVal;
    let parsedOldVal: any = rawOldVal;

    if (rawField.includes("salary") || rawField.includes("income")) {
      fieldName = "monthlyIncome";
      parsedNewVal = parseFinancialAmount(rawNewVal) ?? rawNewVal;
      if (rawOldVal) parsedOldVal = parseFinancialAmount(rawOldVal) ?? rawOldVal;
    } else if (rawField.includes("loan")) {
      fieldName = "loanAmount";
      parsedNewVal = parseFinancialAmount(rawNewVal) ?? rawNewVal;
      if (rawOldVal) parsedOldVal = parseFinancialAmount(rawOldVal) ?? rawOldVal;
    } else if (rawField.includes("cibil")) {
      fieldName = "cibil";
      parsedNewVal = parseInt(rawNewVal.replace(/\D/g, ""), 10) || rawNewVal;
      if (rawOldVal) parsedOldVal = parseInt(rawOldVal.replace(/\D/g, ""), 10) || rawOldVal;
    } else if (rawField.includes("tenure")) {
      fieldName = "tenureMonths";
      const yrs = rawNewVal.match(/(\d+)\s*(?:yr|year)/i);
      parsedNewVal = yrs ? parseInt(yrs[1], 10) * 12 : (parseInt(rawNewVal.replace(/\D/g, ""), 10) || rawNewVal);
    } else if (rawField.includes("emi")) {
      fieldName = "existingEmi";
      parsedNewVal = parseFinancialAmount(rawNewVal) ?? rawNewVal;
      if (rawOldVal) parsedOldVal = parseFinancialAmount(rawOldVal) ?? rawOldVal;
    } else if (rawField.includes("age")) {
      fieldName = "age";
      parsedNewVal = parseInt(rawNewVal.replace(/\D/g, ""), 10) || rawNewVal;
    }

    const corrections: EntityCorrection[] = [{
      field: fieldName,
      newValue: parsedNewVal,
      oldValue: parsedOldVal,
      rawExpression: text,
    }];

    const entities: ExtractedEntities = {};
    (entities as any)[fieldName] = parsedNewVal;

    return {
      messageType: "STATEMENT",
      primaryIntent: "CHANGING_DETAILS",
      secondaryIntents: [],
      conversationAction: "CORRECTION",
      mainUserGoal: (context?.mainUserGoal as MainUserGoal) || "PERSONAL_LOAN",
      confidence: { intentConfidence: 0.95, entityConfidence: 0.95, stateConfidence: 0.95 },
      entities,
      corrections,
    };
  }

  // 6. Context-Aware "76" Ambiguity Guard (Standalone small numbers)
  const pureNumMatch = norm.match(/^(?:rs\.?|₹)?\s*(\d{1,8})\s*$/i);
  if (pureNumMatch) {
    const val = parseInt(pureNumMatch[1], 10);
    if (val > 0 && val <= 100) {
      if (context?.expectedField === "cibil") {
        return {
          messageType: "ANSWER",
          primaryIntent: "LOAN_ELIGIBILITY",
          secondaryIntents: [],
          conversationAction: "CONTINUE",
          mainUserGoal: "PERSONAL_LOAN",
          confidence: { intentConfidence: 0.5, entityConfidence: 0.2, stateConfidence: 0.8 },
          entities: {},
          corrections: [],
          clarificationRequired: {
            isAmbiguous: true,
            reason: "CIBIL score out of range (300-900)",
            clarificationPrompt: "CIBIL scores range from 300 to 900. Did you mean a different score?",
          },
        };
      }
      if (context?.expectedField === "loanAmount") {
        return {
          messageType: "ANSWER",
          primaryIntent: "LOAN_ELIGIBILITY",
          secondaryIntents: [],
          conversationAction: "CONTINUE",
          mainUserGoal: "PERSONAL_LOAN",
          confidence: { intentConfidence: 0.5, entityConfidence: 0.2, stateConfidence: 0.8 },
          entities: {},
          corrections: [],
          clarificationRequired: {
            isAmbiguous: true,
            reason: "Ambiguous loan amount scale",
            clarificationPrompt: `Could you please clarify if by **${val}** you mean **₹${val} Lakhs** or **₹${val},000**? (Personal loans typically start from ₹50,000).`,
          },
        };
      }
      if (context?.expectedField === "monthlyIncome") {
        return {
          messageType: "ANSWER",
          primaryIntent: "LOAN_ELIGIBILITY",
          secondaryIntents: [],
          conversationAction: "CONTINUE",
          mainUserGoal: "PERSONAL_LOAN",
          confidence: { intentConfidence: 0.5, entityConfidence: 0.2, stateConfidence: 0.8 },
          entities: {},
          corrections: [],
          clarificationRequired: {
            isAmbiguous: true,
            reason: "Ambiguous salary scale",
            clarificationPrompt: `Could you please clarify if by **${val}** you mean **₹${val},000/month**?`,
          },
        };
      }
      if (!context?.expectedField || context.expectedField === "companyName" || context.expectedField === "company") {
        return {
          messageType: "ANSWER",
          primaryIntent: "GENERAL_ASSISTANCE",
          secondaryIntents: [],
          conversationAction: "NONE",
          mainUserGoal: "UNKNOWN",
          confidence: { intentConfidence: 0.5, entityConfidence: 0.2, stateConfidence: 0.5 },
          entities: {},
          corrections: [],
          clarificationRequired: {
            isAmbiguous: true,
            reason: "Unanchored numeric input",
            clarificationPrompt: `Could you please clarify what ${val} refers to — is it your age, tenure, or something else?`,
          },
        };
      }
    }
  }

  // 6b. Natural Multi-Bank Loan Eligibility Intent (CRITICAL RULE Section 2)
  // When user asks: "Check my loan eligibility across partner banks", "Which banks can I get a loan from?",
  // "Am I eligible for a personal loan?", "Check eligibility for all banks", "Compare my eligibility",
  // "Find the best bank for me", "Which partner banks am I eligible for?", "Check all lenders",
  // DO NOT interpret as a single bank policy lookup!
  if (isMultiBankEligibilityQuery(text)) {
    const extracted = extractEntitiesFromText(text, context);
    extracted.targetBank = undefined;
    const isQuestion = /\?$/.test(text.trim()) || /^(?:which|can|am|what|where|how)\b/i.test(effectiveNorm);
    return {
      messageType: isQuestion ? "QUESTION" : "COMMAND",
      primaryIntent: "MULTI_BANK_ELIGIBILITY_CHECK",
      secondaryIntents: ["MULTI_BANK_ELIGIBILITY_CHECK"],
      conversationAction: context?.isFlowActive ? "CONTINUE" : "NEW_TASK",
      mainUserGoal: "PERSONAL_LOAN",
      confidence: { intentConfidence: 0.99, entityConfidence: 0.95, stateConfidence: 0.98 },
      entities: extracted,
      corrections: [],
      targetBank: undefined,
      questionTopic: "MULTI_BANK_ELIGIBILITY",
    };
  }

  // 6c. Dedicated Bank Policy / Guidelines Detection
  const isNaturalLoanQuestion = /^(?:can\s*i\s*get\s*a\s*loan|can\s*i\s*get\s*personal\s*loan|am\s*i\s*eligible\s*for\s*(?:a\s*)?loan)/i.test(effectiveNorm);

  const isBankPolicyPhrase =
    !isMultiBankEligibilityQuery(effectiveNorm) &&
    /(?:policy|policies|guidelines?|rules?|criteria|cutoff|cut-off|\bfoir\b|requirement|requirements|\bdocs?\b|\bdocuments?\b|tenure|roi|interest\s*rate|eligibility\s*criteria|what.*loan\s*amount|how\s*much.*loan|loan\s*amount.*approve|max(?:imum)?\s*(?:loan|foir|tenure|amount)|min(?:imum)?\s*(?:salary|cibil|income|amount|age)|\bcibil\b|require(?:\s+\w+)?\s*(?:salary|income)|how\s*much.*lend|minimum\s*income)\b/i.test(effectiveNorm) &&
    /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|\btata\b(?!.*consultancy)|idfc|indusind|bandhan|yes\s*bank|\byes\b|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe|sbm|utkarsh|aditya|abfl|birla|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb|partner\s*banks?)/i.test(effectiveNorm) &&
    !isNaturalLoanQuestion;

  if (isBankPolicyPhrase) {
    const bankMatch = text.match(/\b(hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|idfc|indusind|bandhan|yes\s*bank|yes|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe|sbm|utkarsh|aditya|abfl|birla|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)\b/i);
    const targetBank = bankMatch ? normalizeBankName(bankMatch[1]) : undefined;
    return {
      messageType: "QUESTION",
      primaryIntent: "BANK_POLICY",
      secondaryIntents: ["BANK_POLICY"],
      conversationAction: "TOPIC_SWITCH",
      mainUserGoal: "BANK_POLICY",
      confidence: { intentConfidence: 0.98, entityConfidence: 1.0, stateConfidence: 0.98 },
      entities: {},
      corrections: [],
      targetBank,
      questionTopic: "BANK_POLICY",
    };
  }

  // 6d. Proceed with Bank Loan / Connect with Branch or Manager Detection
  const isProceedWithBankPhrase =
    /(?:proceed\s+with\s+(?:the\s+|this\s+)?(?:bank|loan)?|apply\s+(?:for|with)\s+(?:the\s+|this\s+)?(?:bank|loan)?|i\s+want\s+to\s+proceed|how\s+to\s+proceed|how\s+to\s+apply|connect\s+(?:me\s+)?with\s+(?:the\s+)?(?:branch|manager)|contact\s+(?:the\s+)?manager|talk\s+to\s+(?:the\s+)?manager|find\s+(?:the\s+)?(?:bank\s+)?branch)/i.test(effectiveNorm) ||
    (effectiveNorm.startsWith("proceed") && (effectiveNorm.includes("bank") || effectiveNorm.includes("loan")));

  if (isProceedWithBankPhrase) {
    const bankMatch = text.match(/\b(hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|idfc|indusind|bandhan|yes\s*bank|yes|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe|sbm|utkarsh|aditya|abfl|birla|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)\b/i);
    const targetBank = bankMatch ? normalizeBankName(bankMatch[1]) : ((context as any)?.targetBank || undefined);
    return {
      messageType: "COMMAND",
      primaryIntent: "BANK_MANAGER_SEARCH",
      secondaryIntents: ["PROCEED_WITH_BANK"],
      conversationAction: "TOPIC_SWITCH",
      mainUserGoal: "BANK_MANAGER_SEARCH",
      confidence: { intentConfidence: 0.95, entityConfidence: 0.9, stateConfidence: 0.95 },
      entities: extractEntitiesFromText(text, context),
      corrections: [],
      targetBank,
      questionTopic: "BANK_MANAGER",
    };
  }

  // 7. Question Detection: QUESTION != ENTITY UPDATE
  const isQuestionSyntax =
    /^(?:what|which|how|who|where|why|can\s*(?:you|i)|could|is\s*there|does|tell\s*me|explain)\b/i.test(effectiveNorm) ||
    /\?$/.test(text.trim()) ||
    /(?:documents\s*required|eligibility\s*criteria\s*for|what\s*documents|what\s*is\s*foir|explain\s*foir|policies|policy)/i.test(effectiveNorm);

  if (isQuestionSyntax && !isNaturalLoanQuestion && !isMultiBankEligibilityQuery(effectiveNorm)) {
    let qIntent = "GENERAL_ASSISTANCE";
    let qTopic: string | undefined = undefined;
    let targetBank: string | undefined = undefined;

    if (/(?:document|docs?|paperwork|kyc)/i.test(norm)) {
      qIntent = "BANK_DOCUMENT_REQUIREMENTS";
      qTopic = "BANK_DOCUMENT_REQUIREMENTS";
    } else if (/(?:category|rating|listing|tier)\s+(?:of|for)\b/i.test(norm) || /(?:what\s+is\s+(?:the\s+)?category)/i.test(norm)) {
      qIntent = "COMPANY_SEARCH";
      qTopic = "COMPANY_CATEGORY";
    } else if (/(?:manager|contact|phone|mobile|branch\s*head|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b)/i.test(norm)) {
      qIntent = "BANK_MANAGER_SEARCH";
      qTopic = "BANK_MANAGER";
    } else if (
      /(?:policy|guideline|rules?|criteria|cutoff|cut-off|requirement)/i.test(norm) ||
      /(?:min(?:imum)?\s*(?:cibil|salary|income|loan|amount|tenure)|max(?:imum)?\s*(?:loan|amount|foir|tenure|salary))/i.test(norm) ||
      /(?:cibil\s*(?:score\s*)?(?:required|cutoff|rule|requirement|criteria)|foir\s*(?:allowed|limit|cap|max|rule))/i.test(norm)
    ) {
      qIntent = "BANK_POLICY";
      qTopic = "BANK_POLICY";
    } else if (/(?:cibil|credit\s*score)/i.test(norm)) {
      qIntent = "CONCEPTUAL_FINANCIAL_QUESTION";
      qTopic = "CIBIL";
    } else if (/(?:emi|equated\s*monthly\s*installment)/i.test(norm)) {
      qIntent = "CONCEPTUAL_FINANCIAL_QUESTION";
      qTopic = "EMI";
    } else if (/(?:foir|apr|irr|roi|multiplier|part[\s-]*payment|foreclosure|prepayment)/i.test(norm)) {
      qIntent = "CONCEPTUAL_FINANCIAL_QUESTION";
      qTopic = norm.includes("foir") ? "FOIR" : "FINANCIAL_CONCEPT";
    }

    const bankMatch = text.match(/\b(hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|chola|smfg|finnable|fibe|sbm|utkarsh|aditya|abfl|birla|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)\b/i);
    if (bankMatch) {
      targetBank = normalizeBankName(bankMatch[1]);
    }

    // STRICT INVARIANT: QUESTION != ENTITY UPDATE
    // Numbers or figures in questions must NEVER be extracted as applicant state!
    return {
      messageType: "QUESTION",
      primaryIntent: qIntent,
      secondaryIntents: qTopic ? [qTopic] : [],
      conversationAction: context?.isFlowActive ? "TEMPORARY_INTERRUPT" : "NONE",
      mainUserGoal: (context?.mainUserGoal as MainUserGoal) || (context?.isFlowActive ? "PERSONAL_LOAN" : "UNKNOWN"),
      confidence: { intentConfidence: 0.95, entityConfidence: 1.0, stateConfidence: 0.95 },
      entities: {},
      corrections: [],
      targetBank,
      questionTopic: qTopic,
    };
  }

  // 8. Calculations (EMI)
  const isEmiCalc =
    /(?:calculate|compute)\s+(?:my\s+)?(?:emi|installment|interest|loan)/i.test(norm) ||
    /(?:what\s+(?:is|will\s+be)\s+my\s+emi|how\s+much\s+(?:is\s+the\s+)?emi)/i.test(norm) ||
    /\bcalculate\s+emi\b/i.test(norm);

  if (isEmiCalc && context?.expectedField !== "existingEmi") {
    const extracted = extractEntitiesFromText(text, context);
    return {
      messageType: "COMMAND",
      primaryIntent: "EMI_CALCULATION",
      secondaryIntents: [],
      conversationAction: context?.isFlowActive ? "TOPIC_SWITCH" : "NEW_TASK",
      mainUserGoal: "EMI_CALCULATION",
      confidence: { intentConfidence: 0.92, entityConfidence: 0.9, stateConfidence: 0.9 },
      entities: extracted,
      corrections: [],
    };
  }

  // 9. Standard Entity Extraction & Multi-Entity
  const extracted = extractEntitiesFromText(text, context);
  const applicantCount = [
    extracted.monthlyIncome,
    extracted.cibil,
    extracted.loanAmount,
    extracted.tenureMonths,
    extracted.companyName,
    extracted.existingEmi,
    extracted.age,
    extracted.employmentType,
  ].filter((v) => v !== undefined && v !== null && v !== "").length;

  // 10. Natural Loan Intent phrases
  const isNaturalLoan =
    /(?:i\s*(?:need|want|require|wish|am\s*looking\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(effectiveNorm) ||
    /(?:apply\s*(?:for)?\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(effectiveNorm) ||
    /(?:can\s*i\s*(?:get|have|avail|take|apply\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(effectiveNorm) ||
    /(?:can\s*i\s*get\s*(?:a\s*)?loan)/i.test(effectiveNorm) ||
    /^(?:i\s*need\s*a\s*loan|i\s*want\s*a\s*loan|can\s*i\s*get\s*a\s*loan|loan\s*chahiye|need\s*loan|get\s*me\s*a\s*loan)\b/i.test(effectiveNorm) ||
    /(?:check|evaluate|calculate|find\s*out)\s*(?:my\s*)?(?:personal\s*)?(?:loan\s*)?eligib/i.test(effectiveNorm);

  if (isNaturalLoan || applicantCount >= 2) {
    return {
      messageType: applicantCount > 0 ? "STATEMENT" : "COMMAND",
      primaryIntent: "LOAN_ELIGIBILITY",
      secondaryIntents: [],
      conversationAction: "CONTINUE",
      mainUserGoal: "PERSONAL_LOAN",
      confidence: { intentConfidence: 0.95, entityConfidence: 0.95, stateConfidence: 0.95 },
      entities: extracted,
      corrections: [],
    };
  }

  // 11. Answering active expected field in flow
  if (context?.isFlowActive && context?.expectedField) {
    return {
      messageType: "ANSWER",
      primaryIntent: "LOAN_ELIGIBILITY",
      secondaryIntents: [],
      conversationAction: "CONTINUE",
      mainUserGoal: (context?.mainUserGoal as MainUserGoal) || "PERSONAL_LOAN",
      confidence: { intentConfidence: 0.95, entityConfidence: 0.9, stateConfidence: 0.95 },
      entities: extracted,
      corrections: [],
    };
  }

  // 12. General fallback
  return {
    messageType: "STATEMENT",
    primaryIntent: "GENERAL_ASSISTANCE",
    secondaryIntents: [],
    conversationAction: "NONE",
    mainUserGoal: (context?.mainUserGoal as MainUserGoal) || "UNKNOWN",
    confidence: { intentConfidence: 0.7, entityConfidence: 0.7, stateConfidence: 0.7 },
    entities: extracted,
    corrections: [],
  };
}

/**
 * Resilient fallback parser used ONLY if the LLM endpoint is unreachable.
 */
export function fallbackIntentParser(
  text: string,
  context?: { isFlowActive?: boolean; expectedField?: string }
): IntentClassificationResult {
  const res = fallbackMultidimensionalNluParser(text, context);
  return {
    intent: normalizeIntentName(res.primaryIntent),
    subIntent: res.questionTopic || (res.secondaryIntents.length > 0 ? res.secondaryIntents[0] : undefined),
    confidence: res.confidence.intentConfidence,
    loanType: "Personal Loan",
    extracted: res.entities,
    rawResponse: res.rawReasoning,
  };
}
