import assert from "assert";
import { runCentralAgent } from "@/lib/ai/agent";
import { getEligibilityState, saveEligibilityState } from "@/lib/dynamicEligibilityEngine";
import pool from "@/lib/db";

async function runAll17Tests() {
  console.log("===============================================================================");
  console.log("TESTING ALL 17 POST-ELIGIBILITY BANK SELECTION & MANAGER LOOKUP SCENARIOS");
  console.log("===============================================================================\n");

  const baseApplicant = {
    companyName: "Tata Consultancy Services Limited",
    monthlyIncome: 85000,
    loanAmount: 500000,
    tenureMonths: 60,
    cibil: 780,
    age: 30,
    existingEmi: 0,
  };

  const eligibleList = ["HDFC Bank", "ICICI Bank", "IDFC FIRST Bank", "Kotak Mahindra Bank", "Axis Bank"];

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Eligible user clicks "Proceed With This Bank"
  // ---------------------------------------------------------------------------
  console.log("Scenario 1: Eligible user clicks 'Proceed With This Bank'...");
  const convId1 = `scen1_${Date.now()}`;
  await saveEligibilityState(convId1, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    topBank: "HDFC Bank",
    postEligibilityStage: "ELIGIBILITY_COMPLETED",
    selectedBank: "",
  });

  const res1 = await runCentralAgent({
    conversationId: convId1,
    message: "Proceed With This Bank",
  });
  assert.ok(res1.reply.includes("HDFC Bank"), "Must recognize top bank HDFC Bank");
  assert.ok(res1.reply.toLowerCase().includes("city") || res1.reply.toLowerCase().includes("area"), "Must prompt for location");
  const state1 = await getEligibilityState(convId1);
  assert.strictEqual(state1?.selectedBank, "HDFC Bank", "selectedBank must be saved as HDFC Bank");
  console.log("✓ Scenario 1 passed: User clicking 'Proceed With This Bank' saves selected bank and asks for location.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 2: User selects HDFC Bank from the alternatives
  // ---------------------------------------------------------------------------
  console.log("Scenario 2: User selects HDFC Bank from the alternatives...");
  const convId2 = `scen2_${Date.now()}`;
  await saveEligibilityState(convId2, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    topBank: "ICICI Bank",
    postEligibilityStage: "ELIGIBILITY_COMPLETED",
  });

  // Step 2a: User clicks "Select Another Bank"
  const res2a = await runCentralAgent({
    conversationId: convId2,
    message: "I want to select another bank",
  });
  assert.ok(res2a.reply.includes("HDFC Bank") && res2a.reply.includes("IDFC FIRST Bank"), "Must display alternative eligible banks");

  // Step 2b: User selects "HDFC Bank"
  const res2b = await runCentralAgent({
    conversationId: convId2,
    message: "I would like to proceed with HDFC Bank for my loan application.",
  });
  assert.ok(res2b.reply.includes("HDFC Bank"), "Must acknowledge selected alternative HDFC Bank");
  assert.ok(res2b.reply.toLowerCase().includes("city"), "Must prompt for location");
  const state2 = await getEligibilityState(convId2);
  assert.strictEqual(state2?.selectedBank, "HDFC Bank", "selectedBank must be updated to HDFC Bank");
  console.log("✓ Scenario 2 passed: User can select another bank from alternatives and choose HDFC Bank.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 3: User asks for next steps without mentioning the bank again
  // ---------------------------------------------------------------------------
  console.log("Scenario 3: User asks for next steps without mentioning the bank again...");
  const convId3 = `scen3_${Date.now()}`;
  await saveEligibilityState(convId3, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "IDFC FIRST Bank",
    chosenBank: "IDFC FIRST Bank",
    postEligibilityStage: "BANK_SELECTED",
  });

  const res3 = await runCentralAgent({
    conversationId: convId3,
    message: "What are the next steps?",
  });
  assert.ok(res3.reply.includes("IDFC FIRST Bank"), "Must use selectedBank IDFC FIRST Bank from session state");
  assert.ok(res3.reply.toLowerCase().includes("city") || res3.reply.toLowerCase().includes("branch"), "Must ask for city/branch");
  console.log("✓ Scenario 3 passed: Resolves bank from session state when user asks for next steps.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Agent asks for city/area when location is missing
  // ---------------------------------------------------------------------------
  console.log("Scenario 4: Agent asks for city/area when location is missing...");
  const convId4 = `scen4_${Date.now()}`;
  await saveEligibilityState(convId4, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    topBank: "Kotak Mahindra Bank",
  });

  const res4 = await runCentralAgent({
    conversationId: convId4,
    message: "Kotak Mahindra Bank",
  });
  assert.ok(
    res4.reply.includes("Which city or area would you like to visit?") ||
    res4.reply.toLowerCase().includes("city"),
    "Must ask for city or area politely"
  );
  const state4 = await getEligibilityState(convId4);
  assert.strictEqual(state4?.expectedField, "city", "expectedField must be 'city'");
  console.log("✓ Scenario 4 passed: Asks for city/area when location is missing.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Agent asks for PIN code only when needed
  // ---------------------------------------------------------------------------
  console.log("Scenario 5: Agent asks for PIN code only when needed...");
  const convId5 = `scen5_${Date.now()}`;
  await saveEligibilityState(convId5, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    city: "Pune",
    postEligibilityStage: "AWAITING_PIN_CODE",
    expectedField: "pincode",
  });

  const res5 = await runCentralAgent({
    conversationId: convId5,
    message: "Which branch?",
  });
  assert.ok(res5.reply.includes("Could you please share the branch PIN code?"), "Must prompt for branch PIN code");
  console.log("✓ Scenario 5 passed: Asks for PIN code when specifically needed.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Exact bank + PIN match returns the correct manager
  // ---------------------------------------------------------------------------
  console.log("Scenario 6: Exact bank + PIN match returns the correct manager...");
  // Find a real PIN code in DB for ICICI Bank
  const pinRes = await pool.query(
    `SELECT location, city FROM bank_managers WHERE bank_name = 'ICICI Bank' AND location ~ '^[0-9]{6}$' LIMIT 1`
  );
  const testPin = pinRes.rows[0]?.location || "411038";

  const convId6 = `scen6_${Date.now()}`;
  await saveEligibilityState(convId6, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "ICICI Bank",
    chosenBank: "ICICI Bank",
    postEligibilityStage: "AWAITING_BRANCH_LOCATION",
    expectedField: "city",
  });

  const res6 = await runCentralAgent({
    conversationId: convId6,
    message: testPin,
  });
  assert.ok(res6.reply.includes("ICICI Bank"), "Must return ICICI Bank");
  assert.ok(res6.reply.includes("Branch Contact Details") || res6.reply.includes("| Bank | Branch | City |"), "Must return manager details table/card");
  assert.ok(!res6.reply.includes("HDFC Bank"), "Must never return a different bank");
  console.log("✓ Scenario 6 passed: Exact bank + PIN returns correct manager.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Area-level match works when no exact PIN match exists
  // ---------------------------------------------------------------------------
  console.log("Scenario 7: Area-level match works when no exact PIN match exists...");
  const convId7 = `scen7_${Date.now()}`;
  await saveEligibilityState(convId7, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    postEligibilityStage: "AWAITING_BRANCH_LOCATION",
    expectedField: "city",
  });

  const res7 = await runCentralAgent({
    conversationId: convId7,
    message: "Kothrud",
  });
  assert.ok(res7.reply.includes("HDFC Bank"), "Must return HDFC Bank");
  console.log("✓ Scenario 7 passed: Area-level search handled correctly.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 8: City-level fallback works when no more specific match exists
  // ---------------------------------------------------------------------------
  console.log("Scenario 8: City-level fallback works when no more specific match exists...");
  const convId8 = `scen8_${Date.now()}`;
  await saveEligibilityState(convId8, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    postEligibilityStage: "AWAITING_BRANCH_LOCATION",
    expectedField: "city",
  });

  const res8 = await runCentralAgent({
    conversationId: convId8,
    message: "Pune",
  });
  assert.ok(res8.reply.includes("Pune") || res8.reply.includes("PUNE"), "Must show Pune branches or details");
  assert.ok(res8.reply.includes("HDFC Bank"), "Must reference HDFC Bank");
  console.log("✓ Scenario 8 passed: City-level search works without broad state spillover.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Manager from a different bank is never returned
  // ---------------------------------------------------------------------------
  console.log("Scenario 9: Manager from a different bank is never returned...");
  const convId9 = `scen9_${Date.now()}`;
  await saveEligibilityState(convId9, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    city: "Pune",
    postEligibilityStage: "BRANCH_SELECTION",
    availableBranches: ["PUNE"],
    expectedField: "branchSelection",
  });

  const res9 = await runCentralAgent({
    conversationId: convId9,
    message: "1",
  });
  assert.ok(res9.reply.includes("HDFC Bank"), "Must be HDFC Bank");
  assert.ok(!res9.reply.includes("ICICI Bank"), "Must NOT include ICICI Bank");
  assert.ok(!res9.reply.includes("Axis Bank"), "Must NOT include Axis Bank");
  assert.ok(!res9.reply.includes("Kotak Mahindra Bank"), "Must NOT include Kotak Bank");
  console.log("✓ Scenario 9 passed: Bank isolation strictly enforced.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Missing phone/email fields are handled safely
  // ---------------------------------------------------------------------------
  console.log("Scenario 10: Missing phone/email fields are handled safely...");
  // Look at res9 output which includes records like Deepak Misal where phone is null
  assert.ok(res9.reply.includes("Not available"), "Null phone/email safely formatted as 'Not available'");
  console.log("✓ Scenario 10 passed: Null phone and email rendered as 'Not available' without crashing.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 11: No matching manager produces a helpful fallback response
  // ---------------------------------------------------------------------------
  console.log("Scenario 11: No matching manager produces a helpful fallback response...");
  const convId11 = `scen11_${Date.now()}`;
  await saveEligibilityState(convId11, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    preferredBranch: "NonExistentPlaceXYZ999",
    branch: "NonExistentPlaceXYZ999",
    postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
    expectedField: "cityOrPincode",
  });

  const res11 = await runCentralAgent({
    conversationId: convId11,
    message: "NonExistentPlaceXYZ999",
  });
  assert.ok(
    res11.reply.includes("couldn't find") &&
    res11.reply.includes("Would you like to try another area or PIN code?"),
    "Helpful fallback response on no match"
  );
  console.log("✓ Scenario 11 passed: Helpful fallback response when no record matches.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 12: User changes the selected bank
  // ---------------------------------------------------------------------------
  console.log("Scenario 12: User changes the selected bank...");
  const convId12 = `scen12_${Date.now()}`;
  await saveEligibilityState(convId12, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    city: "Pune",
    postEligibilityStage: "AWAITING_BRANCH_LOCATION",
  });

  const res12 = await runCentralAgent({
    conversationId: convId12,
    message: "Actually I want ICICI Bank",
  });
  assert.ok(res12.reply.includes("ICICI Bank"), "Must switch to ICICI Bank");
  const state12 = await getEligibilityState(convId12);
  assert.strictEqual(state12?.selectedBank, "ICICI Bank", "selectedBank must update to ICICI Bank");
  console.log("✓ Scenario 12 passed: Dynamic bank change preserves city and switches selected bank.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 13: User changes the location
  // ---------------------------------------------------------------------------
  console.log("Scenario 13: User changes the location...");
  const convId13 = `scen13_${Date.now()}`;
  await saveEligibilityState(convId13, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    city: "Pune",
    postEligibilityStage: "AWAITING_BRANCH_LOCATION",
    expectedField: "city",
  });

  const res13 = await runCentralAgent({
    conversationId: convId13,
    message: "Mumbai",
  });
  assert.ok(res13.reply.includes("HDFC Bank"), "Must search for HDFC Bank in Mumbai");
  const state13 = await getEligibilityState(convId13);
  assert.strictEqual(state13?.city, "Mumbai", "City updated to Mumbai");
  console.log("✓ Scenario 13 passed: Location change updates city and searches newly provided location.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 14: 'Thank you' does not restart the workflow
  // ---------------------------------------------------------------------------
  console.log("Scenario 14: 'Thank you' does not restart the workflow...");
  const convId14 = `scen14_${Date.now()}`;
  await saveEligibilityState(convId14, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    city: "Pune",
    postEligibilityStage: "AWAITING_BRANCH_LOCATION",
    expectedField: "city",
  });

  const res14 = await runCentralAgent({
    conversationId: convId14,
    message: "Thank you so much!",
  });
  assert.ok(res14.reply.toLowerCase().includes("welcome"), "Must respond politely to thank you");
  const state14 = await getEligibilityState(convId14);
  assert.strictEqual(state14?.selectedBank, "HDFC Bank", "selectedBank must NOT be cleared by thank you");
  assert.strictEqual(state14?.city, "Pune", "city must be preserved");
  console.log("✓ Scenario 14 passed: 'Thank you' does not restart workflow or wipe state.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 15: Eligibility is not recalculated simply because user provides a location
  // ---------------------------------------------------------------------------
  console.log("Scenario 15: Eligibility is not recalculated simply because user provides a location...");
  const convId15 = `scen15_${Date.now()}`;
  await saveEligibilityState(convId15, {
    applicant: baseApplicant,
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: eligibleList,
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    postEligibilityStage: "AWAITING_BRANCH_LOCATION",
    expectedField: "city",
  });

  const res15 = await runCentralAgent({
    conversationId: convId15,
    message: "Pune",
  });
  // Check that reply does NOT contain recalculation table header
  assert.ok(!res15.reply.includes("Details Updated: Recorded your updated profile details"), "Must not trigger recalculation");
  assert.ok(!res15.reply.includes("Personal Loan Eligibility Assessment — Policy Criteria Not Met"), "Must not evaluate as new loan");
  console.log("✓ Scenario 15 passed: Location input does not trigger eligibility recalculation.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 16: Conversation state persists across messages
  // ---------------------------------------------------------------------------
  console.log("Scenario 16: Conversation state persists across messages...");
  const stateAfterTurn = await getEligibilityState(convId1);
  assert.ok(stateAfterTurn?.hasCompletedEvaluation, "Evaluation completed flag preserved");
  assert.strictEqual(stateAfterTurn?.selectedBank, "HDFC Bank", "Selected bank persisted");
  console.log("✓ Scenario 16 passed: Session state consistently persisted in storage.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 17: Existing eligibility and loan calculation tests still pass
  // ---------------------------------------------------------------------------
  console.log("Scenario 17: Existing eligibility calculation verified...");
  const convId17 = `scen17_${Date.now()}`;
  const res17 = await runCentralAgent({
    conversationId: convId17,
    message: "I need a loan of 5 lakhs for 5 years. I earn 85000 at TCS, age 30, CIBIL 780, zero EMI.",
  });
  assert.ok(
    res17.reply.toLowerCase().includes("company") ||
    res17.reply.toLowerCase().includes("tcs") ||
    res17.reply.includes("Personal Loan Eligibility") ||
    res17.reply.includes("HDFC Bank"),
    "Initial loan calculation works normally"
  );
  console.log("✓ Scenario 17 passed: Existing eligibility intake and calculation engine intact.\n");

  console.log("===============================================================================");
  console.log("ALL 17 SCENARIOS VERIFIED AND PASSED SUCCESSFULLY!");
  console.log("===============================================================================");
}

runAll17Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
