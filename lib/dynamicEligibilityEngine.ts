import { getAllMasterPolicies } from "@/lib/masterPolicies";
import { resolveCompanyCategories, CompanyCategoryMatch } from "@/lib/companyCategoryResolver";
import { getAllBankRulesForCategory, CategoryPolicyRule } from "@/lib/masterPolicyParser";
import pool from "@/lib/db";
import { classifyIntentWithLLM, IntentClassificationResult } from "@/lib/ai/intentClassifier";

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

export interface SessionState {
  applicant: ApplicantProfile;
  expectedField?: string;
  missingFields?: string[];
  updatedAt: number;
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
        return res.rows[0].state;
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
export function detectLoanIntent(message: string): { isLoanIntent: boolean; loanType: string } {
  const norm = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();

  const isIntent =
    /(?:want|need|looking|interested|apply|check|get|avail)\s+(?:a\s+|for\s+)?(?:personal|home|business|car|auto|education)?\s*loan/i.test(norm) ||
    /loan\s*(?:eligibility|check|apply|needed|inquiry|options)/i.test(norm) ||
    /\bcan\s+i\s+get\s+(?:a\s+)?loan/i.test(norm) ||
    /\bam\s+i\s+eligible/i.test(norm) ||
    /\bcheck\s+my\s+eligibility/i.test(norm) ||
    /\bcalculate\s+emi/i.test(norm) ||
    /\bneed\s+a\s+loan\b/i.test(norm) ||
    /\bhow\s+much\s+loan/i.test(norm) ||
    /\bi\s+need\s+(?:rs\.?|₹)?\s*\d+/i.test(norm) ||
    /(?:need|want|require|borrow)\s+(?:rs\.?|₹)?\s*\d+\s*(?:lakhs?|lacs?|k|cr|crores?)/i.test(norm) ||
    /(?:salary|cibil|income|earning).*(?:lakh|lac|loan|borrow|tenure|emi)/i.test(norm) ||
    /(?:need|want|borrow).*(?:lakh|lac).*(?:salary|cibil|tenure|emi|age)/i.test(norm);

  let loanType = "Personal Loan";
  if (/home\s*loan/i.test(norm)) loanType = "Home Loan";
  else if (/business\s*loan/i.test(norm)) loanType = "Business Loan";
  else if (/car\s*loan|auto\s*loan/i.test(norm)) loanType = "Auto Loan";
  else if (/education\s*loan/i.test(norm)) loanType = "Education Loan";

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
 */
export function parseFinancialAmount(valStr: string): number | null {
  const clean = String(valStr || "").replace(/[₹,]/g, "").trim().toLowerCase();
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
 * Validates whether a candidate string is NOT a valid company name (e.g. loan intent phrases, greetings).
 */
export function isInvalidCompanyName(text: string): boolean {
  if (!text) return true;
  const clean = text.trim().toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length < 2) return true;
  if (/^\d+$/.test(clean)) return true;

  // Greetings, hellos, and conversational pleasantries (MUST NEVER be treated as company names)
  if (
    /^(hi|hello|hey|howdy|greetings|namaste|good\s*(morning|afternoon|evening|day)|hi\s*there|hello\s*there|hey\s*there|yo)\b/i.test(
      clean
    )
  ) {
    return true;
  }

  // Casual conversational small talk and bot queries
  if (
    /^(how\s*are\s*you|hows\s*it\s*going|whats\s*up|what\s*can\s*you\s*do|who\s*are\s*you|tell\s*me\s*about\s*yourself|what\s*is\s*your\s*name|who\s*made\s*you|tell\s*me\s*a\s*joke)\b/i.test(
      clean
    )
  ) {
    return true;
  }

  // Confirmations, acknowledgements, and casual replies
  if (
    /^(yes|no|ok|okay|sure|cool|great|awesome|understood|got\s*it|fine|good|perfect|nope|none|nil|na|n\/a|thanks|thank\s*you|thank\s*you\s*very\s*much|thanks\s*a\s*lot|bye|goodbye|see\s*you|please|test|start|cancel|reset|restart)$/i.test(
      clean
    )
  ) {
    return true;
  }

  // Questions starting with question words (unless explicitly corporate structure like "How Inc")
  if (/^(what|who|where|when|why|how|can\s*you|could\s*you|will\s*you|tell\s*me|help)\b/i.test(clean) && !/\b(ltd|limited|inc|corp|services|technologies|solutions)\b/i.test(clean)) {
    return true;
  }

  // Any phrase combining loan/borrowing terms with intent or action words
  if (
    /\b(loan|loans|borrow|borrowing|lending|financ(?:e|ing))\b/i.test(clean) &&
    /\b(want|need|require|apply|looking|get|give|avail|check|eligible|eligibility|interest|calculator|quote|calculate|details|criteria|options|how)\b/i.test(clean)
  ) {
    return true;
  }

  // Loan intent statements and eligibility queries
  if (
    /eligibility|eligible/i.test(clean) ||
    /(?:want|need|looking|interested|apply|check|get|avail|give|require|find)\s+(?:a\s+|for\s+)?(?:personal|home|business|car|auto|education)?\s*loans?/i.test(
      clean
    ) ||
    /^(?:i\s+)?(?:want|need|require|looking\s+for|apply\s+for)\s+(?:a\s+)?(?:personal|home|business|car|auto|education)?\s*loans?/i.test(
      clean
    ) ||
    /^(?:i\s+)?(?:want|need|require)\s+loans?/i.test(clean) ||
    /^(?:personal|home|business|car|auto|education)\s*loans?$/i.test(clean) ||
    /^loans?$/i.test(clean) ||
    /loans?\s*(?:eligibility|check|apply|needed|inquiry|options|calculator|details|rules)/i.test(clean) ||
    /\b(?:want|need)\s+(?:a\s+)?loans?\b/i.test(clean) ||
    /\bcan\s+i\s+get\s+(?:a\s+)?loans?/i.test(clean) ||
    /\bam\s+i\s+eligible/i.test(clean) ||
    /\bcheck\s+my\s+eligibility/i.test(clean) ||
    /^(?:i\s+)?want\s+personal\s*loans?$/i.test(clean) ||
    /^(?:i\s+)?need\s+personal\s*loans?$/i.test(clean) ||
    /^(?:i\s+)?need\s+(?:a\s+)?loans?$/i.test(clean) ||
    /^(?:i\s+)?want\s+(?:a\s+)?loans?$/i.test(clean)
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

  // Salary, loan amount, or currency figures (e.g. "75000", "75k", "0.75 lakh", "5L", "₹500000", "500000", "5 lakhs")
  if (/^(?:rs\.?|₹)?\s*\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr|crores?)?(?:\s*(?:per\s*month|\/mo|salary|income|loan))?$/i.test(clean)) {
    return true;
  }

  // 3-digit CIBIL score (300-900)
  if (/^(?:cibil|score|credit\s*score)?\s*[3-9]\d{2}\s*(?:cibil|score)?$/i.test(clean)) {
    return true;
  }

  // 2-digit age (18-85)
  if (/^(?:age\s*)?(?:1[8-9]|[2-8]\d)\s*(?:years?|yrs?|yr|years\s*old)?$/i.test(clean)) {
    return true;
  }

  // Tenure (e.g. "3 years", "36 months", "3y", "5 yrs", "3", "5")
  if (/^\d{1,2}\s*(?:years?|yrs?|months?|m\b|y\b)$/i.test(clean)) {
    return true;
  }

  // EMI answers (e.g. "none", "0 emi", "no emi", "zero", "nil", "nothing", "nope")
  if (/^(?:no|none|nil|zero|0|nope|nothing|no\s*emi|0\s*emi|no\s*loans)$/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Dynamically extracts all financial and profile parameters from user text.
 * Robust to typos, short forms ("75k", "5L", "3 yrs", "none"), and context.
 */
export function extractApplicantDetails(
  message: string,
  existing: ApplicantProfile = {},
  missingContext: string[] = []
): ApplicantProfile {
  const applicant: ApplicantProfile = { ...existing };
  const text = String(message || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();

  // 0. Detect loan intent first and set loanType
  const detectedIntent = detectLoanIntent(text);
  if (detectedIntent.isLoanIntent && !applicant.loanType) {
    applicant.loanType = detectedIntent.loanType || "Personal Loan";
  }

  // 1. Monthly Salary / Income (e.g. "75k", "75000", "75,000", "75 thousand", "0.75 lakh", "Monthly Salary: 120000", "earn 85000 per month")
  const salMatch =
    text.match(/(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|nmi|nth|earning|earns?|makes?)(?::|\s*is|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b)?/i) ||
    text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b)?\s*(?:per\s*month|\/mo|monthly|take\s*home|salary|income)/i) ||
    text.match(/(?:rs\.?|₹)\s*(\d{2,3}(?:,\d{3})+|\d{5,6})\s*(?:per\s*month|\/mo)?/i);

  if (salMatch) {
    const amt = parseFinancialAmount(salMatch[1] + (salMatch[2] || ""));
    if (amt && amt >= 5000 && amt <= 50000000) {
      applicant.monthlyIncome = amt;
    }
  }

  // 2. Loan Amount Needed (e.g. "5L", "5 lakh", "500000", "500k", "Loan amount: 500000")
  const loanMatch =
    text.match(/(?:loan\s*(?:amount|of|need|require|want)?|need|want|borrow)(?::|\s*is|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?)?/i) ||
    text.match(/(?:rs\.?|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?)\s*(?:loan)?/i) ||
    text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|cr|crores?)\s*(?:loan)?/i);

  if (loanMatch) {
    const amt = parseFinancialAmount(loanMatch[1] + (loanMatch[2] || ""));
    if (amt && amt >= 10000) {
      applicant.loanAmount = amt;
    }
  }

  // 3. CIBIL Score (e.g. "780", "cibil 780", "score 750", "CIBIL: 780")
  const cibilMatch =
    text.match(/(?:cibil|credit\s*score|score)(?::|\s*is|\s*=)?\s*(?:of)?\s*(\d{3})\b/i) ||
    text.match(/\b(\d{3})\b\s*(?:cibil|credit\s*score)/i);

  if (cibilMatch) {
    const val = parseInt(cibilMatch[1], 10);
    if (val >= 300 && val <= 900) {
      applicant.cibil = val;
    }
  } else if (/no\s*cibil|no\s*credit\s*history|first\s*time\s*borrower|not\s*sure|unknown|dont\s*know/i.test(lower)) {
    applicant.cibil = 0;
  }

  // 4. Tenure (e.g. "3y", "3 yrs", "36m", "36 months", "Tenure: 36 months")
  if (!applicant.tenureMonths && !/(?:years?\s*old|yr\s*old|age)/i.test(text)) {
    const tenureMatch =
      text.match(/(?:tenure|duration|term|period|for)(?::|\s*is|\s*=)?\s*(\d{1,2})\s*(years?|yrs?|months?|m\b|y\b)\b/i) ||
      text.match(/\b([1-7])\s*(years?|yrs?)\b(?!\s*old)/i) ||
      text.match(/\b(\d{2})\s*(months?)\b/i);

    if (tenureMatch) {
      const num = parseInt(tenureMatch[1], 10);
      const unit = (tenureMatch[2] || "").toLowerCase();
      if (unit.startsWith("y") || (!unit.startsWith("m") && num <= 7)) {
        applicant.tenureMonths = num * 12;
      } else {
        applicant.tenureMonths = num;
      }
    }
  }

  // 5. Existing EMI Obligations (e.g. "none", "0", "zero", "10k", "5000", "Existing EMI: 0")
  const emiMatch =
    text.match(/(?:existing|current|other|ongoing)?\s*emi(?:s)?(?::|\s*is|\s*of|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i) ||
    text.match(/paying\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*)\s*(?:as)?\s*emi/i);

  if (emiMatch) {
    const amt = parseFinancialAmount(emiMatch[1] + (emiMatch[2] || ""));
    if (amt !== null) applicant.existingEmi = amt;
  } else if (/no\s*(?:existing\s*)?emi|0\s*emi|zero\s*emi|none|nil|no\s*loans|nothing|nope\b/i.test(lower)) {
    applicant.existingEmi = 0;
  }

  // 6. Applicant Age (e.g. "29", "29 yrs", "age 29", "Age: 29")
  const ageMatch =
    text.match(/(?:age|aged)(?::|\s*is|\s*=)?\s*(\d{2})\b/i) ||
    text.match(/\b(\d{2})\s*(?:years?\s*old|yr\s*old)\b/i);

  if (ageMatch) {
    const ageVal = parseInt(ageMatch[1], 10);
    if (ageVal >= 18 && ageVal <= 85) {
      applicant.age = ageVal;
    }
  }

  // 7. Employment Type (e.g. "salaried", "job", "private company", "business")
  if (/salaried|govt|government|private|pvt\s*ltd|mnc|corporate|job|employee/i.test(lower)) {
    applicant.employmentType = "Salaried";
  } else if (/self\s*employed|business|proprietor|partner|freelanc|doctor|trader/i.test(lower)) {
    applicant.employmentType = "Self-Employed";
  }

  // 8. Employer / Company Name: Never infer company from age, salary, CIBIL, loan amount, or previous messages.
  if (!isFinancialOrProfileInput(text)) {
    const compMatch = text.match(
      /(?:work\s+at|works\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is)\s*[:]?\s*([A-Za-z0-9\s&'.-]+?)(?=\s*[,;]|\s+(?:and|with|salary|cibil|age|loan|emi|tenure|earning)|$|[.\n])/i
    );

    if (compMatch) {
      const cName = compMatch[1].trim();
      if (!isInvalidCompanyName(cName) && !isFinancialOrProfileInput(cName)) {
        applicant.companyName = normalizeCompanyName(cName);
      }
    }
  }

  // 9. Contextual fallback for direct single-value answers
  if (missingContext.length > 0) {
    const targetField = missingContext[0];
    applyFieldValue(applicant, targetField, text);
  }

  return applicant;
}

function applyFieldValue(applicant: ApplicantProfile, field: string, valueStr: string): void {
  const trimmed = valueStr.trim();
  if (field === "companyName" && !applicant.companyName) {
    // NEVER infer company from age, salary, CIBIL, loan amount, or other financial/numeric inputs!
    if (isFinancialOrProfileInput(trimmed)) {
      return;
    }
    if (/^(?:i\s+am\s+)?self[\s-]*employed|business|proprietor|partner|freelancer?|doctor|trader$/i.test(trimmed)) {
      applicant.employmentType = "Self-Employed";
      applicant.companyName = "Self-Employed";
    } else if (!isInvalidCompanyName(trimmed)) {
      const clean = trimmed
        .replace(/^(?:i\s+)?(?:work\s+at|works\s+at|working\s+at|employed\s+at|company\s+is|employer\s+is|at)\s+/i, "")
        .trim();
      if (!isInvalidCompanyName(clean) && !isFinancialOrProfileInput(clean)) {
        applicant.companyName = normalizeCompanyName(clean);
      }
    }
  } else if (field === "monthlyIncome" && !applicant.monthlyIncome) {
    const amt = parseFinancialAmount(valueStr);
    if (amt && amt >= 5000) applicant.monthlyIncome = amt;
  } else if (field === "loanAmount" && !applicant.loanAmount) {
    const amt = parseFinancialAmount(valueStr);
    if (amt && amt >= 10000) applicant.loanAmount = amt;
  } else if (field === "cibil" && applicant.cibil === undefined) {
    const num = parseInt(valueStr.replace(/[^\d]/g, ""), 10);
    if (!isNaN(num) && num >= 300 && num <= 900) applicant.cibil = num;
    else if (/no|na|nil|not\s*sure|dont\s*know|unknown|0/i.test(valueStr)) applicant.cibil = 0;
  } else if (field === "tenureMonths" && !applicant.tenureMonths) {
    const num = parseInt(valueStr.replace(/[^\d]/g, ""), 10);
    if (!isNaN(num) && num > 0) {
      if (/years?|yrs?|y\b/i.test(valueStr)) applicant.tenureMonths = num * 12;
      else if (num <= 7) applicant.tenureMonths = num * 12;
      else applicant.tenureMonths = num;
    }
  } else if (field === "existingEmi" && applicant.existingEmi === undefined) {
    if (/no|none|nil|zero|0|nothing|nope/i.test(valueStr)) {
      applicant.existingEmi = 0;
    } else {
      const amt = parseFinancialAmount(valueStr);
      if (amt !== null) applicant.existingEmi = amt;
    }
  } else if (field === "age" && !applicant.age) {
    const num = parseInt(valueStr.replace(/[^\d]/g, ""), 10);
    if (!isNaN(num) && num >= 18 && num <= 85) applicant.age = num;
  }
}

/**
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
  // 1. Employer / Company Name is strictly required first for personal loans
  if (!applicant.companyName || applicant.companyName.trim().length === 0) {
    return ["companyName"];
  }

  // 2. Active bank policy rules evaluation:
  // Dynamically inspect active partner bank rules for the applicant's company category
  const bankRules = getAllBankRulesForCategory(
    companyMatch || {
      searchedName: applicant.companyName,
      matchedName: applicant.companyName,
      isFound: false,
      overallCategoryTier: "Tier 3 / Standard",
      overallCategoryDisplay: "Standard Corporate",
      bankCategories: {},
      rawRecords: [],
    },
    loanType
  );

  const requiredFields = new Set<string>();

  for (const rule of bankRules) {
    // Minimum Monthly Salary required if any active bank enforces minSalary
    if (rule.minSalary && rule.minSalary > 0) {
      requiredFields.add("monthlyIncome");
    }
    // Loan Amount required if any active bank enforces ticket size
    if (rule.minLoanAmount && rule.minLoanAmount > 0) {
      requiredFields.add("loanAmount");
    }
    // Tenure required if any active bank enforces tenure bounds
    if (rule.minTenureMonths && rule.minTenureMonths > 0) {
      requiredFields.add("tenureMonths");
    }
    // CIBIL score required if any active bank enforces CIBIL cut-off
    if (rule.minCibil && rule.minCibil > 0) {
      requiredFields.add("cibil");
    }
    // Existing EMI required if any active bank enforces FOIR limit (for calculating obligations)
    if (rule.foirPercent && rule.foirPercent > 0) {
      requiredFields.add("existingEmi");
    }
    // Age required if any active bank enforces age criteria
    if (rule.minAge && rule.minAge > 0) {
      requiredFields.add("age");
    }
  }

  // If no bank rules loaded, default to the universal loan policy parameters
  if (requiredFields.size === 0) {
    ["monthlyIncome", "loanAmount", "tenureMonths", "cibil", "existingEmi", "age"].forEach((f) =>
      requiredFields.add(f)
    );
  }

  // Filter out any fields that the user has already provided in this chat
  const missing: string[] = [];
  for (const field of requiredFields) {
    if (
      field === "monthlyIncome" &&
      (applicant.monthlyIncome === undefined || applicant.monthlyIncome === null || applicant.monthlyIncome <= 0)
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
  return text
    .replace(/^Here('s| is) a thinking process[\s\S]*?\n\n/i, "")
    .replace(/<think>[\s\S]*?<\/think>/i, "")
    .replace(/^Thinking Process:[\s\S]*?\n\n/i, "")
    .trim();
}

/**
 * Dynamically asks ONE eligibility question at a time using OpenRouter LLM.
 * Never repeats answered questions; acknowledges previous input naturally.
 */
export async function generateDynamicSingleQuestionWithLLM(
  nextField: string,
  applicant: ApplicantProfile,
  userMessage: string
): Promise<string> {
  const collectedSummary: string[] = [];
  if (applicant.companyName) collectedSummary.push(`Company: ${applicant.companyName}`);
  if (applicant.monthlyIncome) collectedSummary.push(`Salary: ₹${applicant.monthlyIncome.toLocaleString("en-IN")}`);
  if (applicant.loanAmount) collectedSummary.push(`Loan Amount: ₹${applicant.loanAmount.toLocaleString("en-IN")}`);
  if (applicant.tenureMonths) collectedSummary.push(`Tenure: ${applicant.tenureMonths} months`);
  if (applicant.cibil !== undefined && applicant.cibil > 0) collectedSummary.push(`CIBIL: ${applicant.cibil}`);
  if (applicant.existingEmi !== undefined) collectedSummary.push(`Existing EMIs: ₹${applicant.existingEmi}`);
  if (applicant.age) collectedSummary.push(`Age: ${applicant.age} years`);

  const fieldPrompts: Record<string, string> = {
    companyName: "Ask: 'What is your company name?'",
    monthlyIncome: "Ask for their net monthly take-home salary in INR.",
    loanAmount: "Ask how much loan amount they need to borrow.",
    tenureMonths: "Ask for their preferred repayment tenure (e.g. 3 years, 5 years, or in months).",
    cibil: "Ask for their approximate CIBIL score (mentioning they can reply with 0 or unknown if not sure).",
    existingEmi: "Ask for their total existing monthly EMIs (mentioning they can say none or 0 if they have no ongoing loans).",
    age: "Ask for their current age in years.",
  };

  if (OPENROUTER_API_KEY) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

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
          model: OPENROUTER_MODEL,
          max_tokens: 150,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "You are CreditWise AI, a friendly, professional financial intelligence assistant. " +
                "Your goal is to guide the applicant through loan eligibility assessment by asking EXACTLY ONE question at a time. " +
                "Never ask multiple questions. Never repeat a question for details already known. " +
                "Keep your response concise (1-2 sentences), warm, and natural. " +
                "Never mention databases, files, tables, or backend systems.",
            },
            {
              role: "user",
              content:
                `The applicant said: "${userMessage}".\n` +
                `Already known details: ${collectedSummary.length > 0 ? collectedSummary.join(", ") : "None yet"}.\n` +
                `Next missing detail needed: ${fieldPrompts[nextField] || nextField}.\n\n` +
                `Respond with a friendly 1-2 sentence message acknowledging their answer (if appropriate) and asking for ONLY this missing detail.`,
            },
          ],
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
      // Fall through to instant conversational fallbacks
    }
  }

  // Graceful conversational fallbacks (warm & natural)
  const fallbacks: Record<string, string> = {
    companyName: `What is your company name?`,
    monthlyIncome: `Thank you! What is your net monthly take-home salary?`,
    loanAmount: `Got it. How much loan amount are you looking to borrow?`,
    tenureMonths: `And what is your preferred repayment tenure (e.g. 3 years or 5 years)?`,
    cibil: `Could you share your approximate CIBIL score? (If you're not sure, feel free to say 0 or unknown)`,
    existingEmi: `Do you currently have any monthly loan EMIs running? (Enter the total amount in ₹, or say "none")`,
    age: `Lastly, what is your current age in years?`,
  };

  return fallbacks[nextField] || `Could you please share your ${nextField}?`;
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

    // Check 0: Loan Type Compatibility (Strict Master Policy check)
    if (!rule.supportedLoanTypes || !Array.isArray(rule.supportedLoanTypes) || rule.supportedLoanTypes.length === 0 || !rule.supportedLoanTypes.includes(requestedLoanType)) {
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

    lines.push(`### 🏆 ${isSole ? "Approved Partner Bank" : "Top Recommended Bank"}: **${recommendedBank.bankName}**`);
    lines.push(`> [!TIP]`);
    if (isSole) {
      lines.push(`> **${recommendedBank.bankName}** is your **sole qualifying partner bank**, with an estimated monthly EMI of **₹${recommendedBank.monthlyEmi.toLocaleString("en-IN")}/month**.`);
    } else {
      lines.push(`> **${recommendedBank.bankName}** is selected as your **#1 Best Match** among **${eligibleBanks.length} approved partner banks**, with an estimated monthly EMI of **₹${recommendedBank.monthlyEmi.toLocaleString("en-IN")}/month**.`);
    }
    lines.push("");
    lines.push(`**Recommendation Details**:`);
    lines.push(`- **Bank Name**: **${recommendedBank.bankName}**`);
    lines.push(`- **Status**: ✅ **Approved / Eligible**`);
    lines.push(`- **Estimated Monthly EMI**: **₹${recommendedBank.monthlyEmi.toLocaleString("en-IN")} / month**`);
    lines.push(`- **CIBIL**: **${recommendedBank.policyCibil || "-"}**`);
    lines.push(`- **Tenure**: **${recommendedBank.policyTenure || "-"}**`);
    lines.push("");
  }

  // Eligible Banks Table (ONLY ELIGIBLE BANKS SHOWN - INELIGIBLE FILTERED OUT)
  if (eligibleBanks.length > 0) {
    const isSole = eligibleBanks.length === 1;
    lines.push(`### ✅ Approved Partner Bank${isSole ? "" : "s"} (${eligibleBanks.length})`);
    if (isSole) {
      lines.push(`Based on your profile and verified financial parameters, **${eligibleBanks[0].bankName}** has approved your loan application:`);
    } else {
      lines.push(`The following **${eligibleBanks.length} partner banks** have approved your profile:`);
    }
    lines.push("");
    lines.push(`| # | Bank Name | Estimated Monthly EMI | CIBIL | Tenure |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);

    eligibleBanks.forEach((b, idx) => {
      lines.push(
        `| ${idx + 1} | **${b.bankName}** | ₹${b.monthlyEmi.toLocaleString("en-IN")} | ${b.policyCibil || "-"} | ${b.policyTenure || "-"} |`
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
  preClassifiedIntent?: IntentClassificationResult
): Promise<DynamicEligibilityOutput> {
  const existingState = await getEligibilityState(conversationId);
  const isFlowActive = !!(
    existingState &&
    (existingState.expectedField ||
      (existingState.missingFields && existingState.missingFields.length > 0))
  );

  // 1. Determine user intent via LLM (or use pre-classified result)
  let intentResult = preClassifiedIntent;
  if (!intentResult) {
    intentResult = await classifyIntentWithLLM(
      userMessage,
      {
        isFlowActive,
        expectedField: existingState?.expectedField,
      },
      modelOverride
    );
  }

  // Handle explicit reset/cancellation
  if (intentResult.intent === "CANCEL_RESET") {
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

  const isNewLoanIntent =
    intentResult.intent === "PERSONAL_LOAN_REQUEST" ||
    detectLoanIntent(userMessage).isLoanIntent;

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

  // 2. Starting fresh or new personal loan inquiry:
  // Every new chat or new loan inquiry starts completely fresh.
  // Never read answers or profile data from previous chats or the database users table.
  if (isNewLoanIntent && !isFlowActive) {
    await clearEligibilityState(conversationId);

    const freshApplicant: ApplicantProfile = {
      loanType: intentResult.loanType || "Personal Loan",
    };

    // Check if the user also explicitly provided their employer in this opening turn
    let candidateCompany = intentResult.extracted?.companyName;
    if (!candidateCompany) {
      const compMatch = userMessage.match(
        /(?:work\s+at|works\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is)\s+([A-Za-z0-9\s&'.-]+?)(?=\s*[,;]|\s+(?:and|with|salary|cibil|age|loan|emi)|$)/i
      );
      if (compMatch) {
        const c = compMatch[1].trim();
        if (!isInvalidCompanyName(c) && !isFinancialOrProfileInput(c)) {
          candidateCompany = c;
        }
      }
    }

    if (candidateCompany && !isInvalidCompanyName(candidateCompany) && !isFinancialOrProfileInput(candidateCompany)) {
      const resolved = await resolveCompanyCategories(candidateCompany);
      if (resolved.isFound) {
        freshApplicant.companyName = resolved.matchedName || candidateCompany;
      }
    }

    // Extract any other numbers in the message if explicitly given
    const updated = extractApplicantDetails(userMessage, freshApplicant, []);
    if (intentResult.extracted?.monthlyIncome && !updated.monthlyIncome) {
      updated.monthlyIncome = intentResult.extracted.monthlyIncome;
    }
    if (intentResult.extracted?.loanAmount && !updated.loanAmount) {
      updated.loanAmount = intentResult.extracted.loanAmount;
    }
    if (intentResult.extracted?.cibil && updated.cibil === undefined) {
      updated.cibil = intentResult.extracted.cibil;
    }
    if (intentResult.extracted?.tenureMonths && !updated.tenureMonths) {
      updated.tenureMonths = intentResult.extracted.tenureMonths;
    }
    if (intentResult.extracted?.existingEmi !== undefined && updated.existingEmi === undefined) {
      updated.existingEmi = intentResult.extracted.existingEmi;
    }
    if (intentResult.extracted?.age && !updated.age) {
      updated.age = intentResult.extracted.age;
    }
    if (!freshApplicant.companyName) {
      updated.companyName = undefined;
    }

    // Step 3a: If company name is not yet resolved, ASK FOR COMPANY NAME FIRST!
    if (!updated.companyName) {
      const nextQuestion = "To evaluate your personal loan eligibility across our partner banks, what is your company or employer name?";
      await saveEligibilityState(conversationId, {
        applicant: updated,
        expectedField: "companyName",
        missingFields: ["companyName"],
        updatedAt: Date.now(),
      });

      return {
        isComplete: false,
        missingFields: ["companyName"],
        nextQuestion,
        applicant: updated,
        formattedMarkdown: nextQuestion,
      };
    }

    // Step 3b: Company is resolved -> dynamically determine required fields from Master Policies
    const companyMatch = await resolveCompanyCategories(updated.companyName);
    const missingFields = getRequiredPolicyFields(updated, companyMatch, updated.loanType || "Personal Loan");

    if (missingFields.length > 0) {
      const nextField = missingFields[0];
      const nextQuestion = await generateDynamicSingleQuestionWithLLM(nextField, updated, userMessage);
      await saveEligibilityState(conversationId, {
        applicant: updated,
        expectedField: nextField,
        missingFields,
        updatedAt: Date.now(),
      });

      return {
        isComplete: false,
        missingFields,
        nextQuestion,
        applicant: updated,
        formattedMarkdown: nextQuestion,
      };
    }

    // All fields provided in opening turn -> evaluate!
    const evalResult = await evaluateApplicantAgainstAllBanks(updated, updated.loanType || "Personal Loan");
    const formattedMarkdown = formatDynamicEligibilityReport(updated, evalResult);
    await clearEligibilityState(conversationId);

    return {
      isComplete: true,
      missingFields: [],
      applicant: updated,
      companyMatch: evalResult.companyMatch,
      evaluations: evalResult.evaluations,
      eligibleBanks: evalResult.eligibleBanks,
      ineligibleBanks: evalResult.ineligibleBanks,
      recommendedBank: evalResult.recommendedBank,
      recommendationReason: evalResult.recommendationReason,
      formattedMarkdown,
    };
  }

  // 3. Continuing an ongoing eligibility flow
  let applicant: ApplicantProfile = existingState?.applicant ? { ...existingState.applicant } : { loanType: "Personal Loan" };
  let expectedField = existingState?.expectedField;

  // If companyName is still expected:
  if (expectedField === "companyName" || !applicant.companyName) {
    const trimmedInput = userMessage.trim();

    // Never accept pure financial figures or profile numbers as company name
    if (isFinancialOrProfileInput(trimmedInput)) {
      applicant = extractApplicantDetails(userMessage, applicant, []);
      applicant.companyName = undefined;
      const question = "What is your company or employer name?";
      await saveEligibilityState(conversationId, {
        applicant,
        expectedField: "companyName",
        missingFields: ["companyName"],
        updatedAt: Date.now(),
      });
      return {
        isComplete: false,
        missingFields: ["companyName"],
        nextQuestion: question,
        applicant,
        formattedMarkdown: question,
      };
    }

    if (/^(?:i\s+am\s+)?self[\s-]*employed|business|proprietor|partner|freelancer?|doctor|trader$/i.test(trimmedInput)) {
      applicant.employmentType = "Self-Employed";
      applicant.companyName = "Self-Employed";
      expectedField = undefined;
    } else if (isInvalidCompanyName(trimmedInput)) {
      applicant.companyName = undefined;
      const question = "What is your company or employer name?";
      return {
        isComplete: false,
        missingFields: ["companyName"],
        nextQuestion: question,
        applicant,
        formattedMarkdown: question,
      };
    } else {
      // Resolve company name dynamically from company_records or as unlisted corporate
      const cleanCandidate = trimmedInput
        .replace(/^(?:i\s+)?(?:work\s+at|working\s+at|employed\s+at|company\s+is|employer\s+is|at)\s+/i, "")
        .trim();

      const resolved = await resolveCompanyCategories(cleanCandidate);
      applicant.companyName = resolved.matchedName || cleanCandidate;
      expectedField = undefined; // Company resolved successfully!
    }
  }

  // 4. Company is verified! Extract remaining fields from userMessage for expectedField
  const verifiedCompany = applicant.companyName;
  const updatedApplicant = extractApplicantDetails(userMessage, applicant, expectedField ? [expectedField] : []);
  if (verifiedCompany) {
    updatedApplicant.companyName = verifiedCompany;
  }

  // 5. Dynamically determine required fields from active bank Master Policy rules
  const companyMatch = await resolveCompanyCategories(updatedApplicant.companyName || "");
  const missingFields = getRequiredPolicyFields(updatedApplicant, companyMatch, updatedApplicant.loanType || "Personal Loan");

  // 6. If fields are missing, ask ONLY the single next question with LLM
  if (missingFields.length > 0) {
    const nextField = missingFields[0];
    const nextQuestion = nextField === "companyName"
      ? "What is your company or employer name?"
      : await generateDynamicSingleQuestionWithLLM(nextField, updatedApplicant, userMessage);

    await saveEligibilityState(conversationId, {
      applicant: updatedApplicant,
      expectedField: nextField,
      missingFields,
      updatedAt: Date.now(),
    });

    return {
      isComplete: false,
      missingFields,
      nextQuestion,
      applicant: updatedApplicant,
      formattedMarkdown: nextQuestion,
    };
  }

  // 7. All required policy parameters collected! Independently evaluate every active bank
  const evalResult = await evaluateApplicantAgainstAllBanks(updatedApplicant, updatedApplicant.loanType || "Personal Loan");
  const formattedMarkdown = formatDynamicEligibilityReport(updatedApplicant, evalResult);

  // Clear session state upon completion
  await clearEligibilityState(conversationId);

  return {
    isComplete: true,
    missingFields: [],
    applicant: updatedApplicant,
    companyMatch: evalResult.companyMatch,
    evaluations: evalResult.evaluations,
    eligibleBanks: evalResult.eligibleBanks,
    ineligibleBanks: evalResult.ineligibleBanks,
    recommendedBank: evalResult.recommendedBank,
    recommendationReason: evalResult.recommendationReason,
    formattedMarkdown,
  };
}

