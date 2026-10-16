/**
 * Standardized Flow Controller Verification Suite
 * Tests the 4-stage pipeline:
 * 1. Pre-Processor & Guardrails (non-salaried tokens, company disavowal)
 * 2. Intent Classifier & State Machine
 * 3. Deterministic Tool Dispatch
 * 4. Structured Policy Lookup & Fallback
 */

import {
  isSpecialProfileKeyword,
  resolveSpecialEmploymentType,
  detectCompanyDisavowal,
  sanitizeExtractedEntities,
  getSpecialProfileGuidance,
} from "../lib/ai/guardrails";
import {
  classifyAgentIntent,
  dispatchToolForState,
} from "../lib/ai/router";
import { lookupPolicyParameterStructured } from "../lib/policyRag";
import { processAgentMessage } from "../lib/ai/agent";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log("=== RUNNING STANDARDIZED FLOW CONTROLLER TESTS ===\n");

  // TEST 1: Guardrails - Special Profile Keywords
  console.log("--- Test 1: Guardrails & Special Profile Filtering ---");
  assert(isSpecialProfileKeyword("student"), "Detects student as special profile");
  assert(isSpecialProfileKeyword("homemaker"), "Detects homemaker as special profile");
  assert(isSpecialProfileKeyword("housewife"), "Detects housewife as special profile");
  assert(isSpecialProfileKeyword("unemployed"), "Detects unemployed as special profile");
  assert(isSpecialProfileKeyword("retired"), "Detects retired as special profile");
  assert(isSpecialProfileKeyword("self-employed"), "Detects self-employed as special profile");

  assert(resolveSpecialEmploymentType("I am a student at IIT") === "Student", "Resolves student employment type");
  assert(resolveSpecialEmploymentType("I am a homemaker") === "Homemaker", "Resolves homemaker employment type");
  assert(resolveSpecialEmploymentType("currently unemployed") === "Unemployed", "Resolves unemployed employment type");
  assert(resolveSpecialEmploymentType("I run my own business (self-employed)") === "Self-Employed", "Resolves self-employed employment type");

  // TEST 2: Non-salaried tokens are NEVER saved as company names
  console.log("\n--- Test 2: Sanitization of Non-Salaried Tokens ---");
  const studentEntities = sanitizeExtractedEntities({
    companyName: "student",
    monthlySalary: 50000,
  });
  assert(studentEntities.companyName === undefined, "Student is never saved as company name");
  assert(studentEntities.employmentType === "Student", "Student mapped to employmentType");

  const homemakerEntities = sanitizeExtractedEntities({
    companyName: "housewife",
  });
  assert(homemakerEntities.companyName === undefined, "Housewife is never saved as company name");
  assert(homemakerEntities.employmentType === "Homemaker", "Housewife mapped to employmentType");

  const unemployedEntities = sanitizeExtractedEntities({
    companyName: "unemployed",
  });
  assert(unemployedEntities.companyName === undefined, "Unemployed is never saved as company name");
  assert(unemployedEntities.employmentType === "Unemployed", "Unemployed mapped to employmentType");

  // TEST 3: Company Disavowal
  console.log("\n--- Test 3: Company Disavowal ---");
  const dis1 = detectCompanyDisavowal("this is not my company, I work at TCS");
  assert(dis1.isDisavowal === true, "Recognizes 'this is not my company'");
  assert(dis1.replacementCompany === "TCS", "Extracts replacement company 'TCS'");

  const dis2 = detectCompanyDisavowal("wrong employer, I don't work there");
  assert(dis2.isDisavowal === true, "Recognizes 'wrong employer'");

  // TEST 4: Intent Classifier & State Machine
  console.log("\n--- Test 4: Intent Classification & Routing ---");
  const cMulti = classifyAgentIntent("Check my loan eligibility across partner banks");
  assert(cMulti.state === "MULTI_BANK_ELIGIBILITY" || cMulti.state === "PROFILE_DATA_COLLECTION", "Classifies multi-bank eligibility request");

  const cPolicy = classifyAgentIntent("What is HDFC Bank personal loan CIBIL cutoff?");
  assert(cPolicy.state === "SINGLE_BANK_POLICY", "Classifies single bank policy inquiry");
  assert(cPolicy.targetLender === "HDFC Bank", "Targets HDFC Bank");

  const cManager = classifyAgentIntent("Show me Axis Bank manager in Pune");
  assert(cManager.state === "BANK_MANAGER_SEARCH", "Classifies bank manager search");

  const cGreeting = classifyAgentIntent("Hello");
  assert(cGreeting.state === "GREETING", "Classifies greeting");

  // TEST 5: Structured Policy Lookup Fallback
  console.log("\n--- Test 5: Structured Policy Lookup & Zero-Hallucination Fallback ---");
  const validPolicy = await lookupPolicyParameterStructured("HDFC Bank", "What is the CIBIL cutoff?");
  assert(validPolicy.found === true, "Found verified parameter for HDFC Bank");
  if (validPolicy.found) {
    assert(validPolicy.lender === "HDFC Bank", "Correct lender attributed");
    assert(validPolicy.value.length > 0, "Contains verified policy content");
  }

  const missingPolicy = await lookupPolicyParameterStructured("HDFC Bank", "What is the cryptocurrency collateral policy?");
  assert(missingPolicy.found === false, "Missing parameter correctly marked as not found");
  if (!missingPolicy.found) {
    assert(
      missingPolicy.message === "Not specified in the available policy.",
      "Returns standardized zero-hallucination fallback message"
    );
  }

  // TEST 6: Multi-Bank Underwriting Tool Dispatch
  console.log("\n--- Test 6: 23-Lender Multi-Bank Underwriting Dispatch ---");
  const multiDispatch = await dispatchToolForState({
    sessionId: "test-conv-001",
    userMessage: "Check my loan eligibility across partner banks",
    profile: {
      monthlySalary: 75000,
      cibilScore: 780,
      age: 32,
      existingEmi: 0,
      loanAmount: 500000,
      tenureMonths: 60,
      companyName: "Tata Consultancy Services",
      employmentType: "Salaried",
      city: "Pune",
    },
    classification: {
      state: "MULTI_BANK_ELIGIBILITY",
      sanitizedEntities: {},
      missingFields: [],
      isMissingProfileData: false,
    },
  });

  assert(multiDispatch.state === "MULTI_BANK_ELIGIBILITY", "Tool dispatch preserves state");
  assert(multiDispatch.reply.includes("Loan Eligibility Across Partner Banks"), "Returns multi-bank eligibility report");
  assert(multiDispatch.toolData?.evaluations?.length >= 20, "Evaluates all partner lenders deterministically");

  // TEST 7: End-to-End processAgentMessage
  console.log("\n--- Test 7: End-to-End processAgentMessage Pipeline ---");
  const response = await processAgentMessage(
    "test-conv-e2e-001",
    "What is HDFC Bank personal loan CIBIL cutoff?"
  );
  assert(response.state === "SINGLE_BANK_POLICY", "E2E processAgentMessage executes and returns typed AgentResponse");
  assert(response.reply.includes("HDFC Bank"), "E2E response contains target bank details");

  console.log("\n🎉 ALL 7 FLOW CONTROLLER VERIFICATION TESTS PASSED SUCCESSFULLY!\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
