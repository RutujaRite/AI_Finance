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
  console.log("=== RUNNING INTENT ROUTING & ELIGIBILITY ENGINE TESTS ===\n");

  // TEST 1: Intent A: Loan Check Phrases DO NOT trigger company search & route to PROFILE_DATA_COLLECTION
  console.log("--- Test 1: Intent A Loan Check Phrases ---");
  const testPhrases = [
    "check my eligibility",
    "evaluate loan",
    "can I get a loan",
    "check eligibility",
    "loan check",
  ];

  for (const phrase of testPhrases) {
    assert(isInvalidCompanyName(phrase), `'${phrase}' is recognized as invalid company name`);
    const compSearch = await searchCompany(phrase);
    assert(!compSearch.found, `'${phrase}' is rejected by company search guardrail`);

    const classification = classifyAgentIntent(phrase, {});
    assert(
      classification.state === "PROFILE_DATA_COLLECTION",
      `'${phrase}' routes to PROFILE_DATA_COLLECTION`
    );
    assert(
      !classification.sanitizedEntities.companyName,
      `'${phrase}' does NOT set companyName in sanitizedEntities`
    );
  }

  // TEST 2: Strict One-by-One Parameter Collection Waterfall
  console.log("\n--- Test 2: Strict One-by-One Parameter Collection Waterfall ---");

  // Step 1: Initial empty profile -> Asks for Employment Status (no bullet list dumping)
  const turn1Classification = classifyAgentIntent("check my eligibility", {});
  const turn1Result = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "check my eligibility",
    profile: {},
    classification: turn1Classification,
  });

  assert(
    turn1Result.reply.includes("Employed (Salaried), Self-Employed, or Unemployed"),
    "Turn 1 asks for Employment Status"
  );
  assert(!turn1Result.reply.includes("•"), "Turn 1 does NOT dump a bullet list of fields");

  // Step 2 (Employed): User says Salaried -> Next asks for Employer/Company Name
  const turn2Profile = { employmentType: "Salaried" };
  const turn2Classification = classifyAgentIntent("I am salaried", turn2Profile);
  const turn2Result = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "I am salaried",
    profile: turn2Profile,
    classification: turn2Classification,
  });

  assert(
    turn2Result.reply.toLowerCase().includes("employer") || turn2Result.reply.toLowerCase().includes("company"),
    "Turn 2 for Salaried asks for Employer/Company Name"
  );
  assert(!turn2Result.reply.includes("•"), "Turn 2 does NOT dump bullet list");

  // Step 2 (Unemployed): User says Unemployed -> Presents Alt-Income & Secured Loan Pathways
  const turn2UnemployedProfile = { employmentType: "Unemployed" };
  const turn2UnemployedClassification = classifyAgentIntent("I am unemployed", turn2UnemployedProfile);
  const turn2UnemployedResult = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "I am unemployed",
    profile: turn2UnemployedProfile,
    classification: turn2UnemployedClassification,
  });

  assert(
    turn2UnemployedResult.reply.includes("Secured / Collateralized Loans") &&
    turn2UnemployedResult.reply.includes("Gold Loans"),
    "Turn 2 for Unemployed presents Alt-Income & Secured pathways"
  );

  // Step 3: Salaried + Employer Name provided -> Asks for Net Monthly Salary
  const turn3Profile = { employmentType: "Salaried", companyName: "TCS" };
  const turn3Classification = classifyAgentIntent("TCS", turn3Profile);
  const turn3Result = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "TCS",
    profile: turn3Profile,
    classification: turn3Classification,
  });

  assert(
    turn3Result.reply.toLowerCase().includes("salary") || turn3Result.reply.toLowerCase().includes("take-home"),
    "Turn 3 asks for Net Monthly Salary"
  );

  // Step 4: With Salary -> Asks for Age
  const turn4Profile = { employmentType: "Salaried", companyName: "TCS", monthlySalary: 60000 };
  const turn4Classification = classifyAgentIntent("60000", turn4Profile);
  const turn4Result = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "60000",
    profile: turn4Profile,
    classification: turn4Classification,
  });

  assert(turn4Result.reply.toLowerCase().includes("age"), "Turn 4 asks for Applicant Age");

  // Step 5: With Age -> Asks for CIBIL
  const turn5Profile = { employmentType: "Salaried", companyName: "TCS", monthlySalary: 60000, age: 28 };
  const turn5Classification = classifyAgentIntent("28", turn5Profile);
  const turn5Result = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "28",
    profile: turn5Profile,
    classification: turn5Classification,
  });

  assert(turn5Result.reply.toLowerCase().includes("cibil"), "Turn 5 asks for CIBIL Score");

  // Step 6: With CIBIL -> Asks for Existing EMIs
  const turn6Profile = { employmentType: "Salaried", companyName: "TCS", monthlySalary: 60000, age: 28, cibilScore: 750 };
  const turn6Classification = classifyAgentIntent("750", turn6Profile);
  const turn6Result = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "750",
    profile: turn6Profile,
    classification: turn6Classification,
  });

  assert(turn6Result.reply.toLowerCase().includes("emi"), "Turn 6 asks for Existing Monthly EMIs");

  // Step 7: With Existing EMIs -> Asks for Desired Loan Amount & Tenure
  const turn7Profile = { employmentType: "Salaried", companyName: "TCS", monthlySalary: 60000, age: 28, cibilScore: 750, existingEmi: 0 };
  const turn7Classification = classifyAgentIntent("0", turn7Profile);
  const turn7Result = await dispatchToolForState({
    sessionId: "test-session",
    userMessage: "0",
    profile: turn7Profile,
    classification: turn7Classification,
  });

  assert(
    turn7Result.reply.toLowerCase().includes("loan amount") &&
    turn7Result.reply.toLowerCase().includes("tenure"),
    "Turn 7 asks for Desired Loan Amount & Tenure"
  );

  // TEST 3: Intent B: Company Search on explicit company name
  console.log("\n--- Test 3: Intent B Explicit Company Search ---");
  const tcsSearch = await searchCompany("TCS");
  assert(tcsSearch.found, "Company search for TCS returns found: true");

  console.log("\n✨ ALL INTENT ROUTING & ELIGIBILITY ENGINE TESTS PASSED SUCCESSFULLY! ✨");
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
