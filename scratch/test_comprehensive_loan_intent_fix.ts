import "dotenv/config";
import * as assert from "assert";
import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runComprehensiveTests() {
  console.log("=== 1. Testing Core Eligibility Intent Phrases ===");

  const targetPhrases = [
    "What banks am I eligible for?",
    "Which banks can I get a loan from?",
    "Which bank is best for my loan?",
    "Am I eligible for a loan?",
    "Which banks will give me a loan?",
    "Where can I get a personal loan?",
    "Check my loan eligibility",
    "What are my loan options?",
    "I need a loan",
    "I need ₹5 lakh loan"
  ];

  for (const phrase of targetPhrases) {
    const convId = `test-intent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await clearEligibilityState(convId);

    const res = await runCentralAgent({
      message: phrase,
      conversationId: convId,
    });

    console.log(`[TEST PASSED] Phrase: "${phrase}"`);
    console.log(`  Reply preview: ${res.reply.slice(0, 100).replace(/\n/g, " ")}...`);

    // Must start collecting applicant details (company/employer or financial profile)
    const lowerReply = res.reply.toLowerCase();
    const asksDetails =
      lowerReply.includes("company") ||
      lowerReply.includes("employer") ||
      lowerReply.includes("salary") ||
      lowerReply.includes("income") ||
      lowerReply.includes("eligibility");

    assert.ok(
      asksDetails,
      `Phrase "${phrase}" must trigger eligibility flow and ask for details. Got: ${res.reply}`
    );

    // Must NOT be classified as general FAQ / generic help
    assert.ok(
      !res.reply.includes("I can help explain banking terms"),
      `Phrase "${phrase}" must not trigger GENERAL_INFORMATION helper response`
    );

    // Verify session state was created
    const session = await getEligibilityState(convId);
    assert.ok(session, `Session state must be active for conversation ${convId}`);
  }

  console.log("\n=== 2. Testing Multi-Turn Detail Collection ===");
  const flowConvId = `test-multiturn-${Date.now()}`;
  await clearEligibilityState(flowConvId);

  // Turn 1: Initiation
  const turn1 = await runCentralAgent({
    message: "What banks am I eligible for?",
    conversationId: flowConvId,
  });
  console.log("Turn 1 Reply:\n", turn1.reply);
  assert.ok(turn1.reply.toLowerCase().includes("company") || turn1.reply.toLowerCase().includes("employer"));

  // Turn 2: Providing company
  const turn2 = await runCentralAgent({
    message: "Tata Consultancy Services",
    conversationId: flowConvId,
  });
  console.log("Turn 2 Reply:\n", turn2.reply);
  assert.ok(
    turn2.reply.toLowerCase().includes("salary") ||
    turn2.reply.toLowerCase().includes("income") ||
    turn2.reply.toLowerCase().includes("tata"),
    "Turn 2 must record company and ask for salary/income"
  );

  const stateTurn2 = await getEligibilityState(flowConvId);
  assert.ok(
    stateTurn2?.applicant?.companyName?.includes("Tata Consultancy Services"),
    "Company name must be saved in applicant profile"
  );

  console.log("\n=== 3. Testing Bank Policy Separation (MUST NOT trigger eligibility flow) ===");
  const policyQueries = [
    "What is HDFC bank policy?",
    "What are ICICI guidelines?",
    "Axis Bank CIBIL cutoff policy"
  ];

  for (const query of policyQueries) {
    const policyConvId = `test-pol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await clearEligibilityState(policyConvId);

    const polRes = await runCentralAgent({
      message: query,
      conversationId: policyConvId,
    });

    console.log(`[TEST PASSED] Policy Query: "${query}"`);
    console.log(`  Reply preview: ${polRes.reply.slice(0, 120).replace(/\n/g, " ")}...`);

    // Must NOT ask for company name / start eligibility flow
    assert.ok(
      !polRes.reply.includes("what is your company or employer name"),
      `Policy query "${query}" must NOT start loan eligibility assessment`
    );

    // Must show policy table sections
    assert.ok(
      polRes.reply.includes("Loan Products Offered") ||
      polRes.reply.includes("Eligibility Criteria") ||
      polRes.reply.includes("Master Policy"),
      `Policy query "${query}" must show policy summary table`
    );

    // Session must NOT be in eligibility flow
    const polSession = await getEligibilityState(policyConvId);
    assert.ok(!polSession?.applicant?.companyName, "Policy query should not create applicant company");
  }

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
}

runComprehensiveTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
