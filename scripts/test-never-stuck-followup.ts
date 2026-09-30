import { runCentralAgent } from "../lib/ai/agent";
import { saveEligibilityState, inMemorySessionStates, getEligibilityState } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function runTests() {
  console.log("==================================================================");
  console.log("  TEST SUITE: Never Stuck On Single Question & Take Follow-up");
  console.log("  1. Skip on loan amount advances with benchmark default");
  console.log("  2. 'Not sure' on CIBIL advances with 'Not provided'");
  console.log("  3. Side question during flow is answered and followed up");
  console.log("  4. Circuit breaker: 2 unparseable answers advance automatically");
  console.log("  5. 'Which bank is best' post-eligibility auto-recommends & advances");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;
  function testAssert(cond: boolean, msg: string, detail?: any) {
    if (cond) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`, detail !== undefined ? detail : "");
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: User says "skip" on loanAmount -> Advances to tenureMonths
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 1: User says 'skip' on loanAmount ---");
  const convId1 = `test_skip_${Date.now()}`;
  inMemorySessionStates.delete(convId1);

  await saveEligibilityState(convId1, {
    applicant: {
      companyName: "Tata Consultancy Services",
      monthlyIncome: 60000,
    },
    in_eligibility_flow: true,
    expectedField: "loanAmount",
    missingFields: ["loanAmount", "tenureMonths", "cibil", "age", "existingEmi"],
    updatedAt: Date.now(),
  } as any);

  const res1 = await runCentralAgent({
    conversationId: convId1,
    message: "skip",
    conversationHistory: [],
  });

  const state1 = await getEligibilityState(convId1);
  console.log("Turn 1 reply:\n", res1.reply.substring(0, 180), "...");
  console.log("State 1 expectedField:", state1?.expectedField, "loanAmount:", state1?.applicant?.loanAmount);

  testAssert(
    state1?.expectedField !== "loanAmount",
    "Did not get stuck on loanAmount after 'skip'",
    state1?.expectedField
  );
  testAssert(
    state1?.applicant?.loanAmount !== undefined && Number(state1?.applicant?.loanAmount) > 0,
    "Applied standard benchmark for loanAmount",
    state1?.applicant?.loanAmount
  );

  // -------------------------------------------------------------------------
  // TEST 2: User says "not sure" on CIBIL -> Advances to age
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: User says 'not sure' on CIBIL ---");
  const convId2 = `test_cibil_notsure_${Date.now()}`;
  inMemorySessionStates.delete(convId2);

  await saveEligibilityState(convId2, {
    applicant: {
      companyName: "Infosys Limited",
      monthlyIncome: 70000,
      loanAmount: 500000,
      tenureMonths: 36,
    },
    in_eligibility_flow: true,
    expectedField: "cibil",
    missingFields: ["cibil", "age", "existingEmi"],
    updatedAt: Date.now(),
  } as any);

  const res2 = await runCentralAgent({
    conversationId: convId2,
    message: "not sure",
    conversationHistory: [],
  });

  const state2 = await getEligibilityState(convId2);
  console.log("Turn 2 reply:\n", res2.reply.substring(0, 180), "...");
  console.log("State 2 expectedField:", state2?.expectedField, "cibil:", state2?.applicant?.cibil);

  testAssert(
    state2?.expectedField === "age",
    "Advanced to age after 'not sure' on CIBIL",
    state2?.expectedField
  );
  testAssert(
    state2?.applicant?.cibil === "Not provided" || state2?.applicant?.cibil === 0,
    "CIBIL set to unprovided/zero benchmark",
    state2?.applicant?.cibil
  );

  // -------------------------------------------------------------------------
  // TEST 3: User asks a banking question/doubt mid-eligibility
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: User asks side question ('why do you need my age?') ---");
  const convId3 = `test_sideq_${Date.now()}`;
  inMemorySessionStates.delete(convId3);

  await saveEligibilityState(convId3, {
    applicant: {
      companyName: "Infosys Limited",
      monthlyIncome: 70000,
      loanAmount: 500000,
      tenureMonths: 36,
      cibil: 750,
    },
    in_eligibility_flow: true,
    expectedField: "age",
    missingFields: ["age", "existingEmi"],
    updatedAt: Date.now(),
  } as any);

  const res3 = await runCentralAgent({
    conversationId: convId3,
    message: "why do you need my age?",
    conversationHistory: [],
  });

  console.log("Turn 3 reply:\n", res3.reply.substring(0, 220), "...");
  testAssert(
    res3.reply.toLowerCase().includes("age") && (res3.reply.toLowerCase().includes("partner") || res3.reply.toLowerCase().includes("eligib") || res3.reply.toLowerCase().includes("criteria")),
    "Answered age question informatively",
    res3.reply
  );
  testAssert(
    res3.reply.includes("continue") || res3.reply.includes("share") || res3.reply.includes("age"),
    "Followed up to continue the loan eligibility check"
  );

  // -------------------------------------------------------------------------
  // TEST 4: Circuit breaker: 2 unparseable answers advance automatically
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: Circuit breaker for unparseable input on age ---");
  const convId4 = `test_circuit_${Date.now()}`;
  inMemorySessionStates.delete(convId4);

  await saveEligibilityState(convId4, {
    applicant: {
      companyName: "Infosys Limited",
      monthlyIncome: 70000,
      loanAmount: 500000,
      tenureMonths: 36,
      cibil: 750,
    },
    in_eligibility_flow: true,
    expectedField: "age",
    missingFields: ["age", "existingEmi"],
    updatedAt: Date.now(),
  } as any);

  // Turn 4A: First unparseable attempt
  console.log("Attempt 1 with unparseable text 'xyzabc'");
  const res4A = await runCentralAgent({
    conversationId: convId4,
    message: "xyzabc",
    conversationHistory: [],
  });
  console.log("Turn 4A reply:\n", res4A.reply.substring(0, 180), "...");
  testAssert(
    res4A.reply.includes("skip") || res4A.reply.includes("age"),
    "Turn 4A offers guidance and skip option"
  );

  // Turn 4B: Second unparseable attempt -> Circuit breaker MUST trip!
  console.log("Attempt 2 with unparseable text 'foobar'");
  const res4B = await runCentralAgent({
    conversationId: convId4,
    message: "foobar",
    conversationHistory: [{ role: "user", content: "xyzabc" }, { role: "assistant", content: res4A.reply }],
  });
  const state4B = await getEligibilityState(convId4);
  console.log("Turn 4B reply:\n", res4B.reply.substring(0, 200), "...");
  console.log("State 4B expectedField:", state4B?.expectedField, "age:", state4B?.applicant?.age);

  testAssert(
    state4B?.expectedField === "existingEmi",
    "Circuit breaker advanced to existingEmi without getting stuck",
    state4B?.expectedField
  );
  testAssert(
    state4B?.applicant?.age === 28,
    "Circuit breaker set standard age benchmark (28)",
    state4B?.applicant?.age
  );

  // -------------------------------------------------------------------------
  // TEST 5: Post-eligibility 'which bank is best' auto-recommends & advances
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: Post-eligibility 'which bank is best' auto-recommends & advances ---");
  const convId5 = `test_best_bank_${Date.now()}`;
  inMemorySessionStates.delete(convId5);

  await saveEligibilityState(convId5, {
    applicant: {
      companyName: "Infosys Limited",
      monthlyIncome: 80000,
      loanAmount: 500000,
      tenureMonths: 36,
      cibil: 760,
      age: 29,
      existingEmi: 0,
      employmentType: "Salaried",
    },
    in_eligibility_flow: false,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: ["HDFC Bank", "ICICI Bank", "Axis Bank"],
    topBank: "HDFC Bank",
    expectedField: "selectedBank",
    currentStep: "BANK_SELECTION",
    postEligibilityStage: "ELIGIBILITY_CONFIRMED",
    updatedAt: Date.now(),
  } as any);

  const res5 = await runCentralAgent({
    conversationId: convId5,
    message: "which bank is best?",
    conversationHistory: [],
  });

  const state5 = await getEligibilityState(convId5);
  console.log("Turn 5 reply:\n", res5.reply.substring(0, 250), "...");
  console.log("State 5 chosenBank:", state5?.chosenBank, "expectedField:", state5?.expectedField);

  testAssert(
    state5?.chosenBank === "HDFC Bank" || state5?.selectedBank === "HDFC Bank",
    "Automatically selected top recommended bank (HDFC Bank)",
    state5?.chosenBank
  );
  testAssert(
    res5.reply.toLowerCase().includes("hdfc bank") &&
    (res5.reply.toLowerCase().includes("branch") || res5.reply.toLowerCase().includes("city") || res5.reply.toLowerCase().includes("pincode")),
    "Prompted user for branch location, city, or pincode for the recommended bank"
  );

  console.log("\n==================================================================");
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================\n");

  if (pool) {
    await pool.end();
  }
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
