// scripts/test-generic-nlu-loan-flow.ts

import assert from "assert";
import {
  extractBankBranchLocationParams,
  extractTypedLoanEntities,
  isConfirmationResponse,
  resolveBankName,
  updateNormalizedLoanState,
} from "../lib/dynamicEligibilityEngine";
import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, saveEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("===============================================================");
  console.log("TESTING GENERIC NLU / ENTITY EXTRACTION & LOAN FLOW STATE RULES");
  console.log("===============================================================\n");

  // -------------------------------------------------------------
  // Test 1: "pune is my location" -> CITY=Pune (no "Is my, Pune")
  // -------------------------------------------------------------
  console.log("--- Test 1: 'pune is my location' ---");
  const loc1 = extractBankBranchLocationParams("pune is my location");
  console.log("Extracted:", loc1);
  assert.strictEqual(loc1.city, "Pune", "City must be Pune");
  assert.strictEqual(loc1.branch, undefined, "Branch must not be 'Is my'");
  assert.strictEqual(loc1.location, "Pune", "Location must not contain filler");

  const typed1 = extractTypedLoanEntities("pune is my location");
  assert.strictEqual(typed1.CITY, "Pune", "Typed CITY must be Pune");
  assert.strictEqual(typed1.BRANCH, undefined, "Typed BRANCH must be undefined");
  console.log("✓ Test 1 Passed: 'pune is my location' -> CITY=Pune\n");

  // -------------------------------------------------------------
  // Test 1b: Other natural language location forms
  // -------------------------------------------------------------
  console.log("--- Test 1b: Natural language location variants ---");
  const loc1b_1 = extractBankBranchLocationParams("my location is Pune");
  assert.strictEqual(loc1b_1.city, "Pune");
  assert.strictEqual(loc1b_1.branch, undefined);

  const loc1b_2 = extractBankBranchLocationParams("I am in Pune");
  assert.strictEqual(loc1b_2.city, "Pune");
  assert.strictEqual(loc1b_2.branch, undefined);

  const loc1b_3 = extractBankBranchLocationParams("I live in Pune");
  assert.strictEqual(loc1b_3.city, "Pune");
  assert.strictEqual(loc1b_3.branch, undefined);

  const loc1b_4 = extractBankBranchLocationParams("from Pune");
  assert.strictEqual(loc1b_4.city, "Pune");
  assert.strictEqual(loc1b_4.branch, undefined);
  console.log("✓ Test 1b Passed: All natural language location phrases extract only city without filler.\n");

  // -------------------------------------------------------------
  // Test 2: "HDFC bank" -> BANK=HDFC Bank (Never location/city/branch)
  // -------------------------------------------------------------
  console.log("--- Test 2: 'HDFC bank' ---");
  const loc2 = extractBankBranchLocationParams("HDFC bank");
  console.log("Extracted:", loc2);
  assert.strictEqual(loc2.bankName, "HDFC Bank", "Bank must be HDFC Bank");
  assert.strictEqual(loc2.city, undefined, "Bank must never become city");
  assert.strictEqual(loc2.branch, undefined, "Bank must never become branch");
  assert.strictEqual(loc2.location, undefined, "Bank must never become location");

  const typed2 = extractTypedLoanEntities("HDFC bank");
  assert.strictEqual(typed2.BANK, "HDFC Bank", "Typed entity BANK must be HDFC Bank");
  assert.strictEqual(typed2.CITY, undefined, "Typed CITY must be undefined");
  assert.strictEqual(typed2.BRANCH, undefined, "Typed BRANCH must be undefined");
  console.log("✓ Test 2 Passed: 'HDFC bank' -> BANK=HDFC Bank, never location\n");

  // -------------------------------------------------------------
  // Test 2b: "ICICI" -> BANK=ICICI Bank
  // -------------------------------------------------------------
  console.log("--- Test 2b: Dynamic bank 'ICICI' ---");
  const typed2b = extractTypedLoanEntities("ICICI");
  assert.strictEqual(typed2b.BANK, "ICICI Bank", "Typed entity BANK must resolve ICICI Bank");
  assert.strictEqual(typed2b.CITY, undefined);
  console.log("✓ Test 2b Passed: 'ICICI' -> BANK=ICICI Bank\n");

  // -------------------------------------------------------------
  // Test 3: "swarget" -> BRANCH/LOCATION=Swarget
  // -------------------------------------------------------------
  console.log("--- Test 3: 'swarget' ---");
  const loc3 = extractBankBranchLocationParams("swarget");
  console.log("Extracted:", loc3);
  assert.strictEqual(loc3.branch, "Swarget", "Branch must be Swarget");
  assert.strictEqual(loc3.location, "Swarget", "Location must be Swarget");

  const typed3 = extractTypedLoanEntities("swarget");
  assert.strictEqual(typed3.BRANCH, "Swarget");
  console.log("✓ Test 3 Passed: 'swarget' -> BRANCH/LOCATION=Swarget\n");

  // -------------------------------------------------------------
  // Test 4: "yes" -> CONFIRMATION=true (Never location/branch/bank)
  // -------------------------------------------------------------
  console.log("--- Test 4: 'yes' -> CONFIRMATION=true ---");
  const conf4 = isConfirmationResponse("yes");
  assert.strictEqual(conf4.isConfirmation, true);
  assert.strictEqual(conf4.value, true);

  const loc4 = extractBankBranchLocationParams("yes");
  assert.strictEqual(loc4.branch, undefined, "Confirmation 'yes' must NEVER become branch");
  assert.strictEqual(loc4.city, undefined, "Confirmation 'yes' must NEVER become city");
  assert.strictEqual(loc4.location, undefined, "Confirmation 'yes' must NEVER become location");

  const typed4 = extractTypedLoanEntities("yes");
  assert.strictEqual(typed4.CONFIRMATION, true);
  assert.strictEqual(typed4.CITY, undefined);
  assert.strictEqual(typed4.BRANCH, undefined);

  // Negative confirmation
  const conf4_neg = isConfirmationResponse("no");
  assert.strictEqual(conf4_neg.isConfirmation, true);
  assert.strictEqual(conf4_neg.value, false);
  console.log("✓ Test 4 Passed: 'yes' -> CONFIRMATION=true, never branch or location\n");

  // -------------------------------------------------------------
  // Test 5: "800000" -> LOAN_AMOUNT=800000 when loan amount expected
  // -------------------------------------------------------------
  console.log("--- Test 5: '800000' -> LOAN_AMOUNT=800000 ---");
  const typed5 = extractTypedLoanEntities("800000", "loanAmount");
  console.log("Extracted:", typed5);
  assert.strictEqual(typed5.LOAN_AMOUNT, 800000, "Loan amount must be 800000");
  assert.strictEqual(typed5.PINCODE, undefined, "800000 must NEVER become pincode");
  assert.strictEqual(typed5.CITY, undefined, "800000 must NEVER become city");
  assert.strictEqual(typed5.BRANCH, undefined, "800000 must NEVER become branch");
  console.log("✓ Test 5 Passed: '800000' -> LOAN_AMOUNT=800000, never pincode or location\n");

  // -------------------------------------------------------------
  // Test 6: "760" -> CIBIL=760 when CIBIL expected
  // -------------------------------------------------------------
  console.log("--- Test 6: '760' -> CIBIL=760 ---");
  const typed6 = extractTypedLoanEntities("760", "cibil");
  console.log("Extracted:", typed6);
  assert.strictEqual(typed6.CIBIL, 760, "CIBIL must be 760");
  assert.strictEqual(typed6.CITY, undefined);
  assert.strictEqual(typed6.BRANCH, undefined);
  console.log("✓ Test 6 Passed: '760' -> CIBIL=760\n");

  // -------------------------------------------------------------
  // Test 7: "23 age" -> AGE=23 when age expected
  // -------------------------------------------------------------
  console.log("--- Test 7: '23 age' -> AGE=23 ---");
  const typed7 = extractTypedLoanEntities("23 age", "age");
  console.log("Extracted:", typed7);
  assert.strictEqual(typed7.AGE, 23, "Age must be 23");
  assert.strictEqual(typed7.BRANCH, undefined, "'age' must NEVER become branch");
  assert.strictEqual(typed7.COMPANY, undefined, "'23 age' must NEVER become company");
  console.log("✓ Test 7 Passed: '23 age' -> AGE=23, never branch or company\n");

  // -------------------------------------------------------------
  // Test 8: End-to-end multi-turn conversation state preservation
  // Turn 1: Gold Loan 600000 over 12 months
  // Turn 2: "pune is my location"
  // Turn 3: "swarget"
  // Turn 4: "HDFC bank"
  // Turn 5: "yes"
  // -------------------------------------------------------------
  console.log("--- Test 8: Multi-turn State Preservation Flow ---");
  const convId = `test_loan_flow_${Date.now()}`;

  // Seed state at Turn 1
  await saveEligibilityState(convId, {
    applicant: {
      loanAmount: 600000,
      tenureMonths: 12,
      employmentStatus: "unemployed",
      employmentType: "Unemployed",
    },
    loanType: "GOLD_LOAN",
    missingFields: [],
    in_eligibility_flow: false,
    currentStep: "LOCATION_COLLECTION",
    expectedEntity: "city",
    updatedAt: Date.now(),
  });

  // Turn 2: User says "pune is my location"
  console.log("-> Turn 2: 'pune is my location'");
  const resTurn2 = await runCentralAgent({
    conversationId: convId,
    message: "pune is my location",
    conversationHistory: [
      { role: "assistant", content: "To help connect you with the right branch and explore the best offers, could you let me know which city you're located in?" },
    ],
    model: "gemini-2.5-flash",
  });
  console.log("Turn 2 Reply:\n", resTurn2.reply, "\n");

  const stateTurn2 = await getEligibilityState(convId);
  console.log("State after Turn 2:", stateTurn2);
  assert.strictEqual(stateTurn2?.city, "Pune", "City must be Pune");
  assert.strictEqual(stateTurn2?.branch, undefined, "Branch must not be set");
  assert.strictEqual(stateTurn2?.applicant.loanAmount, 600000, "loanAmount 600000 preserved");
  assert.strictEqual(stateTurn2?.applicant.tenureMonths, 12, "tenureMonths 12 preserved");

  // Turn 3: User says "swarget"
  console.log("-> Turn 3: 'swarget'");
  const resTurn3 = await runCentralAgent({
    conversationId: convId,
    message: "swarget",
    conversationHistory: [
      { role: "assistant", content: resTurn2.reply },
    ],
    model: "gemini-2.5-flash",
  });
  console.log("Turn 3 Reply:\n", resTurn3.reply, "\n");

  const stateTurn3 = await getEligibilityState(convId);
  console.log("State after Turn 3:", stateTurn3);
  assert.strictEqual(stateTurn3?.preferredBranch, "Swarget", "preferredBranch must be Swarget");
  assert.strictEqual(stateTurn3?.city, "Pune", "City Pune preserved");
  assert.strictEqual(stateTurn3?.applicant.loanAmount, 600000, "loanAmount preserved");
  assert.strictEqual(stateTurn3?.applicant.tenureMonths, 12, "tenure preserved");

  // Turn 4: User says "HDFC bank"
  console.log("-> Turn 4: 'HDFC bank'");
  const resTurn4 = await runCentralAgent({
    conversationId: convId,
    message: "HDFC bank",
    conversationHistory: [
      { role: "assistant", content: resTurn3.reply },
    ],
    model: "gemini-2.5-flash",
  });
  console.log("Turn 4 Reply:\n", resTurn4.reply, "\n");

  const stateTurn4 = await getEligibilityState(convId);
  console.log("State after Turn 4:", stateTurn4);
  assert.strictEqual(stateTurn4?.selectedBank, "HDFC Bank", "selectedBank must be HDFC Bank");
  assert.strictEqual(stateTurn4?.preferredBranch, "Swarget", "preferredBranch must remain Swarget");
  assert.strictEqual(stateTurn4?.city, "Pune", "city must remain Pune");
  assert.notStrictEqual(stateTurn4?.city, "HDFC", "city must NEVER become HDFC");
  assert.notStrictEqual(stateTurn4?.preferredBranch, "HDFC", "branch must NEVER become HDFC");

  // Turn 5: User says "yes"
  console.log("-> Turn 5: 'yes'");
  const resTurn5 = await runCentralAgent({
    conversationId: convId,
    message: "yes",
    conversationHistory: [
      { role: "assistant", content: resTurn4.reply },
    ],
    model: "gemini-2.5-flash",
  });
  console.log("Turn 5 Reply:\n", resTurn5.reply, "\n");

  const stateTurn5 = await getEligibilityState(convId);
  console.log("State after Turn 5:", stateTurn5);
  assert.strictEqual(stateTurn5?.confirmation, true, "confirmation must be true");
  assert.strictEqual(stateTurn5?.selectedBank, "HDFC Bank", "selectedBank preserved as HDFC Bank");
  assert.strictEqual(stateTurn5?.preferredBranch, "Swarget", "preferredBranch preserved as Swarget");
  assert.strictEqual(stateTurn5?.city, "Pune", "city preserved as Pune");
  assert.strictEqual(stateTurn5?.applicant.loanAmount, 600000, "loanAmount preserved as 600000");
  assert.strictEqual(stateTurn5?.applicant.tenureMonths, 12, "tenureMonths preserved as 12");
  assert.notStrictEqual(stateTurn5?.city, "Yes", "city must NEVER become Yes");
  assert.notStrictEqual(stateTurn5?.preferredBranch, "Yes", "branch must NEVER become Yes");
  assert.ok(resTurn5.reply.includes("HDFC Bank"), "Final reply must confirm HDFC Bank");
  console.log("✓ Test 8 Passed: Full 5-turn loan flow preserves all state values without corruption!\n");

  console.log("===============================================================");
  console.log("ALL GENERIC NLU AND LOAN FLOW TESTS COMPLETED SUCCESSFULLY!");
  console.log("===============================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
