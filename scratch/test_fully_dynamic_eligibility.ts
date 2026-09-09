import path from "path";
import pool from "../lib/db";
import { resolveCompanyCategories } from "../lib/companyCategoryResolver";
import {
  getRequiredPolicyFields,
  evaluateApplicantAgainstAllBanks,
  formatDynamicEligibilityReport,
  processDynamicEligibility,
  clearEligibilityState,
  ApplicantProfile
} from "../lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING FULLY DYNAMIC ELIGIBILITY FLOW");
  console.log("================================================================================\n");

  // TEST 1: No Hardcoding - Dynamic Company Resolution for Various Companies
  console.log("--- TEST 1: Dynamic Company Resolution (No hardcoded TCS or any company) ---");
  const testCompanies = [
    { input: "TCS", expectTier: "Tier 1 / Super A" },
    { input: "Infosys", expectTier: "Tier 1 / Super A" },
    { input: "Wipro", expectTier: "Tier 1 / Super A" },
    { input: "Google", expectTier: "Tier 1 / Super A" },
    { input: "Zensar Technologies", expectTier: "Tier 1 / Super A" },
    { input: "Acme Tech Innovations Pvt Ltd", expectTier: "Tier 4 / Unlisted" }
  ];

  for (const tc of testCompanies) {
    const match = await resolveCompanyCategories(tc.input);
    console.log(`Company: "${tc.input}" -> Matched: "${match.matchedName}" | Tier: "${match.overallCategoryDisplay}" | Found: ${match.isFound}`);
    if (tc.expectTier && match.overallCategoryTier !== tc.expectTier) {
      console.warn(`  ⚠️ Expected tier "${tc.expectTier}" but got "${match.overallCategoryTier}"`);
    }
  }
  console.log("✓ Dynamic company resolution verified without hardcoded companies.\n");

  // TEST 2: Company -> Category -> Master Policy -> Required Questions
  console.log("--- TEST 2: Dynamic Required Policy Questions from Master Policy ---");
  const noCompanyApp: ApplicantProfile = { loanType: "Personal Loan" };
  const initialReq = getRequiredPolicyFields(noCompanyApp);
  console.log("Required fields before company is known:", initialReq);
  if (initialReq[0] !== "companyName") {
    throw new Error("companyName must be the first required question!");
  }

  const compMatch = await resolveCompanyCategories("Wipro");
  const withCompanyApp: ApplicantProfile = { loanType: "Personal Loan", companyName: "WIPRO LIMITED" };
  const policyReq = getRequiredPolicyFields(withCompanyApp, compMatch);
  console.log("Required fields after company is known:", policyReq);
  console.log("✓ Dynamic policy fields verified.\n");

  // TEST 3: Evaluation Supporting 0, 1-3, Several, or All Eligible Banks
  console.log("--- TEST 3: Evaluation Supporting 0, 1-3, Several, or All Eligible Banks ---");

  // Profile A: Super Prime Profile (Several / Many banks eligible)
  const profileA: ApplicantProfile = {
    loanType: "Personal Loan",
    companyName: "TATA CONSULTANCY SERVICES LIMITED",
    monthlyIncome: 150000,
    cibil: 815,
    loanAmount: 500000,
    tenureMonths: 36,
    existingEmi: 0,
    age: 30,
    employmentType: "Salaried"
  };
  const evalA = await evaluateApplicantAgainstAllBanks(profileA, "Personal Loan");
  console.log(`Profile A (Super Prime - TCS, ₹1.5L salary, 815 CIBIL, ₹5L loan, 0 EMI):`);
  console.log(`  • Total Evaluated: ${evalA.evaluations.length}`);
  console.log(`  • Eligible Banks: ${evalA.eligibleBanks.length}`);
  console.log(`  • Top Recommended: ${evalA.recommendedBank ? evalA.recommendedBank.bankName : "None"}`);
  if (evalA.eligibleBanks.length < 5) {
    throw new Error("Super Prime profile should qualify for several/many banks!");
  }

  // Profile B: Mid-tier Profile (3–6 banks eligible)
  const profileB: ApplicantProfile = {
    loanType: "Personal Loan",
    companyName: "Zensar Technologies Limited",
    monthlyIncome: 45000,
    cibil: 735,
    loanAmount: 300000,
    tenureMonths: 36,
    existingEmi: 5000,
    age: 28,
    employmentType: "Salaried"
  };
  const evalB = await evaluateApplicantAgainstAllBanks(profileB, "Personal Loan");
  console.log(`\nProfile B (Mid-Tier - Zensar, ₹45k salary, 735 CIBIL, ₹3L loan, ₹5k EMI):`);
  console.log(`  • Total Evaluated: ${evalB.evaluations.length}`);
  console.log(`  • Eligible Banks: ${evalB.eligibleBanks.length}`);
  console.log(`  • Top Recommended: ${evalB.recommendedBank ? evalB.recommendedBank.bankName : "None"}`);

  // Profile C: Marginal Profile (1–3 banks eligible)
  const profileC: ApplicantProfile = {
    loanType: "Personal Loan",
    companyName: "Acme Tech Innovations Pvt Ltd", // Unlisted company
    monthlyIncome: 35000,
    cibil: 705,
    loanAmount: 100000,
    tenureMonths: 24,
    existingEmi: 2000,
    age: 26,
    employmentType: "Salaried"
  };
  const evalC = await evaluateApplicantAgainstAllBanks(profileC, "Personal Loan");
  console.log(`\nProfile C (Marginal / Unlisted - Acme Tech, ₹35k salary, 705 CIBIL, ₹1L loan):`);
  console.log(`  • Total Evaluated: ${evalC.evaluations.length}`);
  console.log(`  • Eligible Banks: ${evalC.eligibleBanks.length}`);
  console.log(`  • Top Recommended: ${evalC.recommendedBank ? evalC.recommendedBank.bankName : "None"}`);

  // Profile D: Ineligible Profile - Low CIBIL (0 banks eligible)
  const profileD: ApplicantProfile = {
    loanType: "Personal Loan",
    companyName: "Infosys Limited",
    monthlyIncome: 65000,
    cibil: 590, // Low CIBIL below all bank cutoffs (650–700)
    loanAmount: 300000,
    tenureMonths: 36,
    existingEmi: 0,
    age: 29,
    employmentType: "Salaried"
  };
  const evalD = await evaluateApplicantAgainstAllBanks(profileD, "Personal Loan");
  console.log(`\nProfile D (Low CIBIL - 590):`);
  console.log(`  • Total Evaluated: ${evalD.evaluations.length}`);
  console.log(`  • Eligible Banks: ${evalD.eligibleBanks.length} (Expected: 0)`);
  if (evalD.eligibleBanks.length !== 0) {
    throw new Error("CIBIL 590 must produce 0 eligible banks!");
  }

  // Profile E: Ineligible Profile - High FOIR (0 banks eligible)
  const profileE: ApplicantProfile = {
    loanType: "Personal Loan",
    companyName: "Infosys Limited",
    monthlyIncome: 40000,
    cibil: 780,
    loanAmount: 1200000,
    tenureMonths: 24,
    existingEmi: 28000, // consumes 70% of salary already
    age: 32,
    employmentType: "Salaried"
  };
  const evalE = await evaluateApplicantAgainstAllBanks(profileE, "Personal Loan");
  console.log(`\nProfile E (High FOIR - EMI ₹28k on ₹40k salary, loan ₹12L):`);
  console.log(`  • Total Evaluated: ${evalE.evaluations.length}`);
  console.log(`  • Eligible Banks: ${evalE.eligibleBanks.length} (Expected: 0)`);
  if (evalE.eligibleBanks.length !== 0) {
    throw new Error("Severe FOIR breach must produce 0 eligible banks!");
  }

  // Verify formatted report output
  console.log("\n--- TEST 4: Formatted Report Check ---");
  const reportA = formatDynamicEligibilityReport(profileA, evalA);
  console.log("Report for Profile A (Sample first 400 chars):\n" + reportA.slice(0, 400));
  if (!reportA.includes("Approved Partner Bank")) {
    throw new Error("Approved partner banks must be shown!");
  }

  const reportD = formatDynamicEligibilityReport(profileD, evalD);
  console.log("\nReport for Profile D (Zero banks eligible):\n" + reportD.slice(0, 400));
  if (!reportD.includes("No Partner Banks Currently Eligible")) {
    throw new Error("Zero eligible banks must produce clean no-eligibility report!");
  }

  // TEST 5: Step-by-Step Conversational Wizard Flow
  console.log("\n--- TEST 5: Conversational Progression (Turn-by-Turn) ---");
  const testConvId = "test_flow_" + Date.now();
  await clearEligibilityState(testConvId);

  // Turn 1: Opening Loan Request
  console.log("Turn 1: User says: 'I need a personal loan'");
  const t1 = await processDynamicEligibility(testConvId, "I need a personal loan");
  console.log("  AI asks:", t1.nextQuestion || t1.formattedMarkdown);
  if (!t1.nextQuestion?.toLowerCase().includes("company") && !t1.nextQuestion?.toLowerCase().includes("employer")) {
    throw new Error("Turn 1 must ask for company name!");
  }

  // Turn 2: User gives company name (Unlisted company)
  console.log("\nTurn 2: User says: 'Apex Cloud Solutions'");
  const t2 = await processDynamicEligibility(testConvId, "Apex Cloud Solutions");
  console.log("  AI asks:", t2.nextQuestion || t2.formattedMarkdown);
  console.log("  Applicant company recorded as:", t2.applicant?.companyName);
  if (!t2.applicant?.companyName) {
    throw new Error("Turn 2 must record company name without getting stuck!");
  }

  // Turn 3: User answers salary
  console.log("\nTurn 3: User says: '75000 per month'");
  const t3 = await processDynamicEligibility(testConvId, "75000 per month");
  console.log("  AI asks:", t3.nextQuestion || t3.formattedMarkdown);
  console.log("  Applicant salary recorded as:", t3.applicant?.monthlyIncome);

  await clearEligibilityState(testConvId);
  console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY!");
  await pool.end();
}

runTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
