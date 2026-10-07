// scripts/test-personal-loan-offers-interruption.ts

import { runCentralAgent } from "../lib/ai/agent";

async function runTest() {
  console.log("==================================================================");
  console.log("🧪 TESTING MULTI-TURN INTERRUPTION: 'Do you have any personal loan offers?'");
  console.log("==================================================================\n");

  const conversationId = `test-offers-${Date.now()}`;
  const history: Array<{ role: string; content: string }> = [];

  // Turn 1: User says "My company is Microsoft"
  console.log("--- Turn 1: User: 'My company is Microsoft' ---");
  const turn1Msg = "My company is Microsoft";
  history.push({ role: "user", content: turn1Msg });
  const turn1Res = await runCentralAgent({
    conversationId,
    message: turn1Msg,
    conversationHistory: history,
  });
  history.push({ role: "assistant", content: turn1Res.reply });

  console.log("Turn 1 Response Preview:\n", turn1Res.reply.slice(0, 200), "...\n");
  const hadDisambiguation =
    turn1Res.reply.includes("Matching Companies") ||
    turn1Res.reply.includes("MICROSOFT");
  console.log(`Turn 1 gave disambiguation options: ${hadDisambiguation ? "YES" : "NO"}`);

  // Turn 2: User interrupts with "Do you have any personal loan offers?"
  console.log("\n--- Turn 2: User: 'Do you have any personal loan offers?' ---");
  const turn2Msg = "Do you have any personal loan offers?";
  history.push({ role: "user", content: turn2Msg });
  const turn2Res = await runCentralAgent({
    conversationId,
    message: turn2Msg,
    conversationHistory: history,
  });
  history.push({ role: "assistant", content: turn2Res.reply });

  console.log("Turn 2 Response:\n", turn2Res.reply, "\n");

  // VALIDATIONS FOR TURN 2:
  const doesNotRepeatCompanyOptions =
    !turn2Res.reply.includes("Matching Companies Found for 'MICROSOFT'") &&
    !turn2Res.reply.includes("Please select your exact employer:");

  const hasOffersTable =
    turn2Res.reply.includes("Personal Loan Offers") ||
    turn2Res.reply.includes("Top Private Banks") ||
    turn2Res.reply.includes("10.25%");

  const hasContextualBridge =
    /microsoft/i.test(turn2Res.reply) &&
    (turn2Res.reply.includes("salary") || turn2Res.reply.includes("Coming back"));

  console.log("Validation Results for Turn 2:");
  console.log(`1. Does NOT re-render matching companies form: ${doesNotRepeatCompanyOptions ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`2. Provides personal loan offers details/table: ${hasOffersTable ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`3. Resumption bridge acknowledges Microsoft and prompts salary: ${hasContextualBridge ? "✅ PASS" : "❌ FAIL"}`);

  if (!doesNotRepeatCompanyOptions || !hasOffersTable || !hasContextualBridge) {
    console.error("\n❌ Turn 2 failed validation!");
    process.exit(1);
  }

  // Turn 3: User answers with salary
  console.log("\n--- Turn 3: User: 'My monthly salary is 75000' ---");
  const turn3Msg = "My monthly salary is 75000";
  history.push({ role: "user", content: turn3Msg });
  const turn3Res = await runCentralAgent({
    conversationId,
    message: turn3Msg,
    conversationHistory: history,
  });
  history.push({ role: "assistant", content: turn3Res.reply });

  console.log("Turn 3 Response Preview:\n", turn3Res.reply.slice(0, 300), "\n");

  const turn3DoesNotAskEmployer =
    !turn3Res.reply.includes("Matching Companies Found") &&
    !turn3Res.reply.includes("name of your current employer");

  console.log(`4. Turn 3 seamlessly proceeds without asking for company: ${turn3DoesNotAskEmployer ? "✅ PASS" : "❌ FAIL"}`);

  if (!turn3DoesNotAskEmployer) {
    console.error("\n❌ Turn 3 failed validation!");
    process.exit(1);
  }

  console.log("\n==================================================================");
  console.log("🎉 ALL MULTI-TURN INTERRUPTION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================================");
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
