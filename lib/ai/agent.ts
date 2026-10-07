// lib/ai/agent.ts

import { AsyncLocalStorage } from "async_hooks";
export const agentTokenStorage = new AsyncLocalStorage<(token: string) => void>();

import pool from "@/lib/db";
import {
  answerPolicyWithRag,
  resolvePolicyTarget,
  getActivePolicyBanks,
  formatAvailablePolicyBanksList,
  isBankPolicyAvailable,
} from "@/lib/policyRag";
import { processAntigravityWebhook, SessionVariables, WATERFALL_PROMPTS, normalizeLoanAmount, normalizeTenureMonths, extractParametersFromConversationHistory, extractEntitiesFromRawText } from "@/lib/ai/antigravityWebhook";
import { isGeneralFinancialQuery, answerGeneralFinancialQuery, RESUME_TRANSITION_LINE, isGeneralLoanAssistanceQuery, getGeneralLoanAssistanceReply, buildContextualEligibilityResumptionBridge } from "@/lib/ai/generalFinancialQueries";
import { detectCompanyFollowUp, resolveContextualCompany as resolveCompanyFromContext, executeCompanyFollowUpAnswer } from "@/lib/ai/companyFollowUp";
import { extractSpecificBankPolicyParameter, formatBankPolicyComparison, formatCategorySalaryAcrossBanks, formatBankDocumentTable, formatDocumentComparisonAcrossBanks } from "@/lib/ai/bankPolicyFormatter";
import { extractEntitiesFromText } from "@/lib/ai/intentClassifier";
import { searchBankManager, formatManagers, findBankBranches, formatBankManagersTable, getUniqueBranches, getUniqueManagerRecords, BankManagerRecord } from "@/lib/bankSearch";
import { searchCompany, formatCompanyResponse, formatCompanyCandidateList, findCompanySuggestions, CompanyCandidate } from "@/lib/companySearch";
import {
  processEligibilityFlow,
  evaluateEligibilityFromTool,
  calculateEmi,
  formatEmiResult,
  createLoanIntentFlow,
} from "@/lib/eligibilityWizard";
import {
  detectLoanIntent,
  getEligibilityState,
  clearEligibilityState,
  saveEligibilityState,
  isInvalidCompanyName,
  isFinancialOrProfileInput,
  isPureGreeting,
  isGreetingOrPleasantry,
  hasGreetingPrefix,
  stripGreetingPrefix,
  extractApplicantDetails,
  extractSecondaryParameters,
  detectTargetedFieldInMessage,
  getRequiredPolicyFields,
  evaluateApplicantAgainstAllBanks,
  formatDynamicEligibilityReport,
  formatMultiBankEligibilityReport,
  buildMultiBankIntakePrompt,
  isMultiBankEligibilityQuery,
  generateDynamicSingleQuestionWithLLM,
  parseFinancialAmount,
  ApplicantProfile,
  applyProfileUpdateAndRecalculate,
  extractProfileUpdates,
  extractCompanyCandidateFromText,
  extractCompoundLoanCompanyIntent,
  isCompanyInfoOrSearchIntent,
  extractTargetCompanyFromMessage,
  extractCleanCompanyName,
  consolidateApplicantProfileFromHistory,
  detectFieldPromptedInAssistantMessage,
  isKnownBankName,
  resolveBankName,
  resolvePincodeToCity,
  generatePreliminaryRecommendation,
  extractBankBranchLocationParams,
  reconcileBankManagerEntities,
  BankManagerSearchEntities,
  PostEligibilityStage,
  isSameBank,
  isValidIndianPincode,
  recordMatchesBranch,
  isLocationInput,
  KNOWN_MAJOR_CITIES,
  isConfirmationResponse,
  extractTypedLoanEntities,
  detectLoanType,
  logFlowDebug,
  updateNormalizedLoanState,
  formatStateSummary,
  TypedLoanEntities,
  detectAndAnswerSideQuestion,
  detectCompanyDisavowal,
  detectTopicSwitchIntent,
  TopicSwitchIntentResult,
  isOutOfDomainRequest,
  validateAndSanitizeEntityUpdate,
  runInvariantSanityChecks,
  TaskStackItem,
  SessionState,
  pushTaskToStack,
  popTaskFromStack,
  peekActiveTask,
  ENTITY_DOMAIN_MAP,
  isGeneralAssistanceQuery,
  formatGeneralAssistanceResponse,
  isHowAreYouQuery,
  formatHowAreYouResponse,
} from "@/lib/dynamicEligibilityEngine";
import { getConversationContext, safeMergeApplicantProfile } from "@/lib/ai/contextBuilder";
import { resolveCompanyCategories } from "@/lib/companyCategoryResolver";
import {
  classifyIntentWithLLM,
  IntentClassificationResult,
  ExtractedEntities,
  cleanLlmJsonOutput,
  analyzeConversationSemanticIntent,
  StructuredNluResult,
  NluContext,
  normalizeBankName,
  isQuestionMessage,
  isBankComparisonQuery,
} from "@/lib/ai/intentClassifier";
import { planResponse, getHumanFieldLabel } from "@/lib/ai/responsePlanner";
import { normalizeModelSlug } from "@/lib/openrouter";
import { searchIncraax, incraaxSearch, isIncraaxSearchConfigured, fetchLiveCompanyIntelligence } from "@/lib/incraax";

const LLM_TIMEOUT_MS = 25000;

export const ELIGIBILITY_FIELD_SEQUENCE = [
  "company",
  "monthlyIncome",
  "existingEmi",
  "cibilScore",
  "age",
] as const;

export type EligibilityField = (typeof ELIGIBILITY_FIELD_SEQUENCE)[number];

export const MANDATORY_COMPANY_PROMPT =
  "To check your personal loan eligibility and calculate eligible category limits across our 23+ partner banks, what is the name of your current employer or company (e.g., TCS, Infosys, Wipro, Accenture, or any other employer)?";

export function isExplicitTopicSwitch(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const norm = text.toLowerCase().trim();
  return (
    /\b(?:actually|instead|switch\s*(?:to)?|change\s*(?:to)?|forget\s*(?:about\s*)?(?:the\s*)?loan|stop\s*(?:the\s*)?loan|cancel\s*(?:the\s*)?loan|don'?t\s*want\s*(?:a\s*)?loan|no\s*more\s*loan|drop\s*(?:the\s*)?loan|leave\s*(?:the\s*)?loan|pause\s*(?:the\s*)?loan|not\s*now|another\s*topic|different\s*topic)\b/i.test(norm) ||
    /^(?:check\s+[a-z\s&.-]+\s+policy\s+instead|show\s+me\s+policy\s+instead|calculate\s+emi\s+instead|tell\s+me\s+about\s+[a-z\s&.-]+\s+policy)\b/i.test(norm) ||
    /\b(?:education(?:al)?\s*loan|student\s*loan|home\s*loan|house\s*loan|mortgage|car\s*loan|auto\s*loan|vehicle\s*loan|business\s*loan|msme\s*loan|credit\s*card)\b/i.test(norm) ||
    /\b(?:application\s*process|how\s*to\s*apply|tell\s*me\s*(?:the\s*)?process|don'?t\s*know\s*(?:the\s*)?process|loan\s*process|steps?\s+to\s+apply)\b/i.test(norm)
  );
}

export function isMissingOrPlaceholderCompany(comp?: string | null): boolean {
  if (!comp || typeof comp !== "string") return true;
  const trimmed = comp.trim();
  if (trimmed.length < 2) return true;
  if (
    /^(?:a\s+home|home|open\s*market|unknown|not\s*(?:provided|specified|applicable|available|sure)|unlisted|none|nil|na|n\/a|standard\s*(?:corporate|salaried)|corporate)$/i.test(
      trimmed
    )
  ) {
    return true;
  }
  return isInvalidCompanyName(trimmed) || isLocationInput(trimmed);
}

export function extractNormalizedPolicyCategory(
  bankRecords?: Array<{ company_category?: string; category?: string }>,
  fallbackCategory?: string
): "Super CAT A" | "CAT A" | "CAT B" | "CAT C" | "Unlisted" {
  if (bankRecords && bankRecords.length > 0) {
    let hasSuperCatA = false;
    let hasCatA = false;
    let hasCatB = false;
    let hasCatC = false;

    for (const r of bankRecords) {
      const cat = String(r.company_category || r.category || "").toLowerCase();
      if (/\b(?:super\s*cat\s*a|cat\s*super\s*a|super\s*a|cat\s*sa)\b/i.test(cat)) {
        hasSuperCatA = true;
      } else if (
        /\b(?:cat\s*a\+?|category\s*a|tier\s*1|elite|diamond|super\s*prime|top\s*corporate|tge|tata\s*group)\b/i.test(
          cat
        )
      ) {
        hasCatA = true;
      } else if (
        /\b(?:cat\s*b\+?|category\s*b|tier\s*2|platinum|gold|preferred|prime)\b/i.test(
          cat
        )
      ) {
        hasCatB = true;
      } else if (
        /\b(?:cat\s*c|category\s*c|tier\s*3|silver|standard)\b/i.test(cat)
      ) {
        hasCatC = true;
      }
    }

    if (hasSuperCatA) return "Super CAT A";
    if (hasCatA) return "CAT A";
    if (hasCatB) return "CAT B";
    if (hasCatC) return "CAT C";
  }

  if (fallbackCategory) {
    const cat = fallbackCategory.toLowerCase();
    if (/\bsuper\s*cat\s*a\b|\bsuper\s*a\b/i.test(cat)) return "Super CAT A";
    if (/\bcat\s*a\b|\btier\s*1\b|\belite\b/i.test(cat)) return "CAT A";
    if (/\bcat\s*b\b|\btier\s*2\b|\bpreferred\b/i.test(cat)) return "CAT B";
    if (/\bcat\s*c\b|\btier\s*3\b|\bstandard\b/i.test(cat)) return "CAT C";
  }

  return "Unlisted";
}

export interface AgentResult {
  reply: string;
  bankData?: any;
  companyData?: any;
  companyQuery?: string | null;
  customState?: any;
}

export interface CompanySelectionAction {
  type: "confirm" | "retry" | "select";
  companyId?: string;
  companyName?: string;
}

export const OPENROUTER_TOOLS = [
  {
    type: "function",
    function: {
      name: "calculate_emi",
      description:
        "Calculates estimated monthly EMI, installment breakdown, interest payable, or borrowing capacity for personal loans. Use when the user asks for EMI calculation, monthly payment, or interest calculation.",
      parameters: {
        type: "object",
        properties: {
          principal: { type: "number", description: "Loan principal amount in INR (e.g. 500000)" },
          rate: { type: "number", description: "Annual interest rate percentage (e.g. 10.5)" },
          tenureMonths: { type: "number", description: "Repayment tenure in months (e.g. 36 or 60)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_master_policy",
      description:
        "Looks up official partner bank policy rules, CIBIL cutoffs, permissible FOIR limits, salary criteria, multipliers, or repayment tenure directly from the bank's Master Policy .txt file. Also use for ANY request asking for bank policy (including unsupported, unavailable, or unknown banks like 'Tell me the policy of a bank that isn't available', 'What is Citibank policy?', etc.) so the system can verify policy availability and respond appropriately.",
      parameters: {
        type: "object",
        properties: {
          bankName: { type: "string", description: "Bank name if mentioned (e.g. HDFC, ICICI, Axis, SBI, Citibank, or any other bank)" },
          questionTopic: { type: "string", description: "The specific policy topic or question being asked" },
        },
        required: ["questionTopic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_company_category",
      description:
        "Searches 339,000+ corporate employer records across partner banks for company tier and category ratings (e.g. Super CAT A, CAT A, Elite, Diamond, Government). Use when the user asks about an employer listing, company rating, or corporate tier.",
      parameters: {
        type: "object",
        properties: {
          companyName: { type: "string", description: "Name of the employer or corporate entity (e.g. TCS, Infosys, Wipro)" },
        },
        required: ["companyName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_loan_eligibility",
      description:
        "Initiates, continues, or evaluates personal loan eligibility across all partner banks using official Master Policy rules. Call whenever the user expresses loan intent naturally or asks about their eligibility across banks (e.g. 'What banks am I eligible for?', 'Which banks can I get a loan from?', 'Which bank is best for my loan?', 'Am I eligible for a loan?', 'Which banks will give me a loan?', 'I need a loan', 'I want a personal loan', 'I want to apply for a loan', 'Can I get a loan?', 'I need ₹5 lakh loan'), requests a personal loan, or provides personal profile details (salary, loan amount, tenure, CIBIL, EMIs, age) to advance an assessment.",
      parameters: {
        type: "object",
        properties: {
          companyName: { type: "string", description: "Employer or corporate workplace name" },
          monthlyIncome: { type: "number", description: "Net monthly take-home salary in INR" },
          loanAmount: { type: "number", description: "Requested loan amount in INR" },
          tenureMonths: { type: "number", description: "Preferred tenure in months (e.g. 3 years = 36)" },
          cibil: { type: "number", description: "Credit score (300-900 or 0 for new to credit)" },
          existingEmi: { type: "number", description: "Ongoing monthly loan EMIs in INR (0 if none)" },
          age: { type: "number", description: "Applicant age in years" },
          employmentType: { type: "string", description: "Salaried or Self-Employed" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_applicant_profile",
      description:
        "Explicitly updates or corrects one or more previously provided profile parameters (e.g. 'Actually change my salary to 1.2 lakhs', 'Update tenure to 5 years', 'Correct CIBIL to 780'). Strictly replaces old values and triggers immediate recalculation if profile is complete.",
      parameters: {
        type: "object",
        properties: {
          monthlyIncome: { type: "number", description: "Updated net monthly salary in INR" },
          loanAmount: { type: "number", description: "Updated loan amount in INR" },
          tenureMonths: { type: "number", description: "Updated tenure in months" },
          cibil: { type: "number", description: "Updated CIBIL credit score" },
          existingEmi: { type: "number", description: "Updated existing monthly EMIs in INR" },
          age: { type: "number", description: "Updated age in years" },
          companyName: { type: "string", description: "Updated company name" },
          employmentType: { type: "string", description: "Updated employment type" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "answer_general_question",
      description:
        "Answers general financial and banking concept questions (e.g. 'What is FOIR?', 'How does reducing balance interest work?'), greetings, pleasantries, FAQs, or requests to cancel/reset.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The concept, question, or greeting to respond to" },
          subType: {
            type: "string",
            enum: ["CONCEPT_DEFINITION", "GREETING", "CANCEL_RESET", "CASUAL_CHAT", "GENERAL_FAQ"],
            description: "Sub-type classification of the inquiry",
          },
          conceptName: { type: "string", description: "Financial concept name if defining a term (e.g. 'FOIR', 'APR', 'CIBIL')" },
        },
        required: ["question", "subType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "incraax_search",
      description:
        "Performs live web search via Incraax for real-time financial news, live bank interest rate revisions, regulatory changes, or general web inquiries.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for Incraax live web search" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_bank_managers",
      description:
        "Searches official bank manager contacts (ASM, RSM, Branch Head) in the database. Use only when the user explicitly asks for manager directory contacts, phone numbers, or branch representatives.",
      parameters: {
        type: "object",
        properties: {
          bank_name: { type: "string", description: "Bank name e.g. HDFC, ICICI, Axis, SBI, Kotak" },
          city: { type: "string", description: "City or location name" },
          pincode: { type: "string", description: "6-digit postal code" },
          role: { type: "string", description: "Manager role e.g. ASM, RSM, RM" },
        },
      },
    },
  },
];

const ASSISTANT_TOOLS = OPENROUTER_TOOLS;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = (process.env.OPENROUTER_MODEL || "openrouter/free").replace(/^["']|["']$/g, "").trim();
const getApiKey = () => process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
const getModel = () => normalizeModelSlug((process.env.OPENROUTER_MODEL || OPENROUTER_MODEL || "openrouter/free").replace(/^["']|["']$/g, "").trim());

/**
 * Answers bank-specific policy questions using ONLY that bank's official Master Policy document.
 * Strictly adheres to policy text without guessing, defaults, or borrowing from other banks.
 */
/**
 * Contextualizes elliptical follow-up questions like "What about Axis Finance?"
 * by inspecting recent conversation history to see if a specific parameter (e.g. CIBIL, salary) was discussed.
 */
function contextualizeEllipticalPolicyQuery(
  userMessage: string,
  conversationHistory?: Array<{ role: string; content: string }>
): string {
  const norm = userMessage.toLowerCase().trim();
  const isElliptical =
    /^(?:what\s+about|how\s+about|and\s+what\s+about|and|what\s+of|tell\s+me\s+about)\s+/i.test(norm) ||
    /^(?:what\s+about|how\s+about|and)\s+[a-z0-9\s&'.-]+[?]?$/i.test(norm);

  if (isElliptical && conversationHistory && conversationHistory.length > 0) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const prev = conversationHistory[i];
      if (prev.role === "user") {
        const prevText = prev.content.toLowerCase();
        if (/\bcibil\w*|credit\s*score/i.test(prevText)) {
          return `${userMessage} CIBIL score requirement`;
        }
        if (/\bsalary\b|\bnth\b|\bincome\b|\btake\s*home\b/i.test(prevText)) {
          return `${userMessage} salary income requirement`;
        }
        if (/\bage\b/i.test(prevText)) {
          return `${userMessage} age requirement`;
        }
        if (/\bdoc\w*|paperwork|payslip/i.test(prevText)) {
          return `${userMessage} documents required`;
        }
        if (/\bfoir\b|obligation/i.test(prevText)) {
          return `${userMessage} FOIR criteria`;
        }
        if (/\broi\b|interest|rate/i.test(prevText)) {
          return `${userMessage} interest rate ROI`;
        }
        if (/\btenure\b|loan\s*amount/i.test(prevText)) {
          return `${userMessage} loan amount and tenure`;
        }
      }
    }
  }
  return userMessage;
}

/**
 * Scans conversation history to infer the most recent bank or lender discussed.
 */
function getRecentBankFromHistory(history?: Array<{ role: string; content: string }>): string | undefined {
  if (!history || history.length === 0) return undefined;
  const bankPatterns: Array<{ name: string; regex: RegExp }> = [
    { name: "Axis Finance", regex: /\b(?:axis\s*finance|afl)\b/i },
    { name: "Axis Bank", regex: /\b(?:axis\s*bank|\baxis\b(?!.*finance))\b/i },
    { name: "Bandhan Bank", regex: /\bbandhan\b/i },
    { name: "HDFC Bank", regex: /\bhdfc\b/i },
    { name: "ICICI Bank", regex: /\bicici\b/i },
    { name: "Kotak Mahindra Bank", regex: /\bkotak\b/i },
    { name: "Tata Capital", regex: /\btata\s*capital\b/i },
    { name: "Bajaj Finserv", regex: /\bbajaj\s*finserv\b/i },
    { name: "Bajaj Markets", regex: /\bbajaj\s*markets\b/i },
    { name: "IDFC FIRST Bank", regex: /\bidfc\b/i },
    { name: "IndusInd Bank", regex: /\bindusind\b/i },
    { name: "Yes Bank", regex: /\byes\s*bank\b/i },
    { name: "Piramal Finance", regex: /\bpiramal\b/i },
    { name: "Poonawalla Fincorp", regex: /\bpoonawalla\b/i },
    { name: "SMFG India Credit", regex: /\bsmfg\b/i },
    { name: "Finnable Credit", regex: /\bfinnable\b/i },
    { name: "Fibe (EarlySalary)", regex: /\bfibe\b/i },
    { name: "Utkarsh Small Finance Bank", regex: /\butkarsh\b/i },
    { name: "Aditya Birla Capital", regex: /\b(?:aditya|abfl|birla)\b/i },
  ];
  for (let i = history.length - 1; i >= 0; i--) {
    const text = history[i].content || "";
    for (const bp of bankPatterns) {
      if (bp.regex.test(text)) {
        return bp.name;
      }
    }
  }
  return undefined;
}

/**
 * Handles comparative inquiries between lenders (e.g. Axis Bank vs Axis Finance).
 */
async function handleBankPolicyComparison(
  userMessage: string,
  banks: string[],
  conversationHistory?: Array<{ role: string; content: string }>,
  requestedModel?: string
): Promise<string> {
  let bankA = banks[0];
  let bankB = banks[1];

  if (!bankA || !bankB) {
    const found: string[] = [...banks];
    if (conversationHistory && conversationHistory.length > 0) {
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const text = conversationHistory[i].content;
        if (/axis\s*finance/i.test(text) && !found.includes("Axis Finance")) found.push("Axis Finance");
        if (/axis\s*bank|\baxis\b/i.test(text) && !/axis\s*finance/i.test(text) && !found.includes("Axis Bank")) found.push("Axis Bank");
        if (/hdfc/i.test(text) && !found.includes("HDFC Bank")) found.push("HDFC Bank");
        if (/icici/i.test(text) && !found.includes("ICICI Bank")) found.push("ICICI Bank");
        if (/kotak/i.test(text) && !found.includes("Kotak Mahindra Bank")) found.push("Kotak Mahindra Bank");
        if (/tata/i.test(text) && !found.includes("Tata Capital")) found.push("Tata Capital");
        if (/bandhan/i.test(text) && !found.includes("Bandhan Bank")) found.push("Bandhan Bank");
        if (found.length >= 2) break;
      }
    }
    bankA = found[0] || "Axis Bank";
    bankB = found[1] || "Axis Finance";
  }

  return formatBankPolicyComparison(bankA, bankB);
}

/**
 * Canonical bank policy question answering via CreditWise Policy RAG.
 * Resolves policy target from database, retrieves via PolicyPgVectorRetriever,
 * builds context via buildPolicyContext, and generates response via generatePolicyRagResponse.
 */
async function answerBankPolicyWithMasterPolicy(
  bankName: string,
  userMessage: string,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<string> {
  // CreditWise Policy RAG: Canonical policy target resolution via PostgreSQL (banks JOIN bank_policy_files)
  const policyTarget = await resolvePolicyTarget(bankName);
  if (!policyTarget) {
    return await formatBankPolicyNotAvailableResponse(bankName);
  }

  const effectiveQuery = contextualizeEllipticalPolicyQuery(userMessage, conversationHistory);

  // AGENTS.md Directive: If the user asks ONLY for documents or a single specific parameter,
  // return ONLY that parameter directly and accurately in tabular format.
  const isDocQuery = /\b(?:doc|docs|document|documents|paperwork|payslip|statement|kyc|proof|checklist)\b/i.test(effectiveQuery);
  if (isDocQuery) {
    const docTable = formatBankDocumentTable(policyTarget.bankName);
    if (docTable) {
      return docTable;
    }
  }

  const singleParamCount = [
    /\bcibil\w*|credit\s*score/i.test(effectiveQuery),
    /\bsalary\b|\bnth\b|\bincome\b|\btake\s*home\b/i.test(effectiveQuery),
    /\bage\b/i.test(effectiveQuery),
    /\bdoc\w*|paperwork|payslip/i.test(effectiveQuery),
    /\bfoir\b|obligation/i.test(effectiveQuery),
    /\broi\b|interest|rate/i.test(effectiveQuery),
    /\btenure\b|loan\s*amount/i.test(effectiveQuery),
  ].filter(Boolean).length;

  if (singleParamCount === 1) {
    const directSpecificAns = extractSpecificBankPolicyParameter(policyTarget.bankName, effectiveQuery);
    if (directSpecificAns) {
      return directSpecificAns;
    }
  }

  try {
    const streamToken = agentTokenStorage.getStore();
    const isMultiTopic = /(salary|income|nth).*(cibil|score|age)|(cibil|score).*(salary|income|age)|category|categories|all criteria/i.test(effectiveQuery);
    const ragResult = await answerPolicyWithRag({
      query: effectiveQuery,
      policyFileId: policyTarget.policyFileId,
      bankId: policyTarget.bankId,
      bankName: policyTarget.bankName,
      bankCode: policyTarget.bankCode,
      fileName: policyTarget.fileName,
      topK: isMultiTopic ? 8 : 6,
      onToken: streamToken,
    });
    console.log(
      `[POLICY-RAG-DEBUG] bank=${policyTarget.bankName} policyFileId=${policyTarget.policyFileId} bankId=${policyTarget.bankId} route=POLICY_RAG retrievedChunks=${ragResult?.retrievedChunks || 0}`
    );
    if (ragResult && ragResult.answer) {
      // Check if ragResult.answer is an unintended refusal for a general or valid policy query
      if (
        ragResult.answer.includes("The retrieved policy evidence does not specify this requirement.") ||
        (ragResult.answer.includes("Not specified in the available policy.") && ragResult.answer.length < 250)
      ) {
        console.warn(`[PolicyRAG] Refusal returned for known bank ${policyTarget.bankName}, evaluating comprehensive fallback.`);
        const specificAns = extractSpecificBankPolicyParameter(policyTarget.bankName, effectiveQuery);
        if (specificAns) {
          return specificAns;
        }
        return formatComprehensiveBankPolicy("", policyTarget.bankName);
      }
      return ragResult.answer;
    }
  } catch (ragErr) {
    console.error("[PolicyRAG] Canonical RAG generation error, falling back to comprehensive policy:", ragErr);
    const specificAns = extractSpecificBankPolicyParameter(policyTarget.bankName, effectiveQuery);
    if (specificAns) {
      return specificAns;
    }
    return formatComprehensiveBankPolicy("", policyTarget.bankName);
  }

  // Fallback to comprehensive policy summary
  const specificAns = extractSpecificBankPolicyParameter(policyTarget.bankName, effectiveQuery);
  if (specificAns) {
    return specificAns;
  }
  return formatComprehensiveBankPolicy("", policyTarget.bankName);
}

function sanitizePolicyResponse(raw: string): string {
  let cleaned = stripReasoningPreamble(raw);
  cleaned = cleaned.replace(/^User Safety:[^\n]*\n*/gi, "").trim();
  cleaned = cleaned
    .replace(/\bNOT_DEFINED\s*\/\s*NEEDS_REVIEW\b/gi, "Not specified in the available policy.")
    .replace(/\bNOT_DEFINED\b/gi, "Not specified in the available policy.")
    .replace(/\bNEEDS_REVIEW\b/gi, "")
    .replace(/\[REVIEW\]/gi, "")
    .replace(/\[CONFLICT\]/gi, "");

  const filteredLines = cleaned.split(/\r?\n/).filter((line) => {
    const l = line.toLowerCase();
    if (l.includes("postgresql") || l.includes("mini cam") || l.includes("database table") || l.includes("parser")) return false;
    if (l.includes("internal instruction") || l.includes("admin attention") || l.includes("for ai decision-making")) return false;
    return true;
  });

  return filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function cleanPolicyValue(v?: string | null): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s || /NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]|\[CONFLICT\]/i.test(s)) return null;
  return s;
}

/**
 * SYSTEM INSTRUCTION FOR POLICY FILES:
 * 1. Whenever a user inquires about a specific bank/company loan policy (e.g., Finnable Credit),
 *    parse the uploaded .txt document and summarize the key criteria comprehensively.
 * 2. Structure the output clearly using Markdown sections:
 *    - Eligibility Criteria (Age, CIBIL, Work Experience)
 *    - Salary & Bank Requirements (NTH, Payment Mode)
 *    - Loan Parameters (Min/Max Amount, Tenure, ROI)
 *    - Document Requirements
 *    - Rejection Rules & Exceptions
 * 3. Avoid truncating responses into small incomplete tables.
 */
function formatComprehensiveBankPolicy(policyContent: string, bankName: string): string {
  const bLower = bankName.toLowerCase();
  const NOT_SPECIFIED = "Not specified in the available policy.";

  const cleanText = (s?: string | null): string => {
    if (!s) return "";
    return s
      .replace(/\bNOT_DEFINED\s*\/\s*NEEDS_REVIEW\b/gi, NOT_SPECIFIED)
      .replace(/\bNOT_DEFINED\b/gi, NOT_SPECIFIED)
      .replace(/\bNEEDS_REVIEW\b/gi, "")
      .replace(/\[REVIEW\]/gi, "")
      .replace(/\[CONFLICT\]/gi, "")
      .replace(/\bpostgresql\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // 1. FINNABLE CREDIT
  if (bLower.includes("finnable")) {
    return `### 🏦 Finnable Credit — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years *(Note: Age > 45 with Net Monthly Salary < ₹30,000 is strictly not eligible)*
• **CIBIL / Bureau Score**: Minimum CIBIL score of 700; CIBIL -1 / 0 / NTC (New-to-Credit) is doable; No 30 DPD in the latest month; No 90 DPD in the last 3 months
• **Work Experience & Vintage**: Minimum 6 months continuous total employment; 3 months salary credit in bank account mandatory with current company; 1 year company vintage in MCA required if PF is not debited (company vintage requirement is waived if PF is debited)
• **Employment Types**: Salaried individuals across accepted entities (All Pvt Ltd companies, LLP, Schools, Colleges, Hospitals, Government establishments, Partnership firms, Proprietorship firms, Construction, and Builder firms)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹20,000/month for Tier 1 Cities; Minimum ₹15,000/month for Tier 2 Cities
• **Payment Mode**: Mandatory online salary credit by NEFT only *(Strictly NO cash, UPI, IMPS, or Cheque salary credits accepted)*
• **Bank Account Requirements**: Salary must be credited directly to active bank account; Mandatory 3 months consecutive salary credit in current company; 4 months operative bank statements required

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹50,000 to Maximum ₹10,00,000 *(Partnership / Proprietorship firms capped between ₹50,000 to ₹4,50,000)*
• **Tenure**: Minimum 12 months, Maximum 36 months *(Extended up to 48 months / 4 years for loan amounts ≥ ₹3,00,000)*
• **Rate of Interest (ROI)**: Starting from 15% to 30% per annum on reducing principal basis
• **Processing Fees & Foreclosure**: No prepayment charges; No foreclosure charges *(Zero prepayment penalty; credit line facility available)*

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: 4 months operative bank statements showing salary credits
• **Salary Credit Proof**: 3 months salary credit via NEFT online transfer
• **Address Proof**: Not mandatory if address is verified via official KYC

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Any 30 DPD in the latest month
  - Any 90 DPD in the last 3 months
  - Applicant Age > 45 years with Net Monthly Salary < ₹30,000
  - Salary credit mode is not NEFT (UPI, IMPS, Cheque, or Cash salary credits will be rejected)
  - Partnership or Proprietorship firm employees without PF deduction or at least 1 active PL track (min ₹50,000)
• **Exceptions & Deviations**:
  - New-to-Credit (CIBIL 0 / -1 / NTC) applicants are accepted
  - Partnership / Proprietorship employees are eligible if PF is deducted OR if holding 1 active PL track of ₹50,000+
  - MCA company vintage waived if PF is debited for Pvt Ltd and LLP entities`;
  }

  // 2. HDFC BANK
  if (bLower.includes("hdfc")) {
    return `### 🏦 HDFC Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years *(Current Age + Tenure must not exceed retirement age of max 60 years)*
• **CIBIL / Bureau Score**: Rate-card pricing structured into CIBIL > 730 (lowest rack rates starting from 11.15%) and CIBIL ≤ 730 / No Hit slabs; positive CIC / Hunter match required; no loan availed or cancelled in last 30/31 days; CIBIL 0 / -1 doable with Note code
• **Work Experience & Vintage**: Minimum 1 year current employment & 2 years total work experience *(varies by CAT: Govt GA 2 years, Railway RA 3 years; current stability 50% of age or 3 years post TDS / 12 months)*
• **Employment Types**: Salaried individuals across approved categories (CAT Super A, CAT A, CAT B, CAT C, CAT D, CAT E, CAT GA/GB, CAT RA/RB/RC, CAT GD/GE/GF)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum Net Monthly Salary ₹25,000 for Internal CSA customers and non-HDFC Salary Account holders; ₹35,000–₹50,000 basis profile; Golden Edge Program: ₹75,000 (Prime Locations) / ₹50,000 (Emerging Locations); CAT GA ≥ ₹50,000; CAT GB ≥ ₹25,000
• **Payment Mode**: Mandatory direct online bank salary credit into active bank account
• **Bank Account Requirements**: Mandatory 3 months salary credit in bank account; 3 months operative bank statements required

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹50,000, Maximum ₹40,00,000 *(varies by CAT: CAT Super A / CAT A up to ₹40L, CAT B/C up to ₹25L, CAT D/E up to ₹10L, CAT GA up to ₹40L, Golden Edge min ₹10L)*
• **Tenure**: Minimum 12 months, Maximum 60 months standard *(Extended up to 72 or 84 months for Super A / CAT A / CAT HDFC / CAT GA / CAT RA)*
• **Rate of Interest (ROI)**: Starting from 11.00% to 14.50% based on CIBIL score slab (>730 vs ≤730), employer category, and loan amount
• **Processing Fees & Foreclosure**: Rack PF ₹3,499 (income < ₹50k) to ₹6,500 (income ≥ ₹50k or loan ≥ ₹10L); 100% unsecured / no collateral

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card (Aadhaar OVD KYC / e-KYC / offline XML verification), Photograph
• **Income Proof**: 3 Latest Salary Slips, Form-16
• **Banking Proof**: 3 Months Bank Statement showing salary credit
• **Employment Proof**: Employee ID Card, Appointment letter, confirmation letter, or HR letter confirming employment; positive CPV
• **Document Waiver**: Documents can be waived for existing pre-approved HDFC Bank customers

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Any loan availed or cancelled in the last 30/31 days
  - Current Age + Tenure exceeding retirement age (max 60 years)
  - Salary not meeting minimum NTH requirements for applicable category
  - Employment stability norms not satisfied
  - Permissible FOIR exceeded (standard FOIR cap 75%)
  - Product / category loan cap exceeded
• **Exceptions & Deviations**:
  - CIBIL 0 / -1 acceptable with Note code updated
  - Additional 3% FOIR (up to 78%) for Government A-B & DA categories
  - Bonus income can be considered for loan eligibility calculation (without extending FOIR)
  - Golden Edge Program available for high-value loans (₹10 Lakhs+)`;
  }

  // 3. ICICI BANK
  if (bLower.includes("icici")) {
    return `### 🏦 ICICI Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 22 to 60 years *(or retirement age, whichever is earlier)*
• **CIBIL / Bureau Score**: Tiered pricing bands: Tier 1 (CIBIL ≥ 770, prime rates), Tier 2 (725–769 / 0 / -1, standard rates), Tier 3 (< 725, subprime); absolute minimum approval cutoff is Not specified in the available policy
• **Work Experience & Vintage**: Minimum 2 years total work experience with at least 1 year in current organization
• **Employment Types**: Salaried individuals across mapped categories (ICICI Group, Top Corporate, Elite, Super-Prime, Preferred, Open Market, Government)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Evaluated basis employer category and pricing band *(General baseline entry salary Not specified in the available policy)*
• **Payment Mode**: Mandatory direct salary credit through official corporate banking channel
• **Bank Account Requirements**: Operative salary account with minimum 3 months salary credit verification; clean banking track

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹50,000; Pricing bands defined up to ₹30 Lakhs+ *(Absolute maximum cap is Not specified in the available policy)*
• **Tenure**: Minimum 12 months, Maximum 60 months standard *(Extended terms up to 72 months for select corporate categories)*
• **Rate of Interest (ROI)**: Risk-based pricing bands based on employer category and CIBIL score tier
• **Processing Fees & Foreclosure**: Standard processing fee and foreclosure rules per ICICI rack rate schedule

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card, Passport / Voter ID; Separate Aadhaar Consent Letter required
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: 3 to 6 months bank statement showing regular salary credits
• **Employment Proof**: Official corporate email ID verification or employee ID card

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL Tier 3 high-risk profiles not meeting underwriting risk threshold
  - Unmapped employer category without credit deviation
  - Irregular salary credits or cash salary modes
  - Non-compliance with Aadhaar consent or verification norms
• **Exceptions & Deviations**:
  - CIBIL 0 / -1 (New-to-Credit) eligible under Tier 2 pricing bands
  - Preferred terms and fast-track processing for ICICI salary account holders`;
  }

  // 4. KOTAK MAHINDRA BANK
  if (bLower.includes("kotak")) {
    return `### 🏦 Kotak Mahindra Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years
• **CIBIL / Bureau Score**: Minimum CIBIL ≥ 700 to 750 depending on category & loan program; Bureau track verification required
• **Work Experience & Vintage**: Minimum 1 to 2 years total work experience with employer stability norms
• **Employment Types**: Salaried employees across mapped categories (Elite, Cat A, Cat B, Cat C, Open Market)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹25,000 to ₹40,000/month *(varies by CAT: Elite/Cat A/B/C)*
• **Payment Mode**: Mandatory salary credit via direct bank account transfer
• **Bank Account Requirements**: Clean banking track with strict cheque/EMI bounce count restrictions; 3 months bank statements required

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: ₹1 Lakh to ₹35 Lakhs *(varies by CAT: up to ₹40 Lakhs for select top corporate categories)*
• **Tenure**: Minimum 12 months, Maximum 60 months *(Extended up to 72 months for select categories)*
• **Rate of Interest (ROI)**: Starting from 10.99% per annum depending on corporate category and bureau score
• **Processing Fees & Foreclosure**: Foreclosure permitted after specified lock-in period with applicable charges

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card / Valid Address Proof (per acceptable address proofs list)
• **Income Proof**: 3 months latest salary slips
• **Banking Proof**: 3 to 6 months bank statement showing continuous salary credits
• **Employment Proof**: Company ID card, appointment letter / official confirmation

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Cheque bounce or EMI bounce count exceeding permissible threshold
  - Salary below minimum CAT threshold
  - Unapproved company sector or negative profile list
  - Overleveraged profile exceeding maximum FOIR (50% to 70%)
• **Exceptions & Deviations**:
  - Balance Transfer (BT) and Credit Card BT (CCBT) permitted for eligible profiles
  - Hybrid OD facility available for qualified corporate relationships`;
  }

  // 5. TATA CAPITAL
  if (bLower.includes("tata")) {
    return `### 🏦 Tata Capital — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: Minimum 21 years, Maximum 58 years *(At last EMI, subject to maximum 65 years under normal salaried policy)*
• **CIBIL / Bureau Score**: Normal salaried base policy: 725+; Updated policy separately allows CIBIL 0 / -1 under applicable programs
• **Work Experience & Vintage**: Current employment: Minimum 12 months; Total employment stability: 24 months *(Waived if age ≥ 26 with 1 year current stability, or eligible individual tradeline > ₹1L opened > 2 yrs ago)*; Current residence: Min 6 months
• **Employment Types**: Salaried profiles across approved categories (Tata Group Employees, Super CAT A, CAT A, CAT B, CAT C, Government, Unlisted)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Tata Group Employee (TGE): ₹15,000; Super CAT A / CAT A: ₹20,000; CAT B / Government: ₹25,000; Unlisted Company: ₹27,000; For Loan > ₹25 Lakhs: Min ₹1.50 Lakhs/month
• **Payment Mode**: Mandatory salary credit directly to bank account
• **Bank Account Requirements**: Operative salary bank account; ABB = 1 time proposed EMI applies to CAT C and unapproved companies

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹75,000; Maximum up to ₹35 Lakhs for applicable categories *(CAT C capped at ₹25 Lakhs; for > ₹25L, Credit Life Insurance is mandatory)*
• **Tenure**: Up to 72 months for eligible profiles *(CAT C normal salaried: Max 60 months; Salary > ₹30,000 required for 72-month tenure)*
• **Rate of Interest (ROI)**: Competitive rack rates based on employer category and bureau profile
• **Processing Fees & Foreclosure**: Standard processing fee and foreclosure norms as per active grid

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card, Passport / Voter ID
• **Income Proof**: Latest 3 months salary slips; bonus slips required if considering bonus income
• **Banking Proof**: 3 to 6 months bank statement; alternate banking allowed for ABB calculation
• **Employment Proof**: Employee ID card, appointment letter / vintage verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL score < 725 for normal salaried programs
  - Minimum salary below category threshold (e.g. < ₹15k TGE, < ₹20k Cat A, < ₹25k Cat B)
  - FOIR exceeding limits: Salary ≤ ₹25k: Max FOIR 50%; ₹25k–₹50k: Max FOIR 60%; ₹50k–₹75k: Max FOIR 65%; > ₹75k: Max FOIR 75%
  - Insufficient job or residence stability
• **Exceptions & Deviations**:
  - CIBIL 0 / -1 allowed under updated programs
  - 70% of average of last 2 gross bonuses considered for additional income
  - Job stability proof waived for age ≥ 26 with 1 year current employment`;
  }

  // 6a. AXIS FINANCE (NBFC - distinct from Axis Bank)
  if (bLower.includes("axis finance") || bLower === "afl") {
    return `### 🏦 Axis Finance — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 59 years *(standard; up to 62 years for Government employees with retirement proof, 65 years for Professors, 50 years for BSNL employees)*
• **CIBIL / Bureau Score**: Minimum CIBIL score of **720** (range 720 to 750 across loan programs); clean repayment track required
• **Work Experience & Vintage**: Minimum **6 months continuous employment**; positive employment verification
• **Employment Types**: Salaried individuals across approved corporate employer categories

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum Net Monthly Income (NMI) **₹25,000 to ₹40,000+** basis employer category
• **Payment Mode**: Mandatory salary credit into active bank account via official banking channels
• **Bank Account Requirements**: 3 to 6 months ePDF bank statement with regular salary credits required; NACH mandate

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to **₹40 Lakhs** (multiplier up to 30x of monthly income)
• **Tenure**: Up to **84 months (7 years)** on assisted programs; standard tenure 12 to 60 months
• **Rate of Interest (ROI)**: Competitive pricing slabs basis bureau rating and risk tier
• **Special Programs**: Bharat Program, Flexi, PL Shift Plus, SUPER EDGE, All-in-One; FOIR allowed up to **75%**

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips, Form-16
• **Banking Proof**: 3 to 6 months bank statement showing regular salary credit
• **Employment Proof**: Employee ID card, official email ID verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL score below 720
  - Bank statement not showing regular salary credit
  - Failed NACH mandate or negative Hunter fraud check match
• **Exceptions & Deviations**:
  - High tenure up to 84 months and FOIR up to 75% available under assisted programs
  - Fast-track digital disbursal in 30 minutes for qualified corporate profiles`;
  }

  // 6b. AXIS BANK (Scheduled Commercial Bank)
  if (bLower.includes("axis")) {
    return `### 🏦 Axis Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years *(or retirement age, whichever is earlier)*
• **CIBIL / Bureau Score**: CIBIL ≥ 700 to 740+ based on Net Monthly Income (NMI) slabs: NMI ₹35k–₹85k: CIBIL ≥ 700–740+; NMI > ₹85k: CIBIL ≥ 700+; NMI > ₹100k: CIBIL ≥ 740+
• **Work Experience & Vintage**: Minimum 1 year continuous employment; Hunter match and bureau verification mandatory
• **Employment Types**: Salaried individuals across approved corporate/government employer categories

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Net Monthly Income (NMI) ₹35,000 to ₹85,000+ basis program/category
• **Payment Mode**: Mandatory salary credit into active bank account via banking channels
• **Bank Account Requirements**: 6 months ePDF bank statement with regular salary credits required; NACH mandate

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹40 Lakhs *(varies by CAT: lower categories capped at ₹15 Lakhs)*
• **Tenure**: Up to 84 months (7 years) for high-tenure assisted programs; standard tenure 12 to 60 months
• **Rate of Interest (ROI)**: Competitive pricing slabs basis NMI and bureau rating
• **Processing Fees & Foreclosure**: Digital disbursement terms with applicable rack processing fee

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips, Form-16
• **Banking Proof**: 6 months ePDF bank statement showing regular salary credit
• **Employment Proof**: Employee ID card, official email ID verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Bank statement not proper or does not show regular salary credit
  - Failed NACH mandate or negative Hunter check match
  - CIBIL below 700 for entry income slabs
• **Exceptions & Deviations**:
  - High tenure up to 84 months available for qualified corporate profiles meeting NMI > ₹50,000`;
  }

  // 7. ADITYA BIRLA FINANCE (ABFL)
  if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
    return `### 🏦 Aditya Birla Finance (ABFL) — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years
• **CIBIL / Bureau Score**: Minimum CIBIL score 700 standard; CIBIL > 725 for Cat A & B fresh loans up to ₹10L without ABB; Maximum 5 bureau inquiries in last 3 months
• **Work Experience & Vintage**: Minimum 1 year in current company; 2 years total work experience
• **Employment Types**: Salaried employees across Pvt Ltd, Public Ltd, Govt, Schools/Colleges, Hospitals, BPOs, Proprietorship, and Partnership entities

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹25,000 to ₹40,000/month *(varies by program/CAT)*
• **Payment Mode**: Mandatory salary credit via official banking channels
• **Bank Account Requirements**: 3 to 6 months bank statement showing regular salary credits; banking surrogate program available

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹50 Lakhs *(varies by program/CAT: standard unsecured ₹5L–₹15L; Cat A maximum cap ₹40 Lakhs)*
• **Tenure**: 12 to 60 months *(Extended up to 84 months for Cat A/B/C/D with NTH ≥ ₹75,000 and loan > ₹5L)*
• **Rate of Interest (ROI)**: Normal cases: 22% to 28% for salary < ₹35k; 14% to 20% for salary ≥ ₹35k
• **Processing Fees & Foreclosure**: Prepayment/foreclosure permitted after 12 months with 4% applicable charges

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips; Annual bonus not considered
• **Banking Proof**: 3 to 6 months bank statement
• **Employment Proof**: Company ID card, appointment letter / vintage proof

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - More than 5 unsecured inquiries in the last 3 months
  - Cooling period violation (unsecured loan availed in the last 6 months for selected programs)
  - FOIR exceeding 50% to 70% threshold
• **Exceptions & Deviations**:
  - New to Credit (-1 CIBIL) permitted for owned house profiles or via banking surrogate
  - Extended tenure up to 84 months for Cat A, B, C & D meeting income thresholds`;
  }

  // 8. INDUSIND BANK
  if (bLower.includes("indusind")) {
    return `### 🏦 IndusInd Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years *(Age > 25 years required for 72/84 months tenure)*
• **CIBIL / Bureau Score**: CIBIL ≥ 700 for standard salaried cases; minimum CIBIL vintage ≥ 6 months; separate policy for New-to-CIBIL (0 / -1)
• **Work Experience & Vintage**: Current employer stability ≥ 3 months for CAT A+/A/B/G; ≥ 12 months for CAT C-1000 & Unlisted
• **Employment Types**: Salaried employees across CAT A+, CAT A, CAT B, CAT G, CAT C-1000, CAT C (Unlisted)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Tier 1 Cities: ₹25,000; Tier 2 Cities: ₹20,000 *(Unlisted Tier 1: ₹30,000, Tier 2: ₹25,000)*
• **Payment Mode**: Mandatory salary credit into active bank account
• **Bank Account Requirements**: Operative salary account with clean banking track; minimum 3 months bank statements

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹50 Lakhs *(varies by CAT: standard salaried ₹25L–₹40L depending on category)*
• **Tenure**: 12 to 60 months standard *(Extended up to 72 or 84 months for CAT A/B/G with NMI > ₹1 Lakh and CIBIL ≥ 750)*
• **Rate of Interest (ROI)**: Competitive rack rates based on employer category and bureau profile
• **Processing Fees & Foreclosure**: Applicable processing fee and foreclosure guidelines per policy grid

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: 3 months latest salary slips
• **Banking Proof**: 3 to 6 months bank statement showing regular salary credit
• **Employment Proof**: Company ID card, appointment letter / vintage verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL score < 700 without specific deviation
  - Employer stability not meeting category minimums (3 mos Cat A/B/G; 12 mos Cat C/Unlisted)
  - FOIR exceeding permissible 50% to 75% limit
• **Exceptions & Deviations**:
  - Balance Transfer (BT) permitted up to 5 BTs with minimum 3 EMIs seasoning
  - Long tenure up to 84 months for prime categories meeting income and score thresholds`;
  }

  // 9. BAJAJ FINSERV / BAJAJ MARKETS
  if (bLower.includes("bajaj")) {
    return `### 🏦 Bajaj Finserv — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 25 to 58 years *(Standard maximum age at maturity 59 years; 62 years for Govt employees with retirement proof; 65 years for professors; 50 years for BSNL employees)*
• **CIBIL / Bureau Score**: CIBIL ≥ 720 to 750; PL Score > 650 allowed; PL Score < 650 allowed with ABB conditions (>15k Prime, >12k G3/G4); Bureau No-Hit (0/-1) program available
• **Work Experience & Vintage**: Minimum 6 months to 1 year in current organization; total work experience 1–2 years
• **Employment Types**: Salaried employees across mapped categories (Top Corporate, Diamond, Platinum, Gold, Silver)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹25,000 to ₹35,000/month *(varies by CAT and city tier)*
• **Payment Mode**: Mandatory salary credit into active bank account via banking transfer
• **Bank Account Requirements**: Minimum 6 months bank statement (AA/Perfios verified) or 1 year PDF statement; clean banking track

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹35 Lakhs to ₹50 Lakhs *(50 Lakh Program available for prime categories)*
• **Tenure**: 12 to 84 months *(Extended up to 96 months under 96 Month Program)*
• **Rate of Interest (ROI)**: Competitive rates starting from 11.00% per annum
• **Processing Fees & Foreclosure**: Term Loan, Dropline Flexi, and Hybrid Flexi facilities available

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: 6 to 12 months bank statements (AA/Perfios verified)
• **Employment Proof**: Employee ID card, appointment letter / official confirmation

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Work from home (WFH) profiles strictly not allowed
  - Office premises operating as co-working space not allowed
  - Contractual employees not allowed
  - Cheque bounce or EMI bounce count exceeding permissible threshold
• **Exceptions & Deviations**:
  - Bureau No-Hit program for CIBIL 0/-1 applicants with CRIF score trigger
  - Paperless Balance Transfer (BT) and Credit Card BT programs available`;
  }

  // 10. IDFC FIRST BANK
  if (bLower.includes("idfc")) {
    return `### 🏦 IDFC FIRST Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years
• **CIBIL / Bureau Score**: CIBIL ≥ 710 to 730+ for standard unsecured personal loans
• **Work Experience & Vintage**: Minimum 1 year continuous employment; total work experience 2–3 years
• **Employment Types**: Salaried employees across Diamond, Platinum, Gold, Silver, and Emerging categories

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹20,000 to ₹35,000/month *(varies by CAT & location)*
• **Payment Mode**: Mandatory salary credit into operative bank account
• **Bank Account Requirements**: Latest 3 months bank statements showing minimum 3 salary credits; <= 1 EMI/cheque bounce in last 3 months

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹1 Crore for prime corporate categories; ₹20L–₹50L standard *(varies by CAT)*
• **Tenure**: 12 to 60 months *(Extended up to 84 months for prime corporate relationships)*
• **Rate of Interest (ROI)**: Competitive rack rates based on bureau band and corporate category
• **Processing Fees & Foreclosure**: Standard processing fees and foreclosure norms as per active policy

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: Latest 3 months bank statement showing at least 3 regular salary credits
• **Employment Proof**: Official employee ID card, appointment letter

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - More than 1 EMI / cheque bounce in the last 3 months
  - Cases below BT ROI benchmark are not allowed
  - Unapproved company category or negative employer listings
• **Exceptions & Deviations**:
  - Balance Transfer (BT) with top-up options available for eligible profiles
  - Extended tenure up to 84 months for prime relationships`;
  }

  // 11. YES BANK
  if (bLower.includes("yes")) {
    return `### 🏦 Yes Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years
• **CIBIL / Bureau Score**: Minimum CIBIL score 700 for standard cases
• **Work Experience & Vintage**: Minimum 1 year continuous employment with current employer; 2 years total work experience
• **Employment Types**: Salaried employees in Super Cat A, Cat A, Cat B, and Cat C corporates

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹25,000/month for listed corporates *(varies by CAT)*
• **Payment Mode**: Mandatory direct online salary credit into active bank account
• **Bank Account Requirements**: Clear banking track with latest 3 months bank statement required

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹40 Lakhs *(varies by CAT: high-ticket policy up to ₹50 Lakhs for Cat A/Elite)*
• **Tenure**: 12 to 60 months
• **Rate of Interest (ROI)**: Attractive rack rates based on employer category and credit score
• **Processing Fees & Foreclosure**: Standard bank processing fees and foreclosure norms

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card, Passport / Voter ID
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: Latest 3 months operative bank statements
• **Employment Proof**: Company ID card, official email confirmation

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Salary below minimum ₹25,000 threshold
  - Irregular salary credits or cash salary modes
  - CIBIL score < 700 without special authorization
• **Exceptions & Deviations**:
  - High-ticket loans up to ₹50 Lakhs available for select Super Cat A corporates`;
  }

  // 12. PIRAMAL CAPITAL
  if (bLower.includes("piramal")) {
    return `### 🏦 Piramal Capital — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: Minimum 21 years, Maximum 61 years
• **CIBIL / Bureau Score**: Minimum CIBIL score 700; NTC (New to Credit) ventile program available for eligible profiles
• **Work Experience & Vintage**: Minimum 1 year current employer stability; total work experience 2 years
• **Employment Types**: Salaried individuals across approved private and public corporate entities

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹20,000 to ₹25,000/month *(varies by city tier)*
• **Payment Mode**: Mandatory salary credit directly to bank account
• **Bank Account Requirements**: 3 to 6 months bank statement showing regular salary credit

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Standard Personal Loan: ₹1 Lakh to ₹25 Lakhs *(Selected programs up to ₹30 Lakhs)*
• **Tenure**: 12 to 60 months
• **Rate of Interest (ROI)**: Competitive interest rate grid basis risk ventile and bureau profile
• **Processing Fees & Foreclosure**: Applicable processing fee and foreclosure guidelines per policy schedule

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips, Form-16
• **Banking Proof**: 3 to 6 months bank statements showing salary credits
• **Employment Proof**: Employee ID card, appointment letter

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL delinquency or negative bureau history
  - Salary below minimum threshold
  - Unapproved or negative listed company
• **Exceptions & Deviations**:
  - Special JFM program with extended caps up to ₹30 Lakhs for prime profiles`;
  }

  // 13. FIBE
  if (bLower.includes("fibe")) {
    return `### 🏦 Fibe — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: Minimum 19 years, Maximum 55 years
• **CIBIL / Bureau Score**: Minimum CIBIL score 700; Bureau track verification required
• **Work Experience & Vintage**: Minimum 3 to 6 months with current employer; 18M loan requires > 2 years employer tenure
• **Employment Types**: Salaried individuals in registered corporate entities

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹18,000/month for Tier 1 Cities; ₹15,000/month for Tier 2 Cities *(18M/24M tenure requires ₹25,000+)*
• **Payment Mode**: Mandatory direct online salary credit into active bank account
• **Bank Account Requirements**: Active operative bank account with minimum 3 months salary credit verification

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹5,000 to Maximum ₹5,00,000
• **Tenure**: 3 to 24 months *(up to 36 months for select high-income profiles)*
• **Rate of Interest (ROI)**: Dynamic digital pricing starting from 18% to 30% per annum
• **Processing Fees & Foreclosure**: Digital processing fees; transparent foreclosure terms

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: 3 months bank statements showing salary credits
• **Employment Proof**: Official corporate email ID / company ID verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Age below 19 years
  - Salary credit mode not direct bank transfer
  - Delinquency in latest 30/90 days
• **Exceptions & Deviations**:
  - Flexible short-tenure loan options for young salaried professionals`;
  }

  // GENERIC DYNAMIC PARSER FOR ANY OTHER BANK OR UPLOADED .TXT MASTER POLICY
  const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const filterLines = (regex: RegExp, excludeRegex?: RegExp, max = 3): string[] => {
    const hits: string[] = [];
    for (const l of lines) {
      if (/^(=+|-{3,})/.test(l)) continue;
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]|\[CONFLICT\]|postgresql|parser/i.test(l)) continue;
      if (regex.test(l) && (!excludeRegex || !excludeRegex.test(l))) {
        const cleaned = cleanText(l.replace(/^[-*•]\s*/, ""));
        if (cleaned.length > 10 && cleaned.length < 160 && !hits.includes(cleaned)) {
          hits.push(cleaned);
          if (hits.length >= max) break;
        }
      }
    }
    return hits;
  };

  const ageHits = filterLines(/(?:minimum\s*age|maximum\s*age|age\s*requirements?|age\s*:)/i, /retirement/i, 2);
  const cibilHits = filterLines(/(?:minimum\s*cibil|cibil\s*score|cibil\s*>|cibil\s*cutoff|bureau\s*requirements?)/i, undefined, 2);
  const workHits = filterLines(/(?:work\s*experience|employment\s*stability|employer\s*tenure|company\s*vintage)/i, undefined, 2);
  const nthHits = filterLines(/(?:monthly\s*nth|minimum\s*nth|net\s*salary|min\s*salary|tier\s*1|tier\s*2)/i, undefined, 2);
  const modeHits = filterLines(/(?:mode\s*of\s*salary|salary\s*credit|neft|cheque|cash|upi|salary\s*should\s*be\s*credited)/i, undefined, 2);
  const loanHits = filterLines(/(?:loan\s*amount\s*caps?|minimum:\s*₹|maximum:\s*₹|max\s*loan|loan\s*amount\s*:)/i, undefined, 2);
  const tenureHits = filterLines(/(?:repayment\s*tenure|maximum\s*tenure|standard\s*tenure|months?\s*tenure)/i, /experience/i, 2);
  const roiHits = filterLines(/(?:base\s*roi|roi\s*range|starting\s*from\s*\d+%\s*to|interest\s*rate)/i, undefined, 2);
  const docHits = filterLines(/(?:pan\s*card|aadhaar|salary\s*slip|bank\s*statement|mandatory\s*documents?)/i, undefined, 3);
  const rejHits = filterLines(/(?:rejection\s*rules?|no\s*30\s*dpd|no\s*90\s*dpd|not\s*allowed|knockout)/i, undefined, 3);

  let output = `### 🏦 ${bankName} — Loan Policy Summary\n\n`;

  // 1. Eligibility Criteria
  output += `#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)\n`;
  if (ageHits.length > 0) output += `• **Age**: ${ageHits.join("; ")}\n`;
  else output += `• **Age**: 21 to 60 years *(or retirement age)*\n`;
  if (cibilHits.length > 0) output += `• **CIBIL / Bureau Score**: ${cibilHits.join("; ")}\n`;
  else output += `• **CIBIL / Bureau Score**: Standard bureau score requirements as per policy grid\n`;
  if (workHits.length > 0) output += `• **Work Experience & Vintage**: ${workHits.join("; ")}\n`;
  else output += `• **Work Experience & Vintage**: Minimum continuous employment stability required\n`;
  output += `• **Employment Types**: Salaried individuals across mapped employer categories\n\n`;

  // 2. Salary & Bank Requirements
  output += `#### 2. Salary & Bank Requirements (NTH, Payment Mode)\n`;
  if (nthHits.length > 0) output += `• **Net Take-Home (NTH) / Salary**: ${nthHits.join("; ")}\n`;
  else output += `• **Net Take-Home (NTH) / Salary**: Evaluated basis employer category and city tier\n`;
  if (modeHits.length > 0) output += `• **Payment Mode**: ${modeHits.join("; ")}\n`;
  else output += `• **Payment Mode**: Mandatory direct online salary credit into active bank account\n`;
  output += `• **Bank Account Requirements**: Operative salary bank account with minimum 3–6 months verified credits\n\n`;

  // 3. Loan Parameters
  output += `#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)\n`;
  if (loanHits.length > 0) output += `• **Loan Amount**: ${loanHits.join("; ")}\n`;
  else output += `• **Loan Amount**: Standard ticket sizes as per approved product matrix\n`;
  if (tenureHits.length > 0) output += `• **Tenure**: ${tenureHits.join("; ")}\n`;
  else output += `• **Tenure**: Standard repayment tenure up to 60 months\n`;
  if (roiHits.length > 0) output += `• **Rate of Interest (ROI)**: ${roiHits.join("; ")}\n`;
  else output += `• **Rate of Interest (ROI)**: Competitive rack rates based on risk band and category\n`;
  output += `• **Processing Fees & Foreclosure**: Applicable processing fee and foreclosure guidelines per policy schedule\n\n`;

  // 4. Document Requirements
  output += `#### 4. Document Requirements\n`;
  if (docHits.length > 0) {
    docHits.forEach((d) => { output += `• ${d}\n`; });
  } else {
    output += `• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card / Valid Government ID\n`;
    output += `• **Income Proof**: Latest 3 months salary slips, Form-16\n`;
    output += `• **Banking Proof**: 3 to 6 months bank statement showing regular salary credits\n`;
    output += `• **Employment Proof**: Employee ID card, appointment letter / vintage verification\n`;
  }
  output += `\n`;

  // 5. Rejection Rules & Exceptions
  output += `#### 5. Rejection Rules & Exceptions\n`;
  if (rejHits.length > 0) {
    output += `• **Rejection Rules (Knockout Criteria)**:\n`;
    rejHits.forEach((r) => { output += `  - ${r}\n`; });
  } else {
    output += `• **Rejection Rules (Knockout Criteria)**: Non-compliance with credit bureau delinquency norms, insufficient income, or unlisted employer categories\n`;
  }
  output += `• **Exceptions & Deviations**: Case-by-case deviations subject to credit risk authority approval\n`;

  return output.trim();
}

const formatStructuredBankPolicy = formatComprehensiveBankPolicy;


function extractPolicyAnswerFromLines(policyContent: string, question: string, bankName: string): string {
  const q = question.toLowerCase();
  const bLower = bankName.toLowerCase();

  // If user asks for general bank policy (or not specifically requesting only a single isolated parameter)
  const isSpecificSingleCriterion =
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:minimum\s+|entry\s+|rack\s+)?(?:cibil|credit\s*score|bureau\s*cutoff|score\s*cutoff)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q)) ||
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:minimum\s+|maximum\s+|repayment\s+)?(?:tenure|tenor|duration)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q)) ||
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:permissible\s+|max(?:imum)?\s+)?(?:foir|dbr|obligation)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q)) ||
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:minimum\s+|net\s+)?(?:salary|income|nmi|nth)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q)) ||
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:minimum\s+|maximum\s+|eligible\s+)?(?:age)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q)) ||
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:minimum\s+|maximum\s+|max\s+)?(?:loan\s*amount|ticket\s*size|cap)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q));

  if (!isSpecificSingleCriterion) {
    return formatStructuredBankPolicy(policyContent, bankName);
  }

  // 1. CIBIL / CREDIT SCORE / BUREAU CUTOFF
  if (/cibil|credit\s*score|bureau|score\s*cutoff|minimum\s*cibil/i.test(q)) {
    if (bLower.includes("icici")) {
      return (
        `### 🏦 ICICI Bank Master Policy — CIBIL Guidelines\n\n` +
        `ICICI Bank's official Master Policy does not set a single fixed minimum CIBIL cutoff score for personal loan approval. Instead, approvals and interest rates are determined by tiered CIBIL pricing bands:\n\n` +
        `• **Tier 1 (Prime)**: CIBIL ≥ 770 (Qualifies for lowest Green ROI)\n` +
        `• **Tier 2 (Standard)**: CIBIL 725 to 769 (including 0 / -1 for new-to-credit applicants)\n` +
        `• **Tier 3 (Subprime)**: CIBIL < 725\n\n` +
        `Final loan approval and applicable interest rates depend on the applicant's CIBIL tier, employer category, and loan amount.`
      );
    }

    if (bLower.includes("hdfc")) {
      return (
        `### 🏦 HDFC Bank Master Policy — CIBIL Guidelines\n\n` +
        `HDFC Bank's official Master Policy rate card does not specify a separate minimum CIBIL cutoff score for personal loan approval. Instead, pricing and eligibility are structured into two bureau slabs:\n\n` +
        `• **CIBIL > 730**: Eligible for preferred rack interest rates across all company categories (rates starting from 11.15% for Cat Super A / A).\n` +
        `• **CIBIL ≤ 730 / No Hit**: Standard rack interest rates apply.\n\n` +
        `Applicants must also have a positive credit bureau record (Hunter match / CIC positive) with no loan availed or cancelled in the last 30 days.`
      );
    }

    if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
      return (
        `### 🏦 Aditya Birla Finance (ABFL) Master Policy — CIBIL Guidelines\n\n` +
        `• **Minimum CIBIL Cutoff**: 700 compulsory for standard approvals.\n` +
        `• **Category A & B Fresh Loans (up to ₹10 Lakhs without ABB)**: CIBIL > 725 required.\n` +
        `• **New to Credit (-1 CIBIL)**: Permitted for applicants with an owned house or through banking surrogate.\n` +
        `• **Bureau Inquiries**: Maximum 5 inquiries in the last 3 months.`
      );
    }

    if (bLower.includes("axis")) {
      return (
        `### 🏦 Axis Bank Master Policy — CIBIL Guidelines\n\n` +
        `Axis Bank's Master Policy determines CIBIL requirements based on Net Monthly Income (NMI) slabs:\n\n` +
        `• **NMI ₹35,000 to ₹85,000**: CIBIL ≥ 700 to 740+\n` +
        `• **NMI ₹50,000+**: CIBIL ≥ 700 (Standard) / ≥ 740 (Fast-track)\n` +
        `• **NMI > ₹85,000**: CIBIL ≥ 700+\n` +
        `• **NMI > ₹100,000**: CIBIL ≥ 740+ for premium loan parameters.`
      );
    }

    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const cibilLines: string[] = [];
    let inCibil = false;
    for (const line of lines) {
      if (/^(=+\s*)?CIBIL|^2\.\s*ELIGIBILITY|^bureau\s*requirements/i.test(line)) {
        inCibil = true;
        continue;
      }
      if (inCibil && /^(=+.*|[0-9]+\.\s+[A-Z]|Age:|Employment:|Income:)/i.test(line)) {
        inCibil = false;
      }
      if (inCibil) {
        if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]|pricing band is not automatically/i.test(line)) continue;
        if (/cibil|score|cutoff|threshold|bureau|tier|slab/i.test(line)) {
          cibilLines.push(line.replace(/^[-*•]\s*/, ""));
        }
      }
    }

    if (cibilLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — CIBIL Guidelines\n\n` +
        cibilLines.slice(0, 5).map((l) => `• ${l}`).join("\n")
      );
    }

    return `The official Master Policy for ${bankName} does not specify an absolute minimum CIBIL cutoff score. Eligibility is evaluated across overall credit history and risk profile.`;
  }

  // 2. TENURE / DURATION
  if (/tenure|tenor|duration|months|years/i.test(q)) {
    const isSuperA = /super\s*a|cat\s*a|category\s*a/i.test(q);

    if (bLower.includes("hdfc")) {
      if (isSuperA || /super/i.test(q)) {
        return (
          `### 🏦 HDFC Bank Master Policy — Loan Tenure for Super A\n\n` +
          `Under HDFC Bank's official Master Policy, the maximum personal loan tenure for **Super A** (CAT Super A / CAT A / CAT HDFC) is **84 months** (7 years).\n\n` +
          `• **Minimum Tenure**: 12 months\n` +
          `• **Standard Maximum Tenure**: 60 months (5 years)\n` +
          `• **Extended Maximum Tenure**: 84 months (7 years) for CAT Super A, CAT A, CAT HDFC, CAT GA, and CAT RA categories.`
        );
      }
      return (
        `### 🏦 HDFC Bank Master Policy — Loan Tenure\n\n` +
        `• **Minimum Tenure**: 12 months\n` +
        `• **Standard Maximum Tenure**: 60 months (5 years)\n` +
        `• **Extended Tenure (Up to 72 or 84 months)**: Available for CAT Super A, CAT A, CAT HDFC, CAT C, CAT GA, and CAT RA categories.`
      );
    }

    if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
      if (isSuperA || /cat\s*a/i.test(q)) {
        return (
          `### 🏦 Aditya Birla Finance (ABFL) Master Policy — Loan Tenure\n\n` +
          `Under ABFL's Master Policy, the maximum loan tenure for **Category A** is **84 months** (7 years) for applicants with Net Monthly Income ≥ ₹75,000 and loan amount above ₹5 Lakhs.\n\n` +
          `• **Standard Tenure**: 12 to 60 months\n` +
          `• **Maximum Extended Tenure**: 84 months for Cat A, B, C & D meeting income thresholds.`
        );
      }
      return (
        `### 🏦 Aditya Birla Finance (ABFL) Master Policy — Loan Tenure\n\n` +
        `• **Minimum Tenure**: 12 months\n` +
        `• **Standard Maximum Tenure**: 60 months (5 years)\n` +
        `• **Extended Tenure**: Up to 84 months (7 years) for Cat A, B, C & D with NTH ≥ ₹75,000 and loan amount > ₹5 Lakhs.`
      );
    }

    if (bLower.includes("icici")) {
      return (
        `### 🏦 ICICI Bank Master Policy — Loan Tenure\n\n` +
        `• **Minimum Tenure**: 12 months\n` +
        `• **Standard Maximum Tenure**: 60 months (5 years)\n` +
        `• Extended terms up to 72 months may apply for prime corporate relationships subject to credit approval.`
      );
    }

    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const tenureLines: string[] = [];
    for (const line of lines) {
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]/i.test(line)) continue;
      if (/work\s*experience|employer\s*tenure|retirement|age\s*\+/i.test(line)) continue;
      if (/tenure|tenor/i.test(line) && /month|year|min|max|standard/i.test(line)) {
        tenureLines.push(line.replace(/^[-*•]\s*/, ""));
      }
    }

    if (tenureLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — Loan Tenure\n\n` +
        tenureLines.slice(0, 4).map((l) => `• ${l}`).join("\n")
      );
    }

    return `Under ${bankName}'s Master Policy, standard personal loan tenure ranges from 12 to 60 months (up to 5 years).`;
  }

  // 3. FOIR / OBLIGATION
  if (/foir|dbr|obligation|fixed\s*obligation/i.test(q)) {
    if (bLower.includes("hdfc")) {
      return (
        `### 🏦 HDFC Bank Master Policy — FOIR Guidelines\n\n` +
        `• **Standard Permissible FOIR**: 75%\n` +
        `• **Government & Defense Categories (CAT GA-GB & DA)**: Additional 3% permissible FOIR (up to 78%)\n` +
        `• Eligibility is determined by 75% FOIR, multiplier-based eligibility, or product cap, whichever is lower.`
      );
    }

    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const foirLines: string[] = [];
    for (const line of lines) {
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]/i.test(line)) continue;
      if (/foir|fixed\s*obligation/i.test(line) && /%|limit|norm|standard|slab/i.test(line)) {
        foirLines.push(line.replace(/^[-*•]\s*/, ""));
      }
    }

    if (foirLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — FOIR Guidelines\n\n` +
        foirLines.slice(0, 4).map((l) => `• ${l}`).join("\n")
      );
    }

    return `Permissible FOIR for ${bankName} is determined by the applicant's net salary slab and employer category rating under the bank's Master Policy.`;
  }

  // 4. SALARY / INCOME / NMI / NTH
  if (/salary|income|nmi|nth|net\s*take\s*home/i.test(q)) {
    if (bLower.includes("hdfc")) {
      return (
        `### 🏦 HDFC Bank Master Policy — Minimum Salary Requirements\n\n` +
        `• **Standard Minimum Net Salary**: ₹25,000 per month\n` +
        `• **CAT GA (Central/State Govt)**: Net take-home salary ≥ ₹50,000\n` +
        `• **CAT GB (Central/State Govt)**: Net take-home salary ≥ ₹25,000\n` +
        `• **Golden Edge Program**: Minimum Net Salary ₹75,000 (Prime Locations) / ₹50,000 (Emerging Locations)`
      );
    }

    if (bLower.includes("icici")) {
      return (
        `### 🏦 ICICI Bank Master Policy — Salary Requirements\n\n` +
        `ICICI Bank's Master Policy does not enforce a single uniform salary threshold. Minimum net take-home salary criteria depend on the employer category (e.g. ICICI Group, Top Corporate, Elite, or Open Market), typically starting from ₹25,000 to ₹35,000+ per month.`
      );
    }

    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const salLines: string[] = [];
    for (const line of lines) {
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]/i.test(line)) continue;
      if (/minimum\s*salary|min\s*salary|net\s*salary|nth|nmi/i.test(line) && /₹|\d+/i.test(line)) {
        salLines.push(line.replace(/^[-*•]\s*/, ""));
      }
    }

    if (salLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — Salary Requirements\n\n` +
        salLines.slice(0, 4).map((l) => `• ${l}`).join("\n")
      );
    }

    return `Minimum salary requirements for ${bankName} vary based on the applicant's employer category and location under the Master Policy.`;
  }

  // 5. AGE
  if (/age/i.test(q) && !/tenure|salary/i.test(q)) {
    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const ageLines: string[] = [];
    for (const line of lines) {
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]/i.test(line)) continue;
      if (/minimum\s*age|min\s*age|maximum\s*age|max\s*age/i.test(line) && /\d+/i.test(line)) {
        ageLines.push(line.replace(/^[-*•]\s*/, ""));
      }
    }

    if (ageLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — Age Criteria\n\n` +
        ageLines.slice(0, 3).map((l) => `• ${l}`).join("\n")
      );
    }

    return `Under ${bankName}'s Master Policy, the eligible age bracket for salaried applicants is typically 21 to 60 years at loan maturity.`;
  }

  // 6. LOAN AMOUNT / CAPS
  if (/loan\s*amount|max\s*loan|loan\s*cap|maximum\s*limit/i.test(q)) {
    if (bLower.includes("hdfc")) {
      return (
        `### 🏦 HDFC Bank Master Policy — Loan Amount Limits\n\n` +
        `• **Minimum Loan Amount**: ₹50,000\n` +
        `• **Maximum Loan Limit**: Up to ₹40,00,000 (₹40 Lakhs)\n\n` +
        `**Category-wise Maximum Caps**:\n` +
        `• CAT Super A / CAT A / CAT HDFC: Up to ₹40 Lakhs\n` +
        `• CAT GA (Central/State Govt): Up to ₹40 Lakhs\n` +
        `• CAT B / CAT C: Up to ₹25 Lakhs\n` +
        `• CAT D / CAT E: Up to ₹10 Lakhs\n` +
        `• CAT RA (Railways): Up to ₹20 Lakhs\n` +
        `• CAT GP: Up to ₹5 Lakhs`
      );
    }

    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const capLines: string[] = [];
    for (const line of lines) {
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]/i.test(line)) continue;
      if (/maximum\s*cap|loan\s*amount\s*caps|maximum\s*limit|max\s*loan/i.test(line) && /lakh|lac|₹|\d+/i.test(line)) {
        capLines.push(line.replace(/^[-*•]\s*/, ""));
      }
    }

    if (capLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — Loan Limits\n\n` +
        capLines.slice(0, 4).map((l) => `• ${l}`).join("\n")
      );
    }

    return `Maximum loan amount under ${bankName}'s Master Policy ranges up to ₹40 to ₹50 Lakhs depending on employer category and net monthly income.`;
  }

  // Fallback: structured bank policy guidelines
  return formatStructuredBankPolicy(policyContent, bankName);
}

async function searchPoliciesForBank(bankName: string, question: string): Promise<string> {
  return answerBankPolicyWithMasterPolicy(bankName, question);
}

function getContradictoryTimeGreeting(userMsg: string, timeStr?: string): string | null {
  const norm = userMsg.toLowerCase();
  const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hour = istDate.getHours(); // 0-23
  const isNight = hour >= 21 || hour < 4;
  const isEvening = hour >= 17 && hour < 21;
  const isAfternoon = hour >= 12 && hour < 17;
  const isMorning = hour >= 4 && hour < 12;

  const saysMorning = /\bgood\s+morning\b|\bmorning\b/i.test(norm);
  const saysAfternoon = /\bgood\s+afternoon\b/i.test(norm);
  const saysEvening = /\bgood\s+evening\b/i.test(norm);
  const saysNight = /\bgood\s+night\b/i.test(norm);

  if (saysMorning && (isNight || isEvening)) {
    return "Good evening! It's late night, but I'm here to help you with your loan queries! How can I assist you with personal loans, bank policies, or EMI calculations today?";
  }
  if (saysMorning && isAfternoon) {
    return "Good afternoon! It's already afternoon, but I'm here to help you with your loan queries! How can I assist you today?";
  }
  if ((saysEvening || saysNight) && isMorning) {
    return "Good morning! It's morning here, but I'm delighted to help you with your loan queries! How can I assist you today?";
  }
  return null;
}

async function generateGreetingWithLLM(
  message: string,
  modelOverride?: string,
  eligibilitySession?: any,
  currentTime?: string
): Promise<string> {
  const currTime = currentTime || new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const apiKey = getApiKey();
  if (apiKey) {
    const modelsToTry = [modelOverride, getModel(), "openrouter/free"].filter(Boolean) as string[];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let systemPrompt =
          `You are CreditWise AI, a helpful, expert financial assistant specializing in personal loan eligibility, EMI calculations, bank loan policies, and branch manager contacts.\n\n` +
          `### DYNAMIC CONTEXT:\n` +
          `- Current Local Time: ${currTime}\n\n` +
          `### BEHAVIOR RULES:\n` +
          `- TIME AWARENESS: Always use the provided Current Local Time. If the user gives a greeting that contradicts the current time (e.g., saying "Good morning" at 10:45 PM), politely acknowledge the current time in a warm, conversational tone (e.g., "Good evening! It's late night, but I'm here to help you with your loan queries!").\n` +
          `- NATURAL & ADAPTIVE: Do not act like a rigid step-by-step form or force single-question loops. Converse naturally like ChatGPT while gathering missing information efficiently.\n` +
          `- ACCURACY: Follow the provided Bank Data, Loan Policy, and Manager Contact records strictly for calculations and recommendations.\n\n` +
          `Generate a warm, natural, and concise greeting in response to the user's message.\n` +
          `Briefly and naturally let them know you can help with personal loan eligibility across 20+ partner banks, bank policies, EMI calculations, or financial questions.\n` +
          `Do NOT use robotic bulleted lists or rigid templates. Keep it conversational, welcoming, and concise (1-3 sentences).\n` +
          `Never start with internal tokens, and do not repeat canned phrases verbatim.`;

        if (eligibilitySession?.applicant?.companyName) {
          systemPrompt += `\nNote: The user currently has an ongoing loan eligibility assessment for ${eligibilitySession.applicant.companyName}. You may naturally mention they can continue or explore anything else.`;
        }

        const streamToken = agentTokenStorage.getStore();
        if (streamToken) {
          const { openRouterChatStream } = await import("@/lib/openrouter");
          const streamed = await openRouterChatStream(
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
            streamToken,
            { model, signal: controller.signal, temperature: 0.6 }
          );
          clearTimeout(timeoutId);
          if (typeof streamed === "string" && streamed.trim().length > 0) {
            return stripReasoningPreamble(streamed.trim());
          }
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3001",
            "X-Title": "CreditWise AI",
          },
          body: JSON.stringify({
            model,
            max_tokens: 500,
            temperature: 0.6,
            reasoning: { max_tokens: 0 },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return stripReasoningPreamble(content.trim());
          }
        }
      } catch (err: any) {
        console.warn(`[Greeting LLM] Failed with model ${model}:`, err?.message || err);
      }
    }
  }

  const contradiction = getContradictoryTimeGreeting(message, currTime);
  if (contradiction) {
    return contradiction;
  }

  return (
    "Hello! My role is to assist you 😊! Welcome to CreditWise AI, your intelligent loan and financial advisory assistant. How can I assist you today? You can ask me to evaluate your loan eligibility across partner banks, calculate an EMI, or check bank policies! 😊"
  );
}

function formatFieldValue(field: string, value: any): string {
  if (field === "monthlyIncome" || field === "loanAmount" || field === "existingEmi") {
    const num = Number(value);
    if (!isNaN(num)) return `₹${num.toLocaleString("en-IN")}`;
  }
  if (field === "tenureMonths") {
    const num = Number(value);
    if (!isNaN(num)) {
      if (num >= 12 && num % 12 === 0) return `${num / 12} years (${num} months)`;
      return `${num} months`;
    }
  }
  if (field === "age") {
    return `${value} years`;
  }
  return String(value);
}

type ToolCallingAgentResult = {
  reply: string;
  bankData?: any;
  companyData?: any;
  companyQuery?: string;
};

/**
 * Send a tool's raw data result back to the LLM and let it generate the final
 * user-facing response. Services and tools return data only; the LLM owns
 * every final response. Returns the raw data if the LLM is unavailable.
 */
async function summarizeToolResult(
  userMessage: string,
  toolName: string | undefined,
  toolResult: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) return toolResult;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "CreditWise AI",
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: 250,
        temperature: 0.2,
        reasoning: { max_tokens: 0 },
        messages: [
          {
            role: "system",
            content:
              "You are CreditWise AI, a friendly personal loan advisor. " +
              "A tool returned verified data below. Summarize it warmly, clearly, and in natural everyday conversational language for the user. " +
              "Avoid stiff, robotic, or overly technical banking jargon. " +
              "Never invent data not present in the tool result. " +
              "Output ONLY the summary. Do not include any thinking, analysis, preamble, or numbering of your own steps.",
          },
          { role: "user", content: userMessage },
          { role: "assistant", content: `I used the ${toolName || "tool"} tool and received this data.` },
          { role: "user", content: `Tool result:\n${toolResult}\n\nPlease summarize this for the user.` },
        ],
      }),
    });
    if (!response.ok) return toolResult;
    const content = (await response.json()).choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      // The free model sometimes echoes its internal reasoning. Strip any
      // "thinking process" preamble so only the final summary reaches the user.
      const cleaned = stripReasoningPreamble(content);
      return cleaned || toolResult;
    }
    return toolResult;
  } catch {
    return toolResult;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Remove the model's internal reasoning preamble (e.g. "Here's a thinking
 * process:") so the final user-facing summary is clean.
 */
function stripReasoningPreamble(text: string): string {
  const markers = [
    "Here's a thinking process",
    "Here is a thinking process",
    "Thinking process:",
    "Let me think",
    "Let's think",
    "Analysis:",
    "Step 1",
  ];
  const lower = text.toLowerCase();
  let idx = -1;
  for (const m of markers) {
    const i = lower.indexOf(m.toLowerCase());
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return text.trim();

  const after = text.slice(idx);
  const m = after.match(/(?:^|\n)\s*(?:\d+\.\s*)?(?:summary|final|answer|result|decision)/i);
  if (m) return text.slice(idx + m.index!).trim();
  return text.trim();
}

/**
 * Execute the non-deterministic portion of the central agent. This must live
 * beside runCentralAgent because the route only imports runCentralAgent.
 *
 * Every user message goes to the LLM first. The LLM understands the message
 * and decides what to do via tool calls. The deterministic search only runs
 * as a fallback when the LLM is completely unavailable.
 */
async function runToolCallingAgent(
  userMessage: string,
  modelOverride?: string,
  contextData?: string,
  customSystemPrompt?: string
): Promise<ToolCallingAgentResult> {
  const model = modelOverride || getModel();
  const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
  const bankName = bankMatch ? bankMatch[0].toUpperCase() : "";

  try {
    if (contextData) {
      if (!OPENROUTER_API_KEY) return { reply: contextData };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3001",
            "X-Title": "CreditWise AI",
          },
          body: JSON.stringify({
            model,
            max_tokens: 500,
            temperature: 0.2,
            reasoning: { max_tokens: 0 },
            messages: [
              {
                role: "system",
                content: customSystemPrompt || "You are Loan Assistant Financial Assistant. Base your report strictly on the provided deterministic policy data.",
              },
              { role: "user", content: contextData },
            ],
          }),
        });
        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return { reply: stripReasoningPreamble(content) };
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }
      return { reply: contextData };
    }

    if (!OPENROUTER_API_KEY) return { reply: await generateGreetingWithLLM(userMessage, modelOverride) };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "CreditWise AI",
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          temperature: 0.2,
          reasoning: { max_tokens: 0 },
          messages: [
            {
              role: "system",
              content:
                `You are CreditWise AI, a helpful, expert financial assistant specializing in personal loan eligibility, EMI calculations, bank loan policies, and branch manager contacts.\n\n` +
                `### DYNAMIC CONTEXT:\n` +
                `- Current Local Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: true, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
                `### BEHAVIOR RULES:\n` +
                `- TIME AWARENESS: Always use the provided Current Local Time. If the user gives a greeting that contradicts the current time (e.g., saying "Good morning" at 10:45 PM), politely acknowledge the current time in a warm, conversational tone (e.g., "Good evening! It's late night, but I'm here to help you with your loan queries!").\n` +
                `- NATURAL & ADAPTIVE: Do not act like a rigid step-by-step form or force single-question loops. Converse naturally like ChatGPT while gathering missing information efficiently.\n` +
                `- ACCURACY: Follow the provided Bank Data, Loan Policy, and Manager Contact records strictly for calculations and recommendations.`
            },
            { role: "user", content: userMessage },
          ],
          tools: ASSISTANT_TOOLS,
          tool_choice: "auto",
        }),
      });
      // A non-OK response (e.g. 429 rate limit) means the LLM cannot decide.
      // Fall through to deterministic searches instead of returning a greeting.
      if (!response.ok) throw new Error("LLM request failed");

      const message = (await response.json()).choices?.[0]?.message;
      const toolCall = message?.tool_calls?.[0];
      if (!toolCall) {
        const content = message?.content;
        if (typeof content === "string" && content.trim().length > 0) {
          return { reply: stripReasoningPreamble(content) };
        }
        throw new Error("LLM returned no tool call");
      }

      // The LLM decided what to do. Run the tool to get raw data only —
      // services and tools return data, never the final user-facing response.
      let toolResult = "";
      let toolData: any = {};
      let toolName = toolCall.function?.name;
      let args: any = {};
      try { args = JSON.parse(toolCall.function?.arguments || "{}"); } catch { /* use defaults */ }

      if (toolName === "search_bank_managers") {
        const bankData = await searchBankManager({ ...args, query: userMessage });
        toolResult = bankData?.length
          ? formatManagers(bankData, userMessage)
          : `No bank manager records found matching "${userMessage}".`;
        toolData.bankData = bankData || [];
      } else if (
        toolName === "search_company_category" ||
        toolName === "search_company_eligibility" ||
        toolName === "search_company" ||
        toolName === "company_search" ||
        toolName === "companySearchTool"
      ) {
        const companyQuery = args.companyName || args.company_name || args.query || userMessage;
        const compRes = await executeSearchCompanyCategory(
          { companyName: companyQuery },
          userMessage
        );
        toolResult = compRes.reply;
        toolData.companyData = compRes.companyData;
        toolData.companyQuery = companyQuery;
      } else if (toolName === "search_bank_policies" || toolName === "lookup_master_policy") {
        toolResult = await searchPoliciesForBank(args.bankName || args.bank_name || "", args.questionTopic || args.question || userMessage);
      } else if (toolName === "check_loan_eligibility") {
        const eligibilityResult = await evaluateEligibilityFromTool({
          bankName: args.bankName || args.bank_name,
          loanType: args.loanType || args.loan_type,
          salary: args.monthlyIncome ?? args.salary,
          cibil: args.cibil,
          existingEmi: args.existingEmi ?? args.existing_emi,
          companyName: args.companyName || args.company_name,
          employmentType: args.employmentType || args.employment_type,
          age: args.age,
        });
        toolResult = eligibilityResult;
      } else if (toolName === "calculate_emi") {
        const emiInput = {
          principal: Number(args.principal),
          rate: Number(args.rate),
          tenure: Number(args.tenure || args.tenureMonths),
        };
        const emiResult = calculateEmi(emiInput);
        toolResult = formatEmiResult(emiInput, emiResult);
      } else if (toolName === "incraax_search") {
        toolResult = await searchIncraaxWeb(args.query || userMessage);
      } else {
        toolResult = "No relevant data found.";
      }

      // For structured outputs like company search and manager directory, return complete verified markdown
      if (
        toolName === "search_company_category" ||
        toolName === "search_company_eligibility" ||
        toolName === "search_company" ||
        toolName === "company_search" ||
        toolName === "companySearchTool"
      ) {
        return { reply: toolResult, ...toolData };
      }

      // Send the tool result back to the LLM and let it generate the final
      // user-facing response. The LLM owns every final response.
      const reply = await summarizeToolResult(userMessage, toolName, toolResult);
      return { reply, ...toolData };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Tool-calling agent error:", error);

    // LLM unavailable — run deterministic searches to get verified data, then
    // let the LLM explain it if it comes back; otherwise return the raw data.
    const isManagerQuery = /manager|contact|phone|mobile|email|number|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b|branch manager|contact details/i.test(userMessage);

    // BASIC LOAN/EMI QUESTIONS: never trigger banking/company tool calls
    const isBasicLoanEmiQuery = /(emi|emi\s+calculator|calculate.*emi|emi.*amount|what.*emi|how.*emi)/i.test(userMessage) ||
      /(loan.*interest|interest.*rate|rate.*loan|loan.*rate)/i.test(userMessage) ||
      /(how.*much.*loan|loan.*how.*much|max.*loan|loan.*max)/i.test(userMessage) ||
      /(personal.*loan.*eligib|eligib.*personal.*loan)/i.test(userMessage);

    const isCompanyQuery = /company|employer|category|rating|listing/i.test(userMessage) && !isManagerQuery && !isBasicLoanEmiQuery;
    const isPolicyQuery = /approval|eligibility|salary|cibil|emi|income|foir|interest|roi|tenure|policy|rate|multiplier|assessment|summary|criteria/i.test(userMessage) && !isManagerQuery && !isBasicLoanEmiQuery && !isCompanyQuery;

    let fallbackData = "";
    let fallbackDataObj: any = {};
    // Minimal filter extraction without hardcoded city lists:
    // - Extract pincode if present as 6-digit number
    // - Extract bank name generically via resolveBankName
    const filters: { bank_name?: string; city?: string; pincode?: string; } = {};
    const pincodeMatch = userMessage.match(/\b(\d{6})\b/);
    if (pincodeMatch) {
      filters.pincode = pincodeMatch[1];
    }
    const resolvedBankFallback = resolveBankName(userMessage);
    if (resolvedBankFallback) {
      filters.bank_name = resolvedBankFallback.bankName;
    }

    if (isManagerQuery) {
      const bankData = await searchBankManager(filters);
      if (bankData?.length) {
        fallbackData = formatManagers(bankData, userMessage);
        fallbackDataObj.bankData = bankData;
      } else {
        // Bank search returned no results — never return the generic greeting.
        // Return a specific "no records found" message instead.
        fallbackData = `No bank manager records found matching your criteria. Please verify the bank name, city, pincode, or branch.`;
        fallbackDataObj.bankData = [];
      }
    }
    if (!fallbackData && isCompanyQuery && !isInvalidCompanyName(userMessage)) {
      const compCandidate = extractCleanCompanyName(userMessage) || extractCompanyCandidateFromText(userMessage) || extractTargetCompanyFromMessage(userMessage) || userMessage;
      const company = await searchCompany(compCandidate);
      if (company?.found) {
        fallbackData = formatCompanyResponse(company);
        fallbackDataObj.companyData = {
          company_name: company.primaryName,
          overview: company.overview,
          basic_info: company.basicInfo,
          financial_info: company.financialInfo,
          bank_records: company.bankRecords,
          needs_disambiguation: company.needsDisambiguation,
          candidates: company.candidates,
        };
      } else {
        fallbackData = `No corporate company records found matching "${compCandidate}".`;
      }
    }
    if (!fallbackData && isPolicyQuery) {
      fallbackData = await searchPoliciesForBank(bankName, userMessage);
    }
    if (!fallbackData) {
      const generalReply = await answerGeneralQuestionWithLLM(userMessage, modelOverride);
      return { reply: generalReply };
    }

    const reply = await finalizeWithLlm(userMessage, fallbackData);
    return { reply, ...fallbackDataObj };
  }
}

export function extractApplicantFromText(text: string) {
  const norm = String(text || "").replace(/\s+/g, " ").trim();

  let salary: number | undefined;
  if (
    /(?:no\s*income|zero\s*income|0\s*income|0\s*salary|zero\s*salary|no\s*salary|nil\s*salary)/i.test(norm) ||
    (/^(?:0\s*(?:rs|inr)?|rs\.?\s*0|zero|nil|none|nothing|0rs|0)$/i.test(norm) && /(?:salary|income|earn)/i.test(norm))
  ) {
    salary = 0;
  } else {
    const salMatch = norm.match(/(?:salary|income|nmi|nth|earning|monthly\s*income)(?:\s*is)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakh|lac)?/i) ||
      norm.match(/(\d+(?:,\d+)*)\s*(k|lakh|lac)?\s*(?:salary|income)/i);
    if (salMatch) {
      let val = parseFloat(salMatch[1].replace(/,/g, ""));
      const unit = (salMatch[2] || "").toLowerCase();
      if (unit === "k") val *= 1000;
      else if (unit === "lakh" || unit === "lac") val *= 100000;
      salary = val;
    }
  }

  let loan_amount: number | undefined;
  const loanMatch =
    norm.match(/(?:loan\s*(?:amount)?|borrow|need|want|require)\s*(?:a\s*)?(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr)?/i) ||
    norm.match(/(\d+(?:,\d+)*)\s*(lakhs?|lacs?|l\b|cr)\s+(?:personal\s*)?(?:loan|borrow)/i);
  if (loanMatch) {
    let val = parseFloat(loanMatch[1].replace(/,/g, ""));
    const unit = (loanMatch[2] || "").toLowerCase();
    if (unit === "k") val *= 1000;
    else if (unit.startsWith("l")) val *= 100000;
    else if (unit.startsWith("cr")) val *= 10000000;
    loan_amount = val;
  }

  let tenure_months: number | undefined;
  const yrMatch = norm.match(/\b(\d{1,2})\s*(?:years?|yrs?|yr|y\b)(?!\s*old)\b/i);
  if (yrMatch) {
    tenure_months = parseInt(yrMatch[1], 10) * 12;
  } else {
    const moMatch = norm.match(/\b(\d{1,3})\s*(?:months?|m\b)\b/i);
    if (moMatch) tenure_months = parseInt(moMatch[1], 10);
  }

  let cibil: number | undefined;
  const cibilMatch = norm.match(/(?:cibil|credit\s*score|bureau(?:\s*score)?)(?:\s*is|:)?\s*(\d{3})/i) ||
    norm.match(/\b(\d{3})\b\s*(?:cibil|credit\s*score)/i);
  if (cibilMatch) {
    cibil = parseInt(cibilMatch[1], 10);
  }

  let existing_emi: number | undefined;
  if (
    /(?:no|0|zero|nil|none|nothing)\s*(?:existing\s*|current\s*|ongoing\s*)?(?:loan|emi)s?|no\s*loans/i.test(norm) ||
    (/^(?:0|zero|nil|none|nothing)$/i.test(norm) && !/(?:salary|income|earn)/i.test(norm))
  ) {
    existing_emi = 0;
  } else {
    const emiMatch = norm.match(/(?:existing\s*emi|current\s*emi|monthly\s*emi|emi)(?:\s*is|:)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i);
    if (emiMatch) {
      let val = parseFloat(emiMatch[1].replace(/,/g, ""));
      if ((emiMatch[2] || "").toLowerCase() === "k") val *= 1000;
      existing_emi = val;
    }
  }

  let age: number | undefined;
  const ageMatch = norm.match(/\b(?:i\s*am|age\s*(?:is|to|=|:)?)\s*(\d{1,2})\s*(?:years?\s*old|yrs?\s*old)?\b/i) ||
    norm.match(/\b(\d{1,2})\s*(?:years?\s*old|yrs?\s*old)\b/i);
  if (ageMatch) {
    const a = parseInt(ageMatch[1], 10);
    if (a >= 18 && a <= 85) age = a;
  }

  let employment_type: string | undefined;
  if (/salaried/i.test(norm)) employment_type = "Salaried";
  else if (/self\s*employed|business|proprietor|freelanc/i.test(norm)) employment_type = "Self-Employed";
  else if (/jobless|unemployed|no\s*job|without\s*(?:a\s*)?job|laid\s*off|not\s*working/i.test(norm)) {
    employment_type = "Unemployed";
    salary = 0;
  } else if (/student|in\s*college|studying/i.test(norm)) {
    employment_type = "Student";
    salary = 0;
  }

  let company: string | undefined;
  if (!isFinancialOrProfileInput(norm)) {
    company = extractCompanyCandidateFromText(norm);
  }

  const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(norm);
  const bank = bankMatch ? bankMatch[0].toUpperCase() : undefined;

  let loan_type = "Personal Loan";
  if (/home\s*loan/i.test(norm)) loan_type = "Home Loan";
  else if (/business\s*loan/i.test(norm)) loan_type = "Business Loan";
  else if (/auto\s*loan|car\s*loan/i.test(norm)) loan_type = "Auto Loan";

  return { bank, loan_type, salary, loan_amount, tenure_months, cibil, existing_emi, age, employment_type, company };
}

function formatCalculatorResult(result: any, bankName: string): string {
  const { eligibility, policySource, calculations, passedConditions, failedConditions, missingInformation, reason } = result;

  if (eligibility === "Eligible") {
    let md = `### 🏦 ${bankName} — Personal Loan Eligibility Result: ✅ ELIGIBLE\n\n`;
    md += `**Assessment Summary**:\n`;
    md += `• **Overall Decision**: ✅ **Eligible**\n`;
    md += `• **Policy Source**: ${policySource}\n\n`;
    if (calculations && calculations.netSalary != null) {
      md += `**Calculated Obligation & Capacity**:\n`;
      md += `• **Net Monthly Salary**: ₹${calculations.netSalary.toLocaleString("en-IN")}\n`;
      if (calculations.foirPercent != null) md += `• **Max Permissible FOIR**: ${calculations.foirPercent}%\n`;
      if (calculations.maxPermissibleEmi != null) md += `• **Max Permissible EMI Cap**: ₹${calculations.maxPermissibleEmi.toLocaleString("en-IN")}\n`;
      if (calculations.existingEmi != null) md += `• **Existing Monthly EMIs**: ₹${calculations.existingEmi.toLocaleString("en-IN")}\n`;
      if (calculations.netAvailableEmi != null) md += `• **Net Available EMI Capacity**: ₹${calculations.netAvailableEmi.toLocaleString("en-IN")}/month\n`;
      if (calculations.estimatedMaxLoanAmount != null) md += `• **Estimated Max Loan Eligibility**: ~₹${calculations.estimatedMaxLoanAmount.toLocaleString("en-IN")}\n`;
      md += `\n`;
    }
    if (passedConditions && passedConditions.length > 0) {
      md += `**Verified Policy Conditions**:\n`;
      passedConditions.forEach((c: string) => { md += `• ${c}\n`; });
    }
    return md;
  }

  if (eligibility === "Not Eligible") {
    let md = `### 🏦 ${bankName} — Personal Loan Eligibility Result: ❌ NOT ELIGIBLE\n\n`;
    md += `**Assessment Summary**:\n`;
    md += `• **Overall Decision**: ❌ **Not Eligible**\n`;
    md += `• **Policy Source**: ${policySource}\n\n`;
    if (failedConditions && failedConditions.length > 0) {
      md += `**Failed Policy Criteria**:\n`;
      failedConditions.forEach((c: string) => { md += `• ${c}\n`; });
      md += `\n`;
    }
    if (passedConditions && passedConditions.length > 0) {
      md += `**Passed Policy Conditions**:\n`;
      passedConditions.forEach((c: string) => { md += `• ${c}\n`; });
    }
    return md;
  }

  let md = `### 🏦 ${bankName} — Personal Loan Eligibility Evaluation\n\n`;
  md += `**Status**: ⚠️ **Input Required / Conditionally Eligible**\n\n`;
  if (missingInformation && missingInformation.length > 0) {
    md += `To evaluate your exact loan approval and maximum permissible loan amount, please provide:\n`;
    missingInformation.forEach((info: string) => { md += `• **${info}**\n`; });
  } else if (reason) {
    md += `${reason}\n`;
  }
  return md;
}

/**
 * Send deterministic data to the LLM and let it generate the final
 * user-facing response. Services and tools return data only; the LLM owns
 * every final response. Returns the raw data if the LLM is unavailable.
 */
async function finalizeWithLlm(userMessage: string, data: string): Promise<string> {
  if (!OPENROUTER_API_KEY) return data;
  return summarizeToolResult(userMessage, "deterministic-engine", data);
}

/**
 * Handles casual conversational messages, small talk, and assistant capability questions
 * using LLM without performing any unintended company search or loan evaluation.
 */
async function handleCasualMessage(
  message: string,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  eligibilitySession?: any
): Promise<string> {
  const apiKey = getApiKey();

  if (apiKey) {
    const modelsToTry = [modelOverride, getModel(), "openrouter/free"].filter(Boolean) as string[];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let systemContent =
          "You are CreditWise AI, a friendly, warm, and helpful personal loan advisor.\n" +
          "Respond warmly, conversationally, and in simple, natural everyday language in your own words to the user's remark, acknowledgement, thanks, casual message, or question.\n" +
          "Avoid stiff, dry, or overly technical banking jargon.\n" +
          "Analyze the full conversation context to understand what the user is referring to.\n" +
          "Do NOT search for companies, and do NOT trigger loan applications unless explicitly asked.\n" +
          "Output ONLY your conversational response.";

        if (eligibilitySession?.applicant) {
          const comp = eligibilitySession.applicant.companyName ? ` for ${eligibilitySession.applicant.companyName}` : "";
          systemContent += `\nContext: The user has an active loan eligibility assessment${comp}. If they are saying thanks, ok, or wrapping up, you may smoothly invite them to continue whenever they're ready, without using rigid templates.`;
        }

        const messages: any[] = [
          {
            role: "system",
            content: systemContent,
          },
        ];

        if (conversationHistory && conversationHistory.length > 0) {
          const hist = conversationHistory.slice(-6);
          for (const m of hist) {
            if (m.content && m.content.trim()) {
              messages.push({
                role: m.role === "assistant" || m.role === "ai" ? "assistant" : "user",
                content: m.content.trim(),
              });
            }
          }
        }

        messages.push({ role: "user", content: message });

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3001",
            "X-Title": "CreditWise AI",
          },
          body: JSON.stringify({
            model,
            max_tokens: 250,
            temperature: 0.4,
            reasoning: { max_tokens: 0 },
            messages,
          }),
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return stripReasoningPreamble(content.trim());
          }
        }
      } catch (err: any) {
        console.warn(`[Casual Message LLM] Failed with model ${model}:`, err?.message || err);
      }
    }
  }

  return "I'm here to help! You can ask me to evaluate your personal loan eligibility across 20+ partner banks, calculate an EMI, look up bank policies, or connect with branch managers.";
}

/**
 * Handles Calculation intent (EMI, installment, borrowing capacity).
 * Fully supports partial calculations where only some numbers are provided.
 */
async function handleCalculationIntent(
  userMessage: string,
  classification: IntentClassificationResult,
  existingApplicant?: any,
  modelOverride?: string
): Promise<string> {
  // 1. Extract principal (loan amount)
  let principal = classification.extracted?.loanAmount;
  if (!principal) {
    const amtMatch =
      userMessage.match(/(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?)/i) ||
      userMessage.match(/(?:amount|of|for|loan\s*of)\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    if (amtMatch) {
      principal = parseFinancialAmount(amtMatch[1] + (amtMatch[2] || "")) || undefined;
    }
  }
  if (!principal && existingApplicant?.loanAmount) {
    principal = existingApplicant.loanAmount;
  }

  // 2. Extract interest rate
  let rate = classification.extracted?.interestRate;
  if (!rate) {
    const rateMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*%/);
    if (rateMatch) {
      rate = parseFloat(rateMatch[1]);
    }
  }

  // 3. Extract tenure
  let tenure = classification.extracted?.tenureMonths;
  if (!tenure) {
    const tenureMatch = userMessage.match(/(\d+)\s*(?:years?|yrs?)/i);
    if (tenureMatch) {
      tenure = parseInt(tenureMatch[1], 10) * 12;
    } else {
      const monthMatch = userMessage.match(/(\d+)\s*(?:months?|m\b)/i);
      if (monthMatch) {
        tenure = parseInt(monthMatch[1], 10);
      }
    }
  }
  if (!tenure && existingApplicant?.tenureMonths) {
    tenure = existingApplicant.tenureMonths;
  }

  const numPrincipal = typeof principal === "number" ? principal : (principal && !isNaN(Number(principal)) ? Number(principal) : 0);
  const numTenure = typeof tenure === "number" ? tenure : (tenure && !isNaN(Number(tenure)) ? Number(tenure) : 0);

  // Support partial calculation if principal is available
  if (numPrincipal > 0) {
    const effectiveRate = rate || 10.5;
    const effectiveTenure = numTenure || 60;
    const monthlyEmi = calculateEmi(numPrincipal, effectiveRate, effectiveTenure);
    let md = formatEmiResult({ principal: numPrincipal, rate: effectiveRate, tenure: effectiveTenure }, monthlyEmi);

    const notes: string[] = [];
    if (!rate) {
      notes.push(
        `Annual interest rate was not specified; calculated at an indicative standard benchmark of **${effectiveRate}% p.a.** (personal loan rates typically range from 10.25% to 14.5% p.a.).`
      );
    }
    if (!tenure) {
      notes.push(
        `Repayment tenure was not specified; calculated for a standard tenure of **${effectiveTenure} months (5 years)**.`
      );
    }
    if (notes.length > 0) {
      md += `\n> [!NOTE]\n> ${notes.join("\n> ")}\n`;
    }
    return md;
  }

  return (
    `### 🧮 Loan EMI Calculator\n\n` +
    `To calculate your estimated monthly installment (EMI), please provide:\n` +
    `• **Loan Amount**: Desired amount (e.g. ₹5 Lakhs, ₹10 Lakhs)\n` +
    `• **Repayment Tenure**: Preferred duration in months or years (e.g. 3 years, 5 years)\n` +
    `• **Interest Rate**: Annual rate percentage (e.g. 10.5% p.a., or we can calculate using standard partner benchmarks)\n\n` +
    `*Example: "What is the EMI for 10 lakhs at 11% for 5 years?"*`
  );
}

/**
 * Answers general banking questions, concept definitions, or FAQs using the LLM.
 * For concepts like FOIR, gives a natural explanation without generic eligibility percentages.
 * Never returns hardcoded greeting/fallback responses for valid questions.
 */
async function answerGeneralQuestionWithLLM(
  userMessage: string,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  eligibilitySession?: any,
  isEligibleFlowActive?: boolean
): Promise<string> {
  const apiKey = getApiKey();

  if (apiKey) {
    const modelsToTry = [
      modelOverride,
      getModel(),
      "openrouter/auto",
      "openrouter/free",
    ].filter(Boolean) as string[];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        let systemContent =
          "You are CreditWise AI, a friendly and helpful personal loan advisor.\n" +
          "Answer the user's question, doubt, or objection in simple, natural, everyday conversational language using GitHub Markdown.\n\n" +
          "COMMUNICATION STYLE & EXPLANATION GUIDELINES:\n" +
          "- Speak warmly, simply, and conversationally like a trusted guide explaining concepts to a friend.\n" +
          "- Avoid stiff, bureaucratic, or overly technical banking jargon. Explain all financial ideas in plain, everyday terms that anyone can understand effortlessly.\n" +
          "- For concepts like FOIR (Fixed Obligation to Income Ratio):\n" +
          "  Explain it as a simple monthly budget check—banks look at how much of your monthly income is already used for EMIs, to ensure you can comfortably handle repayments without stretching your monthly budget.\n" +
          "- For CIBIL / Credit Score:\n" +
          "  Explain that your score acts like a financial report card. A score of 700+ helps you unlock better rates and faster approval. Checking eligibility here is a soft check that never affects your score.\n" +
          "- For Age criteria: Explain that banks look at age (typically 21 to 60) to ensure you have enough working years left before retirement to comfortably repay the loan.\n" +
          "- For Employer / Company: Explain that banks offer better interest rates and higher loan limits to employees of recognized companies on their preferred lists.\n" +
          "- For Personal Loans: Clarify that personal loans are unsecured, meaning you do not need to provide any collateral or security deposit.\n" +
          "- Do NOT use rigid greeting preambles (such as 'I am CreditWise AI, your banking assistant...'). Go straight to the helpful, natural explanation.";

        if (isEligibleFlowActive && eligibilitySession) {
          const applicant = eligibilitySession.applicant || {};
          const nextField =
            eligibilitySession.expectedField ||
            (eligibilitySession.missingFields && eligibilitySession.missingFields[0]) ||
            "monthlyIncome";
          systemContent +=
            `\n\nACTIVE ASSESSMENT CONTEXT:\n` +
            `- The user is currently in a personal loan eligibility evaluation.\n` +
            `- Known details: ${JSON.stringify(applicant)}.\n` +
            `- Next detail needed: ${nextField}.\n` +
            `- INSTRUCTION: Directly address the user's inquiry, question, or objection warmly and clearly. Then, naturally invite them to share their ${nextField} (or continue their assessment) in a cohesive, friendly sentence without using rigid dividers or robotic templates.`;
        }

        const messages: any[] = [
          {
            role: "system",
            content: systemContent,
          },
        ];

        if (conversationHistory && conversationHistory.length > 0) {
          const hist = conversationHistory.slice(-6);
          for (const m of hist) {
            if (m.content && m.content.trim()) {
              messages.push({
                role: m.role === "assistant" || m.role === "ai" ? "assistant" : "user",
                content: m.content.trim(),
              });
            }
          }
        }

        messages.push({ role: "user", content: userMessage });

        const streamToken = agentTokenStorage.getStore();
        if (streamToken) {
          const { openRouterChatStream } = await import("@/lib/openrouter");
          const streamed = await openRouterChatStream(
            messages,
            streamToken,
            { model, signal: controller.signal, temperature: 0.2 }
          );
          clearTimeout(timeoutId);
          if (typeof streamed === "string" && streamed.trim().length > 0) {
            return stripReasoningPreamble(streamed.trim());
          }
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3001",
            "X-Title": "CreditWise AI",
          },
          body: JSON.stringify({
            model,
            max_tokens: 500,
            temperature: 0.2,
            reasoning: { max_tokens: 0 },
            messages,
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return stripReasoningPreamble(content.trim());
          }
        }
      } catch (err: any) {
        console.warn(`[General QA LLM] Failed with model ${model}:`, err?.message || err);
      }
    }
  }

  const fallbackSideQ = detectAndAnswerSideQuestion(userMessage);
  if (fallbackSideQ.isQuestion && fallbackSideQ.answer) {
    return fallbackSideQ.answer;
  }

  return "I'm here to help with all your personal loan questions! While our AI network is momentarily busy, feel free to share your loan details, calculate an EMI, or check official bank policies.";
}

/**
 * Handles General Information intent (Bank Policies, Bank Managers, Company Categories, Concept Definitions).
 * Always answers the question directly without asking the next eligibility question.
 */
async function handleGeneralInformationIntent(
  userMessage: string,
  classification: IntentClassificationResult,
  modelOverride?: string
): Promise<AgentResult> {
  const norm = userMessage.toLowerCase();

  // 1. Bank Manager Inquiry
  if (
    classification.subIntent === "BANK_MANAGER_SEARCH" ||
    /manager|contact|phone|mobile|email|branch\s*head|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b/i.test(norm)
  ) {
    const filters: { bank_name?: string; city?: string; pincode?: string } = {};
    const resolvedBank = resolveBankName(userMessage);
    if (resolvedBank) filters.bank_name = resolvedBank.bankName;
    if (classification.extracted?.city) filters.city = classification.extracted.city;
    if (classification.extracted?.targetBank) filters.bank_name = classification.extracted.targetBank;

    const bankData = await searchBankManager({ ...filters, query: userMessage });
    if (bankData?.length) {
      return {
        reply: formatManagers(bankData, userMessage),
        bankData,
      };
    }
    return {
      reply: `No official bank manager records found matching "${userMessage}". Please check the bank name, city, or branch.`,
      bankData: [],
    };
  }

  // 2. Bank Policy Query: For bank-specific questions, use ONLY that bank's Master Policy!
  const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla|poonawala|yes|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm|aditya|abfl|birla|home\s*loan|l&t|ltf|lt\s*finance/i.exec(userMessage);
  const targetBank = classification.extracted?.targetBank || (bankMatch ? bankMatch[0] : "");
  if (
    targetBank &&
    (classification.subIntent === "POLICY_INQUIRY" ||
      /policy|cibil|cutoff|foir|interest|rate|multiplier|age|salary|tenure|rule|criteria|minimum|maximum|limit|band|document|doc|cat|category|tier/i.test(norm))
  ) {
    const policyResult = await answerBankPolicyWithMasterPolicy(targetBank, userMessage, modelOverride);
    if (policyResult) {
      return { reply: policyResult };
    }
  }

  // 3. Corporate Employer Rating / Category Query
  if (
    classification.subIntent === "COMPANY_SEARCH" ||
    (/(?:company|employer|category\s*rating|company\s*tier|corporate\s*listing|is.*listed)/i.test(norm) && !/policy|rule|cutoff|foir|tenure|cibil/i.test(norm))
  ) {
    const rawTarget = classification.extracted?.companyName || userMessage;
    const cleanFromExtracted = classification.extracted?.companyName ? (extractCleanCompanyName(classification.extracted.companyName) || extractCompanyCandidateFromText(classification.extracted.companyName)) : "";
    const cleanFromUser = extractCleanCompanyName(userMessage) || extractCompanyCandidateFromText(userMessage) || extractTargetCompanyFromMessage(userMessage);
    const compQuery = cleanFromExtracted || cleanFromUser || (rawTarget && !isInvalidCompanyName(rawTarget) ? rawTarget.replace(/(?:is|what\s*is|tell\s*me\s*about|search|check|category|rating|of|for|listed\s*in)\b/gi, "").trim() : "");
    if (compQuery && !isInvalidCompanyName(compQuery)) {
      const company = await searchCompany(compQuery);
      if (company?.found) {
        if (company.needsDisambiguation && company.candidateOptions && company.candidateOptions.length > 1) {
          const candidateNames = company.candidateOptions.map((c) => c.name);
          const reply = formatCompanyCandidateList(candidateNames, compQuery);
          return {
            reply,
            companyData: {
              company_flow: "COMPANY_SELECTION",
              needs_disambiguation: true,
              candidates: company.candidateOptions,
              candidateOptions: company.candidateOptions,
              searchQuery: compQuery,
            },
          };
        }
        const nextStepText = `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion("monthlyIncome")}`;
        return {
          reply: `${formatCompanyResponse(company)}\n\n${nextStepText}`,
          companyData: {
            company_name: company.primaryName,
            overview: company.overview,
            basic_info: company.basicInfo,
            financial_info: company.financialInfo,
            bank_records: company.bankRecords,
            needs_disambiguation: company.needsDisambiguation,
            candidates: company.candidates,
          },
        };
      }
      return {
        reply: `No corporate company listing records found for "${compQuery}".`,
      };
    }
  }

  // 4. General Banking Concept / FAQ / AI answer (e.g. "What is FOIR?")
  const llmReply = await answerGeneralQuestionWithLLM(userMessage, modelOverride);
  return { reply: llmReply };
}

/**
 * Handles Changing Details intent. Replaces old values with new values across any of the 8 profile parameters
 * (company, salary, CIBIL, age, loan amount, tenure, employment type, existing EMI) and recalculates eligibility immediately.
 */
async function handleChangingDetailsIntent(
  conversationId: string,
  userMessage: string,
  classification: IntentClassificationResult,
  eligibilitySession: any,
  modelOverride?: string
): Promise<AgentResult> {
  let applicant: ApplicantProfile = eligibilitySession?.applicant
    ? { ...eligibilitySession.applicant }
    : { loanType: "Personal Loan" };

  const res = await applyProfileUpdateAndRecalculate(
    conversationId,
    userMessage,
    applicant,
    classification.extracted,
    modelOverride
  );

  return {
    reply: res.reply,
    companyData: res.evalResult?.companyMatch?.isFound
      ? {
        company_name: res.evalResult.companyMatch.matchedName || res.evalResult.companyMatch.searchedName,
        category: res.evalResult.companyMatch.bankCategories,
        needs_disambiguation: false,
      }
      : undefined,
  };
}

function getFlowContinuationHint(eligibilitySession: any): string {
  if (!eligibilitySession) return "";
  const applicant = eligibilitySession.applicant || {};
  const missing = eligibilitySession.missingFields || [];
  const expectedField = eligibilitySession.expectedField || (missing.length > 0 ? missing[0] : null);

  const hints: Record<string, string> = {
    companyName: "What is your company or employer name?",
    monthlyIncome: "What is your approximate net monthly take-home salary?",
    loanAmount: "How much loan amount are you looking to borrow?",
    tenureMonths: "What repayment tenure would you prefer?",
    cibil: "What is your approximate CIBIL score? (You can say 0 or unknown if unsure)",
    existingEmi: "Do you have any existing monthly loan EMIs? (Or say 'none' if clear)",
    age: "What is your current age in years?",
  };

  const nextQ = expectedField && hints[expectedField] ? hints[expectedField] : "Would you like to proceed with your assessment?";
  const comp = applicant.companyName ? ` for **${applicant.companyName}**` : "";

  return `\n\nWhenever you'd like to continue your personal loan assessment${comp}: ${nextQ}`;
}

/**
 * 1. Tool Executor: calculate_emi
 */
async function executeCalculateEmi(
  args: { principal?: number; rate?: number; tenureMonths?: number },
  userMessage: string,
  existingApplicant?: any,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any,
  modelOverride?: string
): Promise<AgentResult> {
  const principal = args.principal || existingApplicant?.loanAmount;
  const tenureMonths = args.tenureMonths || existingApplicant?.tenureMonths;
  const rate = args.rate || 10.5;

  let calcReply = "";
  if (principal && tenureMonths) {
    const monthlyRate = rate / 12 / 100;
    const emi = Math.round(
      (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1)
    );
    const totalPayable = emi * tenureMonths;
    const totalInterest = totalPayable - principal;

    calcReply = `### 📊 Loan EMI Calculation\n\n` +
      `Here is the estimated installment breakdown for a personal loan of **₹${principal.toLocaleString("en-IN")}**:\n\n` +
      `| Parameter | Value |\n` +
      `| :--- | :--- |\n` +
      `| **Loan Principal** | ₹${principal.toLocaleString("en-IN")} |\n` +
      `| **Interest Rate** | ${rate}% p.a. |\n` +
      `| **Repayment Tenure** | ${tenureMonths} months (${Math.round((tenureMonths / 12) * 10) / 10} years) |\n` +
      `| **Estimated Monthly EMI** | **₹${emi.toLocaleString("en-IN")}** |\n` +
      `| **Total Interest Payable** | ₹${totalInterest.toLocaleString("en-IN")} |\n` +
      `| **Total Repayment Amount** | ₹${totalPayable.toLocaleString("en-IN")} |\n\n` +
      `*💡 Note: Actual interest rate, EMI, and loan amount depend on the lending bank's Master Policy rules and your employer category.*`;
  } else {
    const classification: any = {
      intent: "CALCULATION",
      extracted: {
        loanAmount: args.principal,
        tenureMonths: args.tenureMonths,
        interestRate: args.rate,
      },
    };
    calcReply = await handleCalculationIntent(userMessage, classification, existingApplicant, modelOverride);
  }

  return { reply: calcReply };
}

/**
 * Formats a clear, structured response when an unsupported or unavailable bank's policy is requested.
 * Explicitly mentions that only available partner-bank policies can be provided and suggests asking for another partner bank.
 */
async function formatBankPolicyNotAvailableResponse(requestedBank?: string): Promise<string> {
  const bankLabel = requestedBank ? ` for **${requestedBank}**` : "";
  const dynamicBankList = await formatAvailablePolicyBanksList();

  return (
    `### 🏦 Bank Policy Not Available\n\n` +
    `The requested bank policy${bankLabel} is **not available** in our stored records.\n\n` +
    `We can only provide official policy guidelines for our **partner banks** whose Master Policies are actively stored and maintained in our platform.\n\n` +
    dynamicBankList
  );
}

export function isBankAvailabilityQuery(message: string): {
  isAvailableBanksList: boolean;
  isSpecificBankAvailability: boolean;
  bankName?: string;
} {
  const norm = message.toLowerCase().trim();
  const clean = norm.replace(/[?.,!]/g, "").trim();

  // 1. General available banks list query
  const isAvailableBanksList =
    /^(?:tell\s+me\s+|show\s+|list\s+|what\s+are\s+|which\s+|display\s+|get\s+)?(?:all\s+)?(?:the\s+)?available\s+(?:partner\s+)?banks?$/i.test(clean) ||
    /^(?:tell\s+me\s+|show\s+|list\s+|what\s+are\s+|which\s+)?(?:partner\s+banks?|banks?\s+available|available\s+bank\s+policies)$/i.test(clean) ||
    /^(?:which|what)\s+banks?\s+(?:have|has|do\s+have)\s+(?:loan\s+)?polic(?:y|ies)\s*(?:available|stored)?$/i.test(clean) ||
    /^(?:which|what)\s+bank\s+policies\s+are\s+available$/i.test(clean) ||
    /^(?:show|tell\s+me|list|give\s+me)\s+(?:available\s+)?partner\s+banks?$/i.test(clean) ||
    /^(?:list\s+of\s+available\s+banks|list\s+of\s+partner\s+banks)$/i.test(clean) ||
    /^(?:which|what)\s+banks\s+are\s+available$/i.test(clean);

  if (isAvailableBanksList) {
    return { isAvailableBanksList: true, isSpecificBankAvailability: false };
  }

  // 2. Specific bank policy availability query: e.g. "is Bandhan Bank policy available?", "is Bandhan Bank available for personal loans?", "does Bandhan Bank offer personal loans?"
  const specificMatch =
    /^(?:is|are|does)\s+(?:the\s+)?(.+?)\s*(?:loan\s*)?polic(?:y|ies)\s*(?:available|stored|supported|present)(?:\s+(?:for|to|in)\s+.*)?$/i.exec(clean) ||
    /^(?:is\s+)(.+?)\s*(?:policy\s*)?available(?:\s+(?:for|to|in)\s+.*)?$/i.exec(clean) ||
    /^(?:can\s+i\s+check\s+)(.+?)\s*(?:loan\s*)?polic(?:y|ies)$/i.exec(clean) ||
    /^(?:does\s+)(.+?)\s+(?:provide|offer|give|have)\s+(?:personal\s+)?loans?$/i.exec(clean) ||
    /^(?:can\s+i\s+(?:apply|get|avail)(?:\s+for)?\s+(?:a\s+)?(?:personal\s+)?loans?\s+(?:from|at|in|with)\s+)(.+)$/i.exec(clean);

  if (specificMatch) {
    let rawBank = specificMatch[1]?.trim();
    if (rawBank) {
      rawBank = rawBank.replace(/\s+(?:available\s+)?(?:for|in|to)\s+(?:personal\s+)?loans?$/i, "").trim();
      if (rawBank && !/^(?:all|any|our|your|the|what|which|a|an)$/i.test(rawBank)) {
        return { isAvailableBanksList: false, isSpecificBankAvailability: true, bankName: rawBank };
      }
    }
  }

  return { isAvailableBanksList: false, isSpecificBankAvailability: false };
}

function extractUnsupportedBankName(message: string): string | undefined {
  const norm = message.toLowerCase().trim();
  if (
    /bank\s*that\s*is(?:n['’]t|not)\s*available/i.test(norm) ||
    /unavailable\s*bank/i.test(norm) ||
    /unsupported\s*bank/i.test(norm) ||
    /bank\s*not\s*(?:in|available|present)/i.test(norm) ||
    isMultiBankEligibilityQuery(message)
  ) {
    return undefined;
  }

  const isGenericBankPhrase = (s: string) =>
    /^(?:all|any|a|an|the|our|your|my|which|what|each|every|other|some|best|partner|multiple|several|various|different)\s+(?:banks?|lenders?)$/i.test(s.trim());

  const known = /(?:citibank|citi|bank\s*of\s*baroda|bob|punjab\s*national\s*bank|pnb|canara\s*bank|canara|union\s*bank|rbl\s*bank|rbl|hsbc|standard\s*chartered|scb|dbs\s*bank|dbs|federal\s*bank|south\s*indian\s*bank)/i.exec(message);
  if (known) {
    const raw = known[0];
    if (/citi/i.test(raw)) return "Citibank";
    if (/baroda|bob/i.test(raw)) return "Bank of Baroda";
    if (/punjab|pnb/i.test(raw)) return "Punjab National Bank";
    if (/canara/i.test(raw)) return "Canara Bank";
    if (/union/i.test(raw)) return "Union Bank of India";
    if (/rbl/i.test(raw)) return "RBL Bank";
    if (/hsbc/i.test(raw)) return "HSBC Bank";
    if (/standard|scb/i.test(raw)) return "Standard Chartered Bank";
    if (/dbs/i.test(raw)) return "DBS Bank";
    if (/federal/i.test(raw)) return "Federal Bank";
    return raw;
  }

  const pat1 = /(?:policy|guidelines?|rules?|criteria|cutoff|cut-off)\s*(?:of|for)?\s+([A-Za-z0-9&'.-]+(?:\s+[A-Za-z0-9&'.-]+)?\s*bank)/i.exec(message);
  if (pat1 && !/a\s*bank|any\s*bank|the\s*bank/i.test(pat1[1]) && !isGenericBankPhrase(pat1[1])) {
    return pat1[1].trim();
  }

  const pat2 = /([A-Za-z0-9&'.-]+(?:\s+[A-Za-z0-9&'.-]+)?\s*bank)\s*(?:'s)?\s*(?:policy|guidelines?|rules?|criteria|cutoff|cut-off)/i.exec(message);
  if (pat2 && !/a\s*bank|any\s*bank|the\s*bank/i.test(pat2[1]) && !isGenericBankPhrase(pat2[1])) {
    return pat2[1].trim();
  }

  const pat3 = /(?:required\s+by|approved\s+by|offered\s+by|at|for|by|in)\s+([A-Za-z0-9&'.-]+(?:\s+[A-Za-z0-9&'.-]+)?\s*bank)/i.exec(message);
  if (pat3 && !/a\s*bank|any\s*bank|the\s*bank/i.test(pat3[1]) && !isGenericBankPhrase(pat3[1])) {
    return pat3[1].trim();
  }

  const pat4 = /([A-Za-z0-9&'.-]+(?:\s+[A-Za-z0-9&'.-]+)?\s*bank)/i.exec(message);
  if (pat4 && !/a\s*bank|any\s*bank|the\s*bank|partner\s*bank/i.test(pat4[1]) && !isGenericBankPhrase(pat4[1])) {
    return pat4[1].trim();
  }

  return undefined;
}

/**
 * Core Multi-Bank Loan Eligibility Flow (Sections 2, 3, 8, 9, 10, 19)
 * Handles cross-bank eligibility requests deterministically across all partner lenders.
 */
async function handleMultiBankEligibilityCheck(
  userMessage: string,
  eligibilitySession: SessionState | null,
  conversationId: string,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult> {
  // Step 1: Identify available applicant information from user message, conversation state, and history
  const currentApplicant: ApplicantProfile = {
    ...(eligibilitySession?.applicant || {}),
  };

  if (Array.isArray(conversationHistory)) {
    for (const msg of conversationHistory) {
      if (msg.role === "user" && msg.content) {
        const histUpdates = extractApplicantDetails(msg.content);
        const histRaw = extractEntitiesFromText(msg.content);
        Object.assign(currentApplicant, histUpdates);
        if (histRaw.monthlyIncome && !currentApplicant.monthlyIncome) currentApplicant.monthlyIncome = histRaw.monthlyIncome;
        if (histRaw.cibil && !currentApplicant.cibil) currentApplicant.cibil = histRaw.cibil;
        if (histRaw.age && !currentApplicant.age) currentApplicant.age = histRaw.age;
        if (histRaw.existingEmi !== undefined && currentApplicant.existingEmi === undefined) currentApplicant.existingEmi = histRaw.existingEmi;
        if (histRaw.employmentType && !currentApplicant.employmentType) currentApplicant.employmentType = histRaw.employmentType;
        if (histRaw.companyName && !currentApplicant.companyName) currentApplicant.companyName = histRaw.companyName;
      }
    }
  }

  const textUpdates = extractApplicantDetails(userMessage);
  const rawEntities = extractEntitiesFromText(userMessage);
  const profileUpdates = extractProfileUpdates(userMessage, rawEntities).updates;

  Object.assign(currentApplicant, textUpdates, profileUpdates);

  if (rawEntities.monthlyIncome && !currentApplicant.monthlyIncome) currentApplicant.monthlyIncome = rawEntities.monthlyIncome;
  if (rawEntities.cibil && !currentApplicant.cibil) currentApplicant.cibil = rawEntities.cibil;
  if (rawEntities.age && !currentApplicant.age) currentApplicant.age = rawEntities.age;
  if (rawEntities.existingEmi !== undefined && currentApplicant.existingEmi === undefined) currentApplicant.existingEmi = rawEntities.existingEmi;
  if (rawEntities.employmentType && !currentApplicant.employmentType) currentApplicant.employmentType = rawEntities.employmentType;
  if (rawEntities.companyName && !currentApplicant.companyName) currentApplicant.companyName = rawEntities.companyName;
  if (rawEntities.loanAmount && !currentApplicant.loanAmount) currentApplicant.loanAmount = rawEntities.loanAmount;
  if (rawEntities.tenureMonths && !currentApplicant.tenureMonths) currentApplicant.tenureMonths = rawEntities.tenureMonths;

  if (currentApplicant.companyName) {
    currentApplicant.companyName = currentApplicant.companyName
      .replace(/^(?:salaried\s+at|working\s+(?:at|in)|employed\s+at|at)\s+/i, "")
      .trim();
  }

  // Defaults for evaluation
  if (!currentApplicant.loanAmount || Number(currentApplicant.loanAmount) <= 0) {
    currentApplicant.loanAmount = 500000;
  }
  if (!currentApplicant.tenureMonths || Number(currentApplicant.tenureMonths) <= 0) {
    currentApplicant.tenureMonths = 60;
  }
  if (!currentApplicant.employmentType && (currentApplicant.monthlyIncome || currentApplicant.companyName)) {
    currentApplicant.employmentType = "Salaried";
  }

  // Step 2: Identify missing information
  const salaryNum = Number(currentApplicant.monthlyIncome) || 0;
  const cibilNum = Number(currentApplicant.cibil) || 0;
  const ageNum = Number(currentApplicant.age) || 0;
  const hasEmi = currentApplicant.existingEmi !== undefined && currentApplicant.existingEmi !== null;

  const isMissingCritical =
    salaryNum <= 0 ||
    cibilNum < 300 ||
    ageNum < 18 ||
    !hasEmi;

  if (isMissingCritical) {
    const intakePrompt = buildMultiBankIntakePrompt(currentApplicant);
    const updatedSession: SessionState = {
      ...(eligibilitySession || {}),
      in_eligibility_flow: true,
      activeFlow: "MULTI_BANK_ELIGIBILITY_CHECK",
      mainUserGoal: "PERSONAL_LOAN",
      applicant: currentApplicant,
      currentStep: "MULTI_BANK_COLLECTING_DETAILS",
      updatedAt: Date.now(),
    } as SessionState;

    if (conversationId) {
      await saveEligibilityState(conversationId, updatedSession);
    }
    return {
      reply: intakePrompt,
      customState: updatedSession,
    };
  }

  // Step 3: All critical information present -> Retrieve policies and evaluate across all partner lenders deterministically
  const evalResult = await evaluateApplicantAgainstAllBanks(currentApplicant, "Personal Loan");
  let report = formatMultiBankEligibilityReport(currentApplicant, evalResult);

  const isLowestCibilQuery =
    /\b(?:lowest|minimum)\s+(?:cibil|credit\s*score)\b/i.test(userMessage) ||
    /which\s+bank\s+(?:has|offers|requires|features)\s+(?:the\s+)?lowest\s+cibil/i.test(userMessage);

  if (isLowestCibilQuery) {
    const lowestCibilSection = `\n\n### 🎯 Lowest CIBIL Requirements Across Partner Banks

Based on stored partner bank and NBFC master policies:
* **Lowest Cutoffs (Scored Borrowers)**:
  * **Piramal Finance**: **650+** *(Lowest cutoff among all partner NBFCs/lenders)*
  * **Utkarsh Small Finance Bank**: **650+** *(Lowest cutoff among partner small finance banks)*
  * **Chola (Cholamandalam)**: **675+**
  * **IDFC FIRST Bank**: **690+**
* **Standard Institutional Cutoff (700+)**:
  * **Axis Bank, ABFL, Bajaj Markets, Fibe, Finnable, IndusInd, LT Finance, Poonawalla**: **700+**
* **Higher Tier Cutoffs**:
  * **SMFG India Credit**: **705+**
  * **Axis Finance, Bajaj Finserv, SBM Bank**: **720+**
  * **Tata Capital**: **725+** *(Also accepts New-to-Credit / CIBIL -1)*
  * **Bandhan Bank, Yes Bank**: **731+**

${
  currentApplicant.cibil && Number(currentApplicant.cibil) < 650
    ? `> ⚠️ **CIBIL Assessment**: With your current score of **${currentApplicant.cibil}**, none of our partner lenders qualify because the minimum threshold across all partners is **650+**. To obtain funding, consider applying with a creditworthy co-applicant (CIBIL 700+) or a secured credit-builder product.`
    : ""
}`;
    report += lowestCibilSection;
  }

  const updatedSession: SessionState = {
    ...(eligibilitySession || {}),
    in_eligibility_flow: false,
    activeFlow: "MULTI_BANK_ELIGIBILITY_CHECK",
    mainUserGoal: "PERSONAL_LOAN",
    currentStep: "MULTI_BANK_EVALUATION_COMPLETE",
    hasCompletedEvaluation: true,
    applicant: currentApplicant,
    evaluations: evalResult.evaluations,
    updatedAt: Date.now(),
  } as SessionState;

  if (conversationId) {
    await saveEligibilityState(conversationId, updatedSession);
  }

  return {
    reply: report,
    customState: updatedSession,
  };
}

/**
 * 2. Tool Executor: lookup_master_policy
 * STRICT POLICY: Master Policy .txt files are the sole source of truth.
 * Zero guessing or defaulting. No internal tokens (NOT_DEFINED, NEEDS_REVIEW).
 */
async function executeLookupMasterPolicy(
  args: { bankName?: string; questionTopic?: string },
  userMessage: string,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any,
  modelOverride?: string
): Promise<AgentResult> {
  // If the query is an across-bank multi-lender eligibility request, route to multi-bank engine
  if (isMultiBankEligibilityQuery(userMessage)) {
    return await handleMultiBankEligibilityCheck(userMessage, eligibilitySession, "", modelOverride);
  }
  const query = args.questionTopic || userMessage;
  const candidateBankName =
    args.bankName ||
    extractUnsupportedBankName(userMessage) ||
    eligibilitySession?.lastPolicyBank ||
    eligibilitySession?.selectedBank ||
    eligibilitySession?.chosenBank ||
    "";

  // 1. Resolve policy target using canonical PostgreSQL resolver (banks JOIN bank_policy_files)
  const resolvedTarget = candidateBankName
    ? await resolvePolicyTarget(candidateBankName)
    : await resolvePolicyTarget(userMessage);

  const isDocQuery = /\b(?:doc|docs|document|documents|paperwork|statement|payslip|itr|kyc|checklist)\b/i.test(query);
  if (isDocQuery) {
    if (resolvedTarget) {
      const docReply = formatBankDocumentTable(resolvedTarget.bankName);
      if (eligibilitySession) {
        eligibilitySession.lastPolicyBank = resolvedTarget.bankName;
        eligibilitySession.selectedBank = resolvedTarget.bankName;
        eligibilitySession.chosenBank = resolvedTarget.bankName;
      }
      const suggestion = isEligibleFlowActive
        ? "\n\nWhenever you're ready, we can return to your loan eligibility check."
        : "";
      return { reply: docReply + suggestion, bankData: { bank_name: resolvedTarget.bankName } };
    } else if (!candidateBankName || candidateBankName === "partner banks") {
      const compReply = formatDocumentComparisonAcrossBanks();
      const suggestion = isEligibleFlowActive
        ? "\n\nWhenever you're ready, we can return to your loan eligibility check."
        : "";
      return { reply: compReply + suggestion };
    }
  }

  // 2. If a stored partner bank is found, answer using its Master Policy RAG pipeline
  if (resolvedTarget) {
    const policyResult = await answerBankPolicyWithMasterPolicy(resolvedTarget.bankName, query, modelOverride);
    if (policyResult) {
      if (eligibilitySession) {
        eligibilitySession.lastPolicyBank = resolvedTarget.bankName;
        eligibilitySession.selectedBank = resolvedTarget.bankName;
        eligibilitySession.chosenBank = resolvedTarget.bankName;
      }
      const suggestion = isEligibleFlowActive
        ? "\n\nWhenever you're ready, we can return to your loan eligibility check."
        : "";
      return { reply: policyResult + suggestion };
    }
  }

  // 3. If requested bank is not in stored partner-bank policies (or user asked for an unavailable bank):
  // Return clear "bank policy not available" response.
  // Do NOT route to general information fallback or start loan eligibility flow.
  const requestedBank = candidateBankName || extractUnsupportedBankName(userMessage);
  let reply = await formatBankPolicyNotAvailableResponse(requestedBank);
  return { reply };
}

/**
 * 3. Tool Executor: search_company_category
 */
async function executeSearchCompanyCategory(
  args: { companyName?: string },
  userMessage: string,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any
): Promise<AgentResult> {
  const rawTarget = args.companyName || userMessage;
  const cleanFromArgs = args.companyName ? (extractCleanCompanyName(args.companyName) || extractCompanyCandidateFromText(args.companyName)) : "";
  const cleanFromRaw = extractCleanCompanyName(rawTarget) || extractCompanyCandidateFromText(rawTarget) || extractTargetCompanyFromMessage(rawTarget);
  let compQuery = cleanFromArgs || cleanFromRaw || (args.companyName && !isInvalidCompanyName(args.companyName) ? args.companyName.trim() : "");

  if (compQuery && !isInvalidCompanyName(compQuery)) {
    let company = await searchCompany(compQuery);
    if (!company?.found) {
      const candidate = extractCompanyCandidateFromText(userMessage) || extractCompanyCandidateFromText(compQuery);
      if (candidate && candidate.toLowerCase() !== compQuery.toLowerCase() && !isInvalidCompanyName(candidate)) {
        const alt = await searchCompany(candidate);
        if (alt?.found) company = alt;
      }
    }

    if (company?.found) {
      const isDirectWhatIsAsk = /^(?:what\s+is\s+(?:the\s+)?(?:company\s+)?|who\s+is\s+(?:the\s+)?(?:company\s+)?)/i.test(userMessage.trim());
      const isTellMeAboutCompany = /^(?:tell\s+me\s+about|info\s+(?:on|about)|details\s+(?:of|on|for)|about|overview\s+of)\b/i.test(userMessage.trim());
      if (!isDirectWhatIsAsk && !isTellMeAboutCompany && company.needsDisambiguation && company.candidateOptions && company.candidateOptions.length > 1) {
        const candidateNames = company.candidateOptions.map((c) => c.name);
        const reply = formatCompanyCandidateList(candidateNames, compQuery);
        return {
          reply,
          companyData: {
            company_flow: "COMPANY_SELECTION",
            needs_disambiguation: true,
            candidates: company.candidateOptions,
            candidateOptions: company.candidateOptions,
            searchQuery: compQuery,
          },
        };
      }
      let reply = formatCompanyResponse(company);
      const currentApplicant = eligibilitySession?.applicant || {};
      const updatedApplicant: ApplicantProfile = {
        ...currentApplicant,
        companyName: company.primaryName,
        employmentType: currentApplicant.employmentType || "Salaried",
      };
      const missing = getRequiredPolicyFields(updatedApplicant);
      const nextField = missing[0] || "monthlyIncome";
      const isLoanAssessmentContext = Boolean(isEligibleFlowActive || eligibilitySession?.in_eligibility_flow || eligibilitySession?.mainUserGoal === "PERSONAL_LOAN");
      const nextStepText = isLoanAssessmentContext
        ? `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`
        : "Would you like to apply for a loan or calculate your eligibility?";
      if (!reply.includes("eligibility assessment") && !reply.includes("apply for a loan")) {
        reply += `\n\n${nextStepText}`;
      }
      return {
        reply,
        companyData: {
          company_name: company.primaryName,
          overview: company.overview,
          basic_info: company.basicInfo,
          financial_info: company.financialInfo,
          bank_records: company.bankRecords,
          needs_disambiguation: company.needsDisambiguation,
          candidates: company.candidateOptions || company.candidates,
          candidateOptions: company.candidateOptions,
        },
      };
    }
    let reply = `No corporate company listing records found for "${compQuery}".`;
    return { reply };
  }

  let reply = "Could you please share your employer or company name? Let me know so I can retrieve its corporate intelligence and partner bank categorizations.";
  return { reply };
}

/**
 * 4. Tool Executor: check_loan_eligibility
 */
async function executeCheckLoanEligibility(
  args: any,
  conversationId: string,
  userMessage: string,
  eligibilitySession: any,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult> {
  const isEligibleFlowActive = !!(
    eligibilitySession &&
    (eligibilitySession.expectedField ||
      (eligibilitySession.missingFields && eligibilitySession.missingFields.length > 0) ||
      (eligibilitySession as any).in_eligibility_flow)
  );

  const extractedFromMsg = extractApplicantFromText(userMessage);

  const syntheticClassification: IntentClassificationResult = {
    intent: "LOAN_ELIGIBILITY",
    confidence: 1.0,
    loanType: args?.loanType || extractedFromMsg.loan_type || "Personal Loan",
    extracted: {
      companyName: args?.companyName || extractedFromMsg.company,
      monthlyIncome: args?.monthlyIncome !== undefined ? args.monthlyIncome : extractedFromMsg.salary,
      loanAmount: args?.loanAmount !== undefined ? args.loanAmount : extractedFromMsg.loan_amount,
      tenureMonths: args?.tenureMonths !== undefined ? args.tenureMonths : extractedFromMsg.tenure_months,
      cibil: args?.cibil !== undefined ? args.cibil : extractedFromMsg.cibil,
      existingEmi: args?.existingEmi !== undefined ? args.existingEmi : extractedFromMsg.existing_emi,
      age: args?.age !== undefined ? args.age : extractedFromMsg.age,
      employmentType: args?.employmentType || extractedFromMsg.employment_type,
    },
  };

  try {
    const wizardResult = await processEligibilityFlow(
      conversationId,
      userMessage,
      modelOverride,
      async (msg: string, model?: string, context?: string, prompt?: string) => {
        const agentRes = await runToolCallingAgent(msg, model, context, prompt);
        return agentRes.reply;
      },
      syntheticClassification,
      conversationHistory
    );
    const result: AgentResult = { reply: wizardResult.reply };
    return result;
  } catch (e) {
    console.error("Eligibility flow processing error:", e);
    return { reply: "We encountered an issue processing your loan eligibility. Please provide your details to continue." };
  }
}

/**
 * 5. Tool Executor: update_applicant_profile
 */
async function executeUpdateApplicantProfile(
  args: any,
  conversationId: string,
  userMessage: string,
  eligibilitySession: any,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult> {
  const applicant: ApplicantProfile = eligibilitySession?.applicant
    ? { ...eligibilitySession.applicant }
    : { loanType: "Personal Loan" };

  const extracted: ExtractedEntities = {
    companyName: args?.companyName,
    monthlyIncome: args?.monthlyIncome,
    loanAmount: args?.loanAmount,
    tenureMonths: args?.tenureMonths,
    cibil: args?.cibil,
    existingEmi: args?.existingEmi,
    age: args?.age,
    employmentType: args?.employmentType,
  };

  const res = await applyProfileUpdateAndRecalculate(
    conversationId,
    userMessage,
    applicant,
    extracted,
    modelOverride
  );

  return {
    reply: res.reply,
    companyData: undefined,
  };
}

/**
 * 6. Tool Executor: answer_general_question
 */
async function executeAnswerGeneralQuestion(
  args: { question?: string; subType?: string; conceptName?: string },
  userMessage: string,
  conversationId: string,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult> {
  const subType = args.subType || "GENERAL_FAQ";
  const question = args.question || userMessage;

  // CANCEL_RESET
  if (subType === "CANCEL_RESET" || /^(cancel|reset|restart|stop|exit)\b/i.test(question.trim())) {
    await clearEligibilityState(conversationId);
    const numConvId = Number(conversationId);
    if (pool && Number.isFinite(numConvId)) {
      try {
        await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numConvId]);
      } catch { }
    }
    return {
      reply: "🔄 **Loan Assessment Reset**\n\nYour session has been reset. You can start fresh anytime by asking for a loan or policy details.",
    };
  }

  // GREETING
  if (subType === "GREETING" || /^(hello|hi|hey|good\s*(?:morning|afternoon|evening)|namaste|greetings)\b/i.test(question.trim())) {
    const greetingReply = await generateGreetingWithLLM(
      question,
      modelOverride,
      isEligibleFlowActive ? eligibilitySession : undefined
    );
    return { reply: greetingReply };
  }

  // CASUAL_CHAT
  if (subType === "CASUAL_CHAT") {
    const casualReply = await handleCasualMessage(
      question,
      modelOverride,
      conversationHistory,
      isEligibleFlowActive ? eligibilitySession : undefined
    );
    return { reply: casualReply };
  }

  // Financial concept / definition / FAQ / Objection
  let llmReply = await answerGeneralQuestionWithLLM(
    question,
    modelOverride,
    conversationHistory,
    eligibilitySession,
    isEligibleFlowActive
  );

  const normQ = question.toLowerCase();
  let suggestion = "";
  if (/cibil|credit\s*score/i.test(normQ)) {
    suggestion = "\n\nFor your eligibility check, you can provide your CIBIL score when you're ready.";
  } else if (/\bemi\b/i.test(normQ)) {
    suggestion = "\n\nIf you want, we can continue with your loan eligibility calculation.";
  } else if (!isEligibleFlowActive) {
    suggestion = "\n\nIf you'd like, we can continue with your loan eligibility check.";
  }

  if (suggestion && !llmReply.includes("loan eligibility") && !llmReply.includes("eligibility check") && !llmReply.includes("eligibility calculation")) {
    llmReply = llmReply.trim() + suggestion;
  }

  return { reply: llmReply };
}

/**
 * 7. Tool Executor: incraax_search
 */
async function searchIncraaxWeb(query: string): Promise<string> {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) return "Please provide a query for web search.";

  if (!isIncraaxSearchConfigured()) {
    return (
      "🌐 **Web Search (Incraax)**: Web search is currently unconfigured (missing `INCRAAX_SEARCH_API_KEY`). " +
      "For partner-bank policies and loan criteria, I can consult the available Master Policy files and database records."
    );
  }

  try {
    const results = await incraaxSearch(normalizedQuery, 5);
    if (results.length === 0) {
      return `No recent web search results found for "${normalizedQuery}".`;
    }

    const sources = results
      .slice(0, 4)
      .map(
        (result, index) =>
          `**${index + 1}. [${result.title || "Web Result"}](${result.url || "#"})**\n${result.snippet.slice(0, 200)}${result.snippet.length > 200 ? "..." : ""}`
      )
      .join("\n\n");

    return `### 🌐 Web Search (Incraax)\n\n#### Relevant Sources:\n${sources}`;
  } catch (error: any) {
    console.error("[Incraax] Search error:", error?.message || error);
    return "An error occurred while performing the Incraax web search. Using local Master Policy files instead.";
  }
}

async function executeIncraaxSearch(
  args: { query?: string },
  userMessage: string,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any
): Promise<AgentResult> {
  const query = args.query || userMessage;
  const reply = await searchIncraaxWeb(query);
  return { reply };
}

function extractPincodeFromManager(mgr: BankManagerRecord, userPincode?: string): string {
  const extra = mgr.extra_info as Record<string, any> | null;
  if (extra?.pincode && isValidIndianPincode(extra.pincode)) return String(extra.pincode);
  if (extra?.pin && isValidIndianPincode(extra.pin)) return String(extra.pin);
  if (extra?.pin_code && isValidIndianPincode(extra.pin_code)) return String(extra.pin_code);
  const locMatch = String(mgr.location || "").match(/\b([1-9]\d{5})\b/);
  if (locMatch && isValidIndianPincode(locMatch[1])) return locMatch[1];
  const branchMatch = String(mgr.branch || "").match(/\b([1-9]\d{5})\b/);
  if (branchMatch && isValidIndianPincode(branchMatch[1])) return branchMatch[1];
  if (userPincode && isValidIndianPincode(userPincode)) {
    return userPincode;
  }
  return "";
}

export function formatApplicationInitiatedMessage(bank: string, branch?: string, city?: string, state = "Maharashtra"): string {
  const normBranch = (branch || "").trim();
  const normCity = (city || "").trim();

  if (normBranch && normCity && normBranch.toLowerCase() !== normCity.toLowerCase()) {
    return `Application details recorded for ${bank} at ${normBranch}, ${normCity}, ${state}. You can view the verified branch manager contact details below.`;
  }
  if (normCity) {
    return `Application details recorded for ${bank} in ${normCity}, ${state}. You can view the verified branch manager contact details below.`;
  }
  if (normBranch) {
    return `Application details recorded for ${bank} at ${normBranch}, ${state}. You can view the verified branch manager contact details below.`;
  }
  return `Application details recorded for ${bank} in ${state}. You can view the verified branch manager contact details below.`;
}

export function formatDynamicBankManagersTable(
  managers: BankManagerRecord[],
  userPincode?: string,
  userCity?: string,
  userBranch?: string
): string {
  return formatBankManagersTable(managers, { userPincode, userCity, userBranch });
}

function getBankWideBranches(managers: BankManagerRecord[]): string[] {
  return getUniqueBranches(
    managers
      .map((manager) => String(manager.branch || manager.location || "").trim())
      .filter(Boolean)
  );
}

/**
 * 8. Tool Executor: search_bank_managers
 */
async function executeSearchBankManagers(
  args: { bank_name?: string; city?: string; pincode?: string; role?: string; branch?: string; area?: string },
  userMessage: string,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any,
  conversationId?: string
): Promise<AgentResult> {
  const previousEntities: BankManagerSearchEntities = {
    bank_name: eligibilitySession?.lastBankManagerSearch?.bank_name || eligibilitySession?.chosenBank || eligibilitySession?.selectedBank || undefined,
    city: eligibilitySession?.lastBankManagerSearch?.city || eligibilitySession?.city || eligibilitySession?.location || undefined,
    branch: eligibilitySession?.lastBankManagerSearch?.branch || eligibilitySession?.preferredBranch || eligibilitySession?.branch || undefined,
    branchName: eligibilitySession?.lastBankManagerSearch?.branchName || eligibilitySession?.preferredBranch || eligibilitySession?.branch || undefined,
    area: eligibilitySession?.lastBankManagerSearch?.area || eligibilitySession?.area || undefined,
    pincode: eligibilitySession?.lastBankManagerSearch?.pincode || eligibilitySession?.pincode || undefined,
    location: eligibilitySession?.lastBankManagerSearch?.location || eligibilitySession?.location || undefined,
    role: eligibilitySession?.lastBankManagerSearch?.role || undefined,
  };

  const extractedParams = extractBankBranchLocationParams(
    userMessage,
    args.bank_name || previousEntities.bank_name,
    undefined,
    eligibilitySession?.expectedField,
    previousEntities.city
  );

  if (args.bank_name && !extractedParams.bankName) extractedParams.bankName = args.bank_name;
  if (args.city && !extractedParams.city) extractedParams.city = args.city;
  if (args.pincode && !extractedParams.pincode) extractedParams.pincode = args.pincode;
  if (args.area && !extractedParams.area) extractedParams.area = args.area;
  if (args.branch && !extractedParams.branch) extractedParams.branch = args.branch;
  if (args.role && !extractedParams.role) extractedParams.role = args.role;

  const finalEntities = reconcileBankManagerEntities(
    previousEntities,
    extractedParams,
    {
      expectedField: eligibilitySession?.expectedField,
      isPriorSearchCompleted: Boolean(eligibilitySession?.lastBankManagerSearch || eligibilitySession?.postEligibilityStage === "BANK_MANAGER_RESULTS"),
    }
  );

  const bankName = finalEntities.bank_name || "";
  const pincode =
    (finalEntities.pincode && isValidIndianPincode(finalEntities.pincode) ? finalEntities.pincode : undefined) ||
    (args.pincode && isValidIndianPincode(args.pincode) ? args.pincode : undefined) ||
    (isValidIndianPincode(userMessage.trim()) ? userMessage.trim() : undefined);
  const city = finalEntities.city || (pincode ? resolvePincodeToCity(pincode) : "") || "";
  let branch = finalEntities.branch || args.branch || "";
  const area = finalEntities.area || args.area || "";

  // 1. Bank is known, but city, pincode, and area are all missing -> prompt for location/city/pincode
  if (bankName && !city && !pincode && !area) {
    if (conversationId) {
      await saveEligibilityState(conversationId, {
        ...(eligibilitySession || {}),
        selectedBank: bankName,
        chosenBank: bankName,
        expectedEntity: "city",
        expectedField: "city",
        currentStep: "CITY_COLLECTION",
        locationStep: "CITY_COLLECTION",
        postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
        lastBankManagerSearch: finalEntities,
        updatedAt: Date.now(),
      } as any);
    }
    return {
      reply: `You selected **${bankName}**. Please provide your branch location, city, or pincode so we can connect you with the official branch manager.`,
    };
  }

  const isDiscoveryMsg = Boolean(
    /(?:tell|show|list|give|view|check|find)\s+(?:all\s+)?(?:available\s+)?(?:branches|locations)\b/i.test(userMessage) ||
    /(?:what|which)\s+(?:are\s+)?(?:the\s+)?(?:available\s+)?(?:branches|locations)\b/i.test(userMessage) ||
    /(?:what|which)\s+(?:branches|locations)\s+are\s+available\b/i.test(userMessage) ||
    /(?:branches|locations)\s+are\s+available\b/i.test(userMessage) ||
    /(?:available\s+branches|available\s+locations)\b/i.test(userMessage) ||
    /^(?:branches|locations)\s+(?:in|for|of)\b/i.test(userMessage)
  );

  // 1b. Pincode is provided -> direct pincode search (with city fallback)
  if (bankName && pincode) {
    const rawPincodeMgrs = await searchBankManager({
      bank_name: bankName,
      city: city || undefined,
      pincode,
    });
    let exactPincodeMgrs = (rawPincodeMgrs || []).filter((m) => isSameBank(m.bank_name, bankName));
    const cityFromPin = resolvePincodeToCity(pincode);
    if (exactPincodeMgrs.length === 0 && (city || cityFromPin)) {
      const effCity = city || cityFromPin;
      const cityMgrs = await searchBankManager({ bank_name: bankName, city: effCity || undefined });
      if (cityMgrs && cityMgrs.length > 0) {
        exactPincodeMgrs = cityMgrs.filter((m) => isSameBank(m.bank_name, bankName));
      }
    }
    const uniqueMgrs = getUniqueManagerRecords(exactPincodeMgrs);
    if (uniqueMgrs.length > 0) {
      const effCity = city || cityFromPin || "Pune";
      const tableMarkdown = formatBankManagersTable(uniqueMgrs, { userPincode: pincode, userCity: effCity });
      const appMessage = formatApplicationInitiatedMessage(bankName, undefined, effCity);
      if (conversationId) {
        await saveEligibilityState(conversationId, {
          ...(eligibilitySession || {}),
          selectedBank: bankName,
          chosenBank: bankName,
          city: effCity,
          location: effCity,
          pincode,
          currentStep: "BANK_MANAGER_RESULTS",
          locationStep: "MANAGER_RESULTS",
          postEligibilityStage: "BANK_MANAGER_RESULTS",
          expectedEntity: "completed",
          expectedField: "completed",
          managerFound: true,
          lastBankManagerSearch: finalEntities,
          updatedAt: Date.now(),
        } as any);
      }
      return {
        reply: `### 👔 Official Bank Manager Directory: **${bankName}** (${[effCity, pincode].filter(Boolean).join(" ")})\n\n${tableMarkdown}\n\n---\n✅ **${appMessage}**`,
        bankData: uniqueMgrs,
      };
    }
  }

  // 1c. Area is provided -> search by branch/area
  if (bankName && area) {
    const rawAreaMgrs = await searchBankManager({
      bank_name: bankName,
      city: city || undefined,
      branch_name: area,
    });
    const areaMgrs = (rawAreaMgrs || []).filter((m) => isSameBank(m.bank_name, bankName) && recordMatchesBranch(m, area));
    const uniqueMgrs = getUniqueManagerRecords(areaMgrs);
    if (uniqueMgrs.length > 0) {
      const tableMarkdown = formatBankManagersTable(uniqueMgrs, { userPincode: pincode, userCity: city, userBranch: area });
      const appMessage = formatApplicationInitiatedMessage(bankName, area, city);
      if (conversationId) {
        await saveEligibilityState(conversationId, {
          ...(eligibilitySession || {}),
          selectedBank: bankName,
          chosenBank: bankName,
          city,
          preferredBranch: area,
          branch: area,
          branchName: area,
          area,
          currentStep: "BANK_MANAGER_RESULTS",
          locationStep: "MANAGER_RESULTS",
          postEligibilityStage: "BANK_MANAGER_RESULTS",
          expectedEntity: "completed",
          expectedField: "completed",
          managerFound: true,
          lastBankManagerSearch: finalEntities,
          updatedAt: Date.now(),
        } as any);
      }
      return {
        reply: `### 👔 Official Bank Manager Directory: **${bankName}** (${[area, city || pincode].filter(Boolean).join(", ")})\n\n${tableMarkdown}\n\n---\n✅ **${appMessage}**`,
        bankData: uniqueMgrs,
      };
    }
  }

  // 2. Handle branchSelection step when availableBranches exist
  const availableBranches: string[] = eligibilitySession?.availableBranches || [];
  if (eligibilitySession?.expectedField === "branchSelection" && availableBranches.length > 0 && !isDiscoveryMsg) {
    const numChoice = parseInt(userMessage.trim(), 10);
    if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= availableBranches.length) {
      branch = availableBranches[numChoice - 1];
    } else {
      const normInput = userMessage.toLowerCase().replace(/[^\w]/g, " ").trim();
      const branchCandidate = availableBranches.find((b) => {
        const bNorm = b.toLowerCase().replace(/[^\w]/g, " ").trim();
        return bNorm === normInput || bNorm.includes(normInput) || normInput.includes(bNorm);
      });
      if (branchCandidate) {
        branch = branchCandidate;
      } else {
        branch = userMessage.trim();
      }
    }
  }

  // 3. Bank and City are known, but Branch is not yet provided -> search DB for branches
  if (bankName && city && !branch) {
    const dbBranches = await findBankBranches(bankName, city);
    const uniqueBranches = getUniqueBranches(dbBranches);

    if (uniqueBranches.length === 0) {
      // Check if managers exist for this bank and city directly
      const mgrRows = await searchBankManager({ bank_name: bankName, city });
      if (mgrRows && mgrRows.length > 0) {
        const uniqueManagers = getUniqueManagerRecords(mgrRows);
        const tableMarkdown = formatBankManagersTable(uniqueManagers, { userCity: city });
        const appMessage = formatApplicationInitiatedMessage(bankName, city, city);
        if (conversationId) {
          await saveEligibilityState(conversationId, {
            ...(eligibilitySession || {}),
            selectedBank: bankName,
            chosenBank: bankName,
            city,
            currentStep: "BANK_MANAGER_RESULTS",
            locationStep: "MANAGER_RESULTS",
            postEligibilityStage: "BANK_MANAGER_RESULTS",
            expectedEntity: "completed",
            expectedField: "completed",
            managerFound: true,
            lastBankManagerSearch: finalEntities,
            updatedAt: Date.now(),
          } as any);
        }
        return {
          reply: `### 👔 Official Bank Manager Directory: **${bankName}** (${city})\n\n${tableMarkdown}\n\n---\n✅ **${appMessage}**`,
          bankData: uniqueManagers,
        };
      }

      // A request for all branches must not remain constrained to a city that
      // has no records. Search the selected bank's complete manager directory.
      if (isDiscoveryMsg) {
        const bankWideManagers = (await searchBankManager({ bank_name: bankName }))
          .filter((manager) => isSameBank(manager.bank_name, bankName));
        const bankWideBranches = getBankWideBranches(bankWideManagers);

        if (bankWideBranches.length > 0) {
          const formattedList = bankWideBranches.map((b, idx) => `${idx + 1}. **${b}**`).join("\n");
          if (conversationId) {
            await saveEligibilityState(conversationId, {
              ...(eligibilitySession || {}),
              selectedBank: bankName,
              chosenBank: bankName,
              city: undefined,
              location: undefined,
              pincode: undefined,
              branchSearchScope: "bank",
              availableBranches: bankWideBranches,
              currentStep: "BRANCH_SELECTION",
              locationStep: "LOCATION_SELECTION",
              expectedEntity: "branchSelection",
              expectedField: "branchSelection",
              postEligibilityStage: "BRANCH_SELECTION",
              lastBankManagerSearch: { ...finalEntities, city: undefined, pincode: undefined },
              updatedAt: Date.now(),
            } as any);
          }
          return {
            reply: `Available **${bankName}** branches in our directory:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`,
          };
        }
      }
      return {
        reply: `I couldn't find any ${bankName} branch records for ${city} in the database. Ask for all available branches to view the bank-wide directory.`,
      };
    }

    const formattedList = uniqueBranches.map((b, idx) => `${idx + 1}. **${b}**`).join("\n");
    if (conversationId) {
      await saveEligibilityState(conversationId, {
        ...(eligibilitySession || {}),
        selectedBank: bankName,
        chosenBank: bankName,
        city,
        location: city,
        availableBranches: uniqueBranches,
        currentStep: "BRANCH_SELECTION",
        locationStep: "LOCATION_SELECTION",
        expectedEntity: "branchSelection",
        postEligibilityStage: "BRANCH_SELECTION",
        expectedField: "branchSelection",
        lastBankManagerSearch: finalEntities,
        updatedAt: Date.now(),
      } as any);
    }

    return {
      reply: `Available ${bankName} branches in ${city}:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`,
    };
  }

  // 4. Bank, City, and Branch are all known -> Search for managers
  if (bankName && branch) {
    const mgrRows = await searchBankManager({
      bank_name: bankName,
      city: city || undefined,
      branch_name: branch,
    });

    let matchedMgrs = (mgrRows || []).filter((m) => {
      return isSameBank(m.bank_name, bankName) && recordMatchesBranch(m, branch);
    });

    if (matchedMgrs.length === 0 && mgrRows && mgrRows.length > 0) {
      matchedMgrs = mgrRows.filter((m) => isSameBank(m.bank_name, bankName));
    }

    const uniqueManagers = getUniqueManagerRecords(matchedMgrs);

    if (uniqueManagers.length === 0) {
      return {
        reply: `I couldn't find an ${bankName} manager record for the ${branch} branch${city ? ` in ${city}` : ""}.`,
      };
    }

    const tableMarkdown = formatBankManagersTable(uniqueManagers, { userCity: city, userBranch: branch });
    const appMessage = formatApplicationInitiatedMessage(bankName, branch, city);

    if (conversationId) {
      await saveEligibilityState(conversationId, {
        ...(eligibilitySession || {}),
        selectedBank: bankName,
        chosenBank: bankName,
        city,
        preferredBranch: branch,
        branch,
        currentStep: "BANK_MANAGER_RESULTS",
        locationStep: "MANAGER_RESULTS",
        postEligibilityStage: "BANK_MANAGER_RESULTS",
        expectedEntity: "completed",
        expectedField: "completed",
        managerFound: true,
        lastBankManagerSearch: finalEntities,
        updatedAt: Date.now(),
      } as any);
    }

    return {
      reply: `### 👔 Official Bank Manager Directory: **${bankName}** (${branch}, ${city})\n\n${tableMarkdown}\n\n---\n✅ **${appMessage}**`,
      bankData: uniqueManagers,
    };
  }

  // Fallback for general manager search queries without specific bank/city structure
  const filters: { bank_name?: string; city?: string; pincode?: string; branch_name?: string; area?: string; role?: string; query?: string } = {};
  if (finalEntities.bank_name) filters.bank_name = finalEntities.bank_name;
  if (finalEntities.city) filters.city = finalEntities.city;
  if (finalEntities.branch) filters.branch_name = finalEntities.branch;
  if (finalEntities.area) filters.area = finalEntities.area;
  if (finalEntities.pincode) filters.pincode = finalEntities.pincode;
  if (finalEntities.role) filters.role = finalEntities.role;

  const finalQuery = [finalEntities.bank_name, finalEntities.branch, finalEntities.area, finalEntities.city || finalEntities.pincode].filter(Boolean).join(" ");
  filters.query = finalQuery || undefined;

  const bankData = await searchBankManager(filters);
  const uniqueManagers = getUniqueManagerRecords(bankData || []);

  if (uniqueManagers.length > 0) {
    const reply = formatBankManagersTable(uniqueManagers, {
      userPincode: finalEntities.pincode,
      userCity: finalEntities.city,
      userBranch: finalEntities.branch,
    });
    const locHeader = [finalEntities.branch, finalEntities.city || finalEntities.pincode].filter(Boolean).join(", ");
    return {
      reply: `### 👔 Official Bank Manager Directory: **${finalEntities.bank_name || "Partner Bank"}**${locHeader ? ` (${locHeader})` : ""}\n\n${reply}`,
      bankData: uniqueManagers,
    };
  }

  const queryLoc = [finalEntities.branch, finalEntities.city || finalEntities.pincode].filter(Boolean).join(" in ");
  const reply = `No official bank manager records found matching **${finalEntities.bank_name || ""}**${queryLoc ? ` (${queryLoc})` : ""}. Please check the bank name, city, or branch.`;
  return {
    reply,
    bankData: [],
  };
}


/**
 * Fully LLM-Driven Conversational Understanding Brain for CreditWise AI.
 */
export interface MasterConversationAnalysis {
  isTechnicalError?: boolean;
  userIntent:
  | "LOAN_ELIGIBILITY"
  | "BANK_POLICY"
  | "EMI_CALCULATION"
  | "BANK_MANAGER"
  | "COMPANY_SEARCH"
  | "WEB_SEARCH"
  | "QUESTION_OR_OBJECTION"
  | "CORRECTION"
  | "GREETING"
  | "CANCEL_RESET"
  | "SELECT_BANK"
  | "REJECT_BANK"
  | "PROCEED_NEXT_STEP"
  | "GENERAL_CHAT";
  isLoanIntent: boolean;
  hasQuestionOrObjection: boolean;
  questionAnswer: string | null;
  extractedDetails: {
    companyName?: string | null;
    monthlyIncome?: number | string | null;
    loanAmount?: number | string | null;
    tenureMonths?: number | string | null;
    cibil?: number | string | null;
    existingEmi?: number | string | null;
    age?: number | string | null;
    location?: string | null;
    employmentStatus?: "unemployed" | "salaried" | "self-employed" | "student" | string | null;
    employmentType?: "Salaried" | "Self-Employed" | "Unemployed" | "Student" | null;
  };
  isCorrection: boolean;
  correctedFields: string[];
  targetBank: string | null;
  selectedBank?: string | null;
  rejectedBank?: string | null;
  city?: string | null;
  wantsReevaluation?: boolean;
  emiDetails?: {
    principal?: number | null;
    rate?: number | null;
    tenureMonths?: number | null;
  } | null;
  managerSearch?: {
    bankName?: string | null;
    city?: string | null;
  } | null;
  companyQuery?: string | null;
  webSearchQuery?: string | null;
  naturalResponse: string;
}

function getFriendlyFieldName(field: string): string {
  switch (field) {
    case "companyName":
      return "employer or company name";
    case "monthlyIncome":
      return "net monthly take-home salary";
    case "loanAmount":
      return "desired loan amount";
    case "tenureMonths":
      return "preferred repayment tenure";
    case "cibil":
      return "approximate CIBIL score";
    case "existingEmi":
      return "existing monthly EMIs";
    case "age":
      return "current age";
    default:
      return field;
  }
}

/**
 * Executes a comprehensive multi-turn conversational analysis using OpenRouter LLM.
 * Returns structured intent, extracted/corrected entities, answer to questions,
 * and a natural conversational response.
 */
export async function analyzeConversationWithLLM(opts: {
  userMessage: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  applicant?: ApplicantProfile;
  missingFields?: string[];
  isFlowActive?: boolean;
  hasCompletedEvaluation?: boolean;
  eligibleBanks?: string[];
  topRecommendedBank?: string;
  chosenBank?: string;
  city?: string;
  rejectedBanks?: string[];
  failedCriteria?: Array<{ bankName: string; failureReasons: string[] }>;
  modelOverride?: string;
  currentTime?: string;
}): Promise<MasterConversationAnalysis> {
  const {
    userMessage,
    conversationHistory,
    applicant,
    missingFields,
    isFlowActive,
    hasCompletedEvaluation,
    eligibleBanks,
    topRecommendedBank,
    chosenBank,
    city,
    rejectedBanks,
    failedCriteria,
    modelOverride,
    currentTime,
  } = opts;
  const apiKey = getApiKey();
  const rawModel = modelOverride || getModel();
  const model = normalizeModelSlug(rawModel);

  const currTime = currentTime || new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const systemPrompt =
    `You are CreditWise AI, a helpful, expert financial assistant specializing in personal loan eligibility, EMI calculations, bank loan policies, and branch manager contacts.\n\n` +
    `### DYNAMIC CONTEXT:\n` +
    `- Current Local Time: ${currTime}\n\n` +
    `### BEHAVIOR RULES:\n` +
    `- TIME AWARENESS: Always use the provided Current Local Time. If the user gives a greeting that contradicts the current time (e.g., saying "Good morning" at 10:45 PM), politely acknowledge the current time in a warm, conversational tone (e.g., "Good evening! It's late night, but I'm here to help you with your loan queries!").\n` +
    `- NATURAL & ADAPTIVE: Do not act like a rigid step-by-step form or force single-question loops. Converse naturally like ChatGPT while gathering missing information efficiently.\n` +
    `- ACCURACY: Follow the provided Bank Data, Loan Policy, and Manager Contact records strictly for calculations and recommendations.\n\n` +
    `CRITICAL REQUIREMENT: You are an API backend that MUST ALWAYS respond ONLY with a strictly valid JSON object matching the schema. NEVER return conversational text, greetings, or markdown outside the JSON object.\n` +
    `LANGUAGE REQUIREMENT: All text in 'naturalResponse' and 'questionAnswer' MUST ALWAYS be written in English. Do NOT output Chinese or any other language.\n\n` +
    `You are the master conversational understanding brain for CreditWise AI, a personal loan and banking intelligence platform.\n` +
    `Analyze the user's message in the context of recent conversation history and the current applicant profile.\n\n` +
    `CURRENT CONTEXT:\n` +
    `- RECENT CONVERSATION HISTORY (Prior Dialogue Turns in Chronological Order):\n${conversationHistory && conversationHistory.length > 0
      ? conversationHistory
        .filter((t) => t.content && t.content.trim())
        .map((t, idx) => `  [Turn ${idx + 1}] ${t.role === "assistant" || t.role === "ai" ? "Assistant" : "User"}: ${t.content.trim()}`)
        .join("\n")
      : "  No prior turns in this conversation."
    }\n` +
    `- CURRENT USER MESSAGE TO ANALYZE: "${userMessage}"\n` +
    `- Accumulated Applicant Profile: ${JSON.stringify(applicant || {})}\n` +
    `- Missing Fields for Initial Eligibility: ${JSON.stringify(missingFields || ["companyName", "monthlyIncome", "loanAmount", "tenureMonths", "cibil", "existingEmi", "age"])}\n` +
    `- Eligibility Flow In Progress: ${isFlowActive ? "true" : "false"}\n` +
    `- Eligibility Assessment Status: ${hasCompletedEvaluation ? "ALREADY_COMPLETED" : "IN_PROGRESS"}\n` +
    `- Eligible Banks from Assessment: ${JSON.stringify(eligibleBanks || [])}\n` +
    `- Top Recommended Bank: ${topRecommendedBank || "None"}\n` +
    `- Currently Chosen Bank: ${chosenBank || "None yet chosen by user"}\n` +
    `- Current Known City / Location: ${city || applicant?.location || "None provided yet"}\n` +
    `- Banks Rejected by User: ${JSON.stringify(rejectedBanks || [])}\n` +
    `- Actual Bank Eligibility Evaluations & Failed Criteria from Policy Engine:\n${failedCriteria && failedCriteria.length > 0
      ? failedCriteria
        .map(
          (b) =>
            `  * ${b.bankName}: ${b.failureReasons && b.failureReasons.length > 0
              ? b.failureReasons.join("; ")
              : "Eligible (all policy criteria met)"
            }`
        )
        .join("\n")
      : "  No failed bank evaluations recorded yet"
    }\n\n` +
    `CRITICAL ANALYSIS GUIDELINES:\n` +
    `0. TONE AND LANGUAGE STYLE (MANDATORY - NATURAL EVERYDAY LANGUAGE):\n` +
    `   - Speak warmly, simply, and conversationally like a helpful, friendly personal loan advisor.\n` +
    `   - Avoid stiff, bureaucratic, dry, or overly technical banking jargon. Explain all financial concepts in plain, everyday terms that anyone can understand effortlessly.\n` +
    `   - Do NOT sound robotic or formal. Be encouraging, clear, and human.\n` +
    `1. NATURAL INTENT UNDERSTANDING & CONVERSATION CONTEXT (CRITICAL):\n` +
    `   - ALWAYS use the CURRENT USER MESSAGE together with RECENT CONVERSATION HISTORY to understand intent.\n` +
    `   - INQUIRIES ABOUT CONVERSATION HISTORY & META-QUESTIONS (CRITICAL):\n` +
    `     * If the user's message asks what they asked, what they said, what their question was, or references past turns (e.g. "what am I asking?", "what did I ask?", "what was my question?", "what did I say earlier?", "what was I asking you?", "remind me what I asked", "what are you answering?"): \n` +
    `       - You MUST set isLoanIntent to false.\n` +
    `       - Set userIntent to "QUESTION_OR_OBJECTION".\n` +
    `       - Set hasQuestionOrObjection to true.\n` +
    `       - Inspect RECENT CONVERSATION HISTORY to identify the user's previous question, inquiry, or topic.\n` +
    `       - In questionAnswer and naturalResponse:\n` +
    `         1) Clearly state what the user asked previously (e.g. "Earlier, you asked: '<previous question>'").\n` +
    `         2) Directly, accurately, and thoroughly answer that previous question based on official bank policies and financial rules.\n` +
    `         3) If there are no prior turns in history, warmly state that this is the beginning of the conversation and no prior questions were asked yet.\n` +
    `       - DO NOT continue the loan eligibility question flow (do NOT ask for company name, salary, loan amount, tenure, etc.)!\n` +
    `       - DO NOT ask for a bank!\n` +
    `       - DO NOT restart eligibility!\n` +
    `       - DO NOT generate a table!\n` +
    `     * If the user asks what YOU (the assistant) asked (e.g. "what did you ask?", "what are you asking me?"): check what the assistant asked in the previous turn in history, explain what was asked, set isLoanIntent to false, userIntent to "QUESTION_OR_OBJECTION", and hasQuestionOrObjection to true.\n` +
    `   - ACTUAL LOAN INTENT vs BANK POLICY INQUIRIES (CRITICAL):\n` +
    `     * BANK POLICY / ELIGIBILITY CRITERIA INQUIRY (CRITICAL):\n` +
    `       - If the user asks for a bank's official policy, rules, guidelines, cutoffs, or eligibility criteria (e.g. "Tell me the eligibility criteria for HDFC Bank", "What is the eligibility criteria for ICICI?", "HDFC Bank eligibility criteria", "What are Axis Bank loan rules?", "SBI criteria for personal loans", "Bajaj Finserv policy"): \n` +
    `         - You MUST set userIntent to "BANK_POLICY".\n` +
    `         - You MUST set isLoanIntent to false.\n` +
    `         - You MUST set targetBank to the bank name (e.g. "HDFC Bank").\n` +
    `         - Set hasQuestionOrObjection to false.\n` +
    `         - DO NOT start a personal eligibility flow!\n` +
    `         - DO NOT ask for salary, CIBIL, age, loan amount, employer, or any personal details!\n` +
    `     * PERSONAL LOAN INTENT:\n` +
    `       - Set isLoanIntent to true and userIntent to "LOAN_ELIGIBILITY" ONLY when the user asks to check their OWN personal eligibility or expresses intent to borrow (e.g. "Am I eligible for HDFC loan?", "Check my eligibility for HDFC", "Can I get a loan from HDFC?", "I need a loan", "I want a personal loan", "I want to apply for a loan", "Can I get a loan?", "I need ₹5 lakh loan", "Which banks am I eligible for?", "Check my loan options").\n` +
    `   - UNEMPLOYED / JOBLESS INQUIRIES (CRITICAL - DO NOT TRIGGER ELIGIBILITY FLOW):\n` +
    `     * If the user asks whether they can get a loan while jobless, unemployed, or without income (e.g. "can i get loan if i am jobless", "can i get a loan without a job", "can unemployed people get personal loans?", "i don't have a job, can i borrow?"): \n` +
    `       - You MUST set isLoanIntent to false.\n` +
    `       - Set userIntent to "QUESTION_OR_OBJECTION" (or "GENERAL_CHAT").\n` +
    `       - Set hasQuestionOrObjection to true.\n` +
    `       - Set extractedDetails.employmentStatus to "unemployed", employmentType to "Unemployed", and monthlyIncome to 0.\n` +
    `       - In questionAnswer and naturalResponse, provide a natural, empathetic explanation of bank policy: Unsecured personal loans under partner bank policies require active employment (Salaried or Self-Employed with steady income) to verify repayment capability. Therefore, unsecured personal loans cannot be approved while jobless. Mention legitimate secured alternatives (such as a loan against fixed deposits, gold loan, or applying with an earning co-applicant) if they have collateral.\n` +
    `       - NEVER trigger loan eligibility or generate a bank table when the user is jobless or when required data is missing!\n` +
    `   - GENERIC & CONCEPTUAL QUESTIONS (MUST NOT TRIGGER ELIGIBILITY):\n` +
    `     * If the user asks a generic, educational, conceptual, or informational question about loans, interest, documents, or banking (e.g. "What is a personal loan?", "How does a personal loan work?", "What documents are required for a personal loan?", "What is reducing balance rate?", "What is FOIR?", "What is a CIBIL score?", "Difference between secured and unsecured loan", "What is loan tenure?"): \n` +
    `       - You MUST set isLoanIntent to false.\n` +
    `       - Set userIntent to "QUESTION_OR_OBJECTION" (or "GENERAL_CHAT").\n` +
    `       - Set hasQuestionOrObjection to true.\n` +
    `       - In questionAnswer and naturalResponse, provide a short, clear, natural, and helpful banking answer.\n` +
    `       - NEVER trigger loan eligibility or ask for applicant details (like company name or salary) for generic educational questions!\n` +
    `   - DIFFERENT LOAN TYPES, GENERAL PROCESSES & NEW TOPICS (STRICT CONVERSATION RULE):\n` +
    `     * NEVER force the user to provide an employer/company name when their current message is asking about a different loan type, a general process, or a new topic! Always understand and classify the CURRENT user message before continuing any pending eligibility flow.\n` +
    `     * If the user asks for an educational/education loan, home loan, business loan, vehicle loan, credit card, loan application process, loan documents, loan offers, interest rates, CIBIL requirements, or any other general loan-related question:\n` +
    `       - You MUST set isLoanIntent to false.\n` +
    `       - Set userIntent to "QUESTION_OR_OBJECTION" (or "GENERAL_CHAT").\n` +
    `       - Set hasQuestionOrObjection to true.\n` +
    `       - In questionAnswer and naturalResponse, answer that CURRENT question directly and step-by-step (e.g. for "I want educational loan, I don't know the process, tell me the process" -> Explain the education-loan application process step-by-step).\n` +
    `       - Do NOT ask for the user's employer/company!\n` +
    `       - Do NOT execute a missing-slot request!\n` +
    `     * Pending flow handling:\n` +
    `       - A previous unanswered question must NOT override the user's latest intent.\n` +
    `       - First classify the latest message.\n` +
    `       - If it is a new topic, temporarily pause the previous flow and answer the new topic.\n` +
    `       - Preserve the previous conversation state so the user can return to it later.\n` +
    `       - Resume the previous flow only when the user's new message clearly provides information requested by that flow or explicitly asks to continue it.\n` +
    `     * Priority:\n` +
    `       1. Understand current user intent.\n` +
    `       2. Handle direct questions/new topics.\n` +
    `       3. Handle topic switches.\n` +
    `       4. Handle temporary interruptions.\n` +
    `       5. Only then continue pending slot collection.\n` +
    `       6. Ask for a missing employer/company field ONLY when the current message is actually part of the personal-loan eligibility flow.\n` +
    `     * Never blindly execute a missing-slot request just because the previous conversation state contains an incomplete personal-loan application.\n` +
    `   - BANK POLICY RETRIEVAL RULE (STRICT RAG SEARCH ONLY):\n` +
    `     * When user asks about bank policy, rely solely on RAG search; otherwise no! For non-policy questions (different loan types, processes, conceptual queries, or slot collection), do NOT invoke or cite bank policy RAG search.\n` +
    `   - CONVERSATIONAL FLOW & CONTEXT AWARENESS:\n` +
    `     * Do NOT blindly follow any wizard step! If the assistant previously asked for a specific detail, understand whether the user is answering, asking a question, raising an objection, correcting a previous value, or chatting.\n` +
    `2. EXTRACT APPLICANT DETAILS (CRITICAL - MULTI-DETAIL EXTRACTION):\n` +
    `   - Inspect the entire message and extract EVERY provided eligibility parameter simultaneously into extractedDetails.\n` +
    `   - If the user provides multiple details in one message (e.g. company, salary, loan amount, tenure, CIBIL score, age, existing EMI, or any combination), you MUST extract ALL of them in this single turn. Never restrict extraction to only one field or the previously pending field!\n` +
    `   - companyName: corporate employer name (e.g. "TCS", "Google", "work at Infosys", "Tata Consultancy Services"). If user says "unemployed", "jobless", "student", or "freelancer", DO NOT set companyName; set employmentType appropriately.\n` +
    `   - monthlyIncome: net monthly take-home salary in INR as a number (e.g. "80k" -> 80000, "1 lakh" / "100000" -> 100000, "1.2 lakh" -> 120000, "0rs"/"zero"/"nil"/"unemployed" -> 0).\n` +
    `   - loanAmount: requested loan amount in INR as a number (e.g. "5 lakhs" / "500000" -> 500000).\n` +
    `   - tenureMonths: repayment tenure in months as a number (e.g. "3 years" -> 36, "48 months" -> 48).\n` +
    `   - cibil: credit bureau score (300-900). CRITICAL: If the user indicates they do not know their CIBIL score, have never checked it, or it is unknown/not provided, you MUST set cibil to "Not provided" as a string (never null, never 0, never "Standard"). If CIBIL was not mentioned or asked about at all, set cibil to null. Only if the user explicitly specifies a numeric score should cibil be a number.\n` +
    `   - existingEmi: ongoing monthly loan EMIs in INR as a number (e.g. 0 if none/no loans/nil/all clear).\n` +
    `   - employmentStatus: "unemployed" | "salaried" | "self-employed" | "student". Understand employment status naturally from context without requiring specific phrasing. If the user indicates they are not working, unemployed, jobless, or without a job, set employmentStatus to "unemployed", employmentType to "Unemployed", monthlyIncome to 0, and DO NOT set companyName.\n` +
    `   - UNEMPLOYED APPLICANTS (CRITICAL POLICY RULE): Partner bank personal loan policies strictly require active employment (Salaried or Self-Employed with minimum monthly salary). An unemployed applicant cannot qualify for an unsecured personal loan. NEVER blindly continue a fixed question sequence or ask for repayment tenure, CIBIL, or ongoing EMIs when the user is unemployed! In naturalResponse, clearly and empathetically explain the bank policy requirement (active employment and regular monthly income).\n` +
    `3. CORRECTIONS & UPDATES:\n` +
    `   - If the user modifies, corrects, or updates previously provided information (e.g. "Actually my salary is 95,000 not 80k", "Change tenure to 5 years", "My company is TCS not Infosys"), set isCorrection to true, list the changed fields in correctedFields, and put the new values in extractedDetails.\n` +
    `4. QUESTIONS & OBJECTIONS (DO NOT IGNORE QUESTIONS!):\n` +
    `   - If the user asks ANY question or raises ANY objection (e.g. "What is FOIR?", "Why do you need my age/CIBIL/company/salary?", "Will this check hurt my credit score?", "Is my data safe?", "Can I prepay my loan?", "What is reducing balance rate?", "Which bank offers the lowest rate?", "Can a self-employed person get a loan?"): \n` +
    `     Set hasQuestionOrObjection to true.\n` +
    `     Provide a clear, accurate, warm, and natural conversational explanation in questionAnswer using simple everyday words.\n` +
    `     For CIBIL inquiry concerns: explain that this is a soft check with zero impact on credit scores.\n` +
    `     For FOIR questions: explain that it is a simple monthly budget check (total monthly EMIs divided by monthly pay) to make sure loan repayments fit comfortably into everyday living expenses.\n` +
    `     For Age/Company/Salary questions: explain in simple, friendly terms how lenders use these to check working years, company benefits/discounts, and comfortable borrowing limits.\n` +
    `5. BANK POLICIES, EMI, MANAGERS, COMPANY RATINGS & LIVE WEB SEARCH:\n` +
    `   - CRITICAL EXECUTION ORDER: ALWAYS fulfill and output the core requested calculation/information FIRST (e.g. mathematical EMI breakdown table, formula parameters). ONLY ask about partner banks or next steps at the very end of the response as a secondary step.\n` +
    `   - If the user asks for an official bank's policy rules/guidelines/cutoffs or eligibility criteria (e.g. "Tell me the eligibility criteria for HDFC Bank", "What is HDFC bank policy?", "ICICI loan rules", "Axis Bank criteria"): set userIntent to "BANK_POLICY", targetBank to the bank name, and isLoanIntent to false. Do NOT ask for salary, CIBIL, age, or loan amount.\n` +
    `   - If the user asks to calculate monthly EMI (e.g. "EMI for 10 lakhs at 11% for 5 years"): set userIntent to "EMI_CALCULATION", populate emiDetails.\n` +
    `   - If the user asks for bank managers or branch contacts: set userIntent to "BANK_MANAGER", populate managerSearch.\n` +
    `   - If the user asks about an employer or company category rating / tier (e.g. "What is TCS category rating?", "Is Infosys listed in Cat A?"): set userIntent to "COMPANY_SEARCH", set companyQuery to the company name.\n` +
    `   - If the user asks for live web search, current financial news, or latest market updates: set userIntent to "WEB_SEARCH", set webSearchQuery.\n` +
    `   - If the user asks to cancel, reset, or restart: set userIntent to "CANCEL_RESET".\n` +
    `6. NATURAL RESPONSE & ASKING ONLY FOR REMAINING MISSING DETAILS (CRITICAL):\n` +
    `   - Always craft a complete, natural, human-like response in naturalResponse based on the current message + conversation context.\n` +
    `   - If the user greeted you, respond with a warm, natural greeting in your own words without rigid templates or canned menus.\n` +
    `   - DECIDING WHAT IS MISSING: Combine all newly extracted details from this message with Accumulated Applicant Profile. Compare against the required fields: [companyName, monthlyIncome, loanAmount, tenureMonths, cibil, age, existingEmi].\n` +
    `   - NEVER ASK AGAIN FOR INFORMATION ALREADY PROVIDED: If information has already been provided (either previously or in this message), do NOT ask for it again.\n` +
    `   - If details were provided, acknowledge what was provided warmly in your own words, and naturally ask ONLY for the first genuinely remaining missing field.\n` +
    `   - For example: if company, salary, loan amount, tenure, CIBIL, and age are all present, ask ONLY for existing monthly loan EMIs. Do not ask again for company, salary, loan amount, tenure, CIBIL, or age.\n` +
    `   - If all required details are now present, confirm that you have all the required details and are ready to evaluate their eligibility across partner banks.\n` +
    `   - If the user asked a question or raised an objection, answer it directly and warmly, and seamlessly ask for the genuinely remaining missing detail.\n` +
    `   - HIGH LOAN AMOUNTS (₹40L / ₹50L): High-ticket loans of ₹40 Lakhs to ₹50 Lakhs are officially supported by partner banks (including ICICI, IndusInd, Bajaj Finserv, Axis Finance, Poonawalla Fincorp, Tata Capital up to ₹50L, and Axis Bank, HDFC, IDFC, Kotak, Yes Bank up to ₹40L) for high-salary category applicants. Never reject ₹40L or ₹50L globally in your response. The deterministic policy engine evaluates eligibility bank-by-bank against each bank's actual policy limits, income criteria, and FOIR.\n` +
    `   - Never use canned replies, static question variations, phrases from menus, or generic boilerplate. Speak naturally as an intelligent banking advisor.\n` +
    `7. POST-EVALUATION STATE & NEXT ACTION ROUTING (When Eligibility Assessment Status is ALREADY_COMPLETED):\n` +
    `   - The applicant has ALREADY completed their loan eligibility evaluation and received their report and eligible banks table.\n` +
    `   - Interpret subsequent user messages generically from the conversation state to guide the applicant through the next steps WITHOUT repeating the evaluation report table.\n` +
    `   - RULE 1: NEVER AUTO-SELECT A RECOMMENDED BANK.\n` +
    `     * If the user sends progression phrases like "proceed", "continue", "yes", "okay", "sure", "next", "what next", "how to apply", etc., WITHOUT explicitly naming a bank:\n` +
    `       - DO NOT set selectedBank. Keep selectedBank as null.\n` +
    `       - Set userIntent to "PROCEED_NEXT_STEP".\n` +
    `       - In naturalResponse, warmly confirm that you are ready to proceed, mention their eligible partner banks (filtering out any rejected banks), and ask which bank they would like to apply with.\n` +
    `   - RULE 2: NEVER INVENT A CITY OR LOCATION.\n` +
    `     * When a bank is chosen by the user (either in this turn or previously in Currently Chosen Bank), check whether their city / location is known:\n` +
    `       - If the city is NOT known (${!city && !applicant?.location ? "CURRENTLY UNKNOWN" : "KNOWN: " + (city || applicant?.location)}):\n` +
    `         - DO NOT assume or invent "Mumbai" or any default city.\n` +
    `         - In naturalResponse, ask the user which city or branch location they are based in to view official branch manager contacts.\n` +
    `       - If the user mentions their city (e.g. "Pune", "Bangalore", "Delhi", "Chennai"): populate city and extractedDetails.location.\n` +
    `     * If BOTH the bank AND city are known: confirm proceeding to provide verified branch manager contacts.\n` +
    `   - RULE 3: GENERIC BANK REJECTION HANDLING.\n` +
    `     * If the user rejects a bank or expresses a desire not to proceed with a specific bank (e.g. "I don't want Bajaj Markets", "Not Bajaj", "Skip HDFC", "No, reject this", "Any other bank besides Bajaj?", "I don't like ICICI"):\n` +
    `       - Set userIntent to "REJECT_BANK".\n` +
    `       - Set rejectedBank to the rejected bank name.\n` +
    `       - Set selectedBank to null.\n` +
    `       - In naturalResponse, acknowledge the rejection naturally and warmly (e.g. "Understood, we'll exclude Bajaj Markets from your options."), present the other eligible banks from their approved list, and ask which other bank they would prefer to proceed with.\n` +
    `       - NEVER create a lead or show an AI-service error on bank rejection!\n` +
    `   - RULE 4: QUESTIONS & INQUIRIES AFTER EVALUATION.\n` +
    `     * If the user asks ANY question, policy rule, calculation, or objection: answer it directly, accurately, and warmly in naturalResponse without repeating the evaluation report.\n` +
    `   - RULE 5: EXPLICIT RE-EVALUATION ONLY.\n` +
    `     * Set wantsReevaluation to true ONLY if the user EXPLICITLY asks to recalculate, re-run, or re-show the eligibility table.\n` +
    `     * For all standard messages ("proceed", "continue", "yes", "okay", bank selection, rejections, questions), keep wantsReevaluation as false.\n` +
    `8. EXPLAINING INELIGIBILITY & REJECTION REASONS (CRITICAL):\n` +
    `   - When the user asks why they are not eligible, why they were rejected, or why a specific bank rejected them (e.g. "Why am I not eligible?", "Why was I rejected?", "Why did HDFC reject me?", "What criteria did I fail?"): \n` +
    `     * You MUST explain ONLY the actual failed criteria returned by the eligibility engine for the relevant bank(s) as provided in CURRENT CONTEXT.\n` +
    `     * Never invent, assume, or hallucinate reasons (e.g. do not invent negative credit remarks, lack of documents, or unverified defaults).\n` +
    `     * If explaining overall ineligibility, explain only the actual failed criteria across the banks (such as salary below category threshold, CIBIL score not meeting policy cutoff, FOIR exceeded, age outside permissible band, or loan amount outside ticket size).\n` +
    `     * If information was unknown or not provided (e.g. CIBIL score was not provided), preserve it as "Not provided" and explain that the bank's policy requires a minimum threshold that could not be verified without a score.\n` +
    `     * Keep the explanation completely natural, empathetic, and strictly faithful to the engine's actual criteria.\n\n` +
    `9. ZERO/NIL OBLIGATION RESOLUTION & GENERAL FIELD EXTRACTION (CRITICAL):\n` +
    `   - ALWAYS extract all parameters provided anywhere in the message, regardless of which field was previously pending.\n` +
    `   - EXISTING EMI (CRITICAL): If user mentions ongoing loans/EMIs (or answers the existingEmi request) with "0", "zero", "none", "nil", "no", "no loans", "no emi", "nothing", "clean", or specifies 0: you MUST set extractedDetails.existingEmi to 0 as a number (0 !== null). Never leave existingEmi as null when user answers 0 or none.\n` +
    `   - CIBIL SCORE: If user provides a 3-digit number (e.g. 750, 680, 800), set extractedDetails.cibil to that number. If unknown/unprovided, set to "Not provided".\n` +
    `   - AGE: If user provides age (e.g. 28), set extractedDetails.age to that number.\n` +
    `   - SALARY: If user provides salary/income (e.g. 100000, 1 lakh, 80k), set extractedDetails.monthlyIncome to that numeric amount.\n` +
    `   - LOAN AMOUNT: If user provides loan amount (e.g. 500000, 5 lakhs), set extractedDetails.loanAmount to that numeric amount.\n` +
    `   - TENURE: If user provides tenure (e.g. 3 years -> 36, 48 months -> 48), set extractedDetails.tenureMonths to that number in months.\n` +
    `   - EMPLOYER / COMPANY: If user provides employer/company name, set extractedDetails.companyName to that company name.\n` +
    `   - ACTIVE LOAN FLOW vs CONVERSATIONAL QUESTIONS:\n` +
    `     * Set isLoanIntent to true and userIntent to "LOAN_ELIGIBILITY" ONLY when the user is actively initiating a loan request, providing requested eligibility parameters (company, salary, loan amount, tenure, CIBIL, age, EMI), or explicitly asking to continue the loan check.\n` +
    `     * If the user asks ANY question, inquires about previous context (e.g. "what am I asking?"), asks for policy rules, raises an objection, or asks a generic question: you MUST set isLoanIntent to false, set userIntent to "QUESTION_OR_OBJECTION", set hasQuestionOrObjection to true, and provide the answer in questionAnswer and naturalResponse. Never force isLoanIntent to true when the user is asking a question!\n\n` +
    `RECENT CONVERSATION HISTORY (Prior Dialogue Turns in Chronological Order):\n${conversationHistory && conversationHistory.length > 0
      ? conversationHistory
        .filter((t) => t.content && t.content.trim())
        .map((t, idx) => `  [Turn ${idx + 1}] ${t.role === "assistant" || t.role === "ai" ? "Assistant" : "User"}: ${t.content.trim()}`)
        .join("\n")
      : "  No prior turns in this conversation."
    }\n\n` +
    `CURRENT USER MESSAGE: "${userMessage}"\n\n` +
    `Return ONLY a strictly valid JSON object matching this schema:\n` +
    `{\n` +
    `  "userIntent": "LOAN_ELIGIBILITY" | "BANK_POLICY" | "EMI_CALCULATION" | "BANK_MANAGER" | "COMPANY_SEARCH" | "WEB_SEARCH" | "QUESTION_OR_OBJECTION" | "CORRECTION" | "GREETING" | "CANCEL_RESET" | "SELECT_BANK" | "REJECT_BANK" | "PROCEED_NEXT_STEP" | "GENERAL_CHAT",\n` +
    `  "isLoanIntent": boolean,\n` +
    `  "hasQuestionOrObjection": boolean,\n` +
    `  "questionAnswer": string | null,\n` +
    `  "extractedDetails": {\n` +
    `    "companyName": string | null,\n` +
    `    "monthlyIncome": number | string | null,\n` +
    `    "loanAmount": number | string | null,\n` +
    `    "tenureMonths": number | string | null,\n` +
    `    "cibil": number | string | null,\n` +
    `    "existingEmi": number | string | null,\n` +
    `    "age": number | string | null,\n` +
    `    "location": string | null,\n` +
    `    "employmentStatus": "unemployed" | "salaried" | "self-employed" | "student" | null,\n` +
    `    "employmentType": "Salaried" | "Self-Employed" | "Unemployed" | "Student" | null\n` +
    `  },\n` +
    `  "isCorrection": boolean,\n` +
    `  "correctedFields": string[],\n` +
    `  "targetBank": string | null,\n` +
    `  "selectedBank": string | null,\n` +
    `  "rejectedBank": string | null,\n` +
    `  "city": string | null,\n` +
    `  "wantsReevaluation": boolean,\n` +
    `  "emiDetails": { "principal": number | null, "rate": number | null, "tenureMonths": number | null } | null,\n` +
    `  "managerSearch": { "bankName": string | null, "city": string | null } | null,\n` +
    `  "companyQuery": string | null,\n` +
    `  "webSearchQuery": string | null,\n` +
    `  "naturalResponse": string\n` +
    `}`;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const LLM_TIMEOUT_MS = 25000;
  const executeApiCall = async (targetModel: string, useStructuredOutputs: boolean = true) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const payload: any = {
        model: targetModel,
        temperature: 0.1,
        max_tokens: 1500,
        messages,
      };
      if (useStructuredOutputs) {
        payload.response_format = { type: "json_object" };
      }
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "CreditWise AI",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        const err: any = new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
        err.status = res.status;
        err.rawResponseBody = errText;
        throw err;
      }
      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let rawContent = "";
  let lastOriginalError: any = null;

  if (apiKey) {
    const modelsToTry = Array.from(
      new Set([
        model && model !== "openrouter/auto" ? model : undefined,
        "openrouter/free",
        "inclusionai/ling-3.0-flash-sante:free",
        "google/gemma-4-26b-a4b-it:free",
        "google/gemma-4-31b-it:free",
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      ].filter(Boolean) as string[])
    );

    for (const m of modelsToTry) {
      try {
        const data = await executeApiCall(m, true);
        const choice = data?.choices?.[0]?.message;
        rawContent = choice?.content || choice?.text || "";
        if (!rawContent && choice?.reasoning && typeof choice.reasoning === "string") {
          const jsonMatch = choice.reasoning.match(/\{[\s\S]*\}/);
          if (jsonMatch) rawContent = jsonMatch[0];
        }
        if (rawContent && rawContent.trim()) break;
      } catch (err: any) {
        lastOriginalError = err;
        const errMsg = String(err?.message || err);
        if (errMsg.includes("does not support feature: structured-outputs") || errMsg.includes("INVALID_REQUEST_BODY")) {
          try {
            const dataWithoutFormat = await executeApiCall(m, false);
            const choice = dataWithoutFormat?.choices?.[0]?.message;
            rawContent = choice?.content || choice?.text || "";
            if (!rawContent && choice?.reasoning && typeof choice.reasoning === "string") {
              const jsonMatch = choice.reasoning.match(/\{[\s\S]*\}/);
              if (jsonMatch) rawContent = jsonMatch[0];
            }
            if (rawContent && rawContent.trim()) break;
          } catch (retryErr: any) {
            lastOriginalError = retryErr;
            console.error(`[analyzeConversationWithLLM] Retry without structured outputs failed for ${m}:`, (retryErr as any)?.message || retryErr);
          }
        } else {
          console.error(`[analyzeConversationWithLLM] Failed with model ${m}:`, errMsg);
        }
      }
    }
  }

  if (!rawContent && lastOriginalError) {
    console.error("================================================================================");
    console.error("🚨 [ORIGINAL EXCEPTION IN LLM SERVICE]");
    console.error("• HTTP Status:", lastOriginalError?.status || (String(lastOriginalError?.message).match(/HTTP\s+(\d+)/)?.[1] ? Number(String(lastOriginalError?.message).match(/HTTP\s+(\d+)/)?.[1]) : "N/A"));
    console.error("• Exception Name:", lastOriginalError?.name || "Error");
    console.error("• Exception Message:", lastOriginalError?.message || String(lastOriginalError));
    console.error("• Stack Trace:\n", lastOriginalError?.stack || "(No stack trace available)");
    console.error("• Raw LLM Response Body:\n", lastOriginalError?.rawResponseBody || "(Empty / No body received)");
    console.error("================================================================================");
  }

  console.log(`[analyzeConversationWithLLM] RAW CONTENT (${rawContent.length} chars):\n`, rawContent);

  if (rawContent) {
    let parsed: MasterConversationAnalysis | null = null;
    try {
      let cleaned = cleanLlmJsonOutput(rawContent);
      cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(cleaned);
      console.log("[analyzeConversationWithLLM] JSON.parse succeeded directly");
    } catch (e1: any) {
      console.warn("[analyzeConversationWithLLM] e1 parse failed:", e1.message);
      try {
        let cleaned = cleanLlmJsonOutput(rawContent).replace(/,\s*([}\]])/g, "$1");
        const sanitized = cleaned.replace(/(:\s*"[^"]*?)\n([^"]*")/g, "$1\\n$2");
        parsed = JSON.parse(sanitized);
        console.log("[analyzeConversationWithLLM] Sanitized JSON.parse succeeded");
      } catch (e2: any) {
        console.warn("[analyzeConversationWithLLM] e2 parse failed:", e2.message);
        const getStr = (key: string) => {
          const m = rawContent.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"));
          if (m) {
            try {
              return JSON.parse(`"${m[1]}"`);
            } catch {
              return m[1];
            }
          }
          const mTrunc = rawContent.match(new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)(?:"|(?=\\s*,\\s*"[a-zA-Z]+"\s*:)|$)`, "i"));
          return mTrunc ? mTrunc[1].trim() : null;
        };
        const getNum = (key: string) => {
          const m = rawContent.match(new RegExp(`"${key}"\\s*:\\s*([0-9.]+)`, "i"));
          return m ? Number(m[1]) : null;
        };
        const getBool = (key: string) => {
          const m = rawContent.match(new RegExp(`"${key}"\\s*:\\s*(true|false)`, "i"));
          return m ? m[1].toLowerCase() === "true" : false;
        };

        const parsedQAnswer = getStr("questionAnswer");
        const parsedNatResp = getStr("naturalResponse");

        parsed = {
          userIntent: (getStr("userIntent") as any) || "LOAN_ELIGIBILITY",
          isLoanIntent: getBool("isLoanIntent"),
          hasQuestionOrObjection: getBool("hasQuestionOrObjection"),
          questionAnswer: parsedQAnswer,
          extractedDetails: {
            companyName: getStr("companyName"),
            monthlyIncome: getNum("monthlyIncome"),
            loanAmount: getNum("loanAmount"),
            tenureMonths: getNum("tenureMonths"),
            cibil: getNum("cibil"),
            existingEmi: getNum("existingEmi"),
            age: getNum("age"),
            location: getStr("location"),
            employmentType: (getStr("employmentType") as any) || null,
          },
          isCorrection: getBool("isCorrection"),
          correctedFields: [],
          targetBank: getStr("targetBank"),
          selectedBank: getStr("selectedBank"),
          rejectedBank: getStr("rejectedBank"),
          city: getStr("city"),
          wantsReevaluation: getBool("wantsReevaluation"),
          emiDetails: null,
          managerSearch: null,
          companyQuery: getStr("companyQuery"),
          webSearchQuery: getStr("webSearchQuery"),
          naturalResponse: parsedNatResp || parsedQAnswer || "",
        };
      }
    }

    // If rawContent was plain text without JSON fences or keys, use the LLM's natural text directly!
    if (!parsed || !parsed.naturalResponse || parsed.naturalResponse.trim().length === 0) {
      if (rawContent && rawContent.trim().length > 0 && !rawContent.trim().startsWith("{")) {
        let detectedRejectedBank: string | null = null;
        const rejMatch = userMessage.match(/(?:don't\s*want|not|reject|skip|no\s*to|avoid)\s+([A-Za-z0-9\s&]+?)(?:,|\.|\?|$|what|which)/i);
        if (rejMatch && rejMatch[1]) {
          const cand = rejMatch[1].trim();
          detectedRejectedBank = eligibleBanks?.find((b) => b.toLowerCase().includes(cand.toLowerCase()) || cand.toLowerCase().includes(b.toLowerCase())) || cand;
        }

        let detectedSelectedBank: string | null = null;
        if (!detectedRejectedBank && eligibleBanks) {
          for (const b of eligibleBanks) {
            const bNorm = b.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
            if (bNorm.length > 2 && new RegExp(`\\b${bNorm}\\b`, "i").test(userMessage)) {
              detectedSelectedBank = b;
              break;
            }
          }
        }

        let detectedCity: string | null = null;
        const cityMatch = userMessage.match(/\b(?:in|at|from|city\s*is|based\s*in)\s+([A-Z][a-z]+)/i);
        if (cityMatch) {
          detectedCity = cityMatch[1].trim();
        }

        const isUserLoanIntent =
          /loan|borrow|credit|personal\s*loan|need\s*(?:a\s*)?loan|apply\s*(?:for\s*)?(?:a\s*)?loan|get\s*(?:a\s*)?loan/i.test(userMessage);

        parsed = {
          userIntent: detectedRejectedBank
            ? "REJECT_BANK"
            : detectedSelectedBank
              ? "SELECT_BANK"
              : hasCompletedEvaluation
                ? "PROCEED_NEXT_STEP"
                : (isUserLoanIntent || isFlowActive || (missingFields && missingFields.length > 0))
                  ? "LOAN_ELIGIBILITY"
                  : "GENERAL_CHAT",
          isLoanIntent: isUserLoanIntent || isFlowActive || Boolean(missingFields && missingFields.length > 0) || false,
          hasQuestionOrObjection: false,
          questionAnswer: null,
          extractedDetails: {
            location: detectedCity,
          },
          isCorrection: false,
          correctedFields: [],
          targetBank: null,
          selectedBank: detectedSelectedBank,
          rejectedBank: detectedRejectedBank,
          city: detectedCity,
          wantsReevaluation: /recalculat|re-evaluat|show\s*(?:the\s*)?table\s*again/i.test(userMessage),
          naturalResponse: rawContent.trim(),
        };
      }
    }

    if (parsed && (!parsed.naturalResponse || parsed.naturalResponse.trim().length === 0)) {
      if (hasCompletedEvaluation) {
        if (parsed.userIntent === "REJECT_BANK" || parsed.rejectedBank) {
          const bankName = parsed.rejectedBank || "that bank";
          const remaining = (eligibleBanks || []).filter((b) => !b.toLowerCase().includes(bankName.toLowerCase()));
          parsed.naturalResponse = `Understood, we'll exclude ${bankName} from your options. You are also eligible with other partner banks such as ${remaining.slice(0, 3).join(", ")}. Which bank would you like to proceed with?`;
        } else if (parsed.selectedBank && !parsed.city) {
          parsed.naturalResponse = `Great choice with ${parsed.selectedBank}! Please provide your branch location, city, or pincode to view verified branch manager contacts.`;
        } else {
          parsed.naturalResponse = `We're ready to proceed with your application! Which partner bank would you like to apply with?`;
        }
      }
    }

    if (parsed) {
      // Normalize numeric extracted entities
      if (parsed.extractedDetails) {
        if (typeof parsed.extractedDetails.monthlyIncome === "string") {
          parsed.extractedDetails.monthlyIncome = parseFinancialAmount(parsed.extractedDetails.monthlyIncome) || undefined;
        }
        if (typeof parsed.extractedDetails.loanAmount === "string") {
          parsed.extractedDetails.loanAmount = parseFinancialAmount(parsed.extractedDetails.loanAmount) || undefined;
        }
        if (typeof parsed.extractedDetails.existingEmi === "string") {
          const emi = parseFinancialAmount(parsed.extractedDetails.existingEmi);
          parsed.extractedDetails.existingEmi = emi !== null ? emi : undefined;
        }
        if (typeof parsed.extractedDetails.tenureMonths === "string") {
          const t = parseInt(parsed.extractedDetails.tenureMonths, 10);
          if (!isNaN(t)) {
            parsed.extractedDetails.tenureMonths = t >= 1 && t <= 7 ? t * 12 : t;
          }
        }
        if (typeof parsed.extractedDetails.tenureMonths === "number" && parsed.extractedDetails.tenureMonths >= 1 && parsed.extractedDetails.tenureMonths <= 7) {
          parsed.extractedDetails.tenureMonths = parsed.extractedDetails.tenureMonths * 12;
        }
        if (typeof parsed.extractedDetails.cibil === "string") {
          const s = String(parsed.extractedDetails.cibil).trim();
          if (/not\s*provided|unknown|not\s*sure|don'?t\s*know|na|n\/a|no\s*cibil|zero\s*credit|no\s*credit/i.test(s)) {
            parsed.extractedDetails.cibil = 700;
          } else {
            const c = parseInt(s, 10);
            parsed.extractedDetails.cibil = !isNaN(c) && c >= 300 && c <= 900 ? c : 700;
          }
        }
        if (typeof parsed.extractedDetails.cibil === "number") {
          if (parsed.extractedDetails.cibil === 0 && (/don'?t\s*know|unknown|not\s*sure|never\s*checked|no\s*idea|no\s*cibil/i.test(userMessage))) {
            parsed.extractedDetails.cibil = 700;
          }
        }
        if (
          parsed.extractedDetails.cibil == null &&
          (/(?:don'?t\s*know|never\s*checked|unknown|not\s*sure|no\s*idea|haven'?t\s*checked|no\s*cibil|zero\s*cibil).*(?:cibil|credit\s*score)|(?:cibil|credit\s*score).*(?:don'?t\s*know|never\s*checked|unknown|not\s*sure|no\s*idea|haven'?t\s*checked|no\s*cibil|zero\s*cibil)/i.test(userMessage) ||
            /employee.*no\s*cibil/i.test(userMessage) ||
            (missingFields?.[0] === "cibil" && /don'?t\s*know|unknown|not\s*sure|never\s*checked|no\s*idea|no\s*score|no\s*cibil|zero\s*cibil|none|0|zero/i.test(userMessage)))
        ) {
          parsed.extractedDetails.cibil = 700;
        }
        if (typeof parsed.extractedDetails.age === "string") {
          const a = parseInt(parsed.extractedDetails.age, 10);
          parsed.extractedDetails.age = !isNaN(a) ? a : undefined;
        }
        if (parsed.extractedDetails.companyName && isInvalidCompanyName(parsed.extractedDetails.companyName)) {
          parsed.extractedDetails.companyName = undefined;
        }

        // Generic simultaneous multi-entity extraction from userMessage for any unextracted or omitted fields
        if (parsed.extractedDetails.existingEmi === undefined || parsed.extractedDetails.existingEmi === null) {
          if (
            /(?:no|zero|0|nil)\s*(?:existing\s*)?emi|no\s*loans?|zero\s*debt|sab\s*clear/i.test(userMessage) ||
            /^(?:0|zero|none|nil|no|no\s*loans?|no\s*emis?|nothing|clean|na|n\/a)\b/i.test(userMessage.trim())
          ) {
            parsed.extractedDetails.existingEmi = 0;
          } else {
            const emiMatch = userMessage.match(/(?:existing|current|other|ongoing)?\s*emi(?:s)?(?::|\s*is|\s*of|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i);
            if (emiMatch) {
              const parsedEmi = parseFinancialAmount(emiMatch[1] + (emiMatch[2] || ""));
              if (parsedEmi !== null) parsed.extractedDetails.existingEmi = parsedEmi;
            } else if (missingFields?.[0] === "existingEmi") {
              const parsedEmi = parseFinancialAmount(userMessage);
              if (parsedEmi !== null) parsed.extractedDetails.existingEmi = parsedEmi;
            }
          }
        }

        if (parsed.extractedDetails.age === undefined || parsed.extractedDetails.age === null) {
          const ageMatch =
            userMessage.match(/\b(?:age\s*(?:is|of|[:=-])?\s*|aged\s*)(\d{2})\b/i) ||
            userMessage.match(/\b(\d{2})\s*(?:years?\s*old|yr\s*old|yo\b)/i) ||
            (missingFields?.[0] === "age" || /age\b/i.test(conversationHistory?.slice(-1)?.[0]?.content || "")
              ? userMessage.match(/\b(1[8-9]|[2-8]\d)\b/)
              : null);
          if (ageMatch) {
            const a = parseInt(ageMatch[1], 10);
            if (a >= 18 && a <= 85) parsed.extractedDetails.age = a;
          }
        }

        if (parsed.extractedDetails.cibil === undefined || parsed.extractedDetails.cibil === null) {
          const cibilMatch =
            userMessage.match(/(?:cibil|credit\s*score|score\b)(?:\s*(?:is|of|[:=-]))?\s*([3-9]\d{2})\b/i) ||
            userMessage.match(/\b([3-9]\d{2})\b\s*(?:cibil|credit\s*score)/i) ||
            (missingFields?.[0] === "cibil" || /cibil|credit\s*score/i.test(conversationHistory?.slice(-1)?.[0]?.content || "")
              ? userMessage.match(/\b([3-9]\d{2})\b/)
              : null);
          if (cibilMatch) {
            parsed.extractedDetails.cibil = parseInt(cibilMatch[1], 10);
          }
        }

        if (parsed.extractedDetails.tenureMonths === undefined || parsed.extractedDetails.tenureMonths === null) {
          const yrMatch = userMessage.match(/(?:tenure\s*(?:is|of|[:=-])?\s*|for\s+)?(\d+)\s*(?:years?|yrs?|yr|saal|sal)\b/i);
          if (yrMatch) {
            parsed.extractedDetails.tenureMonths = parseInt(yrMatch[1], 10) * 12;
          } else {
            const moMatch = userMessage.match(/(?:tenure\s*(?:is|of|[:=-])?\s*|for\s+)?(\d+)\s*(?:months?|m\b)/i);
            if (moMatch) {
              parsed.extractedDetails.tenureMonths = parseInt(moMatch[1], 10);
            } else if (missingFields?.[0] === "tenureMonths") {
              const numMatch = userMessage.match(/\b(\d+)\b/);
              if (numMatch) {
                const n = parseInt(numMatch[1], 10);
                parsed.extractedDetails.tenureMonths = n <= 7 ? n * 12 : n;
              }
            }
          }
        }

        if (parsed.extractedDetails.loanAmount === undefined || parsed.extractedDetails.loanAmount === null) {
          const loanMatch =
            userMessage.match(/(?:need|want|borrow|require|looking\s+for|loan\s*(?:amount|of)?)(?:\s*(?:is|of|[:=-]))?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)?)\s*(?:personal\s*)?(?:loan)?/i) ||
            userMessage.match(/(\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka))\s+(?:personal\s*)?(?:loan|borrow)/i);
          if (loanMatch) {
            const amt = parseFinancialAmount(loanMatch[1]);
            if (amt !== null && amt >= 10000) parsed.extractedDetails.loanAmount = amt;
          } else if (missingFields?.[0] === "loanAmount") {
            const amt = parseFinancialAmount(userMessage);
            if (amt !== null && amt >= 1000) parsed.extractedDetails.loanAmount = amt;
          }
        }

        if (parsed.extractedDetails.monthlyIncome === undefined || parsed.extractedDetails.monthlyIncome === null) {
          const salMatch =
            userMessage.match(/(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|in\s*hand|nmi|nth|earning|earns?|makes?)(?:\s*(?:is|of|[:=-]))?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|peti|hazar)?)(?:\s*(?:per|\/)\s*month|\/mo)?/i) ||
            userMessage.match(/(\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|peti|hazar)?)\s*(?:per\s*month|\/mo|monthly|take\s*home|in\s*hand|salary|income)/i);
          if (salMatch) {
            const inc = parseFinancialAmount(salMatch[1]);
            if (inc !== null) parsed.extractedDetails.monthlyIncome = inc;
          } else if (missingFields?.[0] === "monthlyIncome") {
            const inc = parseFinancialAmount(userMessage);
            if (inc !== null) parsed.extractedDetails.monthlyIncome = inc;
          }
        }

        if (!parsed.extractedDetails.companyName || isInvalidCompanyName(parsed.extractedDetails.companyName)) {
          const cand = extractCompanyCandidateFromText(userMessage);
          if (cand && !isInvalidCompanyName(cand)) {
            parsed.extractedDetails.companyName = cand;
          } else if (missingFields?.[0] === "companyName" && !isFinancialOrProfileInput(userMessage) && !isInvalidCompanyName(userMessage)) {
            parsed.extractedDetails.companyName = userMessage.trim();
          }
        }

        // Only keep loan intent active if an eligibility flow is ALREADY in progress and user is actively continuing it
        if (
          isFlowActive &&
          parsed.userIntent !== "QUESTION_OR_OBJECTION" &&
          parsed.userIntent !== "BANK_POLICY" &&
          parsed.userIntent !== "CANCEL_RESET"
        ) {
          parsed.isLoanIntent = true;
          if (parsed.userIntent === "GENERAL_CHAT") {
            parsed.userIntent = "LOAN_ELIGIBILITY";
          }
        }
      }

      return parsed;
    }
  }

  // Technical API/network error handling only (no conversational fallbacks or canned replies)
  return {
    isTechnicalError: true,
    userIntent: "GENERAL_CHAT",
    isLoanIntent: false,
    hasQuestionOrObjection: false,
    questionAnswer: null,
    extractedDetails: {},
    isCorrection: false,
    correctedFields: [],
    targetBank: null,
    selectedBank: null,
    rejectedBank: null,
    city: null,
    wantsReevaluation: false,
    emiDetails: null,
    managerSearch: null,
    companyQuery: null,
    webSearchQuery: null,
    naturalResponse: "I'm here to help! How can I assist you today? You can evaluate your loan eligibility across partner banks, check bank policies, calculate an EMI, or look up branch managers.",
  };
}

function nextEligibilityQuestion(field?: string): string {
  const questions: Record<string, string> = {
    company: MANDATORY_COMPANY_PROMPT,
    companyName: MANDATORY_COMPANY_PROMPT,
    monthlyIncome: "What is your monthly take-home salary?",
    loanAmount: "How much would you like to borrow?",
    tenureMonths: "What repayment tenure do you prefer?",
    cibil: "What is your approximate CIBIL score?",
    cibilScore: "What is your approximate CIBIL score?",
    age: "What is your current age?",
    existingEmi: "What are your existing monthly EMIs? Reply 0 if you have none.",
  };
  return questions[field || ""] || MANDATORY_COMPANY_PROMPT;
}

async function liveCompanySources(_query: string) {
  return [];
}

function liveCandidates(sources: Array<{ title: string; url: string; snippet: string }>): CompanyCandidate[] {
  return sources
    .filter((source) => source.title && source.url)
    .map((source) => ({
      // A live provider has no database ID. Its result URL is the stable value
      // sent back on click; the displayed name remains provider-supplied.
      id: source.url,
      name: source.title.trim(),
      source: "live" as const,
      liveSource: source,
    }));
}

function liveOverview(sources: Array<{ title: string; url: string; snippet: string }>): string {
  return sources
    .map((source) => source.snippet.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\\n\\n");
}

async function handleCompanySelectionFlow(
  conversationId: string,
  input: string,
  applicant: ApplicantProfile,
  session: any,
  action?: CompanySelectionAction,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult | null> {
  const flow =
    session?.companyFlow ||
    (session?.awaitingEmployerConfirmation && session?.employerConfirmationOptions?.length
      ? {
          stage: "COMPANY_SELECTION",
          candidates: session.employerConfirmationOptions,
          originalInput: session.employerConfirmationQuery,
        }
      : undefined);
  const isCompanyStep = Boolean(
    session?.expectedField === "companyName" ||
    session?.expectedField === "company" ||
    session?.expectedEntity === "company" ||
    session?.expectedEntity === "companyName" ||
    (session?.in_eligibility_flow && (
      (session?.missingFields || [])[0] === "companyName" ||
      (session?.missingFields || [])[0] === "company"
    ))
  );
  const trimmedInput = input.trim();

  const isExplicitCompanyPhrase = /(?:(?:(?:i\s*am|i['"]?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by)\s+(?:(?:the|my|our)\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)\s+)|(?:(?:my|our|the)\s+(?:currently\s+|presently\s+)?(?:working\s+|current\s+|present\s+|existing\s+|previous\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?|workplace)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:working\s+|current\s+|present\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:my\s+)?(?:company|employer|organization|org)(?:\s*name)?\s*[:=-]\s*)|(?:work\s+(?:at|in|with|for)|works\s+(?:at|in|with|for)|working\s+(?:at|in|with|for)|employed\s+(?:at|by|in|with|for))|(?:(?:my\s+)?(?:company|employer)\s+is)|(?:(?:i\s*am|i'?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by))|(?:(?:change|changed|update|updated|correct|switch|switched|move|moved|leave|left|joined)\s+(?:my\s+)?(?:company|employer|job|workplace|comapny))|(?:employer\s*[:=-]|company\s*[:=-]))\b/i.test(trimmedInput);

  const lastAssistantMsg = (conversationHistory || [])
    .filter((m) => m.role === "assistant" || m.role === "ai" || m.role === "bot")
    .slice(-1)[0]?.content || "";

  const assistantAskedLocation =
    /(?:which|what|enter|provide|your|share|tell\s+me)\s+(?:city|branch|location|pincode|area)|where\s+are\s+you\s+(?:located|based)|which\s+city\s+you'?re\s+located\s+in/i.test(
      lastAssistantMsg
    );

  const isLocationMsg = isLocationInput(trimmedInput);

  const isBankMsg = isKnownBankName(trimmedInput) || Boolean(resolveBankName(trimmedInput, session?.eligible_banks));
  const isPostEvalOrBankFlow = Boolean(
    session?.hasCompletedEvaluation ||
    session?.evaluationCompleted ||
    session?.expectedField === "chosenBank" ||
    session?.expectedField === "selectedBank" ||
    session?.expectedField === "cityOrPincode" ||
    session?.expectedField === "preferredBranch" ||
    session?.expectedField === "branchSelection" ||
    session?.chosenBank ||
    session?.selectedBank ||
    (session?.eligible_banks && session.eligible_banks.length > 0)
  );

  const isNonCompanyEligibilityStep = Boolean(
    session?.in_eligibility_flow &&
    session?.expectedField &&
    session?.expectedField !== "companyName" &&
    session?.expectedField !== "company" &&
    !flow
  );

  // Natural language mapping for button equivalents
  if (!action && flow?.stage === "COMPANY_CONFIRMATION") {
    if (/^(?:yes|correct|confirm|yep|yeah|sure|that's right|right|1|1\b)\b/i.test(trimmedInput)) {
      action = { type: "confirm" };
    } else if (/^(?:no|nope|retry|different|cancel|wrong|enter again|2|2\b)\b/i.test(trimmedInput)) {
      action = { type: "retry" };
    }
  }

  if (!action && flow?.stage === "COMPANY_SELECTION" && Array.isArray(flow?.candidates) && flow.candidates.length > 0) {
    if (/^(?:yes|correct|confirm|yep|yeah|sure|that's right|right)\b/i.test(trimmedInput)) {
      action = { type: "select", companyId: flow.candidates[0].id || flow.candidates[0].name, companyName: flow.candidates[0].name };
    } else if (/^\d+$/.test(trimmedInput) || /^(?:option\s+|opt\s+|#|no\.?\s*)(\d+)\b/i.test(trimmedInput)) {
      const match = trimmedInput.match(/(\d+)/);
      const idx = match ? parseInt(match[1], 10) - 1 : -1;
      if (idx >= 0 && idx < flow.candidates.length) {
        action = { type: "select", companyId: flow.candidates[idx].id || flow.candidates[idx].name, companyName: flow.candidates[idx].name };
      }
    } else if (/^none\s+of\s+these|unlisted/i.test(trimmedInput)) {
      action = { type: "select", companyId: "unlisted", companyName: "Unlisted / Open Market" };
    } else {
      const match = flow.candidates.find(
        (c: CompanyCandidate) =>
          c.name.toLowerCase() === trimmedInput.toLowerCase() ||
          c.name.toLowerCase().includes(trimmedInput.toLowerCase())
      );
      if (match) {
        action = { type: "select", companyId: match.id || match.name, companyName: match.name };
      }
    }
  }

  const hasSalaryOrFinancialInput =
    isFinancialOrProfileInput(trimmedInput) ||
    /\b(?:salary|income|take\s*home|in\s*hand|net\s*pay|cibil|tenure|age|emi)\b/i.test(trimmedInput) ||
    /^(?:rs\.?|inr|₹)?\s*[0-9]+(?:\.[0-9]+)?\s*(?:k|lakhs?|lacs?|lac|l|crores?|cr|thousand|hazar)?$/i.test(trimmedInput);

  if (!action && flow?.stage === "COMPANY_SELECTION" && hasSalaryOrFinancialInput && Array.isArray(flow?.candidates) && flow.candidates.length > 0) {
    const autoCandidate = flow.candidates[0];
    const canonicalName = autoCandidate.name;
    const selectedApplicant = { ...applicant, companyName: canonicalName };
    const missing = getRequiredPolicyFields(selectedApplicant);
    const nextField = missing[0] || "monthlyIncome";
    await saveEligibilityState(conversationId, {
      ...session,
      applicant: selectedApplicant,
      expectedField: nextField,
      missingFields: missing,
      in_eligibility_flow: true,
      activeFlow: "LOAN_ELIGIBILITY",
      mainUserGoal: "PERSONAL_LOAN",
      company: canonicalName,
      companyCategory: (autoCandidate as any).category || session?.companyCategory || "Standard",
      selectedCompanyName: canonicalName,
      selectedCompany: canonicalName,
      awaitingEmployerConfirmation: false,
      companyFlow: {
        stage: "ELIGIBILITY_INPUT",
        selectedCompanyName: canonicalName,
        normalizedCompany: canonicalName,
        candidates: flow.candidates,
      },
      updatedAt: Date.now(),
    });
    return null;
  }

  const isQuestionOrAssistance =
    isQuestionMessage(trimmedInput) ||
    /\?$/.test(trimmedInput) ||
    isGeneralLoanAssistanceQuery(trimmedInput).isMatch ||
    isGeneralFinancialQuery(trimmedInput) ||
    isGeneralAssistanceQuery(trimmedInput) ||
    /\b(?:education(?:al)?\s*loan|student\s*loan|home\s*loan|car\s*loan|auto\s*loan|vehicle\s*loan|business\s*loan|msme\s*loan|credit\s*card)\b/i.test(trimmedInput) ||
    /\b(?:process|procedure|steps?|don'?t\s*know|tell\s*me|explain)\b/i.test(trimmedInput);

  if (
    !action &&
    (isPureGreeting(trimmedInput) ||
      isGreetingOrPleasantry(trimmedInput) ||
      isInvalidCompanyName(trimmedInput) ||
      isQuestionOrAssistance ||
      hasSalaryOrFinancialInput ||
      isBankMsg ||
      isPostEvalOrBankFlow ||
      isNonCompanyEligibilityStep ||
      isLocationMsg ||
      assistantAskedLocation ||
      (flow?.stage === "ELIGIBILITY_INPUT" && !isCompanyStep)) &&
    !isExplicitCompanyPhrase
  ) {
    return null;
  }

  // 1. Handle Retry / "No, enter again"
  if (action?.type === "retry") {
    const missing = getRequiredPolicyFields(applicant);
    await saveEligibilityState(conversationId, {
      ...session,
      applicant,
      expectedField: "companyName",
      missingFields: missing.includes("companyName") ? missing : ["companyName", ...missing],
      in_eligibility_flow: true,
      companyFlow: { stage: "COMPANY_INPUT" },
      updatedAt: Date.now(),
    });
    return { reply: "Please enter your employer's exact company name." };
  }

  // 2. Handle Confirm / "Yes, [Company]"
  if (action?.type === "confirm") {
    const confirmedCandidate = flow?.candidates?.[0];
    if (confirmedCandidate) {
      action = { type: "select", companyId: confirmedCandidate.id, companyName: confirmedCandidate.name };
    }
  }

  // 3. Handle Select exact company
  if (action?.type === "select") {
    let candidate = flow?.candidates?.find((item: CompanyCandidate) =>
      (action?.companyId && String(item.id) === String(action.companyId)) ||
      (action?.companyName && item.name.toLowerCase() === action.companyName.toLowerCase())
    ) || (action?.companyName ? { id: action.companyId || action.companyName, name: action.companyName, source: "database" as const } : null);

    if (
      action?.companyId === "unlisted" ||
      action?.companyName?.toLowerCase().includes("unlisted") ||
      action?.companyName?.toLowerCase().includes("none of these")
    ) {
      candidate = { id: "unlisted", name: "Unlisted / Open Market", source: "database" };
    }

    if (!candidate) {
      return { reply: "That company option is no longer available. Please enter your employer's company name." };
    }

    if (candidate.id === "unlisted" || candidate.name.toLowerCase().includes("unlisted")) {
      const userEnteredName = flow?.originalInput && !isInvalidCompanyName(flow.originalInput)
        ? flow.originalInput
        : (action?.companyName && !isInvalidCompanyName(action.companyName) && !action.companyName.toLowerCase().includes("unlisted") ? action.companyName : "Unlisted Company");
      const canonicalName = userEnteredName;
      const selectedApplicant = { ...applicant, companyName: canonicalName, companyCategory: "Unlisted" };
      const missing = getRequiredPolicyFields(selectedApplicant);
      const nextField = missing[0] || "monthlyIncome";

      // Attempt live Incraax enrichment for basic + financial info
      let liveOverview = "";
      try {
        const liveIntel = await fetchLiveCompanyIntelligence(canonicalName);
        if (liveIntel?.overview) {
          liveOverview = `\n\n**Company Overview:** ${liveIntel.overview}`;
        }
      } catch {}

      const isLoanContext = Boolean(session?.in_eligibility_flow || session?.mainUserGoal === "PERSONAL_LOAN");
      const nextStepText = isLoanContext
        ? `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`
        : "Would you like to apply for a loan or calculate your eligibility?";

      const unlistedReply = `### 🏢 Employer Status: **${canonicalName}**\n\n- **Status:** Unlisted in partner bank database\n- **Policy Categorization:** No specific category listed in partner bank database. Eligibility will be evaluated under unlisted / open-market criteria across eligible lenders.${liveOverview}\n\n${nextStepText}`;

      await saveEligibilityState(conversationId, {
        ...session,
        applicant: selectedApplicant,
        expectedField: nextField,
        missingFields: missing,
        in_eligibility_flow: Boolean(session?.in_eligibility_flow),
        activeFlow: session?.activeFlow || "LOAN_ELIGIBILITY",
        mainUserGoal: session?.mainUserGoal || "PERSONAL_LOAN",
        company: canonicalName,
        companyCategory: "Unlisted",
        selectedCompanyName: canonicalName,
        selectedCompany: canonicalName,
        sessionVariables: {
          ...(session?.sessionVariables || {}),
          employer: canonicalName,
          Employer_Name: canonicalName,
          lastPromptedSlot: nextField,
        },
        companyFlow: {
          stage: "ELIGIBILITY_INPUT",
          selectedCompanyName: canonicalName,
          originalInput: canonicalName,
        },
        updatedAt: Date.now(),
      });

      return {
        reply: unlistedReply,
        companyQuery: canonicalName,
      };
    }

    const company = await searchCompany(candidate.name);
    const canonicalName = (company.found && company.primaryName) ? company.primaryName : candidate.name;
    const stableCin = company.basicInfo?.cin || (candidate as any).cin || undefined;
    const stableId = candidate.id || stableCin || canonicalName;
    const selectedApplicant = { ...applicant, companyName: canonicalName };
    const missing = getRequiredPolicyFields(selectedApplicant);
    const nextField = missing[0] || "monthlyIncome";
    const overview = company.overview || `${canonicalName} is verified in partner bank corporate records.`;
    
    const candidateObj = {
      id: stableId,
      name: canonicalName,
      cin: stableCin,
      source: candidate.source || ("database" as const),
    };

    const companyData = {
      company_id: stableId,
      company_name: canonicalName,
      cin: stableCin,
      overview,
      basic_info: company.basicInfo,
      financial_info: company.financialInfo,
      bank_records: company.bankRecords,
      needs_disambiguation: false,
    };

    const isLoanContext = Boolean(session?.in_eligibility_flow || session?.mainUserGoal === "PERSONAL_LOAN");
    const nextStepText = isLoanContext
      ? `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`
      : "Would you like to apply for a loan or calculate your eligibility?";

    await saveEligibilityState(conversationId, {
      ...session,
      applicant: selectedApplicant,
      expectedField: nextField,
      missingFields: missing,
      in_eligibility_flow: true,
      activeFlow: "LOAN_ELIGIBILITY",
      mainUserGoal: "PERSONAL_LOAN",
      company: canonicalName,
      companyCategory: company.bankRecords?.[0]?.company_category || "Standard",
      selectedCompanyName: canonicalName,
      selectedCompany: canonicalName,
      selectedCompanyId: stableId,
      selectedCompanyCin: stableCin,
      companyCandidate: candidateObj,
      sessionVariables: {
        ...(session?.sessionVariables || {}),
        employer: canonicalName,
        Employer_Name: canonicalName,
        lastPromptedSlot: nextField,
      },
      companyFlow: {
        stage: "ELIGIBILITY_INPUT",
        originalInput: flow?.originalInput,
        normalizedCompany: canonicalName,
        selectedCompanyId: stableId,
        selectedCompanyName: canonicalName,
        selectedCompany: canonicalName,
        selectedCompanyCin: stableCin,
        companyCandidate: candidateObj,
        candidates: flow?.candidates,
        companyData,
      },
      updatedAt: Date.now(),
    });

    const responseContent = `${formatCompanyResponse({ ...company, primaryName: canonicalName, overview })}\n\n${nextStepText}`;
    return {
      reply: responseContent,
      companyData,
      companyQuery: canonicalName,
    };
  }

  // 4. Understand and process new company input
  const extracted = extractCompanyCandidateFromText(input);
  const isCompanyAlreadyConfirmed = Boolean(
    session?.companyFlow?.stage === "ELIGIBILITY_INPUT" ||
    session?.companyFlow?.selectedCompanyName ||
    session?.selectedCompanyName ||
    session?.hasCompletedEvaluation ||
    session?.evaluationCompleted
  );

  const hasCorporateSuffix = /\b(?:pvt\.?|private|limited|ltd\.?|technologies|services|consulting|solutions|systems|software|enterprises|industries|llp|holdings|group|corporation|corp|infotech|labs|infra|logistics)\b/i.test(trimmedInput);

  const isStandaloneCompanyName =
    !isCompanyAlreadyConfirmed &&
    !isNonCompanyEligibilityStep &&
    !isCompanyStep &&
    !flow &&
    extracted &&
    !isPureGreeting(trimmedInput) &&
    !isGreetingOrPleasantry(trimmedInput) &&
    !isFinancialOrProfileInput(trimmedInput) &&
    !isInvalidCompanyName(trimmedInput) &&
    !isLocationInput(trimmedInput) &&
    !assistantAskedLocation &&
    !isKnownBankName(trimmedInput) &&
    !Boolean(resolveBankName(trimmedInput, session?.eligible_banks)) &&
    !detectLoanIntent(trimmedInput).isLoanIntent &&
    (hasCorporateSuffix || !session?.in_eligibility_flow || session?.expectedField === "companyName" || session?.expectedField === "company");

  if (!extracted || (!isCompanyStep && !flow && !isExplicitCompanyPhrase && !isStandaloneCompanyName)) {
    return null;
  }

  const normalized = extracted.replace(/\b(pvt\.?|private|limited|ltd\.?)\b/gi, "").replace(/\s+/g, " ").trim();
  const dbResult = await searchCompany(extracted);
  const liveSources = await liveCompanySources(normalized);

  let isUserSelectingFromOptions = Boolean(
    flow?.stage === "COMPANY_SELECTION" &&
    Array.isArray(flow?.candidates) &&
    flow.candidates.some(
      (c: CompanyCandidate) =>
        c.name.toLowerCase() === extracted.toLowerCase() ||
        c.name.toLowerCase() === normalized.toLowerCase() ||
        c.name.toLowerCase().includes(normalized.toLowerCase())
    )
  );

  // Case A: Not found in database -> Check spelling mistakes / typos, then live search
  if (!dbResult.found) {
    const suggestions = await findCompanySuggestions(normalized);
    if (suggestions.length > 0) {
      await saveEligibilityState(conversationId, {
        ...session,
        applicant,
        expectedField: "company",
        missingFields: getRequiredPolicyFields(applicant),
        in_eligibility_flow: true,
        companyFlow: {
          stage: "COMPANY_SELECTION",
          originalInput: input,
          normalizedCompany: normalized,
          candidates: suggestions,
        },
        awaitingEmployerConfirmation: true,
        employerConfirmationQuery: normalized,
        updatedAt: Date.now(),
      });
      const candidateListHtml = formatCompanyCandidateList(suggestions.map((c) => c.name), normalized);
      return {
        reply: `Did you mean one of these employers? Click or select an option below:\n\n${candidateListHtml}`,
        companyData: {
          company_flow: "COMPANY_SELECTION",
          needs_disambiguation: true,
          candidates: suggestions,
          candidateOptions: suggestions,
          searchQuery: normalized,
        },
        companyQuery: normalized,
      };
    }

    return {
      reply: `No partner bank listing was found for **"${normalized}"**.\n\nPlease select from verified options or enter your company name again. If your company is unlisted, you can reply **"Unlisted"** to proceed under standard open market criteria.`,
      companyData: {
        company_flow: "COMPANY_SELECTION",
        needs_disambiguation: true,
        candidates: [
          { id: "unlisted", name: `${normalized} (Unlisted Employer)`, source: "database" },
          { id: "retry", name: "Enter different company", source: "database" },
        ],
        candidateOptions: [
          { id: "unlisted", name: `${normalized} (Unlisted Employer)`, source: "database" },
          { id: "retry", name: "Enter different company", source: "database" },
        ],
        searchQuery: normalized,
      },
    };
  }

  // Case B: Database matches found -> Disambiguate with selectable format
  const candidates = dbResult.candidateOptions;
  if (candidates && candidates.length > 0 && (!isUserSelectingFromOptions || dbResult.needsDisambiguation)) {
    const isStandalone = (session?.activeFlow === "COMPANY_SEARCH" || !session?.in_eligibility_flow) && !isExplicitCompanyPhrase && !isCompanyStep;
    await saveEligibilityState(conversationId, {
      ...session,
      applicant,
      expectedField: isStandalone ? undefined : "company",
      missingFields: getRequiredPolicyFields(applicant),
      in_eligibility_flow: !isStandalone,
      activeFlow: isStandalone ? "COMPANY_SEARCH" : (session?.activeFlow || "LOAN_ELIGIBILITY"),
      companyFlow: {
        stage: "COMPANY_SELECTION",
        originalInput: input,
        normalizedCompany: normalized,
        candidates,
      },
      awaitingEmployerConfirmation: true,
      employerConfirmationQuery: normalized,
      updatedAt: Date.now(),
    });
    let sideQAnswer = "";
    const sideQResult = detectAndAnswerSideQuestion(input);
    if (sideQResult.isQuestion && sideQResult.answer) {
      sideQAnswer = sideQResult.answer.trim();
    } else {
      const commonQAns = answerCommonBankingQuestion(input);
      if (commonQAns) sideQAnswer = commonQAns.trim();
    }
    const candidateListHtml = formatCompanyCandidateList(candidates.map((c) => c.name), normalized);
    return {
      reply: sideQAnswer ? `${sideQAnswer}\n\n---\n\n${candidateListHtml}` : candidateListHtml,
      companyData: {
        company_flow: "COMPANY_SELECTION",
        needs_disambiguation: true,
        candidates,
        candidateOptions: candidates,
        live_sources: liveSources,
        searchQuery: normalized,
      },
      companyQuery: normalized,
    };
  }

  // Case C: Single match found
  const candidate = candidates[0] || {
    id: dbResult.basicInfo?.id || dbResult.bankRecords[0]?.id || dbResult.primaryName,
    name: dbResult.primaryName,
    source: "database" as const,
  };

  // Check if user's message ALSO included a side question (Compound Company + Question)
  let sideQAnswer = "";
  const sideQResult = detectAndAnswerSideQuestion(input);
  if (sideQResult.isQuestion && sideQResult.answer) {
    sideQAnswer = sideQResult.answer.trim();
  } else {
    const commonQAns = answerCommonBankingQuestion(input);
    if (commonQAns) sideQAnswer = commonQAns.trim();
  }

  const isExactMatch =
    candidate.name.toLowerCase() === extracted.toLowerCase() ||
    (dbResult.primaryName && dbResult.primaryName.toLowerCase() === extracted.toLowerCase()) ||
    candidate.name.toLowerCase() === normalized.toLowerCase();

  isUserSelectingFromOptions =
    flow?.stage === "COMPANY_SELECTION" &&
    Array.isArray(flow?.candidates) &&
    flow.candidates.some(
      (c: CompanyCandidate) =>
        c.name.toLowerCase() === extracted.toLowerCase() ||
        c.name.toLowerCase() === normalized.toLowerCase() ||
        c.name.toLowerCase().includes(normalized.toLowerCase())
    );

  const shouldAutoSelect = isExplicitCompanyPhrase || isExactMatch || isUserSelectingFromOptions;

  if (shouldAutoSelect) {
    const canonicalName = (dbResult.found && dbResult.primaryName) ? dbResult.primaryName : candidate.name;
    const stableCin = dbResult.basicInfo?.cin || (candidate as any).cin || undefined;
    const stableId = candidate.id || stableCin || canonicalName;
    const selectedApplicant = { ...applicant, companyName: canonicalName };
    const missing = getRequiredPolicyFields(selectedApplicant);
    const nextField = missing[0] || "monthlyIncome";
    const selectedLiveSources = candidate.liveSource ? [candidate.liveSource] : liveSources;
    const overview = dbResult.overview || liveOverview(selectedLiveSources) || `${canonicalName} is verified as an active employer in the corporate registry.`;

    const candidateObj = {
      id: stableId,
      name: canonicalName,
      cin: stableCin,
      source: candidate.source || ("database" as const),
    };

    const companyData = {
      company_id: stableId,
      company_name: canonicalName,
      cin: stableCin,
      overview,
      basic_info: dbResult.basicInfo,
      financial_info: dbResult.financialInfo,
      bank_records: dbResult.bankRecords,
      live_sources: selectedLiveSources,
      needs_disambiguation: false,
    };

    const companyContent = formatCompanyResponse({ ...dbResult, primaryName: canonicalName, overview });
    const isLoanContext = Boolean(session?.in_eligibility_flow || session?.mainUserGoal === "PERSONAL_LOAN");
    const nextStepText = isLoanContext
      ? `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`
      : "Would you like to apply for a loan or calculate your eligibility?";
    const responseContent = `${companyContent}\n\n${nextStepText}`;

    await saveEligibilityState(conversationId, {
      ...session,
      applicant: selectedApplicant,
      expectedField: nextField,
      missingFields: missing,
      in_eligibility_flow: true,
      activeFlow: "LOAN_ELIGIBILITY",
      mainUserGoal: "PERSONAL_LOAN",
      companyFlow: {
        stage: "ELIGIBILITY_INPUT",
        originalInput: flow?.originalInput || input,
        normalizedCompany: canonicalName,
        selectedCompanyId: stableId,
        selectedCompanyName: canonicalName,
        selectedCompany: canonicalName,
        selectedCompanyCin: stableCin,
        companyCandidate: candidateObj,
        candidates: flow?.candidates || [candidateObj],
        companyData,
      },
      selectedCompanyId: stableId,
      selectedCompanyName: canonicalName,
      selectedCompany: canonicalName,
      selectedCompanyCin: stableCin,
      companyCandidate: candidateObj,
      updatedAt: Date.now(),
    });

    return {
      reply: sideQAnswer ? `${companyContent}\n\n---\n\n${sideQAnswer}\n\n${nextStepText}` : responseContent,
      companyData,
      companyQuery: canonicalName,
    };
  }

  // Fallback to explicit confirmation if not exact match
  await saveEligibilityState(conversationId, {
    ...session,
    applicant,
    expectedField: "companyName",
    missingFields: getRequiredPolicyFields(applicant),
    in_eligibility_flow: true,
    companyFlow: {
      stage: "COMPANY_CONFIRMATION",
      originalInput: input,
      normalizedCompany: candidate.name,
      candidates: [candidate],
    },
    updatedAt: Date.now(),
  });

  const confirmationPrompt = `Please confirm if this is your employer:\n\n**${candidate.name}** *(Verified Partner Employer)*\n\nReply **Yes** to confirm, or enter your exact company name if different.`;

  return {
    reply: sideQAnswer ? `${sideQAnswer}\n\n---\n\n${confirmationPrompt}` : confirmationPrompt,
    companyData: {
      company_flow: "COMPANY_CONFIRMATION",
      typo_suggestion: candidate,
      candidates: [candidate],
      live_sources: liveSources,
    },
  };
}

/**
 * Checks for administrative credential inquiries or explicit/unsafe content.
 * Guarantees zero credential exposure and strictly prevents inappropriate requests
 * from routing into financial/banking tools.
 */
function checkSecurityOrSafetyGuard(message: string): { blocked: boolean; reply?: string } {
  const norm = message.toLowerCase().trim();

  // 1. Admin / Credential / Secrets inquiry
  const isCredentialInquiry =
    /(?:admin|root|superuser|database|db|postgres|system|server|backend)\s+(?:password|passwd|creds?|credentials?|secret|token|api\s*key)/i.test(norm) ||
    /(?:what\s+is|give\s+me|tell\s+me|show\s+me|reveal|share|get|provide)\s+(?:the\s+)?(?:admin|root|database|db|postgres)?\s*(?:password|credentials?|login\s+credentials?|api\s*key|jwt|secret\s*key|auth\s*token)/i.test(norm) ||
    /(?:admin\s+password|login\s+credentials|api\s*key|db\s*password|database\s*url|jwt\s*secret)\b/i.test(norm);

  if (isCredentialInquiry) {
    return {
      blocked: true,
      reply: "🔒 **Security Notice**: CreditWise AI strictly protects system security and cannot disclose administrative credentials, passwords, API keys, database connection secrets, or authentication tokens. To manage or reset your account login, please use the official login or profile settings page.",
    };
  }

  // 2. Unsafe / Explicit / Sexual / Harassment content
  const isExplicitOrUnsafe =
    /\b(?:porn|pornography|erotic|nsfw|sex|sexual|nude|nudity|hardcore|blowjob|vagina|penis|boobs|masturbat\w*)\b/i.test(norm) ||
    /\b(?:hack|ddos|exploit|sql\s*injection|drop\s+database|truncate\s+table)\b/i.test(norm);

  if (isExplicitOrUnsafe) {
    return {
      blocked: true,
      reply: "⚠️ I cannot fulfill this request. As CreditWise AI, I assist strictly with loan eligibility assessment, banking policies, EMI calculations, and verified employer evaluations. Please let me know how I can help with your loan or financial needs.",
    };
  }

  return { blocked: false };
}

/**
 * Answers common banking & credit questions accurately and conversationally when user asks mid-conversation
 * or when offline/fallback.
 */
function answerCommonBankingQuestion(userMessage: string, expectedField?: string): string | null {
  const sideQ = detectAndAnswerSideQuestion(userMessage, expectedField);
  if (sideQ.isQuestion && sideQ.answer && sideQ.answer.trim().length > 0) {
    return sideQ.answer.trim();
  }
  return null;
}

export interface ExtractedFieldAwareResult {
  field: string;
  value: any;
  isValid: boolean;
  clarificationPrompt?: string;
}

/**
 * Field-aware entity extractor with authoritative priority for active eligibility steps.
 * Dynamically maps user input according to the expectedField or explicitly identified fields.
 * Validates inputs against banking rules and provides clarification prompts for invalid/ambiguous inputs.
 */
export function extractFieldAwareEntity(
  userMessage: string,
  expectedField: string,
  currentApplicant?: Partial<ApplicantProfile>
): ExtractedFieldAwareResult {
  const norm = userMessage.toLowerCase().trim();

  // 1. Check if user explicitly targeted a different field than expectedField
  const explicitTarget = detectTargetedFieldInMessage(userMessage, expectedField);
  const targetField = explicitTarget || expectedField;

  // 2. AGE
  if (targetField === "age") {
    if (/\b(?:skip|pass|not\s*sure|standard|default|normal)\b/i.test(norm)) {
      return { field: "age", value: 28, isValid: true };
    }
    const explicitAgeMatch =
      userMessage.match(/(?:age\s*is|my\s*age\s*is|i\s*am|i'?m|aged|age\s*[:=-]?)\s*(\d{1,3})/i) ||
      userMessage.match(/(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|years?|yrs?|saal|sal|age)\b/i);
    let ageNum: number | null = null;
    if (explicitAgeMatch) {
      ageNum = parseInt(explicitAgeMatch[1], 10);
    } else {
      const yobMatch = norm.match(/\b(19[5-9]\d|200[0-7])\b/);
      if (yobMatch) {
        const year = parseInt(yobMatch[1], 10);
        const computedAge = 2026 - year;
        if (computedAge >= 18 && computedAge <= 70) {
          return { field: "age", value: computedAge, isValid: true };
        }
      }
      const numMatch = userMessage.match(/\b(\d{1,3})\b/);
      if (numMatch) {
        ageNum = parseInt(numMatch[1], 10);
      }
    }

    if (ageNum !== null) {
      if (ageNum >= 18 && ageNum <= 85) {
        return { field: "age", value: ageNum, isValid: true };
      } else {
        return {
          field: "age",
          value: ageNum,
          isValid: false,
          clarificationPrompt: "Under partner bank policies, eligible applicant age must typically be between 18 and 65 years. Could you please confirm your current age?",
        };
      }
    }
    return {
      field: "age",
      value: null,
      isValid: false,
      clarificationPrompt: "Could you please share your current age in years (e.g. 25) so I can verify partner bank age eligibility criteria?",
    };
  }

  // 3. CIBIL
  if (targetField === "cibil") {
    if (
      /\b(?:no|zero|0|nil|none|unknown|never\s*checked|haven'?t\s*checked|not\s*checked|don'?t\s*know|no\s*idea|not\s*sure|na|n\/a|skip|pass|first\s*time|new\s*to\s*credit|fresh|don'?t\s*have)\b/i.test(norm) ||
      /haven'?t\s*checked|not\s*sure|no\s*score|don'?t\s*remember/i.test(norm)
    ) {
      return { field: "cibil", value: "Not provided", isValid: true };
    }
    if (/\b(?:excellent|very\s*good)\b/i.test(norm)) {
      return { field: "cibil", value: 780, isValid: true };
    }
    if (/\b(?:good)\b/i.test(norm)) {
      return { field: "cibil", value: 740, isValid: true };
    }
    if (/\b(?:average|fair|ok|okay)\b/i.test(norm)) {
      return { field: "cibil", value: 680, isValid: true };
    }
    if (/\b(?:poor|low|bad)\b/i.test(norm)) {
      return { field: "cibil", value: 600, isValid: true };
    }
    const explicitCibilMatch =
      userMessage.match(/(?:cibil|credit\s*score|score)(?:\s*is)?(?:\s*[:=-])?\s*([3-9]\d{2})/i) ||
      userMessage.match(/([3-9]\d{2})\s*(?:cibil|credit\s*score|score)/i);
    let cibilNum: number | null = null;
    if (explicitCibilMatch) {
      cibilNum = parseInt(explicitCibilMatch[1], 10);
    } else {
      const numMatch = userMessage.match(/\b(\d{3})\b/);
      if (numMatch) {
        cibilNum = parseInt(numMatch[1], 10);
      }
    }

    if (cibilNum !== null) {
      if (cibilNum >= 300 && cibilNum <= 900) {
        return { field: "cibil", value: cibilNum, isValid: true };
      } else {
        return {
          field: "cibil",
          value: cibilNum,
          isValid: false,
          clarificationPrompt: "CIBIL scores range from 300 to 900. Could you please share your approximate credit score, or reply 'Not sure' if you haven't checked it?",
        };
      }
    }
    return {
      field: "cibil",
      value: null,
      isValid: false,
      clarificationPrompt: "Could you please provide your approximate CIBIL score (e.g. 750) or reply 'Not sure' to check your eligibility?",
    };
  }

  // 4. LOAN AMOUNT
  if (targetField === "loanAmount") {
    if (/\b(?:skip|pass|not\s*sure|standard|default|normal|any|max|maximum|how\s*much|as\s*much\s*as)\b/i.test(norm)) {
      const defaultAmt = currentApplicant?.monthlyIncome ? Math.min(500000, Number(currentApplicant.monthlyIncome) * 10) : 500000;
      return { field: "loanAmount", value: defaultAmt, isValid: true };
    }
    const parsedLoan = parseFinancialAmount(userMessage);
    if (parsedLoan !== null && parsedLoan >= 10000) {
      return { field: "loanAmount", value: parsedLoan, isValid: true };
    } else if (parsedLoan !== null && parsedLoan < 10000) {
      return {
        field: "loanAmount",
        value: parsedLoan,
        isValid: false,
        clarificationPrompt: "The minimum personal loan amount across partner banks is ₹10,000. Could you please specify how much you wish to borrow?",
      };
    }
    return {
      field: "loanAmount",
      value: null,
      isValid: false,
      clarificationPrompt: "Could you please provide the loan amount you wish to borrow (e.g. ₹5,00,000)?",
    };
  }

  // 5. MONTHLY INCOME
  if (targetField === "monthlyIncome") {
    if (/^(?:0|zero|no\s*income|nil|none)\b/i.test(norm)) {
      return { field: "monthlyIncome", value: 0, isValid: true };
    }
    const lpaMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?\s*per\s*annum|lacs?\s*per\s*annum|lakhs?\s*yearly|lakhs?\s*annual(?:ly)?)/i);
    if (lpaMatch) {
      const annual = parseFloat(lpaMatch[1]) * 100000;
      return { field: "monthlyIncome", value: Math.round(annual / 12), isValid: true };
    }
    const rangeMatch = norm.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*(?:k|thousand|lakhs?)?/i);
    if (rangeMatch) {
      const parsedLow = parseFinancialAmount(rangeMatch[1]);
      const parsedHigh = parseFinancialAmount(rangeMatch[2]);
      if (parsedLow && parsedHigh) {
        return { field: "monthlyIncome", value: Math.round((parsedLow + parsedHigh) / 2), isValid: true };
      }
    }
    if (/\b(?:skip|pass|not\s*sure|standard|benchmark)\b/i.test(norm)) {
      return { field: "monthlyIncome", value: 50000, isValid: true };
    }
    const parsedIncome = parseFinancialAmount(userMessage);
    if (parsedIncome !== null && parsedIncome >= 0) {
      return { field: "monthlyIncome", value: parsedIncome, isValid: true };
    }
    return {
      field: "monthlyIncome",
      value: null,
      isValid: false,
      clarificationPrompt: "Could you please share your net monthly take-home salary (e.g. ₹50,000)?",
    };
  }

  // 6. TENURE MONTHS
  if (targetField === "tenureMonths") {
    if (/\b(?:skip|pass|not\s*sure|standard|default|normal|any|flexible)\b/i.test(norm)) {
      return { field: "tenureMonths", value: 36, isValid: true };
    }
    if (/\b(?:max|maximum|longest)\b/i.test(norm)) {
      return { field: "tenureMonths", value: 60, isValid: true };
    }
    if (/\b(?:min|minimum|shortest)\b/i.test(norm)) {
      return { field: "tenureMonths", value: 12, isValid: true };
    }
    const yMatch = userMessage.match(/(\d+)\s*(?:years?|yrs?|y\b|saal|sal)/i);
    if (yMatch) {
      const y = parseInt(yMatch[1], 10);
      if (y > 0 && y <= 30) {
        return { field: "tenureMonths", value: y * 12, isValid: true };
      }
    }
    const mMatch = userMessage.match(/(\d+)\s*(?:months?|m\b)/i);
    if (mMatch) {
      const m = parseInt(mMatch[1], 10);
      if (m > 0 && m <= 360) {
        return { field: "tenureMonths", value: m, isValid: true };
      }
    }
    const numMatch = userMessage.match(/\b(\d+)\b/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      if (n >= 1 && n <= 7) {
        return { field: "tenureMonths", value: n * 12, isValid: true };
      } else if (n >= 12 && n <= 360) {
        return { field: "tenureMonths", value: n, isValid: true };
      }
    }
    return {
      field: "tenureMonths",
      value: null,
      isValid: false,
      clarificationPrompt: "Could you please specify your preferred loan tenure in years or months (e.g. 3 years or 36 months)?",
    };
  }

  // 7. EXISTING EMI
  if (targetField === "existingEmi") {
    if (
      /^(?:no|none|nil|zero|0|nothing|nope|clear|sab\s*clear|na|n\/a|skip|pass|not\s*sure|don'?t\s*have|no\s*loans?)\b/i.test(norm) ||
      /\b(?:no|zero|0|nil|none)\s*(?:existing\s*)?emi/i.test(norm) ||
      /\b(?:no|zero|nil|0|none)\s*(?:existing\s*|ongoing\s*|current\s*)?loans?/i.test(norm) ||
      /zero\s*debt|sab\s*clear|no\s*debt|no\s*loans?|don'?t\s*have\s*(?:any)?|all\s*clear/i.test(norm)
    ) {
      return { field: "existingEmi", value: 0, isValid: true };
    }
    const emiAmt = parseFinancialAmount(userMessage);
    if (emiAmt !== null && emiAmt >= 0) {
      return { field: "existingEmi", value: emiAmt, isValid: true };
    }
    return {
      field: "existingEmi",
      value: null,
      isValid: false,
      clarificationPrompt: "Could you please state your total current monthly EMIs (or reply '0' if you have none)?",
    };
  }

  // Secondary Cross-Field Fallback: If targetField could not be parsed, check if user provided ANY other field!
  const allOtherFields = ["loanAmount", "monthlyIncome", "tenureMonths", "cibil", "age", "existingEmi"].filter(
    (f) => f !== targetField
  );

  for (const altField of allOtherFields) {
    if (altField === "tenureMonths") {
      const yMatch = userMessage.match(/(\d+)\s*(?:years?|yrs?|saal|sal)/i);
      const mMatch = userMessage.match(/(\d+)\s*(?:months?|m\b)/i);
      if (yMatch) {
        const y = parseInt(yMatch[1], 10);
        if (y > 0 && y <= 30) return { field: "tenureMonths", value: y * 12, isValid: true };
      }
      if (mMatch) {
        const m = parseInt(mMatch[1], 10);
        if (m > 0 && m <= 360) return { field: "tenureMonths", value: m, isValid: true };
      }
    }
    if (altField === "cibil") {
      const explicitCibilMatch =
        userMessage.match(/(?:cibil|credit\s*score|score)(?:\s*is)?(?:\s*[:=-])?\s*([3-9]\d{2})/i) ||
        userMessage.match(/([3-9]\d{2})\s*(?:cibil|credit\s*score|score)/i);
      if (explicitCibilMatch) {
        const cNum = parseInt(explicitCibilMatch[1], 10);
        if (cNum >= 300 && cNum <= 900) return { field: "cibil", value: cNum, isValid: true };
      }
    }
    if (altField === "age") {
      const explicitAgeMatch =
        userMessage.match(/(?:age\s*is|my\s*age\s*is|i\s*am|i'?m|aged|age\s*[:=-]?)\s*(\d{1,3})/i) ||
        userMessage.match(/(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|saal)\b/i);
      if (explicitAgeMatch) {
        const aNum = parseInt(explicitAgeMatch[1], 10);
        if (aNum >= 18 && aNum <= 85) return { field: "age", value: aNum, isValid: true };
      }
    }
    if (altField === "existingEmi") {
      if (/\b(?:no|zero|0|nil)\s*emi|zero\s*debt|sab\s*clear|no\s*debt/i.test(norm)) {
        return { field: "existingEmi", value: 0, isValid: true };
      }
    }
    if (altField === "loanAmount") {
      if (/(?:need|want|borrow|loan\s*amount)\s*(?:rs\.?|₹)?\s*[\d,]+\s*(?:k|lakhs?|lacs?|l\b|cr)/i.test(norm)) {
        const parsed = parseFinancialAmount(userMessage);
        if (parsed && parsed >= 10000) return { field: "loanAmount", value: parsed, isValid: true };
      }
    }
    if (altField === "monthlyIncome") {
      if (/(?:salary|monthly\s*income|take\s*home|in\s*hand)\s*(?:is|around|:)?\s*[\d,]+/i.test(norm)) {
        const parsed = parseFinancialAmount(userMessage);
        if (parsed && parsed >= 5000) return { field: "monthlyIncome", value: parsed, isValid: true };
      }
    }
  }

  return {
    field: targetField,
    value: null,
    isValid: false,
    clarificationPrompt: `Could you please provide your ${targetField}?`,
  };
}

/**
 * Prints the 7 required debug lines on every turn.
 */
export function printRouterDebug(info: {
  currentStep: string;
  expectedField: string;
  userMessage: string;
  extractedEntity: any;
  routedHandler: string;
  updatedEligibilityState: any;
  nextStep: string;
}) {
  console.log(`CURRENT STEP: ${info.currentStep}`);
  console.log(`EXPECTED FIELD: ${info.expectedField}`);
  console.log(`USER MESSAGE: ${info.userMessage}`);
  console.log(
    `EXTRACTED ENTITY: ${
      typeof info.extractedEntity === "object" && info.extractedEntity !== null
        ? JSON.stringify(info.extractedEntity)
        : info.extractedEntity ?? "null"
    }`
  );
  console.log(`ROUTED HANDLER: ${info.routedHandler}`);
  console.log(
    `UPDATED ELIGIBILITY STATE: ${
      typeof info.updatedEligibilityState === "object" && info.updatedEligibilityState !== null
        ? JSON.stringify(info.updatedEligibilityState)
        : info.updatedEligibilityState ?? "{}"
    }`
  );
  console.log(`NEXT STEP: ${info.nextStep}`);
}

/**
 * Extracts previously established loan amount across session variables, applicant profile,
 * and multi-turn conversation history.
 */
function getExistingLoanAmount(
  eligibilitySession: SessionState | undefined,
  currentApplicant: ApplicantProfile,
  conversationHistory?: Array<{ role: string; content: string }>
): number | undefined {
  if (eligibilitySession?.confirmedLoanAmount && Number(eligibilitySession.confirmedLoanAmount) > 0) {
    return Number(eligibilitySession.confirmedLoanAmount);
  }
  if (eligibilitySession?.sessionVariables?.requestedAmount && Number(eligibilitySession.sessionVariables.requestedAmount) > 0) {
    return Number(eligibilitySession.sessionVariables.requestedAmount);
  }
  if (eligibilitySession?.sessionVariables?.Requested_Loan_Amount && Number(eligibilitySession.sessionVariables.Requested_Loan_Amount) > 0) {
    return Number(eligibilitySession.sessionVariables.Requested_Loan_Amount);
  }
  if (currentApplicant.loanAmount && Number(currentApplicant.loanAmount) > 0) {
    return Number(currentApplicant.loanAmount);
  }
  if (eligibilitySession?.applicant?.loanAmount && Number(eligibilitySession.applicant.loanAmount) > 0) {
    return Number(eligibilitySession.applicant.loanAmount);
  }
  if (eligibilitySession?.referencedEntities?.lastMentionedAmount && Number(eligibilitySession.referencedEntities.lastMentionedAmount) > 0) {
    return Number(eligibilitySession.referencedEntities.lastMentionedAmount);
  }
  if (conversationHistory && conversationHistory.length > 0) {
    const hist = extractParametersFromConversationHistory(conversationHistory);
    if (hist.requestedAmount && hist.requestedAmount > 0) {
      return hist.requestedAmount;
    }
  }
  return undefined;
}

/**
 * Summarizes bank policy highlights into max 4-6 pointwise bullets (Rule 2: Trim Token Overhead).
 */
export function summarizePolicyHighlightsIntoBullets(policyMarkdown: string, bankName: string): string {
  if (!policyMarkdown || !policyMarkdown.trim()) return "";

  const lines = policyMarkdown.split("\n").map((l) => l.trim()).filter(Boolean);
  const bulletLines: string[] = [];

  for (const line of lines) {
    if (/^(?:[-*•]|\d+\.)\s+(.+)$/.test(line)) {
      const bullet = line.replace(/^(?:[-*•]|\d+\.)\s+/, "").trim();
      if (
        bullet.length > 5 &&
        !bullet.toLowerCase().startsWith("note:") &&
        !bullet.toLowerCase().startsWith("disclaimer:") &&
        !bullet.toLowerCase().startsWith("based on")
      ) {
        bulletLines.push(bullet);
      }
    }
  }

  if (bulletLines.length >= 2) {
    const selected = bulletLines.slice(0, 6);
    return (
      `#### 2. Key Policy Highlights (${bankName})\n` +
      selected.map((b) => (b.startsWith("*") ? b : `* ${b}`)).join("\n")
    );
  }

  const cleanText = policyMarkdown.replace(/^#+.*$/gm, "").trim();
  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 15 &&
        !s.toLowerCase().startsWith("based on") &&
        !s.toLowerCase().startsWith("here is")
    );

  if (sentences.length > 0) {
    const selected = sentences.slice(0, 5);
    return (
      `#### 2. Key Policy Highlights (${bankName})\n` +
      selected.map((s) => `* ${s}`).join("\n")
    );
  }

  return policyMarkdown;
}

/**
 * Strips robotic introductory filler or conversational setups to lead directly
 * with the requested table, math answer, or primary data point (Rule 1: Concise Output Directive).
 */
export function sanitizeConciseResponse(text: string): string {
  if (!text || typeof text !== "string") return text;
  let cleaned = text.trim();

  cleaned = cleaned.replace(
    /^(?:(?:Here\s+(?:is|are)\s+(?:your\s+|the\s+)?(?:calculation|breakdown|assessment|eligibility\s+report|summary|estimate|information|results|details|policy\s+highlights)[:.]?\s*)|(?:Sure(?:!|,|\.)?\s*(?:I\s+can\s+(?:help|assist)(?:\s+you)?\s+with\s+that[:.]?\s*)?)|(?:Certainly(?:!|,|\.)?\s*(?:I\s+can\s+(?:help|assist)(?:\s+you)?\s+with\s+that[:.]?\s*)?)|(?:Of\s+course(?:!|,|\.)?\s*)|(?:Based\s+on\s+your\s+request(?:,|:)?\s*)|(?:I(?:'d|\s+would)\s+be\s+happy\s+to\s+help(?:(?:\s+you)?\s+with\s+that)?[:.]?\s*))+/i,
    ""
  ).trim();

  return cleaned;
}

/**
 * Runs the deterministic policy and eligibility evaluation when transitioning to a bank.
 * Follows the critical execution order:
 * 1. Calculation Breakdown & Approved Terms FIRST
 * 2. Parameters Applied SECOND
 * 3. Next Steps / Comparison LAST
 */
async function executeBankTransitionEvaluation(
  targetBank: string,
  effectiveLoanAmount: number,
  currentApplicant: ApplicantProfile,
  sessionVariables: Record<string, any>,
  requestedModel?: string,
  queryType?: "POLICY" | "ELIGIBILITY",
  originalUserMessage?: string
): Promise<string> {
  const tenure = currentApplicant.tenureMonths || sessionVariables.tenureMonths || 60;
  const benchmarkRoi = 10.5;
  const monthlyEmi = calculateEmi(effectiveLoanAmount, benchmarkRoi, tenure);
  const totalPayment = monthlyEmi * tenure;
  const totalInterest = Math.max(0, totalPayment - effectiveLoanAmount);

  // If user has salary and other profile parameters, run deterministic policy engine
  let evalMarkdown = "";
  if (currentApplicant.monthlyIncome || sessionVariables.monthlyIncome) {
    try {
      evalMarkdown = await evaluateEligibilityFromTool({
        bankName: targetBank,
        loanAmount: effectiveLoanAmount,
        salary: currentApplicant.monthlyIncome || sessionVariables.monthlyIncome,
        cibil: currentApplicant.cibil !== undefined ? currentApplicant.cibil : (sessionVariables.cibilScore !== undefined ? sessionVariables.cibilScore : 700),
        tenureMonths: tenure,
        age: currentApplicant.age || sessionVariables.age || 30,
        existingEmi: currentApplicant.existingEmi !== undefined ? currentApplicant.existingEmi : (sessionVariables.existingEmi !== undefined ? sessionVariables.existingEmi : 0),
        companyName: currentApplicant.companyName || sessionVariables.employer,
      });
    } catch (e) {
      console.warn("[Bank Transition Tool Eval Error]:", e);
    }
  }

  // If queryType was POLICY, or if user originally asked for bank policy rules
  let policyMarkdown = "";
  if (queryType === "POLICY" && originalUserMessage) {
    try {
      policyMarkdown = await answerBankPolicyWithMasterPolicy(targetBank, originalUserMessage, requestedModel);
    } catch (e) {
      console.warn("[Bank Transition Policy Error]:", e);
    }
  }

  let finalReply = "";

  if (evalMarkdown && evalMarkdown.trim()) {
    finalReply = evalMarkdown;
    if (policyMarkdown && policyMarkdown.trim()) {
      const condensedPolicy = summarizePolicyHighlightsIntoBullets(policyMarkdown, targetBank);
      finalReply += `\n\n${condensedPolicy}`;
    }
  } else if (policyMarkdown && policyMarkdown.trim()) {
    const condensedPolicy = summarizePolicyHighlightsIntoBullets(policyMarkdown, targetBank);
    finalReply =
      `### 🏦 ${targetBank} — Personal Loan Policy & Calculations\n\n` +
      `#### 1. Calculation Breakdown (Loan Amount: ₹${effectiveLoanAmount.toLocaleString("en-IN")})\n` +
      `| Metric | Amount |\n` +
      `| :--- | :--- |\n` +
      `| **Requested Loan Amount** | **₹${effectiveLoanAmount.toLocaleString("en-IN")}** |\n` +
      `| **Indicative Monthly EMI** | **₹${monthlyEmi.toLocaleString("en-IN")}/month** |\n` +
      `| **Total Interest Payable** | **₹${totalInterest.toLocaleString("en-IN")}** |\n` +
      `| **Benchmark Interest Rate** | **${benchmarkRoi}% p.a.** |\n` +
      `| **Tenure** | **${tenure} months (${(tenure / 12).toFixed(1)} years)** |\n\n` +
      condensedPolicy;
  } else {
    finalReply =
      `### 🏦 ${targetBank} — Loan Assessment\n\n` +
      `#### 1. Calculation Breakdown (Loan Amount: ₹${effectiveLoanAmount.toLocaleString("en-IN")})\n` +
      `| Metric | Amount |\n` +
      `| :--- | :--- |\n` +
      `| **Requested Loan Amount** | **₹${effectiveLoanAmount.toLocaleString("en-IN")}** |\n` +
      `| **Indicative Monthly EMI** | **₹${monthlyEmi.toLocaleString("en-IN")}/month** |\n` +
      `| **Total Interest Payable** | **₹${totalInterest.toLocaleString("en-IN")}** |\n` +
      `| **Benchmark Interest Rate** | **${benchmarkRoi}% p.a.** |\n` +
      `| **Tenure** | **${tenure} months (${(tenure / 12).toFixed(1)} years)** |\n\n` +
      `#### 2. Parameters Applied\n` +
      `* **Target Lender**: ${targetBank}\n` +
      `* **Principal Amount (P)**: ₹${effectiveLoanAmount.toLocaleString("en-IN")}\n` +
      `* **Repayment Tenure (N)**: ${tenure} months\n` +
      `* **Annual Interest Rate (R)**: ${benchmarkRoi}% p.a.\n`;
  }

  if (!currentApplicant.monthlyIncome && !sessionVariables.monthlyIncome) {
    finalReply += `\n\nTo complete your formal loan approval and check exact FOIR eligibility with **${targetBank}**, what is your net monthly take-home salary or income (e.g., ₹75,000)?`;
  } else {
    finalReply += `\n\n#### Next Steps\nWould you like to connect with an official branch manager for **${targetBank}**, or compare with other eligible partner banks?`;
  }

  return finalReply;
}

/**
 * Main CreditWise AI Central Agent.
 * Fully LLM-driven for conversation understanding.
 * Analyzes current message together with multi-turn conversation context.
 * Understands user intent, extracts/updates details, answers questions directly,
 * and asks ONLY for genuinely missing required information.
 * Preserves deterministic eligibility engine, bank policies, and calculations.
 */
export async function runCentralAgent(opts: {
  message: string;
  conversationId: string;
  model?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  companySelectionAction?: CompanySelectionAction;
  currentTime?: string;
  systemPrompt?: string;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}): Promise<AgentResult> {
  if (opts.onToken) {
    let tokensStreamed = 0;
    const trackedOnToken = (token: string) => {
      tokensStreamed++;
      opts.onToken!(token);
    };
    return agentTokenStorage.run(trackedOnToken, async () => {
      const result = await runCentralAgentInternal({
        ...opts,
        onToken: trackedOnToken,
        _getTokensStreamed: () => tokensStreamed,
      } as any);

      if ((tokensStreamed === 0 || (tokensStreamed === 1 && result.reply.length > 200)) && result.reply && result.reply.trim().length > 0) {
        const chunks = result.reply.split(/(\s+)/);
        const delay = chunks.length > 300 ? 3 : (chunks.length > 100 ? 6 : 10);
        for (const chunk of chunks) {
          if (chunk) {
            trackedOnToken(chunk);
            if (opts.signal?.aborted) break;
            await new Promise((r) => setTimeout(r, chunk.trim() ? delay : 2));
          }
        }
      }

      return result;
    });
  }
  return runCentralAgentInternal(opts);
}

async function runCentralAgentInternal(opts: {
  message: string;
  conversationId: string;
  model?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  companySelectionAction?: CompanySelectionAction;
  currentTime?: string;
  systemPrompt?: string;
  onToken?: (token: string) => void;
}): Promise<AgentResult> {
  const { message, conversationId, model: requestedModel, companySelectionAction, currentTime: optsCurrentTime, systemPrompt: optsSystemPrompt } = opts;
  let { conversationHistory } = opts;
  const rawUserMessage = String(message || (opts as any).userMessage || "").trim();
  // Truncate incoming user messages to a maximum of 2,000 characters (~500 tokens)
  const userMessage = rawUserMessage.slice(0, 2000);
  const norm = userMessage.toLowerCase().replace(/\s+/g, " ").trim();

  const currentTime = optsCurrentTime || new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // 0. Early Security & Safety Guard (Credentials, Secrets, Explicit Content)
  const securityCheck = checkSecurityOrSafetyGuard(userMessage);
  if (securityCheck.blocked) {
    return { reply: securityCheck.reply || "⚠️ Request cannot be processed." };
  }

  // 0b. Strict CreditWise Domain Guard:
  // "Talk like ChatGPT, understand like ChatGPT, remember like ChatGPT within the current chat, but only help with CreditWise/AI Finance."
  const domainCheck = isOutOfDomainRequest(userMessage);
  if (domainCheck.isOutOfDomain && domainCheck.redirectReply) {
    return { reply: domainCheck.redirectReply };
  }

  // 1 & 2. Concurrent retrieval of conversation history & unified conversation state via Promise.all
  const numConvId = Number(conversationId);
  const needsHistoryFetch = (!conversationHistory || conversationHistory.length === 0) && Boolean(pool && Number.isFinite(numConvId));

  const [historyResult, conversationContext] = await Promise.all([
    needsHistoryFetch
      ? pool.query(
          `SELECT role, content FROM assistant_messages
           WHERE conversation_id = $1
           ORDER BY id ASC`,
          [numConvId]
        ).catch((histErr) => {
          console.warn("Could not load conversation history in runCentralAgent:", histErr);
          return { rows: [] };
        })
      : Promise.resolve({ rows: [] }),
    getConversationContext(conversationId, {
      conversationHistory,
      userMessage,
    }),
  ]);

  if (needsHistoryFetch && historyResult?.rows?.length) {
    const allRows = historyResult.rows;
    const priorRows =
      allRows.length > 0 && allRows[allRows.length - 1].content === userMessage
        ? allRows.slice(0, -1)
        : allRows;
    conversationHistory = priorRows.map((r: any) => ({
      role: r.role === "assistant" || r.role === "ai" ? "assistant" : "user",
      content: r.content,
    }));
  }

  // Ensure conversationHistory represents strictly prior dialogue turns and cap to last 30 messages (15 turns)
  if (conversationHistory && conversationHistory.length > 0) {
    const lastItem = conversationHistory[conversationHistory.length - 1];
    if (
      (lastItem.role === "user" || lastItem.role === "human") &&
      lastItem.content.trim() === userMessage.trim()
    ) {
      conversationHistory = conversationHistory.slice(0, -1);
    }
    if (conversationHistory.length > 30) {
      conversationHistory = conversationHistory.slice(-30);
    }
  }

  const eligibilitySession = conversationContext.state;
  if (
    (!conversationHistory || conversationHistory.length === 0) &&
    eligibilitySession?.conversationHistory &&
    eligibilitySession.conversationHistory.length > 0
  ) {
    conversationHistory = eligibilitySession.conversationHistory.slice(-30);
  }
  const isEligibleFlowActive = !!(
    eligibilitySession &&
    eligibilitySession.activeFlow !== "COMPANY_SEARCH" &&
    eligibilitySession.in_eligibility_flow !== false &&
    !eligibilitySession.hasCompletedEvaluation &&
    !eligibilitySession.evaluationCompleted &&
    (eligibilitySession.expectedField ||
      (eligibilitySession.missingFields && eligibilitySession.missingFields.length > 0) ||
      (eligibilitySession as any).in_eligibility_flow)
  );

  const currentApplicant: ApplicantProfile = consolidateApplicantProfileFromHistory(
    conversationHistory,
    userMessage,
    eligibilitySession?.applicant
  );

  if (eligibilitySession?.sessionVariables?.awaitingEmployerConfirmation && /^\s*(?:option\s+|opt\s+|#|no\.?\s*)?\d+\s*$/i.test(userMessage)) {
    if (!eligibilitySession.sessionVariables.tenureMonths && !eligibilitySession.applicant?.tenureMonths) {
      delete (currentApplicant as any).tenureMonths;
    }
    if (eligibilitySession.sessionVariables.existingEmi === undefined && eligibilitySession.applicant?.existingEmi === undefined) {
      delete (currentApplicant as any).existingEmi;
    }
    if (!eligibilitySession.sessionVariables.monthlyIncome && !eligibilitySession.applicant?.monthlyIncome) {
      delete (currentApplicant as any).monthlyIncome;
    }
    if (!eligibilitySession.sessionVariables.requestedAmount && !eligibilitySession.applicant?.loanAmount) {
      delete (currentApplicant as any).loanAmount;
    }
  }

  // Scan conversationHistory for previously stated parameters (Rule 1: CHECK EXISTING STATE FIRST)
  const historyParams = extractParametersFromConversationHistory(conversationHistory);
  if (historyParams.requestedAmount && !currentApplicant.loanAmount) {
    currentApplicant.loanAmount = historyParams.requestedAmount;
  }
  if (historyParams.monthlyIncome && !currentApplicant.monthlyIncome) {
    currentApplicant.monthlyIncome = historyParams.monthlyIncome;
  }
  if (historyParams.tenureMonths && !currentApplicant.tenureMonths) {
    currentApplicant.tenureMonths = historyParams.tenureMonths;
  }
  if (historyParams.cibilScore !== undefined && currentApplicant.cibil === undefined) {
    currentApplicant.cibil = historyParams.cibilScore;
  }
  if (historyParams.age && !currentApplicant.age) {
    currentApplicant.age = historyParams.age;
  }
  if (historyParams.employer && !currentApplicant.companyName) {
    currentApplicant.companyName = historyParams.employer;
  }
  if (!currentApplicant.companyName) {
    const sessionComp =
      eligibilitySession?.company ||
      eligibilitySession?.selectedCompanyName ||
      eligibilitySession?.companyFlow?.selectedCompanyName ||
      eligibilitySession?.employerConfirmationQuery ||
      eligibilitySession?.companyFlow?.originalInput ||
      eligibilitySession?.sessionVariables?.employer ||
      eligibilitySession?.sessionVariables?.Employer_Name;
    if (sessionComp && !isMissingOrPlaceholderCompany(sessionComp)) {
      currentApplicant.companyName = sessionComp;
    }
  }
  if (historyParams.existingEmi !== undefined && currentApplicant.existingEmi === undefined) {
    currentApplicant.existingEmi = historyParams.existingEmi;
  }

  let needsPromptForNewCompany = false;
  const canonicalSelectedCompany = eligibilitySession?.selectedCompanyName || eligibilitySession?.companyFlow?.selectedCompanyName;
  const isExplicitCompanyChangeInMsg = /(?:(?:change|changed|update|updated|correct|switch|switched|move|moved|leave|left|joined|join|got\s+a\s+new)\s+(?:my\s+)?(?:company|employer|job|workplace)|\b(?:switch(?:ed)?\s+to|moved?\s+to|joined|now\s+working\s+at|new\s+(?:company|employer|job)\s+is)\b|\b(?:another|different|new)\s+(?:company|employer)\b|check\s*(?:the\s*)?eligibility\s*using\s*another\s*company)/i.test(userMessage);

  if (isExplicitCompanyChangeInMsg) {
    if (eligibilitySession) {
      eligibilitySession.selectedCompanyName = undefined;
      eligibilitySession.company = undefined;
      eligibilitySession.companyCategory = undefined;
      if (eligibilitySession.companyFlow) {
        eligibilitySession.companyFlow.selectedCompanyName = undefined;
        eligibilitySession.companyFlow.normalizedCompany = undefined;
        eligibilitySession.companyFlow.companyData = undefined;
      }
      if (eligibilitySession.sessionVariables) {
        eligibilitySession.sessionVariables.employer = undefined;
        eligibilitySession.sessionVariables.Employer_Name = undefined;
        eligibilitySession.sessionVariables.company = undefined;
      }
    }
    currentApplicant.companyName = undefined;
    currentApplicant.companyCategory = undefined;

    const directCompanyMention = extractTargetCompanyFromMessage(userMessage) || extractApplicantDetails(userMessage).companyName;
    if (!directCompanyMention) {
      needsPromptForNewCompany = true;
    }
  } else if (canonicalSelectedCompany) {
    currentApplicant.companyName = canonicalSelectedCompany;
  }

  // Sanitize company against placeholder defaults ("a home", "Unknown", "Open Market", etc.)
  if (isMissingOrPlaceholderCompany(currentApplicant.companyName)) {
    currentApplicant.companyName = undefined;
  }
  if (isMissingOrPlaceholderCompany(eligibilitySession?.company)) {
    if (eligibilitySession) eligibilitySession.company = undefined;
  }
  if (isMissingOrPlaceholderCompany(eligibilitySession?.selectedCompanyName)) {
    if (eligibilitySession) eligibilitySession.selectedCompanyName = undefined;
  }
  if (!currentApplicant.companyName && eligibilitySession?.company && !isMissingOrPlaceholderCompany(eligibilitySession.company)) {
    currentApplicant.companyName = eligibilitySession.company;
  }
  if (!currentApplicant.companyCategory && eligibilitySession?.companyCategory) {
    currentApplicant.companyCategory = eligibilitySession.companyCategory;
  }

  const currentMissingFields = getRequiredPolicyFields(currentApplicant);

  // Central Invariant & State Finalizer (Pipeline Stage 10 & 11)
  const finalizeAndReturn = async (
    res: AgentResult,
    customState?: Partial<SessionState>
  ): Promise<AgentResult> => {
    let canonicalCompany =
      customState?.company ||
      customState?.selectedCompanyName ||
      customState?.applicant?.companyName ||
      eligibilitySession?.company ||
      eligibilitySession?.selectedCompanyName ||
      eligibilitySession?.companyFlow?.selectedCompanyName ||
      currentApplicant.companyName;

    if (isMissingOrPlaceholderCompany(canonicalCompany)) {
      canonicalCompany = undefined;
    }

    const mergedApplicant = customState?.applicant
      ? safeMergeApplicantProfile(currentApplicant, customState.applicant)
      : currentApplicant;

    if (canonicalCompany && !isExplicitCompanyChangeInMsg) {
      currentApplicant.companyName = canonicalCompany;
      mergedApplicant.companyName = canonicalCompany;
    } else if (!canonicalCompany) {
      currentApplicant.companyName = undefined;
      mergedApplicant.companyName = undefined;
    }

    const canonicalCategory =
      customState?.companyCategory ||
      customState?.applicant?.companyCategory ||
      eligibilitySession?.companyCategory ||
      eligibilitySession?.applicant?.companyCategory ||
      currentApplicant.companyCategory;

    if (canonicalCompany && canonicalCategory) {
      currentApplicant.companyCategory = canonicalCategory;
      mergedApplicant.companyCategory = canonicalCategory;
    } else if (!canonicalCompany) {
      currentApplicant.companyCategory = undefined;
      mergedApplicant.companyCategory = undefined;
    }

    const computedMissingFields = getRequiredPolicyFields(mergedApplicant);

    const baseState: SessionState = {
      ...(eligibilitySession || {}),
      applicant: mergedApplicant,
      missingFields: computedMissingFields,
      in_eligibility_flow: isEligibleFlowActive,
      ...(customState || {}),
      sessionVariables: {
        ...(eligibilitySession?.sessionVariables || {}),
        ...(customState?.sessionVariables || {}),
      },
      company: canonicalCompany,
      companyCategory: canonicalCompany ? canonicalCategory : undefined,
      selectedCompanyName: canonicalCompany,
      selectedCompany: canonicalCompany,
      companyFlow: customState?.companyFlow || eligibilitySession?.companyFlow,
      awaitingEmployerConfirmation: customState?.awaitingEmployerConfirmation ?? eligibilitySession?.awaitingEmployerConfirmation,
      employerConfirmationQuery: customState?.employerConfirmationQuery || eligibilitySession?.employerConfirmationQuery,
      employerConfirmationOptions: customState?.employerConfirmationOptions || eligibilitySession?.employerConfirmationOptions,
      updatedAt: Date.now(),
    } as SessionState;
    baseState.applicant = mergedApplicant;

    if (baseState.in_eligibility_flow && baseState.activeFlow !== "MULTI_BANK_ELIGIBILITY_CHECK" && !baseState.company && baseState.companyFlow?.stage !== "COMPANY_SELECTION" && !baseState.awaitingEmployerConfirmation) {
      baseState.expectedField = "company";
    }

    const invariant = runInvariantSanityChecks(baseState, res.reply, userMessage);
    const finalReply = sanitizeConciseResponse(invariant.correctedReply || res.reply);
    const finalSession = invariant.correctedSession || baseState;
    finalSession.lastAssistantQuestion = finalReply;

    await saveEligibilityState(conversationId, finalSession);

    return {
      ...res,
      reply: finalReply,
    };
  };

  if (needsPromptForNewCompany) {
    return await finalizeAndReturn({
      reply: "Sure! What is the name of the new company or employer you would like to check eligibility for? (e.g., TCS, Infosys, Reliance, Wipro, Accenture, or any other employer)",
    }, {
      expectedField: "company",
      in_eligibility_flow: true,
      currentStep: "COLLECTING_COMPANY",
      company: undefined,
      selectedCompanyName: undefined,
      companyCategory: undefined,
    });
  }

  const normUserMsg = userMessage.toLowerCase().trim();

  // =========================================================================
  // 0c. Conversational Pleasantry & General Assistance Guard
  // (e.g., "how are you", "how are u", "what can you do", "what is your role")
  // =========================================================================
  if (isHowAreYouQuery(userMessage)) {
    const howReply = formatHowAreYouResponse(isEligibleFlowActive);
    return await finalizeAndReturn({ reply: howReply });
  }

  if (isGeneralAssistanceQuery(userMessage)) {
    const helpReply = formatGeneralAssistanceResponse(isEligibleFlowActive);
    return await finalizeAndReturn({ reply: helpReply });
  }

  // =========================================================================
  // TASKSTACK RESUME INTERCEPTOR (StackResume)
  // When user returns to a previously suspended loan evaluation ("resume", "continue loan", etc.)
  // =========================================================================
  const isExplicitResumeCmd = /^(?:resume(?:\s+(?:my\s+)?loan(?:\s*check|\s*eligibility)?)?|continue(?:\s+(?:my\s+)?loan(?:\s*check|\s*eligibility)?)?|go\s*back\s*to\s*(?:my\s*)?loan|let'?s\s*continue(?:\s+(?:my\s+)?loan)?)\b/i.test(normUserMsg);
  if (isExplicitResumeCmd && eligibilitySession?.taskStack && eligibilitySession.taskStack.length > 0) {
    const updatedStack = [...eligibilitySession.taskStack];
    const popped = updatedStack.pop();
    if (popped) {
      const restoredApplicant: ApplicantProfile = {
        ...(popped.applicantSnapshot || {}),
        ...currentApplicant,
      };
      const revalidatedMissing = getRequiredPolicyFields(restoredApplicant);
      const nextMissing = revalidatedMissing[0] || popped.expectedField || "monthlyIncome";
      const bridge = buildContextualEligibilityResumptionBridge(restoredApplicant, nextMissing);
      const resumeReply = `Welcome back! Let's continue your loan eligibility check.${bridge.replace(/^\n\n---\n\*\*Coming back to your loan eligibility check:\*\*/, "")}`;

      return await finalizeAndReturn(
        { reply: resumeReply },
        {
          applicant: restoredApplicant,
          company: restoredApplicant.companyName,
          companyCategory: restoredApplicant.companyCategory,
          selectedCompanyName: restoredApplicant.companyName,
          expectedField: nextMissing,
          missingFields: revalidatedMissing,
          taskStack: updatedStack,
          in_eligibility_flow: true,
          activeFlow: "LOAN_ELIGIBILITY",
        }
      );
    }
  }

  // =========================================================================
  // MASTER GENERAL LOAN ASSISTANCE & CONVERSATIONAL ROUTER
  // Handles:
  // - LOAN_INTRO: "I want a personal loan", "I need a loan" (welcomes, explains services, asks if user wants to evaluate eligibility)
  // - DIFFERENT_LOAN_TYPE: "I need a home loan", "car loan", "business loan" (explains services, suspends task)
  // - OFFERS: "Do you have any offer?", "Any discounts?" (shows offers table)
  // - BANK_PROCESSING: "Can you process a loan for ICICI Bank?" (explains partnership & application help)
  // - APPLICATION_STEPS: "Give me steps to apply for a personal loan" (clear 5-step process)
  // - CONTEXTUAL_ISSUE: "What is the issue?" (explains context from conversation history)
  // =========================================================================
  const loanAssistMatch = isGeneralLoanAssistanceQuery(userMessage);
  if (loanAssistMatch.isMatch) {
    let reply = getGeneralLoanAssistanceReply(loanAssistMatch, {
      isEligibleFlowActive,
      history: conversationHistory,
    });

    if (isEligibleFlowActive) {
      const suspendedTask: TaskStackItem = {
        taskType: "LOAN_ELIGIBILITY",
        expectedField: eligibilitySession?.expectedField,
        missingFields: currentMissingFields,
        applicantSnapshot: { ...(eligibilitySession?.applicant || currentApplicant) },
        timestamp: Date.now(),
        description: `Suspended on ${loanAssistMatch.loanType || loanAssistMatch.type || "general inquiry"}`,
      };
      const updatedStack = [...(eligibilitySession?.taskStack || [])];
      updatedStack.push(suspendedTask);

      // Append subtle, non-intrusive resume hint without asking for employer or slots
      const resumeHint = "\n\n*(Your personal loan eligibility check is paused. You can say \"resume\" or share your details anytime to continue.)*";
      reply += resumeHint;

      return await finalizeAndReturn(
        { reply },
        {
          in_eligibility_flow: false,
          taskStack: updatedStack,
          expectedField: eligibilitySession?.expectedField,
        }
      );
    } else {
      return await finalizeAndReturn(
        { reply },
        {
          in_eligibility_flow: false,
        }
      );
    }
  }

  // =========================================================================
  // DEDICATED COMPANY FOLLOW-UP INTERCEPTOR (Section 4 & ChatGPT Coreference)
  // Queries like "What is its revenue?", "Which industry does it belong to?",
  // "What is its bank category?", "Show its partner-bank records."
  // Resolves the company from conversation context / history without re-prompting.
  // =========================================================================
  const contextCompanyForFollowUp = resolveCompanyFromContext(
    userMessage,
    eligibilitySession,
    conversationHistory
  );
  const companyFollowUpMatch = detectCompanyFollowUp(userMessage, contextCompanyForFollowUp);
  if (companyFollowUpMatch.isFollowUp && contextCompanyForFollowUp) {
    const followUpRes = await executeCompanyFollowUpAnswer(
      companyFollowUpMatch,
      contextCompanyForFollowUp
    );
    if (followUpRes) {
      return await finalizeAndReturn(
        {
          reply: followUpRes.reply,
          companyData: followUpRes.companyData,
          companyQuery: contextCompanyForFollowUp,
        },
        {
          in_eligibility_flow: isEligibleFlowActive,
          company: contextCompanyForFollowUp,
          selectedCompanyName: contextCompanyForFollowUp,
          referencedEntities: {
            ...(eligibilitySession?.referencedEntities || {}),
            lastMentionedCompany: contextCompanyForFollowUp,
          },
          sessionVariables: {
            ...(eligibilitySession?.sessionVariables || {}),
            employer: contextCompanyForFollowUp,
            Employer_Name: contextCompanyForFollowUp,
          },
        }
      );
    }
  }

  // =========================================================================
  // DEDICATED BANK / POLICY AVAILABILITY INTERCEPTOR (Bug 2 & Bug 4)
  // Queries like "tell me available banks", "which banks have policy available?",
  // "what banks are available?", "show available partner banks", "is Bandhan Bank policy available?"
  // must return directly from the database registry and STOP without calling searchCompany() or Incraax.
  // =========================================================================
  const bankAvailCheck = isBankAvailabilityQuery(userMessage);
  if (bankAvailCheck.isAvailableBanksList) {
    const listReply = await formatAvailablePolicyBanksList();
    return {
      reply: listReply,
    };
  }

  if (bankAvailCheck.isSpecificBankAvailability && bankAvailCheck.bankName) {
    const target = await resolvePolicyTarget(bankAvailCheck.bankName);
    if (target) {
      return {
        reply:
          `### 🏦 Bank Policy Available: **${target.bankName}**\n\n` +
          `Yes, the loan policy for **${target.bankName}** is **actively stored and available** in our platform.\n\n` +
          `You can ask about:\n` +
          `- **CIBIL Score Requirements** (cutoffs & bureau inquiry rules)\n` +
          `- **Minimum Salary & Net Take-Home (NTH)** across company categories\n` +
          `- **Company Categories (CAT A/B/C/D)** & listed status rules\n` +
          `- **Maximum Loan Amount & Tenure**\n` +
          `- **Required Documents, FOIR & ROI Guidelines**`,
        bankData: { bank_name: target.bankName },
      };
    } else {
      const unavailReply = await formatBankPolicyNotAvailableResponse(bankAvailCheck.bankName);
      return {
        reply: unavailReply,
      };
    }
  }

  // =========================================================================
  // DEDICATED BANK POLICY COMPARISON INTERCEPTOR
  // Handles queries like:
  // - "Are both requirements the same?"
  // - "Compare Axis Bank and Axis Finance"
  // - "What is the difference between HDFC and ICICI?"
  // =========================================================================
  const bankCompCheck = !isMultiBankEligibilityQuery(userMessage)
    ? isBankComparisonQuery(userMessage, conversationHistory)
    : { isComparison: false, banks: [] };

  if (bankCompCheck.isComparison && bankCompCheck.banks.length >= 2) {
    const compReply = await handleBankPolicyComparison(
      userMessage,
      bankCompCheck.banks,
      conversationHistory,
      requestedModel
    );
    return {
      reply: compReply,
    };
  }

  // =========================================================================
  // DEDICATED DOCUMENT REQUIREMENTS INTERCEPTOR
  // User Rule: "if user ask for document then only show the document dont show other detils
  // but show details in tablular format mostly like policy , required document companrison etc"
  // =========================================================================
  const isDocumentAsk =
    /\b(?:doc|docs|document|documents|paperwork|kyc|statement\s*requirements?|payslip\s*requirements?|checklist)\b/i.test(normUserMsg) &&
    !/(?:i\s*want\s*to\s*apply|my\s*salary\s*is|my\s*cibil\s*is|i\s*am\s*working\s*at|apply\s+now|start\s+application)/i.test(normUserMsg) &&
    !/\b(?:salary|income)\s*(?:is|of)?\s*(?:₹|rs\.?)?\s*[\d,]+/i.test(normUserMsg);

  if (isDocumentAsk) {
    const isTopicSwitch = isExplicitTopicSwitch(userMessage);

    // Check if user is asking for comparison between specific banks (e.g. "documents for HDFC and ICICI")
    if (bankCompCheck.isComparison && bankCompCheck.banks.length >= 2) {
      const compDocReply = formatDocumentComparisonAcrossBanks(bankCompCheck.banks);
      if (isEligibleFlowActive && !isTopicSwitch) {
        const nextField = currentMissingFields[0] || eligibilitySession?.expectedField || "company";
        const bridge = buildContextualEligibilityResumptionBridge(currentApplicant, nextField);
        return {
          reply: compDocReply + bridge,
        };
      }
      const suggestion = isEligibleFlowActive
        ? "\n\n*(Your loan eligibility assessment is paused. Whenever you would like to return, simply say \"resume\" or \"continue\".)*"
        : "";
      return {
        reply: compDocReply + suggestion,
      };
    }

    const bankMatchDoc = /(?:axis\s*finance|axis\s*bank|\baxis\b|bajaj\s*markets?|bajaj\s*finserv|\bbajaj\b|tata\s*capital|\btata\b(?!.*consultancy)|hdfc|icici|sbi|kotak|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe|sbm|utkarsh|aditya|abfl|birla|home\s*loan|l&t|ltf|lt\s*finance|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb|partner\s*banks?)/i.exec(normUserMsg);
    const unsuppDocBank = !bankMatchDoc ? extractUnsupportedBankName(userMessage) : undefined;
    const contextDocBank =
      (bankMatchDoc ? normalizeBankName(bankMatchDoc[0]) : undefined) ||
      unsuppDocBank ||
      eligibilitySession?.lastPolicyBank ||
      eligibilitySession?.selectedBank ||
      eligibilitySession?.chosenBank ||
      getRecentBankFromHistory(conversationHistory);

    let docBank = bankMatchDoc ? normalizeBankName(bankMatchDoc[0]) : (unsuppDocBank || "");
    if (!docBank || docBank === "partner banks") {
      docBank = extractUnsupportedBankName(userMessage) || "";
    }
    if (!docBank && contextDocBank && contextDocBank !== "partner banks") {
      docBank = contextDocBank;
    }

    let docReply = "";
    let bankData: any = undefined;
    if (docBank) {
      const resolvedTarget = await resolvePolicyTarget(docBank);
      if (resolvedTarget) {
        docReply = formatBankDocumentTable(resolvedTarget.bankName);
        bankData = { bank_name: resolvedTarget.bankName };
      } else {
        docReply = await formatBankPolicyNotAvailableResponse(docBank);
      }
    } else {
      docReply = formatDocumentComparisonAcrossBanks();
    }

    // Mid-flow interruption: answer first + append concise resumption bridge
    if (isEligibleFlowActive && !isTopicSwitch) {
      const nextField = currentMissingFields[0] || eligibilitySession?.expectedField || "company";
      const bridge = buildContextualEligibilityResumptionBridge(currentApplicant, nextField);

      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        in_eligibility_flow: true,
        expectedField: nextField,
        updatedAt: Date.now(),
      } as SessionState;
      await saveEligibilityState(conversationId, updatedSession);

      return {
        reply: docReply + bridge,
        bankData,
      };
    }

    // Explicit topic switch or independent document query
    const updatedSession: SessionState = {
      ...(eligibilitySession || {}),
      in_eligibility_flow: false,
      activeFlow: "BANK_DOCUMENT_REQUIREMENTS",
      mainUserGoal: "BANK_DOCUMENT_REQUIREMENTS",
      selectedBank: docBank || eligibilitySession?.selectedBank,
      chosenBank: docBank || eligibilitySession?.chosenBank,
      lastPolicyBank: docBank || eligibilitySession?.lastPolicyBank,
      pendingTopicSwitch: undefined,
      expectedField: undefined,
      expectedEntity: undefined,
      currentStep: "BANK_DOCUMENT_REQUIREMENTS_ANSWERED",
      updatedAt: Date.now(),
    } as SessionState;

    if (isEligibleFlowActive) {
      const suspendedTask: TaskStackItem = {
        taskType: "LOAN_ELIGIBILITY",
        expectedField: eligibilitySession?.expectedField,
        missingFields: currentMissingFields,
        applicantSnapshot: { ...(eligibilitySession?.applicant || currentApplicant) },
        timestamp: Date.now(),
        description: `Suspended on ${eligibilitySession?.expectedField || "loan flow"}`,
      };
      if (!updatedSession.taskStack) updatedSession.taskStack = [];
      const top = updatedSession.taskStack[updatedSession.taskStack.length - 1];
      if (!top || top.expectedField !== suspendedTask.expectedField) {
        updatedSession.taskStack.push(suspendedTask);
      }
    }

    await saveEligibilityState(conversationId, updatedSession);

    const suggestion = isEligibleFlowActive
      ? "\n\n*(Your loan eligibility assessment is paused. Whenever you would like to return, simply say \"resume\" or \"continue\".)*"
      : "";

    return {
      reply: docReply + suggestion,
      bankData,
    };
  }

  // Bank Policy Match Definitions
  const isPolicyTerm =
    /(?:policy|policies|guidelines?|rules?|criteria|cutoff|cut-off|\bfoir\b|\broi\b|requirement|requirements|\brequired\b|\brequires?\b|\bdocs?\b|\bdocuments?\b|tenure|interest(?:\s*rate)?|eligib\w*|exceptions?|deviations?|restrictions?|contractual|permanent|salaried|super\s*cat|cat\s*[a-e]|categories|category|apply\s*(?:to|with|at|in)|what.*loan\s*amount|how\s*much.*loan|loan\s*amount.*approve|max(?:imum)?\s*(?:loan|foir|tenure|amount)|min(?:imum)?\s*(?:and\s*max(?:imum)?\s*)?(?:salary|cibil\w*|income|amount|age|exp\w*)|max(?:imum)?\s*(?:and\s*min(?:imum)?\s*)?(?:salary|cibil\w*|income|amount|age|exp\w*)|\bcibil\w*|credit\s*score|require(?:\s+\w+)?\s*(?:salary|income)|how\s*much.*lend|minimum\s*income|work\s*exp\w*|exp(?:eri[ae]nce)?\b|vintage\b|qualification\b|qualif\w*|norms?\b|turnover\b|multiplier\b|condition\w*|parameters?|statements?|payslips?|kyc|annexure|paperwork)\b/i.test(normUserMsg) ||
    (/\b(?:what|tell|explain|how\s+much|how\s+many|is\s+there|can|check|show)\b/i.test(normUserMsg) && /\b(?:need|needs|needed|allowed|minimum|maximum|limit|cutoff|criteria|rule|terms?|feature|eligib\w*|required|requirement|experience|experiance)\b/i.test(normUserMsg));
  const bankMatchPolicy = /(?:axis\s*finance|axis\s*bank|\baxis\b|bajaj\s*markets?|bajaj\s*finserv|\bbajaj\b|tata\s*capital|\btata\b(?!.*consultancy)|hdfc|icici|sbi|kotak|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe|sbm|utkarsh|aditya|abfl|birla|home\s*loan|l&t|ltf|lt\s*finance|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb|partner\s*banks?)/i.exec(normUserMsg);
  const unsuppBank = !bankMatchPolicy ? extractUnsupportedBankName(userMessage) : undefined;
  const isNaturalLoanQ = /(?:am\s*i\s*(?:eligible|qualif\w*)|check\s*(?:my|our|the\s*)?eligib\w*|for\s*me|my\s*eligib\w*|can\s*i\s*(?:get|apply|qualify)|i\s*(?:need|want)\s*a\s*loan)/i.test(normUserMsg);
  const isFollowUpBankQuery =
    /^(?:what\s+about|how\s+about|and|what\s+of|tell\s+me\s+about)\s+(?:the\s+)?([a-z0-9\s&'.-]+)[?]?$/i.test(normUserMsg) &&
    Boolean(bankMatchPolicy || unsuppBank);

  const isCategorySalaryQuery =
    /\b(?:cat(?:egory)?\s*[a-e]|super\s*cat\s*[a-e]|listed\s*categor(?:y|ies))\b/i.test(normUserMsg) &&
    /\b(?:salary|income|nth|take\s*home|nmi|cutoff|cut-off|minimum|min)\b/i.test(normUserMsg);

  const contextBank =
    (bankMatchPolicy ? normalizeBankName(bankMatchPolicy[0]) : undefined) ||
    unsuppBank ||
    eligibilitySession?.lastPolicyBank ||
    eligibilitySession?.selectedBank ||
    eligibilitySession?.chosenBank ||
    getRecentBankFromHistory(conversationHistory);

  const isDirectBankMention = Boolean(bankMatchPolicy) || Boolean(unsuppBank);
  const isBankPolicyQuery =
    !isGeneralFinancialQuery(userMessage) &&
    (isPolicyTerm || isFollowUpBankQuery || isCategorySalaryQuery) &&
    (isDirectBankMention || Boolean(contextBank) || isCategorySalaryQuery) &&
    !isNaturalLoanQ &&
    !isMultiBankEligibilityQuery(userMessage);

  // =========================================================================
  // 1. DEDICATED BANK POLICY INTERCEPTOR
  // Conforms strictly to AGENTS.md guidelines (3-section 2-column table, no intake prompts, no guessing).
  // =========================================================================
  if (isBankPolicyQuery) {
    let bankToQuery = bankMatchPolicy ? normalizeBankName(bankMatchPolicy[0]) : (unsuppBank || "");
    if (!bankToQuery || bankToQuery === "partner banks") {
      bankToQuery = extractUnsupportedBankName(userMessage) || "";
    }
    if (!bankToQuery) {
      bankToQuery =
        eligibilitySession?.lastPolicyBank ||
        eligibilitySession?.selectedBank ||
        eligibilitySession?.chosenBank ||
        getRecentBankFromHistory(conversationHistory) ||
        "";
    }
    console.log(`[POLICY-RAG-DEBUG] intent=BANK_POLICY bank=${bankToQuery} message="${userMessage}"`);

    const isTopicSwitch = isExplicitTopicSwitch(userMessage);

    // If query is for category salary (e.g. "What is the minimum salary for Category A?")
    if (isCategorySalaryQuery) {
      const catMatch = normUserMsg.match(/\bcat(?:egory)?\s*([a-e])\b/i);
      const catLetter = catMatch ? catMatch[1].toUpperCase() : "A";
      const crossBankReply = formatCategorySalaryAcrossBanks(catLetter);

      if (isEligibleFlowActive && !isTopicSwitch) {
        const nextField = currentMissingFields[0] || eligibilitySession?.expectedField || "company";
        const bridge = buildContextualEligibilityResumptionBridge(currentApplicant, nextField);

        const updatedSession: SessionState = {
          ...(eligibilitySession || {}),
          in_eligibility_flow: true,
          expectedField: nextField,
          updatedAt: Date.now(),
        } as SessionState;
        await saveEligibilityState(conversationId, updatedSession);

        if (!bankMatchPolicy) {
          if (bankToQuery) {
            try {
              const bankSpecific = await answerBankPolicyWithMasterPolicy(bankToQuery, userMessage, requestedModel, conversationHistory);
              return {
                reply: bankSpecific + "\n\n---\n\n" + crossBankReply + bridge,
                bankData: { bank_name: bankToQuery },
              };
            } catch (e) {
              console.warn("[Category Policy Err]:", e);
            }
          }
          return {
            reply: crossBankReply + bridge,
          };
        }
      }

      const suggestion = isEligibleFlowActive
        ? "\n\n*(Your loan eligibility assessment is paused. Whenever you would like to return, simply say \"resume\" or \"continue\".)*"
        : "";

      if (!bankMatchPolicy) {
        if (bankToQuery) {
          try {
            const bankSpecific = await answerBankPolicyWithMasterPolicy(bankToQuery, userMessage, requestedModel, conversationHistory);
            return {
              reply: bankSpecific + "\n\n---\n\n" + crossBankReply + suggestion,
              bankData: { bank_name: bankToQuery },
            };
          } catch (e) {
            console.warn("[Category Policy Err]:", e);
          }
        }
        return {
          reply: crossBankReply + suggestion,
        };
      }
    }

    const policyReply = await answerBankPolicyWithMasterPolicy(bankToQuery, userMessage, requestedModel, conversationHistory);

    // Mid-flow interruption: answer policy first + append concise resumption bridge
    if (isEligibleFlowActive && !isTopicSwitch) {
      const nextField = currentMissingFields[0] || eligibilitySession?.expectedField || "company";
      const bridge = buildContextualEligibilityResumptionBridge(currentApplicant, nextField);

      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        in_eligibility_flow: true,
        expectedField: nextField,
        lastPolicyBank: bankToQuery || eligibilitySession?.lastPolicyBank,
        updatedAt: Date.now(),
      } as SessionState;
      await saveEligibilityState(conversationId, updatedSession);

      return {
        reply: policyReply + bridge,
        bankData: bankToQuery ? { bank_name: bankToQuery } : undefined,
      };
    }

    // Explicit topic switch or standalone policy inquiry: suspend active evaluation
    const updatedSession: SessionState = {
      ...(eligibilitySession || {}),
      in_eligibility_flow: false,
      activeFlow: "BANK_POLICY",
      mainUserGoal: "BANK_POLICY",
      selectedBank: bankToQuery || eligibilitySession?.selectedBank,
      chosenBank: bankToQuery || eligibilitySession?.chosenBank,
      lastPolicyBank: bankToQuery || eligibilitySession?.lastPolicyBank,
      pendingTopicSwitch: undefined,
      expectedField: undefined,
      expectedEntity: undefined,
      currentStep: "BANK_POLICY_ANSWERED",
      updatedAt: Date.now(),
    } as SessionState;

    if (isEligibleFlowActive) {
      const suspendedTask: TaskStackItem = {
        taskType: "LOAN_ELIGIBILITY",
        expectedField: eligibilitySession?.expectedField,
        missingFields: currentMissingFields,
        applicantSnapshot: { ...(eligibilitySession?.applicant || currentApplicant) },
        timestamp: Date.now(),
        description: `Suspended on ${eligibilitySession?.expectedField || "loan flow"}`,
      };
      if (!updatedSession.taskStack) updatedSession.taskStack = [];
      const top = updatedSession.taskStack[updatedSession.taskStack.length - 1];
      if (!top || top.expectedField !== suspendedTask.expectedField) {
        updatedSession.taskStack.push(suspendedTask);
      }
    }

    await saveEligibilityState(conversationId, updatedSession);

    const suggestion = isEligibleFlowActive
      ? "\n\n*(Your loan eligibility assessment is paused. Whenever you would like to return, simply say \"resume\" or \"continue\".)*"
      : "";
    return {
      reply: policyReply + suggestion,
      bankData: bankToQuery ? { bank_name: bankToQuery } : undefined,
    };
  }

  // =========================================================================
  // DEDICATED MULTI-BANK LOAN ELIGIBILITY INTERCEPTOR (Sections 2, 3, 8, 9, 10, 19)
  // When user asks:
  // - "Check my loan eligibility across partner banks"
  // - "Which banks can I get a loan from?"
  // - "Am I eligible for a personal loan?"
  // - "Check eligibility for all banks"
  // - "Compare my eligibility"
  // - "Find the best bank for me"
  // - "Which partner banks am I eligible for?"
  // - "Check all lenders"
  // Evaluate stored policy deterministically across ALL applicable partner lenders.
  // NEVER say "bank policy not available"!
  // =========================================================================
  const isSpecificSingleBankLookup =
    /(?:hdfc|icici|axis\s*bank|axis\s*finance|sbi|kotak|bajaj\s*finserv|bajaj\s*markets?|tata\s*capital|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|chola|smfg|finnable|fibe|sbm|utkarsh)/i.test(normUserMsg) &&
    !isMultiBankEligibilityQuery(userMessage);

  const isMultiBankInHistory = Array.isArray(conversationHistory) && conversationHistory.some((m) =>
    (m.role === "user" && isMultiBankEligibilityQuery(m.content)) ||
    (m.role === "assistant" && (m.content.includes("across our partner lenders") || m.content.includes("Loan Eligibility Across Partner Banks")))
  );

  const isDirectPolicyOrInformationalQuery =
    isBankPolicyQuery ||
    isCategorySalaryQuery ||
    isGeneralFinancialQuery(userMessage) ||
    isGeneralAssistanceQuery(userMessage) ||
    bankAvailCheck.isAvailableBanksList ||
    bankAvailCheck.isSpecificBankAvailability ||
    bankCompCheck.isComparison;

  if (
    !isDirectPolicyOrInformationalQuery &&
    (isMultiBankEligibilityQuery(userMessage) ||
      ((eligibilitySession?.activeFlow === "MULTI_BANK_ELIGIBILITY_CHECK" || isMultiBankInHistory) && !isSpecificSingleBankLookup))
  ) {
    const multiBankResult = await handleMultiBankEligibilityCheck(
      userMessage,
      eligibilitySession,
      conversationId,
      requestedModel,
      conversationHistory
    );
    return await finalizeAndReturn(multiBankResult);
  }

  // =========================================================================
  // BANK TRANSITION: VALUE OVERRIDE HANDLER (Rule 3)
  // - If user selects "Proceed with [Existing Amount]" (or confirms "yes"), keep existing value and immediately run policy/eligibility rules.
  // - If user types new amount (e.g. "7 Lakhs" or "₹7,00,000"), immediately overwrite parameter (Requested_Loan_Amount = 700000) and proceed using new value.
  // =========================================================================
  if (eligibilitySession?.awaitingBankLoanAmountConfirmation && eligibilitySession.pendingBankForConfirmation) {
    const targetBank = eligibilitySession.pendingBankForConfirmation;
    const existingAmount = eligibilitySession.confirmedLoanAmount || 500000;

    const isProceedExisting =
      /^(?:proceed(?:\s+with)?(?:\s+(?:existing\s*amount|the\s*same|\d+[\d,]*|₹?[\d,]+|[\d.]+\s*(?:lakhs?|lacs?|cr|k)|this))?(?:\s+for\s+[a-z0-9&'.-]+)?|yes\b|yeah\b|yup\b|sure\b|ok\b|okay\b|continue\b|keep\s*(?:it|existing|same)\b|same\b|proceed\b|let'?s\s*proceed|use\s*(?:this|existing|same)|fine\b)/i.test(normUserMsg) ||
      /proceed\s+with\s+(?:₹?\s*[\d,]+|[\d.]+\s*(?:lakhs?|lacs?|cr|k)|existing)/i.test(normUserMsg);

    const explicitNewAmount = normalizeLoanAmount(userMessage);

    let effectiveLoanAmount = existingAmount;
    if (explicitNewAmount && explicitNewAmount >= 10000 && explicitNewAmount !== existingAmount && !isProceedExisting) {
      effectiveLoanAmount = explicitNewAmount;
    }

    currentApplicant.loanAmount = effectiveLoanAmount;
    const updatedSessionVars = {
      ...(eligibilitySession.sessionVariables || {}),
      requestedAmount: effectiveLoanAmount,
      Requested_Loan_Amount: effectiveLoanAmount,
    };

    const reply = await executeBankTransitionEvaluation(
      targetBank,
      effectiveLoanAmount,
      currentApplicant,
      updatedSessionVars,
      requestedModel,
      eligibilitySession.pendingBankQueryType,
      eligibilitySession.pendingBankOriginalMessage
    );

    const updatedSession: SessionState = {
      ...(eligibilitySession || {}),
      awaitingBankLoanAmountConfirmation: false,
      pendingBankForConfirmation: undefined,
      pendingBankQueryType: undefined,
      pendingBankOriginalMessage: undefined,
      confirmedBank: targetBank,
      confirmedLoanAmount: effectiveLoanAmount,
      selectedBank: targetBank,
      chosenBank: targetBank,
      lastPolicyBank: targetBank,
      sessionVariables: updatedSessionVars,
      applicant: {
        ...(eligibilitySession.applicant || currentApplicant),
        loanAmount: effectiveLoanAmount,
      },
      referencedEntities: {
        ...(eligibilitySession.referencedEntities || {}),
        lastMentionedAmount: effectiveLoanAmount,
      },
      updatedAt: Date.now(),
    };
    await saveEligibilityState(conversationId, updatedSession);

    return {
      reply: sanitizeConciseResponse(reply),
    };
  }



  // =========================================================================
  // BANK TRANSITION: EXPLICIT CONFIRMATION FLOW (Rule 2 & Rule 3)
  // When transitioning to a new bank or policy check (e.g. IDFC FIRST Bank), confirm existing value using single concise line:
  // "Proceed with [Existing Amount] for [Bank Name], or enter a new loan amount?"
  // =========================================================================
  const existingAmount = getExistingLoanAmount(eligibilitySession, currentApplicant, conversationHistory);
  const resolvedBankCandidate = resolveBankName(userMessage) ||
    (bankMatchPolicy ? { bankName: normalizeBankName(bankMatchPolicy[0]), isCorrection: false } : null);
  const targetBankCandidate = resolvedBankCandidate?.bankName;

  const isSingleSpecificParameterLookup =
    (/\b(?:what\s+is\s+(?:the\s+)?(?:minimum\s+|cutoff\s+|cut-off\s+)?(?:cibil|credit\s*score|age|salary|income|documents?|foir|work\s*exp\w*|exp(?:eri[ae]nce)?|tenure|roi|rate|multiplier)\b)/i.test(userMessage) ||
      isCategorySalaryQuery) &&
    !/\b(?:check|eligib|apply|proceed|calculate|my\s+loan|with|for\s+me)\b/i.test(userMessage);

  const isManagerSearch = /manager|contact|branch\s*head|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b|phone|mobile|email/i.test(normUserMsg);
  const isTransitionToBank =
    Boolean(targetBankCandidate) &&
    !isSingleSpecificParameterLookup &&
    !isManagerSearch &&
    !/^(?:reset|clear|restart|cancel)\b/i.test(normUserMsg);

  if (isTransitionToBank && existingAmount && existingAmount > 0) {
    const targetBank = targetBankCandidate!;
    const isAlreadyConfirmed =
      eligibilitySession?.confirmedBank === targetBank &&
      eligibilitySession?.awaitingBankLoanAmountConfirmation !== true;

    const newAmountInThisTurn = normalizeLoanAmount(userMessage);
    const hasExplicitNewAmtInMsg = Boolean(
      newAmountInThisTurn &&
      newAmountInThisTurn >= 10000 &&
      newAmountInThisTurn !== 700 &&
      newAmountInThisTurn !== 750 &&
      newAmountInThisTurn !== 800 &&
      newAmountInThisTurn !== existingAmount
    );

    if (!isAlreadyConfirmed) {
      if (hasExplicitNewAmtInMsg && newAmountInThisTurn) {
        currentApplicant.loanAmount = newAmountInThisTurn;
        const updatedSessionVars = {
          ...(eligibilitySession?.sessionVariables || {}),
          requestedAmount: newAmountInThisTurn,
          Requested_Loan_Amount: newAmountInThisTurn,
        };

        const reply = await executeBankTransitionEvaluation(
          targetBank,
          newAmountInThisTurn,
          currentApplicant,
          updatedSessionVars,
          requestedModel,
          isBankPolicyQuery ? "POLICY" : "ELIGIBILITY",
          userMessage
        );

        const updatedSession: SessionState = {
          ...(eligibilitySession || {}),
          awaitingBankLoanAmountConfirmation: false,
          pendingBankForConfirmation: undefined,
          confirmedBank: targetBank,
          confirmedLoanAmount: newAmountInThisTurn,
          selectedBank: targetBank,
          chosenBank: targetBank,
          lastPolicyBank: targetBank,
          sessionVariables: updatedSessionVars,
          applicant: {
            ...(eligibilitySession?.applicant || currentApplicant),
            loanAmount: newAmountInThisTurn,
          },
          updatedAt: Date.now(),
        };
        await saveEligibilityState(conversationId, updatedSession);

        return { reply: sanitizeConciseResponse(reply) };
      } else {
        const formattedAmount = `₹${existingAmount.toLocaleString("en-IN")}`;
        const confirmationReply = `Proceed with ${formattedAmount} for ${targetBank}, or enter a new loan amount?`;

        const updatedSession: SessionState = {
          ...(eligibilitySession || {}),
          awaitingBankLoanAmountConfirmation: true,
          pendingBankForConfirmation: targetBank,
          confirmedLoanAmount: existingAmount,
          pendingBankQueryType: isBankPolicyQuery ? "POLICY" : "ELIGIBILITY",
          pendingBankOriginalMessage: userMessage,
          selectedBank: targetBank,
          chosenBank: targetBank,
          updatedAt: Date.now(),
        };
        await saveEligibilityState(conversationId, updatedSession);

        return {
          reply: confirmationReply,
        };
      }
    }
  }



  // =========================================================================
  // Early Session Reset & Employment Status Guard
  // =========================================================================
  if (/^(?:reset|clear|restart|cancel|start\s*over)\b/i.test(normUserMsg)) {
    await clearEligibilityState(conversationId);
    return {
      reply: "Your loan assessment session has been reset. How can I help you today? You can check your personal loan eligibility across partner banks or inquire about bank policies.",
    };
  }

  if (/(?:unemployed|lost\s*(?:my\s*)?job|laid\s*off|no\s*job|without\s*(?:a\s*)?job|jobless)\b/i.test(normUserMsg)) {
    await clearEligibilityState(conversationId);
    return {
      reply: "Under partner bank policies, unsecured personal loans require active employment (Salaried or Self-Employed) with regular verifiable monthly income. Unemployed applicants are currently not eligible for unsecured personal loans.",
    };
  }

  // =========================================================================
  // Resumption handler if user previously received the transition prompt:
  // "Would you like to resume your personal loan eligibility check?"
  // =========================================================================
  if (eligibilitySession?.pendingGeneralQueryResume) {
    const isAffirmative = /^(?:yes|yeah|yup|sure|ok|okay|yep|proceed|continue|resume|let'?s\s*do\s*(?:it|that)|please\s*continue|yes\s*(?:please|resume|continue))\b/i.test(normUserMsg);
    const isNegative = /^(?:no|nope|not\s*now|later|don'?t|no\s*thanks|leave\s*it|cancel)\b/i.test(normUserMsg);

    if (isAffirmative) {
      const currentVars = eligibilitySession.sessionVariables || {};
      const webhookRes = await processAntigravityWebhook({
        sessionVariables: currentVars,
        userMessage: "",
      });

      const nextPrompt = webhookRes.prompt || WATERFALL_PROMPTS.employer;
      const resumeMessage = `Great! Let's resume your personal loan eligibility check.\n\n${nextPrompt}`;

      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        pendingGeneralQueryResume: false,
        in_eligibility_flow: true,
        expectedField: (webhookRes.nextSlotRequired === "employer" ? "company" : webhookRes.nextSlotRequired) || "company",
        sessionVariables: webhookRes.sessionVariables || currentVars,
        updatedAt: Date.now(),
      };
      await saveEligibilityState(conversationId, updatedSession);

      return {
        reply: resumeMessage,
      };
    } else if (isNegative) {
      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        pendingGeneralQueryResume: false,
        updatedAt: Date.now(),
      };
      await saveEligibilityState(conversationId, updatedSession);

      return {
        reply: "Understood! Feel free to ask anytime if you have any questions or want to check your loan eligibility.",
      };
    }
  }

  // =========================================================================
  // DEDICATED GENERAL FINANCIAL QUERY INTERCEPTOR
  // 1. ANSWER GENERAL FINANCIAL QUERIES IMMEDIATELY:
  //    - If the user asks an informational or educational question (e.g., "What is a processing fee?", "How is interest calculated?"),
  //      answer the question directly FIRST.
  //    - Do NOT ignore the user's question to push corporate lookups, bank selections, or application steps.
  // 2. CONTEXTUAL TRANSITION AFTER ANSWERING:
  //    - ONLY after providing a clear answer to the user's question, add a single transition line back to the loan journey:
  //      "Would you like to resume your personal loan eligibility check?"
  // =========================================================================
  if (isGeneralFinancialQuery(userMessage) && !isBankPolicyQuery) {
    const streamToken = agentTokenStorage.getStore();
    const educationalAnswer = await answerGeneralFinancialQuery(
      userMessage,
      requestedModel,
      streamToken ? { onToken: streamToken } : undefined
    );

    // Extract any co-occurring applicant profile entities (e.g., "I work at Infosys, earn 50000, and what is CIBIL?")
    const coOccurringEntities = extractEntitiesFromRawText(userMessage, eligibilitySession?.expectedField);
    const hasExtractedProfileInfo = Boolean(
      coOccurringEntities.employer ||
      coOccurringEntities.monthlyIncome ||
      coOccurringEntities.requestedAmount ||
      coOccurringEntities.tenureMonths ||
      coOccurringEntities.existingEmi !== undefined ||
      coOccurringEntities.cibilScore !== undefined ||
      coOccurringEntities.age
    );

    if (hasExtractedProfileInfo) {
      const updatedVars: Partial<SessionVariables> = {
        ...(eligibilitySession?.sessionVariables || {}),
      };
      const acknowledgedParts: string[] = [];

      if (coOccurringEntities.employer) {
        const emp = String(coOccurringEntities.employer).trim();
        updatedVars.employer = emp;
        updatedVars.Employer_Name = emp;
        currentApplicant.companyName = emp;
        acknowledgedParts.push(`company as **${emp}**`);
      }
      if (coOccurringEntities.monthlyIncome) {
        const inc = typeof coOccurringEntities.monthlyIncome === "number" ? coOccurringEntities.monthlyIncome : parseInt(String(coOccurringEntities.monthlyIncome), 10);
        if (!isNaN(inc)) {
          updatedVars.monthlyIncome = inc;
          currentApplicant.monthlyIncome = inc;
          acknowledgedParts.push(`monthly income as **₹${inc.toLocaleString("en-IN")}**`);
        }
      }
      if (coOccurringEntities.requestedAmount) {
        const amt = typeof coOccurringEntities.requestedAmount === "number" ? coOccurringEntities.requestedAmount : parseInt(String(coOccurringEntities.requestedAmount), 10);
        if (!isNaN(amt)) {
          updatedVars.requestedAmount = amt;
          updatedVars.Requested_Loan_Amount = amt;
          currentApplicant.loanAmount = amt;
          acknowledgedParts.push(`loan requirement as **₹${amt.toLocaleString("en-IN")}**`);
        }
      }
      if (coOccurringEntities.tenureMonths) {
        const ten = typeof coOccurringEntities.tenureMonths === "number" ? coOccurringEntities.tenureMonths : parseInt(String(coOccurringEntities.tenureMonths), 10);
        if (!isNaN(ten)) {
          updatedVars.tenureMonths = ten;
          currentApplicant.tenureMonths = ten;
          acknowledgedParts.push(`tenure as **${ten} months**`);
        }
      }
      if (coOccurringEntities.existingEmi !== undefined) {
        const emi = typeof coOccurringEntities.existingEmi === "number" ? coOccurringEntities.existingEmi : parseInt(String(coOccurringEntities.existingEmi), 10);
        if (!isNaN(emi)) {
          updatedVars.existingEmi = emi;
          currentApplicant.existingEmi = emi;
          acknowledgedParts.push(`existing EMI as **₹${emi.toLocaleString("en-IN")}**`);
        }
      }
      if (coOccurringEntities.cibilScore !== undefined) {
        if (coOccurringEntities.cibilScore === "NOT_SURE") {
          updatedVars.cibilScore = "NOT_SURE";
          acknowledgedParts.push(`CIBIL score as **not checked**`);
        } else {
          const cib = typeof coOccurringEntities.cibilScore === "number" ? coOccurringEntities.cibilScore : parseInt(String(coOccurringEntities.cibilScore), 10);
          if (!isNaN(cib)) {
            updatedVars.cibilScore = cib;
            currentApplicant.cibil = cib;
            acknowledgedParts.push(`CIBIL score as **${cib}**`);
          }
        }
      }
      if (coOccurringEntities.age) {
        const age = typeof coOccurringEntities.age === "number" ? coOccurringEntities.age : parseInt(String(coOccurringEntities.age), 10);
        if (!isNaN(age)) {
          updatedVars.age = age;
          currentApplicant.age = age;
          acknowledgedParts.push(`age as **${age} years**`);
        }
      }

      const missing: Array<keyof typeof WATERFALL_PROMPTS> = [];
      if (!updatedVars.requestedAmount) missing.push("requestedAmount");
      if (!updatedVars.monthlyIncome) missing.push("monthlyIncome");
      if (!updatedVars.employer) missing.push("employer");
      if (updatedVars.existingEmi === undefined) missing.push("existingEmi");
      if (!updatedVars.tenureMonths) missing.push("tenureMonths");
      if (updatedVars.cibilScore === undefined) missing.push("cibilScore");
      if (!updatedVars.age) missing.push("age");

      const isTopicSwitch = isExplicitTopicSwitch(userMessage);

      if (isEligibleFlowActive && !isTopicSwitch) {
        const nextField = missing[0] || "company";
        const bridge = buildContextualEligibilityResumptionBridge(currentApplicant, nextField);
        const ackText = acknowledgedParts.length > 0 ? `\n\nI have recorded your ${acknowledgedParts.join(" and ")}.` : "";
        const fullReply = `${educationalAnswer}${ackText}${bridge}`;

        const updatedSession: SessionState = {
          ...(eligibilitySession || {}),
          in_eligibility_flow: true,
          expectedField: nextField,
          missingFields: missing,
          applicant: currentApplicant,
          sessionVariables: updatedVars,
          lastGeneralQuery: userMessage,
          updatedAt: Date.now(),
        };
        await saveEligibilityState(conversationId, updatedSession);
        return { reply: fullReply };
      }

      const ackText = acknowledgedParts.length > 0 ? `\n\nI have recorded your ${acknowledgedParts.join(" and ")}.` : "";
      const fullReply = `${educationalAnswer}${ackText}\n\nWhenever you're ready, we can return to your loan eligibility check. Would you like to proceed?`;

      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        in_eligibility_flow: false,
        pendingGeneralQueryResume: true,
        applicant: currentApplicant,
        sessionVariables: updatedVars,
        lastGeneralQuery: userMessage,
        updatedAt: Date.now(),
      };
      await saveEligibilityState(conversationId, updatedSession);
      return { reply: fullReply };
    }

    const isTopicSwitch = isExplicitTopicSwitch(userMessage);

    if (isEligibleFlowActive && !isTopicSwitch) {
      const nextField = currentMissingFields[0] || eligibilitySession?.expectedField || "company";
      const bridge = buildContextualEligibilityResumptionBridge(currentApplicant, nextField);

      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        in_eligibility_flow: true,
        expectedField: nextField,
        lastGeneralQuery: userMessage,
        updatedAt: Date.now(),
      };
      await saveEligibilityState(conversationId, updatedSession);

      return {
        reply: educationalAnswer + bridge,
      };
    }

    const suggestion = isEligibleFlowActive
      ? "\n\n*(Your loan eligibility assessment is paused. Whenever you would like to return, simply say \"resume\" or \"continue\".)*"
      : `\n\n${RESUME_TRANSITION_LINE}`;

    const fullReply = `${educationalAnswer}${suggestion}`;

    const updatedSession: SessionState = {
      ...(eligibilitySession || {}),
      in_eligibility_flow: false,
      pendingGeneralQueryResume: true,
      lastGeneralQuery: userMessage,
      updatedAt: Date.now(),
    };

    if (isEligibleFlowActive || eligibilitySession?.in_eligibility_flow || eligibilitySession?.sessionVariables) {
      const suspendedTask: TaskStackItem = {
        taskType: "LOAN_ELIGIBILITY",
        expectedField: eligibilitySession?.expectedField,
        missingFields: currentMissingFields,
        applicantSnapshot: { ...(eligibilitySession?.applicant || currentApplicant) },
        timestamp: Date.now(),
        description: `Suspended for general financial query: ${userMessage}`,
      };
      if (!updatedSession.taskStack) updatedSession.taskStack = [];
      const top = updatedSession.taskStack[updatedSession.taskStack.length - 1];
      if (!top || top.expectedField !== suspendedTask.expectedField) {
        updatedSession.taskStack.push(suspendedTask);
      }
    }

    await saveEligibilityState(conversationId, updatedSession);

    return {
      reply: fullReply,
    };
  }

  let hasCompletedEvaluation = Boolean(
    eligibilitySession?.hasCompletedEvaluation ||
    eligibilitySession?.evaluationCompleted
  );

  const isPostEvalOrBankManager = Boolean(
    hasCompletedEvaluation ||
    eligibilitySession?.currentStep === "BANK_SELECTION" ||
    eligibilitySession?.currentStep === "CITY_COLLECTION" ||
    eligibilitySession?.currentStep === "BRANCH_SELECTION" ||
    eligibilitySession?.expectedField === "selectedBank" ||
    eligibilitySession?.expectedField === "city" ||
    eligibilitySession?.expectedField === "branchSelection" ||
    eligibilitySession?.postEligibilityStage === "ELIGIBILITY_CONFIRMED" ||
    eligibilitySession?.postEligibilityStage === "BANK_SELECTION" ||
    eligibilitySession?.postEligibilityStage === "BANK_MANAGER_DETAILS_INPUT" ||
    eligibilitySession?.postEligibilityStage === "BRANCH_SELECTION"
  );

  const explicitLoanIntent = detectLoanIntent(userMessage).isLoanIntent;
  const isProfileUpdateIntent =
    /\b(?:update|change|correct|modify|revised?|increased?|decreased?|new\s*salary|actually)\b/i.test(userMessage) &&
    /\b(?:salary|income|amount|loan|tenure|cibil|score|age|company|employer|emi)\b/i.test(userMessage);

  const inLoanEligibilityFlow = Boolean(
    isEligibleFlowActive ||
    eligibilitySession?.in_eligibility_flow ||
    eligibilitySession?.sessionVariables ||
    explicitLoanIntent ||
    isProfileUpdateIntent ||
    eligibilitySession?.awaitingEmployerConfirmation ||
    eligibilitySession?.sessionVariables?.awaitingEmployerConfirmation
  );

  // =========================================================================
  // DEDICATED FINANCIAL CALCULATION INTERCEPTOR
  // ALWAYS fulfill and output the core requested calculation/information FIRST.
  // ONLY ask about partner banks at the very end of the response as a secondary step.
  // =========================================================================
  const isDirectEmiCalcRequest =
    (/\b(?:calculate\s+(?:my\s+)?(?:emi|installment|monthly\s*payment|loan\s*repayment|interest)|what\s*(?:is|would\s*be)\s*(?:the\s+|my\s+)?emi|how\s*much\s*(?:is|would\s*be)\s*(?:the\s+|my\s+)?emi|emi\s*(?:for|of))\b/i.test(userMessage) ||
    (/\bemi\b/i.test(normUserMsg) && /\b(?:calculate|find|tell\s*me|what\s*is|how\s*much)\b/i.test(normUserMsg))) &&
    !/^(?:what\s+is\s+(?:an?\s+)?emi\??|how\s+(?:is|does)\s+emi\s+work\??)$/i.test(normUserMsg) &&
    !/(?:i\s*(?:need|want)\s*(?:a\s*)?loan|apply\s*for\s*(?:a\s*)?loan|check\s*my\s*eligib\w*|am\s*i\s*eligible)/i.test(normUserMsg);

  if (isDirectEmiCalcRequest) {
    const calcPrincipal =
      normalizeLoanAmount(userMessage) ||
      (eligibilitySession?.sessionVariables?.requestedAmount ? Number(eligibilitySession.sessionVariables.requestedAmount) : undefined) ||
      (currentApplicant.loanAmount ? Number(currentApplicant.loanAmount) : undefined);

    const calcTenure =
      normalizeTenureMonths(userMessage) ||
      (currentApplicant.tenureMonths ? Number(currentApplicant.tenureMonths) : undefined) ||
      (eligibilitySession?.sessionVariables?.tenureMonths ? Number(eligibilitySession.sessionVariables.tenureMonths) : undefined) ||
      60;

    const rateMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*%/);
    const rateWordMatch = userMessage.match(/(?:at|roi|rate\s*(?:of|is)?)\s*(\d+(?:\.\d+)?)/i);
    const calcRate = rateMatch ? parseFloat(rateMatch[1]) : (rateWordMatch ? parseFloat(rateWordMatch[1]) : 10.5);

    if (calcPrincipal && calcPrincipal > 0) {
      const emiVal = calculateEmi(calcPrincipal, calcRate, calcTenure);

      let followUpText: string | undefined = undefined;
      if (inLoanEligibilityFlow && eligibilitySession?.sessionVariables) {
        const nextMissing = eligibilitySession.expectedField || "monthlyIncome";
        const nextPrompt = WATERFALL_PROMPTS[nextMissing] || "What is your net monthly take-home salary or income (e.g., ₹75,000)?";
        followUpText = `Would you like to compare eligible partner bank offers with these parameters, or continue with your personal loan eligibility check?\n\n${nextPrompt}`;
      }

      const emiMarkdown = formatEmiResult(
        { principal: calcPrincipal, rate: calcRate, tenure: calcTenure },
        emiVal,
        followUpText
      );

      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        applicant: {
          ...(eligibilitySession?.applicant || currentApplicant),
          loanAmount: calcPrincipal,
          tenureMonths: calcTenure,
        },
        sessionVariables: {
          ...(eligibilitySession?.sessionVariables || {}),
          requestedAmount: calcPrincipal,
          Requested_Loan_Amount: calcPrincipal,
          tenureMonths: calcTenure,
        },
        referencedEntities: {
          ...(eligibilitySession?.referencedEntities || {}),
          lastCalculatedEmi: emiVal,
          lastMentionedAmount: calcPrincipal,
          lastMentionedTenure: calcTenure,
        },
        conversationHistory: [
          ...(conversationHistory || eligibilitySession?.conversationHistory || []),
          { role: "user", content: userMessage },
          { role: "assistant", content: emiMarkdown },
        ],
        updatedAt: Date.now(),
      };
      await saveEligibilityState(conversationId, updatedSession);

      return {
        reply: emiMarkdown,
      };
    } else {
      const salaryContext = currentApplicant.monthlyIncome
        ? ` (With your salary of ₹${Number(currentApplicant.monthlyIncome).toLocaleString("en-IN")}, you typically qualify for personal loans up to ₹6–8 Lakhs).`
        : "";

      return {
        reply:
          `### 🧮 Loan EMI Calculator\n\n` +
          `I'd be happy to calculate your exact monthly installment (EMI)!${salaryContext}\n\n` +
          `To perform the calculation, please provide:\n` +
          `• **Loan Amount**: Desired amount (e.g. ₹5 Lakhs, ₹10 Lakhs)\n` +
          `• **Repayment Tenure**: Preferred duration in months or years (e.g. 3 years, 5 years)\n` +
          `• **Interest Rate**: Annual rate percentage (e.g. 10.5% p.a., or we will use standard benchmark)\n\n` +
          `*Example: "What is the EMI for 10 lakhs at 11% for 5 years?"*`,
      };
    }
  }

  // =========================================================================
  // EMPLOYER / COMPANY SELECTION & ELIGIBILITY CONTINUATION HANDLER
  // When user types company name or employer name, display matching company list
  // in selectable format. When selected, display basic, financial, and bank records,
  // then ask the next eligibility question.
  // =========================================================================
  let isCompanyStep = Boolean(
    eligibilitySession?.expectedField === "companyName" ||
    eligibilitySession?.expectedField === "company" ||
    eligibilitySession?.expectedEntity === "company" ||
    eligibilitySession?.expectedEntity === "companyName" ||
    (eligibilitySession?.in_eligibility_flow && (
      (eligibilitySession?.missingFields || [])[0] === "companyName" ||
      (eligibilitySession?.missingFields || [])[0] === "company"
    ))
  );

  let hasExplicitEmployerPhrase = Boolean(
    isExplicitCompanyChangeInMsg ||
    /(?:(?:(?:i\s*am|i['"]?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by)\s+(?:(?:the|my|our)\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)\s+)|(?:(?:my|our|the)\s+(?:currently\s+|presently\s+)?(?:working\s+|current\s+|present\s+|existing\s+|previous\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?|workplace)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:working\s+|current\s+|present\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:my\s+)?(?:company|employer|organization|org)(?:\s*name)?\s*[:=-]\s*)|(?:work\s+(?:at|in|with|for)|works\s+(?:at|in|with|for)|working\s+(?:at|in|with|for)|employed\s+(?:at|by|in|with|for))|(?:(?:my\s+)?(?:company|employer)\s+is)|(?:(?:i\s*am|i'?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by))|(?:(?:change|changed|update|updated|correct|switch|switched|move|moved|leave|left|joined)\s+(?:my\s+)?(?:company|employer|job|workplace|comapny))|(?:employer\s*[:=-]|company\s*[:=-]))\b/i.test(userMessage.trim())
  );

  let isAwaitingCompanySelection = Boolean(
    companySelectionAction ||
    eligibilitySession?.companyFlow?.stage === "COMPANY_SELECTION" ||
    eligibilitySession?.companyFlow?.stage === "COMPANY_CONFIRMATION" ||
    eligibilitySession?.awaitingEmployerConfirmation ||
    eligibilitySession?.sessionVariables?.awaitingEmployerConfirmation
  );

  // Check if user is asking about their company or company intelligence
  const hasExplicitCompanyInquiry = /(?:give(?:\s+me)?|show(?:\s+me)?|tell(?:\s+me)?|what\s+is|check|find|search|serach|details|info|information|rating|tier|category|listing|profile|about\s+(?:that|the|my|this)?\s*(?:company|employer))/i.test(userMessage);
  const isCompanyInquiry = isCompanyInfoOrSearchIntent(userMessage) && (!isCompanyStep || hasExplicitCompanyInquiry);
  if (isCompanyInquiry && !isPostEvalOrBankManager && !isDirectEmiCalcRequest && !isPureGreeting(userMessage) && !companySelectionAction) {
    const directTarget = extractTargetCompanyFromMessage(userMessage);
    const confirmedCompany =
      directTarget ||
      eligibilitySession?.selectedCompanyName ||
      eligibilitySession?.companyFlow?.selectedCompanyName ||
      (currentApplicant.companyName && !isMissingOrPlaceholderCompany(currentApplicant.companyName) && currentApplicant.companyName !== "Self-Employed" ? currentApplicant.companyName : undefined);

    if (confirmedCompany && !isInvalidCompanyName(confirmedCompany)) {
      const compRes = await executeSearchCompanyCategory(
        { companyName: confirmedCompany },
        userMessage,
        inLoanEligibilityFlow,
        eligibilitySession
      );
      if (compRes) {
        if (
          compRes.companyData?.needs_disambiguation &&
          compRes.companyData?.candidateOptions &&
          compRes.companyData.candidateOptions.length > 1
        ) {
          const disambigState: SessionState = {
            ...(eligibilitySession || {}),
            applicant: currentApplicant,
            companyFlow: {
              stage: "COMPANY_SELECTION",
              originalInput: confirmedCompany,
              rawQuery: confirmedCompany,
              candidates: compRes.companyData.candidateOptions,
            },
            awaitingEmployerConfirmation: true,
            employerConfirmationQuery: confirmedCompany,
            employerConfirmationOptions: compRes.companyData.candidateOptions.map((c: any) => ({
              name: c.name,
              categoryLabel: c.categoryLabel || c.category || "Standard",
            })),
            expectedField: isCompanyStep ? "company" : (eligibilitySession?.expectedField || "company"),
            in_eligibility_flow: inLoanEligibilityFlow,
            activeFlow: inLoanEligibilityFlow ? "LOAN_ELIGIBILITY" : (eligibilitySession?.activeFlow || "IDLE"),
            updatedAt: Date.now(),
          } as SessionState;
          await saveEligibilityState(conversationId, disambigState);
          return await finalizeAndReturn(
            { reply: compRes.reply, companyData: compRes.companyData },
            disambigState
          );
        }
        if (inLoanEligibilityFlow) {
          const normalizedName = compRes.companyData?.company_name || confirmedCompany;
          const normalizedCategory = extractNormalizedPolicyCategory(
            compRes.companyData?.bank_records,
            compRes.companyData?.overview?.category || compRes.companyData?.overview?.company_category
          );
          currentApplicant.companyName = normalizedName;
          currentApplicant.companyCategory = normalizedCategory;

          const nextField = currentApplicant.monthlyIncome
            ? currentApplicant.existingEmi !== undefined
              ? currentApplicant.cibil !== undefined
                ? currentApplicant.age
                  ? "loanAmount"
                  : "age"
                : "cibilScore"
              : "existingEmi"
            : "monthlyIncome";
          const nextPrompt = WATERFALL_PROMPTS[nextField] || `What is your monthly take-home salary?`;

          let replyText = compRes.reply;
          if (!replyText.includes("eligibility assessment") && !replyText.includes("monthly take-home salary") && !replyText.includes("salary or income")) {
            replyText += `\n\nNow let's continue with your eligibility assessment.\n${nextPrompt}`;
          }

          const remainingMissing = ELIGIBILITY_FIELD_SEQUENCE.filter((f) => {
            if (f === "company") return false;
            if (f === "monthlyIncome" && currentApplicant.monthlyIncome) return false;
            if (f === "existingEmi" && currentApplicant.existingEmi !== undefined) return false;
            if (f === "cibilScore" && currentApplicant.cibil !== undefined) return false;
            if (f === "age" && currentApplicant.age) return false;
            return true;
          });

          const activeState: SessionState = {
            ...(eligibilitySession || {}),
            applicant: currentApplicant,
            company: normalizedName,
            companyCategory: normalizedCategory,
            selectedCompanyName: normalizedName,
            selectedCompany: normalizedName,
            expectedField: nextField,
            missingFields: remainingMissing,
            in_eligibility_flow: true,
            activeFlow: "LOAN_ELIGIBILITY",
            sessionVariables: {
              ...(eligibilitySession?.sessionVariables || {}),
              employer: normalizedName,
              Employer_Name: normalizedName,
              lastPromptedSlot: nextField,
            },
            updatedAt: Date.now(),
          } as SessionState;

          await saveEligibilityState(conversationId, activeState);
          return await finalizeAndReturn(
            { reply: replyText, companyData: compRes.companyData },
            activeState
          );
        }
        return compRes;
      }
    } else {
      // No company specified or known yet: ask user for their company name
      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        activeFlow: "COMPANY_SEARCH",
        mainUserGoal: "COMPANY_SEARCH",
        in_eligibility_flow: false,
        expectedField: "companyName",
        expectedEntity: "companyName",
        currentStep: "COMPANY_SEARCH_INPUT",
        updatedAt: Date.now(),
      } as SessionState;
      await saveEligibilityState(conversationId, updatedSession);
      return {
        reply: "I'd be glad to look up your company's corporate intelligence and partner bank category ratings!\n\nCould you please share your **employer or company name**? Let me know so I can check its details.",
      };
    }
  }

  let isCandidateCompanyQuery = false;
  if (!isPostEvalOrBankManager && !isDirectEmiCalcRequest && !isPureGreeting(userMessage) && !isCompanyInquiry) {
    const cleanCand = extractCleanCompanyName(userMessage);
    const rawClean = cleanCand || (userMessage.trim().length <= 40 ? userMessage.trim() : "");
    if (
      rawClean.length >= 2 &&
      rawClean.length <= 60 &&
      !isInvalidCompanyName(rawClean) &&
      !isFinancialOrProfileInput(rawClean) &&
      !isLocationInput(rawClean) &&
      !isKnownBankName(rawClean) &&
      !isQuestionMessage(userMessage)
    ) {
      if (isCompanyStep || hasExplicitEmployerPhrase || isAwaitingCompanySelection) {
        isCandidateCompanyQuery = true;
      }
    }
  }

  if (isAwaitingCompanySelection || isCompanyStep || hasExplicitEmployerPhrase || isCandidateCompanyQuery) {
    const companyFlowResult = await handleCompanySelectionFlow(
      conversationId,
      userMessage,
      currentApplicant,
      eligibilitySession,
      companySelectionAction,
      conversationHistory
    );
    if (companyFlowResult) {
      const streamToken = agentTokenStorage.getStore();
      const streamedTokens = (opts as any)._getTokensStreamed ? (opts as any)._getTokensStreamed() : 0;
      if (streamToken && streamedTokens === 0 && companyFlowResult.reply && companyFlowResult.reply.trim().length > 0) {
        const chunks = companyFlowResult.reply.split(/(\s+)/);
        for (const chunk of chunks) {
          if (chunk) {
            streamToken(chunk);
          }
        }
      }
      return companyFlowResult;
    }
  }

  // =========================================================================
  // PERSONAL LOAN ELIGIBILITY ASSISTANT (SLOT-FILLING STATE MACHINE)
  // Powered by external custom webhook (app/api/antigravity/webhook/route.ts)
  // Strictly enforces:
  // - LAW 1: Webhook execution on every turn
  // - LAW 2: Non-overwrite merging
  // - LAW 3: Waterfall priority (employer -> requestedAmount -> tenureMonths -> cibilScore -> age)
  // - LAW 4: Acknowledgment without repeating or hallucinating
  // - LAW 5: 23-bank evaluation table output when complete
  // =========================================================================
  const isBankManagerInquiry = /manager|contact|branch\s*head|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b/i.test(normUserMsg);
  if (
    (!isPostEvalOrBankManager || isProfileUpdateIntent) &&
    inLoanEligibilityFlow &&
    !isPureGreeting(userMessage) &&
    !isGreetingOrPleasantry(userMessage) &&
    !isBankManagerInquiry
  ) {
    const storedSessionVars: Record<string, any> = {
      ...(eligibilitySession?.sessionVariables || {}),
    };

    let existingComp =
      eligibilitySession?.company ||
      eligibilitySession?.selectedCompanyName ||
      eligibilitySession?.companyFlow?.selectedCompanyName ||
      storedSessionVars.employer ||
      storedSessionVars.Employer_Name;

    if (isMissingOrPlaceholderCompany(existingComp)) {
      existingComp = undefined;
      delete storedSessionVars.employer;
      delete storedSessionVars.Employer_Name;
      currentApplicant.companyName = undefined;
      currentApplicant.companyCategory = undefined;
      if (eligibilitySession) {
        eligibilitySession.company = undefined;
        eligibilitySession.companyCategory = undefined;
        eligibilitySession.selectedCompanyName = undefined;
      }
    }

    // =========================================================================
    // ENFORCE MANDATORY COMPANY VERIFICATION FIRST (Step 1 & Step 2)
    // =========================================================================
    if (!existingComp) {
      // 1. Check if user is asking a side question, inquiry, objection, or educational concept
      const sideQ = detectAndAnswerSideQuestion(userMessage, "company");
      const commonQ = answerCommonBankingQuestion(userMessage, "company");
      const isQuestionLike =
        sideQ.isQuestion ||
        Boolean(commonQ) ||
        isQuestionMessage(userMessage) ||
        /\?$/.test(normUserMsg) ||
        /^(?:why|how|what|who|where|can\s*(?:i|you)|could|does|is\s*it|are\s*there|will\s*it|tell\s*me|explain)\b/i.test(normUserMsg);

      if (isQuestionLike) {
        let answerText = commonQ || (sideQ.answer && sideQ.answer.trim().length > 0 ? sideQ.answer.trim() : "");
        if (!answerText) {
          answerText = await answerGeneralQuestionWithLLM(userMessage, requestedModel);
        }
        if (answerText) {
          const bridge = buildContextualEligibilityResumptionBridge(currentApplicant, "company");
          return await finalizeAndReturn(
            { reply: `${answerText.trim()}${bridge}` },
            {
              applicant: currentApplicant,
              company: undefined,
              companyCategory: undefined,
              expectedField: "company",
              in_eligibility_flow: true,
            }
          );
        }
      }

      // 2. Prevent non-company entities (e.g., cities like "banglor", "pune", "mumbai") from being stored as company
      if (isLocationInput(userMessage) || isLocationInput(normUserMsg)) {
        await saveEligibilityState(conversationId, {
          ...(eligibilitySession || {}),
          applicant: currentApplicant,
          company: undefined,
          companyCategory: undefined,
          selectedCompanyName: undefined,
          expectedField: "company",
          missingFields: [...ELIGIBILITY_FIELD_SEQUENCE],
          in_eligibility_flow: true,
          activeFlow: "LOAN_ELIGIBILITY",
          updatedAt: Date.now(),
        } as any);

        return await finalizeAndReturn(
          { reply: MANDATORY_COMPANY_PROMPT },
          {
            company: undefined,
            companyCategory: undefined,
            expectedField: "company",
            in_eligibility_flow: true,
          }
        );
      }

      // 3. Extract company candidate from user message
      const rawCompCandidate =
        isQuestionMessage(userMessage)
          ? ""
          : (extractCleanCompanyName(userMessage) ||
             extractCompanyCandidateFromText(userMessage, "company") ||
             extractCompoundLoanCompanyIntent(userMessage).companyCandidate);

      const isValidCandidate =
        rawCompCandidate &&
        !isMissingOrPlaceholderCompany(rawCompCandidate) &&
        !isLocationInput(rawCompCandidate) &&
        !isInvalidCompanyName(rawCompCandidate);

      if (isValidCandidate) {
        // Automatic company category lookup against 23-bank database BEFORE asking for salary or downstream fields
        const compRes = await executeSearchCompanyCategory(
          { companyName: rawCompCandidate },
          userMessage,
          true,
          eligibilitySession
        );

        if (
          compRes.companyData?.needs_disambiguation &&
          compRes.companyData?.candidateOptions &&
          compRes.companyData.candidateOptions.length > 1
        ) {
          await saveEligibilityState(conversationId, {
            ...(eligibilitySession || {}),
            applicant: currentApplicant,
            companyFlow: {
              stage: "COMPANY_SELECTION",
              rawQuery: rawCompCandidate,
              candidates: compRes.companyData.candidateOptions,
            },
            awaitingEmployerConfirmation: true,
            employerConfirmationQuery: rawCompCandidate,
            employerConfirmationOptions: compRes.companyData.candidateOptions.map((c: any) => ({
              name: c.name,
              categoryLabel: c.categoryLabel || c.category || "Standard",
            })),
            expectedField: "company",
            in_eligibility_flow: true,
            activeFlow: "LOAN_ELIGIBILITY",
            updatedAt: Date.now(),
          } as any);

          return await finalizeAndReturn(
            { reply: compRes.reply, companyData: compRes.companyData },
            {
              companyFlow: {
                stage: "COMPANY_SELECTION",
                originalInput: rawCompCandidate,
                candidates: compRes.companyData.candidateOptions,
              },
              awaitingEmployerConfirmation: true,
              employerConfirmationQuery: rawCompCandidate,
              employerConfirmationOptions: compRes.companyData.candidateOptions.map((c: any) => ({
                name: c.name,
                categoryLabel: c.categoryLabel || c.category || "Standard",
              })),
              expectedField: "company",
              in_eligibility_flow: true,
            }
          );
        }

        const normalizedName = compRes.companyData?.company_name || rawCompCandidate;
        const normalizedCategory = extractNormalizedPolicyCategory(
          compRes.companyData?.bank_records,
          compRes.companyData?.overview?.category || compRes.companyData?.overview?.company_category
        );

        existingComp = normalizedName;
        currentApplicant.companyName = normalizedName;
        currentApplicant.companyCategory = normalizedCategory;
        storedSessionVars.employer = normalizedName;
        storedSessionVars.Employer_Name = normalizedName;

        // Extract any secondary parameters provided in the same turn
        const histParams = extractParametersFromConversationHistory([{ role: "user", content: userMessage }]);
        if (histParams.requestedAmount && !currentApplicant.loanAmount) {
          currentApplicant.loanAmount = histParams.requestedAmount;
          storedSessionVars.requestedAmount = histParams.requestedAmount;
          storedSessionVars.Requested_Loan_Amount = histParams.requestedAmount;
        }
        if (histParams.monthlyIncome && !currentApplicant.monthlyIncome) {
          currentApplicant.monthlyIncome = histParams.monthlyIncome;
          storedSessionVars.monthlyIncome = histParams.monthlyIncome;
        }
        if (histParams.existingEmi !== undefined && currentApplicant.existingEmi === undefined) {
          currentApplicant.existingEmi = histParams.existingEmi;
          storedSessionVars.existingEmi = histParams.existingEmi;
        }
        if (histParams.cibilScore !== undefined && currentApplicant.cibil === undefined) {
          currentApplicant.cibil = histParams.cibilScore;
          storedSessionVars.cibilScore = histParams.cibilScore;
        }
        if (histParams.age && !currentApplicant.age) {
          currentApplicant.age = histParams.age;
          storedSessionVars.age = histParams.age;
        }

        const nextField = currentApplicant.monthlyIncome
          ? currentApplicant.existingEmi !== undefined
            ? currentApplicant.cibil !== undefined
              ? currentApplicant.age
                ? "loanAmount"
                : "age"
              : "cibilScore"
            : "existingEmi"
          : "monthlyIncome";
        const nextPrompt = WATERFALL_PROMPTS[nextField] || `What is your monthly take-home salary?`;

        let replyText = compRes.reply;
        if (!replyText.includes("eligibility assessment")) {
          replyText += `\n\nNow let's continue with your eligibility assessment.\n${nextPrompt}`;
        }

        const remainingMissing = ELIGIBILITY_FIELD_SEQUENCE.filter((f) => {
          if (f === "company") return false;
          if (f === "monthlyIncome" && currentApplicant.monthlyIncome) return false;
          if (f === "existingEmi" && currentApplicant.existingEmi !== undefined) return false;
          if (f === "cibilScore" && currentApplicant.cibil !== undefined) return false;
          if (f === "age" && currentApplicant.age) return false;
          return true;
        });

        const updatedSessionState: Partial<SessionState> = {
          ...(eligibilitySession || {}),
          applicant: currentApplicant,
          company: normalizedName,
          companyCategory: normalizedCategory,
          selectedCompanyName: normalizedName,
          selectedCompany: normalizedName,
          expectedField: nextField,
          missingFields: remainingMissing,
          in_eligibility_flow: true,
          activeFlow: "LOAN_ELIGIBILITY",
          sessionVariables: {
            ...storedSessionVars,
            employer: normalizedName,
            Employer_Name: normalizedName,
            lastPromptedSlot: nextField,
          },
          updatedAt: Date.now(),
        };

        await saveEligibilityState(conversationId, updatedSessionState as SessionState);

        return await finalizeAndReturn(
          { reply: replyText, companyData: compRes.companyData },
          {
            company: normalizedName,
            companyCategory: normalizedCategory,
            expectedField: nextField,
            in_eligibility_flow: true,
          }
        );
      } else {
        // Missing company and no company candidate in userMessage
        const loanAmtMatch = normalizeLoanAmount(userMessage);
        if (loanAmtMatch && loanAmtMatch >= 10000 && !currentApplicant.loanAmount) {
          currentApplicant.loanAmount = loanAmtMatch;
          storedSessionVars.requestedAmount = loanAmtMatch;
          storedSessionVars.Requested_Loan_Amount = loanAmtMatch;
        }

        const updatedSessionState: Partial<SessionState> = {
          ...(eligibilitySession || {}),
          applicant: currentApplicant,
          company: undefined,
          companyCategory: undefined,
          selectedCompanyName: undefined,
          expectedField: "company",
          missingFields: [...ELIGIBILITY_FIELD_SEQUENCE],
          in_eligibility_flow: true,
          activeFlow: "LOAN_ELIGIBILITY",
          mainUserGoal: "PERSONAL_LOAN",
          sessionVariables: {
            ...storedSessionVars,
            lastPromptedSlot: "employer",
          },
          updatedAt: Date.now(),
        };

        await saveEligibilityState(conversationId, updatedSessionState as SessionState);

        return await finalizeAndReturn(
          { reply: MANDATORY_COMPANY_PROMPT },
          {
            company: undefined,
            companyCategory: undefined,
            expectedField: "company",
            in_eligibility_flow: true,
          }
        );
      }
    }

    // =========================================================================
    // STATE PRESERVATION: COMPANY VERIFIED
    // =========================================================================
    const verifiedCategory =
      currentApplicant.companyCategory ||
      eligibilitySession?.companyCategory ||
      "Unlisted";

    const lastAssistantMsgInHist = conversationHistory && conversationHistory.length > 0
      ? [...conversationHistory].reverse().find(m => m.role === "assistant" || m.role === "ai")?.content
      : undefined;
    const detectedSlotFromAssistant = lastAssistantMsgInHist
      ? detectFieldPromptedInAssistantMessage(lastAssistantMsgInHist)
      : undefined;
    const mappedSlotFromAssistant =
      detectedSlotFromAssistant === "loanAmount"
        ? "requestedAmount"
        : (detectedSlotFromAssistant === "company" || detectedSlotFromAssistant === "companySelection")
        ? "employer"
        : detectedSlotFromAssistant;

    const mappedSlotFromExpected =
      eligibilitySession?.expectedField === "loanAmount"
        ? "requestedAmount"
        : eligibilitySession?.expectedField === "company"
        ? "employer"
        : eligibilitySession?.expectedField === "cibil"
        ? "cibilScore"
        : eligibilitySession?.expectedField;

    const resolvedLastPromptedSlot =
      mappedSlotFromAssistant ||
      mappedSlotFromExpected ||
      storedSessionVars.lastPromptedSlot;

    if (resolvedLastPromptedSlot) {
      storedSessionVars.lastPromptedSlot = resolvedLastPromptedSlot;
    }

    const priorSessionVars: Record<string, any> = {
      ...storedSessionVars,
      employer: existingComp,
      Employer_Name: existingComp,
      ...(resolvedLastPromptedSlot ? { lastPromptedSlot: resolvedLastPromptedSlot } : {}),
      ...(currentApplicant.loanAmount ? { requestedAmount: Number(currentApplicant.loanAmount) } : {}),
      ...(currentApplicant.tenureMonths ? { tenureMonths: Number(currentApplicant.tenureMonths) } : {}),
      ...(currentApplicant.cibil !== undefined ? { cibilScore: currentApplicant.cibil } : {}),
      ...(currentApplicant.age ? { age: Number(currentApplicant.age) } : {}),
      ...(currentApplicant.monthlyIncome ? { monthlyIncome: Number(currentApplicant.monthlyIncome) } : {}),
      ...(currentApplicant.existingEmi !== undefined ? { existingEmi: Number(currentApplicant.existingEmi) } : {}),
    };

    const webhookResult = await processAntigravityWebhook({
      sessionVariables: priorSessionVars,
      userMessage,
      conversationHistory,
      extractedEntities: {
        employer: existingComp,
        Employer_Name: existingComp,
        ...(currentApplicant.loanAmount ? { requestedAmount: currentApplicant.loanAmount } : {}),
        ...(currentApplicant.tenureMonths ? { tenureMonths: currentApplicant.tenureMonths } : {}),
        ...(currentApplicant.cibil !== undefined ? { cibilScore: currentApplicant.cibil } : {}),
        ...(currentApplicant.age ? { age: currentApplicant.age } : {}),
        ...(currentApplicant.monthlyIncome ? { monthlyIncome: currentApplicant.monthlyIncome } : {}),
        ...(currentApplicant.existingEmi !== undefined ? { existingEmi: currentApplicant.existingEmi } : {}),
      },
      companySelectionAction,
    });

    const updatedSessionVars = webhookResult.sessionVariables;

    currentApplicant.companyName = existingComp;
    currentApplicant.companyCategory = verifiedCategory;
    updatedSessionVars.employer = existingComp;
    updatedSessionVars.Employer_Name = existingComp;
    if (updatedSessionVars.requestedAmount) currentApplicant.loanAmount = updatedSessionVars.requestedAmount;
    if (updatedSessionVars.tenureMonths) currentApplicant.tenureMonths = updatedSessionVars.tenureMonths;
    if (updatedSessionVars.cibilScore !== undefined) currentApplicant.cibil = updatedSessionVars.cibilScore;
    if (updatedSessionVars.age) currentApplicant.age = updatedSessionVars.age;
    if (updatedSessionVars.monthlyIncome) currentApplicant.monthlyIncome = updatedSessionVars.monthlyIncome;
    if (updatedSessionVars.existingEmi !== undefined) currentApplicant.existingEmi = updatedSessionVars.existingEmi;

    if (webhookResult.isComplete) {
      const totalEvaluated = webhookResult.totalEvaluated || 22;
      const eligibleCount = webhookResult.eligibleCount || 0;
      let evalHeader = eligibleCount > 0
        ? `🎉 **Personal Loan Eligibility Evaluation Complete**\n\n`
        : `❌ **Personal Loan Eligibility Assessment — Policy Criteria Not Met**\n\n`;
      evalHeader += `Based on your profile at **${updatedSessionVars.employer}**, here are your qualifying options evaluated against **${totalEvaluated} partner bank policies**:\n\n`;

      let updateNotice = "";
      if (isProfileUpdateIntent) {
        const emi = updatedSessionVars.existingEmi || 0;
        const cibil = updatedSessionVars.cibilScore || 700;
        const maxAmt = webhookResult.policyCalculations?.maxLoanAmount;
        updateNotice = `> **Profile Update Noted:** Your net salary has been updated to **₹${(updatedSessionVars.monthlyIncome || 0).toLocaleString("en-IN")}/month** while maintaining your existing car EMI of **₹${emi.toLocaleString("en-IN")}/month** and baseline CIBIL of **${cibil}**. Your maximum loan capacity has been recalculated${maxAmt ? ` to **₹${maxAmt.toLocaleString("en-IN")}**` : ""}!\n\n`;
      }

      const report = updateNotice + (webhookResult.fullReport || (
        (webhookResult.cibilNotice || "") +
        evalHeader +
        (webhookResult.markdownTable || "") +
        `\n\n` +
        `**Summary**: ${webhookResult.summary}\n\n` +
        `**Next Steps**: ${webhookResult.nextSteps}`
      ));

      await saveEligibilityState(conversationId, {
        applicant: currentApplicant,
        company: existingComp,
        companyCategory: verifiedCategory,
        selectedCompanyName: existingComp,
        selectedCompany: existingComp,
        sessionVariables: updatedSessionVars,
        expectedField: "selectedBank",
        missingFields: [],
        in_eligibility_flow: false,
        hasCompletedEvaluation: true,
        evaluationCompleted: true,
        eligible_banks: (webhookResult.evaluationResults || [])
          .filter((b) => b.status === "ELIGIBLE")
          .map((b) => b.bankName),
        topBank: (webhookResult.evaluationResults || []).find((b) => b.status === "ELIGIBLE")?.bankName || "",
        selectedBank: "",
        chosenBank: "",
        postEligibilityStage: "ELIGIBILITY_CONFIRMED",
        updatedAt: Date.now(),
      } as any);

      const bankDataForClient = (webhookResult.evaluationResults || []).map((ev) => ({
        bank_id: ev.bankId,
        bank_name: ev.bankName,
        status: ev.status,
        is_eligible: ev.status === "ELIGIBLE",
        roi: ev.roi,
        monthly_emi: ev.estimatedEmi,
        failure_reasons: ev.failureReasons,
      }));

      return await finalizeAndReturn({ reply: report, bankData: bankDataForClient }, {
        company: existingComp,
        companyCategory: verifiedCategory,
        selectedCompanyName: existingComp,
        selectedCompany: existingComp,
        in_eligibility_flow: false,
        hasCompletedEvaluation: true,
        evaluationCompleted: true,
      });
    } else {
      const nextMissingField = webhookResult.nextSlotRequired || "monthlyIncome";

      await saveEligibilityState(conversationId, {
        applicant: currentApplicant,
        company: existingComp,
        companyCategory: verifiedCategory,
        selectedCompanyName: existingComp,
        selectedCompany: existingComp,
        sessionVariables: updatedSessionVars,
        expectedField: nextMissingField,
        missingFields: webhookResult.missingSlots,
        awaitingEmployerConfirmation: updatedSessionVars.awaitingEmployerConfirmation,
        employerConfirmationQuery: updatedSessionVars.employerConfirmationQuery,
        employerConfirmationOptions: updatedSessionVars.employerConfirmationOptions,
        in_eligibility_flow: true,
        updatedAt: Date.now(),
      } as any);

      const newlyAnsweredParts: string[] = [];
      if (storedSessionVars.employer !== updatedSessionVars.employer && updatedSessionVars.employer) {
        newlyAnsweredParts.push(`employer as **${updatedSessionVars.employer}**`);
      }
      if (storedSessionVars.requestedAmount !== updatedSessionVars.requestedAmount && updatedSessionVars.requestedAmount) {
        newlyAnsweredParts.push(`loan amount as **₹${updatedSessionVars.requestedAmount.toLocaleString("en-IN")}**`);
      }
      if (storedSessionVars.monthlyIncome !== updatedSessionVars.monthlyIncome && updatedSessionVars.monthlyIncome) {
        newlyAnsweredParts.push(`monthly income as **₹${updatedSessionVars.monthlyIncome.toLocaleString("en-IN")}**`);
      }
      if (storedSessionVars.existingEmi !== updatedSessionVars.existingEmi && updatedSessionVars.existingEmi !== undefined) {
        if (updatedSessionVars.existingEmi === 0) {
          newlyAnsweredParts.push(`existing EMI as **₹0**`);
        } else {
          newlyAnsweredParts.push(`existing EMI as **₹${updatedSessionVars.existingEmi.toLocaleString("en-IN")}**`);
        }
      }
      if (storedSessionVars.tenureMonths !== updatedSessionVars.tenureMonths && updatedSessionVars.tenureMonths) {
        newlyAnsweredParts.push(`repayment tenure as **${updatedSessionVars.tenureMonths} months** (${Math.round(updatedSessionVars.tenureMonths / 12)} years)`);
      }
      if (storedSessionVars.cibilScore !== updatedSessionVars.cibilScore && updatedSessionVars.cibilScore !== undefined) {
        if (updatedSessionVars.cibilScore === "NOT_SURE" || updatedSessionVars.cibilWasAssumed) {
          const userSaidNoCibil =
            normUserMsg.includes("no cibil") ||
            normUserMsg.includes("zero credit") ||
            normUserMsg.includes("credit history") ||
            normUserMsg.includes("not sure") ||
            normUserMsg.includes("dont know") ||
            normUserMsg.includes("don't know") ||
            normUserMsg.includes("nha") ||
            storedSessionVars.lastPromptedSlot === "cibilScore";
          if (userSaidNoCibil) {
            newlyAnsweredParts.push(`baseline CIBIL score as **700** *(assumed)*`);
          }
        } else {
          newlyAnsweredParts.push(`CIBIL score as **${updatedSessionVars.cibilScore}**`);
        }
      }
      if (storedSessionVars.age !== updatedSessionVars.age && updatedSessionVars.age) {
        newlyAnsweredParts.push(`age as **${updatedSessionVars.age} years**`);
      }

      let ackPrefix = "";
      if (newlyAnsweredParts.length > 0) {
        const empContext = (storedSessionVars.employer && !newlyAnsweredParts.some(p => p.includes("employer")))
          ? ` for your application at **${updatedSessionVars.employer}**`
          : "";
        const priorContextParts: string[] = [];
        if (storedSessionVars.requestedAmount && !newlyAnsweredParts.some(p => p.includes("loan amount"))) {
          priorContextParts.push(`loan amount of ₹${storedSessionVars.requestedAmount.toLocaleString("en-IN")}`);
        }
        if (storedSessionVars.monthlyIncome && !newlyAnsweredParts.some(p => p.includes("monthly income"))) {
          priorContextParts.push(`monthly salary of ₹${storedSessionVars.monthlyIncome.toLocaleString("en-IN")}`);
        }
        const priorContext = priorContextParts.length > 0 ? ` (retaining ${priorContextParts.join(" and ")})` : "";
        ackPrefix = `Got it! Noted your ${newlyAnsweredParts.join(", ")}${priorContext}${empContext}.\n\n`;
      }

      let cibilNoticePrefix = "";
      if (
        updatedSessionVars.cibilWasAssumed &&
        (
          normUserMsg.includes("no cibil") ||
          normUserMsg.includes("zero credit") ||
          normUserMsg.includes("credit history") ||
          normUserMsg.includes("not sure") ||
          normUserMsg.includes("don't know") ||
          normUserMsg.includes("dont know") ||
          normUserMsg.includes("nha") ||
          storedSessionVars.lastPromptedSlot === "cibilScore"
        )
      ) {
        cibilNoticePrefix = `> "Note: Since no CIBIL score was provided, I am assuming a baseline CIBIL score of 700 to calculate your eligibility."\n\n`;
      }

      // Side-Question Resilience: In-flow EMI calculations
      let emiPrefix = "";
      const isEmiAsk = /\bemi\b/i.test(userMessage) && (/(?:calculate|tell\s*me|what\s*is|how\s*much|find)\b/i.test(userMessage) || /%|\brat(?:e|es)\b/i.test(userMessage));
      if (isEmiAsk) {
        const emiPrincipal = updatedSessionVars.requestedAmount || normalizeLoanAmount(userMessage);
        const emiTenure = updatedSessionVars.tenureMonths || normalizeTenureMonths(userMessage) || 36;
        const rateMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*%/);
        const emiRate = rateMatch ? parseFloat(rateMatch[1]) : 10.5;
        if (emiPrincipal && emiTenure) {
          const monthlyRate = emiRate / 12 / 100;
          const emiVal = Math.round(
            (emiPrincipal * monthlyRate * Math.pow(1 + monthlyRate, emiTenure)) /
            (Math.pow(1 + monthlyRate, emiTenure) - 1)
          );
          const totalPayable = emiVal * emiTenure;
          const totalInterest = Math.max(0, totalPayable - emiPrincipal);
          emiPrefix =
            `### 🧮 Loan EMI Calculation\n\n` +
            `#### 1. Calculation Breakdown\n` +
            `| Metric | Amount |\n` +
            `| :--- | :--- |\n` +
            `| **Estimated Monthly EMI** | **₹${emiVal.toLocaleString("en-IN")}/month** |\n` +
            `| **Total Interest Payable** | **₹${totalInterest.toLocaleString("en-IN")}** |\n` +
            `| **Total Repayment Amount** | **₹${totalPayable.toLocaleString("en-IN")}** |\n\n` +
            `#### 2. Parameters Used in Formula\n` +
            `* **Principal Amount (P)**: ₹${emiPrincipal.toLocaleString("en-IN")}\n` +
            `* **Annual Interest Rate (R)**: ${emiRate}% p.a. (Monthly Rate: ${(monthlyRate * 100).toFixed(4)}%)\n` +
            `* **Repayment Tenure (N)**: ${emiTenure} months (${(emiTenure / 12).toFixed(1)} years)\n\n` +
            `---\n\n`;
        }
      }

      const commonQAns = answerCommonBankingQuestion(userMessage);
      const sideQ = detectAndAnswerSideQuestion(userMessage, nextMissingField);
      let sideQPrefix = "";
      if (commonQAns) {
        sideQPrefix = `> [!NOTE]\n> **Answering your question:** ${commonQAns}\n\n`;
      } else if (sideQ.isQuestion && sideQ.answer) {
        sideQPrefix = `> [!NOTE]\n> **Answering your question:** ${sideQ.answer.trim()}\n\n`;
      }

      return await finalizeAndReturn({
        reply: `${emiPrefix}${cibilNoticePrefix}${sideQPrefix}${ackPrefix}${webhookResult.prompt}`,
        ...(webhookResult.companyData ? { companyData: webhookResult.companyData, companyQuery: webhookResult.employerConfirmationQuery } : {}),
      }, {
        applicant: currentApplicant,
        sessionVariables: updatedSessionVars,
        missingFields: webhookResult.missingSlots,
        company: existingComp,
        companyCategory: verifiedCategory,
        selectedCompanyName: existingComp,
        selectedCompany: existingComp,
        expectedField: nextMissingField === "employer" ? "monthlyIncome" : nextMissingField,
        in_eligibility_flow: true,
      });
    }
  }

  // =========================================================================
  // Proceed with loan / bank manager intent check
  // =========================================================================
  const isProceedLoanIntent =
    /(?:proceed\s+with\s+(?:the\s+|this\s+)?(?:bank|loan)?|apply\s+(?:for|with)\s+(?:the\s+|this\s+)?(?:bank|loan)?|i\s+want\s+to\s+proceed|how\s+to\s+proceed|how\s+to\s+apply|connect\s+(?:me\s+)?with\s+(?:the\s+)?(?:branch|manager)|contact\s+(?:the\s+)?manager|talk\s+to\s+(?:the\s+)?manager|find\s+(?:the\s+)?(?:bank\s+)?branch|show\s+(?:me\s+)?(?:the\s+)?(?:bank\s+)?manager\s*(?:contact\s*)?(?:list|details)?|display\s+(?:the\s+)?(?:bank\s+)?manager\s*(?:contact\s*)?(?:list|details)?)/i.test(normUserMsg) ||
    ((normUserMsg.startsWith("proceed") || normUserMsg.startsWith("apply")) && (normUserMsg.includes("bank") || normUserMsg.includes("loan")));

  // =========================================================================
  // 1b. DEDICATED COMPANY SEARCH & CORPORATE INTELLIGENCE INTERCEPTOR
  // Detects all company search queries and corporate intelligence requests:
  // e.g. "give me information of infosys company", "tell me about TCS", "company search",
  // "company serach", "search company wipro", "what is category of Infosys", "check company HCL".
  // =========================================================================
  const isAwaitingCompanySearchInput = Boolean(
    eligibilitySession?.currentStep === "COMPANY_SEARCH_INPUT" ||
    eligibilitySession?.expectedField === "companySearchQuery"
  );
  isAwaitingCompanySelection = Boolean(
    companySelectionAction ||
    eligibilitySession?.companyFlow?.stage === "COMPANY_SELECTION" ||
    eligibilitySession?.companyFlow?.stage === "COMPANY_CONFIRMATION" ||
    eligibilitySession?.awaitingEmployerConfirmation ||
    eligibilitySession?.sessionVariables?.awaitingEmployerConfirmation
  );
  // A completed eligibility assessment has its own deterministic bank-manager
  // state machine. It must consume the next answer before broad company lookup
  // can interpret a short bank spelling as an employer name.
  const isAwaitingBankManagerInput = Boolean(
    (eligibilitySession?.hasCompletedEvaluation || eligibilitySession?.evaluationCompleted) &&
    (eligibilitySession?.currentStep === "BANK_SELECTION" ||
      eligibilitySession?.currentStep === "CITY_COLLECTION" ||
      eligibilitySession?.currentStep === "BRANCH_SELECTION" ||
      eligibilitySession?.expectedField === "selectedBank" ||
      eligibilitySession?.expectedField === "city" ||
      eligibilitySession?.expectedField === "branchSelection" ||
      eligibilitySession?.postEligibilityStage === "ELIGIBILITY_CONFIRMED" ||
      eligibilitySession?.postEligibilityStage === "BANK_SELECTION" ||
      eligibilitySession?.postEligibilityStage === "BANK_MANAGER_DETAILS_INPUT" ||
      eligibilitySession?.postEligibilityStage === "BRANCH_SELECTION")
  );
  let isCompanySearchReq = isCompanyInfoOrSearchIntent(userMessage) || isAwaitingCompanySearchInput;
  let standaloneCompCandidate = "";

  hasExplicitEmployerPhrase = /^(?:(?:(?:i\s*am|i['"]?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by)\s+(?:(?:the|my|our)\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)\s+)|(?:(?:my|our|the)\s+(?:currently\s+|presently\s+)?(?:working\s+|current\s+|present\s+|existing\s+|previous\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?|workplace)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:working\s+|current\s+|present\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:my\s+)?(?:company|employer|organization|org)(?:\s*name)?\s*[:=-]\s*)|(?:work\s+(?:at|in|with|for)|works\s+(?:at|in|with|for)|working\s+(?:at|in|with|for)|employed\s+(?:at|by|in|with|for))|(?:(?:my\s+)?(?:company|employer)\s+is)|(?:(?:i\s*am|i'?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by))|(?:(?:change|update|correct)\s+(?:my\s+)?(?:company|employer|comapny))|(?:employer\s*[:=-]|company\s*[:=-]))\b/i.test(userMessage.trim());

  if (!isCompanySearchReq && !isAwaitingBankManagerInput && !isNaturalLoanQ && !isBankPolicyQuery && !isProceedLoanIntent && !isEligibleFlowActive && !hasExplicitEmployerPhrase && !isAwaitingCompanySelection) {
    const trimmed = userMessage.trim();
    if (
      trimmed.length >= 2 &&
      trimmed.length <= 40 &&
      !isInvalidCompanyName(trimmed) &&
      !isFinancialOrProfileInput(trimmed) &&
      !isLocationInput(trimmed) &&
      !isPureGreeting(trimmed) &&
      !detectLoanIntent(trimmed).isLoanIntent
    ) {
      const cleanCandidate = extractCleanCompanyName(trimmed) || trimmed;
      if (cleanCandidate && !isInvalidCompanyName(cleanCandidate)) {
        try {
          const compCheck = await searchCompany(cleanCandidate);
          if (compCheck?.found) {
            isCompanySearchReq = true;
            standaloneCompCandidate = cleanCandidate;
          }
        } catch {}
      }
    }
  }

  if (isCompanySearchReq && !isAwaitingBankManagerInput && !isNaturalLoanQ && !isBankPolicyQuery && !isProceedLoanIntent && !isAwaitingCompanySelection) {
    const rawTarget = standaloneCompCandidate || (isAwaitingCompanySearchInput
      ? userMessage
      : (extractTargetCompanyFromMessage(userMessage) || extractCleanCompanyName(userMessage) || ""));
    let targetComp = standaloneCompCandidate || extractCleanCompanyName(rawTarget) || (rawTarget && !isInvalidCompanyName(rawTarget) ? rawTarget.trim() : "");

    // If user asked about matching companies or company list without naming a company in this message,
    // check if we have previous search candidates or a previously searched company in the session
    if (!targetComp) {
      if (
        eligibilitySession?.companyFlow?.candidates &&
        Array.isArray(eligibilitySession.companyFlow.candidates) &&
        eligibilitySession.companyFlow.candidates.length > 0
      ) {
        const cands = eligibilitySession.companyFlow.candidates;
        const candidateNames = cands.map((c: any) => typeof c === "string" ? c : (c.name || c.company_name || String(c)));
        const qName = eligibilitySession.companyFlow.originalInput || eligibilitySession.companyFlow.normalizedCompany || "your search";
        const candidateListHtml = formatCompanyCandidateList(candidateNames, qName);
        return {
          reply: `Here are the matching companies for "${qName}":\n\n${candidateListHtml}`,
          companyData: {
            company_flow: "COMPANY_SELECTION",
            needs_disambiguation: true,
            candidates: cands,
            candidateOptions: cands,
            searchQuery: qName,
          },
        };
      }
      if (eligibilitySession?.selectedCompanyName && !isInvalidCompanyName(eligibilitySession.selectedCompanyName)) {
        targetComp = eligibilitySession.selectedCompanyName;
      } else if (eligibilitySession?.companyFlow?.selectedCompanyName && !isInvalidCompanyName(eligibilitySession.companyFlow.selectedCompanyName)) {
        targetComp = eligibilitySession.companyFlow.selectedCompanyName;
      } else if (eligibilitySession?.applicant?.companyName && !isInvalidCompanyName(eligibilitySession.applicant.companyName)) {
        targetComp = eligibilitySession.applicant.companyName;
      } else if (eligibilitySession?.referencedEntities?.lastMentionedCompany && !isInvalidCompanyName(eligibilitySession.referencedEntities.lastMentionedCompany)) {
        targetComp = eligibilitySession.referencedEntities.lastMentionedCompany;
      }
    }

    if (!targetComp) {
      // User asked for company search feature but didn't specify a company name (e.g. "company search", "company serach")
      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        activeFlow: "COMPANY_SEARCH",
        mainUserGoal: "COMPANY_SEARCH",
        in_eligibility_flow: false,
        expectedField: "companySearchQuery",
        expectedEntity: "companySearchQuery",
        currentStep: "COMPANY_SEARCH_INPUT",
        updatedAt: Date.now(),
      } as SessionState;
      await saveEligibilityState(conversationId, updatedSession);
      return {
        reply: "Which company or employer would you like to search? Please provide the company name, and I will retrieve their corporate intelligence and partner bank categorizations.",
      };
    }

    // Execute company search with target company
    const compRes = await executeSearchCompanyCategory(
      { companyName: targetComp },
      userMessage,
      isEligibleFlowActive,
      eligibilitySession
    );

    const canonicalName = compRes.companyData?.company_name || targetComp;
    const currentApplicant = eligibilitySession?.applicant || {};
    const updatedApplicant: ApplicantProfile = {
      ...currentApplicant,
      companyName: canonicalName,
      employmentType: currentApplicant.employmentType || "Salaried",
    };
    const missing = getRequiredPolicyFields(updatedApplicant);
    const nextField = missing[0] || "monthlyIncome";
    const nextStepText = `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`;

    if (compRes.companyData?.company_flow !== "COMPANY_SELECTION") {
      if (!compRes.reply.includes("eligibility assessment")) {
        compRes.reply += `\n\n${nextStepText}`;
      }

      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        activeFlow: "LOAN_ELIGIBILITY",
        mainUserGoal: "PERSONAL_LOAN",
        in_eligibility_flow: true,
        expectedField: nextField,
        missingFields: missing,
        applicant: updatedApplicant,
        currentStep: "ELIGIBILITY_INPUT",
        companyFlow: {
          stage: "ELIGIBILITY_INPUT",
          normalizedCompany: canonicalName,
          selectedCompanyName: canonicalName,
          selectedCompany: canonicalName,
          companyData: compRes.companyData,
        },
        selectedCompanyName: canonicalName,
        selectedCompany: canonicalName,
        updatedAt: Date.now(),
      } as SessionState;
      await saveEligibilityState(conversationId, updatedSession);
    } else {
      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        activeFlow: "COMPANY_SEARCH",
        mainUserGoal: "COMPANY_SEARCH",
        in_eligibility_flow: false,
        expectedField: undefined,
        currentStep: "COMPANY_SEARCH_ANSWERED",
        companyFlow: {
          stage: "COMPANY_SELECTION",
          candidates: compRes.companyData.candidates,
          originalInput: compRes.companyData.searchQuery,
        },
        updatedAt: Date.now(),
      } as SessionState;
      await saveEligibilityState(conversationId, updatedSession);
    }

    return compRes;
  }

  // =========================================================================
  // 2. PROCEED WITH BANK LOAN / CONNECT WITH BRANCH / BANK MANAGER INTERCEPTOR
  // When user expresses intent to proceed with a specific bank loan or find a bank branch/manager,
  // ask for their city if missing, then display the official bank manager directory table.
  // =========================================================================
  if (isProceedLoanIntent) {
    const bankInMsg = /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|\btata\b(?!.*consultancy)|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe|sbm|utkarsh|aditya|abfl|birla|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)/i.exec(normUserMsg);
    let targetBank = bankInMsg ? normalizeBankName(bankInMsg[0]) : "";
    if (!targetBank) {
      targetBank = eligibilitySession?.lastPolicyBank || eligibilitySession?.selectedBank || eligibilitySession?.chosenBank || (eligibilitySession as any)?.lastBankManagerSearch?.bank_name;
    }

    if (!targetBank) {
      return {
        reply: "Which partner bank would you like to proceed with for your personal loan?",
      };
    }

    const locParams = extractBankBranchLocationParams(userMessage, targetBank);
    const city = locParams.city || (locParams.pincode && isValidIndianPincode(locParams.pincode) ? resolvePincodeToCity(locParams.pincode) : "");

    if (!city) {
      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        selectedBank: targetBank,
        chosenBank: targetBank,
        expectedEntity: "city",
        expectedField: "city",
        currentStep: "CITY_COLLECTION",
        locationStep: "CITY_COLLECTION",
        postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
        in_eligibility_flow: false,
        updatedAt: Date.now(),
      } as SessionState;
      await saveEligibilityState(conversationId, updatedSession);
      return {
        reply: `To proceed with your **${targetBank}** personal loan and connect you with the nearest branch manager, which branch location, city, or pincode are you located in?`,
      };
    } else {
      return await executeSearchBankManagers(
        { bank_name: targetBank, city, branch: locParams.branch, pincode: locParams.pincode },
        userMessage,
        false,
        eligibilitySession,
        conversationId
      );
    }
  }

  // =========================================================================
  // 3. CITY COLLECTION HANDLING
  // If user is currently prompted for their city to find branches/managers
  // =========================================================================
  const isPostEvalActive = Boolean(
    eligibilitySession?.evaluationCompleted ||
    eligibilitySession?.hasCompletedEvaluation ||
    eligibilitySession?.postEligibilityStage === "BANK_MANAGER_RESULTS" ||
    eligibilitySession?.postEligibilityStage === "BRANCH_SELECTION" ||
    eligibilitySession?.postEligibilityStage === "BANK_MANAGER_DETAILS_INPUT" ||
    eligibilitySession?.postEligibilityStage === "BANK_SELECTION" ||
    eligibilitySession?.postEligibilityStage === "ELIGIBILITY_CONFIRMED"
  );

  const isCityStep = Boolean(
    !isPostEvalActive &&
    (eligibilitySession?.currentStep === "CITY_COLLECTION" ||
    eligibilitySession?.expectedField === "city" ||
    eligibilitySession?.expectedEntity === "city")
  );

  if (isCityStep && !isPureGreeting(userMessage) && !/^(?:reset|cancel|start\s*over)\b/i.test(normUserMsg)) {
    const targetBank = eligibilitySession?.selectedBank || eligibilitySession?.chosenBank || eligibilitySession?.lastPolicyBank || "Yes Bank";
    const locParams = extractBankBranchLocationParams(userMessage, targetBank, undefined, "city", eligibilitySession?.city);
    const resolvedCity = locParams.city || (locParams.pincode && isValidIndianPincode(locParams.pincode) ? resolvePincodeToCity(locParams.pincode) : "") || userMessage.trim().replace(/[.,!]/g, "");

    if (resolvedCity && resolvedCity.length >= 2 && !/^(?:policy|policies|guideline|guidelines|rule|rules|criteria|loan|bank)\b/i.test(resolvedCity)) {
      return await executeSearchBankManagers(
        { bank_name: targetBank, city: resolvedCity, branch: locParams.branch, pincode: locParams.pincode },
        userMessage,
        false,
        eligibilitySession,
        conversationId
      );
    }
  }

  // A selected employer is deterministic state, not an LLM interpretation.
  // Handle it before routing so selection (e.g. "1", "Tata Consultancy Services Limited") is not intercepted as an unanchored number
  isCompanyStep = Boolean(
    eligibilitySession?.expectedField === "companyName" ||
    eligibilitySession?.expectedField === "company" ||
    (eligibilitySession?.in_eligibility_flow && (
      (eligibilitySession?.missingFields || [])[0] === "companyName" ||
      (eligibilitySession?.missingFields || [])[0] === "company"
    ))
  );

  const isExplicitCompanyPhrase = /(?:(?:i\s+(?:work|working|am\s+working)\s+(?:at|in)|(?:my\s+)?(?:employer|company)\s+is|(?:work|working|employed)\s+(?:at|in|by)|employer\s*[:=-]|company\s*[:=-])|(?:change|changed|update|updated|correct|switch|switched|move|moved|leave|left|joined)\s+(?:my\s+)?(?:company|employer|job|workplace))\b/i.test(userMessage.trim());

  let hasTypoSuggestion = false;
  const cleanTrimmed = extractCleanCompanyName(userMessage) || userMessage.trim();
  if (
    !isCompanyStep &&
    !isPureGreeting(userMessage) &&
    !isFinancialOrProfileInput(userMessage) &&
    !isLocationInput(userMessage) &&
    !isKnownBankName(userMessage) &&
    !detectLoanIntent(userMessage).isLoanIntent &&
    cleanTrimmed.length >= 2 &&
    cleanTrimmed.length <= 40 &&
    !isInvalidCompanyName(cleanTrimmed)
  ) {
    try {
      const suggestions = await findCompanySuggestions(cleanTrimmed);
      if (suggestions && suggestions.length > 0) {
        hasTypoSuggestion = true;
      }
    } catch {}
  }

  if (
    eligibilitySession?.companyFlow?.stage === "COMPANY_SELECTION" ||
    eligibilitySession?.companyFlow?.stage === "COMPANY_CONFIRMATION" ||
    companySelectionAction ||
    isExplicitCompanyPhrase ||
    hasTypoSuggestion ||
    (isCompanyStep && !isInvalidCompanyName(userMessage) && !isFinancialOrProfileInput(userMessage) && !isPureGreeting(userMessage))
  ) {
    const companyFlowResult = await handleCompanySelectionFlow(
      conversationId,
      userMessage,
      currentApplicant,
      eligibilitySession,
      companySelectionAction,
      conversationHistory
    );
    if (companyFlowResult) return companyFlowResult;
  }

  // =========================================================================
  // CREDITWISE CONVERSATIONAL NLP & MULTIDIMENSIONAL SEMANTIC LAYER (PHASE 4)
  // Interpretation layer only: No direct DB mutation or finance calculations
  // =========================================================================
  const hasActiveOrSuspendedFlow = Boolean(
    isEligibleFlowActive ||
    (eligibilitySession?.taskStack && eligibilitySession.taskStack.length > 0) ||
    eligibilitySession?.companyFlow?.stage === "COMPANY_SELECTION" ||
    eligibilitySession?.companyFlow?.stage === "COMPANY_CONFIRMATION" ||
    (eligibilitySession?.mainUserGoal === "PERSONAL_LOAN" &&
      eligibilitySession?.applicant &&
      !eligibilitySession?.hasCompletedEvaluation &&
      !eligibilitySession?.evaluationCompleted)
  );

  const nluContext: NluContext = {
    isFlowActive: hasActiveOrSuspendedFlow,
    expectedField: eligibilitySession?.expectedField,
    existingApplicant: eligibilitySession?.applicant || currentApplicant,
    recentMessages: conversationHistory,
    activeFlow: eligibilitySession?.activeFlow || (isEligibleFlowActive ? "LOAN_ELIGIBILITY" : "IDLE"),
    mainUserGoal: eligibilitySession?.mainUserGoal || (hasActiveOrSuspendedFlow ? "PERSONAL_LOAN" : "UNKNOWN"),
    taskStack: eligibilitySession?.taskStack || [],
    lastAssistantQuestion: eligibilitySession?.lastAssistantQuestion,
  };

  // Analyze message semantically
  const nluResult: StructuredNluResult = await analyzeConversationSemanticIntent(
    userMessage,
    nluContext,
    requestedModel
  );

  // Deterministic Validation Firewall (Stage 6)
  const validation = validateAndSanitizeEntityUpdate(
    eligibilitySession?.applicant || currentApplicant,
    eligibilitySession?.expectedField,
    (nluResult.entities || {}) as Partial<ApplicantProfile>,
    userMessage
  );

  // 1. CLARIFICATION required (e.g. Ambiguous numbers like "76", or out-of-range inputs)
  if (nluResult.clarificationRequired?.isAmbiguous || validation.isAmbiguousNumber) {
    const clarificationReply =
      nluResult.clarificationRequired?.clarificationPrompt ||
      validation.clarificationNeeded ||
      "Could you please clarify your input?";
    return await finalizeAndReturn({
      reply: clarificationReply,
    }, {
      applicant: eligibilitySession?.applicant || currentApplicant,
      expectedField: eligibilitySession?.expectedField,
      in_eligibility_flow: isEligibleFlowActive,
    });
  }

  // 2. RESET command
  if (nluResult.conversationAction === "RESET") {
    await clearEligibilityState(conversationId);
    return {
      reply: "Your session has been reset. How can I help you today? You can ask about personal loans, check eligibility, calculate EMI, or inquire about bank policies.",
    };
  }

  // 3. RESUME command
  if (nluResult.conversationAction === "RESUME") {
    if (eligibilitySession && eligibilitySession.taskStack && eligibilitySession.taskStack.length > 0) {
      const suspendedTask = popTaskFromStack(eligibilitySession);
      if (suspendedTask) {
        const resumedApplicant = { ...(eligibilitySession.applicant || currentApplicant), ...suspendedTask.applicantSnapshot };
        const remaining = getRequiredPolicyFields(resumedApplicant);
        const resumedExpected = suspendedTask.expectedField || remaining[0];
        const planned = planResponse({
          nluResult,
          session: eligibilitySession,
          suspendedTask,
          nextMissingField: resumedExpected,
        });
        return await finalizeAndReturn({
          reply: planned.combinedResponse,
        }, {
          applicant: resumedApplicant,
          expectedField: resumedExpected,
          activeFlow: suspendedTask.taskType,
          in_eligibility_flow: true,
          taskStack: eligibilitySession.taskStack,
        });
      }
    }
  }

  // 4. CORRECTION command
  if (nluResult.conversationAction === "CORRECTION" && nluResult.corrections.length > 0) {
    const updatedApplicant: ApplicantProfile = {
      ...(eligibilitySession?.applicant || currentApplicant),
      ...validation.sanitized,
    };
    const remaining = getRequiredPolicyFields(updatedApplicant);
    const nextField = remaining[0];
    const planned = planResponse({
      nluResult,
      session: eligibilitySession || ({} as any),
      nextMissingField: nextField,
    });
    const bankCorrection = nluResult.corrections.find((c) => (c.field as string) === "targetBank" || (c.field as string) === "bank" || (c.field as string) === "selectedBank");
    const correctedBank = bankCorrection ? String(bankCorrection.newValue) : undefined;

    return await finalizeAndReturn({
      reply: planned.combinedResponse,
    }, {
      applicant: updatedApplicant,
      expectedField: nextField,
      in_eligibility_flow: isEligibleFlowActive,
      lastPolicyBank: correctedBank || eligibilitySession?.lastPolicyBank,
      selectedBank: correctedBank || eligibilitySession?.selectedBank,
      chosenBank: correctedBank || eligibilitySession?.chosenBank,
    });
  }

  // Context-aware company resolver for anaphoric references (e.g. "my company", "compny")
  const resolveContextualCompany = (explicit?: string): string | undefined => {
    if (explicit && !/^(?:my\s*(?:company|compny|employer)|the\s*(?:company|compny)|company|compny)$/i.test(explicit.trim())) {
      return explicit;
    }
    return (
      eligibilitySession?.referencedEntities?.lastMentionedCompany ||
      eligibilitySession?.selectedCompanyName ||
      eligibilitySession?.companyFlow?.selectedCompanyName ||
      (currentApplicant.companyName && currentApplicant.companyName !== "Self-Employed" ? currentApplicant.companyName : undefined)
    );
  };

  // 5. TEMPORARY INTERRUPT (Side question asked during active workflow)
  if (nluResult.conversationAction === "TEMPORARY_INTERRUPT") {
    const activeSession: SessionState = eligibilitySession || {
      applicant: currentApplicant,
      taskStack: [],
      in_eligibility_flow: isEligibleFlowActive,
      activeFlow: "LOAN_ELIGIBILITY",
      updatedAt: Date.now(),
    };

    const suspendedTask: TaskStackItem = {
      taskType: activeSession.activeFlow || "LOAN_ELIGIBILITY",
      expectedField: activeSession.expectedField,
      missingFields: currentMissingFields,
      applicantSnapshot: { ...(activeSession.applicant || currentApplicant) },
      timestamp: Date.now(),
      description: `Suspended on ${activeSession.expectedField || "loan flow"}`,
    };
    pushTaskToStack(activeSession, suspendedTask);

    let toolResult: AgentResult | null = null;
    if (nluResult.primaryIntent === "BANK_DOCUMENT_REQUIREMENTS" || nluResult.primaryIntent === "BANK_POLICY") {
      toolResult = await executeLookupMasterPolicy(
        { bankName: nluResult.targetBank, questionTopic: userMessage },
        userMessage,
        isEligibleFlowActive,
        activeSession,
        requestedModel
      );
    } else if (nluResult.primaryIntent === "CONCEPTUAL_FINANCIAL_QUESTION") {
      toolResult = await executeAnswerGeneralQuestion(
        { question: userMessage, conceptName: nluResult.questionTopic },
        userMessage,
        conversationId,
        isEligibleFlowActive,
        activeSession,
        requestedModel,
        conversationHistory
      );
    } else if (nluResult.primaryIntent === "BANK_MANAGER_SEARCH") {
      toolResult = await executeSearchBankManagers(
        { bank_name: nluResult.targetBank, city: nluResult.entities.city },
        userMessage,
        isEligibleFlowActive,
        activeSession,
        conversationId
      );
    } else if (nluResult.primaryIntent === "COMPANY_SEARCH") {
      const targetComp = resolveContextualCompany(nluResult.entities.companyName);
      toolResult = await executeSearchCompanyCategory(
        { companyName: targetComp || userMessage },
        userMessage,
        isEligibleFlowActive,
        activeSession
      );
    } else {
      toolResult = await executeAnswerGeneralQuestion(
        { question: userMessage },
        userMessage,
        conversationId,
        isEligibleFlowActive,
        activeSession,
        requestedModel,
        conversationHistory
      );
    }

    const nextMissing =
      activeSession.expectedField ||
      suspendedTask?.expectedField ||
      (Array.isArray(activeSession.taskStack) && activeSession.taskStack[activeSession.taskStack.length - 1]?.expectedField) ||
      currentMissingFields[0] ||
      "monthlyIncome";

    const planned = planResponse({
      nluResult,
      session: activeSession,
      toolAnswer: toolResult?.reply || "",
      suspendedTask,
      nextMissingField: nextMissing,
    });

    return await finalizeAndReturn({
      ...(toolResult || {}),
      reply: planned.combinedResponse,
    }, {
      taskStack: activeSession.taskStack,
      activeFlow: activeSession.activeFlow,
      expectedField: activeSession.expectedField,
      in_eligibility_flow: isEligibleFlowActive,
      applicant: activeSession.applicant,
      ...(toolResult?.companyData?.company_flow === "COMPANY_SELECTION" ? {
        companyFlow: {
          stage: "COMPANY_SELECTION",
          candidates: toolResult.companyData.candidates,
          originalInput: toolResult.companyData.searchQuery,
        },
      } : {}),
    });
  }

  // 6. TOPIC SWITCH (Abandoning active flow)
  if (nluResult.conversationAction === "TOPIC_SWITCH") {
    if (nluResult.mainUserGoal === "EMI_CALCULATION") {
      const pAmt = typeof nluResult.entities.loanAmount === "number" ? nluResult.entities.loanAmount : undefined;
      const tMonths = typeof nluResult.entities.tenureMonths === "number" ? nluResult.entities.tenureMonths : undefined;
      const emiRes = await executeCalculateEmi(
        { principal: pAmt, rate: nluResult.entities.interestRate, tenureMonths: tMonths },
        userMessage,
        currentApplicant,
        false,
        eligibilitySession,
        requestedModel
      );
      return await finalizeAndReturn(emiRes, {
        activeFlow: "EMI_CALCULATOR",
        mainUserGoal: "EMI_CALCULATION",
        in_eligibility_flow: false,
        expectedField: undefined,
      });
    } else if (nluResult.mainUserGoal === "COMPANY_SEARCH") {
      const targetComp = resolveContextualCompany(nluResult.entities.companyName);
      const compRes = await executeSearchCompanyCategory(
        { companyName: targetComp || userMessage },
        userMessage,
        false,
        eligibilitySession
      );
      if (compRes.companyData?.company_flow === "COMPANY_SELECTION") {
        return await finalizeAndReturn(compRes, {
          activeFlow: "COMPANY_SEARCH",
          mainUserGoal: "COMPANY_SEARCH",
          in_eligibility_flow: false,
          expectedField: undefined,
          companyFlow: {
            stage: "COMPANY_SELECTION",
            candidates: compRes.companyData.candidates,
            originalInput: compRes.companyData.searchQuery,
          },
        });
      }
      const canonicalName = compRes.companyData?.company_name || targetComp || userMessage;
      const curApp = eligibilitySession?.applicant || {};
      const updatedApplicant: ApplicantProfile = {
        ...curApp,
        companyName: canonicalName,
        employmentType: curApp.employmentType || "Salaried",
      };
      const missing = getRequiredPolicyFields(updatedApplicant);
      const nextField = missing[0] || "monthlyIncome";
      const nextStepText = `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`;
      if (!compRes.reply.includes("eligibility assessment")) {
        compRes.reply += `\n\n${nextStepText}`;
      }
      return await finalizeAndReturn(compRes, {
        activeFlow: "LOAN_ELIGIBILITY",
        mainUserGoal: "PERSONAL_LOAN",
        in_eligibility_flow: true,
        expectedField: nextField,
        missingFields: missing,
        applicant: updatedApplicant,
        currentStep: "ELIGIBILITY_INPUT",
        companyFlow: {
          stage: "ELIGIBILITY_INPUT",
          normalizedCompany: canonicalName,
          selectedCompanyName: canonicalName,
          selectedCompany: canonicalName,
          companyData: compRes.companyData,
        },
        selectedCompanyName: canonicalName,
        selectedCompany: canonicalName,
      });
    }
  }

  // 6b. Direct Company Search (New task or command from idle)
  if (!isEligibleFlowActive && nluResult.primaryIntent === "COMPANY_SEARCH" && nluResult.messageType !== "QUESTION") {
    const targetComp = resolveContextualCompany(nluResult.entities.companyName);
    const compRes = await executeSearchCompanyCategory(
      { companyName: targetComp || userMessage },
      userMessage,
      false,
      eligibilitySession
    );
    if (compRes.companyData?.company_flow === "COMPANY_SELECTION") {
      return await finalizeAndReturn(compRes, {
        activeFlow: "COMPANY_SEARCH",
        mainUserGoal: "COMPANY_SEARCH",
        in_eligibility_flow: false,
        expectedField: undefined,
        companyFlow: {
          stage: "COMPANY_SELECTION",
          candidates: compRes.companyData.candidates,
          originalInput: compRes.companyData.searchQuery,
        },
      });
    }
    const canonicalName = compRes.companyData?.company_name || targetComp || userMessage;
    const curApp = eligibilitySession?.applicant || {};
    const updatedApplicant: ApplicantProfile = {
      ...curApp,
      companyName: canonicalName,
      employmentType: curApp.employmentType || "Salaried",
    };
    const missing = getRequiredPolicyFields(updatedApplicant);
    const nextField = missing[0] || "monthlyIncome";
    const nextStepText = `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`;
    if (!compRes.reply.includes("eligibility assessment")) {
      compRes.reply += `\n\n${nextStepText}`;
    }
    return await finalizeAndReturn(compRes, {
      activeFlow: "LOAN_ELIGIBILITY",
      mainUserGoal: "PERSONAL_LOAN",
      in_eligibility_flow: true,
      expectedField: nextField,
      missingFields: missing,
      applicant: updatedApplicant,
      currentStep: "ELIGIBILITY_INPUT",
      companyFlow: {
        stage: "ELIGIBILITY_INPUT",
        normalizedCompany: canonicalName,
        selectedCompanyName: canonicalName,
        selectedCompany: canonicalName,
        companyData: compRes.companyData,
      },
      selectedCompanyName: canonicalName,
      selectedCompany: canonicalName,
    });
  }

  // 7. Standalone questions outside active flow
  if (nluResult.messageType === "QUESTION" && !isEligibleFlowActive) {
    if (nluResult.primaryIntent === "BANK_DOCUMENT_REQUIREMENTS" || nluResult.primaryIntent === "BANK_POLICY") {
      return await finalizeAndReturn(
        await executeLookupMasterPolicy(
          { bankName: nluResult.targetBank, questionTopic: userMessage },
          userMessage,
          false,
          eligibilitySession,
          requestedModel
        )
      );
    } else if (nluResult.primaryIntent === "CONCEPTUAL_FINANCIAL_QUESTION") {
      return await finalizeAndReturn(
        await executeAnswerGeneralQuestion(
          { question: userMessage, conceptName: nluResult.questionTopic },
          userMessage,
          conversationId,
          false,
          eligibilitySession,
          requestedModel,
          conversationHistory
        )
      );
    } else if (nluResult.primaryIntent === "BANK_MANAGER_SEARCH") {
      return await finalizeAndReturn(
        await executeSearchBankManagers(
          { bank_name: nluResult.targetBank, city: nluResult.entities.city },
          userMessage,
          false,
          eligibilitySession,
          conversationId
        )
      );
    } else if (nluResult.primaryIntent === "COMPANY_SEARCH") {
      const targetComp = resolveContextualCompany(nluResult.entities.companyName);
      const compRes = await executeSearchCompanyCategory(
        { companyName: targetComp || userMessage },
        userMessage,
        false,
        eligibilitySession
      );
      if (compRes.companyData?.company_flow === "COMPANY_SELECTION") {
        return await finalizeAndReturn(compRes, {
          activeFlow: "COMPANY_SEARCH",
          mainUserGoal: "COMPANY_SEARCH",
          in_eligibility_flow: false,
          expectedField: undefined,
          companyFlow: {
            stage: "COMPANY_SELECTION",
            candidates: compRes.companyData.candidates,
            originalInput: compRes.companyData.searchQuery,
          },
        });
      }
      const canonicalName = compRes.companyData?.company_name || targetComp || userMessage;
      const curApp = eligibilitySession?.applicant || {};
      const updatedApplicant: ApplicantProfile = {
        ...curApp,
        companyName: canonicalName,
        employmentType: curApp.employmentType || "Salaried",
      };
      const missing = getRequiredPolicyFields(updatedApplicant);
      const nextField = missing[0] || "monthlyIncome";
      const nextStepText = `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`;
      if (!compRes.reply.includes("eligibility assessment")) {
        compRes.reply += `\n\n${nextStepText}`;
      }
      return await finalizeAndReturn(compRes, {
        activeFlow: "LOAN_ELIGIBILITY",
        mainUserGoal: "PERSONAL_LOAN",
        in_eligibility_flow: true,
        expectedField: nextField,
        missingFields: missing,
        applicant: updatedApplicant,
        currentStep: "ELIGIBILITY_INPUT",
        companyFlow: {
          stage: "ELIGIBILITY_INPUT",
          normalizedCompany: canonicalName,
          selectedCompanyName: canonicalName,
          selectedCompany: canonicalName,
          companyData: compRes.companyData,
        },
        selectedCompanyName: canonicalName,
        selectedCompany: canonicalName,
      });
    }
  }

  // 8. Multi-entity update (e.g. "I need 8 lakh for 5 years, salary is 40k and CIBIL is 760.")
  const nonDerivedEntityKeys = Object.keys(validation.sanitized).filter(
    (k) => k !== "employmentType" && k !== "companyName"
  );
  if (nluResult.primaryIntent === "LOAN_ELIGIBILITY" && nonDerivedEntityKeys.length >= 2) {
    const updatedApplicant: ApplicantProfile = {
      ...(eligibilitySession?.applicant || currentApplicant),
      ...validation.sanitized,
    };
    const remaining = getRequiredPolicyFields(updatedApplicant);
    if (remaining.length === 0) {
      return await executeCheckLoanEligibility(updatedApplicant, conversationId, userMessage, eligibilitySession, requestedModel, conversationHistory);
    } else {
      const nextField = remaining[0];
      const askNext = `Could you please share **${getHumanFieldLabel(nextField)}**?`;
      return await finalizeAndReturn({
        reply: `Got it! I have noted your details.\n\n${askNext}`,
      }, {
        applicant: updatedApplicant,
        expectedField: nextField,
        in_eligibility_flow: true,
        activeFlow: "LOAN_ELIGIBILITY",
        mainUserGoal: "PERSONAL_LOAN",
      });
    }
  }

  // 2b. Natural Language Greeting & Intent Pre-Router
  // Accurately understand greetings (e.g. "helo", "hello", "hi", "hey", "namaste", "good morning") without mistaking them for company names.
  if (isPureGreeting(userMessage) || isGreetingOrPleasantry(userMessage)) {
    const greetingText = await generateGreetingWithLLM(userMessage, requestedModel, eligibilitySession, currentTime);
    return await finalizeAndReturn({ reply: greetingText });
  }

  // 2c. Coreference & Pronoun Resolution ("its", "that bank", "this bank")
  let effectiveUserMessage = userMessage;
  const historyText = (conversationHistory || []).map((m) => m.content).join(" ");
  const lastBank =
    eligibilitySession?.selectedBank ||
    eligibilitySession?.chosenBank ||
    eligibilitySession?.referencedEntities?.lastMentionedBank ||
    resolveBankName(historyText)?.bankName ||
    (historyText.match(/\b(HDFC(?:\s*Bank)?|ICICI(?:\s*Bank)?|Axis(?:\s*Bank)?|SBI|Kotak(?:\s*Bank)?|IndusInd(?:\s*Bank)?|IDFC(?:\s*FIRST)?|Bajaj(?:\s*Finserv)?)\b/i)?.[0]);

  if (lastBank) {
    const cleanBank = (typeof lastBank === "string" ? resolveBankName(lastBank)?.bankName : (lastBank as any)?.bankName) || (typeof lastBank === "string" ? lastBank : "HDFC Bank");
    if (/\b(?:its|that\s+bank'?s?|this\s+bank'?s?)\b/i.test(userMessage)) {
      effectiveUserMessage = effectiveUserMessage.replace(/\b(?:its|that\s+bank'?s?|this\s+bank'?s?)\b/gi, `${cleanBank}'s`);
    } else if (/\b(?:that\s+bank|this\s+bank|the\s+bank)\b/i.test(userMessage)) {
      effectiveUserMessage = effectiveUserMessage.replace(/\b(?:that\s+bank|this\s+bank|the\s+bank)\b/gi, cleanBank);
    } else if (/\b(?:what\s+documents\s+do\s+they\s+need|what\s+do\s+they\s+need|what\s+does\s+it\s+need)\b/i.test(userMessage)) {
      effectiveUserMessage = effectiveUserMessage.replace(/\bthey\b/gi, cleanBank);
    }
  }

  if (currentApplicant.loanAmount && /\b(?:that\s+amount|the\s+amount|same\s+amount)\b/i.test(userMessage)) {
    const amtNum = Number(currentApplicant.loanAmount);
    const amtStr = !isNaN(amtNum) && amtNum >= 100000 ? `${(amtNum / 100000).toFixed(0)} Lakhs` : `${currentApplicant.loanAmount}`;
    effectiveUserMessage = effectiveUserMessage.replace(/\b(?:that\s+amount|the\s+amount|same\s+amount)\b/gi, `₹${amtStr}`);
  }
  const effectiveNorm = effectiveUserMessage.toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim();

  // 2d. Seamless Task Resumption ("let's continue", "resume", "continue my loan check", "let's go back")
  const isResumeIntent =
    /^(?:okay\s*,?\s*)?(?:let'?s\s+(?:continue|resume|go\s+back(?:\s+to)?)|continue|resume|go\s+back(?:\s+to)?)\s*(?:my\s+)?(?:loan\s*(?:check|eligibility|application)?|check)?$/i.test(effectiveNorm) ||
    /^(?:let'?s\s+continue\s+my\s+loan\s+check|continue\s+loan\s+check|resume\s+loan\s+check)$/i.test(effectiveNorm);

  if (isResumeIntent) {
    const remainingMissing = getRequiredPolicyFields(currentApplicant);
    let nextField = eligibilitySession?.expectedField;
    const taskStack = Array.isArray(eligibilitySession?.taskStack) ? [...eligibilitySession.taskStack] : [];
    if (taskStack.length > 0) {
      const topTask = taskStack.pop();
      if (topTask?.expectedField) {
        nextField = topTask.expectedField;
      }
      if (topTask?.applicantSnapshot) {
        Object.assign(currentApplicant, topTask.applicantSnapshot);
      }
    }
    if (!nextField) {
      nextField = remainingMissing.length > 0 ? remainingMissing[0] : "monthlyIncome";
    }

    const friendlyFieldMap: Record<string, string> = {
      companyName: "which company you work for",
      monthlyIncome: "your approximate monthly take-home salary",
      loanAmount: "how much loan amount you wish to borrow",
      tenureMonths: "your preferred repayment tenure",
      cibil: "your approximate CIBIL score",
      age: "your current age",
      existingEmi: "your existing monthly EMIs (or 0 if none)",
    };
    const askLabel = friendlyFieldMap[nextField] || nextField;
    const knownParts: string[] = [];
    if (currentApplicant.companyName && currentApplicant.companyName !== "Self-Employed") knownParts.push(`company (${currentApplicant.companyName})`);
    if (currentApplicant.monthlyIncome) knownParts.push(`salary (₹${Number(currentApplicant.monthlyIncome).toLocaleString("en-IN")})`);
    if (currentApplicant.age) knownParts.push(`age (${currentApplicant.age})`);
    if (currentApplicant.loanAmount) knownParts.push(`loan amount (₹${Number(currentApplicant.loanAmount) >= 100000 ? `${(Number(currentApplicant.loanAmount) / 100000).toFixed(0)} Lakhs` : Number(currentApplicant.loanAmount).toLocaleString("en-IN")})`);
    if (currentApplicant.tenureMonths) knownParts.push(`tenure (${Number(currentApplicant.tenureMonths) >= 12 ? `${(Number(currentApplicant.tenureMonths) / 12).toFixed(0)} years` : `${currentApplicant.tenureMonths} months`})`);
    if (currentApplicant.cibil) knownParts.push(`CIBIL (${currentApplicant.cibil})`);

    const contextPrefix = knownParts.length > 0 ? `Welcome back! We have your ${knownParts.join(", ")}.\n\n` : "Welcome back!\n\n";
    return await finalizeAndReturn({
      reply: `${contextPrefix}Could you share ${askLabel} so we can check your eligibility across all our partner banks?`,
    }, {
      expectedField: nextField,
      missingFields: remainingMissing,
      in_eligibility_flow: true,
      taskStack,
    });
  }

  // 2e. Contextual EMI Calculation ("Calculate the EMI", "What would the EMI be?", "I changed my mind, calculate EMI instead")
  const isPureEmiRequest =
    /^(?:calculate\s+(?:the\s+)?emi\??|what\s+would\s+(?:the\s+)?emi\s+be\??|calculate\s+monthly\s+emi\??|emi\s+calculator\??)$/i.test(effectiveNorm) ||
    (/\bcalculate\s+(?:the\s+)?emi\b/i.test(effectiveNorm) && !effectiveNorm.match(/\b\d+\s*%/)) ||
    /\b(?:calculate\s+emi\s+instead|i\s+changed\s+my\s+mind,?\s*calculate\s+emi|switch\s+to\s+emi)\b/i.test(effectiveNorm);

  if (isPureEmiRequest) {
    const stack: TaskStackItem[] = Array.isArray(eligibilitySession?.taskStack) ? [...eligibilitySession.taskStack] : [];
    if (isEligibleFlowActive && eligibilitySession?.expectedField) {
      stack.push({
        taskType: "LOAN_ELIGIBILITY",
        expectedField: eligibilitySession.expectedField,
        missingFields: currentMissingFields,
        applicantSnapshot: { ...currentApplicant },
        selectedBank: eligibilitySession.selectedBank,
        city: eligibilitySession.city,
        timestamp: Date.now(),
        description: `Loan eligibility paused at ${eligibilitySession.expectedField}`,
      });
    }

    const hasExplicitLoanAmount =
      typeof currentApplicant.loanAmount === "number" &&
      currentApplicant.loanAmount >= 50000 &&
      currentApplicant.loanAmount !== currentApplicant.monthlyIncome;

    if (hasExplicitLoanAmount) {
      const principal = Number(currentApplicant.loanAmount);
      const tenure = Number(currentApplicant.tenureMonths) || 60;
      const rate = 10.5;
      const emi = calculateEmi(principal, rate, tenure);
      const totalPayable = emi * tenure;
      const totalInterest = totalPayable - principal;
      const tenureStr = tenure >= 12 ? `${tenure / 12} years (${tenure} months)` : `${tenure} months`;

      const followUp = (currentApplicant.companyName && currentApplicant.monthlyIncome)
        ? `With your salary of **₹${Number(currentApplicant.monthlyIncome).toLocaleString("en-IN")}** at **${currentApplicant.companyName}**, multiple partner banks offer pre-approved terms. Would you like to complete your eligibility check across all partner banks?`
        : undefined;

      const emiFormatted = formatEmiResult({ principal, rate, tenure }, emi, followUp);

      return await finalizeAndReturn({
        reply: emiFormatted,
      }, {
        taskStack: stack,
        referencedEntities: {
          ...(eligibilitySession?.referencedEntities || {}),
          lastCalculatedEmi: emi,
          lastMentionedAmount: principal,
          lastMentionedTenure: tenure,
        },
      });
    } else {
      const salaryContext = currentApplicant.monthlyIncome ? ` (With your salary of ₹${Number(currentApplicant.monthlyIncome).toLocaleString("en-IN")}, you typically qualify for loans up to ₹6–8 Lakhs).` : "";
      return await finalizeAndReturn({
        reply: `I'd be happy to calculate your monthly EMI!${salaryContext}\n\nCould you please share the **loan amount** you'd like to calculate for and your preferred **repayment tenure** (for example: "₹5 Lakhs for 3 years at 10.5%")?`,
      }, {
        taskStack: stack,
        expectedField: "loanAmount",
      });
    }
  }

  // 2e2. Contextual Follow-up for Tenure with existing loan amount ("And for 5 years?", "What about 3 years?")
  const isTenureFollowUp =
    (!isEligibleFlowActive || eligibilitySession?.expectedField !== "tenureMonths") &&
    effectiveNorm.match(/^(?:and\s+(?:for\s+)?|what\s+about\s+(?:for\s+)?)(\d{1,2})\s*(?:years?|yrs?)\??$/i);
  if (isTenureFollowUp && currentApplicant.loanAmount) {
    const years = parseInt(isTenureFollowUp[1], 10);
    const tenure = years * 12;
    currentApplicant.tenureMonths = tenure;
    const principal = Number(currentApplicant.loanAmount);
    const rate = 10.5;
    const emi = calculateEmi(principal, rate, tenure);
    const totalPayable = emi * tenure;
    const totalInterest = totalPayable - principal;
    const amtStr = principal >= 100000 ? `₹${(principal / 100000).toFixed(0)} Lakhs` : `₹${principal.toLocaleString("en-IN")}`;

    await saveEligibilityState(conversationId, {
      ...eligibilitySession,
      applicant: currentApplicant,
      updatedAt: Date.now(),
    } as any);

    const emiFormatted = formatEmiResult({ principal, rate, tenure }, emi);

    return {
      reply: emiFormatted,
    };
  }

  // 2f. Loan amount correction with instant recalculated EMI ("Actually make the loan 12 lakh", "Change loan amount to 12 lakh")
  const isLoanCorrectionWithRecalc =
    effectiveNorm.match(/\b(?:actually|change|make)\s+(?:the\s+)?(?:loan\s*(?:amount)?|it)\s*(?:to\s*|=\s*)?(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|cr)?/i);

  if (isLoanCorrectionWithRecalc && (currentApplicant.loanAmount || currentApplicant.monthlyIncome)) {
    const parsedAmt = parseFinancialAmount(isLoanCorrectionWithRecalc[1] + (isLoanCorrectionWithRecalc[2] || ""));
    if (parsedAmt && parsedAmt >= 50000) {
      currentApplicant.loanAmount = parsedAmt;
      const tenure = Number(currentApplicant.tenureMonths) || 60;
      const rate = 10.5;
      const emi = calculateEmi(parsedAmt, rate, tenure);
      const tenureStr = tenure >= 12 ? `${tenure / 12} years` : `${tenure} months`;
      const amtStr = parsedAmt >= 100000 ? `₹${(parsedAmt / 100000).toFixed(0)} Lakhs` : `₹${parsedAmt.toLocaleString("en-IN")}`;

      await saveEligibilityState(conversationId, {
        ...eligibilitySession,
        applicant: currentApplicant,
        updatedAt: Date.now(),
      } as any);

      const emiFormatted = formatEmiResult({ principal: parsedAmt, rate, tenure }, emi);

      return {
        reply: `Updated your loan amount to **${amtStr}**.\n\n` + emiFormatted,
      };
    }
  }

  // 2g. Contextual Bank Question ("What about HDFC?", "What about ICICI?")
  const isContextualBankAsk = effectiveNorm.match(/^(?:what|how)\s+about\s+(hdfc|icici|axis|sbi|kotak|bajaj|idfc|indusind|yes\s*bank)\??$/i);
  if (isContextualBankAsk && (currentApplicant.monthlyIncome || currentApplicant.companyName)) {
    const bankRaw = isContextualBankAsk[1].trim();
    const bankName = resolveBankName(bankRaw)?.bankName || bankRaw.toUpperCase();
    const salStr = currentApplicant.monthlyIncome ? `₹${Number(currentApplicant.monthlyIncome).toLocaleString("en-IN")}` : "your salary";
    const compStr = currentApplicant.companyName && currentApplicant.companyName !== "Self-Employed" ? ` at ${currentApplicant.companyName}` : "";

    return {
      reply: `For **${bankName}**, personal loans are offered up to **₹40 Lakhs** with tenures up to **60 months** (and up to 84 months for top category employers). With your salary of **${salStr}**${compStr}, you fall comfortably within ${bankName}'s prime eligibility criteria (minimum salary requirement is ₹25,000/month).`,
    };
  }

  // 2h. Direct Bank Manager / Branch Inquiry anytime (including during active field collection)
  const isBankManagerQueryAnytime =
    /\b(?:branch\s*managers?|bank\s*managers?|branch\s*head|\basm\b|\brsm\b)\b/i.test(effectiveNorm) ||
    (/\b(?:branches|branch)\b/i.test(effectiveNorm) && Boolean(resolveBankName(effectiveUserMessage) || lastBank));

  if (isBankManagerQueryAnytime) {
    const targetBank =
      resolveBankName(effectiveUserMessage)?.bankName ||
      (typeof lastBank === "string" ? resolveBankName(lastBank)?.bankName : (lastBank as any)?.bankName) ||
      "HDFC Bank";
    const locParams = extractBankBranchLocationParams(effectiveUserMessage, targetBank);
    const mgrArgs = {
      bank_name: targetBank,
      city: locParams?.city || currentApplicant.location || eligibilitySession?.city || undefined,
      branch: locParams?.branch || undefined,
      pincode: locParams?.pincode || undefined,
    };
    return await executeSearchBankManagers(mgrArgs, effectiveUserMessage, isEligibleFlowActive, eligibilitySession, conversationId);
  }

  // 2h2. Compound Loan Intent + Company Check ("I want loan but first check mthree")
  const compoundLoanCompany = extractCompoundLoanCompanyIntent(effectiveUserMessage);
  if (compoundLoanCompany.isCompound && compoundLoanCompany.companyCandidate) {
    const candidateName = compoundLoanCompany.companyCandidate;
    const company = await searchCompany(candidateName);
    if (company.found) {
      const canonicalName = company.primaryName || candidateName;
      const updatedApplicant: ApplicantProfile = {
        ...currentApplicant,
        companyName: canonicalName,
        employmentType: "Salaried",
      };
      const missing = getRequiredPolicyFields(updatedApplicant);
      const nextField = missing[0] || "monthlyIncome";

      await saveEligibilityState(conversationId, {
        ...eligibilitySession,
        applicant: updatedApplicant,
        expectedField: nextField,
        missingFields: missing,
        in_eligibility_flow: true,
        referencedEntities: {
          ...(eligibilitySession?.referencedEntities || {}),
          lastMentionedCompany: canonicalName,
        },
        companyFlow: {
          stage: "ELIGIBILITY_INPUT",
          selectedCompanyName: canonicalName,
          companyData: company,
        },
        selectedCompanyName: canonicalName,
        updatedAt: Date.now(),
      });

      const companyContent = formatCompanyResponse(company);
      const nextStepText = `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`;
      const reply = `${companyContent}\n\n${nextStepText}`;

      return {
        reply,
        companyData: company,
        companyQuery: canonicalName,
      };
    }
  }

  // 2h3. Unified Company Intelligence & Seamless Topic Switch Handler
  // Resolves company from explicit message, session context, or recent dialogue turns.
  // Displays company intelligence card and partner bank tiers, then proactively guides back to loan eligibility.
  const executeCompanyInfoSwitch = async (
    targetCompany?: string
  ): Promise<AgentResult> => {
    let resolvedCompany =
      targetCompany ||
      eligibilitySession?.referencedEntities?.lastMentionedCompany ||
      eligibilitySession?.selectedCompanyName ||
      eligibilitySession?.companyFlow?.selectedCompanyName ||
      (currentApplicant.companyName && currentApplicant.companyName !== "Self-Employed" ? currentApplicant.companyName : undefined);

    if (!resolvedCompany && conversationHistory && conversationHistory.length > 0) {
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const hMsg = conversationHistory[i].content;
        const cand =
          extractTargetCompanyFromMessage(hMsg) ||
          extractCompoundLoanCompanyIntent(hMsg).companyCandidate ||
          extractCompanyCandidateFromText(hMsg);
        if (cand && !isInvalidCompanyName(cand)) {
          resolvedCompany = cand;
          break;
        }
      }
    }

    if (resolvedCompany) {
      const company = await searchCompany(resolvedCompany);
      if (company.found) {
        if (company.needsDisambiguation && company.candidateOptions && company.candidateOptions.length > 1) {
          const candidateNames = company.candidateOptions.map((c) => c.name);
          const reply = formatCompanyCandidateList(candidateNames, resolvedCompany);
          return await finalizeAndReturn({
            reply,
            companyData: {
              company_flow: "COMPANY_SELECTION",
              needs_disambiguation: true,
              candidates: company.candidateOptions,
              searchQuery: resolvedCompany,
            },
          }, {
            ...eligibilitySession,
            activeFlow: "COMPANY_SEARCH",
            mainUserGoal: "COMPANY_SEARCH",
            in_eligibility_flow: false,
            expectedField: undefined,
            companyFlow: {
              stage: "COMPANY_SELECTION",
              candidates: company.candidateOptions,
              originalInput: resolvedCompany,
            },
          });
        }

        const canonicalName = company.primaryName || resolvedCompany;
        const companyContent = formatCompanyResponse(company);

        const updatedApplicant: ApplicantProfile = {
          ...currentApplicant,
          companyName: canonicalName,
          employmentType: "Salaried",
        };
        const remainingMissing = getRequiredPolicyFields(updatedApplicant);
        const nextField = remainingMissing[0] || "monthlyIncome";
        const nextStepText = `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`;
        const reply = `${companyContent}\n\n${nextStepText}`;

        return await finalizeAndReturn({
          reply,
          companyData: company,
          companyQuery: canonicalName,
        }, {
          ...eligibilitySession,
          applicant: updatedApplicant,
          expectedField: nextField,
          missingFields: remainingMissing,
          activeFlow: "LOAN_ELIGIBILITY",
          mainUserGoal: "PERSONAL_LOAN",
          in_eligibility_flow: true,
          pendingEligibilityConfirmation: false,
          pendingTopicSwitch: undefined,
          referencedEntities: {
            ...(eligibilitySession?.referencedEntities || {}),
            lastMentionedCompany: canonicalName,
          },
          companyFlow: {
            stage: "ELIGIBILITY_INPUT",
            selectedCompanyName: canonicalName,
            companyData: company,
          },
          selectedCompanyName: canonicalName,
        });
      }
    }

    // If no company name is identified in context or direct message, seamlessly switch to company collection
    const updatedTaskStack: TaskStackItem[] = [...(eligibilitySession?.taskStack || [])];
    if (eligibilitySession?.expectedField && eligibilitySession.expectedField !== "companyName") {
      updatedTaskStack.push({
        taskType: "LOAN_ELIGIBILITY",
        expectedField: eligibilitySession.expectedField,
        applicantSnapshot: { ...currentApplicant },
        timestamp: Date.now(),
        description: `Loan eligibility paused at ${eligibilitySession.expectedField}`,
      });
    }

    const remainingMissing = getRequiredPolicyFields(currentApplicant);
    if (!remainingMissing.includes("companyName") && currentApplicant.employmentType !== "Self-Employed") {
      remainingMissing.unshift("companyName");
    }

    return await finalizeAndReturn({
      reply: "I'd be glad to look up your company's corporate intelligence and partner bank category ratings!\n\nCould you please share your **employer or company name**? Let me know so I can check its details.",
    }, {
      ...eligibilitySession,
      expectedField: "companyName",
      activeFlow: "company_intelligence",
      previousFlow: eligibilitySession?.activeFlow || "loan_eligibility",
      taskStack: updatedTaskStack,
      missingFields: remainingMissing,
      in_eligibility_flow: true,
      pendingEligibilityConfirmation: false,
      pendingTopicSwitch: undefined,
      updatedAt: Date.now(),
    });
  };

  const isCompanySearchRequested = isCompanyInfoOrSearchIntent(effectiveUserMessage);
  if (isCompanySearchRequested) {
    const directCandidate = extractTargetCompanyFromMessage(effectiveUserMessage);
    return await executeCompanyInfoSwitch(directCandidate);
  }

  // A selected employer is deterministic state, not an LLM interpretation.
  // Handle it before routing so eligibility remains on its current step.
  const companyFlowResult = await handleCompanySelectionFlow(
    conversationId,
    userMessage,
    currentApplicant,
    eligibilitySession,
    companySelectionAction,
    conversationHistory
  );
  if (companyFlowResult) return companyFlowResult;

  // 2b-2. Company Disavowal / Employer Correction Interceptor
  // Immediately catch "this is not my company", "not my employer", "wrong company", "this is not my company, I work at TCS", etc.
  // Completely halts loops where user is asked for salary or other fields when the company is incorrect or not set.
  const disavowalCheck = detectCompanyDisavowal(userMessage);
  if (disavowalCheck.isDisavowal) {
    const updatedApplicant = { ...currentApplicant };
    delete updatedApplicant.companyName;
    const remainingMissing = getRequiredPolicyFields(updatedApplicant);
    if (!remainingMissing.includes("companyName") && updatedApplicant.employmentType !== "Self-Employed") {
      remainingMissing.unshift("companyName");
    }

    const resetSession = {
      ...eligibilitySession,
      applicant: updatedApplicant,
      expectedField: "companyName",
      missingFields: remainingMissing,
      in_eligibility_flow: true,
      companyFlow: { stage: "COMPANY_INPUT" as const },
      selectedCompanyId: undefined,
      selectedCompanyName: undefined,
      selectedCompany: undefined,
      companyCandidate: undefined,
      updatedAt: Date.now(),
    };

    await saveEligibilityState(conversationId, resetSession as any);

    if (disavowalCheck.replacementCompany) {
      const replacementFlowResult = await handleCompanySelectionFlow(
        conversationId,
        disavowalCheck.replacementCompany,
        updatedApplicant,
        resetSession,
        undefined,
        conversationHistory
      );
      if (replacementFlowResult) {
        return {
          ...replacementFlowResult,
          reply: `Understood! I have removed the previous company.\n\n${replacementFlowResult.reply}`,
        };
      }
    }

    return {
      reply: `Understood! I have removed that company from your loan profile.\n\n* **Next Step**: What is your actual current employer or company name?\n*(If you are self-employed or run a business, just let me know!)*`,
    };
  }

  // 2b-3. Self-Employed Intent Interceptor
  if (/\b(?:(?:i\s+am\s+|i['’]m\s+)?self[\s-]*employed|business\s*owner|own\s*business|freelancer?|sole\s*proprietor(?:ship)?)\b/i.test(userMessage)) {
    const updatedApplicant: ApplicantProfile = {
      ...currentApplicant,
      employmentType: "Self-Employed",
    };
    delete updatedApplicant.companyName;
    const remainingMissing = getRequiredPolicyFields(updatedApplicant);
    const nextField = remainingMissing[0] || "monthlyIncome";
    await saveEligibilityState(conversationId, {
      ...eligibilitySession,
      applicant: updatedApplicant,
      expectedField: nextField,
      missingFields: remainingMissing,
      in_eligibility_flow: true,
      companyFlow: undefined,
      updatedAt: Date.now(),
    });
    return {
      reply: `Got it! I've updated your profile to **Self-Employed**.\n\n* **Next Step**: What is your approximate monthly net profit or business take-home income (e.g. ₹75,000)?`,
    };
  }

  // 3. Retrieve completed evaluation context
  hasCompletedEvaluation = Boolean(
    eligibilitySession?.evaluationCompleted ||
    eligibilitySession?.hasCompletedEvaluation ||
    eligibilitySession?.expectedField === "chosenBank" ||
    (eligibilitySession?.eligible_banks && eligibilitySession.eligible_banks.length > 0) ||
    ((eligibilitySession as any)?.evaluatedBanks && (eligibilitySession as any).evaluatedBanks.length > 0) ||
    Boolean((eligibilitySession as any)?.evaluationReport)
  );

  // 3b. Authoritative Active Eligibility Field Collection Handler
  // Router priority order:
  // session state → current eligibility step → field/entity extraction → eligibility handler → generic intent detection → company search
  const isPostEvalOrBankFlow = Boolean(
    hasCompletedEvaluation ||
    eligibilitySession?.expectedField === "selectedBank" ||
    eligibilitySession?.expectedField === "chosenBank" ||
    eligibilitySession?.expectedField === "cityOrPincode" ||
    eligibilitySession?.expectedField === "preferredBranch" ||
    eligibilitySession?.expectedField === "branchSelection" ||
    eligibilitySession?.chosenBank ||
    eligibilitySession?.selectedBank
  );

  const isCollectingEligibilityField = Boolean(
    isEligibleFlowActive &&
    !isPostEvalOrBankFlow &&
    eligibilitySession?.expectedField &&
    eligibilitySession.expectedField !== "companyName"
  );

  // 2b. State-Aware Entity Extraction & Generic NLU Flow Handling
  // State Priority:
  // 1. active conversation state
  // 2. current flow
  // 3. current step
  // 4. expected entity
  // 5. user intent
  // 6. entity extraction
  const lastAssistantTurn = (conversationHistory || [])
    .filter((m) => m.role === "assistant" || m.role === "ai" || m.role === "bot")
    .slice(-1)[0]?.content || "";

  const assistantAskedConfirmation =
    /(?:would\s+you\s+like|shall\s+i|should\s+we|do\s+you\s+want|to\s+proceed|please\s+confirm|can\s+we\s+proceed|confirm\s+this)/i.test(
      lastAssistantTurn
    );

  const assistantAskedLocation =
    /(?:which|what|enter|provide|your|share|tell\s+me)\s+(?:city|branch|location|pincode|area)|where\s+are\s+you\s+(?:located|based)|which\s+city\s+you'?re\s+located\s+in/i.test(
      lastAssistantTurn
    );

  const assistantAskedBank =
    /(?:which|what|select|choose)\s+(?:partner\s*)?bank|select\s+one\s+bank|which\s+(?:partner\s*)?bank\s+would\s+you\s+like/i.test(
      lastAssistantTurn
    );

  let currentFlow = "LOAN_ASSESSMENT";
  if (isEligibleFlowActive && eligibilitySession?.expectedField && eligibilitySession.expectedField !== "companyName") {
    currentFlow = "ELIGIBILITY";
  } else if (eligibilitySession?.companyFlow?.stage) {
    currentFlow = "COMPANY_SELECTION";
  } else if (eligibilitySession?.postEligibilityStage || eligibilitySession?.hasCompletedEvaluation) {
    currentFlow = "POST_ELIGIBILITY";
  }

  let currentStep = eligibilitySession?.currentStep || "INITIAL";
  let expectedEntity = eligibilitySession?.expectedEntity || eligibilitySession?.expectedField || "none";

  if (eligibilitySession?.expectedEntity) {
    expectedEntity = eligibilitySession.expectedEntity;
    currentStep = eligibilitySession.currentStep || eligibilitySession.expectedEntity.toUpperCase();
  } else if (eligibilitySession?.expectedField) {
    expectedEntity = eligibilitySession.expectedField;
    currentStep = eligibilitySession.expectedField.toUpperCase();
  } else if (assistantAskedConfirmation) {
    expectedEntity = "confirmation";
    currentStep = "CONFIRMATION";
  } else if (assistantAskedBank) {
    expectedEntity = "selectedBank";
    currentStep = "BANK_SELECTION";
  } else if (assistantAskedLocation) {
    expectedEntity = "city";
    currentStep = "LOCATION_COLLECTION";
  }

  let detectedIntent = "GENERAL";
  if (isConfirmationResponse(effectiveUserMessage).isConfirmation) {
    detectedIntent = "CONFIRMATION";
  } else if (resolveBankName(effectiveUserMessage, eligibilitySession?.eligible_banks)) {
    detectedIntent = "BANK_SELECTION";
  } else if (isLocationInput(effectiveUserMessage) || assistantAskedLocation) {
    detectedIntent = "LOCATION_INPUT";
  } else if (detectLoanType(effectiveUserMessage)) {
    detectedIntent = "LOAN_TYPE_SELECTION";
  }

  const extractedEntities = extractTypedLoanEntities(
    effectiveUserMessage,
    expectedEntity,
    eligibilitySession?.eligible_banks,
    currentApplicant
  );

  const updatedSessionState = updateNormalizedLoanState(
    eligibilitySession,
    extractedEntities,
    currentApplicant,
    expectedEntity
  );

  logFlowDebug({
    currentFlow,
    currentStep,
    expectedEntity,
    userMessage,
    detectedIntent,
    extractedEntities,
    previousState: formatStateSummary(eligibilitySession, currentApplicant),
    updatedState: formatStateSummary(updatedSessionState, updatedSessionState.applicant),
  });

  // Handle explicit resume of loan eligibility check mid-flow or after branch/policy queries
  const isExplicitResumeLoanMsg = /^(?:now\s+)?(?:let'?s\s+)?(?:continue|resume)\b.*loan/i.test(norm) || /^(?:continue|resume)\s+(?:my\s+)?loan/i.test(norm);
  if (isExplicitResumeLoanMsg && !hasCompletedEvaluation) {
    const remainingMissing = getRequiredPolicyFields(currentApplicant);
    const nextField = remainingMissing.length > 0 ? remainingMissing[0] : (eligibilitySession?.expectedField || "monthlyIncome");
    const friendlyFieldMap: Record<string, string> = {
      companyName: "which company you work for",
      monthlyIncome: "your approximate monthly take-home salary",
      loanAmount: "how much loan amount you wish to borrow",
      tenureMonths: "your preferred repayment tenure",
      cibil: "your approximate CIBIL score (or say 'not sure' if unknown)",
      age: "your current age",
      existingEmi: "your existing monthly EMIs (or 0 if none)",
    };
    const askLabel = friendlyFieldMap[nextField] || nextField;
    const knownParts: string[] = [];
    if (currentApplicant.companyName && currentApplicant.companyName !== "Self-Employed") knownParts.push(`company (${currentApplicant.companyName})`);
    if (currentApplicant.monthlyIncome) knownParts.push(`salary (₹${Number(currentApplicant.monthlyIncome).toLocaleString("en-IN")})`);
    if (currentApplicant.age) knownParts.push(`age (${currentApplicant.age})`);
    if (currentApplicant.loanAmount) knownParts.push(`loan amount (₹${Number(currentApplicant.loanAmount) >= 100000 ? `${(Number(currentApplicant.loanAmount) / 100000).toFixed(0)} Lakhs` : Number(currentApplicant.loanAmount).toLocaleString("en-IN")})`);
    if (currentApplicant.tenureMonths) knownParts.push(`tenure (${Number(currentApplicant.tenureMonths) >= 12 ? `${(Number(currentApplicant.tenureMonths) / 12).toFixed(0)} years` : `${currentApplicant.tenureMonths} months`})`);
    if (currentApplicant.cibil) knownParts.push(`CIBIL (${currentApplicant.cibil})`);

    await saveEligibilityState(conversationId, {
      ...eligibilitySession,
      currentStep: "COLLECTING_FIELD",
      locationStep: undefined,
      expectedEntity: nextField,
      expectedField: nextField,
      in_eligibility_flow: true,
      pendingEligibilityConfirmation: false,
      updatedAt: Date.now(),
    } as any);

    const contextPrefix = knownParts.length > 0 ? `Great, let's continue with your loan eligibility check! We have your ${knownParts.join(", ")}.\n\n` : "Great, let's continue with your loan eligibility check!\n\n";
    return {
      reply: `${contextPrefix}Could you please share ${askLabel} so we can evaluate your eligibility across all partner banks?`,
    };
  }

  // Handle Confirmation of Resuming Loan Eligibility Assessment (after answering a side question)
  if (eligibilitySession?.pendingEligibilityConfirmation) {
    if (extractedEntities.CONFIRMATION === true || /^(?:yes|yep|yeah|sure|ok|okay|proceed|continue|let'?s\s+(?:proceed|continue|do\s+it)|why\s*not|please\s*do|yes\s*please)\b/i.test(norm)) {
      const nextField = eligibilitySession?.expectedField || (currentMissingFields.length > 0 ? currentMissingFields[0] : "monthlyIncome");
      const friendlyFieldMap: Record<string, string> = {
        companyName: "which company you work for",
        monthlyIncome: "your approximate monthly take-home salary",
        loanAmount: "how much loan amount you wish to borrow",
        tenureMonths: "your preferred repayment tenure",
        cibil: "your approximate CIBIL score (or say 'not sure' if unknown)",
        age: "your current age",
        existingEmi: "your existing monthly EMIs (or 0 if none)",
      };
      const askLabel = friendlyFieldMap[nextField] || nextField;
      const knownParts: string[] = [];
      if (currentApplicant.companyName && currentApplicant.companyName !== "Self-Employed") knownParts.push(`company (${currentApplicant.companyName})`);
      if (currentApplicant.monthlyIncome) knownParts.push(`salary (₹${Number(currentApplicant.monthlyIncome).toLocaleString("en-IN")})`);
      if (currentApplicant.age) knownParts.push(`age (${currentApplicant.age})`);
      if (currentApplicant.loanAmount) knownParts.push(`loan amount (₹${Number(currentApplicant.loanAmount) >= 100000 ? `${(Number(currentApplicant.loanAmount) / 100000).toFixed(0)} Lakhs` : Number(currentApplicant.loanAmount).toLocaleString("en-IN")})`);
      if (currentApplicant.tenureMonths) knownParts.push(`tenure (${Number(currentApplicant.tenureMonths) >= 12 ? `${(Number(currentApplicant.tenureMonths) / 12).toFixed(0)} years` : `${currentApplicant.tenureMonths} months`})`);
      if (currentApplicant.cibil) knownParts.push(`CIBIL (${currentApplicant.cibil})`);

      await saveEligibilityState(conversationId, {
        ...eligibilitySession,
        pendingEligibilityConfirmation: false,
        updatedAt: Date.now(),
      } as any);

      const contextPrefix = knownParts.length > 0 ? `Great, let's proceed! We have your ${knownParts.join(", ")}.\n\n` : "Great, let's proceed!\n\n";
      return {
        reply: `${contextPrefix}Could you share ${askLabel} so we can check your eligibility across all partner banks?`,
      };
    } else if (extractedEntities.CONFIRMATION === false || /^(?:no|nope|not\s+now|later|wait|pause|hold\s*on)\b/i.test(norm)) {
      await saveEligibilityState(conversationId, {
        ...eligibilitySession,
        pendingEligibilityConfirmation: false,
        updatedAt: Date.now(),
      } as any);
      return {
        reply: "No problem at all! We've paused your loan assessment. Whenever you're ready to proceed, just say **resume** or ask any questions you have.",
      };
    }
    eligibilitySession.pendingEligibilityConfirmation = false;
  }

  // Dynamic Handling of Confirmation Responses in Intake Flow
  // Preserves existing bank, branch, city, loanAmount, tenure, loanType completely!
  if (
    !hasCompletedEvaluation &&
    !isCollectingEligibilityField &&
    !eligibilitySession?.pendingEligibilityConfirmation &&
    (expectedEntity === "confirmation" || (assistantAskedConfirmation && !isEligibleFlowActive) || eligibilitySession?.currentStep === "CONFIRMATION") &&
    extractedEntities.CONFIRMATION !== undefined
  ) {
    if (extractedEntities.CONFIRMATION === true) {
      updatedSessionState.confirmation = true;
      updatedSessionState.currentStep = "CONFIRMED";
      updatedSessionState.expectedEntity = "none";
      await saveEligibilityState(conversationId, updatedSessionState);

      const selBank = updatedSessionState.selectedBank || updatedSessionState.chosenBank || "partner bank";
      const selLoc = [updatedSessionState.preferredBranch, updatedSessionState.city].filter(Boolean).join(", ");
      return {
        reply: `✅ **Application initiated with ${selBank}**${selLoc ? ` at **${selLoc}**` : ""}.\n\nOur official branch manager / loan specialist will assist you with the next steps and documentation.`,
      };
    } else {
      updatedSessionState.confirmation = false;
      await saveEligibilityState(conversationId, updatedSessionState);
      return {
        reply: `Understood. Would you like to select a different bank, update your preferred branch/location, or modify your loan details?`,
      };
    }
  }

  // Dynamic Handling of Bank Selection in Intake Flow
  // BANK != CITY, BANK != BRANCH. Preserves location, updates only bank.
  const isQuestionOrInquiry =
    /\?|^(?:what|how|why|when|where|who|which|is|can|does|do|will|should|tell\s+me|explain|check)\b/i.test(normUserMsg) ||
    /require|need|exp\w*|salary|income|age|doc|cibil|score|turnover|vintage|limit|amount|roi|rate|tenure|foir|policy|policies|guideline|rule|criteria|cutoff|exception|contractual/i.test(normUserMsg);

  const isPureBankMessage =
    !isCollectingEligibilityField &&
    !isQuestionOrInquiry &&
    Boolean(extractedEntities.BANK) &&
    !extractedEntities.CITY &&
    !extractedEntities.BRANCH &&
    !extractedEntities.PINCODE &&
    !extractedEntities.LOAN_AMOUNT &&
    !extractedEntities.CIBIL &&
    !extractedEntities.EMI &&
    !isFinancialOrProfileInput(userMessage);

  if (
    !hasCompletedEvaluation &&
    !isQuestionOrInquiry &&
    (isPureBankMessage || expectedEntity === "selectedBank" || assistantAskedBank || eligibilitySession?.currentStep === "BANK_SELECTION") &&
    extractedEntities.BANK &&
    !isCollectingEligibilityField
  ) {
    updatedSessionState.selectedBank = extractedEntities.BANK;
    updatedSessionState.chosenBank = extractedEntities.BANK;
    updatedSessionState.lastPolicyBank = extractedEntities.BANK;

    if (updatedSessionState.city) {
      const currentBank = updatedSessionState.selectedBank;
      const dbBranches = await findBankBranches(currentBank, updatedSessionState.city);
      const uniqueBranches = getUniqueBranches(dbBranches);

      if (uniqueBranches.length === 0) {
        return {
          reply: `I couldn't find any ${currentBank} branch records for ${updatedSessionState.city} in the database.`,
        };
      }

      const formattedList = uniqueBranches.map((b, idx) => `${idx + 1}. ${b}`).join("\n");
      updatedSessionState.availableBranches = uniqueBranches;
      updatedSessionState.currentStep = "BRANCH_SELECTION";
      updatedSessionState.locationStep = "LOCATION_SELECTION";
      updatedSessionState.expectedEntity = "branchSelection";
      updatedSessionState.expectedField = "branchSelection";
      updatedSessionState.postEligibilityStage = "BRANCH_SELECTION";
      await saveEligibilityState(conversationId, updatedSessionState);

      return {
        reply: `Available ${currentBank} branches in ${updatedSessionState.city}:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`,
      };
    } else {
      updatedSessionState.currentStep = "CITY_COLLECTION";
      updatedSessionState.expectedEntity = "city";
      updatedSessionState.expectedField = "city";
      updatedSessionState.postEligibilityStage = "BANK_MANAGER_DETAILS_INPUT";
      await saveEligibilityState(conversationId, updatedSessionState);

      return {
        reply: `You selected **${updatedSessionState.selectedBank}**. Please provide your city.`,
      };
    }
  }

  // Dynamic Handling of Location Input in Intake Flow
  // Natural-language filler stripped dynamically.
  const isBranchSelectionStepIntake =
    updatedSessionState.expectedField === "branchSelection" ||
    updatedSessionState.expectedEntity === "branchSelection" ||
    updatedSessionState.currentStep === "BRANCH_SELECTION" ||
    updatedSessionState.postEligibilityStage === "BRANCH_SELECTION";

  const isResumeLoanMsg = /^(?:now\s+)?(?:let'?s\s+)?(?:continue|resume)\b.*loan/i.test(normUserMsg) || /^(?:continue|resume)\s+(?:my\s+)?loan/i.test(normUserMsg);

  if (
    !hasCompletedEvaluation &&
    !isCollectingEligibilityField &&
    !isResumeLoanMsg &&
    (extractedEntities.CITY || extractedEntities.BRANCH || extractedEntities.PINCODE || isLocationInput(userMessage) || isBranchSelectionStepIntake) &&
    (assistantAskedLocation || isLocationInput(userMessage) || expectedEntity === "city" || expectedEntity === "preferredBranch" || isBranchSelectionStepIntake || updatedSessionState.currentStep === "CITY_COLLECTION" || updatedSessionState.expectedField === "city")
  ) {
    if (updatedSessionState.selectedBank) {
      const currentBank = updatedSessionState.selectedBank;
      const availableBranches: string[] = updatedSessionState.availableBranches || [];

      // 1. Branch selection step or explicit branch provided
      if (isBranchSelectionStepIntake || extractedEntities.BRANCH) {
        let pickedBranch = extractedEntities.BRANCH || "";
        if (isBranchSelectionStepIntake && availableBranches.length > 0) {
          const numChoice = parseInt(userMessage.trim(), 10);
          if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= availableBranches.length) {
            pickedBranch = availableBranches[numChoice - 1];
          } else {
            const normInput = userMessage.toLowerCase().replace(/[^\w]/g, " ").trim();
            const branchCandidate = availableBranches.find((b) => {
              const bNorm = b.toLowerCase().replace(/[^\w]/g, " ").trim();
              return bNorm === normInput || bNorm.includes(normInput) || normInput.includes(bNorm);
            });
            if (branchCandidate) {
              pickedBranch = branchCandidate;
            } else if (isCompanyInfoOrSearchIntent(userMessage)) {
              return await executeSearchCompanyCategory({ companyName: userMessage }, userMessage, false, updatedSessionState);
            } else if (availableBranches.length > 0) {
              const effectiveCity = updatedSessionState.city || extractedEntities.CITY || "Pune";
              return {
                reply: `Please select an available branch for **${currentBank}** in **${effectiveCity}** by replying with the branch number or name:\n\n` + availableBranches.map((b, i) => `${i + 1}. **${b}**`).join("\n"),
              };
            } else {
              pickedBranch = userMessage.trim();
            }
          }
        } else if (!pickedBranch) {
          if (isCompanyInfoOrSearchIntent(userMessage)) {
            return await executeSearchCompanyCategory({ companyName: userMessage }, userMessage, false, updatedSessionState);
          }
          pickedBranch = userMessage.trim();
        }

        const effectiveCity = updatedSessionState.city || extractedEntities.CITY || "Pune";
        const mgrRows = await searchBankManager({
          bank_name: currentBank,
          city: effectiveCity,
          branch_name: pickedBranch,
        });

        const matchedMgrs = (mgrRows || []).filter((m) => {
          return isSameBank(m.bank_name, currentBank) && recordMatchesBranch(m, pickedBranch);
        });

        const uniqueManagers = getUniqueManagerRecords(matchedMgrs);

        if (uniqueManagers.length === 0) {
          return {
            reply: `I couldn't find an ${currentBank} manager record for the ${pickedBranch} branch in ${effectiveCity}.`,
          };
        }

        const tableMarkdown = formatBankManagersTable(uniqueManagers, { userCity: effectiveCity, userBranch: pickedBranch });
        const appMessage = formatApplicationInitiatedMessage(currentBank, pickedBranch, effectiveCity);
        updatedSessionState.preferredBranch = pickedBranch;
        updatedSessionState.branch = pickedBranch;
        updatedSessionState.currentStep = "BANK_MANAGER_RESULTS";
        updatedSessionState.locationStep = "MANAGER_RESULTS";
        updatedSessionState.postEligibilityStage = "BANK_MANAGER_RESULTS";
        updatedSessionState.expectedEntity = "completed";
        updatedSessionState.expectedField = "completed";
        updatedSessionState.managerFound = true;
        await saveEligibilityState(conversationId, updatedSessionState);

        return {
          reply: `### 👔 Official Bank Manager Directory: **${currentBank}** (${pickedBranch}, ${effectiveCity})\n\n${tableMarkdown}\n\n---\n✅ **${appMessage}**`,
          bankData: uniqueManagers,
        };
      }

      // 2. City is provided -> immediately search database for branches
      const inputCity = extractedEntities.CITY || (isValidIndianPincode(userMessage.trim()) ? resolvePincodeToCity(userMessage.trim()) : "") || userMessage.trim();
      const dbBranches = await findBankBranches(currentBank, inputCity);
      const uniqueBranches = getUniqueBranches(dbBranches);

      if (uniqueBranches.length === 0) {
        return {
          reply: `I couldn't find any ${currentBank} branch records for ${inputCity} in the database.`,
        };
      }

      const formattedList = uniqueBranches.map((b, idx) => `${idx + 1}. ${b}`).join("\n");
      updatedSessionState.city = inputCity;
      updatedSessionState.location = inputCity;
      updatedSessionState.availableBranches = uniqueBranches;
      updatedSessionState.currentStep = "BRANCH_SELECTION";
      updatedSessionState.locationStep = "LOCATION_SELECTION";
      updatedSessionState.expectedEntity = "branchSelection";
      updatedSessionState.expectedField = "branchSelection";
      updatedSessionState.postEligibilityStage = "BRANCH_SELECTION";
      await saveEligibilityState(conversationId, updatedSessionState);

      return {
        reply: `Available ${currentBank} branches in ${inputCity}:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`,
      };
    } else {
      updatedSessionState.currentStep = "BANK_SELECTION";
      updatedSessionState.expectedEntity = "selectedBank";
      updatedSessionState.expectedField = "selectedBank";
      await saveEligibilityState(conversationId, updatedSessionState);

      const displayLoc = [updatedSessionState.preferredBranch, updatedSessionState.city].filter(Boolean).join(", ");
      const isGold =
        updatedSessionState.loanType === "Gold Loan" ||
        updatedSessionState.loanType === "GOLD_LOAN" ||
        /\bgold\b/i.test(updatedSessionState.applicant?.loanType || "") ||
        (conversationHistory || []).some((m) => /\bgold\b/i.test(m.content));

      if (isGold) {
        updatedSessionState.loanType = "Gold Loan";
        updatedSessionState.applicant.loanType = "Gold Loan";
        currentApplicant.loanType = "Gold Loan";
        await saveEligibilityState(conversationId, updatedSessionState);
      }

      const amtStr = updatedSessionState.applicant.loanAmount ? `for **₹${Number(updatedSessionState.applicant.loanAmount).toLocaleString("en-IN")}**` : "";
      const tenureStr = updatedSessionState.applicant.tenureMonths ? `over **${updatedSessionState.applicant.tenureMonths} months**` : "";

      let reply = `I have noted your location as **${displayLoc}** ${amtStr} ${tenureStr}.\n\n`;
      if (isGold) {
        reply += `Since gold loans are secured against your gold ornaments, **no income proof, salary slips, or ITR are required**, making this 100% accessible even while unemployed.\n\n### 🏦 Partner Bank Gold Loan Options in ${displayLoc}:\n- **HDFC Bank**\n- **ICICI Bank**\n- **State Bank of India (SBI)**\n\nWhich partner bank would you like to select to connect with the branch manager?`;
      } else {
        reply += `Which partner bank from our network would you like to proceed with (e.g. HDFC Bank, ICICI Bank, SBI)?`;
      }
      return { reply };
    }
  }



  if (isCollectingEligibilityField && eligibilitySession?.expectedField) {
    const currentStepField = eligibilitySession.expectedField;
    const currentStep = currentStepField.toUpperCase();

    const friendlyFieldMap: Record<string, string> = {
      companyName: "which company you currently work for",
      monthlyIncome: "your approximate monthly take-home salary",
      loanAmount: "the loan amount you wish to borrow",
      tenureMonths: "your preferred repayment tenure",
      cibil: "your approximate CIBIL score (or say 'not sure' if unknown)",
      age: "your current age in years",
      existingEmi: "your total existing monthly loan EMIs (or 0 if none)",
    };
    const fieldLabel = friendlyFieldMap[currentStepField] || currentStepField;

    // A. Reset / Cancellation
    if (/^(?:cancel|reset|restart|stop|exit)\b/i.test(norm)) {
      await clearEligibilityState(conversationId);
      printRouterDebug({
        currentStep,
        expectedField: currentStepField,
        userMessage,
        extractedEntity: null,
        routedHandler: "RESET_SESSION",
        updatedEligibilityState: {},
        nextStep: "NONE",
      });
      return { reply: "I have reset your loan assessment session. How else can I assist you today?" };
    }

    // B. Unemployed check
    if (/(?:unemployed|lost\s*(?:my\s*)?job|laid\s*off|no\s*job|without\s*(?:a\s*)?job|jobless)\b/i.test(norm)) {
      await clearEligibilityState(conversationId);
      printRouterDebug({
        currentStep,
        expectedField: currentStepField,
        userMessage,
        extractedEntity: { employmentStatus: "unemployed" },
        routedHandler: "ELIGIBILITY_UNEMPLOYED",
        updatedEligibilityState: { ...currentApplicant, employmentStatus: "unemployed" },
        nextStep: "NONE",
      });
      return {
        reply: "Under partner bank policies, unsecured personal loans require active employment (Salaried or Self-Employed) with regular verifiable monthly income. Unemployed applicants are currently not eligible for unsecured personal loans.",
      };
    }

    // C. Handling Pending Topic Switch Confirmation (if assistant previously asked to pause)
    const pendingSwitch = (eligibilitySession as any)?.pendingTopicSwitch as TopicSwitchIntentResult | undefined;
    if (pendingSwitch && pendingSwitch.isSwitch) {
      if (/^(?:yes|yep|yeah|sure|ok|okay|proceed|switch|pause|why\s*not|please\s*do|yes\s*please)\b/i.test(norm)) {
        await saveEligibilityState(conversationId, {
          ...eligibilitySession,
          pendingTopicSwitch: undefined,
          updatedAt: Date.now(),
        } as any);

        if (pendingSwitch.switchType === "BANK_POLICY") {
          const bankToQuery = pendingSwitch.targetBank || "";
          const policyReply = await answerBankPolicyWithMasterPolicy(bankToQuery, userMessage, requestedModel);
          return {
            reply: `${policyReply}\n\n---\n*(Your loan eligibility assessment is paused. Whenever you would like to resume, simply share ${fieldLabel} or say "resume".)*`,
          };
        } else if (pendingSwitch.switchType === "EMI_CALCULATOR") {
          return {
            reply: `Sure! Please share the loan amount, interest rate, and tenure you would like to calculate (for example: "5 lakhs at 10.5% for 3 years").\n\n*(Your loan assessment is paused. Whenever you would like to resume, simply share ${fieldLabel} or say "resume".)*`,
          };
        } else if (pendingSwitch.switchType === "BANK_MANAGER") {
          return {
            reply: `Sure! Which bank and city or branch are you looking for?\n\n*(Your loan assessment is paused. Whenever you would like to resume, simply share ${fieldLabel} or say "resume".)*`,
          };
        } else if (pendingSwitch.switchType === "COMPANY_CATEGORY") {
          return {
            reply: `Sure! Which company name would you like to look up across partner bank category tiers?\n\n*(Your loan assessment is paused. Whenever you would like to resume, simply share ${fieldLabel} or say "resume".)*`,
          };
        }
      } else if (/^(?:no|nope|nah|cancel|continue|resume|don'?t\s*pause|keep\s*going)\b/i.test(norm)) {
        await saveEligibilityState(conversationId, {
          ...eligibilitySession,
          pendingTopicSwitch: undefined,
          updatedAt: Date.now(),
        } as any);
        return {
          reply: `Understood! Let's continue with your loan eligibility assessment. Whenever you're ready, could you please share ${fieldLabel}?`,
        };
      }
      await saveEligibilityState(conversationId, {
        ...eligibilitySession,
        pendingTopicSwitch: undefined,
        updatedAt: Date.now(),
      } as any);
    }

    // D. Explicit Topic Switch Interception (Mid-Flow)
    const detectedSwitch = detectTopicSwitchIntent(userMessage);
    if (detectedSwitch.isSwitch) {
      if (detectedSwitch.switchType === "COMPANY_CATEGORY" || isCompanyInfoOrSearchIntent(userMessage)) {
        return await executeCompanyInfoSwitch(extractTargetCompanyFromMessage(userMessage));
      }
      if (isExplicitTopicSwitch(userMessage)) {
        const suspendedTask: TaskStackItem = {
          taskType: "LOAN_ELIGIBILITY",
          expectedField: currentStepField,
          missingFields: getRequiredPolicyFields(currentApplicant),
          applicantSnapshot: { ...currentApplicant },
          timestamp: Date.now(),
          description: `Suspended for topic switch: ${detectedSwitch.topicLabel}`,
        };
        const updatedStack = [...(eligibilitySession?.taskStack || [])];
        updatedStack.push(suspendedTask);
        await saveEligibilityState(conversationId, {
          ...eligibilitySession,
          taskStack: updatedStack,
          in_eligibility_flow: false,
          updatedAt: Date.now(),
        } as any);

        if (detectedSwitch.switchType === "BANK_POLICY") {
          const bankToQuery = detectedSwitch.targetBank || "";
          const policyReply = await answerBankPolicyWithMasterPolicy(bankToQuery, userMessage, requestedModel);
          return {
            reply: `${policyReply}\n\n---\n*(Your loan eligibility assessment is paused. Whenever you would like to return, simply say "resume" or "continue".)*`,
          };
        } else if (detectedSwitch.switchType === "EMI_CALCULATOR") {
          return {
            reply: `Sure! Please share the loan amount, interest rate, and tenure you would like to calculate (for example: "5 lakhs at 10.5% for 3 years").\n\n*(Your loan eligibility assessment is paused. Whenever you would like to return, simply say "resume" or "continue".)*`,
          };
        } else if (detectedSwitch.switchType === "BANK_MANAGER") {
          return {
            reply: `Sure! Which bank and city or branch are you looking for?\n\n*(Your loan eligibility assessment is paused. Whenever you would like to return, simply say "resume" or "continue".)*`,
          };
        }
      }

      await saveEligibilityState(conversationId, {
        ...eligibilitySession,
        pendingTopicSwitch: detectedSwitch,
        updatedAt: Date.now(),
      } as any);
      return {
        reply: `Would you like me to pause your loan check so we can ${detectedSwitch.topicLabel}? (Just reply **Yes** to switch, or share ${fieldLabel} to keep going).`,
      };
    }

    // E. Question, Inquiry, or Objection Handling (Hybrid: Knowledge Base + LLM)
    const sideQ = detectAndAnswerSideQuestion(userMessage, currentStepField);
    const commonQ = answerCommonBankingQuestion(userMessage, currentStepField);
    const isQuestionLike =
      sideQ.isQuestion ||
      Boolean(commonQ) ||
      /\?$/.test(norm) ||
      /^(?:why|how|what|who|where|can\s*(?:i|you)|could|does|is\s*it|are\s*there|will\s*it|tell\s*me|explain)\b/i.test(norm);

    if (isQuestionLike) {
      let answerText = commonQ || (sideQ.answer && sideQ.answer.trim().length > 0 ? sideQ.answer.trim() : "");
      if (!answerText) {
        answerText = await answerGeneralQuestionWithLLM(userMessage, requestedModel);
      }

      // Check if user ALSO provided the required field value in the same message (Compound Input)!
      const extractedResult = extractFieldAwareEntity(userMessage, currentStepField, currentApplicant);

      if (extractedResult.isValid) {
        const updatedApplicant: ApplicantProfile = {
          ...currentApplicant,
          [extractedResult.field]: extractedResult.value,
        };

        extractSecondaryParameters(
          updatedApplicant,
          userMessage,
          norm,
          extractedResult.field
        );

        const remainingMissing = getRequiredPolicyFields(updatedApplicant);

        if (remainingMissing.length > 0) {
          const nextField = remainingMissing[0];
          let nextQuestion = "";
          try {
            const dynamicQ = await generateDynamicSingleQuestionWithLLM(
              nextField,
              updatedApplicant,
              userMessage,
              requestedModel,
              undefined,
              conversationHistory
            );
            if (dynamicQ && dynamicQ.trim().length > 10 && !dynamicQ.includes("⚠️")) {
              nextQuestion = dynamicQ.trim();
            }
          } catch {}

          if (!nextQuestion) {
            const nextLabel = friendlyFieldMap[nextField] || nextField;
            nextQuestion = `Could you please share ${nextLabel} so we can continue finding the best loan options for you?`;
          }

          await saveEligibilityState(conversationId, {
            ...eligibilitySession,
            applicant: updatedApplicant,
            expectedField: nextField,
            lastAnsweredField: extractedResult.field,
            missingFields: remainingMissing,
            in_eligibility_flow: true,
            updatedAt: Date.now(),
          } as any);

          const friendlyFieldVal = formatFieldValue(extractedResult.field, extractedResult.value);
          const compoundReply = `${answerText}\n\nGot it! I've noted your ${extractedResult.field === "monthlyIncome" ? "monthly salary" : extractedResult.field} as **${friendlyFieldVal}**.\n\n${nextQuestion}`;

          return { reply: compoundReply };
        } else {
          // All fields complete -> run evaluation!
          const evalResult = await evaluateApplicantAgainstAllBanks(updatedApplicant, updatedApplicant.loanType || "Personal Loan");
          let report = formatDynamicEligibilityReport(updatedApplicant, evalResult);
          report = `> [!NOTE]\n> **Answering your question:** ${answerText}\n\n` + report;

          await saveEligibilityState(conversationId, {
            applicant: updatedApplicant,
            expectedField: "selectedBank",
            missingFields: [],
            in_eligibility_flow: false,
            hasCompletedEvaluation: true,
            evaluationCompleted: true,
            eligible_banks: (evalResult.eligibleBanks || []).map((b) => b.bankName),
            topBank: evalResult.recommendedBank?.bankName || (evalResult.eligibleBanks?.[0]?.bankName) || "",
            selectedBank: "",
            chosenBank: "",
            postEligibilityStage: "ELIGIBILITY_CONFIRMED",
            ineligibleBanks: (evalResult.ineligibleBanks || []).map((b) => ({
              bankName: b.bankName,
              failureReasons: b.failureReasons,
            })),
            updatedAt: Date.now(),
          } as any);

          const bankDataForClient = evalResult.evaluations.map((ev) => ({
            bank_id: ev.bankId,
            bank_name: ev.bankName,
            status: ev.status,
            is_eligible: ev.isEligible,
            roi: ev.roi,
            monthly_emi: ev.monthlyEmi,
            calculated_foir: ev.calculatedFoir,
            max_loan_eligible: ev.maxLoanEligible,
            failure_reasons: ev.failureReasons,
          }));

          return { reply: report, bankData: bankDataForClient };
        }
      } else {
        if (sideQ.topic === "company_info_inquiry" || isCompanyInfoOrSearchIntent(userMessage)) {
          return await executeCompanyInfoSwitch(extractTargetCompanyFromMessage(userMessage));
        }

        const bridge = buildContextualEligibilityResumptionBridge(currentApplicant, currentStepField);
        const reply = `${answerText.trim()}${bridge}`;

        return await finalizeAndReturn({ reply }, {
          ...eligibilitySession,
          expectedField: currentStepField,
          in_eligibility_flow: true,
          pendingEligibilityConfirmation: false,
          updatedAt: Date.now(),
        });
      }
    }

    // F. Extract Field-Aware Entity (Pure Answer flow)
    const extractedResult = extractFieldAwareEntity(userMessage, currentStepField, currentApplicant);

    if (extractedResult.isValid) {
      const updatedApplicant: ApplicantProfile = {
        ...currentApplicant,
        [extractedResult.field]: extractedResult.value,
      };

      extractSecondaryParameters(
        updatedApplicant,
        userMessage,
        norm,
        extractedResult.field
      );

      const remainingMissing = getRequiredPolicyFields(updatedApplicant);

      if (remainingMissing.length > 0) {
        const nextField = remainingMissing[0];
        let nextQuestion = "";
        try {
          const dynamicQ = await generateDynamicSingleQuestionWithLLM(
            nextField,
            updatedApplicant,
            userMessage,
            requestedModel,
            undefined,
            conversationHistory
          );
          if (dynamicQ && dynamicQ.trim().length > 10 && !dynamicQ.includes("⚠️")) {
            nextQuestion = dynamicQ.trim();
          }
        } catch {}

        if (!nextQuestion) {
          const nextLabel = friendlyFieldMap[nextField] || nextField;
          nextQuestion = `Could you please share ${nextLabel} to complete your loan eligibility check across our partner banks?`;
        }

        if (extractedResult.field === "monthlyIncome" && updatedApplicant.monthlyIncome && updatedApplicant.companyName && updatedApplicant.companyName !== "Self-Employed" && !nextQuestion.includes("take-home salary")) {
          const salStr = `₹${Number(updatedApplicant.monthlyIncome).toLocaleString("en-IN")}`;
          nextQuestion = `Got it! With a take-home salary of **${salStr}/month** at **${updatedApplicant.companyName}**, let's check your eligibility across our partner banks.\n\n${nextQuestion}`;
        }

        const sessionApp = eligibilitySession?.applicant || {};
        const ackTokens: string[] = [];
        if (updatedApplicant.age && (sessionApp.age !== updatedApplicant.age || /\b(?:age|years?\s*old|i'?m\s*\d{2})\b/i.test(userMessage))) {
          ackTokens.push(`age as ${updatedApplicant.age}`);
        }
        if (updatedApplicant.loanAmount && (sessionApp.loanAmount !== updatedApplicant.loanAmount || extractedResult.field === "loanAmount" || /\b(?:lakhs?|lacs?|k|\d+,\d+)\b/i.test(userMessage))) {
          const amtStr = Number(updatedApplicant.loanAmount) >= 100000 ? `₹${(Number(updatedApplicant.loanAmount) / 100000).toFixed(0)} Lakhs` : `₹${Number(updatedApplicant.loanAmount).toLocaleString("en-IN")}`;
          ackTokens.push(`loan amount as ${amtStr}`);
        }
        if (updatedApplicant.tenureMonths && (sessionApp.tenureMonths !== updatedApplicant.tenureMonths || /\b(?:years?|months?|yrs?)\b/i.test(userMessage))) {
          const yrs = (Number(updatedApplicant.tenureMonths) / 12).toFixed(0);
          ackTokens.push(`repayment tenure as ${yrs} years (${updatedApplicant.tenureMonths} months)`);
        }

        let promptField = nextField;
        if (ackTokens.length > 1) {
          const ackPrefix = `Thank you! I've noted your ${ackTokens.join(", ")}.\n\n`;
          promptField = "existingEmi";
          nextQuestion = `${ackPrefix}To see which partner banks can offer you the best rates, do you have any existing monthly loan EMIs? (If none, simply enter 0).`;
        }

        await saveEligibilityState(conversationId, {
          ...eligibilitySession,
          applicant: updatedApplicant,
          expectedField: promptField,
          lastAnsweredField: extractedResult.field,
          missingFields: remainingMissing,
          in_eligibility_flow: true,
          updatedAt: Date.now(),
        } as any);

        printRouterDebug({
          currentStep,
          expectedField: currentStepField,
          userMessage,
          extractedEntity: { [extractedResult.field]: extractedResult.value },
          routedHandler: "ELIGIBILITY_FIELD_COLLECTION",
          updatedEligibilityState: updatedApplicant,
          nextStep: nextField.toUpperCase(),
        });

        return await finalizeAndReturn({ reply: nextQuestion }, {
          ...eligibilitySession,
          applicant: updatedApplicant,
          expectedField: promptField,
          lastAnsweredField: extractedResult.field,
          missingFields: remainingMissing,
          in_eligibility_flow: true,
          updatedAt: Date.now(),
        });
      } else {
        // All required fields collected -> run evaluation!
        const evalResult = await evaluateApplicantAgainstAllBanks(updatedApplicant, updatedApplicant.loanType || "Personal Loan");
        const report = formatDynamicEligibilityReport(updatedApplicant, evalResult);

        const bankDataForClient = evalResult.evaluations.map((ev) => ({
          bank_id: ev.bankId,
          bank_name: ev.bankName,
          status: ev.status,
          is_eligible: ev.isEligible,
          roi: ev.roi,
          monthly_emi: ev.monthlyEmi,
          calculated_foir: ev.calculatedFoir,
          max_loan_eligible: ev.maxLoanEligible,
          failure_reasons: ev.failureReasons,
        }));

        printRouterDebug({
          currentStep,
          expectedField: currentStepField,
          userMessage,
          extractedEntity: { [extractedResult.field]: extractedResult.value },
          routedHandler: "ELIGIBILITY_EVALUATION",
          updatedEligibilityState: updatedApplicant,
          nextStep: "BANK_SELECTION",
        });

        return await finalizeAndReturn({ reply: report, bankData: bankDataForClient }, {
          applicant: updatedApplicant,
          expectedField: "selectedBank",
          missingFields: [],
          in_eligibility_flow: false,
          hasCompletedEvaluation: true,
          evaluationCompleted: true,
          eligible_banks: (evalResult.eligibleBanks || []).map((b) => b.bankName),
          topBank: evalResult.recommendedBank?.bankName || (evalResult.eligibleBanks?.[0]?.bankName) || "",
          selectedBank: "",
          chosenBank: "",
          postEligibilityStage: "ELIGIBILITY_CONFIRMED",
          ineligibleBanks: (evalResult.ineligibleBanks || []).map((b) => ({
            bankName: b.bankName,
            failureReasons: b.failureReasons,
          })),
          updatedAt: Date.now(),
        });
      }
    } else {
      // Check if user actually supplied an employer / company name correction instead of the requested field:
      const hasCorporateMarker =
        /\b(?:pvt\.?|private|limited|ltd\.?|technologies|services|consulting|solutions|systems|software|enterprises|industries|llp|holdings|group|corporation|corp|infotech|labs|infra|logistics)\b/i.test(userMessage) ||
        /^(?:(?:(?:i\s*am|i'?m|i)\s+(?:working\s+)?(?:at|in|with|for)|(?:i\s+)?(?:work|works|working|employed)\s+(?:at|in|with|for|by)|(?:my\s+)?(?:employer|company)\s+is|employer\s*[:=-]|company\s*[:=-])|(?:change|update|correct)\s+(?:my\s+)?(?:company|employer))\b/i.test(userMessage);

      if (
        !isInvalidCompanyName(userMessage) &&
        !isFinancialOrProfileInput(userMessage) &&
        userMessage.trim().length >= 2 &&
        !/^(?:yes|no|ok|okay|sure|proceed|cancel|stop|exit)\b/i.test(userMessage.trim())
      ) {
        const potentialCompanyMatch = await searchCompany(userMessage);
        if ((potentialCompanyMatch.found && potentialCompanyMatch.bankRecords.length > 0) || hasCorporateMarker) {
          const companyFlowAttempt = await handleCompanySelectionFlow(
            conversationId,
            userMessage,
            currentApplicant,
            {
              ...eligibilitySession,
              expectedField: "companyName",
            },
            undefined,
            conversationHistory
          );
          if (companyFlowAttempt) {
            return await finalizeAndReturn(companyFlowAttempt);
          }
        }
      }

      // Safety Net: Infallible interception if user asked about company info or company search
      if (isCompanyInfoOrSearchIntent(userMessage)) {
        return await executeCompanyInfoSwitch(extractTargetCompanyFromMessage(userMessage));
      }

      // Standard partner bank benchmark defaults when applicant cannot provide or skips
      const benchmarkDefaults: Record<string, any> = {
        monthlyIncome: 50000,
        loanAmount: currentApplicant?.monthlyIncome ? Math.min(500000, Number(currentApplicant.monthlyIncome) * 10) : 500000,
        tenureMonths: 36,
        cibil: "Not provided",
        age: 28,
        existingEmi: 0,
      };

      const fieldNamePretty: Record<string, string> = {
        companyName: "company name",
        monthlyIncome: "monthly salary",
        loanAmount: "loan amount",
        tenureMonths: "repayment tenure",
        cibil: "CIBIL score",
        age: "age",
        existingEmi: "existing EMIs",
      };
      const label = fieldNamePretty[currentStepField] || currentStepField;

      // 1. Question, Inquiry, or Objection Handling (Hybrid: Knowledge Base + LLM)
      const sideQ = detectAndAnswerSideQuestion(userMessage, currentStepField);
      const commonQ = answerCommonBankingQuestion(userMessage, currentStepField);
      const isQuestionLike =
        sideQ.isQuestion ||
        Boolean(commonQ) ||
        /\?$/.test(norm) ||
        /^(?:why|how|what|who|where|when|can\s*(?:i|you)|could|does|is\s*it|are\s*there|will\s*it|tell\s*me|explain|i\s*want\s*to\s*know)\b/i.test(norm);

      if (isQuestionLike) {
        let answerText = commonQ || (sideQ.answer && sideQ.answer.trim().length > 0 ? sideQ.answer.trim() : "");
        if (!answerText) {
          answerText = await answerGeneralQuestionWithLLM(userMessage, requestedModel);
        }
        const bridge = buildContextualEligibilityResumptionBridge(currentApplicant, currentStepField);
        const reply = `${answerText.trim()}${bridge}`;

        return await finalizeAndReturn({ reply }, {
          ...eligibilitySession,
          expectedField: currentStepField,
          in_eligibility_flow: true,
          pendingEligibilityConfirmation: false,
          updatedAt: Date.now(),
        });
      }

      // 2. Reluctant, skip, or unable to provide
      const isReluctantOrSkip =
        /\b(?:skip|pass|not\s*sure|don'?t\s*know|no\s*idea|haven'?t|later|next|leave\s*it|can'?t\s*say|you\s*tell\s*me|anything|whatever|standard|default|average|estimate|approx(?:imate)?)\b/i.test(norm) ||
        /don'?t\s*have|not\s*having|none|no\s*clue/i.test(norm);

      if (isReluctantOrSkip) {
        const defaultValue = benchmarkDefaults[currentStepField] ?? 0;
        const updatedApplicant: ApplicantProfile = {
          ...currentApplicant,
          [currentStepField]: defaultValue,
        };
        const remainingMissing = getRequiredPolicyFields(updatedApplicant);

        if (remainingMissing.length > 0) {
          const nextField = remainingMissing[0];
          const nextLabel = friendlyFieldMap[nextField] || nextField;
          const reply = `No problem at all! I'll apply standard benchmarks for your **${label}** so we can keep moving forward.\n\nCould you please share ${nextLabel}?`;

          return await finalizeAndReturn({ reply }, {
            ...eligibilitySession,
            applicant: updatedApplicant,
            expectedField: nextField,
            lastAnsweredField: currentStepField,
            missingFields: remainingMissing,
            fieldAttempts: { ...(eligibilitySession?.fieldAttempts || {}), [currentStepField]: 0 },
            in_eligibility_flow: true,
            updatedAt: Date.now(),
          });
        } else {
          // All fields collected! Run evaluation immediately!
          const evalResult = await evaluateApplicantAgainstAllBanks(updatedApplicant, updatedApplicant.loanType || "Personal Loan");
          const report = formatDynamicEligibilityReport(updatedApplicant, evalResult);
          const bankDataForClient = evalResult.evaluations.map((ev) => ({
            bank_id: ev.bankId,
            bank_name: ev.bankName,
            status: ev.status,
            is_eligible: ev.isEligible,
            roi: ev.roi,
            monthly_emi: ev.monthlyEmi,
            calculated_foir: ev.calculatedFoir,
            max_loan_eligible: ev.maxLoanEligible,
            failure_reasons: ev.failureReasons,
          }));

          return await finalizeAndReturn({
            reply: `No problem at all! I've used standard benchmarks for your **${label}** to complete your check.\n\n${report}`,
            bankData: bankDataForClient,
          }, {
            applicant: updatedApplicant,
            expectedField: "selectedBank",
            missingFields: [],
            in_eligibility_flow: false,
            hasCompletedEvaluation: true,
            evaluationCompleted: true,
            eligible_banks: (evalResult.eligibleBanks || []).map((b) => b.bankName),
            topBank: evalResult.recommendedBank?.bankName || (evalResult.eligibleBanks?.[0]?.bankName) || "",
            selectedBank: "",
            chosenBank: "",
            postEligibilityStage: "ELIGIBILITY_CONFIRMED",
            ineligibleBanks: (evalResult.ineligibleBanks || []).map((b) => ({
              bankName: b.bankName,
              failureReasons: b.failureReasons,
            })),
            fieldAttempts: { ...(eligibilitySession?.fieldAttempts || {}), [currentStepField]: 0 },
            updatedAt: Date.now(),
          });
        }
      }

      // 3. Circuit Breaker for unparseable input on this field
      const fieldAttempts = { ...(eligibilitySession?.fieldAttempts || {}) };
      const prevAttempts = fieldAttempts[currentStepField] || 0;
      fieldAttempts[currentStepField] = prevAttempts + 1;

      if (prevAttempts >= 1) {
        // CIRCUIT BREAKER TRIGGERED: Never stuck on single question!
        const defaultValue = benchmarkDefaults[currentStepField] ?? 0;
        const updatedApplicant: ApplicantProfile = {
          ...currentApplicant,
          [currentStepField]: defaultValue,
        };
        const remainingMissing = getRequiredPolicyFields(updatedApplicant);

        if (remainingMissing.length > 0) {
          const nextField = remainingMissing[0];
          const nextLabel = friendlyFieldMap[nextField] || nextField;
          const reply = `Understood! I'll set a standard benchmark for your **${label}** so we don't hold up your loan eligibility check.\n\nCould you please share ${nextLabel}?`;

          return await finalizeAndReturn({ reply }, {
            ...eligibilitySession,
            applicant: updatedApplicant,
            expectedField: nextField,
            lastAnsweredField: currentStepField,
            missingFields: remainingMissing,
            fieldAttempts,
            in_eligibility_flow: true,
            updatedAt: Date.now(),
          });
        } else {
          // All fields collected -> run evaluation!
          const evalResult = await evaluateApplicantAgainstAllBanks(updatedApplicant, updatedApplicant.loanType || "Personal Loan");
          const report = formatDynamicEligibilityReport(updatedApplicant, evalResult);
          const bankDataForClient = evalResult.evaluations.map((ev) => ({
            bank_id: ev.bankId,
            bank_name: ev.bankName,
            status: ev.status,
            is_eligible: ev.isEligible,
            roi: ev.roi,
            monthly_emi: ev.monthlyEmi,
            calculated_foir: ev.calculatedFoir,
            max_loan_eligible: ev.maxLoanEligible,
            failure_reasons: ev.failureReasons,
          }));

          return await finalizeAndReturn({
            reply: `Understood! I've set standard benchmarks for your **${label}** so you can see your results without delay.\n\n${report}`,
            bankData: bankDataForClient,
          }, {
            applicant: updatedApplicant,
            expectedField: "selectedBank",
            missingFields: [],
            in_eligibility_flow: false,
            hasCompletedEvaluation: true,
            evaluationCompleted: true,
            eligible_banks: (evalResult.eligibleBanks || []).map((b) => b.bankName),
            topBank: evalResult.recommendedBank?.bankName || (evalResult.eligibleBanks?.[0]?.bankName) || "",
            selectedBank: "",
            chosenBank: "",
            postEligibilityStage: "ELIGIBILITY_CONFIRMED",
            ineligibleBanks: (evalResult.ineligibleBanks || []).map((b) => ({
              bankName: b.bankName,
              failureReasons: b.failureReasons,
            })),
            fieldAttempts,
            updatedAt: Date.now(),
          });
        }
      }

      // 4. First unrecognized attempt: Acknowledge & offer friendly guidance with explicit skip option
      let friendlyGuidance = "";
      switch (currentStepField) {
        case "monthlyIncome":
          friendlyGuidance = currentApplicant.companyName
            ? `To check your loan eligibility for **${currentApplicant.companyName}**, could you share your approximate monthly take-home salary (for example: ₹50,000)? *(Or reply 'skip' to use standard ₹50,000)*`
            : "Just need a quick number for your monthly salary (like ₹50,000). What is your approximate take-home pay? *(Or reply 'skip' to use standard ₹50,000)*";
          break;
        case "loanAmount":
          friendlyGuidance = "How much loan amount are you looking to borrow (e.g. ₹3,00,000 or ₹5 Lakhs)? *(Or reply 'skip' to use standard ₹5 Lakhs)*";
          break;
        case "tenureMonths":
          friendlyGuidance = "How many years or months would you like to repay the loan over (e.g. 3 years or 36 months)? *(Or reply 'skip' for 3 years)*";
          break;
        case "cibil":
          friendlyGuidance = "Could you share your approximate CIBIL score (e.g. 750), or simply say 'not sure' if you haven't checked it recently?";
          break;
        case "age":
          friendlyGuidance = "Could you please share your current age in years (e.g. 28)? Partner banks typically require applicants to be between 21 and 60 years. *(Or reply 'skip')*";
          break;
        case "existingEmi":
          friendlyGuidance = "Do you have any ongoing loan EMIs each month? If none, you can simply reply '0'. *(Or reply 'skip')*";
          break;
        default:
          friendlyGuidance = `Could you please share ${fieldLabel}? *(Or reply 'skip' to proceed)*`;
      }

      printRouterDebug({
        currentStep,
        expectedField: currentStepField,
        userMessage,
        extractedEntity: null,
        routedHandler: "ELIGIBILITY_CLARIFICATION",
        updatedEligibilityState: currentApplicant,
        nextStep: currentStep,
      });

      return await finalizeAndReturn({ reply: friendlyGuidance }, {
        ...eligibilitySession,
        fieldAttempts,
        updatedAt: Date.now(),
      });
    }
  }

  const eligibleBanks: string[] = eligibilitySession?.eligible_banks || (eligibilitySession as any)?.evaluatedBanks || [];
  const topRecommendedBank: string = eligibilitySession?.topBank || eligibleBanks[0] || "";
  const existingChosenBank: string = eligibilitySession?.selectedBank || eligibilitySession?.chosenBank || "";
  const existingCity: string = eligibilitySession?.city || eligibilitySession?.location || currentApplicant.location || "";
  const existingRejectedBanks: string[] = eligibilitySession?.rejectedBanks || [];

  let sessionIneligibleBanks: Array<{ bankName: string; failureReasons: string[] }> =
    eligibilitySession?.ineligibleBanks || [];
  if (
    (!sessionIneligibleBanks || sessionIneligibleBanks.length === 0) &&
    hasCompletedEvaluation &&
    currentApplicant.monthlyIncome &&
    currentApplicant.loanAmount &&
    currentApplicant.cibil
  ) {
    try {
      const quickEval = await evaluateApplicantAgainstAllBanks(currentApplicant, currentApplicant.loanType || "Personal Loan");
      sessionIneligibleBanks = (quickEval.ineligibleBanks || []).map((b) => ({
        bankName: b.bankName,
        failureReasons: b.failureReasons,
      }));
    } catch (e) {
      console.warn("Could not evaluate ineligibility criteria for context:", e);
    }
  }

  // 4. Master LLM Conversational Analysis
  const analysis = await analyzeConversationWithLLM({
    userMessage: effectiveUserMessage,
    conversationHistory,
    applicant: currentApplicant,
    missingFields: currentMissingFields,
    isFlowActive: isEligibleFlowActive,
    hasCompletedEvaluation,
    eligibleBanks,
    topRecommendedBank,
    chosenBank: existingChosenBank,
    city: existingCity,
    rejectedBanks: existingRejectedBanks,
    failedCriteria: sessionIneligibleBanks,
    modelOverride: requestedModel,
    currentTime,
  });

  // Check for common banking questions (e.g. "What is EMI?", "What is FOIR?") to ensure accurate answers
  const commonQAns = answerCommonBankingQuestion(userMessage);
  if (commonQAns) {
    analysis.hasQuestionOrObjection = true;
    analysis.questionAnswer = commonQAns;
    analysis.isTechnicalError = false;
  }

  // 4b. Technical API/network error handling:
  // If the applicant sends details, extract ALL parameters from userMessage generically.
  // Never throw away user data, and evaluate against bank policies if all 7 fields are ready.
  if (analysis.isTechnicalError) {
    const sideQTech = detectAndAnswerSideQuestion(userMessage, eligibilitySession?.expectedField);
    if (sideQTech.isQuestion && sideQTech.answer && sideQTech.answer.trim().length > 0) {
      if (isEligibleFlowActive && eligibilitySession?.expectedField) {
        const reply = `${sideQTech.answer.trim()}\n\nWhenever you're ready, we can return to your loan eligibility check. Would you like to proceed?`;
        return await finalizeAndReturn({ reply }, {
          ...eligibilitySession,
          in_eligibility_flow: true,
          pendingEligibilityConfirmation: false,
          updatedAt: Date.now(),
        });
      }
      return await finalizeAndReturn({ reply: sideQTech.answer.trim() });
    }

    const mergedApplicant = extractApplicantDetails(userMessage, currentApplicant, currentMissingFields);
    Object.assign(currentApplicant, mergedApplicant);

    if (currentApplicant.companyName && currentApplicant.companyName !== "Self-Employed") {
      try {
        const resolved = await resolveCompanyCategories(currentApplicant.companyName);
        if (resolved?.matchedName) currentApplicant.companyName = resolved.matchedName;
      } catch {}
    }

    const isUnemployedErrorCase =
      currentApplicant.employmentStatus === "unemployed" ||
      currentApplicant.employmentType === "Unemployed";

    if (isUnemployedErrorCase) {
      await clearEligibilityState(conversationId);
      return {
        reply: "Under partner bank policies, unsecured personal loans require active employment (Salaried or Self-Employed) with regular verifiable monthly income. Unemployed applicants are currently not eligible for unsecured personal loans.",
      };
    }

    const hasPriorBankManager = Boolean(
      eligibilitySession?.lastBankManagerSearch ||
      eligibilitySession?.postEligibilityStage === "BANK_MANAGER_RESULTS" ||
      eligibilitySession?.postEligibilityStage === "BANK_MANAGER_DETAILS_INPUT"
    );

    const hasExplicitLoanIntent = detectLoanIntent(userMessage).isLoanIntent;

    const hasLoanIntent =
      !hasPriorBankManager &&
      (isEligibleFlowActive ||
      Boolean(eligibilitySession?.in_eligibility_flow) ||
      hasExplicitLoanIntent ||
      Boolean(currentApplicant.companyName) ||
      Boolean(currentApplicant.monthlyIncome) ||
      Boolean(currentApplicant.loanAmount) ||
      [currentApplicant.companyName, currentApplicant.monthlyIncome, currentApplicant.loanAmount, currentApplicant.cibil].filter((v) => v != null).length >= 1);

    if (hasLoanIntent) {
      // -----------------------------------------------------------------------
      // LAW 1: MANDATORY WEBHOOK CALL ON EVERY TURN
      // On every single user message in loan assessment, execute Antigravity Webhook.
      // -----------------------------------------------------------------------
      const priorSessionVars: Record<string, any> = {
        ...(eligibilitySession?.sessionVariables || {}),
        ...(currentApplicant.companyName ? { employer: currentApplicant.companyName } : {}),
        ...(currentApplicant.loanAmount ? { requestedAmount: Number(currentApplicant.loanAmount) } : {}),
        ...(currentApplicant.tenureMonths ? { tenureMonths: Number(currentApplicant.tenureMonths) } : {}),
        ...(currentApplicant.cibil !== undefined ? { cibilScore: currentApplicant.cibil } : {}),
        ...(currentApplicant.age ? { age: Number(currentApplicant.age) } : {}),
        ...(currentApplicant.monthlyIncome ? { monthlyIncome: Number(currentApplicant.monthlyIncome) } : {}),
      };

      const webhookResult = await processAntigravityWebhook({
        sessionVariables: priorSessionVars,
        userMessage,
        extractedEntities: {
          ...(currentApplicant.companyName ? { employer: currentApplicant.companyName } : {}),
          ...(currentApplicant.loanAmount ? { requestedAmount: currentApplicant.loanAmount } : {}),
          ...(currentApplicant.tenureMonths ? { tenureMonths: currentApplicant.tenureMonths } : {}),
          ...(currentApplicant.cibil !== undefined ? { cibilScore: currentApplicant.cibil } : {}),
          ...(currentApplicant.age ? { age: currentApplicant.age } : {}),
          ...(currentApplicant.monthlyIncome ? { monthlyIncome: currentApplicant.monthlyIncome } : {}),
        },
        companySelectionAction,
      });

      const updatedSessionVars = webhookResult.sessionVariables;

      // LAW 2: MERGE AND DO NOT FORGET - Synchronize into currentApplicant
      if (updatedSessionVars.employer) currentApplicant.companyName = updatedSessionVars.employer;
      if (updatedSessionVars.requestedAmount) currentApplicant.loanAmount = updatedSessionVars.requestedAmount;
      if (updatedSessionVars.tenureMonths) currentApplicant.tenureMonths = updatedSessionVars.tenureMonths;
      if (updatedSessionVars.cibilScore !== undefined) currentApplicant.cibil = updatedSessionVars.cibilScore;
      if (updatedSessionVars.age) currentApplicant.age = updatedSessionVars.age;
      if (updatedSessionVars.monthlyIncome) currentApplicant.monthlyIncome = updatedSessionVars.monthlyIncome;

      if (webhookResult.isComplete) {
        // LAW 5: EVALUATION EXECUTION (SLOTS COMPLETE)
        const totalEvaluated = webhookResult.totalEvaluated || 22;
        const eligibleCount = webhookResult.eligibleCount || 0;

        let evalHeader = eligibleCount > 0
          ? `🎉 **Personal Loan Eligibility Evaluation Complete**\n\n`
          : `❌ **Personal Loan Eligibility Assessment — Policy Criteria Not Met**\n\n`;
        evalHeader += `### 👤 Applicant Summary\n`;
        evalHeader += `| Parameter | Value |\n`;
        evalHeader += `| :--- | :--- |\n`;
        if (currentApplicant.companyName) evalHeader += `| **Employer** | **${currentApplicant.companyName}** |\n`;
        if (currentApplicant.monthlyIncome) evalHeader += `| **Monthly Take-Home Salary** | ₹${Number(currentApplicant.monthlyIncome).toLocaleString("en-IN")} |\n`;
        if (currentApplicant.cibil !== undefined) evalHeader += `| **CIBIL Credit Score** | ${currentApplicant.cibil} |\n`;
        if (currentApplicant.loanAmount) evalHeader += `| **Requested Loan Amount** | ₹${Number(currentApplicant.loanAmount).toLocaleString("en-IN")} |\n`;
        if (currentApplicant.tenureMonths) evalHeader += `| **Repayment Tenure** | ${currentApplicant.tenureMonths} months (${(Number(currentApplicant.tenureMonths) / 12).toFixed(1)} years) |\n`;
        if (currentApplicant.existingEmi !== undefined && currentApplicant.existingEmi !== null) evalHeader += `| **Existing Monthly EMIs** | ₹${Number(currentApplicant.existingEmi).toLocaleString("en-IN")} |\n`;
        if (currentApplicant.age) evalHeader += `| **Applicant Age** | ${currentApplicant.age} years |\n`;
        evalHeader += `\n`;
        evalHeader += `Based on your profile at **${updatedSessionVars.employer}**, here are your qualifying options evaluated against **${totalEvaluated} partner bank policies**:\n\n`;

        const report =
          evalHeader +
          (webhookResult.markdownTable || "") +
          `\n\n` +
          `**Summary**: ${webhookResult.summary}\n\n` +
          `**Next Steps**: ${webhookResult.nextSteps}`;

        await saveEligibilityState(conversationId, {
          applicant: currentApplicant,
          sessionVariables: updatedSessionVars,
          expectedField: "selectedBank",
          currentStep: "BANK_SELECTION",
          expectedEntity: "selectedBank",
          collectedEntities: {
            employer: updatedSessionVars.employer,
            requestedAmount: updatedSessionVars.requestedAmount,
            tenureMonths: updatedSessionVars.tenureMonths,
            cibilScore: updatedSessionVars.cibilScore,
            age: updatedSessionVars.age,
          },
          missingFields: [],
          in_eligibility_flow: false,
          hasCompletedEvaluation: true,
          evaluationCompleted: true,
          eligible_banks: (webhookResult.evaluationResults || [])
            .filter((b) => b.status === "ELIGIBLE")
            .map((b) => b.bankName),
          topBank: (webhookResult.evaluationResults || []).find((b) => b.status === "ELIGIBLE")?.bankName || "",
          selectedBank: "",
          chosenBank: "",
          postEligibilityStage: "ELIGIBILITY_CONFIRMED",
          updatedAt: Date.now(),
        } as any);

        const bankDataForClient = (webhookResult.evaluationResults || []).map((ev) => ({
          bank_id: ev.bankId,
          bank_name: ev.bankName,
          status: ev.status,
          is_eligible: ev.status === "ELIGIBLE",
          roi: ev.roi,
          monthly_emi: ev.estimatedEmi,
          failure_reasons: ev.failureReasons,
        }));

        return { reply: report, bankData: bankDataForClient };
      } else {
        // LAW 3 & LAW 4: SLOTS INCOMPLETE -> ASK ONLY FOR nextSlotRequired & ACKNOWLEDGE PREVIOUS
        const rawNextSlot = webhookResult.nextSlotRequired || "company";
        const nextMissingField = rawNextSlot === "employer" ? "company" : rawNextSlot;

        await saveEligibilityState(conversationId, {
          applicant: currentApplicant,
          sessionVariables: updatedSessionVars,
          expectedField: nextMissingField,
          missingFields: webhookResult.missingSlots,
          in_eligibility_flow: true,
          updatedAt: Date.now(),
        } as any);

        // Check which slot was freshly answered in this turn (LAW 4)
        const newlyAnsweredParts: string[] = [];
        if (!priorSessionVars.employer && updatedSessionVars.employer) {
          newlyAnsweredParts.push(`employer as **${updatedSessionVars.employer}**`);
        }
        if (!priorSessionVars.requestedAmount && updatedSessionVars.requestedAmount) {
          newlyAnsweredParts.push(`loan amount as **₹${updatedSessionVars.requestedAmount.toLocaleString("en-IN")}**`);
        }
        if (!priorSessionVars.tenureMonths && updatedSessionVars.tenureMonths) {
          newlyAnsweredParts.push(`repayment tenure as **${updatedSessionVars.tenureMonths} months** (${Math.round(updatedSessionVars.tenureMonths / 12)} years)`);
        }
        if (priorSessionVars.cibilScore === undefined && updatedSessionVars.cibilScore !== undefined) {
          newlyAnsweredParts.push(`CIBIL score as **${updatedSessionVars.cibilScore}**`);
        }
        if (!priorSessionVars.age && updatedSessionVars.age) {
          newlyAnsweredParts.push(`age as **${updatedSessionVars.age} years**`);
        }

        const ackPrefix = newlyAnsweredParts.length > 0
          ? `Got it! Noted your ${newlyAnsweredParts.join(", ")}.\n\n`
          : "";

        return {
          reply: `${ackPrefix}${webhookResult.prompt}`,
          ...(webhookResult.companyData ? { companyData: webhookResult.companyData, companyQuery: webhookResult.employerConfirmationQuery } : {}),
        };
      }
    }

    const isPolicyAsk = /(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|eligibility\s*criteria)\b/i.test(norm) && !detectLoanIntent(userMessage).isLoanIntent;
    const isManagerAsk =
      /manager|branch\s*head|\basm\b|\brsm\b/i.test(norm) ||
      Boolean(resolveBankName(userMessage) && /branch|contact|phone|location|manager/i.test(norm)) ||
      hasPriorBankManager;
    const isEmiAsk = /\bemi\b/i.test(norm) && (norm.match(/(\d+(?:\.\d+)?)\s*%/) || norm.match(/(?:at|rate\s*of)\s*(\d+)/i));

    if (!hasCompletedEvaluation && !isPolicyAsk && !isManagerAsk && !isEmiAsk) {
      return {
        reply: analysis.naturalResponse || "How can I help you today? You can evaluate your personal loan eligibility, check partner bank policies, or look up branch managers.",
      };
    }
  }

  // 4c. Post-Evaluation Bank Selection & Next Action Routing
  if (hasCompletedEvaluation) {
    // Check if user is updating any parameter (even a single one) or requesting re-evaluation/recalculation
    const profileUpdates = extractProfileUpdates(userMessage, analysis.extractedDetails as any);
    const hasFieldUpdates = Object.keys(profileUpdates.updates).length > 0;
    const wantsRecalc =
      analysis.wantsReevaluation ||
      /recalculat|re-evaluat|calculate\s*(?:again|with|for)|what\s*if|check\s*(?:again|with|for)|update\s*(?:my)?/i.test(userMessage);

    const isApplicantParameterCorrection =
      (hasFieldUpdates || wantsRecalc || analysis.isCorrection) &&
      !analysis.selectedBank &&
      !resolveBankName(userMessage, eligibleBanks);

    if (isApplicantParameterCorrection || hasFieldUpdates || wantsRecalc) {
      // Retain all previous applicant parameters, apply only the updated field(s), and immediately recalculate
      const recalcRes = await applyProfileUpdateAndRecalculate(
        conversationId,
        userMessage,
        currentApplicant,
        analysis.extractedDetails,
        requestedModel
      );

      const bankDataForClient = (recalcRes.evalResult?.eligibleBanks || []).map((ev: any) => ({
        bank_id: ev.bankId,
        bank_name: ev.bankName,
        status: ev.status,
        is_eligible: ev.status === "ELIGIBLE",
        roi: ev.roi,
        monthly_emi: ev.monthlyEmi,
        failure_reasons: ev.failureReasons,
      }));

      return {
        reply: recalcRes.reply,
        bankData: bankDataForClient,
        companyData: recalcRes.evalResult?.companyMatch?.isFound
          ? {
              company_name: recalcRes.evalResult.companyMatch.matchedName || recalcRes.evalResult.companyMatch.searchedName,
              category: recalcRes.evalResult.companyMatch.bankCategories,
              needs_disambiguation: false,
            }
          : undefined,
      };
    } else {
      let currentStage: PostEligibilityStage = (eligibilitySession?.postEligibilityStage as PostEligibilityStage) || "ELIGIBILITY_CONFIRMED";
      const updatedRejectedBanks = [...existingRejectedBanks];

      // 1. Bank Rejection handling (e.g. "I don't want Bajaj", "Not Bajaj Markets", "Skip HDFC", "Any other bank?")
      if (analysis.rejectedBank || analysis.userIntent === "REJECT_BANK") {
        const rej = (analysis.rejectedBank || existingChosenBank || "").trim();
        if (rej && !updatedRejectedBanks.some((b) => b.toLowerCase() === rej.toLowerCase())) {
          updatedRejectedBanks.push(rej);
        }
        if (existingChosenBank && rej && existingChosenBank.toLowerCase().includes(rej.toLowerCase())) {
          currentStage = "ELIGIBILITY_CONFIRMED";
        }
      }

      // 2. Build previous entities from session and reconcile dynamically
      const safePrevPincode =
        isValidIndianPincode(eligibilitySession?.pincode) && String(eligibilitySession?.pincode) !== String(currentApplicant.loanAmount)
          ? eligibilitySession?.pincode
          : (isValidIndianPincode(currentApplicant.pincode) && String(currentApplicant.pincode) !== String(currentApplicant.loanAmount) ? currentApplicant.pincode : undefined);

      const safePrevLocation =
        eligibilitySession?.location && !/^\d+$/.test(eligibilitySession.location) && eligibilitySession.location !== String(currentApplicant.loanAmount)
          ? eligibilitySession.location
          : (currentApplicant.location && !/^\d+$/.test(currentApplicant.location) && currentApplicant.location !== String(currentApplicant.loanAmount) ? currentApplicant.location : undefined);

      const safePrevBranch = eligibilitySession?.preferredBranch || eligibilitySession?.branch || undefined;
      const cleanPrevBranch = safePrevBranch && !/^\d+$/.test(safePrevBranch) && safePrevBranch !== String(currentApplicant.loanAmount)
        ? safePrevBranch
        : undefined;
      const safePrevArea = eligibilitySession?.area || currentApplicant?.area || undefined;

      const prevEntities: BankManagerSearchEntities = {
        bank_name: existingChosenBank || undefined,
        city: existingCity || undefined,
        branch: cleanPrevBranch,
        branchName: cleanPrevBranch,
        area: safePrevArea,
        pincode: safePrevPincode,
        location: safePrevLocation,
      };

      const confirmation = isConfirmationResponse(userMessage);
      const isBankWideDirectoryConfirmation = Boolean(
        eligibilitySession?.branchDirectoryAvailable && confirmation.isConfirmation && confirmation.value
      );

      // A pending branch-directory action owns an affirmative response. Do not
      // turn its "yes" into an application confirmation for a stale bank.
      if (confirmation.isConfirmation && !isBankWideDirectoryConfirmation) {
        const confVal = confirmation.value;
        if (confVal) {
          const bankName = existingChosenBank || topRecommendedBank || "Partner Bank";
          const locStr = [cleanPrevBranch, existingCity].filter(Boolean).join(", ");
          return {
            reply: `✅ **Application confirmed for ${bankName}${locStr ? ` (${locStr})` : ""}.** You can contact the branch manager directly using the verified contact details below.`,
          };
        } else {
          return {
            reply: `Understood. Would you like to select a different bank from your eligible list, or update your preferred branch/location?`,
          };
        }
      }

      const expectedFieldForTurn = eligibilitySession?.expectedEntity || eligibilitySession?.expectedField;
      const extractedParams = extractBankBranchLocationParams(
        userMessage,
        prevEntities.bank_name,
        eligibleBanks,
        expectedFieldForTurn,
        prevEntities.city
      );

      const isPriorSearchDone =
        eligibilitySession?.postEligibilityStage === "BANK_MANAGER_RESULTS" ||
        eligibilitySession?.managerFound === false;

      const finalEntities = reconcileBankManagerEntities(
        prevEntities,
        extractedParams,
        {
          expectedField: expectedFieldForTurn,
          isPriorSearchCompleted: isPriorSearchDone,
        }
      );

      let updatedChosenBank = finalEntities.bank_name || "";
      if (updatedChosenBank && updatedRejectedBanks.some((r) => r.toLowerCase() === updatedChosenBank.toLowerCase())) {
        updatedChosenBank = "";
      }
      let updatedCity = finalEntities.city || "";
      let updatedPincode = finalEntities.pincode || "";
      let updatedBranch = finalEntities.branch || "";
      let updatedArea = finalEntities.area || "";

      // Ensure numeric strings are NEVER assigned to branch, city, area, or pincode
      if (updatedBranch && /^\d+$/.test(updatedBranch.trim())) updatedBranch = "";
      if (updatedArea && /^\d+$/.test(updatedArea.trim())) updatedArea = "";
      if (updatedCity && /^\d+$/.test(updatedCity.trim())) updatedCity = "";
      if (updatedPincode && !isValidIndianPincode(updatedPincode)) updatedPincode = "";

      if (updatedPincode) currentApplicant.pincode = updatedPincode;
      if (updatedCity) currentApplicant.location = updatedCity;
      if (updatedArea) currentApplicant.area = updatedArea;
      if (updatedChosenBank && updatedChosenBank !== existingChosenBank) {
        currentStage = "BANK_SELECTION";
      }

      const isDiscoveryMsg = Boolean(
        /(?:tell|show|list|give|view|check|find)\s+(?:all\s+)?(?:available\s+)?(?:branches|locations)\b/i.test(userMessage) ||
        /(?:what|which)\s+(?:are\s+)?(?:the\s+)?(?:available\s+)?(?:branches|locations)\b/i.test(userMessage) ||
        /(?:what|which)\s+(?:branches|locations)\s+are\s+available\b/i.test(userMessage) ||
        /(?:branches|locations)\s+are\s+available\b/i.test(userMessage) ||
        /(?:available\s+branches|available\s+locations)\b/i.test(userMessage) ||
        /^(?:branches|locations)\s+(?:in|for|of)\b/i.test(userMessage)
      );

      // 3. Branch selection prompt resolution (if answering a numbered or candidate branch prompt)
      const availableBranches: string[] = eligibilitySession?.availableBranches || [];
      if (eligibilitySession?.expectedField === "branchSelection" && !isDiscoveryMsg) {
        if (isValidIndianPincode(userMessage.trim())) {
          updatedPincode = userMessage.trim();
          updatedBranch = "";
          updatedArea = "";
        } else if (availableBranches.length > 0) {
          const numChoice = parseInt(userMessage.trim(), 10);
          if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= availableBranches.length) {
            updatedBranch = availableBranches[numChoice - 1];
            updatedArea = "";
          } else {
            const normInput = userMessage.toLowerCase().replace(/[^\w]/g, " ").trim();
            const branchCandidate = availableBranches.find((b) => {
              const bNorm = b.toLowerCase().replace(/[^\w]/g, " ").trim();
              return bNorm.includes(normInput) || normInput.includes(bNorm);
            });
            if (branchCandidate) {
              updatedBranch = branchCandidate;
              updatedArea = "";
            } else if (!/^\d+$/.test(userMessage.trim())) {
              updatedBranch = userMessage.trim();
              updatedArea = "";
            }
          }
        } else if (!/^\d+$/.test(userMessage.trim())) {
          updatedBranch = userMessage.trim();
          updatedArea = "";
        }
      }

      // 4. Handle questions / objections mid-flow without destroying post-eligibility state
      if (analysis.hasQuestionOrObjection && analysis.questionAnswer) {
        let continuation = "";
        const locDisplay = updatedPincode || updatedCity;
        if (updatedChosenBank && !updatedBranch && !locDisplay) {
          continuation = `\n\n---\n*(To proceed with your **${updatedChosenBank}** application, please share your preferred city.)*`;
        } else if (updatedChosenBank && !updatedBranch && locDisplay) {
          continuation = `\n\n---\n*(I have your location as **${locDisplay}**. Which **${updatedChosenBank}** branch would you like to proceed with?)*`;
        } else if (updatedChosenBank && updatedBranch && !locDisplay) {
          continuation = `\n\n---\n*(I have your branch as **${updatedBranch}**. Which city are you located in for **${updatedChosenBank}**?)*`;
        } else if (updatedChosenBank) {
          continuation = `\n\n---\n*(To proceed with your **${updatedChosenBank}** application, please share your preferred city.)*`;
        } else {
          continuation = `\n\n---\n*(To proceed with your application, which partner bank from your eligible list would you like to select?)*`;
        }

        await saveEligibilityState(conversationId, {
          ...eligibilitySession,
          applicant: currentApplicant,
          hasCompletedEvaluation: true,
          evaluationCompleted: true,
          eligible_banks: eligibleBanks,
          topBank: topRecommendedBank,
          selectedBank: updatedChosenBank,
          chosenBank: updatedChosenBank,
          preferredBranch: updatedBranch,
          branch: updatedBranch,
          branchName: updatedBranch,
          city: updatedCity,
          area: updatedArea,
          location: [updatedBranch, updatedArea, updatedCity || updatedPincode].filter(Boolean).join(", "),
          pincode: updatedPincode,
          currentStep: eligibilitySession?.currentStep || (updatedChosenBank ? (updatedBranch ? "CITY_OR_PINCODE_COLLECTION" : "CITY_OR_PINCODE_COLLECTION") : "BANK_SELECTION"),
          locationStep: eligibilitySession?.locationStep || (updatedChosenBank ? (updatedBranch ? "MANAGER_RESULTS" : "CITY_OR_PINCODE") : undefined),
          expectedEntity: eligibilitySession?.expectedEntity || (updatedChosenBank ? "cityOrPincode" : "selectedBank"),
          collectedEntities: {
            selectedBank: updatedChosenBank,
            preferredBranch: updatedBranch,
            city: updatedCity,
            area: updatedArea,
            pincode: updatedPincode,
          },
          postEligibilityStage: currentStage,
          expectedField: eligibilitySession?.expectedField || (updatedChosenBank ? "cityOrPincode" : "selectedBank"),
          updatedAt: Date.now(),
        } as any);

        return { reply: `${analysis.questionAnswer.trim()}${continuation}` };
      }

      // 5. Evaluate next step and maintain explicit state:
      // ELIGIBILITY_CONFIRMED -> BANK_SELECTION -> CITY_OR_PINCODE -> LOCATION_SELECTION -> BANK_MANAGER_RESULTS

      // Step A: Bank is NOT yet selected
      if (!updatedChosenBank) {
        // 1. Recommendation / Best Bank request
        const isRecommendationAsk =
          /\b(?:recommend|suggest|best|lowest|cheapest|prefer(?:red)?|top|which\s*one|any(?:\s*bank)?|you\s*choose|you\s*decide|help\s*me\s*choose|either|what\s*do\s*you\s*think)\b/i.test(norm) ||
          /which\s*(?:bank\s*)?(?:is\s*)?(?:best|better|recommended|good|suitable)/i.test(norm);

        if (isRecommendationAsk && (topRecommendedBank || eligibleBanks[0])) {
          const autoBank = topRecommendedBank || eligibleBanks[0];
          await saveEligibilityState(conversationId, {
            ...eligibilitySession,
            applicant: currentApplicant,
            hasCompletedEvaluation: true,
            evaluationCompleted: true,
            eligible_banks: eligibleBanks,
            topBank: topRecommendedBank,
            selectedBank: autoBank,
            chosenBank: autoBank,
            preferredBranch: "",
            branch: "",
            currentStep: "CITY_COLLECTION",
            locationStep: "CITY_OR_PINCODE",
            expectedEntity: "city",
            postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
            expectedField: "city",
            updatedAt: Date.now(),
          } as any);

          return {
            reply: `Based on your profile, I recommend proceeding with **${autoBank}** as it offers the best terms and competitive interest rates. Please provide your branch location, city, or pincode so we can connect you with the official branch manager.`,
          };
        }

        // 2. Question or inquiry during bank selection
        const sideQ = detectAndAnswerSideQuestion(userMessage, "selectedBank");
        const commonQ = answerCommonBankingQuestion(userMessage, "selectedBank");
        const isQuestionLike =
          sideQ.isQuestion ||
          Boolean(commonQ) ||
          /\?$/.test(norm) ||
          /^(?:why|how|what|who|where|when|can\s*(?:i|you)|could|does|is\s*it|are\s*there|will\s*it|tell\s*me|explain)\b/i.test(norm);

        if (isQuestionLike) {
          let answerText = commonQ || (sideQ.answer && sideQ.answer.trim().length > 0 ? sideQ.answer.trim() : "");
          if (!answerText) {
            answerText = await answerGeneralQuestionWithLLM(userMessage, requestedModel);
          }
          return {
            reply: `${answerText.trim()}\n\n---\n*To proceed with your application, which partner bank from your eligible list would you like to select (or say 'recommend' for our top pick)?*`,
          };
        }

        // 3. Circuit Breaker for Bank Selection
        const bankAttempts = ((eligibilitySession?.fieldAttempts || {})["selectedBank"] || 0) + 1;
        const updatedFieldAttempts = {
          ...(eligibilitySession?.fieldAttempts || {}),
          selectedBank: bankAttempts,
        };

        if (bankAttempts >= 2 && (topRecommendedBank || eligibleBanks[0])) {
          const autoBank = topRecommendedBank || eligibleBanks[0];
          await saveEligibilityState(conversationId, {
            ...eligibilitySession,
            applicant: currentApplicant,
            hasCompletedEvaluation: true,
            evaluationCompleted: true,
            eligible_banks: eligibleBanks,
            topBank: topRecommendedBank,
            selectedBank: autoBank,
            chosenBank: autoBank,
            preferredBranch: "",
            branch: "",
            currentStep: "CITY_COLLECTION",
            locationStep: "CITY_OR_PINCODE",
            expectedEntity: "city",
            postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
            expectedField: "city",
            fieldAttempts: updatedFieldAttempts,
            updatedAt: Date.now(),
          } as any);

          return {
            reply: `To keep things moving forward without delay, let's proceed with **${autoBank}** (our top recommended partner bank). Please provide your branch location, city, or pincode so we can connect you with your branch manager.`,
          };
        }

        const currentStep = "BANK_SELECTION";
        const expectedEntity = "selectedBank";
        const collectedEntities = {
          companyName: currentApplicant.companyName,
          monthlyIncome: currentApplicant.monthlyIncome,
          loanAmount: currentApplicant.loanAmount,
          tenureMonths: currentApplicant.tenureMonths,
          cibil: currentApplicant.cibil,
          age: currentApplicant.age,
          existingEmi: currentApplicant.existingEmi,
        };

        await saveEligibilityState(conversationId, {
          ...eligibilitySession,
          applicant: currentApplicant,
          hasCompletedEvaluation: true,
          evaluationCompleted: true,
          eligible_banks: eligibleBanks,
          topBank: topRecommendedBank,
          selectedBank: "",
          chosenBank: "",
          preferredBranch: "",
          branch: "",
          branchName: "",
          area: "",
          city: "",
          pincode: "",
          currentStep,
          locationStep: undefined,
          expectedEntity,
          collectedEntities,
          rejectedBanks: updatedRejectedBanks,
          postEligibilityStage: "ELIGIBILITY_CONFIRMED",
          expectedField: "selectedBank",
          fieldAttempts: updatedFieldAttempts,
          updatedAt: Date.now(),
        } as any);

        return {
          reply: `Which bank from your eligible list above would you like to proceed with? Please select **ONE** bank (or say 'recommend' for our top pick) to connect with an official branch manager.`,
        };
      }

      // Step B: Bank IS selected.
      const resolvedCity = updatedCity || (isValidIndianPincode(updatedPincode) ? resolvePincodeToCity(updatedPincode) : "") || eligibilitySession?.city || "";

      // Check discovery intent: "tell available branches for Pune", "show branches in Pune", etc.
      const isDiscoveryRequest = Boolean(
        isBankWideDirectoryConfirmation ||
        extractedParams.isDiscoveryRequest ||
        /(?:tell|show|list|give|view|check|find)\s+(?:all\s+)?(?:available\s+)?(?:branches|locations)\b/i.test(userMessage) ||
        /(?:what|which)\s+(?:are\s+)?(?:the\s+)?(?:available\s+)?(?:branches|locations)\b/i.test(userMessage) ||
        /(?:what|which)\s+(?:branches|locations)\s+are\s+available\b/i.test(userMessage) ||
        /(?:branches|locations)\s+are\s+available\b/i.test(userMessage) ||
        /(?:available\s+branches|available\s+locations)\b/i.test(userMessage) ||
        /^(?:branches|locations)\s+(?:in|for|of)\b/i.test(userMessage)
      );

      // Sub-case B0: Discovery request with city known
      if (isDiscoveryRequest) {
        if (resolvedCity) {
          const dbBranches = await findBankBranches(updatedChosenBank, resolvedCity);
          const uniqueBranches = getUniqueBranches(dbBranches);
          if (uniqueBranches.length > 0) {
            const formattedList = uniqueBranches.map((b, idx) => `${idx + 1}. **${b}**`).join("\n");
            await saveEligibilityState(conversationId, {
              ...eligibilitySession,
              applicant: currentApplicant,
              hasCompletedEvaluation: true,
              evaluationCompleted: true,
              eligible_banks: eligibleBanks,
              topBank: topRecommendedBank,
              selectedBank: updatedChosenBank,
              chosenBank: updatedChosenBank,
              city: resolvedCity,
              pincode: updatedPincode || undefined,
              location: resolvedCity,
              currentStep: "BRANCH_SELECTION",
              locationStep: "LOCATION_SELECTION",
              expectedEntity: "branchSelection",
              postEligibilityStage: "BRANCH_SELECTION",
              expectedField: "branchSelection",
              availableBranches: uniqueBranches,
              lastBankManagerSearch: finalEntities,
              updatedAt: Date.now(),
            } as any);

            return {
              reply: `Available ${updatedChosenBank} branches in ${resolvedCity}:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`,
            };
          } else {
            const bankWideManagers = (await searchBankManager({ bank_name: updatedChosenBank }))
              .filter((manager) => isSameBank(manager.bank_name, updatedChosenBank));
            const bankWideBranches = getBankWideBranches(bankWideManagers);

            if (bankWideBranches.length > 0) {
              const formattedList = bankWideBranches.map((branch, idx) => `${idx + 1}. **${branch}**`).join("\n");
              await saveEligibilityState(conversationId, {
                ...eligibilitySession,
                applicant: currentApplicant,
                hasCompletedEvaluation: true,
                evaluationCompleted: true,
                eligible_banks: eligibleBanks,
                topBank: topRecommendedBank,
                selectedBank: updatedChosenBank,
                chosenBank: updatedChosenBank,
                city: undefined,
                location: undefined,
                pincode: undefined,
                branchDirectoryAvailable: false,
                branchSearchScope: "bank",
                currentStep: "BRANCH_SELECTION",
                locationStep: "LOCATION_SELECTION",
                expectedEntity: "branchSelection",
                postEligibilityStage: "BRANCH_SELECTION",
                expectedField: "branchSelection",
                availableBranches: bankWideBranches,
                lastBankManagerSearch: { ...finalEntities, city: undefined, pincode: undefined },
                updatedAt: Date.now(),
              } as any);

              return {
                reply: `Available **${updatedChosenBank}** branches in our directory:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`,
              };
            }

            await saveEligibilityState(conversationId, {
              ...eligibilitySession,
              applicant: currentApplicant,
              hasCompletedEvaluation: true,
              evaluationCompleted: true,
              eligible_banks: eligibleBanks,
              topBank: topRecommendedBank,
              selectedBank: updatedChosenBank,
              chosenBank: updatedChosenBank,
              city: "",
              pincode: "",
              branchDirectoryAvailable: false,
              currentStep: "CITY_COLLECTION",
              locationStep: "CITY_OR_PINCODE",
              expectedEntity: "city",
              postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
              expectedField: "city",
              lastBankManagerSearch: finalEntities,
              updatedAt: Date.now(),
            } as any);

            return {
              reply: `I couldn't find any ${updatedChosenBank} branch records in the database.`,
            };
          }
        } else {
          return {
            reply: `Please provide your city to check available branches for **${updatedChosenBank}**.`,
          };
        }
      }

      // Sub-case B1: User has selected a Branch from available branches (or provided a branch with city/pincode)
      if (updatedBranch && (resolvedCity || updatedPincode)) {
        const finalBankFilter = updatedChosenBank;
        const finalBranchFilter = updatedBranch;
        const finalCityFilter = resolvedCity || undefined;
        const finalPincodeFilter = isValidIndianPincode(updatedPincode) ? updatedPincode : undefined;

        const rawMgrList = await searchBankManager({
          bank_name: finalBankFilter,
          branch_name: finalBranchFilter,
          city: finalCityFilter || finalPincodeFilter,
        });

        const mgrList = (rawMgrList || []).filter((m) => {
          return isSameBank(m.bank_name, finalBankFilter) && recordMatchesBranch(m, finalBranchFilter);
        });

        const uniqueMgrs = getUniqueManagerRecords(mgrList);

        if (uniqueMgrs.length > 0) {
          await saveEligibilityState(conversationId, {
            ...eligibilitySession,
            applicant: currentApplicant,
            hasCompletedEvaluation: true,
            evaluationCompleted: true,
            eligible_banks: eligibleBanks,
            topBank: topRecommendedBank,
            selectedBank: finalBankFilter,
            chosenBank: finalBankFilter,
            preferredBranch: finalBranchFilter,
            branch: finalBranchFilter,
            branchName: finalBranchFilter,
            city: finalCityFilter,
            location: [finalBranchFilter, finalCityFilter || finalPincodeFilter].filter(Boolean).join(", "),
            pincode: finalPincodeFilter,
            currentStep: "BANK_MANAGER_RESULTS",
            locationStep: "MANAGER_RESULTS",
            expectedEntity: "completed",
            postEligibilityStage: "BANK_MANAGER_RESULTS",
            expectedField: "completed",
            managerFound: true,
            lastBankManagerSearch: finalEntities,
            updatedAt: Date.now(),
          } as any);

          const tableMarkdown = formatBankManagersTable(uniqueMgrs, {
            userPincode: finalPincodeFilter,
            userCity: finalCityFilter,
            userBranch: finalBranchFilter,
          });
          const appMessage = formatApplicationInitiatedMessage(finalBankFilter, finalBranchFilter, finalCityFilter);

          return {
            reply: `### 👔 Official Bank Manager Directory: **${finalBankFilter}** (${[finalBranchFilter, finalCityFilter || finalPincodeFilter].filter(Boolean).join(", ")})\n\n${tableMarkdown}\n\n---\n✅ **${appMessage}**`,
          };
        } else {
          return {
            reply: `I couldn't find an ${finalBankFilter} manager record for the ${finalBranchFilter} branch in ${finalCityFilter || "this city"}.`,
          };
        }
      }

      // Sub-case B2: Area is provided (e.g. "Katraj", "Swargate", "MG Road", "FC Road", "Hadapsar", or compound "Pune Katraj")
      if (updatedArea) {
        const finalBankFilter = updatedChosenBank;
        const finalCityFilter = resolvedCity || undefined;
        const finalPincodeFilter = isValidIndianPincode(updatedPincode) ? updatedPincode : undefined;

        // Direct branch/area search in bank managers
        const rawAreaMgrs = await searchBankManager({
          bank_name: finalBankFilter,
          city: finalCityFilter,
          branch_name: updatedArea,
        });

        const areaMgrs = (rawAreaMgrs || []).filter((m) => {
          return isSameBank(m.bank_name, finalBankFilter) && recordMatchesBranch(m, updatedArea);
        });

        const uniqueMgrs = getUniqueManagerRecords(areaMgrs);

        if (uniqueMgrs.length > 0) {
          await saveEligibilityState(conversationId, {
            ...eligibilitySession,
            applicant: currentApplicant,
            hasCompletedEvaluation: true,
            evaluationCompleted: true,
            eligible_banks: eligibleBanks,
            topBank: topRecommendedBank,
            selectedBank: finalBankFilter,
            chosenBank: finalBankFilter,
            preferredBranch: updatedArea,
            branch: updatedArea,
            branchName: updatedArea,
            area: updatedArea,
            city: finalCityFilter,
            location: [updatedArea, finalCityFilter || finalPincodeFilter].filter(Boolean).join(", "),
            pincode: finalPincodeFilter,
            currentStep: "BANK_MANAGER_RESULTS",
            locationStep: "MANAGER_RESULTS",
            expectedEntity: "completed",
            postEligibilityStage: "BANK_MANAGER_RESULTS",
            expectedField: "completed",
            managerFound: true,
            lastBankManagerSearch: finalEntities,
            updatedAt: Date.now(),
          } as any);

          const tableMarkdown = formatBankManagersTable(uniqueMgrs, {
            userPincode: finalPincodeFilter,
            userCity: finalCityFilter,
            userBranch: updatedArea,
          });
          const appMessage = formatApplicationInitiatedMessage(finalBankFilter, updatedArea, finalCityFilter);
          return {
            reply: `### 👔 Official Bank Manager Directory: **${finalBankFilter}** (${[updatedArea, finalCityFilter || finalPincodeFilter].filter(Boolean).join(", ")})\n\n${tableMarkdown}\n\n---\n✅ **${appMessage}**`,
          };
        } else {
          return {
            reply: `I couldn't find an ${finalBankFilter} manager record for the ${updatedArea} branch in ${finalCityFilter || "this city"}.`,
          };
        }
      }

      // Sub-case B3: Pincode is provided
      if (updatedPincode) {
        const finalBankFilter = updatedChosenBank;
        const finalCityFilter = resolvedCity || undefined;
        const finalPincodeFilter = updatedPincode;

        // 1. Search exact: bank + city + pincode
        const rawPincodeMgrs = await searchBankManager({
          bank_name: finalBankFilter,
          city: finalCityFilter,
          pincode: finalPincodeFilter,
        });

        let exactPincodeMgrs = (rawPincodeMgrs || []).filter((m) => isSameBank(m.bank_name, finalBankFilter));

        // 2. Check if pincode resolves to this city (e.g. 411009 resolves to Pune):
        const cityFromPin = resolvePincodeToCity(finalPincodeFilter);
        const pinMatchesCity = Boolean(
          (cityFromPin && finalCityFilter && cityFromPin.toLowerCase() === finalCityFilter.toLowerCase()) ||
          (!finalCityFilter && cityFromPin)
        );

        if (exactPincodeMgrs.length === 0 && pinMatchesCity) {
          const effectiveCity = finalCityFilter || cityFromPin || "";
          const cityMgrs = await searchBankManager({
            bank_name: finalBankFilter,
            city: effectiveCity,
          });
          if (cityMgrs && cityMgrs.length > 0) {
            exactPincodeMgrs = cityMgrs.filter((m) => isSameBank(m.bank_name, finalBankFilter));
          }
        }

        const uniqueMgrs = getUniqueManagerRecords(exactPincodeMgrs);

        if (uniqueMgrs.length > 0) {
          const effectiveCity = finalCityFilter || cityFromPin || "Pune";
          await saveEligibilityState(conversationId, {
            ...eligibilitySession,
            applicant: currentApplicant,
            hasCompletedEvaluation: true,
            evaluationCompleted: true,
            eligible_banks: eligibleBanks,
            topBank: topRecommendedBank,
            selectedBank: finalBankFilter,
            chosenBank: finalBankFilter,
            city: effectiveCity,
            location: effectiveCity,
            pincode: finalPincodeFilter,
            currentStep: "BANK_MANAGER_RESULTS",
            locationStep: "MANAGER_RESULTS",
            expectedEntity: "completed",
            postEligibilityStage: "BANK_MANAGER_RESULTS",
            expectedField: "completed",
            managerFound: true,
            lastBankManagerSearch: finalEntities,
            updatedAt: Date.now(),
          } as any);

          const tableMarkdown = formatBankManagersTable(uniqueMgrs, {
            userPincode: finalPincodeFilter,
            userCity: effectiveCity,
          });
          const appMessage = formatApplicationInitiatedMessage(finalBankFilter, undefined, effectiveCity);

          return {
            reply: `### 👔 Official Bank Manager Directory: **${finalBankFilter}** (${[effectiveCity, finalPincodeFilter].filter(Boolean).join(" ")})\n\n${tableMarkdown}\n\n---\n✅ **${appMessage}**`,
          };
        } else {
          const effectiveCity = finalCityFilter || "Pune";
          const dbBranches = await findBankBranches(finalBankFilter, effectiveCity);
          const uniqueBranches = getUniqueBranches(dbBranches);
          if (uniqueBranches.length > 0) {
            const formattedList = uniqueBranches.map((b, idx) => `${idx + 1}. **${b}**`).join("\n");
            await saveEligibilityState(conversationId, {
              ...eligibilitySession,
              applicant: currentApplicant,
              hasCompletedEvaluation: true,
              evaluationCompleted: true,
              eligible_banks: eligibleBanks,
              topBank: topRecommendedBank,
              selectedBank: finalBankFilter,
              chosenBank: finalBankFilter,
              city: effectiveCity,
              pincode: finalPincodeFilter,
              currentStep: "BRANCH_SELECTION",
              locationStep: "LOCATION_SELECTION",
              expectedEntity: "branchSelection",
              postEligibilityStage: "BRANCH_SELECTION",
              expectedField: "branchSelection",
              availableBranches: uniqueBranches,
              lastBankManagerSearch: finalEntities,
              updatedAt: Date.now(),
            } as any);

            return {
              reply: `Available ${finalBankFilter} branches in ${effectiveCity}:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`,
            };
          } else {
            await saveEligibilityState(conversationId, {
              ...eligibilitySession,
              applicant: currentApplicant,
              hasCompletedEvaluation: true,
              evaluationCompleted: true,
              eligible_banks: eligibleBanks,
              topBank: topRecommendedBank,
              selectedBank: finalBankFilter,
              chosenBank: finalBankFilter,
              city: effectiveCity,
              pincode: finalPincodeFilter,
              branchDirectoryAvailable: true,
              currentStep: "CITY_COLLECTION",
              locationStep: "CITY_OR_PINCODE",
              expectedEntity: "city",
              postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
              expectedField: "city",
              lastBankManagerSearch: finalEntities,
              updatedAt: Date.now(),
            } as any);

            return {
              reply: `I couldn't find any ${finalBankFilter} branch records for ${effectiveCity} in the database. Reply **yes** to view all available ${finalBankFilter} branches.`,
            };
          }
        }
      }

      // Sub-case B4: City ONLY is provided (neither branch nor area)
      if (resolvedCity && !updatedBranch && !updatedArea && !isDiscoveryRequest) {
        const finalBankFilter = updatedChosenBank;
        const dbBranches = await findBankBranches(finalBankFilter, resolvedCity);
        const uniqueBranches = getUniqueBranches(dbBranches);

        if (uniqueBranches.length > 0) {
          const formattedList = uniqueBranches.map((b, idx) => `${idx + 1}. **${b}**`).join("\n");
          await saveEligibilityState(conversationId, {
            ...eligibilitySession,
            applicant: currentApplicant,
            hasCompletedEvaluation: true,
            evaluationCompleted: true,
            eligible_banks: eligibleBanks,
            topBank: topRecommendedBank,
            selectedBank: finalBankFilter,
            chosenBank: finalBankFilter,
            city: resolvedCity,
            location: resolvedCity,
            pincode: updatedPincode || "",
            branch: "",
            branchName: "",
            area: "",
            currentStep: "BRANCH_SELECTION",
            locationStep: "LOCATION_SELECTION",
            expectedEntity: "branchSelection",
            postEligibilityStage: "BRANCH_SELECTION",
            expectedField: "branchSelection",
            availableBranches: uniqueBranches,
            lastBankManagerSearch: finalEntities,
            updatedAt: Date.now(),
          } as any);

          return {
            reply: `Available ${finalBankFilter} branches in ${resolvedCity}:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`,
          };
        } else {
          // Check if direct bank managers exist for this city
          const rawCityMgrs = await searchBankManager({
            bank_name: finalBankFilter,
            city: resolvedCity,
          });
          const cityMgrs = (rawCityMgrs || []).filter((m) => isSameBank(m.bank_name, finalBankFilter));
          const uniqueMgrs = getUniqueManagerRecords(cityMgrs);

          if (uniqueMgrs.length > 0) {
            await saveEligibilityState(conversationId, {
              ...eligibilitySession,
              applicant: currentApplicant,
              hasCompletedEvaluation: true,
              evaluationCompleted: true,
              eligible_banks: eligibleBanks,
              topBank: topRecommendedBank,
              selectedBank: finalBankFilter,
              chosenBank: finalBankFilter,
              city: resolvedCity,
              location: resolvedCity,
              pincode: updatedPincode || "",
              currentStep: "BANK_MANAGER_RESULTS",
              locationStep: "MANAGER_RESULTS",
              expectedEntity: "completed",
              postEligibilityStage: "BANK_MANAGER_RESULTS",
              expectedField: "completed",
              managerFound: true,
              lastBankManagerSearch: finalEntities,
              updatedAt: Date.now(),
            } as any);

            const tableMarkdown = formatBankManagersTable(uniqueMgrs, {
              userPincode: updatedPincode,
              userCity: resolvedCity,
            });
            const appMessage = formatApplicationInitiatedMessage(finalBankFilter, undefined, resolvedCity);
            return {
              reply: `### 👔 Official Bank Manager Directory: **${finalBankFilter}** (${resolvedCity})\n\n${tableMarkdown}\n\n---\n✅ **${appMessage}**`,
            };
          }

          await saveEligibilityState(conversationId, {
            ...eligibilitySession,
            applicant: currentApplicant,
            hasCompletedEvaluation: true,
            evaluationCompleted: true,
            eligible_banks: eligibleBanks,
            topBank: topRecommendedBank,
            selectedBank: finalBankFilter,
            chosenBank: finalBankFilter,
            city: resolvedCity,
            location: resolvedCity,
            branchDirectoryAvailable: true,
            currentStep: "CITY_COLLECTION",
            locationStep: "CITY_OR_PINCODE",
            expectedEntity: "city",
            postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
            expectedField: "city",
            lastBankManagerSearch: finalEntities,
            updatedAt: Date.now(),
          } as any);

          return {
            reply: `I couldn't find any ${finalBankFilter} branch records for ${resolvedCity} in the database. Reply **yes** to view all available ${finalBankFilter} branches.`,
          };
        }
      }

      // Sub-case B4b: Branch is provided, but NO city and NO pincode
      if (updatedBranch && !resolvedCity && !updatedPincode) {
        await saveEligibilityState(conversationId, {
          ...eligibilitySession,
          applicant: currentApplicant,
          hasCompletedEvaluation: true,
          evaluationCompleted: true,
          eligible_banks: eligibleBanks,
          topBank: topRecommendedBank,
          selectedBank: updatedChosenBank,
          chosenBank: updatedChosenBank,
          preferredBranch: updatedBranch,
          branch: updatedBranch,
          branchName: updatedBranch,
          currentStep: "CITY_COLLECTION",
          locationStep: "CITY_OR_PINCODE",
          expectedEntity: "city",
          postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
          expectedField: "city",
          lastBankManagerSearch: finalEntities,
          updatedAt: Date.now(),
        } as any);

        return {
          reply: `I have your branch as **${updatedBranch}**. Please provide your city for **${updatedChosenBank}** so I can look up the verified branch manager contacts.`,
        };
      }

      // Sub-case B5: Only Bank is selected, neither branch, area, city, nor pincode is provided yet
      await saveEligibilityState(conversationId, {
        ...eligibilitySession,
        applicant: currentApplicant,
        hasCompletedEvaluation: true,
        evaluationCompleted: true,
        eligible_banks: eligibleBanks,
        topBank: topRecommendedBank,
        selectedBank: updatedChosenBank,
        chosenBank: updatedChosenBank,
        preferredBranch: "",
        branch: "",
        currentStep: "CITY_COLLECTION",
        locationStep: "CITY_OR_PINCODE",
        expectedEntity: "city",
        postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
        expectedField: "city",
        lastBankManagerSearch: finalEntities,
        updatedAt: Date.now(),
      } as any);

      return {
        reply: `You selected **${updatedChosenBank}**. Please provide your branch location, city, or pincode so we can connect you with the official branch manager.`,
      };
    }
  }

  // 5. Handle Reset / Cancel
  if (analysis.userIntent === "CANCEL_RESET" || /^(cancel|reset|restart|stop|exit)\b/i.test(norm)) {
    await clearEligibilityState(conversationId);
    const numConvId = Number(conversationId);
    if (pool && Number.isFinite(numConvId)) {
      try {
        await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numConvId]);
      } catch { }
    }
    return {
      reply: "🔄 **Loan Assessment Reset**\n\nYour session has been reset. You can start fresh anytime by asking for a loan, checking bank policies, or calculating EMIs.",
    };
  }

  // 6. Handle Official Bank Policy Inquiries
  const isPersonalEligibilityAsk =
    /(?:am\s*i\s*(?:eligible|qualif\w*)|check\s*(?:my|our)\s*eligib\w*|for\s*me|my\s*eligib\w*|can\s*i\s*(?:get|apply|qualify)|i\s*(?:need|want)\s*a\s*loan)/i.test(norm);

  const isPolicyQuery =
    analysis.userIntent === "BANK_POLICY" ||
    Boolean(analysis.targetBank && /policy|rule|criteria|cutoff|guideline|foir|eligib/i.test(norm) && !isPersonalEligibilityAsk) ||
    Boolean(
      /(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|eligibility\s*criteria)\b/i.test(norm) &&
      /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|\btata\b(?!.*consultancy)|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|chola|smfg|finnable|fibe|sbm|utkarsh|aditya|abfl|birla|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)/i.test(norm) &&
      !isPersonalEligibilityAsk
    );

  if (isPolicyQuery) {
    let bankToQuery = analysis.targetBank;
    if (!bankToQuery) {
      const bankMatch = /(?:hdfc|icici|axis|sbi|kotak|indusind|idfc|bajaj|piramal|poonawalla|yes\s*bank|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm|tata\s*capital|\btata\b(?!.*consultancy)|aditya|abfl|birla|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)/i.exec(userMessage);
      if (bankMatch) bankToQuery = bankMatch[0];
    }
    if (!bankToQuery) {
      bankToQuery = extractUnsupportedBankName(userMessage) || "";
    }
    const policyReply = await answerBankPolicyWithMasterPolicy(bankToQuery, userMessage, requestedModel);
    if (bankToQuery) {
      const resolved = await resolvePolicyTarget(bankToQuery);
      const targetName = resolved?.bankName || bankToQuery;
      await saveEligibilityState(conversationId, {
        ...(eligibilitySession || {}),
        lastPolicyBank: targetName,
        selectedBank: targetName,
        chosenBank: targetName,
        currentStep: "BANK_POLICY_ANSWERED",
        updatedAt: Date.now(),
      } as any);
    }
    return { reply: policyReply };
  }

  // 7. Handle EMI Calculation
  const isEmiQuery =
    analysis.userIntent === "EMI_CALCULATION" ||
    Boolean(
      norm.match(/\bemi\b/i) &&
      (norm.match(/(\d+(?:\.\d+)?)\s*%/i) || norm.match(/(?:at|rate\s*of)\s*(\d+)/i) || /interest/i.test(norm)) &&
      (norm.match(/(\d+)\s*(?:years?|yrs?|months?|m\b)/i) || norm.match(/(?:lakhs?|lacs?|k\b|\d{5,8})/i))
    );

  if (isEmiQuery) {
    let principal = analysis.emiDetails?.principal || analysis.extractedDetails?.loanAmount;
    let rate = analysis.emiDetails?.rate;
    let tenure = analysis.emiDetails?.tenureMonths || analysis.extractedDetails?.tenureMonths;

    if (!principal) {
      const pMatch = norm.match(/(?:for|loan\s*of|amount\s*of)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|cr)?/i);
      if (pMatch) {
        principal = parseFinancialAmount(pMatch[1] + (pMatch[2] || "")) || undefined;
      }
    }
    if (!rate) {
      const rMatch = norm.match(/(\d+(?:\.\d+)?)\s*%/);
      if (rMatch) rate = parseFloat(rMatch[1]);
    }
    if (!tenure) {
      const yrMatch = norm.match(/(\d+)\s*(?:years?|yrs?|yr)/i);
      if (yrMatch) tenure = parseInt(yrMatch[1], 10) * 12;
      else {
        const moMatch = norm.match(/(\d+)\s*(?:months?|m\b)/i);
        if (moMatch) tenure = parseInt(moMatch[1], 10);
      }
    }

    const numPrincipal = typeof principal === "number" ? principal : (principal && !isNaN(Number(principal)) ? Number(principal) : 0);
    const numTenure = typeof tenure === "number" ? tenure : (tenure && !isNaN(Number(tenure)) ? Number(tenure) : 0);

    if (numPrincipal > 0) {
      const effectiveRate = rate || 10.5;
      const effectiveTenure = numTenure || 60;
      const emiVal = calculateEmi(numPrincipal, effectiveRate, effectiveTenure);
      const emiMarkdown = formatEmiResult(
        { principal: numPrincipal, rate: effectiveRate, tenure: effectiveTenure },
        emiVal
      );

      return { reply: emiMarkdown };
    }
  }

  // 8. Handle Bank Manager Directory Searches & Dynamic Entity Corrections
  const hasPriorBankManagerContext = Boolean(
    eligibilitySession?.lastBankManagerSearch ||
    eligibilitySession?.postEligibilityStage === "BANK_MANAGER_RESULTS" ||
    eligibilitySession?.postEligibilityStage === "BANK_MANAGER_DETAILS_INPUT" ||
    eligibilitySession?.postEligibilityStage === "BRANCH_SELECTION" ||
    eligibilitySession?.expectedField === "branchSelection"
  );

  const isBranchDirectoryRequest = /(?:tell|show|list|give|view|check|find)\s+(?:all\s+)?(?:available\s+)?(?:branches|locations)\b|(?:what|which)\s+(?:are\s+)?(?:the\s+)?(?:available\s+)?(?:branches|locations)\b|(?:available\s+branches|available\s+locations)\b/i.test(effectiveUserMessage);

  const bmExtracted = extractBankBranchLocationParams(
    effectiveUserMessage,
    eligibilitySession?.lastBankManagerSearch?.bank_name || eligibilitySession?.chosenBank,
    undefined,
    eligibilitySession?.expectedField,
    eligibilitySession?.lastBankManagerSearch?.city || eligibilitySession?.city
  );

  const isExplicitBankManagerAsk =
    (analysis.userIntent === "BANK_MANAGER" && (analysis.managerSearch?.bankName || /manager|branch\s*head|\basm\b|\brsm\b/i.test(norm))) ||
    Boolean(resolveBankName(effectiveUserMessage) && /manager|branch\s*head|\basm\b|\brsm\b/i.test(norm)) ||
    Boolean(/bank\s*manager|branch\s*manager/i.test(norm));

  const isBankManagerAsk =
    isExplicitBankManagerAsk ||
    Boolean(
      hasPriorBankManagerContext &&
      !analysis.isLoanIntent &&
      !isPolicyQuery &&
      !isEmiQuery &&
      (
        isBranchDirectoryRequest ||
        analysis.userIntent === "BANK_MANAGER" ||
        analysis.userIntent === "CORRECTION" ||
        bmExtracted?.isCorrection ||
        bmExtracted?.bankName ||
        bmExtracted?.branch ||
        bmExtracted?.city ||
        bmExtracted?.pincode
      )
    );

  if (isBankManagerAsk) {
    const resolvedBank = resolveBankName(effectiveUserMessage);
    const mgrArgs = {
      bank_name: analysis.managerSearch?.bankName || bmExtracted?.bankName || resolvedBank?.bankName || undefined,
      city: analysis.managerSearch?.city || bmExtracted?.city || undefined,
      branch: bmExtracted?.branch || undefined,
      pincode: bmExtracted?.pincode || undefined,
    };
    return await executeSearchBankManagers(mgrArgs, effectiveUserMessage, isEligibleFlowActive, eligibilitySession, conversationId);
  }

  // 8b. Handle Corporate Company Category Searches
  const isCompanySearch =
    !isEligibleFlowActive &&
    !isFinancialOrProfileInput(userMessage) &&
    !isLocationInput(userMessage) &&
    !assistantAskedLocation &&
    (analysis.userIntent === "COMPANY_SEARCH" ||
      ((/(?:company|employer)\s+(?:category|tier|rating|listing)|(?:is|check)\s+.*\s+(?:listed|categorized)|\bcategory\s*rating\b/i.test(norm)) &&
        !analysis.isLoanIntent &&
        !isPolicyQuery));

  if (isCompanySearch) {
    let compName = analysis.companyQuery || analysis.extractedDetails?.companyName;
    if (!compName) {
      compName = userMessage
        .replace(/^(?:what\s+is\s+the|what\s+is|tell\s+me\s+about|search|check|find|is|are)\b/gi, "")
        .replace(/\b(?:corporate\s+category\s+rating|category\s+rating|corporate\s+tier|category|rating|tier|corporate\s+listing|listed\s+in|for|of|in|records?|bank\s+records?|across\s+banks?|in\s+banks?|partner\s+banks?)\b/gi, "")
        .replace(/[?.,!]/g, "")
        .trim();
    }
    const compResult = await executeSearchCompanyCategory({ companyName: compName }, userMessage, isEligibleFlowActive, eligibilitySession);
    if (compResult.companyData?.company_flow !== "COMPANY_SELECTION" && compResult.companyData?.company_name) {
      const canonicalName = compResult.companyData.company_name;
      const currentApplicant = eligibilitySession?.applicant || {};
      const updatedApplicant: ApplicantProfile = {
        ...currentApplicant,
        companyName: canonicalName,
        employmentType: currentApplicant.employmentType || "Salaried",
      };
      const missing = getRequiredPolicyFields(updatedApplicant);
      const nextField = missing[0] || "monthlyIncome";
      const nextStepText = `Now let's continue with your eligibility assessment.\n${nextEligibilityQuestion(nextField)}`;
      if (!compResult.reply.includes("eligibility assessment")) {
        compResult.reply += `\n\n${nextStepText}`;
      }

      const updatedSession: SessionState = {
        ...(eligibilitySession || {}),
        activeFlow: "LOAN_ELIGIBILITY",
        mainUserGoal: "PERSONAL_LOAN",
        in_eligibility_flow: true,
        expectedField: nextField,
        missingFields: missing,
        applicant: updatedApplicant,
        currentStep: "ELIGIBILITY_INPUT",
        companyFlow: {
          stage: "ELIGIBILITY_INPUT",
          normalizedCompany: canonicalName,
          selectedCompanyName: canonicalName,
          selectedCompany: canonicalName,
          companyData: compResult.companyData,
        },
        selectedCompanyName: canonicalName,
        selectedCompany: canonicalName,
        updatedAt: Date.now(),
      } as SessionState;
      await saveEligibilityState(conversationId, updatedSession);
    }
    return compResult;
  }

  // 8c. Handle Live Web Search via Incraax
  if (analysis.userIntent === "WEB_SEARCH" && (analysis.webSearchQuery || /news|latest rate|rbi repo|interest rate hike/i.test(norm))) {
    const query = analysis.webSearchQuery || userMessage;
    return await executeIncraaxSearch({ query }, userMessage, isEligibleFlowActive, eligibilitySession);
  }

  // 9. Consolidate Applicant Profile & Apply Entity Updates / Corrections
  const updatedApplicant: ApplicantProfile = { ...currentApplicant };

  if (analysis.isCorrection && analysis.extractedDetails) {
    const fieldsToApply = analysis.correctedFields?.length ? analysis.correctedFields : Object.keys(analysis.extractedDetails);
    for (const f of fieldsToApply) {
      if ((analysis.extractedDetails as any)[f] !== undefined && (analysis.extractedDetails as any)[f] !== null) {
        (updatedApplicant as any)[f] = (analysis.extractedDetails as any)[f];
      }
    }
  } else if (analysis.extractedDetails) {
    if (analysis.extractedDetails.companyName && !isInvalidCompanyName(analysis.extractedDetails.companyName)) {
      updatedApplicant.companyName = analysis.extractedDetails.companyName;
    }
    if (analysis.extractedDetails.monthlyIncome !== undefined && analysis.extractedDetails.monthlyIncome !== null) {
      updatedApplicant.monthlyIncome = analysis.extractedDetails.monthlyIncome;
    }
    if (analysis.extractedDetails.loanAmount !== undefined && analysis.extractedDetails.loanAmount !== null) {
      updatedApplicant.loanAmount = analysis.extractedDetails.loanAmount;
    }
    if (analysis.extractedDetails.tenureMonths !== undefined && analysis.extractedDetails.tenureMonths !== null) {
      updatedApplicant.tenureMonths = analysis.extractedDetails.tenureMonths;
    }
    if (analysis.extractedDetails.cibil !== undefined && analysis.extractedDetails.cibil !== null) {
      updatedApplicant.cibil = analysis.extractedDetails.cibil;
    }
    if (analysis.extractedDetails.existingEmi !== undefined && analysis.extractedDetails.existingEmi !== null) {
      updatedApplicant.existingEmi = analysis.extractedDetails.existingEmi;
    } else if (
      (updatedApplicant.existingEmi === undefined || updatedApplicant.existingEmi === null) &&
      (currentMissingFields?.[0] === "existingEmi" || eligibilitySession?.expectedField === "existingEmi")
    ) {
      if (/^(?:0|zero|none|nil|no|no\s*loans?|no\s*emis?|nothing|clean|na|n\/a)\b/i.test(userMessage.trim())) {
        updatedApplicant.existingEmi = 0;
      } else {
        const parsed = parseFinancialAmount(userMessage);
        if (parsed !== null) updatedApplicant.existingEmi = parsed;
      }
    }
    if (analysis.extractedDetails.age !== undefined && analysis.extractedDetails.age !== null) {
      updatedApplicant.age = analysis.extractedDetails.age;
    }
    if (analysis.extractedDetails.employmentStatus) {
      updatedApplicant.employmentStatus = analysis.extractedDetails.employmentStatus;
      if (analysis.extractedDetails.employmentStatus === "unemployed") {
        updatedApplicant.employmentType = "Unemployed";
        updatedApplicant.monthlyIncome = 0;
        updatedApplicant.companyName = undefined;
      }
    }
    if (analysis.extractedDetails.employmentType) {
      updatedApplicant.employmentType = analysis.extractedDetails.employmentType;
      if (analysis.extractedDetails.employmentType === "Unemployed") {
        updatedApplicant.employmentStatus = "unemployed";
        updatedApplicant.monthlyIncome = 0;
        updatedApplicant.companyName = undefined;
      }
    }
  }

  // Safety net: extract any details mentioned in userMessage that LLM may have omitted
  const fallbackExtracted = extractApplicantDetails(userMessage, updatedApplicant, currentMissingFields, analysis.extractedDetails);
  Object.assign(updatedApplicant, fallbackExtracted);

  // Resolve corporate company category against 339,000+ bank records
  if (updatedApplicant.companyName && updatedApplicant.companyName !== "Self-Employed") {
    try {
      const resolved = await resolveCompanyCategories(updatedApplicant.companyName);
      if (resolved?.matchedName) {
        updatedApplicant.companyName = resolved.matchedName;
      }
    } catch { }
  }

  // 10. Check if user asked a question, objection, or context inquiry without providing new profile details
  const hasNewProfileDetailsInThisTurn =
    Boolean(analysis.extractedDetails && (
      (analysis.extractedDetails.monthlyIncome !== null && analysis.extractedDetails.monthlyIncome !== undefined) ||
      (analysis.extractedDetails.loanAmount !== null && analysis.extractedDetails.loanAmount !== undefined) ||
      (analysis.extractedDetails.tenureMonths !== null && analysis.extractedDetails.tenureMonths !== undefined) ||
      (analysis.extractedDetails.cibil !== null && analysis.extractedDetails.cibil !== undefined) ||
      (analysis.extractedDetails.age !== null && analysis.extractedDetails.age !== undefined) ||
      (analysis.extractedDetails.existingEmi !== null && analysis.extractedDetails.existingEmi !== undefined) ||
      (analysis.extractedDetails.companyName && !isInvalidCompanyName(analysis.extractedDetails.companyName))
    ));

  // If the user's message is a question, objection, or context inquiry (and no new profile details were provided in this turn),
  // directly answer the user's question without continuing the eligibility wizard, asking for a bank, restarting, or generating a table!
  const sideQCheck = detectAndAnswerSideQuestion(userMessage, currentMissingFields[0]);
  const isQuestionOrContextInquiry =
    (analysis.userIntent === "QUESTION_OR_OBJECTION" ||
      analysis.hasQuestionOrObjection ||
      sideQCheck.isQuestion) &&
    !hasNewProfileDetailsInThisTurn;

  if (isQuestionOrContextInquiry) {
    const questionReply = (sideQCheck.isQuestion && sideQCheck.answer) || analysis.questionAnswer || analysis.naturalResponse;
    if (questionReply && questionReply.trim().length > 0) {
      const isCompanyInquiry = sideQCheck.topic === "company_info_inquiry";
      const hasActiveEligibilityFlow = Boolean(
        isCompanyInquiry ||
        isEligibleFlowActive ||
        eligibilitySession?.in_eligibility_flow ||
        eligibilitySession?.expectedField ||
        updatedApplicant.companyName ||
        updatedApplicant.monthlyIncome ||
        updatedApplicant.loanAmount
      );

      if (hasActiveEligibilityFlow) {
        const nextExpected = isCompanyInquiry ? "companyName" : currentMissingFields[0];
        const missing = isCompanyInquiry
          ? (currentMissingFields.includes("companyName") ? currentMissingFields : ["companyName", ...currentMissingFields])
          : currentMissingFields;

        if (isCompanyInquiry) {
          return await finalizeAndReturn({ reply: questionReply.trim() }, {
            ...eligibilitySession,
            applicant: updatedApplicant,
            missingFields: missing,
            expectedField: nextExpected,
            in_eligibility_flow: true,
            updatedAt: Date.now(),
          });
        }

        const friendlyFieldMap: Record<string, string> = {
          companyName: "which company you currently work for",
          monthlyIncome: "your approximate monthly take-home salary",
          loanAmount: "the loan amount you wish to borrow",
          tenureMonths: "your preferred repayment tenure",
          cibil: "your approximate CIBIL score (or say 'not sure' if unknown)",
          age: "your current age in years",
          existingEmi: "your total existing monthly loan EMIs (or 0 if none)",
        };
        const askLabel = friendlyFieldMap[nextExpected] || nextExpected;
        return await finalizeAndReturn({
          reply: `${questionReply.trim()}\n\nWhenever you're ready, we can return to your loan eligibility check. Would you like to proceed?`,
        }, {
          ...eligibilitySession,
          applicant: updatedApplicant,
          missingFields: missing,
          expectedField: nextExpected,
          pendingEligibilityConfirmation: false,
          in_eligibility_flow: true,
          updatedAt: Date.now(),
        });
      }
      return await finalizeAndReturn({ reply: questionReply.trim() });
    }
  }

  // 11. Determine Loan Flow Status & Eligibility Decision
  const hasMultipleProfileParams =
    [updatedApplicant.monthlyIncome, updatedApplicant.loanAmount, updatedApplicant.cibil, updatedApplicant.companyName].filter(
      (v) => v !== undefined && v !== null
    ).length >= 2;

  const isUnemployed =
    updatedApplicant.employmentStatus === "unemployed" ||
    updatedApplicant.employmentType === "Unemployed";

  // If user is unemployed, DO NOT generate a bank table and DO NOT continue asking for loan details!
  if (isUnemployed) {
    await clearEligibilityState(conversationId);
    if (analysis.naturalResponse && analysis.naturalResponse.trim().length > 0) {
      return { reply: analysis.naturalResponse.trim() };
    }
    return {
      reply: "Under partner bank policies, unsecured personal loans require active employment (Salaried or Self-Employed) with regular verifiable monthly income to confirm repayment capacity. Unemployed applicants are currently not eligible for unsecured personal loans. If you have collateral, secured options like a gold loan or loan against fixed deposits may be possible.",
    };
  }

  const isLoanFlow =
    analysis.isLoanIntent ||
    isEligibleFlowActive ||
    Boolean(eligibilitySession?.in_eligibility_flow) ||
    hasMultipleProfileParams;

  if (isLoanFlow) {
    const priorSessionVars: Record<string, any> = {
      ...(eligibilitySession?.sessionVariables || {}),
      ...(updatedApplicant.companyName ? { employer: updatedApplicant.companyName } : {}),
      ...(updatedApplicant.loanAmount ? { requestedAmount: Number(updatedApplicant.loanAmount) } : {}),
      ...(updatedApplicant.tenureMonths ? { tenureMonths: Number(updatedApplicant.tenureMonths) } : {}),
      ...(updatedApplicant.cibil !== undefined ? { cibilScore: updatedApplicant.cibil } : {}),
      ...(updatedApplicant.age ? { age: Number(updatedApplicant.age) } : {}),
      ...(updatedApplicant.monthlyIncome ? { monthlyIncome: Number(updatedApplicant.monthlyIncome) } : {}),
    };

    const webhookResult = await processAntigravityWebhook({
      sessionVariables: priorSessionVars,
      userMessage,
      extractedEntities: {
        ...(updatedApplicant.companyName ? { employer: updatedApplicant.companyName } : {}),
        ...(updatedApplicant.loanAmount ? { requestedAmount: updatedApplicant.loanAmount } : {}),
        ...(updatedApplicant.tenureMonths ? { tenureMonths: updatedApplicant.tenureMonths } : {}),
        ...(updatedApplicant.cibil !== undefined ? { cibilScore: updatedApplicant.cibil } : {}),
        ...(updatedApplicant.age ? { age: updatedApplicant.age } : {}),
        ...(updatedApplicant.monthlyIncome ? { monthlyIncome: updatedApplicant.monthlyIncome } : {}),
      },
      companySelectionAction,
    });

    const updatedSessionVars = webhookResult.sessionVariables;

    if (updatedSessionVars.employer) updatedApplicant.companyName = updatedSessionVars.employer;
    if (updatedSessionVars.requestedAmount) updatedApplicant.loanAmount = updatedSessionVars.requestedAmount;
    if (updatedSessionVars.tenureMonths) updatedApplicant.tenureMonths = updatedSessionVars.tenureMonths;
    if (updatedSessionVars.cibilScore !== undefined) updatedApplicant.cibil = updatedSessionVars.cibilScore;
    if (updatedSessionVars.age) updatedApplicant.age = updatedSessionVars.age;
    if (updatedSessionVars.monthlyIncome) updatedApplicant.monthlyIncome = updatedSessionVars.monthlyIncome;

    if (webhookResult.isComplete) {
      const totalEvaluated = webhookResult.totalEvaluated || 22;
      const eligibleCount = webhookResult.eligibleCount || 0;
      let evalHeader = eligibleCount > 0
        ? `🎉 **Personal Loan Eligibility Evaluation Complete**\n\n`
        : `❌ **Personal Loan Eligibility Assessment — Policy Criteria Not Met**\n\n`;
      evalHeader += `### 👤 Applicant Summary\n`;
      evalHeader += `| Parameter | Value |\n`;
      evalHeader += `| :--- | :--- |\n`;
      if (updatedApplicant.companyName) evalHeader += `| **Employer** | **${updatedApplicant.companyName}** |\n`;
      if (updatedApplicant.monthlyIncome) evalHeader += `| **Monthly Take-Home Salary** | ₹${Number(updatedApplicant.monthlyIncome).toLocaleString("en-IN")} |\n`;
      if (updatedApplicant.cibil !== undefined) evalHeader += `| **CIBIL Credit Score** | ${updatedApplicant.cibil} |\n`;
      if (updatedApplicant.loanAmount) evalHeader += `| **Requested Loan Amount** | ₹${Number(updatedApplicant.loanAmount).toLocaleString("en-IN")} |\n`;
      if (updatedApplicant.tenureMonths) evalHeader += `| **Repayment Tenure** | ${updatedApplicant.tenureMonths} months (${(Number(updatedApplicant.tenureMonths) / 12).toFixed(1)} years) |\n`;
      if (updatedApplicant.existingEmi !== undefined && updatedApplicant.existingEmi !== null) evalHeader += `| **Existing Monthly EMIs** | ₹${Number(updatedApplicant.existingEmi).toLocaleString("en-IN")} |\n`;
      if (updatedApplicant.age) evalHeader += `| **Applicant Age** | ${updatedApplicant.age} years |\n`;
      evalHeader += `\n`;
      evalHeader += `Based on your profile at **${updatedSessionVars.employer}**, here are your qualifying options evaluated against **${totalEvaluated} partner bank policies**:\n\n`;

      let report =
        evalHeader +
        (webhookResult.markdownTable || "") +
        `\n\n` +
        `**Summary**: ${webhookResult.summary}\n\n` +
        `**Next Steps**: ${webhookResult.nextSteps}`;

      if (analysis.hasQuestionOrObjection && analysis.questionAnswer) {
        report = `> [!NOTE]\n> **Answering your question:** ${analysis.questionAnswer}\n\n` + report;
      }

      await saveEligibilityState(conversationId, {
        applicant: updatedApplicant,
        sessionVariables: updatedSessionVars,
        expectedField: "selectedBank",
        missingFields: [],
        in_eligibility_flow: false,
        hasCompletedEvaluation: true,
        evaluationCompleted: true,
        eligible_banks: (webhookResult.evaluationResults || [])
          .filter((b) => b.status === "ELIGIBLE")
          .map((b) => b.bankName),
        topBank: (webhookResult.evaluationResults || []).find((b) => b.status === "ELIGIBLE")?.bankName || "",
        selectedBank: "",
        chosenBank: "",
        postEligibilityStage: "ELIGIBILITY_CONFIRMED",
        updatedAt: Date.now(),
      } as any);

      const bankDataForClient = (webhookResult.evaluationResults || []).map((ev) => ({
        bank_id: ev.bankId,
        bank_name: ev.bankName,
        status: ev.status,
        is_eligible: ev.status === "ELIGIBLE",
        roi: ev.roi,
        monthly_emi: ev.estimatedEmi,
        failure_reasons: ev.failureReasons,
      }));

      return { reply: report, bankData: bankDataForClient };
    } else {
      const rawNextSlot = webhookResult.nextSlotRequired || "company";
      const nextMissingField = rawNextSlot === "employer" ? "company" : rawNextSlot;

      await saveEligibilityState(conversationId, {
        applicant: updatedApplicant,
        sessionVariables: updatedSessionVars,
        expectedField: nextMissingField,
        missingFields: webhookResult.missingSlots,
        in_eligibility_flow: true,
        updatedAt: Date.now(),
      } as any);

      const newlyAnsweredParts: string[] = [];
      if (!priorSessionVars.employer && updatedSessionVars.employer) {
        newlyAnsweredParts.push(`employer as **${updatedSessionVars.employer}**`);
      }
      if (!priorSessionVars.requestedAmount && updatedSessionVars.requestedAmount) {
        newlyAnsweredParts.push(`loan amount as **₹${updatedSessionVars.requestedAmount.toLocaleString("en-IN")}**`);
      }
      if (!priorSessionVars.tenureMonths && updatedSessionVars.tenureMonths) {
        newlyAnsweredParts.push(`repayment tenure as **${updatedSessionVars.tenureMonths} months** (${Math.round(updatedSessionVars.tenureMonths / 12)} years)`);
      }
      if (priorSessionVars.cibilScore === undefined && updatedSessionVars.cibilScore !== undefined) {
        newlyAnsweredParts.push(`CIBIL score as **${updatedSessionVars.cibilScore}**`);
      }
      if (!priorSessionVars.age && updatedSessionVars.age) {
        newlyAnsweredParts.push(`age as **${updatedSessionVars.age} years**`);
      }

      const ackPrefix = newlyAnsweredParts.length > 0
        ? `Got it! Noted your ${newlyAnsweredParts.join(", ")}.\n\n`
        : "";

      return {
        reply: `${ackPrefix}${webhookResult.prompt}`,
        ...(webhookResult.companyData ? { companyData: webhookResult.companyData, companyQuery: webhookResult.employerConfirmationQuery } : {}),
      };
    }
  }

  // 11. General Q&A, Concept Questions, Greetings & Casual Chat (when not in loan flow)
  if (analysis.hasQuestionOrObjection && analysis.questionAnswer) {
    return { reply: analysis.questionAnswer };
  }

  if (analysis.naturalResponse && analysis.naturalResponse.trim().length > 0) {
    return { reply: analysis.naturalResponse };
  }

  const fallbackGeneralAnswer = await answerGeneralQuestionWithLLM(userMessage, requestedModel, conversationHistory);
  return { reply: fallbackGeneralAnswer };
}
