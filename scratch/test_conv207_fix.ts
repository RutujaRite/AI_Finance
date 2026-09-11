import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function testFix() {
  const convId = "test-conv207-fix-" + Date.now();

  console.log("=== STEP 1: Opening Loan Request ===");
  const m1 = "I want a personal loan. I work at capgemini, I'm 28 years old, earn 1.5 lakh per month, my CIBIL is 810, I need 10 lakh";
  const r1 = await runCentralAgent({ message: m1, conversationId: convId });
  console.log("Step 1 State:", (await getEligibilityState(convId))?.applicant);

  console.log("\n=== STEP 2: Answering Tenure ===");
  const m2 = "60 months";
  const r2 = await runCentralAgent({ message: m2, conversationId: convId });
  console.log("Step 2 State:", (await getEligibilityState(convId))?.applicant);

  console.log("\n=== STEP 3: Answering 0 EMI ===");
  const m3 = "0";
  const r3 = await runCentralAgent({ message: m3, conversationId: convId });
  console.log("Step 3 Reply Preview:\n", r3.reply.slice(0, 300));
  console.log("Step 3 State:", await getEligibilityState(convId));
}

testFix().catch(console.error);
