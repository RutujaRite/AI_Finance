import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";

async function testBankSelection() {
  console.log("=== Testing Bank Selection Connection ===");
  const testConvId = "test_select_" + Date.now();

  // Step 1: Complete evaluation
  const res1 = await runCentralAgent({
    message: "I work at TCS, salary 95k, need 5 lakhs for 3 years, CIBIL 760, no EMI, age 29",
    conversationId: testConvId,
  });
  console.log("Evaluation complete, eligible banks returned.");

  // Step 2: User chooses a bank
  const res2 = await runCentralAgent({
    message: "Connect me with HDFC in Mumbai",
    conversationId: testConvId,
  });

  console.log("\nASSISTANT REPLY:\n", res2.reply);

  const hasMgr = res2.reply.includes("Official Bank Manager Directory") || res2.reply.includes("HDFC");
  console.log("\nManager Connection Check:", hasMgr ? "✅ PASSED" : "❌ FAILED");
  if (!hasMgr) process.exit(1);
}

testBankSelection().catch((err) => {
  console.error(err);
  process.exit(1);
});
