import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import {
  evaluateApplicantAgainstAllBanks,
  formatDynamicEligibilityReport,
  getRequiredPolicyFields,
  ApplicantProfile,
  getEligibilityState,
  saveEligibilityState,
} from "../lib/dynamicEligibilityEngine";
import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";
import { analyzeConversationWithLLM } from "../lib/ai/agent";

async function runRegressionTests() {
  console.log("===============================================================================");
  console.log("🧪 RUNNING COMPREHENSIVE LLM-DRIVEN ELIGIBILITY REGRESSION TEST SUITE");
  console.log("===============================================================================\n");

  let testsPassed = 0;
  let totalTests = 0;

  // ---------------------------------------------------------------------------
  // TEST 1: Unknown CIBIL Extraction and Normalization
  // ---------------------------------------------------------------------------
  totalTests++;
  console.log("👉 TEST 1: Unknown CIBIL Extraction & Normalization");
  {
    // A. classifyIntentWithLLM
    const classified1 = await classifyIntentWithLLM(
      "I don't know my CIBIL score, I have never checked it",
      { isFlowActive: true, expectedField: "cibil" }
    );
    console.log(`classifyIntentWithLLM cibil for 'I don\\'t know my CIBIL score':`, classified1.extracted.cibil);

    if (classified1.extracted.cibil !== "Not provided") {
      throw new Error(`TEST 1 FAILED: Expected cibil to be 'Not provided', but got '${classified1.extracted.cibil}'`);
    }

    // B. analyzeConversationWithLLM
    const analysis1 = await analyzeConversationWithLLM({
      userMessage: "I don't know my CIBIL score",
      applicant: { loanType: "Personal Loan", companyName: "TCS", monthlyIncome: 80000, loanAmount: 500000, tenureMonths: 36 },
      missingFields: ["cibil", "existingEmi", "age"],
      isFlowActive: true,
    });
    console.log(`analyzeConversationWithLLM cibil for 'I don\\'t know my CIBIL score':`, analysis1.extractedDetails.cibil);
    if (analysis1.extractedDetails.cibil !== "Not provided") {
      throw new Error(`TEST 1 FAILED: analyzeConversationWithLLM expected 'Not provided', got '${analysis1.extractedDetails.cibil}'`);
    }

    // C. Explicit 0 must still be 0
    const classifiedZero = await classifyIntentWithLLM(
      "My CIBIL is 0",
      { isFlowActive: true, expectedField: "cibil" }
    );
    console.log(`classifyIntentWithLLM cibil for 'My CIBIL is 0':`, classifiedZero.extracted.cibil);
    if (classifiedZero.extracted.cibil !== 0) {
      throw new Error(`TEST 1 FAILED: Explicit 0 CIBIL was expected to be 0, got '${classifiedZero.extracted.cibil}'`);
    }

    console.log("✅ TEST 1 PASSED: Unknown CIBIL accurately preserved as 'Not provided', 0 preserved as 0.\n");
    testsPassed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Applicant Profile & Report with Unknown CIBIL
  // Verify: Never 0, Never "Standard", Never hardcoded recommendations or bank counts
  // ---------------------------------------------------------------------------
  totalTests++;
  console.log("👉 TEST 2: Report Formatting with Unknown CIBIL & Grounded Rejection Reasons");
  {
    const profileWithUnknownCibil: ApplicantProfile = {
      loanType: "Personal Loan",
      companyName: "Infosys",
      monthlyIncome: 85000,
      loanAmount: 500000,
      tenureMonths: 36,
      cibil: "Not provided",
      existingEmi: 0,
      age: 28,
    };

    const evalResult = await evaluateApplicantAgainstAllBanks(profileWithUnknownCibil, "Personal Loan");
    const report = formatDynamicEligibilityReport(profileWithUnknownCibil, evalResult);

    console.log("Report Snippet:\n", report.slice(0, 800), "\n...\n");

    // 1. Applicant summary must show "Not provided" for CIBIL
    if (!report.includes("| **CIBIL Credit Score** | Not provided |")) {
      throw new Error("TEST 2 FAILED: Applicant summary table did not display 'Not provided' for CIBIL.");
    }

    // 2. Must NEVER display "Standard" for CIBIL
    if (/CIBIL.*Standard/i.test(report)) {
      throw new Error("TEST 2 FAILED: CIBIL was converted to 'Standard' in the report!");
    }

    // 3. Must NEVER have hardcoded 'Top Recommended Bank' card
    if (report.includes("Top Recommended Bank")) {
      throw new Error("TEST 2 FAILED: Report contains hardcoded 'Top Recommended Bank' recommendation!");
    }

    // 4. Must NOT have hardcoded bank count like '23 partner banks'
    if (/23 partner banks/i.test(report) || /22-bank/i.test(report)) {
      throw new Error("TEST 2 FAILED: Report contains hardcoded bank counts!");
    }

    // 5. Must NOT have hardcoded hurdle ranges
    if (report.includes("650 to 731") || report.includes("50%–75%") || report.includes("21–60 years")) {
      throw new Error("TEST 2 FAILED: Report contains hardcoded hurdle ranges!");
    }

    // 6. Ineligible banks must have actual failure reasons from policy engine
    const ineligibleWithReasons = evalResult.ineligibleBanks.filter((b) => b.failureReasons.length > 0);
    console.log(`Ineligible banks with policy failure reasons: ${ineligibleWithReasons.length} / ${evalResult.ineligibleBanks.length}`);
    if (ineligibleWithReasons.length === 0) {
      throw new Error("TEST 2 FAILED: No failure reasons generated for ineligible banks.");
    }

    // Check that CIBIL failure reason explicitly mentions 'Not provided'
    const cibilReason = ineligibleWithReasons.find((b) =>
      b.failureReasons.some((r) => r.toLowerCase().includes("cibil") && r.includes("Not provided"))
    );
    if (!cibilReason) {
      throw new Error("TEST 2 FAILED: Ineligible bank failure reasons did not cite 'CIBIL score (Not provided)'.");
    }
    console.log(`Sample verified CIBIL failure reason: "${cibilReason.failureReasons.find((r) => r.includes('Not provided'))}"`);

    console.log("✅ TEST 2 PASSED: Report formatting and engine failure reasons strictly verified.\n");
    testsPassed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Multi-turn Central Agent Flow with Unknown CIBIL
  // ---------------------------------------------------------------------------
  totalTests++;
  console.log("👉 TEST 3: Multi-turn Central Agent Flow with Unknown CIBIL");
  {
    const convId = "conv_test_cibil_unknown_" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    // Turn 1: User provides partial details
    const msg1 = "I work at Wipro and my salary is 70k. Need 4 lakhs loan for 3 years.";
    console.log(`User Turn 1: "${msg1}"`);
    const res1 = await runCentralAgent({ message: msg1, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: msg1 });
    history.push({ role: "assistant", content: res1.reply });

    // Turn 2: Assistant asks for missing detail (e.g. CIBIL, EMI, or Age)
    // User replies that CIBIL is unknown, no EMIs, age 26
    const msg2 = "I don't know my CIBIL score, never checked it. I have 0 existing loans and my age is 26.";
    console.log(`User Turn 2: "${msg2}"`);
    const res2 = await runCentralAgent({ message: msg2, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: msg2 });
    history.push({ role: "assistant", content: res2.reply });

    console.log("Assistant Turn 2 Reply:\n", res2.reply.slice(0, 600), "\n...\n");

    const savedState = await getEligibilityState(convId);
    console.log("Saved Applicant CIBIL:", savedState?.applicant?.cibil);

    if (savedState?.applicant?.cibil !== "Not provided") {
      throw new Error(`TEST 3 FAILED: Saved applicant CIBIL is '${savedState?.applicant?.cibil}', expected 'Not provided'`);
    }

    if (!res2.reply.includes("| **CIBIL Credit Score** | Not provided |")) {
      throw new Error("TEST 3 FAILED: Eligibility report did not preserve 'Not provided' for CIBIL score.");
    }

    if (res2.reply.includes("Standard") && res2.reply.includes("CIBIL")) {
      throw new Error("TEST 3 FAILED: CIBIL was replaced with 'Standard'!");
    }

    console.log("✅ TEST 3 PASSED: Multi-turn flow preserved 'Not provided' throughout session & report.\n");
    testsPassed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Engine-Grounded Ineligibility Explanation Inquiry
  // User asks "Why did HDFC Bank reject me?" or "Why am I not eligible?"
  // LLM must explain ONLY the actual failed criteria returned by the engine
  // ---------------------------------------------------------------------------
  totalTests++;
  console.log("👉 TEST 4: Engine-Grounded Ineligibility Explanation via LLM");
  {
    const convId = "conv_test_ineligibility_" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    // Setup an evaluation where applicant had salary 18000 and age 20 (low salary, under age)
    const testApplicant: ApplicantProfile = {
      loanType: "Personal Loan",
      companyName: "Local Small Shop",
      monthlyIncome: 18000,
      loanAmount: 300000,
      tenureMonths: 36,
      cibil: 620,
      existingEmi: 8000,
      age: 20,
    };

    const evalResult = await evaluateApplicantAgainstAllBanks(testApplicant, "Personal Loan");
    const hdfcResult = evalResult.ineligibleBanks.find((b) => b.bankName.toLowerCase().includes("hdfc"));
    console.log("HDFC Bank Engine Failure Reasons for test profile:", hdfcResult?.failureReasons);

    await saveEligibilityState(convId, {
      applicant: testApplicant,
      hasCompletedEvaluation: true,
      evaluationCompleted: true,
      eligible_banks: evalResult.eligibleBanks.map((b) => b.bankName),
      ineligibleBanks: evalResult.ineligibleBanks.map((b) => ({
        bankName: b.bankName,
        failureReasons: b.failureReasons,
      })),
      updatedAt: Date.now(),
    } as any);

    const question = "Why am I not eligible for HDFC Bank?";
    console.log(`User: "${question}"`);

    const res = await runCentralAgent({
      message: question,
      conversationId: convId,
      conversationHistory: [
        { role: "user", content: "Check my loan eligibility" },
        { role: "assistant", content: formatDynamicEligibilityReport(testApplicant, evalResult) },
      ],
    });

    console.log("\nAssistant Explanation:\n", res.reply, "\n");

    // The explanation should mention the actual criteria failed (e.g. salary, CIBIL, or age)
    const mentionsEngineCriteria =
      /salary|income|cibil|credit\s*score|age|minimum/i.test(res.reply);
    if (!mentionsEngineCriteria) {
      throw new Error("TEST 4 FAILED: LLM response did not cite any of the engine's actual criteria!");
    }

    // Should NOT hallucinate unverified reasons like missing documents, default on loans, etc.
    const hasHallucinatedReasons =
      /unpaid\s*dues|cheque\s*bounce|criminal|identity\s*theft|settled\s*account/i.test(res.reply);
    if (hasHallucinatedReasons) {
      throw new Error("TEST 4 FAILED: LLM hallucinated unverified credit default reasons!");
    }

    console.log("✅ TEST 4 PASSED: Explanation strictly grounded in engine criteria without hallucinations.\n");
    testsPassed++;
  }

  console.log("===============================================================================");
  console.log(`🎉 ALL ${testsPassed} / ${totalTests} REGRESSION TESTS PASSED SUCCESSFULLY!`);
  console.log("===============================================================================");
}

runRegressionTests().catch((err) => {
  console.error("\n❌ REGRESSION TEST SUITE FAILED:", err);
  process.exit(1);
});
