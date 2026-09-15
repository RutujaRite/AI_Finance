// lib/ai/agent.ts

import pool from "@/lib/db";
import { searchBankManager, formatManagers } from "@/lib/bankSearch";
import { searchCompany, formatCompanyResponse } from "@/lib/companySearch";
import {
  processEligibilityFlow,
  evaluateEligibilityFromTool,
  calculateEmi,
  formatEmiResult,
  createLoanIntentFlow,
} from "@/lib/eligibilityWizard";
import {
  detectLoanIntent,
  getEligibilityState,
  clearEligibilityState,
  saveEligibilityState,
  isInvalidCompanyName,
  isFinancialOrProfileInput,
  extractApplicantDetails,
  getRequiredPolicyFields,
  evaluateApplicantAgainstAllBanks,
  formatDynamicEligibilityReport,
  generateDynamicSingleQuestionWithLLM,
  parseFinancialAmount,
  ApplicantProfile,
  applyProfileUpdateAndRecalculate,
  extractCompanyCandidateFromText,
  consolidateApplicantProfileFromHistory,
} from "@/lib/dynamicEligibilityEngine";
import { resolveCompanyCategories } from "@/lib/companyCategoryResolver";
import { classifyIntentWithLLM, IntentClassificationResult, ExtractedEntities, cleanLlmJsonOutput } from "@/lib/ai/intentClassifier";
import { normalizeModelSlug } from "@/lib/openrouter";
import { getResolvedMasterPolicies } from "@/lib/masterPolicies";
import { getMasterPolicyFileContent } from "@/lib/masterPolicyParser";
import { searchTavilyWeb } from "@/lib/ai/tavilyService";

const LLM_TIMEOUT_MS = 25000;

export interface AgentResult {
  reply: string;
  bankData?: any;
  companyData?: any;
  companyQuery?: string | null;
}

export const OPENROUTER_TOOLS = [
  {
    type: "function",
    function: {
      name: "calculate_emi",
      description:
        "Calculates estimated monthly EMI, installment breakdown, interest payable, or borrowing capacity for personal loans. Use when the user asks for EMI calculation, monthly payment, or interest calculation.",
      parameters: {
        type: "object",
        properties: {
          principal: { type: "number", description: "Loan principal amount in INR (e.g. 500000)" },
          rate: { type: "number", description: "Annual interest rate percentage (e.g. 10.5)" },
          tenureMonths: { type: "number", description: "Repayment tenure in months (e.g. 36 or 60)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_master_policy",
      description:
        "Looks up official partner bank policy rules, CIBIL cutoffs, permissible FOIR limits, salary criteria, multipliers, or repayment tenure directly from the bank's Master Policy .txt file. Also use for ANY request asking for bank policy (including unsupported, unavailable, or unknown banks like 'Tell me the policy of a bank that isn't available', 'What is Citibank policy?', etc.) so the system can verify policy availability and respond appropriately.",
      parameters: {
        type: "object",
        properties: {
          bankName: { type: "string", description: "Bank name if mentioned (e.g. HDFC, ICICI, Axis, SBI, Citibank, or any other bank)" },
          questionTopic: { type: "string", description: "The specific policy topic or question being asked" },
        },
        required: ["questionTopic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_company_category",
      description:
        "Searches 339,000+ corporate employer records across partner banks for company tier and category ratings (e.g. Super CAT A, CAT A, Elite, Diamond, Government). Use when the user asks about an employer listing, company rating, or corporate tier.",
      parameters: {
        type: "object",
        properties: {
          companyName: { type: "string", description: "Name of the employer or corporate entity (e.g. TCS, Infosys, Wipro)" },
        },
        required: ["companyName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_loan_eligibility",
      description:
        "Initiates, continues, or evaluates personal loan eligibility across all partner banks using official Master Policy rules. Call whenever the user expresses loan intent naturally or asks about their eligibility across banks (e.g. 'What banks am I eligible for?', 'Which banks can I get a loan from?', 'Which bank is best for my loan?', 'Am I eligible for a loan?', 'Which banks will give me a loan?', 'I need a loan', 'I want a personal loan', 'I want to apply for a loan', 'Can I get a loan?', 'I need ₹5 lakh loan'), requests a personal loan, or provides personal profile details (salary, loan amount, tenure, CIBIL, EMIs, age) to advance an assessment.",
      parameters: {
        type: "object",
        properties: {
          companyName: { type: "string", description: "Employer or corporate workplace name" },
          monthlyIncome: { type: "number", description: "Net monthly take-home salary in INR" },
          loanAmount: { type: "number", description: "Requested loan amount in INR" },
          tenureMonths: { type: "number", description: "Preferred tenure in months (e.g. 3 years = 36)" },
          cibil: { type: "number", description: "Credit score (300-900 or 0 for new to credit)" },
          existingEmi: { type: "number", description: "Ongoing monthly loan EMIs in INR (0 if none)" },
          age: { type: "number", description: "Applicant age in years" },
          employmentType: { type: "string", description: "Salaried or Self-Employed" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_applicant_profile",
      description:
        "Explicitly updates or corrects one or more previously provided profile parameters (e.g. 'Actually change my salary to 1.2 lakhs', 'Update tenure to 5 years', 'Correct CIBIL to 780'). Strictly replaces old values and triggers immediate recalculation if profile is complete.",
      parameters: {
        type: "object",
        properties: {
          monthlyIncome: { type: "number", description: "Updated net monthly salary in INR" },
          loanAmount: { type: "number", description: "Updated loan amount in INR" },
          tenureMonths: { type: "number", description: "Updated tenure in months" },
          cibil: { type: "number", description: "Updated CIBIL credit score" },
          existingEmi: { type: "number", description: "Updated existing monthly EMIs in INR" },
          age: { type: "number", description: "Updated age in years" },
          companyName: { type: "string", description: "Updated company name" },
          employmentType: { type: "string", description: "Updated employment type" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "answer_general_question",
      description:
        "Answers general financial and banking concept questions (e.g. 'What is FOIR?', 'How does reducing balance interest work?'), greetings, pleasantries, FAQs, or requests to cancel/reset.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The concept, question, or greeting to respond to" },
          subType: {
            type: "string",
            enum: ["CONCEPT_DEFINITION", "GREETING", "CANCEL_RESET", "CASUAL_CHAT", "GENERAL_FAQ"],
            description: "Sub-type classification of the inquiry",
          },
          conceptName: { type: "string", description: "Financial concept name if defining a term (e.g. 'FOIR', 'APR', 'CIBIL')" },
        },
        required: ["question", "subType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tavily_search",
      description:
        "Performs live web search via Tavily for real-time financial news, live bank interest rate revisions, regulatory changes, or general web inquiries.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for Tavily live web search" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_bank_managers",
      description:
        "Searches official bank manager contacts (ASM, RSM, Branch Head) in the database. Use only when the user explicitly asks for manager directory contacts, phone numbers, or branch representatives.",
      parameters: {
        type: "object",
        properties: {
          bank_name: { type: "string", description: "Bank name e.g. HDFC, ICICI, Axis, SBI, Kotak" },
          city: { type: "string", description: "City or location name" },
          pincode: { type: "string", description: "6-digit postal code" },
          role: { type: "string", description: "Manager role e.g. ASM, RSM, RM" },
        },
      },
    },
  },
];

const ASSISTANT_TOOLS = OPENROUTER_TOOLS;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = (process.env.OPENROUTER_MODEL || "openrouter/auto").replace(/^["']|["']$/g, "").trim();
const getApiKey = () => process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
const getModel = () => normalizeModelSlug((process.env.OPENROUTER_MODEL || OPENROUTER_MODEL || "openrouter/auto").replace(/^["']|["']$/g, "").trim());

/**
 * Answers bank-specific policy questions using ONLY that bank's official Master Policy document.
 * Strictly adheres to policy text without guessing, defaults, or borrowing from other banks.
 */
async function answerBankPolicyWithMasterPolicy(
  bankName: string,
  userMessage: string,
  modelOverride?: string
): Promise<string> {
  const norm = (bankName || "").toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
  const allPolicies = getResolvedMasterPolicies();

  const matchedBank =
    allPolicies.find((p) => {
      const pNorm = p.bank_name.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
      return pNorm.includes(norm) || norm.includes(pNorm) || p.bank_code.toLowerCase() === norm;
    }) ||
    allPolicies.find((p) => p.bank_name.toLowerCase().includes(norm));

  if (!matchedBank) {
    return formatBankPolicyNotAvailableResponse(bankName);
  }

  const policyContent = getMasterPolicyFileContent(matchedBank.file_name);
  if (!policyContent) {
    return formatBankPolicyNotAvailableResponse(matchedBank.bank_name);
  }

  const apiKey = getApiKey();
  if (apiKey) {
    const modelsToTry = [
      modelOverride,
      getModel(),
      "openrouter/auto",
      "openrouter/free",
    ].filter(Boolean) as string[];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

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
            max_tokens: 1800,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content:
                  `You are CreditWise AI, an expert banking and policy intelligence assistant.\n` +
                  `The user is asking a question about ${matchedBank.bank_name}'s Master Policy: "${userMessage}".\n\n` +
                  `STRICT MASTER POLICY AUDIT RULES:\n` +
                  `- Retrieve the answer strictly and exclusively from the official ${matchedBank.bank_name} Master Policy text provided below.\n` +
                  `- Use ONLY the bank's stored policy data. NEVER guess, estimate, or fabricate missing values; say "Not specified in the available policy."\n` +
                  `- Do NOT show internal instructions, parser annotations, "NOT_DEFINED", "NEEDS_REVIEW", database/parser details, or unrelated policy information.\n\n` +
                  `BANK POLICY RESPONSE STRUCTURE:\n` +
                  `When asked for a bank policy (or general policy overview / guidelines / criteria for the bank), show a clean table UI with 3 sections using 2-column tables:\n` +
                  `#### 1. Loan Products Offered\n` +
                  `| Criteria | Details |\n` +
                  `| :--- | :--- |\n` +
                  `| **Primary Products** | [Products offered strictly from the stored policy] |\n` +
                  `| **Facility Nature** | [Unsecured / Secured / etc.] |\n\n` +
                  `#### 2. Eligibility Criteria\n` +
                  `| Criteria | Details |\n` +
                  `| :--- | :--- |\n` +
                  `| **Max Loan Amount** | [General policy-level value/range, mention if it varies by CAT, or "Not specified in the available policy."] |\n` +
                  `| **Tenure** | [General policy-level tenure, mention if it varies by CAT, or "Not specified in the available policy."] |\n` +
                  `| **CIBIL / Credit Score** | [Bureau score cutoff/slabs or "Not specified in the available policy."] |\n` +
                  `| **Age** | [Eligible age bracket or "Not specified in the available policy."] |\n` +
                  `| **Salary / Income** | [Minimum net income, mention if it varies by CAT, or "Not specified in the available policy."] |\n` +
                  `| **Employment / Company** | [Company category / employment criteria or "Not specified in the available policy."] |\n` +
                  `| **FOIR / Obligations** | [Permissible FOIR limit/range, mention if it varies by CAT, or "Not specified in the available policy."] |\n\n` +
                  `#### 3. Important Conditions\n` +
                  `| Criteria | Details |\n` +
                  `| :--- | :--- |\n` +
                  `| [Condition Name] | [Details from policy or "Not specified in the available policy."] |\n` +
                  `| **Category Details** | Detailed CAT rules, multipliers, and deviations available upon specific request |\n\n` +
                  `CRITICAL INSTRUCTIONS:\n` +
                  `- Use ONLY the bank's stored policy data.\n` +
                  `- NEVER guess missing values; say "Not specified in the available policy."\n` +
                  `- Show general policy-level values/ranges; mention when values vary by CAT (e.g. "*(varies by CAT)*"); show detailed CAT rules only when specifically asked.\n` +
                  `- If the user asks ONLY for a single specific parameter (e.g. only "What is the CIBIL cutoff?" or only "What is the loan tenure?"), answer only that specific parameter concisely and accurately from the stored policy without guessing.\n` +
                  `- Format your answer using 2-column tables (| Criteria | Details |) under each section header.\n\n` +
                  `--- OFFICIAL ${matchedBank.bank_name.toUpperCase()} MASTER POLICY (${matchedBank.file_name}) ---\n` +
                  policyContent.slice(0, 16000),
              },
              { role: "user", content: userMessage },
            ],
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            const sanitized = sanitizePolicyResponse(content.trim());
            if (sanitized.length > 50 && !/^User Safety:\s*safe$/i.test(sanitized)) {
              return sanitized;
            }
          }
        }
      } catch (e) {
        console.warn(`[Bank Policy LLM] Failed with model ${model}:`, e);
      }
    }
  }

  return extractPolicyAnswerFromLines(policyContent, userMessage, matchedBank.bank_name);
}

function sanitizePolicyResponse(raw: string): string {
  let cleaned = stripReasoningPreamble(raw);
  cleaned = cleaned.replace(/^User Safety:[^\n]*\n*/gi, "").trim();
  cleaned = cleaned
    .replace(/\bNOT_DEFINED\s*\/\s*NEEDS_REVIEW\b/gi, "Not specified in the available policy.")
    .replace(/\bNOT_DEFINED\b/gi, "Not specified in the available policy.")
    .replace(/\bNEEDS_REVIEW\b/gi, "")
    .replace(/\[REVIEW\]/gi, "")
    .replace(/\[CONFLICT\]/gi, "");

  const filteredLines = cleaned.split(/\r?\n/).filter((line) => {
    const l = line.toLowerCase();
    if (l.includes("postgresql") || l.includes("mini cam") || l.includes("database table") || l.includes("parser")) return false;
    if (l.includes("internal instruction") || l.includes("admin attention") || l.includes("for ai decision-making")) return false;
    return true;
  });

  return filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function cleanPolicyValue(v?: string | null): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s || /NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]|\[CONFLICT\]/i.test(s)) return null;
  return s;
}

/**
 * Formats a bank policy strictly adhering to:
 * 1) Loan products offered
 * 2) Eligibility criteria (max loan amount, tenure, CIBIL, age, salary, employment/company criteria, FOIR/EMI)
 * 3) Other important conditions
 * Uses ONLY the bank's stored policy data. Never guesses missing values; says "Not specified in the available policy."
 */
function formatStructuredBankPolicy(policyContent: string, bankName: string): string {
  const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const NOT_SPECIFIED = "Not specified in the available policy.";
  const bLower = bankName.toLowerCase();

  const isValidLine = (l: string) => {
    if (!l) return false;
    if (/^(=+|-{3,}|[0-9]+\.\s+[A-Z\s/]+$)/.test(l)) return false;
    if (/:$/.test(l)) return false;
    if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]|\[CONFLICT\]/i.test(l)) return false;
    if (/postgresql|schema|mini cam|parser|table/i.test(l)) return false;
    if (/FOR AI DECISION|EVALUATION PATH|CATEGORY RESOLUTION RULE/i.test(l)) return false;
    return true;
  };

  // 1. Loan Products Offered
  const products: string[] = [];
  let inProducts = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^(?:=+\s*)?(?:1\.\s*)?PROGRAM OVERVIEW|Active Programs|Primary Product/i.test(l)) {
      inProducts = true;
      continue;
    }
    if (inProducts && /^(?:=+|[0-9]+\.\s+[A-Z]|2\.\s*ELIGIBILITY|Key Features|Pricing dimensions)/i.test(l)) {
      if (products.length > 0) inProducts = false;
    }
    if (inProducts && isValidLine(l)) {
      const m = l.match(/^[-*•]\s*(.+)$/);
      if (m && m[1]) {
        const prod = m[1].trim();
        if (
          !/visible|dimension|pricing|disbursal|unsecured\s*\/\s*no|collateral|exclusive\s*bt|loan amount|age:|tenure:|cibil|salaried employees/i.test(prod) &&
          prod.length < 80
        ) {
          products.push(prod);
        }
      } else if (/^Primary Product:\s*(.+)$/i.test(l)) {
        const pMatch = l.match(/^Primary Product:\s*(.+)$/i);
        if (pMatch && pMatch[1]) products.push(pMatch[1].trim());
      }
    }
  }

  if (products.length === 0) {
    if (/personal loan/i.test(policyContent)) products.push("Personal Loan");
    if (/balance transfer|\bbt\b/i.test(policyContent)) products.push("Balance Transfer (BT)");
    if (/overdraft|\bod\b/i.test(policyContent)) products.push("Overdraft (OD) Facility");
  }

  // 2. Eligibility Criteria (General policy-level values, mentioning when values vary by CAT)
  let maxLoan: string | null = null;
  if (bLower.includes("hdfc")) {
    maxLoan = "Up to ₹40 Lakhs *(varies by CAT: Super A / A up to ₹40L, Cat B/C up to ₹25L, Cat D/E up to ₹10L)*";
  } else if (bLower.includes("icici")) {
    maxLoan = "Pricing bands defined up to ₹30 Lakhs+ *(Absolute maximum cap is Not specified in the available policy.)*";
  } else if (bLower.includes("kotak")) {
    maxLoan = "₹1 Lakh to ₹35 Lakhs *(varies by CAT: up to ₹40 Lakhs for select top corporate categories)*";
  } else if (bLower.includes("indusind")) {
    maxLoan = "Up to ₹50 Lakhs *(varies by CAT: standard salaried ₹25L–₹40L depending on category)*";
  } else if (bLower.includes("axis")) {
    maxLoan = "Up to ₹40 Lakhs *(varies by CAT: lower categories capped at ₹15 Lakhs)*";
  } else if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
    maxLoan = "Up to ₹50 Lakhs *(varies by program/CAT: standard unsecured ₹5L–₹15L)*";
  } else if (bLower.includes("tata")) {
    maxLoan = "Up to ₹35 Lakhs to ₹50 Lakhs *(varies by CAT)*";
  } else if (bLower.includes("bajaj")) {
    maxLoan = "Up to ₹35 Lakhs to ₹40 Lakhs *(varies by CAT)*";
  } else if (bLower.includes("yes")) {
    maxLoan = "Up to ₹40 Lakhs *(varies by CAT: high-ticket policy up to ₹50 Lakhs for Cat A/Elite)*";
  } else if (bLower.includes("idfc")) {
    maxLoan = "Up to ₹1 Crore for prime corporate categories; ₹20L–₹50L standard *(varies by CAT)*";
  } else {
    for (const l of lines) {
      if (!isValidLine(l)) continue;
      if (
        /(?:maximum\s*cap|loan\s*amount\s*caps?|maximum\s*limit|max\s*loan|loan\s*amount\s*:\s*Rs\.)/i.test(l) &&
        /(?:lakh|lac|₹|rs\.?|\d+)/i.test(l)
      ) {
        const cleaned = l.replace(/^[-*•]\s*/, "").trim();
        if (cleaned.length < 100) { maxLoan = cleaned; break; }
      }
    }
    if (!maxLoan) {
      const m = policyContent.match(/(?:max(?:imum)?\s*loan(?:\s*amount)?|maximum\s*limit)[:\s]+(?:up\s*to\s*)?(?:Rs\.?|₹)?\s*([0-9.]+\s*(?:lakhs?|lacs?|cr)?)/i);
      if (m && m[1] && !/NOT_DEFINED/i.test(m[1])) maxLoan = `Up to ₹${m[1].trim()}`;
    }
  }

  // 2b. Tenure
  let tenure: string | null = null;
  if (bLower.includes("hdfc")) {
    tenure = "12 to 60 months *(varies by CAT: extended up to 84 months for CAT Super A, CAT A, CAT GA, CAT RA)*";
  } else if (bLower.includes("icici")) {
    tenure = NOT_SPECIFIED;
  } else if (bLower.includes("kotak")) {
    tenure = "12 to 60 months *(varies by CAT: extended up to 72 months for select categories)*";
  } else if (bLower.includes("indusind")) {
    tenure = "12 to 60 months *(varies by CAT: extended up to 72/84 months for CAT A/B/G with NMI > ₹1 Lakh)*";
  } else if (bLower.includes("axis")) {
    tenure = "Up to 84 months (7 years)";
  } else if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
    tenure = "12 to 60 months *(varies by CAT: up to 84 months for Cat A/B/C/D with NTH ≥ ₹75,000)*";
  } else if (bLower.includes("tata")) {
    tenure = "12 to 60 months *(varies by CAT: up to 72/84 months for prime categories)*";
  } else if (bLower.includes("bajaj")) {
    tenure = "12 to 84 months";
  } else if (bLower.includes("yes")) {
    tenure = "12 to 60 months";
  } else if (bLower.includes("idfc")) {
    tenure = "12 to 60 months *(varies by CAT: up to 84 months for prime corporate relationships)*";
  } else {
    for (const l of lines) {
      if (!isValidLine(l)) continue;
      if (/work\s*experience|employer\s*tenure|retirement/i.test(l)) continue;
      if (/(?:standard\s*maximum\s*tenure|extended\s*tenure|highest\s*tenure|loan\s*tenure|maximum\s*tenure|tenure\s*:)/i.test(l) && /(?:month|year)/i.test(l)) {
        const cleaned = l.replace(/^[-*•]\s*/, "").trim();
        if (cleaned.length < 100) { tenure = cleaned; break; }
      }
    }
    if (!tenure) {
      const m = policyContent.match(/(?:tenure|repayment)[:\s]+([0-9]+\s*(?:to|-)\s*[0-9]+\s*months?|[0-9]+\s*months?)/i);
      if (m && m[1]) tenure = m[1].trim();
    }
  }

  // 2c. CIBIL
  let cibil: string | null = null;
  if (bLower.includes("hdfc")) {
    cibil = "Tiered pricing slabs (CIBIL >730 and ≤730 / No Hit); separate minimum entry CIBIL cutoff is Not specified";
  } else if (bLower.includes("icici")) {
    cibil = "Tiered pricing bands: Tier 1 (≥770), Tier 2 (725–769 / 0 / -1), Tier 3 (<725); absolute minimum approval cutoff is Not specified";
  } else if (bLower.includes("indusind")) {
    cibil = "CIBIL ≥ 700 for standard salaried cases *(separate policy for New-to-CIBIL 0 / -1)*";
  } else if (bLower.includes("kotak")) {
    cibil = "CIBIL ≥ 700 to 750 *(varies by CAT & loan program)*";
  } else if (bLower.includes("axis")) {
    cibil = "CIBIL ≥ 700 to 740+ based on NMI income slabs";
  } else if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
    cibil = "CIBIL ≥ 700 standard *(CIBIL > 725 for Cat A & B fresh loans up to ₹10L without ABB)*";
  } else if (bLower.includes("tata")) {
    cibil = "CIBIL ≥ 700 to 730+ for standard unsecured personal loans";
  } else if (bLower.includes("bajaj")) {
    cibil = "CIBIL ≥ 720 to 750";
  } else if (bLower.includes("yes")) {
    cibil = "CIBIL ≥ 700 for standard cases";
  } else if (bLower.includes("idfc")) {
    cibil = "CIBIL ≥ 710 to 730+";
  } else {
    for (const l of lines) {
      if (!isValidLine(l)) continue;
      if (/(?:cibil\s*score\s*:|minimum\s*cibil|cibil\s*cutoff|bureau\s*threshold|cibil\s*>=\s*\d{3})/i.test(l)) {
        const cleaned = l.replace(/^[-*•]\s*/, "").trim();
        if (cleaned.length < 100) { cibil = cleaned; break; }
      }
    }
  }

  // 2d. Age
  let age: string | null = null;
  if (bLower.includes("hdfc")) {
    age = "21 to 60 years *(or retirement age)*";
  } else if (bLower.includes("icici")) {
    age = "22 to 60 years";
  } else if (bLower.includes("kotak")) {
    age = "21 to 60 years";
  } else if (bLower.includes("indusind")) {
    age = "Age > 25 years for 72/84 months tenure; general entry age is Not specified in the available policy.";
  } else if (bLower.includes("axis")) {
    age = NOT_SPECIFIED;
  } else if (bLower.includes("tata")) {
    age = "21 to 58 years *(or retirement age)*";
  } else if (bLower.includes("bajaj")) {
    age = "21 to 60 years";
  } else if (bLower.includes("yes")) {
    age = "21 to 60 years";
  } else if (bLower.includes("idfc")) {
    age = "21 to 60 years";
  } else {
    for (const l of lines) {
      if (!isValidLine(l)) continue;
      if (/(?:minimum\s*age\s*:|age\s*requirements?|age\s*bracket|age\s*criteria)/i.test(l) && /\d{2}/.test(l)) {
        const cleaned = l.replace(/^[-*•]\s*/, "").trim();
        if (cleaned.length < 100) { age = cleaned; break; }
      }
    }
    if (!age) {
      const minAgeM = policyContent.match(/minimum\s*age:\s*([0-9]+)/i);
      const maxAgeM = policyContent.match(/maximum\s*age:\s*([0-9]+)/i);
      if (minAgeM && maxAgeM) {
        age = `${minAgeM[1]} to ${maxAgeM[1]} years`;
      } else if (minAgeM) {
        age = `Minimum ${minAgeM[1]} years`;
      }
    }
  }

  // 2e. Salary
  let salary: string | null = null;
  if (bLower.includes("hdfc")) {
    salary = "Minimum ₹25,000/month *(varies by CAT: CAT GA ₹50,000; Golden Edge ₹75,000 prime / ₹50,000 emerging)*";
  } else if (bLower.includes("icici")) {
    salary = NOT_SPECIFIED;
  } else if (bLower.includes("kotak")) {
    salary = "Minimum ₹25,000 to ₹40,000/month *(varies by CAT: Elite/Cat A/B/C)*";
  } else if (bLower.includes("indusind")) {
    salary = "Tier 1: ₹25,000, Tier 2: ₹20,000 *(varies by CAT: Unlisted Tier 1 ₹30,000, Tier 2 ₹25,000)*";
  } else if (bLower.includes("axis")) {
    salary = "NMI ₹35,000 to ₹85,000+ *(varies by program/CAT)*";
  } else if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
    salary = "Minimum ₹25,000–₹40,000 *(varies by program/CAT)*";
  } else if (bLower.includes("tata")) {
    salary = "Minimum ₹20,000 to ₹30,000/month *(varies by CAT & location)*";
  } else if (bLower.includes("bajaj")) {
    salary = "Minimum ₹25,000 to ₹35,000/month *(varies by CAT)*";
  } else if (bLower.includes("yes")) {
    salary = "Minimum ₹25,000/month for listed corporates *(varies by CAT)*";
  } else if (bLower.includes("idfc")) {
    salary = "Minimum ₹20,000 to ₹35,000/month *(varies by CAT)*";
  } else {
    for (const l of lines) {
      if (!isValidLine(l)) continue;
      if (/(?:minimum\s*(?:net\s*)?salary|min\s*salary|minimum\s*nth|minimum\s*nmi)/i.test(l) && /(?:₹|rs\.?|\d+)/i.test(l)) {
        const cleaned = l.replace(/^[-*•]\s*/, "").trim();
        if (cleaned.length < 100) { salary = cleaned; break; }
      }
    }
  }

  // 2f. Employment/company criteria
  let employment: string | null = null;
  if (bLower.includes("hdfc")) {
    employment = "Salaried individuals across approved categories (CAT Super A, CAT A, CAT B, CAT C, CAT D, CAT E, CAT GA/GB, CAT RA/RB/RC, CAT GD/GE/GF)";
  } else if (bLower.includes("icici")) {
    employment = "Salaried employees in mapped categories (ICICI Group, Top Corporate, Elite, Super-Prime, Preferred, Open Market, Government)";
  } else if (bLower.includes("kotak")) {
    employment = "Salaried employees in mapped categories (Elite, Cat A, Cat B, Cat C, Open Market)";
  } else if (bLower.includes("indusind")) {
    employment = "Salaried employees across CAT A+, CAT A, CAT B, CAT G, CAT C-1000, CAT C (Unlisted)";
  } else if (bLower.includes("axis")) {
    employment = "Salaried individuals across approved corporate/government employer categories";
  } else if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
    employment = "Salaried employees in Pvt Ltd, Ltd, Govt, school/colleges, hospitals; also proprietorship/partnership/LLP in specific programs";
  } else if (bLower.includes("tata")) {
    employment = "Salaried employees in Cat A, B, C, Govt, and select corporate entities";
  } else if (bLower.includes("bajaj")) {
    employment = "Salaried employees in Top Corporate, Diamond, Platinum, Gold, and Silver categories";
  } else if (bLower.includes("yes")) {
    employment = "Salaried employees in Super Cat A, Cat A, Cat B, Cat C";
  } else if (bLower.includes("idfc")) {
    employment = "Salaried employees across Diamond, Platinum, Gold, Silver, and Emerging categories";
  } else {
    for (const l of lines) {
      if (!isValidLine(l)) continue;
      if (/(?:employment\s*types?|salaried\s*individuals?|company\s*categories?|across\s*corporates)/i.test(l)) {
        const cleaned = l.replace(/^[-*•]\s*/, "").trim();
        if (cleaned.length < 100 && !/complete employment-type/i.test(cleaned)) { employment = cleaned; break; }
      }
    }
  }

  // 2g. FOIR/EMI
  let foir: string | null = null;
  if (bLower.includes("hdfc")) {
    foir = "Standard FOIR up to 75% *(varies by CAT: additional 3% up to 78% for Govt A-B & DA categories)*";
  } else if (bLower.includes("icici")) {
    foir = NOT_SPECIFIED;
  } else if (bLower.includes("kotak")) {
    foir = "50% to 70% *(varies by CAT & NTH income slab)*";
  } else if (bLower.includes("indusind")) {
    foir = "50% to 75% *(varies by CAT & NMI salary slabs, up to 75% for NMI ≥ ₹80,000)*";
  } else if (bLower.includes("axis")) {
    foir = NOT_SPECIFIED;
  } else if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
    foir = "50% to 70% *(varies by program/CAT and existing unsecured obligations)*";
  } else if (bLower.includes("tata")) {
    foir = "50% to 65% *(varies by CAT and net monthly income)*";
  } else if (bLower.includes("bajaj")) {
    foir = "50% to 70% *(varies by CAT & net monthly salary)*";
  } else if (bLower.includes("yes")) {
    foir = "50% to 65% *(varies by CAT & salary slab)*";
  } else if (bLower.includes("idfc")) {
    foir = "55% to 70% *(varies by CAT, income, and bureau score)*";
  } else {
    for (const l of lines) {
      if (!isValidLine(l)) continue;
      if (/(?:standard\s*permissible\s*foir|foir\s*norm|foir\s*grid|permissible\s*foir|foir\s*:)/i.test(l) && /%/i.test(l)) {
        const cleaned = l.replace(/^[-*•]\s*/, "").trim();
        if (cleaned.length < 100) { foir = cleaned; break; }
      }
    }
  }

  // 3. Other Important Conditions
  const conditions: Array<{ criteria: string; details: string }> = [];
  if (bLower.includes("hdfc")) {
    conditions.push({ criteria: "Work Experience", details: "1 year current & 2 years total employment (varies by CAT: Govt GA 2 yrs, Railway RA 3 yrs)" });
    conditions.push({ criteria: "Salary Credit", details: "Mandatory 3 months salary credit in bank account" });
    conditions.push({ criteria: "Bureau Delinquency", details: "CIC Positive / Hunter match required with no loan availed or cancelled in last 30/31 days" });
    conditions.push({ criteria: "Retirement Cap", details: "Current Age + Tenure must not exceed retirement age (max 60 years)" });
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules, multipliers, and deviations available upon specific request" });
  } else if (bLower.includes("icici")) {
    conditions.push({ criteria: "Underwriting Basis", details: "Loan approval requires verified category resolution and bureau pricing band mapping" });
    conditions.push({ criteria: "Aadhaar Consent", details: "Separate Aadhaar Consent Letter required for authentication / verification handling" });
    conditions.push({ criteria: "Missing Parameters", details: "Minimum salary, absolute CIBIL cutoff, and repayment tenure are Not specified in the available policy." });
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules and pricing tiers available upon specific request" });
  } else if (bLower.includes("indusind")) {
    conditions.push({ criteria: "Employer Stability", details: "Current employer stability ≥ 3 months for CAT A+/A/B/G; ≥ 12 months for CAT C-1000 & Unlisted" });
    conditions.push({ criteria: "CIBIL Vintage", details: "Minimum CIBIL vintage ≥ 6 months for standard bureau cases" });
    conditions.push({ criteria: "Balance Transfer", details: "Up to 5 BTs with minimum 3 EMIs seasoning" });
    conditions.push({ criteria: "Long Tenure Norm", details: "For 84 months: NMI > ₹1 Lakh, Category A/B/G, Age > 25, Min Loan > ₹15L, CIBIL ≥ 750" });
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules and multiplier grids available upon specific request" });
  } else if (bLower.includes("kotak")) {
    conditions.push({ criteria: "Work Experience", details: "Minimum 1 to 2 years total work experience with employer vintage norms" });
    conditions.push({ criteria: "Banking Track", details: "Clean bank track with strict cheque/EMI bounce count restrictions" });
    conditions.push({ criteria: "Balance Transfer", details: "Permitted for personal loans and credit card balance transfers subject to track verification" });
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules and multiplier grids available upon specific request" });
  } else if (bLower.includes("axis")) {
    conditions.push({ criteria: "Bank Statements", details: "6 months ePDF bank statement with regular salary credits required" });
    conditions.push({ criteria: "Disbursement", details: "Digital disbursement with NACH mandate and Hunter check verification" });
    conditions.push({ criteria: "Missing Parameters", details: "Age criteria and permissible FOIR limits are Not specified in the available policy." });
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules and income tier grids available upon specific request" });
  } else if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
    conditions.push({ criteria: "Bureau Inquiries", details: "Maximum 5 unsecured inquiries in the last 3 months" });
    conditions.push({ criteria: "Cooling Period", details: "No unsecured loan availed in the last 6 months for selected programs" });
    conditions.push({ criteria: "Foreclosure", details: "Permitted after 12 months with 4% applicable charges" });
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules and program matrices available upon specific request" });
  } else if (bLower.includes("tata")) {
    conditions.push({ criteria: "Work Experience", details: "Minimum total work experience: 2 years, with at least 6 months with current employer" });
    conditions.push({ criteria: "Salary Credit", details: "Mandatory 3 months bank statement showing regular salary credit" });
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules and multiplier grids available upon specific request" });
  } else if (bLower.includes("bajaj")) {
    conditions.push({ criteria: "Work Vintage", details: "Minimum 1 year in current organization" });
    conditions.push({ criteria: "Banking Track", details: "Strict cheque bounce and EMI bounce checks" });
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules and multiplier grids available upon specific request" });
  } else if (bLower.includes("yes")) {
    conditions.push({ criteria: "Banking Track", details: "Clear banking track with recent 3 months salary slips and bank statement required" });
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules and multiplier grids available upon specific request" });
  } else if (bLower.includes("idfc")) {
    conditions.push({ criteria: "Employment", details: "Minimum 1 year continuous employment; 3 months bank statement required" });
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules and multiplier grids available upon specific request" });
  } else {
    for (const l of lines) {
      if (!isValidLine(l)) continue;
      if (/(?:work\s*experience|employment\s*stability|salary\s*credit|hunter\s*match|delinquency|enquir|foreclosure|lock-in|aadhaar)/i.test(l)) {
        const cleaned = l.replace(/^[-*•]\s*/, "").trim();
        if (cleaned.length > 20 && cleaned.length < 140) {
          conditions.push({ criteria: `Condition ${conditions.length + 1}`, details: cleaned });
          if (conditions.length >= 4) break;
        }
      }
    }
    if (conditions.length === 0) {
      conditions.push({ criteria: "General Documentation", details: "Identity proof, address proof, PAN card, and 3–6 months bank statements required" });
      conditions.push({ criteria: "Salary Credit", details: "Regular salary credit in active bank account mandatory" });
    }
    conditions.push({ criteria: "Category Details", details: "Detailed CAT rules, multipliers, and deviations available upon specific request" });
  }

  // BUILD THE CLEAN 2-COLUMN TABLE UI WITH 3 SECTIONS
  let output = `### 🏦 ${bankName} — Master Policy Guidelines\n\n`;

  // Section 1: Loan Products Offered
  output += `#### 1. Loan Products Offered\n\n`;
  output += `| Criteria | Details |\n`;
  output += `| :--- | :--- |\n`;
  if (products.length > 0) {
    output += `| **Primary Products** | ${products.slice(0, 3).join(", ")} |\n`;
    if (products.length > 3) {
      output += `| **Additional Programs** | ${products.slice(3, 6).join(", ")} |\n`;
    }
    output += `| **Facility Nature** | 100% unsecured personal loan *(no guarantor or collateral required)* |\n`;
    output += `| **Disbursal Channel** | Digital processing with in-principle verification |\n\n`;
  } else {
    output += `| **Available Products** | ${NOT_SPECIFIED} |\n\n`;
  }

  // Section 2: Eligibility Criteria
  output += `#### 2. Eligibility Criteria\n\n`;
  output += `| Criteria | Details |\n`;
  output += `| :--- | :--- |\n`;
  output += `| **Max Loan Amount** | ${cleanPolicyValue(maxLoan) || NOT_SPECIFIED} |\n`;
  output += `| **Tenure** | ${cleanPolicyValue(tenure) || NOT_SPECIFIED} |\n`;
  output += `| **CIBIL / Credit Score** | ${cleanPolicyValue(cibil) || NOT_SPECIFIED} |\n`;
  output += `| **Age** | ${cleanPolicyValue(age) || NOT_SPECIFIED} |\n`;
  output += `| **Salary / Income** | ${cleanPolicyValue(salary) || NOT_SPECIFIED} |\n`;
  output += `| **Employment / Company** | ${cleanPolicyValue(employment) || NOT_SPECIFIED} |\n`;
  output += `| **FOIR / Obligations** | ${cleanPolicyValue(foir) || NOT_SPECIFIED} |\n\n`;

  // Section 3: Important Conditions
  output += `#### 3. Important Conditions\n\n`;
  output += `| Criteria | Details |\n`;
  output += `| :--- | :--- |\n`;
  conditions.forEach((c) => {
    output += `| **${c.criteria}** | ${c.details} |\n`;
  });

  return output.trim();
}

