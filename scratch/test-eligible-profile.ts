import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";

async function testEligibleProfile() {
  console.log("=== Testing Full Eligible Profile Evaluation ===");
  const testConvId = "test_eligible_" + Date.now();

  const userMessage =
    "I work at TCS as a salaried employee. My monthly salary is 95,000. I need a personal loan of 5 lakhs for 3 years. My CIBIL score is 760, my existing EMI is 0, and my age is 29.";

  console.log(`USER: "${userMessage}"`);

  const result = await runCentralAgent({
    message: userMessage,
    conversationId: testConvId,
  });

  console.log("\nASSISTANT REPLY:\n", result.reply);

  const hasTable = result.reply.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |");
  console.log("\nTable Check:", hasTable ? "✅ PASSED" : "❌ FAILED");
  if (!hasTable) {
    process.exit(1);
  }
}

testEligibleProfile().catch((err) => {
  console.error(err);
  process.exit(1);
});
