import { evaluateApplicantAgainstAllBanks, BankEvaluationResult, isInvalidCompanyName, isLocationInput, detectFieldPromptedInAssistantMessage } from "@/lib/dynamicEligibilityEngine";
import pool from "@/lib/db";

export interface SessionVariables {
  employer?: string;
  Employer_Name?: string;
  requestedAmount?: number;
  Requested_Loan_Amount?: number;
  tenureMonths?: number;
  cibilScore?: number | "NOT_SURE";
  cibilWasAssumed?: boolean;
  age?: number;
  monthlyIncome?: number;
  existingEmi?: number;
  foir?: number;
  askedSlots?: string[];
  lastPromptedSlot?: "employer" | "company" | "requestedAmount" | "tenureMonths" | "cibilScore" | "age" | "monthlyIncome" | "existingEmi";
  assumptionsUsed?: string[];
  awaitingEmployerConfirmation?: boolean;
  employerConfirmationQuery?: string;
  employerConfirmationOptions?: Array<{ name: string; categoryLabel: string }>;
  [key: string]: any;
}

export interface ExtractedEntities {
  employer?: string;
  requestedAmount?: number | string;
  tenureMonths?: number | string;
  cibilScore?: number | string;
  age?: number | string;
  monthlyIncome?: number | string;
  existingEmi?: number | string;
  [key: string]: any;
}

export interface WebhookRequestPayload {
  sessionVariables?: SessionVariables;
  extractedEntities?: ExtractedEntities;
  userMessage?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  companySelectionAction?: {
    type: "confirm" | "retry" | "select";
    companyId?: string;
    companyName?: string;
  };
}

export interface FormattedBankResult {
  bankId: number;
  bankName: string;
  status: "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_REVIEW";
  cibil: string;
  tenure: string;
  estimatedEmi: number;
  roi: number;
  maxLoanEligible?: number;
  failureReasons?: string[];
}

export interface WebhookResponsePayload {
  isComplete: boolean;
  nextSlotRequired?: "company" | "employer" | "requestedAmount" | "tenureMonths" | "cibilScore" | "age" | "monthlyIncome" | "existingEmi";
  prompt?: string;
  sessionVariables: SessionVariables;
  missingSlots: string[];
  evaluationResults?: FormattedBankResult[];
  eligibleCount?: number;
  totalEvaluated?: number;
  summary?: string;
  nextSteps?: string;
  markdownTable?: string;
  cibilNotice?: string;
  assumptionsUsed?: string[];
  policyCalculations?: {
    nthSalary: number;
    foir: number;
    foirLimit: number;
    existingEmi: number;
    maxEligibleEmi: number;
    maxLoanAmount: number;
  };
  fullReport?: string;
  awaitingEmployerConfirmation?: boolean;
  employerConfirmationQuery?: string;
  employerConfirmationOptions?: Array<{ name: string; categoryLabel: string }>;
  matchingOptionsForm?: string;
  companyData?: any;
}

/* -------------------------------------------------------------------------- */
/*                               NORMALIZERS                                  */
/* -------------------------------------------------------------------------- */

export function normalizeLoanAmount(input: any): number | undefined {
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) {
    return Math.round(input);
  }
  if (!input && input !== 0) return undefined;
  if (typeof input !== "string" && typeof input !== "number") return undefined;
  const str = String(input).toLowerCase().replace(/,/g, "").trim();

  if (str === "0" || str === "zero" || str === "none" || str === "nil") {
    return 0;
  }

  // Match e.g. "5.5 lakhs", "5 lacks", "5 lakh", "5l", "5 lacs", "5 lac"
  const lakhMatch = str.match(/(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lakhs?|lacks?|lacs?|lac|l)\b/i);
  if (lakhMatch) {
    const val = parseFloat(lakhMatch[1]);
    if (!isNaN(val) && val >= 0) return Math.round(val * 100000);
  }

  // Match e.g. "50k", "50 thousand", "70k"
  const kMatch = str.match(/(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:thousand|k)\b/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1]);
    if (!isNaN(val) && val >= 0) return Math.round(val * 1000);
  }

  // Match e.g. "1 crore", "1cr"
  const crMatch = str.match(/(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:crores?|cr)\b/i);
  if (crMatch) {
    const val = parseFloat(crMatch[1]);
    if (!isNaN(val) && val >= 0) return Math.round(val * 10000000);
  }

  // Pure digits e.g. "1000", "70000", "500000" (ignore percentage % or tenure matches like "3 years")
  const cleanedStr = str.replace(/[0-9]+(?:\.[0-9]+)?\s*%/g, "").replace(/[0-9]+\s*(?:years?|yrs?|yr|months?|mos?|m)\b/gi, "").trim();
  const numMatch = cleanedStr.match(/(?:rs\.?|inr|₹)?\s*([0-9]{1,10})/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (!isNaN(val) && val >= 0) return val;
  }

  return undefined;
}

export function normalizeTenureMonths(input: any): number | undefined {
  if (typeof input === "number" && Number.isFinite(input) && input > 0) {
    return input <= 10 ? Math.round(input * 12) : Math.round(input);
  }
  if (!input || typeof input !== "string") return undefined;
  const str = input.toLowerCase().trim();

  // If the text is talking about age (e.g. "28 years old", "age 30"), do NOT treat as tenure!
  if (/\b(?:years?\s*old|yrs?\s*old|age|i\s*am\s*[0-9]+)\b/i.test(str)) {
    return undefined;
  }

  // "5 years", "3.5 yrs", "2 yr"
  const yearMatch = str.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:years?|yrs?|yr|y)\b/i);
  if (yearMatch) {
    const val = parseFloat(yearMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 12);
  }

  // "60 months", "36 mos", "24m"
  const monthMatch = str.match(/([0-9]+)\s*(?:months?|mos?|m)\b/i);
  if (monthMatch) {
    const val = parseInt(monthMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // Only consider pure standalone digits if common tenure years (1-7) in explicit tenure context OR if common tenure months (12, 24, 36, 48, 60, 72, 84)
  const isAmountContext = /\b(?:lakhs?|lacs?|lac|crores?|cr|thousand|k|rs\.?|inr|₹)\b/i.test(str);
  if (!isAmountContext && /^\s*([0-9]{1,3})\s*$/.test(str)) {
    const val = parseInt(str.trim(), 10);
    if ([12, 24, 36, 48, 60, 72, 84, 96, 120].includes(val)) return val;
  }

  return undefined;
}

export function normalizeCibilScore(input: any): number | "NOT_SURE" | undefined {
  if (input === "NOT_SURE") return "NOT_SURE";
  if (typeof input === "number" && Number.isFinite(input)) {
    if (input >= 300 && input <= 900) return Math.round(input);
    if (input === 0 || input === -1) return "NOT_SURE";
    return undefined;
  }
  if (!input || typeof input !== "string") return undefined;
  const str = input.toLowerCase().trim();

  if (
    str.includes("not sure") ||
    str.includes("dont know") ||
    str.includes("don't know") ||
    str.includes("no idea") ||
    str.includes("haven't checked") ||
    str.includes("havent checked") ||
    str.includes("never checked") ||
    str.includes("not checked") ||
    str.includes("unknown") ||
    str.includes("no cibil") ||
    str.includes("zero cibil") ||
    str.includes("without cibil") ||
    str.includes("no credit") ||
    str.includes("zero credit") ||
    str.includes("credit history") ||
    str.includes("first time") ||
    str.includes("blank") ||
    str.includes("nha") ||
    str.includes("no hit") ||
    str === "na" ||
    str === "no" ||
    str === "0" ||
    str === "none" ||
    str === "nil" ||
    /\b(?:employee|applicant|person|someone)?\s*(?:has|have|with)?\s*no\s*cibil\b/i.test(str) ||
    /\b(?:don'?t\s*have\s*(?:any\s*)?(?:cibil|credit)|no\s*(?:cibil|credit)|zero\s*(?:cibil|credit)|without\s*(?:a\s*)?(?:cibil|credit)|never\s*had\s*(?:a\s*)?(?:cibil|credit)|new\s*to\s*credit|credit\s*history)\b/i.test(str) ||
    /\bcibil\s*(?:is|score)?\s*(?:0|zero|none|nil|blank|nha)\b/i.test(str)
  ) {
    return "NOT_SURE";
  }

  // Explicit CIBIL / credit score mention
  const explicitMatch = str.match(/(?:cibil|credit\s*score|score)\s*(?:is|:)?\s*([3-8][0-9]{2}|900)\b/i);
  if (explicitMatch) {
    const val = parseInt(explicitMatch[1], 10);
    if (val >= 300 && val <= 900) return val;
  }

  // Standalone 3-digit number (e.g. answering "750" or "680")
  const standaloneMatch = str.match(/^\s*([3-8][0-9]{2}|900)\s*$/);
  if (standaloneMatch) {
    const val = parseInt(standaloneMatch[1], 10);
    if (val >= 300 && val <= 900) return val;
  }

  // General word boundary match only if not preceded by currency
  const numMatch = str.match(/(?<!(?:rs\.?|inr|₹|,))\b([3-8][0-9]{2}|900)\b(?![0-9,])/i);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (val >= 300 && val <= 900) return val;
  }

  return undefined;
}

export function isUncertainOrVague(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const t = text.trim().toLowerCase();
  return (
    /^(?:not\s*sure(?: yet)?|dont\s*know|don't\s*know|i\s*don'?t\s*know|idk|no\s*idea|skip|skip\s*this|pass|leave\s*it|any(?:thing)?|whatever|standard|default|you\s*(?:decide|choose)|can\s*you\s*assume|assume\s*(?:standard|it)?|proceed\s*(?:anyway|directly)?|just\s*(?:calculate|tell\s*me|evaluate|proceed|give\s*me\s*an\s*estimate|estimate)|give\s*me\s*an\s*estimate|evaluate\s*anyway|i\s*am\s*not\s*sure|no\s*clue|na|nha|none|nil)$/i.test(t) ||
    /\b(?:dont\s*know|don't\s*know|i\s*don'?t\s*know|not\s*sure|no\s*idea|skip\s*this|just\s*calculate|just\s*give\s*me\s*an\s*estimate|give\s*me\s*an\s*estimate|just\s*estimate|proceed\s*with\s*default|use\s*defaults?|you\s*decide|no\s*cibil|zero\s*credit|nha)\b/i.test(t)
  );
}

export function normalizeAge(input: any): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) {
    if (input >= 18 && input <= 100) return Math.round(input);
    return undefined;
  }
  if (!input || typeof input !== "string") return undefined;
  const str = input.toLowerCase().trim();

  // Standalone 2-digit number (e.g. "28", "32")
  const standalone = str.match(/^\s*([1-9][0-9])\s*$/);
  if (standalone) {
    const val = parseInt(standalone[1], 10);
    if (val >= 18 && val <= 90) return val;
  }

  // Explicit age pattern in longer text (e.g. "age 32", "32 years old", "i am 28")
  const ageMatch = str.match(/(?:(?:age|aged)\s*(?:is|:)?\s*([1-9][0-9])|([1-9][0-9])\s*(?:years?|yrs?|yr)\s*(?:old)?|i\s*am\s*([1-9][0-9]))/i);
  if (ageMatch) {
    const val = parseInt(ageMatch[1] || ageMatch[2] || ageMatch[3], 10);
    if (val >= 18 && val <= 90) return val;
  }

  return undefined;
}

