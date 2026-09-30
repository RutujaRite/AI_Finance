import {
  analyzeConversationSemanticIntent,
  fallbackMultidimensionalNluParser,
  StructuredNluResult,
  NluContext,
} from "../lib/ai/intentClassifier";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error("     Details:", JSON.stringify(details, null, 2));
  }
}

async function runNluTests() {
  console.log("=== RUNNING STANDALONE NLU TEST SUITE ===\n");

  // TEST 1: Side-question during CIBIL collection - "Which documents are required for HDFC?"
  console.log("Test 1: Side-question interruption - HDFC documents");
  const ctx1: NluContext = { isFlowActive: true, expectedField: "cibil", activeFlow: "LOAN_ELIGIBILITY" };
  const res1 = fallbackMultidimensionalNluParser("Which documents are required for HDFC?", ctx1);
  assert(res1.messageType === "QUESTION", "Test 1.1: messageType is QUESTION", res1);
  assert(res1.primaryIntent === "BANK_DOCUMENT_REQUIREMENTS", "Test 1.2: primaryIntent is BANK_DOCUMENT_REQUIREMENTS", res1);
  assert(res1.targetBank === "HDFC Bank", "Test 1.3: targetBank is HDFC Bank", res1);
  assert(res1.conversationAction === "TEMPORARY_INTERRUPT", "Test 1.4: conversationAction is TEMPORARY_INTERRUPT", res1);
  assert(res1.entities.cibil === undefined, "Test 1.5: entities.cibil is NOT set", res1);
  assert(Object.keys(res1.entities).length === 0, "Test 1.6: QUESTION ≠ ENTITY UPDATE (entities empty)", res1.entities);

  // TEST 2: Side-question during loan flow - "What is FOIR?"
  console.log("\nTest 2: Conceptual question - What is FOIR?");
  const ctx2: NluContext = { isFlowActive: true, expectedField: "monthlyIncome", activeFlow: "LOAN_ELIGIBILITY" };
  const res2 = fallbackMultidimensionalNluParser("What is FOIR?", ctx2);
  assert(res2.messageType === "QUESTION", "Test 2.1: messageType is QUESTION", res2);
  assert(res2.primaryIntent === "CONCEPTUAL_FINANCIAL_QUESTION", "Test 2.2: primaryIntent is CONCEPTUAL_FINANCIAL_QUESTION", res2);
  assert(res2.questionTopic === "FOIR", "Test 2.3: questionTopic is FOIR", res2);
  assert(res2.conversationAction === "TEMPORARY_INTERRUPT", "Test 2.4: conversationAction is TEMPORARY_INTERRUPT", res2);
  assert(res2.entities.monthlyIncome === undefined, "Test 2.5: entities.monthlyIncome is NOT set", res2);

  // TEST 3: Correction - "My salary is 45k, not 39k"
  console.log("\nTest 3: Entity correction - Salary correction");
  const ctx3: NluContext = { isFlowActive: true, expectedField: "cibil", existingApplicant: { monthlyIncome: 39000 } };
  const res3 = fallbackMultidimensionalNluParser("My salary is 45k, not 39k", ctx3);
  assert(res3.conversationAction === "CORRECTION", "Test 3.1: conversationAction is CORRECTION", res3);
  assert(res3.entities.monthlyIncome === 45000, "Test 3.2: entities.monthlyIncome is 45000", res3);
  assert(res3.corrections.length > 0, "Test 3.3: corrections array populated", res3.corrections);
  assert(res3.corrections[0]?.field === "monthlyIncome", "Test 3.4: correction field is monthlyIncome", res3.corrections);
  assert(res3.corrections[0]?.newValue === 45000, "Test 3.5: correction newValue is 45000", res3.corrections);
  assert(res3.corrections[0]?.oldValue === 39000, "Test 3.6: correction oldValue is 39000", res3.corrections);

  // TEST 4: EMI switch - "I changed my mind, calculate EMI instead."
  console.log("\nTest 4: Topic switch to EMI");
  const ctx4: NluContext = { isFlowActive: true, expectedField: "monthlyIncome", activeFlow: "LOAN_ELIGIBILITY" };
  const res4 = fallbackMultidimensionalNluParser("I changed my mind, calculate EMI instead.", ctx4);
  assert(res4.conversationAction === "TOPIC_SWITCH", "Test 4.1: conversationAction is TOPIC_SWITCH", res4);
  assert(res4.primaryIntent === "EMI_CALCULATION", "Test 4.2: primaryIntent is EMI_CALCULATION", res4);
  assert(res4.mainUserGoal === "EMI_CALCULATION", "Test 4.3: mainUserGoal is EMI_CALCULATION", res4);
  assert(res4.entities.monthlyIncome === undefined, "Test 4.4: salary not reused as EMI principal", res4.entities);

  // TEST 5: Company switch - "Forget the loan, show TCS details."
  console.log("\nTest 5: Topic switch to Company Search");
  const ctx5: NluContext = { isFlowActive: true, expectedField: "cibil", activeFlow: "LOAN_ELIGIBILITY" };
  const res5 = fallbackMultidimensionalNluParser("Forget the loan, show TCS details.", ctx5);
  assert(res5.conversationAction === "TOPIC_SWITCH", "Test 5.1: conversationAction is TOPIC_SWITCH", res5);
  assert(res5.primaryIntent === "COMPANY_SEARCH", "Test 5.2: primaryIntent is COMPANY_SEARCH", res5);
  assert(res5.mainUserGoal === "COMPANY_SEARCH", "Test 5.3: mainUserGoal is COMPANY_SEARCH", res5);
  assert(res5.entities.companyName === "TCS", "Test 5.4: extracted companyName is TCS", res5.entities);

  // TEST 6: CIBIL valid answer - "750"
  console.log("\nTest 6: Valid CIBIL score 750");
  const ctx6: NluContext = { isFlowActive: true, expectedField: "cibil", activeFlow: "LOAN_ELIGIBILITY" };
  const res6 = fallbackMultidimensionalNluParser("750", ctx6);
  assert(res6.entities.cibil === 750, "Test 6.1: entities.cibil is 750", res6);
  assert(res6.conversationAction === "CONTINUE", "Test 6.2: conversationAction is CONTINUE", res6);
  assert(res6.clarificationRequired === undefined, "Test 6.3: No clarification required", res6);

  // TEST 7: Invalid CIBIL - "76" while CIBIL expected
  console.log("\nTest 7: The '76' Principle - Invalid CIBIL");
  const ctx7: NluContext = { isFlowActive: true, expectedField: "cibil", activeFlow: "LOAN_ELIGIBILITY" };
  const res7 = fallbackMultidimensionalNluParser("76", ctx7);
  assert(res7.entities.cibil === undefined, "Test 7.1: 76 NOT saved as CIBIL", res7);
  assert(res7.entities.age === undefined, "Test 7.2: 76 NOT saved as Age", res7);
  assert(res7.clarificationRequired?.isAmbiguous === true, "Test 7.3: Ambiguity detected", res7.clarificationRequired);
  assert(Boolean(res7.clarificationRequired?.clarificationPrompt), "Test 7.4: Clarification prompt provided", res7.clarificationRequired);

  // TEST 8: "76" while loanAmount expected
  console.log("\nTest 8: The '76' Principle - Ambiguous loanAmount");
  const ctx8: NluContext = { isFlowActive: true, expectedField: "loanAmount", activeFlow: "LOAN_ELIGIBILITY" };
  const res8 = fallbackMultidimensionalNluParser("76", ctx8);
  assert(res8.entities.loanAmount === undefined, "Test 8.1: 76 NOT auto-converted to 76k or 76L", res8);
  assert(res8.clarificationRequired?.isAmbiguous === true, "Test 8.2: Ambiguity detected", res8.clarificationRequired);

  // TEST 9: "76" while monthlyIncome expected
  console.log("\nTest 9: The '76' Principle - Ambiguous monthlyIncome");
  const ctx9: NluContext = { isFlowActive: true, expectedField: "monthlyIncome", activeFlow: "LOAN_ELIGIBILITY" };
  const res9 = fallbackMultidimensionalNluParser("76", ctx9);
  assert(res9.entities.monthlyIncome === undefined, "Test 9.1: 76 NOT auto-converted to 76k", res9);
  assert(res9.clarificationRequired?.isAmbiguous === true, "Test 9.2: Ambiguity detected", res9.clarificationRequired);

  // TEST 10: "76" unanchored
  console.log("\nTest 10: The '76' Principle - Unanchored 76");
  const res10 = fallbackMultidimensionalNluParser("76");
  assert(res10.clarificationRequired?.isAmbiguous === true, "Test 10.1: Ambiguity detected for unanchored 76", res10.clarificationRequired);
  assert(res10.entities.age === undefined, "Test 10.2: Age NOT guessed", res10.entities);

  // TEST 11: Question containing numbers - "What salary is required for a 5 lakh loan?"
  console.log("\nTest 11: Question with numbers - What salary is required for a 5 lakh loan?");
  const ctx11: NluContext = { isFlowActive: true, expectedField: "loanAmount", activeFlow: "LOAN_ELIGIBILITY" };
  const res11 = fallbackMultidimensionalNluParser("What salary is required for a 5 lakh loan?", ctx11);
  assert(res11.messageType === "QUESTION", "Test 11.1: messageType is QUESTION", res11);
  assert(res11.entities.loanAmount === undefined, "Test 11.2: loanAmount NOT extracted as applicant state", res11.entities);
  assert(res11.entities.monthlyIncome === undefined, "Test 11.3: monthlyIncome NOT extracted", res11.entities);

  // TEST 12: Multi-entity extraction - "I need 8 lakh for 5 years, salary is 40k and CIBIL is 760."
  console.log("\nTest 12: Multi-entity extraction");
  const res12 = fallbackMultidimensionalNluParser("I need 8 lakh for 5 years, salary is 40k and CIBIL is 760.");
  assert(res12.entities.loanAmount === 800000, "Test 12.1: loanAmount is 800000", res12.entities);
  assert(res12.entities.tenureMonths === 60, "Test 12.2: tenureMonths is 60 (5 years)", res12.entities);
  assert(res12.entities.monthlyIncome === 40000, "Test 12.3: monthlyIncome is 40000", res12.entities);
  assert(res12.entities.cibil === 760, "Test 12.4: cibil is 760", res12.entities);
  assert(res12.primaryIntent === "LOAN_ELIGIBILITY", "Test 12.5: primaryIntent is LOAN_ELIGIBILITY", res12);

  // TEST 13: Conversation Controls - resume & reset
  console.log("\nTest 13: Conversation controls - resume & reset");
  const res13a = fallbackMultidimensionalNluParser("resume");
  assert(res13a.conversationAction === "RESUME", "Test 13.1: 'resume' maps to RESUME action", res13a);

  const res13b = fallbackMultidimensionalNluParser("go back to loan");
  assert(res13b.conversationAction === "RESUME", "Test 13.2: 'go back to loan' maps to RESUME action", res13b);

  const res13c = fallbackMultidimensionalNluParser("reset");
  assert(res13c.conversationAction === "RESET", "Test 13.3: 'reset' maps to RESET action", res13c);

  const res13d = fallbackMultidimensionalNluParser("start over");
  assert(res13d.conversationAction === "RESET", "Test 13.4: 'start over' maps to RESET action", res13d);

  // TEST 14: Yes / No & Not sure answers
  console.log("\nTest 14: Yes/No & Not sure answers");
  const ctx14a: NluContext = { isFlowActive: true, expectedField: "cibil" };
  const res14a = fallbackMultidimensionalNluParser("not sure", ctx14a);
  assert(res14a.entities.cibil === "Not provided", "Test 14.1: 'not sure' maps to 'Not provided' for cibil", res14a.entities);

  const ctx14b: NluContext = { isFlowActive: true, expectedField: "existingEmi" };
  const res14b = fallbackMultidimensionalNluParser("no", ctx14b);
  assert(res14b.entities.existingEmi === 0, "Test 14.2: 'no' maps to 0 for existingEmi", res14b.entities);

  const res14c = fallbackMultidimensionalNluParser("zero debt", ctx14b);
  assert(res14c.entities.existingEmi === 0, "Test 14.3: 'zero debt' maps to 0 for existingEmi", res14c.entities);

  // TEST 15: Typo & greeting prefix
  console.log("\nTest 15: Greeting prefix + loan intent");
  const res15 = fallbackMultidimensionalNluParser("helo I need a personal loan");
  assert(res15.primaryIntent === "LOAN_ELIGIBILITY", "Test 15.1: 'helo I need a personal loan' detects LOAN_ELIGIBILITY", res15);

  console.log("\n==========================================");
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${failedTests}`);
  console.log("==========================================");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL STANDALONE NLU TESTS PASSED!");
  }
}

runNluTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
