import {
  processDynamicEligibility,
  clearEligibilityState,
} from "../lib/dynamicEligibilityEngine";
import { runCentralAgent } from "../lib/ai/agent";

// Minimal DOM simulation of app/home/page.tsx detectEligibilityResult function
function detectEligibilityResult(content: string) {
  if (!content || typeof content !== "string") return null;

  const hasTable = content.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |");
  const hasApplicantSummary = content.includes("Applicant Summary");
  const isEligibilityAssessment =
    (hasTable && hasApplicantSummary) ||
    ((content.includes("Personal Loan Eligibility Assessment") ||
      content.includes("Personal Loan Eligibility Result:") ||
      content.includes("Assessment Outcome: No Partner Banks Currently Eligible")) &&
     (hasApplicantSummary || hasTable));

  if (!isEligibilityAssessment) return null;

  const isWarningOrError =
    content.includes("No Partner Banks Currently Eligible") ||
    content.includes("Policy Criteria Not Met") ||
    content.includes("❌ NOT ELIGIBLE") ||
    content.includes("❌ Not Eligible") ||
    content.includes("Key Policy Constraints Identified") ||
    content.includes("Assessment Outcome: No Partner Banks Currently Eligible") ||
    content.includes("Input Required / Conditionally Eligible") ||
    /\b(?:not\s+eligible|currently\s+not\s+eligible|ineligible|0\s+partner\s+banks?)\b/i.test(content);

  const hasEligibleTableRows =
    hasTable && /\|\s*\*\*[^*]+\*\*\s*\|\s*✅\s*Eligible/i.test(content);

  const isSuccess = hasEligibleTableRows && !isWarningOrError;

  return {
    isEligibility: true,
    isSuccess,
  };
}

