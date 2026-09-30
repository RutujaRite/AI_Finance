import { runCentralAgent } from "../lib/ai/agent";
import { saveEligibilityState, clearEligibilityState, getEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("\n=======================================================");
  console.log("🧪 RUNNING COMMUNICATION INTENT & QUESTION ANSWERING TESTS");
  console.log("=======================================================\n");

  let passed = 0;
  let total = 0;

  function assert(testName: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
    }
  }

  const testConvId = "test_qa_" + Date.now();

  try {
    // ------------------------------------------------------------------------
    // SETUP: Initiate an active eligibility flow where "monthlyIncome" is expected
    // ------------------------------------------------------------------------
    await clearEligibilityState(testConvId);
    await saveEligibilityState(testConvId, {
      applicant: { companyName: "TATA CONSULTANCY SERVICES LIMITED", employmentType: "Salaried" },
      expectedField: "monthlyIncome",
      currentStep: "MONTHLYINCOME",
      missingFields: ["monthlyIncome", "loanAmount", "tenureMonths", "cibil", "age", "existingEmi"],
      in_eligibility_flow: true,
      updatedAt: Date.now(),
    } as any);

    // ------------------------------------------------------------------------
    // TEST 1: Mid-flow question: "Why do you need my salary?"
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 1: 'Why do you need my salary?' during salary collection ---");
    const res1 = await runCentralAgent({
      message: "Why do you need my salary?",
      conversationId: testConvId,
    });
    console.log("Assistant reply:\n", res1.reply);

    assert(
      "Answers why salary is needed in natural language",
      res1.reply.toLowerCase().includes("salary") &&
      res1.reply.toLowerCase().includes("borrow") &&
      !res1.reply.includes("Please provide your monthly") &&
      !res1.reply.includes("Could you please provide your monthlyIncome"),
      res1.reply
    );

    assert(
      "Politely reminds user about the pending detail in friendly words",
      res1.reply.toLowerCase().includes("whenever you're ready") ||
      res1.reply.toLowerCase().includes("could you share") ||
      res1.reply.toLowerCase().includes("monthly"),
      res1.reply
    );

    // Verify session state remained on monthlyIncome
    const state1 = await getEligibilityState(testConvId);
    assert(
      "Preserves active assessment field as monthlyIncome",
      state1?.expectedField === "monthlyIncome"
    );

    // ------------------------------------------------------------------------
    // TEST 2: Mid-flow question: "What is CIBIL?"
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 2: 'What is CIBIL?' during salary collection ---");
    const res2 = await runCentralAgent({
      message: "What is CIBIL?",
      conversationId: testConvId,
    });
    console.log("Assistant reply:\n", res2.reply);

    assert(
      "Answers CIBIL concept in natural language",
      res2.reply.toLowerCase().includes("cibil") &&
      (res2.reply.toLowerCase().includes("credit") || res2.reply.toLowerCase().includes("score")),
      res2.reply
    );

    assert(
      "Does not forcefully error out on CIBIL question",
      !res2.reply.includes("Please provide your monthly") &&
      !res2.reply.includes("Could you please provide your monthlyIncome"),
      res2.reply
    );

    // ------------------------------------------------------------------------
    // TEST 3: Mid-flow question: "Is my personal data safe?"
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 3: 'Is my personal data safe?' during salary collection ---");
    const res3 = await runCentralAgent({
      message: "Is my personal data safe?",
      conversationId: testConvId,
    });
    console.log("Assistant reply:\n", res3.reply);

    assert(
      "Answers data privacy question reassuringly and naturally",
      res3.reply.toLowerCase().includes("confidential") ||
      res3.reply.toLowerCase().includes("secure") ||
      res3.reply.toLowerCase().includes("private"),
      res3.reply
    );

    // ------------------------------------------------------------------------
    // TEST 4: Compound Input: "My salary is ₹85,000, but why is this required?"
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 4: Compound Input: 'My salary is ₹85,000, but why is this required?' ---");
    const res4 = await runCentralAgent({
      message: "My salary is ₹85,000, but why is this required?",
      conversationId: testConvId,
    });
    console.log("Assistant reply:\n", res4.reply);

    assert(
      "Answers why salary is required",
      res4.reply.toLowerCase().includes("salary") &&
      (res4.reply.toLowerCase().includes("borrow") || res4.reply.toLowerCase().includes("budget")),
      res4.reply
    );

    assert(
      "Acknowledges salary of ₹85,000 and advances to loanAmount",
      res4.reply.includes("85,000") &&
      (res4.reply.toLowerCase().includes("loan amount") || res4.reply.toLowerCase().includes("borrow")),
      res4.reply
    );

    const state4 = await getEligibilityState(testConvId);
    assert(
      "Records monthlyIncome = 85000 in applicant state and sets expectedField to loanAmount",
      state4?.applicant?.monthlyIncome === 85000 && state4?.expectedField === "loanAmount",
      `monthlyIncome=${state4?.applicant?.monthlyIncome}, expectedField=${state4?.expectedField}`
    );

    // ------------------------------------------------------------------------
    // TEST 5: Topic Switching mid-assessment: "Show HDFC bank policy"
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 5: Topic Switch to 'Show HDFC bank policy' while at loanAmount step ---");
    const res5 = await runCentralAgent({
      message: "Show HDFC bank policy",
      conversationId: testConvId,
    });
    console.log("Assistant reply:\n", res5.reply);

    assert(
      "Asks for pause confirmation before switching",
      res5.reply.toLowerCase().includes("pause") &&
      res5.reply.toLowerCase().includes("hdfc") &&
      res5.reply.toLowerCase().includes("yes"),
      res5.reply
    );

    // Confirm pause with "Yes"
    console.log("\n--- TEST 5b: Confirming pause with 'Yes' ---");
    const res5b = await runCentralAgent({
      message: "Yes",
      conversationId: testConvId,
    });
    console.log("Assistant reply:\n", res5b.reply);

    assert(
      "Executes HDFC bank policy upon confirmation and reminds how to resume",
      res5b.reply.toLowerCase().includes("hdfc") &&
      res5b.reply.toLowerCase().includes("paused"),
      res5b.reply
    );

    // ------------------------------------------------------------------------
    // TEST 6: Standalone Question outside assessment: "What is reducing balance rate?"
    // ------------------------------------------------------------------------
    const standaloneConvId = "test_standalone_" + Date.now();
    await clearEligibilityState(standaloneConvId);

    console.log("\n--- TEST 6: Standalone Question: 'What is reducing balance rate?' ---");
    const res6 = await runCentralAgent({
      message: "What is reducing balance rate?",
      conversationId: standaloneConvId,
    });
    console.log("Assistant reply:\n", res6.reply);

    assert(
      "Answers reducing balance rate clearly in natural language",
      res6.reply.toLowerCase().includes("reducing") &&
      res6.reply.toLowerCase().includes("interest") &&
      (res6.reply.toLowerCase().includes("balance") || res6.reply.toLowerCase().includes("owe")),
      res6.reply
    );

    assert(
      "Does not start an unwanted personal loan eligibility wizard",
      !res6.reply.toLowerCase().includes("which company you currently work for") &&
      !res6.reply.toLowerCase().includes("monthly take-home salary"),
      res6.reply
    );

    // ------------------------------------------------------------------------
    // TEST 7: Truly invalid input: "abcxyz" when salary is expected
    // ------------------------------------------------------------------------
    const invalidConvId = "test_invalid_" + Date.now();
    await clearEligibilityState(invalidConvId);
    await saveEligibilityState(invalidConvId, {
      applicant: { companyName: "INFOSYS LIMITED", employmentType: "Salaried" },
      expectedField: "monthlyIncome",
      currentStep: "MONTHLYINCOME",
      missingFields: ["monthlyIncome", "loanAmount", "tenureMonths", "cibil", "age", "existingEmi"],
      in_eligibility_flow: true,
      updatedAt: Date.now(),
    } as any);

    console.log("\n--- TEST 7: Truly invalid input 'abcxyz' during salary step ---");
    const res7 = await runCentralAgent({
      message: "abcxyz",
      conversationId: invalidConvId,
    });
    console.log("Assistant reply:\n", res7.reply);

    assert(
      "Provides friendly guidance with an example instead of robotic error",
      res7.reply.includes("50,000") &&
      res7.reply.toLowerCase().includes("salary"),
      res7.reply
    );

    // Clean up
    await clearEligibilityState(testConvId);
    await clearEligibilityState(standaloneConvId);
    await clearEligibilityState(invalidConvId);

  } catch (err: any) {
    console.error("Test execution failed with error:", err);
  }

  console.log("\n=======================================================");
  console.log(`📊 TEST RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log("=======================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
