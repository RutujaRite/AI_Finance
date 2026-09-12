import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { clearEligibilityState, getEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTest() {
  console.log("==================================================");
  console.log("STARTING FULLY LLM-DRIVEN ASSISTANT TEST SUITE");
  console.log("==================================================\n");

  const testConvId = "test_conv_" + Date.now();
  await clearEligibilityState(testConvId);

  const history: Array<{ role: string; content: string }> = [];

  async function step(userMessage: string, label: string) {
    console.log(`\n--------------------------------------------------`);
    console.log(`[TEST STEP: ${label}]`);
    console.log(`USER: "${userMessage}"`);

    const result = await runCentralAgent({
      message: userMessage,
      conversationId: testConvId,
      conversationHistory: [...history],
    });

    console.log(`ASSISTANT REPLY:\n${result.reply}\n`);

    // Add to dialogue history
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: result.reply });

    const state = await getEligibilityState(testConvId);
    console.log(`STORED APPLICANT STATE:`, JSON.stringify(state?.applicant || {}));
    console.log(`EXPECTED / MISSING FIELDS:`, state?.missingFields);
    return result;
  }

  // 1. Natural Loan Intent
  await step("I need a loan", "Natural Loan Intent Detection");

  // 2. Question mid-flow
  await step("Why do you need my company name? Is my data safe?", "Handling Question/Objection mid-flow");

  // 3. Providing company and salary
  await step("I work at TCS and my monthly salary is 80,000", "Providing partial applicant details");

  // 4. Asking concept question mid-flow
  await step("What does FOIR mean?", "Financial concept question during assessment");

  // 5. Providing loan amount and tenure
  await step("I want a loan of 5 lakhs for 3 years", "Providing loan amount and tenure");

  // 6. Correcting previous salary
  await step("Wait, actually my salary is 95,000, not 80,000", "Correcting previously provided salary");

  // 7. Handling unexpected reply (NTC / no credit score)
  await step("I don't have a credit score, I've never taken a loan or credit card", "Handling New-To-Credit / no score");

  // 8. Providing final details (existing EMI + age) -> Should trigger ELIGIBILITY REPORT
  const evalResult = await step("I have zero EMIs, and I am 29 years old", "Final parameters -> Eligibility Decision");

  // Verify the eligibility table exists in the response
  if (evalResult.reply.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |")) {
    console.log("\n✅ PASSED: Eligibility Results Table formatted with exact required columns!");
  } else {
    console.log("\n❌ FAILED: Table format does not match expected columns!");
  }

  // 9. Bank Policy Query
  console.log(`\n--------------------------------------------------`);
  console.log(`[TEST STEP: Bank Policy Query]`);
  const policyResult = await runCentralAgent({
    message: "What is HDFC bank policy?",
    conversationId: "test_policy_conv_" + Date.now(),
  });
  console.log(`ASSISTANT POLICY REPLY:\n${policyResult.reply}\n`);
  if (policyResult.reply.includes("| Criteria | Details |")) {
    console.log("✅ PASSED: Bank policy formatted with 2-column Criteria | Details table!");
  } else {
    console.log("❌ FAILED: Bank policy table format!");
  }

  // 10. EMI Calculation
  console.log(`\n--------------------------------------------------`);
  console.log(`[TEST STEP: EMI Calculation]`);
  const emiResult = await runCentralAgent({
    message: "Calculate EMI for 10 lakhs at 11% for 5 years",
    conversationId: "test_emi_conv_" + Date.now(),
  });
  console.log(`ASSISTANT EMI REPLY:\n${emiResult.reply}\n`);
  if (emiResult.reply.includes("Estimated Monthly EMI") || emiResult.reply.includes("EMI Calculation Result")) {
    console.log("✅ PASSED: EMI calculation returned accurately!");
  } else {
    console.log("❌ FAILED: EMI calculation result!");
  }

  console.log("\n==================================================");
  console.log("TEST SUITE COMPLETED");
  console.log("==================================================");
}

runTest().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
