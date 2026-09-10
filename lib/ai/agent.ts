// lib/ai/agent.ts

import pool from "@/lib/db";
import { searchBankManager, formatManagers } from "@/lib/bankSearch";
import { searchCompany, formatCompanyResponse } from "@/lib/companySearch";
import {
  processEligibilityFlow,
  evaluateEligibilityFromTool,
  calculateEmi,
  formatEmiResult,
} from "@/lib/eligibilityWizard";

/**
 * Maximum time we wait for the LLM to understand a user message and decide
 * what to do, or to summarize a tool result. The free model can take 30-40s
 * when it emits reasoning tokens, so 60s gives it room to respond while still
 * bounding the request.
 */
const LLM_TIMEOUT_MS = 60000;

const { getConversationState } = require("@/services/assistantFlowService");

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
    // LLM unavailable — run deterministic searches to get verified data, then
    // let the LLM explain it if it comes back; otherwise return the raw data.
    const isManagerQuery = /manager|contact|phone|mobile|email|number|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b|branch manager|contact details/i.test(userMessage);

    const cityMatch = userMessage.match(/\bin\s+([A-Za-z\s]+?)\s*(?:for|$|\.|,|\b)/i);
    const city = cityMatch ? cityMatch[1].trim() : null;

    // BASIC LOAN/EMI QUESTIONS: never trigger banking/company tool calls
    const isBasicLoanEmiQuery: boolean =
      /(emi|emi\s+calculator|calculate.*emi|emi.*amount|what.*emi|how.*emi)/i.test(userMessage) ||
      /(loan.*interest|interest.*rate|rate.*loan|loan.*rate)/i.test(userMessage) ||
      /(how.*much.*loan|loan.*how.*much|max.*loan|loan.*max)/i.test(userMessage) ||
      /(personal.*loan.*eligib|eligib.*personal.*loan)/i.test(userMessage) ||
      /(for\s+\d+\s+months?)/i.test(userMessage);

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
    const bankName = bankMatch ? bankMatch[0].toUpperCase() : undefined;
    if (bankName) {
      filters.bank_name = bankName;
    }

    if (city) {
      filters.city = city;
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
    if (!fallbackData && (isCompanyQuery || (!isManagerQuery && !isPolicyQuery && userMessage.trim().length >= 2))) {
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
      } else if (isCompanyQuery) {
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
  const compMatch = norm.match(/(?:working\s*at|company|employer|at)\s+([A-Za-z0-9\s&]+?)(?=\s+(?:salary|cibil|emi|income|can|is|with)|$)/i);
  if (compMatch) {
    const candidate = compMatch[1].trim();
    if (candidate.length > 2 && !/personal|loan|icici|hdfc|axis|sbi|kotak|salary|cibil|emi/i.test(candidate)) {
      company = candidate;
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

export async function runCentralAgent(opts: {
  message: string;
  conversationId: string;
  model?: string;
}): Promise<AgentResult> {
  const { message, conversationId, model: requestedModel } = opts;

  // Simple greetings (hi, hello, hey, good morning, etc.) return a natural
  // greeting without calling any tools.
  if (isSimpleGreeting(message)) {
    return { reply: getGreetingReply(message) };
  }

  // If user only says "loan", ask for loan type
  const normalizedMsg = String(message || "").toLowerCase().trim();
  if (normalizedMsg === "loan" || normalizedMsg === "loans") {
    return {
      reply: "Sure. What type of loan do you need—Personal, Home, Business, or Car?"
    };
  }

  // Loan intent detection: when the user expresses intent for a personal loan,
  // start (or continue) a lightweight eligibility flow that asks for loan
  // amount, monthly salary, tenure, and CIBIL score — WITHOUT searching
  // company data. We detect the intent via keyword matching and then use the
  // deterministic eligibility engine against active policy_rules +
  // policy_versions tables to evaluate the answer.
  const lowerMessage = normalizedMsg;
  const isLoanIntentMsg = /(?:want|need|looking|interested|apply)\s+(?:a\s+|for\s+)?personal\s*loan|personal\s*loan\s*(?:eligibility|check|apply|needed)|\bi\s+want\s+(?:a\s+)?personal\s*loan|\bget\s+(?:a\s+)?personal\s*loan|\bcheck\s+loan\s+eligibility|\bloan\s+eligibility|\bemi\s+calculator|\bcalculate\s+emi|\bi\s+need\s+(?:a\s+)?loan\b|need\s+a\s+loan|\bi\s+want\s+to\s+check\s+eligibility\s+for\s+(?:a\s+)?personal\s*loan|\bi\s+want\s+to\s+check\s+my\s+eligibility\s+for\s+(?:a\s+)?personal\s*loan|\bi\s+want\s+to\s+check\s+loan\s+eligibility|\bcan\s+i\s+get\s+(?:a\s+)?personal\s*loan|\bam\s+i\s+eligible\s+for\s+(?:a\s+)?personal\s*loan|\bhow\s+to\s+get\s+(?:a\s+)?personal\s*loan|\bapply\s+for\s+(?:a\s+)?personal\s*loan|\bpersonal\s+loan\s+eligibility\b|\bfor\s+\d+\s+months?\b/i.test(lowerMessage);

  if (isLoanIntentMsg) {
    let reply = "";

    // Check for existing loan flow state via the eligibility wizard
    try {
      const activeState = await getConversationState(pool, conversationId);
      if (activeState && activeState.in_eligibility_flow) {
        // An eligibility flow is already in progress; let the wizard continue.
        const wizardResult = await processEligibilityFlow(
          conversationId,
          message,
          requestedModel,
          async (msg: string, model?: string, context?: string, prompt?: string) => {
            const agentRes = await runToolCallingAgent(msg, model, context, prompt);
            return agentRes.reply;
          }
        );
        const result: AgentResult = { reply: wizardResult.reply };
        if ((wizardResult as any).companyData) result.companyData = (wizardResult as any).companyData;
        return result;
      }
    } catch (e) {}

    // No active flow — start a lightweight loan flow from conversation state
    try {
      const { createLoanIntentFlow } = require("../eligibilityWizard");
      const flowResult = await createLoanIntentFlow(pool, conversationId, message);
      reply = flowResult.reply || "";
      if (reply) {
        const result: AgentResult = { reply };
        return result;
      }
    } catch (e) {
      console.error("Loan intent flow error:", e);
    }
  }

  // State-based check: if the user is already in an active eligibility flow,
  // continue the wizard. This is a conversation state, not an intent check —
  // the LLM always handles the user's message first and delegates to the wizard.
  const activeState = await getConversationState(pool, conversationId);
  if (activeState && activeState.in_eligibility_flow) {
    const wizardResult = await processEligibilityFlow(
      conversationId,
      message,
      requestedModel,
      async (msg: string, model?: string, context?: string, prompt?: string) => {
        const agentRes = await runToolCallingAgent(msg, model, context, prompt);
        return agentRes.reply;
      }
    );
    const result: AgentResult = { reply: wizardResult.reply };
    if ((wizardResult as any).companyData) result.companyData = (wizardResult as any).companyData;
    return result;
  }

  // Every other message goes to the LLM first — the LLM understands the
  // message and decides what to do via tool calls.
  const agentResult = await runToolCallingAgent(message, requestedModel);
  const result: AgentResult = { reply: agentResult.reply };
  if (agentResult.bankData) result.bankData = agentResult.bankData;
  if (agentResult.companyData) result.companyData = agentResult.companyData;
  if (agentResult.companyQuery) result.companyQuery = agentResult.companyQuery;
  return result;
}
