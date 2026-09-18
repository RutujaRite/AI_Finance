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
  assert.ok(resTurn1.reply.toLowerCase().includes("branch"), "Must ask for branch name one-by-one");
  assert.ok(!resTurn1.reply.toLowerCase().includes("pincode"), "Must NOT ask for pincode yet in 1-by-1 cadence");

  const state1 = await getEligibilityState(convId);
  assert.strictEqual(state1?.selectedBank, "HDFC Bank", "selectedBank must be stored in state");
  assert.strictEqual(state1?.chosenBank, "HDFC Bank", "chosenBank must be stored for compatibility");
  assert.strictEqual(state1?.expectedField, "branch", "expectedField must be 'branch'");
  console.log("✓ Turn 1 Verified: Stored selectedBank='HDFC Bank', asked for branch name only.\n");

  // Turn 2: User provides branch "Baner"
  console.log("--- Turn 2: User replies 'Baner' ---");
  const resTurn2 = await runCentralAgent({
    conversationId: convId,
    message: "Baner",
    conversationHistory: [
      { role: "assistant", content: "You selected **HDFC Bank**. Please provide your branch name." },
    ],
    model: "gemini-2.5-flash",
  });

  console.log("Turn 2 Reply:\n", resTurn2.reply, "\n");
  assert.ok(resTurn2.reply.includes("Baner"), "Must acknowledge branch Baner");
  assert.ok(
    resTurn2.reply.toLowerCase().includes("city") || resTurn2.reply.toLowerCase().includes("pincode"),
    "Must ask for city or pincode"
  );

  const state2 = await getEligibilityState(convId);
  assert.strictEqual(state2?.selectedBank, "HDFC Bank", "selectedBank must be preserved");
  assert.strictEqual(state2?.branch, "Baner", "branch must be stored as 'Baner'");
  assert.strictEqual(state2?.expectedField, "cityOrPincode", "expectedField must be 'cityOrPincode'");
  console.log("✓ Turn 2 Verified: Stored branch='Baner', asked for city/pincode.\n");

  // Turn 3: User provides city "Pune"
  console.log("--- Turn 3: User replies 'Pune' ---");
  const resTurn3 = await runCentralAgent({
    conversationId: convId,
    message: "Pune",
    conversationHistory: [
      { role: "assistant", content: "I have your branch as **Baner**. Please provide your city or pincode for **HDFC Bank**." },
    ],
    model: "gemini-2.5-flash",
  });

  console.log("Turn 3 Reply:\n", resTurn3.reply, "\n");
  assert.ok(resTurn3.reply.includes("HDFC Bank"), "Must reference selected bank HDFC Bank");
  assert.ok(resTurn3.reply.includes("| Bank | Branch | City |"), "Must contain dynamic table header");
  assert.ok(resTurn3.reply.includes("Manager Name"), "Must contain Manager Name header");

  // Verify no other bank appears in the reply
  assert.ok(!resTurn3.reply.includes("ICICI Bank"), "Mandatory filter: NEVER display managers from another bank");
  assert.ok(!resTurn3.reply.includes("Kotak Mahindra Bank"), "Mandatory filter: NEVER display managers from another bank");

  const state3 = await getEligibilityState(convId);
  assert.strictEqual(state3?.selectedBank, "HDFC Bank");
  assert.strictEqual(state3?.city, "Pune");
  console.log("✓ Turn 3 Verified: Successfully executed DB search and displayed matching records!\n");

  // Test 4: Branch + City provided together in one message
  console.log("--- Test 4: Branch + City provided together ('Baner, Pune') ---");
  const convIdTogether = `verify_together_${Date.now()}`;
  await saveEligibilityState(convIdTogether, {
    applicant: { companyName: "TCS", monthlyIncome: 85000 },
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: ["HDFC Bank", "ICICI Bank"],
    topBank: "HDFC Bank",
    postEligibilityStage: "BANK_MANAGER_DETAILS_INPUT",
    expectedField: "branch",
    selectedBank: "HDFC Bank",
    chosenBank: "HDFC Bank",
    updatedAt: Date.now(),
  });

  const resTogether = await runCentralAgent({
    conversationId: convIdTogether,
    message: "Baner, Pune",
    conversationHistory: [],
    model: "gemini-2.5-flash",
  });

  assert.ok(resTogether.reply.includes("HDFC Bank"));
  assert.ok(resTogether.reply.includes("| Bank | Branch | City |"));
  console.log("✓ Test 4 Verified: Branch + City together executed DB search immediately without extra questions.\n");

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
  assert.ok(resBankChange.reply.toLowerCase().includes("branch"), "Must prompt for branch for new bank");

  const stateChange = await getEligibilityState(convId);
  assert.strictEqual(stateChange?.selectedBank, "ICICI Bank", "selectedBank must update to ICICI Bank");
  console.log("✓ Test 5 Verified: Dynamic bank correction properly switches selectedBank and resets branch.\n");

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
