/**
 * Deterministic Agent Intent Router & State Machine
 * Decouples state classification and transitions from message rendering and LLM calls.
 * Implements standard 4-stage pipeline:
 * 1. Pre-Processor & Guardrails
 * 2. Intent Classification & State Machine
 * 3. Deterministic Tool Dispatch
 * 4. Structured Synthesis & Output
 */

import {
  AgentState,
  ExtractedEntities,
  UnderwritingProfile,
  EligibilityResult,
  PolicyLookupResult,
} from "./types";
import {
  isSpecialProfileKeyword,
  detectCompanyDisavowal,
  sanitizeExtractedEntities,
  resolveSpecialEmploymentType,
  getSpecialProfileGuidance,
} from "./guardrails";
import {
  isMultiBankEligibilityQuery,
  detectLoanIntent,
  isPureGreeting,
  isGreetingOrPleasantry,
  resolveBankName,
  isKnownBankName,
  extractApplicantDetails,
  evaluateApplicantAgainstAllBanks,
  formatMultiBankEligibilityReport,
  BankEvaluationResult,
  extractBankBranchLocationParams,
} from "@/lib/dynamicEligibilityEngine";
import {
  isGeneralFinancialQuery,
  answerGeneralFinancialQuery,
} from "@/lib/ai/generalFinancialQueries";
import { searchBankManager, formatBankManagersTable } from "@/lib/bankSearch";
import { lookupPolicyParameterStructured } from "@/lib/policyRag";

export interface IntentClassificationResult {
  state: AgentState;
  sanitizedEntities: ExtractedEntities;
  targetLender?: string;
  missingFields: string[];
  isMissingProfileData: boolean;
  specialProfileNotice?: string;
}

export interface ToolDispatchContext {
  sessionId: string;
  userMessage: string;
  profile: UnderwritingProfile;
  classification: IntentClassificationResult;
  model?: string;
}

export interface ToolDispatchResult {
  state: AgentState;
  reply: string;
  profile: UnderwritingProfile;
  toolData?: any;
  sources?: any[];
}

/**
 * Checks which critical underwriting fields are still missing.
 */
export function getMissingProfileFields(profile: UnderwritingProfile): string[] {
  const missing: string[] = [];
  if (!profile.monthlySalary || profile.monthlySalary <= 0) missing.push("Monthly Net Salary");
  if (profile.cibilScore === undefined || profile.cibilScore === null) missing.push("CIBIL Score");
  if (!profile.age || profile.age <= 0) missing.push("Age");
  if (profile.existingEmi === undefined || profile.existingEmi === null) missing.push("Existing Monthly EMI Obligations");
  if (!profile.employmentType && !profile.companyName) missing.push("Employment Type or Employer Name");
  return missing;
}

/**
 * Stage 2: Intent Classification & State Machine
 */
