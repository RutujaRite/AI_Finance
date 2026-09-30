import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, inMemorySessionStates } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function main() {
  console.log("==================================================================");
  console.log("  TEST: Natural-Language Question Answering & Loan Journey");
  console.log("==================================================================\n");

  const testConvId = 998877;
  const history: Array<{ role: string; content: string }> = [];

  // Reset test conversation from DB and memory
  inMemorySessionStates.delete(String(testConvId));
  if (pool) {
    try {
      await pool.query("DELETE FROM assistant_conversation_states WHERE conversation_id = $1", [testConvId]);
    } catch {}
  }

  let passed = 0;
  let failed = 0;
  function assert(cond: boolean, msg: string, detail?: string) {
    if (cond) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      if (detail) console.error(`   Details: ${detail}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TURN 1: User: "What is Infosys?"
  // -------------------------------------------------------------------------
  console.log("--- Turn 1: User: 'What is Infosys?' ---");
  const turn1User = "What is Infosys?";
  history.push({ role: "user", content: turn1User });

  const res1 = await runCentralAgent({
    message: turn1User,
    conversationId: String(testConvId),
    conversationHistory: history.slice(0, -1),
  });

  history.push({ role: "assistant", content: res1.reply });
  console.log(`AI Reply 1:\n${res1.reply}\n`);

  assert(
    res1.reply.includes("Infosys") &&
    (res1.reply.includes("IT Services") || res1.reply.includes("corporate") || res1.reply.includes("consulting") || res1.reply.includes("Overview")),
    "Turn 1 answers the Infosys company question correctly",
    res1.reply.substring(0, 150)
  );

  assert(
    res1.reply.includes("If you'd like, we can continue with your loan eligibility check.") ||
    res1.reply.toLowerCase().includes("loan eligibility check"),
    "Turn 1 adds helpful suggestion to continue loan eligibility check"
  );

  // -------------------------------------------------------------------------
  // TURN 2: User: "I work at Infosys Limited"
  // -------------------------------------------------------------------------
  console.log("\n--- Turn 2: User: 'I work at Infosys Limited' ---");
  const turn2User = "I work at Infosys Limited";
  history.push({ role: "user", content: turn2User });

  const res2 = await runCentralAgent({
    message: turn2User,
    conversationId: String(testConvId),
    conversationHistory: history.slice(0, -1),
  });

  history.push({ role: "assistant", content: res2.reply });
  console.log(`AI Reply 2:\n${res2.reply}\n`);

  const state2 = await getEligibilityState(String(testConvId));
  assert(
    state2?.applicant?.companyName === "Infosys Limited",
    "Turn 2 stores 'Infosys Limited' as selected canonical company"
  );
  assert(
    res2.reply.toLowerCase().includes("salary") || res2.reply.toLowerCase().includes("income"),
    "Turn 2 asks for monthly take-home salary as next step"
  );

  // -------------------------------------------------------------------------
  // TURN 3: User: "What is CIBIL score?"
  // -------------------------------------------------------------------------
  console.log("\n--- Turn 3: User: 'What is CIBIL score?' ---");
  const turn3User = "What is CIBIL score?";
  history.push({ role: "user", content: turn3User });

  const res3 = await runCentralAgent({
    message: turn3User,
    conversationId: String(testConvId),
    conversationHistory: history.slice(0, -1),
  });

  history.push({ role: "assistant", content: res3.reply });
  console.log(`AI Reply 3:\n${res3.reply}\n`);

  assert(
    res3.reply.toLowerCase().includes("cibil") && (res3.reply.includes("300") || res3.reply.includes("score") || res3.reply.includes("credit")),
    "Turn 3 answers the CIBIL score question naturally and correctly"
  );
  assert(
    res3.reply.includes("For your eligibility check, you can provide your CIBIL score when you're ready.") ||
    res3.reply.toLowerCase().includes("cibil score when you're ready"),
    "Turn 3 adds helpful bridge: 'For your eligibility check, you can provide your CIBIL score when you're ready.'"
  );

  const state3 = await getEligibilityState(String(testConvId));
  assert(
    state3?.applicant?.companyName === "Infosys Limited",
    "Turn 3 preserves canonical company 'Infosys Limited'"
  );
  assert(
    state3?.expectedField === "monthlyIncome",
    "Turn 3 preserves next missing parameter as monthlyIncome"
  );

  // -------------------------------------------------------------------------
  // TURN 4: User: "What is EMI?"
  // -------------------------------------------------------------------------
  console.log("\n--- Turn 4: User: 'What is EMI?' ---");
  const turn4User = "What is EMI?";
  history.push({ role: "user", content: turn4User });

  const res4 = await runCentralAgent({
    message: turn4User,
    conversationId: String(testConvId),
    conversationHistory: history.slice(0, -1),
  });

  history.push({ role: "assistant", content: res4.reply });
  console.log(`AI Reply 4:\n${res4.reply}\n`);

  assert(
    res4.reply.toLowerCase().includes("equated monthly installment") ||
    res4.reply.toLowerCase().includes("fixed monthly payment") ||
    res4.reply.toLowerCase().includes("principal"),
    "Turn 4 answers the EMI question naturally and correctly"
  );
  assert(
    res4.reply.includes("If you want, we can continue with your loan eligibility calculation.") ||
    res4.reply.toLowerCase().includes("loan eligibility calculation"),
    "Turn 4 adds helpful bridge: 'If you want, we can continue with your loan eligibility calculation.'"
  );

  const state4 = await getEligibilityState(String(testConvId));
  assert(
    state4?.applicant?.companyName === "Infosys Limited",
    "Turn 4 preserves canonical company 'Infosys Limited'"
  );

  // -------------------------------------------------------------------------
  // TURN 5: User: "75000" (Provides salary)
  // -------------------------------------------------------------------------
  console.log("\n--- Turn 5: User: '75000' ---");
  const turn5User = "75000";
  history.push({ role: "user", content: turn5User });

  const res5 = await runCentralAgent({
    message: turn5User,
    conversationId: String(testConvId),
    conversationHistory: history.slice(0, -1),
  });

  history.push({ role: "assistant", content: res5.reply });
  console.log(`AI Reply 5:\n${res5.reply}\n`);

  const state5 = await getEligibilityState(String(testConvId));
  assert(
    state5?.applicant?.companyName === "Infosys Limited" && state5?.applicant?.monthlyIncome === 75000,
    "Turn 5 records monthlyIncome=75000 and retains 'Infosys Limited'"
  );
  assert(
    res5.reply.toLowerCase().includes("loan amount") || res5.reply.toLowerCase().includes("borrow"),
    "Turn 5 prompts for next missing field: loan amount"
  );

  // -------------------------------------------------------------------------
  // TURNS 6 to 10: Complete the eligibility journey to calculation
  // -------------------------------------------------------------------------
  console.log("\n--- Completing Remaining Loan Journey Parameters ---");
  // Turn 6: Loan Amount 5 Lakhs
  history.push({ role: "user", content: "500000" });
  const res6 = await runCentralAgent({ message: "500000", conversationId: String(testConvId), conversationHistory: history.slice(0, -1) });
  history.push({ role: "assistant", content: res6.reply });

  // Turn 7: Tenure 3 years
  history.push({ role: "user", content: "3 years" });
  const res7 = await runCentralAgent({ message: "3 years", conversationId: String(testConvId), conversationHistory: history.slice(0, -1) });
  history.push({ role: "assistant", content: res7.reply });

  // Turn 8: CIBIL 750
  history.push({ role: "user", content: "750" });
  const res8 = await runCentralAgent({ message: "750", conversationId: String(testConvId), conversationHistory: history.slice(0, -1) });
  history.push({ role: "assistant", content: res8.reply });

  // Turn 9: Age 28
  history.push({ role: "user", content: "28" });
  const res9 = await runCentralAgent({ message: "28", conversationId: String(testConvId), conversationHistory: history.slice(0, -1) });
  history.push({ role: "assistant", content: res9.reply });

  // Turn 10: Existing EMI 0 -> Triggers deterministic eligibility calculation
  console.log("\n--- Final Parameter: Existing EMI 0 -> Deterministic Calculation ---");
  history.push({ role: "user", content: "0" });
  const res10 = await runCentralAgent({ message: "0", conversationId: String(testConvId), conversationHistory: history.slice(0, -1) });
  history.push({ role: "assistant", content: res10.reply });
  console.log(`AI Final Evaluation Reply:\n${res10.reply.substring(0, 300)}...\n`);

  assert(
    res10.reply.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |") ||
    res10.reply.includes("Eligibility Assessment") ||
    res10.reply.includes("Eligible Banks"),
    "When enough eligibility information is collected, continues to deterministic eligibility calculation"
  );

  const finalState = await getEligibilityState(String(testConvId));
  assert(
    finalState?.applicant?.companyName === "Infosys Limited" &&
    finalState?.applicant?.monthlyIncome === 75000 &&
    finalState?.applicant?.loanAmount === 500000,
    "Final state preserves canonical company and all collected parameters"
  );

  // Cleanup
  if (pool) {
    try {
      await pool.query("DELETE FROM assistant_conversation_states WHERE conversation_id = $1", [testConvId]);
    } catch {}
  }
  inMemorySessionStates.delete(String(testConvId));

  console.log(`\n==================================================================`);
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in test:", err);
  process.exit(1);
});
