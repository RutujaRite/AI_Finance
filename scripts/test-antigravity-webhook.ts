import { processAntigravityWebhook } from "../lib/ai/antigravityWebhook";
import pool from "../lib/db";

async function runWebhookTests() {
  console.log("================================================================================");
  console.log("TESTING ANTIGRAVITY CUSTOM ACTION / WEBHOOK (SLOT-FILLING STATE MACHINE)");
  console.log("================================================================================\n");

  let session: any = {};

  // TURN 1: Initial user intent without details
  console.log("--- TURN 1: Initial prompt 'I want a personal loan' ---");
  const res1 = await processAntigravityWebhook({
    sessionVariables: session,
    userMessage: "I want a personal loan",
  });
  console.log("isComplete:", res1.isComplete);
  console.log("nextSlotRequired:", res1.nextSlotRequired);
  console.log("prompt:", res1.prompt);
  console.log("sessionVariables:", res1.sessionVariables);

  if (res1.isComplete || res1.nextSlotRequired !== "employer") {
    throw new Error(`Turn 1 failed! Expected nextSlotRequired='employer', got ${res1.nextSlotRequired}`);
  }
  session = res1.sessionVariables;
  console.log("✅ Turn 1 passed: Identified missing 'employer'\n");

  // TURN 2: User provides employer name
  console.log("--- TURN 2: User answers employer 'Infosys' ---");
  const res2 = await processAntigravityWebhook({
    sessionVariables: session,
    userMessage: "I work at Infosys Limited",
    extractedEntities: { employer: "Infosys Limited" },
  });
  console.log("isComplete:", res2.isComplete);
  console.log("nextSlotRequired:", res2.nextSlotRequired);
  console.log("prompt:", res2.prompt);
  console.log("sessionVariables:", res2.sessionVariables);

  if (res2.isComplete || res2.nextSlotRequired !== "requestedAmount" || !res2.sessionVariables.employer) {
    throw new Error(`Turn 2 failed! Expected nextSlotRequired='requestedAmount', got ${res2.nextSlotRequired}`);
  }
  session = res2.sessionVariables;
  console.log("✅ Turn 2 passed: Merged employer, asked 'requestedAmount'\n");

  // TURN 3: User provides loan amount
  console.log("--- TURN 3: User answers loan amount '5 lakhs' ---");
  const res3 = await processAntigravityWebhook({
    sessionVariables: session,
    userMessage: "I need around 5 lakhs",
    extractedEntities: { requestedAmount: "5 lakhs" },
  });
  console.log("isComplete:", res3.isComplete);
  console.log("nextSlotRequired:", res3.nextSlotRequired);
  console.log("prompt:", res3.prompt);
  console.log("sessionVariables:", res3.sessionVariables);

  if (res3.isComplete || res3.nextSlotRequired !== "tenureMonths" || res3.sessionVariables.requestedAmount !== 500000) {
    throw new Error(`Turn 3 failed! Expected requestedAmount=500000, next='tenureMonths'`);
  }
  session = res3.sessionVariables;
  console.log("✅ Turn 3 passed: Normalized amount to 500000, asked 'tenureMonths'\n");

  // TURN 4: User provides tenure
  console.log("--- TURN 4: User answers tenure '5 years' ---");
  const res4 = await processAntigravityWebhook({
    sessionVariables: session,
    userMessage: "For 5 years",
    extractedEntities: { tenureMonths: "5 years" },
  });
  console.log("isComplete:", res4.isComplete);
  console.log("nextSlotRequired:", res4.nextSlotRequired);
  console.log("prompt:", res4.prompt);
  console.log("sessionVariables:", res4.sessionVariables);

  if (res4.isComplete || res4.nextSlotRequired !== "cibilScore" || res4.sessionVariables.tenureMonths !== 60) {
    throw new Error(`Turn 4 failed! Expected tenureMonths=60, next='cibilScore'`);
  }
  session = res4.sessionVariables;
  console.log("✅ Turn 4 passed: Normalized tenure to 60 months, asked 'cibilScore'\n");

  // TURN 5: User answers CIBIL with 'not sure'
  console.log("--- TURN 5: User answers CIBIL 'not sure' ---");
  const res5 = await processAntigravityWebhook({
    sessionVariables: session,
    userMessage: "I am not sure about my score",
    extractedEntities: { cibilScore: "not sure" },
  });
  console.log("isComplete:", res5.isComplete);
  console.log("nextSlotRequired:", res5.nextSlotRequired);
  console.log("prompt:", res5.prompt);
  console.log("sessionVariables:", res5.sessionVariables);

  if (res5.isComplete || res5.nextSlotRequired !== "age" || res5.sessionVariables.cibilScore !== "NOT_SURE") {
    throw new Error(`Turn 5 failed! Expected cibilScore='NOT_SURE', next='age'`);
  }
  session = res5.sessionVariables;
  console.log("✅ Turn 5 passed: Normalized CIBIL to 'NOT_SURE', asked 'age'\n");

  // TURN 6: User provides age -> triggers evaluation!
  console.log("--- TURN 6: User answers age '28 years' ---");
  const res6 = await processAntigravityWebhook({
    sessionVariables: session,
    userMessage: "I am 28 years old",
    extractedEntities: { age: 28 },
  });
  console.log("isComplete:", res6.isComplete);
  console.log("eligibleCount:", res6.eligibleCount);
  console.log("totalEvaluated:", res6.totalEvaluated);
  console.log("summary:", res6.summary);
  console.log("\nMarkdown Table Preview:\n" + res6.markdownTable);

  if (!res6.isComplete || (res6.totalEvaluated || 0) < 20 || !res6.markdownTable?.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |")) {
    throw new Error("Turn 6 failed! Expected complete evaluation across 23 banks with table.");
  }
  console.log("✅ Turn 6 passed: Evaluation completed across 23 bank policies!\n");

  // TEST LAW 2: Merge & Do Not Forget (Partial update never erases prior slots)
  console.log("--- TEST LAW 2: Non-Overwrite Safety ---");
  const preserveTest = await processAntigravityWebhook({
    sessionVariables: {
      employer: "TCS",
      requestedAmount: 700000,
      tenureMonths: 48,
    },
    extractedEntities: {
      age: 32, // only age passed
    },
  });
  console.log("Preserved Slots:", preserveTest.sessionVariables);
  if (
    preserveTest.sessionVariables.employer !== "TCS" ||
    preserveTest.sessionVariables.requestedAmount !== 700000 ||
    preserveTest.sessionVariables.tenureMonths !== 48 ||
    preserveTest.sessionVariables.age !== 32
  ) {
    throw new Error("LAW 2 Failed! Prior slot values were lost during partial merge.");
  }
  console.log("✅ LAW 2 Passed: All prior slots preserved during partial merge.\n");

  // TEST Multi-slot extraction in a single turn
  console.log("--- TEST Multi-Slot Single Turn ---");
  const multiRes = await processAntigravityWebhook({
    sessionVariables: {},
    userMessage: "I work at Wipro and need 10 lakh loan for 3 years",
  });
  console.log("Multi-slot extracted:", multiRes.sessionVariables);
  console.log("Next required:", multiRes.nextSlotRequired);
  if (
    multiRes.sessionVariables.employer !== "Wipro" ||
    multiRes.sessionVariables.requestedAmount !== 1000000 ||
    multiRes.sessionVariables.tenureMonths !== 36 ||
    multiRes.nextSlotRequired !== "cibilScore"
  ) {
    throw new Error("Multi-slot single turn extraction failed!");
  }
  console.log("✅ Multi-slot extraction passed: Captured employer, amount, tenure in 1 turn, asked 'cibilScore' next.\n");

  console.log("================================================================================");
  console.log("ALL WEBHOOK UNIT TESTS PASSED SUCCESSFULLY! 🚀");
  console.log("================================================================================");

  await pool.end();
}

runWebhookTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
