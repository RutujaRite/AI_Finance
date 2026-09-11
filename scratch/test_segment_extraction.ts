import { isInvalidCompanyName, isFinancialOrProfileInput } from "../lib/dynamicEligibilityEngine";
import { resolveCompanyCategories } from "../lib/companyCategoryResolver";

function extractCompanyCandidateFromSegments(text: string): string | undefined {
  // 1. Explicit key-value or phrases
  const explicitMatch = text.match(
    /(?:(?:my\s+)?(?:company|employer|organization|org)(?:\s*name)?\s*[:=-]\s*|(?:work\s+at|works\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is)\s+)([A-Za-z0-9\s&'.-]+?)(?=\s*[,;|\n]|\s+(?:and|with|salary|cibil|age|loan|emi|tenure|earning)|$)/i
  );
  if (explicitMatch) {
    const candidate = explicitMatch[1].trim();
    if (!isInvalidCompanyName(candidate) && !isFinancialOrProfileInput(candidate)) {
      return candidate;
    }
  }

  // 2. Delimited segments (comma, semicolon, pipe, newline)
  const segments = text.split(/[,;|\n]+/).map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    // Strip common leading prepositions like "at ", "in "
    const cleanSeg = seg.replace(/^(?:at|in|with)\s+/i, "").trim();
    if (
      cleanSeg.length >= 2 &&
      !isInvalidCompanyName(cleanSeg) &&
      !isFinancialOrProfileInput(cleanSeg) &&
      !/^(?:i\s+need|i\s+want|can\s+i|please|hello|hi|hey|personal\s+loan|loan)\b/i.test(cleanSeg) &&
      !messageMentionsFieldOnly(cleanSeg)
    ) {
      return cleanSeg;
    }
  }

  return undefined;
}

function messageMentionsFieldOnly(str: string): boolean {
  return /^(?:age|salary|income|cibil|credit\s*score|loan|amount|tenure|months|years|emi)\s*[:=-]?\s*.*$/i.test(str);
}

async function test() {
  const inputs = [
    "Capgemini, Age 28, Salary ₹1.5 lakh, CIBIL 810, Loan ₹10 lakh, 60 months, Existing EMI ₹0",
    "Company: Infosys, Age 28, Salary ₹1.5 lakh, CIBIL 810, Loan ₹10 lakh, 60 months, Existing EMI ₹0",
    "TCS | 30 yrs | 80000 salary | 750 cibil | 5 lakh loan | 3 yrs | 0 emi",
    "I work at Wipro, age 25, salary 45k, cibil 720, loan 3L, 2 years, 5k emi",
    "Accenture, 1.2 lakh salary, 780 cibil, 8 lakh loan, 4 years, no emi, 29 age",
  ];

  for (const input of inputs) {
    const cand = extractCompanyCandidateFromSegments(input);
    console.log(`Input: "${input.slice(0, 40)}..." -> Candidate: "${cand}"`);
    if (cand) {
      const res = await resolveCompanyCategories(cand);
      console.log(`  Resolved: isFound=${res.isFound}, matchedName="${res.matchedName}"`);
    }
  }
  process.exit(0);
}

test();
