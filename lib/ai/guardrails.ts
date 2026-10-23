/**
 * Pre-Processor & Guardrails for AI Finance Agent
 * Ensures:
 * 1. Special profile tokens ('student', 'homemaker', 'unemployed', 'retired', 'self-employed')
 *    are NEVER saved or searched as corporate employer names.
 * 2. Company disavowal signals ("this is not my company", "not my employer") immediately reset employer context.
 * 3. Numerical parameters are sanitized, bounded, and typed.
 */

import { ExtractedEntities, UnderwritingProfile } from "./types";
import {
  detectCompanyDisavowal as engineDetectCompanyDisavowal,
  isInvalidCompanyName as engineIsInvalidCompanyName,
  isFinancialOrProfileInput,
  UNEMPLOYED_REGEX,
} from "@/lib/dynamicEligibilityEngine";

export const SPECIAL_PROFILE_KEYWORDS = [
  "student",
  "in college",
  "studying",
  "homemaker",
  "housewife",
  "home maker",
  "house maker",
  "unemployed",
  "jobless",
  "no job",
  "between jobs",
  "lost job",
  "retired",
  "pensioner",
  "senior citizen",
  "self employed",
  "self-employed",
  "self employed",
  "selft employed",
  "self employd",
  "own business",
  "business owner",
  "freelance",
  "freelancer",
  "consultant",
  "no company",
  "don't have a company",
  "do not have a company",
  "not working in a company",
  "not in a company",
];

const SPECIAL_PROFILE_REGEX = new RegExp(
  `\\b(?:student|in\\s+college|studying|house[\\s-]*wife|home[\\s-]*maker|pensioner|retired|senior\\s+citizen|freelancer?|self[t\\s-]*employed|self[\\s-]*employd|own\\s+business|business\\s+owner|unemployed|jobless|no\\s+job|without\\s+job)\\b`,
  "i"
);

/**
 * Checks if a string represents a non-salaried or special profile token.
 */
export function isSpecialProfileKeyword(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  if (SPECIAL_PROFILE_REGEX.test(clean)) return true;
  if (UNEMPLOYED_REGEX.test(clean)) return true;
  return SPECIAL_PROFILE_KEYWORDS.some((kw) => clean.includes(kw));
}

/**
 * Maps special profile keywords into canonical employment types.
 */
export function resolveSpecialEmploymentType(text: string): string | null {
  if (!text) return null;
  const clean = text.trim().toLowerCase();

  if (/student|in\s+college|studying/i.test(clean)) {
    return "Student";
  }
  if (/house[\s-]*wife|home[\s-]*maker/i.test(clean)) {
    return "Homemaker";
  }
  if (/unemployed|jobless|no\s+job|between\s+jobs|lost\s+job/i.test(clean) || UNEMPLOYED_REGEX.test(clean)) {
    return "Unemployed";
  }
  if (/retired|pensioner|senior\s+citizen/i.test(clean)) {
    return "Retired";
  }
  if (/self[t\s-]*employed|self[\s-]*employd|own\s+business|business\s+owner|freelancer?/i.test(clean)) {
    return "Self-Employed";
  }
  return null;
}

/**
 * Detects whether the user is disavowing an assigned company name
 * e.g., "this is not my company", "wrong employer", "I work at TCS instead".
 */
export function detectCompanyDisavowal(text: string): { isDisavowal: boolean; replacementCompany?: string } {
  return engineDetectCompanyDisavowal(text);
}

/**
 * Checks if a string is invalid as a company name.
 */
export function isInvalidCompanyName(text: string): boolean {
  if (!text) return true;
  if (isSpecialProfileKeyword(text)) return true;
  return engineIsInvalidCompanyName(text);
}

/**
 * Sanitizes extracted entities:
 * - If companyName is a special profile token or disavowal, resets companyName and sets employmentType.
 * - Bounds checks numerical values.
 */
