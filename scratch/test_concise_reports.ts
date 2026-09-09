import { evaluateApplicantAgainstAllBanks, formatDynamicEligibilityReport, ApplicantProfile } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function main() {
  console.log("================================================================================");
  console.log("PROFILE 1: 1 BANK ELIGIBLE (Young Age 19, Fibe sole eligible)");
  console.log("================================================================================\n");

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
  const report1 = formatDynamicEligibilityReport(p1, eval1);
  console.log(report1);

  console.log("\n================================================================================");
  console.log("PROFILE 2: 2-3 BANKS ELIGIBLE (Salary ₹22k, CIBIL 710, ₹1L loan, 24m)");
  console.log("================================================================================\n");

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
  const report2 = formatDynamicEligibilityReport(p2, eval2);
  console.log(report2);

  console.log("\n================================================================================");
  console.log("PROFILE 3: MANY BANKS ELIGIBLE (Super Prime - TCS, ₹1.5L salary, CIBIL 810, ₹5L loan, 36m)");
  console.log("================================================================================\n");

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
  const report3 = formatDynamicEligibilityReport(p3, eval3);
  console.log(report3);

  console.log("\n================================================================================");
  console.log("PROFILE 4: 0 BANKS ELIGIBLE (Over-leveraged FOIR > 100%)");
  console.log("================================================================================\n");

  const p4: ApplicantProfile = {
    companyName: "Wipro",
    monthlyIncome: 40000,
    cibil: 750,
    loanAmount: 500000,
    tenureMonths: 36,
    existingEmi: 28000,
    age: 30,
    employmentType: "Salaried",
    loanType: "Personal Loan",
  };
  const eval4 = await evaluateApplicantAgainstAllBanks(p4, "Personal Loan");
  const report4 = formatDynamicEligibilityReport(p4, eval4);
  console.log(report4);
}

main()
  .then(() => pool.end())
  .catch(err => {
    console.error(err);
    pool.end();
  });
