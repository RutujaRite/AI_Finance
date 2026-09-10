import { evaluateApplicantAgainstAllBanks, formatDynamicEligibilityReport, ApplicantProfile } from "../lib/dynamicEligibilityEngine";
import { getAllBankRulesForCategory, getBankRulesForCategory, getPolicyCibilAndTenure, classifyCategoryTier } from "../lib/masterPolicyParser";
import { getAllMasterPolicies } from "../lib/masterPolicies";

async function runTests() {
  console.log("================================================================================");
  console.log("TEST SUITE: ELIGIBILITY TABLE UPDATE VERIFICATION (ALL BANKS)");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Audit every single master policy rule for policyCibil and policyTenure
  console.log("--- 1. Testing Policy CIBIL & Tenure Resolution for all 23 active partner banks ---");
  const allMasterPolicies = getAllMasterPolicies();
  console.log(`Total Master Policies: ${allMasterPolicies.length}`);

  for (const master of allMasterPolicies) {
    const ruleTier1 = getBankRulesForCategory(master.bank_name, "CAT Super A");
    const ruleCatD = getBankRulesForCategory(master.bank_name, "CAT D Local Enterprise");
    const ruleGovt = getBankRulesForCategory(master.bank_name, "Central Government Department");

    console.log(`\n🏦 ${master.bank_name} (${master.bank_code}):`);
    console.log(`    Tier 1 Corporate -> CIBIL: "${ruleTier1?.policyCibil}" | Tenure: "${ruleTier1?.policyTenure}"`);
    console.log(`    CAT D / Standard -> CIBIL: "${ruleCatD?.policyCibil}" | Tenure: "${ruleCatD?.policyTenure}"`);
    console.log(`    Government       -> CIBIL: "${ruleGovt?.policyCibil}" | Tenure: "${ruleGovt?.policyTenure}"`);

    // Specific bank assertions
    if (master.bank_code === "ICICI") {
      assert(ruleTier1?.policyCibil === "-", "ICICI policy CIBIL must be '-'");
      assert(ruleTier1?.policyTenure === "-", "ICICI policy Tenure must be '-'");
    }
    if (master.bank_code === "AXIS") {
      assert(ruleTier1?.policyCibil === "700+", "Axis Bank policy CIBIL must be '700+'");
      assert(ruleTier1?.policyTenure === "-", "Axis Bank policy Tenure must be '-'");
    }
    if (master.bank_code === "HDFC") {
      assert(ruleTier1?.policyCibil === "-", "HDFC policy CIBIL must be '-'");
      assert(ruleTier1?.policyTenure === "12–84 months", "HDFC Super A / Tier 1 tenure must be '12–84 months'");
      assert(ruleCatD?.policyTenure === "12–60 months", "HDFC CAT D tenure must be '12–60 months'");
    }
    if (master.bank_code === "POONAWALLA") {
      assert(ruleTier1?.policyTenure === "Up to 7 years (84 months)", "Poonawalla Tier 1 tenure must be 'Up to 7 years (84 months)'");
      assert(ruleCatD?.policyCibil === "750+", "Poonawalla CAT D CIBIL must be '750+'");
      assert(ruleCatD?.policyTenure === "Up to 5 years (60 months)", "Poonawalla CAT D tenure must be 'Up to 5 years (60 months)'");
    }
    if (master.bank_code === "KOTAK") {
      assert(ruleTier1?.policyCibil === "> 700", "Kotak policy CIBIL must be '> 700'");
      assert(ruleGovt?.policyTenure === "Up to 6 years (72 months)", "Kotak Govt tenure must be 'Up to 6 years (72 months)'");
      assert(ruleTier1?.policyTenure === "1–5 years (12–60 months)", "Kotak standard tenure must be '1–5 years (12–60 months)'");
    }
    if (master.bank_code === "INDUSIND") {
      assert(ruleTier1?.policyCibil === "700+", "IndusInd policy CIBIL must be '700+'");
      assert(ruleTier1?.policyTenure === "Up to 72 months", "IndusInd Tier 1 tenure must be 'Up to 72 months'");
      assert(ruleCatD?.policyTenure === "-", "IndusInd Unlisted / Standard tenure must be '-'");
    }
    if (master.bank_code === "BANDHAN") {
      assert(ruleTier1?.policyCibil === "731+", "Bandhan standard CIBIL must be '731+'");
      assert(ruleCatD?.policyCibil === "750+", "Bandhan CAT D CIBIL must be '750+'");
      assert(ruleTier1?.policyTenure === "3–60 months", "Bandhan tenure must be '3–60 months'");
    }
    if (master.bank_code === "FIBE") {
      assert(ruleTier1?.policyCibil === "700+", "Fibe CIBIL must be '700+'");
      assert(ruleTier1?.policyTenure === "3–36 months", "Fibe tenure must be '3–36 months'");
    }
    if (master.bank_code === "FINNABLE") {
      assert(ruleTier1?.policyCibil === "700+", "Finnable CIBIL must be '700+'");
      assert(ruleTier1?.policyTenure === "12–36 months", "Finnable tenure must be '12–36 months'");
    }
    if (master.bank_code === "SBM") {
      assert(ruleTier1?.policyCibil === "720+", "SBM CIBIL must be '720+'");
      assert(ruleTier1?.policyTenure === "12–60 months", "SBM tenure must be '12–60 months'");
    }
    if (master.bank_code === "SMFG") {
      assert(ruleTier1?.policyCibil === "705+", "SMFG CIBIL must be '705+'");
      assert(ruleTier1?.policyTenure === "1–5 years (12–60 months)", "SMFG tenure must be '1–5 years (12–60 months)'");
    }
    if (master.bank_code === "TATA_CAPITAL") {
      assert(ruleTier1?.policyCibil === "725+", "Tata Capital CIBIL must be '725+'");
      assert(ruleTier1?.policyTenure === "Up to 72 months", "Tata Capital Tier 1 tenure must be 'Up to 72 months'");
      assert(ruleCatD?.policyTenure === "Up to 60 months", "Tata Capital CAT C/D tenure must be 'Up to 60 months'");
    }
    if (master.bank_code === "UTKARSH") {
      assert(ruleTier1?.policyCibil === "650+", "Utkarsh CIBIL must be '650+'");
      assert(ruleTier1?.policyTenure === "12–60 months", "Utkarsh tenure must be '12–60 months'");
    }
    if (master.bank_code === "YES_BANK") {
      assert(ruleTier1?.policyCibil === "731+", "Yes Bank CIBIL must be '731+'");
      assert(ruleTier1?.policyTenure === "Up to 60 months", "Yes Bank standard tenure must be 'Up to 60 months'");
    }
  }

  // 2. Test Full Applicant Evaluation and Report Generation
  console.log("\n--- 2. Testing Dynamic Eligibility Report Generation and Table Formatting ---");
  const applicant: ApplicantProfile = {
    loanType: "Personal Loan",
    companyName: "Infosys Limited",
    monthlyIncome: 85000,
    cibil: 760,
    loanAmount: 500000,
    tenureMonths: 36,
    existingEmi: 0,
    age: 29,
  };

  const evalResult = await evaluateApplicantAgainstAllBanks(applicant, applicant.loanType);
  const report = formatDynamicEligibilityReport(applicant, evalResult);

  console.log("\nGenerated Report Snippet:\n");
  console.log(report.substring(0, 1600));

  // Assertions on the table markdown
  assert(report.includes("| # | Bank Name | Estimated Monthly EMI | CIBIL | Tenure |"), "Table header must have exact columns: '#', 'Bank Name', 'Estimated Monthly EMI', 'CIBIL', 'Tenure'");
  assert(report.includes("| :--- | :--- | :--- | :--- | :--- |"), "Table separator must match 5 columns");
  assert(!report.includes("| Interest Rate (ROI) |"), "Table must NOT contain 'Interest Rate (ROI)' column");
  assert(!report.includes("| Maximum Loan Limit |"), "Table must NOT contain 'Maximum Loan Limit' column");
  assert(!report.includes("| Processing Fee |"), "Table must NOT contain 'Processing Fee' column");

  // Verify that rows contain proper CIBIL and Tenure
  const lines = report.split("\n");
  const tableRows = lines.filter(l => l.startsWith("|") && !l.includes("Bank Name") && !l.includes(":---") && !l.includes("Parameter"));
  console.log(`\nTable row count: ${tableRows.length}`);
  assert(tableRows.length > 0, "Must have approved partner banks in table");
  tableRows.forEach(r => console.log(`  Row: ${r}`));

  // Check that row formatting adheres strictly to 5 columns
  tableRows.forEach((r, idx) => {
    const cols = r.split("|").map(c => c.trim()).filter(Boolean);
    assert(cols.length === 5, `Row ${idx + 1} must contain exactly 5 columns, got ${cols.length}: "${r}"`);
  });

  // 3. Test calculation integrity (must be identical)
  console.log("\n--- 3. Testing Calculation Integrity ---");
  assert(evalResult.eligibleBanks.length > 0, "Eligible banks count must be greater than 0");
  for (const b of evalResult.eligibleBanks) {
    assert(b.monthlyEmi > 0, `${b.bankName} monthly EMI must be calculated`);
    assert(b.calculatedFoir >= 0, `${b.bankName} FOIR must be calculated`);
    assert(b.maxLoanEligible > 0, `${b.bankName} maxLoanEligible must be calculated`);
    assert(typeof b.policyCibil === "string" && b.policyCibil.length > 0, `${b.bankName} policyCibil must be valid string`);
    assert(typeof b.policyTenure === "string" && b.policyTenure.length > 0, `${b.bankName} policyTenure must be valid string`);
  }

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
