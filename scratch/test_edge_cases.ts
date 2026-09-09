import { evaluateApplicantAgainstAllBanks } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function runEdgeCases() {
  console.log("=== TESTING EDGE CASES: INELIGIBILITY FILTERING ===");

  // Profile with Salary = ₹22,000, CIBIL = 670
  // Several banks require salary >= 25,000 or 30,000, and CIBIL >= 700 or 720.
  const applicant = {
    loanType: "Personal Loan",
    companyName: "Local Retail Store",
    monthlyIncome: 22000,
    cibil: 670,
    loanAmount: 100000,
    tenureMonths: 24,
    existingEmi: 0,
    age: 26,
    employmentType: "Salaried",
  };

  const result = await evaluateApplicantAgainstAllBanks(applicant, "Personal Loan");

  console.log("\n=== EDGE CASE RESULTS SUMMARY ===");
  console.log("Total Evaluated:", result.evaluations.length);
  console.log("Eligible Banks Count:", result.eligibleBanks.length);
  console.log("Ineligible Banks Filtered Out Count:", result.ineligibleBanks.length);

  console.log("\nEligible Banks:");
  result.eligibleBanks.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.bankName} - ROI: ${b.roi}% - EMI: ₹${b.monthlyEmi}`);
  });

  console.log("\nIneligible Banks Filtered Out:");
  result.ineligibleBanks.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.bankName} - Reasons: ${b.failureReasons.join("; ")}`);
  });

  await pool.end();
}

runEdgeCases().catch(console.error);
