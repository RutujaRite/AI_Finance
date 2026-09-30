import assert from "node:assert";
import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, saveEligibilityState, inMemorySessionStates } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function runTests() {
  console.log("==================================================================");
  console.log("  TEST: Bank Manager Flow After Eligibility Assessment");
  console.log("  1. Eligibility card asks which bank user wants to proceed with");
  console.log("  2. User sends one bank from eligible banks");
  console.log("  3. Assistant asks for branch location, city, or pincode");
  console.log("  4. User sends location -> displays bank manager details");
  console.log("==================================================================\n");

  const testConvId = `test_bm_flow_${Date.now()}`;
  inMemorySessionStates.delete(testConvId);

  // Setup state as if user just finished 6 out of 7 eligibility questions, now answering the final one (existingEmi)
  await saveEligibilityState(testConvId, {
    applicant: {
      companyName: "Infosys Limited",
      monthlyIncome: 75000,
      loanAmount: 500000,
      tenureMonths: 36,
      cibil: 750,
      age: 28,
      employmentType: "Salaried",
    },
    in_eligibility_flow: true,
    expectedField: "existingEmi",
    missingFields: ["existingEmi"],
    updatedAt: Date.now(),
  } as any);

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
  // TEST STEP 1: User provides final field (0) -> AI generates Eligibility Card
  // -------------------------------------------------------------------------
  console.log("--- Step 1: User provides '0' -> Eligibility Card is Generated ---");
  const resTurn1 = await runCentralAgent({
    conversationId: testConvId,
    message: "0",
    conversationHistory: [],
  });

  console.log("Turn 1 Reply:\n", resTurn1.reply.substring(0, 300), "...\n");
  testAssert(
    resTurn1.reply.includes("Personal Loan Eligibility Assessment") &&
    resTurn1.reply.includes("Eligible Partner Bank"),
    "Step 1: Returns Personal Loan Eligibility Assessment Card"
  );
  testAssert(
    resTurn1.reply.includes("Which bank from your eligible list above would you like to proceed with?") &&
    resTurn1.reply.includes("select **ONE** bank"),
    "Step 1: Card asks user which bank they want to proceed with"
  );

  const state1 = await getEligibilityState(testConvId);
  testAssert(
    state1?.hasCompletedEvaluation === true &&
    state1?.expectedField === "selectedBank" &&
    Array.isArray(state1?.eligible_banks) &&
    state1.eligible_banks.length > 0,
    "Step 1: Session state marks evaluation completed and expects 'selectedBank'"
  );

  // -------------------------------------------------------------------------
  // TEST STEP 2: User sends one bank from eligible banks -> "HDFC Bank"
  // -------------------------------------------------------------------------
  console.log("\n--- Step 2: User selects 'HDFC Bank' from eligible banks ---");
  const resTurn2 = await runCentralAgent({
    conversationId: testConvId,
    message: "HDFC Bank",
    conversationHistory: [
      { role: "assistant", content: resTurn1.reply },
    ],
  });
  console.log("Turn 2 Reply:\n", resTurn2.reply, "\n");

  testAssert(
    resTurn2.reply.includes("HDFC Bank"),
    "Step 2: Acknowledges HDFC Bank selection"
  );
  testAssert(
    resTurn2.reply.toLowerCase().includes("branch location") &&
    resTurn2.reply.toLowerCase().includes("city") &&
    resTurn2.reply.toLowerCase().includes("pincode"),
    "Step 2: Explicitly asks for branch location, city, or pincode"
  );

  const state2 = await getEligibilityState(testConvId);
  testAssert(
    state2?.selectedBank === "HDFC Bank" || state2?.chosenBank === "HDFC Bank",
    "Step 2: Selected bank stored in state as 'HDFC Bank'"
  );
  testAssert(
    state2?.expectedField === "city" || state2?.expectedEntity === "city",
    "Step 2: Next expected field is city/location"
  );

  // -------------------------------------------------------------------------
  // TEST STEP 3: User sends pincode -> "411009"
  // -------------------------------------------------------------------------
  console.log("\n--- Step 3: User provides pincode '411009' ---");
  const resTurn3 = await runCentralAgent({
    conversationId: testConvId,
    message: "411009",
    conversationHistory: [
      { role: "assistant", content: resTurn1.reply },
      { role: "user", content: "HDFC Bank" },
      { role: "assistant", content: resTurn2.reply },
    ],
  });
  console.log("Turn 3 Reply:\n", resTurn3.reply, "\n");

  testAssert(
    resTurn3.reply.includes("Official Bank Manager Directory") && resTurn3.reply.includes("HDFC Bank"),
    "Step 3: Displays official bank manager directory for HDFC Bank"
  );
  testAssert(
    resTurn3.reply.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"),
    "Step 3: Output contains 6-column bank manager table"
  );
  testAssert(
    !resTurn3.reply.includes("ICICI Bank") && !resTurn3.reply.includes("Bajaj Markets"),
    "Step 3: Strictly displays managers for the selected bank (HDFC Bank) only"
  );

  // -------------------------------------------------------------------------
  // TEST STEP 4: Test alternative flow where user provides city then branch
  // -------------------------------------------------------------------------
  console.log("\n--- Step 4: Flow with City -> Branch Selection ---");
  const testConvId2 = `test_bm_flow_city_${Date.now()}`;
  await saveEligibilityState(testConvId2, {
    applicant: { companyName: "Infosys Limited", monthlyIncome: 75000, loanAmount: 500000 },
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: ["Bandhan Bank", "IDFC FIRST Bank"],
    topBank: "Bandhan Bank",
    postEligibilityStage: "ELIGIBILITY_CONFIRMED",
    expectedField: "selectedBank",
    selectedBank: "",
    updatedAt: Date.now(),
  } as any);

  // User selects Bandhan Bank
  const resBank = await runCentralAgent({ conversationId: testConvId2, message: "Bandhan Bank" });
  testAssert(
    resBank.reply.includes("Bandhan Bank") &&
    resBank.reply.toLowerCase().includes("branch location") &&
    resBank.reply.toLowerCase().includes("city") &&
    resBank.reply.toLowerCase().includes("pincode"),
    "Step 4.1: Asks for branch location, city, or pincode for Bandhan Bank"
  );

  // User provides Pune
  const resCity = await runCentralAgent({ conversationId: testConvId2, message: "Pune" });
  testAssert(
    resCity.reply.includes("Available Bandhan Bank branches in Pune") || resCity.reply.includes("Please select a branch"),
    "Step 4.2: Lists available branches in Pune"
  );

  // User selects branch 1
  const resBranch = await runCentralAgent({ conversationId: testConvId2, message: "1" });
  testAssert(
    resBranch.reply.includes("Official Bank Manager Directory") && resBranch.reply.includes("Bandhan Bank"),
    "Step 4.3: Displays official bank manager details for Bandhan Bank in selected branch"
  );
  testAssert(
    resBranch.reply.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"),
    "Step 4.3: Contains 6-column manager table"
  );

  console.log("\n==================================================================");
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (pool) {
    await pool.end();
  }
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
