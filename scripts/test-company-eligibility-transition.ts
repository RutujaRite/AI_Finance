import { runCentralAgent } from "../lib/ai/agent";
import { getConversationContext } from "../lib/ai/contextBuilder";
import pool from "../lib/db";

async function runTest() {
  console.log("================================================================================");
  console.log("TEST SUITE: COMPANY INFORMATION DISPLAY -> NEXT ELIGIBILITY DATA COLLECTION");
  console.log("================================================================================\n");

  const convId = "test-comp-elig-" + Date.now();

  // Test 1: User sends "Meta Platforms LLP"
  console.log("--- TURN 1: User sends 'Meta Platforms LLP' ---");
  const turn1 = await runCentralAgent({
    message: "Meta Platforms LLP",
    conversationId: convId,
    conversationHistory: [],
  });

  console.log("Turn 1 Reply:\n", turn1.reply);
  console.log("\nChecking Turn 1 asserts...");

  const hasOverview = /Meta\s+Platforms\s+LLP/i.test(turn1.reply);
  const hasBankTable = /Piramal/i.test(turn1.reply) && /CAT\s*A/i.test(turn1.reply);
  const asksSalary = /Now let's continue with your eligibility assessment/i.test(turn1.reply) &&
    /monthly\s+take-home\s+salary/i.test(turn1.reply);

  console.log("Has Overview:", hasOverview ? "PASS" : "FAIL");
  console.log("Has Bank Table:", hasBankTable ? "PASS" : "FAIL");
  console.log("Asks Next User Data (Salary):", asksSalary ? "PASS" : "FAIL");

  if (!hasOverview || !hasBankTable || !asksSalary) {
    console.error("TURN 1 FAILED!");
    process.exit(1);
  }

  // Check state in DB / context
  const ctx1 = await getConversationContext(convId, { userMessage: "Meta Platforms LLP" });
  console.log("Session in_eligibility_flow:", ctx1.state.in_eligibility_flow);
  console.log("Session expectedField:", ctx1.state.expectedField);
  console.log("Session companyName:", ctx1.state.applicant?.companyName);

  if (ctx1.state.expectedField !== "monthlyIncome" || !ctx1.state.in_eligibility_flow) {
    console.error("SESSION STATE NOT SET TO EXPECT SALARY!");
    process.exit(1);
  }

  // Turn 2: User provides salary in response to the prompt
  console.log("\n--- TURN 2: User replies with salary '75,000' ---");
  const turn2 = await runCentralAgent({
    message: "75000",
    conversationId: convId,
    conversationHistory: [
      { role: "user", content: "Meta Platforms LLP" },
      { role: "assistant", content: turn1.reply },
    ],
  });

  console.log("Turn 2 Reply:\n", turn2.reply);
  const ctx2 = await getConversationContext(convId, { userMessage: "75000" });
  console.log("Recorded Monthly Income:", ctx2.state.applicant?.monthlyIncome);
  console.log("Next Expected Field:", ctx2.state.expectedField);

  if (ctx2.state.applicant?.monthlyIncome !== 75000) {
    console.error("SALARY NOT RECORDED PROPERLY!");
    process.exit(1);
  }

  // Test 3: Standalone "What is the company category rating for Infosys BPM Limited?"
  console.log("\n--- TEST 3: User asks category rating for Infosys BPM Limited ---");
  const convId2 = "test-comp-elig-2-" + Date.now();
  const turn3 = await runCentralAgent({
    message: "What is the company category rating for Infosys BPM Limited?",
    conversationId: convId2,
    conversationHistory: [],
  });

  console.log("Turn 3 Reply:\n", turn3.reply);
  const t3HasCompany = /Infosys\s+BPM/i.test(turn3.reply);
  const t3AsksNext = /Now let's continue with your eligibility assessment/i.test(turn3.reply) &&
    /monthly\s+take-home\s+salary/i.test(turn3.reply);

  console.log("Infosys BPM resolved:", t3HasCompany ? "PASS" : "FAIL");
  console.log("Prompts next user data (Salary):", t3AsksNext ? "PASS" : "FAIL");

  if (!t3HasCompany || !t3AsksNext) {
    console.error("TEST 3 FAILED!");
    process.exit(1);
  }

  console.log("\n================================================================================");
  console.log("ALL ELIGIBILITY TRANSITION TESTS PASSED SUCCESSFULLY!");
  console.log("================================================================================");

  if (pool) await pool.end();
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