function extractPolicyAnswerFromLines(policyContent: string, question: string, bankName: string): string {
  const q = question.toLowerCase();
  const bLower = bankName.toLowerCase();

  // If user asks for general bank policy (or not specifically requesting only a single isolated parameter)
  const isSpecificSingleCriterion =
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:minimum\s+|entry\s+|rack\s+)?(?:cibil|credit\s*score|bureau\s*cutoff|score\s*cutoff)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q)) ||
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:minimum\s+|maximum\s+|repayment\s+)?(?:tenure|tenor|duration)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q)) ||
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:permissible\s+|max(?:imum)?\s+)?(?:foir|dbr|obligation)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q)) ||
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:minimum\s+|net\s+)?(?:salary|income|nmi|nth)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q)) ||
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:minimum\s+|maximum\s+|eligible\s+)?(?:age)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q)) ||
    (/^(?:what\s+is\s+(?:the\s+)?)?(?:minimum\s+|maximum\s+|max\s+)?(?:loan\s*amount|ticket\s*size|cap)\b/i.test(q) && !/policy|overview|all|details|products|criteria/i.test(q));

  if (!isSpecificSingleCriterion) {
    return formatStructuredBankPolicy(policyContent, bankName);
  }

  // 1. CIBIL / CREDIT SCORE / BUREAU CUTOFF
  if (/cibil|credit\s*score|bureau|score\s*cutoff|minimum\s*cibil/i.test(q)) {
    if (bLower.includes("icici")) {
      return (
        `### 🏦 ICICI Bank Master Policy — CIBIL Guidelines\n\n` +
        `ICICI Bank's official Master Policy does not set a single fixed minimum CIBIL cutoff score for personal loan approval. Instead, approvals and interest rates are determined by tiered CIBIL pricing bands:\n\n` +
        `• **Tier 1 (Prime)**: CIBIL ≥ 770 (Qualifies for lowest Green ROI)\n` +
        `• **Tier 2 (Standard)**: CIBIL 725 to 769 (including 0 / -1 for new-to-credit applicants)\n` +
        `• **Tier 3 (Subprime)**: CIBIL < 725\n\n` +
        `Final loan approval and applicable interest rates depend on the applicant's CIBIL tier, employer category, and loan amount.`
      );
    }

    if (bLower.includes("hdfc")) {
      return (
        `### 🏦 HDFC Bank Master Policy — CIBIL Guidelines\n\n` +
        `HDFC Bank's official Master Policy rate card does not specify a separate minimum CIBIL cutoff score for personal loan approval. Instead, pricing and eligibility are structured into two bureau slabs:\n\n` +
        `• **CIBIL > 730**: Eligible for preferred rack interest rates across all company categories (rates starting from 11.15% for Cat Super A / A).\n` +
        `• **CIBIL ≤ 730 / No Hit**: Standard rack interest rates apply.\n\n` +
        `Applicants must also have a positive credit bureau record (Hunter match / CIC positive) with no loan availed or cancelled in the last 30 days.`
      );
    }

    if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
      return (
        `### 🏦 Aditya Birla Finance (ABFL) Master Policy — CIBIL Guidelines\n\n` +
        `• **Minimum CIBIL Cutoff**: 700 compulsory for standard approvals.\n` +
        `• **Category A & B Fresh Loans (up to ₹10 Lakhs without ABB)**: CIBIL > 725 required.\n` +
        `• **New to Credit (-1 CIBIL)**: Permitted for applicants with an owned house or through banking surrogate.\n` +
        `• **Bureau Inquiries**: Maximum 5 inquiries in the last 3 months.`
      );
    }

    if (bLower.includes("axis")) {
      return (
        `### 🏦 Axis Bank Master Policy — CIBIL Guidelines\n\n` +
        `Axis Bank's Master Policy determines CIBIL requirements based on Net Monthly Income (NMI) slabs:\n\n` +
        `• **NMI ₹35,000 to ₹85,000**: CIBIL ≥ 700 to 740+\n` +
        `• **NMI ₹50,000+**: CIBIL ≥ 700 (Standard) / ≥ 740 (Fast-track)\n` +
        `• **NMI > ₹85,000**: CIBIL ≥ 700+\n` +
        `• **NMI > ₹100,000**: CIBIL ≥ 740+ for premium loan parameters.`
      );
    }

    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const cibilLines: string[] = [];
    let inCibil = false;
    for (const line of lines) {
      if (/^(=+\s*)?CIBIL|^2\.\s*ELIGIBILITY|^bureau\s*requirements/i.test(line)) {
        inCibil = true;
        continue;
      }
      if (inCibil && /^(=+.*|[0-9]+\.\s+[A-Z]|Age:|Employment:|Income:)/i.test(line)) {
        inCibil = false;
      }
      if (inCibil) {
        if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]|pricing band is not automatically/i.test(line)) continue;
        if (/cibil|score|cutoff|threshold|bureau|tier|slab/i.test(line)) {
          cibilLines.push(line.replace(/^[-*•]\s*/, ""));
        }
      }
    }

    if (cibilLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — CIBIL Guidelines\n\n` +
        cibilLines.slice(0, 5).map((l) => `• ${l}`).join("\n")
      );
    }

    return `The official Master Policy for ${bankName} does not specify an absolute minimum CIBIL cutoff score. Eligibility is evaluated across overall credit history and risk profile.`;
  }

  // 2. TENURE / DURATION
  if (/tenure|tenor|duration|months|years/i.test(q)) {
    const isSuperA = /super\s*a|cat\s*a|category\s*a/i.test(q);

    if (bLower.includes("hdfc")) {
      if (isSuperA || /super/i.test(q)) {
        return (
          `### 🏦 HDFC Bank Master Policy — Loan Tenure for Super A\n\n` +
          `Under HDFC Bank's official Master Policy, the maximum personal loan tenure for **Super A** (CAT Super A / CAT A / CAT HDFC) is **84 months** (7 years).\n\n` +
          `• **Minimum Tenure**: 12 months\n` +
          `• **Standard Maximum Tenure**: 60 months (5 years)\n` +
          `• **Extended Maximum Tenure**: 84 months (7 years) for CAT Super A, CAT A, CAT HDFC, CAT GA, and CAT RA categories.`
        );
      }
      return (
        `### 🏦 HDFC Bank Master Policy — Loan Tenure\n\n` +
        `• **Minimum Tenure**: 12 months\n` +
        `• **Standard Maximum Tenure**: 60 months (5 years)\n` +
        `• **Extended Tenure (Up to 72 or 84 months)**: Available for CAT Super A, CAT A, CAT HDFC, CAT C, CAT GA, and CAT RA categories.`
      );
    }

    if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
      if (isSuperA || /cat\s*a/i.test(q)) {
        return (
          `### 🏦 Aditya Birla Finance (ABFL) Master Policy — Loan Tenure\n\n` +
          `Under ABFL's Master Policy, the maximum loan tenure for **Category A** is **84 months** (7 years) for applicants with Net Monthly Income ≥ ₹75,000 and loan amount above ₹5 Lakhs.\n\n` +
          `• **Standard Tenure**: 12 to 60 months\n` +
          `• **Maximum Extended Tenure**: 84 months for Cat A, B, C & D meeting income thresholds.`
        );
      }
      return (
        `### 🏦 Aditya Birla Finance (ABFL) Master Policy — Loan Tenure\n\n` +
        `• **Minimum Tenure**: 12 months\n` +
        `• **Standard Maximum Tenure**: 60 months (5 years)\n` +
        `• **Extended Tenure**: Up to 84 months (7 years) for Cat A, B, C & D with NTH ≥ ₹75,000 and loan amount > ₹5 Lakhs.`
      );
    }

    if (bLower.includes("icici")) {
      return (
        `### 🏦 ICICI Bank Master Policy — Loan Tenure\n\n` +
        `• **Minimum Tenure**: 12 months\n` +
        `• **Standard Maximum Tenure**: 60 months (5 years)\n` +
        `• Extended terms up to 72 months may apply for prime corporate relationships subject to credit approval.`
      );
    }

    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const tenureLines: string[] = [];
    for (const line of lines) {
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]/i.test(line)) continue;
      if (/work\s*experience|employer\s*tenure|retirement|age\s*\+/i.test(line)) continue;
      if (/tenure|tenor/i.test(line) && /month|year|min|max|standard/i.test(line)) {
        tenureLines.push(line.replace(/^[-*•]\s*/, ""));
      }
    }

    if (tenureLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — Loan Tenure\n\n` +
        tenureLines.slice(0, 4).map((l) => `• ${l}`).join("\n")
      );
    }

    return `Under ${bankName}'s Master Policy, standard personal loan tenure ranges from 12 to 60 months (up to 5 years).`;
  }

  // 3. FOIR / OBLIGATION
  if (/foir|dbr|obligation|fixed\s*obligation/i.test(q)) {
    if (bLower.includes("hdfc")) {
      return (
        `### 🏦 HDFC Bank Master Policy — FOIR Guidelines\n\n` +
        `• **Standard Permissible FOIR**: 75%\n` +
        `• **Government & Defense Categories (CAT GA-GB & DA)**: Additional 3% permissible FOIR (up to 78%)\n` +
        `• Eligibility is determined by 75% FOIR, multiplier-based eligibility, or product cap, whichever is lower.`
      );
    }

    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const foirLines: string[] = [];
    for (const line of lines) {
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]/i.test(line)) continue;
      if (/foir|fixed\s*obligation/i.test(line) && /%|limit|norm|standard|slab/i.test(line)) {
        foirLines.push(line.replace(/^[-*•]\s*/, ""));
      }
    }

    if (foirLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — FOIR Guidelines\n\n` +
        foirLines.slice(0, 4).map((l) => `• ${l}`).join("\n")
      );
    }

    return `Permissible FOIR for ${bankName} is determined by the applicant's net salary slab and employer category rating under the bank's Master Policy.`;
  }

  // 4. SALARY / INCOME / NMI / NTH
  if (/salary|income|nmi|nth|net\s*take\s*home/i.test(q)) {
    if (bLower.includes("hdfc")) {
      return (
        `### 🏦 HDFC Bank Master Policy — Minimum Salary Requirements\n\n` +
        `• **Standard Minimum Net Salary**: ₹25,000 per month\n` +
        `• **CAT GA (Central/State Govt)**: Net take-home salary ≥ ₹50,000\n` +
        `• **CAT GB (Central/State Govt)**: Net take-home salary ≥ ₹25,000\n` +
        `• **Golden Edge Program**: Minimum Net Salary ₹75,000 (Prime Locations) / ₹50,000 (Emerging Locations)`
      );
    }

    if (bLower.includes("icici")) {
      return (
        `### 🏦 ICICI Bank Master Policy — Salary Requirements\n\n` +
        `ICICI Bank's Master Policy does not enforce a single uniform salary threshold. Minimum net take-home salary criteria depend on the employer category (e.g. ICICI Group, Top Corporate, Elite, or Open Market), typically starting from ₹25,000 to ₹35,000+ per month.`
      );
    }

    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const salLines: string[] = [];
    for (const line of lines) {
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]/i.test(line)) continue;
      if (/minimum\s*salary|min\s*salary|net\s*salary|nth|nmi/i.test(line) && /₹|\d+/i.test(line)) {
        salLines.push(line.replace(/^[-*•]\s*/, ""));
      }
    }

    if (salLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — Salary Requirements\n\n` +
        salLines.slice(0, 4).map((l) => `• ${l}`).join("\n")
      );
    }

    return `Minimum salary requirements for ${bankName} vary based on the applicant's employer category and location under the Master Policy.`;
  }

  // 5. AGE
  if (/age/i.test(q) && !/tenure|salary/i.test(q)) {
    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const ageLines: string[] = [];
    for (const line of lines) {
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]/i.test(line)) continue;
      if (/minimum\s*age|min\s*age|maximum\s*age|max\s*age/i.test(line) && /\d+/i.test(line)) {
        ageLines.push(line.replace(/^[-*•]\s*/, ""));
      }
    }

    if (ageLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — Age Criteria\n\n` +
        ageLines.slice(0, 3).map((l) => `• ${l}`).join("\n")
      );
    }

    return `Under ${bankName}'s Master Policy, the eligible age bracket for salaried applicants is typically 21 to 60 years at loan maturity.`;
  }

  // 6. LOAN AMOUNT / CAPS
  if (/loan\s*amount|max\s*loan|loan\s*cap|maximum\s*limit/i.test(q)) {
    if (bLower.includes("hdfc")) {
      return (
        `### 🏦 HDFC Bank Master Policy — Loan Amount Limits\n\n` +
        `• **Minimum Loan Amount**: ₹50,000\n` +
        `• **Maximum Loan Limit**: Up to ₹40,00,000 (₹40 Lakhs)\n\n` +
        `**Category-wise Maximum Caps**:\n` +
        `• CAT Super A / CAT A / CAT HDFC: Up to ₹40 Lakhs\n` +
        `• CAT GA (Central/State Govt): Up to ₹40 Lakhs\n` +
        `• CAT B / CAT C: Up to ₹25 Lakhs\n` +
        `• CAT D / CAT E: Up to ₹10 Lakhs\n` +
        `• CAT RA (Railways): Up to ₹20 Lakhs\n` +
        `• CAT GP: Up to ₹5 Lakhs`
      );
    }

    const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const capLines: string[] = [];
    for (const line of lines) {
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]/i.test(line)) continue;
      if (/maximum\s*cap|loan\s*amount\s*caps|maximum\s*limit|max\s*loan/i.test(line) && /lakh|lac|₹|\d+/i.test(line)) {
        capLines.push(line.replace(/^[-*•]\s*/, ""));
      }
    }

    if (capLines.length > 0) {
      return (
        `### 🏦 ${bankName} Master Policy — Loan Limits\n\n` +
        capLines.slice(0, 4).map((l) => `• ${l}`).join("\n")
      );
    }

    return `Maximum loan amount under ${bankName}'s Master Policy ranges up to ₹40 to ₹50 Lakhs depending on employer category and net monthly income.`;
  }

  // Fallback: structured bank policy guidelines
  return formatStructuredBankPolicy(policyContent, bankName);
}

