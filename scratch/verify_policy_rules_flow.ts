import assert from "assert";
import { evaluateApplicantAgainstAllBanks, formatDynamicEligibilityReport, ApplicantProfile } from "../lib/dynamicEligibilityEngine";
import { getAllBankRulesForCategory, getBankRulesForCategory } from "../lib/masterPolicyParser";
import { resolveCompanyCategories } from "../lib/companyCategoryResolver";

async function runVerification() {
  console.log("================================================================================");
  console.log("🧪 VERIFYING DYNAMIC POLICY FILE ELIGIBILITY FLOW");
  console.log("================================================================================\n");

  // TEST 1: Exclude Home Loan policy from Personal Loan
  console.log("--- TEST 1: Home Loan Exclusion ---");
  const compMatch = await resolveCompanyCategories("Tata Consultancy Services");
  const allRules = getAllBankRulesForCategory(compMatch, "Personal Loan");
  const homeLoanInRules = allRules.some(r => r.bankCode === "HOME_LOAN" || /home_loan/i.test(r.fileName));
  assert.strictEqual(homeLoanInRules, false, "Home loan policy must NEVER be included in Personal Loan rules!");
  console.log(`✓ Verified: 0 Home Loan policies loaded. Total Personal Loan policies loaded: ${allRules.length}\n`);

  // TEST 2: Policy File Existence & Values Grounded
  console.log("--- TEST 2: Grounded Policy Rules ---");
  for (const rule of allRules) {
    assert(rule.minSalary > 0, `${rule.bankName}: minSalary must be > 0`);
    assert(rule.minAge >= 18, `${rule.bankName}: minAge must be >= 18`);
    assert(rule.maxAge <= 70, `${rule.bankName}: maxAge must be <= 70`);
    assert(rule.minLoanAmount > 0, `${rule.bankName}: minLoanAmount must be > 0`);
    assert(rule.maxLoanAmount >= rule.minLoanAmount, `${rule.bankName}: maxLoanAmount >= minLoanAmount`);
    assert(rule.minTenureMonths > 0, `${rule.bankName}: minTenureMonths must be > 0`);
    assert(rule.maxTenureMonths >= rule.minTenureMonths, `${rule.bankName}: maxTenureMonths >= minTenureMonths`);
    assert(rule.foirPercent > 0 && rule.foirPercent <= 100, `${rule.bankName}: foirPercent must be between 1 and 100`);
    assert(rule.roi > 0 && rule.roi <= 40, `${rule.bankName}: roi must be valid interest rate`);
    assert(rule.policySource.includes(rule.fileName), `${rule.bankName}: policySource must reference file`);
  }
  console.log(`✓ All ${allRules.length} bank policies have valid, grounded parameters.\n`);

  // TEST 3: Prime Applicant Evaluation (Should have ELIGIBLE banks)
  console.log("--- TEST 3: Prime Profile Evaluation ---");
  const primeApplicant: ApplicantProfile = {
    loanType: "Personal Loan",
    companyName: "TATA CONSULTANCY SERVICES LIMITED",
    monthlyIncome: 120000,
    cibil: 780,
    age: 30,
    loanAmount: 500000,
    tenureMonths: 36,
    existingEmi: 0,
    employmentType: "Salaried",
  };

  const primeResult = await evaluateApplicantAgainstAllBanks(primeApplicant, "Personal Loan");
  console.log(`Evaluated: ${primeResult.evaluations.length} banks`);
  console.log(`Eligible: ${primeResult.eligibleBanks.length}`);
  console.log(`Needs Review: ${primeResult.reviewBanks.length}`);
  console.log(`Ineligible: ${primeResult.ineligibleBanks.length}`);

  assert(primeResult.eligibleBanks.length > 0, "Prime applicant must have eligible banks");
  
  // Verify EMI calculation for first eligible bank
  const firstEligible = primeResult.eligibleBanks[0];
  assert(firstEligible.monthlyEmi > 0, "Monthly EMI must be > 0");
  assert(firstEligible.status === "ELIGIBLE", "Status must be ELIGIBLE");
  console.log(`Top Eligible: ${firstEligible.bankName} | ROI: ${firstEligible.roi}% | EMI: ₹${firstEligible.monthlyEmi}`);

  // TEST 4: Table Rendering Format
  console.log("\n--- TEST 4: Table Rendering Format ---");
  const report = formatDynamicEligibilityReport(primeApplicant, primeResult);
  assert(report.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |"), "Must contain exact table header");
  assert(report.includes("✅ ELIGIBLE"), "Must contain ✅ ELIGIBLE icon");
  console.log("Sample Output Table Snippet:\n");
  const tableLines = report.split("\n").filter(l => l.startsWith("|"));
  console.log(tableLines.slice(0, 8).join("\n"));
  console.log("\n✓ Table format verified.\n");

  // TEST 5: Unlisted / Needs Review Applicant Evaluation
  console.log("--- TEST 5: Standard / Unlisted Corporate Evaluation (NEEDS_REVIEW check) ---");
  const unlistedApplicant: ApplicantProfile = {
    loanType: "Personal Loan",
    companyName: "Acme Small Enterprise Proprietorship",
    monthlyIncome: 65000,
    cibil: 730,
    age: 32,
    loanAmount: 300000,
    tenureMonths: 36,
    existingEmi: 5000,
    employmentType: "Salaried",
  };

  const unlistedResult = await evaluateApplicantAgainstAllBanks(unlistedApplicant, "Personal Loan");
  console.log(`Unlisted Evaluation: ${unlistedResult.evaluations.length} banks`);
  console.log(`Eligible: ${unlistedResult.eligibleBanks.length}`);
  console.log(`Needs Review: ${unlistedResult.reviewBanks.length}`);
  console.log(`Ineligible: ${unlistedResult.ineligibleBanks.length}`);

  const hasNeedsReview = unlistedResult.evaluations.some(e => e.status === "NEEDS_REVIEW");
  console.log(`Has NEEDS_REVIEW status banks: ${hasNeedsReview}`);
  assert(hasNeedsReview, "Unlisted profile should produce banks with status NEEDS_REVIEW");

  const unlistedReport = formatDynamicEligibilityReport(unlistedApplicant, unlistedResult);
  assert(unlistedReport.includes("⚠️ NEEDS_REVIEW"), "Report must include ⚠️ NEEDS_REVIEW indicator");
  console.log("Sample Unlisted Table Snippet:\n");
  const unlistedTableLines = unlistedReport.split("\n").filter(l => l.startsWith("|"));
  console.log(unlistedTableLines.slice(0, 8).join("\n"));
  console.log("\n✓ NEEDS_REVIEW verified.\n");

  // TEST 6: Ineligible Applicant (Low Salary, Low CIBIL)
  console.log("--- TEST 6: Ineligible Applicant ---");
  const ineligApplicant: ApplicantProfile = {
    loanType: "Personal Loan",
    companyName: "Infosys",
    monthlyIncome: 12000,
    cibil: 550,
    age: 19,
    loanAmount: 1000000,
    tenureMonths: 60,
    existingEmi: 8000,
    employmentType: "Salaried",
  };

  const ineligResult = await evaluateApplicantAgainstAllBanks(ineligApplicant, "Personal Loan");
  assert.strictEqual(ineligResult.eligibleBanks.length, 0, "Ineligible profile must have 0 eligible banks");
  assert.strictEqual(ineligResult.reviewBanks.length, 0, "Ineligible profile must have 0 review banks");
  const ineligReport = formatDynamicEligibilityReport(ineligApplicant, ineligResult);
  assert(ineligReport.includes("❌ NOT_ELIGIBLE"), "Ineligible table must contain ❌ NOT_ELIGIBLE");
  console.log("✓ Ineligible flow verified.\n");

  console.log("================================================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("================================================================================\n");
}

runVerification().catch(err => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
