import {
  isPersonalNameOrIntroduction,
  isInvalidCompanyName,
  detectCompanyDisavowal,
  UNEMPLOYED_REGEX,
  extractCompanyCandidateFromText,
  consolidateApplicantProfileFromHistory,
  checkDefinitiveIneligibility,
  buildMultiBankIntakePrompt,
  ApplicantProfile,
} from "../lib/dynamicEligibilityEngine";
import { extractEntitiesFromText } from "../lib/ai/intentClassifier";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runTests() {
  console.log("=== Testing Rutuja Multi-Turn Conversation & Unemployment Intent Recognition ===\n");

  // 1. Turn 2: "i am rutuja"
  console.log("--- Test 1: Self-introduction 'i am rutuja' ---");
  assert(isPersonalNameOrIntroduction("i am rutuja") === true, "'i am rutuja' is recognized as personal name introduction");
  assert(isInvalidCompanyName("i am rutuja") === true, "'i am rutuja' is rejected as company name");
  assert(extractCompanyCandidateFromText("i am rutuja") === undefined, "extractCompanyCandidateFromText returns undefined for 'i am rutuja'");

  const profileAfterTurn2 = consolidateApplicantProfileFromHistory(
    [{ role: "user", content: "hello" }, { role: "assistant", content: "Hello! Welcome to CreditWise..." }],
    "i am rutuja"
  );
  assert(profileAfterTurn2.companyName === undefined, "profile companyName is undefined after 'i am rutuja'");
  assert(profileAfterTurn2.employmentType !== "Salaried", "profile employmentType is NOT Salaried after 'i am rutuja'");

  // 2. Turn 3: "i am unemplyed" (with typo 'unemplyed')
  console.log("\n--- Test 2: Unemployed statement with typo 'i am unemplyed' ---");
  assert(UNEMPLOYED_REGEX.test("i am unemplyed") === true, "UNEMPLOYED_REGEX matches 'i am unemplyed'");
  assert(isInvalidCompanyName("i am unemplyed") === true, "'i am unemplyed' is rejected as company name");
  assert(extractCompanyCandidateFromText("i am unemplyed") === undefined, "extractCompanyCandidateFromText returns undefined for 'i am unemplyed'");

  const entitiesTurn3 = extractEntitiesFromText("i am unemplyed");
  assert(entitiesTurn3.employmentType === "Unemployed", "extractEntitiesFromText extracts employmentType = 'Unemployed'");
  assert(entitiesTurn3.companyName === undefined, "extractEntitiesFromText has no companyName for 'i am unemplyed'");

  const profileAfterTurn3 = consolidateApplicantProfileFromHistory(
    [
      { role: "user", content: "hello" },
      { role: "assistant", content: "Hello! Welcome to CreditWise..." },
      { role: "user", content: "i am rutuja" },
      { role: "assistant", content: "Hello Rutuja! How can I assist you today?" },
    ],
    "i am unemplyed"
  );
  assert(profileAfterTurn3.employmentType === "Unemployed", "profileAfterTurn3 employmentType is 'Unemployed'");
  assert(profileAfterTurn3.companyName === undefined, "profileAfterTurn3 companyName is undefined");
  assert(profileAfterTurn3.monthlyIncome === 0, "profileAfterTurn3 monthlyIncome is 0");

  // 3. Turn 4: "i want loan" (with history)
  console.log("\n--- Test 3: Loan request 'i want loan' when applicant is unemployed ---");
  const historyBeforeTurn4 = [
    { role: "user", content: "hello" },
    { role: "assistant", content: "Hello! Welcome to CreditWise AI..." },
    { role: "user", content: "i am rutuja" },
    { role: "assistant", content: "Hello Rutuja! How can I assist you today?" },
    { role: "user", content: "i am unemplyed" },
    { role: "assistant", content: "Thank you for sharing, Rutuja. Unemployment can affect traditional loan eligibility..." },
  ];

  const profileAtTurn4 = consolidateApplicantProfileFromHistory(
    historyBeforeTurn4,
    "i want loan"
  );
  assert(profileAtTurn4.employmentType === "Unemployed", "profileAtTurn4 preserves employmentType = 'Unemployed'");
  assert(profileAtTurn4.companyName === undefined, "profileAtTurn4 companyName is NOT 'i am rutuja'");

  const ineligibilityTurn4 = checkDefinitiveIneligibility(profileAtTurn4);
  assert(ineligibilityTurn4.isIneligible === true, "checkDefinitiveIneligibility returns isIneligible = true for unemployed");
  assert(ineligibilityTurn4.reasonType === "UNEMPLOYED_OR_ZERO_INCOME", "ineligibility reason is UNEMPLOYED_OR_ZERO_INCOME");

  const intakePromptTurn4 = buildMultiBankIntakePrompt(profileAtTurn4);
  assert(!intakePromptTurn4.includes("employer as i am rutuja"), "Intake prompt NEVER records employer as 'i am rutuja'");
  assert(!intakePromptTurn4.includes("employment type (Salaried)"), "Intake prompt NEVER claims employment type is Salaried");

  // 4. Turn 5: "i am rutuja is my name"
  console.log("\n--- Test 4: Disavowal 'i am rutuja is my name' ---");
  assert(detectCompanyDisavowal("i am rutuja is my name").isDisavowal === true, "'i am rutuja is my name' is detected as disavowal");
  assert(isPersonalNameOrIntroduction("i am rutuja is my name") === true, "'i am rutuja is my name' is recognized as personal name");
  assert(isInvalidCompanyName("i am rutuja is my name") === true, "'i am rutuja is my name' is rejected as company name");
  assert(extractCompanyCandidateFromText("i am rutuja is my name") === undefined, "extractCompanyCandidateFromText is undefined for 'i am rutuja is my name'");

  const profileAfterTurn5 = consolidateApplicantProfileFromHistory(
    [
      ...historyBeforeTurn4,
      { role: "user", content: "i want loan" },
      { role: "assistant", content: "Understood..." },
    ],
    "i am rutuja is my name"
  );
  assert(profileAfterTurn5.companyName === undefined, "profileAfterTurn5 companyName is undefined");

  // 5. Turn 6: "my name is rutuja i am unemplye" (with typo 'unemplye')
  console.log("\n--- Test 5: Personal name + typo 'my name is rutuja i am unemplye' ---");
  assert(UNEMPLOYED_REGEX.test("my name is rutuja i am unemplye") === true, "UNEMPLOYED_REGEX matches 'unemplye'");
  assert(isPersonalNameOrIntroduction("my name is rutuja i am unemplye") === true, "'my name is rutuja...' recognized as personal name");
  assert(isInvalidCompanyName("my name is rutuja i am unemplye") === true, "rejected as company name");
  assert(extractCompanyCandidateFromText("my name is rutuja i am unemplye") === undefined, "extractCompanyCandidateFromText is undefined");

  const entitiesTurn6 = extractEntitiesFromText("my name is rutuja i am unemplye");
  assert(entitiesTurn6.employmentType === "Unemployed", "entitiesTurn6 has employmentType = 'Unemployed'");
  assert(entitiesTurn6.companyName === undefined, "entitiesTurn6 companyName is undefined");

  const profileAfterTurn6 = consolidateApplicantProfileFromHistory(
    [
      ...historyBeforeTurn4,
      { role: "user", content: "i want loan" },
      { role: "assistant", content: "Understood..." },
      { role: "user", content: "i am rutuja is my name" },
      { role: "assistant", content: "Understood..." },
    ],
    "my name is rutuja i am unemplye"
  );
  assert(profileAfterTurn6.employmentType === "Unemployed", "profileAfterTurn6 has employmentType = 'Unemployed'");
  assert(profileAfterTurn6.companyName === undefined, "profileAfterTurn6 companyName is undefined");

  console.log("\n🎉 ALL 18 TESTS PASSED SUCCESSFULLY! The user conversation bugs are completely eliminated.");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
