import { getAllMasterPolicies } from "@/lib/masterPolicies";
import { resolveCompanyCategories, CompanyCategoryMatch } from "@/lib/companyCategoryResolver";
import { getAllBankRulesForCategory, CategoryPolicyRule } from "@/lib/masterPolicyParser";
import pool from "@/lib/db";
import { classifyIntentWithLLM, IntentClassificationResult, ExtractedEntities } from "@/lib/ai/intentClassifier";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

export interface ApplicantProfile {
  loanType?: string;
  companyName?: string;
  monthlyIncome?: number | string;
  cibil?: number | string;
  loanAmount?: number | string;
  tenureMonths?: number | string;
  existingEmi?: number | string;
  age?: number | string;
  employmentType?: string;
  employmentStatus?: string;
  location?: string;
  pincode?: string;
  branch?: string;
  area?: string;
  _lastSideQuestion?: string;
  _lastCorrectionNotice?: string;
}

export interface BankEvaluationResult {
  bankId: number;
  bankName: string;
  bankCode: string;
  fileName: string;
  resolvedCategory: string;
  isEligible: boolean;
  status: "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_REVIEW";
  reviewRequired?: boolean;
  reviewReason?: string;
  roi: number; // % p.a.
  monthlyEmi: number; // ₹/month
  maxLoanEligible: number; // ₹
  requestedLoanAmount: number; // ₹
  processingFeePercent: number;
  tenureMonths: number;
  policyCibil: string;
  policyTenure: string;
  foirPercent: number;
  calculatedFoir: number;
  verifiedChecks: string[];
  failureReasons: string[];
  policySource: string;
}

export interface DynamicEligibilityOutput {
  isComplete: boolean;
  missingFields: string[];
  nextQuestion?: string;
  applicant: ApplicantProfile;
  companyMatch?: CompanyCategoryMatch;
  evaluations?: BankEvaluationResult[];
  eligibleBanks?: BankEvaluationResult[];
  reviewBanks?: BankEvaluationResult[];
  ineligibleBanks?: BankEvaluationResult[];
  recommendedBank?: BankEvaluationResult | null;
  recommendationReason?: string;
  formattedMarkdown?: string;
}

export interface ConversationalContextNotes {
  urgency?: "high" | "normal" | "urgent" | string;
  statedPurpose?: string; // e.g. "medical emergency", "wedding", "home expenses", "debt consolidation"
  emotionalTone?: string; // e.g. "stressed", "worried", "optimistic", "neutral"
  lastCorrection?: string;
  sideQuestionAnswered?: boolean;
}

export type LocationStep =
  | "CITY_OR_PINCODE"
  | "LOCATION_SELECTION"
  | "BRANCH_SELECTION"
  | "MANAGER_LOOKUP"
  | "MANAGER_RESULTS";

export type PostEligibilityStage =
  | "ELIGIBILITY_CONFIRMED"
  | "BANK_SELECTION"
  | "BANK_MANAGER_DETAILS_INPUT"
  | "BRANCH_SELECTION"
  | "BANK_MANAGER_RESULTS";

export interface TaskStackItem {
  taskType: "LOAN_ELIGIBILITY" | "COMPANY_SEARCH" | "EMI_CALCULATOR" | "BANK_MANAGER_SEARCH" | "BANK_POLICY" | string;
  expectedField?: string;
  missingFields?: string[];
  applicantSnapshot: ApplicantProfile;
  selectedBank?: string;
  city?: string;
  timestamp: number;
  description: string;
}

export interface SessionState {
  applicant: ApplicantProfile;
  loanType?: string;
  expectedField?: string;
  postEligibilityStage?: PostEligibilityStage;
  missingFields?: string[];
  updatedAt?: number;
  summary?: string;
  activeTask?: any;
  selectedCompanyCin?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  contextNotes?: ConversationalContextNotes;
  lastAnsweredField?: string;
  lastUserAnsweredField?: string;
  lastAssistantQuestion?: string;
  activeFlow?: "LOAN_ELIGIBILITY" | "COMPANY_SEARCH" | "EMI_CALCULATOR" | "BANK_MANAGER_SEARCH" | "IDLE" | string;
  previousFlow?: string;
  in_eligibility_flow?: boolean;
  eligible_banks?: string[];
  hasCompletedEvaluation?: boolean;
  evaluationCompleted?: boolean;
  topBank?: string;
  chosenBank?: string;
  selectedBank?: string;
  lastPolicyBank?: string;
  preferredBranch?: string;
  city?: string;
  location?: string;
  pincode?: string;
  branch?: string;
  branchName?: string;
  area?: string;
  locationStep?: LocationStep | string;
  currentStep?: string;
  expectedEntity?: string;
  confirmation?: boolean;
  collectedEntities?: Record<string, any>;
  availableBranches?: string[];
  branchDirectoryAvailable?: boolean;
  branchSearchScope?: "city" | "bank";
  managerFound?: boolean;
  rejectedBanks?: string[];
  fieldAttempts?: Record<string, number>;
  lastBankManagerSearch?: BankManagerSearchEntities;
  ineligibleBanks?: Array<{ bankName: string; failureReasons: string[] }>;
  companyFlow?: {
    stage: "COMPANY_INPUT" | "COMPANY_CONFIRMATION" | "COMPANY_SELECTION" | "COMPANY_SELECTED" | "COMPANY_DETAILS" | "ELIGIBILITY_INPUT";
    originalInput?: string;
    normalizedCompany?: string;
    selectedCompanyId?: string;
    selectedCompanyName?: string;
    selectedCompany?: string;
    companyCandidate?: any;
    candidates?: Array<{ id: string; name: string; source: "database" | "live" }>;
    companyData?: any;
  };
  selectedCompanyId?: string;
  selectedCompanyName?: string;
  selectedCompany?: string;
  companyCandidate?: any;
  pendingEligibilityConfirmation?: boolean;
  pendingTopicSwitch?: any;
  activeTopic?: string;
  currentTopic?: string;
  taskStack?: TaskStackItem[];
  mainUserGoal?: "PERSONAL_LOAN" | "EMI_CALCULATION" | "COMPANY_SEARCH" | "BANK_POLICY" | "BANK_MANAGER_SEARCH" | "GENERAL_ASSISTANCE" | "UNKNOWN" | string;
  referencedEntities?: {
    lastMentionedBank?: string;
    lastMentionedAmount?: number;
    lastMentionedTenure?: number;
    lastMentionedCity?: string;
    lastSubjectOrConcept?: string;
    lastMentionedCompany?: string;
    lastCalculatedEmi?: number;
  };
}

/**
 * Application-level static mapping defining which workflow domains own which entities.
 * Ensures entity ownership is verified before state mutation.
 */
export const ENTITY_DOMAIN_MAP: Record<string, string[]> = {
  monthlyIncome: ["LOAN_ELIGIBILITY"],
  loanAmount: ["LOAN_ELIGIBILITY", "EMI_CALCULATOR"],
  tenureMonths: ["LOAN_ELIGIBILITY", "EMI_CALCULATOR"],
  cibil: ["LOAN_ELIGIBILITY"],
  existingEmi: ["LOAN_ELIGIBILITY"],
  age: ["LOAN_ELIGIBILITY"],
  companyName: ["LOAN_ELIGIBILITY", "COMPANY_SEARCH"],
  interestRate: ["EMI_CALCULATOR"],
  targetBank: ["BANK_POLICY", "BANK_MANAGER_SEARCH", "LOAN_ELIGIBILITY"],
  city: ["BANK_MANAGER_SEARCH"],
};

/**
 * Pushes a suspended workflow task onto the task stack.
 */
export function pushTaskToStack(session: SessionState, task: TaskStackItem): void {
  if (!session.taskStack) {
    session.taskStack = [];
  }
  if (session.taskStack.length >= 5) {
    session.taskStack.shift();
  }
  session.taskStack.push(task);
}

/**
 * Pops the most recently suspended task from the task stack for resumption.
 */
export function popTaskFromStack(session: SessionState): TaskStackItem | undefined {
  if (!session.taskStack || session.taskStack.length === 0) {
    return undefined;
  }
  return session.taskStack.pop();
}

/**
 * Peeks at the active suspended task at the top of the stack without removing it.
 */
export function peekActiveTask(session: SessionState): TaskStackItem | undefined {
  if (!session.taskStack || session.taskStack.length === 0) {
    return undefined;
  }
  return session.taskStack[session.taskStack.length - 1];
}

// In-memory fallback session store ensures persistence across turns even if non-numeric conversation IDs are used
export const inMemorySessionStates = new Map<string, SessionState>();

function applySessionDefaults(state: SessionState): SessionState {
  if (!state.taskStack) state.taskStack = [];
  if (!state.mainUserGoal) {
    state.mainUserGoal = state.in_eligibility_flow ? "PERSONAL_LOAN" : "UNKNOWN";
  }
  const canonicalCompany = state.selectedCompanyName || state.companyFlow?.selectedCompanyName;
  if (canonicalCompany) {
    if (!state.applicant) {
      state.applicant = { loanType: "Personal Loan", companyName: canonicalCompany };
    } else if (!state.applicant.companyName || state.applicant.companyName.toLowerCase() !== canonicalCompany.toLowerCase()) {
      state.applicant.companyName = canonicalCompany;
    }
    if (!state.selectedCompanyName) {
      state.selectedCompanyName = canonicalCompany;
    }
  }
  return state;
}

export async function getEligibilityState(conversationId: string): Promise<SessionState | null> {
  if (!conversationId || conversationId === "undefined" || conversationId === "null" || conversationId.trim() === "" || conversationId === "0") {
    return null;
  }
  if (inMemorySessionStates.has(conversationId)) {
    return applySessionDefaults(inMemorySessionStates.get(conversationId)!);
  }
  const numId = Number(conversationId);
  if (pool && Number.isFinite(numId)) {
    try {
      const res = await pool.query(
        `SELECT state FROM assistant_conversation_states WHERE conversation_id = $1 AND expires_at > NOW()`,
        [numId]
      );
      if (res.rowCount && res.rows[0].state) {
        const loaded = applySessionDefaults(res.rows[0].state);
        inMemorySessionStates.set(conversationId, loaded);
        return loaded;
      }
    } catch (e: any) {
      console.error("[getEligibilityState] Error querying DB state:", e?.message || e);
    }
  }
  return null;
}

export async function saveEligibilityState(conversationId: string, state: SessionState): Promise<void> {
  if (!conversationId || conversationId === "undefined" || conversationId === "null" || conversationId.trim() === "" || conversationId === "0") {
    return;
  }
  inMemorySessionStates.set(conversationId, state);
  const numId = Number(conversationId);
  if (pool && Number.isFinite(numId)) {
    try {
      await pool.query(
        `INSERT INTO assistant_conversation_states (conversation_id, state, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '45 minutes')
         ON CONFLICT (conversation_id) DO UPDATE SET state = $2, expires_at = NOW() + INTERVAL '45 minutes'`,
        [numId, state]
      );
    } catch (e: any) {
      console.error("[saveEligibilityState] Error persisting DB state:", e?.message || e);
    }
  }
}

export async function clearEligibilityState(conversationId: string): Promise<void> {
  if (!conversationId || conversationId === "undefined" || conversationId === "null" || conversationId.trim() === "" || conversationId === "0") {
    return;
  }
  inMemorySessionStates.delete(conversationId);
  const numId = Number(conversationId);
  if (pool && Number.isFinite(numId)) {
    try {
      await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numId]);
    } catch (e: any) {
      console.error("[clearEligibilityState] Error deleting DB state:", e?.message || e);
    }
  }
}

/**
 * Loads the complete chronological message history for a conversation from PostgreSQL.
 */
export async function getConversationHistoryMessages(conversationId: string): Promise<Array<{ role: string; content: string }>> {
  const convId = Number(conversationId);
  if (!pool || !Number.isFinite(convId)) return [];
  try {
    const res = await pool.query(
      `SELECT role, content FROM assistant_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC, id ASC`,
      [convId]
    );
    return res.rows || [];
  } catch (err) {
    console.error("Error loading conversation history messages:", err);
    return [];
  }
}

/**
 * Calculates monthly EMI using the standard financial amortization formula.
 */
export function calculateEmi(principal: number, annualRatePct: number, tenureMonths: number): number {
  if (!principal || !tenureMonths || tenureMonths <= 0) return 0;
  if (!annualRatePct || annualRatePct <= 0) return Math.round(principal / tenureMonths);

  const monthlyRate = annualRatePct / (12 * 100);
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  if (factor <= 1) return Math.round(principal / tenureMonths);

  const emi = (principal * monthlyRate * factor) / (factor - 1);
  return Math.round(emi);
}

/**
 * Calculates maximum loan capacity based on available monthly EMI headroom and tenure.
 */
export function calculateMaxLoanCapacity(availableEmi: number, annualRatePct: number, tenureMonths: number): number {
  if (!availableEmi || availableEmi <= 0 || !tenureMonths) return 0;
  const monthlyRate = (annualRatePct || 12) / (12 * 100);
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  if (factor <= 1) return Math.round(availableEmi * tenureMonths);

  const principal = (availableEmi * (factor - 1)) / (monthlyRate * factor);
  return Math.round(principal);
}

/**
 * Detects whether a message expresses loan intent and extracts the loan type.
 */
export function detectLoanIntent(
  message: string,
  preClassifiedIntent?: any
): { isLoanIntent: boolean; loanType: string } {
  if (isPureGreeting(message)) {
    return { isLoanIntent: false, loanType: "Personal Loan" };
  }
  const stripped = stripGreetingPrefix(message);
  const norm = String(stripped || message || "").toLowerCase().replace(/\s+/g, " ").trim();

  let loanType = "Personal Loan";
  if (/home\s*loan/i.test(norm)) loanType = "Home Loan";
  else if (/business\s*loan/i.test(norm)) loanType = "Business Loan";
  else if (/car\s*loan|auto\s*loan/i.test(norm)) loanType = "Auto Loan";
  else if (/education\s*loan/i.test(norm)) loanType = "Education Loan";

  // Bank policy inquiries asking for specific institution guidelines/rules/criteria/cutoffs (partner or non-partner/unsupported)
  const isBankPolicy =
    /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|\btata\b(?!.*consultancy)|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|chola|smfg|finnable|fibe|sbm|utkarsh|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb|bank)\s*(?:'s)?\s*(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|foir\s*norm|eligib\w*)/i.test(norm) ||
    /(?:policy|guidelines?|rules?|criteria|cut-off|cutoff|foir\s*norm|eligibility\s*criteria)\s*(?:of|for|from|regarding)?\s*(?:a\s*|an\s*|any\s*|the\s*)?(?:[a-z0-9\s&'.-]+)?\s*banks?\b/i.test(norm) ||
    (/(?:policy|guidelines?|rules?|cut-off|cutoff|criteria|eligib\w*)\b/i.test(norm) && /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|\btata\b(?!.*consultancy)|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|chola|smfg|finnable|fibe|sbm|utkarsh|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)/i.test(norm));

  const isPersonalEligibilityInquiry =
    /(?:am\s*i\s*(?:eligible|qualif\w*)|check\s*(?:my|our)\s*eligib\w*|for\s*me|my\s*eligib\w*|can\s*i\s*(?:get|apply|qualify)|i\s*(?:need|want)\s*a\s*loan)/i.test(norm);

  if (isBankPolicy && !isPersonalEligibilityInquiry) {
    return { isLoanIntent: false, loanType };
  }

  // Check natural user phrases expressing loan intent or inquiring about eligibility across banks
  const isNaturalLoanPhrase =
    /(?:i\s*(?:need|want|require|wish|am\s*looking\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
    /(?:apply\s*(?:for)?\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
    /(?:can\s*i\s*(?:get|have|avail|take|apply\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
    /(?:can\s*i\s*get\s*(?:a\s*)?loan)/i.test(norm) ||
    /(?:(?:what|which)\s*banks?\s*(?:am\s*i|can\s*i|could\s*i|would\s*i|should\s*i)\s*(?:be\s*)?(?:eligible|qualif\w*|get|apply))/i.test(norm) ||
    /(?:(?:which|what)\s*banks?\s*(?:can\s*i|could\s*i|will|would|do\s*i)\s*(?:get|take|avail|receive|apply\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
    /(?:(?:which|what)\s*banks?\s*(?:is|are|would\s*be)\s*(?:best|good|ideal|suitable|better|recommended)\s*for\s*(?:my\s*)?(?:personal\s*)?loan)/i.test(norm) ||
    /(?:(?:am\s*i|is\s*it\s*possible\s*for\s*me\s*to\s*be|could\s*i\s*be)\s*eligible\s*(?:for\s*(?:a\s*)?(?:personal\s*)?loan)?)/i.test(norm) ||
    /(?:(?:which|what)\s*banks?\s*will\s*(?:give|provide|grant|approve|sanction)\s*(?:me\s*)?(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
    /(?:(?:where|how)\s*can\s*i\s*(?:get|apply\s*for|avail|take)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
    /(?:(?:my\s*loan\s*options|options\s*for\s*(?:my\s*)?loan|what\s*are\s*my\s*loan\s*options))/i.test(norm) ||
    /(?:(?:do\s*i\s*qualify\s*for\s*(?:a\s*)?(?:personal\s*)?loan))/i.test(norm) ||
    /(?:(?:need|want|require)\s*(?:rs\.?|₹)?\s*[\d,]+(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr)?\s*(?:loan|for\s*\d+\s*(?:years?|yrs?|months?)))/i.test(norm) ||
    /(?:(?:need|want|require)\s*(?:rs\.?|₹)?\s*[\d,]+(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr)\b)/i.test(norm) ||
    /(?:(?:check|evaluate|calculate|test|find\s*out)\s*(?:my\s*)?(?:personal\s*)?(?:loan\s*)?eligib\w*)/i.test(norm) ||
    /^(?:i\s*need\s*a\s*loan|i\s*want\s*a\s*loan|can\s*i\s*get\s*a\s*loan|loan\s*chahiye|need\s*loan|get\s*me\s*a\s*loan|looking\s*for\s*(?:a\s*)?loan)\b/i.test(norm);

  // Check if user is sharing multiple applicant profile parameters (e.g. salary + cibil / amount / emi / tenure / company)
  const hasMultipleApplicantProfileFields =
    (Boolean(norm.match(/salary|income|take\s*home/i)) && Boolean(norm.match(/cibil|credit\s*score|score|emi|tenure|\d+\s*(?:years?|yrs?|months?)|need\s*[\d,]+|lakhs?|lacs?/i))) ||
    (Boolean(norm.match(/work\s+at|employed|employer|company/i)) && Boolean(norm.match(/salary|income|cibil|credit\s*score|need\s*[\d,]+/i))) ||
    (Boolean(norm.match(/cibil|credit\s*score/i)) && Boolean(norm.match(/emi|tenure|\d+\s*(?:years?|yrs?|months?)|need\s*[\d,]+|lakhs?|lacs?/i)));

  // Inquiries about obtaining loans while unemployed/jobless or without income/job are informational policy questions,
  // NOT loan application flows, and must NOT trigger loan intent or the eligibility wizard.
  const isJoblessPolicyInquiry =
    /(?:jobless|unemployed|without\s*(?:a\s*)?job|no\s*job|not\s*working|zero\s*salary|without\s*income|no\s*income)/i.test(norm);
  if (isJoblessPolicyInquiry) {
    return { isLoanIntent: false, loanType };
  }

  // Generic educational / informational questions about loans, finance, or banking concepts MUST NOT trigger loan intent!
  const isGenericLoanQuestion =
    /^(?:what\s+is|what\s+are|how\s+does|how\s+do|explain|difference\s+between|tell\s+me\s+about|documents\s+required|eligibility\s+criteria\s+for|what\s+documents|how\s+long\s+does|can\s+you\s+explain)\b/i.test(norm) &&
    !/(?:for\s+me|am\s+i|can\s+i\s+get|i\s+need|i\s+want|check\s+my|my\s+eligib|give\s+me)/i.test(norm);

  if (isGenericLoanQuestion) {
    return { isLoanIntent: false, loanType };
  }

  if ((isNaturalLoanPhrase || hasMultipleApplicantProfileFields) && !isBankPolicy) {
    return { isLoanIntent: true, loanType };
  }

  if (preClassifiedIntent?.intent && (!isBankPolicy || isPersonalEligibilityInquiry)) {
    const isIntent =
      preClassifiedIntent.intent === "LOAN_ELIGIBILITY" ||
      (preClassifiedIntent as any).intent === "PERSONAL_LOAN_REQUEST";
    return { isLoanIntent: isIntent, loanType: preClassifiedIntent.loanType || loanType };
  }

  if (preClassifiedIntent?.extracted && !isBankPolicy) {
    const extractedCount = [
      preClassifiedIntent.extracted.monthlyIncome,
      preClassifiedIntent.extracted.cibil,
      preClassifiedIntent.extracted.loanAmount,
      preClassifiedIntent.extracted.tenureMonths,
      preClassifiedIntent.extracted.companyName,
      preClassifiedIntent.extracted.existingEmi,
      preClassifiedIntent.extracted.age,
    ].filter((v) => v !== undefined && v !== null && v !== "").length;
    if (extractedCount >= 2) {
      return { isLoanIntent: true, loanType };
    }
  }

  return { isLoanIntent: false, loanType };
}

/**
 * Normalizes company short forms, spelling variations, and abbreviations dynamically.
 */
function normalizeCompanyName(raw: string): string {
  const clean = raw.trim();
  if (!clean) return "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveCompanyAlias } = require("@/services/companyAliases");
    if (typeof resolveCompanyAlias === "function") {
      const alias = resolveCompanyAlias(clean);
      if (alias && typeof alias === "string") return alias;
    }
  } catch {}
  return clean;
}

/**
 * Parses financial amounts with multipliers like k, lakh, lac, L, cr, crore.
 * Accurately parses 0, "0rs", "zero", "nil", "nothing", "none".
 */
export function parseFinancialAmount(valStr: string): number | null {
  const clean = String(valStr || "").replace(/[₹,]/g, "").trim().toLowerCase();
  if (/^(?:0\s*(?:rs|inr)?|rs\.?\s*0|zero|nil|none|nothing|nope|na|n\/a|no|null|clear|sab\s*clear|all\s*clear(?:ed)?|no\s*debt|zero\s*debt)$/i.test(clean)) {
    return 0;
  }

  // Indian financial slang: peti (1 Lakh = 100,000)
  const petiMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:peti|petis)\b/i);
  if (petiMatch) {
    return Math.round(parseFloat(petiMatch[1]) * 100000);
  }

  // Indian financial slang: khoka (1 Crore = 10,000,000)
  const khokaMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:khoka|khoke)\b/i);
  if (khokaMatch) {
    return Math.round(parseFloat(khokaMatch[1]) * 10000000);
  }

  // Indian financial slang: hazar (1 Thousand = 1,000)
  const hazarMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:hazar|hazaaron|haz)\b/i);
  if (hazarMatch) {
    return Math.round(parseFloat(hazarMatch[1]) * 1000);
  }

  // Ranges: "4-5 lakhs" or "4 to 5 lakhs" -> upper bound 500,000
  const rangeMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?)?/i);
  if (rangeMatch) {
    let num = parseFloat(rangeMatch[2]);
    const unit = (rangeMatch[3] || "").toLowerCase();
    if (unit === "k") num *= 1000;
    else if (unit.startsWith("l")) num *= 100000;
    else if (unit.startsWith("cr")) num *= 10000000;
    else if (num <= 100) num *= 100000; // e.g. "4 to 5" in context of lakhs
    return Math.round(num);
  }

  const m = clean.match(/^(\d+(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?)?$/i) ||
            clean.match(/(\d+(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?)/i);
  if (!m) {
    const rawNum = parseFloat(clean.replace(/[^\d.]/g, ""));
    return isNaN(rawNum) ? null : Math.round(rawNum);
  }
  let num = parseFloat(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (unit === "k") num *= 1000;
  else if (unit.startsWith("l")) num *= 100000;
  else if (unit.startsWith("cr")) num *= 10000000;
  return Math.round(num);
}

/**
 * Detects side questions asked mid-flow (e.g. credit score impact, collateral, prepayment, FOIR)
 * and generates an authoritative, helpful response.
 */
export interface SideQuestionResult {
  isQuestion: boolean;
  topic?: string;
  answer?: string;
}

export function detectAndAnswerSideQuestion(message: string, expectedField?: string): SideQuestionResult {
  const norm = message.toLowerCase().trim();

  // CIBIL score inquiry / impact
  if (
    /(?:will|does|can|is)\s+.*(?:affect|hurt|impact|damage|lower|reduce|drop|hit).*cibil/i.test(norm) ||
    /(?:cibil|credit\s*score).*(?:affect|hurt|impact|damage|lower|reduce|drop|hit|safe|risk)/i.test(norm) ||
    /(?:is\s+(?:this|it)\s+a\s+hard\s+(?:inquiry|check)|soft\s+(?:inquiry|check))/i.test(norm)
  ) {
    return {
      isQuestion: true,
      topic: "cibil_impact",
      answer:
        "Checking your loan options with CreditWise AI is completely safe:\n\n" +
        "* **Soft Evaluation**: Checking your eligibility here is an indicative soft check and **will not affect your CIBIL score or credit report**.\n" +
        "* **No Bureau Inquiry**: We do not perform hard credit pulls during comparisons.\n" +
        "* **Formal Application Only**: A hard inquiry is only triggered later if you formally apply to a specific bank.",
    };
  }

  // CIBIL definition or minimum score cutoff
  if (
    /(?:what\s+is\s+cibil|cibil\s*mean(?:ing)?|credit\s*score\s*mean(?:ing)?|define\s+cibil|explain\s+cibil|minimum\s+cibil|min\s+cibil|low\s+cibil|bad\s+cibil|cibil\s+cutoff)/i.test(norm) ||
    /\bcibil\s*(?:of\s*)?(?:5\d\d|6\d\d)\b/i.test(norm)
  ) {
    return {
      isQuestion: true,
      topic: "cibil_concept",
      answer:
        "Here is a quick overview of how CIBIL works:\n\n" +
        "* **What It Is**: A 3-digit score (from 300 to 900) summarizing your past credit and repayment track record.\n" +
        "* **Ideal Score**: **700 or above** unlocks lower interest rates and faster digital approval.\n" +
        "* **Partner Bank Cutoffs**: Most lenders look for 650–700+, though flexible policies exist if your income is strong.\n" +
        "* **Safe Soft Check**: Checking your options here is completely safe and **never impacts your score**.",
    };
  }

  // Collateral / Security / Guarantor requirement
  if (
    /\b(?:collateral|security|guarantor|pledge|mortgage)\b/i.test(norm) &&
    /\b(?:need|require|submit|give|necessary|mandatory|any)\b/i.test(norm)
  ) {
    return {
      isQuestion: true,
      topic: "collateral",
      answer:
        "Here is how collateral works for personal loans:\n\n" +
        "* **100% Unsecured**: Personal loans from all our partner banks require **no collateral, property papers, or guarantor**.\n" +
        "* **Approval Basis**: Approvals rely strictly on your verified monthly salary, employer stability, and credit track record.",
    };
  }

  // Prepayment / Foreclosure
  if (/(?:prepay|prepayment|foreclose|foreclosure|part[\s-]*payment|close\s*early)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "foreclosure",
      answer:
        "Here is how loan foreclosure and prepayments work:\n\n" +
        "* **Early Closure**: Most partner lenders allow you to pay off part of your loan or close it completely whenever you wish.\n" +
        "* **Zero Charges**: Several partner banks offer **0% foreclosure charges** once you have completed your initial 6 to 12 monthly EMIs.",
    };
  }

  // FOIR Definition
  if (/(?:what\s+is\s+foir|explain\s+foir|what\s+does\s+foir\s+mean|meaning\s+of\s+foir|define\s+foir)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "foir",
      answer:
        "Here is how Fixed Obligation to Income Ratio (FOIR) works:\n\n" +
        "* **Definition**: The percentage of your monthly net take-home salary committed to existing EMIs and credit card dues.\n" +
        "* **Bank Threshold**: Lenders typically prefer your total monthly EMIs to stay under **50% to 60%** of your net salary.\n" +
        "* **Why It Matters**: It ensures you have sufficient funds left over each month for living expenses and emergencies.",
    };
  }

  // Reducing vs Flat Interest Rate
  if (/(?:reducing\s*(?:balance)?\s*(?:interest\s*)?rate|flat\s*rate\s*vs\s*reducing|reducing\s*vs\s*flat|flat\s*interest|reducing\s*balance)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "reducing_rate",
      answer:
        "Here is the key difference between reducing balance and flat interest rates:\n\n" +
        "* **Reducing Rate**: Interest is calculated each month only on your remaining loan balance. As you pay EMIs, your interest cost shrinks progressively, saving you substantial money over the loan tenure.\n" +
        "* **Flat Rate**: Interest is charged on the entire original principal throughout the loan duration, resulting in significantly higher total repayment.",
    };
  }

  // EMI Definition / Concept
  if (/(?:what\s+is\s+emi|emi\s*mean(?:ing)?|define\s+emi|explain\s+emi|how\s+is\s+emi\s+calculated)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "emi_concept",
      answer:
        "Here is how an Equated Monthly Installment (EMI) works:\n\n" +
        "* **Definition**: A fixed monthly payment made to repay your loan over a chosen tenure.\n" +
        "* **Components**: Each payment includes both principal repayment and interest charges.\n" +
        "* **Predictability**: The installment remains constant each month, making financial planning and budgeting straightforward.",
    };
  }

  // Processing Fees & Hidden Charges
  if (/(?:processing\s*fee|hidden\s*charges?|other\s*charges?|foreclosure\s*fee|gst\s*on\s*loan)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "processing_fee",
      answer:
        "Here is how processing fees and loan charges work:\n\n" +
        "* **Standard Fee**: Partner banks typically charge a one-time processing fee between **0.5% and 2.5%** of the loan amount, deducted at disbursement.\n" +
        "* **Transparency**: All partner banks operate with transparent fee schedules—there are no surprise hidden charges.",
    };
  }

  // Company Information Inquiry / Meta Question ("i want my company information", "check my company", "what company info is needed", "i want to check my compny information")
  if (isCompanyInfoOrSearchIntent(norm)) {
    return {
      isQuestion: true,
      topic: "company_info_inquiry",
      answer:
        "I'd be glad to look up your company's profile and partner bank category ratings!\n\n" +
        "* **What I Check**: Corporate registry, listing status, workforce size, and approval tiers across 22+ partner banks.\n" +
        "* **Why It Matters**: Working for a recognized or listed company unlocks preferential interest rates and higher loan amounts.\n" +
        "* **Next Step**: Could you please tell me your company's name?",
    };
  }

  // Speed / Disbursement Timeline
  if (/(?:how\s*(?:fast|soon|quick)|how\s+long|disbursement\s*time|when\s*will\s*i\s*get)/i.test(norm) && /(?:money|funds?|loan|amount|disburs)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "disbursement_time",
      answer:
        "Here is how fast personal loan disbursement works:\n\n" +
        "* **Timeline**: Once your documents and KYC are digitally verified, funds are typically credited within **24 to 48 hours**.\n" +
        "* **Digital Process**: Pre-approved or top-category corporate applicants often receive instant same-day disbursement.",
    };
  }

  // Lowest Interest Rate Bank
  if (/(?:which\s*bank|who)\s*(?:offers?|gives?|has)\s*(?:the\s*)?(?:lowest|cheapest|best)\s*(?:interest\s*rate|roi|rate)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "lowest_roi",
      answer:
        "Here are current competitive personal loan interest rates from partner lenders:\n\n" +
        "* **Top Rates**: Lenders like **Bajaj Markets**, **Bandhan Bank**, **ICICI Bank**, and **HDFC Bank** offer rates starting from **9.99% to 10.75% p.a.**\n" +
        "* **Key Factors**: Your final interest rate depends on your employer category, credit score (700+), and monthly take-home salary.",
    };
  }

  // Why age inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:my\s+)?age|why\s+age)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_age",
      answer:
        "Here is why banks review your age:\n\n" +
        "* **Eligibility Window**: Standard personal loan eligibility requires applicants to be between **21 and 60 years** (or retirement age).\n" +
        "* **Repayment Horizon**: It ensures you have enough remaining working years to comfortably repay the loan before retirement.",
    };
  }

  // Why company inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:my\s+)?(?:company|employer|workplace)|why\s+company)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_company",
      answer:
        "Here is why your employer matters for loan approval:\n\n" +
        "* **Category Tiers**: Banks classify companies into Super Cat A, Cat A, Cat B, and Govt tiers based on stability and size.\n" +
        "* **Better Terms**: Working for a recognized employer unlocks lower interest rates, higher loan amounts, and faster digital approval.",
    };
  }

  // Why salary inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:my\s+)?(?:salary|income|take\s*home)|why\s+salary)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_salary",
      answer:
        "Here is why your monthly salary is required:\n\n" +
        "* **Borrowing Capacity**: It determines the maximum loan amount partner banks can offer you.\n" +
        "* **Budget Safety**: It ensures your estimated monthly EMI stays comfortably within 50%–60% of your take-home pay.",
    };
  }

  // Data Privacy / Security objection
  if (/(?:is\s+(?:my\s+)?(?:personal\s+)?(?:data|information|info|details)\s+(?:safe|secure|confidential|private)|privacy\s*policy|how\s+safe\s+is\s+(?:my\s+)?data)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "data_privacy",
      answer:
        "Here is how your information is protected:\n\n" +
        "* **Bank-Grade Security**: Your details are encrypted and strictly confidential.\n" +
        "* **Purpose-Bound**: We only use your information to match bank policies and calculate eligibility.\n" +
        "* **No Spam**: We never share or sell your details to unauthorized third parties.",
    };
  }

  // Collateral / security / guarantor inquiry / objection
  if (/(?:collateral|pledge|security|guarantor|property\s*papers?|mortgage)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "collateral_inquiry",
      answer:
        "Here is how collateral works for personal loans:\n\n" +
        "* **100% Unsecured**: Personal loans from all our partner banks require **no collateral, property papers, or guarantor**.\n" +
        "* **Approval Basis**: Approvals rely strictly on your verified monthly salary, employer stability, and credit track record.",
    };
  }

  // Why CIBIL inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:my\s+)?(?:cibil|credit\s*score)|why\s+cibil)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_cibil",
      answer:
        "Here is why your CIBIL score is checked:\n\n" +
        "* **Credit Track Record**: Lenders use your score to gauge past repayment discipline and determine your interest rate.\n" +
        "* **Safe Indicative Check**: Checking eligibility here is a soft check that **does not impact your credit score**.",
    };
  }

  // Why EMI inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:my\s+)?(?:existing\s*)?emi|why\s+emi)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_emi",
      answer:
        "Here is why existing EMIs are factored in:\n\n" +
        "* **FOIR Calculation**: Banks need to verify that adding a new EMI will not push your total obligations above 50%–60% of your income.\n" +
        "* **Financial Comfort**: It prevents over-borrowing and protects your monthly household budget.",
    };
  }

  // Why tenure or loan amount inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:tenure|duration|loan\s*amount|amount)|why\s+tenure)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_amount_tenure",
      answer:
        "Here is why loan amount and tenure are needed:\n\n" +
        "* **Accurate EMI**: They allow us to calculate your exact monthly installment across partner banks.\n" +
        "* **Policy Matching**: Different banks have specific minimum and maximum limits for loan amounts and repayment periods.",
    };
  }

  // Why so many questions inquiry / objection
  if (/(?:why\s+(?:so\s+many|are\s+there\s+so\s+many)\s+questions|too\s+many\s+questions)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_questions",
      answer:
        "Here is why these 7 details are needed:\n\n" +
        "* **No Collateral Needed**: Because personal loans are 100% unsecured, approvals depend entirely on your financial profile.\n" +
        "* **Accurate Approvals**: The 7 parameters (employer, salary, loan amount, tenure, CIBIL, existing EMIs, age) enable exact bank matches and rates without guesswork.",
    };
  }

  // Self-employed / business inquiry
  if (/(?:self[\s-]*employed|own\s*business|freelancer|can\s*self\s*employed\s*get)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "self_employed",
      answer:
        "Here is how personal loans work for self-employed applicants:\n\n" +
        "* **Eligibility**: Self-employed professionals and business owners can qualify for personal loans across partner lenders.\n" +
        "* **Documentation**: Banks typically evaluate 1 to 2 years of ITR filings, computation of income, and 6 months of current bank statements.",
    };
  }

  // Cash salary inquiry / objection
  if (/(?:cash\s*salary|salary\s*in\s*cash|paid\s*in\s*cash|no\s*salary\s*slip)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "cash_salary",
      answer:
        "Here is the policy regarding cash salary:\n\n" +
        "* **Bank Policy**: Partner banks require salary to be credited directly to a bank account with verifiable pay slips.\n" +
        "* **Alternative Options**: If salary is received in cash, unsecured personal loans cannot be verified, but secured options like **Gold Loans** are readily accessible without income proof.",
    };
  }

  // Co-applicant inquiry
  if (/(?:co[\s-]*applicant|co[\s-]*borrower|add\s*(?:my\s*)?(?:spouse|wife|husband|father|mother|brother)|joint\s*loan)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "co_applicant",
      answer:
        "Here is how adding a co-applicant works:\n\n" +
        "* **Higher Eligibility**: Adding an earning co-applicant (such as a spouse or parent) combines your household income.\n" +
        "* **Approval Advantage**: This helps you qualify for higher loan amounts if your individual salary falls short.",
    };
  }

  // Documents required inquiry
  if (/(?:what\s+documents|docs?\s*(?:needed|required)|documentation)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "documents",
      answer:
        "Here are the standard documents required for a personal loan:\n\n" +
        "* **Identity & Address**: PAN card and Aadhaar for digital KYC.\n" +
        "* **Income Proof**: Latest 3 months of bank statements showing salary credits.\n" +
        "* **Employment Proof**: Recent 3 months of salary slips and corporate email or company ID.",
    };
  }

  // Hesitation or reluctance to share
  if (/(?:hesitant|not\s*comfortable|don\x27?t\s*want\s*to\s*share|skip|can\s*we\s*skip|prefer\s*not\s*to\s*say)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "hesitation",
      answer:
        "We completely understand your discretion:\n\n" +
        "* **Soft Evaluation**: All assessments here are indicative and do not trigger hard bureau inquiries.\n" +
        "* **Privacy First**: Your information is kept strictly private and used solely to match partner bank criteria.",
    };
  }

  // Generic "why" or "what" contextual resolution using expectedField (matches standalone or mid-sentence)
  if (
    /^(?:why\??|why\s+(?:is\s+this|do\s+you\s+need|ask\s+for|require)?\s*(?:this|that|it)?\??|what\??|what\s+do\s+you\s+mean\??|why\s+though\??|why\s+so\??|why\s+this\??)$/i.test(norm) ||
    /\b(?:why\s+do\s+you\s+(?:need|ask)|why\s+is\s+(?:this|that|it)\s+(?:needed|required)|why\s+is\s+it|why\s+this\s+is\s+(?:needed|required))\b/i.test(norm)
  ) {
    if (expectedField === "companyName") {
      return {
        isQuestion: true,
        topic: "why_company",
        answer:
          "Here is why your employer matters for loan approval:\n\n" +
          "* **Category Tiers**: Banks classify companies into Super Cat A, Cat A, Cat B, and Govt tiers based on stability and size.\n" +
          "* **Better Terms**: Working for a recognized employer unlocks lower interest rates, higher loan amounts, and faster digital approval.",
      };
    }
    if (expectedField === "monthlyIncome") {
      return {
        isQuestion: true,
        topic: "why_salary",
        answer:
          "Here is why your monthly salary is required:\n\n" +
          "* **Borrowing Capacity**: It determines the maximum loan amount partner banks can offer you.\n" +
          "* **Budget Safety**: It ensures your estimated monthly EMI stays comfortably within 50%–60% of your take-home pay.",
      };
    }
    if (expectedField === "loanAmount") {
      return {
        isQuestion: true,
        topic: "why_amount",
        answer:
          "Here is why loan amount is needed:\n\n" +
          "* **Accurate EMI**: It allows us to calculate your exact monthly installment across partner banks.\n" +
          "* **Policy Matching**: Different banks have specific minimum and maximum limits for loan amounts.",
      };
    }
    if (expectedField === "tenureMonths") {
      return {
        isQuestion: true,
        topic: "why_tenure",
        answer:
          "Here is why tenure is needed:\n\n" +
          "* **Monthly Installment**: Your preferred repayment duration directly determines your monthly EMI.\n" +
          "* **Policy Limits**: Partner banks offer tenures typically between 12 and 60 months (up to 84 months for top employers).",
      };
    }
    if (expectedField === "cibil") {
      return {
        isQuestion: true,
        topic: "why_cibil",
        answer:
          "Here is why your CIBIL score is checked:\n\n" +
          "* **Credit Track Record**: Lenders use your score to gauge past repayment discipline and determine your interest rate.\n" +
          "* **Safe Indicative Check**: Checking eligibility here is a soft check that **does not impact your credit score**.",
      };
    }
    if (expectedField === "existingEmi") {
      return {
        isQuestion: true,
        topic: "why_emi",
        answer:
          "Here is why existing EMIs are factored in:\n\n" +
          "* **FOIR Calculation**: Banks need to verify that adding a new EMI will not push your total obligations above 50%–60% of your income.\n" +
          "* **Financial Comfort**: It prevents over-borrowing and protects your monthly household budget.",
      };
    }
    if (expectedField === "age") {
      return {
        isQuestion: true,
        topic: "why_age",
        answer:
          "Here is why banks review your age:\n\n" +
          "* **Eligibility Window**: Standard personal loan eligibility requires applicants to be between **21 and 60 years** (or retirement age).\n" +
          "* **Repayment Horizon**: It ensures you have enough remaining working years to comfortably repay the loan before retirement.",
      };
    }
  }

  // Inflation & Repo rate inquiry
  if (
    /(?:inflation|rbi\s*repo|repo\s*rate).*(?:affect|impact|loan|interest|emi)/i.test(norm) ||
    /(?:how\s+does\s+inflation\s+affect\s+(?:loans?|interest)|what\s+is\s+repo\s*rate)/i.test(norm)
  ) {
    return {
      isQuestion: true,
      topic: "inflation_repo",
      answer:
        "Here is how inflation and RBI repo rates affect loans:\n\n" +
        "* **Repo Rate Linkage**: Floating loan interest rates are pegged directly to the RBI Repo Rate.\n" +
        "* **Rising Inflation**: When inflation surges, RBI increases the repo rate, which can raise loan interest rates and monthly EMIs.\n" +
        "* **Falling Inflation**: When inflation cools, rate cuts lower your overall borrowing costs.",
    };
  }

  // Why company affects eligibility inquiry
  if (
    /(?:why\s+does\s+(?:my\s+)?company\s+affect|why\s+(?:do\s+)?banks\s+care\s+about\s+company|company\s+category\s+matter)/i.test(norm)
  ) {
    return {
      isQuestion: true,
      topic: "company_importance",
      answer:
        "Here is why banks categorize employers:\n\n" +
        "* **Tiers & Categories**: Banks group employers into Super Cat A, Cat A, Cat B, and Govt tiers based on company stability.\n" +
        "* **Exclusive Perks**: Working for a top-tier employer unlocks lower interest rates (up to 1-2% lower), higher loan amounts, and faster approval.",
    };
  }

  // Home loan tax benefits / Section 24 / 80C
  if (/(?:tax\s*benefits?|section\s*24|80c|tax\s*deduction).*(?:loan|home)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "tax_benefits",
      answer:
        "Here is how tax benefits apply to loans:\n\n" +
        "* **Home Loans**: Under the Old Tax Regime, you can claim up to **₹2 Lakhs/year** on interest paid (Section 24b) and up to **₹1.5 Lakhs/year** on principal repaid (Section 80C).\n" +
        "* **Personal Loans**: Generally carry **no tax deductions**, unless the borrowed funds are deployed strictly for documented home improvement or business assets with valid receipts.",
    };
  }

  // Gold loan vs Personal loan
  if (/(?:gold\s*loan\s*vs\s*personal|personal\s*loan\s*vs\s*gold|difference\s+between\s+gold\s+and\s+personal)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "gold_vs_personal",
      answer:
        "Here is the comparison between Personal Loans and Gold Loans:\n\n" +
        "* **Personal Loan**: 100% unsecured—no gold or property is pledged. Approval depends on your monthly salary and credit score.\n" +
        "* **Gold Loan**: Secured by physical gold jewelry. Often offers lower interest rates, faster disbursement, and flexible credit score cutoffs with no salary proof needed.",
    };
  }

  // General question detection (question mark or question words)
  if (/\?$/.test(norm) || /^(?:why|how|what|is\s+it|can\s+i|will\s+it|do\s+i|are\s+there)\b/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "general_inquiry",
      answer: "",
    };
  }

  return { isQuestion: false };
}

