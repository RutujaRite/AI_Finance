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
} from "@/lib/dynamicEligibilityEngine";
import { resolveCompanyCategories } from "@/lib/companyCategoryResolver";
import { classifyIntentWithLLM, IntentClassificationResult } from "@/lib/ai/intentClassifier";
import { BANK_MASTER_POLICIES, getMasterPolicyText, BankMasterPolicy } from "@/lib/masterPolicies";

const LLM_TIMEOUT_MS = 60000;

export interface AgentResult {
  reply: string;
  bankData?: any;
  companyData?: any;
  companyQuery?: string | null;
}

const ASSISTANT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_bank_managers",
      description:
        "Searches PostgreSQL bank_managers database table for official manager contacts. STRICT: Use ONLY when user explicitly asks for manager phone numbers, emails, or contact directory. DO NOT call for loan applications, salary checks, or policy questions.",
      parameters: {
        type: "object",
        properties: {
          bank_name: { type: "string", description: "Bank name e.g. ICICI, HDFC, Axis, Kotak, Piramal, Tata, Bajaj" },
          city: { type: "string", description: "City or location e.g. Pune, Mumbai, Ahmedabad, Delhi, Hyderabad" },
          role: { type: "string", description: "Manager role e.g. ASM, RSM, RM, SM, ZSM, RH" },
          manager_name: { type: "string", description: "Manager name if searching for specific person" },
          pincode: { type: "string", description: "Pincode if searching by exact postal code (e.g. '411001')" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_company_eligibility",
      description:
        "Searches bank_company_data database table (339,510 corporate companies across 8 banks) for corporate employer listings, category ratings (Cat A, Elite, Diamond), and bank approval coverage.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Name of the corporate company e.g. Infosys, TCS, Wipro, Tata Motors" },
        },
        required: ["company_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_bank_policies",
      description:
        "Searches bank policy rulebooks for CIBIL score requirements, FOIR limits, salary criteria, interest rates, and loan norms.",
      parameters: {
        type: "object",
        properties: {
          bank_name: { type: "string", description: "Bank name if specific bank policy is requested" },
          question: { type: "string", description: "Policy criteria question topic" },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_loan_eligibility",
      description:
        "Evaluates a user's personal loan eligibility against active PostgreSQL bank policy rules. " +
        "Use this tool when the user asks whether they can get a loan, whether they are eligible, " +
        "or wants an eligibility assessment. Pass every parameter you can extract from the message; " +
        "the engine returns a deterministic result and lists any missing inputs. " +
        "DO NOT calculate eligibility yourself — always delegate to this tool.",
      parameters: {
        type: "object",
        properties: {
          bank_name: { type: "string", description: "Target bank if mentioned, e.g. ICICI, HDFC, Axis, SBI, Kotak" },
          loan_type: { type: "string", description: "Loan type, e.g. Personal, Home, Car, Business. Default Personal." },
          salary: { type: "number", description: "Net monthly salary in INR" },
          cibil: { type: "number", description: "CIBIL / credit score (3 digits)" },
          existing_emi: { type: "number", description: "Total existing monthly EMI obligations in INR" },
          company_name: { type: "string", description: "Employer / company name if mentioned" },
          employment_type: { type: "string", description: "Salaried or Self-Employed" },
          age: { type: "number", description: "Applicant age in years" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_emi",
      description:
        "Calculates monthly EMI for a given principal, annual interest rate, and tenure in months. Use this tool when the user asks for EMI amount, monthly payment, or installment calculation.",
      parameters: {
        type: "object",
        properties: {
          principal: { type: "number", description: "Loan amount in INR (e.g. 500000)" },
          rate: { type: "number", description: "Annual interest rate percentage (e.g. 11.5)" },
          tenure: { type: "number", description: "Loan tenure in months (e.g. 60)" },
        },
        required: ["principal", "rate", "tenure"],
      },
    },
  },
];

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

async function searchPoliciesForBank(bankName: string, question: string): Promise<string> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001"}/api/policy-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: `${bankName} ${question}` }),
    });
    if (!res.ok) return "Policy search service is currently unavailable.";
    const data = await res.json();
    return data.answer || "I couldn't find specific policy information for that query.";
  } catch (e) {
    console.error("Policy search error", e);
    return "Policy search failed. Please try again later.";
  }
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
  if (!text) return "";
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^User Safety:[^\n]*\n+/gi, "")
    .trim();

  const markers = [
    "Here's a thinking process",
    "Here is a thinking process",
    "Thinking process:",
    "Let me think",
    "Let's think",
    "Analysis:",
    "Step 1",
  ];
  const lower = cleaned.toLowerCase();
  let idx = -1;
  for (const m of markers) {
    const i = lower.indexOf(m.toLowerCase());
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return cleaned.trim();

  const after = cleaned.slice(idx);
  const m = after.match(/(?:^|\n)\s*(?:\d+\.\s*)?(?:summary|final|answer|result|decision)/i);
  if (m) return cleaned.slice(idx + m.index!).trim();
  return cleaned.trim();
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
    if (!fallbackData) return { reply: FALLBACK_GREETING };

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

  let cibil: number | undefined;
  const cibilMatch = norm.match(/(?:cibil|credit\s*score|bureau(?:\s*score)?)(?:\s*is)?\s*(\d{3})/i) ||
                     norm.match(/\b(\d{3})\b\s*(?:cibil|credit\s*score)/i);
  if (cibilMatch) {
    cibil = parseInt(cibilMatch[1], 10);
  }

  let existing_emi: number | undefined;
  const emiMatch = norm.match(/(?:existing\s*emi|current\s*emi|monthly\s*emi|emi)(?:\s*is)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k)?/i);
  if (emiMatch) {
    let val = parseFloat(emiMatch[1].replace(/,/g, ""));
    if ((emiMatch[2] || "").toLowerCase() === "k") val *= 1000;
    existing_emi = val;
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

  let loan_type = "Personal";
  if (/home\s*loan/i.test(norm)) loan_type = "Home";
  else if (/business\s*loan/i.test(norm)) loan_type = "Business";
  else if (/auto\s*loan|car\s*loan/i.test(norm)) loan_type = "Car";

  return { bank, loan_type, salary, cibil, existing_emi, employment_type, company };
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

  return FALLBACK_GREETING;
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
 * Matches a bank from user message or targetBank against known Master Policy bank definitions.
 */
export function matchBankFromMessage(message: string, targetBank?: string): BankMasterPolicy | null {
  const norm = `${targetBank || ""} ${message}`.toLowerCase();

  if (/aditya\s*birla|abfl/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "ABFL") || null;
  if (/axis\s*finance|\bafl\b/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "AFL") || null;
  if (/axis\s*bank|\baxis\b/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "AXIS") || null;
  if (/bajaj\s*markets/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "BAJAJ_MARKETS") || null;
  if (/bajaj/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "BAJAJ_FINSERV") || null;
  if (/bandhan/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "BANDHAN") || null;
  if (/chola|cholamandalam/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "CHOLA") || null;
  if (/fibe|earlysalary/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "FIBE") || null;
  if (/finnable/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "FINNABLE") || null;
  if (/hdfc/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "HDFC") || null;
  if (/icici/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "ICICI") || null;
  if (/idfc/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "IDFC") || null;
  if (/indusind/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "INDUSIND") || null;
  if (/kotak/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "KOTAK") || null;
  if (/l&t|ltf|lt\s*finance/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "LTF") || null;
  if (/piramal/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "PIRAMAL") || null;
  if (/poonawalla/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "POONAWALLA") || null;
  if (/sbm/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "SBM") || null;
  if (/smfg|fullerton/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "SMFG") || null;
  if (/tata/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "TATA_CAPITAL") || null;
  if (/utkarsh/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "UTKARSH") || null;
  if (/yes\s*bank|\byes\b/i.test(norm)) return BANK_MASTER_POLICIES.find((b) => b.bank_code === "YES_BANK") || null;

  // Generic fallback match across catalog
  for (const p of BANK_MASTER_POLICIES) {
    const codeRegex = new RegExp(`\\b${p.bank_code.toLowerCase()}\\b`, "i");
    if (codeRegex.test(norm)) return p;
    const nameWords = p.bank_name.toLowerCase().replace(/bank|finance|limited|ltd|capital/g, "").trim().split(/\s+/);
    const primaryWord = nameWords.find((w) => w.length >= 4);
    if (primaryWord && new RegExp(`\\b${primaryWord}\\b`, "i").test(norm)) {
      return p;
    }
  }

  return null;
}

/**
 * Extracts the most relevant sections of a policy file for prompt injection (max ~13k chars).
 */
export function extractRelevantPolicyText(fullText: string, question: string, maxChars = 13000): string {
  if (fullText.length <= maxChars) {
    return fullText;
  }

  const stopWords = new Set([
    "what", "is", "the", "for", "and", "in", "of", "to", "a", "an", "does", "how", "much", "can", "get", "tell", "me", "about"
  ]);
  const terms = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  if (terms.includes("foir") || terms.includes("dbr")) {
    terms.push("obligation", "fixed", "ratio", "grid");
  }
  if (terms.includes("interest") || terms.includes("rate")) {
    terms.push("irr", "pricing", "roi");
  }
  if (terms.includes("cibil") || terms.includes("credit")) {
    terms.push("bureau", "score");
  }

  // Split by major numbered sections (e.g. \n5. or \n7. ) or markdown headings, preserving bodies
  const rawSections = fullText.split(/\n(?=[0-9]+\.\s+[A-Z]|\n#{1,3}\s+[A-Z])/);
  const sections = rawSections.filter((s) => s.trim().length > 30);
  const header = sections[0] || fullText.slice(0, 1500);

  const scoredSections = sections.slice(1).map((sec) => {
    const lower = sec.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const regex = new RegExp(`\\b${term}\\b`, "gi");
      const matches = lower.match(regex);
      if (matches) {
        score += matches.length * 5;
      }
    }
    return { sec, score };
  });

  scoredSections.sort((a, b) => b.score - a.score);

  let result = header.slice(0, 1500) + "\n\n";
  for (const item of scoredSections) {
    if (result.length + item.sec.length > maxChars) {
      const remaining = maxChars - result.length;
      if (remaining > 300) {
        result += item.sec.slice(0, remaining) + "\n...";
      }
      break;
    }
    result += item.sec + "\n\n";
  }

  return result;
}

/**
 * Fallback concept answer generator when LLM API is rate-limited or offline.
 * Strictly adheres to rule: never invent or quote default eligibility percentages.
 */
export function getFallbackConceptAnswer(question: string): string {
  const norm = question.toLowerCase();

  if (/foir|dbr|obligation|debt\s*burden/i.test(norm)) {
    return (
      `# Financial Obligations to Income Ratio (FOIR)\n\n` +
      `## Definition\n` +
      `**FOIR** (Financial Obligations to Income Ratio), also referred to by some lenders as **DBR** (Debt Burden Ratio), is an underwriting metric used by financial institutions to assess a borrower’s repayment capacity. It measures the proportion of an applicant's monthly net income that is already allocated toward fixed monthly debt obligations.\n\n` +
      `## What It Measures\n` +
      `- **Fixed Monthly Debt Obligations**: Recurring contractual debt obligations such as existing loan EMIs (home loan, auto loan, personal loan) and credit card minimum due amounts.\n` +
      `- **Net Monthly Income**: Take-home salary credited after all statutory deductions and taxes.\n\n` +
      `## Mathematical Formula\n\n` +
      `$$\\text{FOIR (\\%)} = \\left( \\frac{\\text{Total Existing Monthly Debt Obligations}}{\\text{Net Monthly Income}} \\right) \\times 100$$\n\n` +
      `## Why Lenders Review FOIR\n` +
      `1. **Repayment Cushion**: A lower FOIR signifies that the borrower has ample disposable income left after meeting mandatory debts, reducing default risk.\n` +
      `2. **Maximum Permissible Debt Capacity**: Lenders determine the maximum new EMI an applicant can take on by capping total obligations within acceptable thresholds.\n` +
      `3. **Credit Risk Underwriting**: Higher existing debt ratios indicate potential leverage risk, which may influence loan approval or require higher interest rates.\n\n` +
      `> [!NOTE]\n` +
      `> **Policy Notice**: Permissible FOIR thresholds are **never universal**. Each bank defines its own exact FOIR tiers based on employer company category, income brackets, and existing banking relationships directly inside its official Master Policy.`
    );
  }

  if (/cibil|credit\s*score|bureau/i.test(norm)) {
    return (
      `# CIBIL Score & Credit Bureau Evaluation\n\n` +
      `## Definition\n` +
      `A **CIBIL Score** is a 3-digit numerical summary (ranging between 300 and 900) calculated by TransUnion CIBIL that represents an individual's credit history, borrowing patterns, and repayment discipline over time.\n\n` +
      `## Key Components Evaluated\n` +
      `- **Payment History (35%)**: Consistency in paying past loan EMIs and credit card bills on or before due dates.\n` +
      `- **Credit Utilization Ratio (30%)**: Percentage of revolving credit limit utilized.\n` +
      `- **Credit History Length (15%)**: Duration of active credit facilities.\n` +
      `- **Credit Mix (10%)**: Balance between secured (e.g. home/auto loans) and unsecured credit (e.g. personal loans, cards).\n` +
      `- **Recent Enquiries (10%)**: Number of recent hard enquiries made by lenders.\n\n` +
      `## Why Lenders Review CIBIL\n` +
      `1. **Risk Segmentation**: Lenders categorize applicants into risk bands to determine baseline credit eligibility.\n` +
      `2. **Risk-Based Pricing (ROI)**: Many partner banks apply tiered pricing rate cards where higher bureau scores receive lower annual interest rates.\n` +
      `3. **Special Program Pathways**: Specific policies exist for first-time borrowers (CIBIL 0 or -1 / New to Credit) versus established borrowers.\n\n` +
      `> [!NOTE]\n` +
      `> **Policy Notice**: Each bank enforces its own unique approval cutoff and pricing slabs within its Master Policy. A score that qualifies under one bank's policy may be routed to a higher pricing tier in another.`
    );
  }

  if (/emi|equated\s*monthly/i.test(norm)) {
    return (
      `# Equated Monthly Installment (EMI)\n\n` +
      `## Definition\n` +
      `An **EMI** is a fixed payment amount made by a borrower to a lender at a specified date of each calendar month until the loan is fully repaid.\n\n` +
      `## Mathematical Formula\n\n` +
      `$$\\text{EMI} = \\frac{P \\times r \\times (1 + r)^n}{(1 + r)^n - 1}$$\n\n` +
      `Where:\n` +
      `- **$P$** = Principal loan amount borrowed\n` +
      `- **$r$** = Monthly interest rate (Annual Interest Rate $\\div 12 \\div 100$)\n` +
      `- **$n$** = Repayment tenure in months\n\n` +
      `## How EMI Amortization Works\n` +
      `- In the initial months of the loan, a larger portion of the EMI goes toward servicing interest.\n` +
      `- As the outstanding principal reduces over time, a greater share of the EMI is applied directly to principal repayment.\n\n` +
      `> [!NOTE]\n` +
      `> **Policy Notice**: Exact interest rates and permitted tenures are governed by each bank's official Master Policy rate card.`
    );
  }

  if (/multiplier|loan\s*capacity/i.test(norm)) {
    return (
      `# Net Monthly Income Multiplier\n\n` +
      `## Definition\n` +
      `The **Salary Multiplier** is an underwriting method where a lender determines an applicant's maximum eligible loan capacity by multiplying their net monthly salary by an approved factor.\n\n` +
      `## Conceptual Formula\n\n` +
      `$$\\text{Maximum Loan Capacity} = \\text{Net Monthly Income} \\times \\text{Policy Multiplier Factor}$$\n\n` +
      `## Influencing Underwriting Factors\n` +
      `- **Employer Category**: Listed corporate categories (Super A, Cat A, Cat B, Cat C, Government) receive differentiated multiplier factors.\n` +
      `- **Income Tier**: Higher income brackets often qualify for extended multipliers.\n` +
      `- **Repayment Tenure**: Multipliers are calibrated to ensure the resulting EMI remains within permissible FOIR obligations.\n\n` +
      `> [!NOTE]\n` +
      `> **Policy Notice**: Specific multiplier multiples are defined strictly within each partner bank's Master Policy rulebook.`
    );
  }

  return (
    `### 🏦 Banking & Financial Intelligence\n\n` +
    `CreditWise AI provides information directly aligned with official partner bank Master Policies and regulatory guidelines.\n\n` +
    `You can ask:\n` +
    `- **Specific Bank Master Policies**: e.g., *"What is HDFC Bank CIBIL criteria?"*, *"What is Kotak Bank FOIR rule?"*\n` +
    `- **Financial Concepts**: e.g., *"What is FOIR?"*, *"What is CIBIL score?"*, *"How is EMI calculated?"*\n` +
    `- **Official Bank Managers**: e.g., *"Show HDFC bank managers in Mumbai"*\n` +
    `- **Corporate Listings**: e.g., *"Check category for Infosys"*`
  );
}

/**
 * Fallback policy answer directly parsed from the bank's actual Master Policy file.
 * Used if LLM is offline or rate-limited.
 */
export function getFallbackBankPolicyAnswer(bankName: string, policyText: string, question: string): string {
  const norm = question.toLowerCase();
  const rawSections = policyText.split(/\n(?=[0-9]+\.\s+[A-Z]|\n#{1,3}\s+[A-Z])/);
  const sections = rawSections.filter((s) => s.trim().length > 30);

  const keywords: string[] = [];
  if (/cibil|credit score|bureau/i.test(norm)) keywords.push("cibil", "bureau", "credit");
  if (/foir|dbr|obligation/i.test(norm)) keywords.push("foir", "dbr", "obligation", "ratio");
  if (/tenure|tenor|duration/i.test(norm)) keywords.push("tenure", "tenor", "months");
  if (/interest|roi|rate|pricing/i.test(norm)) keywords.push("interest", "roi", "pricing", "irr", "rate");
  if (/salary|income|nth|nmi/i.test(norm)) keywords.push("salary", "income", "nth", "nmi");
  if (/age/i.test(norm)) keywords.push("age", "retirement");
  if (/fee|charge/i.test(norm)) keywords.push("fee", "processing", "charges");

  const scoredSections = sections.map((sec) => {
    const secLower = sec.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      const matches = secLower.match(new RegExp(`\\b${kw}\\b`, "gi"));
      if (matches) score += matches.length * 3;
    }
    return { sec, score };
  });

  const matchingSections = scoredSections
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matchingSections.length > 0) {
    const excerpt = matchingSections
      .slice(0, 3)
      .map((item) => item.sec.trim())
      .join("\n\n---\n\n");

    return (
      `## 🏦 ${bankName} — Official Master Policy Details\n\n` +
      `*The following details are extracted directly from ${bankName}'s verified Master Policy file:*\n\n` +
      `${excerpt.slice(0, 4500)}\n\n` +
      `> [!NOTE]\n` +
      `> Sourced strictly from ${bankName}'s official Master Policy rulebook. Any parameters not explicitly detailed above are not defined in the policy.`
    );
  }

  return (
    `## 🏦 ${bankName} — Master Policy Rulebook\n\n` +
    `*Excerpt from ${bankName}'s verified Master Policy:*\n\n` +
    `${policyText.slice(0, 2500)}\n\n` +
    `> [!NOTE]\n` +
    `> Sourced strictly from ${bankName}'s official Master Policy rulebook. Any parameters not explicitly detailed above are not defined in the policy.`
  );
}

/**
 * Answers questions about a specific bank's policy using ONLY that bank's verified Master Policy text.
 * Never invents, assumes, borrows from other banks, or uses generic financial benchmarks.
 */
async function answerBankPolicyWithMasterPolicy(
  matchedPolicy: BankMasterPolicy,
  question: string,
  modelOverride?: string
): Promise<string> {
  const fullPolicyText = getMasterPolicyText(matchedPolicy.file_name);
  if (!fullPolicyText || fullPolicyText.trim().length === 0) {
    return `The official Master Policy file for **${matchedPolicy.bank_name}** is currently not available in the repository.`;
  }

  const excerptText = extractRelevantPolicyText(fullPolicyText, question, 13000);

  if (OPENROUTER_API_KEY) {
    const modelsToTry = [
      modelOverride || OPENROUTER_MODEL,
      "nvidia/nemotron-3.5-lightning:free",
      "google/gemma-4-31b-it:free",
      "inclusionai/ling-3.0-flash-fin:free",
      "openrouter/free",
    ];

    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

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
            max_tokens: 1200,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content:
                  `You are CreditWise AI, an expert banking intelligence assistant.\n` +
                  `You are answering a question specifically regarding ${matchedPolicy.bank_name}'s official Master Policy.\n` +
                  `Base your answer EXCLUSIVELY and STRICTLY on the verified Master Policy text provided below.\n\n` +
                  `CRITICAL RULES:\n` +
                  `1. Quote only the actual policy rules present in the text for ${matchedPolicy.bank_name}.\n` +
                  `2. If a specific parameter (e.g. CIBIL score, FOIR %, tenure, salary, interest rate) is NOT explicitly defined or is marked unstated in the text, state clearly that it is not specified in ${matchedPolicy.bank_name}'s Master Policy.\n` +
                  `3. NEVER invent, assume, borrow numbers from other banks, or use generic financial benchmarks as policy values.\n` +
                  `4. Ensure your answer is complete, concise, formatted in GitHub Markdown, and never cut off.\n\n` +
                  `--- ${matchedPolicy.bank_name} Master Policy Text ---\n` +
                  excerptText,
              },
              { role: "user", content: question },
            ],
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          const content = json.choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            const cleaned = stripReasoningPreamble(content.trim());
            if (cleaned.length > 0 && !/^User Safety:\s*safe$/i.test(cleaned)) {
              return cleaned;
            }
          }
        }
      } catch {}
    }
  }

  // High-fidelity fallback directly from the policy file if LLM is offline or rate-limited
  return getFallbackBankPolicyAnswer(matchedPolicy.bank_name, fullPolicyText, question);
}

