import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { clearEligibilityState, getEligibilityState } from "../lib/dynamicEligibilityEngine";

async function main() {
  console.log("================================================================================");
  console.log("   TESTING BANK_POLICY vs PERSONAL ELIGIBILITY INTENT DETECTION                 ");
  console.log("================================================================================\n");

  // TEST 1: Policy inquiry: "Tell me the eligibility criteria for HDFC Bank"
  console.log("=== TEST 1: 'Tell me the eligibility criteria for HDFC Bank' ===");
  const convId1 = "test_hdfc_policy_" + Date.now();
  await clearEligibilityState(convId1);

  const res1 = await runCentralAgent({
    message: "Tell me the eligibility criteria for HDFC Bank",
    conversationId: convId1,
  });

  console.log("\nResponse from Agent:\n----------------------------------------");
  console.log(res1.reply);
  console.log("----------------------------------------\n");

  const state1 = await getEligibilityState(convId1);
  const isInFlow1 = Boolean(state1?.in_eligibility_flow || state1?.expectedField);

  // Assertions for Test 1
  const containsHdfcPolicy = /HDFC/i.test(res1.reply);
  const containsCriteriaTable = /\|.*Criteria.*\|.*Details.*\|/i.test(res1.reply) || /Loan Products/i.test(res1.reply);
  const asksForSalaryOrProfile = /(?:share\s+which\s+company|your\s+approximate\s+net\s+monthly|share\s+your\s+approximate\s+cibil|share\s+your\s+current\s+age)/i.test(res1.reply);

  console.log("[Test 1 Assertions]:");
  console.log("- Mentions HDFC Bank:", containsHdfcPolicy ? "PASS" : "FAIL");
  console.log("- Contains Policy Summary / Criteria Table:", containsCriteriaTable ? "PASS" : "FAIL");
  console.log("- Did NOT ask for salary/CIBIL/age/profile details:", !asksForSalaryOrProfile ? "PASS" : "FAIL");
  console.log("- Did NOT enter eligibility flow:", !isInFlow1 ? "PASS" : "FAIL");

  if (!containsHdfcPolicy || !containsCriteriaTable || asksForSalaryOrProfile || isInFlow1) {
    console.error("TEST 1 FAILED!");
    process.exit(1);
  }
  console.log("TEST 1 PASSED!\n");

  // TEST 2: Personal eligibility query: "I want a personal loan"
  console.log("=== TEST 2: 'I want a personal loan' (Personal Eligibility Query) ===");
  const convId2 = "test_personal_loan_" + Date.now();
  await clearEligibilityState(convId2);

  const res2 = await runCentralAgent({
    message: "I want a personal loan",
    conversationId: convId2,
  });

  console.log("\nResponse from Agent:\n----------------------------------------");
  console.log(res2.reply);
  console.log("----------------------------------------\n");

  const state2 = await getEligibilityState(convId2);
  const isInFlow2 = Boolean(state2?.in_eligibility_flow || state2?.expectedField);
  const asksDetails2 = /(?:company|employer|salary|income|details|borrow)/i.test(res2.reply);

  console.log("[Test 2 Assertions]:");
  console.log("- Initiated loan eligibility flow:", (isInFlow2 || asksDetails2) ? "PASS" : "FAIL");
  console.log("- Asks for applicant details:", asksDetails2 ? "PASS" : "FAIL");

  if (!isInFlow2 && !asksDetails2) {
    console.error("TEST 2 FAILED!");
    process.exit(1);
  }
  console.log("TEST 2 PASSED!\n");

  // TEST 3: Bank Policy query: "What is the eligibility criteria for ICICI Bank?"
  console.log("=== TEST 3: 'What is the eligibility criteria for ICICI Bank?' ===");
  const convId3 = "test_icici_policy_" + Date.now();
  await clearEligibilityState(convId3);

  const res3 = await runCentralAgent({
    message: "What is the eligibility criteria for ICICI Bank?",
    conversationId: convId3,
  });

  console.log("\nResponse from Agent:\n----------------------------------------");
  console.log(res3.reply);
  console.log("----------------------------------------\n");

  const state3 = await getEligibilityState(convId3);
  const isInFlow3 = Boolean(state3?.in_eligibility_flow || state3?.expectedField);
  const containsIciciPolicy = /ICICI/i.test(res3.reply);
  const asksProfile3 = /(?:share\s+which\s+company|your\s+approximate\s+net\s+monthly)/i.test(res3.reply);

  console.log("[Test 3 Assertions]:");
  console.log("- Mentions ICICI Bank:", containsIciciPolicy ? "PASS" : "FAIL");
  console.log("- Did NOT ask for salary/CIBIL/age/profile details:", !asksProfile3 ? "PASS" : "FAIL");
  console.log("- Did NOT enter eligibility flow:", !isInFlow3 ? "PASS" : "FAIL");

  if (!containsIciciPolicy || asksProfile3 || isInFlow3) {
    console.error("TEST 3 FAILED!");
    process.exit(1);
  }
  console.log("TEST 3 PASSED!\n");

  console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