/**
 * Checks if a user message is completely outside the CreditWise / AI Finance domain
 * (e.g. coding, homework, entertainment, general tech support).
 */
export function isOutOfDomainRequest(text: string): { isOutOfDomain: boolean; redirectReply?: string } {
  const norm = String(text || "").toLowerCase().trim();
  if (!norm) return { isOutOfDomain: false };

  // Guard: If message touches on loans, credit, finance, banking, emi, cibil, or salary, it is in-domain!
  if (
    /(?:loan|emi|cibil|credit\s*score|bank|interest|tenure|salary|income|foir|pincode|branch|manager|mortgage|prepay|foreclose|disburs|borrow|finance|tax\s*benefit|80c|24b|invest|inflation|repo\s*rate)/i.test(norm)
  ) {
    return { isOutOfDomain: false };
  }

  // 1. Coding / Programming requests
  const isCoding =
    /\b(?:write|create|debug|run|generate|give)\s+(?:me\s+)?(?:a\s+)?(?:python|java|javascript|js|typescript|ts|c\+\+|c#|ruby|rust|golang|php|html|css|sql|script|function|program|algorithm|code)\b/i.test(norm) ||
    /\b(?:coding|write\s+(?:some\s+)?code|programming|write\s+a\s+regex|debug\s+this|compile\s+error|react\s+component|vue\s+component)\b/i.test(norm) ||
    /^(?:print\(|console\.log|def\s+\w+\(|function\s+\w+\(|import\s+react|public\s+static\s+void)/i.test(norm);

  // 2. Homework / Academic / General Science / History requests
  const isHomeworkOrGeneralAcademic =
    /\b(?:solve\s+my\s+homework|college\s+essay|write\s+an?\s+essay|homework\s+help|chemistry\s+equation|physics\s+numerical|who\s+won\s+world\s+war|capital\s+of\s+\w+|translate\s+to\s+french)\b/i.test(norm);

  // 3. Creative writing & Entertainment
  const isCreativeOrEntertainment =
    /\b(?:write\s+(?:a\s+)?(?:poem|poetry|story|lyrics|song|novel)|tell\s+(?:me\s+)?(?:a\s+)?(?:funny\s+)?joke|joke\b|movie\s+recommendations?|who\s+won\s+the\s+oscar|cricket\s+score)\b/i.test(norm);

  // 4. General Tech Support / Hardware / OS
  const isGeneralTech =
    /\b(?:how\s+to\s+install\s+(?:ubuntu|windows|linux|macos)|fix\s+my\s+wifi|jailbreak\s+iphone|root\s+android|graphics\s+card\s+driver)\b/i.test(norm);

  if (isCoding || isHomeworkOrGeneralAcademic || isCreativeOrEntertainment || isGeneralTech) {
    return {
      isOutOfDomain: true,
      redirectReply:
        "I'm here to help with personal loans, bank eligibility, EMIs, bank policies, company category tiers, and branch manager details. If you have a question about any of these, I'd be happy to help!",
    };
  }

  return { isOutOfDomain: false };
}

export interface TopicSwitchIntentResult {
  isSwitch: boolean;
  switchType?: "BANK_POLICY" | "EMI_CALCULATOR" | "BANK_MANAGER" | "COMPANY_CATEGORY" | "WEB_SEARCH";
  targetBank?: string;
  topicLabel?: string;
}

/**
 * Detects if user input is an explicit switch to another tool/topic during an ongoing assessment.
 */
export function detectTopicSwitchIntent(message: string): TopicSwitchIntentResult {
  const norm = message.toLowerCase().trim();

  // Guard: If message expresses personal borrowing intent, it is NOT a topic switch
  if (/(?:am\s*i\s*(?:eligible|qualif\w*)|check\s*(?:my|our)\s*eligib\w*|for\s*me|my\s*eligib\w*|can\s*i\s*(?:get|apply|qualify)|i\s*(?:need|want)\s*a\s*loan)/i.test(norm)) {
    return { isSwitch: false };
  }

  // 1. Bank Policy switch
  const bankMatch = /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe|sbm|utkarsh|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)/i.exec(norm);
  const isPolicyKeyword = /(?:policy|policies|guidelines?|rules?|criteria|cutoff|cut-off|foir\s*norm|eligibility\s*criteria)\b/i.test(norm);
  if (bankMatch && isPolicyKeyword) {
    const bankName = bankMatch[0];
    return {
      isSwitch: true,
      switchType: "BANK_POLICY",
      targetBank: bankName,
      topicLabel: `check ${bankName.toUpperCase()} bank policy`,
    };
  }

  // 2. EMI Calculator switch
  const isEmiCalc =
    (/\b(?:calculate|what\s+is\s+my|compute)\s+emi\b/i.test(norm) ||
     (/\bemi\b/i.test(norm) && (norm.match(/(\d+(?:\.\d+)?)\s*%/i) || norm.match(/(?:at|rate\s*of)\s*\d+/i)) && norm.match(/(?:years?|months?|lakh|lac|\d{5,8})/i))) &&
    !/what\s+is\s+emi\b|meaning\s+of\s+emi/i.test(norm);
  if (isEmiCalc) {
    return {
      isSwitch: true,
      switchType: "EMI_CALCULATOR",
      topicLabel: "calculate this EMI",
    };
  }

  // 3. Bank Manager switch
  const isManager =
    /(?:find|search|show|get|contact|details\s+of)\s+.*(?:manager|branch\s*head|\basm\b|\brsm\b)/i.test(norm) ||
    Boolean(bankMatch && /manager|branch\s*head|branch\s*contact|manager\s*phone/i.test(norm));
  if (isManager) {
    return {
      isSwitch: true,
      switchType: "BANK_MANAGER",
      targetBank: bankMatch ? bankMatch[0] : undefined,
      topicLabel: `search for official ${bankMatch ? bankMatch[0].toUpperCase() + " " : ""}bank managers`,
    };
  }

  // 4. Company Category / Listing switch
  const isCompanySearch = isCompanyInfoOrSearchIntent(norm);
  if (isCompanySearch) {
    return {
      isSwitch: true,
      switchType: "COMPANY_CATEGORY",
      topicLabel: "look up corporate company details and category tiers",
    };
  }

  // 5. Web Search switch
  const isWebSearch = /(?:search\s+the\s+web|latest\s+financial\s+news|rbi\s+repo\s+rate\s+news|current\s+market\s+rate\s+trend)/i.test(norm);
  if (isWebSearch) {
    return {
      isSwitch: true,
      switchType: "WEB_SEARCH",
      topicLabel: "search the web for current financial news",
    };
  }

  return { isSwitch: false };
}

/**
 * Detects user emotions, urgency, life events, or stated purpose to enable empathetic responses.
 */
export function detectConversationalContext(
  message: string,
  existingNotes?: ConversationalContextNotes
): ConversationalContextNotes {
  const norm = message.toLowerCase();
  const notes: ConversationalContextNotes = { ...(existingNotes || {}) };

  // Medical emergency / hospital
  if (/(?:medical|hospital|surgery|doctor|operation|treatment|emergency|accident|health|illness|sick)/i.test(norm)) {
    notes.urgency = "urgent";
    notes.statedPurpose = "medical emergency";
    notes.emotionalTone = "stressed";
  }

  // Wedding / Family function
  if (/(?:wedding|marriage|shaadi|engagement|reception)/i.test(norm)) {
    notes.statedPurpose = "wedding";
    if (!notes.emotionalTone) notes.emotionalTone = "optimistic";
  }

  // Debt consolidation
  if (/(?:consolidat|clear\s*(?:my\s*)?(?:debt|cards?|loans?)|pay\s*off|close\s*(?:all\s*)?loans?)/i.test(norm)) {
    notes.statedPurpose = "debt consolidation";
  }

  // General Urgency cues
  if (/(?:urgent|urgently|asap|immediately|today|tomorrow|fast|emergency|quick)/i.test(norm)) {
    notes.urgency = "urgent";
  }

  // Anxiety / credit worry
  if (/(?:worried|stressed|tension|afraid|cibil\s*(?:kharab|bad|low|down)|bad\s*credit)/i.test(norm)) {
    notes.emotionalTone = "worried";
  }

  return notes;
}

/**
 * Detects whether the user is correcting an already-stated parameter.
 */
export interface CorrectionResult {
  isCorrection: boolean;
  field?: string;
  value?: any;
  explanation?: string;
}

export function detectCorrectionInMessage(
  message: string,
  applicant: ApplicantProfile,
  lastField?: string
): CorrectionResult {
  const norm = message.toLowerCase().trim();

  // Detect explicit correction markers: "actually", "my bad", "wait", "change to", "update to", "instead of", "make that", "make it", "not <x>"
  const isCorrectionPhrase =
    /\b(?:wait|actually|my\s*bad|mistake|typo|wrong|change|update|correct|instead\s*of|rather\s*than|make\s+(?:that|it)|set\s+(?:it\s+to|to)|change\s+(?:it\s+to|to)|update\s+(?:it\s+to|to))\b/i.test(norm);

  if (!isCorrectionPhrase) return { isCorrection: false };

  // A. Company correction
  const compMatch = message.match(
    /(?:company|employer|workplace|work\s+at|working\s+at|joined|switch(?:ed)?\s+to|moved\s+to|(?:actually\s+)?(?:make\s+it|switch\s+to))\s*(?:is|changed\s*to|to|=|:)?\s*([a-zA-Z0-9\s&'.-]+?)(?=\s*[,;]|\s+(?:and|with|salary|cibil|tenure|as\s+a|as\s+an|full\s*time|part\s*time)|$)/i
  );
  if (compMatch && !isInvalidCompanyName(compMatch[1]) && !isFinancialOrProfileInput(compMatch[1])) {
    const matchedComp = compMatch[1].trim();
    return {
      isCorrection: true,
      field: "companyName",
      value: matchedComp,
      explanation: `Updated your employer to **${matchedComp}**`,
    };
  }

  // B. Salary correction
  const salMatch = message.match(/(?:salary|income|take\s*home)\s*(?:is|changed\s*to|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|hazar))?)\b/i);
  if (salMatch) {
    const amt = parseFinancialAmount(salMatch[1]);
    if (amt !== null && amt >= 0) {
      return {
        isCorrection: true,
        field: "monthlyIncome",
        value: amt,
        explanation: `Updated your monthly take-home salary to **₹${amt.toLocaleString("en-IN")}**`,
      };
    }
  }

  // C. CIBIL score correction
  const cibilMatch = message.match(/(?:cibil|credit\s*score|score)\s*(?:is|changed\s*to|to|=|:)?\s*([3-9]\d{2})\b/i);
  if (cibilMatch) {
    const s = parseInt(cibilMatch[1], 10);
    if (s >= 300 && s <= 900) {
      return {
        isCorrection: true,
        field: "cibil",
        value: s,
        explanation: `Updated your CIBIL score to **${s}**`,
      };
    }
  }

  // D. Loan amount correction
  const loanMatch = message.match(/(?:loan\s*(?:amount)?|amount|borrow|ticket)\s*(?:is|changed\s*to|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|khoka))?)\b/i);
  if (loanMatch) {
    const amt = parseFinancialAmount(loanMatch[1]);
    if (amt !== null && amt >= 10000) {
      return {
        isCorrection: true,
        field: "loanAmount",
        value: amt,
        explanation: `Updated your requested loan amount to **₹${amt.toLocaleString("en-IN")}**`,
      };
    }
  }

  // E. Tenure correction
  const tenureMatch = message.match(/(?:tenure|duration|term)\s*(?:is|changed\s*to|to|=|:)?\s*(\d{1,2})\s*(?:years?|yrs?|saal|months?|m\b)/i);
  if (tenureMatch) {
    const t = parseInt(tenureMatch[1], 10);
    const months = t <= 7 ? t * 12 : t;
    return {
      isCorrection: true,
      field: "tenureMonths",
      value: months,
      explanation: `Updated your repayment tenure to **${months} months (${(months / 12).toFixed(1)} years)**`,
    };
  }

  // F. Existing EMI correction
  const emiMatch = message.match(/(?:existing\s*emi|emi|loan\s*emi)\s*(?:is|changed\s*to|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*k)?)\b/i);
  if (emiMatch) {
    const amt = parseFinancialAmount(emiMatch[1]);
    if (amt !== null && amt >= 0) {
      return {
        isCorrection: true,
        field: "existingEmi",
        value: amt,
        explanation: `Updated your existing monthly EMIs to **₹${amt.toLocaleString("en-IN")}**`,
      };
    }
  }

  // G. Age correction
  const ageMatch = message.match(/(?:age|aged)\s*(?:is|changed\s*to|to|=|:)?\s*(\d{1,2})\b/i);
  if (ageMatch) {
    const a = parseInt(ageMatch[1], 10);
    if (a >= 18 && a <= 85) {
      return {
        isCorrection: true,
        field: "age",
        value: a,
        explanation: `Updated your age to **${a} years**`,
      };
    }
  }

  // H. Generic numeric correction referring to the last answered or relevant field
  // e.g. "Actually make it 60000", "change it to 70000", "make that 65000"
  const genericNumMatch = message.match(
    /(?:actually|make\s+(?:it|that)|change\s+(?:it\s+to|to)|set\s+(?:it\s+to|to)|update\s+(?:it\s+to|to)|instead)\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|hazar))?)\b/i
  );
  if (genericNumMatch) {
    const amt = parseFinancialAmount(genericNumMatch[1]);
    if (amt !== null && amt >= 0) {
      let targetField = lastField;
      if (!targetField) {
        if (applicant.monthlyIncome !== undefined && amt >= 10000 && amt <= 500000) {
          targetField = "monthlyIncome";
        } else if (applicant.loanAmount !== undefined && amt >= 100000) {
          targetField = "loanAmount";
        } else if (applicant.cibil !== undefined && amt >= 300 && amt <= 900) {
          targetField = "cibil";
        } else if (applicant.monthlyIncome !== undefined) {
          targetField = "monthlyIncome";
        } else if (applicant.loanAmount !== undefined) {
          targetField = "loanAmount";
        }
      }

      if (targetField === "monthlyIncome") {
        return {
          isCorrection: true,
          field: "monthlyIncome",
          value: amt,
          explanation: `Updated your monthly take-home salary to **₹${amt.toLocaleString("en-IN")}**`,
        };
      } else if (targetField === "loanAmount") {
        return {
          isCorrection: true,
          field: "loanAmount",
          value: amt,
          explanation: `Updated your requested loan amount to **₹${amt.toLocaleString("en-IN")}**`,
        };
      } else if (targetField === "cibil" && amt >= 300 && amt <= 900) {
        return {
          isCorrection: true,
          field: "cibil",
          value: amt,
          explanation: `Updated your CIBIL score to **${amt}**`,
        };
      } else if (targetField === "existingEmi") {
        return {
          isCorrection: true,
          field: "existingEmi",
          value: amt,
          explanation: `Updated your existing monthly EMIs to **₹${amt.toLocaleString("en-IN")}**`,
        };
      }
    }
  }

  return { isCorrection: false };
}

/**
 * Detects whether the message contains answers for 2 or more distinct parameters.
 */
export function isMultiParameterMessage(text: string): boolean {
  if (!text) return false;
  let count = 0;
  if (messageMentionsField("monthlyIncome", text)) count++;
  if (messageMentionsField("loanAmount", text)) count++;
  if (messageMentionsField("cibil", text)) count++;
  if (messageMentionsField("tenureMonths", text)) count++;
  if (messageMentionsField("existingEmi", text)) count++;
  if (messageMentionsField("age", text)) count++;
  return count >= 2;
}

/**
 * Detects if a message explicitly targets a different field than what was expected.
 */
