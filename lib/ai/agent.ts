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
  isInvalidCompanyName,
  isFinancialOrProfileInput,
} from "@/lib/dynamicEligibilityEngine";
import { classifyIntentWithLLM } from "@/lib/ai/intentClassifier";

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

/**
 * Simple greeting detection. Returns a natural greeting reply for messages
 * like "hi", "hello", "hey", "good morning", etc. without calling any tools.
 */
function isSimpleGreeting(message: string): boolean {
  const normalized = String(message || "")
    .toLowerCase()
    .replace(/[!?.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;

  const greetingPatterns = [
    /^hi\b/,
    /^hello\b/,
    /^hey\b/,
    /^good (morning|afternoon|evening|day)\b/,
    /^howdy\b/,
    /^greetings\b/,
    /^namaste\b/,
    /^good morning\b/,
    /^good afternoon\b/,
    /^good evening\b/,
    /^good day\b/,
    /^hi there\b/,
    /^hello there\b/,
    /^hey there\b/,
    /^hi there\b/,
    /^how are you\b/,
    /^how's it going\b/,
    /^what's up\b/,
    /^whats up\b/,
    /^yo\b/,
    /^hi\b.*$/i,
  ];

  return greetingPatterns.some(p => p.test(normalized));
}

function getGreetingReply(message: string): string {
  const normalized = String(message || "").toLowerCase();
  let timeOfDay = "";
  const hour = new Date().getHours();
  if (hour < 12) timeOfDay = "Good morning";
  else if (hour < 17) timeOfDay = "Good afternoon";
  else timeOfDay = "Good evening";

  return `${timeOfDay}! I'm CreditWise AI, your financial intelligence assistant. I can help you check loan eligibility, find bank policies, search employer listings, or connect you with bank managers. What would you like to do today?`;
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
 * without performing any company search, bank manager lookup, or loan evaluation.
 */
async function handleCasualMessage(message: string, modelOverride?: string): Promise<string> {
  const norm = String(message || "").toLowerCase().trim().replace(/[!?.]+/g, " ");

  if (/\b(how\s*are\s*you|hows\s*it\s*going|how\s*do\s*you\s*do)\b/i.test(norm)) {
    return "I'm doing well, thank you for asking! I'm CreditWise AI, your banking & financial intelligence assistant. How can I assist you today? You can check your personal loan eligibility across 23 partner banks, search company category ratings, view bank policy rules, or connect with bank managers.";
  }

  if (/\b(what\s*can\s*you\s*do|help|how\s*can\s*you\s*help|what\s*are\s*your\s*features)\b/i.test(norm)) {
    return (
      "Here is how I can assist you:\n\n" +
      "1. 🏦 **Personal Loan Eligibility Assessment**: Multi-bank evaluation across 23 partner banks strictly using official Master Policy rules (salary, CIBIL, age, FOIR, tenure).\n" +
      "2. 🏢 **Corporate Employer Directory**: Search 339,000+ companies to check partner bank listings and category tiers (Super Cat A, Cat A, Elite, etc.).\n" +
      "3. 📜 **Bank Policy Guidelines**: Query official bank rules on CIBIL cutoffs, FOIR debt caps, interest rates, and loan norms.\n" +
      "4. 👔 **Bank Manager Directory**: Connect with official bank representatives in your city.\n\n" +
      "What would you like to explore today?"
    );
  }

  if (/\b(who\s*are\s*you|what\s*is\s*creditwise|tell\s*me\s*about\s*yourself|what\s*is\s*your\s*name)\b/i.test(norm)) {
    return "I am CreditWise AI, an automated Banking & Financial Intelligence Assistant. I provide transparent, policy-accurate personal loan eligibility evaluations, employer category ratings, and official bank policy guidelines across 23 partner banks.";
  }

  if (/\b(thanks|thank\s*you|thanks\s*a\s*lot|thank\s*you\s*very\s*much)\b/i.test(norm)) {
    return "You're very welcome! If you need any assistance with personal loan eligibility, company ratings, or bank policies, just let me know.";
  }

  if (/\b(ok|okay|sure|cool|great|awesome|understood|got\s*it|fine|perfect)\b/i.test(norm)) {
    return "Glad to hear! How can I assist you further? You can ask to check personal loan eligibility, look up an employer, or inquire about bank policies.";
  }

  if (/\b(bye|goodbye|see\s*you|take\s*care)\b/i.test(norm)) {
    return "Goodbye! Have a wonderful day ahead. Feel free to return anytime you need banking or loan assistance.";
  }

  if (OPENROUTER_API_KEY) {
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
          model: modelOverride || OPENROUTER_MODEL,
          max_tokens: 250,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "You are CreditWise AI, a banking and financial intelligence assistant. " +
                "Respond politely, helpfully, and concisely to the user's casual remark or question. " +
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
    } catch {
      // Fall through to default greeting
    }
  }

  return FALLBACK_GREETING;
}

export async function runCentralAgent(opts: {
  message: string;
  conversationId: string;
  model?: string;
}): Promise<AgentResult> {
  const { message, conversationId, model: requestedModel } = opts;

  // Check if an eligibility session is active for this specific conversation
  const eligibilitySession = await getEligibilityState(conversationId);
  const isEligibleFlowActive = !!(
    eligibilitySession &&
    (eligibilitySession.expectedField ||
      (eligibilitySession.missingFields && eligibilitySession.missingFields.length > 0) ||
      (eligibilitySession as any).in_eligibility_flow)
  );

  // 1. LLM intent check happens BEFORE any company lookup or eligibility processing
  const classification = await classifyIntentWithLLM(
    message,
    {
      isFlowActive: isEligibleFlowActive,
      expectedField: eligibilitySession?.expectedField,
    },
    requestedModel
  );

  // Handle cancellation/reset command
  if (classification.intent === "CANCEL_RESET") {
    await clearEligibilityState(conversationId);
    return {
      reply: "🔄 **Loan Assessment Reset**\n\nYour session has been reset. You can start fresh anytime by asking for a loan or policy details.",
    };
  }

  // 2. Greetings ("Hi", "Hello", etc.) MUST NEVER trigger company lookup or loan processing!
  if (classification.intent === "GREETING") {
    if (isEligibleFlowActive) {
      const fieldDesc =
        eligibilitySession?.expectedField === "companyName"
          ? "company or employer name"
          : eligibilitySession?.expectedField || "next detail";
      return {
        reply: `Hello! 👋 We currently have an active personal loan eligibility assessment in progress.\n\nWhenever you're ready, please provide your **${fieldDesc}** to continue (or type **cancel** to start over).`,
      };
    }
    return { reply: getGreetingReply(message) };
  }

  // 3. Casual messages & general inquiries MUST NEVER trigger company lookup or loan processing!
  if (classification.intent === "GENERAL_INQUIRY") {
    const casualReply = await handleCasualMessage(message, requestedModel);
    if (isEligibleFlowActive) {
      const fieldDesc =
        eligibilitySession?.expectedField === "companyName"
          ? "company or employer name"
          : eligibilitySession?.expectedField || "next detail";
      return {
        reply: `${casualReply}\n\n*(Note: We have an ongoing loan eligibility assessment waiting for your **${fieldDesc}**. You can answer anytime or type **cancel** to reset.)*`,
      };
    }
    return { reply: casualReply };
  }

  // 4. Other loan requests (Home, Business, Auto)
  if (classification.intent === "OTHER_LOAN_REQUEST" && !isEligibleFlowActive) {
    return {
      reply: `We currently provide multi-bank automated eligibility assessments for **Personal Loans** across 23 partner banks based on their official Master Policies. For **${classification.loanType || "Home/Business"}** loans, please connect with a bank manager or let us know if you would like to evaluate your personal loan eligibility!`,
    };
  }

  // 5. Only genuine loan/eligibility intent (or answering a question in an active flow) starts or continues the eligibility flow
  if (
    classification.intent === "PERSONAL_LOAN_REQUEST" ||
    (isEligibleFlowActive && classification.intent === "PROVIDE_INFORMATION")
  ) {
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

  // 6. Explicit searches (Bank Manager, Company Rating, Policy Guidelines, EMI Calculation)
  const agentResult = await runToolCallingAgent(message, requestedModel);
  const result: AgentResult = { reply: agentResult.reply };
  if (agentResult.bankData) result.bankData = agentResult.bankData;
  if (agentResult.companyData) result.companyData = agentResult.companyData;
  if (agentResult.companyQuery) result.companyQuery = agentResult.companyQuery;
  return result;
}
