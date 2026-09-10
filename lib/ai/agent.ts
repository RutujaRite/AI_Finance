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
import { getResolvedMasterPolicies } from "@/lib/masterPolicies";
import { getMasterPolicyFileContent } from "@/lib/masterPolicyParser";

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
                  `You are CreditWise AI, a verified banking and policy intelligence assistant.\n` +
                  `The user is asking a question about ${matchedBank.bank_name}'s Master Policy: "${userMessage}".\n\n` +
                  `STRICT MASTER POLICY AUDIT RULES:\n` +
                  `- Answer STRICTLY and ONLY based on the official ${matchedBank.bank_name} Master Policy text provided below.\n` +
                  `- Do NOT guess, invent criteria, use defaults, or borrow rules from any other bank.\n` +
                  `- For CIBIL: Distinguish pricing bands from absolute approval cutoffs. If a value is not explicitly defined in the Master Policy, state clearly that it is not specified in ${matchedBank.bank_name}'s Master Policy.\n` +
                  `- For Tenure & FOIR: Quote the exact category-wise figures from the Master Policy.\n` +
                  `- Format your answer in clean GitHub Markdown without thinking preambles.\n\n` +
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
            return stripReasoningPreamble(content.trim());
          }
        }
      } catch (e) {
        console.warn(`[Bank Policy LLM] Failed with model ${model}:`, e);
      }
    }
  }

  return extractPolicyAnswerFromLines(policyContent, userMessage, matchedBank.bank_name);
}

function extractPolicyAnswerFromLines(policyContent: string, question: string, bankName: string): string {
  const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const q = question.toLowerCase();
  const keywords: string[] = [];
  if (/cibil|credit\s*score|cutoff/i.test(q)) keywords.push("cibil", "credit score", "bureau", "cutoff");
  if (/tenure|tenor|duration/i.test(q)) keywords.push("tenure", "tenor", "months", "years");
  if (/foir|dbr|obligation/i.test(q)) keywords.push("foir", "dbr", "obligation");
  if (/salary|income|nmi|nth/i.test(q)) keywords.push("salary", "income", "nmi", "nth");
  if (/age/i.test(q)) keywords.push("age");
  if (/roi|interest|rate/i.test(q)) keywords.push("roi", "interest", "pricing", "rate");

  if (keywords.length === 0) {
    return `Found the official Master Policy for ${bankName}, but could not identify the specific criterion asked.`;
  }

  const matching = lines.filter((l) => {
    const lower = l.toLowerCase();
    return keywords.some((k) => lower.includes(k));
  });

  if (matching.length === 0) {
    return `No explicit mention of "${question}" was found in the official Master Policy for ${bankName}.`;
  }

  const clean = matching.slice(0, 8).map((l) => (l.length > 200 ? l.slice(0, 200) + "..." : l));
  return `### 🏦 ${bankName} Master Policy Guidelines\n\n` + clean.map((l) => `• ${l}`).join("\n");
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

  if (typeof classification.extracted?.monthlyIncome === "number" && classification.extracted.monthlyIncome > 0) {
    applicant.monthlyIncome = classification.extracted.monthlyIncome;
    updatedFields.push(`Monthly Salary to ₹${applicant.monthlyIncome.toLocaleString("en-IN")}`);
  }
  if (typeof classification.extracted?.loanAmount === "number" && classification.extracted.loanAmount > 0) {
    applicant.loanAmount = classification.extracted.loanAmount;
    updatedFields.push(`Loan Amount to ₹${applicant.loanAmount.toLocaleString("en-IN")}`);
  }
  if (typeof classification.extracted?.tenureMonths === "number" && classification.extracted.tenureMonths > 0) {
    applicant.tenureMonths = classification.extracted.tenureMonths;
    updatedFields.push(`Tenure to ${applicant.tenureMonths} months`);
  }
  if (typeof classification.extracted?.cibil === "number" && classification.extracted.cibil > 0) {
    applicant.cibil = classification.extracted.cibil;
    updatedFields.push(`CIBIL Score to ${applicant.cibil}`);
  }
  if (typeof classification.extracted?.existingEmi === "number") {
    applicant.existingEmi = classification.extracted.existingEmi;
    updatedFields.push(`Existing Monthly EMIs to ₹${applicant.existingEmi.toLocaleString("en-IN")}`);
  }
  if (typeof classification.extracted?.age === "number" && classification.extracted.age > 0) {
    applicant.age = classification.extracted.age;
    updatedFields.push(`Age to ${applicant.age} years`);
  }
  if (typeof classification.extracted?.companyName === "string" && !isInvalidCompanyName(classification.extracted.companyName)) {
    const resolved = await resolveCompanyCategories(classification.extracted.companyName);
    applicant.companyName = resolved.matchedName || classification.extracted.companyName;
    updatedFields.push(`Employer to ${applicant.companyName}`);
  }

  // Complement with regex parsing from message if needed
  const regexUpdated = extractApplicantDetails(userMessage, applicant, []);
  if (
    typeof regexUpdated.monthlyIncome === "number" &&
    regexUpdated.monthlyIncome > 0 &&
    typeof classification.extracted?.monthlyIncome !== "number" &&
    regexUpdated.monthlyIncome !== applicant.monthlyIncome
  ) {
    applicant.monthlyIncome = regexUpdated.monthlyIncome;
    updatedFields.push(`Monthly Salary to ₹${applicant.monthlyIncome.toLocaleString("en-IN")}`);
  }
  if (
    typeof regexUpdated.loanAmount === "number" &&
    regexUpdated.loanAmount > 0 &&
    typeof classification.extracted?.loanAmount !== "number" &&
    regexUpdated.loanAmount !== applicant.loanAmount
  ) {
    applicant.loanAmount = regexUpdated.loanAmount;
    updatedFields.push(`Loan Amount to ₹${applicant.loanAmount.toLocaleString("en-IN")}`);
  }
  if (
    typeof regexUpdated.tenureMonths === "number" &&
    regexUpdated.tenureMonths > 0 &&
    typeof classification.extracted?.tenureMonths !== "number" &&
    regexUpdated.tenureMonths !== applicant.tenureMonths
  ) {
    applicant.tenureMonths = regexUpdated.tenureMonths;
    updatedFields.push(`Tenure to ${applicant.tenureMonths} months`);
  }
  if (
    typeof regexUpdated.cibil === "number" &&
    regexUpdated.cibil > 0 &&
    typeof classification.extracted?.cibil !== "number" &&
    regexUpdated.cibil !== applicant.cibil
  ) {
    applicant.cibil = regexUpdated.cibil;
    updatedFields.push(`CIBIL Score to ${applicant.cibil}`);
  }
  if (
    typeof regexUpdated.existingEmi === "number" &&
    typeof classification.extracted?.existingEmi !== "number" &&
    regexUpdated.existingEmi !== applicant.existingEmi
  ) {
    applicant.existingEmi = regexUpdated.existingEmi;
    updatedFields.push(`Existing Monthly EMIs to ₹${applicant.existingEmi.toLocaleString("en-IN")}`);
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