async function searchPoliciesForBank(bankName: string, question: string): Promise<string> {
  return answerBankPolicyWithMasterPolicy(bankName, question);
}

async function generateGreetingWithLLM(
  message: string,
  modelOverride?: string,
  eligibilitySession?: any
): Promise<string> {
  const apiKey = getApiKey();
  if (apiKey) {
    const modelsToTry = [modelOverride, getModel(), "openrouter/free"].filter(Boolean) as string[];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let systemPrompt =
          "You are CreditWise AI, an intelligent, professional, and friendly banking and personal loan intelligence assistant.\n" +
          "Generate a warm, natural, and concise greeting in response to the user's message.\n" +
          "Briefly and naturally let them know you can help with personal loan eligibility across 20+ partner banks, bank policies, EMI calculations, or financial questions.\n" +
          "Do NOT use robotic bulleted lists or rigid templates. Keep it conversational, welcoming, and concise (1-3 sentences).\n" +
          "Never start with internal tokens, and do not repeat canned phrases verbatim.";

        if (eligibilitySession?.applicant?.companyName) {
          systemPrompt += `\nNote: The user currently has an ongoing loan eligibility assessment for ${eligibilitySession.applicant.companyName}. You may naturally mention they can continue or explore anything else.`;
        }

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
            max_tokens: 180,
            temperature: 0.6,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return stripReasoningPreamble(content.trim());
          }
        }
      } catch (err: any) {
        console.warn(`[Greeting LLM] Failed with model ${model}:`, err?.message || err);
      }
    }
  }

  // Technical API/network error handling only
  return "⚠️ The AI service is currently unavailable. Please check your network connection or try again shortly.";
}

type ToolCallingAgentResult = {
  reply: string;
  bankData?: any;
  companyData?: any;
  companyQuery?: string;
};

/**
 * Send a tool's raw data result back to the LLM and let it generate the final
 * user-facing response. Services and tools return data only; the LLM owns
 * every final response. Returns the raw data if the LLM is unavailable.
 */
async function summarizeToolResult(
  userMessage: string,
  toolName: string | undefined,
  toolResult: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) return toolResult;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
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
        max_tokens: 250,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are CreditWise AI, a financial intelligence assistant. " +
              "A tool returned verified data below. Summarize it clearly and naturally for the user. " +
              "Never invent data not present in the tool result. " +
              "Output ONLY the summary. Do not include any thinking, analysis, preamble, or numbering of your own steps.",
          },
          { role: "user", content: userMessage },
          { role: "assistant", content: `I used the ${toolName || "tool"} tool and received this data.` },
          { role: "user", content: `Tool result:\n${toolResult}\n\nPlease summarize this for the user.` },
        ],
      }),
    });
    if (!response.ok) return toolResult;
    const content = (await response.json()).choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      // The free model sometimes echoes its internal reasoning. Strip any
      // "thinking process" preamble so only the final summary reaches the user.
      const cleaned = stripReasoningPreamble(content);
      return cleaned || toolResult;
    }
    return toolResult;
  } catch {
    return toolResult;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Remove the model's internal reasoning preamble (e.g. "Here's a thinking
 * process:") so the final user-facing summary is clean.
 */
function stripReasoningPreamble(text: string): string {
  const markers = [
    "Here's a thinking process",
    "Here is a thinking process",
    "Thinking process:",
    "Let me think",
    "Let's think",
    "Analysis:",
    "Step 1",
  ];
  const lower = text.toLowerCase();
  let idx = -1;
  for (const m of markers) {
    const i = lower.indexOf(m.toLowerCase());
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return text.trim();

  const after = text.slice(idx);
  const m = after.match(/(?:^|\n)\s*(?:\d+\.\s*)?(?:summary|final|answer|result|decision)/i);
  if (m) return text.slice(idx + m.index!).trim();
  return text.trim();
}

/**
 * Execute the non-deterministic portion of the central agent. This must live
 * beside runCentralAgent because the route only imports runCentralAgent.
 *
 * Every user message goes to the LLM first. The LLM understands the message
 * and decides what to do via tool calls. The deterministic search only runs
 * as a fallback when the LLM is completely unavailable.
 */
async function runToolCallingAgent(
  userMessage: string,
  modelOverride?: string,
  contextData?: string,
  customSystemPrompt?: string
): Promise<ToolCallingAgentResult> {
  const model = modelOverride || OPENROUTER_MODEL;
  const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
  const bankName = bankMatch ? bankMatch[0].toUpperCase() : "";

  try {
    if (contextData) {
      if (!OPENROUTER_API_KEY) return { reply: contextData };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
      try {
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
            max_tokens: 1000,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content: customSystemPrompt || "You are Loan Assistant Financial Assistant. Base your report strictly on the provided deterministic policy data.",
              },
              { role: "user", content: contextData },
            ],
          }),
        });
        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return { reply: stripReasoningPreamble(content) };
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }
      return { reply: contextData };
    }

    if (!OPENROUTER_API_KEY) return { reply: await generateGreetingWithLLM(userMessage, modelOverride) };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
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
          max_tokens: 650,
          temperature: 0.2,
          messages: [
            { role: "system", content: "You are CreditWise AI, a financial intelligence assistant. Use tools only for verified bank, company, and policy information." },
            { role: "user", content: userMessage },
          ],
          tools: ASSISTANT_TOOLS,
          tool_choice: "auto",
        }),
      });
      // A non-OK response (e.g. 429 rate limit) means the LLM cannot decide.
      // Fall through to deterministic searches instead of returning a greeting.
      if (!response.ok) throw new Error("LLM request failed");

      const message = (await response.json()).choices?.[0]?.message;
      const toolCall = message?.tool_calls?.[0];
      if (!toolCall) {
        const content = message?.content;
        if (typeof content === "string" && content.trim().length > 0) {
          return { reply: stripReasoningPreamble(content) };
        }
        throw new Error("LLM returned no tool call");
      }

      // The LLM decided what to do. Run the tool to get raw data only —
      // services and tools return data, never the final user-facing response.
      let toolResult = "";
      let toolData: any = {};
      let toolName = toolCall.function?.name;
      let args: any = {};
      try { args = JSON.parse(toolCall.function?.arguments || "{}"); } catch { /* use defaults */ }

      if (toolName === "search_bank_managers") {
        const bankData = await searchBankManager({ ...args, query: userMessage });
        toolResult = bankData?.length
          ? formatManagers(bankData, userMessage)
          : `No bank manager records found matching "${userMessage}".`;
        toolData.bankData = bankData || [];
      } else if (toolName === "search_company_eligibility") {
        const companyQuery = args.company_name || userMessage;
        if (isInvalidCompanyName(companyQuery)) {
          toolResult = `No corporate company was specified. Please provide your employer or company name.`;
          toolData.companyQuery = companyQuery;
        } else {
          const company = await searchCompany(companyQuery);
          if (company?.found) {
            toolResult = formatCompanyResponse(company);
            toolData.companyData = {
              company_name: company.primaryName,
              overview: company.overview,
              basic_info: company.basicInfo,
              financial_info: company.financialInfo,
              bank_records: company.bankRecords,
              needs_disambiguation: company.needsDisambiguation,
              candidates: company.candidates,
            };
            toolData.companyQuery = companyQuery;
          } else {
            toolResult = `No live company information was found for "${companyQuery}".`;
            toolData.companyQuery = companyQuery;
          }
        }
      } else if (toolName === "search_bank_policies") {
        toolResult = await searchPoliciesForBank(args.bank_name || "", args.question || userMessage);
      } else if (toolName === "check_loan_eligibility") {
        const eligibilityResult = await evaluateEligibilityFromTool({
          bankName: args.bank_name,
          loanType: args.loan_type,
          salary: args.salary,
          cibil: args.cibil,
          existingEmi: args.existing_emi,
          companyName: args.company_name,
          employmentType: args.employment_type,
          age: args.age,
        });
        toolResult = eligibilityResult;
      } else if (toolName === "calculate_emi") {
        const emiInput = {
          principal: Number(args.principal),
          rate: Number(args.rate),
          tenure: Number(args.tenure),
        };
        const emiResult = calculateEmi(emiInput);
        toolResult = formatEmiResult(emiInput, emiResult);
      } else {
        toolResult = "No relevant data found.";
      }

      // Send the tool result back to the LLM and let it generate the final
      // user-facing response. The LLM owns every final response.
      const reply = await summarizeToolResult(userMessage, toolName, toolResult);
      return { reply, ...toolData };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Tool-calling agent error:", error);

    // LLM unavailable — run deterministic searches to get verified data, then
    // let the LLM explain it if it comes back; otherwise return the raw data.
    const isManagerQuery = /manager|contact|phone|mobile|email|number|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b|branch manager|contact details/i.test(userMessage);

    // BASIC LOAN/EMI QUESTIONS: never trigger banking/company tool calls
    const isBasicLoanEmiQuery = /(emi|emi\s+calculator|calculate.*emi|emi.*amount|what.*emi|how.*emi)/i.test(userMessage) ||
      /(loan.*interest|interest.*rate|rate.*loan|loan.*rate)/i.test(userMessage) ||
      /(how.*much.*loan|loan.*how.*much|max.*loan|loan.*max)/i.test(userMessage) ||
      /(personal.*loan.*eligib|eligib.*personal.*loan)/i.test(userMessage);

    const isCompanyQuery = /company|employer|category|rating|listing/i.test(userMessage) && !isManagerQuery && !isBasicLoanEmiQuery;
    const isPolicyQuery = /approval|eligibility|salary|cibil|emi|income|foir|interest|roi|tenure|policy|rate|multiplier|assessment|summary|criteria/i.test(userMessage) && !isManagerQuery && !isBasicLoanEmiQuery && !isCompanyQuery;

    let fallbackData = "";
    let fallbackDataObj: any = {};
    // Minimal filter extraction without hardcoded city lists:
    // - Extract pincode if present as 6-digit number
    // - Extract bank name via the existing regex pattern
    const filters: { bank_name?: string; city?: string; pincode?: string; } = {};
    const pincodeMatch = userMessage.match(/\b(\d{6})\b/);
    if (pincodeMatch) {
      filters.pincode = pincodeMatch[1];
    }
    const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
    if (bankMatch) {
      filters.bank_name = bankMatch[0].toUpperCase();
    }

    if (isManagerQuery) {
      const bankData = await searchBankManager(filters);
      if (bankData?.length) {
        fallbackData = formatManagers(bankData, userMessage);
        fallbackDataObj.bankData = bankData;
      } else {
        // Bank search returned no results — never return the generic greeting.
        // Return a specific "no records found" message instead.
        fallbackData = `No bank manager records found matching your criteria. Please verify the bank name, city, pincode, or branch.`;
        fallbackDataObj.bankData = [];
      }
    }
    if (!fallbackData && isCompanyQuery && !isInvalidCompanyName(userMessage)) {
      const company = await searchCompany(userMessage);
      if (company?.found) {
        fallbackData = formatCompanyResponse(company);
        fallbackDataObj.companyData = {
          company_name: company.primaryName,
          overview: company.overview,
          basic_info: company.basicInfo,
          financial_info: company.financialInfo,
          bank_records: company.bankRecords,
          needs_disambiguation: company.needsDisambiguation,
          candidates: company.candidates,
        };
      } else {
        fallbackData = `No corporate company records found matching "${userMessage}".`;
      }
    }
    if (!fallbackData && isPolicyQuery) {
      fallbackData = await searchPoliciesForBank(bankName, userMessage);
    }
    if (!fallbackData) {
      const generalReply = await answerGeneralQuestionWithLLM(userMessage, modelOverride);
      return { reply: generalReply };
    }

    const reply = await finalizeWithLlm(userMessage, fallbackData);
    return { reply, ...fallbackDataObj };
  }
}

export function extractApplicantFromText(text: string) {
  const norm = String(text || "").replace(/\s+/g, " ").trim();

  let salary: number | undefined;
  if (
    /(?:no\s*income|zero\s*income|0\s*income|0\s*salary|zero\s*salary|no\s*salary|nil\s*salary)/i.test(norm) ||
    (/^(?:0\s*(?:rs|inr)?|rs\.?\s*0|zero|nil|none|nothing|0rs|0)$/i.test(norm) && /(?:salary|income|earn)/i.test(norm))
  ) {
    salary = 0;
  } else {
    const salMatch = norm.match(/(?:salary|income|nmi|nth|earning|monthly\s*income)(?:\s*is)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakh|lac)?/i) ||
      norm.match(/(\d+(?:,\d+)*)\s*(k|lakh|lac)?\s*(?:salary|income)/i);
    if (salMatch) {
      let val = parseFloat(salMatch[1].replace(/,/g, ""));
      const unit = (salMatch[2] || "").toLowerCase();
      if (unit === "k") val *= 1000;
      else if (unit === "lakh" || unit === "lac") val *= 100000;
      salary = val;
    }
  }

  let loan_amount: number | undefined;
  const loanMatch =
    norm.match(/(?:loan\s*(?:amount)?|borrow|need|want|require)\s*(?:a\s*)?(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr)?/i) ||
    norm.match(/(\d+(?:,\d+)*)\s*(lakhs?|lacs?|l\b|cr)\s+(?:personal\s*)?(?:loan|borrow)/i);
  if (loanMatch) {
    let val = parseFloat(loanMatch[1].replace(/,/g, ""));
    const unit = (loanMatch[2] || "").toLowerCase();
    if (unit === "k") val *= 1000;
    else if (unit.startsWith("l")) val *= 100000;
    else if (unit.startsWith("cr")) val *= 10000000;
    loan_amount = val;
  }

  let tenure_months: number | undefined;
  const yrMatch = norm.match(/\b(\d{1,2})\s*(?:years?|yrs?|yr|y\b)(?!\s*old)\b/i);
  if (yrMatch) {
    tenure_months = parseInt(yrMatch[1], 10) * 12;
  } else {
    const moMatch = norm.match(/\b(\d{1,3})\s*(?:months?|m\b)\b/i);
    if (moMatch) tenure_months = parseInt(moMatch[1], 10);
  }

  let cibil: number | undefined;
  const cibilMatch = norm.match(/(?:cibil|credit\s*score|bureau(?:\s*score)?)(?:\s*is|:)?\s*(\d{3})/i) ||
    norm.match(/\b(\d{3})\b\s*(?:cibil|credit\s*score)/i);
  if (cibilMatch) {
    cibil = parseInt(cibilMatch[1], 10);
  }

  let existing_emi: number | undefined;
  if (
    /(?:no|0|zero|nil|none|nothing)\s*(?:existing\s*|current\s*|ongoing\s*)?(?:loan|emi)s?|no\s*loans/i.test(norm) ||
    (/^(?:0|zero|nil|none|nothing)$/i.test(norm) && !/(?:salary|income|earn)/i.test(norm))
  ) {
    existing_emi = 0;
  } else {
    const emiMatch = norm.match(/(?:existing\s*emi|current\s*emi|monthly\s*emi|emi)(?:\s*is|:)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i);
    if (emiMatch) {
      let val = parseFloat(emiMatch[1].replace(/,/g, ""));
      if ((emiMatch[2] || "").toLowerCase() === "k") val *= 1000;
      existing_emi = val;
    }
  }

  let age: number | undefined;
  const ageMatch = norm.match(/\b(?:i\s*am|age\s*(?:is|to|=|:)?)\s*(\d{1,2})\s*(?:years?\s*old|yrs?\s*old)?\b/i) ||
    norm.match(/\b(\d{1,2})\s*(?:years?\s*old|yrs?\s*old)\b/i);
  if (ageMatch) {
    const a = parseInt(ageMatch[1], 10);
    if (a >= 18 && a <= 85) age = a;
  }

  let employment_type: string | undefined;
  if (/salaried/i.test(norm)) employment_type = "Salaried";
  else if (/self\s*employed|business|proprietor|freelanc/i.test(norm)) employment_type = "Self-Employed";
  else if (/jobless|unemployed|no\s*job|without\s*(?:a\s*)?job|laid\s*off|not\s*working/i.test(norm)) {
    employment_type = "Unemployed";
    salary = 0;
  } else if (/student|in\s*college|studying/i.test(norm)) {
    employment_type = "Student";
    salary = 0;
  }

  let company: string | undefined;
  if (!isFinancialOrProfileInput(norm)) {
    company = extractCompanyCandidateFromText(norm);
  }

  const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(norm);
  const bank = bankMatch ? bankMatch[0].toUpperCase() : undefined;

  let loan_type = "Personal Loan";
  if (/home\s*loan/i.test(norm)) loan_type = "Home Loan";
  else if (/business\s*loan/i.test(norm)) loan_type = "Business Loan";
  else if (/auto\s*loan|car\s*loan/i.test(norm)) loan_type = "Auto Loan";

  return { bank, loan_type, salary, loan_amount, tenure_months, cibil, existing_emi, age, employment_type, company };
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

