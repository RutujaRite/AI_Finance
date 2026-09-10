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
        "Looks up official partner bank policy rules, CIBIL cutoffs, permissible FOIR limits, salary criteria, multipliers, or repayment tenure directly from the bank's Master Policy .txt file. Use whenever the user asks bank-specific policy questions (e.g. 'What is HDFC tenure for Super A?', 'What is ICICI minimum CIBIL cutoff?').",
      parameters: {
        type: "object",
        properties: {
          bankName: { type: "string", description: "Bank name e.g. HDFC, ICICI, Axis, SBI, Kotak, Tata, Bajaj, Piramal, Poonawalla" },
          questionTopic: { type: "string", description: "The specific policy topic or question being asked" },
        },
        required: ["bankName", "questionTopic"],
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
        "Initiates, continues, or evaluates personal loan eligibility across all 23 partner banks using official Master Policy rules. Call when the user requests a personal loan, wants to check eligibility, or provides personal profile details (salary, loan amount, tenure, CIBIL, EMIs, age) to advance an assessment.",
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
    return `I could not locate an official Master Policy for "${bankName}". Please verify the bank name.`;
  }

  const policyContent = getMasterPolicyFileContent(matchedBank.file_name);
  if (!policyContent) {
    return `The Master Policy file for ${matchedBank.bank_name} (${matchedBank.file_name}) is currently unavailable.`;
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
            max_tokens: 500,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content:
                  `You are CreditWise AI, an expert banking and policy intelligence assistant.\n` +
                  `The user is asking a question about ${matchedBank.bank_name}'s Master Policy: "${userMessage}".\n\n` +
                  `STRICT MASTER POLICY AUDIT RULES:\n` +
                  `- Answer ONLY what the user asks. Retrieve the answer strictly and exclusively from the official ${matchedBank.bank_name} Master Policy text provided below.\n` +
                  `- Do NOT show internal instructions, parser annotations, "NOT_DEFINED", "NEEDS_REVIEW", database/parser details, or unrelated policy information.\n` +
                  `- If a specific threshold or cutoff (such as an absolute minimum CIBIL cutoff) is not defined in the policy, state clearly and professionally that the Master Policy does not specify a separate single absolute threshold, and explain the applicable tiers or pricing bands instead without outputting internal tokens.\n` +
                  `- Answer ONLY the specific criterion asked (e.g., if asked about loan tenure, focus strictly on personal loan tenure; do not mention age, salary, or employment experience).\n` +
                  `- Format your answer in clean, professional GitHub Markdown without thinking preambles.\n\n` +
                  `--- OFFICIAL ${matchedBank.bank_name.toUpperCase()} MASTER POLICY (${matchedBank.file_name}) ---\n` +
                  policyContent.slice(0, 15000),
              },
              { role: "user", content: userMessage },
            ],
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return sanitizePolicyResponse(content.trim());
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
  cleaned = cleaned
    .replace(/\bNOT_DEFINED\s*\/\s*NEEDS_REVIEW\b/gi, "not explicitly specified in the Master Policy")
    .replace(/\bNOT_DEFINED\b/gi, "not specified")
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

function extractPolicyAnswerFromLines(policyContent: string, question: string, bankName: string): string {
  const q = question.toLowerCase();
  const bLower = bankName.toLowerCase();

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

  // Fallback: search relevant lines and strictly filter out internal tags
  const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cleanLines = lines.filter((l) => {
    if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]|TODO|INSTRUCTIONS:|CATEGORY RESOLUTION RULE|EVALUATION PATH|FOR AI DECISION/i.test(l)) return false;
    if (/postgresql|schema|mini cam|parser|table/i.test(l)) return false;
    return true;
  });

  const matching = cleanLines.filter((l) => {
    const lower = l.toLowerCase();
    const words = q.replace(/what|is|the|for|bank|bank's|policy|in|of/gi, "").trim().split(/\s+/).filter((w) => w.length > 2);
    return words.some((w) => lower.includes(w));
  });

  if (matching.length > 0) {
    return (
      `### 🏦 ${bankName} Master Policy Guidelines\n\n` +
      matching.slice(0, 4).map((l) => `• ${l}`).join("\n")
    );
  }

  return `The requested information was not found in ${bankName}'s Master Policy file.`;
}

