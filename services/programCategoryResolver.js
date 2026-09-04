/**
 * Program + Category Resolver for Personal Loan assistant.
 *
 * Uses exactly 8 questions:
 * 1. Company Name
 * 2. Employment Type
 * 3. CIBIL
 * 4. Age
 * 5. Monthly Salary
 * 6. Required Loan Amount
 * 7. Tenure
 * 8. Existing EMI
 *
 * For each bank, uses Company Name + Employment Type to resolve
 * the correct Program and Category from bank master policy/company mapping.
 */

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseAmountValue(value) {
  if (!value) return null;
  const clean = String(value).replace(/[₹,\s]/g, "").toLowerCase();
  if (/cr|crore/.test(clean)) {
    const num = parseFloat(clean.replace(/cr|crore|crores/g, ""));
    return Number.isFinite(num) ? num * 10000000 : null;
  }
  if (/lac|lakh|l$/.test(clean)) {
    const num = parseFloat(clean.replace(/lac|lacs|lakh|lakhs|l/g, ""));
    return Number.isFinite(num) ? num * 100000 : null;
  }
  if (/k|thousand/.test(clean)) {
    const num = parseFloat(clean.replace(/k|thousand/g, ""));
    return Number.isFinite(num) ? num * 1000 : null;
  }
  const number = parseFloat(clean);
  return Number.isNaN(number) ? null : number;
}

const RESOLVER_QUESTIONS = [
  { key: "companyName", label: "What is your employer or company name?" },
  { key: "employmentType", label: "Are you salaried or self-employed?" },
  { key: "age", label: "What is your age in years?" },
  { key: "monthlyIncome", label: "What is your monthly take-home salary (in ₹)?" },
  { key: "cibil", label: "What is your CIBIL score? (Enter 0 if unknown)" },
  { key: "existingEmi", label: "Do you have any existing EMIs? If yes, what is the total amount (in ₹)? If none, say 0." },
  { key: "loanAmount", label: "How much loan amount do you need (in ₹)?" },
  { key: "tenureMonths", label: "What is your preferred tenure in months?" },
  { key: "preferredLocation", label: "What is your current city / location (e.g. Mumbai, Pune, Delhi, Bangalore)?" }
];

function getNextResolverQuestion(applicant = {}) {
  for (const q of RESOLVER_QUESTIONS) {
    const val = applicant[q.key];
    if (val === undefined || val === null || val === "" || (typeof val === "number" && isNaN(val))) {
      return q;
    }
  }
  return null;
}

function isResolverComplete(applicant = {}) {
  return getNextResolverQuestion(applicant) === null;
}

function collectResolverField(message, existingApplicant = {}, expectedField = null) {
  const applicant = { ...existingApplicant };
  const normalized = normalizeText(message);
  const lower = normalized.toLowerCase();

  if (!expectedField) return applicant;

  switch (expectedField) {
    case "companyName": {
      const cleanCompany = normalized
        .replace(/^(working at|employed at|company is|works at|company|employer)\s+/i, "")
        .trim();
      if (cleanCompany) applicant.companyName = cleanCompany;
      return applicant;
    }

    case "employmentType":
      if (/salaried/i.test(lower)) applicant.employmentType = "Salaried";
      else if (/self|business|proprietor|freelance/i.test(lower)) applicant.employmentType = "Self-Employed";
      return applicant;

    case "cibil": {
      const numMatch = normalized.match(/\b(\d{3})\b/);
      if (numMatch) applicant.cibil = parseInt(numMatch[1], 10);
      else if (/-1|minus\s*1|zero|no\s*credit/i.test(lower)) applicant.cibil = -1;
      return applicant;
    }

    case "age": {
      const ageMatch = normalized.match(/\b(\d{2})\b/);
      if (ageMatch) applicant.age = parseInt(ageMatch[1], 10);
      return applicant;
    }

    case "monthlyIncome": {
      const val = parseAmountValue(normalized);
      if (val !== null) applicant.monthlyIncome = val;
      return applicant;
    }

    case "loanAmount": {
      const val = parseAmountValue(normalized);
      if (val !== null) applicant.loanAmount = val;
      return applicant;
    }

    case "tenureMonths": {
      const match = normalized.match(/(\d+)\s*(months?|years?|yrs?|m|y)?/i);
      if (match) {
        let val = parseInt(match[1], 10);
        if (match[2] && /years?|yrs?|y/i.test(match[2])) val *= 12;
        else if (!match[2] && val <= 7) val *= 12;
        applicant.tenureMonths = val;
      }
      return applicant;
    }

    case "existingEmi":
      if (/^(no|none|zero|nil|0|na|no emi|0 emi)$/i.test(lower)) {
        applicant.existingEmi = 0;
      } else {
        const val = parseAmountValue(normalized);
        if (val !== null) applicant.existingEmi = val;
      }
      return applicant;

    case "preferredLocation": {
      const cleanLoc = normalized.replace(/^(location|city|in|at|living in)\s+/i, "").trim();
      if (cleanLoc) applicant.preferredLocation = cleanLoc;
      return applicant;
    }

    default:
      return applicant;
  }
}

module.exports = {
  RESOLVER_QUESTIONS,
  getNextResolverQuestion,
  isResolverComplete,
  collectResolverField
};
