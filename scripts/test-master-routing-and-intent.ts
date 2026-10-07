import { runCentralAgent } from "../lib/ai/agent";
import { clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTest() {
  console.log("==================================================================");
  console.log("   CREDITWISE MASTER INTENT ROUTING & MODULE DISPATCH TEST SUITE  ");
  console.log("==================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
    }
  }

  // ------------------------------------------------------------------
  // TEST 1: Loan Intro ("I want a personal loan")
  // Must NOT prompt for company name!
  // ------------------------------------------------------------------
  {
    const convId = `test_intro_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "I want a personal loan",
      conversationHistory: [],
    });
    assert(
      !res.reply.toLowerCase().includes("what is the exact name of your current employer") &&
      !res.reply.toLowerCase().includes("what is the name of your current employer") &&
      res.reply.toLowerCase().includes("personal loan"),
      "Test 1: 'I want a personal loan' provides assistance without forcing company name prompt",
      res.reply.slice(0, 150)
    );
  }

  // ------------------------------------------------------------------
  // TEST 2: Different Loan Type ("I need a home loan")
  // Must NOT prompt for company name!
  // ------------------------------------------------------------------
  {
    const convId = `test_homeloan_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "I need a home loan",
      conversationHistory: [],
    });
    assert(
      !res.reply.toLowerCase().includes("what is the exact name of your current employer") &&
      !res.reply.toLowerCase().includes("what is the name of your current employer") &&
      res.reply.toLowerCase().includes("home loan"),
      "Test 2: 'I need a home loan' explains services without forcing company name prompt",
      res.reply.slice(0, 150)
    );
  }

  // ------------------------------------------------------------------
  // TEST 3: Offers / Discounts ("Do you have any offer?")
  // Must NOT prompt for company name!
  // ------------------------------------------------------------------
  {
    const convId = `test_offers_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "Do you have any offer?",
      conversationHistory: [],
    });
    assert(
      !res.reply.toLowerCase().includes("what is the exact name of your current employer") &&
      !res.reply.toLowerCase().includes("what is the name of your current employer") &&
      (res.reply.includes("Offer") || res.reply.includes("Special") || res.reply.includes("Rate")),
      "Test 3: 'Do you have any offer?' returns offers without forcing company prompt",
      res.reply.slice(0, 150)
    );
  }

  // ------------------------------------------------------------------
  // TEST 4: Bank Processing ("Can you process a loan for ICICI Bank?")
  // Must NOT prompt for company name!
  // ------------------------------------------------------------------
  {
    const convId = `test_process_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "Can you process a loan for ICICI Bank?",
      conversationHistory: [],
    });
    assert(
      !res.reply.toLowerCase().includes("what is the exact name of your current employer") &&
      !res.reply.toLowerCase().includes("what is the name of your current employer") &&
      res.reply.toLowerCase().includes("icici"),
      "Test 4: 'Can you process a loan for ICICI Bank?' explains bank processing without forcing company prompt",
      res.reply.slice(0, 150)
    );
  }

  // ------------------------------------------------------------------
  // TEST 5: Application Steps ("Give me steps to apply for a personal loan")
  // Must NOT prompt for company name!
  // ------------------------------------------------------------------
  {
    const convId = `test_steps_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "Give me steps to apply for a personal loan",
      conversationHistory: [],
    });
    assert(
      !res.reply.toLowerCase().includes("what is the exact name of your current employer") &&
      !res.reply.toLowerCase().includes("what is the name of your current employer") &&
      (res.reply.includes("Steps") || res.reply.includes("Process") || res.reply.includes("1.")),
      "Test 5: 'Give me steps to apply for a personal loan' returns steps without forcing company prompt",
      res.reply.slice(0, 150)
    );
  }

  // ------------------------------------------------------------------
  // TEST 6: Contextual Issue ("What is the issue?")
  // Must NOT prompt for company name!
  // ------------------------------------------------------------------
  {
    const convId = `test_issue_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "What is the issue?",
      conversationHistory: [],
    });
    assert(
      !res.reply.toLowerCase().includes("what is the exact name of your current employer") &&
      !res.reply.toLowerCase().includes("what is the name of your current employer") &&
      (res.reply.includes("issue") || res.reply.includes("assist") || res.reply.includes("CreditWise")),
      "Test 6: 'What is the issue?' clarifies context without forcing company prompt",
      res.reply.slice(0, 150)
    );
  }

  // ------------------------------------------------------------------
  // TEST 7: Module 1 — Company Search ("Search company Infosys")
  // ------------------------------------------------------------------
  {
    const convId = `test_comp_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "Search company Infosys",
      conversationHistory: [],
    });
    assert(
      res.reply.toLowerCase().includes("infosys") &&
      (res.reply.includes("Corporate") || res.reply.includes("Category") || res.reply.includes("Overview") || res.reply.includes("Matching Companies Found")),
      "Test 7: 'Search company Infosys' routes directly to Module 1 Company Search",
      res.reply.slice(0, 150)
    );
  }

  // ------------------------------------------------------------------
  // TEST 8: Module 2 — Bank Policy ("What is the CIBIL cutoff for HDFC?")
  // ------------------------------------------------------------------
  {
    const convId = `test_policy_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "What is the CIBIL cutoff for HDFC?",
      conversationHistory: [],
    });
    assert(
      res.reply.toLowerCase().includes("hdfc") &&
      (res.reply.includes("700") || res.reply.toLowerCase().includes("cibil") || res.reply.toLowerCase().includes("policy")),
      "Test 8: 'What is the CIBIL cutoff for HDFC?' routes directly to Module 2 Bank Policy",
      res.reply.slice(0, 150)
    );
  }

  // ------------------------------------------------------------------
  // TEST 9 & 10: Eligibility Flow with Mid-Flow Interruption & Resumption
  // Turn 1: Start eligibility check with partial details
  // Turn 2: User interrupts with "What documents are required for HDFC?"
  //         Must answer documents AND append resumption bridge!
  // Turn 3: User answers company "TCS" -> completes evaluation!
  // ------------------------------------------------------------------
  {
    const convId = `test_elig_interrupt_${Date.now()}`;
    await clearEligibilityState(convId);
    const history: Array<{ role: string; content: string }> = [];

    // Turn 1
    const t1 = await runCentralAgent({
      conversationId: convId,
      message: "Check my personal loan eligibility for 5 lakhs, salary 75000, 0 EMI, 750 CIBIL, age 29",
      conversationHistory: history,
    });
    history.push({ role: "user", content: "Check my personal loan eligibility for 5 lakhs, salary 75000, 0 EMI, 750 CIBIL, age 29" });
    history.push({ role: "assistant", content: t1.reply });

    assert(
      t1.reply.toLowerCase().includes("employer") || t1.reply.toLowerCase().includes("company"),
      "Test 9a: Turn 1 prompts for company name",
      t1.reply.slice(0, 150)
    );

    // Turn 2: Interruption (HDFC Documents)
    const t2 = await runCentralAgent({
      conversationId: convId,
      message: "What documents are required for HDFC?",
      conversationHistory: history,
    });
    history.push({ role: "user", content: "What documents are required for HDFC?" });
    history.push({ role: "assistant", content: t2.reply });

    assert(
      t2.reply.toLowerCase().includes("hdfc") &&
      (t2.reply.includes("Document") || t2.reply.includes("KYC") || t2.reply.includes("Payslip") || t2.reply.includes("Bank Statement")) &&
      t2.reply.includes("Coming back to your loan eligibility check") &&
      (t2.reply.toLowerCase().includes("employer") || t2.reply.toLowerCase().includes("company")),
      "Test 9b: Turn 2 answers HDFC documents AND appends concise resumption bridge",
      t2.reply.slice(0, 250)
    );

    // Turn 3: Answer company "TCS"
    const t3 = await runCentralAgent({
      conversationId: convId,
      message: "TCS",
      conversationHistory: history,
    });
    history.push({ role: "user", content: "TCS" });
    history.push({ role: "assistant", content: t3.reply });

    assert(
      t3.reply.includes("Loan Eligibility") || t3.reply.includes("Eligible") || t3.reply.includes("HDFC") || t3.reply.includes("TCS"),
      "Test 9c: Turn 3 resumes seamlessly and generates eligibility evaluation upon receiving company",
      t3.reply.slice(0, 250)
    );
  }

  // ------------------------------------------------------------------
  // TEST 11: Educational Concept Interruption Mid-Flow
  // ------------------------------------------------------------------
  {
    const convId = `test_concept_interrupt_${Date.now()}`;
    await clearEligibilityState(convId);
    const history: Array<{ role: string; content: string }> = [];

    // Turn 1: Start loan check with salary 80000
    const t1 = await runCentralAgent({
      conversationId: convId,
      message: "Check loan eligibility, salary 80000, age 28",
      conversationHistory: history,
    });
    history.push({ role: "user", content: "Check loan eligibility, salary 80000, age 28" });
    history.push({ role: "assistant", content: t1.reply });

    // Turn 2: Educational side question
    const t2 = await runCentralAgent({
      conversationId: convId,
      message: "What is reducing interest rate?",
      conversationHistory: history,
    });
    assert(
      (t2.reply.toLowerCase().includes("reducing") || t2.reply.toLowerCase().includes("principal")) &&
      t2.reply.includes("Coming back to your loan eligibility check"),
      "Test 11: Educational concept answered completely with resumption bridge appended",
      t2.reply.slice(0, 250)
    );
  }

  // ------------------------------------------------------------------
  // TEST 12 & 13: Explicit Topic Switch & TaskStack Resumption
  // ------------------------------------------------------------------
  {
    const convId = `test_switch_resume_${Date.now()}`;
    await clearEligibilityState(convId);
    const history: Array<{ role: string; content: string }> = [];

    // Turn 1: Start loan check
    const t1 = await runCentralAgent({
      conversationId: convId,
      message: "Check loan eligibility for 10 lakhs, salary 95000, age 32, CIBIL 780",
      conversationHistory: history,
    });
    history.push({ role: "user", content: "Check loan eligibility for 10 lakhs, salary 95000, age 32, CIBIL 780" });
    history.push({ role: "assistant", content: t1.reply });

    // Turn 2: Explicit topic switch
    const t2 = await runCentralAgent({
      conversationId: convId,
      message: "Actually check HDFC bank policy instead",
      conversationHistory: history,
    });
    history.push({ role: "user", content: "Actually check HDFC bank policy instead" });
    history.push({ role: "assistant", content: t2.reply });

    assert(
      t2.reply.toLowerCase().includes("hdfc") &&
      (t2.reply.includes("paused") || t2.reply.includes("assessment is paused") || t2.reply.includes("Policy")),
      "Test 12: Explicit topic switch suspends loan task and answers HDFC bank policy",
      t2.reply.slice(0, 250)
    );

    // Turn 3: Resume loan check
    const t3 = await runCentralAgent({
      conversationId: convId,
      message: "Resume my loan check",
      conversationHistory: history,
    });

    assert(
      t3.reply.toLowerCase().includes("welcome back") ||
      t3.reply.toLowerCase().includes("coming back to your loan") ||
      t3.reply.toLowerCase().includes("continue your loan eligibility"),
      "Test 13: 'Resume my loan check' pops task from TaskStack and resumes smoothly",
      t3.reply.slice(0, 250)
    );
  }

  console.log("\n==================================================================");
  console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${((passedTests/totalTests)*100).toFixed(0)}%)`);
  console.log("==================================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL TESTS PASSED! Master Intent Routing & Module Dispatch is fully verified.");
    process.exit(0);
  } else {
    console.error("❌ Some tests failed.");
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Test execution threw exception:", err);
  process.exit(1);
});
