import { evaluateApplicantAgainstAllBanks, formatDynamicEligibilityReport, ApplicantProfile } from "../lib/dynamicEligibilityEngine";
import * as assert from "assert";

async function runTest() {
  console.log("=== Testing Updated Eligibility UI ===");

  const applicant: ApplicantProfile = {
    loanType: "Personal Loan",
    companyName: "Infosys",
    monthlyIncome: 85000,
    cibil: 780,
    existingEmi: 10000,
    loanAmount: 500000,
    tenureMonths: 60,
    age: 32,
    employmentType: "Salaried",
  };

  const evalResult = await evaluateApplicantAgainstAllBanks(applicant, applicant.loanType);
  const report = formatDynamicEligibilityReport(applicant, evalResult);

  console.log("--- GENERATED REPORT ---");
  console.log(report);
  console.log("------------------------");

  // 1. Verify "Key Eligibility Reasons" is completely removed
  assert.strictEqual(
    report.includes("Key Eligibility Reasons"),
    false,
    "FAIL: 'Key Eligibility Reasons' section should be completely removed"
  );

  // 2. Verify "Annual Interest Rate (ROI)" is NOT present in recommendation details
  assert.strictEqual(
    report.includes("Annual Interest Rate (ROI)"),
    false,
    "FAIL: 'Annual Interest Rate (ROI)' should not be present in recommendation details"
  );

  // 3. Verify "Maximum Eligible Loan Capacity" is NOT present
  assert.strictEqual(
    report.includes("Maximum Eligible Loan Capacity"),
    false,
    "FAIL: 'Maximum Eligible Loan Capacity' should not be present"
  );

  // 4. Verify "Processing Fee" is NOT present
  assert.strictEqual(
    report.includes("Processing Fee"),
    false,
    "FAIL: 'Processing Fee' should not be present"
  );

  // 5. Verify fields that MUST be kept in Recommendation Details:
  assert.ok(
    report.includes("**Recommendation Details**:"),
    "FAIL: 'Recommendation Details' header should be present"
  );
  assert.ok(
    report.includes("- **Bank Name**:"),
    "FAIL: 'Bank Name' must be present in recommendation details"
  );
  assert.ok(
    report.includes("- **Status**: ✅ **Eligible"),
    "FAIL: 'Status' must be present in recommendation details"
  );
  assert.ok(
    report.includes("- **Estimated Monthly EMI**:"),
    "FAIL: 'Estimated Monthly EMI' must be present in recommendation details"
  );
  assert.ok(
    report.includes("- **CIBIL**:"),
    "FAIL: 'CIBIL' must be present in recommendation details"
  );
  assert.ok(
    report.includes("- **Tenure**:"),
    "FAIL: 'Tenure' must be present in recommendation details"
  );

  // 6. Verify table columns
  assert.ok(
    report.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |"),
    "FAIL: Table header must include Bank, Status, CIBIL, Tenure, Est. EMI"
  );

  // 7. Verify no mentions of ROI/interest rate in the tip callout
  const tipSection = report.split("### 🏆")[1]?.split("### ✅")[0] || "";
  assert.strictEqual(
    /interest rate|% p\.a\./i.test(tipSection),
    false,
    "FAIL: Recommendation callout/details must not contain interest rate or % p.a."
  );

  console.log("✅ ALL ASSERTIONS PASSED SUCCESSFULLY!");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