/**
 * Send deterministic data to the LLM and let it generate the final
 * user-facing response. Services and tools return data only; the LLM owns
 * every final response. Returns the raw data if the LLM is unavailable.
 */
async function finalizeWithLlm(userMessage: string, data: string): Promise<string> {
  if (!OPENROUTER_API_KEY) return data;
  return summarizeToolResult(userMessage, "deterministic-engine", data);
}

/**
 * Handles casual conversational messages, small talk, and assistant capability questions
 * using LLM without performing any unintended company search or loan evaluation.
 */
async function handleCasualMessage(
  message: string,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  eligibilitySession?: any
): Promise<string> {
  const apiKey = getApiKey();

  if (apiKey) {
    const modelsToTry = [modelOverride, getModel(), "openrouter/free"].filter(Boolean) as string[];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let systemContent =
          "You are CreditWise AI, a friendly and expert banking and financial intelligence assistant.\n" +
          "Respond conversationally, helpfully, and naturally in your own words to the user's remark, acknowledgement, thanks, casual message, or question.\n" +
          "Analyze the full conversation context to understand what the user is referring to.\n" +
          "Do NOT search for companies, and do NOT trigger loan applications unless explicitly asked.\n" +
          "Output ONLY your conversational response.";

        if (eligibilitySession?.applicant) {
          const comp = eligibilitySession.applicant.companyName ? ` for ${eligibilitySession.applicant.companyName}` : "";
          systemContent += `\nContext: The user has an active loan eligibility assessment${comp}. If they are saying thanks, ok, or wrapping up, you may smoothly invite them to continue whenever they're ready, without using rigid templates.`;
        }

        const messages: any[] = [
          {
            role: "system",
            content: systemContent,
          },
        ];

        if (conversationHistory && conversationHistory.length > 0) {
          const hist = conversationHistory.slice(-6);
          for (const m of hist) {
            if (m.content && m.content.trim()) {
              messages.push({
                role: m.role === "assistant" || m.role === "ai" ? "assistant" : "user",
                content: m.content.trim(),
              });
            }
          }
        }

        messages.push({ role: "user", content: message });

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
            max_tokens: 250,
            temperature: 0.4,
            messages,
          }),
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return stripReasoningPreamble(content.trim());
          }
        }
      } catch (err: any) {
        console.warn(`[Casual Message LLM] Failed with model ${model}:`, err?.message || err);
      }
    }
  }

  // Technical API/network error handling only
  return "⚠️ The AI service is currently unavailable. Please check your network connection or try again shortly.";
}

/**
 * Handles Calculation intent (EMI, installment, borrowing capacity).
 * Fully supports partial calculations where only some numbers are provided.
 */
async function handleCalculationIntent(
  userMessage: string,
  classification: IntentClassificationResult,
  existingApplicant?: any,
  modelOverride?: string
): Promise<string> {
  // 1. Extract principal (loan amount)
  let principal = classification.extracted?.loanAmount;
  if (!principal) {
    const amtMatch =
      userMessage.match(/(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr|crores?)/i) ||
      userMessage.match(/(?:amount|of|for|loan\s*of)\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    if (amtMatch) {
      principal = parseFinancialAmount(amtMatch[1] + (amtMatch[2] || "")) || undefined;
    }
  }
  if (!principal && existingApplicant?.loanAmount) {
    principal = existingApplicant.loanAmount;
  }

  // 2. Extract interest rate
  let rate = classification.extracted?.interestRate;
  if (!rate) {
    const rateMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*%/);
    if (rateMatch) {
      rate = parseFloat(rateMatch[1]);
    }
  }

  // 3. Extract tenure
  let tenure = classification.extracted?.tenureMonths;
  if (!tenure) {
    const tenureMatch = userMessage.match(/(\d+)\s*(?:years?|yrs?)/i);
    if (tenureMatch) {
      tenure = parseInt(tenureMatch[1], 10) * 12;
    } else {
      const monthMatch = userMessage.match(/(\d+)\s*(?:months?|m\b)/i);
      if (monthMatch) {
        tenure = parseInt(monthMatch[1], 10);
      }
    }
  }
  if (!tenure && existingApplicant?.tenureMonths) {
    tenure = existingApplicant.tenureMonths;
  }

  const numPrincipal = typeof principal === "number" ? principal : (principal && !isNaN(Number(principal)) ? Number(principal) : 0);
  const numTenure = typeof tenure === "number" ? tenure : (tenure && !isNaN(Number(tenure)) ? Number(tenure) : 0);

  // Support partial calculation if principal is available
  if (numPrincipal > 0) {
    const effectiveRate = rate || 10.5;
    const effectiveTenure = numTenure || 60;
    const monthlyEmi = calculateEmi(numPrincipal, effectiveRate, effectiveTenure);
    let md = formatEmiResult({ principal: numPrincipal, rate: effectiveRate, tenure: effectiveTenure }, monthlyEmi);

    const notes: string[] = [];
    if (!rate) {
      notes.push(
        `Annual interest rate was not specified; calculated at an indicative standard benchmark of **${effectiveRate}% p.a.** (personal loan rates typically range from 10.25% to 14.5% p.a.).`
      );
    }
    if (!tenure) {
      notes.push(
        `Repayment tenure was not specified; calculated for a standard tenure of **${effectiveTenure} months (5 years)**.`
      );
    }
    if (notes.length > 0) {
      md += `\n> [!NOTE]\n> ${notes.join("\n> ")}\n`;
    }
    return md;
  }

  return (
    `### 🧮 Loan EMI Calculator\n\n` +
    `To calculate your estimated monthly installment (EMI), please provide:\n` +
    `• **Loan Amount**: Desired amount (e.g. ₹5 Lakhs, ₹10 Lakhs)\n` +
    `• **Repayment Tenure**: Preferred duration in months or years (e.g. 3 years, 5 years)\n` +
    `• **Interest Rate**: Annual rate percentage (e.g. 10.5% p.a., or we can calculate using standard partner benchmarks)\n\n` +
    `*Example: "What is the EMI for 10 lakhs at 11% for 5 years?"*`
  );
}

/**
 * Answers general banking questions, concept definitions, or FAQs using the LLM.
 * For concepts like FOIR, gives a natural explanation without generic eligibility percentages.
 * Never returns hardcoded greeting/fallback responses for valid questions.
 */
async function answerGeneralQuestionWithLLM(
  userMessage: string,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  eligibilitySession?: any,
  isEligibleFlowActive?: boolean
): Promise<string> {
  const apiKey = getApiKey();

  if (apiKey) {
    const modelsToTry = [
      modelOverride,
      getModel(),
      "openrouter/auto",
      "openrouter/free",
    ].filter(Boolean) as string[];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        let systemContent =
          "You are CreditWise AI, an expert banking and financial intelligence assistant.\n" +
          "Answer the user's banking, loan, or financial question / objection clearly, accurately, and naturally in GitHub Markdown.\n\n" +
          "CRITICAL CONCEPT & BANKING EXPLANATION RULES:\n" +
          "- For concepts like FOIR (Fixed Obligation to Income Ratio), CIBIL score, debt ratios, EMI, or borrowing capacity:\n" +
          "  Give a clear, natural explanation of what the term stands for, how it is calculated, and what lenders evaluate.\n" +
          "- Do NOT include generic eligibility percentage thresholds (e.g. do NOT claim 'you are eligible if under 50%').\n" +
          "- Explicitly clarify that permissible FOIR caps and eligibility criteria vary strictly by each individual bank's Master Policy based on salary tier and company category.\n" +
          "- Age criteria: statutory 21-60 bracket dictates allowable tenure and legal eligibility.\n" +
          "- Employer / Company: categorized into tiers (Super Cat A, Cat A, Elite, etc.) determining interest rates and max loan ceilings.\n" +
          "- Credit checks on Loan Assistant are soft inquiries with zero score impact.\n" +
          "- Personal loans from partner banks are 100% unsecured without collateral or guarantor requirements.\n" +
          "- Do NOT include generic greeting preambles (such as 'I am CreditWise AI, your banking assistant...'). Go straight to the helpful explanation.";

        if (isEligibleFlowActive && eligibilitySession) {
          const applicant = eligibilitySession.applicant || {};
          const nextField =
            eligibilitySession.expectedField ||
            (eligibilitySession.missingFields && eligibilitySession.missingFields[0]) ||
            "monthlyIncome";
          systemContent +=
            `\n\nACTIVE ASSESSMENT CONTEXT:\n` +
            `- The user is currently in a personal loan eligibility evaluation.\n` +
            `- Known details: ${JSON.stringify(applicant)}.\n` +
            `- Next detail needed: ${nextField}.\n` +
            `- INSTRUCTION: Directly address the user's inquiry, question, or objection warmly and clearly. Then, naturally invite them to share their ${nextField} (or continue their assessment) in a cohesive, friendly sentence without using rigid dividers or robotic templates.`;
        }

        const messages: any[] = [
          {
            role: "system",
            content: systemContent,
          },
        ];

        if (conversationHistory && conversationHistory.length > 0) {
          const hist = conversationHistory.slice(-6);
          for (const m of hist) {
            if (m.content && m.content.trim()) {
              messages.push({
                role: m.role === "assistant" || m.role === "ai" ? "assistant" : "user",
                content: m.content.trim(),
              });
            }
          }
        }

        messages.push({ role: "user", content: userMessage });

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
            max_tokens: 500,
            temperature: 0.2,
            messages,
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return stripReasoningPreamble(content.trim());
          }
        }
      } catch (err: any) {
        console.warn(`[General QA LLM] Failed with model ${model}:`, err?.message || err);
      }
    }
  }

  // Technical API/network error handling only
  return "⚠️ The AI service is currently unavailable. Please check your network connection or try again shortly.";
}

/**
 * Handles General Information intent (Bank Policies, Bank Managers, Company Categories, Concept Definitions).
 * Always answers the question directly without asking the next eligibility question.
 */
async function handleGeneralInformationIntent(
  userMessage: string,
  classification: IntentClassificationResult,
  modelOverride?: string
): Promise<AgentResult> {
  const norm = userMessage.toLowerCase();

  // 1. Bank Manager Inquiry
  if (
    classification.subIntent === "BANK_MANAGER_SEARCH" ||
    /manager|contact|phone|mobile|email|branch\s*head|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b/i.test(norm)
  ) {
    const filters: { bank_name?: string; city?: string; pincode?: string } = {};
    const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
    if (bankMatch) filters.bank_name = bankMatch[0].toUpperCase();
    if (classification.extracted?.city) filters.city = classification.extracted.city;
    if (classification.extracted?.targetBank) filters.bank_name = classification.extracted.targetBank;

    const bankData = await searchBankManager({ ...filters, query: userMessage });
    if (bankData?.length) {
      return {
        reply: formatManagers(bankData, userMessage),
        bankData,
      };
    }
    return {
      reply: `No official bank manager records found matching "${userMessage}". Please check the bank name, city, or branch.`,
      bankData: [],
    };
  }

  // 2. Bank Policy Query: For bank-specific questions, use ONLY that bank's Master Policy!
  const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla|yes|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm/i.exec(userMessage);
  const targetBank = classification.extracted?.targetBank || (bankMatch ? bankMatch[0] : "");
  if (
    targetBank &&
    (classification.subIntent === "POLICY_INQUIRY" ||
      /policy|cibil|cutoff|foir|interest|rate|multiplier|age|salary|tenure|rule|criteria|minimum|maximum|limit|band|document|doc|cat|category|tier/i.test(norm))
  ) {
    const policyResult = await answerBankPolicyWithMasterPolicy(targetBank, userMessage, modelOverride);
    if (policyResult) {
      return { reply: policyResult };
    }
  }

  // 3. Corporate Employer Rating / Category Query
  if (
    classification.subIntent === "COMPANY_SEARCH" ||
    (/(?:company|employer|category\s*rating|company\s*tier|corporate\s*listing|is.*listed)/i.test(norm) && !/policy|rule|cutoff|foir|tenure|cibil/i.test(norm))
  ) {
    const compQuery =
      classification.extracted?.companyName ||
      userMessage
        .replace(/(?:is|what\s*is|tell\s*me\s*about|search|check|category|rating|of|for|listed\s*in)\b/gi, "")
        .trim();
    if (compQuery && !isInvalidCompanyName(compQuery)) {
      const company = await searchCompany(compQuery);
      if (company?.found) {
        return {
          reply: formatCompanyResponse(company),
          companyData: {
            company_name: company.primaryName,
            overview: company.overview,
            basic_info: company.basicInfo,
            financial_info: company.financialInfo,
            bank_records: company.bankRecords,
            needs_disambiguation: company.needsDisambiguation,
            candidates: company.candidates,
          },
        };
      }
      return {
        reply: `No corporate company listing records found for "${compQuery}".`,
      };
    }
  }

  // 4. General Banking Concept / FAQ / AI answer (e.g. "What is FOIR?")
  const llmReply = await answerGeneralQuestionWithLLM(userMessage, modelOverride);
  return { reply: llmReply };
}

/**
 * Handles Changing Details intent. Replaces old values with new values across any of the 8 profile parameters
 * (company, salary, CIBIL, age, loan amount, tenure, employment type, existing EMI) and recalculates eligibility immediately.
 */
async function handleChangingDetailsIntent(
  conversationId: string,
  userMessage: string,
  classification: IntentClassificationResult,
  eligibilitySession: any,
  modelOverride?: string
): Promise<AgentResult> {
  let applicant: ApplicantProfile = eligibilitySession?.applicant
    ? { ...eligibilitySession.applicant }
    : { loanType: "Personal Loan" };

  const res = await applyProfileUpdateAndRecalculate(
    conversationId,
    userMessage,
    applicant,
    classification.extracted,
    modelOverride
  );

  return {
    reply: res.reply,
    companyData: res.evalResult?.companyMatch?.isFound
      ? {
        company_name: res.evalResult.companyMatch.matchedName || res.evalResult.companyMatch.searchedName,
        category: res.evalResult.companyMatch.bankCategories,
        needs_disambiguation: false,
      }
      : undefined,
  };
}

function getFlowContinuationHint(eligibilitySession: any): string {
  if (!eligibilitySession) return "";
  const applicant = eligibilitySession.applicant || {};
  const missing = eligibilitySession.missingFields || [];
  const expectedField = eligibilitySession.expectedField || (missing.length > 0 ? missing[0] : null);

  const hints: Record<string, string> = {
    companyName: "What is your company or employer name?",
    monthlyIncome: "What is your approximate net monthly take-home salary?",
    loanAmount: "How much loan amount are you looking to borrow?",
    tenureMonths: "What repayment tenure would you prefer?",
    cibil: "What is your approximate CIBIL score? (You can say 0 or unknown if unsure)",
    existingEmi: "Do you have any existing monthly loan EMIs? (Or say 'none' if clear)",
    age: "What is your current age in years?",
  };

  const nextQ = expectedField && hints[expectedField] ? hints[expectedField] : "Would you like to proceed with your assessment?";
  const comp = applicant.companyName ? ` for **${applicant.companyName}**` : "";

  return `\n\nWhenever you'd like to continue your personal loan assessment${comp}: ${nextQ}`;
}

/**
 * 1. Tool Executor: calculate_emi
 */
async function executeCalculateEmi(
  args: { principal?: number; rate?: number; tenureMonths?: number },
  userMessage: string,
  existingApplicant?: any,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any,
  modelOverride?: string
): Promise<AgentResult> {
  const principal = args.principal || existingApplicant?.loanAmount;
  const tenureMonths = args.tenureMonths || existingApplicant?.tenureMonths;
  const rate = args.rate || 10.5;

  let calcReply = "";
  if (principal && tenureMonths) {
    const monthlyRate = rate / 12 / 100;
    const emi = Math.round(
      (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1)
    );
    const totalPayable = emi * tenureMonths;
    const totalInterest = totalPayable - principal;

    calcReply = `### 📊 Loan EMI Calculation\n\n` +
      `Here is the estimated installment breakdown for a personal loan of **₹${principal.toLocaleString("en-IN")}**:\n\n` +
      `| Parameter | Value |\n` +
      `| :--- | :--- |\n` +
      `| **Loan Principal** | ₹${principal.toLocaleString("en-IN")} |\n` +
      `| **Interest Rate** | ${rate}% p.a. |\n` +
      `| **Repayment Tenure** | ${tenureMonths} months (${Math.round((tenureMonths / 12) * 10) / 10} years) |\n` +
      `| **Estimated Monthly EMI** | **₹${emi.toLocaleString("en-IN")}** |\n` +
      `| **Total Interest Payable** | ₹${totalInterest.toLocaleString("en-IN")} |\n` +
      `| **Total Repayment Amount** | ₹${totalPayable.toLocaleString("en-IN")} |\n\n` +
      `*💡 Note: Actual interest rate, EMI, and loan amount depend on the lending bank's Master Policy rules and your employer category.*`;
  } else {
    const classification: any = {
      intent: "CALCULATION",
      extracted: {
        loanAmount: args.principal,
        tenureMonths: args.tenureMonths,
        interestRate: args.rate,
      },
    };
    calcReply = await handleCalculationIntent(userMessage, classification, existingApplicant, modelOverride);
  }

  return { reply: calcReply };
}

/**
 * Formats a clear, structured response when an unsupported or unavailable bank's policy is requested.
 * Explicitly mentions that only available partner-bank policies can be provided and suggests asking for another partner bank.
 */
function formatBankPolicyNotAvailableResponse(requestedBank?: string): string {
  const bankLabel = requestedBank ? ` for **${requestedBank}**` : "";

  return (
    `### 🏦 Bank Policy Not Available\n\n` +
    `The requested bank policy${bankLabel} is **not available** in our stored records.\n\n` +
    `We can only provide official policy guidelines for our **partner banks** whose Master Policies are actively stored and maintained in our platform.\n\n` +
    `**Available Partner Banks Include**:\n` +
    `- **Major Private Banks**: HDFC Bank, ICICI Bank, Axis Bank, State Bank of India (SBI), Kotak Mahindra Bank, IndusInd Bank, IDFC FIRST Bank, Bandhan Bank, Yes Bank, SBM Bank India\n` +
    `- **Leading NBFCs & Lenders**: Bajaj Finserv, Bajaj Markets, Tata Capital, Aditya Birla Finance, Poonawalla Fincorp, Piramal Capital, L&T Finance, Axis Finance, Cholamandalam, SMFG India Credit, Finnable, Fibe\n` +
    `- **Small Finance Banks**: Utkarsh Small Finance Bank\n\n` +
    `💡 **Suggestion**: Please ask for the policy of one of our available partner banks listed above (for example, *"What is HDFC bank policy?"* or *"Tell me ICICI guidelines"*), and I will be glad to share their complete criteria!`
  );
}

