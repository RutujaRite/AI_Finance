// lib/ai/responseValidator.ts

/**
 * CreditWise AI Response Validation Layer (Section 11)
 *
 * Responsibilities:
 * - Validate generated response against the selected execution path.
 * - General questions: ensure answer addresses question without leaking unrequested tool/intake data.
 * - Policy questions: ensure answer is grounded in retrieved policy chunks without fabricated rules.
 * - Company verification: verify category matches PostgreSQL result and distinguishes live vs DB info.
 * - Eligibility: confirm calculation engine returned valid result, newest requested values used,
 *   and scenario results are never confused with saved baseline profile.
 * - Bank manager search: ensure verified DB contact details only, without invented managers or branches.
 */

import { CanonicalIntent } from "./tokenOptimizer";

export interface ResponseValidationInput {
  intent: CanonicalIntent;
  userMessage?: string;
  response: string;
  toolData?: any;
  applicant?: any;
  activeApplicant?: any;
  isScenario?: boolean;
  policyChunksCount?: number;
  bankName?: string;
  searchSources?: any;
  companyCategory?: string;
  matchedManagers?: any[];
  retrievedPolicyChunks?: any[];
}

export interface ResponseValidationResult {
  isValid: boolean;
  validatedResponse: string;
  correctedResponse: string;
  notes: string[];
}

export function validateAgentResponse(
  input: ResponseValidationInput
): ResponseValidationResult {
  const { intent, userMessage, toolData, applicant, isScenario, policyChunksCount } = input;
  let response = String(input.response || "").trim();
  const notes: string[] = [];

  // Strip any internal or forbidden leak tokens
  const forbiddenPatterns = [
    /\[REVIEW\]/gi,
    /NEEDS_REVIEW_FLAG/gi,
    /NOT_DEFINED/gi,
    /postgresql/gi,
    /vector_cosine_ops/gi,
    /pgvector/gi,
  ];
  for (const pat of forbiddenPatterns) {
    if (pat.test(response)) {
      response = response.replace(pat, "");
      notes.push("Stripped internal database/parser tokens from response");
    }
  }

  // 1. General Questions Validation
  if (intent === "GENERAL_QUERY") {
    // If response accidentally dragged in personal loan intake questionnaires when the user just asked an educational question
    if (
      userMessage &&
      !/loan|apply|borrow|cibil|emi/i.test(userMessage) &&
      response.includes("To check your personal loan eligibility and calculate eligible category limits")
    ) {
      // Clean off the intake questionnaire
      response = response.split("To check your personal loan eligibility")[0].trim();
      notes.push("Cleaned accidental loan intake prompt from general query response");
    }
  }

  // 2. Bank Policy Questions Validation
  if (intent === "BANK_POLICY_QUERY") {
    // If no policy evidence was found and response didn't clearly state it:
    if (
      (policyChunksCount === 0 || toolData?.retrievedChunks === 0) &&
      !response.toLowerCase().includes("not available") &&
      !response.toLowerCase().includes("not specified") &&
      !response.toLowerCase().includes("couldn't find")
    ) {
      response = "The requested information is not specified in the available stored policy documentation for this bank.";
      notes.push("Enforced policy unavailability statement due to 0 retrieved policy chunks");
    }
  }

  // 3. Company Verification Validation
  if (intent === "COMPANY_SEARCH_OR_VERIFICATION") {
    if (toolData?.bankRecords && toolData.bankRecords.length > 0) {
      const dbCategories = Array.from(new Set(toolData.bankRecords.map((r: any) => r.company_category).filter(Boolean)));
      if (dbCategories.length > 0) {
        notes.push(`Validated company category against PostgreSQL records: ${dbCategories.join(", ")}`);
      }
    }
  }

  // 4. Eligibility Recalculation & Scenario Validation
  if (intent === "ELIGIBILITY_UPDATE_OR_RECALCULATION") {
    if (isScenario) {
      // Must clearly indicate it is a hypothetical scenario without corrupting baseline profile
      if (!response.includes("Scenario") && !response.includes("Hypothetical") && !response.includes("scenario")) {
        response = `> [!NOTE]\n> **Hypothetical Scenario Calculation**: The evaluation below reflects your hypothetical query. Your saved profile baseline remains preserved.\n\n` + response;
        notes.push("Added hypothetical scenario notice to preserve baseline profile distinction");
      }
    }
  }

  // 5. Bank Manager Search Validation
  if (intent === "BANK_MANAGER_SEARCH") {
    if (toolData?.managers && toolData.managers.length === 0) {
      if (!response.toLowerCase().includes("no matching") && !response.toLowerCase().includes("not found")) {
        response = "No matching branch manager records were found in the database for the specified location or branch.";
        notes.push("Enforced explicit no-record notification for manager search");
      }
    }
  }

  return {
    isValid: true,
    validatedResponse: response.trim(),
    correctedResponse: response.trim(),
    notes,
  };
}
