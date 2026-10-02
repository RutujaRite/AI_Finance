// scripts/verify-bank-manager-flow.ts

import assert from "assert";
import { runCentralAgent } from "@/lib/ai/agent";
import { getEligibilityState, saveEligibilityState } from "@/lib/dynamicEligibilityEngine";

async function runVerification() {
  console.log("=======================================================");
  console.log("VERIFYING FINAL BANK MANAGER FLOW AFTER ELIGIBILITY");
  console.log("=======================================================\n");

  const convId = `verify_bm_flow_${Date.now()}`;

  // 1. Initial State: Eligibility evaluation completed
  await saveEligibilityState(convId, {
    applicant: {
      companyName: "Tata Consultancy Services",
      monthlyIncome: 85000,
      loanAmount: 500000,
      tenureMonths: 60,
      cibil: 780,
      age: 30,
      existingEmi: 0,
    },
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: ["HDFC Bank", "ICICI Bank", "IDFC FIRST Bank", "Kotak Mahindra Bank"],
    topBank: "IDFC FIRST Bank",
    postEligibilityStage: "ELIGIBILITY_CONFIRMED",
    expectedField: "selectedBank",
    selectedBank: "",
    chosenBank: "",
    updatedAt: Date.now(),
  });

  // Turn 1: User selects "HDFC Bank"
  console.log("--- Turn 1: User selects 'HDFC Bank' ---");
  const resTurn1 = await runCentralAgent({
    conversationId: convId,
    message: "HDFC Bank",
    conversationHistory: [
      { role: "assistant", content: "Please select ONE bank from your eligible list above to proceed with connecting to an official branch manager." },
    ],
    model: "gemini-2.5-flash",
  });

  console.log("Turn 1 Reply:\n", resTurn1.reply, "\n");
  assert.ok(resTurn1.reply.includes("HDFC Bank"), "Must acknowledge HDFC Bank");
  assert.ok(resTurn1.reply.toLowerCase().includes("city"), "Must ask for city");

  const state1 = await getEligibilityState(convId);
  assert.strictEqual(state1?.selectedBank, "HDFC Bank", "selectedBank must be stored in state");
  assert.strictEqual(state1?.chosenBank, "HDFC Bank", "chosenBank must be stored for compatibility");
  assert.strictEqual(state1?.expectedField, "city", "expectedField must be 'city'");
  console.log("✓ Turn 1 Verified: Stored selectedBank='HDFC Bank', asked for city.\n");

  // Turn 2: User provides city "Pune"
  console.log("--- Turn 2: User replies 'Pune' ---");
  const resTurn2 = await runCentralAgent({
    conversationId: convId,
    message: "Pune",
    conversationHistory: [
      { role: "assistant", content: "You selected **HDFC Bank**. Please provide your city." },
    ],
    model: "gemini-2.5-flash",
  });

  console.log("Turn 2 Reply:\n", resTurn2.reply, "\n");
  assert.ok(
    resTurn2.reply.includes("Available HDFC Bank branches in Pune") || resTurn2.reply.includes("Please select a branch"),
    "Must search database and show available branches in Pune"
  );

  const state2 = await getEligibilityState(convId);
  assert.strictEqual(state2?.selectedBank, "HDFC Bank", "selectedBank must be preserved");
  assert.strictEqual(state2?.city, "Pune", "city must be stored as 'Pune'");
  console.log("✓ Turn 2 Verified: Stored city='Pune', listed available branches.\n");

  // Turn 3: User selects branch "1"
  console.log("--- Turn 3: User replies '1' ---");
  const resTurn3 = await runCentralAgent({
    conversationId: convId,
    message: "1",
    conversationHistory: [],
    model: "gemini-2.5-flash",
  });

  console.log("Turn 3 Reply:\n", resTurn3.reply, "\n");
  assert.ok(resTurn3.reply.includes("HDFC Bank"), "Must reference selected bank HDFC Bank");
  assert.ok(resTurn3.reply.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"), "Must contain 6-column table header");
  assert.ok(resTurn3.reply.includes("Manager Name"), "Must contain Manager Name header");

  // Verify no other bank appears in the reply
  assert.ok(!resTurn3.reply.includes("ICICI Bank"), "Mandatory filter: NEVER display managers from another bank");
  assert.ok(!resTurn3.reply.includes("Kotak Mahindra Bank"), "Mandatory filter: NEVER display managers from another bank");

  const state3 = await getEligibilityState(convId);
  assert.strictEqual(state3?.selectedBank, "HDFC Bank");
  assert.strictEqual(state3?.city, "Pune");
  console.log("✓ Turn 3 Verified: Successfully executed DB search and displayed matching records!\n");

  // Test 4: Discovery request: "What branches are available?" and selecting '1' displays table
  console.log("--- Test 4: Discovery request shows available locations and selecting '1' displays table ---");
  const convIdTogether = `verify_together_${Date.now()}`;
  await saveEligibilityState(convIdTogether, {
    applicant: { companyName: "TCS", monthlyIncome: 85000 },
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: ["HDFC Bank", "ICICI Bank"],
    topBank: "HDFC Bank",
    postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
    expectedField: "cityOrPincode",
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    city: "Pune",
    updatedAt: Date.now(),
  });

  const resCity = await runCentralAgent({
    conversationId: convIdTogether,
    message: "What branches are available?",
    conversationHistory: [],
    model: "gemini-2.5-flash",
  });

  assert.ok(resCity.reply.includes("HDFC Bank"));
  assert.ok(resCity.reply.includes("Available HDFC Bank branches in Pune") || resCity.reply.includes("Available **HDFC Bank** branches in Pune"));
  assert.ok(resCity.reply.includes("1. **PUNE**"));

  const resSelect = await runCentralAgent({
    conversationId: convIdTogether,
    message: "1",
    conversationHistory: [],
    model: "gemini-2.5-flash",
  });

  assert.ok(resSelect.reply.includes("HDFC Bank"));
  assert.ok(resSelect.reply.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"));
  console.log("✓ Test 4 Verified: Discovery request -> shows available locations -> selecting 1 displays manager directory.\n");

  // Test 5: Changing selected bank dynamically
  console.log("--- Test 5: Dynamic bank change to 'ICICI Bank' ---");
  const resBankChange = await runCentralAgent({
    conversationId: convId,
    message: "Actually I want ICICI Bank",
    conversationHistory: [],
    model: "gemini-2.5-flash",
  });

  console.log("Bank Change Reply:\n", resBankChange.reply, "\n");
  assert.ok(resBankChange.reply.includes("ICICI Bank"), "Must update to ICICI Bank");
  assert.ok(
    resBankChange.reply.includes("Available ICICI Bank branches in Pune") ||
    resBankChange.reply.includes("| Bank | Branch | City |") ||
    resBankChange.reply.toLowerCase().includes("city or pincode"),
    "Must preserve known city or display managers for known location"
  );

  const stateChange = await getEligibilityState(convId);
  assert.strictEqual(stateChange?.selectedBank, "ICICI Bank", "selectedBank must update to ICICI Bank");
  console.log("✓ Test 5 Verified: Dynamic bank correction properly switches selectedBank and shows locations for known city.\n");

  // Test 6: Verify Swarget (0 DB records) does NOT cause automatic fallback to All Maharashtra
  console.log("--- Test 6: preferredBranch='Swarget' with 0 matches never causes automatic fallback to All Maharashtra ---");
  const convIdSwarget = `verify_swarget_${Date.now()}`;
  await saveEligibilityState(convIdSwarget, {
    applicant: { companyName: "TCS", monthlyIncome: 85000, loanAmount: 800000 },
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: ["ICICI Bank"],
    topBank: "ICICI Bank",
    postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
    expectedField: "cityOrPincode",
    selectedBank: "ICICI Bank",
    chosenBank: "ICICI Bank",
    preferredBranch: "Swarget",
    branch: "Swarget",
    updatedAt: Date.now(),
  });

  const resSwarget = await runCentralAgent({
    conversationId: convIdSwarget,
    message: "Pune",
    conversationHistory: [
      { role: "assistant", content: "I have your branch as **Swarget**. Please provide your city or pincode for **ICICI Bank**." },
    ],
    model: "gemini-2.5-flash",
  });

  console.log("Swarget Reply:\n", resSwarget.reply, "\n");
  assert.ok(
    resSwarget.reply.includes("couldn't find an exact") ||
    resSwarget.reply.includes("couldn't find an official") ||
    resSwarget.reply.includes("couldn't find an ICICI Bank manager record") ||
    resSwarget.reply.includes("No matching or exact") ||
    resSwarget.reply.includes("no exact bank manager records were found"),
    "Must inform user no exact records found"
  );
  assert.ok(!resSwarget.reply.includes("All Maharashtra"), "Must NEVER fall back to All Maharashtra");
  assert.ok(!resSwarget.reply.includes("rest of pune+Mumbai"), "Must NEVER fall back to broad regional records");
  assert.ok(!resSwarget.reply.includes("800000"), "loanAmount=800000 must NEVER become location/pincode 800000");

  const stateSwarget = await getEligibilityState(convIdSwarget);
  assert.strictEqual(stateSwarget?.pincode, undefined, "loanAmount=800000 must not become pincode");
  assert.notStrictEqual(stateSwarget?.location, "800000", "location must not be 800000");
  assert.strictEqual(stateSwarget?.preferredBranch, "Swarget", "preferredBranch must remain Swarget");
  console.log("✓ Test 6 Verified: 'Swarget' does NOT fall back to 'All Maharashtra', loanAmount 800000 is preserved without becoming location.\n");

  console.log("=======================================================");
  console.log("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!");
  console.log("=======================================================");
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
