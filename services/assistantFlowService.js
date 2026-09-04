const {
  RESOLVER_QUESTIONS
} = require("./programCategoryResolver");

function normalizeAssistantText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getConversationState(pool, conversationId) {
  if (!pool || !conversationId) return null;
  try {
    const result = await pool.query(
      `SELECT state FROM assistant_conversation_states WHERE conversation_id = $1 AND expires_at > NOW()`,
      [conversationId]
    );
    if (result.rowCount > 0 && result.rows[0].state) {
      return result.rows[0].state;
    }
  } catch (err) {
    console.warn("Failed to load conversation state:", err.message);
  }
  return null;
}

async function setConversationState(pool, conversationId, state) {
  if (!pool || !conversationId) return;
  try {
    await pool.query(
      `INSERT INTO assistant_conversation_states (conversation_id, state, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 minutes')
       ON CONFLICT (conversation_id) DO UPDATE SET state = $2, expires_at = NOW() + INTERVAL '30 minutes'`,
      [conversationId, state || {}]
    );
  } catch (err) {
    console.warn("Failed to save conversation state:", err.message);
  }
}

async function clearConversationState(pool, conversationId) {
  if (!pool || !conversationId) return;
  try {
    await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [conversationId]);
  } catch (err) {
    console.warn("Failed to clear conversation state:", err.message);
  }
}

function isLoanIntent(text) {
  return /(loan|eligibility|eligible|emi|bank recommendation|affordability|personal loan|home loan|car loan|education loan|credit check|need a loan|apply for a loan)/i.test(
    normalizeAssistantText(text)
  );
}

function looksLikeCompanyQuery(text) {
  const normalized = normalizeAssistantText(text);

  if (!normalized || isLoanIntent(normalized)) return false;

  if (/(hi|hello|hey|thanks|thank you|help me|who are you)/i.test(normalized)) {
    return false;
  }

  return /(company|employer|organization|firm|business|corp|inc|ltd|llp|private limited)/i.test(normalized);
}