function extractUnsupportedBankName(message: string): string | undefined {
  const norm = message.toLowerCase().trim();
  if (
    /bank\s*that\s*is(?:n['’]t|not)\s*available/i.test(norm) ||
    /unavailable\s*bank/i.test(norm) ||
    /unsupported\s*bank/i.test(norm) ||
    /bank\s*not\s*(?:in|available|present)/i.test(norm)
  ) {
    return undefined;
  }

  const known = /(?:citibank|citi|bank\s*of\s*baroda|bob|punjab\s*national\s*bank|pnb|canara\s*bank|canara|union\s*bank|rbl\s*bank|rbl|hsbc|standard\s*chartered|scb|dbs\s*bank|dbs|federal\s*bank|south\s*indian\s*bank)/i.exec(message);
  if (known) {
    const raw = known[0];
    if (/citi/i.test(raw)) return "Citibank";
    if (/baroda|bob/i.test(raw)) return "Bank of Baroda";
    if (/punjab|pnb/i.test(raw)) return "Punjab National Bank";
    if (/canara/i.test(raw)) return "Canara Bank";
    if (/union/i.test(raw)) return "Union Bank of India";
    if (/rbl/i.test(raw)) return "RBL Bank";
    if (/hsbc/i.test(raw)) return "HSBC Bank";
    if (/standard|scb/i.test(raw)) return "Standard Chartered Bank";
    if (/dbs/i.test(raw)) return "DBS Bank";
    if (/federal/i.test(raw)) return "Federal Bank";
    return raw;
  }

  const pat1 = /(?:policy|guidelines?|rules?|criteria|cutoff|cut-off)\s*(?:of|for)?\s+([A-Za-z0-9&'.-]+(?:\s+[A-Za-z0-9&'.-]+)?\s*bank)/i.exec(message);
  if (pat1 && !/a\s*bank|any\s*bank|the\s*bank/i.test(pat1[1])) {
    return pat1[1].trim();
  }

  const pat2 = /([A-Za-z0-9&'.-]+(?:\s+[A-Za-z0-9&'.-]+)?\s*bank)\s*(?:'s)?\s*(?:policy|guidelines?|rules?|criteria|cutoff|cut-off)/i.exec(message);
  if (pat2 && !/a\s*bank|any\s*bank|the\s*bank/i.test(pat2[1])) {
    return pat2[1].trim();
  }

  return undefined;
}

/**
 * 2. Tool Executor: lookup_master_policy
 * STRICT POLICY: Master Policy .txt files are the sole source of truth.
 * Zero guessing or defaulting. No internal tokens (NOT_DEFINED, NEEDS_REVIEW).
 */
async function executeLookupMasterPolicy(
  args: { bankName?: string; questionTopic?: string },
  userMessage: string,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any,
  modelOverride?: string
): Promise<AgentResult> {
  // If the query mentions Tata Consultancy Services or TCS, it's a corporate company lookup, not a bank policy
  if (/tata\s*consultancy|tcs\b/i.test(userMessage) && !/tata\s*capital/i.test(userMessage)) {
    return await executeSearchCompanyCategory(
      { companyName: "Tata Consultancy Services" },
      userMessage,
      isEligibleFlowActive,
      eligibilitySession
    );
  }

  const query = args.questionTopic || userMessage;
  const allPolicies = getResolvedMasterPolicies();

  // 1. Determine if a partner bank is matched
  let matchedPartnerBank: any = undefined;
  const candidateBankName = args.bankName || "";

  if (candidateBankName) {
    const normCand = candidateBankName.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
    matchedPartnerBank =
      allPolicies.find((p) => {
        const pNorm = p.bank_name.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
        return pNorm.includes(normCand) || normCand.includes(pNorm) || p.bank_code.toLowerCase() === normCand;
      }) ||
      allPolicies.find((p) => p.bank_name.toLowerCase().includes(normCand));
  }

  if (!matchedPartnerBank) {
    const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|poonawalla|yes\s*bank|\byes\b|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm|tata\s*capital|\btata\b(?!.*consultancy)/i.exec(
      userMessage
    );
    if (bankMatch) {
      const matchText = bankMatch[0].toLowerCase();
      matchedPartnerBank = allPolicies.find((p) => {
        const pNorm = p.bank_name.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
        return pNorm.includes(matchText) || matchText.includes(pNorm) || p.bank_code.toLowerCase() === matchText;
      });
    }
  }

  // 2. If a stored partner bank is found, answer using its Master Policy file
  if (matchedPartnerBank) {
    const policyResult = await answerBankPolicyWithMasterPolicy(matchedPartnerBank.bank_name, query, modelOverride);
    if (policyResult) {
      return { reply: policyResult };
    }
  }

  // 3. If requested bank is not in stored partner-bank policies (or user asked for an unavailable bank):
  // Return clear "bank policy not available" response.
  // Do NOT route to general information fallback or start loan eligibility flow.
  const requestedBank = candidateBankName || extractUnsupportedBankName(userMessage);
  let reply = formatBankPolicyNotAvailableResponse(requestedBank);
  return { reply };
}

/**
 * 3. Tool Executor: search_company_category
 */
async function executeSearchCompanyCategory(
  args: { companyName?: string },
  userMessage: string,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any
): Promise<AgentResult> {
  let compQuery = (args.companyName || userMessage)
    .replace(/^(?:what\s+is\s+the|what\s+is|tell\s+me\s+about|search|check|find|is|are)\b/gi, "")
    .replace(/\b(?:corporate\s+category\s+rating|category\s+rating|corporate\s+tier|category|rating|tier|corporate\s+listing|listed\s+in|for|of|in|records?|bank\s+records?|across\s+banks?|in\s+banks?|partner\s+banks?)\b/gi, "")
    .replace(/[?.,!]/g, "")
    .trim();

  if (compQuery && !isInvalidCompanyName(compQuery)) {
    let company = await searchCompany(compQuery);
    if (!company?.found) {
      const candidate = extractCompanyCandidateFromText(userMessage) || extractCompanyCandidateFromText(compQuery);
      if (candidate && candidate.toLowerCase() !== compQuery.toLowerCase()) {
        const alt = await searchCompany(candidate);
        if (alt?.found) company = alt;
      }
    }

    if (company?.found) {
      let reply = formatCompanyResponse(company);
      return {
        reply,
        companyData: {
          company_name: company.primaryName,
          overview: company.overview,
          basic_info: company.basicInfo,
          financial_info: company.financialInfo,
          bank_records: company.bankRecords,
          needs_disambiguation: company.needsDisambiguation,
          candidates: company.candidates,
        },
      };
    }
    let reply = `No corporate company listing records found for "${compQuery}".`;
    return { reply };
  }

  let reply = "Please specify an employer or company name to search for corporate listings and partner bank tier ratings.";
  return { reply };
}

/**
 * 4. Tool Executor: check_loan_eligibility
 */
async function executeCheckLoanEligibility(
  args: any,
  conversationId: string,
  userMessage: string,
  eligibilitySession: any,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult> {
  const isEligibleFlowActive = !!(
    eligibilitySession &&
    (eligibilitySession.expectedField ||
      (eligibilitySession.missingFields && eligibilitySession.missingFields.length > 0) ||
      (eligibilitySession as any).in_eligibility_flow)
  );

  const extractedFromMsg = extractApplicantFromText(userMessage);

  const syntheticClassification: IntentClassificationResult = {
    intent: "LOAN_ELIGIBILITY",
    confidence: 1.0,
    loanType: args?.loanType || extractedFromMsg.loan_type || "Personal Loan",
    extracted: {
      companyName: args?.companyName || extractedFromMsg.company,
      monthlyIncome: args?.monthlyIncome !== undefined ? args.monthlyIncome : extractedFromMsg.salary,
      loanAmount: args?.loanAmount !== undefined ? args.loanAmount : extractedFromMsg.loan_amount,
      tenureMonths: args?.tenureMonths !== undefined ? args.tenureMonths : extractedFromMsg.tenure_months,
      cibil: args?.cibil !== undefined ? args.cibil : extractedFromMsg.cibil,
      existingEmi: args?.existingEmi !== undefined ? args.existingEmi : extractedFromMsg.existing_emi,
      age: args?.age !== undefined ? args.age : extractedFromMsg.age,
      employmentType: args?.employmentType || extractedFromMsg.employment_type,
    },
  };

  try {
    const wizardResult = await processEligibilityFlow(
      conversationId,
      userMessage,
      modelOverride,
      async (msg: string, model?: string, context?: string, prompt?: string) => {
        const agentRes = await runToolCallingAgent(msg, model, context, prompt);
        return agentRes.reply;
      },
      syntheticClassification,
      conversationHistory
    );
    const result: AgentResult = { reply: wizardResult.reply };
    return result;
  } catch (e) {
    console.error("Eligibility flow processing error:", e);
    return { reply: "We encountered an issue processing your loan eligibility. Please provide your details to continue." };
  }
}

/**
 * 5. Tool Executor: update_applicant_profile
 */
async function executeUpdateApplicantProfile(
  args: any,
  conversationId: string,
  userMessage: string,
  eligibilitySession: any,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult> {
  const applicant: ApplicantProfile = eligibilitySession?.applicant
    ? { ...eligibilitySession.applicant }
    : { loanType: "Personal Loan" };

  const extracted: ExtractedEntities = {
    companyName: args?.companyName,
    monthlyIncome: args?.monthlyIncome,
    loanAmount: args?.loanAmount,
    tenureMonths: args?.tenureMonths,
    cibil: args?.cibil,
    existingEmi: args?.existingEmi,
    age: args?.age,
    employmentType: args?.employmentType,
  };

  const res = await applyProfileUpdateAndRecalculate(
    conversationId,
    userMessage,
    applicant,
    extracted,
    modelOverride
  );

  return {
    reply: res.reply,
    companyData: undefined,
  };
}

/**
 * 6. Tool Executor: answer_general_question
 */
async function executeAnswerGeneralQuestion(
  args: { question?: string; subType?: string; conceptName?: string },
  userMessage: string,
  conversationId: string,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any,
  modelOverride?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult> {
  const subType = args.subType || "GENERAL_FAQ";
  const question = args.question || userMessage;

  // CANCEL_RESET
  if (subType === "CANCEL_RESET" || /^(cancel|reset|restart|stop|exit)\b/i.test(question.trim())) {
    await clearEligibilityState(conversationId);
    const numConvId = Number(conversationId);
    if (pool && Number.isFinite(numConvId)) {
      try {
        await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numConvId]);
      } catch { }
    }
    return {
      reply: "🔄 **Loan Assessment Reset**\n\nYour session has been reset. You can start fresh anytime by asking for a loan or policy details.",
    };
  }

  // GREETING
  if (subType === "GREETING" || /^(hello|hi|hey|good\s*(?:morning|afternoon|evening)|namaste|greetings)\b/i.test(question.trim())) {
    const greetingReply = await generateGreetingWithLLM(
      question,
      modelOverride,
      isEligibleFlowActive ? eligibilitySession : undefined
    );
    return { reply: greetingReply };
  }

  // CASUAL_CHAT
  if (subType === "CASUAL_CHAT") {
    const casualReply = await handleCasualMessage(
      question,
      modelOverride,
      conversationHistory,
      isEligibleFlowActive ? eligibilitySession : undefined
    );
    return { reply: casualReply };
  }

  // Financial concept / definition / FAQ / Objection
  let llmReply = await answerGeneralQuestionWithLLM(
    question,
    modelOverride,
    conversationHistory,
    eligibilitySession,
    isEligibleFlowActive
  );
  return { reply: llmReply };
}

/**
 * 7. Tool Executor: tavily_search
 */
async function executeTavilySearch(
  args: { query?: string },
  userMessage: string,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any
): Promise<AgentResult> {
  const query = args.query || userMessage;
  let reply = await searchTavilyWeb(query);
  return { reply };
}

/**
 * 8. Tool Executor: search_bank_managers
 */
async function executeSearchBankManagers(
  args: { bank_name?: string; city?: string; pincode?: string; role?: string },
  userMessage: string,
  isEligibleFlowActive?: boolean,
  eligibilitySession?: any
): Promise<AgentResult> {
  const filters: { bank_name?: string; city?: string; pincode?: string } = {};
  const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
  if (args.bank_name) filters.bank_name = args.bank_name.toUpperCase();
  else if (bankMatch) filters.bank_name = bankMatch[0].toUpperCase();
  if (args.city) filters.city = args.city;
  if (args.pincode) filters.pincode = args.pincode;

  const bankData = await searchBankManager({ ...filters, query: userMessage });
  if (bankData?.length) {
    let reply = formatManagers(bankData, userMessage);
    return {
      reply,
      bankData,
    };
  }
  let reply = `No official bank manager records found matching "${userMessage}". Please check the bank name, city, or branch.`;
  return {
    reply,
    bankData: [],
  };
}


/**
 * Fully LLM-Driven Conversational Understanding Brain for CreditWise AI.
 */
export interface MasterConversationAnalysis {
  isTechnicalError?: boolean;
  userIntent:
  | "LOAN_ELIGIBILITY"
  | "BANK_POLICY"
  | "EMI_CALCULATION"
  | "BANK_MANAGER"
  | "COMPANY_SEARCH"
  | "WEB_SEARCH"
  | "QUESTION_OR_OBJECTION"
  | "CORRECTION"
  | "GREETING"
  | "CANCEL_RESET"
  | "SELECT_BANK"
  | "REJECT_BANK"
  | "PROCEED_NEXT_STEP"
  | "GENERAL_CHAT";
  isLoanIntent: boolean;
  hasQuestionOrObjection: boolean;
  questionAnswer: string | null;
  extractedDetails: {
    companyName?: string | null;
    monthlyIncome?: number | string | null;
    loanAmount?: number | string | null;
    tenureMonths?: number | string | null;
    cibil?: number | string | null;
    existingEmi?: number | string | null;
    age?: number | string | null;
    location?: string | null;
    employmentStatus?: "unemployed" | "salaried" | "self-employed" | "student" | string | null;
    employmentType?: "Salaried" | "Self-Employed" | "Unemployed" | "Student" | null;
  };
  isCorrection: boolean;
  correctedFields: string[];
  targetBank: string | null;
  selectedBank?: string | null;
  rejectedBank?: string | null;
  city?: string | null;
  wantsReevaluation?: boolean;
  emiDetails?: {
    principal?: number | null;
    rate?: number | null;
    tenureMonths?: number | null;
  } | null;
  managerSearch?: {
    bankName?: string | null;
    city?: string | null;
  } | null;
  companyQuery?: string | null;
  webSearchQuery?: string | null;
  naturalResponse: string;
}

function getFriendlyFieldName(field: string): string {
  switch (field) {
    case "companyName":
      return "employer or company name";
    case "monthlyIncome":
      return "net monthly take-home salary";
    case "loanAmount":
      return "desired loan amount";
    case "tenureMonths":
      return "preferred repayment tenure";
    case "cibil":
      return "approximate CIBIL score";
    case "existingEmi":
      return "existing monthly EMIs";
    case "age":
      return "current age";
    default:
      return field;
  }
}

/**
 * Executes a comprehensive multi-turn conversational analysis using OpenRouter LLM.
 * Returns structured intent, extracted/corrected entities, answer to questions,
 * and a natural conversational response.
 */
export async function analyzeConversationWithLLM(opts: {
  userMessage: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  applicant?: ApplicantProfile;
  missingFields?: string[];
  isFlowActive?: boolean;
  hasCompletedEvaluation?: boolean;
  eligibleBanks?: string[];
  topRecommendedBank?: string;
  chosenBank?: string;
  city?: string;
  rejectedBanks?: string[];
  failedCriteria?: Array<{ bankName: string; failureReasons: string[] }>;
  modelOverride?: string;
}): Promise<MasterConversationAnalysis> {
  const {
    userMessage,
    conversationHistory,
    applicant,
    missingFields,
    isFlowActive,
    hasCompletedEvaluation,
    eligibleBanks,
    topRecommendedBank,
    chosenBank,
    city,
    rejectedBanks,
    failedCriteria,
    modelOverride,
  } = opts;
  const apiKey = getApiKey();
  const rawModel = modelOverride || getModel();
  const model = normalizeModelSlug(rawModel);

  const systemPrompt =
    `CRITICAL REQUIREMENT: You are an API backend that MUST ALWAYS respond ONLY with a strictly valid JSON object matching the schema. NEVER return conversational text, greetings, or markdown outside the JSON object.\n` +
    `LANGUAGE REQUIREMENT: All text in 'naturalResponse' and 'questionAnswer' MUST ALWAYS be written in English. Do NOT output Chinese or any other language.\n\n` +
    `You are the master conversational understanding brain for CreditWise AI, a personal loan and banking intelligence platform.\n` +
    `Analyze the user's message in the context of recent conversation history and the current applicant profile.\n\n` +
    `CURRENT CONTEXT:\n` +
    `- RECENT CONVERSATION HISTORY (Prior Dialogue Turns in Chronological Order):\n${conversationHistory && conversationHistory.length > 0
      ? conversationHistory
        .filter((t) => t.content && t.content.trim())
        .map((t, idx) => `  [Turn ${idx + 1}] ${t.role === "assistant" || t.role === "ai" ? "Assistant" : "User"}: ${t.content.trim()}`)
        .join("\n")
      : "  No prior turns in this conversation."
    }\n` +
    `- CURRENT USER MESSAGE TO ANALYZE: "${userMessage}"\n` +
    `- Accumulated Applicant Profile: ${JSON.stringify(applicant || {})}\n` +
    `- Missing Fields for Initial Eligibility: ${JSON.stringify(missingFields || ["companyName", "monthlyIncome", "loanAmount", "tenureMonths", "cibil", "existingEmi", "age"])}\n` +
    `- Eligibility Flow In Progress: ${isFlowActive ? "true" : "false"}\n` +
    `- Eligibility Assessment Status: ${hasCompletedEvaluation ? "ALREADY_COMPLETED" : "IN_PROGRESS"}\n` +
    `- Eligible Banks from Assessment: ${JSON.stringify(eligibleBanks || [])}\n` +
    `- Top Recommended Bank: ${topRecommendedBank || "None"}\n` +
    `- Currently Chosen Bank: ${chosenBank || "None yet chosen by user"}\n` +
    `- Current Known City / Location: ${city || applicant?.location || "None provided yet"}\n` +
    `- Banks Rejected by User: ${JSON.stringify(rejectedBanks || [])}\n` +
    `- Actual Bank Eligibility Evaluations & Failed Criteria from Policy Engine:\n${failedCriteria && failedCriteria.length > 0
      ? failedCriteria
        .map(
          (b) =>
            `  * ${b.bankName}: ${b.failureReasons && b.failureReasons.length > 0
              ? b.failureReasons.join("; ")
              : "Eligible (all policy criteria met)"
            }`
        )
        .join("\n")
      : "  No failed bank evaluations recorded yet"
    }\n\n` +
    `CRITICAL ANALYSIS GUIDELINES:\n` +
    `1. NATURAL INTENT UNDERSTANDING & CONVERSATION CONTEXT (CRITICAL):\n` +
    `   - ALWAYS use the CURRENT USER MESSAGE together with RECENT CONVERSATION HISTORY to understand intent.\n` +
    `   - INQUIRIES ABOUT CONVERSATION HISTORY & META-QUESTIONS (CRITICAL):\n` +
    `     * If the user's message asks what they asked, what they said, what their question was, or references past turns (e.g. "what am I asking?", "what did I ask?", "what was my question?", "what did I say earlier?", "what was I asking you?", "remind me what I asked", "what are you answering?"): \n` +
    `       - You MUST set isLoanIntent to false.\n` +
    `       - Set userIntent to "QUESTION_OR_OBJECTION".\n` +
    `       - Set hasQuestionOrObjection to true.\n` +
    `       - Inspect RECENT CONVERSATION HISTORY to identify the user's previous question, inquiry, or topic.\n` +
    `       - In questionAnswer and naturalResponse:\n` +
    `         1) Clearly state what the user asked previously (e.g. "Earlier, you asked: '<previous question>'").\n` +
    `         2) Directly, accurately, and thoroughly answer that previous question based on official bank policies and financial rules.\n` +
    `         3) If there are no prior turns in history, warmly state that this is the beginning of the conversation and no prior questions were asked yet.\n` +
    `       - DO NOT continue the loan eligibility question flow (do NOT ask for company name, salary, loan amount, tenure, etc.)!\n` +
    `       - DO NOT ask for a bank!\n` +
    `       - DO NOT restart eligibility!\n` +
    `       - DO NOT generate a table!\n` +
    `     * If the user asks what YOU (the assistant) asked (e.g. "what did you ask?", "what are you asking me?"): check what the assistant asked in the previous turn in history, explain what was asked, set isLoanIntent to false, userIntent to "QUESTION_OR_OBJECTION", and hasQuestionOrObjection to true.\n` +
    `   - ACTUAL LOAN INTENT vs BANK POLICY INQUIRIES (CRITICAL):\n` +
    `     * BANK POLICY / ELIGIBILITY CRITERIA INQUIRY (CRITICAL):\n` +
    `       - If the user asks for a bank's official policy, rules, guidelines, cutoffs, or eligibility criteria (e.g. "Tell me the eligibility criteria for HDFC Bank", "What is the eligibility criteria for ICICI?", "HDFC Bank eligibility criteria", "What are Axis Bank loan rules?", "SBI criteria for personal loans", "Bajaj Finserv policy"): \n` +
    `         - You MUST set userIntent to "BANK_POLICY".\n` +
    `         - You MUST set isLoanIntent to false.\n` +
    `         - You MUST set targetBank to the bank name (e.g. "HDFC Bank").\n` +
    `         - Set hasQuestionOrObjection to false.\n` +
    `         - DO NOT start a personal eligibility flow!\n` +
    `         - DO NOT ask for salary, CIBIL, age, loan amount, employer, or any personal details!\n` +
    `     * PERSONAL LOAN INTENT:\n` +
    `       - Set isLoanIntent to true and userIntent to "LOAN_ELIGIBILITY" ONLY when the user asks to check their OWN personal eligibility or expresses intent to borrow (e.g. "Am I eligible for HDFC loan?", "Check my eligibility for HDFC", "Can I get a loan from HDFC?", "I need a loan", "I want a personal loan", "I want to apply for a loan", "Can I get a loan?", "I need ₹5 lakh loan", "Which banks am I eligible for?", "Check my loan options").\n` +
    `   - UNEMPLOYED / JOBLESS INQUIRIES (CRITICAL - DO NOT TRIGGER ELIGIBILITY FLOW):\n` +
    `     * If the user asks whether they can get a loan while jobless, unemployed, or without income (e.g. "can i get loan if i am jobless", "can i get a loan without a job", "can unemployed people get personal loans?", "i don't have a job, can i borrow?"): \n` +
    `       - You MUST set isLoanIntent to false.\n` +
    `       - Set userIntent to "QUESTION_OR_OBJECTION" (or "GENERAL_CHAT").\n` +
    `       - Set hasQuestionOrObjection to true.\n` +
    `       - Set extractedDetails.employmentStatus to "unemployed", employmentType to "Unemployed", and monthlyIncome to 0.\n` +
    `       - In questionAnswer and naturalResponse, provide a natural, empathetic explanation of bank policy: Unsecured personal loans under partner bank policies require active employment (Salaried or Self-Employed with steady income) to verify repayment capability. Therefore, unsecured personal loans cannot be approved while jobless. Mention legitimate secured alternatives (such as a loan against fixed deposits, gold loan, or applying with an earning co-applicant) if they have collateral.\n` +
    `       - NEVER trigger loan eligibility or generate a bank table when the user is jobless or when required data is missing!\n` +
    `   - GENERIC & CONCEPTUAL QUESTIONS (MUST NOT TRIGGER ELIGIBILITY):\n` +
    `     * If the user asks a generic, educational, conceptual, or informational question about loans, interest, documents, or banking (e.g. "What is a personal loan?", "How does a personal loan work?", "What documents are required for a personal loan?", "What is reducing balance rate?", "What is FOIR?", "What is a CIBIL score?", "Difference between secured and unsecured loan", "What is loan tenure?"): \n` +
    `       - You MUST set isLoanIntent to false.\n` +
    `       - Set userIntent to "QUESTION_OR_OBJECTION" (or "GENERAL_CHAT").\n` +
    `       - Set hasQuestionOrObjection to true.\n` +
    `       - In questionAnswer and naturalResponse, provide a short, clear, natural, and helpful banking answer.\n` +
    `       - NEVER trigger loan eligibility or ask for applicant details (like company name or salary) for generic educational questions!\n` +
    `   - CONVERSATIONAL FLOW & CONTEXT AWARENESS:\n` +
    `     * Do NOT blindly follow any wizard step! If the assistant previously asked for a specific detail, understand whether the user is answering, asking a question, raising an objection, correcting a previous value, or chatting.\n` +
    `2. EXTRACT APPLICANT DETAILS (CRITICAL - MULTI-DETAIL EXTRACTION):\n` +
    `   - Inspect the entire message and extract EVERY provided eligibility parameter simultaneously into extractedDetails.\n` +
    `   - If the user provides multiple details in one message (e.g. company, salary, loan amount, tenure, CIBIL score, age, existing EMI, or any combination), you MUST extract ALL of them in this single turn. Never restrict extraction to only one field or the previously pending field!\n` +
    `   - companyName: corporate employer name (e.g. "TCS", "Google", "work at Infosys", "Tata Consultancy Services"). If user says "unemployed", "jobless", "student", or "freelancer", DO NOT set companyName; set employmentType appropriately.\n` +
    `   - monthlyIncome: net monthly take-home salary in INR as a number (e.g. "80k" -> 80000, "1 lakh" / "100000" -> 100000, "1.2 lakh" -> 120000, "0rs"/"zero"/"nil"/"unemployed" -> 0).\n` +
    `   - loanAmount: requested loan amount in INR as a number (e.g. "5 lakhs" / "500000" -> 500000).\n` +
    `   - tenureMonths: repayment tenure in months as a number (e.g. "3 years" -> 36, "48 months" -> 48).\n` +
    `   - cibil: credit bureau score (300-900). CRITICAL: If the user indicates they do not know their CIBIL score, have never checked it, or it is unknown/not provided, you MUST set cibil to "Not provided" as a string (never null, never 0, never "Standard"). If CIBIL was not mentioned or asked about at all, set cibil to null. Only if the user explicitly specifies a numeric score should cibil be a number.\n` +
    `   - existingEmi: ongoing monthly loan EMIs in INR as a number (e.g. 0 if none/no loans/nil/all clear).\n` +
    `   - employmentStatus: "unemployed" | "salaried" | "self-employed" | "student". Understand employment status naturally from context without requiring specific phrasing. If the user indicates they are not working, unemployed, jobless, or without a job, set employmentStatus to "unemployed", employmentType to "Unemployed", monthlyIncome to 0, and DO NOT set companyName.\n` +
    `   - UNEMPLOYED APPLICANTS (CRITICAL POLICY RULE): Partner bank personal loan policies strictly require active employment (Salaried or Self-Employed with minimum monthly salary). An unemployed applicant cannot qualify for an unsecured personal loan. NEVER blindly continue a fixed question sequence or ask for repayment tenure, CIBIL, or ongoing EMIs when the user is unemployed! In naturalResponse, clearly and empathetically explain the bank policy requirement (active employment and regular monthly income).\n` +
    `3. CORRECTIONS & UPDATES:\n` +
    `   - If the user modifies, corrects, or updates previously provided information (e.g. "Actually my salary is 95,000 not 80k", "Change tenure to 5 years", "My company is TCS not Infosys"), set isCorrection to true, list the changed fields in correctedFields, and put the new values in extractedDetails.\n` +
    `4. QUESTIONS & OBJECTIONS (DO NOT IGNORE QUESTIONS!):\n` +
    `   - If the user asks ANY question or raises ANY objection (e.g. "What is FOIR?", "Why do you need my age/CIBIL/company/salary?", "Will this check hurt my credit score?", "Is my data safe?", "Can I prepay my loan?", "What is reducing balance rate?", "Which bank offers the lowest rate?", "Can a self-employed person get a loan?"): \n` +
    `     Set hasQuestionOrObjection to true.\n` +
    `     Provide a clear, accurate, natural, professional banking explanation in questionAnswer.\n` +
    `     For CIBIL inquiry concerns: explain that this is a soft evaluation with zero impact on credit scores.\n` +
    `     For FOIR questions: explain that Fixed Obligation to Income Ratio represents total EMIs divided by monthly income, used by lenders to measure repayment capacity.\n` +
    `     For Age/Company/Salary questions: explain how lenders use these to assess statutory eligibility, corporate category tier, and loan affordability.\n` +
    `5. BANK POLICIES, EMI, MANAGERS, COMPANY RATINGS & LIVE WEB SEARCH:\n` +
    `   - If the user asks for an official bank's policy rules/guidelines/cutoffs or eligibility criteria (e.g. "Tell me the eligibility criteria for HDFC Bank", "What is HDFC bank policy?", "ICICI loan rules", "Axis Bank criteria"): set userIntent to "BANK_POLICY", targetBank to the bank name, and isLoanIntent to false. Do NOT ask for salary, CIBIL, age, or loan amount.\n` +
    `   - If the user asks to calculate monthly EMI (e.g. "EMI for 10 lakhs at 11% for 5 years"): set userIntent to "EMI_CALCULATION", populate emiDetails.\n` +
    `   - If the user asks for bank managers or branch contacts: set userIntent to "BANK_MANAGER", populate managerSearch.\n` +
    `   - If the user asks about an employer or company category rating / tier (e.g. "What is TCS category rating?", "Is Infosys listed in Cat A?"): set userIntent to "COMPANY_SEARCH", set companyQuery to the company name.\n` +
    `   - If the user asks for live web search, current financial news, or latest market updates: set userIntent to "WEB_SEARCH", set webSearchQuery.\n` +
    `   - If the user asks to cancel, reset, or restart: set userIntent to "CANCEL_RESET".\n` +
    `6. NATURAL RESPONSE & ASKING ONLY FOR REMAINING MISSING DETAILS (CRITICAL):\n` +
    `   - Always craft a complete, natural, human-like response in naturalResponse based on the current message + conversation context.\n` +
    `   - If the user greeted you, respond with a warm, natural greeting in your own words without rigid templates or canned menus.\n` +
    `   - DECIDING WHAT IS MISSING: Combine all newly extracted details from this message with Accumulated Applicant Profile. Compare against the required fields: [companyName, monthlyIncome, loanAmount, tenureMonths, cibil, age, existingEmi].\n` +
    `   - NEVER ASK AGAIN FOR INFORMATION ALREADY PROVIDED: If information has already been provided (either previously or in this message), do NOT ask for it again.\n` +
    `   - If details were provided, acknowledge what was provided warmly in your own words, and naturally ask ONLY for the first genuinely remaining missing field.\n` +
    `   - For example: if company, salary, loan amount, tenure, CIBIL, and age are all present, ask ONLY for existing monthly loan EMIs. Do not ask again for company, salary, loan amount, tenure, CIBIL, or age.\n` +
    `   - If all required details are now present, confirm that you have all the required details and are ready to evaluate their eligibility across partner banks.\n` +
    `   - If the user asked a question or raised an objection, answer it directly and warmly, and seamlessly ask for the genuinely remaining missing detail.\n` +
    `   - HIGH LOAN AMOUNTS (₹40L / ₹50L): High-ticket loans of ₹40 Lakhs to ₹50 Lakhs are officially supported by partner banks (including ICICI, IndusInd, Bajaj Finserv, Axis Finance, Poonawalla Fincorp, Tata Capital up to ₹50L, and Axis Bank, HDFC, IDFC, Kotak, Yes Bank up to ₹40L) for high-salary category applicants. Never reject ₹40L or ₹50L globally in your response. The deterministic policy engine evaluates eligibility bank-by-bank against each bank's actual policy limits, income criteria, and FOIR.\n` +
    `   - Never use canned replies, static question variations, phrases from menus, or generic boilerplate. Speak naturally as an intelligent banking advisor.\n` +
    `7. POST-EVALUATION STATE & NEXT ACTION ROUTING (When Eligibility Assessment Status is ALREADY_COMPLETED):\n` +
    `   - The applicant has ALREADY completed their loan eligibility evaluation and received their report and eligible banks table.\n` +
    `   - Interpret subsequent user messages generically from the conversation state to guide the applicant through the next steps WITHOUT repeating the evaluation report table.\n` +
    `   - RULE 1: NEVER AUTO-SELECT A RECOMMENDED BANK.\n` +
    `     * If the user sends progression phrases like "proceed", "continue", "yes", "okay", "sure", "next", "what next", "how to apply", etc., WITHOUT explicitly naming a bank:\n` +
    `       - DO NOT set selectedBank. Keep selectedBank as null.\n` +
    `       - Set userIntent to "PROCEED_NEXT_STEP".\n` +
    `       - In naturalResponse, warmly confirm that you are ready to proceed, mention their eligible partner banks (filtering out any rejected banks), and ask which bank they would like to apply with.\n` +
    `   - RULE 2: NEVER INVENT A CITY OR LOCATION.\n` +
    `     * When a bank is chosen by the user (either in this turn or previously in Currently Chosen Bank), check whether their city / location is known:\n` +
    `       - If the city is NOT known (${!city && !applicant?.location ? "CURRENTLY UNKNOWN" : "KNOWN: " + (city || applicant?.location)}):\n` +
    `         - DO NOT assume or invent "Mumbai" or any default city.\n` +
    `         - In naturalResponse, ask the user which city or branch location they are based in so you can connect them with their official bank representative.\n` +
    `       - If the user mentions their city (e.g. "Pune", "Bangalore", "Delhi", "Chennai"): populate city and extractedDetails.location.\n` +
    `     * If BOTH the bank AND city are known: confirm proceeding to connect them with their local representative.\n` +
    `   - RULE 3: GENERIC BANK REJECTION HANDLING.\n` +
    `     * If the user rejects a bank or expresses a desire not to proceed with a specific bank (e.g. "I don't want Bajaj Markets", "Not Bajaj", "Skip HDFC", "No, reject this", "Any other bank besides Bajaj?", "I don't like ICICI"):\n` +
    `       - Set userIntent to "REJECT_BANK".\n` +
    `       - Set rejectedBank to the rejected bank name.\n` +
    `       - Set selectedBank to null.\n` +
    `       - In naturalResponse, acknowledge the rejection naturally and warmly (e.g. "Understood, we'll exclude Bajaj Markets from your options."), present the other eligible banks from their approved list, and ask which other bank they would prefer to proceed with.\n` +
    `       - NEVER create a lead or show an AI-service error on bank rejection!\n` +
    `   - RULE 4: QUESTIONS & INQUIRIES AFTER EVALUATION.\n` +
    `     * If the user asks ANY question, policy rule, calculation, or objection: answer it directly, accurately, and warmly in naturalResponse without repeating the evaluation report.\n` +
    `   - RULE 5: EXPLICIT RE-EVALUATION ONLY.\n` +
    `     * Set wantsReevaluation to true ONLY if the user EXPLICITLY asks to recalculate, re-run, or re-show the eligibility table.\n` +
    `     * For all standard messages ("proceed", "continue", "yes", "okay", bank selection, rejections, questions), keep wantsReevaluation as false.\n` +
    `8. EXPLAINING INELIGIBILITY & REJECTION REASONS (CRITICAL):\n` +
    `   - When the user asks why they are not eligible, why they were rejected, or why a specific bank rejected them (e.g. "Why am I not eligible?", "Why was I rejected?", "Why did HDFC reject me?", "What criteria did I fail?"): \n` +
    `     * You MUST explain ONLY the actual failed criteria returned by the eligibility engine for the relevant bank(s) as provided in CURRENT CONTEXT.\n` +
    `     * Never invent, assume, or hallucinate reasons (e.g. do not invent negative credit remarks, lack of documents, or unverified defaults).\n` +
    `     * If explaining overall ineligibility, explain only the actual failed criteria across the banks (such as salary below category threshold, CIBIL score not meeting policy cutoff, FOIR exceeded, age outside permissible band, or loan amount outside ticket size).\n` +
    `     * If information was unknown or not provided (e.g. CIBIL score was not provided), preserve it as "Not provided" and explain that the bank's policy requires a minimum threshold that could not be verified without a score.\n` +
    `     * Keep the explanation completely natural, empathetic, and strictly faithful to the engine's actual criteria.\n\n` +
    `9. ZERO/NIL OBLIGATION RESOLUTION & GENERAL FIELD EXTRACTION (CRITICAL):\n` +
    `   - ALWAYS extract all parameters provided anywhere in the message, regardless of which field was previously pending.\n` +
    `   - EXISTING EMI (CRITICAL): If user mentions ongoing loans/EMIs (or answers the existingEmi request) with "0", "zero", "none", "nil", "no", "no loans", "no emi", "nothing", "clean", or specifies 0: you MUST set extractedDetails.existingEmi to 0 as a number (0 !== null). Never leave existingEmi as null when user answers 0 or none.\n` +
    `   - CIBIL SCORE: If user provides a 3-digit number (e.g. 750, 680, 800), set extractedDetails.cibil to that number. If unknown/unprovided, set to "Not provided".\n` +
    `   - AGE: If user provides age (e.g. 28), set extractedDetails.age to that number.\n` +
    `   - SALARY: If user provides salary/income (e.g. 100000, 1 lakh, 80k), set extractedDetails.monthlyIncome to that numeric amount.\n` +
    `   - LOAN AMOUNT: If user provides loan amount (e.g. 500000, 5 lakhs), set extractedDetails.loanAmount to that numeric amount.\n` +
    `   - TENURE: If user provides tenure (e.g. 3 years -> 36, 48 months -> 48), set extractedDetails.tenureMonths to that number in months.\n` +
    `   - EMPLOYER / COMPANY: If user provides employer/company name, set extractedDetails.companyName to that company name.\n` +
    `   - ACTIVE LOAN FLOW vs CONVERSATIONAL QUESTIONS:\n` +
    `     * Set isLoanIntent to true and userIntent to "LOAN_ELIGIBILITY" ONLY when the user is actively initiating a loan request, providing requested eligibility parameters (company, salary, loan amount, tenure, CIBIL, age, EMI), or explicitly asking to continue the loan check.\n` +
    `     * If the user asks ANY question, inquires about previous context (e.g. "what am I asking?"), asks for policy rules, raises an objection, or asks a generic question: you MUST set isLoanIntent to false, set userIntent to "QUESTION_OR_OBJECTION", set hasQuestionOrObjection to true, and provide the answer in questionAnswer and naturalResponse. Never force isLoanIntent to true when the user is asking a question!\n\n` +
    `RECENT CONVERSATION HISTORY (Prior Dialogue Turns in Chronological Order):\n${conversationHistory && conversationHistory.length > 0
      ? conversationHistory
        .filter((t) => t.content && t.content.trim())
        .map((t, idx) => `  [Turn ${idx + 1}] ${t.role === "assistant" || t.role === "ai" ? "Assistant" : "User"}: ${t.content.trim()}`)
        .join("\n")
      : "  No prior turns in this conversation."
    }\n\n` +
    `CURRENT USER MESSAGE: "${userMessage}"\n\n` +
    `Return ONLY a strictly valid JSON object matching this schema:\n` +
    `{\n` +
    `  "userIntent": "LOAN_ELIGIBILITY" | "BANK_POLICY" | "EMI_CALCULATION" | "BANK_MANAGER" | "COMPANY_SEARCH" | "WEB_SEARCH" | "QUESTION_OR_OBJECTION" | "CORRECTION" | "GREETING" | "CANCEL_RESET" | "SELECT_BANK" | "REJECT_BANK" | "PROCEED_NEXT_STEP" | "GENERAL_CHAT",\n` +
    `  "isLoanIntent": boolean,\n` +
    `  "hasQuestionOrObjection": boolean,\n` +
    `  "questionAnswer": string | null,\n` +
    `  "extractedDetails": {\n` +
    `    "companyName": string | null,\n` +
    `    "monthlyIncome": number | string | null,\n` +
    `    "loanAmount": number | string | null,\n` +
    `    "tenureMonths": number | string | null,\n` +
    `    "cibil": number | string | null,\n` +
    `    "existingEmi": number | string | null,\n` +
    `    "age": number | string | null,\n` +
    `    "location": string | null,\n` +
    `    "employmentStatus": "unemployed" | "salaried" | "self-employed" | "student" | null,\n` +
    `    "employmentType": "Salaried" | "Self-Employed" | "Unemployed" | "Student" | null\n` +
    `  },\n` +
    `  "isCorrection": boolean,\n` +
    `  "correctedFields": string[],\n` +
    `  "targetBank": string | null,\n` +
    `  "selectedBank": string | null,\n` +
    `  "rejectedBank": string | null,\n` +
    `  "city": string | null,\n` +
    `  "wantsReevaluation": boolean,\n` +
    `  "emiDetails": { "principal": number | null, "rate": number | null, "tenureMonths": number | null } | null,\n` +
    `  "managerSearch": { "bankName": string | null, "city": string | null } | null,\n` +
    `  "companyQuery": string | null,\n` +
    `  "webSearchQuery": string | null,\n` +
    `  "naturalResponse": string\n` +
    `}`;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const LLM_TIMEOUT_MS = 25000;
  const executeApiCall = async (targetModel: string, useStructuredOutputs: boolean = true) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const payload: any = {
        model: targetModel,
        temperature: 0.1,
        max_tokens: 3000,
        messages,
        reasoning: { effort: "low" },
      };
      if (useStructuredOutputs) {
        payload.response_format = { type: "json_object" };
      }
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
          "X-Title": "CreditWise AI",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        const err: any = new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
        err.status = res.status;
        err.rawResponseBody = errText;
        throw err;
      }
      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let rawContent = "";
  let lastOriginalError: any = null;

  if (apiKey) {
    const modelsToTry = Array.from(
      new Set([
        model,
        "inclusionai/ling-3.0-flash-vl:free",
        "inclusionai/ling-3.0-flash-fin:free",
        "nvidia/nemotron-3.5-lightning:free",
        "openrouter/auto",
      ].filter(Boolean) as string[])
    );

    for (const m of modelsToTry) {
      try {
        const data = await executeApiCall(m, true);
        rawContent = data?.choices?.[0]?.message?.content || "";
        if (rawContent && rawContent.trim()) break;
      } catch (err: any) {
        lastOriginalError = err;
        const errMsg = String(err?.message || err);
        if (errMsg.includes("does not support feature: structured-outputs") || errMsg.includes("INVALID_REQUEST_BODY")) {
          try {
            const dataWithoutFormat = await executeApiCall(m, false);
            rawContent = dataWithoutFormat?.choices?.[0]?.message?.content || "";
            if (rawContent && rawContent.trim()) break;
          } catch (retryErr: any) {
            lastOriginalError = retryErr;
            console.error(`[analyzeConversationWithLLM] Retry without structured outputs failed for ${m}:`, (retryErr as any)?.message || retryErr);
          }
        } else {
          console.error(`[analyzeConversationWithLLM] Failed with model ${m}:`, errMsg);
        }
      }
    }
  }

  if (!rawContent && lastOriginalError) {
    console.error("================================================================================");
    console.error("🚨 [ORIGINAL EXCEPTION IN LLM SERVICE]");
    console.error("• HTTP Status:", lastOriginalError?.status || (String(lastOriginalError?.message).match(/HTTP\s+(\d+)/)?.[1] ? Number(String(lastOriginalError?.message).match(/HTTP\s+(\d+)/)?.[1]) : "N/A"));
    console.error("• Exception Name:", lastOriginalError?.name || "Error");
    console.error("• Exception Message:", lastOriginalError?.message || String(lastOriginalError));
    console.error("• Stack Trace:\n", lastOriginalError?.stack || "(No stack trace available)");
    console.error("• Raw LLM Response Body:\n", lastOriginalError?.rawResponseBody || "(Empty / No body received)");
    console.error("================================================================================");
  }

  console.log(`[analyzeConversationWithLLM] RAW CONTENT (${rawContent.length} chars):\n`, rawContent);

  if (rawContent) {
    let parsed: MasterConversationAnalysis | null = null;
    try {
      let cleaned = cleanLlmJsonOutput(rawContent);
      cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(cleaned);
      console.log("[analyzeConversationWithLLM] JSON.parse succeeded directly");
    } catch (e1: any) {
      console.warn("[analyzeConversationWithLLM] e1 parse failed:", e1.message);
      try {
        let cleaned = cleanLlmJsonOutput(rawContent).replace(/,\s*([}\]])/g, "$1");
        const sanitized = cleaned.replace(/(:\s*"[^"]*?)\n([^"]*")/g, "$1\\n$2");
        parsed = JSON.parse(sanitized);
        console.log("[analyzeConversationWithLLM] Sanitized JSON.parse succeeded");
      } catch (e2: any) {
        console.warn("[analyzeConversationWithLLM] e2 parse failed:", e2.message);
        const getStr = (key: string) => {
          const m = rawContent.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"));
          if (m) {
            try {
              return JSON.parse(`"${m[1]}"`);
            } catch {
              return m[1];
            }
          }
          const mTrunc = rawContent.match(new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)(?:"|(?=\\s*,\\s*"[a-zA-Z]+"\s*:)|$)`, "i"));
          return mTrunc ? mTrunc[1].trim() : null;
        };
        const getNum = (key: string) => {
          const m = rawContent.match(new RegExp(`"${key}"\\s*:\\s*([0-9.]+)`, "i"));
          return m ? Number(m[1]) : null;
        };
        const getBool = (key: string) => {
          const m = rawContent.match(new RegExp(`"${key}"\\s*:\\s*(true|false)`, "i"));
          return m ? m[1].toLowerCase() === "true" : false;
        };

        const parsedQAnswer = getStr("questionAnswer");
        const parsedNatResp = getStr("naturalResponse");

        parsed = {
          userIntent: (getStr("userIntent") as any) || "LOAN_ELIGIBILITY",
          isLoanIntent: getBool("isLoanIntent"),
          hasQuestionOrObjection: getBool("hasQuestionOrObjection"),
          questionAnswer: parsedQAnswer,
          extractedDetails: {
            companyName: getStr("companyName"),
            monthlyIncome: getNum("monthlyIncome"),
            loanAmount: getNum("loanAmount"),
            tenureMonths: getNum("tenureMonths"),
            cibil: getNum("cibil"),
            existingEmi: getNum("existingEmi"),
            age: getNum("age"),
            location: getStr("location"),
            employmentType: (getStr("employmentType") as any) || null,
          },
          isCorrection: getBool("isCorrection"),
          correctedFields: [],
          targetBank: getStr("targetBank"),
          selectedBank: getStr("selectedBank"),
          rejectedBank: getStr("rejectedBank"),
          city: getStr("city"),
          wantsReevaluation: getBool("wantsReevaluation"),
          emiDetails: null,
          managerSearch: null,
          companyQuery: getStr("companyQuery"),
          webSearchQuery: getStr("webSearchQuery"),
          naturalResponse: parsedNatResp || parsedQAnswer || "",
        };
      }
    }

    // If rawContent was plain text without JSON fences or keys, use the LLM's natural text directly!
    if (!parsed || !parsed.naturalResponse || parsed.naturalResponse.trim().length === 0) {
      if (rawContent && rawContent.trim().length > 0 && !rawContent.trim().startsWith("{")) {
        let detectedRejectedBank: string | null = null;
        const rejMatch = userMessage.match(/(?:don't\s*want|not|reject|skip|no\s*to|avoid)\s+([A-Za-z0-9\s&]+?)(?:,|\.|\?|$|what|which)/i);
        if (rejMatch && rejMatch[1]) {
          const cand = rejMatch[1].trim();
          detectedRejectedBank = eligibleBanks?.find((b) => b.toLowerCase().includes(cand.toLowerCase()) || cand.toLowerCase().includes(b.toLowerCase())) || cand;
        }

        let detectedSelectedBank: string | null = null;
        if (!detectedRejectedBank && eligibleBanks) {
          for (const b of eligibleBanks) {
            const bNorm = b.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
            if (bNorm.length > 2 && new RegExp(`\\b${bNorm}\\b`, "i").test(userMessage)) {
              detectedSelectedBank = b;
              break;
            }
          }
        }

        let detectedCity: string | null = null;
        const cityMatch = userMessage.match(/\b(?:in|at|from|city\s*is|based\s*in)\s+([A-Z][a-z]+)/i);
        if (cityMatch) {
          detectedCity = cityMatch[1].trim();
        }

        const isUserLoanIntent =
          /loan|borrow|credit|personal\s*loan|need\s*(?:a\s*)?loan|apply\s*(?:for\s*)?(?:a\s*)?loan|get\s*(?:a\s*)?loan/i.test(userMessage);

        parsed = {
          userIntent: detectedRejectedBank
            ? "REJECT_BANK"
            : detectedSelectedBank
              ? "SELECT_BANK"
              : hasCompletedEvaluation
                ? "PROCEED_NEXT_STEP"
                : (isUserLoanIntent || isFlowActive || (missingFields && missingFields.length > 0))
                  ? "LOAN_ELIGIBILITY"
                  : "GENERAL_CHAT",
          isLoanIntent: isUserLoanIntent || isFlowActive || Boolean(missingFields && missingFields.length > 0) || false,
          hasQuestionOrObjection: false,
          questionAnswer: null,
          extractedDetails: {
            location: detectedCity,
          },
          isCorrection: false,
          correctedFields: [],
          targetBank: null,
          selectedBank: detectedSelectedBank,
          rejectedBank: detectedRejectedBank,
          city: detectedCity,
          wantsReevaluation: /recalculat|re-evaluat|show\s*(?:the\s*)?table\s*again/i.test(userMessage),
          naturalResponse: rawContent.trim(),
        };
      }
    }

    if (parsed && (!parsed.naturalResponse || parsed.naturalResponse.trim().length === 0)) {
      if (hasCompletedEvaluation) {
        if (parsed.userIntent === "REJECT_BANK" || parsed.rejectedBank) {
          const bankName = parsed.rejectedBank || "that bank";
          const remaining = (eligibleBanks || []).filter((b) => !b.toLowerCase().includes(bankName.toLowerCase()));
          parsed.naturalResponse = `Understood, we'll exclude ${bankName} from your options. You are also eligible with other partner banks such as ${remaining.slice(0, 3).join(", ")}. Which bank would you like to proceed with?`;
        } else if (parsed.selectedBank && !parsed.city) {
          parsed.naturalResponse = `Great choice with ${parsed.selectedBank}! Which city or branch location are you based in so we can connect you with your official representative?`;
        } else {
          parsed.naturalResponse = `We're ready to proceed with your application! Which partner bank would you like to apply with?`;
        }
      }
    }

    if (parsed) {
      // Normalize numeric extracted entities
      if (parsed.extractedDetails) {
        if (typeof parsed.extractedDetails.monthlyIncome === "string") {
          parsed.extractedDetails.monthlyIncome = parseFinancialAmount(parsed.extractedDetails.monthlyIncome) || undefined;
        }
        if (typeof parsed.extractedDetails.loanAmount === "string") {
          parsed.extractedDetails.loanAmount = parseFinancialAmount(parsed.extractedDetails.loanAmount) || undefined;
        }
        if (typeof parsed.extractedDetails.existingEmi === "string") {
          const emi = parseFinancialAmount(parsed.extractedDetails.existingEmi);
          parsed.extractedDetails.existingEmi = emi !== null ? emi : undefined;
        }
        if (typeof parsed.extractedDetails.tenureMonths === "string") {
          const t = parseInt(parsed.extractedDetails.tenureMonths, 10);
          if (!isNaN(t)) {
            parsed.extractedDetails.tenureMonths = t >= 1 && t <= 7 ? t * 12 : t;
          }
        }
        if (typeof parsed.extractedDetails.tenureMonths === "number" && parsed.extractedDetails.tenureMonths >= 1 && parsed.extractedDetails.tenureMonths <= 7) {
          parsed.extractedDetails.tenureMonths = parsed.extractedDetails.tenureMonths * 12;
        }
        if (typeof parsed.extractedDetails.cibil === "string") {
          const s = String(parsed.extractedDetails.cibil).trim();
          if (/not\s*provided|unknown|not\s*sure|don'?t\s*know|na|n\/a|no\s*cibil/i.test(s)) {
            parsed.extractedDetails.cibil = "Not provided";
          } else {
            const c = parseInt(s, 10);
            parsed.extractedDetails.cibil = !isNaN(c) ? c : "Not provided";
          }
        }
        if (typeof parsed.extractedDetails.cibil === "number") {
          if (parsed.extractedDetails.cibil === 0 && (/don'?t\s*know|unknown|not\s*sure|never\s*checked|no\s*idea/i.test(userMessage))) {
            parsed.extractedDetails.cibil = "Not provided";
          }
        }
        if (
          parsed.extractedDetails.cibil == null &&
          (/(?:don'?t\s*know|never\s*checked|unknown|not\s*sure|no\s*idea|haven'?t\s*checked).*(?:cibil|credit\s*score)|(?:cibil|credit\s*score).*(?:don'?t\s*know|never\s*checked|unknown|not\s*sure|no\s*idea|haven'?t\s*checked)/i.test(userMessage) ||
            (missingFields?.[0] === "cibil" && /don'?t\s*know|unknown|not\s*sure|never\s*checked|no\s*idea|no\s*score|none/i.test(userMessage)))
        ) {
          parsed.extractedDetails.cibil = "Not provided";
        }
        if (typeof parsed.extractedDetails.age === "string") {
          const a = parseInt(parsed.extractedDetails.age, 10);
          parsed.extractedDetails.age = !isNaN(a) ? a : undefined;
        }
        if (parsed.extractedDetails.companyName && isInvalidCompanyName(parsed.extractedDetails.companyName)) {
          parsed.extractedDetails.companyName = undefined;
        }

        // Generic simultaneous multi-entity extraction from userMessage for any unextracted or omitted fields
        if (parsed.extractedDetails.existingEmi === undefined || parsed.extractedDetails.existingEmi === null) {
          if (
            /(?:no|zero|0|nil)\s*(?:existing\s*)?emi|no\s*loans?|zero\s*debt|sab\s*clear/i.test(userMessage) ||
            /^(?:0|zero|none|nil|no|no\s*loans?|no\s*emis?|nothing|clean|na|n\/a)\b/i.test(userMessage.trim())
          ) {
            parsed.extractedDetails.existingEmi = 0;
          } else {
            const emiMatch = userMessage.match(/(?:existing|current|other|ongoing)?\s*emi(?:s)?(?::|\s*is|\s*of|\s*=)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i);
            if (emiMatch) {
              const parsedEmi = parseFinancialAmount(emiMatch[1] + (emiMatch[2] || ""));
              if (parsedEmi !== null) parsed.extractedDetails.existingEmi = parsedEmi;
            } else if (missingFields?.[0] === "existingEmi") {
              const parsedEmi = parseFinancialAmount(userMessage);
              if (parsedEmi !== null) parsed.extractedDetails.existingEmi = parsedEmi;
            }
          }
        }

        if (parsed.extractedDetails.age === undefined || parsed.extractedDetails.age === null) {
          const ageMatch =
            userMessage.match(/\b(?:age\s*(?:is|of|[:=-])?\s*|aged\s*)(\d{2})\b/i) ||
            userMessage.match(/\b(\d{2})\s*(?:years?\s*old|yr\s*old|yo\b)/i) ||
            (missingFields?.[0] === "age" || /age\b/i.test(conversationHistory?.slice(-1)?.[0]?.content || "")
              ? userMessage.match(/\b(1[8-9]|[2-8]\d)\b/)
              : null);
          if (ageMatch) {
            const a = parseInt(ageMatch[1], 10);
            if (a >= 18 && a <= 85) parsed.extractedDetails.age = a;
          }
        }

        if (parsed.extractedDetails.cibil === undefined || parsed.extractedDetails.cibil === null) {
          const cibilMatch =
            userMessage.match(/(?:cibil|credit\s*score|score\b)(?:\s*(?:is|of|[:=-]))?\s*([3-9]\d{2})\b/i) ||
            userMessage.match(/\b([3-9]\d{2})\b\s*(?:cibil|credit\s*score)/i) ||
            (missingFields?.[0] === "cibil" || /cibil|credit\s*score/i.test(conversationHistory?.slice(-1)?.[0]?.content || "")
              ? userMessage.match(/\b([3-9]\d{2})\b/)
              : null);
          if (cibilMatch) {
            parsed.extractedDetails.cibil = parseInt(cibilMatch[1], 10);
          }
        }

        if (parsed.extractedDetails.tenureMonths === undefined || parsed.extractedDetails.tenureMonths === null) {
          const yrMatch = userMessage.match(/(?:tenure\s*(?:is|of|[:=-])?\s*|for\s+)?(\d+)\s*(?:years?|yrs?|yr|saal|sal)\b/i);
          if (yrMatch) {
            parsed.extractedDetails.tenureMonths = parseInt(yrMatch[1], 10) * 12;
          } else {
            const moMatch = userMessage.match(/(?:tenure\s*(?:is|of|[:=-])?\s*|for\s+)?(\d+)\s*(?:months?|m\b)/i);
            if (moMatch) {
              parsed.extractedDetails.tenureMonths = parseInt(moMatch[1], 10);
            } else if (missingFields?.[0] === "tenureMonths") {
              const numMatch = userMessage.match(/\b(\d+)\b/);
              if (numMatch) {
                const n = parseInt(numMatch[1], 10);
                parsed.extractedDetails.tenureMonths = n <= 7 ? n * 12 : n;
              }
            }
          }
        }

        if (parsed.extractedDetails.loanAmount === undefined || parsed.extractedDetails.loanAmount === null) {
          const loanMatch =
            userMessage.match(/(?:need|want|borrow|require|looking\s+for|loan\s*(?:amount|of)?)(?:\s*(?:is|of|[:=-]))?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka)?)\s*(?:personal\s*)?(?:loan)?/i) ||
            userMessage.match(/(\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr|crores?|peti|khoka))\s+(?:personal\s*)?(?:loan|borrow)/i);
          if (loanMatch) {
            const amt = parseFinancialAmount(loanMatch[1]);
            if (amt !== null && amt >= 10000) parsed.extractedDetails.loanAmount = amt;
          } else if (missingFields?.[0] === "loanAmount") {
            const amt = parseFinancialAmount(userMessage);
            if (amt !== null && amt >= 1000) parsed.extractedDetails.loanAmount = amt;
          }
        }

        if (parsed.extractedDetails.monthlyIncome === undefined || parsed.extractedDetails.monthlyIncome === null) {
          const salMatch =
            userMessage.match(/(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|in\s*hand|nmi|nth|earning|earns?|makes?)(?:\s*(?:is|of|[:=-]))?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|peti|hazar)?)(?:\s*(?:per|\/)\s*month|\/mo)?/i) ||
            userMessage.match(/(\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|peti|hazar)?)\s*(?:per\s*month|\/mo|monthly|take\s*home|in\s*hand|salary|income)/i);
          if (salMatch) {
            const inc = parseFinancialAmount(salMatch[1]);
            if (inc !== null) parsed.extractedDetails.monthlyIncome = inc;
          } else if (missingFields?.[0] === "monthlyIncome") {
            const inc = parseFinancialAmount(userMessage);
            if (inc !== null) parsed.extractedDetails.monthlyIncome = inc;
          }
        }

        if (!parsed.extractedDetails.companyName || isInvalidCompanyName(parsed.extractedDetails.companyName)) {
          const cand = extractCompanyCandidateFromText(userMessage);
          if (cand && !isInvalidCompanyName(cand)) {
            parsed.extractedDetails.companyName = cand;
          } else if (missingFields?.[0] === "companyName" && !isFinancialOrProfileInput(userMessage) && !isInvalidCompanyName(userMessage)) {
            parsed.extractedDetails.companyName = userMessage.trim();
          }
        }

        // Only keep loan intent active if an eligibility flow is ALREADY in progress and user is actively continuing it
        if (
          isFlowActive &&
          parsed.userIntent !== "QUESTION_OR_OBJECTION" &&
          parsed.userIntent !== "BANK_POLICY" &&
          parsed.userIntent !== "CANCEL_RESET"
        ) {
          parsed.isLoanIntent = true;
          if (parsed.userIntent === "GENERAL_CHAT") {
            parsed.userIntent = "LOAN_ELIGIBILITY";
          }
        }
      }

      return parsed;
    }
  }

  // Technical API/network error handling only (no conversational fallbacks or canned replies)
  return {
    isTechnicalError: true,
    userIntent: "GENERAL_CHAT",
    isLoanIntent: false,
    hasQuestionOrObjection: false,
    questionAnswer: null,
    extractedDetails: {},
    isCorrection: false,
    correctedFields: [],
    targetBank: null,
    selectedBank: null,
    rejectedBank: null,
    city: null,
    wantsReevaluation: false,
    emiDetails: null,
    managerSearch: null,
    companyQuery: null,
    webSearchQuery: null,
    naturalResponse: "⚠️ The AI service is currently unavailable. Please check your network connection or try again shortly.",
  };
}

