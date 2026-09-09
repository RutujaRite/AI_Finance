import { evaluateApplicantAgainstAllBanks } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function run() {
  console.log("=== RUNNING DIRECT EVALUATION TEST ===");

  const applicant = {
    loanType: "Personal Loan",
    companyName: "Google India",
    monthlyIncome: 120000,
    cibil: 780,
    loanAmount: 500000,
    tenureMonths: 36,
    existingEmi: 0,
    age: 29,
    employmentType: "Salaried",
  };

  const result = await evaluateApplicantAgainstAllBanks(applicant, "Personal Loan");

  console.log("\n=== TEST RESULTS SUMMARY ===");
  console.log("Total Evaluated:", result.evaluations.length);
  console.log("Eligible Banks Count:", result.eligibleBanks.length);
  console.log("Ineligible Banks Count:", result.ineligibleBanks.length);
  console.log("Top Recommended Bank:", result.recommendedBank?.bankName, "@", result.recommendedBank?.roi + "%");

  console.log("\nEligible Banks:");
  result.eligibleBanks.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.bankName} - ROI: ${b.roi}% - EMI: ₹${b.monthlyEmi} - Limit: ₹${b.maxLoanEligible}`);
  });

  console.log("\nIneligible Banks Filtered Out:");
  result.ineligibleBanks.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.bankName} - Reasons: ${b.failureReasons.join("; ")}`);
  });

  await pool.end();
}

run().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
