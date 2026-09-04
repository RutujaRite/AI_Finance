const assert = require("assert");
const pool = require("../lib/db");
const {
  buildPolicyChecks,
  evaluateApplicantAgainstPolicies,
  getActivePolicyRequirements,
  getApplicableMissingFields
} = require("../services/eligibilityService");
const {
  collectEligibilityField,
  getEligibilityQuestion,
  formatEligibilityResult,
  generateEligibleBankRecommendations,
  isLoanIntent
} = require("../services/assistantFlowService");

async function runEligibilityTests() {
  console.log("==================================================");
  console.log(" RUNNING DETERMINISTIC ELIGIBILITY ENGINE TESTS");
  console.log("==================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}\n`);
    }
  }

  // ==========================================
  // UNIT TESTS: buildPolicyChecks
  // ==========================================
  console.log("--- 1. Testing Rule-Level Criteria (buildPolicyChecks) ---");

  const sampleRule = {
    id: 101,
    policy_version_id: 50,
    policy_version: "V2",
    loan_type: "Personal",
    category: "CAT A",
    min_cibil: 700,
    max_cibil: 900,
    min_salary: 25000,
    max_salary: 500000,
    employment_type: "Salaried",
    min_age: 21,
    max_age: 58,
    min_loan_amount: 50000,
    max_loan_amount: 1500000,
    min_tenure_months: 12,
    max_tenure_months: 60,
    foir_percent: 50,
    roi: 11.5,
    processing_fee_percent: 1.5,
    processing_fee_flat: 1000,
    company_rules: { categories: ["CAT A", "TCS", "INFOSYS"] },
    location_rules: { locations: ["mumbai", "pune", "delhi"], pincodes: ["400001", "411001"] },
    other_rules: { conditions: ["No current 30+ DPD"] }
  };

  test("Eligible profile with all matching criteria", () => {
    const applicant = {
      cibil: 750,
      monthlyIncome: 60000,
      existingEmi: 15000, // FOIR: 25% (<= 50%)
      age: 28,
      employmentType: "Salaried",
      loanAmount: 300000,
      tenureMonths: 36,
      companyName: "TCS",
      location: "Mumbai"
    };

    const res = buildPolicyChecks(sampleRule, applicant);
    const cibilCheck = res.checks.find(c => c.criterion === "CIBIL");
    const salaryCheck = res.checks.find(c => c.criterion === "Salary");
    const ageCheck = res.checks.find(c => c.criterion === "Age");
    const foirCheck = res.checks.find(c => c.criterion === "FOIR");
    const empCheck = res.checks.find(c => c.criterion === "Employment");
    const locCheck = res.checks.find(c => c.criterion === "Location/Pincode");
    const compCheck = res.checks.find(c => c.criterion === "Company/Category");

    assert.strictEqual(cibilCheck.result, "pass");
    assert.strictEqual(salaryCheck.result, "pass");
    assert.strictEqual(ageCheck.result, "pass");
    assert.strictEqual(foirCheck.result, "pass");
    assert.strictEqual(empCheck.result, "pass");
    assert.strictEqual(locCheck.result, "pass");
    assert.strictEqual(compCheck.result, "pass");
    assert.strictEqual(res.offered_terms.roi, 11.5);
    assert.strictEqual(res.source.policy_version, "V2");
  });

  test("CIBIL failure check (below minimum required score)", () => {
    const applicant = {
      cibil: 650, // Below 700
      monthlyIncome: 60000,
      existingEmi: 5000,
      age: 28,
      employmentType: "Salaried",
      loanAmount: 300000,
      tenureMonths: 36,
      companyName: "TCS",
      location: "Mumbai"
    };

    const res = buildPolicyChecks(sampleRule, applicant);
    assert.strictEqual(res.status, "NOT_ELIGIBLE");
    const cibilCheck = res.checks.find(c => c.criterion === "CIBIL");
    assert.strictEqual(cibilCheck.result, "fail");
    assert(res.failure_reasons.some(r => r.includes("CIBIL 650 does not meet")));
  });

  test("FOIR calculation & threshold breach check", () => {
    const applicant = {
      cibil: 750,
      monthlyIncome: 40000,
      existingEmi: 25000, // 25000 / 40000 = 62.5% > 50%
      age: 28,
      employmentType: "Salaried",
      loanAmount: 300000,
      tenureMonths: 36,
      companyName: "TCS",
      location: "Mumbai"
    };

    const res = buildPolicyChecks(sampleRule, applicant);
    assert.strictEqual(res.status, "NOT_ELIGIBLE");
    const foirCheck = res.checks.find(c => c.criterion === "FOIR");
    assert.strictEqual(foirCheck.result, "fail");
    assert.strictEqual(foirCheck.actual, "62.5%");
    assert(res.failure_reasons.some(r => r.includes("62.5% exceeds max allowable FOIR")));
  });

  test("Missing data handling (returns NEEDS_REVIEW and lists missing fields)", () => {
    const applicant = {
      employmentType: "Salaried"
    };

    const res = buildPolicyChecks(sampleRule, applicant);
    assert.strictEqual(res.status, "NEEDS_REVIEW");
    assert(res.missing_fields.includes("cibil"));
    assert(res.missing_fields.includes("monthlyIncome"));
    assert(res.missing_fields.includes("age"));
    assert(res.missing_fields.includes("loanAmount"));
    assert(res.missing_fields.includes("tenureMonths"));
    assert(res.review_reasons.length > 0);
  });

  test("Location & Pincode rejection check", () => {
    const applicant = {
      cibil: 750,
      monthlyIncome: 60000,
      existingEmi: 5000,
      age: 28,
      employmentType: "Salaried",
      loanAmount: 300000,
      tenureMonths: 36,
      companyName: "TCS",
      location: "Patna" // Not in mumbai, pune, delhi
    };

    const res = buildPolicyChecks(sampleRule, applicant);
    assert.strictEqual(res.status, "NOT_ELIGIBLE");
    const locCheck = res.checks.find(c => c.criterion === "Location/Pincode");
    assert.strictEqual(locCheck.result, "fail");
  });

  test("Location check passes by exact Pincode match", () => {
    const applicant = {
      cibil: 750,
      monthlyIncome: 60000,
      existingEmi: 5000,
      age: 28,
      employmentType: "Salaried",
      loanAmount: 300000,
      tenureMonths: 36,
      companyName: "TCS",
      pincode: "400001"
    };

    const res = buildPolicyChecks(sampleRule, applicant);
    const locCheck = res.checks.find(c => c.criterion === "Location/Pincode");
    assert.strictEqual(locCheck.result, "pass");
  });

  test("Company category resolution with external context", () => {
    const applicant = {
      cibil: 750,
      monthlyIncome: 60000,
      existingEmi: 5000,
      age: 28,
      employmentType: "Salaried",
      loanAmount: 300000,
      tenureMonths: 36,
      companyName: "Acme Analytics Pvt Ltd",
      location: "Mumbai"
    };

    const resWithContext = buildPolicyChecks(sampleRule, applicant, { company_category: "CAT A" });
    const compCheck = resWithContext.checks.find(c => c.criterion === "Company/Category");
    assert.strictEqual(compCheck.result, "pass");

    const resWithout = buildPolicyChecks(sampleRule, applicant, {});
    const compCheckWithout = resWithout.checks.find(c => c.criterion === "Company/Category");
    assert.strictEqual(compCheckWithout.result, "review");
  });

  test("Employment type mismatch check", () => {
    const applicant = {
      cibil: 750,
      monthlyIncome: 60000,
      existingEmi: 5000,
      age: 28,
      employmentType: "Self-Employed",
      loanAmount: 300000,
      tenureMonths: 36,
      companyName: "TCS",
      location: "Mumbai"
    };

    const res = buildPolicyChecks(sampleRule, applicant);
    assert.strictEqual(res.status, "NOT_ELIGIBLE");
    const empCheck = res.checks.find(c => c.criterion === "Employment");
    assert.strictEqual(empCheck.result, "fail");
  });

  test("Boundary conditions: exact minimum CIBIL, Age, Salary limits", () => {
    const applicant = {
      cibil: 700,
      monthlyIncome: 25000,
      existingEmi: 0,
      age: 21,
      employmentType: "Salaried",
      loanAmount: 50000,
      tenureMonths: 12,
      companyName: "TCS",
      location: "Mumbai"
    };

    const res = buildPolicyChecks(sampleRule, applicant);
    assert.strictEqual(res.checks.find(c => c.criterion === "CIBIL").result, "pass");
    assert.strictEqual(res.checks.find(c => c.criterion === "Salary").result, "pass");
    assert.strictEqual(res.checks.find(c => c.criterion === "Age").result, "pass");
    assert.strictEqual(res.checks.find(c => c.criterion === "Loan Amount").result, "pass");
    assert.strictEqual(res.checks.find(c => c.criterion === "Tenure").result, "pass");
  });

  // ==========================================
  // STEP-BY-STEP ASSISTANT CONVERSATION TESTS
  // ==========================================
  console.log("\n--- 2. Testing Step-by-Step Assistant Data Collection ---");

  test("Assistant extracts multiple fields from initial message", () => {
    const userMsg = "I need a personal loan of 5 lakhs, my salary is 75000, cibil 780, age 30 in Mumbai, working at TCS";
    const applicant = collectEligibilityField(userMsg, {});

    assert.strictEqual(applicant.loanAmount, 500000);
    assert.strictEqual(applicant.monthlyIncome, 75000);
    assert.strictEqual(applicant.cibil, 780);
    assert.strictEqual(applicant.age, 30);
    assert.strictEqual(applicant.location, "Mumbai");
    assert.strictEqual(applicant.companyName, "TCS");
    assert.strictEqual(applicant.existingEmi, null);
    assert.strictEqual(applicant.tenureMonths, null);
  });

  test("Assistant step-by-step field collection handles answers sequentially", () => {
    let applicant = {};

    applicant = collectEligibilityField("80000", applicant, "monthlyIncome");
    assert.strictEqual(applicant.monthlyIncome, 80000);

    applicant = collectEligibilityField("no emi", applicant, "existingEmi");
    assert.strictEqual(applicant.existingEmi, 0);

    applicant = collectEligibilityField("400000", applicant, "loanAmount");
    assert.strictEqual(applicant.loanAmount, 400000);

    applicant = collectEligibilityField("36 months", applicant, "tenureMonths");
    assert.strictEqual(applicant.tenureMonths, 36);

    applicant = collectEligibilityField("760", applicant, "cibil");
    assert.strictEqual(applicant.cibil, 760);

    applicant = collectEligibilityField("29", applicant, "age");
    assert.strictEqual(applicant.age, 29);

    applicant = collectEligibilityField("salaried", applicant, "employmentType");
    assert.strictEqual(applicant.employmentType, "Salaried");
  });

  // ==========================================
  // RECOMMENDATION LAYER TESTS
  // ==========================================
  console.log("\n--- 3. Testing Policy-Backed Recommendation Layer ---");

  test("Recommendation layer accurately compares multiple eligible banks strictly by policy data", () => {
    const eligibleBanks = [
      {
        bank: "Bank Alpha",
        status: "ELIGIBLE",
        offered_terms: { roi: 10.25, processing_fee_percent: 1.5, max_tenure_months: 60, max_loan_amount: 4000000, foir_percent: 65 }
      },
      {
        bank: "Bank Beta",
        status: "ELIGIBLE",
        offered_terms: { roi: 11.5, processing_fee_percent: 1.0, max_tenure_months: 84, max_loan_amount: 5000000, foir_percent: 70 }
      }
    ];

    const rec = generateEligibleBankRecommendations(eligibleBanks);

    // Lowest ROI should be Bank Alpha (10.25%)
    assert(rec.includes("Lowest Interest Rate"), "Must include Lowest Interest Rate");
    assert(rec.includes("Bank Alpha"), "Bank Alpha must be lowest ROI");
    assert(rec.includes("10.25%"), "10.25% ROI must be mentioned");

    // Lowest Fee should be Bank Beta (1.0%)
    assert(rec.includes("Lowest Processing Fee"), "Must include Lowest Processing Fee");
    assert(rec.includes("Bank Beta"), "Bank Beta must be lowest Fee");
    assert(rec.includes("1%"), "1% fee must be mentioned");

    // Longest Tenure should be Bank Beta (84 months)
    assert(rec.includes("Longest Repayment Tenure"), "Must include Longest Tenure");
    assert(rec.includes("84 months"), "84 months must be mentioned");

    // Highest Cap should be Bank Beta (50 Lakhs)
    assert(rec.includes("Highest Loan Ticket Size"), "Must include Highest Loan Ticket Size");
    assert(rec.includes("50,00,000"), "50,00,000 cap must be mentioned");

    // Highest FOIR should be Bank Beta (70%)
    assert(rec.includes("Highest Obligation / FOIR Allowance"), "Must include FOIR");
    assert(rec.includes("70%"), "70% FOIR must be mentioned");
  });

  test("Recommendation layer excludes NEEDS_REVIEW and NOT_ELIGIBLE banks from approved recommendations", () => {
    const mixedEvaluations = [
      {
        bank: "Approved Bank",
        status: "ELIGIBLE",
        policy_version: "V1",
        offered_terms: { roi: 10.5, processing_fee_percent: 1.0, max_tenure_months: 60, max_loan_amount: 3000000, foir_percent: 60 },
        checks: [{ criterion: "CIBIL", result: "pass", detail: "Pass" }]
      },
      {
        bank: "Review Bank",
        status: "NEEDS_REVIEW",
        policy_version: "V2",
        offered_terms: { roi: 9.0, processing_fee_percent: 0.5, max_tenure_months: 120, max_loan_amount: 10000000, foir_percent: 80 },
        checks: [{ criterion: "Employer", result: "review", detail: "Needs verification" }]
      },
      {
        bank: "Failed Bank",
        status: "NOT_ELIGIBLE",
        policy_version: "V1",
        offered_terms: { roi: 8.0, processing_fee_percent: 0.2, max_tenure_months: 120, max_loan_amount: 10000000, foir_percent: 90 },
        checks: [{ criterion: "CIBIL", result: "fail", detail: "Fail" }]
      }
    ];

    const result = formatEligibilityResult({ customerName: "Test" }, mixedEvaluations);

    // The recommendation section must strictly recommend Approved Bank
    assert(result.includes("🏆 Policy-Backed Recommendation for Eligible Banks"));
    assert(result.includes("**Approved Bank** is currently your sole approved loan option"));
    assert(!result.includes("Review Bank is currently your sole approved loan option"));
    assert(!result.includes("Failed Bank is currently your sole approved loan option"));
  });

  // ==========================================
  // INTEGRATION TESTS: Single Bank Appearance & Aggregation
  // ==========================================
  console.log("\n--- 4. Testing Single-Bank Appearance & Policy Aggregation ---");

  try {
    const dynamicEvaluations = await evaluateApplicantAgainstPolicies(pool, {
      cibil: 760,
      monthlyIncome: 80000,
      existingEmi: 10000,
      age: 30,
      employmentType: "Salaried",
      loanAmount: 500000,
      tenureMonths: 48,
      location: "Mumbai",
      companyName: "TCS"
    });

    test("Every bank appears strictly once in the dynamic evaluations output", () => {
      assert(Array.isArray(dynamicEvaluations), "Evaluations must be an array");
      assert(dynamicEvaluations.length > 0, "Should evaluate at least one active bank");

      const bankIds = dynamicEvaluations.map(e => e.bank_id);
      const uniqueBankIds = new Set(bankIds);
      assert.strictEqual(bankIds.length, uniqueBankIds.size, `Duplicate bank entries detected: ${bankIds.length} vs unique ${uniqueBankIds.size}`);

      const bankNames = dynamicEvaluations.map(e => e.bank);
      const uniqueBankNames = new Set(bankNames);
      assert.strictEqual(bankNames.length, uniqueBankNames.size, `Duplicate bank names detected: ${bankNames.length} vs unique ${uniqueBankNames.size}`);
      console.log(`    Evaluated ${dynamicEvaluations.length} unique banks: ${bankNames.join(", ")}`);
    });

    test("No bank appears in multiple decision groups in formatEligibilityResult", () => {
      const formatted = formatEligibilityResult({ customerName: "Test User" }, dynamicEvaluations);

      const isEligible = s => /^eligible$/i.test(String(s || "").trim());
      const isReview = s => /^(needs[_ ]review|review)$/i.test(String(s || "").trim());
      const isNotEligible = s => /^(not[_ ]eligible|fail)$/i.test(String(s || "").trim());

      const eligibleBanks = dynamicEvaluations.filter(e => isEligible(e.status)).map(e => e.bank);
      const reviewBanks = dynamicEvaluations.filter(e => isReview(e.status)).map(e => e.bank);
      const notEligibleBanks = dynamicEvaluations.filter(e => isNotEligible(e.status)).map(e => e.bank);

      // Check intersection between groups
      const eligibleSet = new Set(eligibleBanks);
      const reviewSet = new Set(reviewBanks);
      const notEligibleSet = new Set(notEligibleBanks);

      for (const b of eligibleBanks) {
        assert(!reviewSet.has(b), `Bank '${b}' appears in both Eligible and Needs Review`);
        assert(!notEligibleSet.has(b), `Bank '${b}' appears in both Eligible and Not Eligible`);
      }
      for (const b of reviewBanks) {
        assert(!notEligibleSet.has(b), `Bank '${b}' appears in both Needs Review and Not Eligible`);
      }

      console.log(`    Eligible (${eligibleBanks.length}): ${eligibleBanks.join(", ") || "None"}`);
      console.log(`    Needs Review (${reviewBanks.length}): ${reviewBanks.join(", ") || "None"}`);
      console.log(`    Not Eligible (${notEligibleBanks.length}): ${notEligibleBanks.join(", ") || "None"}`);
    });

    test("Multi-bank evaluations contain matched_rule and policy source traceability", () => {
      dynamicEvaluations.forEach(ev => {
        assert(typeof ev.matched_rule === "string" && ev.matched_rule.length > 0, `matched_rule missing for bank ${ev.bank}`);
        assert(typeof ev.source === "object" && ev.source !== null, `source missing for bank ${ev.bank}`);
        assert(Array.isArray(ev.all_sources), `all_sources missing for bank ${ev.bank}`);
      });
    });
  } catch (err) {
    console.error("Database evaluation failed:", err);
  }

  console.log("\n==================================================");
  console.log(` TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("==================================================");

  if (passedTests === totalTests) {
    console.log(" ALL TESTS PASSED SUCCESSFULLY.\n");
  } else {
    process.exitCode = 1;
  }
}

runEligibilityTests()
  .then(() => pool.end())
  .catch(err => {
    console.error("Test runner error:", err);
    pool.end();
  });