export function normalizeEmployer(input: any): string | undefined {
  if (!input || typeof input !== "string") return undefined;
  let str = input.trim();
  // Strip conversational prefix e.g. "I work at Infosys", "My working company is TCS"
  str = str.replace(
    /^(?:(?:(?:i\s*am|i['"]?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by)\s+(?:(?:the|my|our)\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)\s+)|(?:(?:my|our|the)\s+(?:currently\s+|presently\s+)?(?:working\s+|current\s+|present\s+|existing\s+|previous\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?|workplace)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:working\s+|current\s+|present\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:my\s+)?(?:company|employer|organization|org)(?:\s*name)?\s*[:=-]\s*)|(?:work\s+(?:at|in|with|for)|works\s+(?:at|in|with|for)|working\s+(?:at|in|with|for)|employed\s+(?:at|by|in|with|for))|(?:(?:my\s+)?(?:company|employer)\s+is)|(?:(?:i\s*am|i'?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by))|(?:employer\s*[:=-]|company\s*[:=-]|at\s+|in\s+))\s*/i,
    ""
  ).trim();
  // Stop at connective words like "and", "need", "for", "with"
  str = str.replace(/\s+\b(?:and|need|want|looking|for|with|having|earning|salary)\b.*$/i, "").trim();
  // Strip trailing period or quotes
  str = str.replace(/[."']+$/g, "").trim();
  if (
    str.length >= 2 &&
    !/^(?:yes|no|hi|hello|hey|loan|ok|okay)$/i.test(str) &&
    !/^(?:what|how|why|when|where|who|explain|tell|can\s*you|meaning|definition)\b/i.test(str) &&
    !/\?$/.test(str)
  ) {
    return str;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/*                     FALLBACK IN-TEXT ENTITY EXTRACTOR                      */
/* -------------------------------------------------------------------------- */

export function extractEntitiesFromRawText(text: string, lastPromptedSlot?: string): ExtractedEntities {
  const entities: ExtractedEntities = {};
  if (!text || typeof text !== "string") return entities;

  const cleanTrimmed = text.trim();

  // Dedicated check for Zero EMI declarations
  if (
    /^(?:0\s*(?:rs|inr|₹)?|rs\.?\s*0|zero|none|nil|nothing|nope|na|n\/a|no)\b/i.test(cleanTrimmed) ||
    /(?:no|zero|nil|0)\s*(?:existing\s*)?(?:monthly\s*)?(?:loan\s*)?emi/i.test(cleanTrimmed) ||
    /(?:no|zero|nil|0)\s*(?:existing\s*|ongoing\s*|current\s*)?loans?/i.test(cleanTrimmed) ||
    /(?:don['’]?t\s*have|have\s*no)\s*(?:any\s*)?(?:existing\s*)?emi/i.test(cleanTrimmed) ||
    /\b(?:zero\s*debt|sab\s*clear|no\s*debt|no\s*emis?)\b/i.test(cleanTrimmed)
  ) {
    if (
      lastPromptedSlot === "existingEmi" ||
      /(?:emi|loan|debt)/i.test(cleanTrimmed) ||
      (/^(?:0|zero|none|nil|no|nothing|nope)$/i.test(cleanTrimmed) && (!lastPromptedSlot || lastPromptedSlot === "existingEmi"))
    ) {
      entities.existingEmi = 0;
      return entities;
    }
  }

  // --------------------------------------------------------------------------
  // RULE 1: EXTRACT NUMERIC INTENTS
  // Treat standalone numbers in user turns (e.g., "70000", "1000", "70k", "₹70,000")
  // as the direct answer to your last question.
  // --------------------------------------------------------------------------
  const isStandaloneNum =
    /^(?:rs\.?|inr|₹)?\s*[0-9]+(?:\.[0-9]+)?\s*(?:lakhs?|lacs?|lac|l|crores?|cr|thousand|k)?\s*(?:per\s*month|\/month|\/mo|pm|p\.m\.)?$/i.test(cleanTrimmed) ||
    /^[0-9,]{1,12}$/.test(cleanTrimmed) ||
    /^(?:0|zero|none|nil|no|na|n\/a)$/i.test(cleanTrimmed);

  if (isStandaloneNum && lastPromptedSlot) {
    if (lastPromptedSlot === "monthlyIncome") {
      const sal = normalizeLoanAmount(cleanTrimmed);
      if (sal && sal >= 5000 && sal <= 50000000) {
        entities.monthlyIncome = sal;
        return entities;
      }
    } else if (lastPromptedSlot === "existingEmi") {
      if (/^(?:0|zero|none|nil|no|na|n\/a)$/i.test(cleanTrimmed)) {
        entities.existingEmi = 0;
        return entities;
      }
      const emi = normalizeLoanAmount(cleanTrimmed);
      if (emi !== undefined && emi >= 0 && emi <= 5000000) {
        entities.existingEmi = emi;
        return entities;
      }
    } else if (lastPromptedSlot === "requestedAmount") {
      const amt = normalizeLoanAmount(cleanTrimmed);
      if (amt && amt >= 10000) {
        entities.requestedAmount = amt;
        return entities;
      }
    } else if (lastPromptedSlot === "tenureMonths") {
      const tenure = normalizeTenureMonths(cleanTrimmed);
      if (tenure && tenure > 0) {
        entities.tenureMonths = tenure;
        return entities;
      }
    } else if (lastPromptedSlot === "cibilScore") {
      const cibil = normalizeCibilScore(cleanTrimmed);
      if (cibil !== undefined) {
        entities.cibilScore = cibil;
        return entities;
      }
    } else if (lastPromptedSlot === "age") {
      const age = normalizeAge(cleanTrimmed);
      if (age && age >= 18) {
        entities.age = age;
        return entities;
      }
    }
  }

  // 1. Monthly Income / Salary
  const salMatch = text.match(/(?:salary|net\s*salary|income|in-hand|take\s*home|earning|earn)\s*(?:is|changed\s*to|of|around|approx|about)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?\s*(?:lakhs?|lacs?|lac|crores?|cr|k)|[0-9,]{4,12})/i);
  if (salMatch) {
    const sal = normalizeLoanAmount(salMatch[1]);
    if (sal && sal >= 5000 && sal <= 50000000) {
      entities.monthlyIncome = sal;
    }
  }

  // 2. Existing EMI / Ongoing Obligations
  const emiMatch =
    text.match(/(?:(?:pay|paying|have)\s*(?:around|approx|about)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?\s*(?:k)?|[0-9,]{3,8})\s*(?:in|as|towards)?\s*(?:car|home|personal|bike)?\s*emi|(?:car|home|personal|bike|existing)?\s*emi\s*(?:is|of|around|approx)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?\s*(?:k)?|[0-9,]{3,8}))/i);
  if (emiMatch) {
    const rawEmi = emiMatch[1] || emiMatch[2];
    const emi = normalizeLoanAmount(rawEmi);
    if (emi !== undefined && emi >= 0 && emi <= 2000000) {
      entities.existingEmi = emi;
    }
  }

  // 3. Requested Loan Amount
  const isQueryAboutLoanAmount = /\b(?:loan\s*amount\s*(?:i\s*can|can\s*i)\s*get|eligible\s*loan\s*amount|how\s*much\s*loan|update\s*(?:the\s*)?loan\s*amount)\b/i.test(text);
  const loanMatch = text.match(/(?:personal\s*loan|loan(?:\s*amount)?)\s*(?:of|is|worth|around)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?\s*(?:lakhs?|lacs?|lac|l|crores?|cr|k)?|[0-9,]{5,10})/i);
  if (loanMatch && !isQueryAboutLoanAmount) {
    const amt = normalizeLoanAmount(loanMatch[1]);
    if (amt && amt >= 10000) entities.requestedAmount = amt;
  } else if (!isQueryAboutLoanAmount && lastPromptedSlot === "requestedAmount") {
    const amount = normalizeLoanAmount(text);
    if (amount && amount >= 10000 && (!entities.monthlyIncome || amount !== entities.monthlyIncome) && (!entities.existingEmi || amount !== entities.existingEmi)) {
      entities.requestedAmount = amount;
    }
  } else if (!isQueryAboutLoanAmount && /(?:borrow|for\s*loan|need\s*loan|want\s*loan|require|personal\s*loan|loan\s*of)/i.test(text)) {
    const isSalary = /\b(?:salary|income|earn|nth|take\s*home|per\s*month|pm|\/mo)\b/i.test(text);
    if (!isSalary) {
      const amount = normalizeLoanAmount(text);
      if (amount && amount >= 10000 && (!entities.monthlyIncome || amount !== entities.monthlyIncome) && (!entities.existingEmi || amount !== entities.existingEmi)) {
        entities.requestedAmount = amount;
      }
    }
  }

  // 4. Tenure
  const tenure = normalizeTenureMonths(text);
  if (tenure) entities.tenureMonths = tenure;

  // 5. CIBIL
  const cibil = normalizeCibilScore(text);
  if (cibil) entities.cibilScore = cibil;

  // 6. Age (only if text indicates age or is a 2-digit number when age is expected)
  if (/\b(?:age|years?\s*old|yrs?\s*old|i\s*am\s*[0-9]{2})\b/i.test(text) || /^\s*[1-9][0-9]\s*$/.test(text)) {
    const age = normalizeAge(text);
    if (age) entities.age = age;
  }

  // 7. Employer
  const empMatch = text.match(/(?:(?:(?:i\s*am|i['"]?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by)\s+(?:(?:the|my|our)\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)\s+)|(?:(?:my|our|the)\s+(?:currently\s+|presently\s+)?(?:working\s+|current\s+|present\s+|existing\s+|previous\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?|workplace)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:working\s+|current\s+|present\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:my\s+)?(?:company|employer|organization|org)(?:\s*name)?\s*[:=-]\s*)|(?:work\s+(?:at|in|with|for)|works\s+(?:at|in|with|for)|working\s+(?:at|in|with|for)|employed\s+(?:at|by|in|with|for))|(?:(?:my\s+)?(?:company|employer)\s+is)|(?:(?:i\s*am|i'?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by)))\s+([A-Za-z0-9&'.-]+(?:\s+[A-Za-z0-9&'.-]+)*)/i);
  if (empMatch) {
    const emp = normalizeEmployer(empMatch[1]);
    if (emp && !isInvalidCompanyName(emp)) entities.employer = emp;
  } else if (
    !entities.requestedAmount &&
    !entities.tenureMonths &&
    !entities.cibilScore &&
    !entities.age &&
    !entities.monthlyIncome &&
    !entities.existingEmi
  ) {
    const clean = text.trim();
    if (
      clean.length >= 2 &&
      clean.length <= 80 &&
      !isInvalidCompanyName(clean) &&
      !/^\d+$/.test(clean) &&
      !/^(?:what|how|why|when|where|who|explain|tell|can\s*you|meaning|definition)\b/i.test(clean) &&
      !/\?$/.test(clean)
    ) {
      const emp = normalizeEmployer(clean);
      if (emp && !isInvalidCompanyName(emp)) entities.employer = emp;
    }
  }

  return entities;
}

/**
 * Scans previous conversation turns for financial and profile parameters.
 * Strictly enforces Rule 1: CHECK EXISTING STATE FIRST:
 * If a parameter (e.g. requested loan amount = ₹5,00,000) was ALREADY provided in an earlier turn,
 * it is extracted and retained so the system NEVER asks for it as if it is missing.
 */
export function extractParametersFromConversationHistory(
  conversationHistory: Array<{ role: string; content: string }> | undefined
): Partial<SessionVariables> {
  const result: Partial<SessionVariables> = {};
  if (!conversationHistory || conversationHistory.length === 0) return result;

  let lastAssistantMsg: string | undefined = undefined;
  for (const turn of conversationHistory) {
    if (turn.role === "assistant" || turn.role === "ai") {
      lastAssistantMsg = turn.content;
      continue;
    }
    if ((turn.role === "user" || turn.role === "human") && turn.content) {
      const text = turn.content;
      const promptedField = lastAssistantMsg ? detectFieldPromptedInAssistantMessage(lastAssistantMsg) : undefined;

      // Handle user's direct answer to assistant's prompted question
      if (promptedField === "existingEmi" && result.existingEmi === undefined) {
        if (/^(?:0\s*(?:rs|inr|₹)?|rs\.?\s*0|zero|none|nil|no|nothing|nope|clear|sab\s*clear|0\s*emi|no\s*emi)$/i.test(text.trim())) {
          result.existingEmi = 0;
        } else {
          const emi = normalizeLoanAmount(text);
          if (emi !== undefined && emi >= 0) {
            result.existingEmi = emi;
          }
        }
      } else if (promptedField === "monthlyIncome" && result.monthlyIncome === undefined) {
        const sal = normalizeLoanAmount(text);
        if (sal && sal >= 5000) {
          result.monthlyIncome = sal;
        }
      } else if (promptedField === "requestedAmount" && result.requestedAmount === undefined) {
        const amt = normalizeLoanAmount(text);
        if (amt && amt >= 10000) {
          result.requestedAmount = amt;
        }
      } else if (promptedField === "tenureMonths" && result.tenureMonths === undefined) {
        const tenure = normalizeTenureMonths(text);
        if (tenure && tenure > 0) {
          result.tenureMonths = tenure;
        }
      } else if (promptedField === "cibilScore" && result.cibilScore === undefined) {
        const cibil = normalizeCibilScore(text);
        if (cibil !== undefined) {
          result.cibilScore = cibil;
        }
      } else if (promptedField === "age" && result.age === undefined) {
        const age = normalizeAge(text);
        if (age && age >= 18 && age <= 90) {
          result.age = age;
        }
      }

      // Extract Monthly Income FIRST
      if (result.monthlyIncome === undefined) {
        const salRegex = /(?:salary|net\s*salary|income|in-hand|take\s*home|earning|earn|nth)\s*(?:is|changed\s*to|of|around|approx|about)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?\s*(?:lakhs?|lacs?|lac|crores?|cr|k)?|[0-9,]{4,12})/i;
        const salM = text.match(salRegex);
        if (salM) {
          const inc = normalizeLoanAmount(salM[1]);
          if (inc && inc > 0) {
            result.monthlyIncome = inc;
          }
        } else if (/\b(?:salary|income|earn|nth|take\s*home|per\s*month|pm|\/mo)\b/i.test(text)) {
          const inc = normalizeLoanAmount(text);
          if (inc && inc > 0) {
            result.monthlyIncome = inc;
          }
        }
      }

      // Extract Loan Amount
      if (result.requestedAmount === undefined) {
        const loanRegex = /(?:personal\s*loan|loan(?:\s*amount)?|borrow)\s*(?:of|is|worth|around)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?\s*(?:lakhs?|lacs?|lac|l|crores?|cr|k)?|[0-9,]{5,10})/i;
        const loanM = text.match(loanRegex);
        if (loanM) {
          const amt = normalizeLoanAmount(loanM[1]);
          if (amt && amt >= 10000 && amt !== result.monthlyIncome) {
            result.requestedAmount = amt;
          }
        } else {
          const isSalary = /\b(?:salary|income|earn|nth|take\s*home|per\s*month|pm|\/mo)\b/i.test(text);
          const isLoanContext = /\b(?:borrow|for\s*loan|need\s*loan|want\s*loan)\b/i.test(text) || (/(?:lakhs?|lacs?|crores?)/i.test(text) && !isSalary);
          if (isLoanContext && !isSalary) {
            const amt = normalizeLoanAmount(text);
            if (amt && amt >= 10000 && amt !== 700 && amt !== 750 && amt !== 800 && amt !== result.monthlyIncome) {
              result.requestedAmount = amt;
            }
          }
        }
      }

      // Extract Tenure
      if (
        result.tenureMonths === undefined &&
        promptedField !== "companySelection" &&
        !/^\s*(?:option\s+|opt\s+|#|no\.?\s*)?[1-9]\d{0,1}\s*$/i.test(text.trim())
      ) {
        const tenure = normalizeTenureMonths(text);
        if (tenure && tenure > 0) {
          result.tenureMonths = tenure;
        }
      }

      // Extract CIBIL
      if (result.cibilScore === undefined) {
        const cibil = normalizeCibilScore(text);
        if (cibil !== undefined) {
          result.cibilScore = cibil;
        }
      }

      // Extract Age
      if (result.age === undefined) {
        const age = normalizeAge(text);
        if (age && age >= 18 && age <= 90) {
          result.age = age;
        }
      }

      // Extract Employer
      if (result.employer === undefined) {
        const empMatch = text.match(/(?:work\s*(?:at|in|for)|company\s*(?:is)?)\s+([A-Za-z0-9&'.-]+(?:\s+[A-Za-z0-9&'.-]+)*)/i);
        if (empMatch) {
          const emp = normalizeEmployer(empMatch[1]);
          if (emp && !isInvalidCompanyName(emp) && !isLocationInput(emp) && !/^(?:a\s+home|home|open\s*market|unknown|not\s*provided|unlisted)$/i.test(emp.trim())) {
            result.employer = emp;
          }
        }
      }

      // Extract Existing EMI
      if (result.existingEmi === undefined) {
        if (
          /\b(?:existing\s*emi|ongoing\s*(?:loan|emi)|car\s*emi|home\s*loan\s*emi|personal\s*loan\s*emi|current\s*emi|paying\s*emi)\b/i.test(text) ||
          /(?:no|zero|nil|0)\s*(?:existing\s*)?(?:monthly\s*)?(?:loan\s*)?emi/i.test(text)
        ) {
          if (/(?:no|zero|nil|0)\s*(?:existing\s*)?(?:monthly\s*)?(?:loan\s*)?emi/i.test(text)) {
            result.existingEmi = 0;
          } else {
            const emi = normalizeLoanAmount(text);
            if (emi !== undefined && emi >= 0) {
              result.existingEmi = emi;
            }
          }
        }
      }

      lastAssistantMsg = undefined;
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*           COMPANY LOOKUP & CATEGORIZATION MATCHING HELPERS                 */
/* -------------------------------------------------------------------------- */

export interface EmployerMatchingOption {
  name: string;
  categoryLabel: string;
}

/**
 * Searches PostgreSQL bank_company_data for candidate matching companies.
 * Categorizes matches into "Category A / Listed" or "Category B / Private".
 */
export async function searchEmployerMatchingOptions(
  query: string
): Promise<EmployerMatchingOption[]> {
  const raw = String(query || "").trim();
  const clean = raw
    .replace(
      /^(?:i\s*work\s*(?:at|in|for)|my\s*company\s*(?:is|name\s*is)?|employed\s*(?:at|by|with)|company:?|employer:?)\s*/i,
      ""
    )
    .trim();

  if (!clean || clean.length < 2) return [];

  let alias: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const aliasesMod = require("@/services/companyAliases");
    if (typeof aliasesMod?.resolveCompanyAlias === "function") {
      alias = aliasesMod.resolveCompanyAlias(clean) || aliasesMod.resolveCompanyAlias(raw);
    }
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const aliasesMod = require("../../services/companyAliases");
      if (typeof aliasesMod?.resolveCompanyAlias === "function") {
        alias = aliasesMod.resolveCompanyAlias(clean) || aliasesMod.resolveCompanyAlias(raw);
      }
    } catch {}
  }

  const searchPattern = `%${clean.toLowerCase()}%`;
  const aliasPattern = alias ? `%${alias.toLowerCase()}%` : searchPattern;

  try {
    const res = await pool.query(
      `SELECT bcd.company_name, bcd.company_category
       FROM bank_company_data bcd
       WHERE LOWER(bcd.company_name) LIKE $1 OR LOWER(bcd.company_name) LIKE $2
       ORDER BY 
         CASE 
           WHEN LOWER(bcd.company_name) = LOWER($3) THEN 0
           WHEN LOWER(bcd.company_name) = LOWER($4) THEN 1
           WHEN LOWER(bcd.company_name) LIKE LOWER($3 || ' %') THEN 2
           WHEN LOWER(bcd.company_name) LIKE LOWER($4 || ' %') THEN 3
           ELSE 4
         END,
         LENGTH(bcd.company_name) ASC
       LIMIT 50`,
      [aliasPattern, searchPattern, alias || clean, clean]
    );

    const dedupe = new Map<string, { name: string; categories: string[] }>();
    for (const row of res.rows) {
      const name = String(row.company_name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!dedupe.has(key)) {
        dedupe.set(key, { name, categories: [] });
      }
      if (row.company_category) {
        dedupe.get(key)!.categories.push(String(row.company_category).trim());
      }
    }

    const entries = Array.from(dedupe.values()).slice(0, 4);
    const options: EmployerMatchingOption[] = entries.map((entry) => {
      const cats = entry.categories.map((c) => c.toUpperCase());
      const lowerName = entry.name.toLowerCase();
      const isCatA =
        cats.some(
          (c) =>
            c.includes("CAT A") ||
            c.includes("A+") ||
            c.includes("SUPER") ||
            c.includes("ELITE") ||
            c.includes("DIAMOND") ||
            c.includes("LISTED") ||
            c.includes("GOVT")
        ) ||
        (lowerName.includes("limited") && !lowerName.includes("private"));

      const isCatB =
        cats.some((c) => c.includes("CAT B") || c.includes("B+")) ||
        lowerName.includes("private limited") ||
        lowerName.includes("pvt ltd") ||
        lowerName.includes("llp");

      let categoryLabel = "Category B / Private";
      if (isCatA) {
        categoryLabel = "Category A / Listed";
      } else if (isCatB) {
        categoryLabel = "Category B / Private";
      }
      return { name: entry.name, categoryLabel };
    });

    if (options.length === 0) {
      options.push({
        name: clean,
        categoryLabel: "Category B / Private",
      });
    }

    return options;
  } catch (err) {
    console.error("[searchEmployerMatchingOptions] DB query error:", err);
    return [{ name: clean, categoryLabel: "Category B / Private" }];
  }
}

/**
 * Strict protocol formatting:
 * 🏢 Matching Companies Found for '[User Query]':
 * Please select your exact employer:
 * 1. [Company Name 1] (Category A / Listed)
 * 2. [Company Name 2] (Category B / Private)
 * 3. None of these / Unlisted Company
 */
export function renderMatchingOptionsForm(
  query: string,
  options: EmployerMatchingOption[]
): string {
  let text = `🏢 Matching Companies Found for '${query}':\nPlease select your exact employer:\n`;
  options.forEach((opt, idx) => {
    text += `${idx + 1}. ${opt.name} (${opt.categoryLabel})\n`;
  });
  text += `${options.length + 1}. None of these / Unlisted Company`;
  return text;
}

/**
 * Resolves user selection from the corporate matching options list.
 */
export function resolveUserSelectedEmployer(
  input: string,
  options: EmployerMatchingOption[],
  originalQuery: string
): { selectedName: string; isUnlisted: boolean } | null {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Check None of these / Unlisted
  if (
    /^(?:none(?:\s+of\s+these|\s+of\s+the\s+above)?|unlisted(?:\s+company)?|not\s+listed|neither|other|skip)$/i.test(
      lower
    )
  ) {
    return { selectedName: `${originalQuery} (Unlisted)`, isUnlisted: true };
  }

  // Check numeric index (e.g. "1", "2", "3", "option 1", "#1", "opt 2")
  const numMatch = lower.match(/^(?:option\s+|opt\s+|#|no\.?\s*)?(\d+)\b/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 1 && num <= options.length) {
      return { selectedName: options[num - 1].name, isUnlisted: false };
    }
    if (num === options.length + 1) {
      return { selectedName: `${originalQuery} (Unlisted)`, isUnlisted: true };
    }
  }

  // Check word index e.g. "first", "second", "third", "fourth"
  const wordMap: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
  };
  for (const [word, idx] of Object.entries(wordMap)) {
    if (
      lower === word ||
      lower.startsWith(`${word} option`) ||
      lower.startsWith(`${word} one`)
    ) {
      if (idx <= options.length) {
        return { selectedName: options[idx - 1].name, isUnlisted: false };
      }
      if (idx === options.length + 1) {
        return { selectedName: `${originalQuery} (Unlisted)`, isUnlisted: true };
      }
    }
  }

  // Check exact / partial name match against options
  for (const opt of options) {
    const optLower = opt.name.toLowerCase();
    if (lower === optLower || optLower.includes(lower) || lower.includes(optLower)) {
      return { selectedName: opt.name, isUnlisted: false };
    }
  }

  // Check token overlap
  const inputTokens = lower
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (inputTokens.length > 0) {
    for (const opt of options) {
      const optClean = opt.name.toLowerCase();
      const matchCount = inputTokens.filter((t) => optClean.includes(t)).length;
      if (matchCount >= Math.min(2, inputTokens.length)) {
        return { selectedName: opt.name, isUnlisted: false };
      }
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*                     CORE WEBHOOK LOGIC (STATE MACHINE)                     */
/* -------------------------------------------------------------------------- */

export const WATERFALL_PROMPTS: Record<string, string> = {
  employer: "To provide accurate partner bank rates and category limits, what is the exact name of your current employer / company?",
  company: "To provide accurate partner bank rates and category limits, what is the exact name of your current employer / company?",
  monthlyIncome: "What is your net monthly take-home salary or income (e.g., ₹75,000)?",
  existingEmi: "Do you have any existing monthly loan EMIs? (Please specify the amount, or reply '0' if none)",
  cibilScore: "What is your estimated CIBIL or credit score? (Type 'not sure' if you haven't checked)",
  age: "What is your current age?",
  requestedAmount: "How much loan amount would you like to borrow (e.g., ₹5 Lakhs)?",
  tenureMonths: "What is your preferred repayment tenure (in months or years)?",
};

export async function processAntigravityWebhook(
  payload: WebhookRequestPayload
): Promise<WebhookResponsePayload> {
  const currentSession: SessionVariables = { ...(payload.sessionVariables || {}) };
  const incomingEntities: ExtractedEntities = { ...(payload.extractedEntities || {}) };
  let selectedCompanyDataPayload: any = undefined;
  let selectedCompanyReportHeader = "";

  // Rule 1: Scan conversation history to restore previously established parameters
  if (payload.conversationHistory && payload.conversationHistory.length > 0) {
    const histParams = extractParametersFromConversationHistory(payload.conversationHistory);
    for (const [k, v] of Object.entries(histParams)) {
      if (v !== undefined && (currentSession as any)[k] === undefined && (incomingEntities as any)[k] === undefined) {
        if (k === "employer" && !currentSession.Employer_Name) {
          continue;
        }
        (currentSession as any)[k] = v;
      }
    }
  }

  let rawEntities: ExtractedEntities = {};
  // If raw user text was provided, freshly extracted entities take priority
  if (payload.userMessage) {
    rawEntities = extractEntitiesFromRawText(payload.userMessage, currentSession.lastPromptedSlot);
    for (const [k, v] of Object.entries(rawEntities)) {
      if (v !== undefined) {
        incomingEntities[k] = v;
      }
    }
  }

  // =========================================================================
  // COMPANY LOOKUP & CATEGORIZATION INTERRUPT (STRICT PROTOCOL)
  // Step 1: Handle User Selection from Options Form (Confirmation Turn)
  // =========================================================================
  if (
    currentSession.awaitingEmployerConfirmation &&
    currentSession.employerConfirmationOptions &&
    currentSession.employerConfirmationOptions.length > 0
  ) {
    if (payload.companySelectionAction?.type === "retry") {
      currentSession.awaitingEmployerConfirmation = false;
      currentSession.employerConfirmationQuery = undefined;
      currentSession.employerConfirmationOptions = undefined;
      delete currentSession.employer;
      delete currentSession.Employer_Name;
      currentSession.lastPromptedSlot = "company";
      return {
        isComplete: false,
        nextSlotRequired: "company",
        prompt: "No problem! What is the name of your employer or company?",
        sessionVariables: currentSession,
        missingSlots: ["company", "existingEmi", "tenureMonths", "cibilScore", "age"],
      };
    }

    let resolved: { selectedName: string; isUnlisted: boolean } | null = null;

    if (payload.companySelectionAction?.type === "select") {
      const actionCompName = payload.companySelectionAction.companyName || payload.userMessage || "";
      const isUnlisted =
        payload.companySelectionAction.companyId === "unlisted" ||
        /none\s+of\s+these|unlisted/i.test(actionCompName);

      resolved = {
        selectedName: isUnlisted
          ? `${currentSession.employerConfirmationQuery || "Unlisted"} (Unlisted)`
          : actionCompName,
        isUnlisted,
      };
    } else {
      const userMsg = String(payload.userMessage || "").trim();
      resolved = resolveUserSelectedEmployer(
        userMsg,
        currentSession.employerConfirmationOptions,
        currentSession.employerConfirmationQuery || ""
      );
    }

    if (resolved) {
      currentSession.employer = resolved.selectedName;
      currentSession.Employer_Name = resolved.selectedName;
      currentSession.awaitingEmployerConfirmation = false;
      currentSession.employerConfirmationQuery = undefined;
      currentSession.employerConfirmationOptions = undefined;

      // Prevent option selection digits (e.g. "1", "2") from accidentally becoming tenure or amount
      delete incomingEntities.tenureMonths;
      delete incomingEntities.requestedAmount;
      if (resolved.isUnlisted && String(payload.userMessage || "").toLowerCase().includes("none") && currentSession.existingEmi === undefined) {
        delete incomingEntities.existingEmi;
      }

      // Fetch live company intelligence upon user selection
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { searchCompany, formatCompanyResponse } = require("@/lib/companySearch");
        const compInfo = await searchCompany(resolved.selectedName);
        if (compInfo && (compInfo.basicInfo || compInfo.financialInfo || (compInfo.bankRecords && compInfo.bankRecords.length > 0))) {
          selectedCompanyReportHeader = formatCompanyResponse(compInfo);
          selectedCompanyDataPayload = {
            company_flow: "COMPANY_SELECTION",
            needs_disambiguation: false,
            searchQuery: resolved.selectedName,
            selectedCompany: resolved.selectedName,
            company_name: compInfo.primaryName || resolved.selectedName,
            basic_info: compInfo.basicInfo,
            financial_info: compInfo.financialInfo,
            bank_records: compInfo.bankRecords,
            overview: compInfo.overview,
          };
        }
      } catch (err) {
        console.warn("[antigravityWebhook] Failed to fetch live company intelligence:", err);
      }
    } else {
      const userText = String(payload.userMessage || "").trim();
      const hasFinancialOrProfileKeywords =
        /\b(?:salary|income|take\s*home|in\s*hand|net\s*pay|cibil|tenure|age|emi|years?\s*old|lakhs?|lacs?|thousand|crores?)\b/i.test(userText) ||
        /^(?:rs\.?|inr|₹)?\s*[0-9]+(?:\.[0-9]+)?\s*(?:k|lakhs?|lacs?|lac|l|crores?|cr|thousand|hazar)?$/i.test(userText);

      const hasOtherSlots =
        rawEntities.monthlyIncome !== undefined ||
        incomingEntities.monthlyIncome !== undefined ||
        rawEntities.requestedAmount !== undefined ||
        incomingEntities.requestedAmount !== undefined ||
        rawEntities.cibilScore !== undefined ||
        incomingEntities.cibilScore !== undefined ||
        rawEntities.tenureMonths !== undefined ||
        incomingEntities.tenureMonths !== undefined ||
        rawEntities.existingEmi !== undefined ||
        incomingEntities.existingEmi !== undefined ||
        rawEntities.age !== undefined ||
        incomingEntities.age !== undefined ||
        hasFinancialOrProfileKeywords;

      if (hasOtherSlots) {
        // If the user skipped selecting an exact corporate entity and provided other details (like salary),
        // accept the tentative employer query or top match so the intake doesn't get blocked.
        const defaultName =
          currentSession.employerConfirmationOptions[0]?.name ||
          currentSession.employerConfirmationQuery ||
          "Unlisted Company";
        currentSession.employer = defaultName;
        currentSession.Employer_Name = defaultName;
        currentSession.awaitingEmployerConfirmation = false;
        currentSession.employerConfirmationQuery = undefined;
        currentSession.employerConfirmationOptions = undefined;

        if (!currentSession.monthlyIncome && !incomingEntities.monthlyIncome) {
          const salMatch = userText.match(/(?:salary|net\s*salary|income|in-hand|take\s*home|earning|earn)\s*(?:is|changed\s*to|of|around|approx|about)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?\s*(?:lakhs?|lacs?|lac|crores?|cr|k)|[0-9,]{4,12})/i);
          if (salMatch) {
            const sal = normalizeLoanAmount(salMatch[1]);
            if (sal && sal >= 5000 && sal <= 50000000) {
              currentSession.monthlyIncome = sal;
              incomingEntities.monthlyIncome = sal;
            }
          }
        }
      } else {
        // Re-prompt matching options form if user reply was unrecognized
        const form = renderMatchingOptionsForm(
          currentSession.employerConfirmationQuery || "your company",
          currentSession.employerConfirmationOptions
        );
        const candidatesPayload = currentSession.employerConfirmationOptions.map((opt, idx) => ({
          id: String(idx + 1),
          name: opt.name,
          categoryLabel: opt.categoryLabel,
          source: "database",
        }));
        return {
          isComplete: false,
          nextSlotRequired: "company",
          prompt: form,
          sessionVariables: currentSession,
          missingSlots: ["company", "existingEmi", "tenureMonths", "cibilScore", "age"],
          matchingOptionsForm: form,
          awaitingEmployerConfirmation: true,
          employerConfirmationQuery: currentSession.employerConfirmationQuery,
          employerConfirmationOptions: currentSession.employerConfirmationOptions,
          companyData: {
            company_flow: "COMPANY_SELECTION",
            needs_disambiguation: true,
            searchQuery: currentSession.employerConfirmationQuery || "your company",
            candidates: candidatesPayload,
            candidateOptions: candidatesPayload,
          },
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // LAW 2: MERGE AND DO NOT FORGET
  // Never overwrite previously confirmed slot values with null or unmentioned defaults.
  // --------------------------------------------------------------------------

  // 2. Requested Amount
  if (incomingEntities.requestedAmount !== undefined) {
    const normalizedAmt = normalizeLoanAmount(incomingEntities.requestedAmount);
    if (normalizedAmt && normalizedAmt > 0) {
      currentSession.requestedAmount = normalizedAmt;
      currentSession.Requested_Loan_Amount = normalizedAmt;
    }
  }

  // Optional: Monthly Income
  if (incomingEntities.monthlyIncome !== undefined) {
    const inc = normalizeLoanAmount(incomingEntities.monthlyIncome);
    if (inc && inc > 0) {
      currentSession.monthlyIncome = inc;
    }
  }

  // 3. Tenure Months
  if (incomingEntities.tenureMonths !== undefined) {
    const normalizedTenure = normalizeTenureMonths(incomingEntities.tenureMonths);
    if (normalizedTenure && normalizedTenure > 0) {
      if (!currentSession.tenureMonths || /\b(?:years?|yrs?|yr|months?|mos?|m)\b/i.test(String(payload.userMessage || ""))) {
        currentSession.tenureMonths = normalizedTenure;
      }
    }
  }

  // 4. CIBIL Score
  if (incomingEntities.cibilScore !== undefined) {
    const normalizedCibil = normalizeCibilScore(incomingEntities.cibilScore);
    if (normalizedCibil !== undefined) {
      if (normalizedCibil === "NOT_SURE") {
        currentSession.cibilScore = 700;
        currentSession.cibilWasAssumed = true;
      } else if (typeof normalizedCibil === "number" && normalizedCibil >= 300 && normalizedCibil <= 900) {
        currentSession.cibilScore = normalizedCibil;
        currentSession.cibilWasAssumed = false;
      }
    }
  }

  // 5. Age
  if (incomingEntities.age !== undefined) {
    const normalizedAge = normalizeAge(incomingEntities.age);
    if (normalizedAge && normalizedAge >= 18) {
      currentSession.age = normalizedAge;
    }
  }

  // 6. Existing EMI Obligations
  if (incomingEntities.existingEmi !== undefined) {
    const emi = normalizeLoanAmount(incomingEntities.existingEmi);
    if (emi !== undefined && emi >= 0) {
      currentSession.existingEmi = emi;
    }
  }

  // =========================================================================
  // COMPANY LOOKUP & CATEGORIZATION INTERRUPT (STRICT PROTOCOL)
  // Step 2: Mandatory Interrupt on Employer Input
  // When the user provides an employer name (e.g. "mthree", "L&T"), DO NOT immediately
  // save it and move to "existing EMIs". Trigger and display the Match List.
  // =========================================================================
  const userText = String(payload.userMessage || "").trim();
  const explicitCompanyRegex = /^(?:(?:(?:i\s*am|i['"]?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by)\s+(?:(?:the|my|our)\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)\s+)|(?:(?:my|our|the)\s+(?:currently\s+|presently\s+)?(?:working\s+|current\s+|present\s+|existing\s+|previous\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?|workplace)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:working\s+|current\s+|present\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer|firm|org(?:anization|anisation)?)(?:\s*name)?\s*(?:is|are|called|named|[:=-])\s*)|(?:(?:my\s+)?(?:company|employer|organization|org)(?:\s*name)?\s*[:=-]\s*)|(?:work\s+(?:at|in|with|for)|works\s+(?:at|in|with|for)|working\s+(?:at|in|with|for)|employed\s+(?:at|by|in|with|for))|(?:(?:my\s+)?(?:company|employer)\s+is)|(?:(?:i\s*am|i'?m|i)\s+(?:currently\s+|presently\s+)?(?:working\s+|employed\s+)?(?:at|in|with|for|by))|(?:(?:change|update|correct)\s+(?:my\s+)?(?:company|employer|comapny))|(?:employer\s*[:=-]|company\s*[:=-]))\b/i;
  const isExplicitCompanyTurn = explicitCompanyRegex.test(userText);
  const hasFinancialOrProfileKeywords =
    /\b(?:salary|income|take\s*home|in\s*hand|net\s*pay|cibil|tenure|age|emi|years?\s*old|lakhs?|lacs?|thousand|crores?)\b/i.test(userText) ||
    /^(?:rs\.?|inr|₹)?\s*[0-9]+(?:\.[0-9]+)?\s*(?:k|lakhs?|lacs?|lac|l|crores?|cr|thousand|hazar)?$/i.test(userText);
  const isReplyingToEmployerSlot =
    currentSession.lastPromptedSlot === "employer" &&
    !isInvalidCompanyName(userText) &&
    !hasFinancialOrProfileKeywords &&
    !/^\s*(?:0|none|nil|no|yes|hi|hello|hey|ok|okay)\s*$/i.test(userText) &&
    !/^\s*[0-9,.\s₹rs]+\s*$/i.test(userText);

  const incomingEmpRaw = incomingEntities.employer || rawEntities.employer;
  const hasIncomingEmployerInput = Boolean(
    incomingEmpRaw ||
    isExplicitCompanyTurn ||
    isReplyingToEmployerSlot
  );

  // If employer is NOT yet confirmed (no Employer_Name) or user is explicitly updating/changing company:
  if (hasIncomingEmployerInput && (!currentSession.Employer_Name || isExplicitCompanyTurn)) {
    let empQuery =
      incomingEmpRaw ||
      normalizeEmployer(userText) ||
      userText.replace(explicitCompanyRegex, "").trim();
    empQuery = empQuery.replace(/^[,"':\s]+|[,"':\s]+$/g, "").trim();

    if (empQuery && !isInvalidCompanyName(empQuery)) {
      const options = await searchEmployerMatchingOptions(empQuery);
      const form = renderMatchingOptionsForm(empQuery, options);

      currentSession.awaitingEmployerConfirmation = true;
      currentSession.employerConfirmationQuery = empQuery;
      currentSession.employerConfirmationOptions = options;
      currentSession.lastPromptedSlot = "employer";
      delete currentSession.employer;
      delete currentSession.Employer_Name;

      const candidatesPayload = options.map((opt, idx) => ({
        id: String(idx + 1),
        name: opt.name,
        categoryLabel: opt.categoryLabel,
        source: "database",
      }));

      return {
        isComplete: false,
        nextSlotRequired: "company",
        prompt: form,
        sessionVariables: currentSession,
        missingSlots: ["company", "existingEmi", "tenureMonths", "cibilScore", "age"],
        matchingOptionsForm: form,
        awaitingEmployerConfirmation: true,
        employerConfirmationQuery: empQuery,
        employerConfirmationOptions: options,
        companyData: {
          company_flow: "COMPANY_SELECTION",
          needs_disambiguation: true,
          searchQuery: empQuery,
          candidates: candidatesPayload,
          candidateOptions: candidatesPayload,
        },
      };
    }
  }

  // 1. Employer fallback (if already confirmed)
  if (incomingEntities.employer !== undefined && currentSession.employer) {
    const normalizedEmp = normalizeEmployer(incomingEntities.employer);
    if (normalizedEmp && isExplicitCompanyTurn) {
      currentSession.employer = normalizedEmp;
      currentSession.Employer_Name = normalizedEmp;
    }
  }

  // --------------------------------------------------------------------------
  // LAW 3: STRICT SLOT WATERFALL (SLOTS INCOMPLETE)
  // Required applicant & financial parameters strictly ordered by ELIGIBILITY_FIELD_SEQUENCE:
  // employer -> monthlyIncome -> existingEmi -> cibilScore -> age -> requestedAmount -> tenureMonths
  // --------------------------------------------------------------------------

  const missingSlots: Array<"company" | "employer" | "monthlyIncome" | "existingEmi" | "cibilScore" | "age" | "requestedAmount" | "tenureMonths"> = [];

  const isEmployerPlaceholder =
    !currentSession.employer ||
    typeof currentSession.employer !== "string" ||
    currentSession.employer.trim().length < 2 ||
    isInvalidCompanyName(currentSession.employer) ||
    isLocationInput(currentSession.employer) ||
    /^(?:a\s+home|home|open\s*market|unknown|not\s*(?:provided|specified|applicable|available|sure)|unlisted|standard\s*(?:corporate|salaried)|none|nil|na|n\/a)$/i.test(currentSession.employer.trim());

  if (isEmployerPlaceholder) {
    missingSlots.push("company");
  }

  // STRICT FINANCIAL DATA: Never assume, invent, or default salary or loan amount!
  if (!currentSession.monthlyIncome || typeof currentSession.monthlyIncome !== "number" || currentSession.monthlyIncome <= 0) {
    missingSlots.push("monthlyIncome");
  }
  if (currentSession.existingEmi === undefined) {
    missingSlots.push("existingEmi");
  }
  if (currentSession.cibilScore === undefined && currentSession.cibilWasAssumed !== true) {
    missingSlots.push("cibilScore");
  }
  if (!currentSession.age || typeof currentSession.age !== "number" || currentSession.age < 18) {
    missingSlots.push("age");
  }
  if (!currentSession.requestedAmount || typeof currentSession.requestedAmount !== "number" || currentSession.requestedAmount <= 0) {
    missingSlots.push("requestedAmount");
  }
  if (!currentSession.tenureMonths || typeof currentSession.tenureMonths !== "number" || currentSession.tenureMonths <= 0) {
    missingSlots.push("tenureMonths");
  }

  // --------------------------------------------------------------------------
  // ANTI-LOOPING & AUTOMATIC FALLBACK ON UNCERTAINTY/STUCK INPUTS
  // 1. ONE-TIME CLARIFICATION: Ask a maximum of 1 follow-up question per turn if required information is missing. Never ask the same missing information question twice.
  // 2. If the user provides vague, incomplete, or repeated answers, DO NOT repeat your question.
  // 3. NO ARBITRARY FINANCIAL ASSUMPTIONS: Never default salary to ₹50,000 or loan amount to ₹5,00,000.
  //    If required financial fields (Monthly Income or Desired Loan Amount) are missing, politely ask for them.
  //    Do NOT generate fake bank calculations or dummy eligibility tables until actual financial inputs are provided.
  // --------------------------------------------------------------------------

  const assumptionsUsed: string[] = [...(currentSession.assumptionsUsed || [])];

  const hasExplicitDefaultRequest =
    /\b(?:assume\s*(?:standard|defaults?|benchmark)|use\s*defaults?|standard\s*defaults?|proceed\s*with\s*defaults?|evaluate\s*directly|just\s*(?:tell\s*me\s*(?:my\s*)?loan\s*eligibility|tell\s*me|give\s*me\s*an\s*estimate|estimate)|tell\s*me\s*my\s*loan\s*eligibility|i\s*don'?t\s*know|i\s*don'?t\s*want\s*to\s*tell|skip\s*this|skip|no\s*idea|whatever|dont\s*know)\b/i.test(userText);

  const promptCounts: Record<string, number> = { ...(currentSession.promptCounts || {}) };
  const lastSlot = currentSession.lastPromptedSlot;
  const currentSlotPromptCount = lastSlot ? (promptCounts[lastSlot] || 0) : 0;

  // Has the user provided concrete new entities in this turn?
  const providedNewInfoThisTurn = Boolean(
    incomingEntities.existingEmi !== undefined ||
    incomingEntities.monthlyIncome !== undefined ||
    incomingEntities.requestedAmount !== undefined ||
    incomingEntities.tenureMonths !== undefined ||
    incomingEntities.cibilScore !== undefined ||
    incomingEntities.employer !== undefined ||
    incomingEntities.age !== undefined
  );

  const isVagueOrEvasive = hasExplicitDefaultRequest || (isUncertainOrVague(userText) && !providedNewInfoThisTurn);

  // Fallback triggers if:
  // 1. User gave an evasive/vague/default request (e.g. "I don't know", "skip this", "just tell me my loan eligibility"), OR
  const shouldTriggerFallback =
    (missingSlots.length > 0 && hasExplicitDefaultRequest) ||
    (missingSlots.length > 0 && isVagueOrEvasive);

  const hasRequiredFinancialData = Boolean(
    currentSession.monthlyIncome && currentSession.monthlyIncome > 0 &&
    currentSession.requestedAmount && currentSession.requestedAmount > 0
  );

  // User Rule: NEVER consider own values or default values.
  // ONLY when user says not sure about cibil or employee has no cibil, in that case consider 700.
  if (
    missingSlots.includes("cibilScore") &&
    (currentSession.lastPromptedSlot === "cibilScore" || /cibil|credit/i.test(userText)) &&
    (shouldTriggerFallback || isUncertainOrVague(userText) || /not\s*sure|no\s*cibil|zero\s*credit/i.test(userText))
  ) {
    currentSession.cibilScore = 700;
    currentSession.cibilWasAssumed = true;
    assumptionsUsed.push("CIBIL Score: 700 (Unprovided / NHA / zero credit history baseline)");
    const idx = missingSlots.indexOf("cibilScore");
    if (idx !== -1) missingSlots.splice(idx, 1);
    currentSession.assumptionsUsed = assumptionsUsed;
  }

  // If required financial data is missing, we MUST ask the user for it and NOT evaluate!
  if (missingSlots.length > 0) {
    let nextSlotRequired = missingSlots[0];

    // RULE 2: NEVER REPEAT THE EXACT SAME QUESTION:
    // Ask for a missing field AT MOST ONCE.
    // If the user was already asked nextSlotRequired in the previous turn (currentSlotPromptCount >= 1):
    // Advance immediately to the next unprompted parameter!
    if (lastSlot && nextSlotRequired === lastSlot && currentSlotPromptCount >= 1) {
      const nextUnasked = missingSlots.find((s) => s !== lastSlot && (!promptCounts[s] || promptCounts[s] < 1));
      if (nextUnasked) {
        nextSlotRequired = nextUnasked;
      } else if (missingSlots.length > 1) {
        nextSlotRequired = missingSlots.find((s) => s !== lastSlot) || missingSlots[0];
      }
    }

    const basePrompt = WATERFALL_PROMPTS[nextSlotRequired] || `Could you please provide your ${nextSlotRequired}?`;
    const prompt = selectedCompanyReportHeader
      ? `${selectedCompanyReportHeader}\n\nGot it! I have confirmed your employer as **${currentSession.employer}**.\n\nNow let's continue with your eligibility assessment.\n\n${basePrompt}`
      : basePrompt;

    promptCounts[nextSlotRequired] = (promptCounts[nextSlotRequired] || 0) + 1;
    currentSession.promptCounts = promptCounts;
    currentSession.lastPromptedSlot = nextSlotRequired;
    currentSession.askedSlots = Array.from(new Set([...(currentSession.askedSlots || []), nextSlotRequired]));

    const finalNextSlot = (nextSlotRequired === "employer" ? "company" : nextSlotRequired) as any;
    const finalMissingSlots = missingSlots.map((s) => (s === "employer" ? "company" : s));

    return {
      isComplete: false,
      nextSlotRequired: finalNextSlot,
      prompt,
      sessionVariables: currentSession,
      missingSlots: finalMissingSlots,
      companyData: selectedCompanyDataPayload,
    };
  }

  // --------------------------------------------------------------------------
  // LAW 5: EVALUATION EXECUTION (SLOTS COMPLETE)
  // When all required slots are populated, evaluate eligibility against partner bank policy datasets.
  // --------------------------------------------------------------------------

  // If CIBIL was not provided by user, set baseline 700 and mark as assumed
  if (currentSession.cibilScore === undefined || currentSession.cibilScore === "NOT_SURE") {
    currentSession.cibilScore = 700;
    currentSession.cibilWasAssumed = true;
  }

  const effectiveCibil = typeof currentSession.cibilScore === "number"
    ? currentSession.cibilScore
    : 700;

  // CIBIL SCORE HANDLING (ONLY PERMITTED ASSUMPTION):
  // Prepend exact notice if CIBIL was unmentioned or zero credit history
  const cibilNotice = currentSession.cibilWasAssumed
    ? `> "Note: Since no CIBIL score was provided, I am assuming a baseline CIBIL score of 700 to calculate your eligibility."\n\n`
    : "";

  // --------------------------------------------------------------------------
  // FOIR & ELIGIBILITY COMPUTATION STEPS:
  // Once actual user values are present:
  // 1. FOIR Limit = Monthly Income × Bank FOIR Threshold % (e.g., 50%).
  // 2. Max Eligible Monthly EMI = FOIR Limit - Actual User Existing Monthly EMIs.
  // 3. Compare Max Eligible EMI and Max Loan Amount directly against the user's Requested Loan Amount.
  // 4. Filter matching partner bank policy datasets and present qualifying banks.
  // --------------------------------------------------------------------------

  const actualMonthlyIncome = currentSession.monthlyIncome!;
  const actualExistingEmi = currentSession.existingEmi ?? 0;
  const actualRequestedAmount = currentSession.requestedAmount!;

  const foir = currentSession.foir || 50; // Bank FOIR Threshold %
  const foirLimit = Math.round(actualMonthlyIncome * (foir / 100));
  const maxEligibleEmi = Math.round(foirLimit - actualExistingEmi);

  const tenureMonths = currentSession.tenureMonths || 60;
  const benchmarkRoi = 10.75;
  const monthlyRate = benchmarkRoi / 12 / 100;
  const maxLoanEligible = Math.round(
    (Math.max(0, maxEligibleEmi) * (Math.pow(1 + monthlyRate, tenureMonths) - 1)) /
    (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths))
  );

  const applicant = {
    companyName: currentSession.employer,
    loanAmount: actualRequestedAmount,
    tenureMonths: currentSession.tenureMonths,
    cibil: effectiveCibil,
    age: currentSession.age || 30,
    monthlyIncome: actualMonthlyIncome,
    loanType: "Personal Loan",
    employmentType: "Salaried",
  };

  const evalOutput = await evaluateApplicantAgainstAllBanks(applicant, "Personal Loan");

  const formattedResults: FormattedBankResult[] = (evalOutput.evaluations || []).map((ev: BankEvaluationResult) => {
    return {
      bankId: ev.bankId,
      bankName: ev.bankName,
      status: ev.status,
      cibil: ev.policyCibil || (ev.isEligible ? "Met" : "Below Cutoff"),
      tenure: `${ev.tenureMonths || currentSession.tenureMonths || 60} months`,
      estimatedEmi: Math.round(ev.monthlyEmi || 0),
      roi: Number((ev.roi || 11.5).toFixed(2)),
      maxLoanEligible: Math.round(ev.maxLoanEligible || 0),
      failureReasons: ev.failureReasons || [],
    };
  });

  const eligibleResults = formattedResults.filter((b) => b.status === "ELIGIBLE");
  const reviewResults = formattedResults.filter((b) => b.status === "NEEDS_REVIEW");
  const totalEligible = eligibleResults.length;

  // Sort eligible banks with the best offer / lowest ROI / lowest EMI on top
  eligibleResults.sort((a, b) => {
    if (a.roi !== b.roi) return a.roi - b.roi;
    if (a.estimatedEmi !== b.estimatedEmi) return a.estimatedEmi - b.estimatedEmi;
    return (b.maxLoanEligible || 0) - (a.maxLoanEligible || 0);
  });

  // Build markdown table as specified in AGENTS.md:
  // | Bank | Status | CIBIL | Tenure | Est. EMI |
  let markdownTable = `| Bank | Status | CIBIL | Tenure | Est. EMI |\n`;
  markdownTable += `|---|---|---|---|---|\n`;

  // Display eligible banks first, followed by review banks if any; if none qualify, display evaluated partner banks
  const displayBanks =
    eligibleResults.length > 0
      ? eligibleResults
      : reviewResults.length > 0
      ? reviewResults
      : formattedResults;

  for (let idx = 0; idx < displayBanks.length; idx++) {
    const b = displayBanks[idx];
    const isTopRecommended = idx === 0 && b.status === "ELIGIBLE";
    const emiDisplay =
      b.status === "ELIGIBLE"
        ? (b.estimatedEmi > 0 ? `₹${b.estimatedEmi.toLocaleString("en-IN")}` : "Varies by CAT")
        : (b.failureReasons && b.failureReasons.length > 0 ? b.failureReasons[0].replace(/^-\s*/, "").replace(/^\*\*[^*]+\*\*:\s*/, "") : "Below Policy Cutoff");
    const bankDisplay = isTopRecommended ? `**${b.bankName}** 🌟 *(Highly Recommended)*` : `**${b.bankName}**`;
    markdownTable += `| ${bankDisplay} | \`${b.status}\` | ${b.cibil} | ${b.tenure} | **${emiDisplay}** |\n`;
  }

  const summary = `Evaluated applicant profile against 23 bank policy datasets. ${totalEligible} bank(s) qualify for immediate funding.`;
  const nextSteps = totalEligible > 0
    ? `You can select any of the qualifying banks above to proceed with branch manager contact or loan application submission.`
    : `None of the 23 partner banks currently match all credit criteria. Actionable steps: 1) Add a creditworthy co-applicant, 2) Lower the requested loan amount, or 3) Extend repayment tenure.`;

  // --------------------------------------------------------------------------
  // RESPONSE EXECUTION STEPS (STREAMING & FORMATTING GUIDELINES):
  // Section 1: CIBIL & Fallback Notices (if applicable)
  // Section 2: Input Summary & Assumptions Used
  // Section 3: Eligibility & FOIR/EMI Calculation
  // Section 4: Recommended Action / Next Steps
  // --------------------------------------------------------------------------

  // Section 1: CIBIL & Fallback Notices (if applicable)
  // STRICT CIBIL DISPLAY & TRIGGER RULES:
  // 1. USER PROVIDED CIBIL SCORE:
  //    - If the user provides a specific CIBIL score (e.g., 750, 680), evaluate eligibility using their exact score.
  //    - DO NOT display any assumption notice or fallback message.
  // 2. NO CIBIL / MISSING CIBIL (TRIGGER CONDITION):
  //    - ONLY show the assumption notice if the user explicitly states they have no CIBIL score, zero credit history, NHA/NA, or if CIBIL is missing from their input.
  //    - Set CIBIL = 700 and display this EXACT notice at the very start of Section 1:
  //      > "Note: Since no CIBIL score was provided, I am assuming a baseline CIBIL score of 700 to calculate your eligibility."
  let section1 = "";
  if (currentSession.cibilWasAssumed) {
    section1 += `### Section 1: CIBIL & Fallback Notices\n\n`;
    section1 += `> "Note: Since no CIBIL score was provided, I am assuming a baseline CIBIL score of 700 to calculate your eligibility."\n\n`;
    if (currentSession.assumptionsUsed && currentSession.assumptionsUsed.length > 2) {
      section1 += `> **Notice:** Standard benchmark defaults (FOIR: 50%, Tenure: 5 years) were automatically applied for unprovided fields to prevent dialogue looping.\n\n`;
    }
  } else if (currentSession.assumptionsUsed && currentSession.assumptionsUsed.length > 2) {
    section1 += `### Section 1: Fallback Notices\n\n`;
    section1 += `> **Notice:** Standard benchmark defaults (FOIR: 50%, Tenure: 5 years) were automatically applied for unprovided fields to prevent dialogue looping.\n\n`;
  }

  // Section 2: Input Summary & Assumptions Applied
  const rawAssumptions: string[] = currentSession.assumptionsUsed && currentSession.assumptionsUsed.length > 0
    ? currentSession.assumptionsUsed
    : [
        ...(currentSession.cibilWasAssumed ? ["CIBIL Score: 700 (Unprovided / NHA / zero credit history baseline)"] : []),
        `Monthly FOIR Cap: 50% (Standard debt-to-income benchmark)`,
        `Existing EMI Obligations: ₹0 (No active debt liabilities declared)`,
        `Loan Tenure: 5 Years (60 months standard repayment period)`,
      ];

  const finalAssumptions: string[] = currentSession.cibilWasAssumed
    ? rawAssumptions
    : rawAssumptions.filter((a) => !/cibil/i.test(a));

  let section2 = `### Section 2: Input Summary & Assumptions Applied\n\n`;
  section2 += `#### 📋 Applicant Input Summary\n`;
  section2 += `* **Employer / Company**: **${currentSession.employer || "Standard Corporate"}**\n`;
  section2 += `* **Requested Loan Amount**: **₹${(currentSession.requestedAmount || 500000).toLocaleString("en-IN")}**\n`;
  section2 += `* **Repayment Tenure**: **${tenureMonths} months** (${Math.round(tenureMonths / 12)} years)\n`;
  section2 += `* **Credit Score**: **${effectiveCibil}** ${currentSession.cibilWasAssumed ? "*(Assumed Baseline)*" : "*(Provided)*"}\n`;
  section2 += `* **Applicant Age**: **${currentSession.age || 30} years**\n\n`;

  section2 += `#### ⚙️ Assumptions Applied (Assumptions Used)\n`;
  section2 += `> [!NOTE]\n`;
  section2 += `> **Assumptions Applied Callout** *(Defaults used so you can verify or correct them later)*:\n`;
  for (const a of finalAssumptions) {
    if (a.includes(":")) {
      const parts = a.split(":");
      section2 += `> • **${parts[0].trim()}**: ${parts.slice(1).join(":").trim()}\n`;
    } else {
      section2 += `> • ${a}\n`;
    }
  }
  section2 += `\n`;

  // Section 3: Eligibility & FOIR/EMI Calculation
  let section3 = `### Section 3: Eligibility & FOIR/EMI Calculation\n\n`;
  section3 += `#### 🧮 Bank Policy Financial Calculations\n`;
  section3 += `* **Net Take-Home (NTH) Salary**: ₹${actualMonthlyIncome.toLocaleString("en-IN")} / month *(User Provided)*\n`;
  section3 += `* **Bank FOIR Threshold**: ${foir.toFixed(1)}%\n`;
  section3 += `* **FOIR Limit**: **₹${foirLimit.toLocaleString("en-IN")} / month** \`(${foir}% of ₹${actualMonthlyIncome.toLocaleString("en-IN")})\`\n`;
  section3 += `* **Actual Existing Monthly EMIs**: ₹${actualExistingEmi.toLocaleString("en-IN")} *(User Provided)*\n`;
  section3 += `* **Maximum Eligible Monthly EMI**: **₹${maxEligibleEmi.toLocaleString("en-IN")} / month** \`(FOIR Limit ₹${foirLimit.toLocaleString("en-IN")} - Existing EMIs ₹${actualExistingEmi.toLocaleString("en-IN")})\`\n`;
  section3 += `* **Requested Loan Amount**: **₹${actualRequestedAmount.toLocaleString("en-IN")}** *(User Provided)*\n`;
  section3 += `* **Maximum Loan Amount Capacity**: **₹${maxLoanEligible.toLocaleString("en-IN")}** *(calculated at benchmark ${benchmarkRoi}% p.a. over ${tenureMonths} months)*\n`;
  if (actualRequestedAmount <= maxLoanEligible) {
    section3 += `* **Capacity Comparison**: ✅ Your requested loan amount of **₹${actualRequestedAmount.toLocaleString("en-IN")}** is within your maximum borrowing capacity of **₹${maxLoanEligible.toLocaleString("en-IN")}**.\n\n`;
  } else {
    section3 += `* **Capacity Comparison**: ⚠️ Your requested loan amount of **₹${actualRequestedAmount.toLocaleString("en-IN")}** exceeds your maximum eligible borrowing capacity of **₹${maxLoanEligible.toLocaleString("en-IN")}**.\n\n`;
  }

  section3 += `#### 🏦 Partner Bank Policy Evaluation Results\n\n`;
  section3 += markdownTable + `\n\n`;

  // Section 4: Recommended Action / Next Steps
  const topEligible = eligibleResults[0];
  const allFailureReasons = formattedResults.flatMap((b) => b.failureReasons).filter(Boolean);
  let primaryFailureReason = "";
  if (actualExistingEmi >= foirLimit || maxEligibleEmi <= 0) {
    primaryFailureReason = `Your existing monthly EMI obligations (₹${actualExistingEmi.toLocaleString("en-IN")}) equal or exceed your permissible FOIR debt limit (₹${foirLimit.toLocaleString("en-IN")}).`;
  } else if (actualRequestedAmount > maxLoanEligible) {
    primaryFailureReason = `Your requested loan amount (₹${actualRequestedAmount.toLocaleString("en-IN")}) exceeds your maximum eligible borrowing capacity of ₹${maxLoanEligible.toLocaleString("en-IN")} based on your FOIR debt-to-income ratio.`;
  } else if (allFailureReasons.length > 0 && allFailureReasons[0]) {
    primaryFailureReason = allFailureReasons[0];
  } else {
    primaryFailureReason = `Your net take-home salary or debt obligations do not meet the minimum eligibility cutoffs across partner bank policies.`;
  }

  let section4 = `### Section 4: Recommended Action / Next Steps\n\n`;
  section4 += `* **Policy Match Summary**: Evaluated profile against **${formattedResults.length} institutional partner bank policies**. **${totalEligible} bank(s)** qualify for immediate funding.\n`;
  if (topEligible) {
    section4 += `* **Top Recommended Partner**: **${topEligible.bankName}** with benchmark ROI of **${topEligible.roi}% p.a.** and monthly EMI of **₹${topEligible.estimatedEmi.toLocaleString("en-IN")}**.\n`;
    section4 += `* **Next Steps**: ${nextSteps}\n`;
  } else {
    section4 += `* **Primary Ineligibility Reason**: ${primaryFailureReason}\n`;
    section4 += `* **Next Steps**: Would you like to check eligibility using another company?\n`;
  }

  const topNoticePrefix = currentSession.cibilWasAssumed
    ? `> "Note: Since no CIBIL score was provided, I am assuming a baseline CIBIL score of 700 to calculate your eligibility."\n\n`
    : "";

  let reportTitle = "";
  if (totalEligible > 0) {
    reportTitle =
      `🎉 **Personal Loan Eligibility Evaluation Complete**\n\n` +
      `Based on your profile at **${currentSession.employer || "Standard Corporate"}**, here is your complete institutional loan assessment:\n\n`;
  } else {
    reportTitle =
      `### ❌ Loan Eligibility Assessment Result\n\n` +
      `Based on your profile at **${currentSession.employer || "Standard Corporate"}**, none of our partner banks qualify for funding at this time.\n\n`;
  }

  const fullReport =
    topNoticePrefix +
    reportTitle +
    (section1 ? `${section1}\n` : "") +
    section2 +
    section3 +
    section4;

  return {
    isComplete: true,
    sessionVariables: currentSession,
    missingSlots: [],
    evaluationResults: formattedResults,
    eligibleCount: totalEligible,
    totalEvaluated: formattedResults.length,
    summary,
    nextSteps,
    markdownTable,
    cibilNotice,
    assumptionsUsed: finalAssumptions,
    policyCalculations: {
      nthSalary: actualMonthlyIncome,
      foir,
      foirLimit,
      existingEmi: actualExistingEmi,
      maxEligibleEmi,
      maxLoanAmount: maxLoanEligible,
    },
    fullReport,
  };
}
