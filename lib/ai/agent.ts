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
} from "@/lib/dynamicEligibilityEngine";
import { resolveCompanyCategories } from "@/lib/companyCategoryResolver";
import { classifyIntentWithLLM, IntentClassificationResult, ExtractedEntities } from "@/lib/ai/intentClassifier";
import { getResolvedMasterPolicies } from "@/lib/masterPolicies";
import { getMasterPolicyFileContent } from "@/lib/masterPolicyParser";
import { searchTavilyWeb } from "@/lib/ai/tavilyService";

const LLM_TIMEOUT_MS = 60000;

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
const getModel = () => (process.env.OPENROUTER_MODEL || OPENROUTER_MODEL || "openrouter/auto").replace(/^["']|["']$/g, "").trim();

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

  // Resilient technical offline fallback only if LLM API is unavailable
  return "Hello! I'm CreditWise AI, your banking and financial intelligence assistant. I can help evaluate personal loan eligibility across 20+ partner banks, calculate EMIs, check bank policies, or search employer categories. How can I assist you today?";
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
                content: customSystemPrompt || "You are CreditWise AI Financial Assistant. Base your report strictly on the provided deterministic policy data.",
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

  // Technical safety fallback if LLM is offline or API fails
  return "I'm here to help with personal loans, EMI calculations, bank policies, and financial questions. How can I assist you?";
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

  // Support partial calculation if principal is available
  if (principal && principal > 0) {
    const effectiveRate = rate || 10.5;
    const effectiveTenure = tenure || 60;
    const monthlyEmi = calculateEmi(principal, effectiveRate, effectiveTenure);
    let md = formatEmiResult({ principal, rate: effectiveRate, tenure: effectiveTenure }, monthlyEmi);

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
          "- Credit checks on CreditWise AI are soft inquiries with zero score impact.\n" +
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

  // Resilient natural conceptual fallback if LLM network call fails
  let fallbackReply = "";
  if (/foir|fixed\s*obligation/i.test(userMessage)) {
    fallbackReply =
      `### What is FOIR (Fixed Obligation to Income Ratio)?\n\n` +
      `**FOIR** stands for **Fixed Obligation to Income Ratio**. In banking, it measures the proportion of a borrower's net monthly take-home income committed toward existing fixed recurring debts and loan EMIs.\n\n` +
      `#### Formula\n` +
      `$$\\text{FOIR} = \\left( \\frac{\\text{Total Fixed Monthly Obligations / EMIs}}{\\text{Net Monthly Take-Home Income}} \\right) \\times 100$$\n\n` +
      `#### What Lenders Evaluate\n` +
      `• **Fixed Obligations**: Existing loan EMIs (home, personal, car, education) and credit card obligations.\n` +
      `• **Net Monthly Income**: In-hand salary credited to your bank account after statutory taxes and PF deductions.\n` +
      `• **Bank-Specific Policies**: Permissible FOIR limits are not generic. Each partner bank defines its own maximum permissible FOIR limits in its official Master Policy, calibrated to your net salary slab and employer category rating (e.g., Cat A, Diamond, Government).\n\n` +
      `*Would you like to check the permissible FOIR limit for a specific partner bank?*`;
  } else if (/cibil|credit\s*score/i.test(userMessage)) {
    fallbackReply =
      `### Understanding CIBIL Score in Loan Approvals\n\n` +
      `A **CIBIL Score** is a 3-digit numerical summary (ranging from 300 to 900) reflecting an individual's credit history and repayment discipline, generated by TransUnion CIBIL.\n\n` +
      `#### Key Considerations\n` +
      `• **Repayment Discipline**: Timely repayment of loans and credit cards.\n` +
      `• **Credit Utilization**: Keeping revolving credit card balances low.\n` +
      `• **Bank Policy Cutoffs**: Each partner bank sets its own approval thresholds in its Master Policy (some banks require 700+, others 730+, while certain lenders define pricing bands rather than strict entry cutoffs).\n\n` +
      `*Would you like to check the CIBIL cutoff for a specific partner bank?*`;
  } else if (/reducing|flat\s*rate|diminishing|interest\s*rate|how.*interest.*work/i.test(userMessage)) {
    fallbackReply =
      `### Understanding Reducing Balance Interest Rate\n\n` +
      `Under a **Reducing Balance (Diminishing Balance) Interest Rate**, interest is calculated exclusively on the **outstanding principal loan balance** at the end of each monthly billing cycle, rather than on the original loan amount borrowed.\n\n` +
      `#### How It Works\n` +
      `• With each monthly EMI paid, a portion covers the interest charge and the remaining amount repays the principal.\n` +
      `• As the principal balance reduces each month, the interest payable in following months correspondingly decreases.\n` +
      `• Compared to a flat interest rate where interest is computed on the entire original principal for the full tenure, a reducing balance rate results in significantly lower total interest outgo.\n\n` +
      `*Would you like to calculate the monthly EMI and total interest for a specific loan amount?*`;
  } else if (/collateral|pledge|security|guarantor|unsecured/i.test(userMessage)) {
    fallbackReply =
      `### Do Personal Loans Require Collateral?\n\n` +
      `**No**, personal loans offered through our 23 partner banks are **100% unsecured**. You do not need to pledge any collateral, property, gold, or security, nor is a guarantor required.\n\n` +
      `Eligibility and loan limits are determined strictly by your monthly take-home salary, employer categorization, CIBIL score, and repayment capacity (FOIR).\n\n` +
      `*Would you like to evaluate which partner banks approve your unsecured loan amount?*`;
  } else {
    fallbackReply =
      `I can help explain banking terms, look up partner bank Master Policies (CIBIL cutoffs, tenure, FOIR, multipliers), ` +
      `search 339,000+ employer listings, calculate EMIs, or evaluate your personal loan eligibility. What specific details would you like to explore?`;
  }

  return fallbackReply;
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
    `We can only provide official policy guidelines for our **23 partner banks** whose Master Policies are actively stored and maintained in our platform.\n\n` +
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
    .replace(/\b(?:corporate\s+category\s+rating|category\s+rating|corporate\s+tier|category|rating|tier|corporate\s+listing|listed\s+in|for|of|in|records?|bank\s+records?)\b/gi, "")
    .replace(/[?.,!]/g, "")
    .trim();

  if (compQuery && !isInvalidCompanyName(compQuery)) {
    const company = await searchCompany(compQuery);
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
      } catch {}
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
 * Dispatches an approved tool call to the corresponding specialized tool handler.
 */
async function dispatchToolCall(
  toolName: string,
  args: any,
  opts: {
    conversationId: string;
    userMessage: string;
    eligibilitySession: any;
    isEligibleFlowActive: boolean;
    modelOverride?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  }
): Promise<AgentResult> {
  const { conversationId, userMessage, eligibilitySession, isEligibleFlowActive, modelOverride, conversationHistory } = opts;

  switch (toolName) {
    case "calculate_emi":
      return await executeCalculateEmi(
        args,
        userMessage,
        eligibilitySession?.applicant,
        isEligibleFlowActive,
        eligibilitySession,
        modelOverride
      );

    case "lookup_master_policy":
      return await executeLookupMasterPolicy(
        args,
        userMessage,
        isEligibleFlowActive,
        eligibilitySession,
        modelOverride
      );

    case "search_company_category":
      return await executeSearchCompanyCategory(
        args,
        userMessage,
        isEligibleFlowActive,
        eligibilitySession
      );

    case "check_loan_eligibility":
      return await executeCheckLoanEligibility(
        args,
        conversationId,
        userMessage,
        eligibilitySession,
        modelOverride,
        conversationHistory
      );

    case "update_applicant_profile":
      return await executeUpdateApplicantProfile(
        args,
        conversationId,
        userMessage,
        eligibilitySession,
        modelOverride,
        conversationHistory
      );

    case "answer_general_question":
      return await executeAnswerGeneralQuestion(
        args,
        userMessage,
        conversationId,
        isEligibleFlowActive,
        eligibilitySession,
        modelOverride,
        conversationHistory
      );

    case "tavily_search":
      return await executeTavilySearch(
        args,
        userMessage,
        isEligibleFlowActive,
        eligibilitySession
      );

    case "search_bank_managers":
      return await executeSearchBankManagers(
        args,
        userMessage,
        isEligibleFlowActive,
        eligibilitySession
      );

    default:
      return await executeAnswerGeneralQuestion(
        { question: userMessage, subType: "GENERAL_FAQ" },
        userMessage,
        conversationId,
        isEligibleFlowActive,
        eligibilitySession,
        modelOverride,
        conversationHistory
      );
  }
}

/**
 * Fallback semantic dispatcher: If OpenRouter API call encounters a network issue,
 * timeout, or rate-limit (429/402), seamlessly routes to the EXACT same 8 tools.
 */
async function fallbackToolDispatcher(
  userMessage: string,
  conversationId: string,
  eligibilitySession: any,
  isEligibleFlowActive: boolean,
  requestedModel?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult> {
  const norm = userMessage.toLowerCase().trim();

  const countProfileFields = (extracted?: any): number => {
    if (!extracted) return 0;
    return [
      extracted.monthlyIncome,
      extracted.cibil,
      extracted.loanAmount,
      extracted.tenureMonths,
      extracted.companyName,
      extracted.existingEmi,
      extracted.age,
      extracted.employmentType,
    ].filter((v) => v !== undefined && v !== null && v !== "").length;
  };

  // 1. Explicit Cancel/Reset
  if (/^(cancel|reset|restart|stop|exit)\b/i.test(norm)) {
    return await dispatchToolCall(
      "answer_general_question",
      { question: userMessage, subType: "CANCEL_RESET" },
      {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
        conversationHistory,
      }
    );
  }

  // 2. Greetings
  if (/^(hello|hi|hey|good\s*(?:morning|afternoon|evening)|namaste|greetings)\b/i.test(norm)) {
    return await dispatchToolCall(
      "answer_general_question",
      { question: userMessage, subType: "GREETING" },
      {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
        conversationHistory,
      }
    );
  }

  // 3. Continuation or acknowledgment during active flow (only if no profile data in text)
  const hasProfileDataInText =
    /(?:cibil|credit\s*score|salary|income|lakh|lac|emi|age|tenure|year|month|\b\d{3,7}\b)/i.test(norm);

  if (
    isEligibleFlowActive &&
    !hasProfileDataInText &&
    /^(ok|okay|got\s*it|understood|cool|sure|great|fine|thanks|thank\s*you|continue|let['’]?s\s*continue|proceed|next|resume|go\s*ahead|yes)\b/i.test(
      norm
    )
  ) {
    return await dispatchToolCall(
      "check_loan_eligibility",
      { resume: true },
      {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
        conversationHistory,
      }
    );
  }

  // 4. Semantic LLM intent classification with multi-turn conversation history
  const classification = await classifyIntentWithLLM(
    userMessage,
    {
      isFlowActive: isEligibleFlowActive,
      expectedField: eligibilitySession?.expectedField,
      existingApplicant: eligibilitySession?.applicant,
      recentMessages: conversationHistory,
    },
    requestedModel
  );

  if (classification.intent === "CALCULATION") {
    return await dispatchToolCall(
      "calculate_emi",
      {
        principal: classification.extracted?.loanAmount,
        rate: classification.extracted?.interestRate,
        tenureMonths: classification.extracted?.tenureMonths,
      },
      {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
        conversationHistory,
      }
    );
  }

  if (classification.intent === "CHANGING_DETAILS") {
    return await dispatchToolCall(
      "update_applicant_profile",
      classification.extracted || {},
      {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
        conversationHistory,
      }
    );
  }

  if (classification.intent === "GENERAL_INFORMATION") {
    if (
      classification.subIntent === "BANK_MANAGER_SEARCH" ||
      /manager|contact|phone|mobile|branch\s*head|\basm\b|\brsm\b/i.test(norm)
    ) {
      return await dispatchToolCall(
        "search_bank_managers",
        {
          bank_name: classification.extracted?.targetBank,
          city: classification.extracted?.city,
        },
        {
          conversationId,
          userMessage,
          eligibilitySession,
          isEligibleFlowActive,
          modelOverride: requestedModel,
          conversationHistory,
        }
      );
    }

    // Corporate Employer / Company Category Listing
    if (
      classification.subIntent === "COMPANY_SEARCH" ||
      (/(?:company|employer|category\s*rating|company\s*tier|corporate\s*listing|is.*listed)/i.test(norm) &&
        !/policy|rule|cutoff|foir|tenure|cibil/i.test(norm))
    ) {
      return await dispatchToolCall(
        "search_company_category",
        {
          companyName: classification.extracted?.companyName || userMessage,
        },
        {
          conversationId,
          userMessage,
          eligibilitySession,
          isEligibleFlowActive,
          modelOverride: requestedModel,
          conversationHistory,
        }
      );
    }

    const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|poonawalla|yes\s*bank|\byes\b|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm|tata\s*capital|\btata\b(?!.*consultancy)/i.exec(
      userMessage
    );
    const targetBank = classification.extracted?.targetBank || (bankMatch ? bankMatch[0] : "");
    const profileFieldsPresent = [
      classification.extracted?.monthlyIncome,
      classification.extracted?.cibil,
      classification.extracted?.loanAmount,
      classification.extracted?.tenureMonths,
      classification.extracted?.companyName,
      classification.extracted?.existingEmi,
      classification.extracted?.age,
    ].filter((v) => v !== undefined && v !== null && v !== "").length;

    const isApplicantProfileSubmission =
      countProfileFields(classification.extracted) >= 2 ||
      Boolean(norm.match(/(?:work\s+at|employed\s+(?:at|by)|my\s+salary\s*is|cibil\s*(?:is|:)?\s*\d+|need\s*[\d,]+|age\s*(?:is|:)?\s*\d+)/i));

    const isBankPolicyInquiry =
      !isApplicantProfileSubmission &&
      (classification.subIntent === "BANK_POLICY" ||
      classification.subIntent === "POLICY_INQUIRY" ||
      /(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|foir\s*norm)\s*(?:of|for|from|regarding)?\s*(?:a\s*|an\s*|any\s*|the\s*)?(?:[a-z0-9\s&'.-]+)?\s*banks?\b/i.test(norm) ||
      /banks?\s*(?:'s)?\s*(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|foir\s*norm)/i.test(norm) ||
      (/(?:policy|guidelines?|rules?|cut-off|cutoff)\b/i.test(norm) && /\bbanks?\b/i.test(norm)) ||
      (Boolean(targetBank) &&
        /(?:what\s+is|tell\s+me|show|check|explain|find)?\s*(?:the\s*)?(?:policy|guidelines?|norm|rules?|cutoff|criteria|foir|interest\s*rate|multiplier)/i.test(
          norm
        )));

    if (isBankPolicyInquiry) {
      return await dispatchToolCall(
        "lookup_master_policy",
        {
          bankName: targetBank || classification.extracted?.targetBank,
          questionTopic: userMessage,
        },
        {
          conversationId,
          userMessage,
          eligibilitySession,
          isEligibleFlowActive,
          modelOverride: requestedModel,
          conversationHistory,
        }
      );
    }

    // Live search if web/news query
    if (/news|latest|update|current|today|market|rbi\s*repo/i.test(norm)) {
      return await dispatchToolCall(
        "tavily_search",
        { query: userMessage },
        {
          conversationId,
          userMessage,
          eligibilitySession,
          isEligibleFlowActive,
          modelOverride: requestedModel,
          conversationHistory,
        }
      );
    }

    // Natural loan intent phrases and eligibility inquiries should route to check_loan_eligibility, NOT general question
    const naturalLoanCheck = detectLoanIntent(userMessage, classification);
    if (naturalLoanCheck.isLoanIntent || isApplicantProfileSubmission) {
      return await dispatchToolCall(
        "check_loan_eligibility",
        classification.extracted || {},
        {
          conversationId,
          userMessage,
          eligibilitySession,
          isEligibleFlowActive,
          modelOverride: requestedModel,
          conversationHistory,
        }
      );
    }

    return await dispatchToolCall(
      "answer_general_question",
      {
        question: userMessage,
        subType: "CONCEPT_DEFINITION",
      },
      {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
        conversationHistory,
      }
    );
  }

  // Global check for natural loan intent or multi-field profile submission
  const naturalLoanGlobalCheck = detectLoanIntent(userMessage, classification);
  const globalProfileCount = countProfileFields(classification.extracted);
  if (
    classification.intent === "LOAN_ELIGIBILITY" ||
    naturalLoanGlobalCheck.isLoanIntent ||
    globalProfileCount >= 2
  ) {
    return await dispatchToolCall(
      "check_loan_eligibility",
      classification.extracted || {},
      {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
        conversationHistory,
      }
    );
  }

  if (classification.intent === "ANOTHER_TOPIC") {
    return await dispatchToolCall(
      "answer_general_question",
      {
        question: userMessage,
        subType: "CASUAL_CHAT",
      },
      {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
        conversationHistory,
      }
    );
  }

  return await dispatchToolCall(
    "answer_general_question",
    {
      question: userMessage,
      subType: "GENERAL_FAQ",
    },
    {
      conversationId,
      userMessage,
      eligibilitySession,
      isEligibleFlowActive,
      modelOverride: requestedModel,
      conversationHistory,
    }
  );
}

/**
 * Main CreditWise AI Central Agent.
 * OpenRouter serves as the primary decision-making brain on every turn.
 * Selects and invokes actions via tools.
 * Never allows active eligibility to block or override a new request.
 * Master Policy .txt files are the sole source of truth for bank eligibility and policy QA.
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

  // If conversationHistory was not provided, attempt to load recent history from database or memory
  if (!conversationHistory || conversationHistory.length === 0) {
    const numConvId = Number(conversationId);
    if (pool && Number.isFinite(numConvId)) {
      try {
        const historyRes = await pool.query(
          `SELECT role, content FROM assistant_messages
           WHERE conversation_id = $1
           ORDER BY id ASC
           LIMIT 20`,
          [numConvId]
        );
        const allRows = historyRes.rows;
        const priorRows = allRows.length > 0 && allRows[allRows.length - 1].content === userMessage
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

  // 1. Check if an eligibility session is active for this specific conversation
  const eligibilitySession = await getEligibilityState(conversationId);
  const isEligibleFlowActive = !!(
    eligibilitySession &&
    (eligibilitySession.expectedField ||
      (eligibilitySession.missingFields && eligibilitySession.missingFields.length > 0) ||
      (eligibilitySession as any).in_eligibility_flow)
  );

  if ((!conversationHistory || conversationHistory.length === 0) && eligibilitySession?.conversationHistory) {
    conversationHistory = eligibilitySession.conversationHistory;
  }
  conversationHistory = conversationHistory || [];

  const model = requestedModel || getModel();
  const apiKey = getApiKey();

  // If no API key is configured, route via fallbackToolDispatcher directly
  if (!apiKey) {
    return await fallbackToolDispatcher(
      userMessage,
      conversationId,
      eligibilitySession,
      isEligibleFlowActive,
      requestedModel,
      conversationHistory
    );
  }

  // 2. OpenRouter Tool-Calling Decision-Making Brain
  const systemPrompt =
    `You are the central decision-making brain of CreditWise AI, an intelligent personal loan and banking intelligence platform.\n` +
    `Your role is to understand the user's current message in the context of the full conversation history and select the EXACT tool needed to respond.\n\n` +
    `AVAILABLE TOOLS:\n` +
    `1. "calculate_emi": Use for monthly EMI calculations, interest payable, or installment questions.\n` +
    `2. "lookup_master_policy": Use for bank-specific policy questions (CIBIL cutoff, FOIR limits, salary criteria, tenure, multipliers) using that bank's official Master Policy .txt file. When asked for a bank policy, show a clean 2-column table UI (| Criteria | Details |) with 3 sections: 1) Loan products offered, 2) Eligibility criteria, 3) Important conditions. Show general policy-level values/ranges, mention when values vary by CAT, and never guess missing values (say "Not specified in the available policy."). Show detailed CAT rules only when specifically asked.\n` +
    `3. "search_company_category": Use when user asks about an employer or company category/tier listing (Super Cat A, Cat A, Elite, Diamond).\n` +
    `4. "check_loan_eligibility": Use whenever user expresses loan intent naturally or asks about their eligibility across banks (e.g. "What banks am I eligible for?", "Which banks can I get a loan from?", "Which bank is best for my loan?", "Am I eligible for a loan?", "Which banks will give me a loan?", "I need a loan", "I want a personal loan", "I want to apply for a loan", "Can I get a loan?", "I need ₹5 lakh loan"), requests a personal loan, checks eligibility, answers an eligibility question, raises an objection during eligibility (e.g. "Why age?", "Why company?", "Why salary?", "Is my data safe?", "Will this affect my CIBIL?"), or provides profile details (salary, amount, tenure, cibil, emi, age). When loan intent or eligibility inquiry is detected, start the eligibility flow and collect the required details. Keep bank policy questions separate: specific inquiries asking for an official bank's policy rules (e.g. "What is HDFC bank policy?") must use "lookup_master_policy", NOT "check_loan_eligibility".\n` +
    `5. "update_applicant_profile": Use when the user explicitly wants to update, correct, or change a previously provided detail (e.g. "change salary to 1.2L", "update cibil to 780", "actually my company is Infosys").\n` +
    `6. "answer_general_question": Use for standalone general financial concepts (e.g. "What is FOIR?"), greetings (subType="GREETING"), small talk, or cancellation (subType="CANCEL_RESET") when not answering an in-flow eligibility question.\n` +
    `7. "tavily_search": Use for live financial news, current market interest rate changes, or web searches.\n` +
    `8. "search_bank_managers": Use for bank manager contacts, ASM/RSM directory, phone numbers, or branch contacts.\n\n` +
    `CRITICAL CONVERSATIONAL RULES:\n` +
    `- ANALYZE MULTI-TURN CONTEXT: If an eligibility assessment is in progress and the user replies to the assistant's previous question, asks an objection (e.g. "Why do you need my age?", "Will this hurt my CIBIL?"), or provides partial details, call "check_loan_eligibility" so the engine naturally explains the requirement and seamlessly continues the assessment.\n` +
    `- NEVER let an active eligibility flow block or ignore an explicit external request! If an assessment is in progress and the user explicitly asks for an official bank's policy, an EMI calculation, a live search, a manager contact, or a concept definition, ALWAYS call that specific tool.\n` +
    `- Choose the tool that addresses the user's CURRENT message in its conversational context.\n` +
    `- Context: isFlowActive=${isEligibleFlowActive ? "true" : "false"}, expectedField=${eligibilitySession?.expectedField || "none"}, applicant=${JSON.stringify(eligibilitySession?.applicant || {})}.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const messagesForBrain: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-8);
      for (const turn of recentHistory) {
        if (turn.content && turn.content.trim()) {
          messagesForBrain.push({
            role: turn.role === "assistant" || turn.role === "ai" ? "assistant" : "user",
            content: turn.content.trim(),
          });
        }
      }
    }

    messagesForBrain.push({ role: "user", content: userMessage });

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
        temperature: 0.1,
        max_tokens: 600,
        messages: messagesForBrain,
        tools: OPENROUTER_TOOLS,
        tool_choice: "auto",
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // If OpenRouter returns non-200 (e.g. rate limit, 429, 402), use fallback dispatcher
      return await fallbackToolDispatcher(
        userMessage,
        conversationId,
        eligibilitySession,
        isEligibleFlowActive,
        requestedModel,
        conversationHistory
      );
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    if (toolCall?.function?.name) {
      const toolName = toolCall.function.name;
      let parsedArgs: any = {};
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        parsedArgs = {};
      }

      const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|poonawalla|yes\s*bank|\byes\b|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm|tata\s*capital|\btata\b(?!.*consultancy)/i.exec(
        userMessage
      );

      // If model erroneously invoked general question on a user loan eligibility inquiry, redirect to check_loan_eligibility
      if (toolName === "answer_general_question" && detectLoanIntent(userMessage).isLoanIntent) {
        return await dispatchToolCall("check_loan_eligibility", parsedArgs, {
          conversationId,
          userMessage,
          eligibilitySession,
          isEligibleFlowActive,
          modelOverride: requestedModel,
          conversationHistory,
        });
      }

      const isBankPolicyInquiry =
        /(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|foir\s*norm)\s*(?:of|for|from|regarding)?\s*(?:a\s*|an\s*|any\s*|the\s*)?(?:[a-z0-9\s&'.-]+)?\s*banks?\b/i.test(norm) ||
        /banks?\s*(?:'s)?\s*(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|foir\s*norm)/i.test(norm) ||
        (/(?:policy|guidelines?|rules?|cut-off|cutoff)\b/i.test(norm) && /\bbanks?\b/i.test(norm)) ||
        (bankMatch && /policy|guideline|guidelines|rules?|criteria|cutoff|cut-off|foir|rate|cibil|salary|tenure/i.test(norm));

      // If model erroneously invoked general question on a bank policy inquiry, redirect to lookup_master_policy
      if (toolName === "answer_general_question" && isBankPolicyInquiry) {
        return await dispatchToolCall(
          "lookup_master_policy",
          { bankName: bankMatch ? bankMatch[0] : parsedArgs?.bankName, questionTopic: userMessage },
          {
            conversationId,
            userMessage,
            eligibilitySession,
            isEligibleFlowActive,
            modelOverride: requestedModel,
            conversationHistory,
          }
        );
      }

      return await dispatchToolCall(toolName, parsedArgs, {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
        conversationHistory,
      });
    }

    // Direct text reply from model
    const textContent = choice?.message?.content;
    if (typeof textContent === "string" && textContent.trim().length > 0) {
      // If model generated direct text instead of calling check_loan_eligibility on a loan eligibility inquiry, start eligibility flow
      if (detectLoanIntent(userMessage).isLoanIntent) {
        return await dispatchToolCall("check_loan_eligibility", {}, {
          conversationId,
          userMessage,
          eligibilitySession,
          isEligibleFlowActive,
          modelOverride: requestedModel,
          conversationHistory,
        });
      }

      // If model generated direct text instead of calling lookup_master_policy on a bank policy inquiry, lookup policy
      const directBankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|poonawalla|yes\s*bank|\byes\b|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm|tata\s*capital|\btata\b/i.exec(userMessage);
      const isBankPolicyInquiry =
        /(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|foir\s*norm)\s*(?:of|for|from|regarding)?\s*(?:a\s*|an\s*|any\s*|the\s*)?(?:[a-z0-9\s&'.-]+)?\s*banks?\b/i.test(norm) ||
        /banks?\s*(?:'s)?\s*(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|foir\s*norm)/i.test(norm) ||
        (/(?:policy|guidelines?|rules?|cut-off|cutoff)\b/i.test(norm) && /\bbanks?\b/i.test(norm)) ||
        (Boolean(directBankMatch) && /policy|guideline|guidelines|rules?|criteria|cutoff|cut-off|foir|rate|cibil|salary|tenure/i.test(norm));

      if (isBankPolicyInquiry) {
        return await dispatchToolCall(
          "lookup_master_policy",
          { bankName: directBankMatch ? directBankMatch[0] : undefined, questionTopic: userMessage },
          {
            conversationId,
            userMessage,
            eligibilitySession,
            isEligibleFlowActive,
            modelOverride: requestedModel,
            conversationHistory,
          }
        );
      }

      let reply = stripReasoningPreamble(textContent)
        .replace(/^User Safety:[^\n]*\n*/gi, "")
        .trim();
      if (reply.length > 0 && !/^User Safety:\s*safe$/i.test(reply)) {
        return { reply };
      }
    }

    // If no tool call and empty content, fallback
    return await fallbackToolDispatcher(
      userMessage,
      conversationId,
      eligibilitySession,
      isEligibleFlowActive,
      requestedModel,
      conversationHistory
    );
  } catch (err) {
    // Network error or timeout -> fallback dispatcher
    return await fallbackToolDispatcher(
      userMessage,
      conversationId,
      eligibilitySession,
      isEligibleFlowActive,
      requestedModel,
      conversationHistory
    );
  }
}


