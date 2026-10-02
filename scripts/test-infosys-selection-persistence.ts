import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, inMemorySessionStates } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function main() {
  console.log("==================================================================");
  console.log("  TEST: Selected Company Persistence in CreditWise Loan Flow");
  console.log("  Flow: 'i working at infosys' -> 'Infosys Limited' -> 'i want loan' -> '75000'");
  console.log("==================================================================\n");

  const testConvId = 888777;
  const history: Array<{ role: string; content: string }> = [];

  // Clean test conversation from DB and memory
  inMemorySessionStates.delete(String(testConvId));
  if (pool) {
    try {
      await pool.query("DELETE FROM assistant_conversation_states WHERE conversation_id = $1", [testConvId]);
    } catch {}
  }

  let passed = 0;
  let failed = 0;
  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // TURN 1: User says: "i working at infosys"
  console.log("--- Turn 1: User: 'i working at infosys' ---");
  const turn1User = "i working at infosys";
  history.push({ role: "user", content: turn1User });

  const res1 = await runCentralAgent({
    message: turn1User,
    conversationId: String(testConvId),
    conversationHistory: history.slice(0, -1),
  });

  history.push({ role: "assistant", content: res1.reply });
  console.log(`Assistant Reply 1:\n${res1.reply}\n`);

  assert(
    res1.companyData?.company_flow === "COMPANY_SELECTION" ||
    (res1.companyData?.candidates && res1.companyData.candidates.length > 0) ||
    res1.reply.includes("Infosys Limited") ||
    res1.reply.includes("matching"),
    "Turn 1 returns company selection / candidate options"
  );

  const state1 = await getEligibilityState(String(testConvId));
  assert(
    state1?.companyFlow?.stage === "COMPANY_SELECTION" ||
    Boolean(state1?.companyFlow?.candidates && state1.companyFlow.candidates.length > 0),
    "Turn 1 state has companyFlow with candidates in COMPANY_SELECTION stage"
  );

  // TURN 2: User selects "Infosys Limited"
  console.log("\n--- Turn 2: User selects 'Infosys Limited' ---");
  const turn2User = "Infosys Limited";
  history.push({ role: "user", content: turn2User });

  const res2 = await runCentralAgent({
    message: turn2User,
    conversationId: String(testConvId),
    conversationHistory: history.slice(0, -1),
    companySelectionAction: { type: "select", companyName: "Infosys Limited" },
  });

  history.push({ role: "assistant", content: res2.reply });
  console.log(`Assistant Reply 2:\n${res2.reply.substring(0, 300)}...\n`);

  const state2 = await getEligibilityState(String(testConvId));
  console.log("State 2 Summary:", {
    selectedCompanyName: state2?.selectedCompanyName,
    selectedCompanyCin: state2?.selectedCompanyCin,
    applicantCompanyName: state2?.applicant?.companyName,
    companyFlowStage: state2?.companyFlow?.stage,
    companyFlowSelected: state2?.companyFlow?.selectedCompanyName,
  });

  assert(
    state2?.selectedCompanyName === "Infosys Limited",
    `Turn 2 state.selectedCompanyName is strictly 'Infosys Limited' (got: '${state2?.selectedCompanyName}')`
  );
  assert(
    state2?.applicant?.companyName === "Infosys Limited",
    `Turn 2 state.applicant.companyName is strictly 'Infosys Limited' (got: '${state2?.applicant?.companyName}')`
  );
  assert(
    !res2.reply.toLowerCase().includes("which company or employer would you like to search"),
    "Turn 2 did NOT get intercepted as an unhandled company search"
  );

  // TURN 3: User says: "i want loan"
  console.log("\n--- Turn 3: User: 'i want loan' ---");
  const turn3User = "i want loan";
  history.push({ role: "user", content: turn3User });

  const res3 = await runCentralAgent({
    message: turn3User,
    conversationId: String(testConvId),
    conversationHistory: history.slice(0, -1),
  });

  history.push({ role: "assistant", content: res3.reply });
  console.log(`Assistant Reply 3:\n${res3.reply}\n`);

  const state3 = await getEligibilityState(String(testConvId));
  console.log("State 3 Summary:", {
    selectedCompanyName: state3?.selectedCompanyName,
    applicantCompanyName: state3?.applicant?.companyName,
    expectedField: state3?.expectedField,
    in_eligibility_flow: state3?.in_eligibility_flow,
  });

  assert(
    state3?.applicant?.companyName === "Infosys Limited",
    `Turn 3 state.applicant.companyName remains 'Infosys Limited' (got: '${state3?.applicant?.companyName}')`
  );
  assert(
    state3?.selectedCompanyName === "Infosys Limited",
    `Turn 3 state.selectedCompanyName remains 'Infosys Limited' (got: '${state3?.selectedCompanyName}')`
  );
  assert(
    res3.reply.includes("Infosys Limited"),
    "Turn 3 reply explicitly cites 'Infosys Limited'"
  );
  assert(
    !res3.reply.toLowerCase().includes("tell me which company you currently work for"),
    "Turn 3 does NOT ask for company name again"
  );
  assert(
    state3?.expectedField === "monthlyIncome" || res3.reply.toLowerCase().includes("salary") || res3.reply.toLowerCase().includes("income"),
    "Turn 3 asks for monthly salary / income"
  );

  // TURN 4: User says: "75000"
  console.log("\n--- Turn 4: User: '75000' ---");
  const turn4User = "75000";
  history.push({ role: "user", content: turn4User });

  const res4 = await runCentralAgent({
    message: turn4User,
    conversationId: String(testConvId),
    conversationHistory: history.slice(0, -1),
  });

  history.push({ role: "assistant", content: res4.reply });
  console.log(`Assistant Reply 4:\n${res4.reply}\n`);

  const state4 = await getEligibilityState(String(testConvId));
  console.log("State 4 Summary:", {
    selectedCompanyName: state4?.selectedCompanyName,
    applicantCompanyName: state4?.applicant?.companyName,
    monthlyIncome: state4?.applicant?.monthlyIncome,
    expectedField: state4?.expectedField,
  });

  assert(
    state4?.applicant?.companyName === "Infosys Limited",
    `Turn 4 state.applicant.companyName remains 'Infosys Limited' (got: '${state4?.applicant?.companyName}')`
  );
  assert(
    state4?.applicant?.monthlyIncome === 75000,
    `Turn 4 state.applicant.monthlyIncome is 75000 (got: ${state4?.applicant?.monthlyIncome})`
  );
  assert(
    res4.reply.includes("Infosys Limited"),
    "Turn 4 reply retains 'Infosys Limited'"
  );
  assert(
    !res4.reply.toLowerCase().includes("matching companies") && !res4.reply.toLowerCase().includes("tell me which company"),
    "Turn 4 did NOT trigger a company search or re-ask for company"
  );

  // POSTGRESQL RESTORATION TEST
  console.log("\n--- Turn 5: PostgreSQL Database Restoration Test ---");
  // Clear in-memory session cache so getEligibilityState must query PostgreSQL
  inMemorySessionStates.delete(String(testConvId));

  if (pool) {
    const dbRow = await pool.query(
      "SELECT state FROM assistant_conversation_states WHERE conversation_id = $1",
      [testConvId]
    );
    assert(dbRow.rowCount === 1, "State exists in PostgreSQL assistant_conversation_states table");
    const restoredDbState = await getEligibilityState(String(testConvId));
    console.log("Restored from DB:", {
      selectedCompanyName: restoredDbState?.selectedCompanyName,
      applicantCompanyName: restoredDbState?.applicant?.companyName,
      monthlyIncome: restoredDbState?.applicant?.monthlyIncome,
    });

    assert(
      restoredDbState?.selectedCompanyName === "Infosys Limited",
      `PostgreSQL restored state has selectedCompanyName === 'Infosys Limited'`
    );
    assert(
      restoredDbState?.applicant?.companyName === "Infosys Limited",
      `PostgreSQL restored state has applicant.companyName === 'Infosys Limited'`
    );
  }

  // CLEANUP
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

main().catch((e) => {
  console.error("FATAL ERROR in test:", e);
  process.exit(1);
});
