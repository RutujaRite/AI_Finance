import pool from "../lib/db";
import { runCentralAgent } from "../lib/ai/agent";
import { clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function main() {
  console.log("=== Testing runCentralAgent End-to-End ===\n");

  const convId = "test_agent_" + Date.now();
  await clearEligibilityState(convId);

  // Turn 1: User says: "I need a personal loan"
  console.log("Turn 1: User -> 'I need a personal loan'");
  const r1 = await runCentralAgent({
    message: "I need a personal loan",
    conversationId: convId,
  });
  console.log("AI Reply 1:\n", r1.reply, "\n");

  // Turn 2: User says: "Wipro"
  console.log("Turn 2: User -> 'Wipro'");
  const r2 = await runCentralAgent({
    message: "Wipro",
    conversationId: convId,
  });
  console.log("AI Reply 2:\n", r2.reply, "\n");

  // Turn 3: User says: "120000"
  console.log("Turn 3: User -> '120000'");
  const r3 = await runCentralAgent({
    message: "120000",
    conversationId: convId,
  });
  console.log("AI Reply 3:\n", r3.reply, "\n");

  // Turn 4: User says: "500000"
  console.log("Turn 4: User -> '500000'");
  const r4 = await runCentralAgent({
    message: "500000",
    conversationId: convId,
  });
  console.log("AI Reply 4:\n", r4.reply, "\n");

  // Turn 5: User says: "3 years"
  console.log("Turn 5: User -> '3 years'");
  const r5 = await runCentralAgent({
    message: "3 years",
    conversationId: convId,
  });
  console.log("AI Reply 5:\n", r5.reply, "\n");

  // Turn 6: User says: "cibil 800"
  console.log("Turn 6: User -> 'cibil 800'");
  const r6 = await runCentralAgent({
    message: "cibil 800",
    conversationId: convId,
  });
  console.log("AI Reply 6:\n", r6.reply, "\n");

  // Turn 7: User says: "none"
  console.log("Turn 7: User -> 'none'");
  const r7 = await runCentralAgent({
    message: "none",
    conversationId: convId,
  });
  console.log("AI Reply 7:\n", r7.reply, "\n");

  // Turn 8: User says: "30"
  console.log("Turn 8: User -> '30'");
  const r8 = await runCentralAgent({
    message: "30",
    conversationId: convId,
  });
  console.log("AI Reply 8 (Final Evaluation):\n", r8.reply.slice(0, 600), "\n...");

  await clearEligibilityState(convId);
  await pool.end();
  console.log("\n✅ End-to-end integration test passed!");
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