function simulateUiRender(content: string, messageId = "msg_test"): string {
  const eligibilityInfo = detectEligibilityResult(content);
  if (!eligibilityInfo) {
    return `<div class="chat-message">${content}</div>`;
  }

  if (eligibilityInfo.isSuccess) {
    return `<div class="eligibility-card eligibility-card-success">
      <span>Eligibility Confirmed — Qualifying Partner Banks Found</span>
      <div>${content}</div>
    </div>`;
  } else {
    return `<div class="eligibility-card eligibility-card-warning">
      <span>Eligibility Assessment — Policy Criteria Not Met</span>
      <div>${content}</div>
    </div>`;
  }
}

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING NATURAL FINAL RESPONSE GENERATION & UI NOT_ELIGIBLE FIX");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: any, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 1: User says "I am not working anywhere"
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 1: User says 'I am not working anywhere' ---");
  const convId1 = `test_not_working_${Date.now()}`;
  await clearEligibilityState(convId1);

  // Turn 1: User starts loan inquiry
  const turn1 = await processDynamicEligibility(convId1, "I need a loan");
  assert(!turn1.isComplete, "Turn 1: Flow started and asking for details");

  // Turn 2: User says "I am not working anywhere"
  const turn2 = await processDynamicEligibility(convId1, "I am not working anywhere");
  console.log("\nTurn 2 Assistant Response:\n" + turn2.formattedMarkdown + "\n");

  // A. Flow must terminate immediately
  assert(turn2.isComplete === true, "Turn 2: Terminated immediately on ineligibility");

  // B. Must NOT contain the old canned report header
  assert(
    !turn2.formattedMarkdown?.includes("### ℹ️ Personal Loan Eligibility Assessment"),
    "Turn 2: Does NOT contain canned header '### ℹ️ Personal Loan Eligibility Assessment'"
  );

  // C. Must NOT contain hardcoded canned bullet points
  assert(
    !turn2.formattedMarkdown?.includes("• **Mandatory Income Requirement**"),
    "Turn 2: Does NOT contain canned bullet point 'Mandatory Income Requirement'"
  );

  // D. Must NOT contain hardcoded alternatives block
  assert(
    !turn2.formattedMarkdown?.includes("💡 **Alternative Options You Can Explore**"),
    "Turn 2: Does NOT contain hardcoded canned alternatives block"
  );
  assert(
    !turn2.formattedMarkdown?.includes("1. **Apply with an Earning Co-Applicant**"),
    "Turn 2: Does NOT contain hardcoded co-applicant option #1"
  );

  // E. Must be a natural conversational explanation mentioning policy income requirement
  assert(
    /regular\s*income|verifiable\s*income|steady\s*income|monthly\s*income|unemployed/i.test(turn2.formattedMarkdown || ""),
    "Turn 2: Naturally explains that policies require regular income"
  );
  assert(
    /not\s*eligible/i.test(turn2.formattedMarkdown || ""),
    "Turn 2: Naturally states not eligible based on policies"
  );

  // F. UI Check: simulate UI render
  const uiHtml1 = simulateUiRender(turn2.formattedMarkdown || "");
  assert(
    !uiHtml1.includes("Eligibility Confirmed — Qualifying Partner Banks Found"),
    "UI Check 1: UI NEVER displays 'Eligibility Confirmed — Qualifying Partner Banks Found'"
  );
  const detectRes1 = detectEligibilityResult(turn2.formattedMarkdown || "");
  assert(
    detectRes1 === null || detectRes1.isSuccess === false,
    "UI Check 1: detectEligibilityResult is either null (natural chat) or isSuccess: false"
  );

  // ---------------------------------------------------------------------------
  // TEST 2: User says "I am jobless" in single opening turn
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: User says 'I am jobless' in opening turn ---");
  const convId2 = `test_jobless_${Date.now()}`;
  await clearEligibilityState(convId2);

  const res2 = await processDynamicEligibility(convId2, "I am jobless, can I get a loan?");
  console.log("\nResponse:\n" + res2.formattedMarkdown + "\n");

  assert(res2.isComplete === true, "Test 2: Terminated immediately");
  assert(
    !res2.formattedMarkdown?.includes("### ℹ️ Personal Loan Eligibility Assessment"),
    "Test 2: No canned header"
  );
  assert(
    !res2.formattedMarkdown?.includes("💡 **Alternative Options You Can Explore**"),
    "Test 2: No canned alternatives block"
  );
  assert(
    /unemployed|income|not\s*eligible/i.test(res2.formattedMarkdown || ""),
    "Test 2: Natural explanation of policy requirement"
  );

  const uiHtml2 = simulateUiRender(res2.formattedMarkdown || "");
  assert(
    !uiHtml2.includes("Eligibility Confirmed — Qualifying Partner Banks Found"),
    "UI Check 2: UI NEVER displays 'Eligibility Confirmed — Qualifying Partner Banks Found'"
  );

  // ---------------------------------------------------------------------------
  // TEST 3: User answers "0rs" for salary
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: User answers '0rs' for salary ---");
  const convId3 = `test_zero_salary_${Date.now()}`;
  await clearEligibilityState(convId3);

  await processDynamicEligibility(convId3, "I need a personal loan");
  await processDynamicEligibility(convId3, "Wipro");
  const res3 = await processDynamicEligibility(convId3, "0rs");
  console.log("\nResponse:\n" + res3.formattedMarkdown + "\n");

  assert(res3.isComplete === true, "Test 3: Terminated immediately on zero income");
  assert(
    !res3.formattedMarkdown?.includes("### ℹ️ Personal Loan Eligibility Assessment"),
    "Test 3: No canned header"
  );
  assert(
    !res3.formattedMarkdown?.includes("💡 **Alternative Options You Can Explore**"),
    "Test 3: No canned alternatives"
  );
  assert(
    /income|salary|not\s*eligible/i.test(res3.formattedMarkdown || ""),
    "Test 3: Natural explanation of salary criteria"
  );

  const uiHtml3 = simulateUiRender(res3.formattedMarkdown || "");
  assert(
    !uiHtml3.includes("Eligibility Confirmed — Qualifying Partner Banks Found"),
    "UI Check 3: UI NEVER displays 'Eligibility Confirmed — Qualifying Partner Banks Found'"
  );

  // ---------------------------------------------------------------------------
  // TEST 4: Fully Eligible User -> Must Render Table and UI Success Card
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Fully Eligible User ---");
  const convId4 = `test_eligible_${Date.now()}`;
  await clearEligibilityState(convId4);

  const res4 = await processDynamicEligibility(
    convId4,
    "I work at Tata Consultancy Services, monthly salary 90000, need 5 lakh loan for 3 years, CIBIL 770, zero emi, age 29"
  );

  assert(res4.isComplete === true, "Test 4: Evaluation complete");
  assert(res4.eligibleBanks && res4.eligibleBanks.length > 0, `Test 4: Found ${res4.eligibleBanks?.length} eligible banks`);
  assert(
    res4.formattedMarkdown?.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |"),
    "Test 4: Contains exact required table format"
  );

  const detectRes4 = detectEligibilityResult(res4.formattedMarkdown || "");
  assert(
    detectRes4 !== null && detectRes4.isSuccess === true,
    "Test 4: detectEligibilityResult correctly detects SUCCESS for eligible table"
  );

  const uiHtml4 = simulateUiRender(res4.formattedMarkdown || "");
  assert(
    uiHtml4.includes("Eligibility Confirmed — Qualifying Partner Banks Found"),
    "Test 4: UI shows Eligibility Confirmed for genuinely eligible user"
  );

  // ---------------------------------------------------------------------------
  // TEST 5: Full Ineligible Profile (Low CIBIL failing all banks)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: Full Ineligible Profile (CIBIL 500 failing all banks) ---");
  const convId5 = `test_ineligible_${Date.now()}`;
  await clearEligibilityState(convId5);

  const res5 = await processDynamicEligibility(
    convId5,
    "I work at TCS, salary 50000, loan 500000 for 3 years, CIBIL 500, zero emi, age 30"
  );

  assert(res5.isComplete === true, "Test 5: Evaluation complete");
  assert(res5.eligibleBanks?.length === 0, "Test 5: 0 eligible banks found");
  assert(
    res5.formattedMarkdown?.includes("No Partner Banks Currently Eligible") ||
    res5.formattedMarkdown?.includes("Policy Criteria Not Met") ||
    res5.formattedMarkdown?.includes("Credit Score (CIBIL)"),
    "Test 5: Explains specific policy hurdles"
  );

  const detectRes5 = detectEligibilityResult(res5.formattedMarkdown || "");
  assert(
    detectRes5 !== null && detectRes5.isSuccess === false,
    "Test 5: detectEligibilityResult correctly flags isSuccess: FALSE"
  );

  const uiHtml5 = simulateUiRender(res5.formattedMarkdown || "");
  assert(
    !uiHtml5.includes("Eligibility Confirmed — Qualifying Partner Banks Found"),
    "Test 5: UI NEVER displays Eligibility Confirmed for ineligible profile"
  );
  assert(
    uiHtml5.includes("Eligibility Assessment — Policy Criteria Not Met"),
    "Test 5: UI displays Policy Criteria Not Met warning banner"
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`🏁 TEST RESULTS: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log("================================================================================\n");

  if (passed === total) {
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME TESTS FAILED.");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
