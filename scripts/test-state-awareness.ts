import assert from "node:assert";
import {
  saveEligibilityState,
  getEligibilityState,
  isKnownBankName,
  resolveBankName,
  resolvePincodeToCity,
  generatePreliminaryRecommendation,
  isInvalidCompanyName,
  extractSecondaryParameters,
  ApplicantProfile,
  consolidateApplicantProfileFromHistory,
  extractBankBranchLocationParams,
} from "../lib/dynamicEligibilityEngine";
import { findBankBranches, formatBankManagersTable, searchBankManager } from "../lib/bankSearch";
import { runCentralAgent } from "../lib/ai/agent";

async function runTests() {
  console.log("\n=======================================================");
  console.log("RUNNING RIGOROUS CONTEXT & STATE AWARENESS TEST SUITE");
  console.log("=======================================================\n");

  let passed = 0;
  let total = 0;

  async function check(desc: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${desc}`);
      console.error(err);
    }
  }

  // Test 1: Bank name detection & validation (prevents Company Search interception)
  await check("1. Bank names and typos are recognized as banks and rejected as company names", async () => {
    assert.strictEqual(isKnownBankName("HDFC Bank"), true);
    assert.strictEqual(isKnownBankName("HDFC bnka"), true);
    assert.strictEqual(isKnownBankName("ICICI Bank"), true);
    assert.strictEqual(isKnownBankName("State Bank of India"), true);
    assert.strictEqual(isKnownBankName("Axis Bank"), true);
    assert.strictEqual(isKnownBankName("Kotak Mahindra"), true);

    // Must be rejected as valid company candidates
    assert.strictEqual(isInvalidCompanyName("HDFC Bank"), true);
    assert.strictEqual(isInvalidCompanyName("ICICI Bank"), true);
    assert.strictEqual(isInvalidCompanyName("HDFC bnka"), true);
    assert.strictEqual(isInvalidCompanyName("Axis"), true);
  });

  // Test 2: resolveBankName handles typos, direct names, and conversational corrections
  await check("2. resolveBankName handles typos, direct names, and conversational corrections", async () => {
    const banks = ["HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "IDFC FIRST Bank"];

    assert.strictEqual(resolveBankName("HDFC Bank", banks)?.bankName, "HDFC Bank");
    assert.strictEqual(resolveBankName("HDFC bnka", banks)?.bankName, "HDFC Bank");
    assert.strictEqual(resolveBankName("I want ICICI", banks)?.bankName, "ICICI Bank");
    assert.strictEqual(resolveBankName("No, I meant ICICI Bank", banks)?.bankName, "ICICI Bank");
    assert.strictEqual(resolveBankName("No, I meant ICICI Bank", banks)?.isCorrection, true);
    assert.strictEqual(resolveBankName("Actually Axis Bank please", banks)?.bankName, "Axis Bank");
    assert.strictEqual(resolveBankName("kotak", banks)?.bankName, "Kotak Mahindra Bank");
  });

  // Test 3: 6-digit pincode extraction & city mapping
  await check("3. 6-digit pincode extraction & city mapping", async () => {
    const applicant: ApplicantProfile = {};
    const text = "I live in 411001 area";
    extractSecondaryParameters(applicant, text, text.toLowerCase());
    assert.strictEqual(applicant.pincode, "411001");
    assert.strictEqual(applicant.location, "Pune");
    assert.strictEqual(resolvePincodeToCity("411001"), "Pune");
    assert.strictEqual(resolvePincodeToCity("400001"), "Mumbai");
    assert.strictEqual(resolvePincodeToCity("416001"), "Kolhapur");
    assert.strictEqual(resolvePincodeToCity("560001"), "Bangalore");
  });

  // Test 4: extractBankBranchLocationParams handles inputs in any order
  await check("4. extractBankBranchLocationParams handles multi-field details in any order", async () => {
    const p1 = extractBankBranchLocationParams("HDFC Bank Camp Pune");
    assert.strictEqual(p1.bankName, "HDFC Bank");
    assert.strictEqual(p1.branch, "Camp");
    assert.strictEqual(p1.city, "Pune");

    const p2 = extractBankBranchLocationParams("Camp branch, Pune");
    assert.strictEqual(p2.branch, "Camp");
    assert.strictEqual(p2.city, "Pune");

    const p3 = extractBankBranchLocationParams("411001");
    assert.strictEqual(p3.pincode, "411001");
    assert.strictEqual(p3.city, "Pune");
    assert.strictEqual(p3.branch, undefined);

    const p4 = extractBankBranchLocationParams("Camp");
    assert.strictEqual(p4.branch, "Camp");
    assert.strictEqual(p4.city, undefined);

    const p5 = extractBankBranchLocationParams("Pune 411001");
    assert.strictEqual(p5.pincode, "411001");
    assert.strictEqual(p5.city, "Pune");
    assert.strictEqual(p5.branch, undefined);
  });

  // Test 5: Step 1: Selecting bank starts Bank Manager flow by asking for branch name ONE AT A TIME
  await check("5. Step 1: Selecting 'HDFC Bank' asks for branch name (one question at a time)", async () => {
    const convId = `test_bank_sel_${Date.now()}`;
    await saveEligibilityState(convId, {
      applicant: { companyName: "TCS", monthlyIncome: 85000 },
      hasCompletedEvaluation: true,
      evaluationCompleted: true,
      eligible_banks: ["HDFC Bank", "ICICI Bank"],
      topBank: "HDFC Bank",
      postEligibilityStage: "ELIGIBILITY_CONFIRMED",
      expectedField: "selectedBank",
      updatedAt: Date.now(),
    });

    const res = await runCentralAgent({
      conversationId: convId,
      message: "HDFC Bank",
      conversationHistory: [
        { role: "user", content: "Check my loan eligibility for TCS, 85k salary, 5L loan" },
        { role: "assistant", content: "Eligibility Confirmed — Partner Banks Found" },
      ],
      model: "gemini-2.5-flash",
    });

    // Must NOT treat as company
    assert.ok(!res.reply.includes("matching companies"), "Must never trigger company search on bank selection");
    // Must ask for branch name one at a time
    assert.ok(res.reply.includes("HDFC Bank"), "Must reference HDFC Bank");
    assert.ok(res.reply.toLowerCase().includes("branch"), "Must ask for branch name");

    const state = await getEligibilityState(convId);
    assert.strictEqual(state?.chosenBank, "HDFC Bank");
    assert.strictEqual(state?.selectedBank, "HDFC Bank");
    assert.strictEqual(state?.postEligibilityStage, "BANK_MANAGER_DETAILS_INPUT");
    assert.strictEqual(state?.expectedField, "branch");
  });

  // Test 6: Step 2A: If only location/pincode is provided, preserve bank and ask only for branch
  await check("6. Step 2A: Providing only pincode '411001' preserves bank and asks only for branch name", async () => {
    const convId = `test_pincode_only_${Date.now()}`;
    await saveEligibilityState(convId, {
      applicant: { companyName: "TCS", monthlyIncome: 85000 },
      chosenBank: "HDFC Bank",
      hasCompletedEvaluation: true,
      evaluationCompleted: true,
      eligible_banks: ["HDFC Bank", "ICICI Bank"],
      postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
      expectedField: "branchAndLocation",
      updatedAt: Date.now(),
    });

    const res = await runCentralAgent({
      conversationId: convId,
      message: "411001",
      conversationHistory: [
        { role: "assistant", content: "You selected HDFC Bank. Please provide the branch name and your location/city or pincode so I can find the relevant bank manager." },
      ],
      model: "gemini-2.5-flash",
    });

    assert.ok(res.reply.includes("411001") || res.reply.toLowerCase().includes("pune"), "Must acknowledge location");
    assert.ok(res.reply.toLowerCase().includes("branch"), "Must ask for missing branch name");
    assert.ok(res.reply.includes("HDFC Bank"), "Must preserve selected bank");

    const state = await getEligibilityState(convId);
    assert.strictEqual(state?.chosenBank, "HDFC Bank");
    assert.strictEqual(state?.pincode, "411001");
    assert.strictEqual(state?.postEligibilityStage, "BANK_MANAGER_DETAILS_INPUT");
    assert.strictEqual(state?.expectedField, "branch");
  });

  // Test 7: Step 2B: If only branch is provided, preserve bank and ask only for location
  await check("7. Step 2B: Providing only branch 'Camp' preserves bank and asks only for location", async () => {
    const convId = `test_branch_only_${Date.now()}`;
    await saveEligibilityState(convId, {
      applicant: { companyName: "TCS", monthlyIncome: 85000 },
      chosenBank: "HDFC Bank",
      hasCompletedEvaluation: true,
      evaluationCompleted: true,
      eligible_banks: ["HDFC Bank", "ICICI Bank"],
      postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
      expectedField: "branchAndLocation",
      updatedAt: Date.now(),
    });

    const res = await runCentralAgent({
      conversationId: convId,
      message: "Camp",
      conversationHistory: [
        { role: "assistant", content: "You selected HDFC Bank. Please provide the branch name and your location/city or pincode so I can find the relevant bank manager." },
      ],
      model: "gemini-2.5-flash",
    });

    assert.ok(res.reply.includes("Camp"), "Must acknowledge branch");
    assert.ok(
      res.reply.toLowerCase().includes("city") || res.reply.toLowerCase().includes("location") || res.reply.toLowerCase().includes("pincode"),
      "Must ask for missing location"
    );
    assert.ok(res.reply.includes("HDFC Bank"), "Must preserve selected bank");

    const state = await getEligibilityState(convId);
    assert.strictEqual(state?.chosenBank, "HDFC Bank");
    assert.strictEqual(state?.branch, "Camp");
    assert.strictEqual(state?.postEligibilityStage, "BANK_MANAGER_DETAILS_INPUT");
    assert.strictEqual(state?.expectedField, "cityOrPincode");
  });

  // Test 8: Step 3: When both branch and location are provided, retrieves DB managers and displays in TABULAR FORMAT
  await check("8. Step 3: Tabular format for bank managers with DB columns", async () => {
    const convId = `test_tabular_${Date.now()}`;
    await saveEligibilityState(convId, {
      applicant: { companyName: "TCS", monthlyIncome: 85000 },
      chosenBank: "HDFC Bank",
      city: "Pune",
      hasCompletedEvaluation: true,
      evaluationCompleted: true,
      eligible_banks: ["HDFC Bank", "ICICI Bank"],
      postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
      expectedField: "branch",
      updatedAt: Date.now(),
    });

    // User provides branch "PUNE" (actual HDFC branch in DB)
    const res = await runCentralAgent({
      conversationId: convId,
      message: "PUNE",
      conversationHistory: [
        { role: "assistant", content: "I have your location as Pune. Which HDFC Bank branch would you like to proceed with?" },
      ],
      model: "gemini-2.5-flash",
    });

    // Must contain table with columns:
    // | Bank | Branch | City | ... | Manager Name | ... |
    assert.ok(res.reply.includes("| Bank | Branch | City |") && res.reply.includes("Manager Name"), "Must contain dynamic tabular header");
    assert.ok(
      res.reply.includes("SHANNOL DIASSAPECO") ||
      res.reply.includes("SHRIJEET BONDE") ||
      res.reply.includes("GAURAV RAWAT") ||
      res.reply.includes("Deepak Misal"),
      "Must show actual DB manager names"
    );

    const state = await getEligibilityState(convId);
    assert.strictEqual(state?.postEligibilityStage, "BANK_MANAGER_RESULTS");
    assert.strictEqual(state?.expectedField, "completed");
  });

  // Test 9: All information together: "HDFC Bank PUNE Pune"
  await check("9. Bank + branch + city together in single message retrieves managers immediately", async () => {
    const convId = `test_all_together_${Date.now()}`;
    await saveEligibilityState(convId, {
      applicant: { companyName: "TCS", monthlyIncome: 85000 },
      hasCompletedEvaluation: true,
      evaluationCompleted: true,
      eligible_banks: ["HDFC Bank", "ICICI Bank"],
      postEligibilityStage: "ELIGIBILITY_CONFIRMED",
      expectedField: "chosenBank",
      updatedAt: Date.now(),
    });

    const res = await runCentralAgent({
      conversationId: convId,
      message: "HDFC Bank PUNE Pune",
      conversationHistory: [],
      model: "gemini-2.5-flash",
    });

    assert.ok(res.reply.includes("| Bank | Branch | City |") && res.reply.includes("Manager Name"), "Must return tabular managers immediately");
    assert.ok(res.reply.includes("HDFC Bank"));
  });

  // Test 10: No exact result found: do NOT fabricate data
  await check("10. Non-existent branch/location explains no records found without fabricating data", async () => {
    const convId = `test_no_fabricate_${Date.now()}`;
    await saveEligibilityState(convId, {
      applicant: { companyName: "TCS", monthlyIncome: 85000 },
      chosenBank: "HDFC Bank",
      hasCompletedEvaluation: true,
      evaluationCompleted: true,
      eligible_banks: ["HDFC Bank", "ICICI Bank"],
      postEligibilityStage: "ELIGIBILITY_CONFIRMED",
      expectedField: "chosenBank",
      updatedAt: Date.now(),
    });

    const res = await runCentralAgent({
      conversationId: convId,
      message: "HDFC Bank NonExistentXYZ NowhereCity",
      conversationHistory: [],
      model: "gemini-2.5-flash",
    });

    assert.ok(
      res.reply.includes("No matching") || res.reply.toLowerCase().includes("no matching bank manager records"),
      "Must explain no records found"
    );
    assert.ok(res.reply.includes("HDFC Bank"));

    const state = await getEligibilityState(convId);
    assert.strictEqual(state?.chosenBank, "HDFC Bank");
  });

  // Test 11: Random question mid-flow preserves state and appends resumption prompt
  await check("11. Random question 'What is EMI?' preserves post-eligibility state with resumption prompt", async () => {
    const convId = `test_random_q_${Date.now()}`;
    await saveEligibilityState(convId, {
      applicant: { companyName: "TCS", monthlyIncome: 85000 },
      chosenBank: "HDFC Bank",
      pincode: "411001",
      city: "Pune",
      hasCompletedEvaluation: true,
      evaluationCompleted: true,
      eligible_banks: ["HDFC Bank", "ICICI Bank"],
      postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
      expectedField: "branch",
      updatedAt: Date.now(),
    });

    const res = await runCentralAgent({
      conversationId: convId,
      message: "What is EMI?",
      conversationHistory: [
        { role: "assistant", content: "I have your location as 411001. Which HDFC Bank branch would you like to proceed with?" },
      ],
      model: "gemini-2.5-flash",
    });

    // Should answer EMI
    assert.ok(res.reply.toLowerCase().includes("equated monthly installment") || res.reply.toLowerCase().includes("emi"));
    // Should preserve prompt for branch
    assert.ok(res.reply.includes("HDFC Bank") && res.reply.toLowerCase().includes("branch"));

    // Verify state preserved
    const state = await getEligibilityState(convId);
    assert.strictEqual(state?.chosenBank, "HDFC Bank");
    assert.strictEqual(state?.pincode, "411001");
    assert.strictEqual(state?.postEligibilityStage, "BANK_MANAGER_DETAILS_INPUT");
  });

  // Test 12: Bank typo and correction
  await check("12. Spelling variation ('HDFC bnka') and correction ('No, I meant ICICI Bank')", async () => {
    const convId = `test_typo_corr_${Date.now()}`;
    await saveEligibilityState(convId, {
      applicant: { companyName: "TCS", monthlyIncome: 85000 },
      hasCompletedEvaluation: true,
      evaluationCompleted: true,
      eligible_banks: ["HDFC Bank", "ICICI Bank", "Axis Bank"],
      postEligibilityStage: "ELIGIBILITY_CONFIRMED",
      expectedField: "chosenBank",
      updatedAt: Date.now(),
    });

    // Typo: "HDFC bnka"
    const resTypo = await runCentralAgent({
      conversationId: convId,
      message: "HDFC bnka",
      conversationHistory: [],
      model: "gemini-2.5-flash",
    });
    assert.ok(resTypo.reply.includes("HDFC Bank"));
    let state = await getEligibilityState(convId);
    assert.strictEqual(state?.chosenBank, "HDFC Bank");

    // Correction: "No, I meant ICICI Bank"
    const resCorrection = await runCentralAgent({
      conversationId: convId,
      message: "No, I meant ICICI Bank",
      conversationHistory: [{ role: "assistant", content: resTypo.reply }],
      model: "gemini-2.5-flash",
    });
    assert.ok(resCorrection.reply.includes("ICICI Bank"));
    state = await getEligibilityState(convId);
    assert.strictEqual(state?.chosenBank, "ICICI Bank");
  });

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log("=======================================================");

  process.exit(passed === total ? 0 : 1);
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
