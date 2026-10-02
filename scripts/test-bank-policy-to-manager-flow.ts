import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("=== Testing Bank Policy & Proceed-to-Manager Workflow ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, detail?: any) {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      if (detail) console.error("   Details:", detail);
      failed++;
    }
  }

  // --- TEST 1: Mid-eligibility flow policy inquiry halts flow and returns policy ---
  const convId1 = "test-policy-halt-" + Date.now();
  await clearEligibilityState(convId1);

  // Turn 1: User starts loan flow
  const r1 = await runCentralAgent({ message: "I need a personal loan of 5 lakhs", conversationId: convId1 });
  const s1 = await getEligibilityState(convId1);
  assert(Boolean(s1?.in_eligibility_flow), "Step 1: Session is in eligibility flow");

  // Turn 2: User asks for ICICI Bank policy mid-flow
  const r2 = await runCentralAgent({
    message: "what is the policy of ICICI Bank",
    conversationId: convId1,
    conversationHistory: [
      { role: "user", content: "I need a personal loan of 5 lakhs" },
      { role: "assistant", content: r1.reply }
    ]
  });
  const s2 = await getEligibilityState(convId1);

  assert(!s2?.in_eligibility_flow, "Step 2: Eligibility flow is halted (in_eligibility_flow === false)");
  assert(s2?.selectedBank === "ICICI Bank" || s2?.lastPolicyBank === "ICICI Bank", "Step 2: Selected/lastPolicyBank is ICICI Bank", s2?.selectedBank);
  assert(r2.reply.includes("Criteria") && r2.reply.includes("Details"), "Step 2: Policy table contains Criteria | Details format");
  assert(/loan products offered/i.test(r2.reply) && /eligibility criteria/i.test(r2.reply), "Step 2: Policy contains structured sections");
  assert(!r2.reply.toLowerCase().includes("please provide your city"), "Step 2: No false bank selection prompt on policy query");
  assert(!r2.reply.toLowerCase().includes("whenever you're ready to continue"), "Step 2: No intake resume bridge appended");

  // --- TEST 2: Yes Bank policy with plural "policies" ---
  const convId2 = "test-yes-bank-policies-" + Date.now();
  await clearEligibilityState(convId2);

  const rYes = await runCentralAgent({ message: "i want to check the yes bank policies", conversationId: convId2 });
  const sYes = await getEligibilityState(convId2);

  assert(!rYes.reply.toLowerCase().includes("you selected **yes bank**"), "Step 3: 'i want to check the yes bank policies' does NOT trigger false bank selection", rYes.reply.slice(0, 150));
  assert(rYes.reply.includes("Criteria") && rYes.reply.includes("Details"), "Step 3: Yes Bank policy returned structured table");
  assert(sYes?.selectedBank === "Yes Bank" || sYes?.lastPolicyBank === "Yes Bank", "Step 3: State tracks Yes Bank", sYes);

  // --- TEST 3: Poonawalla Fincorp with single "l" ("poonawala") ---
  const convId3 = "test-poonawala-" + Date.now();
  await clearEligibilityState(convId3);

  const rPoona = await runCentralAgent({ message: "i want poonawala fincorp bank policy", conversationId: convId3 });
  assert(rPoona.reply.toLowerCase().includes("poonawalla") || rPoona.reply.toLowerCase().includes("criteria"), "Step 4: Poonawalla single-l matches Poonawalla Fincorp policy", rPoona.reply.slice(0, 150));

  // --- TEST 4: Proceed with bank loan -> asks for city ---
  const rProceed = await runCentralAgent({
    message: "I want to proceed with this bank loan",
    conversationId: convId2,
    conversationHistory: [
      { role: "user", content: "i want to check the yes bank policies" },
      { role: "assistant", content: rYes.reply }
    ]
  });
  const sProceed = await getEligibilityState(convId2);

  assert(
    rProceed.reply.toLowerCase().includes("city") && rProceed.reply.includes("Yes Bank"),
    "Step 5: Proceeding with loan prompts for city with target bank name",
    rProceed.reply
  );
  assert(sProceed?.currentStep === "CITY_COLLECTION" || sProceed?.expectedField === "city", "Step 5: Session state expects city", sProceed?.currentStep);

  // --- TEST 5: User shares City ("Pune") -> shows branches for Yes Bank ---
  const rCity = await runCentralAgent({
    message: "Pune",
    conversationId: convId2,
    conversationHistory: [
      { role: "user", content: "I want to proceed with this bank loan" },
      { role: "assistant", content: rProceed.reply }
    ]
  });
  const sCity = await getEligibilityState(convId2);

  assert(
    rCity.reply.includes("Pune Digital") || rCity.reply.includes("Available Yes Bank branches"),
    "Step 6: Pune branches listed for Yes Bank",
    rCity.reply
  );
  assert(sCity?.currentStep === "BRANCH_SELECTION", "Step 6: Current step is BRANCH_SELECTION");

  // --- TEST 6: User selects Branch ("1" or "Pune Digital") -> displays Manager Table ---
  const rBranch = await runCentralAgent({
    message: "1",
    conversationId: convId2,
    conversationHistory: [
      { role: "user", content: "Pune" },
      { role: "assistant", content: rCity.reply }
    ]
  });

  assert(
    rBranch.reply.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"),
    "Step 7: Manager table displayed with exact required columns",
    rBranch.reply.slice(0, 300)
  );
  assert(rBranch.reply.includes("Yes Bank"), "Step 7: Manager table contains Yes Bank");
  assert(rBranch.reply.includes("8999362624") || rBranch.reply.includes("7709104375"), "Step 7: Manager table contains actual manager contact details");

  // --- TEST 7: ICICI Bank proceed -> city -> branch list -> manager table ---
  const convId4 = "test-single-branch-" + Date.now();
  await clearEligibilityState(convId4);

  // User asks for ICICI policy
  await runCentralAgent({ message: "what is the policy of ICICI Bank", conversationId: convId4 });
  // User proceeds
  const rProc4 = await runCentralAgent({ message: "proceed with icici bank loan", conversationId: convId4 });
  // User enters Pune -> system prompts with available branch
  const rCity4 = await runCentralAgent({
    message: "Pune",
    conversationId: convId4,
    conversationHistory: [{ role: "assistant", content: rProc4.reply }]
  });

  assert(
    rCity4.reply.includes("Available ICICI Bank branches in Pune"),
    "Step 8a: Available branches listed for ICICI Bank in Pune",
    rCity4.reply
  );

  // User selects branch "1"
  const rBranch4 = await runCentralAgent({
    message: "1",
    conversationId: convId4,
    conversationHistory: [{ role: "assistant", content: rCity4.reply }]
  });

  assert(
    rBranch4.reply.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"),
    "Step 8b: ICICI Bank branch selection displays 6-column manager table",
    rBranch4.reply.slice(0, 300)
  );
  assert(rBranch4.reply.includes("ICICI Bank"), "Step 8b: Displays ICICI Bank manager records");

  console.log(`\n========================================`);
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().then(() => process.exit(0)).catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