export function sanitizeExtractedEntities(entities: ExtractedEntities): ExtractedEntities {
  const sanitized: ExtractedEntities = { ...entities };

  // 1. Guardrail against saving non-salaried tokens as company name
  if (sanitized.companyName) {
    const rawComp = sanitized.companyName.trim();
    const specialType = resolveSpecialEmploymentType(rawComp);
    const isDisavowal = detectCompanyDisavowal(rawComp).isDisavowal;

    if (specialType || isSpecialProfileKeyword(rawComp) || isDisavowal || isInvalidCompanyName(rawComp)) {
      sanitized.companyName = undefined;
      if (specialType && !sanitized.employmentType) {
        sanitized.employmentType = specialType;
      }
    }
  }

  // 2. Numerical Sanitization & Bounding
  if (sanitized.cibilScore !== undefined && sanitized.cibilScore !== null) {
    const score = Number(sanitized.cibilScore);
    if (score === -1 || score === 0 || (score >= 300 && score <= 900)) {
      sanitized.cibilScore = score;
    } else {
      sanitized.cibilScore = undefined;
    }
  }

  if (sanitized.age !== undefined && sanitized.age !== null) {
    const age = Number(sanitized.age);
    if (age >= 18 && age <= 100) {
      sanitized.age = age;
    } else {
      sanitized.age = undefined;
    }
  }

  if (sanitized.monthlySalary !== undefined && sanitized.monthlySalary !== null) {
    const sal = Number(sanitized.monthlySalary);
    sanitized.monthlySalary = sal >= 0 && sal <= 50000000 ? sal : undefined;
  }

  if (sanitized.existingEmi !== undefined && sanitized.existingEmi !== null) {
    const emi = Number(sanitized.existingEmi);
    sanitized.existingEmi = emi >= 0 && emi <= 20000000 ? emi : undefined;
  }

  if (sanitized.loanAmount !== undefined && sanitized.loanAmount !== null) {
    const amt = Number(sanitized.loanAmount);
    sanitized.loanAmount = amt >= 1000 && amt <= 100000000 ? amt : undefined;
  }

  if (sanitized.tenureMonths !== undefined && sanitized.tenureMonths !== null) {
    const ten = Number(sanitized.tenureMonths);
    sanitized.tenureMonths = ten >= 1 && ten <= 360 ? ten : undefined;
  }

  return sanitized;
}

/**
 * Validates and normalizes an underwriting profile according to credit risk policies.
 */
export function validateUnderwritingProfile(profile: UnderwritingProfile): UnderwritingProfile {
  const sanitized = sanitizeExtractedEntities({
    age: profile.age,
    cibilScore: profile.cibilScore,
    monthlySalary: profile.monthlySalary,
    existingEmi: profile.existingEmi,
    loanAmount: profile.loanAmount,
    tenureMonths: profile.tenureMonths,
    companyName: profile.companyName,
    employmentType: profile.employmentType,
    city: profile.city,
    pincode: profile.pincode,
  });

  return {
    ...profile,
    age: sanitized.age,
    cibilScore: sanitized.cibilScore,
    monthlySalary: sanitized.monthlySalary,
    existingEmi: sanitized.existingEmi,
    loanAmount: sanitized.loanAmount,
    tenureMonths: sanitized.tenureMonths,
    companyName: sanitized.companyName,
    employmentType: sanitized.employmentType || profile.employmentType,
    city: sanitized.city,
    pincode: sanitized.pincode,
  };
}

/**
 * Standard policy guidance response for special profiles (Students, Homemakers, Unemployed, etc.)
 */
export function getSpecialProfileGuidance(employmentType: string): string {
  switch (employmentType) {
    case "Student":
      return `### 🎓 Student Profile Notice\n\nMost partner banks require applicants to be currently employed with a regular monthly salary to qualify for an unsecured Personal Loan.\n\n**Recommended Alternatives:**\n1. **Education Loan**: Dedicated student education loans for higher studies with an earning co-borrower.\n2. **Joint Application**: Apply with an earning parent or guardian as the primary applicant.\n3. **Secured Loan**: Explore a Loan Against Fixed Deposit or Gold Loan.`;

    case "Homemaker":
      return `### 🏡 Homemaker Profile Notice\n\nPartner bank personal loan policies require independent proof of verifiable monthly income (salary credits or business ITR).\n\n**Recommended Alternatives:**\n1. **Co-Applicant**: Apply jointly with an earning spouse or family member.\n2. **Secured Credit**: Inquire about Gold Loans or Loans Against Property (LAP) which offer flexible income criteria.`;

    case "Unemployed":
      return `### 💼 Unemployed / Alternate Income Pathways

While standard unsecured personal loans require verifiable monthly salary credits, we can explore alternate lending pathways tailored for you:

* **a) Alternative Income Verification:** Check if you receive verifiable rental income, dividends, or regular pension credits.
* **b) Secured / Collateralized Loans:** **Gold Loans**, **Loans Against Fixed Deposits (LAFD)**, or **Loans Against Securities** do not require corporate employment slips.
* **c) Joint Application / Co-Applicant:** Applying jointly with an earning family member (spouse/parents) allows joint approval.

Which option would you prefer to explore?`;

    case "Retired":
      return `### 🪙 Retired / Pensioner Profile Notice\n\nRetired applicants are evaluated basis regular monthly pension credits and maximum age limits (typically up to 65–70 years at loan maturity).\n\nBanks such as SBI, PNB, and select partner lenders offer dedicated Pensioner Personal Loan programs.`;

    case "Self-Employed":
      return `### 🏢 Self-Employed / Business Profile\n\nFor self-employed professionals and business owners, eligibility is determined via:\n- **Minimum Business Vintage**: Typically 2 to 3 years in the same business.\n- **Financial Documents**: Last 2 years' ITR with computation of income, P&L, balance sheet, and 6 months' bank statements.\n- **Turnover / Net Profit**: Minimum annual net profit criteria vary by lender (typically ₹2 Lakhs+ p.a.).`;

    default:
      return `Please provide details regarding your monthly net income and employment status so we can check your partner bank eligibility.`;
  }
}