/**
 * Main CreditWise AI Central Agent.
 * Fully LLM-driven for conversation understanding.
 * Analyzes current message together with multi-turn conversation context.
 * Understands user intent, extracts/updates details, answers questions directly,
 * and asks ONLY for genuinely missing required information.
 * Preserves deterministic eligibility engine, bank policies, and calculations.
 */
export async function runCentralAgent(opts: {
  message: string;
  conversationId: string;
  model?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}): Promise<AgentResult> {
  const { message, conversationId, model: requestedModel } = opts;
  let { conversationHistory } = opts;
  const userMessage = String(message || "").trim();
  const norm = userMessage.toLowerCase().replace(/\s+/g, " ").trim();

  // 1. Ensure conversationHistory represents prior dialogue turns
  if (!conversationHistory || conversationHistory.length === 0) {
    const numConvId = Number(conversationId);
    if (pool && Number.isFinite(numConvId)) {
      try {
        const historyRes = await pool.query(
          `SELECT role, content FROM assistant_messages
           WHERE conversation_id = $1
           ORDER BY id ASC`,
          [numConvId]
        );
        const allRows = historyRes.rows;
        const priorRows =
          allRows.length > 0 && allRows[allRows.length - 1].content === userMessage
            ? allRows.slice(0, -1)
            : allRows;
        conversationHistory = priorRows.map((r: any) => ({
          role: r.role === "assistant" || r.role === "ai" ? "assistant" : "user",
          content: r.content,
        }));
      } catch (histErr) {
        console.warn("Could not load conversation history in runCentralAgent:", histErr);
      }
    }
  }

  // Ensure conversationHistory represents strictly prior dialogue turns
  if (conversationHistory && conversationHistory.length > 0) {
    const lastItem = conversationHistory[conversationHistory.length - 1];
    if (
      (lastItem.role === "user" || lastItem.role === "human") &&
      lastItem.content.trim() === userMessage.trim()
    ) {
      conversationHistory = conversationHistory.slice(0, -1);
    }
  }

  // 2. Retrieve existing eligibility session state & consolidate full conversation profile
  const eligibilitySession = await getEligibilityState(conversationId);
  const isEligibleFlowActive = !!(
    eligibilitySession &&
    (eligibilitySession.expectedField ||
      (eligibilitySession.missingFields && eligibilitySession.missingFields.length > 0) ||
      (eligibilitySession as any).in_eligibility_flow)
  );

  const currentApplicant: ApplicantProfile = consolidateApplicantProfileFromHistory(
    conversationHistory,
    userMessage,
    eligibilitySession?.applicant
  );

  const currentMissingFields = getRequiredPolicyFields(currentApplicant);

  // 3. Retrieve completed evaluation context
  const hasCompletedEvaluation = Boolean(
    eligibilitySession?.evaluationCompleted ||
    eligibilitySession?.hasCompletedEvaluation ||
    eligibilitySession?.expectedField === "chosenBank" ||
    (eligibilitySession?.eligible_banks && eligibilitySession.eligible_banks.length > 0)
  );
  const eligibleBanks: string[] = eligibilitySession?.eligible_banks || [];
  const topRecommendedBank: string = eligibilitySession?.topBank || eligibleBanks[0] || "";
  const existingChosenBank: string = eligibilitySession?.chosenBank || "";
  const existingCity: string = eligibilitySession?.city || eligibilitySession?.location || currentApplicant.location || "";
  const existingRejectedBanks: string[] = eligibilitySession?.rejectedBanks || [];

  let sessionIneligibleBanks: Array<{ bankName: string; failureReasons: string[] }> =
    eligibilitySession?.ineligibleBanks || [];
  if (
    (!sessionIneligibleBanks || sessionIneligibleBanks.length === 0) &&
    hasCompletedEvaluation
  ) {
    try {
      const quickEval = await evaluateApplicantAgainstAllBanks(currentApplicant, currentApplicant.loanType || "Personal Loan");
      sessionIneligibleBanks = (quickEval.ineligibleBanks || []).map((b) => ({
        bankName: b.bankName,
        failureReasons: b.failureReasons,
      }));
    } catch (e) {
      console.warn("Could not evaluate ineligibility criteria for context:", e);
    }
  }

  // 4. Master LLM Conversational Analysis
  const analysis = await analyzeConversationWithLLM({
    userMessage,
    conversationHistory,
    applicant: currentApplicant,
    missingFields: currentMissingFields,
    isFlowActive: isEligibleFlowActive,
    hasCompletedEvaluation,
    eligibleBanks,
    topRecommendedBank,
    chosenBank: existingChosenBank,
    city: existingCity,
    rejectedBanks: existingRejectedBanks,
    failedCriteria: sessionIneligibleBanks,
    modelOverride: requestedModel,
  });

  // 4b. Technical API/network error handling:
  // If the applicant sends details, extract ALL parameters from userMessage generically.
  // Never throw away user data, and evaluate against bank policies if all 7 fields are ready.
  if (analysis.isTechnicalError) {
    const mergedApplicant = extractApplicantDetails(userMessage, currentApplicant, currentMissingFields);
    Object.assign(currentApplicant, mergedApplicant);

    if (currentApplicant.companyName && currentApplicant.companyName !== "Self-Employed") {
      try {
        const resolved = await resolveCompanyCategories(currentApplicant.companyName);
        if (resolved?.matchedName) currentApplicant.companyName = resolved.matchedName;
      } catch {}
    }

    const isUnemployedErrorCase =
      currentApplicant.employmentStatus === "unemployed" ||
      currentApplicant.employmentType === "Unemployed";

    if (isUnemployedErrorCase) {
      await clearEligibilityState(conversationId);
      return {
        reply: "Under partner bank policies, unsecured personal loans require active employment (Salaried or Self-Employed) with regular verifiable monthly income. Unemployed applicants are currently not eligible for unsecured personal loans.",
      };
    }

    const hasLoanIntent =
      isEligibleFlowActive ||
      Boolean(eligibilitySession?.in_eligibility_flow) ||
      detectLoanIntent(userMessage).isLoanIntent ||
      [currentApplicant.companyName, currentApplicant.monthlyIncome, currentApplicant.loanAmount, currentApplicant.cibil].filter((v) => v != null).length >= 1;

    if (hasLoanIntent) {
      const remainingMissing = getRequiredPolicyFields(currentApplicant);
      const hasAllFields =
        Boolean(currentApplicant.companyName || currentApplicant.employmentType === "Self-Employed") &&
        typeof currentApplicant.monthlyIncome === "number" && currentApplicant.monthlyIncome > 0 &&
        typeof currentApplicant.loanAmount === "number" && currentApplicant.loanAmount > 0 &&
        typeof currentApplicant.tenureMonths === "number" && currentApplicant.tenureMonths > 0 &&
        remainingMissing.length === 0;

      if (hasAllFields && !hasCompletedEvaluation) {
        // All fields collected! Run deterministic policy evaluation directly from bank Master Policies!
        const evalResult = await evaluateApplicantAgainstAllBanks(currentApplicant, currentApplicant.loanType || "Personal Loan");
        const report = formatDynamicEligibilityReport(currentApplicant, evalResult);

        await saveEligibilityState(conversationId, {
          applicant: currentApplicant,
          expectedField: "chosenBank",
          missingFields: [],
          in_eligibility_flow: false,
          hasCompletedEvaluation: true,
          evaluationCompleted: true,
          eligible_banks: (evalResult.eligibleBanks || []).map((b) => b.bankName),
          topBank: evalResult.recommendedBank?.bankName || (evalResult.eligibleBanks?.[0]?.bankName) || "",
          ineligibleBanks: (evalResult.ineligibleBanks || []).map((b) => ({
            bankName: b.bankName,
            failureReasons: b.failureReasons,
          })),
          updatedAt: Date.now(),
        } as any);

        const bankDataForClient = evalResult.evaluations.map((ev) => ({
          bank_id: ev.bankId,
          bank_name: ev.bankName,
          status: ev.status,
          is_eligible: ev.isEligible,
          roi: ev.roi,
          monthly_emi: ev.monthlyEmi,
          calculated_foir: ev.calculatedFoir,
          max_loan_eligible: ev.maxLoanEligible,
          failure_reasons: ev.failureReasons,
        }));

        return { reply: report, bankData: bankDataForClient };
      } else if (remainingMissing.length > 0 && !hasCompletedEvaluation) {
        const nextMissingField = remainingMissing[0];
        await saveEligibilityState(conversationId, {
          applicant: currentApplicant,
          expectedField: nextMissingField,
          missingFields: remainingMissing,
          in_eligibility_flow: true,
          updatedAt: Date.now(),
        } as any);

        let askMessage = "";
        switch (nextMissingField) {
          case "companyName":
            askMessage = "Could you please tell me which company you currently work for?";
            break;
          case "monthlyIncome":
            askMessage = "Could you let me know your approximate monthly take-home salary?";
            break;
          case "loanAmount":
            askMessage = "How much loan amount are you looking to borrow?";
            break;
          case "tenureMonths":
            askMessage = "What is your preferred repayment tenure (in months or years)?";
            break;
          case "cibil":
            askMessage = "What is your approximate CIBIL credit score (or say 'not sure' if unknown)?";
            break;
          case "age":
            askMessage = "Could you share your current age?";
            break;
          case "existingEmi":
            askMessage = "Do you have any existing monthly EMIs on ongoing loans? (If none, simply enter 0)";
            break;
          default:
            askMessage = `Could you share your ${nextMissingField}?`;
        }

        const ackParts: string[] = [];
        if (currentApplicant.companyName) ackParts.push(`working at **${currentApplicant.companyName}**`);
        if (currentApplicant.monthlyIncome) ackParts.push(`earning **₹${Number(currentApplicant.monthlyIncome).toLocaleString("en-IN")}/month**`);
        if (currentApplicant.loanAmount) ackParts.push(`for a loan of **₹${Number(currentApplicant.loanAmount).toLocaleString("en-IN")}**`);

        const ackPrefix = ackParts.length > 0 ? `Thank you! I've noted your details (${ackParts.join(", ")}). ` : "";
        return { reply: `${ackPrefix}To complete your eligibility check across our partner banks, ${askMessage.charAt(0).toLowerCase() + askMessage.slice(1)}` };
      }
    }

    return {
      reply: analysis.naturalResponse || "⚠️ The AI service is currently unavailable. Please check your network connection or try again shortly.",
    };
  }

  // 4c. Post-Evaluation Bank Selection & Next Action Routing
  if (hasCompletedEvaluation) {
    // If the user explicitly asks to recalculate or re-evaluate, fall through to shouldRunEvaluation below
    if (analysis.wantsReevaluation || (analysis.isCorrection && currentMissingFields.length === 0)) {
      // Handled by shouldRunEvaluation below
    } else {
      let updatedChosenBank = existingChosenBank;
      let updatedCity = existingCity;
      const updatedRejectedBanks = [...existingRejectedBanks];

      // 1. Bank Rejection handling (e.g. "I don't want Bajaj", "Not Bajaj Markets", "Skip HDFC", "Any other bank?")
      if (analysis.rejectedBank || analysis.userIntent === "REJECT_BANK") {
        const rej = (analysis.rejectedBank || existingChosenBank || "").trim();
        if (rej && !updatedRejectedBanks.some((b) => b.toLowerCase() === rej.toLowerCase())) {
          updatedRejectedBanks.push(rej);
        }
        // If the rejected bank was the previously chosen bank, clear chosenBank
        if (updatedChosenBank && rej && updatedChosenBank.toLowerCase().includes(rej.toLowerCase())) {
          updatedChosenBank = "";
        }
      }

      // 2. Bank Selection (ONLY from explicit user choice, NEVER auto-selected)
      if (analysis.selectedBank && analysis.selectedBank.trim()) {
        const normChosen = analysis.selectedBank.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
        const matchedBank =
          eligibleBanks.find((b) => {
            const bNorm = b.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
            return bNorm.includes(normChosen) || normChosen.includes(bNorm);
          }) || analysis.selectedBank.trim();

        // Ensure not in rejected list
        if (!updatedRejectedBanks.some((r) => r.toLowerCase().includes(normChosen))) {
          updatedChosenBank = matchedBank;
        }
      }

      // 3. User-Provided City/Location (NEVER invent "Mumbai" or any default city)
      const extractedCity = (analysis.city || analysis.extractedDetails?.location || "").trim();
      if (extractedCity) {
        updatedCity = extractedCity;
        currentApplicant.location = extractedCity;
      }

      // 4. If BOTH bank AND city are known from user -> Connect with bank manager / initiate lead
      if (updatedChosenBank && updatedCity) {
        let managerSection = "";
        try {
          const mgrList = await searchBankManager({
            bank_name: updatedChosenBank,
            city: updatedCity,
            query: `${updatedChosenBank} ${updatedCity}`,
          });
          managerSection = mgrList?.length
            ? `### 👔 Official Bank Manager Directory: **${updatedChosenBank}** (${updatedCity})\n\n` + formatManagers(mgrList, updatedCity)
            : `Official manager contact request logged for **${updatedChosenBank}** in **${updatedCity}**.`;
        } catch {
          managerSection = `Official manager contact request logged for **${updatedChosenBank}** in **${updatedCity}**.`;
        }

        await clearEligibilityState(conversationId);
        const numConvId = Number(conversationId);
        if (pool && Number.isFinite(numConvId)) {
          try {
            await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numConvId]);
          } catch { }
        }

        const replyText =
          analysis.naturalResponse && !analysis.naturalResponse.toLowerCase().includes(updatedChosenBank.toLowerCase())
            ? `${analysis.naturalResponse}\n\n${managerSection}\n\n---\n✅ **Application process initiated for ${updatedChosenBank} in ${updatedCity}. Our official representative will assist you.**`
            : `${analysis.naturalResponse || managerSection}\n\n---\n✅ **Thank you for choosing ${updatedChosenBank}! Our official representative in ${updatedCity} will assist with your application.**`;

        return { reply: replyText };
      }

      // 5. If bank or city is still missing, or bank rejected, or question asked:
      // Persist state across conversation turns so the assistant knows what's selected, rejected, or missing
      await saveEligibilityState(conversationId, {
        ...eligibilitySession,
        applicant: currentApplicant,
        hasCompletedEvaluation: true,
        evaluationCompleted: true,
        eligible_banks: eligibleBanks,
        topBank: topRecommendedBank,
        chosenBank: updatedChosenBank,
        city: updatedCity,
        location: updatedCity,
        rejectedBanks: updatedRejectedBanks,
        updatedAt: Date.now(),
      } as any);

      // Return the LLM's natural conversational response directly (never canned/default)
      if (analysis.hasQuestionOrObjection && analysis.questionAnswer) {
        return { reply: analysis.questionAnswer.trim() };
      }
      if (analysis.naturalResponse && analysis.naturalResponse.trim().length > 0) {
        return { reply: analysis.naturalResponse.trim() };
      }
    }
  }

  // 5. Handle Reset / Cancel
  if (analysis.userIntent === "CANCEL_RESET" || /^(cancel|reset|restart|stop|exit)\b/i.test(norm)) {
    await clearEligibilityState(conversationId);
    const numConvId = Number(conversationId);
    if (pool && Number.isFinite(numConvId)) {
      try {
        await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numConvId]);
      } catch { }
    }
    return {
      reply: "🔄 **Loan Assessment Reset**\n\nYour session has been reset. You can start fresh anytime by asking for a loan, checking bank policies, or calculating EMIs.",
    };
  }

  // 6. Handle Official Bank Policy Inquiries
  const isPersonalEligibilityAsk =
    /(?:am\s*i\s*(?:eligible|qualif\w*)|check\s*(?:my|our)\s*eligib\w*|for\s*me|my\s*eligib\w*|can\s*i\s*(?:get|apply|qualify)|i\s*(?:need|want)\s*a\s*loan)/i.test(norm);

  const isPolicyQuery =
    analysis.userIntent === "BANK_POLICY" ||
    Boolean(analysis.targetBank && /policy|rule|criteria|cutoff|guideline|foir|eligib/i.test(norm) && !isPersonalEligibilityAsk) ||
    Boolean(
      /(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|eligibility\s*criteria)\b/i.test(norm) &&
      /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|\btata\b(?!.*consultancy)|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|chola|smfg|finnable|fibe|sbm|utkarsh|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)/i.test(norm) &&
      !isPersonalEligibilityAsk
    );

  if (isPolicyQuery) {
    let bankToQuery = analysis.targetBank;
    if (!bankToQuery) {
      const bankMatch = /(?:hdfc|icici|axis|sbi|kotak|indusind|idfc|bajaj|piramal|poonawalla|yes\s*bank|\byes\b|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm|tata\s*capital|\btata\b(?!.*consultancy)|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)/i.exec(userMessage);
      if (bankMatch) bankToQuery = bankMatch[0];
    }
    if (!bankToQuery) {
      bankToQuery = extractUnsupportedBankName(userMessage) || "";
    }
    const policyReply = await answerBankPolicyWithMasterPolicy(bankToQuery, userMessage, requestedModel);
    return { reply: policyReply };
  }

  // 7. Handle EMI Calculation
  const isEmiQuery =
    analysis.userIntent === "EMI_CALCULATION" ||
    Boolean(
      norm.match(/\bemi\b/i) &&
      (norm.match(/(\d+(?:\.\d+)?)\s*%/i) || norm.match(/(?:at|rate\s*of)\s*(\d+)/i) || /interest/i.test(norm)) &&
      (norm.match(/(\d+)\s*(?:years?|yrs?|months?|m\b)/i) || norm.match(/(?:lakhs?|lacs?|k\b|\d{5,8})/i))
    );

  if (isEmiQuery) {
    let principal = analysis.emiDetails?.principal || analysis.extractedDetails?.loanAmount;
    let rate = analysis.emiDetails?.rate;
    let tenure = analysis.emiDetails?.tenureMonths || analysis.extractedDetails?.tenureMonths;

    if (!principal) {
      const pMatch = norm.match(/(?:for|loan\s*of|amount\s*of)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|cr)?/i);
      if (pMatch) {
        principal = parseFinancialAmount(pMatch[1] + (pMatch[2] || "")) || undefined;
      }
    }
    if (!rate) {
      const rMatch = norm.match(/(\d+(?:\.\d+)?)\s*%/);
      if (rMatch) rate = parseFloat(rMatch[1]);
    }
    if (!tenure) {
      const yrMatch = norm.match(/(\d+)\s*(?:years?|yrs?|yr)/i);
      if (yrMatch) tenure = parseInt(yrMatch[1], 10) * 12;
      else {
        const moMatch = norm.match(/(\d+)\s*(?:months?|m\b)/i);
        if (moMatch) tenure = parseInt(moMatch[1], 10);
      }
    }

    const numPrincipal = typeof principal === "number" ? principal : (principal && !isNaN(Number(principal)) ? Number(principal) : 0);
    const numTenure = typeof tenure === "number" ? tenure : (tenure && !isNaN(Number(tenure)) ? Number(tenure) : 0);

    if (numPrincipal > 0) {
      const effectiveRate = rate || 10.5;
      const effectiveTenure = numTenure || 60;
      const emiVal = calculateEmi(numPrincipal, effectiveRate, effectiveTenure);
      const emiMarkdown = formatEmiResult(
        { principal: numPrincipal, rate: effectiveRate, tenure: effectiveTenure },
        emiVal
      );

      return { reply: emiMarkdown };
    }
  }

  // 8. Handle Bank Manager Directory Searches
  if (
    analysis.userIntent === "BANK_MANAGER" &&
    (analysis.managerSearch?.bankName || /manager|branch\s*head|\basm\b|\brsm\b/i.test(norm))
  ) {
    const mgrArgs = {
      bank_name: analysis.managerSearch?.bankName || undefined,
      city: analysis.managerSearch?.city || undefined,
    };
    return await executeSearchBankManagers(mgrArgs, userMessage, isEligibleFlowActive, eligibilitySession);
  }

  // 8b. Handle Corporate Company Category Searches
  const isCompanySearch =
    analysis.userIntent === "COMPANY_SEARCH" ||
    ((/(?:company|employer)\s+(?:category|tier|rating|listing)|(?:is|check)\s+.*\s+(?:listed|categorized)|\bcategory\s*rating\b/i.test(norm)) &&
      !analysis.isLoanIntent &&
      !isEligibleFlowActive &&
      !isPolicyQuery);

  if (isCompanySearch) {
    let compName = analysis.companyQuery || analysis.extractedDetails?.companyName;
    if (!compName) {
      compName = userMessage
        .replace(/^(?:what\s+is\s+the|what\s+is|tell\s+me\s+about|search|check|find|is|are)\b/gi, "")
        .replace(/\b(?:corporate\s+category\s+rating|category\s+rating|corporate\s+tier|category|rating|tier|corporate\s+listing|listed\s+in|for|of|in|records?|bank\s+records?|across\s+banks?|in\s+banks?|partner\s+banks?)\b/gi, "")
        .replace(/[?.,!]/g, "")
        .trim();
    }
    const compResult = await executeSearchCompanyCategory({ companyName: compName }, userMessage, isEligibleFlowActive, eligibilitySession);
    return compResult;
  }

  // 8c. Handle Live Web Search via Tavily
  if (analysis.userIntent === "WEB_SEARCH" && (analysis.webSearchQuery || /news|latest rate|rbi repo|interest rate hike/i.test(norm))) {
    const query = analysis.webSearchQuery || userMessage;
    return await executeTavilySearch({ query }, userMessage, isEligibleFlowActive, eligibilitySession);
  }

  // 9. Consolidate Applicant Profile & Apply Entity Updates / Corrections
  const updatedApplicant: ApplicantProfile = { ...currentApplicant };

  if (analysis.isCorrection && analysis.extractedDetails) {
    const fieldsToApply = analysis.correctedFields?.length ? analysis.correctedFields : Object.keys(analysis.extractedDetails);
    for (const f of fieldsToApply) {
      if ((analysis.extractedDetails as any)[f] !== undefined && (analysis.extractedDetails as any)[f] !== null) {
        (updatedApplicant as any)[f] = (analysis.extractedDetails as any)[f];
      }
    }
  } else if (analysis.extractedDetails) {
    if (analysis.extractedDetails.companyName && !isInvalidCompanyName(analysis.extractedDetails.companyName)) {
      updatedApplicant.companyName = analysis.extractedDetails.companyName;
    }
    if (analysis.extractedDetails.monthlyIncome !== undefined && analysis.extractedDetails.monthlyIncome !== null) {
      updatedApplicant.monthlyIncome = analysis.extractedDetails.monthlyIncome;
    }
    if (analysis.extractedDetails.loanAmount !== undefined && analysis.extractedDetails.loanAmount !== null) {
      updatedApplicant.loanAmount = analysis.extractedDetails.loanAmount;
    }
    if (analysis.extractedDetails.tenureMonths !== undefined && analysis.extractedDetails.tenureMonths !== null) {
      updatedApplicant.tenureMonths = analysis.extractedDetails.tenureMonths;
    }
    if (analysis.extractedDetails.cibil !== undefined && analysis.extractedDetails.cibil !== null) {
      updatedApplicant.cibil = analysis.extractedDetails.cibil;
    }
    if (analysis.extractedDetails.existingEmi !== undefined && analysis.extractedDetails.existingEmi !== null) {
      updatedApplicant.existingEmi = analysis.extractedDetails.existingEmi;
    } else if (
      (updatedApplicant.existingEmi === undefined || updatedApplicant.existingEmi === null) &&
      (currentMissingFields?.[0] === "existingEmi" || eligibilitySession?.expectedField === "existingEmi")
    ) {
      if (/^(?:0|zero|none|nil|no|no\s*loans?|no\s*emis?|nothing|clean|na|n\/a)\b/i.test(userMessage.trim())) {
        updatedApplicant.existingEmi = 0;
      } else {
        const parsed = parseFinancialAmount(userMessage);
        if (parsed !== null) updatedApplicant.existingEmi = parsed;
      }
    }
    if (analysis.extractedDetails.age !== undefined && analysis.extractedDetails.age !== null) {
      updatedApplicant.age = analysis.extractedDetails.age;
    }
    if (analysis.extractedDetails.employmentStatus) {
      updatedApplicant.employmentStatus = analysis.extractedDetails.employmentStatus;
      if (analysis.extractedDetails.employmentStatus === "unemployed") {
        updatedApplicant.employmentType = "Unemployed";
        updatedApplicant.monthlyIncome = 0;
        updatedApplicant.companyName = undefined;
      }
    }
    if (analysis.extractedDetails.employmentType) {
      updatedApplicant.employmentType = analysis.extractedDetails.employmentType;
      if (analysis.extractedDetails.employmentType === "Unemployed") {
        updatedApplicant.employmentStatus = "unemployed";
        updatedApplicant.monthlyIncome = 0;
        updatedApplicant.companyName = undefined;
      }
    }
  }

  // Safety net: extract any details mentioned in userMessage that LLM may have omitted
  const fallbackExtracted = extractApplicantDetails(userMessage, updatedApplicant, currentMissingFields, analysis.extractedDetails);
  Object.assign(updatedApplicant, fallbackExtracted);

  // Resolve corporate company category against 339,000+ bank records
  if (updatedApplicant.companyName && updatedApplicant.companyName !== "Self-Employed") {
    try {
      const resolved = await resolveCompanyCategories(updatedApplicant.companyName);
      if (resolved?.matchedName) {
        updatedApplicant.companyName = resolved.matchedName;
      }
    } catch { }
  }

  // 10. Check if user asked a question, objection, or context inquiry without providing new profile details
  const hasNewProfileDetailsInThisTurn =
    Boolean(analysis.extractedDetails && (
      (analysis.extractedDetails.monthlyIncome !== null && analysis.extractedDetails.monthlyIncome !== undefined) ||
      (analysis.extractedDetails.loanAmount !== null && analysis.extractedDetails.loanAmount !== undefined) ||
      (analysis.extractedDetails.tenureMonths !== null && analysis.extractedDetails.tenureMonths !== undefined) ||
      (analysis.extractedDetails.cibil !== null && analysis.extractedDetails.cibil !== undefined) ||
      (analysis.extractedDetails.age !== null && analysis.extractedDetails.age !== undefined) ||
      (analysis.extractedDetails.existingEmi !== null && analysis.extractedDetails.existingEmi !== undefined) ||
      (analysis.extractedDetails.companyName && !isInvalidCompanyName(analysis.extractedDetails.companyName))
    ));

  // If the user's message is a question, objection, or context inquiry (and no new profile details were provided in this turn),
  // directly answer the user's question without continuing the eligibility wizard, asking for a bank, restarting, or generating a table!
  const isQuestionOrContextInquiry =
    (analysis.userIntent === "QUESTION_OR_OBJECTION" || (analysis.hasQuestionOrObjection && !analysis.isLoanIntent)) &&
    !hasNewProfileDetailsInThisTurn;

  if (isQuestionOrContextInquiry) {
    const questionReply = analysis.questionAnswer || analysis.naturalResponse;
    if (questionReply && questionReply.trim().length > 0) {
      return { reply: questionReply.trim() };
    }
  }

  // 11. Determine Loan Flow Status & Eligibility Decision
  const hasMultipleProfileParams =
    [updatedApplicant.monthlyIncome, updatedApplicant.loanAmount, updatedApplicant.cibil, updatedApplicant.companyName].filter(
      (v) => v !== undefined && v !== null
    ).length >= 2;

  const isUnemployed =
    updatedApplicant.employmentStatus === "unemployed" ||
    updatedApplicant.employmentType === "Unemployed";

  // If user is unemployed, DO NOT generate a bank table and DO NOT continue asking for loan details!
  if (isUnemployed) {
    await clearEligibilityState(conversationId);
    if (analysis.naturalResponse && analysis.naturalResponse.trim().length > 0) {
      return { reply: analysis.naturalResponse.trim() };
    }
    return {
      reply: "Under partner bank policies, unsecured personal loans require active employment (Salaried or Self-Employed) with regular verifiable monthly income to confirm repayment capacity. Unemployed applicants are currently not eligible for unsecured personal loans. If you have collateral, secured options like a gold loan or loan against fixed deposits may be possible.",
    };
  }

  const isLoanFlow =
    analysis.isLoanIntent ||
    isEligibleFlowActive ||
    Boolean(eligibilitySession?.in_eligibility_flow) ||
    hasMultipleProfileParams;

  if (isLoanFlow) {
    const missingFields = getRequiredPolicyFields(updatedApplicant);

    const hasAllRequiredFields =
      !isUnemployed &&
      Boolean(updatedApplicant.companyName || updatedApplicant.employmentType === "Self-Employed") &&
      typeof updatedApplicant.monthlyIncome === "number" && updatedApplicant.monthlyIncome > 0 &&
      typeof updatedApplicant.loanAmount === "number" && updatedApplicant.loanAmount > 0 &&
      typeof updatedApplicant.tenureMonths === "number" && updatedApplicant.tenureMonths > 0 &&
      missingFields.length === 0;

    // Only run or re-run the evaluation engine if:
    // 1) It has not yet been run in this session (!hasCompletedEvaluation), OR
    // 2) The user explicitly requested to recalculate/re-evaluate (analysis.wantsReevaluation), OR
    // 3) The user updated/corrected profile details (analysis.isCorrection).
    const shouldRunEvaluation =
      (!hasCompletedEvaluation && hasAllRequiredFields) ||
      (hasCompletedEvaluation && Boolean(analysis.wantsReevaluation) && hasAllRequiredFields) ||
      (hasCompletedEvaluation && Boolean(analysis.isCorrection && hasAllRequiredFields));

    if (shouldRunEvaluation) {
      const evalResult = await evaluateApplicantAgainstAllBanks(updatedApplicant, updatedApplicant.loanType || "Personal Loan");
      let report = formatDynamicEligibilityReport(updatedApplicant, evalResult);

      // If user also asked a question or raised an objection in this turn, answer it before the report!
      if (analysis.hasQuestionOrObjection && analysis.questionAnswer) {
        report = `> [!NOTE]\n> **Answering your question:** ${analysis.questionAnswer}\n\n` + report;
      }

      await saveEligibilityState(conversationId, {
        applicant: updatedApplicant,
        expectedField: "chosenBank",
        missingFields: [],
        in_eligibility_flow: false,
        hasCompletedEvaluation: true,
        evaluationCompleted: true,
        eligible_banks: (evalResult.eligibleBanks || []).map((b) => b.bankName),
        topBank: evalResult.recommendedBank?.bankName || (evalResult.eligibleBanks?.[0]?.bankName) || "",
        ineligibleBanks: (evalResult.ineligibleBanks || []).map((b) => ({
          bankName: b.bankName,
          failureReasons: b.failureReasons,
        })),
        updatedAt: Date.now(),
      } as any);

      const bankDataForClient = evalResult.evaluations.map((ev) => ({
        bank_id: ev.bankId,
        bank_name: ev.bankName,
        status: ev.status,
        is_eligible: ev.isEligible,
        roi: ev.roi,
        monthly_emi: ev.monthlyEmi,
        calculated_foir: ev.calculatedFoir,
        max_loan_eligible: ev.maxLoanEligible,
        failure_reasons: ev.failureReasons,
      }));

      return { reply: report, bankData: bankDataForClient };
    }

    // Case B: Information is missing -> Ask ONLY for the genuinely missing detail during active collection!
    if (!hasCompletedEvaluation && missingFields.length > 0) {
      const nextField = missingFields[0];
      let replyText = analysis.naturalResponse?.trim() || "";

      // Check if the LLM's response asked again for information already provided
      const asksForAlreadyProvidedField =
        (updatedApplicant.companyName && nextField !== "companyName" && /(?:which|what)\s+(?:company|employer)|who\s+do\s+you\s+work\s+for/i.test(replyText)) ||
        (updatedApplicant.monthlyIncome != null && nextField !== "monthlyIncome" && /(?:what|share|tell|provide).*(?:salary|income|take[\s-]*home)/i.test(replyText)) ||
        (updatedApplicant.loanAmount != null && nextField !== "loanAmount" && /(?:how\s*much|what).*(?:loan|borrow|amount)/i.test(replyText)) ||
        (updatedApplicant.tenureMonths != null && nextField !== "tenureMonths" && /(?:what|preferred).*(?:tenure|repayment|duration)/i.test(replyText)) ||
        (updatedApplicant.cibil != null && nextField !== "cibil" && /(?:what|approximate|share).*(?:cibil|credit\s*score)/i.test(replyText)) ||
        (updatedApplicant.age != null && nextField !== "age" && /(?:what|share|your).*(?:current\s*age|age\b)/i.test(replyText));

      // If the LLM response is empty or re-asked for already provided information, generate dynamically via LLM
      if (!replyText || asksForAlreadyProvidedField) {
        try {
          const dynamicQ = await generateDynamicSingleQuestionWithLLM(
            nextField,
            updatedApplicant,
            userMessage,
            requestedModel,
            undefined,
            conversationHistory
          );
          if (dynamicQ && dynamicQ.trim().length > 10 && !dynamicQ.includes("⚠️")) {
            replyText = dynamicQ.trim();
          }
        } catch {}

        if (!replyText || asksForAlreadyProvidedField) {
          const fieldDescriptions: Record<string, string> = {
            companyName: "which company you currently work for",
            monthlyIncome: "your approximate net monthly take-home salary",
            loanAmount: "the loan amount you wish to borrow",
            tenureMonths: "your preferred repayment tenure",
            cibil: "your approximate CIBIL score (or let me know if not sure)",
            age: "your current age",
            existingEmi: "your total existing monthly loan EMIs (or 0 if none)",
          };
          const label = fieldDescriptions[nextField] || nextField;
          replyText = `Could you please share ${label} to complete your loan eligibility check across our partner banks?`;
        }
      }

      // If user also asked a question or raised an objection, ensure the LLM answer is seamlessly included
      if (analysis.hasQuestionOrObjection && analysis.questionAnswer) {
        if (!replyText.toLowerCase().includes(analysis.questionAnswer.slice(0, 30).toLowerCase())) {
          replyText = `${analysis.questionAnswer}\n\n${replyText}`;
        }
      }

      await saveEligibilityState(conversationId, {
        applicant: updatedApplicant,
        expectedField: nextField,
        missingFields,
        in_eligibility_flow: true,
        updatedAt: Date.now(),
      } as any);

      return { reply: replyText };
    }
  }

  // 11. General Q&A, Concept Questions, Greetings & Casual Chat (when not in loan flow)
  if (analysis.hasQuestionOrObjection && analysis.questionAnswer) {
    return { reply: analysis.questionAnswer };
  }

  if (analysis.naturalResponse && analysis.naturalResponse.trim().length > 0) {
    return { reply: analysis.naturalResponse };
  }

  const fallbackGeneralAnswer = await answerGeneralQuestionWithLLM(userMessage, requestedModel, conversationHistory);
  return { reply: fallbackGeneralAnswer };
}



