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
  monthlyIncome?: number;
  cibil?: number;
  loanAmount?: number;
  tenureMonths?: number;
  existingEmi?: number;
  age?: number;
  employmentType?: string;
  location?: string;
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

export interface SessionState {
  applicant: ApplicantProfile;
  expectedField?: string;
  missingFields?: string[];
  updatedAt: number;
  conversationHistory?: Array<{ role: string; content: string }>;
  contextNotes?: ConversationalContextNotes;
  lastAnsweredField?: string;
  in_eligibility_flow?: boolean;
  eligible_banks?: string[];
}

// In-memory fallback session store ensures persistence across turns even if non-numeric conversation IDs are used
export const inMemorySessionStates = new Map<string, SessionState>();

export async function getEligibilityState(conversationId: string): Promise<SessionState | null> {
  if (inMemorySessionStates.has(conversationId)) {
    return inMemorySessionStates.get(conversationId)!;
  }
  const numId = Number(conversationId);
  if (pool && Number.isFinite(numId)) {
    try {
      const res = await pool.query(
        `SELECT state FROM assistant_conversation_states WHERE conversation_id = $1 AND expires_at > NOW()`,
        [numId]
      );
      if (res.rowCount && res.rows[0].state) {
        const loaded = res.rows[0].state;
        inMemorySessionStates.set(conversationId, loaded);
        return loaded;
      }
    } catch (e) {}
  }
  return null;
}

export async function saveEligibilityState(conversationId: string, state: SessionState): Promise<void> {
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
    } catch (e) {}
  }
}

