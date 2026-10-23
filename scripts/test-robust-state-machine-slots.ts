import { classifyAgentIntent, dispatchToolForState } from "../lib/ai/router";
import { isInvalidCompanyName } from "../lib/dynamicEligibilityEngine";
import { searchCompany } from "../lib/companySearch";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runTests() {
  console.log("=== RUNNING CREDITWISE AI ROBUST STATE MACHINE & SLOT-PARSING TESTS ===\n");

  // -------------------------------------------------------------
  // TEST 1: Strict Slot Boundary Protection (Rule 3)
  // -------------------------------------------------------------
  console.log("--- 1. Testing Rule 3: Strict Slot Boundary Protection ---");
  const loanPhrases = ["5lakh", "5 lakh", "5L", "500000", "5 lacs", "₹5,00,000"];

  for (const p of loanPhrases) {
    assert(isInvalidCompanyName(p), `'${p}' is strictly recognized as invalid company name`);
    const compSearch = await searchCompany(p);
    assert(!compSearch.found, `'${p}' does not trigger valid corporate company search`);

    // Verify boundary protection when companyName is pending
    const emptyProfile = { employmentType: "Salaried" };
    const classification = classifyAgentIntent(p, emptyProfile);
    assert(
      !classification.sanitizedEntities.companyName,
      `'${p}' is NEVER assigned to company_name when company_name is missing`
    );
    assert(
      classification.missingFields.includes("Employer / Company Name"),
      `Employer / Company Name remains missing when '${p}' is input`
    );
  }

  // -------------------------------------------------------------
  // TEST 2: Fuzzy Unit Parsing & Default Tenure (Rule 2)
  // -------------------------------------------------------------
  console.log("\n--- 2. Testing Rule 2: Fuzzy Unit Parsing & Default Tenure (60 months) ---");
  const turn7Profile = {
    employmentType: "Salaried",
    companyName: "TCS",
    monthlySalary: 60000,
    age: 28,
    cibilScore: 750,
    existingEmi: 0,
  };

  const fuzzyAmountInputs = [
    { input: "5lakh", expectedAmount: 500000, expectedTenure: 60 },
    { input: "5 lakh", expectedAmount: 500000, expectedTenure: 60 },
    { input: "5L", expectedAmount: 500000, expectedTenure: 60 },
    { input: "500000", expectedAmount: 500000, expectedTenure: 60 },
    { input: "5 lacs", expectedAmount: 500000, expectedTenure: 60 },
    { input: "5 lakhs for 3 years", expectedAmount: 500000, expectedTenure: 36 },
    { input: "5L 36 months", expectedAmount: 500000, expectedTenure: 36 },
  ];

  for (const t of fuzzyAmountInputs) {
    const classification = classifyAgentIntent(t.input, turn7Profile);
    assert(
      classification.sanitizedEntities.loanAmount === t.expectedAmount,
      `Input '${t.input}' correctly parses loanAmount = ₹${t.expectedAmount.toLocaleString("en-IN")}`
    );
    assert(
      classification.sanitizedEntities.tenureMonths === t.expectedTenure,
      `Input '${t.input}' correctly resolves tenure = ${t.expectedTenure} months`
    );
    assert(
      classification.state === "MULTI_BANK_ELIGIBILITY",
      `Input '${t.input}' completes slot collection and routes to MULTI_BANK_ELIGIBILITY`
    );
    assert(
      classification.missingFields.length === 0,
      `Input '${t.input}' leaves 0 missing fields (no endless looping)`
    );
  }

  // -------------------------------------------------------------
  // TEST 3: Anti-Looping & Immediate State Updates (Rule 1)
  // -------------------------------------------------------------
  console.log("\n--- 3. Testing Rule 1: Anti-Looping & Immediate State Updates ---");

  // Step 1: Employment Status
  let currentProfile: any = {};
  let c1 = classifyAgentIntent("check my eligibility", currentProfile);
  let r1 = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "check my eligibility",
    profile: currentProfile,
    classification: c1,
  });
  assert(
    r1.reply.includes("Employed (Salaried), Self-Employed, or Unemployed"),
    "Step 1: Asks for Employment Status"
  );

  // User replies: "Salaried"
  let c2 = classifyAgentIntent("Salaried", currentProfile);
  assert(c2.sanitizedEntities.employmentType === "Salaried", "Immediately captures employmentType = Salaried");
  currentProfile.employmentType = c2.sanitizedEntities.employmentType;
  let r2 = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "Salaried",
    profile: currentProfile,
    classification: c2,
  });
  assert(
    r2.reply.toLowerCase().includes("employer") || r2.reply.toLowerCase().includes("company"),
    "Step 2: Advances to ask for Employer/Company Name (does not repeat Step 1)"
  );

  // User replies: "TCS"
  let c3 = classifyAgentIntent("TCS", currentProfile);
  assert(
    Boolean(c3.sanitizedEntities.companyName && (c3.sanitizedEntities.companyName.includes("TCS") || c3.sanitizedEntities.companyName.includes("TATA CONSULTANCY SERVICES"))),
    "Immediately captures companyName = TCS / TATA CONSULTANCY SERVICES LIMITED"
  );
  currentProfile.companyName = c3.sanitizedEntities.companyName;
  let r3 = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "TCS",
    profile: currentProfile,
    classification: c3,
  });
  assert(
    r3.reply.toLowerCase().includes("salary") || r3.reply.toLowerCase().includes("take-home"),
    "Step 3: Advances to ask for Net Monthly Salary (does not repeat Step 2)"
  );

  // User replies: "60k"
  let c4 = classifyAgentIntent("60k", currentProfile);
  assert(c4.sanitizedEntities.monthlySalary === 60000, "Immediately captures monthlySalary = 60000 from '60k'");
  currentProfile.monthlySalary = c4.sanitizedEntities.monthlySalary;
  let r4 = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "60k",
    profile: currentProfile,
    classification: c4,
  });
  assert(
    r4.reply.toLowerCase().includes("age"),
    "Step 4: Advances to ask for Age (does not repeat Step 3)"
  );

  // User replies: "23"
  let c5 = classifyAgentIntent("23", currentProfile);
  assert(c5.sanitizedEntities.age === 23, "Immediately captures age = 23 from '23'");
  currentProfile.age = c5.sanitizedEntities.age;
  let r5 = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "23",
    profile: currentProfile,
    classification: c5,
  });
  assert(
    r5.reply.toLowerCase().includes("cibil"),
    "Step 5: Advances to ask for CIBIL Score (does not repeat Step 4)"
  );

  // User replies: "780"
  let c6 = classifyAgentIntent("780", currentProfile);
  assert(c6.sanitizedEntities.cibilScore === 780, "Immediately captures cibilScore = 780 from '780'");
  currentProfile.cibilScore = c6.sanitizedEntities.cibilScore;
  let r6 = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "780",
    profile: currentProfile,
    classification: c6,
  });
  assert(
    r6.reply.toLowerCase().includes("emi"),
    "Step 6: Advances to ask for Existing EMIs (does not repeat Step 5)"
  );

  // User replies: "0"
  let c7 = classifyAgentIntent("0", currentProfile);
  assert(c7.sanitizedEntities.existingEmi === 0, "Immediately captures existingEmi = 0 from '0'");
  currentProfile.existingEmi = c7.sanitizedEntities.existingEmi;
  let r7 = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "0",
    profile: currentProfile,
    classification: c7,
  });
  assert(
    r7.reply.toLowerCase().includes("loan amount"),
    "Step 7: Advances to ask for Desired Loan Amount & Tenure (does not repeat Step 6)"
  );

  // User replies: "5lakh" (omitting tenure)
  let c8 = classifyAgentIntent("5lakh", currentProfile);
  assert(c8.sanitizedEntities.loanAmount === 500000, "Immediately captures loanAmount = 500000 from '5lakh'");
  assert(c8.sanitizedEntities.tenureMonths === 60, "Defaults tenure to 60 months");
  assert(c8.state === "MULTI_BANK_ELIGIBILITY", "Transitions to MULTI_BANK_ELIGIBILITY");

  currentProfile.loanAmount = c8.sanitizedEntities.loanAmount;
  currentProfile.tenureMonths = c8.sanitizedEntities.tenureMonths;

  let r8 = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "5lakh",
    profile: currentProfile,
    classification: c8,
  });
  assert(
    r8.reply.includes("Loan Eligibility & FOIR Comparison") || r8.reply.includes("Partner Bank"),
    "Step 8: Generates multi-bank comparison table"
  );

  // -------------------------------------------------------------
  // TEST 4: Bank Manager Dispatch
  // -------------------------------------------------------------
  console.log("\n--- 4. Testing Bank Manager Dispatch ---");
  const managerClassification = classifyAgentIntent("IDFC FIRST Bank manager Mumbai 400001", currentProfile);
  assert(
    managerClassification.state === "BANK_MANAGER_SEARCH",
    "Manager intent routes to BANK_MANAGER_SEARCH"
  );
  assert(
    managerClassification.targetLender === "IDFC FIRST Bank",
    "Resolves target lender as IDFC FIRST Bank"
  );

  console.log("\n✨ ALL ROBUST STATE MACHINE & SLOT-PARSING TESTS PASSED! ✨");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
