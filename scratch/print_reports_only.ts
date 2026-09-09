import { evaluateApplicantAgainstAllBanks, formatDynamicEligibilityReport, ApplicantProfile } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function main() {
  // Silence console.log during evaluation
  const origLog = console.log;
  console.log = () => {};

  const p1: ApplicantProfile = {
    companyName: "Tech Solutions",
    monthlyIncome: 25000,
    cibil: 710,
    loanAmount: 50000,
    tenureMonths: 12,
    existingEmi: 0,
    age: 19,
    employmentType: "Salaried",
    loanType: "Personal Loan",
  };
  const eval1 = await evaluateApplicantAgainstAllBanks(p1, "Personal Loan");
  const rep1 = formatDynamicEligibilityReport(p1, eval1);

  const p2: ApplicantProfile = {
    companyName: "Infosys Limited",
    monthlyIncome: 22000,
    cibil: 710,
    loanAmount: 100000,
    tenureMonths: 24,
    existingEmi: 0,
    age: 26,
    employmentType: "Salaried",
    loanType: "Personal Loan",
  };
  const eval2 = await evaluateApplicantAgainstAllBanks(p2, "Personal Loan");
  const rep2 = formatDynamicEligibilityReport(p2, eval2);

  const p3: ApplicantProfile = {
    companyName: "Tata Consultancy Services",
    monthlyIncome: 150000,
    cibil: 810,
    loanAmount: 500000,
    tenureMonths: 36,
    existingEmi: 0,
    age: 32,
    employmentType: "Salaried",
    loanType: "Personal Loan",
  };
  const eval3 = await evaluateApplicantAgainstAllBanks(p3, "Personal Loan");
  const rep3 = formatDynamicEligibilityReport(p3, eval3);

  // Restore console.log
  console.log = origLog;

  console.log("=== OUTPUT 1: EXACTLY 1 BANK ELIGIBLE ===");
  console.log(rep1);
  console.log("\n=== OUTPUT 2: 2-3 BANKS ELIGIBLE ===");
  console.log(rep2);
  console.log("\n=== OUTPUT 3: MANY BANKS ELIGIBLE ===");
  console.log(rep3);
}

main()
  .then(() => pool.end())
  .catch(err => {
    console.error(err);
    pool.end();
  });
