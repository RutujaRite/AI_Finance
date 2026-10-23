// scripts/test-loan-eligibility-routing-regression.ts

import assert from "assert";
import pool from "@/lib/db";
import { runCentralAgent } from "@/lib/ai/agent";
import {
  saveEligibilityState,
  getEligibilityState,
  clearEligibilityState,
  isLoanEligibilityIntent,
} from "@/lib/dynamicEligibilityEngine";
import { classifyIntelligentIntent } from "@/lib/ai/intentClassifier";
import { isCompanyCategoryLookupIntent } from "@/lib/companySearch";

async function runRegressionSuite() {
  console.log("================================================================");
  console.log("STARTING CREDITWISE LOAN ELIGIBILITY ROUTING REGRESSION SUITE");
  console.log("================================================================\n");

  let passed = 0;
  let total = 0;

  function recordTest(name: string, ok: boolean, details?: string) {
    total++;
    if (ok) {
      passed++;
      console.log(`✅ [PASS] ${name}`);
      if (details) console.log(`   ${details}`);
    } else {
      console.error(`❌ [FAIL] ${name}`);
      if (details) console.error(`   ${details}`);
      throw new Error(`Test failed: ${name} - ${details}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Intent Classification Verification for Canonical Phrases
    // -------------------------------------------------------------------------
    console.log("--- Section 1: Canonical Loan Eligibility Intent Classification ---");

    const canonicalQueries = [
      "Check my eligibility.",
      "Can you check my eligibility?",
      "Check my loan eligibility.",
      "Am I eligible for a loan?",
      "Can I get a personal loan?",
      "Calculate my eligibility.",
      "I want to check whether I qualify for a loan.",
      "Tell me my loan eligibility.",
    ];

    for (const q of canonicalQueries) {
      const isElig = isLoanEligibilityIntent(q);
      assert.strictEqual(isElig, true, `Expected isLoanEligibilityIntent("${q}") to be true`);

      const isCompCat = isCompanyCategoryLookupIntent(q);
      assert.strictEqual(isCompCat, false, `Expected isCompanyCategoryLookupIntent("${q}") to be false`);

      const nlu = await classifyIntelligentIntent({ userMessage: q });
      assert.strictEqual(
        nlu.intent,
        "LOAN_ELIGIBILITY",
        `Expected classifyIntelligentIntent("${q}") to return LOAN_ELIGIBILITY, got ${nlu.intent}`
      );
      assert.strictEqual(
        nlu.targetCompany,
        undefined,
        `Expected targetCompany for "${q}" to be undefined, got "${nlu.targetCompany}"`
      );

      recordTest(`Canonical intent check: "${q}"`, true, `Intent: ${nlu.intent}, targetCompany: undefined`);
    }

    console.log("\n--- Section 4: Regression Tests A through G ---\n");

    // -------------------------------------------------------------------------
    // Test A: User: "check my eligibility"
    // Expected: Eligibility workflow starts. No company search is executed.
    // Prompt asks: "Sure! Let's check your loan eligibility. What is your monthly take-home salary?"
    // -------------------------------------------------------------------------
    console.log("--- Test A: 'check my eligibility' starts eligibility workflow with salary prompt ---");
    const convA = `test_conv_a_${Date.now()}`;
    await clearEligibilityState(convA);

    const resA = await runCentralAgent({
      message: "check my eligibility",
      conversationId: convA,
      conversationHistory: [],
    });

    assert.strictEqual(resA.companyData, undefined, "Must not return companyData");
    assert.ok(
      resA.reply.includes("Sure! Let's check your loan eligibility. What is your monthly take-home salary?"),
      `Expected salary prompt, got: ${resA.reply}`
    );
    assert.ok(!resA.reply.toLowerCase().includes("corporate company listing"), "Must not display corporate listing error");

    const stateA = await getEligibilityState(convA);
    assert.strictEqual(stateA?.in_eligibility_flow, true, "Must be in eligibility flow");
    assert.strictEqual(stateA?.expectedField, "monthlyIncome", "Expected field must be monthlyIncome");
    recordTest("Test A: 'check my eligibility'", true, `Reply: "${resA.reply.trim()}"`);

    // -------------------------------------------------------------------------
    // Test B: User: "Can you check my company category?"
    // Expected: The assistant asks for the company name.
    // -------------------------------------------------------------------------
    console.log("\n--- Test B: 'Can you check my company category?' asks for company name ---");
    const convB = `test_conv_b_${Date.now()}`;
    await clearEligibilityState(convB);

    const resB = await runCentralAgent({
      message: "Can you check my company category?",
      conversationId: convB,
      conversationHistory: [],
    });

    assert.ok(
      resB.reply.toLowerCase().includes("tell me your company name") ||
      resB.reply.toLowerCase().includes("share your employer") ||
      resB.reply.toLowerCase().includes("company name"),
      `Expected company name prompt, got: ${resB.reply}`
    );

    const stateB = await getEligibilityState(convB);
    assert.strictEqual(stateB?.activeIntent, "COMPANY_CATEGORY_LOOKUP", "Active intent must be COMPANY_CATEGORY_LOOKUP");
    assert.strictEqual(stateB?.awaitingCompanyName, true, "awaitingCompanyName must be true");
    recordTest("Test B: 'Can you check my company category?'", true, `Reply: "${resB.reply.trim()}"`);

    // -------------------------------------------------------------------------
    // Test C: User: "Cognizant"
    // Expected: If a company-category lookup is active, search for matching Cognizant records.
    // -------------------------------------------------------------------------
    console.log("\n--- Test C: 'Cognizant' in active company-category lookup returns records ---");
    const resC = await runCentralAgent({
      message: "Cognizant",
      conversationId: convB, // Reusing session from Test B where awaitingCompanyName was set
      conversationHistory: [
        { role: "user", content: "Can you check my company category?" },
        { role: "assistant", content: resB.reply },
      ],
    });

    assert.ok(
      resC.reply.includes("Cognizant") || resC.reply.includes("Category") || resC.reply.includes("CAT"),
      `Expected Cognizant category results or table, got: ${resC.reply}`
    );
    const stateC = await getEligibilityState(convB);
    assert.strictEqual(stateC?.activeIntent, "COMPANY_CATEGORY_LOOKUP");
    recordTest("Test C: 'Cognizant' in active company category flow", true, "Category table/options returned for Cognizant");

    // -------------------------------------------------------------------------
    // Test D: User: "Check my loan eligibility"
    // Expected: Route to eligibility workflow and ask only for the next missing field.
    // -------------------------------------------------------------------------
    console.log("\n--- Test D: 'Check my loan eligibility' routes to eligibility flow ---");
    const convD = `test_conv_d_${Date.now()}`;
    await clearEligibilityState(convD);

    const resD = await runCentralAgent({
      message: "Check my loan eligibility",
      conversationId: convD,
      conversationHistory: [],
    });

    assert.strictEqual(resD.companyData, undefined, "Must not return companyData");
    assert.ok(
      resD.reply.includes("Sure! Let's check your loan eligibility. What is your monthly take-home salary?"),
      `Expected exact salary question, got: ${resD.reply}`
    );
    const stateD = await getEligibilityState(convD);
    assert.strictEqual(stateD?.in_eligibility_flow, true);
    assert.strictEqual(stateD?.expectedField, "monthlyIncome");
    recordTest("Test D: 'Check my loan eligibility'", true, `Reply: "${resD.reply.trim()}"`);

    // -------------------------------------------------------------------------
    // Test E: User: "I want to check my eligibility. My salary is ₹50,000."
    // Expected: Recognize eligibility request, retain salary = 50,000, ask for company name.
    // -------------------------------------------------------------------------
    console.log("\n--- Test E: 'I want to check my eligibility. My salary is ₹50,000.' retains salary ---");
    const convE = `test_conv_e_${Date.now()}`;
    await clearEligibilityState(convE);

    const resE = await runCentralAgent({
      message: "I want to check my eligibility. My salary is ₹50,000.",
      conversationId: convE,
      conversationHistory: [],
    });

    assert.strictEqual(resE.companyData, undefined, "Must not execute company search");
    assert.ok(
      resE.reply.toLowerCase().includes("company") || resE.reply.toLowerCase().includes("work for"),
      `Expected next missing field question (company), got: ${resE.reply}`
    );

    const stateE = await getEligibilityState(convE);
    assert.strictEqual(stateE?.in_eligibility_flow, true, "Must be in eligibility flow");
    assert.strictEqual(stateE?.applicant?.monthlyIncome, 50000, "Salary must be retained as 50000");
    assert.strictEqual(stateE?.expectedField, "companyName", "Expected field must advance to companyName");
    recordTest("Test E: Retain salary ₹50,000 and ask for company", true, `Salary: ${stateE?.applicant?.monthlyIncome}, Next: ${stateE?.expectedField}`);

    // -------------------------------------------------------------------------
    // Test F: User previously provided salary and CIBIL score.
    // User: "Check my eligibility."
    // Expected: Reuse existing information and continue eligibility assessment without repeating questions.
    // -------------------------------------------------------------------------
    console.log("\n--- Test F: Pre-existing salary and CIBIL preserved on 'Check my eligibility.' ---");
    const convF = `test_conv_f_${Date.now()}`;
    await clearEligibilityState(convF);

    await saveEligibilityState(convF, {
      applicant: {
        monthlyIncome: 60000,
        cibilScore: 780,
        cibil: 780,
      },
      expectedField: "companyName",
      missingFields: ["companyName", "age", "existingEmi", "loanAmount", "tenureMonths"],
      in_eligibility_flow: true,
      activeFlow: "LOAN_ELIGIBILITY",
      updatedAt: Date.now(),
    } as any);

    const resF = await runCentralAgent({
      message: "Check my eligibility.",
      conversationId: convF,
      conversationHistory: [
        { role: "user", content: "My salary is 60000 and CIBIL is 780" },
        { role: "assistant", content: "Great! 😊 Which company do you currently work for?" },
      ],
    });

    assert.strictEqual(resF.companyData, undefined, "Must not execute company search");
    // Should NOT re-ask for salary or CIBIL
    assert.ok(
      !resF.reply.toLowerCase().includes("take-home salary"),
      `Must not re-prompt for salary. Got: ${resF.reply}`
    );
    assert.ok(
      !resF.reply.toLowerCase().includes("what is your cibil"),
      `Must not re-prompt for CIBIL. Got: ${resF.reply}`
    );
    assert.ok(
      resF.reply.toLowerCase().includes("company") || resF.reply.toLowerCase().includes("work for"),
      `Must continue and ask for missing company name. Got: ${resF.reply}`
    );

    const stateF = await getEligibilityState(convF);
    assert.strictEqual(stateF?.applicant?.monthlyIncome, 60000, "Salary 60000 must be preserved");
    const preservedCibil = stateF?.applicant?.cibilScore || stateF?.applicant?.cibil;
    assert.strictEqual(preservedCibil, 780, "CIBIL 780 must be preserved");
    recordTest("Test F: Reused salary and CIBIL without repeating questions", true, `Salary: ${stateF?.applicant?.monthlyIncome}, CIBIL: ${preservedCibil}`);

    // -------------------------------------------------------------------------
    // Test G: User is currently in the company-category flow.
    // User: "Forget that, check my loan eligibility."
    // Expected: Switch to eligibility workflow without losing valid eligibility data.
    // -------------------------------------------------------------------------
    console.log("\n--- Test G: Switch from active company-category flow to loan eligibility ---");
    const convG = `test_conv_g_${Date.now()}`;
    await clearEligibilityState(convG);

    // Set up active company-category session with selected company Cognizant
    await saveEligibilityState(convG, {
      activeIntent: "COMPANY_CATEGORY_LOOKUP",
      selectedCompanyName: "Cognizant Technology Solutions",
      company: "Cognizant Technology Solutions",
      applicant: {
        companyName: "Cognizant Technology Solutions",
      },
      awaitingCompanyName: false,
      awaitingCompanySelection: false,
      in_eligibility_flow: false,
      updatedAt: Date.now(),
    } as any);

    const resG = await runCentralAgent({
      message: "Forget that, check my loan eligibility.",
      conversationId: convG,
      conversationHistory: [
        { role: "user", content: "What is the category of Cognizant?" },
        { role: "assistant", content: "Cognizant Technology Solutions is CAT A across major partner banks." },
      ],
    });

    assert.strictEqual(resG.companyData, undefined, "Must not execute company search for 'Forget that, check my loan eligibility.'");
    assert.ok(
      resG.reply.includes("Sure! Let's check your loan eligibility. What is your monthly take-home salary?") ||
      resG.reply.toLowerCase().includes("monthly take-home salary") ||
      resG.reply.toLowerCase().includes("salary"),
      `Expected loan eligibility workflow with salary question, got: ${resG.reply}`
    );

    const stateG = await getEligibilityState(convG);
    assert.strictEqual(stateG?.in_eligibility_flow, true, "Must be switched into in_eligibility_flow");
    assert.strictEqual(
      stateG?.applicant?.companyName,
      "Cognizant Technology Solutions",
      "Must preserve valid company Cognizant"
    );
    assert.strictEqual(stateG?.expectedField, "monthlyIncome", "Next field must be monthlyIncome");
    recordTest("Test G: Clean switch from company category to loan eligibility preserving Cognizant", true, `Company: ${stateG?.applicant?.companyName}, Next: ${stateG?.expectedField}`);

    console.log("\n================================================================");
    console.log(`ALL REGRESSION TESTS PASSED: ${passed}/${total} assertions succeeded!`);
    console.log("================================================================\n");

  } finally {
    await pool.end();
  }
}

runRegressionSuite().catch((err) => {
  console.error("FATAL ERROR in regression suite:", err);
  process.exit(1);
});
