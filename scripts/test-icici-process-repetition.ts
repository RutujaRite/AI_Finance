import { runCentralAgent } from "../lib/ai/agent";
import { clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function testIciciProcessing() {
  console.log("==================================================================");
  console.log("🧪 TESTING ICICI LOAN PROCESSING 2-TURN INTERACTION");
  console.log("==================================================================\n");

  const conversationId = `test_icici_${Date.now()}`;
  await clearEligibilityState(conversationId);
  const history: Array<{ role: string; content: string }> = [];

  // Turn 1
  console.log("--- Turn 1: User says 'can you process the loan for icici bank' ---");
  const res1 = await runCentralAgent({
    conversationId,
    message: "can you process the loan for icici bank",
    conversationHistory: history,
  });
  console.log("Assistant Reply 1:\n", res1.reply, "\n");
  history.push({ role: "user", content: "can you process the loan for icici bank" });
  history.push({ role: "assistant", content: res1.reply });

  if (res1.reply.includes("I want to make sure I understand you correctly!")) {
    throw new Error("Turn 1 failed: contains broken repetitive prompt!");
  }
  if (!res1.reply.includes("ICICI Bank") || !res1.reply.includes("Yes, absolutely!")) {
    throw new Error("Turn 1 failed: did not explain ICICI Bank loan processing!");
  }

  // Turn 2: User says again "can you process the loan for icici bank"
  console.log("--- Turn 2: User repeats 'can you process the loan for icici bank' ---");
  const res2 = await runCentralAgent({
    conversationId,
    message: "can you process the loan for icici bank",
    conversationHistory: history,
  });
  console.log("Assistant Reply 2:\n", res2.reply, "\n");

  if (res2.reply.includes("I want to make sure I understand you correctly!")) {
    throw new Error("Turn 2 failed: hijacked by Invariant 2 prompt!");
  }
  if (res2.reply.includes("could you please share your information?")) {
    throw new Error("Turn 2 failed: hijacked by vague 'share your information' prompt!");
  }

  console.log("==================================================================");
  console.log("🎉 SUCCESS: ICICI Loan Processing 2-turn test passed flawlessly!");
  console.log("==================================================================\n");
}

testIciciProcessing().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
