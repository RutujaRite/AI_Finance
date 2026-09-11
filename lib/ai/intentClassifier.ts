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
        `   - User asks to check personal loan eligibility, apply for a personal loan, start an eligibility assessment, OR expresses loan intent naturally (e.g. "I need a loan", "I want a personal loan", "I want to apply for a loan", "Can I get a loan?", "I need ₹5 lakh loan", "Need a personal loan", "Looking for a loan", "Can I get credit/loan?").\n` +
        `   - Also includes providing personal profile details (e.g. employer name, monthly salary, CIBIL, loan amount, tenure, EMIs, age) to advance an in-progress eligibility assessment.\n\n` +
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
        `- User phrases expressing personal loan intent like "I need a loan", "I want a personal loan", "I want to apply for a loan", "Can I get a loan?", "I need ₹5 lakh loan" MUST be classified as "LOAN_ELIGIBILITY", NOT "GENERAL_INFORMATION".\n` +
        `- If an eligibility conversation is active, but the user asks a policy question, an EMI calculation, a manager contact, a general definition, or asks to change a detail, you MUST classify that specific intent ("GENERAL_INFORMATION", "CALCULATION", "CHANGING_DETAILS"), NOT "LOAN_ELIGIBILITY".\n` +
        `- Only classify as "LOAN_ELIGIBILITY" if the user is expressing loan intent, directly answering the expected eligibility question, or asking to proceed with eligibility evaluation.\n\n` +
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
        `- employmentType: "Salaried" or "Self-Employed" if mentioned\n` +
        `- interestRate: annual interest rate percentage as a number (e.g. 10.5)\n` +
        `- targetBank: specific bank name if mentioned (e.g. HDFC, ICICI, Axis)\n` +
        `- city: city name if mentioned (e.g. Pune, Mumbai)\n` +
        `- changeFields: array of field names being changed if intent is CHANGING_DETAILS (e.g. ["monthlyIncome"])\n` +
        `- questionTopic: topic of the question if GENERAL_INFORMATION\n\n` +
        `CRITICAL DATA INTEGRITY & ENTITY EXTRACTION RULES:\n` +
        `- NEVER invent, default, guess, or assume entity values that are not explicitly stated in the user's message.\n` +
        `- Return null for any parameter not explicitly stated in the user message.\n` +
        `- NEVER copy or carry over unmentioned fields from "Known Applicant Profile" into extracted entities.\n` +
        `- If the user has not explicitly provided or asked about a CIBIL score, "cibil" MUST be null.\n` +
        `- When the intent is "CHANGING_DETAILS" (e.g. "Change salary to 1.2L"), ONLY extract the specific field(s) being changed, and list them in "changeFields" (e.g. ["monthlyIncome"]). All unmentioned fields in "extracted" MUST be null.\n\n` +
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
        `    "employmentType": null,\n` +
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
              if (extracted.existingEmi !== undefined && extracted.existingEmi !== null && typeof extracted.existingEmi === "string") {
                const parsedEmi = parseFinancialAmount(extracted.existingEmi);
                extracted.existingEmi = parsedEmi !== null ? parsedEmi : undefined;
              }
              if (extracted.tenureMonths && typeof extracted.tenureMonths === "string") {
                const parsedTenure = parseInt(String(extracted.tenureMonths), 10);
                extracted.tenureMonths = !isNaN(parsedTenure) ? parsedTenure : undefined;
              }
              if (typeof extracted.tenureMonths === "number" && extracted.tenureMonths >= 1 && extracted.tenureMonths <= 7) {
                extracted.tenureMonths = extracted.tenureMonths * 12;
              }
              if (extracted.cibil !== undefined && extracted.cibil !== null && typeof extracted.cibil === "string") {
                const parsedCibil = parseInt(String(extracted.cibil), 10);
                extracted.cibil = !isNaN(parsedCibil) ? parsedCibil : undefined;
              }
              if (typeof extracted.cibil === "number") {
                if (extracted.cibil !== 0 && (extracted.cibil < 300 || extracted.cibil > 900)) {
                  extracted.cibil = undefined;
                }
              }
              if (extracted.age && typeof extracted.age === "string") {
                const parsedAge = parseInt(String(extracted.age), 10);
                extracted.age = !isNaN(parsedAge) ? parsedAge : undefined;
              }
              if (extracted.employmentType && typeof extracted.employmentType === "string") {
                const normEmp = extracted.employmentType.toLowerCase();
                if (/self|business|proprietor|partner|freelanc|doctor|trader/i.test(normEmp)) {
                  extracted.employmentType = "Self-Employed";
                } else if (/salaried|job|pvt|corp|employee/i.test(normEmp)) {
                  extracted.employmentType = "Salaried";
                }
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

function isPersonalFieldMention(field: string, text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  switch (field) {
    case "cibil":
      return (
        /(?:cibil|credit\s*score|score\b|bureau)/i.test(lower) ||
        /\b[3-9]\d{2}\b/.test(lower)
      );
    case "monthlyIncome":
    case "salary":
      return /(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|nmi|nth|earning|earns?|makes?|\/mo|per\s*month)/i.test(lower);
    case "loanAmount":
      return /(?:loan|borrow|ticket|need|require|want)/i.test(lower) || /(?:rs\.?|₹)\s*\d+/i.test(lower) || /\b\d+\s*(?:lakhs?|lacs?|l\b|cr)/i.test(lower);
    case "tenureMonths":
    case "tenure":
      return /(?:tenure|duration|term|period)/i.test(lower) || /\b\d{1,2}\s*(?:years?|yrs?|months?)\b/i.test(lower);
    case "existingEmi":
    case "emi":
      return /(?:existing|current|other|ongoing)?\s*emi(?:s)?/i.test(lower) || /(?:no|zero|nil|0)\s*(?:existing\s*)?emi/i.test(lower) || /paying.*emi/i.test(lower);
    case "age":
      return /(?:age|aged)\b/i.test(lower) || /\b(?:years?\s*old|yr\s*old)\b/i.test(lower) || /(?:i\s*am|im)\s+\d{2}\b/i.test(lower);
    case "companyName":
      return /(?:work\s+at|works\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is|company|firm|employer)\b/i.test(lower);
    default:
      return false;
  }
}

/**
 * Extracts entities from raw text when using the fallback parser.
 */
function extractEntitiesFromText(
  text: string,
  context?: { isFlowActive?: boolean; expectedField?: string }
): ExtractedEntities {
  const extracted: ExtractedEntities = {};
  const norm = text.toLowerCase().trim();

  // 1. CIBIL score
  const cibilScoreMatch =
    text.match(/\b(?:cibil|credit\s*score|score)?\s*(?:is|to|=|:)?\s*([3-9]\d{2})\b/i) ||
    text.match(/\b([3-9]\d{2})\b/);
  if (cibilScoreMatch && (context?.expectedField === "cibil" || /(?:cibil|score|credit)/i.test(norm))) {
    const s = parseInt(cibilScoreMatch[1], 10);
    if (s >= 300 && s <= 900) {
      extracted.cibil = s;
    }
  } else if (context?.expectedField === "cibil" && /no|none|nil|zero|0|unknown|not\s*sure|don'?t\s*know/i.test(norm)) {
    extracted.cibil = 0;
  }

  // 2. Monthly Income
  const salMatch =
    text.match(
      /(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|net\s*pay)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr))?)\b/i
    ) ||
    text.match(
      /([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr))?)\s*(?:per\s*month|\/month|\/mo|monthly|salary|income)\b/i
    );
  if (salMatch) {
    const amt = parseFinancialAmount(salMatch[1]);
    if (amt && amt >= 5000) extracted.monthlyIncome = amt;
  } else if (context?.expectedField === "monthlyIncome") {
    const amt = parseFinancialAmount(text);
    if (amt && amt >= 5000) extracted.monthlyIncome = amt;
  }

  // 3. Loan Amount
  const loanMatch =
    text.match(
      /(?:loan\s*(?:amount|ticket|size)?|borrow|need|want|require)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr))?)\b/i
    ) ||
    text.match(/(?:rs\.?|₹)\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr))?)\s*(?:loan)?\b/i) ||
    text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|cr|crores?)\s+(?:loan|borrow)/i);
  if (loanMatch) {
    const amt = parseFinancialAmount(loanMatch[1] + (loanMatch[2] || ""));
    if (amt && amt >= 10000) extracted.loanAmount = amt;
  } else if (context?.expectedField === "loanAmount") {
    const amt = parseFinancialAmount(text);
    if (amt && amt >= 10000) extracted.loanAmount = amt;
  }

  // 4. Tenure
  const yrMatch = text.match(/\b(\d{1,2})\s*(?:years?|yrs?|yr|y\b)(?!\s*old)\b/i);
  if (yrMatch) {
    extracted.tenureMonths = parseInt(yrMatch[1], 10) * 12;
  } else {
    const moMatch = text.match(/\b(\d{1,3})\s*(?:months?|m\b)\b/i);
    if (moMatch) {
      extracted.tenureMonths = parseInt(moMatch[1], 10);
    } else if (context?.expectedField === "tenureMonths") {
      const numMatch = text.match(/\b(\d+)\b/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num >= 1 && num <= 7) extracted.tenureMonths = num * 12;
        else if (num >= 12 && num <= 360) extracted.tenureMonths = num;
      }
    }
  }

  // 5. Existing EMI
  if (/(?:no|0|zero|nil)\s*(?:existing\s*|current\s*|ongoing\s*)?(?:loan|emi)s?|no\s*loans/i.test(norm)) {
    extracted.existingEmi = 0;
  } else if (context?.expectedField === "existingEmi" && /none|zero|0|nil|no|nope/i.test(norm)) {
    extracted.existingEmi = 0;
  } else {
    const emiMatch = text.match(
      /(?:existing\s*emi|ongoing\s*emi|current\s*emi|emi)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*k)?)\b/i
    );
    if (emiMatch) {
      const amt = parseFinancialAmount(emiMatch[1]);
      if (amt !== null) extracted.existingEmi = amt;
    } else if (context?.expectedField === "existingEmi") {
      const amt = parseFinancialAmount(text);
      if (amt !== null) extracted.existingEmi = amt;
    }
  }

  // 6. Age
  const ageMatch =
    text.match(/\b(?:i\s*am|age\s*(?:is|to|=|:)?)\s*(\d{1,2})\s*(?:years?\s*old|yrs?\s*old)?\b/i) ||
    text.match(/\b(\d{1,2})\s*(?:years?\s*old|yrs?\s*old)\b/i);
  if (ageMatch) {
    const a = parseInt(ageMatch[1], 10);
    if (a >= 18 && a <= 85) extracted.age = a;
  } else if (context?.expectedField === "age") {
    const numMatch = text.match(/\b(1[89]|[2-7]\d)\b/);
    if (numMatch) extracted.age = parseInt(numMatch[1], 10);
  }

  // 7. Company Name
  const compMatch = text.match(
    /(?:work\s+at|works\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is)\s+([A-Za-z0-9\s&'.-]+?)(?=\s*[,;]|\s+(?:and|with|salary|cibil|age|loan|emi)|$)/i
  );
  if (compMatch) {
    extracted.companyName = compMatch[1].trim();
  } else if (context?.expectedField === "companyName" && text.length > 2 && text.length < 80) {
    extracted.companyName = text.trim();
  }

  // 8. Bank name if mentioned in text
  const bankMatch = text.match(/\b(hdfc|icici|axis|sbi|kotak|bajaj|tata|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|sbm|smfg|utkarsh|fibe|finnable|l&t|cholamandalam|aditya\s*birla)\b/i);
  if (bankMatch) {
    extracted.targetBank = bankMatch[1];
  }

  return extracted;
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
    norm.length < 35 &&
    !/(?:loan|borrow|foir|cibil|policy|emi|rate|interest|salary|\d+)/i.test(norm)
  ) {
    return {
      intent: "GREETINGS",
      confidence: 0.95,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 3. Changing details
  const isExplicitChange =
    /\b(?:change|update|modify|edit|correct|instead\s*of|rather\s*than)\b/i.test(norm) ||
    /(?:change|update|correct)\s+(?:my|the)/i.test(norm) ||
    /\bactually\s+(?:change|update|make|set|increase|decrease|reduce)\b/i.test(norm) ||
    (/\bactually\b/i.test(norm) && /(?:salary|loan|cibil|tenure|company|employer|emi|age|income)\b/i.test(norm) && !context?.isFlowActive);

  if (isExplicitChange) {
    const extracted = extractEntitiesFromText(text, context);
    const changeFields: string[] = [];
    if (extracted.monthlyIncome !== undefined) changeFields.push("monthlyIncome");
    if (extracted.loanAmount !== undefined) changeFields.push("loanAmount");
    if (extracted.tenureMonths !== undefined) changeFields.push("tenureMonths");
    if (extracted.cibil !== undefined) changeFields.push("cibil");
    if (extracted.existingEmi !== undefined) changeFields.push("existingEmi");
    if (extracted.age !== undefined) changeFields.push("age");
    if (extracted.companyName !== undefined) changeFields.push("companyName");
    if (extracted.employmentType !== undefined) changeFields.push("employmentType");
    extracted.changeFields = changeFields;

    return {
      intent: "CHANGING_DETAILS",
      confidence: 0.95,
      loanType: "Personal Loan",
      extracted,
    };
  }

  // 4. Calculations (EMI, installment, interest)
  const isCalculation =
    /(?:calculate|compute)\s+(?:my\s+)?(?:emi|installment|interest|loan)/i.test(norm) ||
    /(?:what\s+(?:is|will\s+be)\s+my\s+emi|how\s+much\s+(?:is\s+the\s+)?emi|monthly\s+installment\s+for)/i.test(norm) ||
    /(?:emi|installment)\s+for\s+[\d,]+/i.test(norm) ||
    /\bcalculate\s+emi\b/i.test(norm) ||
    /\binterest\s+payable\b/i.test(norm) ||
    (/(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:k|lakhs?|lacs?|l|cr)?\s+at\s+[\d.]+\s*%\s+(?:for\s+)?\d+\s*(?:years?|yrs?|months?)/i.test(norm));

  const isAnsweringEmi =
    context?.isFlowActive &&
    context?.expectedField === "existingEmi" &&
    !/(?:calculate|compute)\s+emi/i.test(norm);

  if (isCalculation && !isAnsweringEmi) {
    return {
      intent: "CALCULATION",
      subIntent: "EMI_CALCULATION",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: extractEntitiesFromText(text, context),
    };
  }

  // 5. Casual pleasantries / small talk
  if (
    /^(how\s*are\s*you|hows\s*it\s*going|whats\s*up|what\s*can\s*you\s*do|who\s*are\s*you|tell\s*me\s*about\s*yourself|what\s*is\s*your\s*name|who\s*made\s*you|fine|bye|goodbye|see\s*you)\b/i.test(
      norm
    ) &&
    norm.length < 50
  ) {
    return {
      intent: "ANOTHER_TOPIC",
      subIntent: "CASUAL_CHAT",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted: {},
    };
  }

  // 6. Natural Loan Intent phrases (MUST be checked before generic question words!)
  const isBankPolicyQuery =
    /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata|idfc|indusind|bandhan|yes\s*bank|bank)\s*(?:'s)?\s*(?:policy|guideline|rules?|criteria|cutoff|cut-off|foir\s*norm)/i.test(norm) ||
    (/(?:policy|guidelines?|rules?|cut-off|cutoff)\b/i.test(norm) && /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata|idfc|indusind|bandhan|yes\s*bank|bank)/i.test(norm));

  const isNaturalLoanIntent =
    !isBankPolicyQuery &&
    (/(?:i\s*(?:need|want|require|wish|am\s*looking\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
     /(?:apply\s*(?:for)?\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
     /(?:can\s*i\s*(?:get|have|avail|take|apply\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
     /(?:can\s*i\s*get\s*(?:a\s*)?loan)/i.test(norm) ||
     /(?:(?:need|want|require)\s*(?:rs\.?|₹)?\s*[\d,]+(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr)?\s*loan)/i.test(norm) ||
     /(?:check\s*(?:my\s*)?(?:loan\s*)?eligib)/i.test(norm) ||
     /^(?:i\s*need\s*a\s*loan|i\s*want\s*a\s*loan|can\s*i\s*get\s*a\s*loan|loan\s*chahiye|need\s*loan|get\s*me\s*a\s*loan|looking\s*for\s*(?:a\s*)?loan)\b/i.test(norm));

  if (isNaturalLoanIntent) {
    const extracted = extractEntitiesFromText(text, context);
    return {
      intent: "LOAN_ELIGIBILITY",
      confidence: 0.95,
      loanType: "Personal Loan",
      extracted,
    };
  }

  // 7. Bank Manager, Company, Policy, or General Information queries
  const isManagerQuery =
    /(?:manager|contact|phone|mobile|branch\s*head|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b)/i.test(norm) &&
    !/(?:salary|cibil|age|tenure|existing)/i.test(norm);

  const isCompanyCategoryQuery =
    /(?:category|rating|listing|tier)\s+(?:of|for)\b/i.test(norm) ||
    /(?:what\s+is\s+(?:the\s+)?category)/i.test(norm) ||
    /(?:is\s+[a-z0-9\s&'.-]+\s+(?:listed|cat\s*[a-d]|super\s*cat|elite|diamond))/i.test(norm);

  const isConceptQuery =
    /(?:what\s+is|what\s+are|what\s+does|explain|meaning\s+of|tell\s*me\s*about|how\s+does)\s+(?:foir|cibil|apr|irr|roi|part[\s-]*payment|foreclosure|prepayment|personal\s*loan|credit\s*score)\b/i.test(norm) ||
    /\bwhat\s+is\s+foir\b/i.test(norm) ||
    /\bexplain\s+foir\b/i.test(norm);

  const isPolicyQuery =
    /(?:cutoff|cut-off|guideline|guidelines|rules?|multiplier|eligibility\s*criteria|min(?:imum)?\s*(?:salary|cibil|income|age)|max(?:imum)?\s*(?:tenure|loan|ticket))/i.test(norm) ||
    (/^(?:what|which|how|can\s*i|is\s*there|does)\b/i.test(norm) && /(?:bank|policy|tenure|cibil|salary|foir|rate|interest)/i.test(norm)) ||
    (/\?/i.test(norm) && /(?:bank|policy|tenure|cutoff|foir|hdfc|icici|axis|sbi|kotak|bajaj|tata)/i.test(norm));

  const isQuestion =
    /^(?:what|which|how|who|where|why|can\s*(?:you|i)|could|does|is\s*there|tell\s*me|explain)\b/i.test(norm) ||
    /\?/i.test(norm) ||
    /(?:cutoff|cut-off|guideline|rules?|criteria|difference|meaning)/i.test(norm) ||
    /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata|idfc|bank)\s*(?:'s)?\s*(?:policy|tenure|cutoff|cibil|rate|foir|criteria|rule|limit|max|min)/i.test(norm);

  // Guard: User stating personal values is NEVER a policy query, UNLESS it's an explicit question
  const isPersonalAnswer =
    !isQuestion &&
    (/^(?:my\s*cibil\s*is|cibil\s*(?:is|:)?\s*\d+|my\s*salary\s*is|i\s*work\s*at|i\s*need|no\s*existing\s*emi|i\s*am\s*\d+)/i.test(norm) ||
      (context?.isFlowActive && context?.expectedField && isPersonalFieldMention(context.expectedField, text)));

  if ((isManagerQuery || isCompanyCategoryQuery || isConceptQuery || isPolicyQuery || isQuestion) && !isPersonalAnswer) {
    const extracted = extractEntitiesFromText(text, context);
    return {
      intent: "GENERAL_INFORMATION",
      confidence: 0.9,
      loanType: "Personal Loan",
      extracted,
    };
  }

  // 7. If an active eligibility session is expecting a specific field
  if (context?.isFlowActive) {
    const extracted = extractEntitiesFromText(text, context);
    return {
      intent: "LOAN_ELIGIBILITY",
      confidence: 0.95,
      loanType: "Personal Loan",
      extracted,
    };
  }

  // 8. Default to Loan Eligibility if loan words present
  if (/(?:personal\s*loan|loan|borrow|need\s*money|apply\s*for|eligib)/i.test(norm)) {
    const extracted = extractEntitiesFromText(text, context);
    return {
      intent: "LOAN_ELIGIBILITY",
      confidence: 0.85,
      loanType: "Personal Loan",
      extracted,
    };
  }

  return {
    intent: "ANOTHER_TOPIC",
    confidence: 0.7,
    loanType: "Personal Loan",
    extracted: extractEntitiesFromText(text, context),
  };
}
