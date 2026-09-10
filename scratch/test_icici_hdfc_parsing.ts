import assert from "assert";
import {
  parseIciciPolicyCibilAndTenure,
  parseHdfcPolicyCibilAndTenure,
  getBankRulesForCategory,
  classifyCategoryTier,
} from "../lib/masterPolicyParser";
import {
  evaluateApplicantAgainstAllBanks,
  formatDynamicEligibilityReport,
  ApplicantProfile,
} from "../lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("================================================================================");
  console.log("TEST: ICICI and HDFC Master Policy Dynamic CIBIL and Tenure Parsing");
  console.log("================================================================================\n");

  // --------------------------------------------------------------------------------
  // 1. ICICI BANK TESTS
  // --------------------------------------------------------------------------------
  console.log("--- 1. Testing ICICI Bank Policy Parsing ---");

  const iciciCategories = [
    "Top Corporate",
    "Elite",
    "Super-Prime",
    "Preferred",
    "Defense",
    "Doctors",
    "NRIs and Pensioners",
    "Open Market",
    "Government 1",
    "Government 2 - MP, AP, J&K, Punjab and Haryana only",
    "Unlisted",
    null,
    undefined,
  ];

  for (const cat of iciciCategories) {
    const result = parseIciciPolicyCibilAndTenure(undefined, cat);
    console.log(`  ICICI [${cat || "Empty/Default"}]:`);
    console.log(`    CIBIL:  "${result.policyCibil}"`);
    console.log(`    Tenure: "${result.policyTenure}"`);

    // ICICI policy explicitly states:
    // - "A CIBIL pricing band is not automatically an absolute eligibility cutoff."
    // - "Absolute Minimum CIBIL for approval: NOT_DEFINED / NEEDS_REVIEW"
    // - "Minimum Tenure: NOT_DEFINED / NEEDS_REVIEW"
    // - "Maximum Tenure: NOT_DEFINED / NEEDS_REVIEW"
    assert.strictEqual(
      result.policyCibil,
      "-",
      `ICICI policy CIBIL must be '-' for category '${cat}' because policy does not define an approval cutoff`
    );
    assert.strictEqual(
      result.policyTenure,
      "-",
      `ICICI policy Tenure must be '-' for category '${cat}' because policy does not define tenure limits`
    );

    // Also verify via getBankRulesForCategory
    const rule = getBankRulesForCategory("ICICI Bank", cat);
    assert(rule !== null, `Rule should load for ICICI with category '${cat}'`);
    assert.strictEqual(rule.policyCibil, "-", `rule.policyCibil must be '-' for ICICI`);
    assert.strictEqual(rule.policyTenure, "-", `rule.policyTenure must be '-' for ICICI`);
  }
  console.log("✓ ICICI Bank: All categories verified. CIBIL is '-', Tenure is '-' (pricing bands correctly distinguished from approval cutoff).\n");

  // --------------------------------------------------------------------------------
  // 2. HDFC BANK TESTS
  // --------------------------------------------------------------------------------
  console.log("--- 2. Testing HDFC Bank Policy Parsing ---");

  // A. 84 Months Categories: Super A, CAT A, CAT HDFC, CAT GA, CAT RA
  const hdfc84mCategories = [
    "Super A",
    "CAT Super A",
    "CAT A",
    "Category A",
    "CAT HDFC",
    "CAT GA",
    "CAT RA",
    "Railway",
  ];

  console.log("\n  [HDFC 84-Month Eligible Categories]:");
  for (const cat of hdfc84mCategories) {
    const classification = classifyCategoryTier(cat);
    const result = parseHdfcPolicyCibilAndTenure(undefined, cat, classification);
    console.log(`    HDFC [${cat}]: CIBIL="${result.policyCibil}", Tenure="${result.policyTenure}"`);

    assert.strictEqual(
      result.policyCibil,
      "-",
      `HDFC CIBIL must be '-' for '${cat}' (rate card does not specify separate minimum threshold)`
    );
    assert.strictEqual(
      result.policyTenure,
      "12–84 months",
      `HDFC Tenure must be '12–84 months' for '${cat}' as per Section 6 of policy`
    );

    const rule = getBankRulesForCategory("HDFC Bank", cat);
    assert(rule !== null, `Rule should load for HDFC with category '${cat}'`);
    assert.strictEqual(rule.policyCibil, "-", `rule.policyCibil must be '-' for HDFC`);
    assert.strictEqual(rule.policyTenure, "12–84 months", `rule.policyTenure must be '12–84 months' for '${cat}'`);
  }

  // B. 72 Months Categories: CAT C, CAT GO nurse
  const hdfc72mCategories = [
    "CAT C",
    "Category C",
    "CAT GO nurse",
    "Govt Nurse",
    "Nurse",
  ];

  console.log("\n  [HDFC 72-Month Eligible Categories]:");
  for (const cat of hdfc72mCategories) {
    const classification = classifyCategoryTier(cat);
    const result = parseHdfcPolicyCibilAndTenure(undefined, cat, classification);
    console.log(`    HDFC [${cat}]: CIBIL="${result.policyCibil}", Tenure="${result.policyTenure}"`);

    assert.strictEqual(
      result.policyCibil,
      "-",
      `HDFC CIBIL must be '-' for '${cat}'`
    );
    assert.strictEqual(
      result.policyTenure,
      "12–72 months",
      `HDFC Tenure must be '12–72 months' for '${cat}' as per Section 6 of policy`
    );

    const rule = getBankRulesForCategory("HDFC Bank", cat);
    assert(rule !== null, `Rule should load for HDFC with category '${cat}'`);
    assert.strictEqual(rule.policyCibil, "-", `rule.policyCibil must be '-' for HDFC`);
    assert.strictEqual(rule.policyTenure, "12–72 months", `rule.policyTenure must be '12–72 months' for '${cat}'`);
  }

  // C. Standard 60 Months Categories: CAT B, CAT D, CAT E, CAT F, CAT GB, CAT GO others, CAT GP, CAT PEN, CAT RB, CAT RC, CAT GD, Open Market, Unlisted
  const hdfc60mCategories = [
    "CAT B",
    "Category B",
    "CAT D",
    "CAT E",
    "CAT F",
    "CAT GB",
    "CAT GO",
    "CAT GP",
    "CAT PEN",
    "CAT RB",
    "CAT RC",
    "CAT GD",
    "CAT GE",
    "CAT GF",
    "Open Market",
    "Standard Corporate",
    "Unlisted",
  ];

  console.log("\n  [HDFC Standard 60-Month Categories]:");
  for (const cat of hdfc60mCategories) {
    const classification = classifyCategoryTier(cat);
    const result = parseHdfcPolicyCibilAndTenure(undefined, cat, classification);
    console.log(`    HDFC [${cat}]: CIBIL="${result.policyCibil}", Tenure="${result.policyTenure}"`);

    assert.strictEqual(
      result.policyCibil,
      "-",
      `HDFC CIBIL must be '-' for '${cat}'`
    );
    assert.strictEqual(
      result.policyTenure,
      "12–60 months",
      `HDFC Tenure must be '12–60 months' for '${cat}' as per Section 6 of policy`
    );

    const rule = getBankRulesForCategory("HDFC Bank", cat);
    assert(rule !== null, `Rule should load for HDFC with category '${cat}'`);
    assert.strictEqual(rule.policyCibil, "-", `rule.policyCibil must be '-' for HDFC`);
    assert.strictEqual(rule.policyTenure, "12–60 months", `rule.policyTenure must be '12–60 months' for '${cat}'`);
  }
  console.log("✓ HDFC Bank: All category-wise tenure rules verified accurately (84m, 72m, 60m) and CIBIL is '-'.\n");

  // --------------------------------------------------------------------------------
  // 3. END-TO-END APPLICANT EVALUATION TEST
  // --------------------------------------------------------------------------------
  console.log("--- 3. Testing End-to-End Dynamic Eligibility Report ---");

  const applicant1: ApplicantProfile = {
    monthlyIncome: 85000,
    cibil: 750,
    loanAmount: 500000,
    tenureMonths: 48,
    existingEmi: 0,
    age: 30,
    companyName: "Tata Consultancy Services",
    employmentType: "Salaried",
  };

  const evalOutput1 = await evaluateApplicantAgainstAllBanks(applicant1);
  const report1 = formatDynamicEligibilityReport(applicant1, evalOutput1);

  // Find ICICI and HDFC in evaluations
  const iciciEval = evalOutput1.evaluations.find((e) => /icici/i.test(e.bankName));
  const hdfcEval = evalOutput1.evaluations.find((e) => /hdfc/i.test(e.bankName));

  assert(iciciEval, "ICICI should be in evaluation output");
  assert(hdfcEval, "HDFC should be in evaluation output");

  console.log("Evaluation Result for ICICI Bank:");
  console.log(`  Bank: ${iciciEval.bankName}`);
  console.log(`  Eligible: ${iciciEval.isEligible}`);
  console.log(`  Policy CIBIL: ${iciciEval.policyCibil}`);
  console.log(`  Policy Tenure: ${iciciEval.policyTenure}`);
  assert.strictEqual(iciciEval.policyCibil, "-");
  assert.strictEqual(iciciEval.policyTenure, "-");

  console.log("Evaluation Result for HDFC Bank:");
  console.log(`  Bank: ${hdfcEval.bankName}`);
  console.log(`  Eligible: ${hdfcEval.isEligible}`);
  console.log(`  Policy CIBIL: ${hdfcEval.policyCibil}`);
  console.log(`  Policy Tenure: ${hdfcEval.policyTenure}`);
  assert.strictEqual(hdfcEval.policyCibil, "-");
  assert(hdfcEval.policyTenure.includes("months"), "HDFC policyTenure should be a valid tenure range");

  console.log("\nSample Markdown Table Output:");
  const tableMatch = report1.match(/\| # \| Bank Name \|[^\n]+\n\|[^\n]+\n([\s\S]+?\n\n)/);
  if (tableMatch) {
    console.log(tableMatch[0].trim());
  }

  console.log("\n================================================================================");
  console.log("ALL ICICI AND HDFC PARSING & POLICY EXTRACTION TESTS PASSED SUCCESSFULLY! ✓");
  console.log("================================================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
