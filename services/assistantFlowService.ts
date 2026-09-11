type Applicant = Record<string, any>;

const normalizeAssistantText = (value: unknown): string => String(value ?? "").replace(/\s+/g, " ").trim();

const RESOLVER_QUESTIONS = [
  { key: "companyName", label: "What is your employer or company name?" },
  { key: "employmentType", label: "Are you salaried or self-employed?" },
  { key: "monthlyIncome", label: "What is your monthly take-home salary (in ₹)?" },
  { key: "cibil", label: "What is your CIBIL score?" },
  { key: "existingEmi", label: "What is your current monthly EMI obligation (if any)?" },
  { key: "loanAmount", label: "What loan amount do you need (in ₹)?" },
  { key: "tenureMonths", label: "What is the preferred loan tenure in months?" },
  { key: "age", label: "What is your age?" },
];

async function getConversationState(pool: any, conversationId: string | null) {
  if (!pool || !conversationId) return null;
  try {
    const result = await pool.query(
      `SELECT state FROM assistant_conversation_states WHERE conversation_id = $1 AND expires_at > NOW()`,
      [conversationId]
    );
    if (result.rowCount > 0 && result.rows[0]?.state) {
      return result.rows[0].state;
    }
  } catch (err: any) {
    console.warn("Failed to load conversation state:", err?.message || err);
  }
  return null;
}

async function setConversationState(pool: any, conversationId: string | null, state: any) {
  if (!pool || !conversationId) return;
  try {
    await pool.query(
      `INSERT INTO assistant_conversation_states (conversation_id, state, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 minutes')
       ON CONFLICT (conversation_id) DO UPDATE SET state = $2, expires_at = NOW() + INTERVAL '30 minutes'`,
      [conversationId, state || {}]
    );
  } catch (err: any) {
    console.warn("Failed to save conversation state:", err?.message || err);
  }
}

async function clearConversationState(pool: any, conversationId: string | null) {
  if (!pool || !conversationId) return;
  try {
    await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [conversationId]);
  } catch (err: any) {
    console.warn("Failed to clear conversation state:", err?.message || err);
  }
}

function isLoanIntent(text: string): boolean {
  return /(loan|eligibility|eligible|emi|bank recommendation|affordability|personal loan|home loan|car loan|education loan|credit check|need a loan|apply for a loan)/i.test(normalizeAssistantText(text));
}

function parseAmountValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const clean = String(value).replace(/[₹,\s]/g, "").toLowerCase();
  if (!clean) return null;
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
  const num = Number.parseFloat(clean);
  return Number.isFinite(num) ? num : null;
}

function getEligibilityQuestion(field: string): string {
  const question = RESOLVER_QUESTIONS.find((q) => q.key === field);
  return question ? question.label : "Could you please provide the required details?";
}

function collectEligibilityField(message: string, existingApplicant: Applicant = {}, expectedField: string | null = null): Applicant {
  const applicant = { ...existingApplicant };
  const normalized = normalizeAssistantText(message);
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
    case "employmentType": {
      if (/salaried/i.test(lower)) applicant.employmentType = "Salaried";
      else if (/self|business|proprietor|freelance/i.test(lower)) applicant.employmentType = "Self-Employed";
      return applicant;
    }
    case "cibil": {
      const numMatch = normalized.match(/\b(\d{3})\b/);
      if (numMatch) applicant.cibil = Number.parseInt(numMatch[1], 10);
      else if (/-1|minus\s*1|zero|no\s*credit/i.test(lower)) applicant.cibil = -1;
      return applicant;
    }
    case "age": {
      const ageMatch = normalized.match(/\b(\d{2})\b/);
      if (ageMatch) applicant.age = Number.parseInt(ageMatch[1], 10);
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
        let val = Number.parseInt(match[1], 10);
        if (match[2] && /years?|yrs?|y/i.test(match[2])) val *= 12;
        else if (!match[2] && val <= 7) val *= 12;
        applicant.tenureMonths = val;
      }
      return applicant;
    }
    case "existingEmi": {
      if (/^(no|none|zero|nil|0|na|no emi|0 emi)$/i.test(lower)) {
        applicant.existingEmi = 0;
      } else {
        const val = parseAmountValue(normalized);
        if (val !== null) applicant.existingEmi = val;
      }
      return applicant;
    }
    default:
      return applicant;
  }
}

