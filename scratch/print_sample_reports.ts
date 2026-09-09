import { evaluateApplicantAgainstAllBanks, formatDynamicEligibilityReport } from "../lib/dynamicEligibilityEngine";

async function checkReports() {
  console.log("\n=======================================================");
  console.log("CASE 1: ZERO ELIGIBLE BANKS (LOW CIBIL 620)");
  console.log("=======================================================");
  const pLowCibil = {
    loanType: "Personal Loan",
    companyName: "Flipkart",
    monthlyIncome: 50000,
    cibil: 620,
    age: 29,
    loanAmount: 200000,
    tenureMonths: 24,
    existingEmi: 0,
  };
  const resLowCibil = await evaluateApplicantAgainstAllBanks(pLowCibil, pLowCibil.loanType);
  console.log(formatDynamicEligibilityReport(pLowCibil, resLowCibil));

  console.log("\n=======================================================");
  console.log("CASE 2: ZERO ELIGIBLE BANKS (OVER-LEVERAGED FOIR)");
  console.log("=======================================================");
  const pOverLev = {
    loanType: "Personal Loan",
    companyName: "Wipro Limited",
    monthlyIncome: 40000,
    cibil: 750,
    age: 30,
    loanAmount: 500000,
    tenureMonths: 36,
    existingEmi: 28000,
  };
  const resOverLev = await evaluateApplicantAgainstAllBanks(pOverLev, pOverLev.loanType);
  console.log(formatDynamicEligibilityReport(pOverLev, resOverLev));

  console.log("\n=======================================================");
  console.log("CASE 3: EXACTLY ONE ELIGIBLE BANK (AGE 19)");
  console.log("=======================================================");
  const pAge19 = {
    loanType: "Personal Loan",
    companyName: "Tech Solutions",
    monthlyIncome: 25000,
    cibil: 710,
    age: 19,
    loanAmount: 50000,
    tenureMonths: 12,
    existingEmi: 0,
  };
  const resAge19 = await evaluateApplicantAgainstAllBanks(pAge19, pAge19.loanType);
  console.log(formatDynamicEligibilityReport(pAge19, resAge19));

  console.log("\n=======================================================");
  console.log("CASE 4: EXACTLY 2-3 ELIGIBLE BANKS (SALARY ₹22k, AGE 26)");
  console.log("=======================================================");
  const pMidSalary = {
    loanType: "Personal Loan",
    companyName: "Local Retail Store",
    monthlyIncome: 22000,
    cibil: 710,
    age: 26,
    loanAmount: 100000,
    tenureMonths: 24,
    existingEmi: 0,
  };
  const resMidSalary = await evaluateApplicantAgainstAllBanks(pMidSalary, pMidSalary.loanType);
  console.log(formatDynamicEligibilityReport(pMidSalary, resMidSalary));
}

checkReports().catch(console.error);
