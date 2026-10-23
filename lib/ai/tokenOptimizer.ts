// lib/ai/tokenOptimizer.ts

/**
 * Token Optimization & Budgeting Configuration for CreditWise AI.
 * 
 * Implements strict, configurable input and output token budgets mapped directly
 * to intelligent user intents as defined in the architectural specifications.
 */

export type CanonicalIntent =
  | "GENERAL_QUERY"
  | "EXTERNAL_INFORMATION_QUERY"
  | "BANK_POLICY_QUERY"
  | "LOAN_TYPE_OR_LOAN_PROCESS_QUERY"
  | "COMPANY_SEARCH_OR_VERIFICATION"
  | "LOAN_ELIGIBILITY"
  | "LOAN_ELIGIBILITY_CALCULATION"
  | "ELIGIBILITY_UPDATE_OR_RECALCULATION"
  | "BANK_MANAGER_SEARCH"
  | "CONVERSATION_FOLLOW_UP"
  | "INFORMATION_CORRECTION"
  | "MULTI_INTENT"
  | "AMBIGUOUS_INTENT"
  // Master Architectural Phase 2 Supported Intents
  | "GREETING_OR_SMALL_TALK"
  | "ELIGIBILITY_START"
  | "ELIGIBILITY_FIELD_ANSWER"
  | "COMPANY_SEARCH"
  | "COMPANY_INFORMATION"
  | "COMPANY_CATEGORY"
  | "BANK_POLICY"
  | "BANK_MANAGER_LOOKUP"
  | "ELIGIBILITY_RECALCULATION"
  | "ELIGIBILITY_RESULT_EXPLANATION"
  | "GENERAL_QUESTION"
  | "TOPIC_INTERRUPTION"
  | "TOPIC_RESUMPTION"
  | "AMBIGUOUS_INPUT";

export type SpecificSubCategory =
  | "GREETING"
  | "DETAILED_EDUCATIONAL"
  | "DETAILED_ELIGIBILITY_REPORT";

export interface IntentBudgetConfig {
  inputMinTokens: number;
  inputMaxTokens: number;
  outputMinTokens: number;
  outputMaxTokens: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  retrieval: string;
}

/**
 * Canonical Token Limits Table:
 * | Intent | Input budget | Output budget | Retrieval |
 * |---|---:|---:|---|
 * | Greeting | 500–1,000 | 30–80 | None |
 * | General question | 1,000–2,500 | 150–400 | None |
 * | Detailed educational explanation | 2,000–4,000 | 400–800 | Usually none |
 * | External information search | 2,000–5,000 | 250–600 | External search when needed |
 * | Bank policy question | 3,000–6,000 | 250–600 | Semantic RAG |
 * | Loan process explanation | 2,000–5,000 | 250–600 | RAG when bank-specific facts are required |
 * | Company verification | 1,500–4,000 | 150–400 | Company database/API |
 * | Eligibility calculation | 2,000–5,000 | 400–900 | Existing calculation engine |
 * | Detailed eligibility report | 3,000–6,000 | 700–1,200 | Calculation results and relevant policy evidence |
 * | Bank manager search | 1,000–3,000 | 150–350 | PostgreSQL |
 * | Complex multi-intent request | 4,000–8,000 | 500–1,000 | Only required tools |
 */