export function classifyAgentIntent(
  userMessage: string,
  currentProfile: UnderwritingProfile = {}
): IntentClassificationResult {
  const norm = (userMessage || "").toLowerCase().trim();

  // 1. Guardrail checks: Company Disavowal
  const disavowal = detectCompanyDisavowal(userMessage);

  // 2. Extract entities and sanitize
  const raw = extractApplicantDetails(userMessage);
  const rawEntities: ExtractedEntities = {
    loanAmount: raw.loanAmount ? Number(raw.loanAmount) : undefined,
    tenureMonths: raw.tenureMonths ? Number(raw.tenureMonths) : undefined,
    monthlySalary: raw.monthlyIncome ? Number(raw.monthlyIncome) : undefined,
    existingEmi: raw.existingEmi !== undefined ? Number(raw.existingEmi) : undefined,
    cibilScore: raw.cibil !== undefined ? Number(raw.cibil) : undefined,
    age: raw.age ? Number(raw.age) : undefined,
    companyName: raw.companyName,
    employmentType: raw.employmentType,
    city: raw.location,
    pincode: raw.pincode,
  };

  if (disavowal.isDisavowal) {
    rawEntities.companyName = disavowal.replacementCompany || undefined;
  }

  const sanitizedEntities = sanitizeExtractedEntities(rawEntities);

  // Check for special profile keyword in input
  const specialEmpType = resolveSpecialEmploymentType(userMessage);
  let specialProfileNotice: string | undefined;
  if (specialEmpType) {
    sanitizedEntities.employmentType = specialEmpType;
    sanitizedEntities.companyName = undefined;
    specialProfileNotice = getSpecialProfileGuidance(specialEmpType);
  }

  // Merge with existing profile to evaluate missing fields
  const updatedProfile: UnderwritingProfile = {
    ...currentProfile,
    age: sanitizedEntities.age ?? currentProfile.age,
    cibilScore: sanitizedEntities.cibilScore ?? currentProfile.cibilScore,
    monthlySalary: sanitizedEntities.monthlySalary ?? currentProfile.monthlySalary,
    existingEmi: sanitizedEntities.existingEmi ?? currentProfile.existingEmi,
    loanAmount: sanitizedEntities.loanAmount ?? currentProfile.loanAmount,
    tenureMonths: sanitizedEntities.tenureMonths ?? currentProfile.tenureMonths,
    companyName: sanitizedEntities.companyName ?? (disavowal.isDisavowal ? undefined : currentProfile.companyName),
    employmentType: sanitizedEntities.employmentType ?? currentProfile.employmentType,
    city: sanitizedEntities.city ?? currentProfile.city,
    pincode: sanitizedEntities.pincode ?? currentProfile.pincode,
  };

  const missingFields = getMissingProfileFields(updatedProfile);
  const isMissingProfileData = missingFields.length > 0;

  // 3. Greeting Classification
  if (isPureGreeting(norm) || (isGreetingOrPleasantry(norm) && norm.split(/\s+/).length <= 3)) {
    return {
      state: "GREETING",
      sanitizedEntities,
      missingFields,
      isMissingProfileData,
    };
  }

  // 4. Bank Manager / Branch Search
  const isManagerQuery =
    /\b(?:manager|contact|branch|branches|phone|email|office|pincode|pin\s*code|location)\b/i.test(norm) &&
    /\b(bank|axis|hdfc|icici|kotak|sbi|idfc|indusind|bandhan|yes|bajaj|tata|chola|piramal|poonawalla)\b/i.test(norm);
  if (isManagerQuery) {
    const bankResolution = resolveBankName(norm);
    const targetLender = bankResolution ? bankResolution.bankName : undefined;
    return {
      state: "BANK_MANAGER_SEARCH",
      sanitizedEntities,
      targetLender,
      missingFields,
      isMissingProfileData,
    };
  }

  // 5. Multi-Bank Eligibility Check
  const hasLoanIntent = detectLoanIntent(norm);
  const isMultiBank = isMultiBankEligibilityQuery(norm);

  if (isMultiBank || (hasLoanIntent && !isKnownBankName(norm))) {
    // If critical fields are missing and this is initial intake
    if (isMissingProfileData && missingFields.length >= 3 && !updatedProfile.monthlySalary) {
      return {
        state: "PROFILE_DATA_COLLECTION",
        sanitizedEntities,
        missingFields,
        isMissingProfileData: true,
        specialProfileNotice,
      };
    }
    return {
      state: "MULTI_BANK_ELIGIBILITY",
      sanitizedEntities,
      missingFields,
      isMissingProfileData,
      specialProfileNotice,
    };
  }

  // 6. Single Bank Policy Lookup
  const bankRes = resolveBankName(norm);
  const detectedBank = bankRes ? bankRes.bankName : undefined;
  const isPolicyKeyword = /\b(?:policy|policies|guideline|rule|cibil|roi|interest|rate|tenure|nth|salary|age|document|docs|process)\b/i.test(norm);
  if (detectedBank && (isPolicyKeyword || !hasLoanIntent)) {
    return {
      state: "SINGLE_BANK_POLICY",
      sanitizedEntities,
      targetLender: detectedBank,
      missingFields,
      isMissingProfileData,
    };
  }

  // 7. Ongoing Profile Data Collection (if user provided financial inputs like salary or CIBIL)
  if (
    sanitizedEntities.monthlySalary ||
    sanitizedEntities.cibilScore !== undefined ||
    sanitizedEntities.age ||
    sanitizedEntities.companyName ||
    sanitizedEntities.existingEmi !== undefined
  ) {
    if (isMissingProfileData) {
      return {
        state: "PROFILE_DATA_COLLECTION",
        sanitizedEntities,
        missingFields,
        isMissingProfileData: true,
        specialProfileNotice,
      };
    }
    return {
      state: "MULTI_BANK_ELIGIBILITY",
      sanitizedEntities,
      missingFields,
      isMissingProfileData: false,
      specialProfileNotice,
    };
  }

  // 8. General Finance FAQ / Fallback
  if (isGeneralFinancialQuery(norm)) {
    return {
      state: "GENERAL_FINANCE_FAQ",
      sanitizedEntities,
      missingFields,
      isMissingProfileData,
    };
  }

  // Default state
  return {
    state: isMissingProfileData ? "PROFILE_DATA_COLLECTION" : "MULTI_BANK_ELIGIBILITY",
    sanitizedEntities,
    missingFields,
    isMissingProfileData,
    specialProfileNotice,
  };
}