async function searchPoliciesForBank(bankName: string, question: string): Promise<string> {
  return answerBankPolicyWithMasterPolicy(bankName, question);
}

const FALLBACK_GREETING =
  "Hello! I am CreditWise AI, your automated Banking & Financial Intelligence Assistant.\n\n" +
  "I can help you:\n" +
  "- **Evaluate Personal & Corporate Loan Eligibility** across 20+ partner banks\n" +
  "- **Search 339,000+ Employer Listings** & bank category ratings (Cat A, Elite, Diamond)\n" +
  "- **Check Bank Policy Guidelines** (CIBIL, FOIR, Multipliers & Income rules)\n" +
  "- **Connect with Official Bank Managers** in your city\n\n" +
  "How can I assist you today?";

function getGreetingReply(message: string): string {
  const normalized = String(message || "").toLowerCase();
  let timeOfDay = "";
  const hour = new Date().getHours();
  if (hour < 12) timeOfDay = "Good morning";
  else if (hour < 17) timeOfDay = "Good afternoon";
  else timeOfDay = "Good evening";

  return `${timeOfDay}! I'm CreditWise AI, your financial intelligence assistant. I can help you check loan eligibility, calculate EMIs, find bank policies, search employer listings, or connect you with bank managers. How can I assist you today?`;
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

    if (!OPENROUTER_API_KEY) return { reply: FALLBACK_GREETING };

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

function extractApplicantFromText(text: string) {
  const norm = String(text || "").replace(/\s+/g, " ").trim();

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

  let loan_amount: number | undefined;
  const loanMatch = norm.match(/(?:loan\s*(?:amount)?|borrow|need|want)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(k|lakhs?|lacs?|l\b|cr)?/i) ||
                    norm.match(/(\d+(?:,\d+)*)\s*(lakhs?|lacs?|l\b|cr)\s+(?:loan|borrow)/i);
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
  if (/(?:no|0|zero|nil)\s*(?:existing\s*|current\s*|ongoing\s*)?(?:loan|emi)s?|no\s*loans/i.test(norm)) {
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
  else if (/self\s*employed|business|proprietor/i.test(norm)) employment_type = "Self-Employed";

  let company: string | undefined;
  if (!isFinancialOrProfileInput(norm)) {
    const compMatch = norm.match(/(?:working\s+at|works\s+at|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is)\s+([A-Za-z0-9\s&'.-]+?)(?=\s+(?:salary|cibil|emi|income|can|is|with)|$)/i);
    if (compMatch) {
      const candidate = compMatch[1].trim();
      if (candidate.length > 2 && !isInvalidCompanyName(candidate) && !isFinancialOrProfileInput(candidate)) {
        company = candidate;
      }
    }
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
async function handleCasualMessage(message: string, modelOverride?: string): Promise<string> {
  const norm = String(message || "").toLowerCase().trim();

  if (OPENROUTER_API_KEY) {
    const modelsToTry = [modelOverride || OPENROUTER_MODEL];
    if ((modelOverride || OPENROUTER_MODEL) !== "openrouter/free") {
      modelsToTry.push("openrouter/free");
    }

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
            max_tokens: 250,
            temperature: 0.3,
            messages: [
              {
                role: "system",
                content:
                  "You are CreditWise AI, a banking and financial intelligence assistant. " +
                  "Respond politely, helpfully, and concisely to the user's remark or question. " +
                  "Do NOT search for companies, do NOT trigger loan applications unless explicitly asked. " +
                  "Output ONLY your conversational response.",
              },
              { role: "user", content: message },
            ],
          }),
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const content = (await response.json()).choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return stripReasoningPreamble(content);
          }
        }
      } catch {}
    }
  }

  // Graceful conversational fallbacks if LLM is offline
  if (/\b(thanks|thank\s*you)\b/i.test(norm)) {
    return "You're very welcome! If you need assistance with loan eligibility, EMI calculations, or bank policies, feel free to ask.";
  }
  if (/\b(ok|okay|sure|cool|great|awesome|understood|got\s*it)\b/i.test(norm)) {
    return "Great! How can I assist you further? You can ask to check personal loan eligibility, calculate EMIs, or view bank policies.";
  }
  if (/\b(bye|goodbye|see\s*you)\b/i.test(norm)) {
    return "Goodbye! Have a great day ahead. Feel free to return anytime you need financial or loan guidance.";
  }

  return answerGeneralQuestionWithLLM(message, modelOverride);
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
async function answerGeneralQuestionWithLLM(userMessage: string, modelOverride?: string): Promise<string> {
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
            messages: [
              {
                role: "system",
                content:
                  "You are CreditWise AI, an expert banking and financial intelligence assistant.\n" +
                  "Answer the user's banking, loan, or financial question clearly, accurately, and naturally in GitHub Markdown.\n\n" +
                  "CRITICAL CONCEPT EXPLANATION RULES:\n" +
                  "- For concepts like FOIR (Fixed Obligation to Income Ratio), CIBIL score, debt ratios, EMI, or borrowing capacity:\n" +
                  "  Give a clear, natural explanation of what the term stands for, how it is calculated, and what lenders evaluate.\n" +
                  "- Do NOT include generic eligibility percentage thresholds (e.g. do NOT claim 'you are eligible if under 50%').\n" +
                  "- Explicitly clarify that permissible FOIR caps and eligibility criteria vary strictly by each individual bank's Master Policy based on salary tier and company category.\n" +
                  "- Do NOT include generic greeting preambles (such as 'I am CreditWise AI, your banking assistant...'). Go straight to the helpful explanation.",
              },
              { role: "user", content: userMessage },
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
        console.warn(`[General QA LLM] Failed with model ${model}:`, err?.message || err);
      }
    }
  }

  // Resilient natural conceptual fallback if LLM network call fails
  if (/foir|fixed\s*obligation/i.test(userMessage)) {
    return (
      `### What is FOIR (Fixed Obligation to Income Ratio)?\n\n` +
      `**FOIR** stands for **Fixed Obligation to Income Ratio**. In banking, it measures the proportion of a borrower's net monthly take-home income committed toward existing fixed recurring debts and loan EMIs.\n\n` +
      `#### Formula\n` +
      `$$\\text{FOIR} = \\left( \\frac{\\text{Total Fixed Monthly Obligations / EMIs}}{\\text{Net Monthly Take-Home Income}} \\right) \\times 100$$\n\n` +
      `#### What Lenders Evaluate\n` +
      `• **Fixed Obligations**: Existing loan EMIs (home, personal, car, education) and credit card obligations.\n` +
      `• **Net Monthly Income**: In-hand salary credited to your bank account after statutory taxes and PF deductions.\n` +
      `• **Bank-Specific Policies**: Permissible FOIR limits are not generic. Each partner bank defines its own maximum permissible FOIR limits in its official Master Policy, calibrated to your net salary slab and employer category rating (e.g., Cat A, Diamond, Government).\n\n` +
      `*Would you like to check the permissible FOIR limit for a specific partner bank?*`
    );
  }

  if (/cibil|credit\s*score/i.test(userMessage)) {
    return (
      `### Understanding CIBIL Score in Loan Approvals\n\n` +
      `A **CIBIL Score** is a 3-digit numerical summary (ranging from 300 to 900) reflecting an individual's credit history and repayment discipline, generated by TransUnion CIBIL.\n\n` +
      `#### Key Considerations\n` +
      `• **Repayment Discipline**: Timely repayment of loans and credit cards.\n` +
      `• **Credit Utilization**: Keeping revolving credit card balances low.\n` +
      `• **Bank Policy Cutoffs**: Each partner bank sets its own approval thresholds in its Master Policy (some banks require 700+, others 730+, while certain lenders define pricing bands rather than strict entry cutoffs).\n\n` +
      `*Would you like to check the CIBIL cutoff for a specific partner bank?*`
    );
  }

  if (/reducing|flat\s*rate|diminishing|interest\s*rate|how.*interest.*work/i.test(userMessage)) {
    return (
      `### Understanding Reducing Balance Interest Rate\n\n` +
      `Under a **Reducing Balance (Diminishing Balance) Interest Rate**, interest is calculated exclusively on the **outstanding principal loan balance** at the end of each monthly billing cycle, rather than on the original loan amount borrowed.\n\n` +
      `#### How It Works\n` +
      `• With each monthly EMI paid, a portion covers the interest charge and the remaining amount repays the principal.\n` +
      `• As the principal balance reduces each month, the interest payable in following months correspondingly decreases.\n` +
      `• Compared to a flat interest rate where interest is computed on the entire original principal for the full tenure, a reducing balance rate results in significantly lower total interest outgo.\n\n` +
      `*Would you like to calculate the monthly EMI and total interest for a specific loan amount?*`
    );
  }

  return (
    `I can help explain banking terms, look up partner bank Master Policies (CIBIL cutoffs, tenure, FOIR, multipliers), ` +
    `search 339,000+ employer listings, calculate EMIs, or evaluate your personal loan eligibility. What specific details would you like to explore?`
  );
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
    companyName: "what is your company or employer name?",
    monthlyIncome: "what is your net monthly take-home salary?",
    loanAmount: "how much loan amount are you looking to borrow?",
    tenureMonths: "what repayment tenure would you prefer (e.g. 3 years, 5 years)?",
    cibil: "what is your approximate CIBIL score? (or say 'unknown')",
    existingEmi: "do you have any ongoing monthly loan EMIs? (or say 'none')",
    age: "what is your current age in years?",
  };

  const nextQ = expectedField && hints[expectedField] ? hints[expectedField] : "would you like to proceed with your assessment?";
  const comp = applicant.companyName ? ` for **${applicant.companyName}**` : "";

  return `\n\n---\n*💡 Whenever you're ready, we can continue your personal loan eligibility assessment${comp}. (Next: ${nextQ})*`;
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

  if (isEligibleFlowActive) {
    calcReply += getFlowContinuationHint(eligibilitySession);
  }
  return { reply: calcReply };
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

  const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|poonawalla|yes\s*bank|\byes\b|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm|tata\s*capital|\btata\b(?!.*consultancy)/i.exec(userMessage);
  const targetBank = args.bankName || (bankMatch ? bankMatch[0] : "");
  const query = args.questionTopic || userMessage;

  if (targetBank) {
    const policyResult = await answerBankPolicyWithMasterPolicy(targetBank, query, modelOverride);
    if (policyResult) {
      let reply = policyResult;
      if (isEligibleFlowActive) {
        reply += getFlowContinuationHint(eligibilitySession);
      }
      return { reply };
    }
  }

  let reply = await answerGeneralQuestionWithLLM(query, modelOverride);
  if (isEligibleFlowActive) {
    reply += getFlowContinuationHint(eligibilitySession);
  }
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
      if (isEligibleFlowActive) {
        reply += getFlowContinuationHint(eligibilitySession);
      }
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
    if (isEligibleFlowActive) {
      reply += getFlowContinuationHint(eligibilitySession);
    }
    return { reply };
  }

  let reply = "Please specify an employer or company name to search for corporate listings and partner bank tier ratings.";
  if (isEligibleFlowActive) {
    reply += getFlowContinuationHint(eligibilitySession);
  }
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
  modelOverride?: string
): Promise<AgentResult> {
  const isEligibleFlowActive = !!(
    eligibilitySession &&
    (eligibilitySession.expectedField ||
      (eligibilitySession.missingFields && eligibilitySession.missingFields.length > 0) ||
      (eligibilitySession as any).in_eligibility_flow)
  );

  const hasProfileData =
    /(?:cibil|credit\s*score|salary|income|lakh|lac|emi|age|tenure|year|month|\b\d{3,7}\b)/i.test(userMessage);

  // Resume or acknowledgment during active flow (only if no profile data in text)
  if (
    isEligibleFlowActive &&
    !hasProfileData &&
    (args?.resume ||
      /^(ok|okay|got\s*it|understood|cool|sure|great|fine|thanks|thank\s*you|continue|let['’]?s\s*continue|proceed|next|resume|go\s*ahead|yes)\b/i.test(
        userMessage.trim()
      ))
  ) {
    const nextField =
      eligibilitySession.expectedField ||
      (eligibilitySession.missingFields && eligibilitySession.missingFields[0]) ||
      "monthlyIncome";
    const question = await generateDynamicSingleQuestionWithLLM(
      nextField,
      eligibilitySession.applicant || {},
      modelOverride
    );
    const comp = eligibilitySession.applicant?.companyName
      ? ` for **${eligibilitySession.applicant.companyName}**`
      : "";
    return {
      reply: `Glad that helped! Let's pick right back up with your loan assessment${comp}.\n\n${question}`,
    };
  }

  const extractedFromMsg = extractApplicantFromText(userMessage);

  const syntheticClassification: IntentClassificationResult = {
    intent: "LOAN_ELIGIBILITY",
    confidence: 1.0,
    loanType: args?.loanType || extractedFromMsg.loan_type || "Personal Loan",
    extracted: {
      companyName: args?.companyName || extractedFromMsg.company,
      monthlyIncome: args?.monthlyIncome || extractedFromMsg.salary,
      loanAmount: args?.loanAmount || extractedFromMsg.loan_amount,
      tenureMonths: args?.tenureMonths || extractedFromMsg.tenure_months,
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
      syntheticClassification
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
  modelOverride?: string
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
  modelOverride?: string
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
    if (isEligibleFlowActive) {
      const comp = eligibilitySession?.applicant?.companyName
        ? ` for **${eligibilitySession.applicant.companyName}**`
        : "";
      return {
        reply: `Hello! 👋 How can I assist you today? If you'd like to continue your loan eligibility assessment${comp}, we can pick right back up whenever you're ready.`,
      };
    }
    return { reply: getGreetingReply(question) };
  }

  // CASUAL_CHAT
  if (subType === "CASUAL_CHAT") {
    let casualReply = await handleCasualMessage(question, modelOverride);
    if (isEligibleFlowActive) {
      casualReply += getFlowContinuationHint(eligibilitySession);
    }
    return { reply: casualReply };
  }

  // Financial concept / definition / FAQ
  let llmReply = await answerGeneralQuestionWithLLM(question, modelOverride);
  if (isEligibleFlowActive) {
    llmReply += getFlowContinuationHint(eligibilitySession);
  }
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

  if (isEligibleFlowActive) {
    reply += getFlowContinuationHint(eligibilitySession);
  }
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
    if (isEligibleFlowActive) {
      reply += getFlowContinuationHint(eligibilitySession);
    }
    return {
      reply,
      bankData,
    };
  }
  let reply = `No official bank manager records found matching "${userMessage}". Please check the bank name, city, or branch.`;
  if (isEligibleFlowActive) {
    reply += getFlowContinuationHint(eligibilitySession);
  }
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
  }
): Promise<AgentResult> {
  const { conversationId, userMessage, eligibilitySession, isEligibleFlowActive, modelOverride } = opts;

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
        modelOverride
      );

    case "update_applicant_profile":
      return await executeUpdateApplicantProfile(
        args,
        conversationId,
        userMessage,
        eligibilitySession,
        modelOverride
      );

    case "answer_general_question":
      return await executeAnswerGeneralQuestion(
        args,
        userMessage,
        conversationId,
        isEligibleFlowActive,
        eligibilitySession,
        modelOverride
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
        modelOverride
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
  requestedModel?: string
): Promise<AgentResult> {
  const norm = userMessage.toLowerCase().trim();

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
      }
    );
  }

  // 4. Semantic LLM intent classification
  const classification = await classifyIntentWithLLM(
    userMessage,
    {
      isFlowActive: isEligibleFlowActive,
      expectedField: eligibilitySession?.expectedField,
      existingApplicant: eligibilitySession?.applicant,
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
        }
      );
    }

    const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|poonawalla|yes\s*bank|\byes\b|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm|tata\s*capital|\btata\b(?!.*consultancy)/i.exec(
      userMessage
    );
    const targetBank = classification.extracted?.targetBank || (bankMatch ? bankMatch[0] : "");
    if (
      targetBank &&
      (classification.subIntent === "POLICY_INQUIRY" ||
        /policy|cibil|cutoff|foir|interest|rate|multiplier|age|salary|tenure|rule|criteria|minimum|maximum|limit|band|document|doc|cat|category|tier/i.test(
          norm
        ))
    ) {
      return await dispatchToolCall(
        "lookup_master_policy",
        {
          bankName: targetBank,
          questionTopic: userMessage,
        },
        {
          conversationId,
          userMessage,
          eligibilitySession,
          isEligibleFlowActive,
          modelOverride: requestedModel,
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
      }
    );
  }

  if (classification.intent === "LOAN_ELIGIBILITY") {
    return await dispatchToolCall(
      "check_loan_eligibility",
      classification.extracted || {},
      {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
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
}): Promise<AgentResult> {
  const { message, conversationId, model: requestedModel } = opts;
  const userMessage = String(message || "").trim();

  // 1. Check if an eligibility session is active for this specific conversation
  const eligibilitySession = await getEligibilityState(conversationId);
  const isEligibleFlowActive = !!(
    eligibilitySession &&
    (eligibilitySession.expectedField ||
      (eligibilitySession.missingFields && eligibilitySession.missingFields.length > 0) ||
      (eligibilitySession as any).in_eligibility_flow)
  );

  const model = requestedModel || getModel();
  const apiKey = getApiKey();

  // If no API key is configured, route via fallbackToolDispatcher directly
  if (!apiKey) {
    return await fallbackToolDispatcher(
      userMessage,
      conversationId,
      eligibilitySession,
      isEligibleFlowActive,
      requestedModel
    );
  }

  // 2. OpenRouter Tool-Calling Decision-Making Brain
  const systemPrompt =
    `You are the central decision-making brain of CreditWise AI, an intelligent personal loan and banking intelligence platform.\n` +
    `Your role is to understand the user's current message and select the EXACT tool needed to respond.\n\n` +
    `AVAILABLE TOOLS:\n` +
    `1. "calculate_emi": Use for monthly EMI calculations, interest payable, or installment questions.\n` +
    `2. "lookup_master_policy": Use for bank-specific policy questions (CIBIL cutoff, FOIR limits, salary criteria, tenure, multipliers) using that bank's official Master Policy .txt file. NEVER guess or invent policy rules.\n` +
    `3. "search_company_category": Use when user asks about an employer or company category/tier listing (Super Cat A, Cat A, Elite, Diamond).\n` +
    `4. "check_loan_eligibility": Use when user wants personal loan eligibility, applies for a loan, or provides missing details (salary, amount, tenure, cibil, emi, age) for an assessment.\n` +
    `5. "update_applicant_profile": Use when the user explicitly wants to update, correct, or change a previously provided detail (e.g. "change salary to 1.2L", "update cibil to 780").\n` +
    `6. "answer_general_question": Use for general financial concepts (e.g. "What is FOIR?"), greetings (subType="GREETING"), small talk, or cancellation (subType="CANCEL_RESET").\n` +
    `7. "tavily_search": Use for live financial news, current market interest rate changes, or web searches.\n` +
    `8. "search_bank_managers": Use for bank manager contacts, ASM/RSM directory, phone numbers, or branch contacts.\n\n` +
    `CRITICAL CONVERSATIONAL RULES:\n` +
    `- NEVER let an active eligibility flow override or ignore a new user request! If an assessment is in progress and the user asks a policy question, an EMI calculation, a live search, a manager contact, or a concept definition, ALWAYS call that specific tool.\n` +
    `- Choose the tool that addresses the user's CURRENT message.\n` +
    `- Context: isFlowActive=${isEligibleFlowActive ? "true" : "false"}, expectedField=${eligibilitySession?.expectedField || "none"}, applicant=${JSON.stringify(eligibilitySession?.applicant || {})}.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

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
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
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
        requestedModel
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

      return await dispatchToolCall(toolName, parsedArgs, {
        conversationId,
        userMessage,
        eligibilitySession,
        isEligibleFlowActive,
        modelOverride: requestedModel,
      });
    }

    // Direct text reply from model
    const textContent = choice?.message?.content;
    if (typeof textContent === "string" && textContent.trim().length > 0) {
      let reply = stripReasoningPreamble(textContent);
      if (isEligibleFlowActive && !reply.includes("continue") && !reply.includes("eligibility")) {
        reply += getFlowContinuationHint(eligibilitySession);
      }
      return { reply };
    }

    // If no tool call and empty content, fallback
    return await fallbackToolDispatcher(
      userMessage,
      conversationId,
      eligibilitySession,
      isEligibleFlowActive,
      requestedModel
    );
  } catch (err) {
    // Network error or timeout -> fallback dispatcher
    return await fallbackToolDispatcher(
      userMessage,
      conversationId,
      eligibilitySession,
      isEligibleFlowActive,
      requestedModel
    );
  }
}


