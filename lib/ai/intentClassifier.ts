// lib/ai/intentClassifier.ts
import { parseFinancialAmount } from "@/lib/dynamicEligibilityEngine";

const getApiKey = () => process.env.OPENROUTER_API_KEY || "";
const getModel = () => (process.env.OPENROUTER_MODEL || "openrouter/auto").replace(/^["']|["']$/g, "").trim();
const LLM_TIMEOUT_MS = 12000;

export type UserIntentType =
  | "LOAN_ELIGIBILITY"
  | "CALCULATION"
  | "GENERAL_INFORMATION"
  | "CHANGING_DETAILS"
  | "GREETINGS"
  | "ANOTHER_TOPIC";

export interface ExtractedEntities {
  companyName?: string;
  monthlyIncome?: number;
  loanAmount?: number;
  tenureMonths?: number;
  cibil?: number;
  existingEmi?: number;
  age?: number;
  interestRate?: number;
  employmentType?: string;
  loanType?: string;
  targetBank?: string;
  city?: string;
  changeFields?: string[];
  questionTopic?: string;
}

export interface IntentClassificationResult {
  intent: UserIntentType;
  subIntent?: string;
  confidence: number;
  loanType: string;
  extracted: ExtractedEntities;
  rawResponse?: string;
}

/**
 * Strips reasoning tokens, thinking process preamble, or markdown fences emitted by LLMs.
 */
export function cleanLlmJsonOutput(raw: string): string {
  if (!raw) return "{}";
  let cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^Here('s| is) a thinking process[\s\S]*?\n\n/gi, "")
    .replace(/^Thinking Process:[\s\S]*?\n\n/gi, "")
    .replace(/^User Safety:[^\n]*\n+/gi, "")
    .trim();

  // Extract json markdown fence if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Find the first { and last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/**
 * Classifies user intent using OpenRouter LLM.
 * Strictly analyzes every user message semantically before eligibility processing.
 */
export async function classifyIntentWithLLM(
  userMessage: string,
  context?: {
    isFlowActive?: boolean;
    expectedField?: string;
    existingApplicant?: any;
    recentMessages?: Array<{ role: string; content: string }>;
  },
  modelOverride?: string
): Promise<IntentClassificationResult> {
  const primaryModel = modelOverride || getModel();
  const messageText = String(userMessage || "").trim();

  if (!messageText) {
    return {
      intent: "ANOTHER_TOPIC",
      subIntent: "EMPTY",
      confidence: 1.0,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  const prompt = [
    {
      role: "system",
      content:
        `You are the Intent Classification and Entity Extraction Engine for CreditWise AI, a banking and loan intelligence platform.\n` +
        `Your task is to analyze the user's message semantically and classify it into EXACTLY ONE of the following 6 intent categories:\n\n` +
        `1. "LOAN_ELIGIBILITY":\n` +
        `   - User asks to check personal loan eligibility, apply for a personal loan, start an eligibility assessment, OR is providing personal profile details (e.g. employer name, monthly salary, CIBIL, loan amount, tenure, EMIs, age) to continue an in-progress eligibility assessment.\n\n` +
        `2. "CALCULATION":\n` +
        `   - User asks to calculate monthly EMI, interest payable, installment, or borrowing capacity (e.g. "What will my EMI be for 10 lakhs at 11% for 5 years?", "Calculate EMI for 500000", "What is my monthly installment?"). Supports partial calculations where only some numbers are given.\n\n` +
        `3. "GENERAL_INFORMATION":\n` +
        `   - User asks questions about bank policies (e.g. CIBIL cutoffs, FOIR percentage, interest rates, age limits), official bank manager contacts / branch directory, employer corporate listings or category ratings (Super Cat A, Cat A, Elite, Diamond), general banking concepts (e.g. "What is FOIR?", "How does personal loan interest work?"), or assistant capabilities / FAQs.\n\n` +
        `4. "CHANGING_DETAILS":\n` +
        `   - User explicitly asks to change, update, modify, or correct previously provided profile details (e.g. "Change my salary to 2 lakhs", "Actually my CIBIL is 750", "Update my company to TCS", "Make tenure 3 years", "I want to change loan amount to 15L").\n\n` +
        `5. "GREETINGS":\n` +
        `   - User is saying hello, hi, hey, good morning, greetings, namaste, etc. (CRITICAL: Greetings are NEVER loan requests or company searches).\n\n` +
        `6. "ANOTHER_TOPIC":\n` +
        `   - User is asking an off-topic question, making casual pleasantries / small talk ("who made you", "thank you", "goodbye"), or requesting to cancel/reset ("cancel", "reset", "start over").\n\n` +
        `CRITICAL CONVERSATIONAL RULES:\n` +
        `- NEVER use hardcoded keyword matching. Understand the user's semantic intent from the message.\n` +
        `- If an eligibility conversation is active, but the user asks a policy question, an EMI calculation, a manager contact, a general definition, or asks to change a detail, you MUST classify that specific intent ("GENERAL_INFORMATION", "CALCULATION", "CHANGING_DETAILS"), NOT "LOAN_ELIGIBILITY".\n` +
        `- Only classify as "LOAN_ELIGIBILITY" if the user is directly answering the expected eligibility question or asking to proceed with eligibility evaluation.\n\n` +
        `Context:\n` +
        `- Eligibility Flow Active: ${context?.isFlowActive ? "true" : "false"}\n` +
        `- Expected Field: ${context?.expectedField || "none"}\n` +
        `- Known Applicant Profile: ${JSON.stringify(context?.existingApplicant || {})}\n\n` +
        `Entity Extraction (extract whatever parameters are explicitly mentioned):\n` +
        `- companyName: employer or corporate name (DO NOT assign greetings, numbers, or amounts as company name)\n` +
        `- monthlyIncome: net monthly salary in INR as a number\n` +
        `- loanAmount: loan amount needed in INR as a number\n` +
        `- tenureMonths: tenure in months (e.g. 3 years = 36) as a number\n` +
        `- cibil: credit score (300-900) as a number\n` +
        `- existingEmi: ongoing monthly loan EMIs in INR as a number (0 if none/no loans)\n` +
        `- age: applicant age in years as a number\n` +
        `- interestRate: annual interest rate percentage as a number (e.g. 10.5)\n` +
        `- targetBank: specific bank name if mentioned (e.g. HDFC, ICICI, Axis)\n` +
        `- city: city name if mentioned (e.g. Pune, Mumbai)\n` +
        `- changeFields: array of field names being changed if intent is CHANGING_DETAILS (e.g. ["monthlyIncome"])\n` +
        `- questionTopic: topic of the question if GENERAL_INFORMATION\n\n` +
        `Return strictly valid JSON only in this exact format:\n` +
        `{\n` +
        `  "intent": "LOAN_ELIGIBILITY" | "CALCULATION" | "GENERAL_INFORMATION" | "CHANGING_DETAILS" | "GREETINGS" | "ANOTHER_TOPIC",\n` +
        `  "subIntent": "...",\n` +
        `  "confidence": 0.95,\n` +
        `  "loanType": "Personal Loan",\n` +
        `  "extracted": {\n` +
        `    "companyName": null,\n` +
        `    "monthlyIncome": null,\n` +
        `    "loanAmount": null,\n` +
        `    "tenureMonths": null,\n` +
        `    "cibil": null,\n` +
        `    "existingEmi": null,\n` +
        `    "age": null,\n` +
        `    "interestRate": null,\n` +
        `    "targetBank": null,\n` +
        `    "city": null,\n` +
        `    "changeFields": [],\n` +
        `    "questionTopic": null\n` +
        `  }\n` +
        `}`
    },
    {
      role: "user",
      content: messageText
    }
  ];

  const apiKey = getApiKey();
  if (apiKey) {
    const rawEnv = getModel();
    const modelsToTry = [
      primaryModel,
      rawEnv,
      "openrouter/auto",
      "openrouter/free",
    ].filter(Boolean) as string[];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            max_tokens: 600,
            temperature: 0.1,
            messages: prompt,
          }),
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const content = json.choices?.[0]?.message?.content;
          if (content) {
            let parsed: any = null;
            try {
              const cleaned = cleanLlmJsonOutput(content);
              parsed = JSON.parse(cleaned);
            } catch {
              const intentMatch = content.match(/"intent"\s*:\s*"([A-Za-z_]+)"/i);
              if (intentMatch) {
                const topicMatch = content.match(/"questionTopic"\s*:\s*"([^"]+)"/i);
                const bankMatch = content.match(/"targetBank"\s*:\s*"([^"]+)"/i);
                parsed = {
                  intent: intentMatch[1],
                  extracted: {
                    questionTopic: topicMatch ? topicMatch[1] : undefined,
                    targetBank: bankMatch ? bankMatch[1] : undefined,
                  },
                };
              }
            }
            if (parsed && parsed.intent) {
              const normalizedIntent = normalizeIntentName(parsed.intent);
              const extracted: ExtractedEntities = parsed.extracted || {};

              // Normalize numeric fields if received as strings
              if (extracted.monthlyIncome && typeof extracted.monthlyIncome === "string") {
                extracted.monthlyIncome = parseFinancialAmount(extracted.monthlyIncome) || undefined;
              }
              if (extracted.loanAmount && typeof extracted.loanAmount === "string") {
                extracted.loanAmount = parseFinancialAmount(extracted.loanAmount) || undefined;
              }
              if (extracted.existingEmi && typeof extracted.existingEmi === "string") {
                extracted.existingEmi = parseFinancialAmount(extracted.existingEmi) || 0;
              }
              if (extracted.tenureMonths && typeof extracted.tenureMonths === "string") {
                const parsedTenure = parseInt(String(extracted.tenureMonths), 10);
                extracted.tenureMonths = !isNaN(parsedTenure) ? parsedTenure : undefined;
              }

              return {
                intent: normalizedIntent,
                subIntent: parsed.subIntent || parsed.sub_intent,
                confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.95,
                loanType: parsed.loanType || "Personal Loan",
                extracted,
                rawResponse: content,
              };
            }
          }
        }
      } catch (err: any) {
        console.warn(`LLM intent call with ${model} failed or timed out:`, err?.message || err);
      }
    }
  }

  // Resilient fallback parser strictly in case LLM network request fails
  return fallbackIntentParser(messageText, context);
}

