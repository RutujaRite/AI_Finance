import {
  processDynamicEligibility,
  extractApplicantDetails,
  parseFinancialAmount,
  detectAndAnswerSideQuestion,
  detectConversationalContext,
  detectCorrectionInMessage,
  detectTargetedFieldInMessage,
  clearEligibilityState,
  getEligibilityState,
} from "../lib/dynamicEligibilityEngine";
import { runCentralAgent } from "../lib/ai/agent";

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING REALISTIC HUMAN AI FINANCIAL ASSISTANT (NLU + CONTEXT + REASONING)");
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

  // 1. Indian Slang Parsing Tests
  console.log("--- 1. Testing Financial Slang Parsing ---");
  assert(parseFinancialAmount("5 peti") === 500000, "Parse '5 peti' -> 5,00,000");
  assert(parseFinancialAmount("1 khoka") === 10000000, "Parse '1 khoka' -> 1,00,00,000");
  assert(parseFinancialAmount("85 hazar") === 85000, "Parse '85 hazar' -> 85,000");
  assert(parseFinancialAmount("in hand 85k") === 85000, "Parse 'in hand 85k' -> 85,000");
  assert(parseFinancialAmount("zero debt") === 0, "Parse 'zero debt' -> 0");
  assert(parseFinancialAmount("sab clear") === 0, "Parse 'sab clear' -> 0");
  assert(parseFinancialAmount("4-5 lakhs") === 500000, "Parse range '4-5 lakhs' -> 500,000");

  // 2. NLU Helper Tests
  console.log("\n--- 2. Testing NLU Helpers (Emotions, Side Questions, Corrections) ---");
  const ctx = detectConversationalContext("I have a medical emergency in hospital, need loan urgently");
  assert(ctx.statedPurpose === "medical emergency", "Detect medical emergency purpose");
  assert(ctx.urgency === "urgent", "Detect urgent urgency");
  assert(ctx.emotionalTone === "stressed", "Detect stressed emotional tone");

  const sideQ1 = detectAndAnswerSideQuestion("Will checking this affect my CIBIL score?");
  assert(sideQ1.isQuestion === true, "Detect side question on CIBIL impact");
  assert(/soft evaluation|zero impact/i.test(sideQ1.answer || ""), "Accurate answer on soft CIBIL inquiry");

  const sideQ2 = detectAndAnswerSideQuestion("Do I need to submit collateral for this?");
  assert(sideQ2.isQuestion === true, "Detect side question on collateral");
  assert(/unsecured/i.test(sideQ2.answer || ""), "Accurate answer on unsecured personal loan");

  const corr1 = detectCorrectionInMessage("Actually my salary is 95000 not 80k", { monthlyIncome: 80000 });
  assert(corr1.isCorrection === true, "Detect salary correction");
  assert(corr1.field === "monthlyIncome" && corr1.value === 95000, "Correct salary value extracted (95,000)");

  const corr2 = detectCorrectionInMessage("Wait, my tenure is 4 years", { tenureMonths: 36 });
  assert(corr2.isCorrection === true, "Detect tenure correction");
  assert(corr2.field === "tenureMonths" && corr2.value === 48, "Correct tenure months extracted (48 months)");

  // 3. Multi-field extraction with Slang in Single Message
  console.log("\n--- 3. Testing Multi-Field Extraction with Colloquial Slang ---");
  const multiMsg = "I work at Infosys, in hand 85k, need 5 peti loan for 3 saal, cibil is 770, zero debt, age 29";
  const extracted = extractApplicantDetails(multiMsg, {});
  assert(Boolean(extracted.companyName && /infosys/i.test(extracted.companyName)), `Extracted company: ${extracted.companyName}`);
  assert(extracted.monthlyIncome === 85000, `Extracted salary: ${extracted.monthlyIncome}`);
  assert(extracted.loanAmount === 500000, `Extracted loan amount: ${extracted.loanAmount}`);
  assert(extracted.tenureMonths === 36, `Extracted tenure: ${extracted.tenureMonths} months`);
  assert(extracted.cibil === 770, `Extracted CIBIL: ${extracted.cibil}`);
  assert(extracted.existingEmi === 0, `Extracted EMI: ${extracted.existingEmi}`);
  assert(extracted.age === 29, `Extracted age: ${extracted.age}`);

  // 4. Conversational Mid-Flow Side Question Test
  console.log("\n--- 4. Testing Conversational Mid-Flow Side Question ---");
  const convId1 = "test_conv_side_q_" + Date.now();
  await clearEligibilityState(convId1);

  // Turn 1: User indicates loan intent
  const t1 = await processDynamicEligibility(convId1, "I need a personal loan");
  assert(!t1.isComplete, "Turn 1: Started eligibility flow");
  assert(t1.nextQuestion?.toLowerCase().includes("company") || t1.nextQuestion?.toLowerCase().includes("employer"), "Turn 1: Asked for company name");

  // Turn 2: User answers company
  const t2 = await processDynamicEligibility(convId1, "TCS");
  assert(!t2.isComplete, "Turn 2: Accepted company");
  assert(Boolean(t2.applicant.companyName && /tcs|tata consultancy/i.test(t2.applicant.companyName)), `Turn 2: Company resolved (${t2.applicant.companyName})`);

  // Turn 3: User asks side question mid-flow instead of answering salary: "Wait, will checking this hurt my CIBIL?"
  const t3 = await processDynamicEligibility(convId1, "Wait, will checking this hurt my CIBIL?");
  assert(!t3.isComplete, "Turn 3: Still in flow");
  assert(/cibil|soft|credit/i.test(t3.nextQuestion || ""), "Turn 3: Answered CIBIL question directly");
  assert(/salary|take-home|in-hand|income/i.test(t3.nextQuestion || ""), "Turn 3: Prompted for salary in same turn");

  // Turn 4: User now answers salary: "in hand 90k"
  const t4 = await processDynamicEligibility(convId1, "in hand 90k");
  assert(t4.applicant.monthlyIncome === 90000, "Turn 4: Successfully recorded salary 90,000");

  // 5. Conversational Mid-Flow Correction Test
  console.log("\n--- 5. Testing Conversational Mid-Flow Correction ---");
  const convId2 = "test_conv_corr_" + Date.now();
  await clearEligibilityState(convId2);

  await processDynamicEligibility(convId2, "I need a loan for Wipro");
  await processDynamicEligibility(convId2, "salary is 80k");
  const tCorr = await processDynamicEligibility(convId2, "Actually my salary is 95000 not 80k");
  assert(tCorr.applicant.monthlyIncome === 95000, "Turn 3: Corrected salary updated to 95,000");

  // 6. Complete End-to-End Evaluation with Table Output
  console.log("\n--- 6. Testing Full Evaluation Table Output ---");
  const convId3 = "test_conv_full_" + Date.now();
  await clearEligibilityState(convId3);

  const tFull = await processDynamicEligibility(
    convId3,
    "I work at TCS, monthly salary 1.2 lakhs, need 5 lakh loan for 3 years, CIBIL 780, zero EMI, age 28"
  );
  assert(tFull.isComplete === true, "Full evaluation complete in one shot");
  assert(tFull.eligibleBanks && tFull.eligibleBanks.length > 0, `Found ${tFull.eligibleBanks?.length} eligible banks`);
  assert(tFull.formattedMarkdown?.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |"), "Eligibility table contains exact columns | Bank | Status | CIBIL | Tenure | Est. EMI |");

  // 7. Realistic NOT_ELIGIBLE handling
  console.log("\n--- 7. Testing Definitive NOT_ELIGIBLE Handling ---");
  const convId4 = "test_conv_unemp_" + Date.now();
  await clearEligibilityState(convId4);

  const tUnemp = await processDynamicEligibility(convId4, "I am currently jobless, can I get a loan?");
  assert(tUnemp.isComplete === true, "Jobless inquiry terminates without continuing questionnaire");
  assert(/not eligible/i.test(tUnemp.formattedMarkdown || ""), "Clear explanation of ineligibility");
  assert(/income|employment|regular/i.test(tUnemp.formattedMarkdown || ""), "Explains policy income/employment requirement without canned alternatives");

  console.log("\n================================================================================");
  console.log(`🏁 TEST RESULTS: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log("================================================================================\n");

  if (passed === total) {
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("⚠️ SOME TESTS FAILED!");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
