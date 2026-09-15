import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function main() {
  console.log("================================================================================");
  console.log("   TESTING CONTEXT HANDLING & 'WHAT AM I ASKING?' INTENT UNDERSTANDING          ");
  console.log("================================================================================\n");

  // TEST 1: User asks "can i get loan if i am jobless", then "what am I asking?"
  console.log("=== SCENARIO 1: 'can i get loan if i am jobless' -> 'what am I asking?' ===");
  const convId1 = "test_context_jobless_" + Date.now();
  await clearEligibilityState(convId1);

  const history1: Array<{ role: string; content: string }> = [];

  console.log("Turn 1 User: can i get loan if i am jobless");
  history1.push({ role: "user", content: "can i get loan if i am jobless" });
  const res1 = await runCentralAgent({
    message: "can i get loan if i am jobless",
    conversationId: convId1,
    conversationHistory: history1,
  });
  console.log("Turn 1 Assistant:\n", res1.reply.slice(0, 200) + "...\n");
  history1.push({ role: "assistant", content: res1.reply });

  console.log("Turn 2 User: what am I asking?");
  history1.push({ role: "user", content: "what am I asking?" });
  const res2 = await runCentralAgent({
    message: "what am I asking?",
    conversationId: convId1,
    conversationHistory: history1,
  });
  console.log("Turn 2 Assistant:\n", res2.reply);

  const isTable1 = res2.reply.includes("| Bank |") || res2.reply.includes("|---");
  const asksBank1 = /which bank|select a bank|choose a bank/i.test(res2.reply);
  const mentionsJobless = /jobless|unemployed|without a job|no job/i.test(res2.reply);
  const explainsJoblessPolicy = /partner bank|active employment|income|collateral|secured/i.test(res2.reply);

  console.log("\n[Scenario 1 Assertions]:");
  console.log("- Mentions user's previous jobless question:", mentionsJobless ? "PASS" : "FAIL");
  console.log("- Directly answers previous question with policy:", explainsJoblessPolicy ? "PASS" : "FAIL");
  console.log("- Did NOT ask for a bank:", !asksBank1 ? "PASS" : "FAIL");
  console.log("- Did NOT generate a table:", !isTable1 ? "PASS" : "FAIL");

  if (!mentionsJobless || !explainsJoblessPolicy || asksBank1 || isTable1) {
    console.error("SCENARIO 1 FAILED!");
  } else {
    console.log("SCENARIO 1 PASSED!\n");
  }

  // TEST 2: User starts personal loan flow, then asks "what did I ask?"
  console.log("=== SCENARIO 2: 'I want a personal loan' -> 'what did I ask?' ===");
  const convId2 = "test_context_loan_" + Date.now();
  await clearEligibilityState(convId2);

  const history2: Array<{ role: string; content: string }> = [];

  console.log("Turn 1 User: I want a personal loan");
  history2.push({ role: "user", content: "I want a personal loan" });
  const res2_1 = await runCentralAgent({
    message: "I want a personal loan",
    conversationId: convId2,
    conversationHistory: history2,
  });
  console.log("Turn 1 Assistant:\n", res2_1.reply.slice(0, 200) + "...\n");
  history2.push({ role: "assistant", content: res2_1.reply });

  console.log("Turn 2 User: what did I ask?");
  history2.push({ role: "user", content: "what did I ask?" });
  const res2_2 = await runCentralAgent({
    message: "what did I ask?",
    conversationId: convId2,
    conversationHistory: history2,
  });
  console.log("Turn 2 Assistant:\n", res2_2.reply);

  const isTable2 = res2_2.reply.includes("| Bank |") || res2_2.reply.includes("|---");
  const asksBank2 = /which bank|select a bank|choose a bank/i.test(res2_2.reply);
  const mentionsPersonalLoan = /personal loan/i.test(res2_2.reply);
  const continuesBlindly = /which company you currently work for|net monthly take-home salary/i.test(res2_2.reply);

  console.log("\n[Scenario 2 Assertions]:");
  console.log("- Mentions user asked about personal loan:", mentionsPersonalLoan ? "PASS" : "FAIL");
  console.log("- Did NOT ask for a bank:", !asksBank2 ? "PASS" : "FAIL");
  console.log("- Did NOT restart eligibility:", !continuesBlindly ? "PASS" : "FAIL");
  console.log("- Did NOT generate a table:", !isTable2 ? "PASS" : "FAIL");

  if (!mentionsPersonalLoan || asksBank2 || continuesBlindly || isTable2) {
    console.error("SCENARIO 2 FAILED!");
  } else {
    console.log("SCENARIO 2 PASSED!\n");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
