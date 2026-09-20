// scripts/verify-eligibility-routing.ts

import assert from "assert";
import pool from "@/lib/db";
import {
  runCentralAgent,
  extractFieldAwareEntity,
} from "@/lib/ai/agent";
import {
  saveEligibilityState,
  getEligibilityState,
  clearEligibilityState,
  isFinancialOrProfileInput,
  isInvalidCompanyName,
  isLocationInput,
  extractCompanyCandidateFromText,
} from "@/lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("================================================================");
  console.log("STARTING ELIGIBILITY ROUTING VERIFICATION SUITE");
  console.log("================================================================\n");

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // UNIT TEST 1: isFinancialOrProfileInput & extractCompanyCandidateFromText
    // -------------------------------------------------------------------------
    console.log("--- Test 1: Financial & Profile Input Detection ---");
    const ageInputs = ["23", "23 age", "age 23", "I am 23", "my age is 23", "23 years old", "23 yrs", "23 saal", "age: 23"];
    for (const input of ageInputs) {
      assert.strictEqual(
        isFinancialOrProfileInput(input),
        true,
        `Expected isFinancialOrProfileInput("${input}") to be true`
      );
      assert.strictEqual(
        extractCompanyCandidateFromText(input),
        undefined,
        `Expected extractCompanyCandidateFromText("${input}") to be undefined`
      );
    }
    console.log("✓ Test 1 Passed: All age expressions correctly identified as financial/profile inputs and rejected as companies.\n");

    // -------------------------------------------------------------------------
    // UNIT TEST 2: extractFieldAwareEntity unit checks
    // -------------------------------------------------------------------------
    console.log("--- Test 2: Field-Aware Entity Extraction (All Test Cases) ---");

    // Age test cases
    const testCasesAge = [
      { msg: "23", expected: 23 },
      { msg: "23 age", expected: 23 },
      { msg: "I am 23", expected: 23 },
      { msg: "my age is 23", expected: 23 },
      { msg: "23 years old", expected: 23 },
    ];
    for (const tc of testCasesAge) {
      const res = extractFieldAwareEntity(tc.msg, "age");
      assert.strictEqual(res.isValid, true, `Expected valid extraction for "${tc.msg}"`);
      assert.strictEqual(res.field, "age");
      assert.strictEqual(res.value, tc.expected, `Expected age=${tc.expected} for "${tc.msg}"`);
    }

    // CIBIL test case: 760
    const resCibil = extractFieldAwareEntity("760", "cibil");
    assert.strictEqual(resCibil.isValid, true);
    assert.strictEqual(resCibil.field, "cibil");
    assert.strictEqual(resCibil.value, 760);

    // Loan amount test case: 800000
    const resLoan = extractFieldAwareEntity("800000", "loanAmount");
    assert.strictEqual(resLoan.isValid, true);
    assert.strictEqual(resLoan.field, "loanAmount");
    assert.strictEqual(resLoan.value, 800000);

    // Tenure test cases
    const resTenure1 = extractFieldAwareEntity("3 years", "tenureMonths");
    assert.strictEqual(resTenure1.isValid, true);
    assert.strictEqual(resTenure1.value, 36);

    const resTenure2 = extractFieldAwareEntity("36", "tenureMonths");
    assert.strictEqual(resTenure2.isValid, true);
    assert.strictEqual(resTenure2.value, 36);

    // Existing EMI test cases
    const resEmi1 = extractFieldAwareEntity("0 emi", "existingEmi");
    assert.strictEqual(resEmi1.isValid, true);
    assert.strictEqual(resEmi1.value, 0);

    const resEmi2 = extractFieldAwareEntity("5000", "existingEmi");
    assert.strictEqual(resEmi2.isValid, true);
    assert.strictEqual(resEmi2.value, 5000);

    // Explicit field override: expected age, but user provides CIBIL
    const resOverride = extractFieldAwareEntity("cibil is 760", "age");
    assert.strictEqual(resOverride.isValid, true);
    assert.strictEqual(resOverride.field, "cibil");
    assert.strictEqual(resOverride.value, 760);

    // Invalid & ambiguous inputs
    const resInvalidAge = extractFieldAwareEntity("120", "age");
    assert.strictEqual(resInvalidAge.isValid, false, "Age 120 must be invalid");
    assert.ok(resInvalidAge.clarificationPrompt, "Must contain clarification prompt");

    const resAmbiguous = extractFieldAwareEntity("something completely different", "age");
    assert.strictEqual(resAmbiguous.isValid, false);
    assert.ok(resAmbiguous.clarificationPrompt, "Must contain clarification prompt");

    console.log("✓ Test 2 Passed: extractFieldAwareEntity successfully verified for all test cases.\n");

    // -------------------------------------------------------------------------
    // INTEGRATION TEST 3: runCentralAgent with "23 age" when expectedField is "age"
    // (The exact bug reported by user)
    // -------------------------------------------------------------------------
    console.log("--- Test 3: Exact Bug Reproduction & Fix Verification (What is your age? -> 23 age) ---");

    const convId = `test_routing_exact_${Date.now()}`;

    // Setup active session at "age" step with company, salary, loan, tenure, cibil already collected
    await saveEligibilityState(convId, {
      applicant: {
        companyName: "Tata Consultancy Services",
        monthlyIncome: 85000,
        loanAmount: 500000,
        tenureMonths: 36,
        cibil: 750,
      },
      expectedField: "age",
      missingFields: ["age", "existingEmi"],
      in_eligibility_flow: true,
      updatedAt: Date.now(),
    } as any);

    // User sends "23 age"
    console.log("Simulating user response: '23 age' when expectedField = 'age'");
    const result = await runCentralAgent({
      message: "23 age",
      conversationId: convId,
      conversationHistory: [
        { role: "assistant", content: "What is your current age?" },
      ],
    });

    console.log("Agent response:", result.reply);

    // Check assertions
    assert.strictEqual(
      result.companyData,
      undefined,
      "Agent must NEVER return companyData when answering an age question!"
    );
    assert.strictEqual(
      result.companyQuery,
      undefined,
      "Agent must NEVER set companyQuery for '23 age'!"
    );
    assert.ok(
      !result.reply.toLowerCase().includes("category"),
      "Response must NOT be a company category search result!"
    );

    // Verify updated state in database
    const updatedState = await getEligibilityState(convId);
    assert.ok(updatedState, "Eligibility state must exist");
    assert.strictEqual(updatedState.applicant.age, 23, "Applicant age must be 23!");
    assert.strictEqual(updatedState.expectedField, "existingEmi", "Next expected field must be existingEmi!");
    console.log("✓ Test 3 Passed: '23 age' correctly stored age = 23, advanced to existingEmi, and did NOT trigger company search!\n");

    // -------------------------------------------------------------------------
    // INTEGRATION TEST 4: Variations of Age ("23", "I am 23", "my age is 23", "23 years old")
    // -------------------------------------------------------------------------
    console.log("--- Test 4: Testing Variations of Age Input ---");
    const variations = ["23", "I am 23", "my age is 23", "23 years old"];

    let varIdx = 0;
    for (const ageInput of variations) {
      varIdx++;
      const vConvId = `test_age_var_${varIdx}_${Date.now()}`;

      await saveEligibilityState(vConvId, {
        applicant: {
          companyName: "Infosys",
          monthlyIncome: 90000,
          loanAmount: 600000,
          tenureMonths: 48,
          cibil: 760,
        },
        expectedField: "age",
        missingFields: ["age", "existingEmi"],
        in_eligibility_flow: true,
        updatedAt: Date.now(),
      } as any);

      const vResult = await runCentralAgent({
        message: ageInput,
        conversationId: vConvId,
        conversationHistory: [{ role: "assistant", content: "What is your current age?" }],
      });

      assert.strictEqual(vResult.companyData, undefined, `Must not route to company search for '${ageInput}'`);
      const vState = await getEligibilityState(vConvId);
      assert.strictEqual(vState?.applicant.age, 23, `Age must be 23 for input '${ageInput}'`);
      assert.strictEqual(vState?.expectedField, "existingEmi", `Next expected field must be existingEmi for '${ageInput}'`);
      console.log(`  ✓ Passed for '${ageInput}' -> age = 23, next = existingEmi`);
    }
    console.log("✓ Test 4 Passed: All age input variations extract dynamically and advance.\n");

    // -------------------------------------------------------------------------
    // INTEGRATION TEST 5: CIBIL and Loan Amount Routing
    // -------------------------------------------------------------------------
    console.log("--- Test 5: Testing CIBIL and Loan Amount Inputs ---");

    // CIBIL test: "What is your CIBIL?" -> "760"
    const cibilConvId = `test_cibil_${Date.now()}`;
    await saveEligibilityState(cibilConvId, {
      applicant: {
        companyName: "Wipro",
        monthlyIncome: 75000,
        loanAmount: 400000,
        tenureMonths: 36,
      },
      expectedField: "cibil",
      missingFields: ["cibil", "age", "existingEmi"],
      in_eligibility_flow: true,
      updatedAt: Date.now(),
    } as any);

    const cibilResult = await runCentralAgent({
      message: "760",
      conversationId: cibilConvId,
      conversationHistory: [{ role: "assistant", content: "What is your CIBIL score?" }],
    });
    assert.strictEqual(cibilResult.companyData, undefined);
    const cibilState = await getEligibilityState(cibilConvId);
    assert.strictEqual(cibilState?.applicant.cibil, 760);
    assert.strictEqual(cibilState?.expectedField, "age");
    console.log("  ✓ Passed: '760' when expectedField = 'cibil' -> cibil = 760, next = age");

    // Loan amount test: "What is your loan amount?" -> "800000"
    const loanConvId = `test_loan_${Date.now()}`;
    await saveEligibilityState(loanConvId, {
      applicant: {
        companyName: "Google",
        monthlyIncome: 150000,
      },
      expectedField: "loanAmount",
      missingFields: ["loanAmount", "tenureMonths", "cibil", "age", "existingEmi"],
      in_eligibility_flow: true,
      updatedAt: Date.now(),
    } as any);

    const loanResult = await runCentralAgent({
      message: "800000",
      conversationId: loanConvId,
      conversationHistory: [{ role: "assistant", content: "How much loan do you require?" }],
    });
    assert.strictEqual(loanResult.companyData, undefined);
    const loanState = await getEligibilityState(loanConvId);
    assert.strictEqual(loanState?.applicant.loanAmount, 800000);
    assert.strictEqual(loanState?.expectedField, "tenureMonths");
    console.log("  ✓ Passed: '800000' when expectedField = 'loanAmount' -> loanAmount = 800000, next = tenureMonths");
    console.log("✓ Test 5 Passed: CIBIL and Loan Amount field-aware routing verified.\n");

    // -------------------------------------------------------------------------
    // INTEGRATION TEST 6: Ambiguous/Invalid Input Asks Clarification, Never Routes to Company Search
    // -------------------------------------------------------------------------
    console.log("--- Test 6: Ambiguous / Invalid Inputs Ask Clarification ---");

    const ambConvId = `test_ambiguous_${Date.now()}`;
    await saveEligibilityState(ambConvId, {
      applicant: {
        companyName: "Accenture",
        monthlyIncome: 65000,
        loanAmount: 300000,
        tenureMonths: 24,
        cibil: 720,
      },
      expectedField: "age",
      missingFields: ["age", "existingEmi"],
      in_eligibility_flow: true,
      updatedAt: Date.now(),
    } as any);

    const ambResult = await runCentralAgent({
      message: "something random and unclear",
      conversationId: ambConvId,
      conversationHistory: [{ role: "assistant", content: "What is your current age?" }],
    });

    assert.strictEqual(ambResult.companyData, undefined, "Ambiguous input must NEVER trigger company search");
    assert.ok(
      ambResult.reply.toLowerCase().includes("age"),
      "Agent must ask clarification about age"
    );
    const ambState = await getEligibilityState(ambConvId);
    assert.strictEqual(ambState?.expectedField, "age", "Must stay on expectedField 'age'");
    console.log("✓ Test 6 Passed: Ambiguous input asked clarification about age and did not route to company search.\n");

    // -------------------------------------------------------------------------
    // INTEGRATION TEST 7: Complete End-to-End Evaluation from Final Field
    // -------------------------------------------------------------------------
    console.log("--- Test 7: Final Field Completion Triggers Multi-Bank Policy Evaluation Table ---");

    const finalConvId = `test_final_${Date.now()}`;
    await saveEligibilityState(finalConvId, {
      applicant: {
        companyName: "Tata Consultancy Services",
        monthlyIncome: 85000,
        loanAmount: 500000,
        tenureMonths: 36,
        cibil: 750,
        age: 28,
      },
      expectedField: "existingEmi",
      missingFields: ["existingEmi"],
      in_eligibility_flow: true,
      updatedAt: Date.now(),
    } as any);

    const finalResult = await runCentralAgent({
      message: "0 emi",
      conversationId: finalConvId,
      conversationHistory: [{ role: "assistant", content: "Do you have any existing EMIs?" }],
    });

    assert.ok(finalResult.reply.includes("|"), "Final reply must contain the eligibility table!");
    assert.ok(finalResult.bankData && finalResult.bankData.length > 0, "Must return evaluated bankData");
    const finalState = await getEligibilityState(finalConvId);
    assert.strictEqual(finalState?.hasCompletedEvaluation, true, "Evaluation must be completed");
    assert.strictEqual(finalState?.expectedField, "selectedBank", "Next step must be selectedBank");
    console.log("✓ Test 7 Passed: Final field triggers full dynamic evaluation and presents the eligible bank table.\n");

    // -------------------------------------------------------------------------
    // INTEGRATION TEST 8: Location Input & Gold Loan Routing ("pune swarget")
    // -------------------------------------------------------------------------
    console.log("--- Test 8: Location Input Handling & Gold Loan Routing ---");

    const locInputs = ["pune swarget", "swargate", "pune", "mumbai", "411042", "Camp branch, Pune", "located in Swargate"];
    for (const l of locInputs) {
      assert.strictEqual(isLocationInput(l), true, `Expected isLocationInput("${l}") to be true`);
      assert.strictEqual(isInvalidCompanyName(l), true, `Expected isInvalidCompanyName("${l}") to be true`);
      assert.strictEqual(extractCompanyCandidateFromText(l), undefined, `Expected extractCompanyCandidateFromText("${l}") to be undefined`);
    }

    const goldConvId = `test_gold_${Date.now()}`;
    const goldHistory = [
      { role: "user", content: "i am unemployed, can i get a loan?" },
      { role: "assistant", content: "Under partner bank policies, unsecured personal loans require active employment. Secured options like a gold loan are possible." },
      { role: "user", content: "i want a gold loan of 6 lakhs" },
      { role: "assistant", content: "A gold loan of ₹6,00,000 is a secured loan against jewellery. What repayment tenure would you prefer?" },
      { role: "user", content: "year" },
      { role: "assistant", content: "Perfect — 1 year (12 months) as your repayment tenure. So to summarise, you're looking for a gold loan of ₹6,00,000 over 12 months. Since you're currently not employed, a gold loan is a great fit as it's secured against your jewellery and doesn't require income proof. To help connect you with the right branch and explore the best offers, could you let me know which city you're located in?" }
    ];

    const goldResult = await runCentralAgent({
      message: "pune swarget",
      conversationId: goldConvId,
      conversationHistory: goldHistory,
    });

    assert.strictEqual(goldResult.companyData, undefined, "Location input must NEVER trigger company data or live search");
    assert.ok(!goldResult.reply.includes("Justdial"), "Reply must not contain Justdial scrapings");
    assert.ok(!goldResult.reply.includes("Corporate Companies"), "Reply must not treat location as employer search");
    assert.ok(goldResult.reply.includes("Swarget") || goldResult.reply.includes("Swargate"), "Reply must acknowledge Swarget / Swargate");
    assert.ok(goldResult.reply.includes("Pune"), "Reply must acknowledge Pune");
    assert.ok(goldResult.reply.includes("Gold Loan"), "Reply must proceed with Gold Loan flow");
    assert.ok(goldResult.reply.includes("no income proof"), "Reply must explain no income proof required");

    const savedGoldState = await getEligibilityState(goldConvId);
    assert.strictEqual(savedGoldState?.loanType, "Gold Loan", "State must preserve Gold Loan type");
    assert.ok(savedGoldState?.location?.includes("Pune"), "State must record location in Pune");

    console.log("✓ Test 8 Passed: Location input ('pune swarget') correctly routed to Gold Loan branch support without company search.\n");

    console.log("================================================================");
    console.log("ALL 8 ELIGIBILITY ROUTING TESTS PASSED PERFECTLY!");
    console.log("================================================================");
  } finally {
    client.release();
  }
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
