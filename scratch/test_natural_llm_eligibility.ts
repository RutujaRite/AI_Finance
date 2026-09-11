import "dotenv/config";
import * as assert from "assert";
import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("\n================================================================================");
  console.log("TEST 1: Unemployed / Jobless User ('I am jobless')");
  console.log("================================================================================");
  const convId1 = `test-jobless-${Date.now()}`;
  await clearEligibilityState(convId1);

  // Turn 1: User expresses loan intent
  console.log("Turn 1: User says 'I need a loan'");
  const turn1 = await runCentralAgent({
    message: "I need a loan",
    conversationId: convId1,
  });
  console.log("Agent response preview:\n" + turn1.reply.slice(0, 150) + "...\n");
  assert.ok(
    turn1.reply.toLowerCase().includes("company") ||
    turn1.reply.toLowerCase().includes("employer") ||
    turn1.reply.toLowerCase().includes("workplace") ||
    turn1.reply.toLowerCase().includes("organization"),
    "Turn 1 should ask for company/employer"
  );

  // Turn 2: User says 'I am jobless'
  console.log("Turn 2: User says 'I am jobless'");
  const turn2 = await runCentralAgent({
    message: "I am jobless",
    conversationId: convId1,
  });
  console.log("Agent response:\n" + turn2.reply + "\n");

  // Verify:
  // 1. Must NOT treat 'I am jobless' as a company name
  const state1 = await getEligibilityState(convId1);
  assert.ok(
    !state1?.applicant?.companyName?.toLowerCase().includes("jobless"),
    "Must not save 'I am jobless' as company name"
  );

  // 2. Must NOT continue the questionnaire asking for loan amount, tenure, cibil, etc.
  const lowerReply1 = turn2.reply.toLowerCase();
  assert.ok(
    !lowerReply1.includes("what repayment tenure") &&
    !lowerReply1.includes("how much loan amount") &&
    !lowerReply1.includes("what is your approximate cibil"),
    "Must NOT continue asking subsequent questions to a jobless user"
  );

  // 3. Must clearly explain partner bank income/employment requirements
  assert.ok(
    lowerReply1.includes("not eligible") ||
    lowerReply1.includes("partner banks") ||
    lowerReply1.includes("income") ||
    lowerReply1.includes("employment"),
    "Must explain that partner banks require employment/income"
  );
  console.log("✅ TEST 1 PASSED: Jobless applicant handled naturally with definitive explanation.\n");

  console.log("\n================================================================================");
  console.log("TEST 2: Zero Income User ('0rs' for salary)");
  console.log("================================================================================");
  const convId2 = `test-zerosal-${Date.now()}`;
  await clearEligibilityState(convId2);

  // Turn 1: Start flow
  await runCentralAgent({
    message: "Can I get a personal loan?",
    conversationId: convId2,
  });

  // Turn 2: Provide company
  const turn2b = await runCentralAgent({
    message: "Infosys",
    conversationId: convId2,
  });
  console.log("Agent ask for salary:\n" + turn2b.reply.slice(0, 150) + "...\n");

  // Turn 3: User answers 0rs
  console.log("Turn 3: User says '0rs'");
  const turn3b = await runCentralAgent({
    message: "0rs",
    conversationId: convId2,
  });
  console.log("Agent response:\n" + turn3b.reply + "\n");

  // Verify:
  // Must NOT repeat "What is your monthly salary?"
  const lowerReply2 = turn3b.reply.toLowerCase();
  assert.ok(
    !lowerReply2.includes("what is your approximate net monthly") &&
    !lowerReply2.includes("could you share your monthly take-home"),
    "Must NOT repeat salary question when user replied 0rs"
  );
  assert.ok(
    lowerReply2.includes("not eligible") ||
    lowerReply2.includes("income") ||
    lowerReply2.includes("partner banks"),
    "Must explain ineligibility due to zero income"
  );
  console.log("✅ TEST 2 PASSED: 0rs salary handled without repeating questions.\n");

  console.log("\n================================================================================");
  console.log("TEST 3: Multi-Information Natural Turn");
  console.log("================================================================================");
  const convId3 = `test-multi-${Date.now()}`;
  await clearEligibilityState(convId3);

  const multiQuery = "I work at Tata Consultancy Services, salary 85000, credit score 770, need 5 lakhs for 3 years, 0 emi, age 29";
  console.log(`User says: "${multiQuery}"`);
  const multiRes = await runCentralAgent({
    message: multiQuery,
    conversationId: convId3,
  });
  console.log("Agent response preview:\n" + multiRes.reply.slice(0, 300) + "...\n");

  // Must output eligibility table with columns: Bank | Status | CIBIL | Tenure | Est. EMI
  assert.ok(
    multiRes.reply.includes("Bank") &&
    multiRes.reply.includes("Status") &&
    multiRes.reply.includes("CIBIL") &&
    multiRes.reply.includes("Tenure") &&
    multiRes.reply.includes("Est. EMI"),
    "Must output standard eligibility table directly from single turn"
  );
  console.log("✅ TEST 3 PASSED: Multi-information turn processed into full table.\n");

  console.log("\n================================================================================");
  console.log("TEST 4: Bank Policy Separation & Unsupported Bank Check");
  console.log("================================================================================");
  // Verify unsupported bank still returns Bank Policy Not Available
  const unsuppRes = await runCentralAgent({
    message: "Tell me the policy of a bank that isn't available",
    conversationId: `test-unsupp-${Date.now()}`,
  });
  assert.ok(
    unsuppRes.reply.includes("Bank Policy Not Available"),
    "Must return Bank Policy Not Available for unavailable bank"
  );
  console.log("✅ TEST 4 PASSED: Bank policy separation verified.\n");

  console.log("\n================================================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
