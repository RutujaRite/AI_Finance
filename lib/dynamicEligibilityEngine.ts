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
  if (preClassifiedIntent?.intent) {
    const isIntent =
      preClassifiedIntent.intent === "LOAN_ELIGIBILITY" ||
      (preClassifiedIntent as any).intent === "PERSONAL_LOAN_REQUEST";
    return { isLoanIntent: isIntent, loanType: preClassifiedIntent.loanType || "Personal Loan" };
  }

  const norm = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();
  const isIntent = /\b(?:loan|loans|borrow|borrowing|lending|financ(?:e|ing)|eligib)\b/i.test(norm);

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
 * Validates whether a candidate string is NOT a valid company name.
 * Performs structural validation (length, character composition) without hardcoded intent phrases.
 */
export function isInvalidCompanyName(text: string): boolean {
  if (!text) return true;
  const clean = text.trim().toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length < 2) return true;
  if (/^\d+$/.test(clean)) return true;
  if (!/[a-zA-Z]/.test(clean)) return true;
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
  if (/^\d{1,2}\s*(?:years?|yrs?|months?|m\b|y\b)?$/i.test(clean)) {
    return true;
  }

  // EMI answers (e.g. "none", "0 emi", "no emi", "zero", "nil", "nothing", "nope")
  if (/^(?:no|none|nil|zero|0|nope|nothing|no\s*emi|0\s*emi|no\s*loans)$/i.test(clean)) {
    return true;
  }

  return false;
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
    if (typeof llmExtracted?.monthlyIncome === "number" && llmExtracted.monthlyIncome >= 5000) {
      applicant.monthlyIncome = llmExtracted.monthlyIncome;
      return;
    }
    const amt = parseFinancialAmount(text);
    if (amt && amt >= 5000 && amt <= 50000000) {
      applicant.monthlyIncome = amt;
      return;
    }
    const salMatch = text.match(/(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b)?/i);
    if (salMatch) {
      const parsed = parseFinancialAmount(salMatch[1] + (salMatch[2] || ""));
      if (parsed && parsed >= 5000) {
        applicant.monthlyIncome = parsed;
        return;
      }
    }
  }

  // B. Loan Amount Needed
  if (field === "loanAmount") {
    if (typeof llmExtracted?.loanAmount === "number" && llmExtracted.loanAmount >= 10000) {
      applicant.loanAmount = llmExtracted.loanAmount;
      return;
    }
    const amt = parseFinancialAmount(text);
    if (amt && amt >= 10000) {
      applicant.loanAmount = amt;
      return;
    }
    const loanMatch = text.match(/(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?)?/i);
    if (loanMatch) {
      const parsed = parseFinancialAmount(loanMatch[1] + (loanMatch[2] || ""));
      if (parsed && parsed >= 10000) {
        applicant.loanAmount = parsed;
        return;
      }
    }
  }

  // C. Tenure Months
  if (field === "tenureMonths") {
    if (typeof llmExtracted?.tenureMonths === "number" && llmExtracted.tenureMonths > 0) {
      applicant.tenureMonths = llmExtracted.tenureMonths;
      return;
    }
    const yMatch = text.match(/(\d+)\s*(?:years?|yrs?|y\b)/i);
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
    if (/no|none|nil|zero|0|unknown|not\s*sure|don'?t\s*know|first\s*time|never\s*checked|na|n\/a/i.test(lower)) {
      applicant.cibil = 0;
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
  }

  // E. Existing EMI Obligations
  if (field === "existingEmi") {
    if (typeof llmExtracted?.existingEmi === "number") {
      applicant.existingEmi = llmExtracted.existingEmi;
      return;
    }
    if (/no|none|nil|zero|0|nothing|nope|no\s*emi|0\s*emi|no\s*loans/i.test(lower)) {
      applicant.existingEmi = 0;
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

  // G. Company Name
  if (field === "companyName") {
    if (isFinancialOrProfileInput(text) || isInvalidCompanyName(text)) {
      return;
    }
    if (/^(?:i\s+am\s+)?self[\s-]*employed|business|proprietor|partner|freelancer?|doctor|trader$/i.test(lower)) {
      applicant.employmentType = "Self-Employed";
      applicant.companyName = "Self-Employed";
      return;
    }
    const candidate =
      llmExtracted?.companyName ||
      text
        .replace(/^(?:i\s+)?(?:work\s+at|works\s+at|working\s+at|employed\s+at|company\s+is|employer\s+is|at)\s+/i, "")
        .trim();
    if (!isInvalidCompanyName(candidate) && !isFinancialOrProfileInput(candidate)) {
      applicant.companyName = normalizeCompanyName(candidate);
    }
  }
}

/**
 * Extracts any secondary/additional parameters explicitly mentioned in the user message or by the LLM.
 * Strictly preserves all already collected values.
 */
function extractSecondaryParameters(
  applicant: ApplicantProfile,
  text: string,
  lower: string,
  targetExpectedField?: string,
  llmExtracted?: any
): void {
  // 1. Monthly Income (ONLY if not targetExpectedField and not already set)
  if (targetExpectedField !== "monthlyIncome" && (applicant.monthlyIncome === undefined || applicant.monthlyIncome <= 0)) {
    if (typeof llmExtracted?.monthlyIncome === "number" && llmExtracted.monthlyIncome >= 5000) {
      applicant.monthlyIncome = llmExtracted.monthlyIncome;
    } else {
      const salMatch =
        text.match(/(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|nmi|nth|earning|earns?|makes?)(?::|\s*is|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b)?/i) ||
        text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b)?\s*(?:per\s*month|\/mo|monthly|take\s*home|salary|income)/i);
      if (salMatch) {
        const amt = parseFinancialAmount(salMatch[1] + (salMatch[2] || ""));
        if (amt && amt >= 5000 && amt <= 50000000) {
          applicant.monthlyIncome = amt;
        }
      }
    }
  }

  // 2. Loan Amount (ONLY if not targetExpectedField and not already set)
  if (targetExpectedField !== "loanAmount" && (applicant.loanAmount === undefined || applicant.loanAmount <= 0)) {
    if (typeof llmExtracted?.loanAmount === "number" && llmExtracted.loanAmount >= 10000) {
      applicant.loanAmount = llmExtracted.loanAmount;
    } else {
      const loanMatch =
        text.match(/(?:loan\s*(?:amount|of|need|require|want)?|need|want|borrow)(?::|\s*is|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?)?/i) ||
        text.match(/(?:rs\.?|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?)\s*(?:loan)?/i) ||
        text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|cr|crores?)\s+(?:loan|borrow)/i);
      if (loanMatch) {
        const amt = parseFinancialAmount(loanMatch[1] + (loanMatch[2] || ""));
        if (amt && amt >= 10000) {
          applicant.loanAmount = amt;
        }
      }
    }
  }

  // 3. CIBIL Score (ONLY if not targetExpectedField and not already set)
  if (targetExpectedField !== "cibil" && applicant.cibil === undefined) {
    if (typeof llmExtracted?.cibil === "number") {
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
      } else if (/no\s*cibil|no\s*credit\s*history|first\s*time\s*borrower/i.test(lower)) {
        applicant.cibil = 0;
      }
    }
  }

  // 4. Tenure Months (ONLY if not targetExpectedField and not already set)
  if (targetExpectedField !== "tenureMonths" && (applicant.tenureMonths === undefined || applicant.tenureMonths <= 0)) {
    if (typeof llmExtracted?.tenureMonths === "number" && llmExtracted.tenureMonths > 0) {
      applicant.tenureMonths = llmExtracted.tenureMonths;
    } else if (!/(?:years?\s*old|yr\s*old|age)/i.test(text)) {
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
  }

  // 5. Existing EMI Obligations (ONLY if not targetExpectedField and not already set)
  if (targetExpectedField !== "existingEmi" && applicant.existingEmi === undefined) {
    if (typeof llmExtracted?.existingEmi === "number") {
      applicant.existingEmi = llmExtracted.existingEmi;
    } else {
      const emiMatch =
        text.match(/(?:existing|current|other|ongoing)?\s*emi(?:s)?(?::|\s*is|\s*of|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i) ||
        text.match(/paying\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*)\s*(?:as)?\s*emi/i);
      if (emiMatch) {
        const amt = parseFinancialAmount(emiMatch[1] + (emiMatch[2] || ""));
        if (amt !== null) applicant.existingEmi = amt;
      } else if (/no\s*(?:existing\s*)?emi|0\s*emi|zero\s*emi|no\s*loans/i.test(lower)) {
        applicant.existingEmi = 0;
      }
    }
  }

  // 6. Applicant Age (ONLY if not targetExpectedField and not already set)
  if (targetExpectedField !== "age" && (applicant.age === undefined || applicant.age <= 0)) {
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

  // 7. Employment Type (ONLY if not already set)
  if (!applicant.employmentType) {
    if (/salaried|govt|government|private|pvt\s*ltd|mnc|corporate|job|employee/i.test(lower)) {
      applicant.employmentType = "Salaried";
    } else if (/self\s*employed|business|proprietor|partner|freelanc|doctor|trader/i.test(lower)) {
      applicant.employmentType = "Self-Employed";
    }
  }

  // 8. Company Name (ONLY if not targetExpectedField and not already set)
  if (targetExpectedField !== "companyName" && !applicant.companyName) {
    if (llmExtracted?.companyName && !isInvalidCompanyName(llmExtracted.companyName) && !isFinancialOrProfileInput(llmExtracted.companyName)) {
      applicant.companyName = normalizeCompanyName(llmExtracted.companyName);
    } else if (!isFinancialOrProfileInput(text)) {
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

  // 0. Detect loan intent first and set loanType if not already set
  const detectedIntent = detectLoanIntent(text);
  if (detectedIntent.isLoanIntent && !applicant.loanType) {
    applicant.loanType = detectedIntent.loanType || "Personal Loan";
  }

  // 1. Map to expected field first (highest priority for direct answers)
  if (targetExpectedField) {
    mapAnswerToTargetField(applicant, targetExpectedField, text, lower, llmExtracted);
  }

  // 2. Extract any secondary parameters provided in the same message, preserving existing values
  extractSecondaryParameters(applicant, text, lower, targetExpectedField, llmExtracted);

  return applicant;
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
    const modelsToTry = [OPENROUTER_MODEL];
    if (OPENROUTER_MODEL !== "openrouter/free") modelsToTry.push("openrouter/free");

    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

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
        // Try fallback model
      }
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
    const updated = extractApplicantDetails(userMessage, applicant, []);
    if (intentResult.extracted?.monthlyIncome) updated.monthlyIncome = intentResult.extracted.monthlyIncome;
    if (intentResult.extracted?.loanAmount) updated.loanAmount = intentResult.extracted.loanAmount;
    if (intentResult.extracted?.tenureMonths) updated.tenureMonths = intentResult.extracted.tenureMonths;
    if (intentResult.extracted?.cibil !== undefined) updated.cibil = intentResult.extracted.cibil;
    if (intentResult.extracted?.existingEmi !== undefined) updated.existingEmi = intentResult.extracted.existingEmi;
    if (intentResult.extracted?.age) updated.age = intentResult.extracted.age;
    if (intentResult.extracted?.companyName) {
      const resolved = await resolveCompanyCategories(intentResult.extracted.companyName);
      updated.companyName = resolved.matchedName || intentResult.extracted.companyName;
    }
    const companyMatch = updated.companyName
      ? await resolveCompanyCategories(updated.companyName)
      : undefined;
    const missingFields = getRequiredPolicyFields(updated, companyMatch, updated.loanType || "Personal Loan");

    if (missingFields.length === 0) {
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
        formattedMarkdown: `🔄 **Details Updated & Recalculated**\n\n${formattedMarkdown}`,
      };
    }

    const nextField = missingFields[0];
    const nextQuestion = nextField === "companyName"
      ? "What is your company or employer name?"
      : await generateDynamicSingleQuestionWithLLM(nextField, updated, userMessage);
    await saveEligibilityState(conversationId, {
      applicant: updated,
      expectedField: nextField,
      missingFields,
      updatedAt: Date.now(),
    });
    return {
      isComplete: false,
      missingFields,
      nextQuestion: `🔄 **Details Updated**\n\n${nextQuestion}`,
      applicant: updated,
      formattedMarkdown: `🔄 **Details Updated**\n\n${nextQuestion}`,
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

  // If an eligibility flow is active, but the user asked a side question (calculation, general info, greeting, another topic),
  // do NOT ask the next eligibility question! Yield cleanly so the caller can answer the question directly.
  if (isFlowActive && intentResult.intent !== "LOAN_ELIGIBILITY") {
    return {
      isComplete: false,
      missingFields: existingState?.missingFields || [],
      nextQuestion: "",
      applicant: existingState?.applicant || {},
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
    const updated = extractApplicantDetails(userMessage, freshApplicant, [], intentResult?.extracted);
    if (!freshApplicant.companyName && !updated.companyName) {
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
      applicant = extractApplicantDetails(userMessage, applicant, [], intentResult?.extracted);
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
      const cleanCandidate =
        (intentResult?.extracted?.companyName && !isInvalidCompanyName(intentResult.extracted.companyName) && !isFinancialOrProfileInput(intentResult.extracted.companyName))
          ? intentResult.extracted.companyName
          : trimmedInput
              .replace(/^(?:i\s+)?(?:work\s+at|works\s+at|working\s+at|employed\s+at|company\s+is|employer\s+is|at)\s+/i, "")
              .trim();

      const resolved = await resolveCompanyCategories(cleanCandidate);
      applicant.companyName = resolved.matchedName || cleanCandidate;
      expectedField = undefined; // Company resolved successfully!
    }
  }

  // 4. Extract parameters using expectedField and intentResult.extracted
  const verifiedCompany = applicant.companyName;
  const updatedApplicant = extractApplicantDetails(
    userMessage,
    applicant,
    expectedField ? [expectedField] : [],
    intentResult?.extracted
  );
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

