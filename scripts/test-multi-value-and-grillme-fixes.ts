import assert from "assert";
import {
  parseFinancialAmount,
  extractCommaSeparatedProfileParameters,
  messageMentionsField,
  ApplicantProfile,
} from "../lib/dynamicEligibilityEngine";
import { classifyIntelligentIntent } from "../lib/ai/intentClassifier";

async function runTests() {
  console.log("=== RUNNING MULTI-VALUE & GRILL-ME VALIDATION SUITE ===\n");

  // 1. Safe Financial Parsing (₹27,10,000 corruption regression test)
  console.log("TEST 1: Safe financial parsing & no digit concatenation");
  const multiNumberResult = parseFinancialAmount("age is 27 years monthly emi are 10000");
  assert.strictEqual(
    multiNumberResult,
    null,
    `Expected multi-number string to return null, got ${multiNumberResult}`
  );
  assert.strictEqual(parseFinancialAmount("10000"), 10000);
  assert.strictEqual(parseFinancialAmount("₹10,000"), 10000);
  assert.strictEqual(parseFinancialAmount("50k"), 50000);
  assert.strictEqual(parseFinancialAmount("5 lakhs"), 500000);
  assert.strictEqual(parseFinancialAmount("0"), 0);
  assert.strictEqual(parseFinancialAmount("none"), 0);
  console.log("✓ TEST 1 PASSED: Multi-number squashing bug completely fixed.\n");

  // 2. Field mention checks for monthly EMI
  console.log("TEST 2: messageMentionsField for 'monthly emi are 10000'");
  assert.strictEqual(
    messageMentionsField("existingEmi", "age is 27 years monthly emi are 10000"),
    true,
    "Expected messageMentionsField('existingEmi') to be true"
  );
  assert.strictEqual(
    messageMentionsField("age", "age is 27 years monthly emi are 10000"),
    true,
    "Expected messageMentionsField('age') to be true"
  );
  console.log("✓ TEST 2 PASSED: Field mention detection handles 'monthly emi'.\n");

  // 3. Comma-separated profile extraction
  console.log("TEST 3: extractCommaSeparatedProfileParameters");
  
  // 3a. Standard 3-value: CIBIL, Age, EMI
  const res1 = extractCommaSeparatedProfileParameters("760, 34, 0");
  assert.deepStrictEqual(res1, { cibil: 760, age: 34, existingEmi: 0 });

  // 3b. 4-value: Income, CIBIL, Age, EMI
  const res2 = extractCommaSeparatedProfileParameters("80000, 760, 28, 0");
  assert.deepStrictEqual(res2, {
    monthlyIncome: 80000,
    cibil: 760,
    age: 28,
    existingEmi: 0,
  });

  // 3c. Zero value acceptance
  const res3 = extractCommaSeparatedProfileParameters("760, 34, 0");
  assert.strictEqual(res3.existingEmi, 0);

  // 3d. 'not sure' handling for CIBIL
  const res4 = extractCommaSeparatedProfileParameters("not sure, 34, 0");
  assert.strictEqual(res4.cibil, "Not provided");
  assert.strictEqual(res4.age, 34);
  assert.strictEqual(res4.existingEmi, 0);

  // 3e. Single value (no commas) returns empty object
  const res5 = extractCommaSeparatedProfileParameters("760");
  assert.deepStrictEqual(res5, {});

  // 3f. Mixed text with multipliers: '50k, 760, 34, 0'
  const res6 = extractCommaSeparatedProfileParameters("50k, 760, 34, 0");
  assert.deepStrictEqual(res6, {
    monthlyIncome: 50000,
    cibil: 760,
    age: 34,
    existingEmi: 0,
  });

  // 3g. Fields already set on existingApplicant are preserved
  const existingApp: ApplicantProfile = { age: 32 };
  const res7 = extractCommaSeparatedProfileParameters("760, 34, 0", existingApp);
  assert.strictEqual(res7.age, undefined, "Age should not overwrite existing age");
  assert.strictEqual(res7.cibil, 760);
  assert.strictEqual(res7.existingEmi, 0);

  // 3h. Cross-field value ordering: 0, 34, 760
  const res8 = extractCommaSeparatedProfileParameters("0, 34, 760");
  assert.deepStrictEqual(res8, {
    existingEmi: 0,
    age: 34,
    cibil: 760,
  });

  console.log("✓ TEST 3 PASSED: All comma-separated extraction scenarios verified.\n");

  // 4. Intent Classification for 'how can i get loan from hdfc bank ?'
  console.log("TEST 4: Intent classification for single-bank loan inquiry");
  const nluResult = await classifyIntelligentIntent({
    userMessage: "how can i get loan from hdfc bank ?",
  });
  assert.strictEqual(
    nluResult.intent,
    "BANK_POLICY_QUERY",
    `Expected BANK_POLICY_QUERY, got ${nluResult.intent}`
  );
  assert.strictEqual(
    nluResult.targetBank,
    "HDFC Bank",
    `Expected targetBank 'HDFC Bank', got ${nluResult.targetBank}`
  );
  console.log("✓ TEST 4 PASSED: Single bank query routes to BANK_POLICY_QUERY for HDFC Bank.\n");

  console.log("ALL TESTS COMPLETED SUCCESSFULLY! 🎉");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
