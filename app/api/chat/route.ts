/**
 * Chat API Route with Tool-Calling LLM Agent Architecture.
 * The LLM acts as the central reasoning engine, deciding when and how to invoke database search tools.
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { searchBankManager, formatManagers } from "@/lib/bankSearch";
import { searchCompany, formatCompanyResponse } from "@/lib/companySearch";
import { processEligibilityFlow, isLoanEligibilityIntent, calculateDeterministicEligibility } from "@/lib/eligibilityWizard";

const { getConversationState } = require("@/services/assistantFlowService");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowISO() {
  return new Date().toISOString();
}

/**
 * Definition of AI Assistant Tools for LLM Function Calling
 */
const ASSISTANT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_bank_managers",
      description: "Searches PostgreSQL bank_managers database table for official manager contacts. STRICT: Use ONLY when user explicitly asks for manager phone numbers, emails, or contact directory. DO NOT call for loan applications, salary checks, or policy questions.",
      parameters: {
        type: "object",
        properties: {
          bank_name: { type: "string", description: "Bank name e.g. ICICI, HDFC, Axis, Kotak, Piramal, Tata, Bajaj" },
          city: { type: "string", description: "City or location e.g. Pune, Mumbai, Ahmedabad, Delhi, Hyderabad" },
          role: { type: "string", description: "Manager role e.g. ASM, RSM, RM, SM, ZSM, RH" },
          manager_name: { type: "string", description: "Manager name if searching for specific person" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_company_eligibility",
      description: "Searches bank_company_data database table (339,510 corporate companies across 8 banks) for corporate employer listings, category ratings (Cat A, Elite, Diamond), and bank approval coverage.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Name of the corporate company e.g. Infosys, TCS, Wipro, Tata Motors" }
        },
        required: ["company_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_bank_policies",
      description: "Searches bank policy rulebooks for CIBIL score requirements, FOIR limits, salary criteria, interest rates, and loan norms.",
      parameters: {
        type: "object",
        properties: {
          bank_name: { type: "string", description: "Bank name if specific bank policy is requested" },
          question: { type: "string", description: "Policy criteria question topic" }
        },
        required: ["question"]
      }
    }
  }
];

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

/**
 * OpenRouter Tool-Calling Agent Execution Loop
 */