/**
 * Normalizes any legacy or alternative intent names into the 6 canonical categories.
 */
function normalizeIntentName(raw: string): UserIntentType {
  const norm = String(raw || "").trim().toUpperCase();
  if (norm === "LOAN_ELIGIBILITY" || norm === "PERSONAL_LOAN_REQUEST" || norm === "PROVIDE_INFORMATION") {
    return "LOAN_ELIGIBILITY";
  }
  if (norm === "CALCULATION" || norm === "EMI_CALCULATION") {
    return "CALCULATION";
  }
  if (
    norm === "GENERAL_INFORMATION" ||
    norm === "POLICY_INQUIRY" ||
    norm === "BANK_MANAGER_SEARCH" ||
    norm === "COMPANY_SEARCH"
  ) {
    return "GENERAL_INFORMATION";
  }
  if (norm === "CHANGING_DETAILS") {
    return "CHANGING_DETAILS";
  }
  if (norm === "GREETINGS" || norm === "GREETING") {
    return "GREETINGS";
  }
  return "ANOTHER_TOPIC";
}

/**
 * Resilient fallback parser used ONLY if the LLM endpoint is unreachable.
 */
function fallbackIntentParser(
  text: string,
  context?: { isFlowActive?: boolean; expectedField?: string }
): IntentClassificationResult {
  const norm = text.toLowerCase().trim();

  // 1. Cancel / Reset commands
  if (/^(cancel|reset|restart|stop|exit)\b/i.test(norm)) {
    return {
      intent: "ANOTHER_TOPIC",
      subIntent: "CANCEL_RESET",
      confidence: 0.95,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 2. Greetings
  if (
    /^(hi|hello|hey|good\s*(morning|afternoon|evening|day)|howdy|greetings|namaste|hi\s*there|hello\s*there|hey\s*there|yo)\b/i.test(
      norm
    ) &&
    norm.length < 35
  ) {
    return {
      intent: "GREETINGS",
      confidence: 0.95,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 3. Changing details
  if (/^(?:change|update|modify|actually|correct|edit)\b/i.test(norm) || /(?:change|update|correct)\s+(?:my|the)/i.test(norm)) {
    return {
      intent: "CHANGING_DETAILS",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 4. Calculations (EMI, installment, interest)
  if (/(?:emi|calculate|installment|monthly\s*payment|interest\s*payable)/i.test(norm)) {
    return {
      intent: "CALCULATION",
      subIntent: "EMI_CALCULATION",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 5. Bank Manager, Company, Policy, or General Information queries
  if (
    /(?:manager|contact|phone|mobile|email|branch\s*head|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b)/i.test(norm) ||
    /(?:company|employer|category|rating|listing|tier|listed)/i.test(norm) ||
    /(?:cibil|cutoff|foir|policy|guideline|rule|multiplier|max\s*loan)/i.test(norm) ||
    /^(?:what|who|how|can\s*you|where|explain|tell\s*me)\b/i.test(norm)
  ) {
    return {
      intent: "GENERAL_INFORMATION",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 6. Casual pleasantries / small talk
  if (
    /^(how\s*are\s*you|hows\s*it\s*going|whats\s*up|what\s*can\s*you\s*do|who\s*are\s*you|tell\s*me\s*about\s*yourself|what\s*is\s*your\s*name|who\s*made\s*you|thanks|thank\s*you|thank\s*you\s*very\s*much|thanks\s*a\s*lot|ok|okay|sure|cool|great|awesome|understood|got\s*it|fine|bye|goodbye|see\s*you)\b/i.test(
      norm
    )
  ) {
    return {
      intent: "ANOTHER_TOPIC",
      subIntent: "CASUAL_CHAT",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 7. If an active eligibility session is expecting a specific field
  if (context?.isFlowActive) {
    return {
      intent: "LOAN_ELIGIBILITY",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 8. Default to Loan Eligibility if loan words present
  if (/(?:personal\s*loan|loan|borrow|need\s*money|eligib)/i.test(norm)) {
    return {
      intent: "LOAN_ELIGIBILITY",
      confidence: 0.85,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  return {
    intent: "ANOTHER_TOPIC",
    confidence: 0.7,
    loanType: "Personal Loan",
    extracted: {},
  };
}