function getEligibilityQuestion(field) {
  const question = RESOLVER_QUESTIONS.find(q => q.key === field);
  return question ? question.label : "Could you please provide the required details?";
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

function collectEligibilityField(message, existingApplicant = {}, expectedField = null) {
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

function formatEligibilityResult(applicant, evaluations) {
  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    return "No applicable Personal Loan policy could be evaluated for your profile.";
  }

  const isEligible = status =>
    /^eligible$/i.test(String(status || "").trim());

  const isReview = status =>
    /^(needs[_ ]review|review)$/i.test(String(status || "").trim());

  const isNotEligible = status =>
    /^(not[_ ]eligible|fail)$/i.test(String(status || "").trim());

  const eligibleList = evaluations.filter(e => isEligible(e.status));
  const reviewList = evaluations.filter(e => isReview(e.status));
  const notEligibleList = evaluations.filter(e => isNotEligible(e.status));

  const applicantName = applicant.customerName || "Applicant";

  const formatMoney = value => {
    if (value === null || value === undefined || value === "") {
      return "Not available";
    }

    const num = Number(value);

    if (!Number.isFinite(num)) {
      return String(value);
    }

    return `₹${num.toLocaleString("en-IN")}`;
  };

  const safeChecks = evaluation =>
    Array.isArray(evaluation?.checks) ? evaluation.checks : [];

  const safeReviewReasons = evaluation =>
    Array.isArray(evaluation?.review_reasons)
      ? evaluation.review_reasons
      : [];

  const safeFailureReasons = evaluation =>
    Array.isArray(evaluation?.failure_reasons)
      ? evaluation.failure_reasons
      : [];

  const checkStatus = check =>
    String(check?.result || check?.status || "").toLowerCase();

  const lines = [];

  lines.push(`Personal Loan Eligibility Result for ${applicantName}`);
  lines.push("");

  lines.push("Your Profile");
  lines.push(`Company: ${applicant.companyName || "Not specified"}`);
  lines.push(`Employment Type: ${applicant.employmentType || "Not specified"}`);
  lines.push(`CIBIL: ${applicant.cibil ?? "Not specified"}`);
  lines.push(`Age: ${applicant.age ?? "Not specified"} years`);
  lines.push(`Monthly Salary: ${formatMoney(applicant.monthlyIncome)}`);
  lines.push(`Required Loan Amount: ${formatMoney(applicant.loanAmount)}`);
  lines.push(
    `Tenure: ${
      applicant.tenureMonths != null
        ? `${applicant.tenureMonths} months`
        : "Not specified"
    }`
  );
  lines.push(`Existing EMI: ${formatMoney(applicant.existingEmi ?? 0)}`);
  lines.push("");

  // ---------------- ELIGIBLE ----------------

  if (eligibleList.length > 0) {
    lines.push(`### ✅ ELIGIBLE BANKS (${eligibleList.length})`);
    lines.push("");

    eligibleList.forEach((ev, index) => {
      const checks = safeChecks(ev);
      const terms = ev.offered_terms || {};

      const program = ev.program || ev.matched_program || ev.program_name || null;
      const category = ev.category || ev.matched_category || null;

      lines.push(`**${index + 1}. 🏦 ${ev.bank || ev.bank_name || "Bank"}**`);

      if (program) lines.push(`• **Program**: ${program}`);
      if (category) lines.push(`• **Category**: ${category}`);
      if (ev.matched_rule) lines.push(`• **Policy Rule**: ${ev.matched_rule}`);

      const passedChecks = checks.filter(c => checkStatus(c) === "pass");
      if (passedChecks.length > 0) {
        lines.push("• **Verified Conditions**:");
        passedChecks.forEach(check => {
          const criterion = check.criterion || check.field || "Policy criterion";
          const actual = check.actual != null ? String(check.actual) : "Not specified";
          const required = check.required != null ? String(check.required) : "Not specified";
          lines.push(`  - ✓ **${criterion}**: ${actual} (Required: ${required})`);
        });
      }

      if (terms.roi != null) lines.push(`• **Interest Rate (ROI)**: ${terms.roi}% p.a.`);
      if (terms.processing_fee_percent != null) lines.push(`• **Processing Fee**: ${terms.processing_fee_percent}%`);
      else if (terms.processing_fee_flat != null) lines.push(`• **Processing Fee**: ${formatMoney(terms.processing_fee_flat)}`);
      if (terms.max_loan_amount != null) lines.push(`• **Max Loan Amount**: ${formatMoney(terms.max_loan_amount)}`);
      if (terms.max_tenure_months != null) lines.push(`• **Max Tenure**: ${terms.max_tenure_months} months`);
      if (terms.foir_percent != null) lines.push(`• **FOIR Limit**: ${terms.foir_percent}%`);
      lines.push("");
    });
  }

  // ---------------- CONDITIONAL / UNDER REVIEW ----------------
  if (reviewList.length > 0) {
    lines.push(`### ⚠️ CONDITIONAL / UNDER REVIEW BANKS (${reviewList.length})`);
    lines.push("");

    reviewList.forEach((ev, index) => {
      const reviewReasons = safeReviewReasons(ev);
      lines.push(`**${index + 1}. 🏦 ${ev.bank || ev.bank_name || "Bank"}**`);
      lines.push(`• **Status**: ⚠️ **Conditional Approval / Document Verification Needed**`);
      if (reviewReasons.length > 0) {
        lines.push(`• **Pending Items / Reasons**:`);
        reviewReasons.forEach(r => lines.push(`  - ${r}`));
      }
      lines.push("");
    });
  }

  // ---------------- INELIGIBLE BANKS ----------------
  if (notEligibleList.length > 0) {
    lines.push(`### ❌ INELIGIBLE BANKS (${notEligibleList.length})`);
    lines.push("");

    notEligibleList.forEach((ev, index) => {
      const failReasons = safeFailureReasons(ev);
      lines.push(`**${index + 1}. 🏦 ${ev.bank || ev.bank_name || "Bank"}**`);
      lines.push(`• **Status**: ❌ **Not Eligible**`);
      if (failReasons.length > 0) {
        lines.push(`• **Failure Reasons**:`);
        failReasons.forEach(f => lines.push(`  - ${f}`));
      }
      lines.push("");
    });
  }

  if (eligibleList.length === 0 && reviewList.length === 0) {
    lines.push("No banks matched as eligible based on the active policy rules for the resolved category.");
  }

  lines.push("*(Note: Eligibility is determined strictly from active bank policy rules stored in PostgreSQL database. Missing or unresolved values are not guessed.)*");

  return lines.join("\n").trim();
}

function generateEligibleBankRecommendations(eligibleList) {
  if (!eligibleList || eligibleList.length === 0) {
    return "";
  }

  const lines = [];
  lines.push("Policy-Backed Recommendations for Eligible Banks:");

  if (eligibleList.length === 1) {
    const single = eligibleList[0];
    const t = single.offered_terms || {};
    lines.push(`${single.bank} is currently your sole approved loan option based on active database policies.`);
    if (t.roi != null) lines.push(`- Interest Rate: ${t.roi}% p.a.`);
    if (t.processing_fee_percent != null || t.processing_fee_flat != null) {
      lines.push(`- Processing Fee: ${t.processing_fee_percent != null ? t.processing_fee_percent + "%" : "₹" + t.processing_fee_flat}`);
    }
    if (t.max_tenure_months) lines.push(`- Max Tenure: Up to ${t.max_tenure_months} months`);
    if (t.max_loan_amount) lines.push(`- Max Loan Amount: Up to ₹${Number(t.max_loan_amount).toLocaleString("en-IN")}`);
    lines.push("");
    return lines.join("\n");
  }

  const comparisons = [];

  const banksWithRoi = eligibleList.filter(e => e.offered_terms && e.offered_terms.roi != null);
  if (banksWithRoi.length > 0) {
    const minRoi = Math.min(...banksWithRoi.map(e => Number(e.offered_terms.roi)));
    const bestRoiBanks = banksWithRoi.filter(e => Number(e.offered_terms.roi) === minRoi);
    if (bestRoiBanks.length === 1) {
      comparisons.push(`- Lowest Interest Rate: ${bestRoiBanks[0].bank} offers the lowest rate at ${minRoi}% p.a.`);
    } else if (bestRoiBanks.length < eligibleList.length) {
      comparisons.push(`- Lowest Interest Rate: ${bestRoiBanks.map(b => b.bank).join(" and ")} offer the lowest rate at ${minRoi}% p.a.`);
    }
  }

  const banksWithFeePct = eligibleList.filter(e => e.offered_terms && e.offered_terms.processing_fee_percent != null);
  if (banksWithFeePct.length > 0) {
    const minFee = Math.min(...banksWithFeePct.map(e => Number(e.offered_terms.processing_fee_percent)));
    const bestFeeBanks = banksWithFeePct.filter(e => Number(e.offered_terms.processing_fee_percent) === minFee);
    if (bestFeeBanks.length === 1) {
      comparisons.push(`- Lowest Processing Fee: ${bestFeeBanks[0].bank} has the lowest fee at ${minFee}%`);
    } else if (bestFeeBanks.length < eligibleList.length) {
      comparisons.push(`- Lowest Processing Fee: ${bestFeeBanks.map(b => b.bank).join(" and ")} tie for lowest fee at ${minFee}%`);
    }
  }

  const banksWithTenure = eligibleList.filter(e => e.offered_terms && e.offered_terms.max_tenure_months != null);
  if (banksWithTenure.length > 0) {
    const maxTenure = Math.max(...banksWithTenure.map(e => Number(e.offered_terms.max_tenure_months)));
    const bestTenureBanks = banksWithTenure.filter(e => Number(e.offered_terms.max_tenure_months) === maxTenure);
    if (bestTenureBanks.length === 1) {
      comparisons.push(`- Longest Repayment Tenure: ${bestTenureBanks[0].bank} permits the longest tenure up to ${maxTenure} months`);
    } else if (bestTenureBanks.length < eligibleList.length) {
      comparisons.push(`- Longest Repayment Tenure: ${bestTenureBanks.map(b => b.bank).join(" and ")} offer tenure up to ${maxTenure} months`);
    }
  }

  const banksWithLoanCap = eligibleList.filter(e => e.offered_terms && e.offered_terms.max_loan_amount != null);
  if (banksWithLoanCap.length > 0) {
    const maxCap = Math.max(...banksWithLoanCap.map(e => Number(e.offered_terms.max_loan_amount)));
    const bestCapBanks = banksWithLoanCap.filter(e => Number(e.offered_terms.max_loan_amount) === maxCap);
    if (bestCapBanks.length === 1) {
      comparisons.push(`- Highest Loan Ticket Size: ${bestCapBanks[0].bank} offers the highest funding cap up to ₹${Number(maxCap).toLocaleString("en-IN")}`);
    } else if (bestCapBanks.length < eligibleList.length) {
      comparisons.push(`- Highest Loan Ticket Size: ${bestCapBanks.map(b => b.bank).join(" and ")} offer caps up to ₹${Number(maxCap).toLocaleString("en-IN")}`);
    }
  }

  const banksWithFoir = eligibleList.filter(e => e.offered_terms && e.offered_terms.foir_percent != null);
  if (banksWithFoir.length > 0) {
    const maxFoir = Math.max(...banksWithFoir.map(e => Number(e.offered_terms.foir_percent)));
    const bestFoirBanks = banksWithFoir.filter(e => Number(e.offered_terms.foir_percent) === maxFoir);
    if (bestFoirBanks.length === 1) {
      comparisons.push(`- Highest Obligation / FOIR Allowance: ${bestFoirBanks[0].bank} allows up to ${maxFoir}% fixed obligations`);
    } else if (bestFoirBanks.length < eligibleList.length) {
      comparisons.push(`- Highest Obligation / FOIR Allowance: ${bestFoirBanks.map(b => b.bank).join(" and ")} allow up to ${maxFoir}%`);
    }
  }

  if (comparisons.length > 0) {
    lines.push(comparisons.join("\n"));
  } else {
    lines.push(`All ${eligibleList.length} banks meet your requirements with comparable stored policy parameters.`);
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Handle company search in assistant flow
 * Detects if user is asking about company/employer and initiates search
 * 
 * @param {string} userMessage - User's message
 * @returns {Object} {shouldInitiateCompanySearch: boolean, companyInput: string}
 */
function detectCompanySearchIntent(userMessage) {
  const normalized = normalizeAssistantText(userMessage).toLowerCase();

  // Check if message contains loan intent (if yes, they want eligibility check, not company info)
  if (isLoanIntent(normalized)) {
    return { shouldInitiateCompanySearch: false, companyInput: null };
  }

  // Check if message looks like company query
  if (!looksLikeCompanyQuery(normalized)) {
    return { shouldInitiateCompanySearch: false, companyInput: null };
  }

  // Extract company name from message
  const companyInput = normalized
    .replace(/^(my |i work at |i'm at |employed at |company is |working at )/i, "")
    .replace(/\?.*$/i, "")
    .trim();

  return {
    shouldInitiateCompanySearch: true,
    companyInput: companyInput || null
  };
}

/**
 * Format company search results for display to user
 * 
 * @param {Array} searchResults - Distinct company names from search
 * @param {string} searchQuery - Original user query
 * @returns {string} Formatted response
 */
function formatCompanySearchResults(searchResults, searchQuery) {
  if (!Array.isArray(searchResults) || searchResults.length === 0) {
    return `I couldn't find any company matching "${searchQuery}" in our database. Could you provide more details or an alternative company name?`;
  }

  if (searchResults.length === 1) {
    return `Found your company: "${searchResults[0]}". I'll use this for your loan eligibility check. Now, let me collect your other details.`;
  }

  const formattedList = searchResults
    .slice(0, 10)
    .map((name, idx) => `${idx + 1}. ${name}`)
    .join("\n");

  return `I found several companies matching your search:\n\n${formattedList}\n\nWhich one is your employer? Please mention the exact name from the list above.`;
}

/**
 * Format supported banks list for user confirmation
 * 
 * @param {string} selectedCompany - Selected company name
 * @param {Array} supportedBanks - Array of {bank_name, company_category}
 * @returns {string} Formatted response
 */
function formatSupportedBanksConfirmation(selectedCompany, supportedBanks) {
  if (!Array.isArray(supportedBanks) || supportedBanks.length === 0) {
    return `I selected "${selectedCompany}", but unfortunately, there are no supporting bank policies available in our database for this company at the moment. Please try another company name.`;
  }

  const lines = [
    `Great! I've confirmed your company: "${selectedCompany}"`,
    `\nI found ${supportedBanks.length} bank(s) offering personal loans to employees of your company:`,
    ""
  ];

  supportedBanks.forEach((bank, idx) => {
    const categoryInfo = bank.company_category ? ` (${bank.company_category})` : "";
    lines.push(`${idx + 1}. ${bank.bank_name}${categoryInfo}`);
  });

  lines.push("");
  lines.push("I'll now check your eligibility against each of these banks. Please provide your employment details.");

  return lines.join("\n");
}

module.exports = {
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
  detectCompanySearchIntent,
  formatCompanySearchResults,
  formatSupportedBanksConfirmation
};