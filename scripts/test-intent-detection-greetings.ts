// scripts/test-intent-detection-greetings.ts

import { runCentralAgent } from "../lib/ai/agent";
import { isPureGreeting, hasGreetingPrefix, stripGreetingPrefix, isInvalidCompanyName, extractCompanyCandidateFromText, detectLoanIntent } from "../lib/dynamicEligibilityEngine";
import assert from "assert";

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING NATURAL LANGUAGE INTENT DETECTION & GREETING DISAMBIGUATION");
  console.log("================================================================================\n");

  // 1. Unit Tests for Greeting Helpers
  console.log("--- 1. Testing Greeting Detection Helpers ---");
  const pureGreetings = [
    "helo",
    "hello",
    "hlo",
    "hlw",
    "hellow",
    "helloo",
    "hi",
    "hii",
    "hiii",
    "hey",
    "heyy",
    "heya",
    "namaste",
    "namaskar",
    "pranam",
    "vanakkam",
    "salaam",
    "good morning",
    "good afternoon",
    "good evening",
    "helo bot",
    "hello creditwise",
    "hi there",
  ];

  for (const g of pureGreetings) {
    const isG = isPureGreeting(g);
    console.log(`  isPureGreeting("${g}") = ${isG}`);
    assert.strictEqual(isG, true, `Expected "${g}" to be detected as pure greeting`);

    const isInvComp = isInvalidCompanyName(g);
    assert.strictEqual(isInvComp, true, `Expected "${g}" to be rejected as invalid company name`);

    const cand = extractCompanyCandidateFromText(g);
    assert.strictEqual(cand, undefined, `Expected extractCompanyCandidateFromText("${g}") to be undefined`);
  }
  console.log("  ✅ All pure greetings detected and rejected as company candidates.\n");

  // 2. Non-greetings must NOT be detected as pure greetings
  console.log("--- 2. Testing Non-Greetings and Company Names ---");
  const nonGreetings = [
    "Infosys Limited",
    "Tata Consultancy Services",
    "Wipro",
    "Google",
    "I need a loan",
    "HDFC bank policy",
    "calculate emi for 5 lakh",
    "Pune",
  ];

  for (const ng of nonGreetings) {
    const isG = isPureGreeting(ng);
    console.log(`  isPureGreeting("${ng}") = ${isG}`);
    assert.strictEqual(isG, false, `Expected "${ng}" NOT to be pure greeting`);
  }
  console.log("  ✅ Non-greetings accurately distinguished.\n");

  // 3. Test Prefix Stripping on Compound Messages
  console.log("--- 3. Testing Compound Messages with Greeting Prefixes ---");
  const compoundCases = [
    { input: "helo I need a loan", expectedIntent: true },
    { input: "hi can I get a loan", expectedIntent: true },
    { input: "hey I need 5 lakh loan", expectedIntent: true },
    { input: "namaste I want personal loan", expectedIntent: true },
  ];

  for (const cc of compoundCases) {
    const hasP = hasGreetingPrefix(cc.input);
    const stripped = stripGreetingPrefix(cc.input);
    const loanIntent = detectLoanIntent(cc.input);
    console.log(`  Input: "${cc.input}"`);
    console.log(`    hasGreetingPrefix: ${hasP}`);
    console.log(`    stripped: "${stripped}"`);
    console.log(`    isLoanIntent: ${loanIntent.isLoanIntent}`);
    assert.strictEqual(hasP, true);
    assert.strictEqual(loanIntent.isLoanIntent, cc.expectedIntent);
  }
  console.log("  ✅ Greeting prefixes stripped and loan intents preserved.\n");

  // 4. End-to-End Agent Execution with "helo"
  console.log("--- 4. End-to-End Agent Test for 'helo' ---");
  const testConvId = `test-helo-${Date.now()}`;
  const heloRes = await runCentralAgent({
    conversationId: testConvId,
    message: "helo",
  });

  console.log("Response for 'helo':\n" + heloRes.reply);

  // Verification assertions for "helo":
  assert.ok(
    heloRes.reply.includes("CreditWise AI"),
    "Expected response to introduce CreditWise AI"
  );
  assert.ok(
    !heloRes.reply.includes("ARCHELONS"),
    "CRITICAL: Response must NOT contain ARCHELONS"
  );
  assert.ok(
    !heloRes.reply.includes("CHELOOR"),
    "CRITICAL: Response must NOT contain CHELOOR"
  );
  assert.ok(
    !heloRes.reply.includes("ECHELON"),
    "CRITICAL: Response must NOT contain ECHELON"
  );
  assert.ok(
    !heloRes.reply.includes("MECHELONIC"),
    "CRITICAL: Response must NOT contain MECHELONIC"
  );
  assert.ok(
    !heloRes.reply.includes("matching \"helo\""),
    "CRITICAL: Response must NOT say 'matching \"helo\"'"
  );
  console.log("  ✅ 'helo' produces a welcome greeting without triggering company search!\n");

  // 5. End-to-End Agent Test for "helo I need a loan"
  console.log("--- 5. End-to-End Agent Test for 'helo I need a loan' ---");
  const loanConvId = `test-loan-${Date.now()}`;
  const loanRes = await runCentralAgent({
    conversationId: loanConvId,
    message: "helo I need a loan",
  });

  console.log("Response for 'helo I need a loan':\n" + loanRes.reply);
  assert.ok(
    !loanRes.reply.includes("ARCHELONS") && !loanRes.reply.includes("ECHELON"),
    "Response must not trigger company search on 'helo'"
  );
  assert.ok(
    /employer|company|salary|income|eligibility/i.test(loanRes.reply),
    "Response should start loan eligibility flow"
  );
  console.log("  ✅ 'helo I need a loan' triggers eligibility flow without matching companies on 'helo'!\n");

  // 6. End-to-End Agent Test for Policy Query
  console.log("--- 6. End-to-End Agent Test for 'helo what is HDFC bank policy?' ---");
  const policyConvId = `test-policy-${Date.now()}`;
  const policyRes = await runCentralAgent({
    conversationId: policyConvId,
    message: "helo what is HDFC bank policy?",
  });

  console.log("Response for 'helo what is HDFC bank policy?':\n" + policyRes.reply.slice(0, 300) + "...\n");
  assert.ok(
    policyRes.reply.includes("HDFC") && /Criteria\s*\|\s*Details/i.test(policyRes.reply),
    "Response should render HDFC Bank policy table"
  );
  console.log("  ✅ 'helo what is HDFC bank policy?' renders policy table!\n");

  console.log("================================================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("================================================================================\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
