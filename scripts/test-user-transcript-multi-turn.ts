// scripts/test-user-transcript-multi-turn.ts

import assert from "assert";
import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTranscriptTest() {
  console.log("================================================================================");
  console.log("🧪 TESTING FULL 6-TURN USER CONVERSATION TRANSCRIPT");
  console.log("================================================================================\n");

  const conversationId = `transcript_test_${Date.now()}`;
  await clearEligibilityState(conversationId);

  // ---------------------------------------------------------------------------
  // Turn 1: "I want loan but first check mthree"
  // ---------------------------------------------------------------------------
  console.log("--- Turn 1: User says 'I want loan but first check mthree' ---");
  const t1 = await runCentralAgent({
    conversationId,
    message: "I want loan but first check mthree",
  });
  console.log("Assistant Turn 1 Reply:\n", t1.reply, "\n");

  assert.ok(
    !t1.reply.toLowerCase().includes("cibil score first"),
    "Turn 1 must NOT hallucinate CIBIL score advice"
  );
  assert.ok(
    t1.reply.toLowerCase().includes("mthree"),
    "Turn 1 must verify and display information for Mthree"
  );
  assert.ok(
    t1.reply.toLowerCase().includes("salary") || t1.reply.toLowerCase().includes("loan"),
    "Turn 1 must provide proactive follow-up bridge for loan eligibility"
  );
  console.log("✅ Turn 1 PASSED: Compound loan + company check handled without CIBIL hallucination.\n");

  // ---------------------------------------------------------------------------
  // Turn 2: "no, forget loan, show my company information"
  // ---------------------------------------------------------------------------
  console.log("--- Turn 2: User says 'no, forget loan, show my company information' ---");
  const t2 = await runCentralAgent({
    conversationId,
    message: "no, forget loan, show my company information",
    conversationHistory: [
      { role: "user", content: "I want loan but first check mthree" },
      { role: "assistant", content: t1.reply },
    ],
  });
  console.log("Assistant Turn 2 Reply:\n", t2.reply, "\n");

  assert.ok(
    !t2.reply.includes("Please specify an employer or company name"),
    "Turn 2 must NOT ask user to specify company name again"
  );
  assert.ok(
    t2.reply.toLowerCase().includes("mthree"),
    "Turn 2 must resolve Mthree from previous conversation context"
  );
  console.log("✅ Turn 2 PASSED: Anaphoric company reference resolved from context.\n");

  // ---------------------------------------------------------------------------
  // Turn 3: "mthree"
  // ---------------------------------------------------------------------------
  console.log("--- Turn 3: User says 'mthree' ---");
  const t3 = await runCentralAgent({
    conversationId,
    message: "mthree",
    conversationHistory: [
      { role: "user", content: "I want loan but first check mthree" },
      { role: "assistant", content: t1.reply },
      { role: "user", content: "no, forget loan, show my company information" },
      { role: "assistant", content: t2.reply },
    ],
  });
  console.log("Assistant Turn 3 Reply:\n", t3.reply, "\n");
  assert.ok(
    t3.reply.toLowerCase().includes("mthree"),
    "Turn 3 must show Mthree details"
  );
  console.log("✅ Turn 3 PASSED: Company details displayed.\n");

  // ---------------------------------------------------------------------------
  // Turn 4: "go back to loan"
  // ---------------------------------------------------------------------------
  console.log("--- Turn 4: User says 'go back to loan' ---");
  const t4 = await runCentralAgent({
    conversationId,
    message: "go back to loan",
    conversationHistory: [
      { role: "user", content: "I want loan but first check mthree" },
      { role: "assistant", content: t1.reply },
      { role: "user", content: "no, forget loan, show my company information" },
      { role: "assistant", content: t2.reply },
      { role: "user", content: "mthree" },
      { role: "assistant", content: t3.reply },
    ],
  });
  console.log("Assistant Turn 4 Reply:\n", t4.reply, "\n");
  assert.ok(
    t4.reply.toLowerCase().includes("salary") || t4.reply.toLowerCase().includes("take-home"),
    "Turn 4 must ask for take-home salary"
  );

  const stateAfterT4 = await getEligibilityState(conversationId);
  assert.strictEqual(
    stateAfterT4?.expectedField,
    "monthlyIncome",
    "Turn 4 must persist expectedField: 'monthlyIncome' in database"
  );
  assert.strictEqual(
    stateAfterT4?.in_eligibility_flow,
    true,
    "Turn 4 must persist in_eligibility_flow: true in database"
  );
  console.log("✅ Turn 4 PASSED: State properly persisted on loan resumption.\n");

  // ---------------------------------------------------------------------------
  // Turn 5: "39000"
  // ---------------------------------------------------------------------------
  console.log("--- Turn 5: User says '39000' ---");
  const t5 = await runCentralAgent({
    conversationId,
    message: "39000",
    conversationHistory: [
      { role: "user", content: "I want loan but first check mthree" },
      { role: "assistant", content: t1.reply },
      { role: "user", content: "no, forget loan, show my company information" },
      { role: "assistant", content: t2.reply },
      { role: "user", content: "mthree" },
      { role: "assistant", content: t3.reply },
      { role: "user", content: "go back to loan" },
      { role: "assistant", content: t4.reply },
    ],
  });
  console.log("Assistant Turn 5 Reply:\n", t5.reply, "\n");

  const stateAfterT5 = await getEligibilityState(conversationId);
  assert.strictEqual(
    Number(stateAfterT5?.applicant?.monthlyIncome),
    39000,
    "Turn 5 must record salary as 39000"
  );
  assert.notStrictEqual(
    Number(stateAfterT5?.applicant?.loanAmount),
    39000,
    "Turn 5 must NEVER set loanAmount to the salary (39000)"
  );
  assert.strictEqual(
    stateAfterT5?.expectedField,
    "loanAmount",
    "Turn 5 must set next expectedField to 'loanAmount'"
  );
  assert.ok(
    t5.reply.toLowerCase().includes("loan amount") || t5.reply.toLowerCase().includes("borrow"),
    "Turn 5 must ask for desired loan amount (not tenure)"
  );
  console.log("✅ Turn 5 PASSED: Salary recorded, loan amount isolated, and next question is loan amount.\n");

  // ---------------------------------------------------------------------------
  // Turn 6: "I changed my mind, calculate EMI instead"
  // ---------------------------------------------------------------------------
  console.log("--- Turn 6: User says 'I changed my mind, calculate EMI instead' ---");
  const t6 = await runCentralAgent({
    conversationId,
    message: "I changed my mind, calculate EMI instead",
    conversationHistory: [
      { role: "user", content: "I want loan but first check mthree" },
      { role: "assistant", content: t1.reply },
      { role: "user", content: "no, forget loan, show my company information" },
      { role: "assistant", content: t2.reply },
      { role: "user", content: "mthree" },
      { role: "assistant", content: t3.reply },
      { role: "user", content: "go back to loan" },
      { role: "assistant", content: t4.reply },
      { role: "user", content: "39000" },
      { role: "assistant", content: t5.reply },
    ],
  });
  console.log("Assistant Turn 6 Reply:\n", t6.reply, "\n");

  assert.ok(
    !t6.reply.includes("₹838/month"),
    "Turn 6 must NOT calculate an EMI of ₹838 for a ₹39,000 loan!"
  );
  assert.ok(
    t6.reply.toLowerCase().includes("loan amount") || t6.reply.toLowerCase().includes("calculate"),
    "Turn 6 must ask how much loan amount they wish to calculate EMI for"
  );
  console.log("✅ Turn 6 PASSED: Did not assume salary as loan amount; prompted user clearly.\n");

  // Cleanup
  await clearEligibilityState(conversationId);

  console.log("================================================================================");
  console.log("🎉 ALL 6 TURNS IN USER TRANSCRIPT VERIFIED AND PASSED PERFECTLY!");
  console.log("================================================================================");
}

runTranscriptTest().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
