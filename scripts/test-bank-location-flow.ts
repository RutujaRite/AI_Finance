// scripts/test-bank-location-flow.ts
import assert from "assert";
import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, saveEligibilityState } from "../lib/dynamicEligibilityEngine";

async function setupEligibilityState(convId: string, overrides: Record<string, any> = {}) {
  await saveEligibilityState(convId, {
    applicant: {
      companyName: "Infosys",
      monthlyIncome: 95000,
      loanAmount: 500000,
      tenureMonths: 60,
      cibil: 790,
      age: 32,
      existingEmi: 0,
    },
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: ["Tata Capital", "HDFC Bank", "ICICI Bank", "Bajaj Finserv"],
    topBank: "Tata Capital",
    postEligibilityStage: "ELIGIBILITY_CONFIRMED",
    expectedField: "selectedBank",
    selectedBank: "",
    chosenBank: "",
    updatedAt: Date.now(),
    ...overrides,
  });
}

async function runAll20Tests() {
  console.log("===============================================================================");
  console.log("STARTING AUTOMATED VERIFICATION FOR ALL 20 BANK LOCATION & BRANCH FLOW CASES");
  console.log("===============================================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      console.log(`▶ Running Test: ${name}`);
      await fn();
      console.log(`✔ PASSED: ${name}\n`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAILED: ${name}`);
      console.error(err);
      console.log("\n");
      failed++;
    }
  }

  // Case 1: Tata Capital -> Pune
  await test("Case 1: Tata Capital -> Pune", async () => {
    const cid = `test_case_1_${Date.now()}`;
    await setupEligibilityState(cid);

    const r1 = await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    assert.ok(r1.reply.includes("Tata Capital"), "Must acknowledge Tata Capital");
    assert.ok(r1.reply.toLowerCase().includes("city or pincode"), "Must prompt for city or pincode");

    const r2 = await runCentralAgent({ conversationId: cid, message: "Pune" });
    assert.ok(r2.reply.includes("Available **Tata Capital** locations in **Pune**"), "Must list available locations");
    assert.ok(r2.reply.includes("PUNE"), "Must contain PUNE");
    assert.ok(r2.reply.includes("Please select one"), "Must ask to select one");

    const state = await getEligibilityState(cid);
    assert.strictEqual(state?.chosenBank, "Tata Capital");
    assert.strictEqual(state?.city, "Pune");
    assert.strictEqual(state?.postEligibilityStage, "BRANCH_SELECTION");
  });

  // Case 2: Tata Capital -> 411009
  await test("Case 2: Tata Capital -> 411009", async () => {
    const cid = `test_case_2_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    const r2 = await runCentralAgent({ conversationId: cid, message: "411009" });
    assert.ok(r2.reply.includes("PUNE"), "Must resolve 411009 to Pune and show PUNE");
    assert.ok(r2.reply.includes("Please select one"), "Must ask to select one");

    const state = await getEligibilityState(cid);
    assert.strictEqual(state?.pincode, "411009");
    assert.strictEqual(state?.city, "Pune");
  });

  // Case 3: Tata Capital -> Pune -> Katraj
  await test("Case 3: Tata Capital -> Pune -> Katraj", async () => {
    const cid = `test_case_3_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    await runCentralAgent({ conversationId: cid, message: "Pune" });
    const r3 = await runCentralAgent({ conversationId: cid, message: "Katraj" });

    assert.ok(r3.reply.includes("couldn't find an official Tata Capital manager record"), "Must state couldn't find record");
    assert.ok(r3.reply.includes("Katraj, Pune"), "Must state Katraj, Pune");
    assert.ok(r3.reply.includes("Available Tata Capital locations found for Pune:"), "Must show available locations for Pune");
    assert.ok(r3.reply.includes("1. **PUNE**"), "Must show 1. PUNE");
    assert.ok(r3.reply.includes("Please select one of these locations"), "Must ask to select");

    const state = await getEligibilityState(cid);
    assert.strictEqual(state?.city, "Pune");
    assert.strictEqual(state?.area, "Katraj");
    assert.strictEqual(state?.postEligibilityStage, "BRANCH_SELECTION");
  });

  // Case 4: Tata Capital -> Pune -> Swargate
  await test("Case 4: Tata Capital -> Pune -> Swargate", async () => {
    const cid = `test_case_4_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    await runCentralAgent({ conversationId: cid, message: "Pune" });
    const r3 = await runCentralAgent({ conversationId: cid, message: "Swargate" });

    assert.ok(r3.reply.includes("couldn't find an official Tata Capital manager record"), "Must state couldn't find record");
    assert.ok(r3.reply.includes("Swargate, Pune"), "Must state Swargate, Pune");
    assert.ok(r3.reply.includes("1. **PUNE**"), "Must show 1. PUNE");
  });

  // Case 5: Tata Capital -> Pune -> MG Road
  await test("Case 5: Tata Capital -> Pune -> MG Road", async () => {
    const cid = `test_case_5_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    await runCentralAgent({ conversationId: cid, message: "Pune" });
    const r3 = await runCentralAgent({ conversationId: cid, message: "MG Road" });

    assert.ok(r3.reply.includes("couldn't find an official Tata Capital manager record"), "Must state couldn't find record for Tata Capital");
    assert.ok(r3.reply.includes("MG Road, Pune"), "Must state MG Road, Pune");
    assert.ok(r3.reply.includes("1. **PUNE**"), "Must list 1. PUNE");
  });

  // Case 6: Tata Capital -> Pune -> FC Road
  await test("Case 6: Tata Capital -> Pune -> FC Road", async () => {
    const cid = `test_case_6_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    await runCentralAgent({ conversationId: cid, message: "Pune" });
    const r3 = await runCentralAgent({ conversationId: cid, message: "FC Road" });

    assert.ok(r3.reply.includes("couldn't find an official Tata Capital manager record"), "Must state couldn't find record");
    assert.ok(r3.reply.includes("FC Road, Pune"), "Must state FC Road, Pune");
    assert.ok(r3.reply.includes("1. **PUNE**"), "Must show 1. PUNE");
  });

  // Case 7: Tata Capital -> Pune -> Hadapsar
  await test("Case 7: Tata Capital -> Pune -> Hadapsar", async () => {
    const cid = `test_case_7_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    await runCentralAgent({ conversationId: cid, message: "Pune" });
    const r3 = await runCentralAgent({ conversationId: cid, message: "Hadapsar" });

    assert.ok(r3.reply.includes("couldn't find an official Tata Capital manager record"), "Must state couldn't find record");
    assert.ok(r3.reply.includes("Hadapsar, Pune"), "Must state Hadapsar, Pune");
    assert.ok(r3.reply.includes("1. **PUNE**"), "Must show 1. PUNE");
  });

  // Case 8: Tata Capital -> 411009 -> Katraj
  await test("Case 8: Tata Capital -> 411009 -> Katraj", async () => {
    const cid = `test_case_8_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    await runCentralAgent({ conversationId: cid, message: "411009" });
    const r3 = await runCentralAgent({ conversationId: cid, message: "Katraj" });

    assert.ok(r3.reply.includes("couldn't find an official Tata Capital manager record"), "Must state couldn't find record");
    assert.ok(r3.reply.includes("Katraj, Pune"), "Must state Katraj, Pune");
    assert.ok(r3.reply.includes("1. **PUNE**"), "Must show 1. PUNE");
  });

  // Case 9: Tata Capital -> "tell available branches for Pune"
  await test("Case 9: Tata Capital -> 'tell available branches for Pune'", async () => {
    const cid = `test_case_9_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    const r2 = await runCentralAgent({ conversationId: cid, message: "tell available branches for Pune" });

    assert.ok(r2.reply.includes("Available **Tata Capital** locations in **Pune**"), "Must list available branches");
    assert.ok(r2.reply.includes("PUNE"), "Must contain PUNE");
  });

  // Case 10: Tata Capital -> "show branches in Pune"
  await test("Case 10: Tata Capital -> 'show branches in Pune'", async () => {
    const cid = `test_case_10_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    const r2 = await runCentralAgent({ conversationId: cid, message: "show branches in Pune" });

    assert.ok(r2.reply.includes("Available **Tata Capital** locations in **Pune**"), "Must list available branches");
    assert.ok(r2.reply.includes("PUNE"), "Must contain PUNE");
  });

  // Case 11: tata capital -> pune (lowercase)
  await test("Case 11: tata capital -> pune (lowercase)", async () => {
    const cid = `test_case_11_${Date.now()}`;
    await setupEligibilityState(cid);

    const r1 = await runCentralAgent({ conversationId: cid, message: "tata capital" });
    assert.ok(r1.reply.includes("Tata Capital"), "Must normalize to Tata Capital");

    const r2 = await runCentralAgent({ conversationId: cid, message: "pune" });
    assert.ok(r2.reply.includes("Available **Tata Capital** locations in **Pune**"), "Must normalize to Pune and show branches");
  });

  // Case 12: TATA CAPITAL -> PUNE (uppercase)
  await test("Case 12: TATA CAPITAL -> PUNE (uppercase)", async () => {
    const cid = `test_case_12_${Date.now()}`;
    await setupEligibilityState(cid);

    const r1 = await runCentralAgent({ conversationId: cid, message: "TATA CAPITAL" });
    assert.ok(r1.reply.includes("Tata Capital"), "Must normalize to Tata Capital");

    const r2 = await runCentralAgent({ conversationId: cid, message: "PUNE" });
    assert.ok(r2.reply.includes("Available **Tata Capital** locations in **Pune**"), "Must normalize to Pune and show branches");
  });

  // Case 13: Pune -> 411009
  await test("Case 13: Pune -> 411009", async () => {
    const cid = `test_case_13_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    await runCentralAgent({ conversationId: cid, message: "Pune" });
    const r3 = await runCentralAgent({ conversationId: cid, message: "411009" });

    assert.ok(r3.reply.includes("PUNE"), "Must acknowledge 411009/Pune and show branches");
    assert.ok(r3.reply.includes("Please select one"), "Must ask to select one");
    const state = await getEligibilityState(cid);
    assert.strictEqual(state?.pincode, "411009");
    assert.strictEqual(state?.city, "Pune");
  });

  // Case 14: Pune Katraj (compound phrase)
  await test("Case 14: Pune Katraj", async () => {
    const cid = `test_case_14_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    const r2 = await runCentralAgent({ conversationId: cid, message: "Pune Katraj" });

    assert.ok(r2.reply.includes("couldn't find an official Tata Capital manager record"), "Must state couldn't find record");
    assert.ok(r2.reply.includes("Katraj, Pune"), "Must cleanly extract city=Pune, area=Katraj");
    assert.ok(r2.reply.includes("1. **PUNE**"), "Must show available location 1. PUNE");
  });

  // Case 15: Pune, Hadapsar (compound phrase)
  await test("Case 15: Pune, Hadapsar", async () => {
    const cid = `test_case_15_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    const r2 = await runCentralAgent({ conversationId: cid, message: "Pune, Hadapsar" });

    assert.ok(r2.reply.includes("couldn't find an official Tata Capital manager record"), "Must state couldn't find record");
    assert.ok(r2.reply.includes("Hadapsar, Pune"), "Must cleanly extract city=Pune, area=Hadapsar");
    assert.ok(r2.reply.includes("1. **PUNE**"), "Must show available location 1. PUNE");
  });

  // Case 16: Invalid location ("Atlantis")
  await test("Case 16: Invalid location ('Atlantis')", async () => {
    const cid = `test_case_16_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    const r2 = await runCentralAgent({ conversationId: cid, message: "Atlantis" });

    assert.ok(r2.reply.includes("No branches or locations found"), "Must report no branches found");
    assert.ok(r2.reply.includes("Atlantis"), "Must cite Atlantis");
    assert.ok(r2.reply.toLowerCase().includes("valid city or pincode"), "Must prompt for valid city or pincode");
  });

  // Case 17: Change location after failed search (Katraj -> PUNE)
  await test("Case 17: Change location after failed search (Katraj -> PUNE)", async () => {
    const cid = `test_case_17_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    await runCentralAgent({ conversationId: cid, message: "Pune" });
    await runCentralAgent({ conversationId: cid, message: "Katraj" });
    // User now selects option 1 ("PUNE")
    const r4 = await runCentralAgent({ conversationId: cid, message: "1" });

    assert.ok(r4.reply.includes("Official Bank Manager Directory"), "Must render official bank manager directory");
    assert.ok(r4.reply.includes("Tata Capital"), "Must be for Tata Capital");
    assert.ok(r4.reply.includes("| Bank |"), "Must contain directory table");

    const state = await getEligibilityState(cid);
    assert.strictEqual(state?.postEligibilityStage, "BANK_MANAGER_RESULTS");
    assert.strictEqual(state?.managerFound, true);
  });

  // Case 18: Same location twice
  await test("Case 18: Same location twice ('Pune' then 'Pune')", async () => {
    const cid = `test_case_18_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    await runCentralAgent({ conversationId: cid, message: "Pune" });
    // User sends "Pune" again: Since PUNE is the available branch, it matches and renders manager table!
    const r3 = await runCentralAgent({ conversationId: cid, message: "Pune" });

    assert.ok(
      r3.reply.includes("Official Bank Manager Directory") || r3.reply.includes("Available **Tata Capital** locations in **Pune**"),
      "Must smoothly resolve without loop or crash"
    );
  });

  // Case 19: Only pincode
  await test("Case 19: Only pincode ('411009')", async () => {
    const cid = `test_case_19_${Date.now()}`;
    await setupEligibilityState(cid);

    await runCentralAgent({ conversationId: cid, message: "Tata Capital" });
    const r2 = await runCentralAgent({ conversationId: cid, message: "411009" });

    assert.ok(r2.reply.includes("Available **Tata Capital** locations in **Pune**"), "Must show locations for resolved city Pune");
    assert.ok(r2.reply.includes("1. **PUNE**"), "Must show 1. PUNE");
    const state = await getEligibilityState(cid);
    assert.strictEqual(state?.pincode, "411009");
    assert.strictEqual(state?.city, "Pune");
  });

  // Case 20: Only area after city known
  await test("Case 20: Only area after city known", async () => {
    const cid = `test_case_20_${Date.now()}`;
    // City is already known in state as Pune
    await setupEligibilityState(cid, {
      selectedBank: "Tata Capital",
      chosenBank: "Tata Capital",
      city: "Pune",
      location: "Pune",
      postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
      expectedField: "cityOrPincode",
    });

    const r1 = await runCentralAgent({ conversationId: cid, message: "Katraj" });
    assert.ok(r1.reply.includes("couldn't find an official Tata Capital manager record for the selected location (Katraj, Pune)"), "Must recognize area Katraj within city Pune");
    assert.ok(r1.reply.includes("1. **PUNE**"), "Must show available location 1. PUNE");
  });

  console.log("===============================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED OUT OF 20 TESTS`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAll20Tests().catch((e) => {
  console.error("FATAL ERROR IN TEST SUITE:", e);
  process.exit(1);
});
