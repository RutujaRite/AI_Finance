import pool from "../lib/db";
import {
  evaluateApplicantAgainstAllBanks,
  formatDynamicEligibilityReport,
  applyProfileUpdateAndRecalculate,
  saveEligibilityState,
  getEligibilityState,
} from "../lib/dynamicEligibilityEngine";
import {
  lookupPostEligibilityBankManager,
  formatPostEligibilityManagerDetails,
} from "../lib/bankSearch";
import { handlePostEligibilityWorkflow } from "../lib/ai/postEligibilityWorkflow";

async function runAllTests() {
  console.log("==========================================================");
  console.log("RUNNING COMPREHENSIVE LOAN ELIGIBILITY SHEET TEST SUITE");
  console.log("==========================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------
    // Test 1, 2, 3: Full evaluation, all evaluated banks in sheet, rejection reasons
    // -------------------------------------------------------------------
    console.log("\n--- TEST SUITE 1: Full Eligibility Evaluation & 7-Column Sheet ---");
    const testApplicant = {
      salary: 60000,
      monthlySalary: 60000,
      monthlyIncome: 60000,
      company: "Tata Consultancy Services",
      companyName: "Tata Consultancy Services",
      companyCategory: "CAT Super A",
      age: 29,
      cibil: 760,
      cibilScore: 760,
      existingEmi: 5000,
      currentEmis: 5000,
      existingLoanEmi: 5000,
      loanAmount: 800000,
      tenure: 48,
      tenureMonths: 48,
    };

    const evalResult = await evaluateApplicantAgainstAllBanks(testApplicant as any);
    assert(evalResult.evaluations.length >= 10, `Evaluated banks count >= 10 (actual: ${evalResult.evaluations.length})`);
    
    const eligibleEvals = evalResult.evaluations.filter((e) => e.isEligible);
    const ineligibleEvals = evalResult.evaluations.filter((e) => !e.isEligible);
    assert(eligibleEvals.length > 0, `At least 1 bank eligible (actual: ${eligibleEvals.length})`);
    assert(ineligibleEvals.length > 0, `At least 1 bank ineligible (actual: ${ineligibleEvals.length})`);

    // Ineligible banks must have actual failure reasons
    for (const inelig of ineligibleEvals) {
      assert(
        inelig.failureReasons && inelig.failureReasons.length > 0,
        `Ineligible bank ${inelig.bankName} has actual failure reason: ${inelig.failureReasons?.[0]}`
      );
    }

    // -------------------------------------------------------------------
    // Test 4: Recommended Bank Card & 7-Column Format
    // -------------------------------------------------------------------
    console.log("\n--- TEST SUITE 2: Recommended Bank & Sheet Formatting ---");
    const report = formatDynamicEligibilityReport(testApplicant as any, evalResult);
    assert(report.includes("### 🌟 Recommended Bank"), "Report contains Recommended Bank card heading");
    assert(report.includes("Estimated Eligible Amount"), "Recommended Bank card contains Estimated Eligible Amount");
    assert(report.includes("Interest Rate"), "Recommended Bank card contains Interest Rate");
    assert(report.includes("Why recommended"), "Recommended Bank card contains Why recommended explanation");
    assert(
      report.includes("| Bank Name | Eligibility Status | Eligible Loan Amount | Interest Rate | Tenure | Eligibility Reason | Action |"),
      "Report contains exact 7-column table header"
    );

    // Verify recommended bank is genuinely eligible
    const recBank = evalResult.recommendedBank;
    assert(recBank !== null, "Recommended bank exists for eligible applicant");
    if (recBank) {
      const isActuallyEligible = evalResult.evaluations.some(
        (e) => e.bankName === recBank.bankName && e.isEligible
      );
      assert(isActuallyEligible, `Recommended bank (${recBank.bankName}) is actually marked eligible in evaluation`);
      assert(recBank.maxLoanEligible > 0, `Recommended bank has positive calculated loan amount: ${recBank.maxLoanEligible}`);
      assert(recBank.roi > 0, `Recommended bank has verified interest rate: ${recBank.roi}%`);
      assert(Boolean(evalResult.recommendationReason), `Recommended bank has reason: ${evalResult.recommendationReason}`);
    }

    // -------------------------------------------------------------------
    // Test 5, 6, 7: Working Select option & Ineligible bank validation
    // -------------------------------------------------------------------
    console.log("\n--- TEST SUITE 3: Bank Selection Action & Server Validation ---");
    const testConvId = `test_conv_${Date.now()}`;
    await saveEligibilityState(testConvId, {
      hasCompletedEvaluation: true,
      lastEligibilityResult: evalResult,
      eligible_banks: eligibleEvals.map((e) => e.bankName),
      topBank: recBank?.bankName || "HDFC Bank",
      postEligibilityStage: "BANK_SELECTION",
      currentStep: "BANK_SELECTION",
    });

    const eligibleBankToSelect = eligibleEvals[0].bankName;
    const selectEligibleResult = await handlePostEligibilityWorkflow({
      conversationId: testConvId,
      userMessage: `I select ${eligibleBankToSelect}`,
      eligibilitySession: await getEligibilityState(testConvId),
      currentApplicant: testApplicant,
      bankSelectionAction: {
        bankName: eligibleBankToSelect,
        bankId: eligibleBankToSelect.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      },
      finalizeAndReturn: async (res, customState) => {
        if (customState) {
          const current = (await getEligibilityState(testConvId)) || {};
          await saveEligibilityState(testConvId, { ...current, ...customState });
        }
        return res;
      },
    });

    assert(
      selectEligibleResult !== null &&
      selectEligibleResult.reply.includes(`You selected **${eligibleBankToSelect}**`),
      `Selecting eligible bank prompts: 'You selected **${eligibleBankToSelect}**. Which city, branch, or pincode would you prefer?'`
    );

    const stateAfterSelect = await getEligibilityState(testConvId);
    assert(stateAfterSelect?.selectedBank === eligibleBankToSelect, `selectedBank persisted as ${eligibleBankToSelect}`);
    assert(stateAfterSelect?.selectedBankId !== undefined, `selectedBankId persisted: ${stateAfterSelect?.selectedBankId}`);

    // Ineligible Bank selection rejection test
    const ineligibleBankToSelect = ineligibleEvals[0].bankName;
    const selectIneligibleResult = await handlePostEligibilityWorkflow({
      conversationId: testConvId,
      userMessage: `I select ${ineligibleBankToSelect}`,
      eligibilitySession: stateAfterSelect,
      currentApplicant: testApplicant,
      bankSelectionAction: {
        bankName: ineligibleBankToSelect,
        bankId: ineligibleBankToSelect.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      },
      finalizeAndReturn: async (res, customState) => res,
    });

    assert(
      selectIneligibleResult !== null &&
      selectIneligibleResult.reply.includes("is not eligible"),
      `Selecting ineligible bank rejected with explanation: ${selectIneligibleResult?.reply.slice(0, 100)}`
    );

    // -------------------------------------------------------------------
    // Test 8, 9: Bank Manager Location Query & Verified Database Records
    // -------------------------------------------------------------------
    console.log("\n--- TEST SUITE 4: Verified Bank Manager Lookup from PostgreSQL ---");
    // Query manager for HDFC Bank in Pune
    const mgrResult = await lookupPostEligibilityBankManager({
      bankName: "HDFC Bank",
      city: "Pune",
    });

    assert(mgrResult.matchLevel !== "none", `Found matching records for HDFC Bank in Pune (matchLevel: ${mgrResult.matchLevel})`);
    
    // Also test by pincode e.g. 411038
    const mgrPinResult = await lookupPostEligibilityBankManager({
      bankName: "HDFC Bank",
      pincode: "411038",
    });
    assert(
      (mgrPinResult.managers && mgrPinResult.managers.length > 0) || mgrPinResult.matchLevel !== "none",
      `Lookup by PIN code 411038 returns verified records`
    );

    if (mgrResult.managers && mgrResult.managers.length > 0) {
      const sampleMgr = mgrResult.managers[0];
      const formatted = formatPostEligibilityManagerDetails("HDFC Bank", [sampleMgr]);
      assert(formatted.includes("- **Bank Name**:"), "Manager card includes '- **Bank Name**:'");
      assert(formatted.includes("- **Branch Name**:"), "Manager card includes '- **Branch Name**:'");
      assert(formatted.includes("- **Manager Name**:"), "Manager card includes '- **Manager Name**:'");
      assert(formatted.includes("- **Contact Number**:"), "Manager card includes '- **Contact Number**:'");
      assert(formatted.includes("- **Email Address**:"), "Manager card includes '- **Email Address**:'");
      assert(formatted.includes("- **Branch Address**:"), "Manager card includes '- **Branch Address**:'");
    }

    // -------------------------------------------------------------------
    // Test 10, 11: Profile Recalculation & Selection Revalidation
    // -------------------------------------------------------------------
    console.log("\n--- TEST SUITE 5: Dynamic Profile Recalculation & Revalidation ---");
    // Suppose user decreases salary drastically to ₹15,000 where previous bank becomes ineligible
    const recalcRes = await applyProfileUpdateAndRecalculate(
      testConvId,
      "update salary to 15000",
      testApplicant,
      { salary: 15000, monthlySalary: 15000 }
    );

    assert(recalcRes !== null, "Recalculation executed successfully");
    assert(recalcRes.reply.includes("Updated Assessment Sheet") || recalcRes.reply.includes("Recommended Bank") || recalcRes.reply.includes("Eligibility"), "Recalculation returned fresh assessment");

    const stateAfterRecalc = await getEligibilityState(testConvId);
    const savedApp = stateAfterRecalc?.applicant || stateAfterRecalc?.applicantProfile;
    assert(savedApp?.salary === 15000 || savedApp?.monthlyIncome === 15000, "Preserved updated salary as 15000");
    assert(savedApp?.age === 29, "Preserved unchanged age as 29");
    assert(savedApp?.cibil === 760 || savedApp?.cibilScore === 760, "Preserved unchanged CIBIL as 760");

    // Check if the previously selected bank was revalidated
    if (stateAfterRecalc?.lastEligibilityResult) {
      const stillEligible = stateAfterRecalc.lastEligibilityResult.evaluations.some(
        (e: any) => e.bankName === eligibleBankToSelect && e.isEligible
      );
      if (!stillEligible) {
        assert(!stateAfterRecalc.selectedBank, "Previously selected bank cleared because it is no longer eligible at ₹15,000 salary");
      } else {
        assert(stateAfterRecalc.selectedBank === eligibleBankToSelect, "Previously selected bank maintained because it remains eligible");
      }
    }

    // -------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------
    console.log("\n==========================================================");
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==========================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution threw error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAllTests();