/**
 * Stage 3: Deterministic Tool Dispatch (No LLM Guessing)
 */
export async function dispatchToolForState(
  context: ToolDispatchContext
): Promise<ToolDispatchResult> {
  const { sessionId, userMessage, profile, classification } = context;
  const state = classification.state;

  // Handle special profile guidance immediately (Student, Homemaker, Unemployed)
  if (classification.specialProfileNotice) {
    return {
      state,
      reply: classification.specialProfileNotice,
      profile,
    };
  }

  switch (state) {
    case "GREETING": {
      const greetingReply =
        `Hello! 👋 I am your **CreditWise AI Underwriting Assistant**.\n\n` +
        `I can help you:\n` +
        `1. **Check Loan Eligibility** across **23 partner banks & NBFCs** instantly.\n` +
        `2. **Inspect Bank Policies** (ROI, CIBIL cutoffs, minimum salary, documents).\n` +
        `3. **Locate Bank Managers & Branches** near your city or pincode.\n` +
        `4. **Calculate Personal Loan EMI** and borrowing capacity.\n\n` +
        `How may I assist you with your loan requirements today?`;
      return {
        state: "GREETING",
        reply: greetingReply,
        profile,
      };
    }

    case "MULTI_BANK_ELIGIBILITY": {
      // Deterministically run the 23-lender underwriting evaluation
      const applicantForEngine = {
        monthlyIncome: profile.monthlySalary || 0,
        cibil: profile.cibilScore ?? 750,
        age: profile.age || 30,
        existingEmi: profile.existingEmi || 0,
        loanAmount: profile.loanAmount || 500000,
        tenureMonths: profile.tenureMonths || 60,
        companyName: profile.companyName || "Standard Corporate",
        employmentType: profile.employmentType || "Salaried",
        location: profile.city || "Tier 1",
      };

      const evaluationReport = await evaluateApplicantAgainstAllBanks(applicantForEngine as any);
      const formattedReport = formatMultiBankEligibilityReport(applicantForEngine as any, evaluationReport);

      return {
        state: "MULTI_BANK_ELIGIBILITY",
        reply: formattedReport,
        profile,
        toolData: evaluationReport,
      };
    }

    case "SINGLE_BANK_POLICY": {
      const lender = classification.targetLender || "HDFC Bank";
      const lookupResult: PolicyLookupResult = await lookupPolicyParameterStructured(
        lender,
        userMessage
      );

      if (lookupResult.found) {
        return {
          state: "SINGLE_BANK_POLICY",
          reply: lookupResult.value,
          profile,
          sources: lookupResult.sourceFile ? [{ file: lookupResult.sourceFile }] : [],
          toolData: lookupResult,
        };
      } else {
        return {
          state: "SINGLE_BANK_POLICY",
          reply: `I apologize, but related information for **${lender}** is: *${lookupResult.message}*`,
          profile,
          toolData: lookupResult,
        };
      }
    }

    case "BANK_MANAGER_SEARCH": {
      const bankName = classification.targetLender || "HDFC Bank";
      const locationParams = extractBankBranchLocationParams(userMessage);
      const searchResult = await searchBankManager({
        bank_name: bankName,
        city: locationParams.city,
        branch_name: locationParams.branch,
        pincode: locationParams.pincode,
      });

      const reply = formatBankManagersTable(searchResult, bankName);
      return {
        state: "BANK_MANAGER_SEARCH",
        reply,
        profile,
        toolData: searchResult,
      };
    }

    case "PROFILE_DATA_COLLECTION": {
      const missing = classification.missingFields;
      const bulletList = missing.map((f) => `• **${f}**`).join("\n");
      const reply =
        `To evaluate your loan eligibility accurately across our **23 partner lenders**, please share the following details:\n\n` +
        bulletList +
        `\n\n*(You can reply in a single sentence, e.g., "Salary 65k, CIBIL 760, age 29, no EMI, working at Wipro")*`;

      return {
        state: "PROFILE_DATA_COLLECTION",
        reply,
        profile,
      };
    }

    case "GENERAL_FINANCE_FAQ":
    default: {
      const faqAnswer = await answerGeneralFinancialQuery(userMessage);
      if (faqAnswer) {
        return {
          state: "GENERAL_FINANCE_FAQ",
          reply: faqAnswer,
          profile,
        };
      }

      return {
        state: "GENERAL_FINANCE_FAQ",
        reply:
          `I am your CreditWise Financial Assistant. You can ask me to check your personal loan eligibility across 23 partner lenders, verify bank interest rates and policy cutoffs, or search for bank managers.`,
        profile,
      };
    }
  }
}