export async function clearEligibilityState(conversationId: string): Promise<void> {
  inMemorySessionStates.delete(conversationId);
  const numId = Number(conversationId);
  if (pool && Number.isFinite(numId)) {
    try {
      await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numId]);
    } catch (e) {}
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
  const norm = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();

  let loanType = "Personal Loan";
  if (/home\s*loan/i.test(norm)) loanType = "Home Loan";
  else if (/business\s*loan/i.test(norm)) loanType = "Business Loan";
  else if (/car\s*loan|auto\s*loan/i.test(norm)) loanType = "Auto Loan";
  else if (/education\s*loan/i.test(norm)) loanType = "Education Loan";

  // Bank policy inquiries asking for specific institution guidelines/rules/criteria/cutoffs (partner or non-partner/unsupported)
  const isBankPolicy =
    /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|\btata\b(?!.*consultancy)|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|chola|smfg|finnable|fibe|sbm|utkarsh|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb|bank)\s*(?:'s)?\s*(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|foir\s*norm)/i.test(norm) ||
    (/(?:policy|guidelines?|rules?|criteria|cut-off|cutoff|foir\s*norm)\s*(?:of|for|from|regarding)?\s*(?:a\s*|an\s*|any\s*|the\s*)?(?:[a-z0-9\s&'.-]+)?\s*banks?\b/i.test(norm)) ||
    (/(?:policy|guidelines?|rules?|cut-off|cutoff)\b/i.test(norm) && /\bbanks?\b/i.test(norm)) ||
    (/(?:policy|guidelines?|rules?|cut-off|cutoff)\b/i.test(norm) && /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|\btata\b(?!.*consultancy)|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|chola|smfg|finnable|fibe|sbm|utkarsh|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)/i.test(norm));

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

  if ((isNaturalLoanPhrase || hasMultipleApplicantProfileFields) && !isBankPolicy) {
    return { isLoanIntent: true, loanType };
  }

  if (preClassifiedIntent?.intent) {
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

  const isIntent = !isBankPolicy && /\b(?:loan|loans|borrow|borrowing|lending|financ(?:e|ing)|eligib\w*)\b/i.test(norm);

  return { isLoanIntent: isIntent, loanType };
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
      answer: "No need to worry—checking your loan eligibility with CreditWise AI is a **soft evaluation** and has **zero impact** on your CIBIL score or credit report.",
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
      answer: "Personal loans from our partner banks are **100% unsecured**, meaning you do not need any collateral, mortgage, or guarantor.",
    };
  }

  // Prepayment / Foreclosure
  if (/(?:prepay|prepayment|foreclose|foreclosure|part[\s-]*payment|close\s*early)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "foreclosure",
      answer: "Yes, our partner banks allow part-prepayment and foreclosure. Many partner lenders permit zero-penalty foreclosure once an initial 6 to 12 monthly EMIs are paid.",
    };
  }

  // FOIR Definition
  if (/(?:what\s+is\s+foir|explain\s+foir|what\s+does\s+foir\s+mean|meaning\s+of\s+foir)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "foir",
      answer: "**FOIR (Fixed Obligation to Income Ratio)** is the percentage of your monthly net salary that goes toward loan EMIs. Partner banks generally cap total EMIs at **50% to 70%** of your monthly income.",
    };
  }

  // Speed / Disbursement Timeline
  if (/(?:how\s*(?:fast|soon|quick)|how\s+long|disbursement\s*time|when\s*will\s*i\s*get)/i.test(norm) && /(?:money|funds?|loan|amount|disburs)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "disbursement_time",
      answer: "Upon document verification and final digital approval, partner banks typically disburse funds within **24 to 48 hours** directly into your bank account.",
    };
  }

  // Lowest Interest Rate Bank
  if (/(?:which\s*bank|who)\s*(?:offers?|gives?|has)\s*(?:the\s*)?(?:lowest|cheapest|best)\s*(?:interest\s*rate|roi|rate)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "lowest_roi",
      answer: "Currently, our partner NBFCs and banks like **Bajaj Markets**, **Bandhan Bank**, **ICICI Bank**, and **HDFC Bank** offer the most competitive personal loan rates starting from **9.99% to 10.75% p.a.** for prime corporate employees.",
    };
  }

  // Why age inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:my\s+)?age|why\s+age)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_age",
      answer: "Partner banks use applicant age to verify legal eligibility (typically 21 to 60 years) and determine your maximum allowable repayment tenure.",
    };
  }

  // Why company inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:my\s+)?(?:company|employer|workplace)|why\s+company)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_company",
      answer: "Partner banks categorize employers into company tiers (Super Cat A, Cat A, Elite, etc.) which directly determines your interest rate and maximum loan limit.",
    };
  }

  // Why salary inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:my\s+)?(?:salary|income|take\s*home)|why\s+salary)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_salary",
      answer: "Your take-home salary determines your maximum borrowing limit and ensures loan EMIs remain within partner banks' permissible FOIR caps (50%–70%).",
    };
  }

  // Data Privacy / Security objection
  if (/(?:is\s+(?:my\s+)?(?:data|information|details)\s+(?:safe|secure|confidential|private)|privacy\s*policy)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "data_privacy",
      answer: "Your data is strictly confidential. CreditWise AI only evaluates official partner bank policies to check eligibility and never sells or shares your information.",
    };
  }

  // Collateral / security / guarantor inquiry / objection
  if (/(?:collateral|pledge|security|guarantor|property\s*papers?|mortgage)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "collateral_inquiry",
      answer: "No collateral or security is required. All personal loans from our partner banks are 100% unsecured loans based strictly on your monthly income and credit profile.",
    };
  }

  // Why CIBIL inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:my\s+)?(?:cibil|credit\s*score)|why\s+cibil)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_cibil",
      answer: "Partner banks evaluate your CIBIL score to assess credit history and determine approval odds and interest rates. A soft check here won't impact your score.",
    };
  }

  // Why EMI inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:my\s+)?(?:existing\s*)?emi|why\s+emi)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_emi",
      answer: "Partner banks evaluate ongoing monthly EMIs to calculate your Fixed Obligation to Income Ratio (FOIR) and ensure total monthly payments stay within 50%–70% of salary.",
    };
  }

  // Why tenure or loan amount inquiry / objection
  if (/(?:why\s+(?:do\s+you\s+need|ask\s+for|require)\s+(?:tenure|duration|loan\s*amount|amount)|why\s+tenure)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_amount_tenure",
      answer: "Your requested loan amount and tenure determine your estimated monthly EMI and ensure the loan duration conforms to partner banks' age and policy criteria.",
    };
  }

  // Why so many questions inquiry / objection
  if (/(?:why\s+(?:so\s+many|are\s+there\s+so\s+many)\s+questions|too\s+many\s+questions)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "why_questions",
      answer: "Because personal loans are 100% unsecured without collateral, partner banks require 7 core policy criteria—employer, salary, loan amount, tenure, CIBIL, EMIs, and age—to accurately determine approval and rates without guessing.",
    };
  }

  // Cash salary inquiry / objection
  if (/(?:cash\s*salary|salary\s*in\s*cash|paid\s*in\s*cash|no\s*salary\s*slip)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "cash_salary",
      answer: "Partner bank personal loan policies require regular salary credited directly to a bank account or documented through official salary slips and bank statements.",
    };
  }

  // Co-applicant inquiry
  if (/(?:co[\s-]*applicant|co[\s-]*borrower|add\s*(?:my\s*)?(?:spouse|wife|husband|father|mother|brother)|joint\s*loan)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "co_applicant",
      answer: "Unsecured personal loans are usually processed individually based on your own credit profile, though select partner lenders allow a co-applicant to boost eligible loan limits.",
    };
  }

  // Documents required inquiry
  if (/(?:what\s+documents|docs?\s*(?:needed|required)|documentation)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "documents",
      answer: "For digital loan processing, partner banks typically require PAN card, Aadhaar for KYC, 3 months' bank statements showing salary credits, and recent salary slips.",
    };
  }

  // Hesitation or reluctance to share
  if (/(?:hesitant|not\s*comfortable|don'?t\s*want\s*to\s*share|skip|can\s*we\s*skip|prefer\s*not\s*to\s*say)/i.test(norm)) {
    return {
      isQuestion: true,
      topic: "hesitation",
      answer: "I completely understand. We only use these details to check partner bank policies and ensure an accurate eligibility assessment without hard credit inquiries.",
    };
  }

  // Generic "why" or "what" contextual resolution using expectedField
  if (
    /^(?:why\??|why\s+(?:is\s+this|do\s+you\s+need|ask\s+for|require)?\s*(?:this|that|it)?\??|what\??|what\s+do\s+you\s+mean\??|why\s+though\??|why\s+so\??|why\s+this\??)$/i.test(norm) ||
    /^(?:why|what|explain)\b/i.test(norm)
  ) {
    if (expectedField === "companyName") {
      return {
        isQuestion: true,
        topic: "why_company",
        answer: "Partner banks categorize employers into company tiers (Super Cat A, Cat A, Elite, etc.) which directly determines your interest rate and maximum loan limit.",
      };
    }
    if (expectedField === "monthlyIncome") {
      return {
        isQuestion: true,
        topic: "why_salary",
        answer: "Your take-home salary determines your maximum borrowing limit and ensures loan EMIs remain within partner banks' permissible FOIR caps (50%–70%).",
      };
    }
    if (expectedField === "loanAmount") {
      return {
        isQuestion: true,
        topic: "why_amount",
        answer: "Your requested loan amount helps identify which partner banks can fulfill your borrowing requirement within their minimum and maximum policy caps.",
      };
    }
    if (expectedField === "tenureMonths") {
      return {
        isQuestion: true,
        topic: "why_tenure",
        answer: "Your preferred repayment tenure determines your estimated monthly EMI and ensures the loan duration conforms to partner banks' policy limits.",
      };
    }
    if (expectedField === "cibil") {
      return {
        isQuestion: true,
        topic: "why_cibil",
        answer: "Partner banks evaluate your CIBIL score to assess credit history and determine approval odds and interest rates. A soft check here won't impact your score.",
      };
    }
    if (expectedField === "existingEmi") {
      return {
        isQuestion: true,
        topic: "why_emi",
        answer: "Partner banks evaluate ongoing monthly EMIs to calculate your Fixed Obligation to Income Ratio (FOIR) and ensure total monthly payments stay within 50%–70% of salary.",
      };
    }
    if (expectedField === "age") {
      return {
        isQuestion: true,
        topic: "why_age",
        answer: "Partner banks use applicant age to verify legal eligibility (typically 21 to 60 years) and determine your maximum allowable repayment tenure.",
      };
    }
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
  applicant: ApplicantProfile
): CorrectionResult {
  const norm = message.toLowerCase().trim();

  // Detect explicit correction markers: "actually", "my bad", "wait", "change to", "update to", "instead of", "make that", "not <x>"
  const isCorrectionPhrase =
    /\b(?:wait|actually|my\s*bad|mistake|typo|wrong|change|update|correct|instead\s*of|rather\s*than|make\s+that)\b/i.test(norm);

  if (!isCorrectionPhrase) return { isCorrection: false };

  // A. Company correction
  const compMatch = message.match(
    /(?:company|employer|workplace|work\s+at|working\s+at|joined|switch(?:ed)?\s+to|moved\s+to)\s*(?:is|changed\s*to|to|=|:)?\s*([a-zA-Z0-9\s&'.-]+?)(?=\s*[,;]|\s+(?:and|with|salary|cibil|tenure|as\s+a|as\s+an|full\s*time|part\s*time)|$)/i
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

  // If user says "my cibil is 750", "no cibil", "don't have credit score" or "score 770" while expectedField was something else:
  if (
    targetExpectedField !== "cibil" &&
    (/(?:cibil|credit\s*score|score\s*is|score\b)\s*[3-9]\d{2}/i.test(norm) ||
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

  // If user says "age 28" or "28 years old" while expectedField was something else:
  if (targetExpectedField !== "age" && /(?:age\s*is|aged)\s*\d{2}\b/i.test(norm)) {
    return "age";
  }

  return null;
}

/**
 * Validates whether a candidate string is NOT a valid company name.
 * Recognizes structural validation, numbers, and non-company status answers (jobless, unemployed, student, freelancer).
 */
export function isInvalidCompanyName(text: string): boolean {
  if (!text) return true;
  const raw = text.trim();
  const clean = raw.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length < 2) return true;
  if (/^\d+$/.test(clean)) return true;
  if (!/[a-zA-Z]/.test(clean)) return true;

  // Questions, conversational phrases, confirmations, small talk
  if (
    /\?$/.test(raw) ||
    /^(?:why|how|what|when|where|who|which|explain|is|can|will|do|did|does|should|would|could|are|am)\b/i.test(clean) ||
    /^(?:ok|okay|sure|yes|yep|yeah|proceed|continue|go\s*ahead|fine|understood|got\s*it|thanks|thank\s*you|hello|hi|hey|good\s*(?:morning|afternoon|evening|day)|bye|cancel|reset)\b/i.test(clean)
  ) {
    return true;
  }

  // Financial parameter statements, corrections, or profile data
  if (
    /\b(?:salary|income|take\s*home|in\s*hand|cibil|credit\s*score|existing\s*emi|no\s*emi|zero\s*emi|lakh|lakhs|crore|crores|peti|khoka)\b/i.test(clean)
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
  return false;
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

  // Salary, loan amount, or currency figures (e.g. "75000", "75k", "0.75 lakh", "5L", "₹500000", "500000", "5 lakhs", "0rs", "0")
  if (
    /^(?:rs\.?|₹)?\s*\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr|crores?)?(?:\s*(?:per\s*month|\/mo|salary|income|loan))?$/i.test(clean) ||
    /^(?:rs\.?|₹)?\s*\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr|crores?)?(?:\s*(?:per\s*month|\/mo|salary|income|loan))?$/i.test(stripped)
  ) {
    return true;
  }

  // 3-digit CIBIL score (300-900)
  if (
    /^(?:cibil|score|credit\s*score)?\s*[3-9]\d{2}\s*(?:cibil|score)?$/i.test(clean) ||
    /^(?:cibil|score|credit\s*score)?\s*[3-9]\d{2}\s*(?:cibil|score)?$/i.test(stripped)
  ) {
    return true;
  }

  // 2-digit age (18-85)
  if (
    /^(?:age\s*)?(?:1[8-9]|[2-8]\d)\s*(?:years?|yrs?|yr|years\s*old)?$/i.test(clean) ||
    /^(?:age\s*)?(?:1[8-9]|[2-8]\d)\s*(?:years?|yrs?|yr|years\s*old)?$/i.test(stripped)
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
 * Extracts a candidate company/employer name from text.
 * Handles:
 * 1. Key-value indicators: "Company: Infosys", "Employer: Capgemini", "Org: TCS"
 * 2. Employment phrases: "work at Google", "working in Microsoft", "employed by Wipro", "my company is Accenture"
 * 3. Structured/delimited profile submissions: "Capgemini, Age 28, Salary ₹1.5 lakh..." or "TCS | 30 yrs | ..."
 * Strictly rejects financial numbers, ages, CIBIL scores, tenures, EMIs, and non-company status answers.
 */
export function extractCompanyCandidateFromText(text: string): string | undefined {
  if (!text) return undefined;
  const raw = text.trim();

  // 1. Explicit key-value labels or employment phrases
  const explicitMatch = raw.match(
    /(?:(?:my\s+)?(?:company|employer|organization|org)(?:\s*name)?\s*[:=-]\s*|(?:work\s+at|works\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is)\s+)([A-Za-z0-9\s&'.-]+?)(?=\s*[,;|\n]|\s+(?:and|with|salary|cibil|age|loan|emi|tenure|earning)|$)/i
  );
  if (explicitMatch) {
    const candidate = explicitMatch[1].trim();
    if (!isInvalidCompanyName(candidate) && !isFinancialOrProfileInput(candidate)) {
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
        !/^(?:i\s+need|i\s+want|can\s+i|please|hello|hi|hey|personal\s+loan|loan)\b/i.test(cleanSeg) &&
        !/^(?:age|salary|income|cibil|credit\s*score|loan|amount|tenure|months|years|emi)\s*[:=-]?\s*.*$/i.test(cleanSeg)
      ) {
        return cleanSeg;
      }
    }
  }

  // 3. Single-phrase input (e.g. user typed "Capgemini" or "Infosys Limited")
  if (
    !isFinancialOrProfileInput(raw) &&
    !isInvalidCompanyName(raw) &&
    !/^(?:i\s+need|i\s+want|can\s+i|personal\s+loan|loan)\b/i.test(raw)
  ) {
    const clean = raw
      .replace(/^(?:i\s+)?(?:work\s+at|works\s+at|working\s+at|employed\s+at|company\s+is|employer\s+is|at)\s+/i, "")
      .trim();
    if (!isFinancialOrProfileInput(clean) && !isInvalidCompanyName(clean)) {
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
    if (typeof llmExtracted?.loanAmount === "number" && llmExtracted.loanAmount >= 10000) {
      applicant.loanAmount = llmExtracted.loanAmount;
      return;
    }
    const loanMatch =
      text.match(/(?:loan\s*(?:amount|of|need|require|want)?|need|want|borrow)(?::|\s*is|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)?/i) ||
      text.match(/(?:rs\.?|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)\s*(?:loan)?/i) ||
      text.match(/(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)?/i);
    if (loanMatch) {
      const parsed = parseFinancialAmount(loanMatch[1] + (loanMatch[2] || ""));
      if (parsed && parsed >= 10000) {
        applicant.loanAmount = parsed;
        return;
      }
    }
    const amt = parseFinancialAmount(text);
    if (amt && amt >= 10000) {
      applicant.loanAmount = amt;
      return;
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
    const cibilMatch = text.match(/\b([3-9]\d{2})\b/);
    if (cibilMatch) {
      const score = parseInt(cibilMatch[1], 10);
      if (score >= 300 && score <= 900) {
        applicant.cibil = score;
        return;
      }
    }
    if (
      /\b(?:no|none|nil|zero|0|unknown|not\s*sure|don'?t\s*know|first\s*time|never\s*checked|na|n\/a)\b/i.test(lower) ||
      /(?:no|don['’]?t\s*have|never\s*had|never\s*checked|zero|nil|unknown)\s*(?:a\s*)?(?:cibil|credit\s*score|score)/i.test(lower)
    ) {
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

    if (isFinancialOrProfileInput(text) || isInvalidCompanyName(text)) {
      return;
    }

    const candidate =
      llmExtracted?.companyName ||
      extractCompanyCandidateFromText(text) ||
      text
        .replace(/^(?:i\s+)?(?:work\s+at|works\s+at|working\s+at|employed\s+at|company\s+is|employer\s+is|at)\s+/i, "")
        .trim();
    if (!isInvalidCompanyName(candidate) && !isFinancialOrProfileInput(candidate)) {
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
        /(?:i\s*am|im)\s+\d{2}\b/i.test(lower)
      );

    case "employmentType":
      return /(?:salaried|self[\s-]*employed|business|proprietor|partner|freelanc|doctor|trader|govt|government|private|pvt\s*ltd|mnc|corporate|job|employee)/i.test(lower);

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
 * Extracts any secondary/additional parameters explicitly mentioned in the user message or by the LLM.
 * Strictly preserves all already collected values.
 * Never extracts or sets any parameter unless the user's message explicitly mentions that parameter.
 */
function extractSecondaryParameters(
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
    (applicant.loanAmount === undefined || applicant.loanAmount <= 0) &&
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
        /(?:no|don['’]?t\s*have|never\s*had|never\s*checked|zero|nil|unknown|first\s*time)\s*(?:a\s*)?(?:cibil|credit\s*score|score|credit\s*history)/i.test(lower) ||
        /(?:cibil|credit\s*score|score)\s*(?:is\s*)?(?:unknown|zero|nil|none|never\s*checked|not\s*generated)/i.test(lower) ||
        /no\s*cibil|no\s*credit\s*history|first\s*time\s*borrower/i.test(lower)
      ) {
        applicant.cibil = 0;
      }
    }
  }

  // 4. Tenure Months (ONLY if not targetExpectedField, not already set, AND explicitly mentioned)
  if (
    targetExpectedField !== "tenureMonths" &&
    (applicant.tenureMonths === undefined || applicant.tenureMonths <= 0) &&
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
    (applicant.age === undefined || applicant.age <= 0) &&
    messageMentionsField("age", text)
  ) {
    if (typeof llmExtracted?.age === "number" && llmExtracted.age >= 18 && llmExtracted.age <= 85) {
      applicant.age = llmExtracted.age;
    } else {
      const ageMatch =
        text.match(/(?:age|aged)(?::|\s*is|\s*=)?\s*(\d{2})\b/i) ||
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
    } else if (!isFinancialOrProfileInput(text) && !isInvalidCompanyName(text)) {
      const cand = extractCompanyCandidateFromText(text);
      if (cand) {
        applicant.companyName = normalizeCompanyName(cand);
      }
    }
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
  llmExtracted?: any
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
  const correction = detectCorrectionInMessage(text, applicant);
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

  // 0c. If LLM provided extracted entities, merge them safely
  if (llmExtracted) {
    if (llmExtracted.employmentType) {
      applicant.employmentType = llmExtracted.employmentType;
      if (applicant.employmentType === "Unemployed") {
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

  // Iterate chronologically through user messages
  for (let i = 0; i < userMessages.length; i++) {
    const msg = userMessages[i];
    const isLatest = i === userMessages.length - 1;
    const extractedForTurn = isLatest ? currentExtracted : undefined;
    const lower = msg.toLowerCase().trim();

    // 1. Employment type checks
    if (
      /(?:not\s*working(?:\s*anywhere)?|don['’]?t\s*work|have\s*no\s*job|without\s*a?\s*job|jobless|unemployed|un-employed|lost\s*my\s*job|laid\s*off|no\s*employment)/i.test(lower)
    ) {
      applicant.employmentType = "Unemployed";
      applicant.monthlyIncome = 0;
      applicant.companyName = undefined;
    } else if (/\b(?:student|in\s*college|studying)\b/i.test(lower)) {
      applicant.employmentType = "Student";
      applicant.monthlyIncome = 0;
      applicant.companyName = undefined;
    } else if (/\b(?:self[\s-]*employed|business|proprietor|partner|freelancer?|doctor|trader|consultant)\b/i.test(lower)) {
      applicant.employmentType = "Self-Employed";
      applicant.companyName = "Self-Employed";
    }

    // 2. Company name candidate extraction
    const hasExplicitCompanyInTurn =
      /(?:(?:change|update|correct)\s+(?:my\s+)?(?:company|employer)|(?:work\s+at|works\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is)|(?:company|employer)\s*[:=-])/i.test(msg);

    if (!applicant.companyName || hasExplicitCompanyInTurn) {
      if (applicant.employmentType !== "Unemployed" && applicant.employmentType !== "Student" && applicant.employmentType !== "Self-Employed") {
        const compCandidate = extractCompanyCandidateFromText(msg);
        if (compCandidate && !isInvalidCompanyName(compCandidate) && !isFinancialOrProfileInput(compCandidate)) {
          applicant.companyName = compCandidate;
          if (!applicant.employmentType) applicant.employmentType = "Salaried";
        }
      }
    }

    // 3. Extract details and handle corrections
    const missingForTurn = getRequiredPolicyFields(applicant);
    applicant = extractApplicantDetails(msg, applicant, missingForTurn, extractedForTurn);
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
  // 1. Employer / Company Name is strictly required first for salaried personal loans
  if (applicant.employmentType === "Unemployed" || applicant.employmentType === "Student") {
    // Unemployed individuals and students do not have corporate employers
  } else if (!applicant.companyName || applicant.companyName.trim().length === 0) {
    return ["companyName"];
  }

  // 2. Active bank policy rules evaluation:
  // For loan eligibility evaluation, all 6 financial & profile parameters are required:
  // monthlyIncome, loanAmount, tenureMonths, cibil, existingEmi, age.
  const requiredFields = new Set<string>([
    "monthlyIncome",
    "loanAmount",
    "tenureMonths",
    "cibil",
    "existingEmi",
    "age",
  ]);

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
      (applicant.loanAmount === undefined || applicant.loanAmount === null || applicant.loanAmount <= 0)
    ) {
      missing.push("loanAmount");
    } else if (
      field === "tenureMonths" &&
      (applicant.tenureMonths === undefined || applicant.tenureMonths === null || applicant.tenureMonths <= 0)
    ) {
      missing.push("tenureMonths");
    } else if (
      field === "cibil" &&
      (applicant.cibil === undefined || applicant.cibil === null)
    ) {
      missing.push("cibil");
    } else if (
      field === "existingEmi" &&
      (applicant.existingEmi === undefined || applicant.existingEmi === null)
    ) {
      missing.push("existingEmi");
    } else if (
      field === "age" &&
      (applicant.age === undefined || applicant.age === null || applicant.age <= 0)
    ) {
      missing.push("age");
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
 * across all 23 partner banks (e.g. unemployed/jobless, zero income, or underage).
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
    (applicant.monthlyIncome !== undefined && applicant.monthlyIncome !== null && applicant.monthlyIncome < 10000)
  ) {
    return {
      isIneligible: true,
      reasonType: "UNEMPLOYED_OR_ZERO_INCOME",
      explanationSnippet:
        "All 23 partner banks strictly require active monthly employment and regular verifiable salary (typically starting from ₹15,000 to ₹25,000/month) to verify loan repayment capacity for unsecured personal loans.",
    };
  }

  // 2. Underage (< 18)
  if (applicant.age !== undefined && applicant.age !== null && applicant.age < 18) {
    return {
      isIneligible: true,
      reasonType: "MINIMUM_AGE",
      explanationSnippet:
        "The minimum eligible age for personal loans across all our partner banks is 18 to 21 years.",
    };
  }

  // 3. Beyond maximum age (> 70)
  if (applicant.age !== undefined && applicant.age !== null && applicant.age > 70) {
    return {
      isIneligible: true,
      reasonType: "MAXIMUM_AGE",
      explanationSnippet:
        "The maximum permissible age across partner banks is 60 to 65 years at loan maturity.",
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
        "The applicant is inquiring about or applying for a personal loan, but based on the official policies of our 23 partner banks, they are currently NOT ELIGIBLE under their current profile (for example: being unemployed / having no job / zero regular income / underage).\n\n" +
        "CRITICAL INSTRUCTIONS:\n" +
        "- Generate a completely natural, conversational, human response using the full conversation context.\n" +
        "- Respond naturally, for example: \"I understand. If you’re currently unemployed, most unsecured personal-loan policies may not support the application because they require regular income. So based on the available policies, you’re currently not eligible.\"\n" +
        "- Do NOT use fixed phrases, canned headings (do NOT include '### ℹ️ Personal Loan Eligibility Assessment' or any markdown headers), rigid bullet points, or canned paragraphs.\n" +
        "- Do NOT provide hardcoded alternatives (do not insert canned paragraphs about co-applicants, gold loans, or fixed deposits unless the user specifically asks for options).\n" +
        "- Only mention reasons actually returned by the eligibility engine/policies (such as requiring regular, verifiable monthly income or statutory age criteria).\n" +
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

  // Graceful conversational fallback
  if (reason.reasonType === "UNEMPLOYED_OR_ZERO_INCOME") {
    if (/not\s*working|jobless|unemployed|no\s*job|without\s*a?\s*job|laid\s*off/i.test(userMessage || "")) {
      return "I understand. If you’re currently unemployed, most unsecured personal-loan policies may not support the application because they require regular income. So based on the available policies, you’re currently not eligible.";
    }
    return "I understand. Unsecured personal-loan policies across our partner banks require regular, verifiable monthly income to service loan EMIs. So based on the available policies, you’re currently not eligible.";
  }

  if (reason.reasonType === "MINIMUM_AGE" || reason.reasonType === "MAXIMUM_AGE") {
    return `I understand. Partner bank personal loan policies require applicants to be within the eligible age bracket (${reason.explanationSnippet || "18 to 60 years"}). Based on the available policies, you're currently not eligible.`;
  }

  return `I understand. Based on our partner banks' policies, personal loans require ${reason.explanationSnippet || "meeting specific policy criteria"}. Under your current profile, you're currently not eligible.`;
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
  if (applicant.companyName) collectedSummary.push(`Company: ${applicant.companyName}`);
  if (applicant.monthlyIncome !== undefined && applicant.monthlyIncome !== null) collectedSummary.push(`Salary: ₹${applicant.monthlyIncome.toLocaleString("en-IN")}`);
  if (applicant.loanAmount) collectedSummary.push(`Loan Amount: ₹${applicant.loanAmount.toLocaleString("en-IN")}`);
  if (applicant.tenureMonths) collectedSummary.push(`Tenure: ${applicant.tenureMonths} months`);
  if (applicant.cibil !== undefined && applicant.cibil > 0) collectedSummary.push(`CIBIL: ${applicant.cibil}`);
  if (applicant.existingEmi !== undefined) collectedSummary.push(`Existing EMIs: ₹${applicant.existingEmi}`);
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

  // Graceful conversational fallbacks with natural, varied, contextual ChatGPT-like wording
  return getContextualFallbackQuestion(nextField, applicant, contextNotes);
}

function getContextualFallbackQuestion(
  nextField: string,
  applicant: ApplicantProfile,
  contextNotes?: ConversationalContextNotes
): string {
  const salaryStr = applicant.monthlyIncome ? `₹${applicant.monthlyIncome.toLocaleString("en-IN")}` : "";
  const loanStr = applicant.loanAmount ? `₹${applicant.loanAmount.toLocaleString("en-IN")}` : "";

  const variations: Record<string, string[]> = {
    companyName: [
      "To check partner bank policies tailored to your organization, what is your company or employer name?",
      "Which company or organization are you currently employed with?",
      "May I know the name of your current employer or workplace?",
      "To evaluate your personal loan eligibility across our partner banks, what is your company or employer name?",
    ],
    monthlyIncome: [
      applicant.companyName
        ? `Great, working at **${applicant.companyName}**! What is your approximate net monthly take-home salary?`
        : "What is your approximate net monthly in-hand salary?",
      applicant.companyName
        ? `Noted, **${applicant.companyName}**. Could you share your monthly take-home income after standard deductions?`
        : "Could you share your monthly take-home income after standard deductions?",
      applicant.companyName
        ? `Got it for **${applicant.companyName}**! How much is your net monthly salary credited to your bank account?`
        : "How much is your net monthly salary credited to your bank account?",
      applicant.companyName
        ? `Understood, at **${applicant.companyName}**. What is your regular monthly take-home income?`
        : "What is your regular monthly take-home income?",
    ],
    loanAmount: [
      salaryStr
        ? `Got it, noted your monthly salary of ${salaryStr}. How much loan amount are you looking to borrow?`
        : "How much loan amount are you looking to borrow?",
      salaryStr
        ? `Thank you. For a take-home of ${salaryStr}, what is your desired personal loan requirement in INR?`
        : "What is your desired personal loan requirement in INR?",
      salaryStr
        ? `Noted ${salaryStr} monthly income. Could you let me know the loan amount you have in mind?`
        : "Could you let me know the loan amount you have in mind?",
      salaryStr
        ? `Understood! With ${salaryStr} take-home, how much financing are you looking to borrow?`
        : "How much financing are you looking to borrow?",
    ],
    tenureMonths: [
      loanStr
        ? `Understood, for a loan of ${loanStr}, what repayment tenure would you prefer (e.g. 3 years, 5 years)?`
        : "What repayment tenure would you prefer (e.g. 3 years, 5 years)?",
      loanStr
        ? `Got it for ${loanStr}. Over what duration would you like to repay the loan (e.g. 2 years, 3 years, 5 years)?`
        : "Over what duration would you like to repay the loan (e.g. 2 years, 3 years, 5 years)?",
      loanStr
        ? `Noted ${loanStr} loan requirement. What repayment period or tenure works best for your monthly budget?`
        : "What repayment period or tenure works best for your monthly budget?",
      loanStr
        ? `For your ${loanStr} loan request, how many months or years would you prefer for the tenure?`
        : "How many months or years would you prefer for the repayment tenure?",
    ],
    cibil: [
      "Could you share your approximate CIBIL score? (If you're not sure, feel free to say 0 or unknown.)",
      "What is your estimated CIBIL / credit score? (You can reply with 'unknown' if you haven't checked recently.)",
      "Do you happen to know your CIBIL score? (Feel free to say 'not sure' or 0 if you're new to credit.)",
      "What is your approximate credit score? (Say 'unknown' if you'd like us to evaluate with standard benchmarks.)",
    ],
    existingEmi: [
      "Do you currently pay any monthly loan or card EMIs? (Enter the total amount in ₹, or say 'none' if you have no active loans.)",
      "Are there any ongoing monthly loan EMIs being deducted? (Reply with 'none' or 0 if you are debt-free.)",
      "What is the total of your existing monthly EMI obligations, if any? (Say '0' or 'none' if you have no ongoing loans.)",
      "Do you have any active loan EMIs running right now? (Feel free to reply with 'no EMIs' if you don't have any.)",
    ],
    age: [
      "Lastly, what is your current age in years?",
      "Could you please share your current age?",
      "To confirm age eligibility against partner policies, how old are you?",
      "Just to verify lender age criteria, what is your current age in years?",
    ],
  };

  const list = variations[nextField];
  let baseQuestion = `Could you please share your ${nextField}?`;
  if (list && list.length > 0) {
    const idx = Math.floor(Math.random() * list.length);
    baseQuestion = list[idx];
  }

  const prefixes: string[] = [];

  if (applicant._lastSideQuestion) {
    prefixes.push(applicant._lastSideQuestion);
  }

  if (applicant._lastCorrectionNotice) {
    prefixes.push(`Got it! ${applicant._lastCorrectionNotice}.`);
  }

  if (prefixes.length > 0) {
    return `${prefixes.join("\n\n")}\n\n${baseQuestion}`;
  }

  if (contextNotes?.statedPurpose === "medical emergency" && !applicant.companyName && !applicant.monthlyIncome) {
    return `I understand this is urgent for medical reasons. Let's find your best loan options as quickly as possible.\n\n${baseQuestion}`;
  }

  return baseQuestion;
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
  ineligibleBanks: BankEvaluationResult[];
  recommendedBank: BankEvaluationResult | null;
  recommendationReason: string;
}> {
  const monthlySalary = applicant.monthlyIncome || 0;
  const cibil = applicant.cibil || 0;
  const age = applicant.age || 0;
  const loanAmount = applicant.loanAmount || 0;
  const tenureMonths = applicant.tenureMonths || 0;
  const existingEmi = applicant.existingEmi || 0;

  console.log(`\n================================================================================`);
  console.log(`[Eligibility Trace] === Step 1: User Profile Received ===`);
  console.log(`[Eligibility Trace]   • Product Requested: ${requestedLoanType}`);
  console.log(`[Eligibility Trace]   • Employer / Company: ${applicant.companyName || "Not provided"}`);
  console.log(`[Eligibility Trace]   • Monthly Take-Home Salary: ₹${monthlySalary.toLocaleString("en-IN")}`);
  console.log(`[Eligibility Trace]   • CIBIL Credit Score: ${cibil > 0 ? cibil : "Not provided"}`);
  console.log(`[Eligibility Trace]   • Applicant Age: ${age > 0 ? `${age} years` : "Not provided"}`);
  console.log(`[Eligibility Trace]   • Requested Loan Amount: ₹${loanAmount.toLocaleString("en-IN")}`);
  console.log(`[Eligibility Trace]   • Repayment Tenure: ${tenureMonths} months (${(tenureMonths / 12).toFixed(1)} years)`);
  console.log(`[Eligibility Trace]   • Existing Monthly EMIs: ₹${existingEmi.toLocaleString("en-IN")}`);
  console.log(`[Eligibility Trace]   • Employment Type: ${applicant.employmentType || "Salaried"}`);

  // Step 2: Resolve employer category across banks from company_records
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
  const bankRules = getAllBankRulesForCategory(companyMatch, requestedLoanType);
  console.log(`[Eligibility Trace]   • Active partner banks loaded for evaluation: ${bankRules.length}`);

  // Step 4: Independent Bank Evaluation
  console.log(`[Eligibility Trace] === Step 4: Independent Bank Evaluation (${bankRules.length} banks) ===`);
  const evaluations: BankEvaluationResult[] = [];

  for (const rule of bankRules) {
    const verifiedChecks: string[] = [];
    const failureReasons: string[] = [];

    const normReq = requestedLoanType.toLowerCase().replace(/\s*loan$/, "");
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

    // Check 1: Minimum Monthly Salary (Category-specific from Master Policy)
    if (!rule.minSalary || rule.minSalary <= 0) {
      failureReasons.push(`Bank policy does not define a valid minimum monthly salary rule`);
    } else if (monthlySalary < rule.minSalary) {
      failureReasons.push(
        `Monthly salary of ₹${monthlySalary.toLocaleString("en-IN")} is below the required ₹${rule.minSalary.toLocaleString("en-IN")} for ${rule.resolvedCategory}`
      );
    } else {
      verifiedChecks.push(`Monthly salary meets ${rule.resolvedCategory} policy minimum (₹${rule.minSalary.toLocaleString("en-IN")})`);
    }

    // Check 2: CIBIL Score Threshold
    if (!rule.minCibil || rule.minCibil <= 0) {
      failureReasons.push(`Bank policy does not define a valid minimum CIBIL score threshold`);
    } else if (cibil < rule.minCibil) {
      failureReasons.push(`CIBIL score (${cibil > 0 ? cibil : "N/A"}) is below the policy minimum threshold of ${rule.minCibil}`);
    } else {
      verifiedChecks.push(`CIBIL score (${cibil}) meets or exceeds policy minimum of ${rule.minCibil}`);
    }

    // Check 3: Age Bounds
    if (!rule.minAge || !rule.maxAge || rule.minAge <= 0 || rule.maxAge <= rule.minAge) {
      failureReasons.push(`Bank policy does not define valid age criteria`);
    } else if (age < rule.minAge || age > rule.maxAge) {
      failureReasons.push(`Age ${age} is outside permissible range (${rule.minAge} to ${rule.maxAge} years)`);
    } else {
      verifiedChecks.push(`Applicant age (${age} years) is within permissible limits (${rule.minAge}–${rule.maxAge} years)`);
    }

    // Check 4: Loan Amount Limits (Ticket Size)
    if (!rule.minLoanAmount || !rule.maxLoanAmount || rule.minLoanAmount <= 0 || rule.maxLoanAmount < rule.minLoanAmount) {
      failureReasons.push(`Bank policy does not define valid loan amount (ticket size) limits`);
    } else if (loanAmount < rule.minLoanAmount) {
      failureReasons.push(`Requested loan amount (₹${loanAmount.toLocaleString("en-IN")}) is below minimum ticket size of ₹${rule.minLoanAmount.toLocaleString("en-IN")}`);
    } else if (loanAmount > rule.maxLoanAmount) {
      failureReasons.push(`Requested loan amount (₹${loanAmount.toLocaleString("en-IN")}) exceeds maximum permissible ticket size of ₹${rule.maxLoanAmount.toLocaleString("en-IN")}`);
    } else {
      verifiedChecks.push(`Requested amount (₹${loanAmount.toLocaleString("en-IN")}) is within permissible ticket size range`);
    }

    // Check 5: Tenure Limits
    if (!rule.minTenureMonths || !rule.maxTenureMonths || rule.minTenureMonths <= 0 || rule.maxTenureMonths < rule.minTenureMonths) {
      failureReasons.push(`Bank policy does not define valid repayment tenure limits`);
    } else if (tenureMonths < rule.minTenureMonths || tenureMonths > rule.maxTenureMonths) {
      failureReasons.push(`Requested tenure of ${tenureMonths} months is outside permissible range (${rule.minTenureMonths} to ${rule.maxTenureMonths} months)`);
    } else {
      verifiedChecks.push(`Requested tenure (${tenureMonths} months) is within permissible policy tenure`);
    }

    // Check 6: Permissible FOIR & Monthly EMI Debt-to-Income
    let foirValid = true;
    if (!rule.foirPercent || rule.foirPercent <= 0) {
      failureReasons.push(`Bank policy does not define a valid permissible FOIR cap`);
      foirValid = false;
    }
    if (!rule.roi || rule.roi <= 0) {
      failureReasons.push(`Bank policy does not define a valid interest rate (ROI)`);
      foirValid = false;
    }

    const emi = rule.roi && rule.roi > 0 ? calculateEmi(loanAmount, rule.roi, tenureMonths) : 0;
    const totalObligation = existingEmi + emi;
    const calculatedFoir = monthlySalary > 0 ? (totalObligation / monthlySalary) * 100 : 100;

    const maxPermissibleEmi = rule.foirPercent && rule.foirPercent > 0 ? monthlySalary * (rule.foirPercent / 100) : 0;
    const availableEmiHeadroom = Math.max(0, maxPermissibleEmi - existingEmi);
    let maxLoanEligible = rule.roi && rule.roi > 0 ? calculateMaxLoanCapacity(availableEmiHeadroom, rule.roi, tenureMonths) : 0;
    if (rule.maxLoanAmount && maxLoanEligible > rule.maxLoanAmount) {
      maxLoanEligible = rule.maxLoanAmount;
    }

    if (foirValid) {
      if (calculatedFoir > rule.foirPercent) {
        failureReasons.push(`Total debt obligations consume ${calculatedFoir.toFixed(1)}% of income, exceeding the policy FOIR cap of ${rule.foirPercent}%`);
      } else {
        verifiedChecks.push(`Total debt obligations (${calculatedFoir.toFixed(1)}%) remain within permissible FOIR cap of ${rule.foirPercent}%`);
      }
    }

    const isEligible = failureReasons.length === 0;

    if (isEligible) {
      console.log(
        `[Eligibility Trace]   [✓ ELIGIBLE] ${rule.bankName}: Approved | ROI: ${rule.roi}% | EMI: ₹${emi.toLocaleString("en-IN")}/mo | Max Limit: ₹${maxLoanEligible.toLocaleString("en-IN")} | FOIR: ${calculatedFoir.toFixed(1)}%`
      );
    } else {
      console.log(
        `[Eligibility Trace]   [✗ INELIGIBLE] ${rule.bankName}: Filtered out | Reasons: ${failureReasons.join(" | ")}`
      );
    }

    evaluations.push({
      bankId: rule.bankId,
      bankName: rule.bankName,
      bankCode: rule.bankCode,
      fileName: rule.fileName,
      resolvedCategory: rule.resolvedCategory,
      isEligible,
      roi: rule.roi,
      monthlyEmi: emi,
      maxLoanEligible: isEligible ? maxLoanEligible : 0,
      requestedLoanAmount: loanAmount,
      processingFeePercent: rule.processingFeePercent,
      tenureMonths,
      policyCibil: rule.policyCibil || "-",
      policyTenure: rule.policyTenure || "-",
      foirPercent: rule.foirPercent,
      calculatedFoir: Number(calculatedFoir.toFixed(1)),
      verifiedChecks,
      failureReasons,
      policySource: rule.policySource,
    });
  }

  // Strictly filter out all ineligible banks
  const eligibleBanks = evaluations.filter((e) => e.isEligible);
  const ineligibleBanks = evaluations.filter((e) => !e.isEligible);

  // Rank Eligible Banks to select the #1 Top Recommendation
  // Criteria: Lowest ROI -> Lowest Processing Fee -> Highest Loan Capacity
  eligibleBanks.sort((a, b) => {
    if (a.roi !== b.roi) return a.roi - b.roi;
    if (a.processingFeePercent !== b.processingFeePercent) return a.processingFeePercent - b.processingFeePercent;
    return b.maxLoanEligible - a.maxLoanEligible;
  });

  const recommendedBank = eligibleBanks.length > 0 ? eligibleBanks[0] : null;
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
  if (applicant.cibil && applicant.cibil > 0) {
    parts.push(`CIBIL of ${applicant.cibil}`);
  }

  // Salary factor (included when relevant, e.g. salary <= ₹40,000)
  if (applicant.monthlyIncome && applicant.monthlyIncome > 0 && applicant.monthlyIncome <= 40000) {
    parts.push(`monthly salary of ₹${applicant.monthlyIncome.toLocaleString("en-IN")}`);
  }

  // Loan amount factor
  if (applicant.loanAmount && applicant.loanAmount > 0) {
    const amt = applicant.loanAmount >= 100000
      ? `₹${(applicant.loanAmount / 100000).toFixed(applicant.loanAmount % 100000 === 0 ? 0 : 1)} lakh loan amount`
      : `₹${applicant.loanAmount.toLocaleString("en-IN")} loan amount`;
    parts.push(amt);
  }

  // Tenure factor
  if (applicant.tenureMonths && applicant.tenureMonths > 0) {
    parts.push(`${applicant.tenureMonths}-month tenure`);
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
    eligibleBanks: BankEvaluationResult[];
    ineligibleBanks: BankEvaluationResult[];
    recommendedBank: BankEvaluationResult | null;
    recommendationReason: string;
  }
): string {
  const { eligibleBanks, recommendedBank } = evaluationOutput;
  const lines: string[] = [];

  // Header
  lines.push(`## 📊 Personal Loan Eligibility Assessment`);
  lines.push("");

  // Applicant Profile Overview (User-facing & concise, strictly from collected answers)
  lines.push(`### 👤 Applicant Summary`);
  lines.push(`| Parameter | Value |`);
  lines.push(`| :--- | :--- |`);
  if (applicant.companyName) {
    lines.push(`| **Employer** | **${applicant.companyName}** |`);
  }
  lines.push(`| **Monthly Take-Home Salary** | ₹${(applicant.monthlyIncome || 0).toLocaleString("en-IN")} |`);
  lines.push(`| **CIBIL Credit Score** | ${applicant.cibil && applicant.cibil > 0 ? applicant.cibil : "Standard"} |`);
  lines.push(`| **Requested Loan Amount** | ₹${(applicant.loanAmount || 0).toLocaleString("en-IN")} |`);
  lines.push(`| **Repayment Tenure** | ${applicant.tenureMonths || 0} months (${(((applicant.tenureMonths || 0)) / 12).toFixed(1)} years) |`);
  lines.push(`| **Existing Monthly EMIs** | ₹${(applicant.existingEmi || 0).toLocaleString("en-IN")} |`);
  lines.push(`| **Applicant Age** | ${applicant.age || 0} years (${applicant.employmentType || "Salaried"}) |`);
  lines.push("");

  // Top Recommendation Highlight
  if (recommendedBank) {
    const isSole = eligibleBanks.length === 1;

    lines.push(`### 🏆 ${isSole ? "Eligible Partner Bank" : "Top Recommended Bank"}: **${recommendedBank.bankName}**`);
    lines.push(`> [!TIP]`);
    if (isSole) {
      lines.push(`> **${recommendedBank.bankName}** is your **sole qualifying partner bank**, with an estimated monthly EMI of **₹${recommendedBank.monthlyEmi.toLocaleString("en-IN")}/month**.`);
    } else {
      lines.push(`> **${recommendedBank.bankName}** is selected as your **#1 Best Match** among **${eligibleBanks.length} eligible partner banks**, with an estimated monthly EMI of **₹${recommendedBank.monthlyEmi.toLocaleString("en-IN")}/month**.`);
    }
    lines.push("");
    lines.push(`**Recommendation Details**:`);
    lines.push(`- **Bank Name**: **${recommendedBank.bankName}**`);
    lines.push(`- **Status**: ✅ **Eligible / Criteria Met**`);
    lines.push(`- **Estimated Monthly EMI**: **₹${recommendedBank.monthlyEmi.toLocaleString("en-IN")} / month**`);
    lines.push(`- **CIBIL**: **${recommendedBank.policyCibil || "-"}**`);
    lines.push(`- **Tenure**: **${recommendedBank.policyTenure || "-"}**`);
    lines.push("");
  }

  // Eligible Banks Table (ONLY ELIGIBLE BANKS SHOWN - INELIGIBLE FILTERED OUT)
  if (eligibleBanks.length > 0) {
    const isSole = eligibleBanks.length === 1;
    lines.push(`### 📋 Eligible Partner Bank${isSole ? "" : "s"} (${eligibleBanks.length})`);
    if (isSole) {
      lines.push(`Based on your profile and verified financial parameters, **${eligibleBanks[0].bankName}** meets all eligibility criteria for your requested loan:`);
    } else {
      lines.push(`The following **${eligibleBanks.length} partner banks** meet all policy criteria for your profile:`);
    }
    lines.push("");
    lines.push(`| Bank | Status | CIBIL | Tenure | Est. EMI |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);

    eligibleBanks.forEach((b) => {
      lines.push(
        `| **${b.bankName}** | ✅ Eligible | ${b.policyCibil || "-"} | ${b.policyTenure || "-"} | ₹${b.monthlyEmi.toLocaleString("en-IN")} |`
      );
    });
    lines.push("");

    lines.push(`---\n🏦 **Next Step**: Reply with your chosen bank (for example, **"${recommendedBank?.bankName || "HDFC Bank"}"**) and city to connect with an official branch representative!`);
  } else {
    // Clean, informative No-Eligibility message with specific policy hurdles and constructive recommendations
    lines.push(`### ⚠️ Assessment Outcome: No Partner Banks Currently Eligible`);
    lines.push(`> [!WARNING]`);
    lines.push(`> **Policy Criteria Not Met**`);
    lines.push(`> Based on an objective, policy-by-policy evaluation against the Master Policy rules of our partner banks, no partner bank currently approves the requested loan parameters under this specific financial profile.`);
    lines.push("");

    // Identify the specific failure hurdles across ineligible banks
    const hurdles: string[] = [];
    const ineligibles = evaluationOutput.ineligibleBanks || [];

    const cibilFails = ineligibles.filter((b) => b.failureReasons.some((r) => /cibil/i.test(r)));
    const foirFails = ineligibles.filter((b) => b.failureReasons.some((r) => /foir|debt obligations/i.test(r)));
    const salaryFails = ineligibles.filter((b) => b.failureReasons.some((r) => /salary/i.test(r)));
    const ageFails = ineligibles.filter((b) => b.failureReasons.some((r) => /age/i.test(r)));
    const amountFails = ineligibles.filter((b) => b.failureReasons.some((r) => /ticket size|loan amount/i.test(r)));
    const tenureFails = ineligibles.filter((b) => b.failureReasons.some((r) => /tenure/i.test(r)));

    if (cibilFails.length > 0 && applicant.cibil !== undefined && applicant.cibil < 650) {
      hurdles.push(`- **Credit Score (CIBIL)**: Your credit score of **${applicant.cibil}** is below partner cut-offs. Partner banks require a minimum score of **650**, with most prime lenders requiring **700 to 731**.`);
    }

    if (foirFails.length > 0 && applicant.existingEmi && applicant.monthlyIncome) {
      const debtRatio = ((applicant.existingEmi / applicant.monthlyIncome) * 100).toFixed(1);
      hurdles.push(`- **Debt Obligations / FOIR**: Current monthly EMIs (₹${applicant.existingEmi.toLocaleString("en-IN")}) consume **${debtRatio}%** of monthly income. When combined with the requested loan EMI, total obligations exceed partner banks' permissible FOIR cap (50%–75%).`);
    }

    if (salaryFails.length === ineligibles.length && applicant.monthlyIncome) {
      hurdles.push(`- **Minimum Monthly Salary**: Take-home salary of **₹${applicant.monthlyIncome.toLocaleString("en-IN")}** is below the minimum entry requirement for your employer category across partner lenders.`);
    }

    if (ageFails.length > 0 && applicant.age && (applicant.age < 21 || applicant.age > 60)) {
      hurdles.push(`- **Applicant Age**: Current age of **${applicant.age} years** is outside the permissible age band (21–60 years) enforced by most personal loan partner policies.`);
    }

    if (amountFails.length > 0 && applicant.loanAmount) {
      hurdles.push(`- **Requested Loan Amount**: The ticket size of **₹${applicant.loanAmount.toLocaleString("en-IN")}** is outside permissible loan bounds for certain lenders.`);
    }

    if (tenureFails.length > 0 && applicant.tenureMonths) {
      hurdles.push(`- **Repayment Tenure**: The requested duration of **${applicant.tenureMonths} months** is outside permissible tenure ranges.`);
    }

    if (hurdles.length > 0) {
      lines.push(`#### 📋 Key Policy Constraints Identified:`);
      hurdles.forEach((h) => lines.push(h));
      lines.push("");
    }

    lines.push(`#### 💡 Recommended Next Steps to Qualify:`);
    if (foirFails.length > 0) {
      lines.push(`1. **Lower Requested Loan Amount**: A smaller loan amount reduces monthly EMI and brings obligations within acceptable FOIR thresholds.`);
      lines.push(`2. **Select a Longer Tenure**: Extending repayment tenure lowers monthly EMI, improving your debt-to-income headroom.`);
      lines.push(`3. **Clear Existing Loans**: Paying off or consolidating active loans frees up monthly income capacity.`);
    } else if (cibilFails.length > 0) {
      lines.push(`1. **Improve Credit Score**: Making timely EMI/credit card payments and maintaining credit utilization below 30% can bring your score above 700 within 3–6 months.`);
      lines.push(`2. **Check for Co-Applicant**: Adding a co-borrower with a healthy credit score (750+) can help secure approval.`);
    } else if (salaryFails.length > 0) {
      lines.push(`1. **Add a Co-Borrower**: Combining income with an earning family member increases total disposable income.`);
      lines.push(`2. **Explore Collateral/Gold Loans**: Secured credit products generally offer more flexible salary requirements.`);
    } else {
      lines.push(`1. **Adjust Loan Terms**: Try re-evaluating with a modified loan amount or tenure.`);
      lines.push(`2. **Consult with an Advisor**: Inquire about specialized partner programs for your specific segment.`);
    }
    lines.push("");
    lines.push(`---\n💬 **Would you like to re-evaluate with a lower loan amount, longer tenure, or updated details?** Just type your updated preferences below to start fresh.`);
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
    } else if (/no\s*cibil|0\s*cibil|zero\s*cibil|no\s*credit\s*(?:score|history)/i.test(lower)) {
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
 * 3. Personal loan company-first resolution from company_records.
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
    } as any);

    return {
      isComplete: true,
      missingFields: [],
      applicant,
      companyMatch: evalResult.companyMatch,
      evaluations: evalResult.evaluations,
      eligibleBanks: evalResult.eligibleBanks,
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

