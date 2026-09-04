import { NextRequest, NextResponse } from "next/server";
import pool from "../../../lib/db";
import { calculateDeterministicEligibility } from "../../../lib/eligibilityWizard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BANK_CATALOG: Record<string, { name: string; code: string }> = {
  adityabirla: { name: "Aditya Birla Finance", code: "ABFL" },
  "axis bank": { name: "Axis Bank", code: "AXIS" },
  "axis finance": { name: "Axis Finance", code: "AFL" },
  "bajaj finserv": { name: "Bajaj Finserv", code: "BAJAJ_FINSERV" },
  "bajaj markets": { name: "Bajaj Markets", code: "BAJAJ_MARKETS" },
  bandhan: { name: "Bandhan Bank", code: "BANDHAN" },
  "bandhan bank": { name: "Bandhan Bank", code: "BANDHAN" },
  chola: { name: "Cholamandalam Investment & Finance", code: "CHOLA" },
  fibe: { name: "Fibe (EarlySalary)", code: "FIBE" },
  finnable: { name: "Finnable Credit", code: "FINNABLE" },
  hdfc: { name: "HDFC Bank", code: "HDFC" },
  "home loan": { name: "Home Loan Services", code: "HOME_LOAN" },
  icici: { name: "ICICI Bank", code: "ICICI" },
  idfc: { name: "IDFC FIRST Bank", code: "IDFC" },
  indusind: { name: "IndusInd Bank", code: "INDUSIND" },
  kotak: { name: "Kotak Mahindra Bank", code: "KOTAK" },
  "l&t finance": { name: "L&T Finance", code: "LTF" },
  piramal: { name: "Piramal Capital & Housing Finance", code: "PIRAMAL" },
  poonawalla: { name: "Poonawalla Fincorp", code: "POONAWALLA" },
  "sbm bank": { name: "SBM Bank India", code: "SBM" },
  smfg: { name: "SMFG India Credit (Fullerton)", code: "SMFG" },
  "tata capital": { name: "Tata Capital", code: "TATA_CAPITAL" },
  "utkarsh small finance bank": { name: "Utkarsh Small Finance Bank", code: "UTKARSH" },
  "yes bank": { name: "Yes Bank", code: "YES_BANK" },
};

function normalizeText(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectBankFromText(text: string) {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return null;

  const bankNamePatterns = [
    { pattern: /axis\s*finance/i, bank: BANK_CATALOG["axis finance"] },
    { pattern: /axis\s*bank/i, bank: BANK_CATALOG["axis bank"] },
    { pattern: /aditya\s*birla/i, bank: BANK_CATALOG["adityabirla"] },
    { pattern: /bajaj\s*finserv/i, bank: BANK_CATALOG["bajaj finserv"] },
    { pattern: /bajaj\s*markets/i, bank: BANK_CATALOG["bajaj markets"] },
    { pattern: /bandhan\s*bank/i, bank: BANK_CATALOG["bandhan bank"] },
    { pattern: /tata\s*capital/i, bank: BANK_CATALOG["tata capital"] },
    { pattern: /yes\s*bank/i, bank: BANK_CATALOG["yes bank"] },
    { pattern: /hdfc/i, bank: BANK_CATALOG["hdfc"] },
    { pattern: /icici/i, bank: BANK_CATALOG["icici"] },
    { pattern: /idfc/i, bank: BANK_CATALOG["idfc"] },
    { pattern: /indusind/i, bank: BANK_CATALOG["indusind"] },
    { pattern: /kotak/i, bank: BANK_CATALOG["kotak"] },
    { pattern: /piramal/i, bank: BANK_CATALOG["piramal"] },
  ];

  for (const { pattern, bank } of bankNamePatterns) {
    if (pattern.test(normalized) && bank) return bank;
  }

  const normalizedNoSpaces = normalized.replace(/\s+/g, "");
  for (const [key, bankInfo] of Object.entries(BANK_CATALOG)) {
    const keyNoSpaces = key.replace(/\s+/g, "");
    if (normalized.includes(key) || normalizedNoSpaces.includes(keyNoSpaces)) {
      return bankInfo;
    }
    if (bankInfo && bankInfo.code) {
      const code = String(bankInfo.code).toLowerCase();
      if (code === "axis" && /axis\s*finance/i.test(normalized)) continue;
      const codeRegex = new RegExp(`\\b${escapeRegExp(code)}\\b`, "i");
      if (codeRegex.test(normalized)) return bankInfo;
    }
  }
  return null;
}

function detectLoanType(question: string): string {
  const q = normalizeText(question).toLowerCase();
  if (/business loan|\bbl\b/i.test(q)) return "Business";
  if (/home loan|housing loan|mortgage/i.test(q)) return "Home";
  if (/car loan|auto loan|vehicle loan/i.test(q)) return "Car";
  if (/education loan|student loan/i.test(q)) return "Education";
  return "Personal";
}

function formatIndianMoney(value: any): string | null {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `₹${number.toLocaleString("en-IN")}`;
}

function formatPercent(value: any): string | null {
  let number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number > 0 && number <= 1) number = number * 100;
  return `${Number(number.toFixed(2))}%`;
}