export const INTENT_BUDGETS: Record<CanonicalIntent | SpecificSubCategory, IntentBudgetConfig> = {
  GREETING: {
    inputMinTokens: 500,
    inputMaxTokens: 1000,
    outputMinTokens: 30,
    outputMaxTokens: 80,
    retrieval: "None",
  },
  GREETING_OR_SMALL_TALK: {
    inputMinTokens: 500,
    inputMaxTokens: 1000,
    outputMinTokens: 30,
    outputMaxTokens: 80,
    retrieval: "None",
  },
  GENERAL_QUERY: {
    inputMinTokens: 1000,
    inputMaxTokens: 2500,
    outputMinTokens: 150,
    outputMaxTokens: 400,
    retrieval: "None",
  },
  DETAILED_EDUCATIONAL: {
    inputMinTokens: 2000,
    inputMaxTokens: 4000,
    outputMinTokens: 400,
    outputMaxTokens: 800,
    retrieval: "Usually none",
  },
  EXTERNAL_INFORMATION_QUERY: {
    inputMinTokens: 2000,
    inputMaxTokens: 5000,
    outputMinTokens: 250,
    outputMaxTokens: 600,
    retrieval: "External search when needed",
  },
  BANK_POLICY_QUERY: {
    inputMinTokens: 3000,
    inputMaxTokens: 6000,
    outputMinTokens: 250,
    outputMaxTokens: 600,
    retrieval: "Semantic RAG",
  },
  LOAN_TYPE_OR_LOAN_PROCESS_QUERY: {
    inputMinTokens: 2000,
    inputMaxTokens: 5000,
    outputMinTokens: 250,
    outputMaxTokens: 600,
    retrieval: "RAG when bank-specific facts are required",
  },
  COMPANY_SEARCH_OR_VERIFICATION: {
    inputMinTokens: 1500,
    inputMaxTokens: 4000,
    outputMinTokens: 150,
    outputMaxTokens: 400,
    retrieval: "Company database/API",
  },
  LOAN_ELIGIBILITY_CALCULATION: {
    inputMinTokens: 2000,
    inputMaxTokens: 5000,
    outputMinTokens: 400,
    outputMaxTokens: 900,
    retrieval: "Existing calculation engine",
  },
  LOAN_ELIGIBILITY: {
    inputMinTokens: 2000,
    inputMaxTokens: 5000,
    outputMinTokens: 400,
    outputMaxTokens: 900,
    retrieval: "Existing calculation engine",
  },
  ELIGIBILITY_UPDATE_OR_RECALCULATION: {
    inputMinTokens: 2000,
    inputMaxTokens: 5000,
    outputMinTokens: 400,
    outputMaxTokens: 900,
    retrieval: "Existing calculation engine",
  },
  DETAILED_ELIGIBILITY_REPORT: {
    inputMinTokens: 3000,
    inputMaxTokens: 6000,
    outputMinTokens: 700,
    outputMaxTokens: 1200,
    retrieval: "Calculation results and relevant policy evidence",
  },
  BANK_MANAGER_SEARCH: {
    inputMinTokens: 1000,
    inputMaxTokens: 3000,
    outputMinTokens: 150,
    outputMaxTokens: 350,
    retrieval: "PostgreSQL",
  },
  CONVERSATION_FOLLOW_UP: {
    inputMinTokens: 1500,
    inputMaxTokens: 3500,
    outputMinTokens: 150,
    outputMaxTokens: 400,
    retrieval: "Context-dependent",
  },
  INFORMATION_CORRECTION: {
    inputMinTokens: 1500,
    inputMaxTokens: 3500,
    outputMinTokens: 150,
    outputMaxTokens: 400,
    retrieval: "Context-dependent",
  },
  MULTI_INTENT: {
    inputMinTokens: 4000,
    inputMaxTokens: 8000,
    outputMinTokens: 500,
    outputMaxTokens: 1000,
    retrieval: "Only required tools",
  },
  AMBIGUOUS_INTENT: {
    inputMinTokens: 1000,
    inputMaxTokens: 2000,
    outputMinTokens: 100,
    outputMaxTokens: 250,
    retrieval: "None",
  },
  ELIGIBILITY_START: {
    inputMinTokens: 2000,
    inputMaxTokens: 5000,
    outputMinTokens: 400,
    outputMaxTokens: 900,
    retrieval: "Existing calculation engine",
  },
  ELIGIBILITY_FIELD_ANSWER: {
    inputMinTokens: 2000,
    inputMaxTokens: 5000,
    outputMinTokens: 400,
    outputMaxTokens: 900,
    retrieval: "Existing calculation engine",
  },
  COMPANY_SEARCH: {
    inputMinTokens: 1500,
    inputMaxTokens: 4000,
    outputMinTokens: 150,
    outputMaxTokens: 400,
    retrieval: "Company database/API",
  },
  COMPANY_INFORMATION: {
    inputMinTokens: 1500,
    inputMaxTokens: 4000,
    outputMinTokens: 150,
    outputMaxTokens: 400,
    retrieval: "Company database/API",
  },
  COMPANY_CATEGORY: {
    inputMinTokens: 1500,
    inputMaxTokens: 4000,
    outputMinTokens: 150,
    outputMaxTokens: 400,
    retrieval: "Company database/API",
  },
  BANK_POLICY: {
    inputMinTokens: 3000,
    inputMaxTokens: 6000,
    outputMinTokens: 250,
    outputMaxTokens: 600,
    retrieval: "Semantic RAG",
  },
  BANK_MANAGER_LOOKUP: {
    inputMinTokens: 1000,
    inputMaxTokens: 3000,
    outputMinTokens: 150,
    outputMaxTokens: 350,
    retrieval: "PostgreSQL",
  },
  ELIGIBILITY_RECALCULATION: {
    inputMinTokens: 2000,
    inputMaxTokens: 5000,
    outputMinTokens: 400,
    outputMaxTokens: 900,
    retrieval: "Existing calculation engine",
  },
  ELIGIBILITY_RESULT_EXPLANATION: {
    inputMinTokens: 3000,
    inputMaxTokens: 6000,
    outputMinTokens: 700,
    outputMaxTokens: 1200,
    retrieval: "Calculation results and relevant policy evidence",
  },
  GENERAL_QUESTION: {
    inputMinTokens: 1000,
    inputMaxTokens: 2500,
    outputMinTokens: 150,
    outputMaxTokens: 400,
    retrieval: "None",
  },
  TOPIC_INTERRUPTION: {
    inputMinTokens: 1500,
    inputMaxTokens: 3500,
    outputMinTokens: 150,
    outputMaxTokens: 400,
    retrieval: "Context-dependent",
  },
  TOPIC_RESUMPTION: {
    inputMinTokens: 1500,
    inputMaxTokens: 3500,
    outputMinTokens: 150,
    outputMaxTokens: 400,
    retrieval: "Context-dependent",
  },
  AMBIGUOUS_INPUT: {
    inputMinTokens: 1000,
    inputMaxTokens: 2000,
    outputMinTokens: 100,
    outputMaxTokens: 250,
    retrieval: "None",
  },
};

