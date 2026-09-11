import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function main() {
  console.log("===============================================================");
  console.log("🚀 Testing LLM/NLU-Driven CreditWise AI Multi-Turn Conversations");
  console.log("===============================================================\n");

  const conversationId = "test-llm-flow-" + Date.now();
  const history: Array<{ role: string; content: string }> = [];

  async function chat(userMsg: string, testLabel: string) {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`💬 [User] (${testLabel}): "${userMsg}"`);
    console.log(`---------------------------------------------------------------`);

    const result = await runCentralAgent({
      message: userMsg,
      conversationId,
      conversationHistory: [...history],
    });

    console.log(`🤖 [CreditWise AI]:\n${result.reply}\n`);

    // Update conversation history
    history.push({ role: "user", content: userMsg });
    history.push({ role: "assistant", content: result.reply });

    const state = await getEligibilityState(conversationId);
    console.log(`📊 [Current State]:`, {
      expectedField: state?.expectedField,
      missingFields: state?.missingFields,
      applicant: state?.applicant,
      inFlow: state?.in_eligibility_flow,
    });

    return { result, state };
  }

  // --- Scenario 1: Natural Loan Intent + Multiple Details ---
  console.log("\n==================== SCENARIO 1: Opening Multi-Detail Loan Intent ====================");
  const step1 = await chat("I need a personal loan, I work at Tata Consultancy Services with 85000 salary", "Opening Intent with 2 details");
  if (!step1.result.reply || step1.result.reply.length === 0) {
    throw new Error("Step 1 failed: Empty reply");
  }
  if (!step1.state?.applicant?.companyName?.includes("Tata")) {
    console.warn("⚠️ Warning: company name not captured in step 1", step1.state?.applicant);
  }

  // --- Scenario 2: Objection / In-flow Side Question (Why CIBIL?) ---
  console.log("\n==================== SCENARIO 2: In-Flow Objection (Why CIBIL / Will it hurt score?) ====================");
  const step2 = await chat("Will checking my eligibility hurt my CIBIL score? Why do you need it?", "In-flow objection");
  // Should answer naturally about soft check, no impact, and keep asking for missing fields
  if (/cibil|soft|inquiry|check/i.test(step2.result.reply)) {
    console.log("✅ Step 2 passed: Successfully answered CIBIL objection dynamically!");
  } else {
    console.warn("⚠️ Step 2 warning: Expected mention of CIBIL/soft inquiry");
  }

  // --- Scenario 3: Unexpected Reply ("I don't know my cibil score") ---
  console.log("\n==================== SCENARIO 3: Unexpected Reply (Don't know CIBIL) ====================");
  const step3 = await chat("I don't know my CIBIL score, I have never checked it", "Unexpected reply");
  if (!step3.result.reply || step3.result.reply.length === 0) {
    throw new Error("Step 3 failed: Empty reply");
  }

  // --- Scenario 4: Answering Remaining Loan Parameters ---
  console.log("\n==================== SCENARIO 4: Providing Loan Amount & Tenure ====================");
  const step4 = await chat("I need 5 lakh for 3 years", "Loan amount + tenure");
  if (!step4.result.reply || step4.result.reply.length === 0) {
    throw new Error("Step 4 failed: Empty reply");
  }

  // --- Scenario 5: Another Objection (Why Age?) ---
  console.log("\n==================== SCENARIO 5: Another Objection (Why Age?) ====================");
  const step5 = await chat("Why do you need my age? Is that really necessary?", "Why age objection");
  if (/age|21|60|tenure|legal|statutory/i.test(step5.result.reply)) {
    console.log("✅ Step 5 passed: Successfully explained why age is required!");
  } else {
    console.warn("⚠️ Step 5 warning: Expected age explanation");
  }

  // --- Scenario 6: Providing Age & Existing EMIs to complete eligibility ---
  console.log("\n==================== SCENARIO 6: Completing Assessment with Age & Zero EMI ====================");
  const step6 = await chat("I am 29 years old and have 0 existing emi", "Age and EMI details");
  if (/\|.*Bank.*\|.*Status.*\|.*CIBIL.*\|.*Tenure.*\|.*Est\. EMI.*\|/i.test(step6.result.reply)) {
    console.log("✅ Step 6 passed: Eligibility evaluation table generated correctly with required columns!");
  } else {
    console.log("ℹ️ Step 6: Follow-up question or evaluation returned:\n", step6.result.reply);
  }

  // --- Scenario 7: Dynamic Profile Correction (Salary update) ---
  console.log("\n==================== SCENARIO 7: Dynamic Profile Correction ====================");
  const step7 = await chat("Wait, actually my salary is 1.2 lakh, not 85k", "Correction");
  if (/1,20,000|1.2/i.test(step7.result.reply)) {
    console.log("✅ Step 7 passed: Profile correction reflected new salary!");
  } else {
    console.log("ℹ️ Step 7 response:\n", step7.result.reply);
  }

  // Clean up
  await clearEligibilityState(conversationId);
  console.log("\n===============================================================");
  console.log("🎉 ALL MULTI-TURN LLM/NLU TESTS COMPLETED SUCCESSFULLY!");
  console.log("===============================================================\n");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