export function detectTargetedFieldInMessage(text: string, targetExpectedField?: string): string | null {
  if (isMultiParameterMessage(text)) return null;
  const norm = text.toLowerCase().trim();

  // If user says "3 years" or "36 months" or "3 saal" while expectedField was salary or loan amount:
  if (
    targetExpectedField !== "tenureMonths" &&
    /\b\d{1,2}\s*(?:years?|yrs?|saal|sal|months?|m\b)\b/i.test(norm) &&
    !/(?:salary|income|earn|take\s*home|in\s*hand|need|loan|cibil|age)/i.test(norm)
  ) {
    return "tenureMonths";
  }

  // If user says "my cibil is 750", "cibil is 750", "no cibil", "don't have credit score" or "score 770" while expectedField was something else:
  if (
    targetExpectedField !== "cibil" &&
    (/(?:cibil|credit\s*score|score)(?:\s*is)?(?:\s*[:=-])?\s*[3-9]\d{2}/i.test(norm) ||
      /(?:no|don['’]?t\s*have|never\s*had|never\s*checked|zero|nil|unknown|first\s*time)\s*(?:a\s*)?(?:cibil|credit\s*score|score)/i.test(norm) ||
      /(?:cibil|credit\s*score|score)\s*(?:is\s*)?(?:unknown|zero|nil|none|never\s*checked|not\s*generated)/i.test(norm))
  ) {
    return "cibil";
  }

  // If user says "my salary is 80k" or "in hand 85000" while expectedField was something else:
  if (targetExpectedField !== "monthlyIncome" && /(?:salary|monthly\s*income|take\s*home|in\s*hand)\s*(?:is|around|:)?\s*[\d,]+/i.test(norm)) {
    return "monthlyIncome";
  }

  // If user says "need 5 lakhs" or "5 peti loan" while expectedField was tenure or age:
  if (targetExpectedField !== "loanAmount" && /(?:need|want|borrow|loan\s*amount)\s*(?:rs\.?|₹)?\s*[\d,]+\s*(?:k|lakhs?|lacs?|l\b|cr|peti|khoka)/i.test(norm)) {
    return "loanAmount";
  }

  // If user says "no emi" or "0 emi" or "zero debt" or "sab clear" while expectedField was something else:
  if (targetExpectedField !== "existingEmi" && /(?:no|zero|0|nil)\s*emi|zero\s*debt|sab\s*clear|no\s*debt/i.test(norm)) {
    return "existingEmi";
  }

  // If user says "age 28", "23 age", "I am 23", "my age is 23", "28 years old", etc. while expectedField was something else:
  if (
    targetExpectedField !== "age" &&
    (/(?:age\s*is|my\s*age\s*is|age\s*[:=-]|aged)\s*\d{2}\b/i.test(norm) ||
      /\b(?:i\s*am|i'?m)\s+\d{2}\b/i.test(norm) ||
      /\b\d{2}\s*(?:years?\s*old|yrs?\s*old|saal)\b/i.test(norm) ||
      /\b\d{2}\s*age\b/i.test(norm))
  ) {
    return "age";
  }

  // If user says "working at TCS", "company is Infosys", "self employed", "freelance" while expectedField was something else:
  if (
    targetExpectedField !== "companyName" &&
    (/(?:(?:i\s+)?(?:work|working|employed)\s+(?:at|in|with|for)|(?:my\s+)?(?:company|employer)\s+is)\s+([A-Za-z0-9&'.-]+)/i.test(norm) ||
      /\b(?:self\s*employed|business|freelance|consultant|own\s*business|shop\s*owner)\b/i.test(norm))
  ) {
    return "companyName";
  }

  return null;
}

export const KNOWN_BANK_PATTERNS: Array<{
  canonicalName: string;
  regex: RegExp;
}> = [
  { canonicalName: "HDFC Bank", regex: /\b(?:hdfc|hdfc\s*bnk[a-z]*|hdfc\s*banck)\b/i },
  { canonicalName: "ICICI Bank", regex: /\b(?:icici|icic\b|icic\s*bnk[a-z]*|icici\s*bnk[a-z]*)\b/i },
  { canonicalName: "Axis Bank", regex: /\b(?:axis\s*bank|axis\s*bnk[a-z]*|\baxis\b(?!.*finance))\b/i },
  { canonicalName: "Axis Finance", regex: /\b(?:axis\s*finance|afl)\b/i },
  { canonicalName: "Kotak Mahindra Bank", regex: /\b(?:kotak|kotak\s*mahindra|kotak\s*bnk[a-z]*)\b/i },
  { canonicalName: "Bajaj Finserv", regex: /\b(?:bajaj\s*finserv|bajaj\s*finance|\bbajaj\b(?!.*markets))\b/i },
  { canonicalName: "Bajaj Markets", regex: /\b(?:bajaj\s*markets)\b/i },
  { canonicalName: "Tata Capital", regex: /\btata\s*capital\b/i },
  { canonicalName: "IDFC FIRST Bank", regex: /\b(?:idfc|idfc\s*first|idfc\s*bnk[a-z]*)\b/i },
  { canonicalName: "IndusInd Bank", regex: /\b(?:indusind|indus\s*ind|indusind\s*bnk[a-z]*)\b/i },
  { canonicalName: "Bandhan Bank", regex: /\b(?:bandhan|bandhan\s*bnk[a-z]*)\b/i },
  { canonicalName: "Cholamandalam Investment & Finance", regex: /\b(?:chola|cholamandalam)\b/i },
  { canonicalName: "Piramal Capital & Housing Finance", regex: /\b(?:piramal|piramal\s*finance)\b/i },
  { canonicalName: "Poonawalla Fincorp", regex: /\b(?:poonawalla|poonawala)\b/i },
  { canonicalName: "SMFG India Credit (Fullerton)", regex: /\b(?:smfg|fullerton)\b/i },
  { canonicalName: "Finnable Credit", regex: /\b(?:finnable)\b/i },
  { canonicalName: "Fibe (EarlySalary)", regex: /\b(?:fibe|early\s*salary)\b/i },
  { canonicalName: "SBM Bank India", regex: /\b(?:sbm|sbm\s*bank)\b/i },
  { canonicalName: "Utkarsh Small Finance Bank", regex: /\b(?:utkarsh)\b/i },
  { canonicalName: "Yes Bank", regex: /\b(?:yes\s*bank|\byes\s*bnk[a-z]*)\b/i },
  { canonicalName: "Aditya Birla Finance", regex: /\b(?:aditya\s*birla\s*finance|abfl)\b/i },
  { canonicalName: "InCred Finance", regex: /\b(?:incred)\b/i },
  { canonicalName: "L&T Finance", regex: /\b(?:l&t\s*finance|lt\s*finance|ltf)\b/i },
  { canonicalName: "State Bank of India", regex: /\b(?:sbi|state\s*bank\s*of\s*india)\b/i },
];

export function isKnownBankName(text: string): boolean {
  if (!text) return false;
  const raw = text.trim();
  if (/^(?:i\s+(?:work|working|am\s+working)\s+(?:at|in)|(?:my\s+)?(?:employer|company)\s+is|(?:work|working|employed)\s+(?:at|in|by)|employer\s*[:=-]|company\s*[:=-])\b/i.test(raw)) {
    return false;
  }
  const clean = raw.toLowerCase().replace(/^(?:no,?\s*(?:i\s*meant|i\s*mean)\s+|actually\s+|i\s*want\s+|i\s*prefer\s+|please\s+select\s+|proceed\s+with\s+|go\s+with\s+|choose\s+)/i, "").trim();
  for (const p of KNOWN_BANK_PATTERNS) {
    if (p.regex.test(clean)) return true;
  }
  return false;
}

function normalizeBankCandidate(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(?:bank|finance|fincorp|capital|limited|ltd)$/g, "");
}

function bankEditDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

export function resolveBankName(
  text: string,
  eligibleBanks?: string[]
): { bankName: string; isCorrection: boolean } | null {
  if (!text) return null;
  const raw = text.trim();
  const lower = raw.toLowerCase();

  const isCorrection = /(?:no,?\s*(?:i\s*meant|i\s*mean)|actually|change\s*(?:to|bank\s*to)?|switch\s*to|prefer|instead\s*of)/i.test(lower);

  const clean = lower
    .replace(/^(?:no,?\s*(?:i\s*meant|i\s*mean)\s+|actually\s+|i\s*(?:want|prefer|select|choose)\s+|please\s+select\s+|proceed\s+with\s+|go\s+with\s+|change\s+(?:to|bank\s*to)?\s+|switch\s+to\s+)/i, "")
    .trim();

  for (const p of KNOWN_BANK_PATTERNS) {
    if (p.regex.test(clean) || p.regex.test(lower)) {
      if (eligibleBanks && eligibleBanks.length > 0) {
        const normTarget = p.canonicalName.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
        const matched = eligibleBanks.find((eb) => {
          const ebNorm = eb.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
          return ebNorm.includes(normTarget) || normTarget.includes(ebNorm);
        });
        if (matched) {
          return { bankName: matched, isCorrection };
        }
      }
      return { bankName: p.canonicalName, isCorrection };
    }
  }

  if (eligibleBanks && eligibleBanks.length > 0) {
    const numMatch = clean.match(/^(?:option\s*|bank\s*|number\s*|#\s*)?(\d+)\b/i);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < eligibleBanks.length) {
        return { bankName: eligibleBanks[idx], isCorrection };
      }
    }

    for (const eb of eligibleBanks) {
      const ebNorm = eb.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
      if (ebNorm.length > 2 && new RegExp(`\\b${ebNorm}\\b`, "i").test(clean)) {
        return { bankName: eb, isCorrection };
      }
    }

    // The eligible-bank list is the authoritative, per-session partner-bank network.
    // Resolve a close natural-language/phonetic spelling only when one candidate is
    // clearly better than the rest; do not turn an uncertain input into a bank choice.
    const inputCandidate = normalizeBankCandidate(clean);
    if (inputCandidate.length >= 4) {
      const matches = eligibleBanks
        .map((bankName) => ({
          bankName,
          distance: bankEditDistance(inputCandidate, normalizeBankCandidate(bankName)),
        }))
        .sort((a, b) => a.distance - b.distance);
      const best = matches[0];
      const runnerUp = matches[1];
      const maxDistance = inputCandidate.length <= 7 ? 1 : Math.floor(inputCandidate.length * 0.2);
      if (best && best.distance <= maxDistance && (!runnerUp || best.distance < runnerUp.distance)) {
        return { bankName: best.bankName, isCorrection };
      }
    }
  }

  return null;
}

export function isSameBank(bankA: string | undefined | null, bankB: string | undefined | null): boolean {
  if (!bankA || !bankB) return false;
  const cleanA = bankA.toLowerCase().replace(/bank|finance|fincorp|limited|ltd|\./gi, "").replace(/\s+/g, "").trim();
  const cleanB = bankB.toLowerCase().replace(/bank|finance|fincorp|limited|ltd|\./gi, "").replace(/\s+/g, "").trim();
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
  const abbrevs: Record<string, string[]> = {
    sbi: ["statebankofindia", "sbi"],
    hdfc: ["hdfc", "hdfcbank"],
    icici: ["icici", "icicibank"],
    kotak: ["kotak", "kotakmahindra", "kotakmahindrabank"],
    pnb: ["punjabnational", "punjabnationalbank"],
    bob: ["bankofbaroda"],
    boi: ["bankofindia"],
    scb: ["standardchartered", "standardcharteredbank"],
    poonawalla: ["poonawalla", "poonawala"],
    tatacapital: ["tata", "tatacapital"],
  };
  for (const list of Object.values(abbrevs)) {
    const matchA = list.some((k) => cleanA.includes(k) || k.includes(cleanA));
    const matchB = list.some((k) => cleanB.includes(k) || k.includes(cleanB));
    if (matchA && matchB) return true;
  }
  return false;
}

/**
 * Validates whether a candidate string is a plausible 6-digit Indian postal PIN code.
 * Rules:
 * 1. Exactly 6 numeric digits starting with 1-9.
 * 2. Does NOT end in 0000 (Indian delivery post offices start at 001; round financial loan/income amounts like 800000, 500000 end in 0000).
 * 3. Range is within valid Indian postal PIN codes (110001 to 855126).
 */
export function isValidIndianPincode(candidate: unknown): boolean {
  if (!candidate) return false;
  const str = String(candidate).trim();
  if (!/^[1-9]\d{5}$/.test(str)) return false;
  if (/0000$/.test(str)) return false;
  return true;
}

/**
 * Validates whether a database manager record matches a user's preferred branch.
 * Explicitly prevents generic regional catch-alls (e.g. "All Maharashtra", "Entire Maharashtra")
 * from matching specific branch requests like "Swarget" or "Katraj".
 */
export function recordMatchesBranch(
  record: { branch?: string | null; location?: string | null },
  preferredBranch?: string
): boolean {
  if (!preferredBranch) return true;
  const pb = preferredBranch.trim().toLowerCase();
  if (!pb) return true;
  const branch = (record.branch || "").trim().toLowerCase();
  const location = (record.location || "").trim().toLowerCase();

  const isGenericRegion =
    /^(?:all\s+maharashtra|entire\s+maharashtra|rest\s+of\s+maharashtra|maharashtra|all\s+india|pan\s+india)$/i.test(location) ||
    /^(?:all\s+maharashtra|entire\s+maharashtra|rest\s+of\s+maharashtra|maharashtra|all\s+india|pan\s+india)$/i.test(branch);

  const isUserRequestingRegion =
    /^(?:all\s+maharashtra|entire\s+maharashtra|maharashtra|all\s+india|pan\s+india)$/i.test(pb);

  if (isGenericRegion && !isUserRequestingRegion) {
    return false;
  }

  const matchesBranch = Boolean(branch && (branch.includes(pb) || pb.includes(branch)));
  const matchesLocation = Boolean(location && (location.includes(pb) || pb.includes(location)));

  return matchesBranch || matchesLocation;
}

export function resolvePincodeToCity(pincode: string): string | null {
  if (!pincode) return null;
  const match = String(pincode).match(/\b([1-9]\d{5})\b/);
  if (!match) return null;
  const pin = match[1];
  if (!isValidIndianPincode(pin)) return null;
  const p3 = parseInt(pin.slice(0, 3), 10);
  const p2 = parseInt(pin.slice(0, 2), 10);

  if (p3 >= 411 && p3 <= 412) return "Pune";
  if (p3 === 400) return "Mumbai";
  if (p3 === 401 || p3 === 421) return "Thane";
  if (p3 === 416) return "Kolhapur";
  if (p3 === 415) return "Satara";
  if (p3 === 413) return "Solapur";
  if (p3 === 414) return "Ahmednagar";
  if (p3 === 422) return "Nashik";
  if (p3 === 431) return "Aurangabad";
  if (p3 === 440 || p3 === 441) return "Nagpur";
  if (p2 === 11) return "Delhi";
  if (p3 === 122) return "Gurgaon";
  if (p3 === 201) return "Noida";
  if (p3 === 121) return "Faridabad";
  if (p3 >= 560 && p3 <= 562) return "Bangalore";
  if (p3 >= 500 && p3 <= 502) return "Hyderabad";
  if (p3 >= 600 && p3 <= 603) return "Chennai";
  if (p3 >= 700 && p3 <= 703) return "Kolkata";
  if (p3 === 380 || p3 === 382) return "Ahmedabad";
  if (p3 === 395) return "Surat";
  if (p3 === 390) return "Vadodara";
  if (p3 === 302 || p3 === 303) return "Jaipur";
  if (p3 === 226) return "Lucknow";
  if (p3 === 160) return "Chandigarh";
  if (p3 === 452) return "Indore";
  if (p3 === 462) return "Bhopal";
  if (p3 === 800) return "Patna";
  if (p3 === 682) return "Kochi";
  if (p3 === 641) return "Coimbatore";

  return null;
}

export const KNOWN_MAJOR_CITIES: string[] = [
  "pune", "mumbai", "kolhapur", "bangalore", "bengaluru", "delhi", "new delhi", "hyderabad",
  "chennai", "kolkata", "ahmedabad", "surat", "jaipur", "lucknow", "kanpur", "nagpur",
  "indore", "thane", "bhopal", "patna", "vadodara", "nashik", "aurangabad", "sangli",
  "satara", "solapur", "navi mumbai", "gurgaon", "gurugram", "noida", "ghaziabad",
  "faridabad", "chandigarh", "coimbatore", "mysore", "mysuru", "kochi", "cochin",
  "trivandrum", "thiruvananthapuram", "visakhapatnam", "vijayawada", "guntur", "madurai",
  "salem", "trichy", "tiruchirappalli", "hubli", "dharwad", "belgaum", "belagavi",
  "mangalore", "mangaluru", "raipur", "bilaspur", "ranchi", "jamshedpur", "dhanbad",
  "bhubaneswar", "cuttack", "guwahati", "dehradun", "amritsar", "ludhiana", "jalandhar",
  "agra", "varanasi", "allahabad", "prayagraj", "meerut", "bareilly", "aligarh",
  "moradabad", "jodhpur", "udaipur", "kota", "bikaner", "ajmer", "gwalior", "jabalpur", "ujjain"
];

export const KNOWN_LOCALITIES: string[] = [
  "swargate", "swarget", "kothrud", "hadapsar", "hinjewadi", "wakad", "baner", "aundh",
  "katraj", "shivajinagar", "viman nagar", "kalyani nagar", "kondhwa", "warje", "pimpri", "chinchwad", "bhosari",
  "camp", "deccan", "kharadi", "magarpatta", "dhanori", "ravet", "nigdi", "yerwada", "bavdhan", "koregaon",
  "koregaon park", "senapati bapat road", "sb road", "fergusson college road", "fc road", "jm road", "jangali maharaj road",
  "mg road", "m g road", "mahatma gandhi road", "model colony", "wadgaon sheri", "bibwewadi", "dhankawadi", "wanowrie",
  "fatima nagar", "salunke vihar", "sangvi", "chakan", "talegaon", "moshi", "dighi", "alandi", "shikrapur",
  "uruli kanchan", "manjri", "narhe", "ambegaon", "sinhagad road", "parvati", "padmavati", "sahakar nagar",
  "karve nagar", "erandwane", "law college road", "prabhat road", "bhandarkar road", "ghole road", "kasba peth",
  "somwar peth", "shaniwar peth", "budhwar peth", "guruwar peth", "ravivar peth", "ganesh peth", "nana peth", "bhavani peth",
  "andheri", "bandra", "dadar", "borivali", "kurla", "ghatkopar", "malad", "chembur", "juhu", "worli", "powai",
  "whitefield", "koramangala", "indiranagar", "hsr", "jayanagar", "malleswaram", "hebbal", "marathahalli",
  "connaught place", "nehru place", "saket", "karol bagh", "hauz khas", "dwarka", "rohini",
  "hitec city", "gachibowli", "madhapur", "jubilee hills", "banjara hills", "kukatpally", "secunderabad",
  "t nagar", "adyar", "velachery", "anna nagar", "mylapore", "alwarpet", "guindy"
];

export function isKnownLocality(text: string): boolean {
  if (!text) return false;
  const clean = text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return false;
  if (KNOWN_MAJOR_CITIES.includes(clean)) return false;
  if (KNOWN_LOCALITIES.includes(clean)) return true;
  for (const loc of KNOWN_LOCALITIES) {
    if (clean === loc || clean.startsWith(loc + " ") || clean.endsWith(" " + loc)) return true;
  }
  if (/\b(?:road|rd|chowk|nagar|colony|layout|sector|camp|cantonment|midc|wadi|gaon|viha+r|park|lane|street|cross|circle|bazaar|bazar|complex)\b/i.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Validates whether an input string represents a geographic location, city, branch, locality, or pincode
 * rather than a company / employer name.
 */
export function isLocationInput(text: string): boolean {
  if (!text) return false;
  const raw = text.trim();
  const clean = raw.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return false;

  // Explicit employment or corporate statements are not pure locations
  if (/(?:work\s+(?:at|in)|working\s+(?:at|in)|employed\s+(?:at|by|in)|(?:company|employer)\s*(?:is|:)|my\s+company|my\s+employer)\b/i.test(raw)) {
    return false;
  }

  // Corporate designators indicate a corporate entity, not a pure location
  if (/\b(?:pvt|private|ltd|limited|llp|inc|corp|corporation|technologies|technology|tech|solutions|systems|consultancy|consulting|services|enterprises|infotech|industries|holdings|group|bank)\b/i.test(clean)) {
    return false;
  }

  // 1. Valid 6-digit Indian postal code
  if (/\b[1-9]\d{5}\b/.test(clean)) {
    return true;
  }

  // 2. Explicit location or branch keywords / prepositions
  if (
    /\b(?:city|branch|locality|location|pincode|pin|area|road|rd|chowk|nagar|colony|layout|sector|cantonment|camp)\b/i.test(clean) ||
    /^(?:in|at|from|near|located\s+in|based\s+in|stay\s+in|living\s+in)\s+[a-z]+/i.test(raw)
  ) {
    return true;
  }

  // 3. Known major cities
  const words = clean.split(/\s+/);
  for (const city of KNOWN_MAJOR_CITIES) {
    if (clean === city || words.includes(city) || clean.startsWith(city + " ") || clean.endsWith(" " + city)) {
      return true;
    }
  }

  // 4. Prominent localities / urban hubs
  for (const loc of KNOWN_LOCALITIES) {
    if (clean === loc || words.includes(loc) || clean.includes(loc)) {
      return true;
    }
  }

  if (isKnownLocality(clean)) {
    return true;
  }

  return false;
}

export interface ExtractedBankBranchLocationDetails {
  bankName?: string;
  isCorrection?: boolean;
  branch?: string;
  branchName?: string;
  city?: string;
  pincode?: string;
  area?: string;
  location?: string;
  role?: string;
  isDiscoveryRequest?: boolean;
}

export interface BankManagerSearchEntities {
  bank_name?: string;
  city?: string;
  branch?: string;
  branchName?: string;
  area?: string;
  pincode?: string;
  location?: string;
  role?: string;
}

/**
 * Extracts bank, branch, city/location, and pincode from post-eligibility user messages in any order.
 * Dynamically handles corrections, removes conversational fillers without hardcoding, and maps pincodes.
 * Examples supported:
 * - "HDFC Bank Camp Pune"
 * - "Camp branch, Pune"
 * - "411001"
 * - "Camp"
 * - "Pune 411001"
 * - "Pune"
 * - "Actually Katraj"
 * - "Change location to Katraj 411046"
 */
/**
 * Generic confirmation detector: handles affirmations ("yes", "okay", "confirm", etc.)
 * and negations ("no", "cancel", "not this", etc.) dynamically.
 */
export function isConfirmationResponse(text: string): { isConfirmation: boolean; value?: boolean } {
  if (!text) return { isConfirmation: false };
  const raw = text.trim().toLowerCase();
  const clean = raw.replace(/[.!?,]/g, "").trim();

  // If the message specifies an explicit bank name, it is a bank selection/correction, not a pure confirmation
  if (isKnownBankName(clean) || Boolean(resolveBankName(clean))) {
    return { isConfirmation: false };
  }

  // Affirmative confirmations
  if (
    /^(?:yes|yep|yeah|yup|sure|ok|okay|k|confirm|confirmed|proceed|continue|please\s*proceed|yes\s*please|go\s*ahead|correct|right|fine|done|accept|agree|approved?)$/i.test(clean) ||
    /^(?:yes|yep|yeah|yup|sure|ok|okay|confirm|confirmed|proceed|continue|please\s*proceed|yes\s*please|go\s*ahead)\b/i.test(clean)
  ) {
    return { isConfirmation: true, value: true };
  }

  // Negative / cancellation confirmations
  if (
    /^(?:no|nope|nah|cancel|not\s*this|change\s*it|stop|dont|don't|wrong|incorrect|decline|reject)$/i.test(clean) ||
    /^(?:no|nope|nah|cancel)\b/i.test(clean)
  ) {
    return { isConfirmation: true, value: false };
  }

  return { isConfirmation: false };
}

export const LOCATION_STOPWORDS = new Set([
  "is", "my", "am", "in", "at", "to", "for", "of", "on", "from", "by", "as", "or", "so", "it", "its", "the", "a", "an", "and",
  "we", "us", "me", "our", "you", "your", "here", "there", "where", "location", "locations", "city", "branch", "branches", "place", "area", "address",
  "town", "pincode", "pin", "code", "located", "living", "live", "stay", "staying", "based", "prefer", "want", "need", "please",
  "select", "choose", "give", "show", "check", "find", "search", "change", "update", "instead", "actually", "meant", "mean",
  "tell", "list", "view", "available",
  "yes", "yeah", "yep", "sure", "ok", "okay", "no", "nope", "confirm", "proceed", "continue", "age", "years", "year", "old",
  "lakh", "lakhs", "lac", "lacs", "cr", "crore", "crores", "k", "thousand", "rupees", "rs", "inr", "cibil", "score", "salary",
  "income", "emi", "loan", "bank"
]);

export function detectLoanType(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\b(?:gold\s*loan|loan\s*against\s*gold|jewellery\s*loan|ornaments?)\b/i.test(lower)) return "Gold Loan";
  if (/\b(?:personal\s*loan|unsecured\s*loan|instant\s*loan|cash\s*loan)\b/i.test(lower)) return "Personal Loan";
  if (/\b(?:home\s*loan|housing\s*loan|plot\s*loan)\b/i.test(lower)) return "Home Loan";
  if (/\b(?:business\s*loan|msme\s*loan|commercial\s*loan)\b/i.test(lower)) return "Business Loan";
  if (/\b(?:car\s*loan|auto\s*loan|vehicle\s*loan)\b/i.test(lower)) return "Car Loan";
  if (/\b(?:education\s*loan|student\s*loan)\b/i.test(lower)) return "Education Loan";
  if (/\b(?:loan\s*against\s*property|lap)\b/i.test(lower)) return "Loan Against Property";
  return null;
}

export type EntityType =
  | "BANK"
  | "BRANCH"
  | "CITY"
  | "PINCODE"
  | "LOAN_AMOUNT"
  | "TENURE"
  | "AGE"
  | "CIBIL"
  | "EMI"
  | "CONFIRMATION"
  | "LOAN_TYPE"
  | "COMPANY";

export interface TypedLoanEntities {
  BANK?: string;
  BRANCH?: string;
  CITY?: string;
  PINCODE?: string;
  AREA?: string;
  LOAN_AMOUNT?: number;
  TENURE?: number;
  AGE?: number;
  CIBIL?: number;
  EMI?: number;
  CONFIRMATION?: boolean;
  LOAN_TYPE?: string;
  COMPANY?: string;
}

/**
 * Extracts typed loan entities with strict isolation.
 * BANK != CITY, BANK != BRANCH, CITY != CONFIRMATION, LOAN_AMOUNT != PINCODE, LOAN_AMOUNT != LOCATION
 */
export function extractTypedLoanEntities(
  text: string,
  expectedEntity?: string,
  eligibleBanks?: string[],
  currentApplicant?: ApplicantProfile
): TypedLoanEntities {
  const entities: TypedLoanEntities = {};
  if (!text) return entities;
  const raw = text.trim();
  const exp = (expectedEntity || "").toLowerCase();

  // 1. CONFIRMATION
  const conf = isConfirmationResponse(raw);
  if (conf.isConfirmation) {
    entities.CONFIRMATION = conf.value;
  }

  // 2. BANK
  const bankMatch = resolveBankName(raw, eligibleBanks);
  if (bankMatch) {
    entities.BANK = bankMatch.bankName;
  }

  // 3. LOAN_TYPE
  const lt = detectLoanType(raw);
  if (lt) {
    entities.LOAN_TYPE = lt;
  }

  // 4. STEP-AWARE FINANCIAL & PROFILE ENTITIES
  // AGE
  if (exp === "age" || /\b(?:age|years?\s*old|yo)\b/i.test(raw)) {
    const ageMatch = raw.match(/\b(\d{1,2})\s*(?:years?\s*old|age|yo)?\b/i) || raw.match(/\b(?:i\s*(?:am|m)?\s*)?(\d{1,2})\b/);
    if (ageMatch) {
      const val = parseInt(ageMatch[1], 10);
      if (val >= 18 && val <= 85) {
        entities.AGE = val;
      }
    }
  }

  // CIBIL
  if (exp === "cibil" || /\b(?:cibil|credit\s*score|score)\b/i.test(raw)) {
    const cibilMatch = raw.match(/\b([3-9]\d{2})\b/);
    if (cibilMatch) {
      const val = parseInt(cibilMatch[1], 10);
      if (val >= 300 && val <= 900) {
        entities.CIBIL = val;
      }
    }
  }

  // LOAN_AMOUNT
  if (exp === "loanamount" || exp === "loan_amount" || /\b(?:lakh|lac|crore|cr|thousand|loan\s*amount)\b/i.test(raw)) {
    const amt = parseFinancialAmount(raw);
    if (amt && amt >= 10000) {
      entities.LOAN_AMOUNT = amt;
    }
  }

  // TENURE
  if (exp === "tenuremonths" || exp === "tenure" || /\b(?:tenure|months?|years?|yr|yrs)\b/i.test(raw)) {
    const yrMatch = raw.match(/\b(\d+(?:\.\d+)?)\s*(?:years?|yrs?|yr)\b/i);
    if (yrMatch) {
      entities.TENURE = Math.round(parseFloat(yrMatch[1]) * 12);
    } else {
      const moMatch = raw.match(/\b(\d+)\s*(?:months?|mos?|m)\b/i);
      if (moMatch) {
        entities.TENURE = parseInt(moMatch[1], 10);
      } else {
        const numMatch = raw.match(/\b(\d+)\b/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          entities.TENURE = num <= 7 ? num * 12 : num;
        }
      }
    }
  }

  // EXISTING_EMI
  if (exp === "existingemi" || exp === "emi" || /\b(?:emi|existing\s*loan)\b/i.test(raw)) {
    if (/\b(?:none|no|zero|0|nil|na)\b/i.test(raw)) {
      entities.EMI = 0;
    } else {
      const emiAmt = parseFinancialAmount(raw);
      if (emiAmt !== undefined && emiAmt !== null && !isNaN(emiAmt)) {
        entities.EMI = emiAmt;
      }
    }
  }

  // 5. LOCATION (CITY, BRANCH, PINCODE)
  // Strict isolation:
  // - Pure confirmation must NEVER become location!
  // - Pure numeric input when financial/profile entity is expected must NEVER become location or pincode!
  const isPureConfirmation = conf.isConfirmation && !/(?:branch|city|bank|pincode|\d{6})/i.test(raw);
  const isNumericStep = ["age", "cibil", "loanamount", "tenuremonths", "existingemi", "monthlyincome"].includes(exp);
  const isPureNumeric = /^\d+$/.test(raw);

  if (!isPureConfirmation && !(isNumericStep && isPureNumeric)) {
    const loc = extractBankBranchLocationParams(
      raw,
      entities.BANK,
      eligibleBanks,
      expectedEntity,
      currentApplicant?.location
    );

    if (loc.pincode && isValidIndianPincode(loc.pincode)) {
      if (entities.LOAN_AMOUNT !== Number(loc.pincode)) {
        entities.PINCODE = loc.pincode;
      }
    }
    if (loc.city && !isKnownBankName(loc.city)) {
      entities.CITY = loc.city;
    }
    if (loc.area && !isKnownBankName(loc.area)) {
      entities.AREA = loc.area;
    }
    if (loc.branch && !isKnownBankName(loc.branch)) {
      entities.BRANCH = loc.branch;
    }
  }

  return entities;
}

/**
 * Robust, generic natural language parser for Bank, Branch, City, Pincode, and Area/Locality.
 * Cleanly isolates BANK, CITY, PINCODE, AREA, and BRANCH so they are never confused.
 */
export function extractBankBranchLocationParams(
  text: string,
  currentBank?: string,
  eligibleBanks?: string[],
  expectedField?: string,
  currentCity?: string
): ExtractedBankBranchLocationDetails {
  const result: ExtractedBankBranchLocationDetails = {};
  if (!text) return result;
  const raw = text.trim();

  // 0. Detect pure greetings: greetings must NEVER become location
  if (isPureGreeting(raw)) {
    return result;
  }

  // 0a. Detect confirmation responses: pure affirmations/negations must NEVER become location
  const conf = isConfirmationResponse(raw);
  if (conf.isConfirmation && !/(?:branch|city|bank|pincode|\d{6})/i.test(raw)) {
    return result;
  }

  // 0b. Detect branch / location discovery requests:
  // e.g. "tell available branches for pune city", "show branches in Pune", "available branches for Pune"
  const isDiscovery =
    /(?:tell|show|what\s+are|list|give|view|check|find)\s+(?:available\s+)?(?:branches|locations)\b/i.test(raw) ||
    /(?:available\s+branches|available\s+locations)\b/i.test(raw) ||
    /^(?:branches|locations)\s+(?:in|for|of)\b/i.test(raw);
  if (isDiscovery) {
    result.isDiscoveryRequest = true;
  }

  // 0c. Detect whether this message is an explicit correction
  const hasCorrectionPhrase = /(?:no,?\s*(?:i\s*meant|i\s*mean)|actually|change\s*(?:the\s*)?(?:location|branch|city|bank|pincode|pin)?\s*(?:to|is)?|update\s*(?:the\s*)?(?:location|branch|city|bank|pincode|pin)?\s*(?:to|is)?|switch\s*to|prefer|instead\s*(?:of)?|rather|\b(?:to|->|→)\b)/i.test(raw);

  // 1. Detect Bank Name & Correction (e.g. "HDFC Bank", "HDFC bnka", "No, I meant ICICI Bank")
  const bankMatch = resolveBankName(raw, eligibleBanks);
  if (bankMatch) {
    result.bankName = bankMatch.bankName;
    result.isCorrection = bankMatch.isCorrection || hasCorrectionPhrase;
  } else if (hasCorrectionPhrase) {
    result.isCorrection = true;
  }

  // Remove bank name to extract branch & location
  let remaining = raw;
  // If the text explicitly mentions an employer / company (e.g. "I work at Infosys"), strip it so it is never treated as a location
  const hasExplicitEmployerPhrase = /(?:work\s+(?:at|in)|working\s+(?:at|in)|employed\s+(?:at|by|in)|(?:my\s+)?(?:company|employer)\s*(?:is|:)|employer|company)\b/i.test(raw);
  const compCandidate = hasExplicitEmployerPhrase ? extractCompanyCandidateFromText(raw) : undefined;
  if (compCandidate) {
    const escComp = compCandidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    remaining = remaining.replace(new RegExp(`\\b${escComp}\\b`, "gi"), " ");
  }

  if (result.bankName) {
    const bNorm = result.bankName.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
    const escBank = result.bankName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escNorm = bNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    remaining = remaining.replace(new RegExp(`\\b(?:${escBank}|${escNorm}|bank|bnk[a-z]*)\\b`, "gi"), " ");
  }

  // 1b. Detect Role if mentioned
  const roleMatch = raw.match(/\b(branch\s*manager|area\s*sales\s*manager|zonal\s*sales\s*manager|regional\s*sales\s*manager|sales\s*manager|asm|rsm|zsm|rh|rm)\b/i);
  if (roleMatch) {
    result.role = roleMatch[0].trim();
  }

  // Handle transition phrases like "Pune to Mumbai", "from Swarget to Katraj", "411046 to 411037"
  const transitionMatch = remaining.match(/\b(?:from\s+)?([a-zA-Z0-9]+)\s+(?:to|->|→)\s+([a-zA-Z0-9]+)\b/i);
  if (transitionMatch) {
    result.isCorrection = true;
    remaining = remaining.replace(/\b(?:from\s+)?([a-zA-Z0-9]+)\s+(?:to|->|→)\s+/gi, " ");
  }

  // 2. Extract 6-digit Pincode (valid Indian postal codes)
  const pinMatch = raw.match(/\b([1-9]\d{5})\b/);
  if (pinMatch && isValidIndianPincode(pinMatch[1])) {
    result.pincode = pinMatch[1];
    remaining = remaining.replace(pinMatch[1], " ").trim();
    const cityFromPin = resolvePincodeToCity(result.pincode);
    if (cityFromPin) {
      result.city = cityFromPin;
    }
  }

  // General questions or conceptual queries should not be arbitrarily tokenized into branch and city
  const isGeneralQuestion =
    (/\?/.test(raw) || /^(?:what\s+is|what\s+are|what\s+does|how\s+does|how\s+is|how\s+to|why\s+is|why\s+do|explain|tell\s+me\s+about|meaning\s+of|definition\s+of)\b/i.test(raw)) &&
    !/(?:branch|location|city|pincode|office|address|where)\b/i.test(raw);

  if (isGeneralQuestion && !result.city && !result.branch && !result.pincode && !result.bankName) {
    return result;
  }

  // 3. Extract explicit Branch keyword (e.g. "Camp branch", "branch Camp", "branch is Camp", "at Camp branch")
  if (!result.isDiscoveryRequest) {
    const branchExplicitMatch = remaining.match(/\b([a-zA-Z0-9\s-]+?)\s+\bbranch\b/i) ||
      remaining.match(/\b(?:branch\s*(?:is|:)?|at\s+branch)\b\s*([a-zA-Z0-9\s-]+)/i);
    if (branchExplicitMatch) {
      const cand = branchExplicitMatch[1].trim();
      const candLower = cand.toLowerCase();
      if (cand.length >= 2 && !/^\d+$/.test(cand) && !isKnownBankName(cand) && !KNOWN_MAJOR_CITIES.includes(candLower) && !LOCATION_STOPWORDS.has(candLower)) {
        result.branch = cand;
        result.branchName = cand;
        remaining = remaining.replace(branchExplicitMatch[0], " ").trim();
      }
    }
  }

  // 4. Extract explicit City keyword (e.g. "city Pune", "city: Pune", "in city Pune", "based in Pune", "live in Pune", "stay in Pune")
  const cityExplicitMatch = remaining.match(/\b(?:city\s*(?:is|:)?|in\s+city\b|based\s*in|live\s*in|stay\s*in)\s*([a-zA-Z\s]+)/i);
  if (cityExplicitMatch) {
    const rawCity = cityExplicitMatch[1].trim().split(/\s*[,.]|\s+(?:and|with|for)\s+/)[0].trim();
    if (rawCity.length >= 2 && !/^\d+$/.test(rawCity) && !isKnownBankName(rawCity) && !LOCATION_STOPWORDS.has(rawCity.toLowerCase())) {
      result.city = rawCity.charAt(0).toUpperCase() + rawCity.slice(1);
      remaining = remaining.replace(cityExplicitMatch[0], " ").trim();
    }
  }

  // 4b. Extract explicit Area keyword (e.g. "area Katraj", "locality Swargate")
  const areaExplicitMatch = remaining.match(/\b(?:area\s*(?:is|:)?|in\s+area\b|locality\s*(?:is|:)?)\s*([a-zA-Z0-9\s-]+)/i);
  if (areaExplicitMatch) {
    const rawArea = areaExplicitMatch[1].trim().split(/\s*[,.]|\s+(?:and|with|for)\s+/)[0].trim();
    if (rawArea.length >= 2 && !/^\d+$/.test(rawArea) && !isKnownBankName(rawArea) && !LOCATION_STOPWORDS.has(rawArea.toLowerCase())) {
      result.area = rawArea.charAt(0).toUpperCase() + rawArea.slice(1);
      remaining = remaining.replace(areaExplicitMatch[0], " ").trim();
    }
  }

  // Generic cleaning of conversational prefixes, filler phrases, discovery phrases, etc.
  remaining = stripGreetingPrefix(remaining);
  remaining = remaining
    .replace(/\b(?:tell|show|what\s+are|list|give|view|check|find)\s+(?:available\s+)?(?:branches|locations)?\s*(?:for|in|of|at)?\b/gi, " ")
    .replace(/\b(?:available\s+)?(?:branches|locations)\s*(?:for|in|of|at)?\b/gi, " ")
    .replace(/\b(?:available)\b/gi, " ")
    .replace(/\b(?:is|as)?\s*(?:my|the|our)?\s*(?:current\s*)?(?:location|city|place|area|address|town|region|pincode|pin|code)\b/gi, " ")
    .replace(/\b(?:is|as)\s*(?:where\s+i\s+(?:live|stay|am|work))\b/gi, " ")
    .replace(/\b(?:my|the|our)\s*(?:current\s*)?(?:location|city|place|area|address|town|region|pincode|pin)\s*(?:is|as|to|should\s*be)?\b/gi, " ")
    .replace(/\b(?:i\s*(?:am|m)?\s*)?(?:currently\s*)?(?:located|living|live|staying|stay|based|working|work)\s*(?:in|at|from|near|out\s*of)?\b/gi, " ")
    .replace(/\b(?:i\s*(?:want|prefer|need|meant|mean))\s*(?:to\s*go\s*with)?\b/gi, " ")
    .replace(/\b(?:from|at|near|in)\b/gi, " ")
    .replace(/\b(?:instead\s+of\s+[a-zA-Z0-9\s-]+|change\s*(?:the\s*)?(?:location|city|bank|pincode|pin)?\s*(?:to|is)?|update\s*(?:the\s*)?(?:location|city|bank|pincode|pin)?\s*(?:to|is)?|switch\s*(?:to)?|what\s+about|how\s+about|search\s*(?:for|in)?|find\s*(?:in)?|show\s*(?:in)?|look\s*for|check\s*(?:in)?)\b/gi, " ")
    .replace(/\b(?:bank\s*managers?|branch\s*managers?|managers?|branch\s*heads?|contacts?|phones?|emails?|representatives?|officers?|executives?|directory|asm|rsm|zsm|rh|rm)\b/gi, " ")
    .replace(/\b(?:policy|policies|guidelines?|rules?|criteria|cutoff|cut-off|foir|personal\s*loan|loan|loans|need|want|borrow|apply|can\s*i|get\s*me|tell\s*me|check)\b/gi, " ")
    .replace(/^(?:no,?\s*(?:i\s*meant|i\s*mean)\s+|no,?\s+|actually\s+|instead\s+|rather\s+|i\s*(?:want|prefer|need|meant|mean)\s+|please\s+select\s+|proceed\s+with\s+|go\s+with\s+|choose\s+)/gi, " ")
    .replace(/[,\-:;?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 5. Check if any KNOWN_MAJOR_CITIES appears in remaining text
  if (!result.city) {
    for (const city of KNOWN_MAJOR_CITIES) {
      const cityRegex = new RegExp(`\\b${city}\\b`, "i");
      if (cityRegex.test(remaining)) {
        result.city = city.charAt(0).toUpperCase() + city.slice(1);
        remaining = remaining.replace(cityRegex, " ").trim();
        break;
      }
    }
  } else {
    const escCity = result.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    remaining = remaining.replace(new RegExp(`\\b${escCity}\\b`, "gi"), " ").trim();
  }

  // 6. Tokenize remaining words to identify Area, Branch, or Locality
  const remWords = remaining
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t.length >= 2 &&
        !/^\d+$/.test(t) &&
        !LOCATION_STOPWORDS.has(t.toLowerCase()) &&
        !/^(?:what|how|why|when|where|which|who|explain|policy|policies|guideline|guidelines|rule|rules|criteria|loan|loans|bank|banks|help|info)$/i.test(t)
    );
  const remText = remWords.join(" ").trim();

  if (remText.length > 0) {
    const remLower = remText.toLowerCase();

    // If remText matches known localities or road patterns (e.g. "Katraj", "Swargate", "MG Road", "FC Road", "Hadapsar")
    if (isKnownLocality(remText) || KNOWN_LOCALITIES.includes(remLower)) {
      result.area = remWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    } else {
      // Check if any sub-phrase matches known localities
      let foundLoc = "";
      for (const loc of KNOWN_LOCALITIES) {
        if (new RegExp(`\\b${loc}\\b`, "i").test(remText)) {
          foundLoc = loc;
          break;
        }
      }

      if (foundLoc) {
        result.area = foundLoc.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      } else if (expectedField === "branchSelection") {
        // Only in explicit branch selection step where user is picking from available branches
        result.branch = remWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        result.branchName = result.branch;
      } else if ((expectedField === "cityOrPincode" || expectedField === "city") && !result.city && !currentCity) {
        // User is answering city/pincode prompt with a location name (e.g. unknown city or invalid location)
        result.city = remWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      } else if (result.city || currentCity) {
        // City is already known, so any sub-location entered is an area candidate, NOT a branch!
        result.area = remWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      } else if (isKnownLocality(remText) || expectedField === "location" || expectedField === "area" || expectedField === "preferredBranch") {
        result.area = remWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }
  }

  // If area was detected and city is not set, but currentCity is available from conversation state, preserve it!
  if (result.area && !result.city && currentCity) {
    result.city = currentCity;
  }

  // Strict isolation: Never allow BANK, COMPANY, CONFIRMATION, or pure digits to become BRANCH, AREA, or CITY
  // And never allow a KNOWN_MAJOR_CITY to become BRANCH or AREA!
  const compLower = compCandidate?.toLowerCase().trim();
  if (result.branch) {
    const bLower = result.branch.toLowerCase().trim();
    if (
      isKnownBankName(result.branch) ||
      (compLower && bLower === compLower) ||
      KNOWN_MAJOR_CITIES.includes(bLower) ||
      LOCATION_STOPWORDS.has(bLower) ||
      /^(?:yes|no|ok|okay|confirm|cancel)$/i.test(bLower) ||
      /^\d+$/.test(bLower)
    ) {
      delete result.branch;
      delete result.branchName;
    }
  }
  if (result.area) {
    const aLower = result.area.toLowerCase().trim();
    if (
      isKnownBankName(result.area) ||
      (compLower && aLower === compLower) ||
      KNOWN_MAJOR_CITIES.includes(aLower) ||
      LOCATION_STOPWORDS.has(aLower) ||
      /^(?:yes|no|ok|okay|confirm|cancel)$/i.test(aLower) ||
      /^\d+$/.test(aLower)
    ) {
      delete result.area;
    }
  }
  if (result.city) {
    const cLower = result.city.toLowerCase().trim();
    if (
      isKnownBankName(result.city) ||
      (compLower && cLower === compLower) ||
      LOCATION_STOPWORDS.has(cLower) ||
      /^(?:yes|no|ok|okay|confirm|cancel)$/i.test(cLower) ||
      /^\d+$/.test(cLower)
    ) {
      delete result.city;
    }
  }

  const locParts = [result.branch, result.area, result.city || result.pincode].filter(Boolean);
  if (locParts.length > 0) {
    result.location = locParts.join(", ");
  }

  return result;
}

/**
 * Updates the normalized loan conversation state following the Critical State Rule:
 * previous valid state + latest user message + current expected field = updated state
 * Never rebuilds state from scratch, and preserves all uncontradicted fields.
 */
export function updateNormalizedLoanState(
  previous: SessionState | null | undefined,
  extracted: TypedLoanEntities,
  currentApplicant?: ApplicantProfile,
  expectedEntity?: string
): SessionState {
  const prevApplicant = previous?.applicant || currentApplicant || {
    companyName: "",
    monthlyIncome: 0,
  };

  const updatedApplicant: ApplicantProfile = {
    ...prevApplicant,
  };

  if (extracted.LOAN_AMOUNT !== undefined) {
    updatedApplicant.loanAmount = extracted.LOAN_AMOUNT;
  }
  if (extracted.TENURE !== undefined) {
    updatedApplicant.tenureMonths = extracted.TENURE;
  }
  if (extracted.AGE !== undefined) {
    updatedApplicant.age = extracted.AGE;
  }
  if (extracted.CIBIL !== undefined) {
    updatedApplicant.cibil = extracted.CIBIL;
  }
  if (extracted.EMI !== undefined) {
    updatedApplicant.existingEmi = extracted.EMI;
  }
  if (extracted.LOAN_TYPE) {
    updatedApplicant.loanType = extracted.LOAN_TYPE;
  }

  // Preserve existing bank and branch values unless explicitly updated by latest message
  let selectedBank = previous?.selectedBank || previous?.chosenBank || undefined;
  if (extracted.BANK) {
    selectedBank = extracted.BANK;
  }

  let preferredBranch = previous?.preferredBranch || previous?.branch || undefined;
  if (extracted.BRANCH) {
    preferredBranch = extracted.BRANCH;
  }

  let city = previous?.city || undefined;
  if (extracted.CITY) {
    city = extracted.CITY;
  }

  let area = previous?.area || undefined;
  if (extracted.AREA) {
    area = extracted.AREA;
  }

  let pincode = previous?.pincode || undefined;
  if (extracted.PINCODE) {
    pincode = extracted.PINCODE;
    if (!city) {
      city = resolvePincodeToCity(pincode) || undefined;
    }
  }

  const location = [preferredBranch, area, city || pincode].filter(Boolean).join(", ");
  if (location) {
    updatedApplicant.location = location;
  }
  if (preferredBranch) {
    updatedApplicant.branch = preferredBranch;
  }
  if (area) {
    updatedApplicant.area = area;
  }

  const updatedState: SessionState = {
    ...(previous || {
      missingFields: [],
      in_eligibility_flow: false,
    }),
    applicant: updatedApplicant,
    loanType: extracted.LOAN_TYPE || previous?.loanType || updatedApplicant.loanType,
    selectedBank,
    chosenBank: selectedBank,
    preferredBranch,
    branch: preferredBranch,
    branchName: preferredBranch,
    city,
    area,
    pincode,
    location: location || previous?.location,
    confirmation: extracted.CONFIRMATION !== undefined ? extracted.CONFIRMATION : previous?.confirmation,
    currentStep: previous?.currentStep,
    expectedEntity: previous?.expectedEntity || expectedEntity,
    locationStep: previous?.locationStep,
    updatedAt: Date.now(),
  };

  return updatedState;
}

export function formatStateSummary(state: any, applicant?: any): Record<string, any> {
  return {
    loanType: state?.loanType || applicant?.loanType || undefined,
    loanAmount: state?.loanAmount || applicant?.loanAmount || undefined,
    tenure: state?.tenure || state?.tenureMonths || applicant?.tenureMonths || undefined,
    selectedBank: state?.selectedBank || state?.chosenBank || undefined,
    preferredBranch: state?.preferredBranch || state?.branch || applicant?.branch || undefined,
    branchName: state?.branchName || state?.branch || undefined,
    city: state?.city || applicant?.location || undefined,
    area: state?.area || applicant?.area || undefined,
    pincode: state?.pincode || applicant?.pincode || undefined,
    locationStep: state?.locationStep || undefined,
    currentStep: state?.currentStep || undefined,
    expectedEntity: state?.expectedEntity || state?.expectedField || undefined,
    confirmation: state?.confirmation !== undefined ? state.confirmation : undefined,
  };
}

/**
 * Standardized 8-key temporary debug logger as requested by user.
 */
export function logFlowDebug(params: {
  currentFlow: string;
  currentStep: string;
  expectedEntity: string;
  userMessage: string;
  detectedIntent: string;
  extractedEntities: Record<string, any>;
  previousState: Record<string, any>;
  updatedState: Record<string, any>;
}) {
  console.log(`CURRENT FLOW: ${params.currentFlow}`);
  console.log(`CURRENT STEP: ${params.currentStep}`);
  console.log(`EXPECTED ENTITY: ${params.expectedEntity}`);
  console.log(`USER MESSAGE: ${params.userMessage}`);
  console.log(`DETECTED INTENT: ${params.detectedIntent}`);
  console.log(`EXTRACTED ENTITIES:`, JSON.stringify(params.extractedEntities));
  console.log(`PREVIOUS STATE:`, JSON.stringify(params.previousState));
  console.log(`UPDATED STATE:`, JSON.stringify(params.updatedState));
}

/**
 * Reconciles bank manager search entities between previous session state and latest user input.
 * Dynamically prioritizes latest extracted values, preserves non-contradicted entities,
 * and invalidates stale conflicting location values.
 *
 * Rules implemented:
 * 1. Latest user message has highest priority for entity values.
 * 2. Preserve only entities that are not contradicted.
 * 3. When a new branch/city/pincode is detected, invalidate conflicting old location values.
 * 4. When a new bank is detected, replace the previous bank dynamically (and invalidate old branch/area).
 * 5. When area is provided, preserve city if already known.
 * 6. Never assign a city or area to branch.
 * 7. Case-insensitive and whitespace-tolerant.
 */
export function reconcileBankManagerEntities(
  previous: BankManagerSearchEntities | null | undefined,
  latest: (ExtractedBankBranchLocationDetails & { role?: string }) | null | undefined,
  context?: {
    expectedField?: string;
    isPriorSearchCompleted?: boolean;
  }
): BankManagerSearchEntities {
  const prevBank = previous?.bank_name?.trim() || "";
  const prevBranch = previous?.branch?.trim() || "";
  const prevArea = previous?.area?.trim() || "";
  const prevCity = previous?.city?.trim() || "";
  const prevPincode = previous?.pincode?.trim() || "";
  const prevLocation = previous?.location?.trim() || "";
  const prevRole = previous?.role?.trim() || "";

  const latestBank = latest?.bankName?.trim() || "";
  const latestBranch = latest?.branch?.trim() || "";
  const latestArea = latest?.area?.trim() || "";
  const latestCity = latest?.city?.trim() || "";
  const latestPincode = latest?.pincode?.trim() || "";
  const latestLocation = latest?.location?.trim() || "";
  const latestRole = latest?.role?.trim() || "";
  const isCorrection = Boolean(latest?.isCorrection);

  const final: BankManagerSearchEntities = {};

  // Rule 1 & Rule 4: Bank handling
  let bankChanged = false;
  if (latestBank) {
    final.bank_name = latestBank;
    if (prevBank && prevBank.toLowerCase() !== latestBank.toLowerCase()) {
      bankChanged = true;
    }
  } else if (prevBank) {
    final.bank_name = prevBank;
  }

  // Branch & Area invalidation flag
  let invalidateOldBranch = bankChanged;
  let invalidateOldArea = bankChanged;

  // City handling
  let cityChanged = false;
  if (latestCity) {
    final.city = latestCity;
    if (prevCity && prevCity.toLowerCase() !== latestCity.toLowerCase()) {
      cityChanged = true;
      invalidateOldBranch = true;
      invalidateOldArea = true;
    } else if ((isCorrection || context?.isPriorSearchCompleted) && !latestBranch && !latestArea) {
      // User explicitly re-stated city only (e.g. "Pune" after "Katraj" had 0 records)
      invalidateOldBranch = true;
      invalidateOldArea = true;
    }
  } else if (latestPincode && !prevCity) {
    final.city = resolvePincodeToCity(latestPincode) || undefined;
  } else {
    final.city = prevCity || undefined;
  }

  // Pincode handling
  if (latestPincode) {
    final.pincode = latestPincode;
  } else if (cityChanged) {
    final.pincode = undefined;
  } else {
    final.pincode = prevPincode || undefined;
  }

  // Area handling
  if ((context?.expectedField === "city" || context?.expectedField === "cityOrPincode") && !final.city && latestArea && !latestBranch) {
    final.city = latestArea;
    final.area = undefined;
  } else if (latestArea) {
    final.area = latestArea;
  } else if (invalidateOldArea) {
    final.area = undefined;
  } else {
    final.area = prevArea || undefined;
  }

  // Branch handling
  if (latestBranch) {
    final.branch = latestBranch;
    final.branchName = latestBranch;
  } else if (invalidateOldBranch) {
    final.branch = undefined;
    final.branchName = undefined;
  } else {
    final.branch = prevBranch || undefined;
    final.branchName = prevBranch || undefined;
  }

  // Composite location
  if (latestLocation) {
    final.location = latestLocation;
  } else if (final.branch || final.area || final.city || final.pincode) {
    final.location = [final.branch, final.area, final.city || final.pincode].filter(Boolean).join(", ");
  } else {
    final.location = prevLocation || undefined;
  }

  // Role handling
  if (latestRole) {
    final.role = latestRole;
  } else if (prevRole && !bankChanged) {
    final.role = prevRole;
  }

  // Ensure numeric strings are NEVER assigned to branch, area, city, or location
  if (final.branch && /^\d+$/.test(final.branch.trim())) {
    final.branch = undefined;
    final.branchName = undefined;
  }
  if (final.area && /^\d+$/.test(final.area.trim())) {
    final.area = undefined;
  }
  if (final.city && /^\d+$/.test(final.city.trim())) {
    final.city = undefined;
  }
  if (final.pincode && !isValidIndianPincode(final.pincode)) {
    final.pincode = undefined;
  }
  if (final.location && /^\d+$/.test(final.location.trim())) {
    final.location = undefined;
  }

  console.log(
    `[BankManager] previous entities → latest extracted entities → final search entities:`,
    `\n  previous: ${JSON.stringify(previous || {})}`,
    `\n  latest:   ${JSON.stringify(latest || {})}`,
    `\n  final:    ${JSON.stringify(final)}`
  );

  return final;
}

export function generatePreliminaryRecommendation(applicant: ApplicantProfile): string {
  const parts: string[] = [];
  const salary = typeof applicant.monthlyIncome === "number" ? applicant.monthlyIncome : (applicant.monthlyIncome && !isNaN(Number(applicant.monthlyIncome)) ? Number(applicant.monthlyIncome) : 0);
  const loan = typeof applicant.loanAmount === "number" ? applicant.loanAmount : (applicant.loanAmount && !isNaN(Number(applicant.loanAmount)) ? Number(applicant.loanAmount) : 0);
  const company = applicant.companyName;

  if (company && company !== "Self-Employed" && salary > 0) {
    parts.push(`With an income of **₹${salary.toLocaleString("en-IN")}/month** at **${company}**, you match the profile for top partner banks (including **HDFC Bank, ICICI Bank, Axis Bank, and Kotak Mahindra Bank**), with indicative interest rates starting from **10.5% – 11.25% p.a.**`);
  } else if (salary > 0) {
    parts.push(`A monthly salary of **₹${salary.toLocaleString("en-IN")}** qualifies for the minimum income cutoff across major partner lenders, typically supporting borrowing capacity up to 15–20x monthly income.`);
  } else if (company && company !== "Self-Employed") {
    parts.push(`**${company}** is recognized in partner corporate registries, providing access to preferential corporate interest rates and higher loan multipliers.`);
  } else if (loan > 0) {
    parts.push(`A requested loan of **₹${loan.toLocaleString("en-IN")}** is within standard unsecured personal loan ticket limits across partner banks.`);
  }

  if (parts.length === 0) return "";

  return (
    `💡 **Preliminary Recommendation (Indicative)**\n` +
    parts.join(" ") + "\n" +
    `*(Note: This is an indicative preview. Confirmed eligibility and bank-wise sanction limits require your complete details.)*`
  );
}

/**
 * Normalizes text for greeting checks by collapsing repeated letters and stripping punctuation/whitespace.
 */
export function normalizeGreetingTokens(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if user input is a pure greeting, salutation, or pleasantry with NO loan or business intent.
 * Covers Indian and global greetings, common typos ("helo", "hlo", "hlw", etc.), time-of-day greetings,
 * and casual greetings with bot names ("hello creditwise", "hey bot").
 */
export function isPureGreeting(text: string): boolean {
  if (!text) return false;
  const clean = normalizeGreetingTokens(text);
  if (!clean) return false;

  // If message mentions loan, bank policy, calculation, manager, or financial numbers, it is NOT a pure greeting
  if (
    /(?:loan|borrow|emi|cibil|salary|income|cutoff|policy|criteria|foir|manager|branch|lakh|crore|thousand|pvt|ltd|limited|\d+)/i.test(clean)
  ) {
    return false;
  }

  // Strip addressing words like "bot", "creditwise", "ai", "there", "assistant", "team", "sir", "madam", "friend"
  const stripped = clean
    .replace(/\b(?:creditwise(?:\s*ai)?|creditwiseai|bot|assistant|ai|there|sir|madam|team|everyone|all|friend|buddy)\b/gi, "")
    .trim();

  // Greeting patterns:
  // 1. Hello variants & typos: helo, hello, hlo, hlw, hellow, helloo, heloo, hllo, helooo
  // 2. Hi/Hey variants: hi, hii, hiii, hey, heyy, heya, heyya, hiya, howdy, hola, bonjour, sup, yo, wassup
  // 3. Indian greetings: namaste, namaskar, namaskara, namaskaram, pranam, pranaam, vanakkam, salaam, salam, adaab, sat sri akal, radhe radhe, ram ram, jai shri ram, khamma ghani
  // 4. Time of day: good morning, good afternoon, good evening, good day, good night, morning, evening
  // 5. Pleasantries: greetings, welcome, how are you, how do you do, what's up, whats up
  const greetingRegex =
    /^(?:h(?:e+l+o+w*|e+l+l+o+w*|l+o+|l+w+|l+l+o+)|h(?:i+|e+y+|e+y+a+)|h(?:owdy|ola|iya)|bonjour|sup|wassup|yo|namaste+|namaskar(?:a|am)?|prana?am|vanakkam|sala+m|ada+b|sat\s*sri\s*akal|radhe\s*radhe|ram\s*ram|jai\s*shri\s*ram|khamma\s*ghani|good\s*(?:morning|afternoon|evening|day|night)|morning|evening|greetings|welcome|how\s*(?:are\s*you|do\s*you\s*do)|what(?:'?s|\s+is)\s*up)$/i;

  return greetingRegex.test(stripped) || greetingRegex.test(clean);
}

/**
 * Checks if input is a greeting or general pleasantry (e.g. "thank you", "nice to meet you").
 */
export function isGreetingOrPleasantry(text: string): boolean {
  if (isPureGreeting(text)) return true;
  const clean = normalizeGreetingTokens(text);
  if (!clean) return false;
  if (
    /(?:loan|borrow|emi|cibil|salary|income|cutoff|policy|criteria|foir|manager|branch|lakh|crore|thousand|pvt|ltd|limited|\d+)/i.test(clean)
  ) {
    return false;
  }
  return /^(?:thanks?|thank\s*you(?:\s*so\s*much)?|nice\s*to\s*meet\s*you|pleasure\s*to\s*meet\s*you|have\s*a\s*nice\s*day|see\s*you|bye|goodbye|take\s*care)\b/i.test(clean);
}

/**
 * Checks if input starts with a greeting prefix, allowing extraction of the actual intent behind it.
 * E.g. "helo I need a loan" -> returns true.
 */
export function hasGreetingPrefix(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return /^(?:h(?:e+l+o+w*|e+l+l+o+w*|l+o+|l+w+|l+l+o+)|h(?:i+|e+y+|e+y+a+)|h(?:owdy|ola|iya)|bonjour|sup|wassup|yo|namaste+|namaskar(?:a|am)?|prana?am|vanakkam|sala+m|ada+b|sat\s*sri\s*akal|radhe\s*radhe|ram\s*ram|jai\s*shri\s*ram|good\s*(?:morning|afternoon|evening|day|night)|morning|evening|greetings|welcome)\b/i.test(clean);
}

/**
 * Strips greeting prefixes from text to expose the core user intent.
 * E.g. "helo I need a 5 lakh loan" -> "I need a 5 lakh loan"
 */
export function stripGreetingPrefix(text: string): string {
  if (!text) return "";
  let clean = text.trim();
  clean = clean.replace(
    /^(?:(?:h(?:e+l+o+w*|e+l+l+o+w*|l+o+|l+w+|l+l+o+)|h(?:i+|e+y+|e+y+a+)|h(?:owdy|ola|iya)|bonjour|sup|wassup|yo|namaste+|namaskar(?:a|am)?|prana?am|vanakkam|sala+m|ada+b|sat\s*sri\s*akal|radhe\s*radhe|ram\s*ram|jai\s*shri\s*ram|good\s*(?:morning|afternoon|evening|day|night)|morning|evening|greetings|welcome|how\s*(?:are\s*you|do\s*you\s*do)|what(?:'?s|\s+is)\s*up)\b[\s,!.:;-]*)+/i,
    ""
  ).trim();
  return clean || text.trim();
}

/**
 * Validates whether a candidate string is NOT a valid company name.
 * Recognizes structural validation, numbers, and non-company status answers (jobless, unemployed, student, freelancer).
 */
export function isInvalidCompanyName(text: string): boolean {
  if (!text) return true;
  const raw = text.trim();
  if (isKnownBankName(raw)) return true;
  if (isLocationInput(raw)) return true;
  if (isPureGreeting(raw) || isGreetingOrPleasantry(raw)) return true;
  const clean = raw.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length < 2) return true;
  if (/^\d+$/.test(clean)) return true;
  if (!/[a-zA-Z]/.test(clean)) return true;

  // Known bank names must never enter company search
  if (isKnownBankName(clean)) return true;

  // Bank policy queries must never enter company search
  if (
    /(?:policy|policies|guideline|guidelines|rules?|criteria|cutoff|cut-off)\b/i.test(clean) &&
    /(?:bank|hdfc|icici|axis|sbi|kotak|bajaj|tata|idfc|indusind|bandhan|yes|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe)/i.test(clean)
  ) {
    return true;
  }

  // Standalone common dictionary words / system commands / keywords:
  if (
    /^(?:help|start|menu|info|information|options|loan|loans|bank|banks|apply|check|status|manager|branch|branches|calculate|calculator|emi|test|demo|guide|about|details|query|contact|support|service|services|rate|rates|interest|feature|features|policy|policies|rules|criteria|cutoff|cutoffs|foir|score|scores|cibil|credit|bureau|yes|no|none|nil|na|n\/a|okay|ok|sure|cancel|reset|restart|exit|stop)$/i.test(clean)
  ) {
    return true;
  }

  // Greetings and typo variants
  if (
    /^(?:h(?:e+l+o+w*|e+l+l+o+w*|l+o+|l+w+|l+l+o+)|h(?:i+|e+y+|e+y+a+)|h(?:owdy|ola|iya)|bonjour|sup|wassup|yo|namaste+|namaskar(?:a|am)?|prana?am|vanakkam|sala+m|ada+b|sat\s*sri\s*akal|radhe\s*radhe|ram\s*ram|jai\s*shri\s*ram|good\s*(?:morning|afternoon|evening|day|night)|morning|evening|greetings|welcome)\b/i.test(clean)
  ) {
    return true;
  }

  // Questions, conversational phrases, confirmations, small talk
  if (
    /\?$/.test(raw) ||
    /^(?:why|how|what|when|where|who|which|explain|is|can|will|do|did|does|should|would|could|are|am)\b/i.test(clean) ||
    /^(?:ok|okay|sure|yes|yep|yeah|proceed|continue|go\s*ahead|fine|understood|got\s*it|thanks|thank\s*you|hello|helo|hi|hey|good\s*(?:morning|afternoon|evening|day)|bye|cancel|reset)\b/i.test(clean)
  ) {
    return true;
  }

  // Financial parameter statements, corrections, or profile data
  if (
    /\b(?:salary|income|take\s*home|in\s*hand|cibil|credit\s*score|existing\s*emi|no\s*emi|zero\s*emi|lakh|lakhs|crore|crores|peti|khoka)\b/i.test(clean) ||
    /\b(?:loan|personal\s*loan|home\s*loan|borrow|borrowing|need\s*(?:a\s*)?loan|want\s*(?:a\s*)?loan|apply\s*(?:for\s*)?(?:a\s*)?loan|get\s*(?:a\s*)?loan)\b/i.test(clean)
  ) {
    return true;
  }

  if (
    /^(?:i\s+am\s+|i\s*m\s+)?(?:jobless|unemployed|no\s*job|without\s*(?:a\s*)?job|laid\s*off|not\s*working(?:\s*anywhere)?|none|nil|na|n\/a|nothing|zero|0|0rs|student|freelancer?|self[\s-]*employed)$/i.test(
      clean
    ) ||
    /(?:not\s*working(?:\s*anywhere)?|don['’]?t\s*work|have\s*no\s*job|without\s*a?\s*job|jobless|unemployed|un-employed|lost\s*my\s*job|laid\s*off|no\s*employment)/i.test(clean)
  ) {
    return true;
  }

  // Company disavowals ("this is not my company", "not my company", "wrong company", "that is not my employer", etc.)
  if (
    /\b(?:this\s+is\s+not|that'?s\s+not\s+(?:where\s+i\s+work|my\s+company|my\s+employer)|not\s+my\s+(?:company|employer)|wrong\s+(?:company|employer)|i\s+don'?t\s+work\s+(?:at|in|there)|remove\s+(?:my\s+)?company|change\s+(?:my\s+)?company|different\s+company)\b/i.test(
      clean
    )
  ) {
    return true;
  }

  // Meta inquiries or requests for company information / category check ("i want my company information", "check my company", etc.)
  if (
    /\b(?:company\s+(?:info|information|details|category|tier)|(?:i\s+want|tell\s+me|show\s+me|what\s+is)\s+(?:my\s+)?company(?:\s+info|\s+information)?|check\s+my\s+company)\b/i.test(
      clean
    )
  ) {
    return true;
  }

  // Generic company search commands, inquiries, or typo queries (must never be stored as employer names)
  if (
    /^(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach|lookup|check|find|details|info|information|list)$/i.test(clean) ||
    /^(?:search|serach|check|find|lookup|show|list|display)\s+(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)$/i.test(clean) ||
    /^(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach)\b/i.test(clean) ||
    /^(?:search|serach)\s+(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\b/i.test(clean) ||
    /^(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer)$/i.test(clean) ||
    /^(?:give\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)|tell\s+me\s+about|show\s+(?:me\s+)?|what\s+is\s+(?:the\s+)?(?:category|tier|rating|status|details)|check\s+company|search\s+company)\b/i.test(clean) ||
    /\b(?:give\s+(?:me\s+)?(?:the\s+)?information\s+(?:of|about|on|for)|give\s+(?:me\s+)?(?:the\s+)?details\s+(?:of|about|on|for)|tell\s+me\s+about)\b/i.test(clean)
  ) {
    return true;
  }

  // Matching companies list inquiries, missing list complaints, or typos (e.g. "matching compies list", "matching compies list not displaying", "show matching companies")
  if (
    /\b(?:matching\s+comp(?:any|anies|ny|nay|o|a|ies)?|comp(?:any|anies|ny|nay|o|a|ies)?\s+list|not\s+displaying|not\s+showing|where\s+(?:is|are)\s+(?:the\s+)?comp(?:any|anies|ny|nay|o|a|ies)?)\b/i.test(clean) ||
    /^(?:matching\s+comp(?:any|anies|ny|nay|o|a|ies)?(?:\s+list)?(?:\s+not\s+(?:displaying|showing))?|show\s+matching(?:\s+comp(?:any|anies|ny|nay|o|a|ies)?)?|list\s+matching(?:\s+comp(?:any|anies|ny|nay|o|a|ies)?)?)$/i.test(clean)
  ) {
    return true;
  }

  return false;
}

/**
 * Detects if a user message disavows the currently assigned/selected company
 * (e.g. "this is not my company", "not my employer", "wrong company", "i don't work at infosys, i work at tcs")
 * and extracts any replacement company mentioned in the same message.
 */
export function detectCompanyDisavowal(text: string): { isDisavowal: boolean; replacementCompany?: string } {
  if (!text) return { isDisavowal: false };
  const clean = text.trim();
  const disavowalRegex = /\b(?:this\s+is\s+not\s+(?:my\s+)?(?:company|employer)|that'?s\s+not\s+(?:where\s+i\s+work|my\s+company|my\s+employer)|not\s+my\s+(?:company|employer)|wrong\s+(?:company|employer)|i\s+don'?t\s+work\s+(?:at|in|there|for)|i\s+do\s+not\s+work\s+(?:at|in|there|for)|remove\s+(?:my\s+)?company|change\s+(?:my\s+)?company|different\s+company|neither|none\s+of\s+these)\b/i;

  if (!disavowalRegex.test(clean)) {
    return { isDisavowal: false };
  }

  // Check if user also provided a replacement company in the same message, e.g.:
  // "this is not my company, I work at TCS"
  // "not my company, it is Wipro"
  // "wrong company actually TCS"
  const replacementMatch = clean.match(/(?:i\s+work\s+(?:at|in|for)|it\s+is|it['’]s|my\s+company\s+is|actually|instead|rather)\s+([A-Za-z0-9\s&.,'-]+?)(?:[.!?]|$)/i);
  if (replacementMatch && replacementMatch[1]) {
    const candidate = replacementMatch[1].trim().replace(/^[,\s-]+|[,\s-]+$/g, "");
    if (candidate.length >= 2 && !isInvalidCompanyName(candidate) && !isFinancialOrProfileInput(candidate)) {
      return { isDisavowal: true, replacementCompany: candidate };
    }
  }

  return { isDisavowal: true };
}

/**
 * Checks if user input represents purely financial or profile parameters (salary, CIBIL, age, loan amount, tenure, EMI)
 * that must NEVER be inferred or assigned as a company name.
 */
export function isFinancialOrProfileInput(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  const stripped = clean.replace(/^(?:(?:actually|wait|no|update|change|please|hey|hi|hello|my)\s*[,:]?\s*)+/i, "").trim();

  // Phrases with take-home, in-hand, per month, or direct salary/income statements
  if (
    /^(?:my\s+)?(?:monthly\s+)?(?:take\s*home|in\s*hand|salary|income|nmi|nth)(?:\s+is)?(?:\s*[:=-])?\s*(?:rs\.?|₹)?\s*\d+/i.test(clean) ||
    /^(?:my\s+)?(?:monthly\s+)?(?:take\s*home|in\s*hand|salary|income|nmi|nth)(?:\s+is)?(?:\s*[:=-])?\s*(?:rs\.?|₹)?\s*\d+/i.test(stripped) ||
    /(?:take\s*home|in\s*hand|per\s*month|\/mo)\b/i.test(clean) ||
    /(?:take\s*home|in\s*hand|per\s*month|\/mo)\b/i.test(stripped) ||
    /\b(?:salary|income)\s*(?:is\s*)?(?:rs\.?|₹)?\s*\d+/i.test(clean) ||
    /\b(?:salary|income)\s*(?:is\s*)?(?:rs\.?|₹)?\s*\d+/i.test(stripped)
  ) {
    return true;
  }

  // Numeric corrections like "actually make it 60000", "change it to 70000", "make that 65000"
  if (
    /\b(?:make\s+(?:it|that)|change\s+(?:it\s+to|to)|set\s+(?:it\s+to|to)|update\s+(?:it\s+to|to)|instead)\s*(?:rs\.?|₹)?\s*[\d,]+/i.test(clean) ||
    /^(?:make\s+(?:it|that)|change\s+(?:it\s+to|to)|set\s+(?:it\s+to|to)|update\s+(?:it\s+to|to)|instead)\s*(?:rs\.?|₹)?\s*[\d,]+/i.test(stripped)
  ) {
    return true;
  }

  // Salary, loan amount, or currency figures (e.g. "75000", "75k", "0.75 lakh", "5L", "₹500000", "500000", "5 lakhs", "0rs", "0")
  if (
    /^(?:rs\.?|₹)?\s*\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr|crores?)?(?:\s*(?:per\s*month|\/mo|salary|income|loan))?$/i.test(clean) ||
    /^(?:rs\.?|₹)?\s*\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr|crores?)?(?:\s*(?:per\s*month|\/mo|salary|income|loan))?$/i.test(stripped)
  ) {
    return true;
  }

  // 3-digit CIBIL score (300-900)
  if (
    /^(?:(?:my\s+)?(?:cibil|credit\s*score|score)(?:\s*is)?(?:\s*[:=-])?\s*)?[3-9]\d{2}(?:\s*(?:cibil|score|credit\s*score))?$/i.test(clean) ||
    /^(?:(?:my\s+)?(?:cibil|credit\s*score|score)(?:\s*is)?(?:\s*[:=-])?\s*)?[3-9]\d{2}(?:\s*(?:cibil|score|credit\s*score))?$/i.test(stripped) ||
    /\b(?:cibil|credit\s*score|score\s*is|score\b)\s*[3-9]\d{2}\b/i.test(clean)
  ) {
    return true;
  }

  // 2-digit age (18-85) - handles "23", "23 age", "age 23", "I am 23", "my age is 23", "23 years old", "23 yrs", "23 saal", "age: 23"
  if (
    /^(?:(?:i\s*am|i'?m|my\s*age\s*is|age\s*is|age\s*[:=-]?)\s*)?(?:1[8-9]|[2-8]\d)\s*(?:years?\s*old|years?|yrs?|yr|saal|sal|age)?$/i.test(clean) ||
    /^(?:(?:i\s*am|i'?m|my\s*age\s*is|age\s*is|age\s*[:=-]?)\s*)?(?:1[8-9]|[2-8]\d)\s*(?:years?\s*old|years?|yrs?|yr|saal|sal|age)?$/i.test(stripped) ||
    /\b(?:i\s*am|i'?m|my\s*age\s*is|age\s*is|age\s*[:=-])\s*(?:1[8-9]|[2-8]\d)\b/i.test(clean) ||
    /\b(?:1[8-9]|[2-8]\d)\s*(?:years?\s*old|yrs?\s*old|years?|yrs?|saal)\b/i.test(clean) ||
    /\b(?:1[8-9]|[2-8]\d)\s*age\b/i.test(clean)
  ) {
    return true;
  }

  // Tenure (e.g. "3 years", "36 months", "3y", "5 yrs", "3", "5")
  if (
    /^\d{1,2}\s*(?:years?|yrs?|months?|m\b|y\b)?$/i.test(clean) ||
    /^\d{1,2}\s*(?:years?|yrs?|months?|m\b|y\b)?$/i.test(stripped)
  ) {
    return true;
  }

  // EMI answers & zero values (e.g. "none", "0 emi", "no emi", "zero", "nil", "nothing", "nope", "0rs", "0")
  if (
    /^(?:no|none|nil|zero|0|nope|nothing|no\s*emi|0\s*emi|no\s*loans|0rs|rs\.?\s*0)$/i.test(clean) ||
    /^(?:no|none|nil|zero|0|nope|nothing|no\s*emi|0\s*emi|no\s*loans|0rs|rs\.?\s*0)$/i.test(stripped)
  ) {
    return true;
  }

  return false;
}

/**
 * Detects compound loan intent combined with a company check request
 * (e.g. "I want loan but first check mthree", "I need a loan, check Infosys first", "check TCS first then loan").
 */
export function extractCompoundLoanCompanyIntent(text: string): { isCompound: boolean; companyCandidate?: string } {
  if (!text) return { isCompound: false };
  const raw = text.trim();
  if (isPureGreeting(raw) || isGreetingOrPleasantry(raw) || isFinancialOrProfileInput(raw)) {
    return { isCompound: false };
  }

  // Pattern 1: "I want loan but first check mthree", "I need a loan, check Infosys first"
  const m1 = raw.match(
    /(?:(?:i\s+)?(?:want|need|require|looking\s+for|apply\s+for)?\s*(?:a\s*)?(?:personal\s*)?loan\s*(?:,|\.|\s+but|\s+and|\s+so|\s+first)?\s*(?:first\s+check|check\s+(?:my\s+)?(?:company)?|verify\s+(?:company)?)\s+|(?:first\s+check|check\s+(?:my\s+)?(?:company)?|verify\s+(?:company)?)\s+)([A-Za-z0-9\s&'.-]+?)(?=\s+(?:first|then|for\s+loan|for\s+my\s+loan|and|please|$)|$)/i
  );
  if (m1) {
    const cand = m1[1].replace(/^(?:my\s+)?(?:company|employer)\s+/i, "").trim();
    if (cand.length >= 2 && !isInvalidCompanyName(cand) && !isFinancialOrProfileInput(cand) && !isLocationInput(cand) && !isKnownBankName(cand)) {
      return { isCompound: true, companyCandidate: cand };
    }
  }

  // Pattern 2: "first check mthree before loan", "check google then I want loan"
  const m2 = raw.match(
    /(?:first\s+check|check\s+(?:my\s+)?(?:company)?|verify\s+(?:company)?)\s+([A-Za-z0-9\s&'.-]+?)\s*(?:first)?\s*(?:,|\.|\s+then|\s+before|\s+and)?\s*(?:i\s+)?(?:want|need|require|looking\s+for|apply\s+for)\s*(?:a\s*)?loan/i
  );
  if (m2) {
    const cand = m2[1].replace(/^(?:my\s+)?(?:company|employer)\s+/i, "").trim();
    if (cand.length >= 2 && !isInvalidCompanyName(cand) && !isFinancialOrProfileInput(cand) && !isLocationInput(cand) && !isKnownBankName(cand)) {
      return { isCompound: true, companyCandidate: cand };
    }
  }

  return { isCompound: false };
}

/**
 * Strips conversational query phrasing, actions, prepositions, and corporate suffixes
 * to isolate the clean target company/employer name.
 * e.g. "give me information of infosys company" -> "infosys"
 *      "company search infosys" -> "infosys"
 *      "company serach tcs" -> "tcs"
 *      "tell me about TCS" -> "TCS"
 *      "company search" -> ""
 */
export function extractCleanCompanyName(input: string): string {
  if (!input) return "";
  let str = input.trim();

  // 1. Remove leading conversational, action, and matching list prefixes
  str = str.replace(
    /^(?:can\s+(?:you|we)\s+|could\s+you\s+|please\s+|i\s+(?:want|need|wish|would\s+like)\s+(?:to\s+)?(?:check|see|know|search|find|get)?\s*)/i,
    ""
  );
  str = str.replace(
    /^(?:show\s+(?:me\s+)?(?:the\s+)?|display\s+(?:the\s+)?|list\s+(?:the\s+)?|get\s+(?:the\s+)?|where\s+(?:is|are)\s+(?:the\s+)?)?(?:matching\s+)?comp(?:any|anies|ny|nay|o|a|ies)?(?:\s+list)?\s+(?:of|for|in|about)\s+/i,
    ""
  );
  str = str.replace(/[?.,!]+$/, "").trim();
  str = str.replace(
    /^(?:give\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)\s+(?:of|about|on|for|regarding)|show\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)?\s*(?:of|about|on|for)?|tell\s+me\s+about|provide\s+(?:me\s+)?(?:details|info|information)\s+(?:of|about|on|for)?|what\s+is\s+(?:the\s+)?(?:category|tier|rating|status|details|info|information)?\s*(?:of|for|on|about)?|what\s+is|who\s+is|how\s+is|check\s+(?:for\s+)?|search\s+(?:for\s+)?|verify|look\s*up|find|info\s+on|details\s+(?:of|for|about)|is|are)\s+/i,
    ""
  );

  // 1b. Remove employment prefix if present
  str = str.replace(
    /^(?:(?:i\s*am|i['"]?m|i)\s+(?:working\s+)?(?:at|in|with|for)|(?:i\s+)?(?:work|works|working|employed)\s+(?:at|in|with|for|by)|(?:my\s+)?(?:employer|company)\s+is|employer\s*[:=-]|company\s*[:=-]|at|in|with|for)\s+/i,
    ""
  );

  // 2. Strip 'company search', 'company serach', 'search company', 'check company' prefixes/suffixes
  str = str.replace(
    /^(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach|lookup|check|find|details|info|information)\s+(?:of|for|about|on)?\s*/i,
    ""
  );
  str = str.replace(
    /^(?:search|serach|check|find|lookup)\s+(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\s+(?:of|for|about|on)?\s*/i,
    ""
  );

  // 3. Remove leading 'company' / 'employer' if still at start
  str = str.replace(/^(?:the\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer)\s+/i, "");

  // 3b. Strip trailing inquiry clauses e.g. ". Give me information about that company"
  str = str.replace(/(?:\s*[.,;!?]|\s+(?:and|with|so|now))\s*(?:(?:please\s+)?(?:give|show|tell|provide|check|display|find|get)\s+.*|what\s+.*|can\s+you\s+.*)$/i, "");

  // 4. Remove trailing query phrases like 'company', 'company details', 'listing', 'category rating', 'is listed'
  str = str.replace(/\s+(?:is\s+)?(?:listed|categorized|approved)\s*(?:in\s+banks?|across\s+banks?)?$/i, "");
  str = str.replace(/\s+(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\s+(?:details|information|info|rating|tier|category|status|listing|list)$/i, "");
  str = str.replace(/\s+(?:details|information|info|rating|tier|category|status|listing|profile|list)$/i, "");
  str = str.replace(/\s+(?:not\s+(?:displaying|showing))$/i, "");
  str = str.replace(/\s+(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)$/i, "");

  // 5. Clean punctuation
  str = str.replace(/^[?.,!:\s]+|[?.,!:\s]+$/g, "").trim();

  // If the result is just generic words like 'search', 'serach', 'company', 'matching', etc., return empty
  if (/^(?:search|serach|company|compny|comapny|compies|employer|details|info|information|check|find|lookup|status|category|tier|rating|matching|list|matching\s+companies|matching\s+compies)$/i.test(str)) {
    return "";
  }

  return str;
}

/**
 * Detects if user wants to check company information, search a company,
 * or switch the conversation from loan eligibility to company search.
 * Extremely typo-tolerant (compny, comapny, cmpny, employer, serach, etc.).
 */
export function isCompanyInfoOrSearchIntent(text: string): boolean {
  if (!text) return false;
  const norm = text.toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim();
  if (isPureGreeting(norm) || isFinancialOrProfileInput(norm)) return false;

  // 1. Generic company search commands or typos (e.g. "company search", "company serach", "search company", "matching compies list", "matching companies list not displaying")
  if (
    /^(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach|lookup|check|find|details|info|information|list)$/i.test(norm) ||
    /^(?:search|serach|check|find|lookup|show|display|list)\s+(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)$/i.test(norm) ||
    /^(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach)\b/i.test(norm) ||
    /^(?:search|serach)\s+(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\b/i.test(norm) ||
    /\b(?:matching\s+comp(?:any|anies|ny|nay|o|a|ies)?|comp(?:any|anies|ny|nay|o|a|ies)?\s+list(?:\s+not\s+(?:displaying|showing))?|show\s+matching|display\s+matching|list\s+matching)\b/i.test(norm)
  ) {
    return true;
  }

  // Employment statements like "I work at TCS" without an inquiry are intake inputs, not search requests
  const hasInfoQuery = /(?:give(?:\s+me)?|show(?:\s+me)?|tell(?:\s+me)?|what\s+is|check|find|search|serach|details|info|information|rating|tier|category|listing|profile|about\s+(?:that|the|my|this)?\s*(?:company|employer))/i.test(norm);
  if (!hasInfoQuery && /^(?:(?:i\s*am|i'?m|i)\s+(?:working\s+)?(?:at|in|with|for)|(?:my\s+)?(?:employer|company)\s+is|(?:work|working|employed)\s+(?:at|in|by|with|for))\s+[a-zA-Z0-9]/i.test(norm)) {
    return false;
  }

  // 2. Clear inquiry patterns (e.g. "give me information of ...", "give me details of ...", "tell me about ...", "what is category of ...", "what is infosys", "is ... listed")
  if (
    /(?:give\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)\s+(?:of|about|on|for|regarding)|tell\s+me\s+about|what\s+is\s+(?:the\s+)?(?:category|tier|rating|status|details|info|information)\s+(?:of|for|on)|show\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)?\s*(?:of|about|on|for)?|info\s+(?:on|about)|details\s+(?:of|for|about))/i.test(norm)
  ) {
    return true;
  }

  if (/^(?:what\s+is|who\s+is|tell\s+me\s+about)\s+(?:the\s+)?(?:company\s+)?([a-zA-Z0-9\s&'.-]+)$/i.test(norm)) {
    const cand = norm.replace(/^(?:what\s+is|who\s+is|tell\s+me\s+about)\s+(?:the\s+)?(?:company\s+)?/i, "").replace(/[?.,!]+$/, "").trim();
    const isFinancialSideQ = /(?:cibil|credit\s*score|emi|foir|tenure|salary|income|apr|roi|interest(?:\s*rate)?|rate|reducing|balance|flat|fixed|collateral|foreclosure|prepayment|processing\s*fee|amortization|moratorium|part[\s-]*payment)\b/i.test(cand);
    if (!isFinancialSideQ && cand.length >= 2 && !isInvalidCompanyName(cand)) {
      return true;
    }
  }

  // 3. Action + company/employer (e.g. "check my compny", "show company information", "look up employer", "company search tcs", "company serach infosys")
  const verbMatch =
    /(?:check|show|tell(?:\s+me)?|view|find|search|serach|look\s*up|verify|give|display|get)\s+(?:about\s+)?(?:me\s+)?(?:my\s+)?(?:the\s+)?(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny|employer[s]?)/i.test(norm) ||
    /(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach|details|info|information|rating|tier|category|status|listing)/i.test(norm);

  // 4. Target company + company keyword (e.g. "infosys company", "tcs company", "wipro company details")
  // Dynamically detect any potential company name followed by company/employer keywords
  // without hardcoding specific company names
  if (
    /\b[a-zA-Z0-9][a-zA-Z0-9\s&'.-]{1,40}?\s+(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny|employer[s]?)\b/i.test(norm)
  ) {
    return true;
  }

  // 5. Requests & Intent phrases (e.g. "i want to check my compny information", "can we check company", "switch to company search")
  const requestMatch = /(?:(?:i\s+(?:want|need|wish|would\s+like)\s+(?:to\s+)?|can\s+(?:we|i|you)\s+|could\s+you\s+|please\s+|let'?s\s+|first\s+)(?:check|see|view|know|find|search|serach|look\s*up|get)|switch\s+to|change\s+to|go\s+to|turn\s+to)\s+(?:about\s+)?(?:my\s+)?(?:the\s+)?(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny|employer[s]?)/i.test(norm);

  // 6. Explicit check on category/tier/listing
  if (
    /(?:category|tier|rating|listing)\s+(?:of|for|in)\b/i.test(norm) ||
    /\b(?:is|are)\s+.*\s+(?:listed|categorized|approved)\b/i.test(norm)
  ) {
    return true;
  }

  // 7. Topic switch away from loan (e.g. "forget loan, show my company", "no loan, check compny")
  const loanDropMatch = /(?:forget|no|drop|stop|pause|leave)\s+(?:the\s+)?loan.*(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny|employer[s]?)/i.test(norm);

  // 8. Direct command with target company (e.g. "check mthree", "search TCS", "show Infosys")
  const actionWithTarget = norm.match(/^(?:check(?:\s+for)?|search(?:\s+for)?|serach(?:\s+for)?|show(?:\s+me)?|look\s*up|verify|tell\s+me\s+about|info\s+on)\s+([a-zA-Z0-9\s&'.-]+)$/i);
  let isActionForTarget = false;
  if (actionWithTarget) {
    const target = actionWithTarget[1].trim();
    if (target.length >= 2 && !isInvalidCompanyName(target) && !isFinancialOrProfileInput(target) && !isLocationInput(target) && !isKnownBankName(target)) {
      isActionForTarget = true;
    }
  }

  return verbMatch || requestMatch || loanDropMatch || isActionForTarget;
}

/**
 * Extracts a specific target company name from a user message if explicitly provided
 * (e.g. "check mthree" -> "mthree", "search for TCS" -> "TCS", "give me information of infosys company" -> "infosys").
 * Returns undefined if user is asking generic company search ("i want to check my compny information").
 */
export function extractTargetCompanyFromMessage(text: string): string | undefined {
  if (!text) return undefined;
  const raw = text.trim();
  if (isPureGreeting(raw) || isFinancialOrProfileInput(raw) || isKnownBankName(raw)) return undefined;

  // 1. Compound loan + company check intent
  const compound = extractCompoundLoanCompanyIntent(raw);
  if (compound.isCompound && compound.companyCandidate) {
    return compound.companyCandidate;
  }

  // 2. Employment phrase combined with company information inquiry (e.g. "I am working at TCS. Give me information about that company")
  const empWithInquiry = raw.match(
    /^(?:i\s+(?:work|working|am\s+working)\s+(?:at|in)|(?:my\s+)?(?:employer|company)\s+is|(?:work|working|employed)\s+(?:at|in|by))\s+([A-Za-z0-9\s&'-]+?)(?=\s*[.,;!?|\n]|\s+(?:and|with|but|salary|cibil|age|loan|emi|tenure|earning)\b|$)/i
  );
  if (empWithInquiry) {
    const cand = empWithInquiry[1].trim().replace(/[.,;!?]+$/, "").trim();
    if (cand.length >= 2 && !isInvalidCompanyName(cand) && !isFinancialOrProfileInput(cand) && !isLocationInput(cand) && !isKnownBankName(cand)) {
      if (/(?:information|info|details|rating|tier|category|profile|tell\s+me|show\s+me|give\s+me|check)/i.test(raw)) {
        return cand;
      }
    }
  }

  // 3. Direct clean extraction via extractCleanCompanyName
  const cleaned = extractCleanCompanyName(raw);
  if (cleaned && cleaned.length >= 2 && !isInvalidCompanyName(cleaned) && !isFinancialOrProfileInput(cleaned) && !isLocationInput(cleaned) && !isKnownBankName(cleaned)) {
    return cleaned;
  }

  return undefined;
}

/**
 * Extracts a candidate company/employer name from text.
 * Handles:
 * 1. Key-value indicators: "Company: Infosys", "Employer: Capgemini", "Org: TCS"
 * 2. Employment phrases: "work at Google", "working in Microsoft", "employed by Wipro", "my company is Accenture"
 * 3. Structured/delimited profile submissions: "Capgemini, Age 28, Salary ₹1.5 lakh..." or "TCS | 30 yrs | ..."
 * Strictly rejects financial numbers, ages, CIBIL scores, tenures, EMIs, and non-company status answers.
 */
export function extractCompanyCandidateFromText(text: string, expectedField?: string): string | undefined {
  if (!text) return undefined;
  const raw = text.trim();
  if (isKnownBankName(raw)) return undefined;
  if (isPureGreeting(raw) || isGreetingOrPleasantry(raw)) return undefined;

  // 0. Explicit company search query (e.g. "check mthree", "search TCS", "I want loan but first check mthree")
  const explicitTarget = extractTargetCompanyFromMessage(raw);
  if (explicitTarget) {
    return explicitTarget;
  }

  // 1. Explicit key-value labels or employment phrases (e.g. "I work at Infosys, but what is CIBIL?")
  const explicitMatch = raw.match(
    /(?:(?:my\s+)?(?:company|employer|organization|org)(?:\s*name)?\s*[:=-]\s*|(?:work\s+(?:at|in|with|for)|works\s+(?:at|in|with|for)|working\s+(?:at|in|with|for)|employed\s+(?:at|by|in|with|for)|(?:my\s+)?(?:company|employer)\s+is|(?:i\s*am|i'?m|i)\s+(?:working\s+)?(?:at|in|with|for))\s+)([A-Za-z0-9\s&'-]+?)(?=\s*[.,;!?|\n]|\s+(?:and|but|salary|cibil|age|loan|emi|tenure|earning)|$)/i
  );
  if (explicitMatch) {
    const candidate = explicitMatch[1].trim().replace(/[.,;!?]+$/, "").trim();
    if (candidate.length >= 2 && !isInvalidCompanyName(candidate) && !isFinancialOrProfileInput(candidate) && !isLocationInput(candidate)) {
      return candidate;
    }
  }

  // 2. Delimited segments (comma, semicolon, pipe, newline)
  // Protect number commas like 95,000 from splitting
  const unformattedNumberText = raw.replace(/(\d),(\d)/g, "$1$2");
  const segments = unformattedNumberText.split(/[,;|\n]+/).map((s) => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    for (const seg of segments) {
      const cleanSeg = seg.replace(/^(?:at|in|with)\s+/i, "").trim();
      if (
        cleanSeg.length >= 2 &&
        !isInvalidCompanyName(cleanSeg) &&
        !isFinancialOrProfileInput(cleanSeg) &&
        !isLocationInput(cleanSeg) &&
        !/^(?:i\s+need|i\s+want|can\s+i|please|hello|hi|hey|personal\s+loan|loan)\b/i.test(cleanSeg) &&
        !/^(?:age|salary|income|cibil|credit\s*score|loan|amount|tenure|months|years|emi)\s*[:=-]?\s*.*$/i.test(cleanSeg)
      ) {
        return cleanSeg;
      }
    }
  }

  // 3. Single-phrase input (e.g. user typed "Capgemini" or "Infosys Limited" or "mthree")
  if (
    expectedField !== "city" &&
    expectedField !== "cityOrPincode" &&
    expectedField !== "branchSelection" &&
    expectedField !== "location" &&
    expectedField !== "area" &&
    !isFinancialOrProfileInput(raw) &&
    !isInvalidCompanyName(raw) &&
    !isLocationInput(raw) &&
    !/^(?:i\s+need|i\s+want|can\s+i|personal\s+loan|loan)\b/i.test(raw)
  ) {
    const clean = raw
      .replace(/^(?:(?:i\s*am|i'?m|i)\s+(?:working\s+)?(?:at|in|with|for)|(?:i\s+)?(?:work|works|working|employed)\s+(?:at|in|with|for|by)|(?:my\s+)?(?:employer|company)\s+is|employer\s*[:=-]|company\s*[:=-]|at|in|with|for)\s+/i, "")
      .replace(/^(?:check(?:\s+for)?|search(?:\s+for)?|show(?:\s+me)?|view|find|verify|look\s*up|tell\s+me\s+about|info\s+on|about)\s+/i, "")
      .replace(/\s+(?:tier|rating|category|status|listing|details|info|information)$/i, "")
      .trim();
    if (!isFinancialOrProfileInput(clean) && !isInvalidCompanyName(clean) && !isLocationInput(clean) && clean.length >= 2) {
      return clean;
    }
  }

  return undefined;
}

/**
 * Maps the user's direct response to the specific expected field.
 * Guarantees that the expected field is mapped accurately and cannot contaminate other fields.
 */
function mapAnswerToTargetField(
  applicant: ApplicantProfile,
  field: string,
  text: string,
  lower: string,
  llmExtracted?: any
): void {
  // A. Monthly Income / Salary
  if (field === "monthlyIncome") {
    if (typeof llmExtracted?.monthlyIncome === "number") {
      applicant.monthlyIncome = llmExtracted.monthlyIncome;
      return;
    }
    if (/^(?:0\s*(?:rs|inr)?|rs\.?\s*0|zero|nil|none|nothing|0rs|0|no\s*income|0\s*income)$/i.test(lower)) {
      applicant.monthlyIncome = 0;
      return;
    }
    const salMatch =
      text.match(/(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|in\s*hand|nmi|nth|earning)(?::|\s*is|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|peti|hazar)?/i) ||
      text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|peti|hazar)?\s*(?:per\s*month|\/mo|monthly|take\s*home|in\s*hand|salary|income)/i) ||
      text.match(/(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|peti|hazar)?/i);
    if (salMatch) {
      const parsed = parseFinancialAmount(salMatch[1] + (salMatch[2] || ""));
      if (parsed !== null && parsed >= 0) {
        applicant.monthlyIncome = parsed;
        return;
      }
    }
    const amt = parseFinancialAmount(text);
    if (amt !== null && amt >= 0 && amt <= 50000000) {
      applicant.monthlyIncome = amt;
      return;
    }
  }

  // B. Loan Amount Needed
  if (field === "loanAmount") {
    const hasBorrowMarker = /\b(?:loan\s*(?:amount|of|need|require|want)?|need|want|borrow|require)\b/i.test(text);
    if (typeof llmExtracted?.loanAmount === "number" && llmExtracted.loanAmount >= 10000) {
      if (applicant.monthlyIncome && llmExtracted.loanAmount === applicant.monthlyIncome && !hasBorrowMarker) {
        // Skip salary contamination
      } else {
        applicant.loanAmount = llmExtracted.loanAmount;
        return;
      }
    }
    const loanMatch =
      text.match(/(?:loan\s*(?:amount|of|need|require|want)?|need|want|borrow)(?::|\s*is|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)?/i) ||
      text.match(/(?:rs\.?|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)\s*(?:loan)?/i) ||
      text.match(/(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)?/i);
    if (loanMatch) {
      const parsed = parseFinancialAmount(loanMatch[1] + (loanMatch[2] || ""));
      if (parsed && parsed >= 10000) {
        if (applicant.monthlyIncome && parsed === applicant.monthlyIncome && !hasBorrowMarker) {
          // Skip salary contamination
        } else {
          applicant.loanAmount = parsed;
          return;
        }
      }
    }
    const amt = parseFinancialAmount(text);
    if (amt && amt >= 10000) {
      if (applicant.monthlyIncome && amt === applicant.monthlyIncome && !hasBorrowMarker) {
        // Skip salary contamination
      } else {
        applicant.loanAmount = amt;
        return;
      }
    }
  }

  // C. Tenure Months
  if (field === "tenureMonths") {
    if (typeof llmExtracted?.tenureMonths === "number" && llmExtracted.tenureMonths > 0) {
      const t = llmExtracted.tenureMonths;
      applicant.tenureMonths = t <= 7 ? t * 12 : t;
      return;
    }
    const yMatch = text.match(/(\d+)\s*(?:years?|yrs?|y\b|saal|sal)/i);
    if (yMatch) {
      const y = parseInt(yMatch[1], 10);
      if (y > 0 && y <= 30) {
        applicant.tenureMonths = y * 12;
        return;
      }
    }
    const mMatch = text.match(/(\d+)\s*(?:months?|m\b)/i);
    if (mMatch) {
      const m = parseInt(mMatch[1], 10);
      if (m > 0 && m <= 360) {
        applicant.tenureMonths = m;
        return;
      }
    }
    const numMatch = text.match(/\b(\d+)\b/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num >= 1 && num <= 7) {
        applicant.tenureMonths = num * 12;
        return;
      } else if (num >= 12 && num <= 360) {
        applicant.tenureMonths = num;
        return;
      }
    }
  }

  // D. CIBIL Score
  if (field === "cibil") {
    if (typeof llmExtracted?.cibil === "number") {
      applicant.cibil = llmExtracted.cibil;
      return;
    }
    if (typeof llmExtracted?.cibil === "string" && /not\s*provided|unknown|not\s*sure|don'?t\s*know|na|n\/a/i.test(llmExtracted.cibil)) {
      applicant.cibil = "Not provided";
      return;
    }
    const cibilMatch = text.match(/\b([3-9]\d{2})\b/);
    if (cibilMatch) {
      const score = parseInt(cibilMatch[1], 10);
      if (score >= 300 && score <= 900) {
        applicant.cibil = score;
        return;
      }
    }
    if (
      /\b(?:unknown|not\s*sure|don'?t\s*know|never\s*checked|na|n\/a|no\s*idea)\b/i.test(lower) ||
      /(?:don['’]?t\s*have|never\s*had|never\s*checked|unknown|no\s*idea)\s*(?:a\s*)?(?:cibil|credit\s*score|score)/i.test(lower)
    ) {
      applicant.cibil = "Not provided";
      return;
    }
    if (/\b(?:zero|0)\b/i.test(lower)) {
      applicant.cibil = 0;
      return;
    }
  }

  // E. Existing EMI Obligations
  if (field === "existingEmi") {
    if (typeof llmExtracted?.existingEmi === "number") {
      applicant.existingEmi = llmExtracted.existingEmi;
      return;
    }
    if (
      /\b(?:no|none|nil|zero|0|nothing|nope|clear)\b/i.test(lower) ||
      /(?:no|zero|0)\s*(?:existing\s*)?emi/i.test(lower) ||
      /(?:no|zero|nil|0)\s*(?:existing\s*|ongoing\s*|current\s*)?loans?/i.test(lower) ||
      /zero\s*debt|sab\s*clear|no\s*debt/i.test(lower)
    ) {
      const parsedAmt = parseFinancialAmount(text);
      if (parsedAmt && parsedAmt > 0 && !/(?:no|zero|0|nil)\s*emi/i.test(lower)) {
        applicant.existingEmi = parsedAmt;
      } else {
        applicant.existingEmi = 0;
      }
      return;
    }
    const amt = parseFinancialAmount(text);
    if (amt !== null && amt >= 0) {
      applicant.existingEmi = amt;
      return;
    }
  }

  // F. Age
  if (field === "age") {
    if (typeof llmExtracted?.age === "number" && llmExtracted.age >= 18 && llmExtracted.age <= 85) {
      applicant.age = llmExtracted.age;
      return;
    }
    const ageMatch = text.match(/\b(1[8-9]|[2-8]\d)\b/);
    if (ageMatch) {
      const ageVal = parseInt(ageMatch[1], 10);
      if (ageVal >= 18 && ageVal <= 85) {
        applicant.age = ageVal;
        return;
      }
    }
  }

  // G. Company Name & Employment Status
  if (field === "companyName") {
    // 1. Check if user is jobless / unemployed
    if (
      llmExtracted?.employmentType === "Unemployed" ||
      /^(?:i\s+am\s+|i\s*m\s+)?(?:jobless|unemployed|no\s*job|without\s*(?:a\s*)?job|laid\s*off|not\s*working(?:\s*anywhere)?|lost\s*(?:my\s*)?job)\b/i.test(lower) ||
      /(?:not\s*working(?:\s*anywhere)?|don['’]?t\s*work|have\s*no\s*job|without\s*a?\s*job|jobless|unemployed|un-employed|lost\s*my\s*job|laid\s*off|no\s*employment)/i.test(lower)
    ) {
      applicant.employmentType = "Unemployed";
      applicant.companyName = undefined;
      applicant.monthlyIncome = 0;
      return;
    }

    // 2. Check if student
    if (
      llmExtracted?.employmentType === "Student" ||
      /^(?:i\s+am\s+|i\s*m\s+)?(?:student|in\s*college|studying)\b/i.test(lower)
    ) {
      applicant.employmentType = "Student";
      applicant.companyName = undefined;
      applicant.monthlyIncome = 0;
      return;
    }

    // 3. Check if self-employed / freelancer / business
    if (
      llmExtracted?.employmentType === "Self-Employed" ||
      /^(?:i\s+am\s+|i\s*m\s+)?(?:self[\s-]*employed|business|proprietor|partner|freelancer?|doctor|trader|consultant)\b/i.test(lower)
    ) {
      applicant.employmentType = "Self-Employed";
      applicant.companyName = "Self-Employed";
      return;
    }

    const candidate =
      llmExtracted?.companyName ||
      extractCompanyCandidateFromText(text) ||
      (!isFinancialOrProfileInput(text) && !isInvalidCompanyName(text)
        ? text
            .replace(/^(?:(?:i\s*am|i'?m|i)\s+(?:working\s+)?(?:at|in|with|for)|(?:i\s+)?(?:work|works|working|employed)\s+(?:at|in|with|for|by)|(?:my\s+)?(?:employer|company)\s+is|employer\s*[:=-]|company\s*[:=-]|at|in|with|for)\s+/i, "")
            .trim()
        : undefined);
    if (candidate && !isInvalidCompanyName(candidate) && !isFinancialOrProfileInput(candidate)) {
      applicant.companyName = normalizeCompanyName(candidate);
      if (!applicant.employmentType) {
        applicant.employmentType = "Salaried";
      }
    }
  }
}

/**
 * Verifies whether the user's message explicitly mentions or targets a specific parameter.
 * Used to ensure we never invent, default, or extract parameters not genuinely stated by the user.
 */
export function messageMentionsField(field: string, text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  switch (field) {
    case "monthlyIncome":
    case "salary":
      return /(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|in\s*hand|nmi|nth|earning|earns?|makes?|\/mo|per\s*month|hazar)/i.test(lower);

    case "loanAmount":
      return (
        /(?:loan\s*(?:amount|ticket|size|of|need|require|want)?|borrow|ticket|need|require|want)/i.test(lower) &&
        /(?:rs\.?|₹|\d+\s*(?:k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka))/i.test(lower)
      ) || /(?:rs\.?|₹)\s*\d+/i.test(lower) || /\b\d+\s*(?:lakhs?|lacs?|l\b|cr|crores?|peti|khoka)\s+(?:loan|borrow)/i.test(lower);

    case "cibil":
      return (
        /(?:cibil|credit\s*score|score\b|bureau)/i.test(lower) ||
        (/\b[3-9]\d{2}\b/.test(lower) && /(?:cibil|score|credit)/i.test(lower))
      );

    case "tenureMonths":
    case "tenure":
      return (
        /(?:tenure|duration|term|period)/i.test(lower) ||
        /\b\d{1,2}\s*(?:years?|yrs?|saal|sal|months?)\b/i.test(lower) ||
        /\b[1-7]\s*(?:y|yr|years?|saal|sal)\b(?!\s*old)/i.test(lower)
      );

    case "existingEmi":
    case "emi":
      return (
        /(?:existing|current|other|ongoing)?\s*emi(?:s)?/i.test(lower) ||
        /(?:no|zero|nil|0)\s*(?:existing\s*)?emi(?:s)?/i.test(lower) ||
        /(?:no|zero|nil|0)\s*(?:existing\s*|ongoing\s*|current\s*)?loans?/i.test(lower) ||
        /(?:no|zero|nil|0)\s*(?:obligations?|debt)/i.test(lower) ||
        /sab\s*clear/i.test(lower) ||
        /paying\s*(?:rs\.?|₹)?\s*\d+\s*(?:as)?\s*emi/i.test(lower)
      );

    case "age":
      return (
        /(?:age|aged)\b/i.test(lower) ||
        /\b(?:years?\s*old|yr\s*old)\b/i.test(lower) ||
        /(?:i\s*am|i'?m)\s+\d{2}\b/i.test(lower)
      );

    case "employmentType":
      return /(?:salaried|self[\s-]*employed|business|proprietor|partner|freelanc|doctor|trader|govt|government|private|pvt\s*ltd|mnc|corporate|job|employee)/i.test(lower);

    case "companyName":
      return (
        /(?:work\s+(?:at|in|with|for)|works\s+(?:at|in|with|for)|working\s+(?:at|in|with|for)|employed\s+(?:at|by|in|with|for)|(?:i\s*am|i'?m|i)\s+(?:working\s+)?(?:at|in|with|for)|my\s+company\s+is|employer\s+is|company|firm|employer)\b/i.test(lower) ||
        Boolean(extractCompanyCandidateFromText(text))
      );

    default:
      return false;
  }
}

/**
 * Extracts any secondary/additional parameters explicitly mentioned in the user message or by the LLM.
 * Strictly preserves all already collected values.
 * Never extracts or sets any parameter unless the user's message explicitly mentions that parameter.
 */
export function extractSecondaryParameters(
  applicant: ApplicantProfile,
  text: string,
  lower: string,
  targetExpectedField?: string,
  llmExtracted?: any
): void {
  // 1. Monthly Income (ONLY if not targetExpectedField, not already set, AND explicitly mentioned)
  if (
    targetExpectedField !== "monthlyIncome" &&
    applicant.monthlyIncome === undefined &&
    messageMentionsField("monthlyIncome", text)
  ) {
    if (typeof llmExtracted?.monthlyIncome === "number") {
      applicant.monthlyIncome = llmExtracted.monthlyIncome;
    } else if (/zero\s*income|0\s*salary|no\s*salary|no\s*income|0rs|rs\.?\s*0|nil\s*salary/i.test(lower)) {
      applicant.monthlyIncome = 0;
    } else {
      const salMatch =
        text.match(/(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|in\s*hand|nmi|nth|earning|earns?|makes?)(?::|\s*is|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|peti|hazar)?/i) ||
        text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|peti|hazar)?\s*(?:per\s*month|\/mo|monthly|take\s*home|in\s*hand|salary|income)/i);
      if (salMatch) {
        const amt = parseFinancialAmount(salMatch[1] + (salMatch[2] || ""));
        if (amt !== null && amt >= 0 && amt <= 50000000) {
          applicant.monthlyIncome = amt;
        }
      }
    }
  }

  // 2. Loan Amount (ONLY if not targetExpectedField, not already set, AND explicitly mentioned)
  if (
    targetExpectedField !== "loanAmount" &&
    (applicant.loanAmount === undefined || (typeof applicant.loanAmount === "number" && applicant.loanAmount <= 0)) &&
    messageMentionsField("loanAmount", text)
  ) {
    if (typeof llmExtracted?.loanAmount === "number" && llmExtracted.loanAmount >= 10000) {
      applicant.loanAmount = llmExtracted.loanAmount;
    } else {
      const loanMatch =
        text.match(/(?:loan\s*(?:amount|of|need|require|want)?|need|want|borrow|require)\s*(?:a\s*)?(?::|\s*is|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)?/i) ||
        text.match(/(?:rs\.?|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)\s*(?:personal\s*)?(?:loan)?/i) ||
        text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|cr|crores?|peti|khoka)\s+(?:personal\s*)?(?:loan|borrow)/i);
      if (loanMatch) {
        const amt = parseFinancialAmount(loanMatch[1] + (loanMatch[2] || ""));
        if (amt && amt >= 10000) {
          applicant.loanAmount = amt;
        }
      }
    }
  }

  // 3. CIBIL Score (ONLY if not targetExpectedField, not already set, AND explicitly mentioned)
  if (
    targetExpectedField !== "cibil" &&
    applicant.cibil === undefined &&
    messageMentionsField("cibil", text)
  ) {
    if (typeof llmExtracted?.cibil === "number" && ((llmExtracted.cibil >= 300 && llmExtracted.cibil <= 900) || llmExtracted.cibil === 0)) {
      applicant.cibil = llmExtracted.cibil;
    } else if (typeof llmExtracted?.cibil === "string" && /not\s*provided|unknown|not\s*sure|don'?t\s*know/i.test(llmExtracted.cibil)) {
      applicant.cibil = "Not provided";
    } else {
      const cibilMatch =
        text.match(/(?:cibil|credit\s*score|score)(?::|\s*is|\s*=)?\s*(?:of)?\s*(\d{3})\b/i) ||
        text.match(/\b(\d{3})\b\s*(?:cibil|credit\s*score)/i);
      if (cibilMatch) {
        const val = parseInt(cibilMatch[1], 10);
        if (val >= 300 && val <= 900) {
          applicant.cibil = val;
        }
      } else if (
        /(?:don['’]?t\s*have|never\s*had|never\s*checked|unknown|no\s*idea)\s*(?:a\s*)?(?:cibil|credit\s*score|score|credit\s*history)/i.test(lower) ||
        /(?:cibil|credit\s*score|score)\s*(?:is\s*)?(?:unknown|not\s*sure|don'?t\s*know|never\s*checked|not\s*generated)/i.test(lower)
      ) {
        applicant.cibil = "Not provided";
      } else if (/\b(?:zero|0)\s*(?:cibil|credit)/i.test(lower)) {
        applicant.cibil = 0;
      }
    }
  }

  // 4. Tenure Months (ONLY if not targetExpectedField, not already set, AND explicitly mentioned)
  if (
    targetExpectedField !== "tenureMonths" &&
    (applicant.tenureMonths === undefined || (typeof applicant.tenureMonths === "number" && applicant.tenureMonths <= 0)) &&
    messageMentionsField("tenureMonths", text)
  ) {
    if (typeof llmExtracted?.tenureMonths === "number" && llmExtracted.tenureMonths > 0) {
      applicant.tenureMonths = llmExtracted.tenureMonths;
    } else {
      const tenureMatch =
        text.match(/(?:tenure|duration|term|period|for)(?::|\s*is|\s*=)?\s*(\d{1,2})\s*(years?|yrs?|saal|sal|months?|m\b|y\b)\b/i) ||
        text.match(/\b([1-7])\s*(years?|yrs?|saal|sal)\b(?!\s*old)/i) ||
        text.match(/\b(\d{2})\s*(months?)\b/i);
      if (tenureMatch) {
        const num = parseInt(tenureMatch[1], 10);
        const unit = (tenureMatch[2] || "").toLowerCase();
        if (unit.startsWith("y") || unit.startsWith("s") || (!unit.startsWith("m") && num <= 7)) {
          applicant.tenureMonths = num * 12;
        } else {
          applicant.tenureMonths = num;
        }
      }
    }
  }

  // 5. Existing EMI Obligations (ONLY if not targetExpectedField, not already set, AND explicitly mentioned)
  if (
    targetExpectedField !== "existingEmi" &&
    applicant.existingEmi === undefined &&
    messageMentionsField("existingEmi", text)
  ) {
    if (typeof llmExtracted?.existingEmi === "number" && llmExtracted.existingEmi >= 0) {
      applicant.existingEmi = llmExtracted.existingEmi;
    } else {
      const emiMatch =
        text.match(/(?:existing|current|other|ongoing)?\s*emi(?:s)?(?::|\s*is|\s*of|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i) ||
        text.match(/paying\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*)\s*(?:as)?\s*emi/i);
      if (emiMatch) {
        const amt = parseFinancialAmount(emiMatch[1] + (emiMatch[2] || ""));
        if (amt !== null && amt >= 0) applicant.existingEmi = amt;
      } else if (/no\s*(?:existing\s*)?emi|0\s*emi|zero\s*emi|no\s*loans|zero\s*debt|sab\s*clear|no\s*debt/i.test(lower)) {
        applicant.existingEmi = 0;
      }
    }
  }

  // 6. Applicant Age (ONLY if not targetExpectedField, not already set, AND explicitly mentioned)
  if (
    targetExpectedField !== "age" &&
    (applicant.age === undefined || (typeof applicant.age === "number" && applicant.age <= 0)) &&
    messageMentionsField("age", text)
  ) {
    if (typeof llmExtracted?.age === "number" && llmExtracted.age >= 18 && llmExtracted.age <= 85) {
      applicant.age = llmExtracted.age;
    } else {
      const ageMatch =
        text.match(/(?:age|aged|i'?m|i\s*am)(?::|\s*is|\s*=)?\s*(\d{2})\b/i) ||
        text.match(/\b(\d{2})\s*(?:years?\s*old|yr\s*old)\b/i);
      if (ageMatch) {
        const ageVal = parseInt(ageMatch[1], 10);
        if (ageVal >= 18 && ageVal <= 85) {
          applicant.age = ageVal;
        }
      }
    }
  }

  // 7. Employment Type (ONLY if not already set AND explicitly mentioned or implied)
  if (!applicant.employmentType) {
    if (llmExtracted?.employmentType) {
      applicant.employmentType = llmExtracted.employmentType;
      if (applicant.employmentType === "Unemployed" && applicant.monthlyIncome === undefined) {
        applicant.monthlyIncome = 0;
      }
    } else if (/jobless|unemployed|no\s*job|without\s*(?:a\s*)?job|not\s*working|laid\s*off/i.test(lower)) {
      applicant.employmentType = "Unemployed";
      if (applicant.monthlyIncome === undefined) applicant.monthlyIncome = 0;
    } else if (/student|in\s*college|studying/i.test(lower)) {
      applicant.employmentType = "Student";
      if (applicant.monthlyIncome === undefined) applicant.monthlyIncome = 0;
    } else if (/salaried|govt|government|private|pvt\s*ltd|mnc|corporate|job|employee/i.test(lower)) {
      applicant.employmentType = "Salaried";
    } else if (/self\s*employed|business|proprietor|partner|freelanc|doctor|trader/i.test(lower)) {
      applicant.employmentType = "Self-Employed";
    }
  }

  // 8. Company Name (ONLY if not targetExpectedField, not already set, AND explicitly mentioned)
  if (
    targetExpectedField !== "companyName" &&
    !applicant.companyName &&
    applicant.employmentType !== "Unemployed" &&
    applicant.employmentType !== "Student" &&
    messageMentionsField("companyName", text)
  ) {
    if (llmExtracted?.companyName && !isInvalidCompanyName(llmExtracted.companyName) && !isFinancialOrProfileInput(llmExtracted.companyName)) {
      applicant.companyName = normalizeCompanyName(llmExtracted.companyName);
    } else {
      const cand = extractCompanyCandidateFromText(text);
      if (cand && !isInvalidCompanyName(cand) && !isFinancialOrProfileInput(cand)) {
        applicant.companyName = normalizeCompanyName(cand);
      }
    }
  }

  // 9. Location & Pincode (if mentioned, strictly guarding against financial amounts)
  const isFinancialField =
    targetExpectedField === "loanAmount" ||
    targetExpectedField === "monthlyIncome" ||
    targetExpectedField === "existingEmi" ||
    targetExpectedField === "cibil" ||
    targetExpectedField === "age" ||
    targetExpectedField === "tenureMonths";

  const pinMatch = text.match(/\b([1-9]\d{5})\b/);
  if (pinMatch && !applicant.pincode && !isFinancialField) {
    const candPin = pinMatch[1];
    const isFinancialValue =
      candPin === String(applicant.loanAmount) ||
      candPin === String(applicant.monthlyIncome) ||
      candPin === String(applicant.existingEmi);

    if (isValidIndianPincode(candPin) && !isFinancialValue) {
      applicant.pincode = candPin;
      const resolvedCity = resolvePincodeToCity(candPin);
      if (resolvedCity && !applicant.location) {
        applicant.location = resolvedCity;
      }
    }
  }

  const cityMatch = text.match(/\b(?:in|at|from|city\s*(?:is|:)?|based\s*in|live\s*in|stay\s*in)\s+([a-zA-Z\s]+)/i);
  if (cityMatch && !applicant.location) {
    const rawCity = cityMatch[1].trim().split(/\s*[,.]|\s+(?:and|with|for)\s+/)[0].trim();
    if (rawCity.length >= 2 && rawCity.length <= 30 && !/^\d+$/.test(rawCity) && !/^(?:bank|loan|personal|finance|ltd|limited)\b/i.test(rawCity)) {
      applicant.location = rawCity;
    }
  }

  // Ensure loanAmount or other financial numbers never contaminate location or pincode
  if (applicant.pincode && (!isValidIndianPincode(applicant.pincode) || applicant.pincode === String(applicant.loanAmount) || applicant.pincode === String(applicant.monthlyIncome))) {
    applicant.pincode = undefined;
  }
  if (applicant.location && (/^\d+$/.test(applicant.location) || applicant.location === String(applicant.loanAmount) || applicant.location === String(applicant.monthlyIncome))) {
    applicant.location = undefined;
  }
}

/**
 * Dynamically extracts all financial and profile parameters from user text.
 * Robust to typos, short forms ("75k", "5L", "3 yrs", "none"), and context.
 * Strictly preserves all collected values and maps responses to the expected field first.
 */
export function extractApplicantDetails(
  message: string,
  existing: ApplicantProfile = {},
  missingContext: string[] = [],
  llmExtracted?: any,
  lastField?: string
): ApplicantProfile {
  const applicant: ApplicantProfile = { ...existing };
  const text = String(message || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const targetExpectedField = missingContext.length > 0 ? missingContext[0] : undefined;

  // 0. Detect side questions mid-flow and save for the response generator
  const sideQ = detectAndAnswerSideQuestion(text, targetExpectedField);
  if (sideQ.isQuestion && sideQ.answer) {
    applicant._lastSideQuestion = sideQ.answer;
  } else {
    delete applicant._lastSideQuestion;
  }

  // 0a. Detect parameter corrections ("actually my salary is 95000 not 80k", "wait, CIBIL is 740", "my bad tenure is 4 years")
  const correction = detectCorrectionInMessage(text, applicant, lastField);
  if (correction.isCorrection && correction.field && correction.value !== undefined) {
    (applicant as any)[correction.field] = correction.value;
    if (correction.field === "companyName") {
      applicant.employmentType = "Salaried";
    }
    applicant._lastCorrectionNotice = correction.explanation;
  } else {
    delete applicant._lastCorrectionNotice;
  }

  // 0b. Detect loan intent first and set loanType if not already set
  const detectedIntent = detectLoanIntent(text);
  if (detectedIntent.isLoanIntent && !applicant.loanType) {
    applicant.loanType = detectedIntent.loanType || "Personal Loan";
  }

  // 0c. Detect unemployed status from user text or LLM extraction
  const isUnemployedCheck =
    llmExtracted?.employmentStatus === "unemployed" ||
    llmExtracted?.employmentType === "Unemployed" ||
    /(?:not\s*working(?:\s*anywhere)?|don['’]?t\s*work|have\s*no\s*job|without\s*a?\s*job|jobless|unemployed|un-employed|lost\s*(?:my\s*)?job|laid\s*off|no\s*employment|no\s*job\s*right\s*now)/i.test(lower);

  if (isUnemployedCheck) {
    applicant.employmentStatus = "unemployed";
    applicant.employmentType = "Unemployed";
    applicant.monthlyIncome = 0;
    applicant.companyName = undefined;
  }

  // 0d. If LLM provided extracted entities, merge them safely
  if (llmExtracted) {
    if (llmExtracted.employmentStatus) {
      applicant.employmentStatus = llmExtracted.employmentStatus;
    }
    if (llmExtracted.employmentType) {
      applicant.employmentType = llmExtracted.employmentType;
      if (applicant.employmentType === "Unemployed") {
        applicant.employmentStatus = "unemployed";
        applicant.monthlyIncome = 0;
      }
    }
    if (
      typeof llmExtracted.monthlyIncome === "number" &&
      (applicant.monthlyIncome === undefined || targetExpectedField === "monthlyIncome" || messageMentionsField("monthlyIncome", text))
    ) {
      applicant.monthlyIncome = llmExtracted.monthlyIncome;
    }
    if (
      typeof llmExtracted.loanAmount === "number" && llmExtracted.loanAmount > 0 &&
      (applicant.loanAmount === undefined || targetExpectedField === "loanAmount" || messageMentionsField("loanAmount", text))
    ) {
      applicant.loanAmount = llmExtracted.loanAmount;
    }
    if (
      typeof llmExtracted.tenureMonths === "number" && llmExtracted.tenureMonths > 0 &&
      (applicant.tenureMonths === undefined || targetExpectedField === "tenureMonths" || messageMentionsField("tenureMonths", text))
    ) {
      applicant.tenureMonths = llmExtracted.tenureMonths;
    }
    if (
      typeof llmExtracted.cibil === "number" &&
      (applicant.cibil === undefined || targetExpectedField === "cibil" || messageMentionsField("cibil", text))
    ) {
      applicant.cibil = llmExtracted.cibil;
    }
    if (
      typeof llmExtracted.existingEmi === "number" &&
      (applicant.existingEmi === undefined || targetExpectedField === "existingEmi" || messageMentionsField("existingEmi", text))
    ) {
      applicant.existingEmi = llmExtracted.existingEmi;
    }
    if (
      typeof llmExtracted.age === "number" && llmExtracted.age >= 18 &&
      (applicant.age === undefined || targetExpectedField === "age" || messageMentionsField("age", text))
    ) {
      applicant.age = llmExtracted.age;
    }
    const hasExplicitCompanyInText =
      /(?:(?:change|update|correct)\s+(?:my\s+)?(?:company|employer)|(?:work\s+at|works\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is)|(?:company|employer)\s*[:=-])/i.test(text);

    if (
      llmExtracted.companyName &&
      !isInvalidCompanyName(llmExtracted.companyName) &&
      !isFinancialOrProfileInput(llmExtracted.companyName) &&
      (!applicant.companyName || targetExpectedField === "companyName" || hasExplicitCompanyInText)
    ) {
      applicant.companyName = normalizeCompanyName(llmExtracted.companyName);
      if (!applicant.employmentType) applicant.employmentType = "Salaried";
    }
  }

  // 1. Detect if the message explicitly targets a different field than what was expected
  // (Prevents blind field mapping when user provides tenure instead of salary, or age instead of EMI)
  const explicitTarget = detectTargetedFieldInMessage(text, targetExpectedField);
  const effectiveTarget = explicitTarget || targetExpectedField;

  // 2. Map answer to target field (skip if message is purely a side question without any profile answer)
  const hasAnswerData =
    /\d+/.test(text) ||
    /^(?:no|none|nil|zero|0|clear|nothing|nope|salaried|jobless|unemployed|student|self[\s-]*employed)\b/i.test(lower);

  if (
    effectiveTarget &&
    (!sideQ.isQuestion || hasAnswerData) &&
    (!correction.isCorrection || correction.field !== effectiveTarget)
  ) {
    mapAnswerToTargetField(applicant, effectiveTarget, text, lower, llmExtracted);
  }

  // 3. Extract any secondary parameters provided in the same message, preserving existing values
  extractSecondaryParameters(applicant, text, lower, effectiveTarget, llmExtracted);

  return applicant;
}

/**
 * Detects whether the user is confirming or agreeing to proceed.
 */
export function isConfirmationMessage(text: string): boolean {
  const norm = String(text || "").trim().toLowerCase();
  return /^(?:ok|okay|sure|proceed|yes|yep|yeah|continue|go\s*ahead|all\s*good|fine|understood|got\s*it|confirm|sounds\s*good|let['’]?s\s*continue|next)\b/i.test(norm);
}

/**
 * Analyzes the full multi-turn conversation history across all turns and the current user message,
 * extracting and merging all known applicant details, respecting chronological corrections,
 * handling employment status and credit history, and guaranteeing no already-provided information is lost or re-asked.
 */
export function consolidateApplicantProfileFromHistory(
  conversationHistory: Array<{ role: string; content: string }> | undefined,
  currentMessage: string,
  existingApplicant?: ApplicantProfile,
  currentExtracted?: any
): ApplicantProfile {
  let applicant: ApplicantProfile = {
    loanType: "Personal Loan",
    ...(existingApplicant || {}),
  };

  // Collect user messages in chronological order
  const userMessages: string[] = [];
  if (conversationHistory && conversationHistory.length > 0) {
    for (const turn of conversationHistory) {
      if ((turn.role === "user" || turn.role === "human") && turn.content && turn.content.trim()) {
        userMessages.push(turn.content.trim());
      }
    }
  }

  const trimmedCurrent = String(currentMessage || "").trim();
  if (trimmedCurrent) {
    const lastUserMsg = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
    if (lastUserMsg !== trimmedCurrent) {
      userMessages.push(trimmedCurrent);
    }
  }

  let lastAnsweredField: string | undefined = undefined;

  // Iterate chronologically through user messages
  for (let i = 0; i < userMessages.length; i++) {
    const msg = userMessages[i];
    const isLatest = i === userMessages.length - 1;
    const extractedForTurn = isLatest ? currentExtracted : undefined;
    const lower = msg.toLowerCase().trim();

    // 1. Employment type checks
    if (
      /(?:not\s*working|no\s*job|without\s*a?\s*job|jobless|unemployed|un-employed|lost\s*my\s*job|laid\s*off|no\s*employment|don['’]?t\s*work)/i.test(lower) ||
      extractedForTurn?.employmentStatus === "unemployed" ||
      extractedForTurn?.employmentType === "Unemployed"
    ) {
      applicant.employmentStatus = "unemployed";
      applicant.employmentType = "Unemployed";
      applicant.monthlyIncome = 0;
      applicant.companyName = undefined;
    } else if (/\b(?:student|in\s*college|studying)\b/i.test(lower) || extractedForTurn?.employmentStatus === "student" || extractedForTurn?.employmentType === "Student") {
      applicant.employmentStatus = "student";
      applicant.employmentType = "Student";
      applicant.monthlyIncome = 0;
      applicant.companyName = undefined;
    } else if (/\b(?:self[\s-]*employed|business|proprietor|partner|freelancer?|doctor|trader|consultant)\b/i.test(lower) || extractedForTurn?.employmentStatus === "self-employed" || extractedForTurn?.employmentType === "Self-Employed") {
      applicant.employmentStatus = "self-employed";
      applicant.employmentType = "Self-Employed";
      applicant.companyName = "Self-Employed";
    } else if (extractedForTurn?.employmentStatus === "salaried" || extractedForTurn?.employmentType === "Salaried") {
      applicant.employmentStatus = "salaried";
      applicant.employmentType = "Salaried";
    }

    // 2. Company name candidate extraction
    // NEVER extract company candidate from a message that is a parameter correction or financial input!
    const isCorrectionMsg = detectCorrectionInMessage(msg, applicant, lastAnsweredField).isCorrection;
    const isExplicitCompanyChange = /(?:(?:change|update|correct)\s+(?:my\s+)?(?:company|employer)|\b(?:switch\s+to)\s+([A-Za-z0-9&'.-]+))/i.test(msg);
    const hasExplicitCompanyInTurn =
      !isCorrectionMsg &&
      (isExplicitCompanyChange ||
        /(?:(?:work\s+(?:at|in|with|for)|works\s+(?:at|in|with|for)|working\s+(?:at|in|with|for)|employed\s+(?:at|by|in|with|for)|(?:i\s*am|i['"]?m|i)\s+(?:working\s+)?(?:at|in|with|for)|my\s+company\s+is|employer\s+is)|(?:company|employer)\s*[:=-])/i.test(msg));

    const hasEstablishedCanonicalCompany = Boolean(
      existingApplicant?.companyName &&
      !isExplicitCompanyChange &&
      !isLatest
    );

    if ((!applicant.companyName || (hasExplicitCompanyInTurn && !hasEstablishedCanonicalCompany)) && !isCorrectionMsg) {
      if (applicant.employmentType !== "Unemployed" && applicant.employmentType !== "Student" && applicant.employmentType !== "Self-Employed") {
        const compCandidate = extractCompanyCandidateFromText(msg);
        if (compCandidate && !isInvalidCompanyName(compCandidate) && !isFinancialOrProfileInput(compCandidate) && !isFinancialOrProfileInput(msg)) {
          applicant.companyName = compCandidate;
          if (!applicant.employmentType) applicant.employmentType = "Salaried";
          lastAnsweredField = "companyName";
        }
      }
    }

    // 3. Extract details and handle corrections
    const prevIncome = applicant.monthlyIncome;
    const prevLoan = applicant.loanAmount;
    const prevCibil = applicant.cibil;
    const prevTenure = applicant.tenureMonths;
    const prevEmi = applicant.existingEmi;
    const prevAge = applicant.age;
    const prevComp = applicant.companyName;

    const missingForTurn = getRequiredPolicyFields(applicant);
    applicant = extractApplicantDetails(msg, applicant, missingForTurn, extractedForTurn, lastAnsweredField);

    if (applicant.monthlyIncome !== prevIncome && applicant.monthlyIncome !== undefined) lastAnsweredField = "monthlyIncome";
    else if (applicant.loanAmount !== prevLoan && applicant.loanAmount !== undefined) lastAnsweredField = "loanAmount";
    else if (applicant.cibil !== prevCibil && applicant.cibil !== undefined) lastAnsweredField = "cibil";
    else if (applicant.tenureMonths !== prevTenure && applicant.tenureMonths !== undefined) lastAnsweredField = "tenureMonths";
    else if (applicant.existingEmi !== prevEmi && applicant.existingEmi !== undefined) lastAnsweredField = "existingEmi";
    else if (applicant.age !== prevAge && applicant.age !== undefined) lastAnsweredField = "age";
    else if (applicant.companyName !== prevComp && applicant.companyName !== undefined) lastAnsweredField = "companyName";
  }

  return applicant;
}

/**
 * Dynamically determines which fields are required based on active bank Master Policy rules.
 * Inspects all active partner bank rules for the applicant's company category.
 * Strictly avoids hardcoded question sequences or default values.
 */
export function getRequiredPolicyFields(
  applicant: ApplicantProfile,
  companyMatch?: CompanyCategoryMatch,
  loanType: string = "Personal Loan"
): string[] {
  // If applicant is unemployed, they do not meet active employment requirements for unsecured personal loans.
  if (
    applicant.employmentStatus === "unemployed" ||
    applicant.employmentType === "Unemployed" ||
    (applicant.monthlyIncome === 0 && applicant.employmentType !== "Salaried")
  ) {
    return ["employmentStatus"];
  }

  // 1. Employer / Company Name is strictly required first for salaried personal loans
  if (applicant.employmentType === "Student" || applicant.employmentType === "Self-Employed") {
    // Students and self-employed applicants do not have corporate salaried employers
  } else if (!applicant.companyName || applicant.companyName.trim().length === 0) {
    return ["companyName"];
  }

  // 2. Active bank policy rules evaluation:
  // For loan eligibility evaluation, all 6 financial & profile parameters are required:
  // monthlyIncome, loanAmount, tenureMonths, cibil, existingEmi, age.
  const requiredFields = [
    "monthlyIncome",
    "loanAmount",
    "tenureMonths",
    "cibil",
    "age",
    "existingEmi",
  ];

  // Filter out any fields that the user has already provided in this chat
  const missing: string[] = [];
  for (const field of requiredFields) {
    if (
      field === "monthlyIncome" &&
      (applicant.monthlyIncome === undefined || applicant.monthlyIncome === null)
    ) {
      missing.push("monthlyIncome");
    } else if (
      field === "loanAmount" &&
      (applicant.loanAmount === undefined || applicant.loanAmount === null || (typeof applicant.loanAmount === "number" && applicant.loanAmount <= 0))
    ) {
      missing.push("loanAmount");
    } else if (
      field === "tenureMonths" &&
      (applicant.tenureMonths === undefined || applicant.tenureMonths === null || (typeof applicant.tenureMonths === "number" && applicant.tenureMonths <= 0))
    ) {
      missing.push("tenureMonths");
    } else if (
      field === "cibil" &&
      (applicant.cibil === undefined || applicant.cibil === null)
    ) {
      missing.push("cibil");
    } else if (
      field === "age" &&
      (applicant.age === undefined || applicant.age === null || (typeof applicant.age === "number" && applicant.age <= 0))
    ) {
      missing.push("age");
    } else if (
      field === "existingEmi" &&
      (applicant.existingEmi === undefined || applicant.existingEmi === null)
    ) {
      missing.push("existingEmi");
    }
  }

  return missing;
}

/**
 * Backward-compatible alias for getRequiredPolicyFields
 */
export function getMissingRequiredFields(applicant: ApplicantProfile): string[] {
  return getRequiredPolicyFields(applicant);
}

/**
 * Removes thinking tags and preamble from LLM outputs.
 */
function stripReasoningPreamble(text: string): string {
  if (!text) return "";
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^Here('s| is) a thinking process[\s\S]*?\n\n/i, "")
    .replace(/^(?:\*{1,2}|#+\s*)?(?:Thinking Process|Thought Process|Analysis|Chain of thought)(?:\*{1,2}|:)?[\s\S]*?\n\n/i, "")
    .replace(/^(?:\d+\.\s+)?\*\*(?:Analyze User Input|Analysis|Drafting response)\*\*[\s\S]*?\n\n/i, "")
    .trim();

  // If response has an explicit "**Response:**" or "Assistant:" label after thoughts
  const respMatch = cleaned.match(/(?:^|\n\n)(?:\*{1,2}|#+\s*)?(?:Response|Final Response|Message to User)(?:\*{1,2}|:)?\s*\n+([\s\S]+)$/i);
  if (respMatch) {
    cleaned = respMatch[1].trim();
  }

  // Also strip any leading analysis numbered points like "1. **Analyze User Input:**\n ... \n\n"
  cleaned = cleaned.replace(/^(?:\d+\.\s+)?\*\*[^*]+\*\*:\s*\n(?:\s*[-*]\s*[^\n]+\n)+\n*/i, "").trim();

  return cleaned;
}

/**
 * Checks whether the applicant's known details make them definitively ineligible
 * across partner banks (e.g. unemployed/jobless, zero income, or underage).
 */
export interface DefinitiveIneligibilityResult {
  isIneligible: boolean;
  reasonType?: "UNEMPLOYED_OR_ZERO_INCOME" | "MINIMUM_AGE" | "MAXIMUM_AGE";
  explanationSnippet?: string;
}

export function checkDefinitiveIneligibility(
  applicant: ApplicantProfile
): DefinitiveIneligibilityResult {
  // 1. Unemployed, Jobless, or Zero / severely insufficient income
  if (
    applicant.employmentType === "Unemployed" ||
    (applicant.monthlyIncome !== undefined && applicant.monthlyIncome !== null && typeof applicant.monthlyIncome === "number" && applicant.monthlyIncome < 10000)
  ) {
    return {
      isIneligible: true,
      reasonType: "UNEMPLOYED_OR_ZERO_INCOME",
      explanationSnippet:
        "Partner bank policies require active monthly employment and regular verifiable salary to verify loan repayment capacity for unsecured personal loans.",
    };
  }

  // 2. Underage (< 18)
  if (applicant.age !== undefined && applicant.age !== null && typeof applicant.age === "number" && applicant.age < 18) {
    return {
      isIneligible: true,
      reasonType: "MINIMUM_AGE",
      explanationSnippet:
        "Partner bank policies require applicants to be of legal age of majority (minimum 18 to 21 years depending on lender).",
    };
  }

  // 3. Beyond maximum age (> 70)
  if (applicant.age !== undefined && applicant.age !== null && typeof applicant.age === "number" && applicant.age > 70) {
    return {
      isIneligible: true,
      reasonType: "MAXIMUM_AGE",
      explanationSnippet:
        "Applicant age exceeds maximum permissible policy limits at loan maturity across partner banks.",
    };
  }

  return { isIneligible: false };
}

/**
 * Uses the LLM to generate a natural, conversational explanation when an applicant
 * is definitively ineligible, using the full conversation context and mentioning only
 * reasons returned by the policies.
 */
export async function generateDefinitiveIneligibilityExplanationWithLLM(
  applicant: ApplicantProfile,
  reason: DefinitiveIneligibilityResult,
  userMessage?: string,
  modelOverride?: string,
  conversationHistory?: { role: string; content: string }[]
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  const model = modelOverride || process.env.OPENROUTER_MODEL || OPENROUTER_MODEL || "openrouter/auto";

  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const systemPrompt =
        "You are CreditWise AI, a helpful, intelligent financial assistant having a natural, realistic conversation with a user.\n" +
        "The applicant is inquiring about or applying for a personal loan, but based on the official policies of our partner banks, they are currently NOT ELIGIBLE under their current profile.\n\n" +
        "CRITICAL INSTRUCTIONS:\n" +
        "- Generate a completely natural, conversational, human response using the full conversation context.\n" +
        "- Do NOT use fixed phrases, canned headings (do NOT include '### ℹ️ Personal Loan Eligibility Assessment' or any markdown headers), rigid bullet points, or canned paragraphs.\n" +
        "- Do NOT provide hardcoded alternatives unless the user specifically asks for options.\n" +
        "- Only mention reasons actually returned by the eligibility engine/policies.\n" +
        "- Keep the response concise, natural, empathetic, and human (1 to 2 short conversational paragraphs).\n" +
        "- Never mention internal code, database tables, or backend systems.";

      const messages: any[] = [
        { role: "system", content: systemPrompt },
      ];

      if (conversationHistory && conversationHistory.length > 0) {
        const relevantHistory = conversationHistory.slice(-6);
        for (const msg of relevantHistory) {
          if (msg.role === "user" || msg.role === "assistant") {
            messages.push({ role: msg.role, content: msg.content });
          }
        }
      }

      messages.push({
        role: "user",
        content:
          `The user's latest message: "${userMessage || ""}".\n` +
          `Applicant profile: ${JSON.stringify(applicant)}.\n` +
          `Policy evaluation reason: ${reason.explanationSnippet || "Policy criteria not met."}\n\n` +
          `Respond naturally and conversationally explaining the outcome based on the policies.`,
      });

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
          max_tokens: 300,
          temperature: 0.3,
          messages,
        }),
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        if (content && typeof content === "string" && content.trim().length > 15) {
          return stripReasoningPreamble(content.trim());
        }
      }
    } catch (e) {
      // Fall through to fallback
    }
  }

  // Fallback explanation if LLM is unavailable
  const specificReason = reason.explanationSnippet || "unsecured personal loans require regular verifiable monthly income and active employment";
  return `Based on official partner bank policies, we are currently unable to approve a personal loan because ${specificReason}.`;
}

/**
 * Dynamically asks ONE eligibility question at a time using OpenRouter LLM.
 * Never repeats answered questions; acknowledges previous input naturally.
 */
export async function generateDynamicSingleQuestionWithLLM(
  nextField: string,
  applicant: ApplicantProfile,
  userMessage?: string,
  modelOverride?: string,
  contextNotes?: ConversationalContextNotes,
  conversationHistory?: { role: string; content: string }[]
): Promise<string> {
  const collectedSummary: string[] = [];
  if (applicant.monthlyIncome !== undefined && applicant.monthlyIncome !== null) {
    collectedSummary.push(`Salary: ${typeof applicant.monthlyIncome === "number" ? `₹${applicant.monthlyIncome.toLocaleString("en-IN")}` : applicant.monthlyIncome}`);
  }
  if (applicant.loanAmount) {
    collectedSummary.push(`Loan Amount: ${typeof applicant.loanAmount === "number" ? `₹${applicant.loanAmount.toLocaleString("en-IN")}` : applicant.loanAmount}`);
  }
  if (applicant.tenureMonths) collectedSummary.push(`Tenure: ${applicant.tenureMonths} months`);
  if (applicant.cibil !== undefined && applicant.cibil !== null) collectedSummary.push(`CIBIL: ${applicant.cibil}`);
  if (applicant.existingEmi !== undefined) {
    collectedSummary.push(`Existing EMIs: ${typeof applicant.existingEmi === "number" ? `₹${applicant.existingEmi.toLocaleString("en-IN")}` : applicant.existingEmi}`);
  }
  if (applicant.age) collectedSummary.push(`Age: ${applicant.age} years`);

  const fieldPrompts: Record<string, string> = {
    companyName: "Ask for their employer or company name (or whether they are salaried or self-employed).",
    monthlyIncome: "Ask for their net monthly take-home salary in INR.",
    loanAmount: "Ask how much loan amount they need to borrow.",
    tenureMonths: "Ask for their preferred repayment tenure (e.g. 3 years, 5 years, or in months).",
    cibil: "Ask for their approximate CIBIL score (mentioning they can reply with 0 or unknown if not sure).",
    existingEmi: "Ask for their total existing monthly EMIs (mentioning they can say none or 0 if they have no ongoing loans).",
    age: "Ask for their current age in years.",
  };

  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (apiKey) {
    const modelsToTry = [modelOverride, OPENROUTER_MODEL].filter(Boolean) as string[];
    if (OPENROUTER_MODEL !== "openrouter/free") modelsToTry.push("openrouter/free");

    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let userPromptContent =
          `The applicant said: "${userMessage}".\n` +
          `Already known details: ${collectedSummary.length > 0 ? collectedSummary.join(", ") : "None yet"}.\n` +
          `Next missing detail needed: ${fieldPrompts[nextField] || nextField}.\n`;

        if (applicant._lastSideQuestion) {
          userPromptContent +=
            `Side question or objection raised by user: "${userMessage}".\n` +
            `Policy facts and guidance: ${applicant._lastSideQuestion}\n` +
            `Instruction: Answer the user's specific question or objection directly, accurately, and conversationally in your own words using the policy facts. Do not repeat text verbatim.\n`;
        }
        if (applicant._lastCorrectionNotice) {
          userPromptContent +=
            `Correction provided by user: "${applicant._lastCorrectionNotice}".\n` +
            `Instruction: Naturally acknowledge that this detail was updated.\n`;
        }
        if (contextNotes?.statedPurpose) {
          userPromptContent += `User context/purpose: ${contextNotes.statedPurpose} (${contextNotes.urgency || "standard"}).\n`;
        }

        userPromptContent += `\nRespond with a friendly 2-3 sentence message. If a side question or objection was asked, answer it first directly and warmly in your own words. If a correction was made, acknowledge the update first naturally. Then ask for ONLY the next missing detail in a warm, natural conversational tone without any rigid dividers or static templates.`;

        const messages: any[] = [
          {
            role: "system",
            content:
              "You are CreditWise AI, a friendly, empathetic, professional financial intelligence advisor behaving naturally like an experienced senior loan officer.\n" +
              "Your goal is to guide the applicant through loan eligibility assessment by asking EXACTLY ONE missing detail at a time.\n" +
              "Generate fresh, natural, varied conversational phrasing each time while keeping the required question crystal clear.\n" +
              "If the applicant asked a side question, objection, or expressed concern (such as why company/salary/age/cibil is needed, credit score impact, collateral, prepayment, documents, data safety, or FOIR), provide an authoritative, reassuring, and conversational answer in your own dynamic words first.\n" +
              "If the applicant corrected a previous detail, acknowledge the update naturally.\n" +
              "If the user shared life events or urgency (such as a medical emergency or wedding), show genuine empathy.\n" +
              "Then, seamlessly ask for ONLY the next missing detail in a warm, natural tone.\n" +
              "Never ask multiple questions. Never repeat a question for details already known.\n" +
              "Do NOT use rigid dividers like '---', robotic canned footers, or static templates.\n" +
              "Keep your response concise (2-3 sentences), warm, and human.\n" +
              "Do NOT output internal thinking steps, numbered analysis lists, or thought preambles. Output ONLY the direct conversational response to the user.\n" +
              "Never mention databases, files, tables, internal tokens, or backend systems.",
          },
        ];

        if (conversationHistory && conversationHistory.length > 0) {
          const hist = conversationHistory.slice(-4);
          for (const m of hist) {
            if (m.content && m.content.trim()) {
              messages.push({
                role: m.role === "assistant" || m.role === "ai" ? "assistant" : "user",
                content: m.content.trim(),
              });
            }
          }
        }

        messages.push({
          role: "user",
          content: userPromptContent,
        });

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
            max_tokens: 220,
            temperature: 0.7,
            messages,
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          const content = json.choices?.[0]?.message?.content;
          if (content && typeof content === "string" && content.trim().length > 10) {
            return stripReasoningPreamble(content.trim());
          }
        }
      } catch (e) {
        // Try fallback model
      }
    }
  }

  // Fallback field question if LLM is unavailable
  const fallbackQuestions: Record<string, string> = {
    monthlyIncome: "What is your approximate monthly take-home salary?",
    loanAmount: "How much loan amount would you like to borrow?",
    tenureMonths: "What is your preferred repayment tenure (e.g. 3 years or 36 months)?",
    cibil: "What is your approximate CIBIL credit score?",
    age: "What is your current age?",
    existingEmi: "What are your total existing monthly EMIs? (If none, reply 0)",
    companyName: "What is the name of your current employer or company?",
  };
  return fallbackQuestions[nextField] || `Could you please share your ${nextField}?`;
}

export const generateDynamicQuestion = generateDynamicSingleQuestionWithLLM;

/**
 * Core dynamic evaluator: Evaluates the applicant against all banks using their Master Policy rules
 * and the user's resolved company category.
 * Strictly uses actual policy parameters — no defaults, fallbacks, or invented values.
 */
export async function evaluateApplicantAgainstAllBanks(
  applicant: ApplicantProfile,
  requestedLoanType: string = "Personal Loan"
): Promise<{
  companyMatch: CompanyCategoryMatch;
  evaluations: BankEvaluationResult[];
  eligibleBanks: BankEvaluationResult[];
  reviewBanks: BankEvaluationResult[];
  ineligibleBanks: BankEvaluationResult[];
  recommendedBank: BankEvaluationResult | null;
  recommendationReason: string;
}> {
  const monthlySalary = typeof applicant.monthlyIncome === "number" ? applicant.monthlyIncome : (applicant.monthlyIncome && !isNaN(Number(applicant.monthlyIncome)) ? Number(applicant.monthlyIncome) : 0);
  const cibil = typeof applicant.cibil === "number" ? applicant.cibil : (applicant.cibil && !isNaN(Number(applicant.cibil)) ? Number(applicant.cibil) : 0);
  const age = typeof applicant.age === "number" ? applicant.age : (applicant.age && !isNaN(Number(applicant.age)) ? Number(applicant.age) : 0);
  const loanAmount = typeof applicant.loanAmount === "number" ? applicant.loanAmount : (applicant.loanAmount && !isNaN(Number(applicant.loanAmount)) ? Number(applicant.loanAmount) : 0);
  const tenureMonths = typeof applicant.tenureMonths === "number" ? applicant.tenureMonths : (applicant.tenureMonths && !isNaN(Number(applicant.tenureMonths)) ? Number(applicant.tenureMonths) : 0);
  const existingEmi = typeof applicant.existingEmi === "number" ? applicant.existingEmi : (applicant.existingEmi && !isNaN(Number(applicant.existingEmi)) ? Number(applicant.existingEmi) : 0);

  console.log(`\n================================================================================`);
  console.log(`[Eligibility Trace] === Step 1: User Profile Received ===`);
  console.log(`[Eligibility Trace]   • Product Requested: ${requestedLoanType}`);
  console.log(`[Eligibility Trace]   • Employer / Company: ${applicant.companyName || "Not provided"}`);
  console.log(`[Eligibility Trace]   • Monthly Take-Home Salary: ${monthlySalary > 0 ? `₹${monthlySalary.toLocaleString("en-IN")}` : "Not provided"}`);
  console.log(`[Eligibility Trace]   • CIBIL Credit Score: ${typeof applicant.cibil === "number" && applicant.cibil > 0 ? applicant.cibil : "Not provided"}`);
  console.log(`[Eligibility Trace]   • Applicant Age: ${age > 0 ? `${age} years` : "Not provided"}`);
  console.log(`[Eligibility Trace]   • Requested Loan Amount: ${loanAmount > 0 ? `₹${loanAmount.toLocaleString("en-IN")}` : "Not provided"}`);
  console.log(`[Eligibility Trace]   • Repayment Tenure: ${tenureMonths > 0 ? `${tenureMonths} months (${(tenureMonths / 12).toFixed(1)} years)` : "Not provided"}`);
  console.log(`[Eligibility Trace]   • Existing Monthly EMIs: ${applicant.existingEmi !== undefined && applicant.existingEmi !== null ? `₹${existingEmi.toLocaleString("en-IN")}` : "Not provided"}`);
  console.log(`[Eligibility Trace]   • Employment Type: ${applicant.employmentType || "Salaried"}`);

  // Step 2: Resolve employer category across banks from bank_company_data
  console.log(`[Eligibility Trace] === Step 2: Resolving Company Category from Master Records ===`);
  const companyQuery = applicant.companyName || "";
  const companyMatch = await resolveCompanyCategories(companyQuery);
  console.log(
    `[Eligibility Trace]   • Queried: "${companyQuery}" -> Matched: "${companyMatch.matchedName || "No exact DB match (Standard Category applied)"}" (Found: ${companyMatch.isFound})`
  );
  console.log(`[Eligibility Trace]   • Overall Category Tier: ${companyMatch.overallCategoryDisplay || "Standard Corporate"}`);
  console.log(`[Eligibility Trace]   • Bank categories mapped: ${Object.keys(companyMatch.bankCategories).length} banks`);

  // Step 3: Load all bank policy rules with the company category applied
  console.log(`[Eligibility Trace] === Step 3: Loading Master Policy Files for Active Partner Banks ===`);
  const allBankRules = getAllBankRulesForCategory(companyMatch, requestedLoanType);
  const normReq = requestedLoanType.toLowerCase().replace(/\s*loan$/, "");

  // Evaluate ONLY active Personal Loan policies, excluding Home Loan or non-matching policies
  const bankRules = allBankRules.filter((rule) => {
    if (rule.bankCode === "HOME_LOAN" || /home_loan/i.test(rule.fileName)) return false;
    if (normReq === "personal") {
      const isPL =
        (rule.loanType && rule.loanType.toLowerCase().includes("personal")) ||
        (Array.isArray(rule.supportedLoanTypes) &&
          rule.supportedLoanTypes.some((t) => t.toLowerCase().includes("personal")));
      return isPL;
    }
    return true;
  });
  console.log(`[Eligibility Trace]   • Active partner banks loaded for evaluation: ${bankRules.length}`);

  // Step 4: Independent Bank Evaluation
  console.log(`[Eligibility Trace] === Step 4: Independent Bank Evaluation (${bankRules.length} banks) ===`);
  const evaluations: BankEvaluationResult[] = [];

  for (const rule of bankRules) {
    const verifiedChecks: string[] = [];
    const failureReasons: string[] = [];

    // 1. Calculate Proposed EMI First using bank's policy ROI, requested loan amount, and tenure
    const proposedEmi = rule.roi && rule.roi > 0 && loanAmount > 0 && tenureMonths > 0
      ? calculateEmi(loanAmount, rule.roi, tenureMonths)
      : 0;

    // 2. Calculate FOIR = (Existing EMI + Proposed EMI) / Salary * 100
    const totalObligations = existingEmi + proposedEmi;
    const calculatedFoir = monthlySalary > 0
      ? Number(((totalObligations / monthlySalary) * 100).toFixed(1))
      : 100;

    const isSupportedProduct =
      rule.supportedLoanTypes &&
      Array.isArray(rule.supportedLoanTypes) &&
      rule.supportedLoanTypes.some(
        (t) =>
          t.toLowerCase() === requestedLoanType.toLowerCase() ||
          t.toLowerCase().replace(/\s*loan$/, "") === normReq
      );

    if (!isSupportedProduct) {
      failureReasons.push(
        `Bank policy does not offer ${requestedLoanType} (supported product: ${rule.supportedLoanTypes ? rule.supportedLoanTypes.join(", ") : "N/A"})`
      );
    } else {
      verifiedChecks.push(`Product type (${requestedLoanType}) is officially offered`);
    }

    // Check 0: Employment Status Criteria
    if (applicant.employmentStatus === "unemployed" || applicant.employmentType === "Unemployed") {
      failureReasons.push(
        `Employment criteria not met: Personal loans require active employment (Salaried or Self-Employed). Unemployed applicants are not eligible under partner bank policies.`
      );
    }

    const missingPolicyRules: string[] = [];

    // Check 1: Minimum Monthly Salary (Category-specific from Master Policy)
    if (!rule.minSalary || rule.minSalary <= 0) {
      missingPolicyRules.push(`Minimum monthly salary not specified in policy`);
    } else if (monthlySalary < rule.minSalary) {
      const salDisplay = monthlySalary > 0 ? `₹${monthlySalary.toLocaleString("en-IN")}` : "Not provided";
      failureReasons.push(
        `Monthly salary (${salDisplay}) is below the required ₹${rule.minSalary.toLocaleString("en-IN")} for ${rule.resolvedCategory}`
      );
    } else {
      verifiedChecks.push(`Monthly salary meets ${rule.resolvedCategory} policy minimum (₹${rule.minSalary.toLocaleString("en-IN")})`);
    }

    // Check 2: CIBIL Score Threshold
    if (!rule.minCibil || rule.minCibil <= 0) {
      missingPolicyRules.push(`CIBIL cutoff not specified in policy`);
    } else if (cibil < rule.minCibil) {
      const cibilDisplay = typeof applicant.cibil === "number" && applicant.cibil > 0 ? applicant.cibil : "Not provided";
      failureReasons.push(`CIBIL score (${cibilDisplay}) is below the policy minimum threshold of ${rule.minCibil}`);
    } else {
      verifiedChecks.push(`CIBIL score (${cibil}) meets or exceeds policy minimum of ${rule.minCibil}`);
    }

    // Check 3: Age Bounds
    if (!rule.minAge || !rule.maxAge || rule.minAge <= 0 || rule.maxAge <= rule.minAge) {
      missingPolicyRules.push(`Age limits not specified in policy`);
    } else if (age < rule.minAge || age > rule.maxAge) {
      const ageDisplay = age > 0 ? `${age} years` : "Not provided";
      failureReasons.push(`Age (${ageDisplay}) is outside permissible range (${rule.minAge} to ${rule.maxAge} years)`);
    } else {
      verifiedChecks.push(`Applicant age (${age} years) is within permissible limits (${rule.minAge}–${rule.maxAge} years)`);
    }

    // Check 4: Loan Amount Limits (Ticket Size)
    if (!rule.minLoanAmount || !rule.maxLoanAmount || rule.minLoanAmount <= 0 || rule.maxLoanAmount < rule.minLoanAmount) {
      missingPolicyRules.push(`Loan amount limits not specified in policy`);
    } else if (loanAmount < rule.minLoanAmount) {
      const amtDisplay = loanAmount > 0 ? `₹${loanAmount.toLocaleString("en-IN")}` : "Not provided";
      failureReasons.push(`Requested loan amount (${amtDisplay}) is below minimum ticket size of ₹${rule.minLoanAmount.toLocaleString("en-IN")}`);
    } else if (loanAmount > rule.maxLoanAmount) {
      const amtDisplay = loanAmount > 0 ? `₹${loanAmount.toLocaleString("en-IN")}` : "Not provided";
      failureReasons.push(`Requested loan amount (${amtDisplay}) exceeds maximum permissible ticket size of ₹${rule.maxLoanAmount.toLocaleString("en-IN")}`);
    } else {
      verifiedChecks.push(`Requested amount (₹${loanAmount.toLocaleString("en-IN")}) is within permissible ticket size range`);
    }

    // Check 5: Tenure Limits
    if (!rule.minTenureMonths || !rule.maxTenureMonths || rule.minTenureMonths <= 0 || rule.maxTenureMonths < rule.minTenureMonths) {
      missingPolicyRules.push(`Repayment tenure limits not specified in policy`);
    } else if (tenureMonths < rule.minTenureMonths || tenureMonths > rule.maxTenureMonths) {
      const tenureDisplay = tenureMonths > 0 ? `${tenureMonths} months` : "Not provided";
      failureReasons.push(`Requested tenure (${tenureDisplay}) is outside permissible range (${rule.minTenureMonths} to ${rule.maxTenureMonths} months)`);
    } else {
      verifiedChecks.push(`Requested tenure (${tenureMonths} months) is within permissible policy tenure`);
    }

    // Check 6: Permissible FOIR & Monthly EMI Debt-to-Income
    let foirValid = true;
    if (!rule.foirPercent || rule.foirPercent <= 0) {
      missingPolicyRules.push(`Permissible FOIR cap not specified in policy`);
      foirValid = false;
    }
    if (!rule.roi || rule.roi <= 0) {
      missingPolicyRules.push(`Interest rate (ROI) not specified in policy`);
      foirValid = false;
    }

    const maxPermissibleEmi = rule.foirPercent && rule.foirPercent > 0 ? monthlySalary * (rule.foirPercent / 100) : 0;
    const availableEmiHeadroom = Math.max(0, maxPermissibleEmi - existingEmi);
    let maxLoanEligible = rule.roi && rule.roi > 0 ? calculateMaxLoanCapacity(availableEmiHeadroom, rule.roi, tenureMonths) : 0;
    if (rule.maxLoanAmount && maxLoanEligible > rule.maxLoanAmount) {
      maxLoanEligible = rule.maxLoanAmount;
    }

    if (foirValid) {
      if (calculatedFoir > rule.foirPercent) {
        failureReasons.push(
          `Total debt obligations consume ${calculatedFoir}% of income (existing EMI ₹${existingEmi.toLocaleString("en-IN")} + proposed EMI ₹${proposedEmi.toLocaleString("en-IN")}), exceeding the policy FOIR cap of ${rule.foirPercent}%`
        );
      } else {
        verifiedChecks.push(
          `Total debt obligations (${calculatedFoir}%) remain within permissible FOIR cap of ${rule.foirPercent}%`
        );
      }
    }

    const isChecksPassed = failureReasons.length === 0;
    const hasMissingRules = missingPolicyRules.length > 0;
    const isReview = isChecksPassed && (rule.reviewRequired === true || hasMissingRules);
    const resolvedReviewReason = rule.reviewReason || (hasMissingRules ? `Underwriting review required: ${missingPolicyRules.join(", ")}` : undefined);

    const status: "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_REVIEW" = !isChecksPassed
      ? "NOT_ELIGIBLE"
      : isReview
      ? "NEEDS_REVIEW"
      : "ELIGIBLE";
    const isEligible = status === "ELIGIBLE" || status === "NEEDS_REVIEW";

    if (status === "ELIGIBLE") {
      console.log(
        `[Eligibility Trace]   [✓ ELIGIBLE] ${rule.bankName}: Approved | ROI: ${rule.roi}% | EMI: ₹${proposedEmi.toLocaleString("en-IN")}/mo | Max Limit: ₹${maxLoanEligible.toLocaleString("en-IN")} | FOIR: ${calculatedFoir}%`
      );
    } else if (status === "NEEDS_REVIEW") {
      console.log(
        `[Eligibility Trace]   [⚠️ NEEDS_REVIEW] ${rule.bankName}: Review required | Reason: ${rule.reviewReason || "Underwriting review required"}`
      );
    } else {
      console.log(
        `[Eligibility Trace]   [✗ NOT_ELIGIBLE] ${rule.bankName}: Filtered out | Reasons: ${failureReasons.join(" | ")}`
      );
    }

    evaluations.push({
      bankId: rule.bankId,
      bankName: rule.bankName,
      bankCode: rule.bankCode,
      fileName: rule.fileName,
      resolvedCategory: rule.resolvedCategory,
      isEligible,
      status,
      reviewRequired: isReview,
      reviewReason: resolvedReviewReason,
      roi: rule.roi,
      monthlyEmi: proposedEmi,
      maxLoanEligible: isEligible ? maxLoanEligible : 0,
      requestedLoanAmount: loanAmount,
      processingFeePercent: rule.processingFeePercent,
      tenureMonths,
      policyCibil: rule.policyCibil || "-",
      policyTenure: rule.policyTenure || "-",
      foirPercent: rule.foirPercent,
      calculatedFoir,
      verifiedChecks,
      failureReasons,
      policySource: rule.policySource,
    });
  }

  // Strictly filter out all ineligible banks
  const eligibleBanks = evaluations.filter((e) => e.status === "ELIGIBLE");
  const reviewBanks = evaluations.filter((e) => e.status === "NEEDS_REVIEW");
  const ineligibleBanks = evaluations.filter((e) => e.status === "NOT_ELIGIBLE");

  // Rank Eligible Banks to select the #1 Top Recommendation
  // Criteria: Lowest ROI -> Lowest Processing Fee -> Highest Loan Capacity
  eligibleBanks.sort((a, b) => {
    if (a.roi !== b.roi) return a.roi - b.roi;
    if (a.processingFeePercent !== b.processingFeePercent) return a.processingFeePercent - b.processingFeePercent;
    return b.maxLoanEligible - a.maxLoanEligible;
  });

  reviewBanks.sort((a, b) => {
    if (a.roi !== b.roi) return a.roi - b.roi;
    if (a.processingFeePercent !== b.processingFeePercent) return a.processingFeePercent - b.processingFeePercent;
    return b.maxLoanEligible - a.maxLoanEligible;
  });

  const recommendedBank = eligibleBanks.length > 0 ? eligibleBanks[0] : reviewBanks.length > 0 ? reviewBanks[0] : null;
  let recommendationReason = "";

  if (recommendedBank) {
    recommendationReason =
      `**${recommendedBank.bankName}** is selected as your #1 Top Recommendation because it offers the **lowest interest rate of ${recommendedBank.roi}% p.a.**, with an estimated monthly EMI of ₹${recommendedBank.monthlyEmi.toLocaleString("en-IN")} and a low processing fee of ${recommendedBank.processingFeePercent}%.`;
  } else {
    recommendationReason =
      "No partner banks currently meet all policy requirements under the specified profile.";
  }

  console.log(`[Eligibility Trace] === Step 5: Final Eligibility Result ===`);
  console.log(`[Eligibility Trace]   • Total Banks Evaluated: ${evaluations.length}`);
  console.log(
    `[Eligibility Trace]   • Eligible Banks (${eligibleBanks.length}): ${eligibleBanks.map((b) => `${b.bankName} (${b.roi}%)`).join(", ") || "None"}`
  );
  if (reviewBanks.length > 0) {
    console.log(
      `[Eligibility Trace]   • Needs Review Banks (${reviewBanks.length}): ${reviewBanks.map((b) => `${b.bankName} (${b.roi}%)`).join(", ")}`
    );
  }
  console.log(
    `[Eligibility Trace]   • Ineligible Banks Filtered Out (${ineligibleBanks.length}): ${ineligibleBanks.map((b) => b.bankName).join(", ") || "None"}`
  );
  console.log(
    `[Eligibility Trace]   • Top Recommendation: ${recommendedBank ? `${recommendedBank.bankName} (${recommendedBank.roi}% p.a.)` : "None"}`
  );
  console.log(`================================================================================\n`);

  return {
    companyMatch,
    evaluations,
    eligibleBanks,
    reviewBanks,
    ineligibleBanks,
    recommendedBank,
    recommendationReason,
  };
}

/**
 * Formats the evaluation results into clean, beautiful GitHub-flavored Markdown.
 * STRICTLY HIDES all backend details, filenames, database tables, and ineligible bank lists.
 * SHOWS ONLY ELIGIBLE BANKS THAT PASS ALL ACTUAL POLICY RULES.
 */
/**
 * Generates a concise, 1–2 sentence user-facing reason based on key eligibility factors:
 * CIBIL, loan amount, tenure, salary when relevant, and FOIR.
 * Strictly excludes any internal filenames, database details, internal category codes, or technical checklists.
 */
export function buildConciseEligibilityReason(applicant: ApplicantProfile, b: BankEvaluationResult): string {
  const parts: string[] = [];

  // CIBIL factor
  if (typeof applicant.cibil === "number" && applicant.cibil > 0) {
    parts.push(`CIBIL of ${applicant.cibil}`);
  }

  // Salary factor (included when relevant, e.g. salary <= ₹40,000)
  const salaryNum = typeof applicant.monthlyIncome === "number" ? applicant.monthlyIncome : (applicant.monthlyIncome && !isNaN(Number(applicant.monthlyIncome)) ? Number(applicant.monthlyIncome) : 0);
  if (salaryNum > 0 && salaryNum <= 40000) {
    parts.push(`monthly salary of ₹${salaryNum.toLocaleString("en-IN")}`);
  }

  // Loan amount factor
  const loanNum = typeof applicant.loanAmount === "number" ? applicant.loanAmount : (applicant.loanAmount && !isNaN(Number(applicant.loanAmount)) ? Number(applicant.loanAmount) : 0);
  if (loanNum > 0) {
    const amt = loanNum >= 100000
      ? `₹${(loanNum / 100000).toFixed(loanNum % 100000 === 0 ? 0 : 1)} lakh loan amount`
      : `₹${loanNum.toLocaleString("en-IN")} loan amount`;
    parts.push(amt);
  }

  // Tenure factor
  const tenureNum = typeof applicant.tenureMonths === "number" ? applicant.tenureMonths : (applicant.tenureMonths && !isNaN(Number(applicant.tenureMonths)) ? Number(applicant.tenureMonths) : 0);
  if (tenureNum > 0) {
    parts.push(`${tenureNum}-month tenure`);
  }

  // FOIR factor
  if (b.calculatedFoir != null) {
    parts.push(`~${b.calculatedFoir}% FOIR`);
  }

  if (parts.length === 0) {
    return `Eligible based on your credit and financial profile meeting this bank's applicable criteria.`;
  }

  if (parts.length === 1) {
    return `Eligible because your ${parts[0]} meets this bank's applicable criteria.`;
  }

  const last = parts.pop();
  return `Eligible because your ${parts.join(", ")}, and ${last} meet this bank's applicable criteria.`;
}

export function deduplicateRejectionReasons(
  ineligibleBanks: BankEvaluationResult[],
  applicant: ApplicantProfile
): string[] {
  const reasons: string[] = [];
  const allReasons = ineligibleBanks.flatMap((b) => b.failureReasons);
  // 0. Employment status
  if (
    allReasons.some((r) => /employment|unemployed/i.test(r)) ||
    applicant.employmentStatus === "unemployed" ||
    applicant.employmentType === "Unemployed"
  ) {
    reasons.push(
      `**Employment Status**: Personal loan policies require active employment (Salaried or Self-Employed) with regular verified income. Unemployed applicants are currently ineligible.`
    );
  }

  // 1. CIBIL score
  if (allReasons.some((r) => /cibil/i.test(r))) {
    const cibilDisplay = typeof applicant.cibil === "number" && applicant.cibil > 0 ? applicant.cibil : "Not provided";
    reasons.push(`**Credit Score (CIBIL)**: Current score (${cibilDisplay}) is below partner bank cutoffs (minimum required is typically 650–700+).`);
  }

  // 2. Minimum monthly salary
  if (allReasons.some((r) => /salary/i.test(r))) {
    const salDisplay = typeof applicant.monthlyIncome === "number" && applicant.monthlyIncome > 0
      ? `₹${applicant.monthlyIncome.toLocaleString("en-IN")}`
      : "Not provided";
    reasons.push(`**Minimum Monthly Salary**: Take-home salary (${salDisplay}) is below partner bank requirements for your employer category.`);
  }

  // 3. FOIR / Debt obligations
  if (allReasons.some((r) => /foir|debt obligations|debt burden/i.test(r))) {
    reasons.push(`**Debt Burden / FOIR**: Current loan obligations and proposed EMI exceed partner banks' permissible debt-to-income (FOIR) limit (typically 50%–70%).`);
  }

  // 4. Age limits
  if (allReasons.some((r) => /age/i.test(r))) {
    const ageDisplay = typeof applicant.age === "number" && applicant.age > 0 ? `${applicant.age} years` : "Not provided";
    reasons.push(`**Applicant Age**: Current age (${ageDisplay}) is outside partner banks' eligible age bracket (typically 21–60 years).`);
  }

  // 5. Loan Amount (Ticket size)
  if (allReasons.some((r) => /ticket size|loan amount/i.test(r))) {
    const amtDisplay = typeof applicant.loanAmount === "number" && applicant.loanAmount > 0
      ? `₹${applicant.loanAmount.toLocaleString("en-IN")}`
      : "Not provided";
    reasons.push(`**Requested Loan Amount**: Ticket size of ${amtDisplay} is outside permissible loan bounds for partner lenders.`);
  }

  // 6. Tenure
  if (allReasons.some((r) => /tenure/i.test(r))) {
    const tenureDisplay = typeof applicant.tenureMonths === "number" && applicant.tenureMonths > 0
      ? `${applicant.tenureMonths} months`
      : "Not provided";
    reasons.push(`**Repayment Tenure**: Requested tenure (${tenureDisplay}) is outside permissible policy ranges.`);
  }

  // Fallback if none matched: return at most 3 distinct general reasons
  if (reasons.length === 0) {
    const distinct = Array.from(new Set(allReasons)).slice(0, 3);
    reasons.push(...distinct);
  }

  return reasons;
}

/**
 * Formats the final eligibility assessment report into a clean, concise, user-facing Markdown document.
 * Strictly SHOWS ONLY ELIGIBLE BANKS with a 1–2 sentence reason based on key factors:
 * CIBIL, loan amount, tenure, salary when relevant, and FOIR.
 * Strictly removes all backend/internal information (Master Policy filenames, internal category codes,
 * policy source names, technical calculations, and long verification checklists).
 */
export function formatDynamicEligibilityReport(
  applicant: ApplicantProfile,
  evaluationOutput: {
    companyMatch: CompanyCategoryMatch;
    evaluations?: BankEvaluationResult[];
    eligibleBanks: BankEvaluationResult[];
    reviewBanks?: BankEvaluationResult[];
    ineligibleBanks: BankEvaluationResult[];
    recommendedBank: BankEvaluationResult | null;
    recommendationReason: string;
  }
): string {
  const { eligibleBanks, recommendedBank, reviewBanks = [] } = evaluationOutput;
  const approvedOrReviewBanks = [...eligibleBanks, ...reviewBanks];
  const lines: string[] = [];

  // Do not generate a bank table when required data is missing!
  const isUnemployed =
    applicant.employmentStatus === "unemployed" ||
    applicant.employmentType === "Unemployed";

  const isMissingRequiredData =
    isUnemployed ||
    !applicant.loanAmount ||
    !applicant.monthlyIncome ||
    !applicant.tenureMonths ||
    (applicant.employmentType !== "Self-Employed" && !applicant.companyName);

  if (isMissingRequiredData) {
    if (isUnemployed) {
      return (
        `### ⚠️ Personal Loan Policy Assessment\n\n` +
        `Under partner bank policies, unsecured personal loans require active employment (Salaried or Self-Employed) with regular verifiable monthly income to confirm repayment capacity. Unemployed applicants are currently not eligible for unsecured personal loans. Secured financing options (such as gold loans or loans against fixed deposits) may be explored if collateral is available.`
      );
    }
    return (
      `### ⚠️ Incomplete Loan Parameters\n\n` +
      `Key loan parameters (such as employment details, monthly income, requested loan amount, or repayment tenure) have not been fully provided. Please share the required details to check your eligibility across partner banks.`
    );
  }

  // Header
  lines.push(`## 📊 Personal Loan Eligibility Assessment`);
  lines.push("");

  // Applicant Profile Overview (User-facing & concise, strictly from collected answers)
  lines.push(`### 👤 Applicant Summary`);
  lines.push(`| Parameter | Value |`);
  lines.push(`| :--- | :--- |`);
  lines.push(`| **Employer** | ${applicant.companyName ? `**${applicant.companyName}**` : "Not provided"} |`);
  lines.push(`| **Monthly Take-Home Salary** | ${applicant.monthlyIncome && typeof applicant.monthlyIncome === "number" && applicant.monthlyIncome > 0 ? `₹${applicant.monthlyIncome.toLocaleString("en-IN")}` : "Not provided"} |`);
  lines.push(`| **CIBIL Credit Score** | ${typeof applicant.cibil === "number" && applicant.cibil > 0 ? applicant.cibil : "Not provided"} |`);
  lines.push(`| **Requested Loan Amount** | ${applicant.loanAmount && typeof applicant.loanAmount === "number" && applicant.loanAmount > 0 ? `₹${applicant.loanAmount.toLocaleString("en-IN")}` : "Not provided"} |`);
  lines.push(`| **Repayment Tenure** | ${applicant.tenureMonths && typeof applicant.tenureMonths === "number" && applicant.tenureMonths > 0 ? `${applicant.tenureMonths} months (${(applicant.tenureMonths / 12).toFixed(1)} years)` : "Not provided"} |`);
  lines.push(`| **Existing Monthly EMIs** | ${applicant.existingEmi !== undefined && applicant.existingEmi !== null && typeof applicant.existingEmi === "number" ? `₹${applicant.existingEmi.toLocaleString("en-IN")}` : "Not provided"} |`);
  lines.push(`| **Applicant Age** | ${applicant.age && typeof applicant.age === "number" && applicant.age > 0 ? `${applicant.age} years` : "Not provided"} |`);
  lines.push("");

  // Eligible Banks Table (Bank | Status | CIBIL | Tenure | Est. EMI)
  if (approvedOrReviewBanks.length > 0) {
    const isSole = approvedOrReviewBanks.length === 1;
    lines.push(`### 📋 Eligible Partner Bank${isSole ? "" : "s"} (${approvedOrReviewBanks.length})`);
    if (isSole) {
      lines.push(`Based on your profile and verified financial parameters, **${approvedOrReviewBanks[0].bankName}** meets all eligibility criteria for your requested loan:`);
    } else {
      lines.push(`The following partner banks meet all policy criteria for your profile:`);
    }
    lines.push("");
    lines.push(`| Bank | Status | CIBIL | Tenure | Est. EMI |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);

    approvedOrReviewBanks.forEach((b) => {
      const statusIcon = b.status === "ELIGIBLE" ? "✅ ELIGIBLE" : "⚠️ NEEDS_REVIEW";
      lines.push(
        `| **${b.bankName}** | ${statusIcon} | ${b.policyCibil || "-"} | ${b.policyTenure || "-"} | ₹${b.monthlyEmi.toLocaleString("en-IN")} |`
      );
    });
    lines.push("");

    if (reviewBanks.length > 0) {
      lines.push(`> ⚠️ **Note**: Banks marked **NEEDS_REVIEW** require underwriting sign-off or employer verification as per bank policy.`);
      lines.push("");
    }

    lines.push(`---\n🏦 **Next Step**: Which bank from your eligible list above would you like to proceed with? Please select **ONE** bank to connect with an official branch manager.`);
  } else {
    // Objective assessment outcome based strictly on actual failed criteria returned by the engine
    lines.push(`### ⚠️ Assessment Outcome: No Partner Banks Currently Eligible`);
    lines.push(`> [!WARNING]`);
    lines.push(`> **Policy Criteria Not Met**`);
    lines.push(`> Based on an objective evaluation against partner bank policies, no partner bank currently approves the requested loan parameters under this profile.`);
    lines.push("");

    const ineligibles = evaluationOutput.ineligibleBanks || [];
    if (ineligibles.length > 0) {
      lines.push(`### 📋 Bank-Wise Assessment Results`);
      lines.push(`| Bank | Status | CIBIL | Tenure | Est. EMI |`);
      lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
      ineligibles.forEach((b) => {
        lines.push(
          `| **${b.bankName}** | ❌ NOT_ELIGIBLE | ${b.policyCibil || "-"} | ${b.policyTenure || "-"} | - |`
        );
      });
      lines.push("");
    }

    const deduplicatedReasons = deduplicateRejectionReasons(ineligibles, applicant);
    if (deduplicatedReasons.length > 0) {
      lines.push(`#### 📋 Key Policy Criteria Not Met:`);
      deduplicatedReasons.forEach((r) => {
        lines.push(`* **${r.split(":")[0] || "Policy Rule"}**: ${r.includes(":") ? r.split(":").slice(1).join(":").trim() : r}`);
      });
      lines.push("");
    }

    // Simple natural-language actionable guidance in pointwise format
    lines.push(`#### 💡 How You Can Become Eligible:`);
    const numIncome = Number(applicant.monthlyIncome) || 0;
    const numLoan = Number(applicant.loanAmount) || 0;
    const numTenure = Number(applicant.tenureMonths) || 0;
    const numEmi = Number(applicant.existingEmi) || 0;
    const numCibil = Number(applicant.cibil) || 0;

    if (numIncome > 0 && numIncome < 25000) {
      lines.push(`* **Salary Threshold**: Most partner lenders require a minimum take-home salary of ₹25,000/month. Adding an earning co-applicant can bridge this gap.`);
    }
    if (numCibil > 0 && numCibil < 700) {
      lines.push(`* **Credit Score**: Lenders require a CIBIL score of 700+. Making timely credit card and loan payments for 3–6 months will improve your score.`);
    }
    if (numLoan > 0 && numIncome > 0 && numLoan > numIncome * 20) {
      const suggestedMax = Math.max(50000, Math.round((numIncome * 12) / 10000) * 10000);
      lines.push(`* **Lower Loan Amount**: Applying for a lower amount (e.g. ₹${suggestedMax.toLocaleString("en-IN")}) significantly increases approval probability.`);
    }
    if (numTenure > 0 && numTenure < 60) {
      lines.push(`* **Extend Tenure**: Choosing a longer repayment tenure (e.g. 48 or 60 months) lowers your monthly EMI and keeps your FOIR within bank limits.`);
    }
    if (numEmi > 0 && numIncome > 0 && (numEmi / numIncome) > 0.35) {
      lines.push(`* **Reduce Existing EMIs**: Paying off short-term personal loans or credit card EMIs lowers your debt obligations.`);
    }
    lines.push(`* **Add a Salaried Co-Applicant**: Applying jointly with an earning spouse or family member combines income to qualify for higher amounts.`);
    lines.push("");
    lines.push(`---\nWould you like to recalculate your eligibility with a different loan amount or longer tenure?`);
  }

  return lines.join("\n");
}

function inferFieldFromAssistantQuestion(q?: string | null): string | null {
  if (!q) return null;
  const norm = q.toLowerCase();
  if (/employer|company\s*name/i.test(norm)) return "companyName";
  if (/salary|take-home|income|monthly/i.test(norm)) return "monthlyIncome";
  if (/loan\s*amount|borrow|how\s*much/i.test(norm)) return "loanAmount";
  if (/tenure|repayment|years|duration/i.test(norm)) return "tenureMonths";
  if (/cibil|credit\s*score/i.test(norm)) return "cibil";
  if (/emi|ongoing\s*loans/i.test(norm)) return "existingEmi";
  if (/age/i.test(norm)) return "age";
  return null;
}

export interface ProfileUpdateExtraction {
  updates: Partial<ApplicantProfile>;
  updatedFieldLabels: string[];
}

/**
 * Extracts updated profile values for any of the 8 parameters:
 * company, salary/monthlyIncome, cibil, age, loanAmount, tenure, employmentType, existingEmi.
 * STRICT PROFILE INTEGRITY:
 * - Only extracts a field if the user's message explicitly targets/mentions that field.
 * - Unmentioned fields are NEVER invented, defaulted, or modified.
 */
export function extractProfileUpdates(
  message: string,
  llmExtracted?: ExtractedEntities
): ProfileUpdateExtraction {
  const updates: Partial<ApplicantProfile> = {};
  const updatedFieldLabels: string[] = [];
  const text = String(message || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();

  // Helper: check if a field is explicitly targeted in message or in LLM changeFields
  const isTargeted = (field: string, changeFieldAliases: string[]): boolean => {
    if (messageMentionsField(field, text)) return true;
    if (Array.isArray(llmExtracted?.changeFields)) {
      return llmExtracted.changeFields.some((f) =>
        changeFieldAliases.some((alias) => new RegExp(`^${alias}$`, "i").test(f))
      );
    }
    return false;
  };

  // 1. Company Name / Employer
  if (isTargeted("companyName", ["companyName", "company", "employer", "firm"])) {
    if (
      typeof llmExtracted?.companyName === "string" &&
      !isInvalidCompanyName(llmExtracted.companyName) &&
      !isFinancialOrProfileInput(llmExtracted.companyName)
    ) {
      updates.companyName = normalizeCompanyName(llmExtracted.companyName);
      updatedFieldLabels.push(`Employer to ${updates.companyName}`);
    } else {
      const compMatch =
        text.match(
          /(?:change|update|modify|set|make|correct)?\s*(?:my\s*)?(?:company|employer|firm|workplace)(?:\s*(?:name|is|to|=|:))\s*([A-Za-z0-9\s&'.-]+?)(?=\s*[,;]|\s+(?:and|with|salary|cibil|age|loan|emi|tenure|earning)|$|[.\n])/i
        ) ||
        text.match(
          /(?:work\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is)\s*[:]?\s*([A-Za-z0-9\s&'.-]+?)(?=\s*[,;]|\s+(?:and|with|salary|cibil|age|loan|emi|tenure|earning)|$|[.\n])/i
        );
      if (compMatch) {
        let c = compMatch[1].trim().replace(/^(?:to|is|at|=|:)\s+/i, "");
        if (!isInvalidCompanyName(c) && !isFinancialOrProfileInput(c)) {
          updates.companyName = normalizeCompanyName(c);
          updatedFieldLabels.push(`Employer to ${updates.companyName}`);
        }
      }
    }
  }

  // 2. Monthly Income / Salary
  if (isTargeted("monthlyIncome", ["monthlyIncome", "salary", "income", "takeHome"])) {
    if (typeof llmExtracted?.monthlyIncome === "number" && llmExtracted.monthlyIncome >= 5000) {
      updates.monthlyIncome = llmExtracted.monthlyIncome;
      updatedFieldLabels.push(`Monthly Salary to ₹${updates.monthlyIncome.toLocaleString("en-IN")}`);
    } else {
      const salMatch =
        text.match(
          /(?:change|update|make|set)?\s*(?:my\s*)?(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|nmi|nth|earning)(?:\s*(?:is|to|=|:))\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b)?/i
        ) ||
        text.match(
          /(?:salary|income|take\s*home)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b)?/i
        ) ||
        text.match(
          /(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b)?\s*(?:per\s*month|\/mo|monthly|take\s*home|salary|income)/i
        );
      if (salMatch) {
        const amt = parseFinancialAmount(salMatch[1] + (salMatch[2] || ""));
        if (amt && amt >= 5000 && amt <= 50000000) {
          updates.monthlyIncome = amt;
          updatedFieldLabels.push(`Monthly Salary to ₹${updates.monthlyIncome.toLocaleString("en-IN")}`);
        }
      }
    }
  }

  // 3. CIBIL Score
  if (isTargeted("cibil", ["cibil", "creditScore", "score"])) {
    if (typeof llmExtracted?.cibil === "number" && ((llmExtracted.cibil >= 300 && llmExtracted.cibil <= 900) || llmExtracted.cibil === 0)) {
      updates.cibil = llmExtracted.cibil;
      updatedFieldLabels.push(updates.cibil > 0 ? `CIBIL Score to ${updates.cibil}` : `CIBIL Score to 0 (No Score)`);
    } else if (typeof llmExtracted?.cibil === "string" && /not\s*provided|unknown|not\s*sure|don'?t\s*know/i.test(llmExtracted.cibil)) {
      updates.cibil = "Not provided";
      updatedFieldLabels.push(`CIBIL Score to Not provided`);
    } else if (/unknown|not\s*sure|don'?t\s*know|never\s*checked|no\s*idea/i.test(lower)) {
      updates.cibil = "Not provided";
      updatedFieldLabels.push(`CIBIL Score to Not provided`);
    } else if (/no\s*cibil|0\s*cibil|zero\s*cibil/i.test(lower)) {
      updates.cibil = 0;
      updatedFieldLabels.push(`CIBIL Score to 0 (No Score)`);
    } else {
      const cibilMatch =
        text.match(
          /(?:change|update|make|set)?\s*(?:my\s*)?(?:cibil|credit\s*score|score)(?:\s*(?:is|to|=|:)?\s*(?:of)?)\s*([3-9]\d{2})\b/i
        ) ||
        text.match(/\b([3-9]\d{2})\b\s*(?:cibil|credit\s*score)/i);
      if (cibilMatch) {
        const val = parseInt(cibilMatch[1], 10);
        if (val >= 300 && val <= 900) {
          updates.cibil = val;
          updatedFieldLabels.push(`CIBIL Score to ${updates.cibil}`);
        }
      }
    }
  }

  // 4. Age
  if (isTargeted("age", ["age", "applicantAge"])) {
    if (typeof llmExtracted?.age === "number" && llmExtracted.age >= 18 && llmExtracted.age <= 85) {
      updates.age = llmExtracted.age;
      updatedFieldLabels.push(`Age to ${updates.age} years`);
    } else {
      const ageMatch =
        text.match(/(?:change|update|make|set)?\s*(?:my\s*)?(?:age|aged)(?:\s*(?:is|to|=|:))\s*(\d{2})\b/i) ||
        text.match(/(?:actually\s+)?(?:i\s*am|im)\s+(\d{2})\s*(?:years?\s*old|yrs?\s*old)?\b/i) ||
        text.match(/\b(\d{2})\s*(?:years?\s*old|yr\s*old)\b/i);
      if (ageMatch) {
        const ageVal = parseInt(ageMatch[1], 10);
        if (ageVal >= 18 && ageVal <= 85) {
          updates.age = ageVal;
          updatedFieldLabels.push(`Age to ${updates.age} years`);
        }
      }
    }
  }

  // 5. Loan Amount Needed
  if (isTargeted("loanAmount", ["loanAmount", "loan", "amount", "ticketSize"])) {
    if (typeof llmExtracted?.loanAmount === "number" && llmExtracted.loanAmount >= 10000) {
      updates.loanAmount = llmExtracted.loanAmount;
      updatedFieldLabels.push(`Loan Amount to ₹${updates.loanAmount.toLocaleString("en-IN")}`);
    } else {
      const loanMatch =
        text.match(
          /(?:change|update|make|set|increase|decrease|reduce|raise)?\s*(?:my\s*)?(?:loan\s*(?:amount|ticket|size)?|borrow|need|require)(?:\s*(?:is|to|=|:))\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)?/i
        ) ||
        text.match(
          /(?:loan\s*amount)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)?/i
        ) ||
        text.match(
          /(?:rs\.?|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)\s*(?:loan)?/i
        ) ||
        text.match(
          /(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|cr|crores?|peti|khoka)\s+(?:loan|borrow)/i
        );
      if (loanMatch) {
        const amt = parseFinancialAmount(loanMatch[1] + (loanMatch[2] || ""));
        if (amt && amt >= 10000) {
          updates.loanAmount = amt;
          updatedFieldLabels.push(`Loan Amount to ₹${updates.loanAmount.toLocaleString("en-IN")}`);
        }
      }
    }
  }

  // 6. Tenure
  if (isTargeted("tenureMonths", ["tenureMonths", "tenure", "term", "duration"])) {
    if (typeof llmExtracted?.tenureMonths === "number" && llmExtracted.tenureMonths > 0) {
      updates.tenureMonths = llmExtracted.tenureMonths;
      updatedFieldLabels.push(`Tenure to ${updates.tenureMonths} months (${(updates.tenureMonths / 12).toFixed(1)} years)`);
    } else {
      const tenureMatch =
        text.match(
          /(?:change|update|make|set|increase|decrease|reduce)?\s*(?:my\s*)?(?:tenure|duration|term|period)(?:\s*(?:is|to|=|:))\s*(\d{1,2})\s*(years?|yrs?|saal|sal|months?|m\b|y\b)?/i
        ) ||
        text.match(
          /(?:tenure|duration|term|period)\s*(?:is|to|=|:)?\s*(\d{1,2})\s*(years?|yrs?|saal|sal|months?|m\b|y\b)?/i
        ) ||
        text.match(/\b([1-7])\s*(?:years?|yrs?|saal|sal)\b(?!\s*old)/i) ||
        text.match(/\b(\d{2})\s*(?:months?)\b/i);
      if (tenureMatch) {
        const num = parseInt(tenureMatch[1], 10);
        const unit = (tenureMatch[2] || "").toLowerCase();
        let months = num;
        if (unit.startsWith("y") || unit.startsWith("s") || (!unit.startsWith("m") && num <= 7)) {
          months = num * 12;
        }
        if (months > 0 && months <= 360) {
          updates.tenureMonths = months;
          updatedFieldLabels.push(`Tenure to ${updates.tenureMonths} months (${(updates.tenureMonths / 12).toFixed(1)} years)`);
        }
      }
    }
  }

  // 7. Employment Type
  if (isTargeted("employmentType", ["employmentType", "employment", "jobType"])) {
    if (llmExtracted?.employmentType) {
      const normEmp = String(llmExtracted.employmentType).toLowerCase();
      if (/self|business|proprietor|partner|freelanc|doctor|trader/i.test(normEmp)) {
        updates.employmentType = "Self-Employed";
      } else if (/salaried|job|pvt|corp|employee/i.test(normEmp)) {
        updates.employmentType = "Salaried";
      }
      if (updates.employmentType) {
        updatedFieldLabels.push(`Employment Type to ${updates.employmentType}`);
      }
    } else {
      const empMatch =
        text.match(
          /(?:change|update|make|set)?\s*(?:my\s*)?(?:employment\s*type|employment)(?:\s*(?:is|to|=|:))\s*(salaried|self[\s-]*employed|business|proprietor|freelancer)/i
        ) ||
        text.match(/\b(?:self[\s-]*employed|business|proprietor|partner|freelanc|doctor|trader)\b/i) ||
        text.match(/\b(?:salaried|job|employee|corporate|pvt\s*ltd|mnc)\b/i);
      if (empMatch) {
        const matchStr = empMatch[1] || empMatch[0];
        if (/self|business|proprietor|partner|freelanc|doctor|trader/i.test(matchStr)) {
          updates.employmentType = "Self-Employed";
        } else {
          updates.employmentType = "Salaried";
        }
        updatedFieldLabels.push(`Employment Type to ${updates.employmentType}`);
      }
    }
  }

  // 8. Existing Monthly EMI
  if (isTargeted("existingEmi", ["existingEmi", "emi", "obligations"])) {
    if (typeof llmExtracted?.existingEmi === "number") {
      updates.existingEmi = llmExtracted.existingEmi;
      updatedFieldLabels.push(updates.existingEmi > 0 ? `Existing Monthly EMIs to ₹${updates.existingEmi.toLocaleString("en-IN")}` : `Existing Monthly EMIs to ₹0 (No EMIs)`);
    } else if (/no\s*(?:existing\s*)?emi|0\s*emi|zero\s*emi|no\s*loans|no\s*existing\s*loans|nil\s*emi|zero\s*debt|sab\s*clear|no\s*debt/i.test(lower)) {
      updates.existingEmi = 0;
      updatedFieldLabels.push(`Existing Monthly EMIs to ₹0 (No EMIs)`);
    } else {
      const emiMatch =
        text.match(
          /(?:change|update|make|set)?\s*(?:my\s*)?(?:existing|current|other|ongoing)?\s*emi(?:s)?(?:\s*(?:is|to|=|:))\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i
        ) ||
        text.match(
          /(?:existing|ongoing|current)?\s*emi(?:s)?\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i
        );
      if (emiMatch) {
        const amt = parseFinancialAmount(emiMatch[1] + (emiMatch[2] || ""));
        if (amt !== null && amt >= 0) {
          updates.existingEmi = amt;
          updatedFieldLabels.push(`Existing Monthly EMIs to ₹${updates.existingEmi.toLocaleString("en-IN")}`);
        }
      }
    }
  }

  return { updates, updatedFieldLabels };
}

/**
 * Applies profile updates by replacing old values with new values (no old values retained),
 * re-evaluates company categories if employer changed, and recalculates eligibility against all banks
 * using strictly active Master Policy rules.
 */
export async function applyProfileUpdateAndRecalculate(
  conversationId: string,
  userMessage: string,
  existingApplicant: ApplicantProfile = {},
  llmExtracted?: any,
  modelOverride?: string
): Promise<{
  reply: string;
  applicant: ApplicantProfile;
  evalResult?: any;
  isComplete: boolean;
  missingFields: string[];
  updatedFields: string[];
}> {
  // Start with a clean copy of the existing applicant profile
  const applicant: ApplicantProfile = {
    ...existingApplicant,
    loanType: existingApplicant.loanType || "Personal Loan",
  };

  const { updates, updatedFieldLabels } = extractProfileUpdates(userMessage, llmExtracted);

  // STRICT REPLACEMENT: Replace old values with new values; old values are NEVER retained for calculation
  if (updates.monthlyIncome !== undefined) {
    applicant.monthlyIncome = updates.monthlyIncome;
  }
  if (updates.loanAmount !== undefined) {
    applicant.loanAmount = updates.loanAmount;
  }
  if (updates.tenureMonths !== undefined) {
    applicant.tenureMonths = updates.tenureMonths;
  }
  if (updates.cibil !== undefined) {
    applicant.cibil = updates.cibil;
  }
  if (updates.existingEmi !== undefined) {
    applicant.existingEmi = updates.existingEmi;
  }
  if (updates.age !== undefined) {
    applicant.age = updates.age;
  }
  if (updates.employmentType !== undefined) {
    applicant.employmentType = updates.employmentType;
  }
  if (updates.companyName !== undefined) {
    applicant.companyName = updates.companyName;
  }

  // If company was updated, resolve categories immediately to re-map bank tiers
  let companyMatch = applicant.companyName
    ? await resolveCompanyCategories(applicant.companyName)
    : undefined;
  if (companyMatch?.isFound && companyMatch.matchedName) {
    applicant.companyName = companyMatch.matchedName;
  }

  // If employmentType changed to Self-Employed and companyName is empty, label company as Self-Employed
  if (applicant.employmentType === "Self-Employed" && (!applicant.companyName || applicant.companyName === "Standard Corporate")) {
    applicant.companyName = "Self-Employed";
  }

  const missingFields = getRequiredPolicyFields(applicant, companyMatch, applicant.loanType || "Personal Loan");

  const updateAck =
    updatedFieldLabels.length > 0
      ? `🔄 **Details Updated**: Updated your ${updatedFieldLabels.join(", ")}.`
      : `🔄 **Details Updated**: Recorded your updated profile details.`;

  // If all required fields are complete, RECALCULATE IMMEDIATELY using the fresh profile!
  if (missingFields.length === 0) {
    const evalResult = await evaluateApplicantAgainstAllBanks(applicant, applicant.loanType || "Personal Loan");
    const report = formatDynamicEligibilityReport(applicant, evalResult);

    await saveEligibilityState(conversationId, {
      applicant,
      expectedField: "chosenBank",
      updatedAt: Date.now(),
      in_eligibility_flow: true,
      eligible_banks: (evalResult.eligibleBanks || []).map((b) => b.bankName),
      ineligibleBanks: (evalResult.ineligibleBanks || []).map((b) => ({
        bankName: b.bankName,
        failureReasons: b.failureReasons,
      })),
    } as any);

    return {
      reply: `${updateAck}\n\n${report}`,
      applicant,
      evalResult,
      isComplete: true,
      missingFields: [],
      updatedFields: updatedFieldLabels,
    };
  }

  // If still missing fields, prompt for the next missing field without repeating answered ones
  const nextField = missingFields[0];
  const nextQuestion = await generateDynamicSingleQuestionWithLLM(
    nextField,
    applicant,
    userMessage,
    modelOverride
  );

  await saveEligibilityState(conversationId, {
    applicant,
    expectedField: nextField,
    missingFields,
    updatedAt: Date.now(),
  });

  return {
    reply: `${updateAck}\n\n${nextQuestion}`,
    applicant,
    isComplete: false,
    missingFields,
    updatedFields: updatedFieldLabels,
  };
}

/**
 * Main entry point for conversational loan eligibility flow.
 * Strictly implements:
 * 1. Fresh chat isolation (never reuses answers from previous chats or users table).
 * 2. LLM-driven intent determination (no hardcoded phrases).
 * 3. Personal loan company-first resolution from bank_company_data.
 * 4. Dynamic policy-based parameter determination from active bank Master Policy rules.
 * 5. Single missing question at a time with no default values.
 * 6. Independent bank evaluation showing only eligible banks and recommending the best.
 */
export async function processDynamicEligibility(
  conversationId: string,
  userMessage: string,
  modelOverride?: string,
  preClassifiedIntent?: IntentClassificationResult,
  passedConversationHistory?: { role: string; content: string }[]
): Promise<DynamicEligibilityOutput> {
  const existingState = await getEligibilityState(conversationId);
  const isFlowActive = !!(
    existingState &&
    (existingState.expectedField ||
      (existingState.missingFields && existingState.missingFields.length > 0))
  );

  const contextNotes: ConversationalContextNotes = detectConversationalContext(
    userMessage,
    existingState?.contextNotes
  );
  const conversationHistory: { role: string; content: string }[] =
    passedConversationHistory && passedConversationHistory.length > 0
      ? [...passedConversationHistory]
      : existingState?.conversationHistory
      ? [...existingState.conversationHistory]
      : [];
  conversationHistory.push({ role: "user", content: userMessage });

  // 1. Determine user intent via LLM (or use pre-classified result)
  let intentResult = preClassifiedIntent;
  if (!intentResult) {
    intentResult = await classifyIntentWithLLM(
      userMessage,
      {
        isFlowActive,
        expectedField: existingState?.expectedField,
        existingApplicant: existingState?.applicant,
        recentMessages: conversationHistory,
      },
      modelOverride
    );
  }

  // Handle explicit reset/cancellation
  if ((intentResult.intent as any) === "CANCEL_RESET" || (intentResult.intent === "ANOTHER_TOPIC" && intentResult.subIntent === "CANCEL_RESET")) {
    await clearEligibilityState(conversationId);
    const resetMsg =
      "🔄 **Loan Eligibility Assessment Reset**\n\nYour previous assessment has been cleared. You can start fresh anytime by asking for a loan.";
    return {
      isComplete: false,
      missingFields: [],
      nextQuestion: resetMsg,
      applicant: {},
      formattedMarkdown: resetMsg,
    };
  }

  // Handle changing details
  if (intentResult.intent === "CHANGING_DETAILS") {
    let applicant: ApplicantProfile = existingState?.applicant ? { ...existingState.applicant } : { loanType: "Personal Loan" };
    const res = await applyProfileUpdateAndRecalculate(
      conversationId,
      userMessage,
      applicant,
      intentResult.extracted,
      modelOverride
    );
    return {
      isComplete: res.isComplete,
      missingFields: res.missingFields,
      nextQuestion: res.reply,
      applicant: res.applicant,
      companyMatch: res.evalResult?.companyMatch,
      evaluations: res.evalResult?.evaluations,
      eligibleBanks: res.evalResult?.eligibleBanks,
      ineligibleBanks: res.evalResult?.ineligibleBanks,
      recommendedBank: res.evalResult?.recommendedBank,
      recommendationReason: res.evalResult?.recommendationReason,
      formattedMarkdown: res.reply,
    };
  }

  const isNewLoanIntent =
    intentResult.intent === "LOAN_ELIGIBILITY" ||
    (intentResult as any).intent === "PERSONAL_LOAN_REQUEST" ||
    detectLoanIntent(userMessage, intentResult).isLoanIntent;

  // If no loan intent and no active flow, do NOT trigger company lookup or loan processing!
  if (!isNewLoanIntent && !isFlowActive) {
    return {
      isComplete: false,
      missingFields: [],
      nextQuestion: "",
      applicant: {},
      formattedMarkdown: "",
    };
  }

  // If an eligibility flow is active, check whether the user provided profile/financial answers
  const hasProfileInput =
    isFinancialOrProfileInput(userMessage) ||
    Boolean(detectTargetedFieldInMessage(userMessage, existingState?.expectedField)) ||
    Boolean(
      intentResult.extracted &&
        (intentResult.extracted.monthlyIncome !== undefined ||
          intentResult.extracted.cibil !== undefined ||
          intentResult.extracted.loanAmount !== undefined ||
          intentResult.extracted.tenureMonths !== undefined ||
          intentResult.extracted.existingEmi !== undefined ||
          intentResult.extracted.age !== undefined ||
          intentResult.extracted.employmentType !== undefined)
    );

  if (hasProfileInput) {
    intentResult.intent = "LOAN_ELIGIBILITY";
  }

  // If an eligibility flow is active, but the user asked an explicit bank manager search or external bank policy query,
  // let the central agent dispatch those specific tools.
  const isExplicitExternalToolQuery =
    /(?:manager|contact|branch\s*head|\basm\b|\brsm\b)/i.test(userMessage) ||
    (/(?:policy|guidelines?|rules?|criteria|cutoff)\s*(?:of|for)?\s+[A-Za-z0-9&'.-]+\s*bank/i.test(userMessage) && !/my|i|eligible|can\s*i/i.test(userMessage));

  const directSideQ = detectAndAnswerSideQuestion(userMessage, existingState?.expectedField);
  if (isFlowActive && !hasProfileInput && intentResult.intent !== "LOAN_ELIGIBILITY" && !directSideQ.isQuestion && isExplicitExternalToolQuery) {
    return {
      isComplete: false,
      missingFields: existingState?.missingFields || [],
      nextQuestion: "",
      applicant: existingState?.applicant || {},
      formattedMarkdown: "",
    };
  }

  // 2. Consolidate applicant details across the full conversation history and current message
  let applicant = consolidateApplicantProfileFromHistory(
    conversationHistory,
    userMessage,
    existingState?.applicant,
    intentResult?.extracted
  );

  if (intentResult.loanType) {
    applicant.loanType = intentResult.loanType;
  }

  // If applicant provided a company candidate, resolve against partner bank records
  if (applicant.companyName && applicant.companyName !== "Self-Employed") {
    const resolved = await resolveCompanyCategories(applicant.companyName);
    applicant.companyName = resolved.matchedName || applicant.companyName;
    if (!applicant.employmentType) applicant.employmentType = "Salaried";
  }

  // 3. Early definitive ineligibility check
  const definitiveCheck = checkDefinitiveIneligibility(applicant);
  if (definitiveCheck.isIneligible) {
    const explanation = await generateDefinitiveIneligibilityExplanationWithLLM(
      applicant,
      definitiveCheck,
      userMessage,
      modelOverride,
      conversationHistory
    );
    await clearEligibilityState(conversationId);
    return {
      isComplete: true,
      missingFields: [],
      applicant,
      formattedMarkdown: explanation,
      nextQuestion: explanation,
    };
  }

  // 4. If company is not resolved for salaried applicants, ask for companyName first
  const isNonSalaried =
    applicant.employmentType === "Unemployed" ||
    applicant.employmentType === "Student" ||
    applicant.employmentType === "Self-Employed";

  if (!applicant.companyName && !isNonSalaried) {
    const sideQ = detectAndAnswerSideQuestion(userMessage, "companyName");
    if (sideQ.isQuestion && sideQ.answer) {
      applicant._lastSideQuestion = sideQ.answer;
    }
    const nextQuestion = await generateDynamicSingleQuestionWithLLM(
      "companyName",
      applicant,
      userMessage,
      modelOverride,
      contextNotes,
      conversationHistory
    );
    conversationHistory.push({ role: "assistant", content: nextQuestion });
    await saveEligibilityState(conversationId, {
      applicant,
      expectedField: "companyName",
      missingFields: ["companyName"],
      updatedAt: Date.now(),
      contextNotes,
      conversationHistory: conversationHistory.slice(-10),
    });

    return {
      isComplete: false,
      missingFields: ["companyName"],
      nextQuestion,
      applicant,
      formattedMarkdown: nextQuestion,
    };
  }

  // 5. Dynamically determine required fields from active bank Master Policy rules
  const companyMatch = applicant.companyName ? await resolveCompanyCategories(applicant.companyName) : undefined;
  const missingFields = getRequiredPolicyFields(applicant, companyMatch, applicant.loanType || "Personal Loan");

  // 6. If all parameters collected, evaluate independently against all banks!
  if (missingFields.length === 0) {
    const evalResult = await evaluateApplicantAgainstAllBanks(applicant, applicant.loanType || "Personal Loan");
    const formattedMarkdown = formatDynamicEligibilityReport(applicant, evalResult);

    await saveEligibilityState(conversationId, {
      applicant,
      expectedField: "chosenBank",
      missingFields: [],
      updatedAt: Date.now(),
      in_eligibility_flow: false,
      eligible_banks: (evalResult.eligibleBanks || []).map((b) => b.bankName),
      ineligibleBanks: (evalResult.ineligibleBanks || []).map((b) => ({
        bankName: b.bankName,
        failureReasons: b.failureReasons,
      })),
    } as any);

    return {
      isComplete: true,
      missingFields: [],
      applicant,
      companyMatch: evalResult.companyMatch,
      evaluations: evalResult.evaluations,
      eligibleBanks: evalResult.eligibleBanks,
      reviewBanks: evalResult.reviewBanks,
      ineligibleBanks: evalResult.ineligibleBanks,
      recommendedBank: evalResult.recommendedBank,
      recommendationReason: evalResult.recommendationReason,
      formattedMarkdown,
    };
  }

  // 7. If fields are genuinely missing, ask ONLY the single next missing field
  const nextField = missingFields[0];
  const sideQ = detectAndAnswerSideQuestion(userMessage, nextField);
  if (sideQ.isQuestion && sideQ.answer) {
    applicant._lastSideQuestion = sideQ.answer;
  }

  const nextQuestion = await generateDynamicSingleQuestionWithLLM(
    nextField,
    applicant,
    userMessage,
    modelOverride,
    contextNotes,
    conversationHistory
  );

  conversationHistory.push({ role: "assistant", content: nextQuestion });

  await saveEligibilityState(conversationId, {
    applicant,
    expectedField: nextField,
    missingFields,
    updatedAt: Date.now(),
    contextNotes,
    conversationHistory: conversationHistory.slice(-10),
  });

  return {
    isComplete: false,
    missingFields,
    nextQuestion,
    applicant,
    formattedMarkdown: nextQuestion,
  };
}

export interface EntityValidationResult {
  sanitized: Partial<ApplicantProfile>;
  rejectedFields: string[];
  clarificationNeeded?: string;
  isAmbiguousNumber?: boolean;
}

/**
 * Deterministic Validation Firewall (Stage 6)
 * Strictly verifies field boundaries, prevents cross-field contamination,
 * and ensures salary (e.g. ₹39,000) NEVER becomes loanAmount.
 * Disallows guessing on ambiguous numbers (e.g. "76") without explicit context.
 */
export function validateAndSanitizeEntityUpdate(
  currentApplicant: ApplicantProfile,
  expectedField: string | undefined,
  extracted: Partial<ApplicantProfile>,
  userMessage: string
): EntityValidationResult {
  const sanitized: Partial<ApplicantProfile> = {};
  const rejectedFields: string[] = [];
  let clarificationNeeded: string | undefined = undefined;
  let isAmbiguousNumber = false;
  const raw = String(userMessage || "").trim();
  const lower = raw.toLowerCase();

  // 0. Strict Invariant: QUESTION != ENTITY UPDATE
  const isQuestion =
    /^(?:what|which|how|who|where|why|can\s*(?:you|i)|could|is\s*there|does|tell\s*me|explain)\b/i.test(lower) ||
    /\?$/.test(raw) ||
    /(?:documents\s*required|eligibility\s*criteria\s*for|what\s*documents|what\s*is\s*foir|explain\s*foir)/i.test(lower);

  const isNaturalLoanQuestion = /^(?:can\s*i\s*get\s*a\s*loan|can\s*i\s*get\s*personal\s*loan|am\s*i\s*eligible\s*for\s*(?:a\s*)?loan)/i.test(lower);

  if (isQuestion && !isNaturalLoanQuestion) {
    // Pure questions must NEVER mutate applicant state or extract numbers as entities!
    return {
      sanitized: {},
      rejectedFields: Object.keys(extracted),
      clarificationNeeded: undefined,
      isAmbiguousNumber: false,
    };
  }

  // 1. Check for ambiguous standalone numbers (The "76" Principle)
  const pureNumberMatch = raw.match(/^\s*(?:rs\.?|₹)?\s*(\d{1,8})\s*$/i);
  if (pureNumberMatch) {
    const val = parseInt(pureNumberMatch[1], 10);
    if (val > 0 && val <= 100) {
      if (expectedField === "cibil") {
        isAmbiguousNumber = true;
        clarificationNeeded = "CIBIL scores range from 300 to 900. Did you mean a different score?";
        return { sanitized, rejectedFields: Object.keys(extracted), clarificationNeeded, isAmbiguousNumber };
      } else if (expectedField === "loanAmount") {
        isAmbiguousNumber = true;
        clarificationNeeded = `Could you please clarify if by **${val}** you mean **₹${val} Lakhs** or **₹${val},000**? (Personal loans typically start from ₹50,000).`;
        return { sanitized, rejectedFields: Object.keys(extracted), clarificationNeeded, isAmbiguousNumber };
      } else if (expectedField === "monthlyIncome") {
        isAmbiguousNumber = true;
        clarificationNeeded = `Could you please clarify if by **${val}** you mean **₹${val},000/month**?`;
        return { sanitized, rejectedFields: Object.keys(extracted), clarificationNeeded, isAmbiguousNumber };
      } else if (!expectedField || expectedField === "companyName") {
        isAmbiguousNumber = true;
        clarificationNeeded = `Could you please clarify what ${val} refers to — is it your age in years, repayment tenure, or something else?`;
        return { sanitized, rejectedFields: Object.keys(extracted), clarificationNeeded, isAmbiguousNumber };
      }
    }
  }

  // 1b. Rate / percentage guard: Rates must NEVER contaminate CIBIL, age, or loan amount
  const hasRateMarker = /%|\bpercent\b|\brate\b|\broi\b/i.test(lower);

  // 2. Validate monthlyIncome
  if (extracted.monthlyIncome !== undefined) {
    const inc = Number(extracted.monthlyIncome);
    if (!isNaN(inc) && inc >= 8000 && inc <= 50000000 && !hasRateMarker) {
      sanitized.monthlyIncome = inc;
    } else {
      rejectedFields.push("monthlyIncome");
    }
  }

  // 3. Validate loanAmount with strict anti-salary and anti-pincode contamination
  if (extracted.loanAmount !== undefined) {
    const amt = Number(extracted.loanAmount);
    const hasExplicitBorrowMarker =
      /\b(?:loan\s*(?:of|amount|req|worth|for)?|borrow|need|want|require|looking\s+for|apply\s+for)\b/i.test(lower) &&
      !/\b(?:salary|income|earn|take[\s-]*home|per\s*month|monthly)\b/i.test(lower);

    const isSameAsSalary =
      (currentApplicant.monthlyIncome && amt === Number(currentApplicant.monthlyIncome)) ||
      (sanitized.monthlyIncome && amt === Number(sanitized.monthlyIncome));

    const isPotentialPincode =
      amt >= 100000 &&
      amt <= 999999 &&
      (lower.includes("pin") || lower.includes("pincode") || expectedField === "pincode" || expectedField === "location");

    if (isPotentialPincode || hasRateMarker) {
      rejectedFields.push("loanAmount");
    } else if (isSameAsSalary && !hasExplicitBorrowMarker && expectedField !== "loanAmount") {
      rejectedFields.push("loanAmount");
    } else if (!isNaN(amt) && amt >= 25000 && amt <= 200000000) {
      if (expectedField === "monthlyIncome" && !hasExplicitBorrowMarker) {
        rejectedFields.push("loanAmount");
      } else {
        sanitized.loanAmount = amt;
      }
    } else {
      rejectedFields.push("loanAmount");
    }
  }

  // 4. Validate age (Guard against tenure-to-age and rate-to-age contamination)
  if (extracted.age !== undefined) {
    const ageNum = Number(extracted.age);
    const isTenureContamination =
      !lower.includes("age") &&
      !lower.includes("old") &&
      expectedField !== "age" &&
      /\b(?:months?|yrs?|years?)\b/i.test(lower);

    if (!isNaN(ageNum) && ageNum >= 18 && ageNum <= 75 && !hasRateMarker && !isTenureContamination) {
      sanitized.age = ageNum;
    } else {
      rejectedFields.push("age");
    }
  }

  // 5. Validate CIBIL (Strict range 300 to 900; NEVER allow age, small numbers, or rates)
  if (extracted.cibil !== undefined) {
    if (typeof extracted.cibil === "string" && /not\s*provided|unknown|not\s*sure|don'?t\s*know|no\s*idea/i.test(extracted.cibil)) {
      sanitized.cibil = "Not provided";
    } else {
      const cibilNum = Number(extracted.cibil);
      if (!isNaN(cibilNum) && cibilNum >= 300 && cibilNum <= 900 && !hasRateMarker) {
        sanitized.cibil = cibilNum;
      } else if (cibilNum === 0 && /\b(?:0|zero)\b/i.test(lower)) {
        sanitized.cibil = 0;
      } else {
        rejectedFields.push("cibil");
      }
    }
  }

  // 6. Validate tenureMonths (convert years to months if <= 7)
  if (extracted.tenureMonths !== undefined) {
    let t = Number(extracted.tenureMonths);
    if (!isNaN(t) && !hasRateMarker) {
      if (t >= 1 && t <= 7) {
        t = t * 12;
      }
      if (t >= 6 && t <= 84) {
        sanitized.tenureMonths = t;
      } else {
        rejectedFields.push("tenureMonths");
      }
    }
  }

  // 7. Validate existingEmi
  if (extracted.existingEmi !== undefined) {
    const emi = Number(extracted.existingEmi);
    if (!isNaN(emi) && emi >= 0 && emi <= 20000000 && !hasRateMarker) {
      sanitized.existingEmi = emi;
    } else {
      rejectedFields.push("existingEmi");
    }
  }

  // 8. Validate companyName
  if (extracted.companyName !== undefined && typeof extracted.companyName === "string") {
    const comp = extracted.companyName.trim();
    if (comp.length >= 2 && !isInvalidCompanyName(comp) && !isFinancialOrProfileInput(comp) && !isKnownBankName(comp)) {
      sanitized.companyName = comp;
      if (!sanitized.employmentType) {
        sanitized.employmentType = "Salaried";
      }
    } else {
      rejectedFields.push("companyName");
    }
  }

  // 9. Validate employmentType & employmentStatus
  if (extracted.employmentType !== undefined) {
    sanitized.employmentType = extracted.employmentType;
  }
  if (extracted.employmentStatus !== undefined) {
    sanitized.employmentStatus = extracted.employmentStatus;
  }

  return { sanitized, rejectedFields, clarificationNeeded, isAmbiguousNumber };
}

/**
 * Deterministic Invariant Checker & Auto-Recovery (Stage 10)
 * Evaluates state and planned response to guarantee zero conversational contradictions,
 * zero repetitive guidance loops, zero EMI salary-conflations, and zero topic mismatches.
 */
export function runInvariantSanityChecks(
  session: SessionState,
  plannedReply: string,
  userMessage: string
): { isValid: boolean; correctedReply?: string; correctedSession?: SessionState } {
  const applicant = session.applicant || {};
  let correctedReply = plannedReply;
  let hasModifications = false;
  const updatedSession = { ...session };

  // Invariant 1: Anti-Conflation Guarantee
  // If applicant.loanAmount === applicant.monthlyIncome without explicit loan phrasing, reset loanAmount
  if (
    typeof applicant.monthlyIncome === "number" &&
    typeof applicant.loanAmount === "number" &&
    applicant.monthlyIncome > 0 &&
    applicant.loanAmount === applicant.monthlyIncome
  ) {
    const msgLower = userMessage.toLowerCase();
    const explicitBoth =
      /\b(?:loan|borrow|need)\b/i.test(msgLower) &&
      /\b(?:salary|income|earn|take[\s-]*home)\b/i.test(msgLower);

    if (!explicitBoth) {
      delete applicant.loanAmount;
      updatedSession.applicant = { ...applicant };
      hasModifications = true;
    }
  }

  // Invariant 2: Repetitive Prompt Guard
  // Never repeat the exact same prompt robotically if user typed a question or non-empty message
  if (
    session.lastAssistantQuestion &&
    plannedReply.trim() === session.lastAssistantQuestion.trim() &&
    userMessage.trim().length > 0
  ) {
    const fieldName = session.expectedField || "information";
    const friendlyMap: Record<string, string> = {
      monthlyIncome: "your approximate take-home salary each month (for example: ₹50,000)",
      loanAmount: "the loan amount you wish to borrow (for example: ₹5 Lakhs)",
      tenureMonths: "your preferred loan tenure in years or months (for example: 3 years)",
      cibil: "your approximate CIBIL credit score (e.g. 750, or 'not sure')",
      companyName: "the company or employer you work for (e.g. TCS, Infosys)",
    };
    const askDesc = friendlyMap[fieldName] || `your ${fieldName}`;
    correctedReply = `I want to make sure I understand you correctly! To check your loan options across all our partner banks, could you please share ${askDesc}?`;
    hasModifications = true;
  }

  // Invariant 3: Topic Mismatch / Salary Forcing Guard
  // If user requested company search or financial inquiry, ensure reply does NOT rigidly badger for salary
  const isCompanySearch = isCompanyInfoOrSearchIntent(userMessage);
  if (isCompanySearch && plannedReply.includes("Just need a quick number for your monthly salary")) {
    correctedReply = "I'd be glad to look up your company's corporate intelligence and partner bank category ratings!\n\nCould you please share your **employer or company name** (e.g. TCS, Infosys, Wipro)?";
    hasModifications = true;
  }

  return {
    isValid: !hasModifications,
    correctedReply: hasModifications ? correctedReply : undefined,
    correctedSession: hasModifications ? updatedSession : undefined,
  };
}
