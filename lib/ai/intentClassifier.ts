// lib/ai/intentClassifier.ts
import { parseFinancialAmount } from "@/lib/dynamicEligibilityEngine";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const LLM_TIMEOUT_MS = 25000;

export type UserIntentType =
  | "PERSONAL_LOAN_REQUEST"
  | "OTHER_LOAN_REQUEST"
  | "BANK_MANAGER_SEARCH"
  | "COMPANY_SEARCH"
  | "POLICY_INQUIRY"
  | "EMI_CALCULATION"
  | "GREETING"
  | "CANCEL_RESET"
  | "PROVIDE_INFORMATION"
  | "GENERAL_INQUIRY";

export interface ExtractedEntities {
  companyName?: string;
  monthlyIncome?: number;
  loanAmount?: number;
  tenureMonths?: number;
  cibil?: number;
  existingEmi?: number;
  age?: number;
  employmentType?: string;
  loanType?: string;
  targetBank?: string;
  city?: string;
}

export interface IntentClassificationResult {
  intent: UserIntentType;
  confidence: number;
  loanType: string;
  extracted: ExtractedEntities;
  rawResponse?: string;
}

/**
 * Strips reasoning tokens or thinking process preamble often emitted by free models.
 */
function cleanLlmJsonOutput(raw: string): string {
  let cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^Here('s| is) a thinking process[\s\S]*?\n\n/gi, "")
    .replace(/^Thinking Process:[\s\S]*?\n\n/gi, "")
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
 * Strictly uses the LLM to understand what the user wants without hardcoded phrases.
 */
export async function classifyIntentWithLLM(
  userMessage: string,
  context?: {
    isFlowActive?: boolean;
    expectedField?: string;
    recentMessages?: Array<{ role: string; content: string }>;
  },
  modelOverride?: string
): Promise<IntentClassificationResult> {
  const model = modelOverride || OPENROUTER_MODEL;
  const messageText = String(userMessage || "").trim();

  if (!messageText) {
    return {
      intent: "GENERAL_INQUIRY",
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
        `Your task is to analyze the user's message semantically and return a strictly valid JSON object.\n\n` +
        `Possible intents:\n` +
        `- "PERSONAL_LOAN_REQUEST": User explicitly asks to check eligibility for a personal loan, wants a personal loan, applies for a personal loan, or inquires about personal borrowing. (CRITICAL: Casual messages, hellos, and greetings are NEVER personal loan requests).\n` +
        `- "OTHER_LOAN_REQUEST": User explicitly asks for Home Loan, Business Loan, Car / Auto Loan, or Education Loan.\n` +
        `- "BANK_MANAGER_SEARCH": User seeks contact details, phone numbers, email addresses, or branch directory for bank managers or representatives.\n` +
        `- "COMPANY_SEARCH": User asks whether their corporate employer is listed or what category (Cat A, Elite, Diamond) their company has.\n` +
        `- "POLICY_INQUIRY": User asks specific questions about bank policies (e.g. CIBIL cutoffs, FOIR percentage, interest rates, age limits).\n` +
        `- "EMI_CALCULATION": User asks to calculate monthly EMI for specific loan amount, rate, and tenure.\n` +
        `- "GREETING": User is saying hello, hi, good morning, hey, greetings, hi there, hello there, namaste, etc. (CRITICAL: Greetings are NEVER loan requests or company searches).\n` +
        `- "CANCEL_RESET": User wants to cancel, reset, restart, or start over.\n` +
        `- "PROVIDE_INFORMATION": User is providing answers or profile information (e.g., providing company name, salary, cibil, etc.) in an ongoing conversation.\n` +
        `- "GENERAL_INQUIRY": Casual pleasantries, small talk ("how are you", "what can you do", "who are you", "tell me about yourself", "thanks", "ok"), or questions about the bot capabilities.\n\n` +
        `Context: Flow is currently ${context?.isFlowActive ? `ACTIVE (expecting: ${context?.expectedField || "next detail"})` : "INACTIVE"}.\n\n` +
        `Entity Extraction: Extract any of the following if explicitly mentioned:\n` +
        `- companyName: employer or corporate name (DO NOT assign greetings, casual phrases, numbers, or financial amounts as company name)\n` +
        `- monthlyIncome: net monthly take-home salary in INR as a number\n` +
        `- loanAmount: loan amount needed in INR as a number\n` +
        `- tenureMonths: tenure in months (e.g., 3 years = 36) as a number\n` +
        `- cibil: credit score (300-900) as a number\n` +
        `- existingEmi: ongoing monthly loan EMIs in INR as a number (0 if says none/no loans)\n` +
        `- age: applicant age in years as a number\n` +
        `- employmentType: "Salaried" or "Self-Employed"\n` +
        `- loanType: "Personal Loan", "Home Loan", "Business Loan", "Auto Loan"\n` +
        `- targetBank: specific bank name if mentioned\n\n` +
        `Return JSON ONLY in this exact structure:\n` +
        `{\n` +
        `  "intent": "<ONE_OF_THE_INTENTS_ABOVE>",\n` +
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
        `    "employmentType": null,\n` +
        `    "targetBank": null\n` +
        `  }\n` +
        `}`
    },
    {
      role: "user",
      content: messageText
    }
  ];

  if (OPENROUTER_API_KEY) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
          max_tokens: 300,
          temperature: 0.1,
          messages: prompt,
        }),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const cleaned = cleanLlmJsonOutput(content);
          const parsed = JSON.parse(cleaned);
          if (parsed && parsed.intent) {
            const extracted: ExtractedEntities = parsed.extracted || {};
            
            // Clean up any stringified numbers
            if (extracted.monthlyIncome && typeof extracted.monthlyIncome === "string") {
              extracted.monthlyIncome = parseFinancialAmount(extracted.monthlyIncome) || undefined;
            }
            if (extracted.loanAmount && typeof extracted.loanAmount === "string") {
              extracted.loanAmount = parseFinancialAmount(extracted.loanAmount) || undefined;
            }
            if (extracted.existingEmi && typeof extracted.existingEmi === "string") {
              extracted.existingEmi = parseFinancialAmount(extracted.existingEmi) || 0;
            }

            return {
              intent: parsed.intent,
              confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
              loanType: parsed.loanType || "Personal Loan",
              extracted,
              rawResponse: content,
            };
          }
        }
      }
    } catch (err: any) {
      console.warn("LLM intent classification call failed or timed out:", err?.message || err);
    }
  }

  // Resilient fallback parser strictly in case LLM network request fails
  return fallbackIntentParser(messageText, context);
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
  if (/^(cancel|reset|restart|stop|exit)$/i.test(norm)) {
    return {
      intent: "CANCEL_RESET",
      confidence: 0.95,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 2. Greetings (must be evaluated BEFORE active flow or loan intent)
  if (
    /^(hi|hello|hey|good\s*(morning|afternoon|evening|day)|howdy|greetings|namaste|hi\s*there|hello\s*there|hey\s*there|yo)\b/i.test(
      norm
    ) &&
    norm.length < 35
  ) {
    return {
      intent: "GREETING",
      confidence: 0.95,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 3. Casual conversational pleasantries / small talk / bot capabilities
  if (
    /^(how\s*are\s*you|hows\s*it\s*going|whats\s*up|what\s*can\s*you\s*do|who\s*are\s*you|tell\s*me\s*about\s*yourself|what\s*is\s*your\s*name|who\s*made\s*you|thanks|thank\s*you|thank\s*you\s*very\s*much|thanks\s*a\s*lot|ok|okay|sure|cool|great|awesome|understood|got\s*it|fine|bye|goodbye|see\s*you)\b/i.test(
      norm
    )
  ) {
    return {
      intent: "GENERAL_INQUIRY",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 4. If an active eligibility session is expecting a specific field and message is an answer
  if (context?.isFlowActive) {
    return {
      intent: "PROVIDE_INFORMATION",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 5. Official bank manager contact searches
  if (/(?:manager|contact|phone|mobile|email|branch\s*head|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b)/i.test(norm)) {
    return {
      intent: "BANK_MANAGER_SEARCH",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 6. Company listing / category rating queries
  if (/(?:company|employer|category|rating|listing|tier|listed)/i.test(norm) && !/loan|borrow/i.test(norm)) {
    return {
      intent: "COMPANY_SEARCH",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 7. Non-personal loan requests
  if (/(?:home\s*loan|housing\s*loan)/i.test(norm)) {
    return {
      intent: "OTHER_LOAN_REQUEST",
      confidence: 0.9,
      loanType: "Home Loan",
      extracted: { loanType: "Home Loan" },
    };
  }

  if (/(?:business\s*loan)/i.test(norm)) {
    return {
      intent: "OTHER_LOAN_REQUEST",
      confidence: 0.9,
      loanType: "Business Loan",
      extracted: { loanType: "Business Loan" },
    };
  }

  if (/(?:car\s*loan|auto\s*loan|vehicle\s*loan)/i.test(norm)) {
    return {
      intent: "OTHER_LOAN_REQUEST",
      confidence: 0.9,
      loanType: "Auto Loan",
      extracted: { loanType: "Auto Loan" },
    };
  }

  // 8. Genuine personal loan / borrowing / eligibility requests
  if (/(?:personal\s*loan|loan|borrow|need\s*money|eligib)/i.test(norm)) {
    return {
      intent: "PERSONAL_LOAN_REQUEST",
      confidence: 0.85,
      loanType: "Personal Loan",
      extracted: { loanType: "Personal Loan" },
    };
  }

  return {
    intent: "GENERAL_INQUIRY",
    confidence: 0.7,
    loanType: "Personal Loan",
    extracted: {},
  };
}