/**
 * Resolves the token budget for a given intent and sub-category.
 */
export function getTokenBudget(
  intent: CanonicalIntent,
  options?: {
    isGreeting?: boolean;
    isDetailedEducational?: boolean;
    isDetailedReport?: boolean;
  }
): IntentBudgetConfig {
  const budget =
    (options?.isGreeting && INTENT_BUDGETS.GREETING) ||
    (intent === "GENERAL_QUERY" && options?.isDetailedEducational && INTENT_BUDGETS.DETAILED_EDUCATIONAL) ||
    ((intent === "LOAN_ELIGIBILITY_CALCULATION" || intent === "ELIGIBILITY_UPDATE_OR_RECALCULATION") &&
      options?.isDetailedReport &&
      INTENT_BUDGETS.DETAILED_ELIGIBILITY_REPORT) ||
    INTENT_BUDGETS[intent] ||
    INTENT_BUDGETS.GENERAL_QUERY;

  return {
    ...budget,
    maxInputTokens: budget.inputMaxTokens,
    maxOutputTokens: budget.outputMaxTokens,
  };
}

/**
 * Truncates message history to ensure the total tokens stay well within the input budget.
 * Assumes an average of ~4 characters per token.
 */
export function pruneHistoryToBudget(
  history: Array<{ role: string; content: string }>,
  maxInputTokens: number
): Array<{ role: string; content: string }> {
  if (!history || history.length === 0) return [];
  const maxChars = maxInputTokens * 4;
  let accumulatedChars = 0;
  const prunedReversed: Array<{ role: string; content: string }> = [];

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const msgLen = (msg.content || "").length;
    if (accumulatedChars + msgLen > maxChars) {
      break;
    }
    accumulatedChars += msgLen;
    prunedReversed.push(msg);
  }

  return prunedReversed.reverse();
}