function getRuleName(rule: any): string {
  if (rule.category && String(rule.category).trim()) return String(rule.category).trim();
  if (rule.employment_type && String(rule.employment_type).trim()) return String(rule.employment_type).trim();
  if (rule.policy_version && String(rule.policy_version).trim()) return `Policy ${rule.policy_version}`;
  return `Policy Rule ${rule.id}`;
}

function removeDuplicateResults(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name}|${item.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getMasterPolicyForBank(bankId: number) {
  const result = await pool.query(
    `SELECT id, file_name, extracted_text, metadata FROM bank_policy_files WHERE bank_id = $1 AND (metadata->>'is_master_policy' = 'true' OR metadata->>'is_unified_text' = 'true') ORDER BY id DESC LIMIT 1`,
    [bankId]
  );
  if (result.rowCount === 0) return null;
  return result.rows[0];
}

function answerFromMasterPolicy(masterPolicy: any, question: string, bankName: string): string {
  if (!masterPolicy || !masterPolicy.extracted_text) {
    return `I don't have access to the master policy document for ${bankName || "this bank"}.`;
  }

  const text = String(masterPolicy.extracted_text);
  const q = normalizeText(question).toLowerCase();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const keywords: string[] = [];
  if (/cibil|credit score|bureau/i.test(q)) keywords.push("cibil", "credit score", "bureau");
  if (/salary|income|nmi|nth|net take home/i.test(q)) keywords.push("salary", "income", "nmi", "nth", "net take home");
  if (/foir|dbr/i.test(q)) keywords.push("foir", "dbr");
  if (/tenure|tenor/i.test(q)) keywords.push("tenure", "tenor");
  if (/roi|interest|pricing/i.test(q)) keywords.push("roi", "interest", "pricing");
  if (/loan amount|max loan|minimum loan/i.test(q)) keywords.push("loan amount", "maximum loan", "minimum loan");
  if (/age/i.test(q)) keywords.push("age");
  if (/processing fee/i.test(q)) keywords.push("processing fee");
  if (/document|kyc/i.test(q)) keywords.push("document", "kyc");
  if (/location|pincode|city|branch/i.test(q)) keywords.push("location", "pincode", "city", "branch");

  if (keywords.length === 0) {
    return `I found the master policy for ${bankName || "this bank"}, but I could not identify the specific policy criterion you are asking about.`;
  }

  const relevantLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  });

  if (relevantLines.length === 0) {
    return `I couldn't find a clear answer for "${normalizeText(question)}" in the ${bankName || "bank"} master policy.`;
  }

  const cleanedLines = relevantLines
    .slice(0, 8)
    .map((line) => (line.length > 240 ? line.slice(0, 240) + "..." : line));

  return (
    `Based on the master policy for ${bankName || "this bank"}:\n\n` +
    cleanedLines.map((line) => `• ${line}`).join("\n")
  );
}

