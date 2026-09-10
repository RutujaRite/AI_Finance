import {
  extractApplicantDetails,
  extractProfileUpdates,
  applyProfileUpdateAndRecalculate,
  getRequiredPolicyFields,
  processDynamicEligibility,
  ApplicantProfile,
  messageMentionsField,
} from "../lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 RUNNING COMPREHENSIVE PROFILE INTEGRITY VERIFICATION SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // TEST 1: messageMentionsField accuracy
  console.log("Test Suite 1: messageMentionsField guards");
  assert(messageMentionsField("cibil", "My CIBIL score is 750"), "Detects CIBIL mention");
  assert(messageMentionsField("cibil", "Credit score 800"), "Detects credit score mention");
  assert(!messageMentionsField("cibil", "My salary is 80000"), "Does not falsely detect CIBIL in salary message");
  assert(!messageMentionsField("cibil", "Change loan amount to 5 lakhs"), "Does not falsely detect CIBIL in loan message");
  assert(messageMentionsField("monthlyIncome", "Salary is 90k"), "Detects salary mention");
  assert(!messageMentionsField("monthlyIncome", "My CIBIL is 750"), "Does not falsely detect salary in CIBIL message");
  assert(messageMentionsField("age", "I am 30 years old"), "Detects age mention");
  assert(!messageMentionsField("age", "3 years tenure"), "Does not falsely detect age in tenure message");
  assert(messageMentionsField("tenureMonths", "3 years tenure"), "Detects tenure mention");
  assert(messageMentionsField("existingEmi", "No existing loans"), "Detects EMI/loan obligation mention");

  // TEST 2: Never invent, default, or reuse missing applicant values
  console.log("\nTest Suite 2: Never invent, default, or reuse missing applicant values");
  const partialProfile: ApplicantProfile = {
    companyName: "Tata Consultancy Services",
    monthlyIncome: 80000,
    loanAmount: 500000,
    tenureMonths: 36,
  };

  // User answers EMI: "no emi"
  const updatedEmi = extractApplicantDetails("no emi", partialProfile, ["existingEmi"]);
  assert(updatedEmi.existingEmi === 0, "Explicit 'no emi' recorded as 0");
  assert(updatedEmi.cibil === undefined, "CIBIL remains strictly undefined (NOT defaulted)");
  assert(updatedEmi.age === undefined, "Age remains strictly undefined (NOT defaulted)");

  // Verify getRequiredPolicyFields marks cibil and age as missing
  const missingAfterEmi = getRequiredPolicyFields(updatedEmi);
  assert(missingAfterEmi.includes("cibil"), "CIBIL is strictly required and listed in missingFields");
  assert(missingAfterEmi.includes("age"), "Age is strictly required and listed in missingFields");
  assert(!missingAfterEmi.includes("monthlyIncome"), "Answered monthlyIncome is NOT missing");
  assert(!missingAfterEmi.includes("existingEmi"), "Answered existingEmi (0) is NOT missing");

  // TEST 3: Secondary extraction NEVER captures unmentioned fields even if LLM hallucinated them
  console.log("\nTest Suite 3: Protection against hallucinated LLM secondary entities");
  const hallucinatedLlmExtraction = {
    monthlyIncome: 85000,
    cibil: 750, // Hallucinated! User never said CIBIL
    age: 30,    // Hallucinated! User never said age
    existingEmi: 5000, // Hallucinated! User never said EMI
  };

  const applicantAnsweringSalary: ApplicantProfile = {
    companyName: "Infosys Limited",
  };

  // User ONLY said "85000" in response to monthlyIncome
  const extractedFromSalary = extractApplicantDetails(
    "85000",
    applicantAnsweringSalary,
    ["monthlyIncome"],
    hallucinatedLlmExtraction
  );

  assert(extractedFromSalary.monthlyIncome === 85000, "Mapped salary from answer correctly");
  assert(extractedFromSalary.cibil === undefined, "Hallucinated CIBIL was REJECTED because user message did not mention CIBIL");
  assert(extractedFromSalary.age === undefined, "Hallucinated Age was REJECTED because user message did not mention Age");
  assert(extractedFromSalary.existingEmi === undefined, "Hallucinated EMI was REJECTED because user message did not mention EMI");

  // TEST 4: Profile Update Mid-Flow: update ONLY the corrected field, preserve other valid values, keep missing fields missing
  console.log("\nTest Suite 4: Mid-Flow Profile Correction Integrity");
  const midFlowApplicant: ApplicantProfile = {
    companyName: "Wipro",
    monthlyIncome: 70000,
    loanAmount: 400000,
    // tenureMonths, cibil, existingEmi, age are missing
  };

  // User says: "Actually my salary is 85000" with LLM returning extra fields
  const midFlowUpdates = extractProfileUpdates("Actually my salary is 85000", {
    monthlyIncome: 85000,
    cibil: 780, // unmentioned in text
    changeFields: ["monthlyIncome"],
  });

  assert(midFlowUpdates.updates.monthlyIncome === 85000, "Only monthlyIncome in updates");
  assert(midFlowUpdates.updates.cibil === undefined, "CIBIL NOT in updates because user did not mention CIBIL");
  assert(midFlowUpdates.updates.loanAmount === undefined, "Loan amount NOT in updates");

  // Apply update to mid-flow profile
  const testConvId = `test_conv_${Date.now()}`;
  const midFlowResult = await applyProfileUpdateAndRecalculate(
    testConvId,
    "Actually my salary is 85000",
    midFlowApplicant,
    { monthlyIncome: 85000, cibil: 780, changeFields: ["monthlyIncome"] }
  );

  assert(midFlowResult.applicant.monthlyIncome === 85000, "Applicant salary updated to 85,000");
  assert(Boolean(midFlowResult.applicant.companyName?.includes("Wipro")), "Company preserved as Wipro (resolved to Wipro Limited)");
  assert(midFlowResult.applicant.loanAmount === 400000, "Loan amount preserved as 400,000");
  assert(midFlowResult.applicant.cibil === undefined, "CIBIL remains strictly undefined/missing");
  assert(midFlowResult.applicant.age === undefined, "Age remains strictly undefined/missing");
  assert(!midFlowResult.isComplete, "Eligibility evaluation was NOT triggered prematurely");
  assert(midFlowResult.missingFields.includes("cibil"), "CIBIL is still in missingFields");
  assert(midFlowResult.reply.includes("Updated your Monthly Salary"), "Reply acknowledges salary update");
  assert(!midFlowResult.reply.includes("Bank Evaluation"), "No premature bank evaluation report generated");

  // TEST 5: Completed Profile Update: update ONLY the corrected field and recalculate
  console.log("\nTest Suite 5: Completed Profile Correction & Recalculation");
  const completedApplicant: ApplicantProfile = {
    companyName: "Tata Consultancy Services",
    monthlyIncome: 100000,
    loanAmount: 500000,
    tenureMonths: 36,
    cibil: 720,
    existingEmi: 0,
    age: 29,
    loanType: "Personal Loan",
  };

  const completedResult = await applyProfileUpdateAndRecalculate(
    testConvId,
    "Change my CIBIL score to 800",
    completedApplicant,
    { cibil: 800, changeFields: ["cibil"] }
  );

  assert(completedResult.applicant.cibil === 800, "CIBIL successfully updated to 800");
  assert(completedResult.applicant.monthlyIncome === 100000, "Salary preserved at 100,000");
  assert(completedResult.applicant.loanAmount === 500000, "Loan amount preserved at 500,000");
  assert(completedResult.applicant.tenureMonths === 36, "Tenure preserved at 36 months");
  assert(completedResult.applicant.existingEmi === 0, "Existing EMI preserved at 0");
  assert(completedResult.applicant.age === 29, "Age preserved at 29");
  assert(completedResult.isComplete, "Eligibility was evaluated and marked complete");
  assert(completedResult.missingFields.length === 0, "Zero missing fields");
  assert(completedResult.reply.includes("Updated your CIBIL Score to 800"), "Acknowledges CIBIL update");
  assert(completedResult.evalResult?.evaluations?.length > 0, "Banks evaluated against Master Policies");

  // TEST 6: Multi-field update: "Change salary to 1.2L and tenure to 5 years"
  console.log("\nTest Suite 6: Multi-field explicit correction");
  const multiUpdates = extractProfileUpdates("Change salary to 1.2L and tenure to 5 years");
  assert(multiUpdates.updates.monthlyIncome === 120000, "Monthly income parsed as 120,000");
  assert(multiUpdates.updates.tenureMonths === 60, "Tenure parsed as 60 months (5 years * 12)");
  assert(multiUpdates.updates.cibil === undefined, "CIBIL untouched");
  assert(multiUpdates.updates.loanAmount === undefined, "Loan amount untouched");

  // TEST 7: Conversational Flow: Missing CIBIL prompts for CIBIL before eligibility
  console.log("\nTest Suite 7: Full conversational flow asking for CIBIL before eligibility");
  const convIdFlow = `conv_flow_${Date.now()}`;

  // 1. User starts loan: "I work at Tata Consultancy Services and want a personal loan"
  const step1 = await processDynamicEligibility(convIdFlow, "I work at Tata Consultancy Services and want a personal loan");
  assert(!step1.isComplete, "Step 1 not complete");
  assert(Boolean(step1.applicant.companyName?.includes("Tata Consultancy Services")), "Company captured");

  // 2. User provides salary: "My salary is 1 lakh"
  const step2 = await processDynamicEligibility(convIdFlow, "My salary is 1 lakh");
  assert(!step2.isComplete, "Step 2 not complete");
  assert(step2.applicant.monthlyIncome === 100000, "Salary captured as 100,000");
  assert(step2.applicant.cibil === undefined, "CIBIL is NOT yet known");

  // 3. User provides loan amount: "Need 6 lakhs"
  const step3 = await processDynamicEligibility(convIdFlow, "Need 6 lakhs");
  assert(!step3.isComplete, "Step 3 not complete");
  assert(step3.applicant.loanAmount === 600000, "Loan amount captured as 600,000");
  assert(step3.applicant.cibil === undefined, "CIBIL is NOT yet known");

  // 4. User provides tenure: "3 years"
  const step4 = await processDynamicEligibility(convIdFlow, "3 years");
  assert(!step4.isComplete, "Step 4 not complete");
  assert(step4.applicant.tenureMonths === 36, "Tenure captured as 36 months");
  assert(step4.applicant.cibil === undefined, "CIBIL is still undefined!");

  // Step 4 must NOT evaluate eligibility, and must ask for one of the missing fields (cibil, existingEmi, age)
  assert(step4.missingFields.includes("cibil"), "CIBIL is confirmed missing in step 4");
  assert(Boolean(step4.nextQuestion && step4.nextQuestion.length > 0), "Asks next question");

  console.log("\n================================================================================");
  console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