/**
 * Answers general financial concept questions without quoting generic/default eligibility percentages or benchmarks.
 */
async function answerGeneralConceptWithLLM(userMessage: string, modelOverride?: string): Promise<string> {
  if (OPENROUTER_API_KEY) {
    const modelsToTry = [
      modelOverride || OPENROUTER_MODEL,
      "nvidia/nemotron-3.5-lightning:free",
      "google/gemma-4-31b-it:free",
      "inclusionai/ling-3.0-flash-fin:free",
      "openrouter/free",
    ];

    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

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
            max_tokens: 1200,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content:
                  `You are CreditWise AI, a banking and financial intelligence assistant.\n` +
                  `Explain the financial/banking concept clearly, objectively, and accurately in response to the user's question.\n\n` +
                  `CRITICAL RULES:\n` +
                  `1. DO NOT quote any generic, default, or hypothetical eligibility percentages or rules (such as 'banks generally allow 50% to 60% FOIR', 'minimum CIBIL is 750', standard multiplier numbers, etc.).\n` +
                  `2. Explain the concept itself (what the term stands for, what it measures, the mathematical formula if applicable, and why lenders review it) WITHOUT asserting universal or benchmark percentage limits, because every bank enforces its own unique Master Policy rules.\n` +
                  `3. Never invent, assume, or use general financial benchmarks as policy values.\n` +
                  `4. Ensure your response is complete, concise, formatted in GitHub Markdown, and never cut off mid-sentence.`,
              },
              { role: "user", content: userMessage },
            ],
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          const content = json.choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            const cleaned = stripReasoningPreamble(content.trim());
            if (cleaned.length > 0 && !/^User Safety:\s*safe$/i.test(cleaned)) {
              return cleaned;
            }
          }
        }
      } catch {}
    }
  }

  // Deterministic concept fallback if LLM is offline or rate-limited
  return getFallbackConceptAnswer(userMessage);
}