async function answerPolicyQuestion(bankInfo: any, question: string): Promise<string> {
  if (!bankInfo || !bankInfo.name) {
    return "Please specify the bank name.";
  }

  const bankResult = await pool.query(
    `SELECT id, name, code FROM banks WHERE LOWER(name) = LOWER($1) OR UPPER(code) = UPPER($2) LIMIT 1`,
    [bankInfo.name, bankInfo.code || ""]
  );

  if (bankResult.rowCount === 0) {
    return `I don't have policy information for ${bankInfo.name} in the system yet.`;
  }

  const bank = bankResult.rows[0];
  const requestedLoanType = detectLoanType(question);

  const rulesResult = await pool.query(
    `SELECT
      pr.id,
      pr.loan_type,
      pr.category,
      pr.min_cibil,
      pr.max_cibil,
      pr.min_salary,
      pr.max_salary,
      pr.employment_type,
      pr.min_age,
      pr.max_age,
      pr.min_loan_amount,
      pr.max_loan_amount,
      pr.min_tenure_months,
      pr.max_tenure_months,
      pr.foir_percent,
      pr.roi,
      pr.processing_fee_percent,
      pr.processing_fee_flat,
      pr.company_rules,
      pr.location_rules,
      pr.other_rules,
      pr.status,
      pv.version AS policy_version,
      pv.status AS version_status
    FROM policy_rules pr
    JOIN policy_versions pv ON pv.id = pr.policy_version_id
    WHERE pv.bank_id = $1
      AND pv.status = 'active'
      AND pr.status IN ('active', 'review')
      AND LOWER(COALESCE(pr.loan_type, '')) LIKE LOWER($2)
    ORDER BY CASE WHEN pr.status = 'active' THEN 0 ELSE 1 END, pr.id`,
    [bank.id, `%${requestedLoanType}%`]
  );

  const rules = rulesResult.rows;

  if (rules.length === 0) {
    const masterPolicy = await getMasterPolicyForBank(bank.id);
    if (masterPolicy) {
      return answerFromMasterPolicy(masterPolicy, question, bank.name);
    }
    return `No active ${requestedLoanType} Loan policy rules were found for ${bank.name}.`;
  }

  const q = normalizeText(question).toLowerCase();
  const wantsMaximum = /\b(maximum|max|highest|up to)\b/i.test(q);
  const wantsMinimum = /\b(minimum|min|lowest|starting)\b/i.test(q);

  if (/cibil|credit score|bureau score/i.test(q)) {
    const field = wantsMaximum ? "max_cibil" : "min_cibil";
    let results = rules
      .filter((rule) => rule[field] != null)
      .map((rule) => ({ name: getRuleName(rule), value: Number(rule[field]), status: rule.status }));
    results = removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy = await getMasterPolicyForBank(bank.id);
      return answerFromMasterPolicy(masterPolicy, question, bank.name);
    }

    let response = `${bank.name} — ${requestedLoanType} Loan CIBIL Criteria\n\n`;
    if (results.length > 1) {
      response += `There is no single universal CIBIL requirement across all active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach((item) => {
      response += `• ${item.name}: ${wantsMaximum ? "Maximum" : "Minimum"} CIBIL ${item.value}${wantsMaximum ? "" : "+"}`;
      if (item.status === "review") response += " (Review)";
      response += "\n";
    });

    response += `\nThe applicable CIBIL depends on the exact program and applicant profile.`;
    return response;
  }

  if (/salary|income|nmi|nth|net take home/i.test(q)) {
    const field = wantsMaximum ? "max_salary" : "min_salary";
    let results = rules
      .filter((rule) => rule[field] != null)
      .map((rule) => ({ name: getRuleName(rule), value: formatIndianMoney(rule[field]), status: rule.status }))
      .filter((item) => item.value);
    results = removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy = await getMasterPolicyForBank(bank.id);
      return answerFromMasterPolicy(masterPolicy, question, bank.name);
    }

    let response = `${bank.name} — ${requestedLoanType} Loan Income Criteria\n\n`;
    if (results.length > 1) {
      response += `Income requirements vary across active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach((item) => {
      response += `• ${item.name}: ${wantsMaximum ? "Maximum income" : "Minimum income"} ${item.value}`;
      if (!wantsMaximum) response += "+";
      if (item.status === "review") response += " (Review)";
      response += "\n";
    });

    return response;
  }

  if (/foir|dbr/i.test(q)) {
    let results = rules
      .filter((rule) => rule.foir_percent != null)
      .map((rule) => ({ name: getRuleName(rule), value: formatPercent(rule.foir_percent), status: rule.status }))
      .filter((item) => item.value);
    results = removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy = await getMasterPolicyForBank(bank.id);
      return answerFromMasterPolicy(masterPolicy, question, bank.name);
    }

    let response = `${bank.name} — ${requestedLoanType} Loan FOIR Criteria\n\n`;
    if (results.length > 1) {
      response += `FOIR limits vary across active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach((item) => {
      response += `• ${item.name}: Maximum FOIR ${item.value}`;
      if (item.status === "review") response += " (Review)";
      response += "\n";
    });

    return response;
  }

  if (/tenure|tenor/i.test(q)) {
    const field = wantsMinimum ? "min_tenure_months" : "max_tenure_months";
    let results = rules
      .filter((rule) => rule[field] != null)
      .map((rule) => ({ name: getRuleName(rule), value: Number(rule[field]), status: rule.status }));
    results = removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy = await getMasterPolicyForBank(bank.id);
      return answerFromMasterPolicy(masterPolicy, question, bank.name);
    }

    let response = `${bank.name} — ${requestedLoanType} Loan Tenure Criteria\n\n`;
    if (results.length > 1) {
      response += `Tenure varies across active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach((item) => {
      response += `• ${item.name}: ${wantsMinimum ? "Minimum" : "Maximum"} tenure ${item.value} months`;
      if (item.status === "review") response += " (Review)";
      response += "\n";
    });

    return response;
  }

  if (/\bage\b|age limit/i.test(q)) {
    const field = wantsMaximum ? "max_age" : "min_age";
    let results = rules
      .filter((rule) => rule[field] != null)
      .map((rule) => ({ name: getRuleName(rule), value: Number(rule[field]), status: rule.status }));
    results = removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy = await getMasterPolicyForBank(bank.id);
      return answerFromMasterPolicy(masterPolicy, question, bank.name);
    }

    let response = `${bank.name} — ${requestedLoanType} Loan Age Criteria\n\n`;
    results.slice(0, 12).forEach((item) => {
      response += `• ${item.name}: ${wantsMaximum ? "Maximum" : "Minimum"} age ${item.value} years`;
      if (item.status === "review") response += " (Review)";
      response += "\n";
    });

    return response;
  }

  if (/loan amount|maximum loan|max loan|minimum loan|min loan/i.test(q)) {
    const field = wantsMinimum ? "min_loan_amount" : "max_loan_amount";
    let results = rules
      .filter((rule) => rule[field] != null)
      .map((rule) => ({ name: getRuleName(rule), value: formatIndianMoney(rule[field]), status: rule.status }))
      .filter((item) => item.value);
    results = removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy = await getMasterPolicyForBank(bank.id);
      return answerFromMasterPolicy(masterPolicy, question, bank.name);
    }

    let response = `${bank.name} — ${requestedLoanType} Loan Amount Criteria\n\n`;
    if (results.length > 1) {
      response += `Loan amount limits vary across active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach((item) => {
      response += `• ${item.name}: ${wantsMinimum ? "Minimum" : "Maximum"} loan amount ${item.value}`;
      if (item.status === "review") response += " (Review)";
      response += "\n";
    });

    return response;
  }

  if (/roi|interest rate|pricing/i.test(q)) {
    let results = rules
      .filter((rule) => rule.roi != null && String(rule.roi).trim() !== "")
      .map((rule) => ({
        name: getRuleName(rule),
        value: Number.isFinite(Number(rule.roi)) ? formatPercent(rule.roi) : String(rule.roi),
        status: rule.status,
      }))
      .filter((item) => item.value);
    results = removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy = await getMasterPolicyForBank(bank.id);
      return answerFromMasterPolicy(masterPolicy, question, bank.name);
    }

    let response = `${bank.name} — ${requestedLoanType} Loan Interest / ROI\n\n`;
    if (results.length > 1) {
      response += `Interest rates vary across active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach((item) => {
      response += `• ${item.name}: ${item.value}`;
      if (item.status === "review") response += " (Review)";
      response += "\n";
    });

    return response;
  }

  if (/processing fee|fee/i.test(q)) {
    let results = rules
      .filter((rule) => rule.processing_fee_percent != null || rule.processing_fee_flat != null)
      .map((rule) => {
        const parts: string[] = [];
        if (rule.processing_fee_percent != null) parts.push(formatPercent(rule.processing_fee_percent) || "");
        if (rule.processing_fee_flat != null) {
          const flat = formatIndianMoney(rule.processing_fee_flat);
          if (flat) parts.push(flat);
        }
        return { name: getRuleName(rule), value: parts.filter(Boolean).join(" + "), status: rule.status };
      })
      .filter((item) => item.value);
    results = removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy = await getMasterPolicyForBank(bank.id);
      return answerFromMasterPolicy(masterPolicy, question, bank.name);
    }

    let response = `${bank.name} — ${requestedLoanType} Loan Processing Fee\n\n`;
    if (results.length > 1) {
      response += `Processing fees vary across active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach((item) => {
      response += `• ${item.name}: ${item.value}`;
      if (item.status === "review") response += " (Review)";
      response += "\n";
    });

    return response;
  }

  if (/eligibility|criteria|requirements|policy/i.test(q)) {
    const activeRules = rules.filter((rule) => rule.status === "active");
    const sourceRules = activeRules.length > 0 ? activeRules : rules;

    let response = `${bank.name} — ${requestedLoanType} Loan Policy Summary\n\n`;

    const cibilValues = [...new Set(sourceRules.filter((rule) => rule.min_cibil != null).map((rule) => Number(rule.min_cibil)))];
    const salaryValues = [...new Set(sourceRules.filter((rule) => rule.min_salary != null).map((rule) => Number(rule.min_salary)))];
    const maxLoanValues = [...new Set(sourceRules.filter((rule) => rule.max_loan_amount != null).map((rule) => Number(rule.max_loan_amount)))];
    const maxTenureValues = [...new Set(sourceRules.filter((rule) => rule.max_tenure_months != null).map((rule) => Number(rule.max_tenure_months)))];
    const foirValues = [...new Set(sourceRules.filter((rule) => rule.foir_percent != null).map((rule) => formatPercent(rule.foir_percent)).filter(Boolean))];

    if (cibilValues.length > 0) response += `• Minimum CIBIL values: ${cibilValues.join(", ")}\n`;
    if (salaryValues.length > 0) response += `• Minimum income values: ${salaryValues.map(formatIndianMoney).join(", ")}\n`;
    if (maxLoanValues.length > 0) response += `• Maximum loan amounts: ${maxLoanValues.map(formatIndianMoney).join(", ")}\n`;
    if (maxTenureValues.length > 0) response += `• Maximum tenure values: ${maxTenureValues.join(", ")} months\n`;
    if (foirValues.length > 0) response += `• FOIR limits: ${foirValues.join(", ")}\n`;

    response += `\nDifferent programs may have different eligibility conditions.`;
    return response;
  }

  const masterPolicy = await getMasterPolicyForBank(bank.id);
  if (masterPolicy) {
    return answerFromMasterPolicy(masterPolicy, question, bank.name);
  }

  return `I found active policy rules for ${bank.name}, but I could not identify the specific criterion requested.`;
}

function extractEligibilityParameters(text: string) {
  const norm = normalizeText(text);

  let salary: number | undefined;
  const salMatch = norm.match(/(?:salary|income|nmi|nth|earning|monthly\s*income)(?:\s*is)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakh|lac)?/i) ||
                   norm.match(/(\d+(?:,\d+)*)\s*(k|lakh|lac)?\s*(?:salary|income)/i);
  if (salMatch) {
    let val = parseFloat(salMatch[1].replace(/,/g, ""));
    const unit = (salMatch[2] || "").toLowerCase();
    if (unit === "k") val *= 1000;
    else if (unit === "lakh" || unit === "lac") val *= 100000;
    salary = val;
  }

  let cibil: number | undefined;
  const cibilMatch = norm.match(/(?:cibil|credit\s*score|bureau(?:\s*score)?)(?:\s*is)?\s*(\d{3})/i) ||
                     norm.match(/\b(\d{3})\b\s*(?:cibil|credit\s*score)/i);
  if (cibilMatch) {
    cibil = parseInt(cibilMatch[1], 10);
  }

  let existingEmi: number | undefined;
  const emiMatch = norm.match(/(?:existing\s*emi|current\s*emi|monthly\s*emi|emi)(?:\s*is)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i);
  if (emiMatch) {
    let val = parseFloat(emiMatch[1].replace(/,/g, ""));
    if ((emiMatch[2] || "").toLowerCase() === "k") val *= 1000;
    existingEmi = val;
  }

  let employmentType: string | undefined;
  if (/salaried/i.test(norm)) employmentType = "Salaried";
  else if (/self\s*employed|business|proprietor/i.test(norm)) employmentType = "Self-Employed";

  let companyName: string | undefined;
  const compMatch = norm.match(/(?:working\s*at|company|employer|at)\s+([A-Za-z0-9\s&]+?)(?=\s+(?:salary|cibil|emi|income|can|is|with)|$)/i);
  if (compMatch) {
    const candidate = compMatch[1].trim();
    if (candidate.length > 2 && !/personal|loan|icici|hdfc|axis|sbi|kotak|salary|cibil|emi/i.test(candidate)) {
      companyName = candidate;
    }
  }

  const isEligibilityAssessmentIntent = 
    /(can i get|am i eligible|check eligibility|check my eligibility|loan approval|calculate eligibility|eligibility check)/i.test(norm) ||
    (salary !== undefined || cibil !== undefined || existingEmi !== undefined);

  return {
    salary,
    cibil,
    existingEmi,
    employmentType,
    companyName,
    isEligibilityAssessmentIntent
  };
}

function formatCalculatorResult(result: any, bankName: string): string {
  const { eligibility, policySource, calculations, passedConditions, failedConditions, missingInformation, reason } = result;

  if (eligibility === "Eligible") {
    let md = `### 🏦 ${bankName} — Personal Loan Eligibility Result: ✅ ELIGIBLE\n\n`;
    md += `**Assessment Summary**:\n`;
    md += `• **Overall Decision**: ✅ **Eligible**\n`;
    md += `• **Policy Source**: ${policySource}\n\n`;

    if (calculations && calculations.netSalary != null) {
      md += `**Calculated Obligation & Capacity**:\n`;
      md += `• **Net Monthly Salary**: ₹${calculations.netSalary.toLocaleString("en-IN")}\n`;
      if (calculations.foirPercent != null) md += `• **Max Permissible FOIR**: ${calculations.foirPercent}%\n`;
      if (calculations.maxPermissibleEmi != null) md += `• **Max Permissible EMI Cap**: ₹${calculations.maxPermissibleEmi.toLocaleString("en-IN")}\n`;
      if (calculations.existingEmi != null) md += `• **Existing Monthly EMIs**: ₹${calculations.existingEmi.toLocaleString("en-IN")}\n`;
      if (calculations.netAvailableEmi != null) md += `• **Net Available EMI Capacity**: ₹${calculations.netAvailableEmi.toLocaleString("en-IN")}/month\n`;
      if (calculations.estimatedMaxLoanAmount != null) md += `• **Estimated Max Loan Eligibility**: ~₹${calculations.estimatedMaxLoanAmount.toLocaleString("en-IN")}\n`;
      md += `\n`;
    }

    if (passedConditions && passedConditions.length > 0) {
      md += `**Verified Policy Conditions**:\n`;
      passedConditions.forEach((c: string) => { md += `• ${c}\n`; });
    }

    return md;
  }

  if (eligibility === "Not Eligible") {
    let md = `### 🏦 ${bankName} — Personal Loan Eligibility Result: ❌ NOT ELIGIBLE\n\n`;
    md += `**Assessment Summary**:\n`;
    md += `• **Overall Decision**: ❌ **Not Eligible**\n`;
    md += `• **Policy Source**: ${policySource}\n\n`;

    if (failedConditions && failedConditions.length > 0) {
      md += `**Failed Policy Criteria**:\n`;
      failedConditions.forEach((c: string) => { md += `• ${c}\n`; });
      md += `\n`;
    }

    if (passedConditions && passedConditions.length > 0) {
      md += `**Passed Policy Conditions**:\n`;
      passedConditions.forEach((c: string) => { md += `• ${c}\n`; });
    }

    return md;
  }

  let md = `### 🏦 ${bankName} — Personal Loan Eligibility Evaluation\n\n`;
  md += `**Status**: ⚠️ **Input Required / Conditionally Eligible**\n\n`;
  if (missingInformation && missingInformation.length > 0) {
    md += `To evaluate your exact loan approval and maximum permissible loan amount, please provide:\n`;
    missingInformation.forEach((info: string) => { md += `• **${info}**\n`; });
  } else if (reason) {
    md += `${reason}\n`;
  }
  return md;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const question = String(body.question || body.message || "").trim();

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const bankInfo = detectBankFromText(question);
    const params = extractEligibilityParameters(question);

    // 1. If user is asking for eligibility assessment or provided financial parameters
    if (params.isEligibilityAssessmentIntent) {
      if (!bankInfo) {
        return NextResponse.json({
          success: true,
          answer: "To evaluate your loan eligibility, please specify which bank you'd like to check with (e.g., ICICI Bank, HDFC Bank, Axis Bank), along with your net monthly salary, CIBIL score, and existing monthly EMIs.",
          bank: null,
        });
      }

      // Execute deterministic calculation engine directly
      const calcResult = await calculateDeterministicEligibility({
        bankName: bankInfo.name,
        salary: params.salary,
        cibil: params.cibil,
        existingEmi: params.existingEmi,
        companyName: params.companyName,
        employmentType: params.employmentType,
        loanType: detectLoanType(question)
      }, pool);

      const formattedAnswer = formatCalculatorResult(calcResult, bankInfo.name);

      return NextResponse.json({
        success: true,
        answer: formattedAnswer,
        bank: bankInfo.name,
        bank_code: bankInfo.code,
        calculation_result: calcResult
      });
    }

    // 2. Otherwise: General policy query (interest rates, minimum salary rules, required documents, tenure)
    if (!bankInfo) {
      return NextResponse.json({
        success: true,
        answer: "I can help you with policy information. Please specify which bank you are asking about (for example: HDFC, ICICI, Axis Bank, etc.).",
        bank: null,
      });
    }

    const answer = await answerPolicyQuestion(bankInfo, question);
    return NextResponse.json({
      success: true,
      answer,
      bank: bankInfo.name,
      bank_code: bankInfo.code,
    });
  } catch (err) {
    console.error("Policy search failed", err);
    return NextResponse.json({ error: "Policy search failed" }, { status: 500 });
  }
}
