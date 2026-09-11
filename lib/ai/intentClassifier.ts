import { parseFinancialAmount, extractCompanyCandidateFromText } from "@/lib/dynamicEligibilityEngine";

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
        `   - User asks about personal loan eligibility, which banks they qualify for, apply for a personal loan, start an eligibility assessment, OR expresses loan intent naturally (e.g. "What banks am I eligible for?", "Which banks can I get a loan from?", "Which bank is best for my loan?", "Am I eligible for a loan?", "Which banks will give me a loan?", "Where can I get a loan?", "I need a loan", "I want a personal loan", "I want to apply for a loan", "Can I get a loan?", "I need ₹5 lakh loan", "Need a personal loan", "Looking for a loan", "Can I get credit/loan?").\n` +
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
        `CRITICAL CONVERSATIONAL & MULTI-TURN RULES:\n` +
        `- NEVER use hardcoded keyword matching. Understand the user's semantic intent from the message in context of the ongoing conversation.\n` +
        `- Multi-Turn Context: Analyze previous assistant questions and user answers. If the assistant asked for a specific detail (e.g. salary or age), evaluate whether the user is answering, raising an objection ("Why do you need my age?"), asking a side question ("Is checking this going to affect my CIBIL?"), correcting a previous answer ("Actually I work at Google"), or giving an unexpected reply ("I don't know my cibil score").\n` +
        `- Objections & Questions: If the user asks "Why age?", "Why company?", "Why salary?", "Is my data safe?", "Will this pull a hard inquiry?", "Can I prepay?", "What is FOIR?", or raises any other objection or question mid-assessment, classify intent as "GENERAL_INFORMATION" with subIntent "OBJECTION" or "CONCEPT_DEFINITION". If the message ALSO provides profile information (e.g. "I earn 80k at TCS, but why do you need my age?"), extract the profile parameters into "extracted"!\n` +
        `- Conversational & Employment Status Answers: If the user says "I am jobless", "unemployed", "I have no job", "without job", "lost my job", "laid off", "student", or "freelancer", understand this as employmentType (and NOT a company name). For "jobless" or "unemployed", set employmentType to "Unemployed", monthlyIncome to 0, and companyName to null. For "freelancer" or "self employed", set employmentType to "Self-Employed" and companyName to "Self-Employed".\n` +
        `- Zero Values & New to Credit: When the user replies "0rs", "0", "nil", "zero", "nothing", "no income", or "no emi" to a question about salary or existing EMIs, accurately extract 0 for that field. If the user says "don't know", "never had a loan or credit card", or "no cibil score" when asked for CIBIL, set "cibil" to 0 (new to credit).\n` +
        `- Corrections: When the user says "actually", "wait", "my bad", "make that", "change to", or corrects a previous parameter (e.g. "Actually my salary is 95000 not 80k"), classify as "CHANGING_DETAILS" and specify the field in "changeFields".\n` +
        `- Bank Policy Requests (subIntent: "BANK_POLICY" or "POLICY_INQUIRY"): If the user asks for the policy, guidelines, rules, or cutoff of ANY bank (whether a partner bank, an unsupported bank like Citibank/Bank of Baroda/PNB, or an unavailable bank, e.g. "Tell me the policy of a bank that isn't available", "What is Citibank policy?", "What is HDFC bank policy?"), classify as "GENERAL_INFORMATION" with subIntent: "BANK_POLICY", and extract targetBank if mentioned. NEVER classify bank policy questions as LOAN_ELIGIBILITY or generic FAQ.\n` +
        `- Keep bank policy questions separate: Specific bank policy inquiries asking for an official bank's rules/guidelines (e.g. "What is HDFC bank policy?", "What are ICICI guidelines?", "Axis Bank CIBIL cutoff policy") belong to "GENERAL_INFORMATION" (subIntent: "BANK_POLICY"). In contrast, any question about user qualification or which bank is best for the user's loan ("What banks am I eligible for?", "Which banks can I get a loan from?", "Which bank is best for my loan?", "Am I eligible for a loan?") belongs strictly to "LOAN_ELIGIBILITY".\n` +
        `- If an eligibility conversation is active, but the user asks a policy question, an EMI calculation, a manager contact, a general definition, or asks to change a detail, you MUST classify that specific intent ("GENERAL_INFORMATION", "CALCULATION", "CHANGING_DETAILS"), NOT "LOAN_ELIGIBILITY".\n` +
        `- Only classify as "LOAN_ELIGIBILITY" if the user is expressing loan intent, directly answering the expected eligibility question, or asking to proceed with eligibility evaluation.\n\n` +
        `Context:\n` +
        `- Eligibility Flow Active: ${context?.isFlowActive ? "true" : "false"}\n` +
        `- Expected Field: ${context?.expectedField || "none"}\n` +
        `- Known Applicant Profile: ${JSON.stringify(context?.existingApplicant || {})}\n\n` +
        `Entity Extraction (extract whatever parameters are explicitly mentioned):\n` +
        `- companyName: employer or corporate name. If the message lists an organization or begins with a company name (e.g. "Capgemini, Age 28...", "Company: TCS", or "work at Wipro"), extract that organization as "companyName". (DO NOT assign greetings, numbers, amounts, or employment status phrases like "jobless", "unemployed", "freelancer", "student" as company name)\n` +
        `- monthlyIncome: net monthly salary in INR as a number (CRITICAL: If the user indicates zero income, 0rs, zero, nil, nothing, or that they are unemployed/jobless/student with no income, set monthlyIncome to 0, NOT null)\n` +
        `- loanAmount: loan amount needed in INR as a number\n` +
        `- tenureMonths: tenure in months (e.g. 3 years = 36) as a number\n` +
        `- cibil: credit score (300-900) as a number (or 0 if no score / new to credit / unknown)\n` +
        `- existingEmi: ongoing monthly loan EMIs in INR as a number (0 if none/no loans/nil)\n` +
        `- age: applicant age in years as a number\n` +
        `- employmentType: "Salaried", "Self-Employed", "Unemployed", or "Student" if mentioned or implied (e.g. "I am jobless" -> "Unemployed", "student" -> "Student", "freelancer" -> "Self-Employed")\n` +
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
    }
  ];

  // Feed previous dialogue turns so the LLM has complete conversational context
  if (context?.recentMessages && context.recentMessages.length > 0) {
    const historySlice = context.recentMessages.slice(-6);
    for (const msg of historySlice) {
      if (msg.content && msg.content.trim()) {
        prompt.push({
          role: msg.role === "assistant" || msg.role === "ai" ? "assistant" : "user",
          content: msg.content.trim(),
        });
      }
    }
  }

  prompt.push({
    role: "user",
    content: messageText,
  });

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

              if (!extracted.companyName) {
                const cand = extractCompanyCandidateFromText(messageText);
                if (cand) {
                  extracted.companyName = cand;
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
    norm === "BANK_POLICY" ||
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
      return (
        /(?:work\s+at|works\s+at|working\s+(?:at|in)|employed\s+(?:at|by)|my\s+company\s+is|employer\s+is|company|firm|employer)\b/i.test(lower) ||
        Boolean(extractCompanyCandidateFromText(text))
      );
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
      /(?:monthly\s*salary|monthly\s*income|salary|income|take\s*home|in\s*hand|net\s*pay)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|hazar))?)\b/i
    ) ||
    text.match(
      /([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|hazar))?)\s*(?:per\s*month|\/month|\/mo|monthly|take\s*home|in\s*hand|salary|income)\b/i
    );
  if (salMatch) {
    const amt = parseFinancialAmount(salMatch[1]);
    if (amt !== null && amt >= 0) extracted.monthlyIncome = amt;
  } else if (context?.expectedField === "monthlyIncome") {
    if (/^(?:0\s*(?:rs|inr)?|rs\.?\s*0|zero|nil|none|nothing|0rs|0)$/i.test(norm)) {
      extracted.monthlyIncome = 0;
    } else {
      const amt = parseFinancialAmount(text);
      if (amt !== null && amt >= 0) extracted.monthlyIncome = amt;
    }
  }

  // 3. Loan Amount
  const loanMatch =
    text.match(
      /(?:loan\s*(?:amount|ticket|size)?|borrow|need|want|require)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|khoka))?)\b/i
    ) ||
    text.match(/(?:rs\.?|₹)\s*([\d,]+(?:\.\d+)?(?:\s*(?:k|lakhs?|lacs?|l\b|cr|peti|khoka))?)\s*(?:loan)?\b/i) ||
    text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|cr|crores?|peti|khoka)\s+(?:loan|borrow)/i);
  if (loanMatch) {
    const amt = parseFinancialAmount(loanMatch[1] + (loanMatch[2] || ""));
    if (amt && amt >= 10000) extracted.loanAmount = amt;
  } else if (context?.expectedField === "loanAmount") {
    const amt = parseFinancialAmount(text);
    if (amt && amt >= 10000) extracted.loanAmount = amt;
  }

  // 4. Tenure
  const yrMatch = text.match(/\b(\d{1,2})\s*(?:years?|yrs?|yr|y\b|saal|sal)(?!\s*old)\b/i);
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
  if (/(?:no|0|zero|nil)\s*(?:existing\s*|current\s*|ongoing\s*)?(?:loan|emi|debt)s?|no\s*loans?|zero\s*debt|sab\s*clear|no\s*debt/i.test(norm)) {
    extracted.existingEmi = 0;
  } else if (context?.expectedField === "existingEmi" && /none|zero|0|nil|no|nope|0rs|rs\.?\s*0|0\s*emi|zero\s*debt|sab\s*clear|no\s*debt/i.test(norm)) {
    extracted.existingEmi = 0;
  } else {
    const emiMatch = text.match(
      /(?:existing\s*emi|ongoing\s*emi|current\s*emi|emi)\s*(?:is|to|=|:)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?(?:\s*k)?)\b/i
    );
    if (emiMatch) {
      const amt = parseFinancialAmount(emiMatch[1]);
      if (amt !== null && amt >= 0) extracted.existingEmi = amt;
    } else if (context?.expectedField === "existingEmi") {
      const amt = parseFinancialAmount(text);
      if (amt !== null && amt >= 0) extracted.existingEmi = amt;
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

  // 7. Employment Type & Status
  if (/(?:jobless|unemployed|no\s*job|without\s*(?:a\s*)?job|laid\s*off|not\s*working)\b/i.test(norm)) {
    extracted.employmentType = "Unemployed";
    extracted.monthlyIncome = 0;
  } else if (/(?:student|in\s*college|studying)\b/i.test(norm)) {
    extracted.employmentType = "Student";
    extracted.monthlyIncome = 0;
  } else if (/(?:self[\s-]*employed|freelanc|business|proprietor|doctor|trader)\b/i.test(norm)) {
    extracted.employmentType = "Self-Employed";
  }

  // 8. Company Name (strictly avoid assigning employment status or zero answers as company)
  const compCandidate = extractCompanyCandidateFromText(text);
  if (compCandidate) {
    extracted.companyName = compCandidate;
  } else if (context?.expectedField === "companyName") {
    const clean = text.replace(/^(?:i\s+)?(?:work\s+at|works\s+at|working\s+at|employed\s+at|company\s+is|employer\s+is|at)\s+/i, "").trim();
    if (clean.length >= 2) {
      extracted.companyName = clean;
    }
  }

  // 9. Bank name if mentioned in text (avoid matching "Tata" if part of "Tata Consultancy Services" or user's employer)
  const isTataCompany = /(?:tata\s*consultancy|\btcs\b)/i.test(text);
  const bankMatch = text.match(
    /\b(hdfc|icici|axis|sbi|kotak|bajaj|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|sbm|smfg|utkarsh|fibe|finnable|l&t|cholamandalam|aditya\s*birla|tata\s*capital)\b/i
  ) || (!isTataCompany ? text.match(/\b(tata)\b/i) : null);
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

  // 6. Natural Loan Intent phrases & Bank Policy queries (MUST be checked before generic question words!)
  const isBankPolicyQuery =
    /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|\btata\b(?!.*consultancy)|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|chola|smfg|finnable|fibe|sbm|utkarsh|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb|bank)\s*(?:'s)?\s*(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|foir\s*norm)/i.test(norm) ||
    (/(?:policy|guidelines?|rules?|criteria|cut-off|cutoff|foir\s*norm)\s*(?:of|for|from|regarding)?\s*(?:a\s*|an\s*|any\s*|the\s*)?(?:[a-z0-9\s&'.-]+)?\s*banks?\b/i.test(norm)) ||
    (/(?:policy|guidelines?|rules?|cut-off|cutoff)\b/i.test(norm) && /\bbanks?\b/i.test(norm)) ||
    (/(?:policy|guidelines?|rules?|cut-off|cutoff)\b/i.test(norm) && /(?:hdfc|icici|axis|sbi|kotak|bajaj|tata\s*capital|\btata\b(?!.*consultancy)|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|chola|smfg|finnable|fibe|sbm|utkarsh|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb)/i.test(norm));

  if (isBankPolicyQuery) {
    const extracted = extractEntitiesFromText(text, context);
    const knownBank = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|poonawalla|yes\s*bank|\byes\b|bandhan|chola|fibe|finnable|smfg|utkarsh|sbm|tata\s*capital|\btata\b(?!.*consultancy)|citibank|citi|baroda|bob|pnb|canara|union|rbl|hsbc|standard\s*chartered|scb/i.exec(text);
    if (knownBank) {
      extracted.targetBank = knownBank[0];
    }
    return {
      intent: "GENERAL_INFORMATION",
      subIntent: "BANK_POLICY",
      confidence: 0.95,
      loanType: "Personal Loan",
      extracted,
    };
  }

  const isNaturalLoanIntent =
    !isBankPolicyQuery &&
    (/(?:i\s*(?:need|want|require|wish|am\s*looking\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
     /(?:apply\s*(?:for)?\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
     /(?:can\s*i\s*(?:get|have|avail|take|apply\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
     /(?:can\s*i\s*get\s*(?:a\s*)?loan)/i.test(norm) ||
     /(?:(?:what|which)\s*banks?\s*(?:am\s*i|can\s*i|could\s*i|would\s*i|should\s*i)\s*(?:be\s*)?(?:eligible|qualif\w*|get|apply))/i.test(norm) ||
     /(?:(?:which|what)\s*banks?\s*(?:can\s*i|could\s*i|will|would|do\s*i)\s*(?:get|take|avail|receive|apply\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
     /(?:(?:which|what)\s*banks?\s*(?:is|are|would\s*be)\s*(?:best|good|ideal|suitable|better|recommended)\s*for\s*(?:my\s*)?(?:personal\s*)?loan)/i.test(norm) ||
     /(?:(?:am\s*i|is\s*it\s*possible\s*for\s*me\s*to\s*be|could\s*i\s*be)\s*eligible\s*(?:for\s*(?:a\s*)?(?:personal\s*)?loan)?)/i.test(norm) ||
     /(?:(?:which|what)\s*banks?\s*will\s*(?:give|provide|grant|approve|sanction)\s*(?:me\s*)?(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
     /(?:(?:where|how)\s*can\s*i\s*(?:get|apply\s*for|avail|take)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(norm) ||
     /(?:(?:my\s*loan\s*options|options\s*for\s*(?:my\s*)?loan|what\s*are\s*my\s*loan\s*options))/i.test(norm) ||
     /(?:(?:do\s*i\s*qualify\s*for\s*(?:a\s*)?(?:personal\s*)?loan))/i.test(norm) ||
     /(?:(?:need|want|require)\s*(?:rs\.?|₹)?\s*[\d,]+(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr)?\s*(?:loan|for\s*\d+\s*(?:years?|yrs?|months?)))/i.test(norm) ||
     /(?:(?:need|want|require)\s*(?:rs\.?|₹)?\s*[\d,]+(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l\b|cr)\b)/i.test(norm) ||
     /(?:(?:check|evaluate|calculate|test|find\s*out)\s*(?:my\s*)?(?:personal\s*)?(?:loan\s*)?eligib\w*)/i.test(norm) ||
     /^(?:i\s*need\s*a\s*loan|i\s*want\s*a\s*loan|can\s*i\s*get\s*a\s*loan|loan\s*chahiye|need\s*loan|get\s*me\s*a\s*loan|looking\s*for\s*(?:a\s*)?loan)\b/i.test(norm));

  const candidateEntities = extractEntitiesFromText(text, context);
  const applicantProfileCount = [
    candidateEntities.monthlyIncome,
    candidateEntities.cibil,
    candidateEntities.loanAmount,
    candidateEntities.tenureMonths,
    candidateEntities.companyName,
    candidateEntities.existingEmi,
    candidateEntities.age,
    candidateEntities.employmentType,
  ].filter((v) => v !== undefined && v !== null && v !== "").length;

  if (!isBankPolicyQuery && (isNaturalLoanIntent || applicantProfileCount >= 2)) {
    return {
      intent: "LOAN_ELIGIBILITY",
      confidence: 0.95,
      loanType: "Personal Loan",
      extracted: candidateEntities,
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
