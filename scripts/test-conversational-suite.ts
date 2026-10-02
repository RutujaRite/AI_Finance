// scripts/test-conversational-suite.ts

import assert from "assert";
import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runConversationalSuite() {
  console.log("================================================================================");
  console.log("🧪 TESTING ADVANCED CONVERSATIONAL SUITE (TYPOS, FOIR, DISAMBIGUATION, RESUMPTION)");
  console.log("================================================================================\n");

  const conversationId = `suite_test_${Date.now()}`;
  await clearEligibilityState(conversationId);

  // ---------------------------------------------------------------------------
  // Scenario 1: Start loan -> Assistant asks for salary
  // ---------------------------------------------------------------------------
  console.log("--- 1. User starts loan flow: 'I need a personal loan' ---");
  const t1 = await runCentralAgent({
    conversationId,
    message: "I need a personal loan",
  });
  console.log("Assistant Reply:\n", t1.reply, "\n");
  assert.ok(
    t1.reply.toLowerCase().includes("company") || t1.reply.toLowerCase().includes("employer") || t1.reply.toLowerCase().includes("salary"),
    "Must start loan eligibility questions"
  );
  console.log("✅ Scenario 1 PASSED: Loan eligibility initiated.\n");

  // ---------------------------------------------------------------------------
  // Scenario 2: Typo interruption 'i want to check my compny information'
  // ---------------------------------------------------------------------------
  console.log("--- 2. User interrupts with typo: 'i want to check my compny information' ---");
  const t2 = await runCentralAgent({
    conversationId,
    message: "i want to check my compny information",
    conversationHistory: [
      { role: "user", content: "I need a personal loan" },
      { role: "assistant", content: t1.reply },
    ],
  });
  console.log("Assistant Reply:\n", t2.reply, "\n");
  assert.ok(
    !t2.reply.includes("Just need a quick number for your monthly salary"),
    "Must NOT badger for salary when user asks for company info"
  );
  assert.ok(
    t2.reply.toLowerCase().includes("company") || t2.reply.toLowerCase().includes("employer"),
    "Must prompt for company name"
  );
  console.log("✅ Scenario 2 PASSED: Typo 'compny' recognized without salary badgering.\n");

  // ---------------------------------------------------------------------------
  // Scenario 3: User answers company 'TCS'
  // ---------------------------------------------------------------------------
  console.log("--- 3. User specifies company: 'TCS' ---");
  const t3 = await runCentralAgent({
    conversationId,
    message: "TCS",
    conversationHistory: [
      { role: "user", content: "I need a personal loan" },
      { role: "assistant", content: t1.reply },
      { role: "user", content: "i want to check my compny information" },
      { role: "assistant", content: t2.reply },
    ],
  });
  console.log("Assistant Reply:\n", t3.reply, "\n");
  assert.ok(
    t3.reply.toLowerCase().includes("tata consultancy") || t3.reply.toLowerCase().includes("tcs"),
    "Must display company intelligence for TCS"
  );
  console.log("✅ Scenario 3 PASSED: Company intelligence displayed.\n");

  // ---------------------------------------------------------------------------
  // Scenario 4: User asks side question 'What is FOIR?'
  // ---------------------------------------------------------------------------
  console.log("--- 4. User asks conceptual question: 'What is FOIR?' ---");
  const t4 = await runCentralAgent({
    conversationId,
    message: "What is FOIR?",
    conversationHistory: [
      { role: "user", content: "I need a personal loan" },
      { role: "assistant", content: t1.reply },
      { role: "user", content: "i want to check my compny information" },
      { role: "assistant", content: t2.reply },
      { role: "user", content: "TCS" },
      { role: "assistant", content: t3.reply },
    ],
  });
  console.log("Assistant Reply:\n", t4.reply, "\n");
  assert.ok(
    t4.reply.toLowerCase().includes("fixed obligation to income ratio") || t4.reply.toLowerCase().includes("foir"),
    "Must explain FOIR accurately"
  );
  assert.ok(
    !t4.reply.includes("Whenever you're ready, can we proceed with your loan eligibility calculation?"),
    "Must NOT use passive 'Whenever you're ready' fallback"
  );
  assert.ok(
    t4.reply.toLowerCase().includes("salary") || t4.reply.toLowerCase().includes("take-home"),
    "Must proactively ask for salary to continue assessment"
  );
  console.log("✅ Scenario 4 PASSED: FOIR answered with proactive resumption.\n");

  // ---------------------------------------------------------------------------
  // Scenario 5: User answers salary '50000'
  // ---------------------------------------------------------------------------
  console.log("--- 5. User answers salary: '50000' ---");
  const t5 = await runCentralAgent({
    conversationId,
    message: "50000",
    conversationHistory: [
      { role: "user", content: "What is FOIR?" },
      { role: "assistant", content: t4.reply },
    ],
  });
  console.log("Assistant Reply:\n", t5.reply, "\n");
  const stateT5 = await getEligibilityState(conversationId);
  assert.strictEqual(
    Number(stateT5?.applicant?.monthlyIncome),
    50000,
    "Salary must be 50000"
  );
  assert.strictEqual(
    stateT5?.expectedField,
    "loanAmount",
    "Next field must be loanAmount"
  );
  console.log("✅ Scenario 5 PASSED: Salary recorded, transitioned to loan amount.\n");

  // ---------------------------------------------------------------------------
  // Scenario 6: Ambiguous number '76'
  // ---------------------------------------------------------------------------
  console.log("--- 6. User sends unanchored ambiguous number: '76' when expected field is loanAmount ---");
  const t6 = await runCentralAgent({
    conversationId,
    message: "76",
    conversationHistory: [
      { role: "user", content: "50000" },
      { role: "assistant", content: t5.reply },
    ],
  });
  console.log("Assistant Reply:\n", t6.reply, "\n");
  assert.ok(
    t6.reply.toLowerCase().includes("could you please clarify") || t6.reply.toLowerCase().includes("specify"),
    "Must ask clarification for ambiguous number '76'"
  );
  const stateT6 = await getEligibilityState(conversationId);
  assert.notStrictEqual(
    Number(stateT6?.applicant?.loanAmount),
    76,
    "Must NEVER set loanAmount to 76"
  );
  console.log("✅ Scenario 6 PASSED: Ambiguous number '76' properly flagged for clarification without guessing.\n");

  // ---------------------------------------------------------------------------
  // Scenario 7: User clarifies loan amount '5 lakhs'
  // ---------------------------------------------------------------------------
  console.log("--- 7. User clarifies loan amount: '5 lakhs' ---");
  const t7 = await runCentralAgent({
    conversationId,
    message: "5 lakhs",
    conversationHistory: [
      { role: "user", content: "76" },
      { role: "assistant", content: t6.reply },
    ],
  });
  console.log("Assistant Reply:\n", t7.reply, "\n");
  const stateT7 = await getEligibilityState(conversationId);
  assert.strictEqual(
    Number(stateT7?.applicant?.loanAmount),
    500000,
    "Loan amount must be 500000"
  );
  assert.strictEqual(
    stateT7?.expectedField,
    "tenureMonths",
    "Next field must be tenureMonths"
  );
  console.log("✅ Scenario 7 PASSED: Desired loan amount ₹5 Lakhs captured accurately.\n");

  // Cleanup
  await clearEligibilityState(conversationId);

  console.log("================================================================================");
  console.log("🎉 ALL ADVANCED CONVERSATIONAL SUITE SCENARIOS PASSED PERFECTLY!");
  console.log("================================================================================");
}

runConversationalSuite().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