async function runToolCallingAgent(
  userMessage: string,
  modelOverride?: string,
  contextData?: string,
  customSystemPrompt?: string
): Promise<{ reply: string; bankData?: any; companyData?: any; companyQuery?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = modelOverride || process.env.OPENROUTER_MODEL || "openrouter/free";

  let bankData: any = null;
  let companyData: any = null;
  let companyQuery: string | undefined = undefined;

  // Direct LLM completion for report synthesis when contextData is provided
  if (contextData) {
    const sysPrompt = customSystemPrompt || "You are CreditWise AI Financial Assistant. Present a clear, executive Loan Eligibility Report based STRICTLY and ONLY on the provided deterministic policy data. Do NOT guess, assume, or fabricate any missing bank policies, interest rates, caps, or eligibility rules.";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "CreditWise AI",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
          temperature: 0.2,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: `Here is the deterministic loan policy evaluation data:\n\n${contextData}\n\nPlease generate a clean executive Loan Eligibility Summary report for the applicant based strictly on this data.` }
          ]
        }),
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && content.trim().length > 30) {
          return { reply: content };
        }
      }
    } catch (e) {
      console.warn("LLM report synthesis request failed, returning raw report:", e);
    }
    return { reply: contextData };
  }

  // Step 1: Top-Level Intent Classification
  const isManagerQuery = /manager|contact|phone|mobile|email|number|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b|branch manager|contact details/i.test(userMessage);
  const isCompanyQuery = /company|employer|category|rating|listing/i.test(userMessage) && !isManagerQuery;
  const isPolicyOrEligibilityQuery = /approval|eligibility|salary|cibil|emi|income|foir|interest|roi|tenure|policy|rate|multiplier|assessment|summary|criteria/i.test(userMessage) && !isManagerQuery && !isCompanyQuery;

  // Handle Bank Manager Searches Directly
  if (isManagerQuery) {
    const mgrResults = await searchBankManager({ query: userMessage });
    if (mgrResults && mgrResults.length > 0) {
      return { reply: formatManagers(mgrResults, userMessage), bankData: mgrResults };
    }
  }

  // Handle Corporate Company Searches Directly (via keywords or direct company search)
  if (isCompanyQuery || (!isManagerQuery && !isPolicyOrEligibilityQuery && userMessage.trim().length >= 2)) {
    const compRes = await searchCompany(userMessage);
    if (compRes?.found) {
      const formattedText = formatCompanyResponse(compRes);
      return { 
        reply: formattedText, 
        companyData: {
          company_name: compRes.primaryName,
          overview: compRes.overview,
          basic_info: compRes.basicInfo,
          financial_info: compRes.financialInfo,
          bank_records: compRes.bankRecords,
          needs_disambiguation: compRes.needsDisambiguation,
          candidates: compRes.candidates,
        },
        companyQuery: compRes.primaryName
      };
    }
    if (isCompanyQuery) {
      return { reply: `No corporate company records found matching "${userMessage}".` };
    }
  }

  // Handle Policy / Loan Approval Queries Directly
  if (isPolicyOrEligibilityQuery) {
    const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
    const bankName = bankMatch ? bankMatch[0].toUpperCase() : "";
    const policyResult = await searchPoliciesForBank(bankName, userMessage);
    return { reply: policyResult };
  }

  const systemContent = `You are CreditWise AI, an autonomous Financial Intelligence Assistant.
Analyze the user's intent with precision:
1. BANK POLICY & LOAN ELIGIBILITY: If the user asks about loan approval, eligibility, salary, CIBIL score, FOIR, interest rates, policy rules, or assessment summaries, invoke 'search_bank_policies' or analyze loan eligibility. NEVER return manager contact tables for policy or loan application questions.
2. CORPORATE COMPANY SEARCH: If the user searches for company loan listing or category rating (e.g. "Is Infosys approved?"), invoke 'search_company_eligibility'.
3. BANK MANAGER CONTACT DIRECTORY: STRICT RULE: Invoke 'search_bank_managers' ONLY AND EXCLUSIVELY if the user explicitly asks for manager phone numbers, emails, contacts, or branch hierarchy (e.g. "ICICI manager contact Mumbai"). If the user asks to apply for a loan or check eligibility, NEVER call 'search_bank_managers'.

STRICT RULE ON DATA & NO ASSUMPTIONS:
- Base ALL responses strictly on the verified bank policy files, company records, and database tables.
- DO NOT guess, assume, or fabricate any interest rates (ROI), loan caps, FOIR limits, or bank rules that are not explicitly present in the retrieved database records.
- If information is missing or not provided in the policy file, explicitly state that it is not specified in the bank's master policy.

Always format responses in professional Markdown with clear financial structure and emojis.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Step 1: Initial LLM reasoning with tool definitions
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "CreditWise AI",
      },
      body: JSON.stringify({
        model,
        max_tokens: 650,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userMessage }
        ],
        tools: ASSISTANT_TOOLS,
        tool_choice: "auto"
      }),
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (isPolicyOrEligibilityQuery) {
        const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
        const bankName = bankMatch ? bankMatch[0].toUpperCase() : "";
        const policyResult = await searchPoliciesForBank(bankName, userMessage);
        return { reply: policyResult };
      }
      if (isManagerQuery) {
        const results = await searchBankManager({ query: userMessage });
        return { reply: formatManagers(results, userMessage), bankData: results };
      }
      const compRes = await searchCompany(userMessage);
      if (compRes?.found) {
        const formattedText = formatCompanyResponse(compRes);
        return { 
          reply: formattedText, 
          companyData: {
            company_name: compRes.primaryName,
            overview: compRes.overview,
            basic_info: compRes.basicInfo,
            financial_info: compRes.financialInfo,
            bank_records: compRes.bankRecords,
            needs_disambiguation: compRes.needsDisambiguation,
            candidates: compRes.candidates,
          },
          companyQuery: compRes.primaryName
        };
      }
      return { reply: "Hello! I am CreditWise AI, your automated Banking & Financial Intelligence Assistant.\n\nI can help you:\n- **Evaluate Personal & Corporate Loan Eligibility** across 20+ partner banks\n- **Search 339,000+ Employer Listings** & bank category ratings (Cat A, Elite, Diamond)\n- **Check Bank Policy Guidelines** (CIBIL, FOIR, Multipliers & Income rules)\n- **Connect with Official Bank Managers** in your city\n\nHow can I assist you today?" };
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const messageObj = choice?.message;

    // If LLM returned a tool call, process it
    if (messageObj?.tool_calls && messageObj.tool_calls.length > 0) {
      const toolCall = messageObj.tool_calls[0];
      const fnName = toolCall.function.name;
      let args: any = {};
      try { args = JSON.parse(toolCall.function.arguments || "{}"); } catch (e) {}

      let toolResultContent = "";

      if (fnName === "search_bank_managers") {
        const mgrResults = await searchBankManager({ ...args, query: userMessage });
        bankData = mgrResults;
        toolResultContent = formatManagers(mgrResults, userMessage);
        return { reply: toolResultContent, bankData };
      } 
      else if (fnName === "search_company_eligibility") {
        const cName = args.company_name || userMessage;
        companyQuery = cName;
        const compRes = await searchCompany(cName);
        if (compRes?.found) {
          const formattedText = formatCompanyResponse(compRes);
          companyData = {
            company_name: compRes.primaryName,
            overview: compRes.overview,
            basic_info: compRes.basicInfo,
            financial_info: compRes.financialInfo,
            bank_records: compRes.bankRecords,
            needs_disambiguation: compRes.needsDisambiguation,
            candidates: compRes.candidates,
          };
          return { reply: formattedText, companyData, companyQuery };
        } else {
          toolResultContent = `**${cName}** does not appear to provide active loan offers from our existing banking partners.`;
          return { reply: toolResultContent, companyQuery };
        }
      }
      else if (fnName === "search_bank_policies") {
        toolResultContent = await searchPoliciesForBank(args.bank_name || "", args.question || userMessage);
        return { reply: toolResultContent };
      }
    }

    // Explicit Policy / Eligibility Handling
    if (isPolicyOrEligibilityQuery) {
      const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
      const bankName = bankMatch ? bankMatch[0].toUpperCase() : "";
      const policyResult = await searchPoliciesForBank(bankName, userMessage);
      return { reply: policyResult };
    }

    // Direct Database Execution ONLY for explicit Bank Manager Queries
    if (isManagerQuery) {
      const mgrResults = await searchBankManager({ query: userMessage });
      if (mgrResults && mgrResults.length > 0) {
        return { reply: formatManagers(mgrResults, userMessage), bankData: mgrResults };
      }
    }

    // If LLM returned text directly without tool calling and not a bank search
    if (messageObj?.content) {
      return { reply: messageObj.content };
    }

    // Safe Intent Fallback
    if (isPolicyOrEligibilityQuery) {
      const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
      const bankName = bankMatch ? bankMatch[0].toUpperCase() : "";
      const policyResult = await searchPoliciesForBank(bankName, userMessage);
      return { reply: policyResult };
    }

    if (isManagerQuery) {
      const fallbackResults = await searchBankManager({ query: userMessage });
      return { reply: formatManagers(fallbackResults, userMessage), bankData: fallbackResults };
    }
    return { reply: "Hello! I am CreditWise AI, your automated Banking & Financial Intelligence Assistant.\n\nI can help you:\n- **Evaluate Personal & Corporate Loan Eligibility** across 20+ partner banks\n- **Search 339,000+ Employer Listings** & bank category ratings (Cat A, Elite, Diamond)\n- **Check Bank Policy Guidelines** (CIBIL, FOIR, Multipliers & Income rules)\n- **Connect with Official Bank Managers** in your city\n\nHow can I assist you today?" };

  } catch (err) {
    console.error("Tool-Calling Agent error:", err);
    try {
      const compRes = await searchCompany(userMessage);
      if (compRes?.found) {
        const formattedText = formatCompanyResponse(compRes);
        return { 
          reply: formattedText, 
          companyData: {
            company_name: compRes.primaryName,
            overview: compRes.overview,
            basic_info: compRes.basicInfo,
            financial_info: compRes.financialInfo,
            bank_records: compRes.bankRecords,
            needs_disambiguation: compRes.needsDisambiguation,
            candidates: compRes.candidates,
          },
          companyQuery: compRes.primaryName
        };
      }
    } catch (e) {}

    if (isPolicyOrEligibilityQuery) {
      const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
      const bankName = bankMatch ? bankMatch[0].toUpperCase() : "";
      const policyResult = await searchPoliciesForBank(bankName, userMessage);
      return { reply: policyResult };
    }
    if (isManagerQuery) {
      const fallbackResults = await searchBankManager({ query: userMessage });
      return { reply: formatManagers(fallbackResults, userMessage), bankData: fallbackResults };
    }
    return { reply: "Hello! I am CreditWise AI, your automated Banking & Financial Intelligence Assistant.\n\nI can help you:\n- **Evaluate Personal & Corporate Loan Eligibility** across 20+ partner banks\n- **Search 339,000+ Employer Listings** & bank category ratings (Cat A, Elite, Diamond)\n- **Check Bank Policy Guidelines** (CIBIL, FOIR, Multipliers & Income rules)\n- **Connect with Official Bank Managers** in your city\n\nHow can I assist you today?" };
  }
}

export interface ExtractedApplicantJSON {
  bank?: string;
  loan_type?: string;
  salary?: number;
  cibil?: number;
  existing_emi?: number;
  employment_type?: string;
  company?: string;
}

function extractApplicantFromText(text: string): ExtractedApplicantJSON {
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

  return {
    bank,
    loan_type,
    salary,
    cibil,
    existing_emi,
    employment_type,
    company
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
  const body = await req.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  const conversationId = body.conversation_id || "default_session";
  const requestedModel = body.model;

  if (!message) {
    return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
  }

  try {
    let reply = "";
    let bankData: any = null;
    let companyData: any = null;
    let companyQuery: string | null = null;

    const extractedParams = extractApplicantFromText(message);
    const hasFinancialInputs = extractedParams.salary !== undefined || extractedParams.cibil !== undefined || extractedParams.existing_emi !== undefined;
    const isEligibilityQuery = /approval|eligibility|eligible|can i get|assessment/i.test(message);

    if (isEligibilityQuery && (!extractedParams.salary || !extractedParams.cibil || extractedParams.existing_emi === undefined)) {
      const missing: string[] = [];
      if (!extractedParams.salary) missing.push("Net Monthly Salary (e.g. ₹85,000)");
      if (!extractedParams.cibil) missing.push("CIBIL Score (e.g. 780)");
      if (extractedParams.existing_emi === undefined) missing.push("Existing Monthly EMIs (e.g. ₹15,000 or ₹0)");

      reply = `To calculate your deterministic loan eligibility for **${extractedParams.bank || "the requested bank"}**, please provide the following missing details:\n\n` +
        missing.map((m) => `• **${m}**`).join("\n") +
        `\n\n*(Note: Our system uses strict PostgreSQL policy calculations and does not guess missing financial values.)*`;
    }
    else if (hasFinancialInputs) {
      const calcResult = await calculateDeterministicEligibility({
        bankName: extractedParams.bank || "ICICI Bank",
        salary: extractedParams.salary,
        cibil: extractedParams.cibil,
        existingEmi: extractedParams.existing_emi,
        companyName: extractedParams.company,
        employmentType: extractedParams.employment_type || "Salaried",
        loanType: extractedParams.loan_type || "Personal"
      }, pool);

      reply = formatCalculatorResult(calcResult, extractedParams.bank || "ICICI Bank");
    }
    else {
      // Check if user is in interactive eligibility flow
      const activeState = await getConversationState(pool, conversationId);
      if ((activeState && activeState.in_eligibility_flow) || isLoanEligibilityIntent(message)) {
        const wizardResult = await processEligibilityFlow(
          conversationId,
          message,
          requestedModel,
          async (msg: string, model?: string, context?: string, prompt?: string) => {
            const agentRes = await runToolCallingAgent(msg, model, context, prompt);
            return agentRes.reply;
          }
        );
        reply = wizardResult.reply;
        if ((wizardResult as any).companyData) companyData = (wizardResult as any).companyData;
      } else {
        // Execute Central Tool-Calling LLM Reasoning Loop
        const agentResult = await runToolCallingAgent(message, requestedModel);
        reply = agentResult.reply;
        if (agentResult.bankData) bankData = agentResult.bankData;
        if (agentResult.companyData) companyData = agentResult.companyData;
        if (agentResult.companyQuery) companyQuery = agentResult.companyQuery;
      }
    }

    const aiMessage: any = {
      id: uid(),
      role: "ai",
      content: reply,
      timestamp: nowISO(),
    };
    if (companyData !== null) aiMessage.company_data = companyData;
    if (companyQuery !== null) aiMessage.company_query = companyQuery;
    if (bankData !== null) aiMessage.bank_data = bankData;

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      title: message.slice(0, 40) || "New Conversation",
      ai_message: aiMessage,
      user_message: { id: uid(), role: "user", content: message, timestamp: nowISO() },
    });
  } catch (err) {
    console.error("Chat API error", err);
    return NextResponse.json({ success: false, error: "Chat failed" });
  }
}