function formatEligibilityResult(applicant: Applicant, evaluations: any[]): string {
  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    return "No applicable Personal Loan policy could be evaluated for your profile.";
  }

  const formatMoney = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "Not available";
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    return `₹${num.toLocaleString("en-IN")}`;
  };

  const lines: string[] = [];
  lines.push(`Personal Loan Eligibility Result for ${applicant.customerName || "Applicant"}`);
  lines.push("");
  lines.push("Your Profile");
  lines.push(`Company: ${applicant.companyName || "Not specified"}`);
  lines.push(`Employment Type: ${applicant.employmentType || "Not specified"}`);
  lines.push(`CIBIL: ${applicant.cibil ?? "Not specified"}`);
  lines.push(`Age: ${applicant.age ?? "Not specified"} years`);
  lines.push(`Monthly Salary: ${formatMoney(applicant.monthlyIncome)}`);
  lines.push(`Required Loan Amount: ${formatMoney(applicant.loanAmount)}`);
  lines.push(`Tenure: ${applicant.tenureMonths != null ? `${applicant.tenureMonths} months` : "Not specified"}`);
  lines.push(`Existing EMI: ${formatMoney(applicant.existingEmi ?? 0)}`);
  lines.push("");

  const eligible = evaluations.filter((e) => String(e?.status || "").toLowerCase() === "eligible");
  const review = evaluations.filter((e) => /^(needs[_ ]review|review)$/i.test(String(e?.status || "")));
  const notEligible = evaluations.filter((e) => /^(not[_ ]eligible|fail)$/i.test(String(e?.status || "")));

  if (eligible.length > 0) {
    lines.push(`ELIGIBLE BANKS (${eligible.length})`);
    eligible.forEach((ev, index) => {
      lines.push(`${index + 1}. ${ev.bank || ev.bank_name || "Bank"}`);
      if (ev.matched_rule) lines.push(`Matched Rule: ${ev.matched_rule}`);
      if (ev.offered_terms?.roi != null) lines.push(`ROI: ${ev.offered_terms.roi}% p.a.`);
      if (ev.offered_terms?.processing_fee_percent != null) {
        lines.push(`Processing Fee: ${ev.offered_terms.processing_fee_percent}%`);
      }
      lines.push("");
    });
  }

  if (review.length > 0) {
    lines.push(`NEEDS REVIEW (${review.length})`);
    review.forEach((ev) => lines.push(`${ev.bank || ev.bank_name || "Bank"}: ${ev.review_reasons?.join(", ") || "Additional data required"}`));
  }

  if (notEligible.length > 0) {
    lines.push(`NOT ELIGIBLE (${notEligible.length})`);
    notEligible.forEach((ev) => lines.push(`${ev.bank || ev.bank_name || "Bank"}: ${ev.failure_reasons?.join(", ") || "Did not satisfy policy"}`));
  }

  return lines.join("\n").trim();
}

function generateEligibleBankRecommendations(eligibleList: any[] = []) {
  if (!eligibleList || eligibleList.length === 0) return "";
  const lines: string[] = ["Policy-Backed Recommendations for Eligible Banks:"];

  if (eligibleList.length === 1) {
    const single = eligibleList[0];
    const t = single.offered_terms || {};
    lines.push(`${single.bank} is currently your sole approved loan option based on active database policies.`);
    if (t.roi != null) lines.push(`- Interest Rate: ${t.roi}% p.a.`);
    if (t.max_loan_amount) lines.push(`- Max Loan Amount: Up to ₹${Number(t.max_loan_amount).toLocaleString("en-IN")}`);
    lines.push("");
    return lines.join("\n");
  }

  const comparisons: string[] = [];
  const banksWithRoi = eligibleList.filter((e) => e.offered_terms && e.offered_terms.roi != null);
  if (banksWithRoi.length > 0) {
    const minRoi = Math.min(...banksWithRoi.map((e) => Number(e.offered_terms.roi)));
    const bestRoi = banksWithRoi.filter((e) => Number(e.offered_terms.roi) === minRoi);
    comparisons.push(`- Lowest Interest Rate: ${bestRoi.map((b) => b.bank).join(" and ")} offer the lowest rate at ${minRoi}% p.a.`);
  }

  if (comparisons.length > 0) lines.push(comparisons.join("\n"));
  return lines.join("\n");
}

function looksLikeCompanyQuery(text: string): boolean {
  const normalized = normalizeAssistantText(text).toLowerCase();
  return /(company|employer|work at|works at|i work at|my company|employed at|organization)/i.test(normalized);
}

const assistantFlowService = {
  normalizeAssistantText,
  getConversationState,
  setConversationState,
  clearConversationState,
  collectEligibilityField,
  getEligibilityQuestion,
  formatEligibilityResult,
  generateEligibleBankRecommendations,
  isLoanIntent,
  looksLikeCompanyQuery,
  RESOLVER_QUESTIONS,
  parseAmountValue,
};

export {
  normalizeAssistantText,
  getConversationState,
  setConversationState,
  clearConversationState,
  collectEligibilityField,
  getEligibilityQuestion,
  formatEligibilityResult,
  generateEligibleBankRecommendations,
  isLoanIntent,
  looksLikeCompanyQuery,
  RESOLVER_QUESTIONS,
  parseAmountValue,
};

export default assistantFlowService;
