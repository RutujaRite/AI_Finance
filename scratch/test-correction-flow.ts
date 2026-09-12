// scratch/test-correction-flow.ts
import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";

async function testCorrectionFlow() {
  console.log("==================================================");
  console.log("TESTING CORRECTION AND UNEXPECTED REPLIES FLOW");
  console.log("==================================================\n");

  const convId = "conv_corr_" + Date.now();

  // Step 1: User provides initial details
  const msg1 = "I need a personal loan of 5 lakhs. I work at Infosys and earn 70,000 per month.";
  console.log(`User: "${msg1}"`);
  const res1 = await runCentralAgent({ message: msg1, conversationId: convId });
  console.log(`\nAssistant:\n${res1.reply}\n`);

  // Step 2: User corrects company and salary, and raises unexpected query
  const msg2 = "Actually my salary is 1.5 lakhs and I work at Google, not Infosys. What is reducing interest rate?";
  console.log(`User: "${msg2}"`);
  const res2 = await runCentralAgent({
    message: msg2,
    conversationId: convId,
    conversationHistory: [
      { role: "user", content: msg1 },
      { role: "assistant", content: res1.reply },
    ],
  });
  console.log(`\nAssistant:\n${res2.reply}\n`);

  // Step 3: Provide remaining parameters in one sentence
  const msg3 = "Tenure 4 years, CIBIL 760, no EMIs, age 32.";
  console.log(`User: "${msg3}"`);
  const res3 = await runCentralAgent({
    message: msg3,
    conversationId: convId,
    conversationHistory: [
      { role: "user", content: msg1 },
      { role: "assistant", content: res1.reply },
      { role: "user", content: msg2 },
      { role: "assistant", content: res2.reply },
    ],
  });
  console.log(`\nAssistant:\n${res3.reply}\n`);

  const hasExactHeader = res3.reply.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |");
  console.log(`✅ Evaluation Table Header Verification: ${hasExactHeader ? "PASSED" : "FAILED"}`);
  console.log(`✅ Corrected Employer Present (Google): ${res3.reply.toLowerCase().includes("google") ? "PASSED" : "FAILED"}`);
  console.log(`✅ Corrected Salary Present (1,50,000): ${res3.reply.includes("1,50,000") ? "PASSED" : "FAILED"}`);

  console.log("\n==================================================");
  console.log("🎉 CORRECTION FLOW TEST COMPLETED!");
  console.log("==================================================");
  process.exit(0);
}

testCorrectionFlow().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