/**
 * Backward-compatible alias for general question answering.
 */
async function answerGeneralQuestionWithLLM(userMessage: string, modelOverride?: string): Promise<string> {
  return answerGeneralConceptWithLLM(userMessage, modelOverride);
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

  // 2. Corporate Employer Rating / Category Query
  if (
    classification.subIntent === "COMPANY_SEARCH" ||
    (/(?:company|employer|category|rating|listing|tier|listed)/i.test(norm) && !/policy|rule|cutoff|foir|tenure|interest/i.test(norm))
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

  // 3. Bank Policy Query: If a specific bank is known / identified, answer ONLY from its actual Master Policy!
  const matchedBank = matchBankFromMessage(userMessage, classification.extracted?.targetBank);
  if (matchedBank) {
    const policyReply = await answerBankPolicyWithMasterPolicy(matchedBank, userMessage, modelOverride);
    return { reply: policyReply };
  }

  // 4. General Banking Concept / FAQ / AI answer (no specific bank applies)
  const conceptReply = await answerGeneralConceptWithLLM(userMessage, modelOverride);
  return { reply: conceptReply };
}

/**
 * Handles Changing Details intent. Updates applicant parameters and recalculates or prompts for next missing field.
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

  const updatedFields: string[] = [];

  if (classification.extracted?.monthlyIncome && classification.extracted.monthlyIncome > 0) {
    applicant.monthlyIncome = classification.extracted.monthlyIncome;
    updatedFields.push(`Monthly Salary to ₹${applicant.monthlyIncome.toLocaleString("en-IN")}`);
  }
  if (classification.extracted?.loanAmount && classification.extracted.loanAmount > 0) {
    applicant.loanAmount = classification.extracted.loanAmount;
    updatedFields.push(`Loan Amount to ₹${applicant.loanAmount.toLocaleString("en-IN")}`);
  }
  if (classification.extracted?.tenureMonths && classification.extracted.tenureMonths > 0) {
    applicant.tenureMonths = classification.extracted.tenureMonths;
    updatedFields.push(`Tenure to ${applicant.tenureMonths} months`);
  }
  if (classification.extracted?.cibil !== undefined && classification.extracted.cibil > 0) {
    applicant.cibil = classification.extracted.cibil;
    updatedFields.push(`CIBIL Score to ${applicant.cibil}`);
  }
  if (classification.extracted?.existingEmi !== undefined) {
    applicant.existingEmi = classification.extracted.existingEmi;
    updatedFields.push(`Existing Monthly EMIs to ₹${applicant.existingEmi.toLocaleString("en-IN")}`);
  }
  if (classification.extracted?.age && classification.extracted.age > 0) {
    applicant.age = classification.extracted.age;
    updatedFields.push(`Age to ${applicant.age} years`);
  }
  if (classification.extracted?.companyName && !isInvalidCompanyName(classification.extracted.companyName)) {
    const resolved = await resolveCompanyCategories(classification.extracted.companyName);
    applicant.companyName = resolved.matchedName || classification.extracted.companyName;
    updatedFields.push(`Employer to ${applicant.companyName}`);
  }

  // Complement with regex parsing from message if needed
  const regexUpdated = extractApplicantDetails(userMessage, applicant, []);
  if (
    regexUpdated.monthlyIncome &&
    !classification.extracted?.monthlyIncome &&
    regexUpdated.monthlyIncome !== applicant.monthlyIncome
  ) {
    applicant.monthlyIncome = regexUpdated.monthlyIncome;
    updatedFields.push(`Monthly Salary to ₹${applicant.monthlyIncome.toLocaleString("en-IN")}`);
  }
  if (
    regexUpdated.loanAmount &&
    !classification.extracted?.loanAmount &&
    regexUpdated.loanAmount !== applicant.loanAmount
  ) {
    applicant.loanAmount = regexUpdated.loanAmount;
    updatedFields.push(`Loan Amount to ₹${applicant.loanAmount.toLocaleString("en-IN")}`);
  }
  if (
    regexUpdated.tenureMonths &&
    !classification.extracted?.tenureMonths &&
    regexUpdated.tenureMonths !== applicant.tenureMonths
  ) {
    applicant.tenureMonths = regexUpdated.tenureMonths;
    updatedFields.push(`Tenure to ${applicant.tenureMonths} months`);
  }
  if (
    regexUpdated.cibil !== undefined &&
    !classification.extracted?.cibil &&
    regexUpdated.cibil !== applicant.cibil
  ) {
    applicant.cibil = regexUpdated.cibil;
    updatedFields.push(`CIBIL Score to ${applicant.cibil}`);
  }

  const updateAck =
    updatedFields.length > 0
      ? `🔄 **Details Updated**: Updated your ${updatedFields.join(", ")}.`
      : `🔄 **Details Updated**: Recorded your updated information.`;

  const companyMatch = applicant.companyName
    ? await resolveCompanyCategories(applicant.companyName)
    : undefined;

  const missingFields = getRequiredPolicyFields(applicant, companyMatch, applicant.loanType || "Personal Loan");

  // If all required fields are complete, recalculate immediately!
  if (missingFields.length === 0) {
    const evalResult = await evaluateApplicantAgainstAllBanks(applicant, applicant.loanType || "Personal Loan");
    const report = formatDynamicEligibilityReport(applicant, evalResult);

    await saveEligibilityState(conversationId, {
      applicant,
      expectedField: "chosenBank",
      updatedAt: Date.now(),
      in_eligibility_flow: true,
      eligible_banks: (evalResult.eligibleBanks || []).map((b) => b.bankName),
    } as any);

    return {
      reply: `${updateAck}\n\n${report}`,
      companyData: evalResult.companyMatch?.isFound
        ? {
            company_name: evalResult.companyMatch.matchedName || evalResult.companyMatch.searchedName,
            category: evalResult.companyMatch.bankCategories,
            needs_disambiguation: false,
          }
        : undefined,
    };
  }

  // Still have missing fields: ask the next single question without repeating answered ones
  const nextField = missingFields[0];
  const nextQuestion =
    nextField === "companyName"
      ? "What is your company or employer name?"
      : await generateDynamicSingleQuestionWithLLM(nextField, applicant, userMessage);

  await saveEligibilityState(conversationId, {
    applicant,
    expectedField: nextField,
    missingFields,
    updatedAt: Date.now(),
  });

  return {
    reply: `${updateAck}\n\n${nextQuestion}`,
  };
}

export async function runCentralAgent(opts: {
  message: string;
  conversationId: string;
  model?: string;
}): Promise<AgentResult> {
  const { message, conversationId, model: requestedModel } = opts;

  // 1. Check if an eligibility session is active for this specific conversation
  const eligibilitySession = await getEligibilityState(conversationId);
  const isEligibleFlowActive = !!(
    eligibilitySession &&
    (eligibilitySession.expectedField ||
      (eligibilitySession.missingFields && eligibilitySession.missingFields.length > 0) ||
      (eligibilitySession as any).in_eligibility_flow)
  );

  // 2. LLM Intent Detection on EVERY message BEFORE any eligibility processing!
  const classification = await classifyIntentWithLLM(
    message,
    {
      isFlowActive: isEligibleFlowActive,
      expectedField: eligibilitySession?.expectedField,
      existingApplicant: eligibilitySession?.applicant,
    },
    requestedModel
  );

  // 3. GREETINGS: Answer greeting directly, never force next eligibility question!
  if (classification.intent === "GREETINGS") {
    if (isEligibleFlowActive) {
      return {
        reply: `Hello! 👋 How can I assist you today? If you'd like to continue your loan eligibility evaluation, we can pick right back up whenever you're ready.`,
      };
    }
    return { reply: getGreetingReply(message) };
  }

  // 4. CALCULATION: Answer calculation directly (supports partial calculations) without asking next eligibility question!
  if (classification.intent === "CALCULATION") {
    const calcReply = await handleCalculationIntent(
      message,
      classification,
      eligibilitySession?.applicant,
      requestedModel
    );
    return { reply: calcReply };
  }

  // 5. GENERAL_INFORMATION: Answer policy, manager, company, or concept directly without asking next eligibility question!
  if (classification.intent === "GENERAL_INFORMATION") {
    const genResult = await handleGeneralInformationIntent(message, classification, requestedModel);
    return genResult;
  }

  // 6. CHANGING_DETAILS: Update changed details and recalculate or ask next missing field!
  if (classification.intent === "CHANGING_DETAILS") {
    const changeResult = await handleChangingDetailsIntent(
      conversationId,
      message,
      classification,
      eligibilitySession,
      requestedModel
    );
    return changeResult;
  }

  // 7. ANOTHER_TOPIC: Cancellation/reset or casual small talk
  if (classification.intent === "ANOTHER_TOPIC") {
    if (
      classification.subIntent === "CANCEL_RESET" ||
      /^(cancel|reset|restart|stop|exit)\b/i.test(message.trim())
    ) {
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

    const casualReply = await handleCasualMessage(message, requestedModel);
    return { reply: casualReply };
  }

  // 8. LOAN_ELIGIBILITY: Process loan eligibility flow
  if (classification.intent === "LOAN_ELIGIBILITY") {
    try {
      const wizardResult = await processEligibilityFlow(
        conversationId,
        message,
        requestedModel,
        async (msg: string, model?: string, context?: string, prompt?: string) => {
          const agentRes = await runToolCallingAgent(msg, model, context, prompt);
          return agentRes.reply;
        },
        classification
      );
      const result: AgentResult = { reply: wizardResult.reply };
      if ((wizardResult as any).companyData) result.companyData = (wizardResult as any).companyData;
      return result;
    } catch (e) {
      console.error("Eligibility flow processing error:", e);
    }
  }

  // 9. Fallback search
  const agentResult = await runToolCallingAgent(message, requestedModel);
  const result: AgentResult = { reply: agentResult.reply };
  if (agentResult.bankData) result.bankData = agentResult.bankData;
  if (agentResult.companyData) result.companyData = agentResult.companyData;
  if (agentResult.companyQuery) result.companyQuery = agentResult.companyQuery;
  return result;
}

