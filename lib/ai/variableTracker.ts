// lib/ai/variableTracker.ts
/**
 * Session Memory & Context Variable Tracking Layer
 *
 * Responsibilities:
 * 1. Automatically extract, catch, and track context variables (salary, existing EMI, loan amount,
 *    credit score, employer category, company name, age, tenure, employment type).
 * 2. Detect updates and overrides across multiple turns in the same conversation.
 * 3. Persist the updated variables to PostgreSQL (assistant_conversation_states).
 * 4. Format active variables for injection into the LLM system prompt.
 */

import pool from "@/lib/db";
import { parseFinancialAmount, checkEligibilitySlotCompleteness } from "@/lib/dynamicEligibilityEngine";

export interface ContextVariables {
  monthlySalary?: number;
  existingEmi?: number;
  loanAmount?: number;
  cibilScore?: number;
  companyName?: string;
  employerCategory?: string;
  age?: number;
  tenureMonths?: number;
  employmentType?: string;
}

/**
 * Extracts individual variable updates from a user message.
 */
export function extractVariableUpdatesFromText(text: string): Partial<ContextVariables> {
  const updates: Partial<ContextVariables> = {};
  if (!text || typeof text !== "string") return updates;

  const raw = text.trim();
  const lower = raw.toLowerCase();

  // 1. Monthly Salary / Net Income / NTH
  const salaryMatch =
    /(?:(?:my\s+)?(?:monthly\s+)?(?:salary|net\s*salary|income|take[\s-]*home|nth|nmi)(?:\s*(?:is|of|as|=|\:))?\s*(?:\(?collected:\s*)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|cr))?))\b/i.exec(
      raw
    ) ||
    /(?:(?:i\s+)?earn(?:ing)?|makes?|making|take\s*home)\s*(?:\(?collected:\s*)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|cr))?)(?:\s*(?:per\s*month|\/mo|\/month|monthly))?/i.exec(
      raw
    ) ||
    /(?:change|update|actually|now)?\s*(?:my\s*)?salary\s*(?:to|is)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?))?)/i.exec(
      raw
    );

  if (salaryMatch) {
    const parsed = parseFinancialAmount(salaryMatch[1]);
    if (parsed && parsed >= 5000) {
      updates.monthlySalary = parsed;
    }
  }

  // 2. Existing Monthly EMI Obligations
  const emiZeroMatch =
    /(?:no\s+existing\s+emi|zero\s+emi|no\s+emi|0\s+emi|emi\s*(?:is|:)?\s*0|don't\s+have\s+(?:any\s+)?emi|existing\s*monthly\s*emis?:\s*(?:\(?collected:\s*)?(?:rs\.?|inr|₹)?\s*0\b)/i.test(
      raw
    );
  if (emiZeroMatch) {
    updates.existingEmi = 0;
  } else {
    const emiMatch =
      /(?:(?:existing\s*(?:monthly\s*)?|current|monthly|total)\s*emi(?:\s*(?:is|of|as|=|\:))?\s*(?:\(?collected:\s*)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?))?))\b/i.exec(
        raw
      ) ||
      /(?:paying|paying\s+an?)\s+emi\s+of\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?))?)/i.exec(
        raw
      ) ||
      /(?:change|update|actually|now)?\s*(?:my\s*)?emi\s*(?:to|is)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?))?)/i.exec(
        raw
      );

    if (emiMatch) {
      const parsed = parseFinancialAmount(emiMatch[1]);
      if (parsed !== null && parsed !== undefined && parsed >= 0) {
        updates.existingEmi = parsed;
      }
    }
  }

  // 3. Requested Loan Amount
  const loanAmtMatch =
    /(?:(?:desired\s*)?(?:personal\s*)?loan\s*(?:amount)?(?:\s*(?:is|of|as|=|\:))?\s*(?:\(?collected:\s*)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|cr))?))\b/i.exec(
      raw
    ) ||
    /(?:(?:need|want|require|apply\s+for|looking\s+for)\s+(?:a\s+)?(?:personal\s+)?loan\s+(?:of\s+)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|cr))?))\b/i.exec(
      raw
    ) ||
    /(?:(?:looking|applying)\s+for\s+)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|cr))?)\s*(?:personal\s+)?loan/i.exec(
      raw
    ) ||
    /(?:borrow|give\s+me)\s+(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|cr))?)/i.exec(
      raw
    );

  if (loanAmtMatch) {
    const parsed = parseFinancialAmount(loanAmtMatch[1]);
    if (parsed && parsed >= 10000) {
      updates.loanAmount = parsed;
    }
  }

  // 4. CIBIL / Credit Score
  const cibilMatch =
    /(?:cibil(?:\s*score)?|credit\s*score)(?:\s*(?:is|of|as|=|\:))?\s*(?:\(?collected:\s*)?(\d{3})\b/i.exec(
      raw
    ) ||
    /(?:score\s*is|cibil\s*is|cibil\s*to)\s*(\d{3})\b/i.exec(raw) ||
    /\b(\d{3})\b\s*(?:cibil|credit\s*score)/i.exec(raw);

  if (cibilMatch) {
    const score = parseInt(cibilMatch[1], 10);
    if (score >= 300 && score <= 900) {
      updates.cibilScore = score;
    }
  }

  // 5. Age
  const ageMatch =
    /(?:(?:my\s+)?age(?:\s*(?:is|of|as|=|\:))?\s*(?:\(?collected:\s*)?(\d{2})\b)/i.exec(raw) ||
    /\b(\d{2})\s*(?:years?\s*old|yrs?\s*old)\b/i.exec(raw) ||
    /(?:i\s*am|i'm)\s*(\d{2})\s*(?:years?\s*old)?/i.exec(raw) ||
    /\b(\d{2})\s*age\b/i.exec(raw);

  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    if (age >= 18 && age <= 75) {
      updates.age = age;
    }
  }

  // 6. Tenure
  const tenureYearsMatch =
    /(?:(?:desired\s*)?tenure(?:\s*(?:is|of|as|=|\:))?\s*(?:\(?collected:\s*)?(\d+)\s*years?)/i.exec(raw) ||
    /(?:for|over)\s*(\d+)\s*years?\s*(?:tenure|repayment)?/i.exec(raw);
  if (tenureYearsMatch) {
    const years = parseInt(tenureYearsMatch[1], 10);
    if (years >= 1 && years <= 10) {
      updates.tenureMonths = years * 12;
    }
  } else {
    const tenureMonthsMatch =
      /(?:(?:desired\s*)?tenure(?:\s*(?:is|of|as|=|\:))?\s*(?:\(?collected:\s*)?(\d+)\s*months?)/i.exec(raw) ||
      /(?:for|over)\s*(\d+)\s*months?\s*(?:tenure)?/i.exec(raw);
    if (tenureMonthsMatch) {
      const months = parseInt(tenureMonthsMatch[1], 10);
      if (months >= 6 && months <= 120) {
        updates.tenureMonths = months;
      }
    }
  }

  // 7. Employer Category
  const catMatch =
    /\b(?:cat(?:egory)?\s*([a-e]|super\s*a)|super\s*cat\s*a|diamond|platinum|gold|silver|listed|unlisted|government|govt|psu)\b/i.exec(
      raw
    );
  if (catMatch) {
    updates.employerCategory = catMatch[0].toUpperCase();
  }

  // 8. Employment Type
  const isNegatedOrTransitional =
    /(?:not|no\s*longer|instead\s*of|was|previously|from)\s*(?:unemployed|jobless)/i.test(lower) ||
    /(?:from\s+)?unemployed\s+to\s+(?:self[\s-]*employed|salaried|employed)/i.test(lower);

  if (/\b(?:self[\s-]*employed|business\s*owner|own\s*business|proprietor|freelancer)\b/i.test(lower)) {
    updates.employmentType = "Self-Employed";
  } else if (/\b(?:salaried|regular\s*salary)\b/i.test(lower) && !/no\s*job/i.test(lower)) {
    updates.employmentType = "Salaried";
  } else if (!isNegatedOrTransitional && /\b(?:unemployed|jobless|no\s*job)\b/i.test(lower)) {
    updates.employmentType = "Unemployed";
  } else if (/\b(?:student)\b/i.test(lower)) {
    updates.employmentType = "Student";
  } else if (/\b(?:homemaker|housewife)\b/i.test(lower)) {
    updates.employmentType = "Homemaker";
  } else if (/\b(?:retired|pensioner)\b/i.test(lower)) {
    updates.employmentType = "Retired";
  }

  // 9. Employer / Company Name
  const companyMatch =
    /(?:work(?:ing)?\s+(?:at|in|with)|company(?:\s*name)?(?:\s*(?:is|:))|employer(?:\s*(?:is|:)))\s*([a-zA-Z0-9\s&.,'-]{2,40})/i.exec(
      raw
    );
  if (companyMatch) {
    const candidate = companyMatch[1].trim().replace(/[.,;!]+$/, "");
    if (
      !/^(undefined|null|none|no|my|a|an|the|company|employer|salaried|job)$/i.test(candidate) &&
      candidate.length >= 2
    ) {
      updates.companyName = candidate;
    }
  }

  return updates;
}

/**
 * Loads currently tracked context variables for a conversation from PostgreSQL.
 */
export async function loadSessionVariables(conversationId: string): Promise<ContextVariables> {
  const cleanId = String(conversationId || "").trim();
  if (!cleanId) return {};

  try {
    const res = await pool.query(
      `SELECT state FROM assistant_conversation_states WHERE conversation_id = $1`,
      [cleanId]
    );

    if (res.rows.length > 0 && res.rows[0]?.state) {
      const state = res.rows[0].state;
      const applicant = state.applicant || {};
      const sessionVars = state.sessionVariables || {};

      return {
        monthlySalary: sessionVars.monthlySalary || sessionVars.monthlyIncome || applicant.monthlyIncome || applicant.monthlySalary,
        existingEmi: sessionVars.existingEmi !== undefined ? sessionVars.existingEmi : applicant.existingEmi,
        loanAmount: sessionVars.loanAmount || sessionVars.requestedAmount || applicant.loanAmount,
        cibilScore: sessionVars.cibilScore !== undefined ? sessionVars.cibilScore : (applicant.cibil !== undefined ? applicant.cibil : applicant.cibilScore),
        companyName: sessionVars.companyName || sessionVars.employer || applicant.companyName,
        employerCategory: sessionVars.employerCategory || applicant.companyCategory,
        age: sessionVars.age || applicant.age,
        tenureMonths: sessionVars.tenureMonths || applicant.tenureMonths,
        employmentType: sessionVars.employmentType || applicant.employmentType,
      };
    }
  } catch (err) {
    console.warn("[VariableTracker] Error loading session variables:", err);
  }

  return {};
}

/**
 * Updates context variables in PostgreSQL assistant_conversation_states atomically.
 */
export async function persistUpdatedVariables(
  conversationId: string,
  updates: Partial<ContextVariables>,
  currentVars: ContextVariables
): Promise<ContextVariables> {
  const cleanId = String(conversationId || "").trim();
  if (!cleanId) return { ...currentVars, ...updates };

  const merged: ContextVariables = {
    ...currentVars,
    ...updates,
  };

  try {
    const res = await pool.query(
      `SELECT state FROM assistant_conversation_states WHERE conversation_id = $1`,
      [cleanId]
    );

    const currentState = res.rows[0]?.state || {};
    const updatedApplicant = {
      ...(currentState.applicant || {}),
      monthlyIncome: merged.monthlySalary ?? currentState.applicant?.monthlyIncome,
      monthlySalary: merged.monthlySalary ?? currentState.applicant?.monthlySalary,
      existingEmi: merged.existingEmi ?? currentState.applicant?.existingEmi,
      loanAmount: merged.loanAmount ?? currentState.applicant?.loanAmount,
      cibil: merged.cibilScore ?? currentState.applicant?.cibil,
      cibilScore: merged.cibilScore ?? currentState.applicant?.cibilScore,
      companyName: merged.companyName ?? currentState.applicant?.companyName,
      companyCategory: merged.employerCategory ?? currentState.applicant?.companyCategory,
      age: merged.age ?? currentState.applicant?.age,
      tenureMonths: merged.tenureMonths ?? currentState.applicant?.tenureMonths,
      employmentType: merged.employmentType ?? currentState.applicant?.employmentType,
    };

    const updatedSessionVars = {
      ...(currentState.sessionVariables || {}),
      ...merged,
      updatedAt: Date.now(),
    };

    const updatedState = {
      ...currentState,
      applicant: updatedApplicant,
      sessionVariables: updatedSessionVars,
      updatedAt: Date.now(),
    };

    await pool.query(
      `INSERT INTO assistant_conversation_states (conversation_id, state, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '2 hours')
       ON CONFLICT (conversation_id) DO UPDATE SET state = $2, expires_at = NOW() + INTERVAL '2 hours'`,
      [cleanId, updatedState]
    );
  } catch (err) {
    console.warn("[VariableTracker] Error saving variables to assistant_conversation_states:", err);
  }

  return merged;
}

/**
 * Formats tracked variables into a clean Markdown block for injection into LLM prompts.
 * Uses the strict 7-slot State Completeness Checklist.
 */
export function formatActiveVariablesPrompt(vars: ContextVariables): string {
  const slotCheck = checkEligibilitySlotCompleteness({}, vars);

  return (
    `### [CURRENT SESSION CONTEXT & STATE COMPLETENESS CHECKLIST]\n` +
    `Track the following collected slots in the session context:\n` +
    slotCheck.formattedChecklist +
    `\n\nCRITICAL: Always use these exact confirmed values for all calculations, underwriting rules, and response generation. Do not re-ask for any of these confirmed parameters.`
  );
}
