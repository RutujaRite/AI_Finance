import { runCentralAgent } from "../lib/ai/agent";
import { saveEligibilityState, getEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("=== Testing Intent Recognition & Location Trap Fixes ===\n");
  let passed = 0;
  let failed = 0;

  function assert(desc: string, cond: boolean, details?: any) {
    if (cond) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      if (details) console.error("   Details:", details);
      failed++;
    }
  }

  const convId = "test_trap_fix_" + Date.now();

  // Seed session state: User has completed eligibility and selected Yes Bank, now awaiting branch location
  const initialSession = {
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    selectedBank: "Yes Bank",
    chosenBank: "Yes Bank",
    eligible_banks: ["Yes Bank", "HDFC Bank", "ICICI Bank"],
    postEligibilityStage: "AWAITING_BRANCH_LOCATION",
    currentStep: "CITY_COLLECTION",
    expectedField: "cityOrPincode",
    applicant: {
      monthlySalary: 75000,
      cibilScore: 780,
      age: 28,
      existingEmi: 0,
      loanAmount: 500000,
      tenureMonths: 36,
      employmentType: "Salaried",
      companyName: "Capgemini",
    },
  };

  await saveEligibilityState(convId, initialSession as any);

  // Test 1: User types "capgemini" while awaiting Yes Bank location
  console.log("\n--- Test 1: Typing standalone 'capgemini' in AWAITING_BRANCH_LOCATION ---");
  const res1 = await runCentralAgent({
    conversationId: convId,
    message: "capgemini",
    conversationHistory: [
      { role: "assistant", content: "Great! You've selected **Yes Bank**. Which city or area would you like to visit?" }
    ],
  });

  assert(
    "Does NOT reply with 'I couldn't find an exact or matching Yes Bank manager'",
    !res1.reply.includes("I couldn't find an exact or matching Yes Bank manager"),
    res1.reply.substring(0, 200)
  );

  assert(
    "Answers Capgemini company categories across partner banks (or disambiguation list)",
    res1.reply.toLowerCase().includes("capgemini") && (res1.reply.includes("CAT") || res1.reply.includes("UPC") || res1.reply.includes("category") || res1.reply.includes("Matching Companies") || res1.reply.includes("employer")),
    res1.reply.substring(0, 300)
  );

  assert(
    "Appends seamless continuation note that Yes Bank is still active",
    res1.reply.includes("Yes Bank") && (res1.reply.includes("still active") || res1.reply.includes("ready")),
    res1.reply.substring(res1.reply.length - 250)
  );

  // Test 2: User types "search capgemini compsany"
  console.log("\n--- Test 2: Typing 'search capgemini compsany' (with typo) ---");
  const res2 = await runCentralAgent({
    conversationId: convId,
    message: "search capgemini compsany",
    conversationHistory: [
      { role: "user", content: "capgemini" },
      { role: "assistant", content: res1.reply },
    ],
  });

  assert(
    "Does NOT reply with 'I couldn't find an exact or matching Yes Bank manager'",
    !res2.reply.includes("I couldn't find an exact or matching Yes Bank manager"),
    res2.reply.substring(0, 200)
  );

  assert(
    "Answers Capgemini company categories",
    res2.reply.toLowerCase().includes("capgemini"),
    res2.reply.substring(0, 300)
  );

  // Test 3: Off-topic financial question: "What is CIBIL score?"
  console.log("\n--- Test 3: Asking 'What is CIBIL score?' mid-flow ---");
  const res3 = await runCentralAgent({
    conversationId: convId,
    message: "What is CIBIL score?",
    conversationHistory: [
      { role: "assistant", content: "Great! You've selected **Yes Bank**. Which city or area would you like to visit?" }
    ],
  });

  assert(
    "Does NOT treat 'What is CIBIL score?' as a location",
    !res3.reply.includes("I couldn't find an exact or matching Yes Bank manager"),
    res3.reply.substring(0, 200)
  );

  assert(
    "Answers CIBIL definition conceptually",
    res3.reply.toLowerCase().includes("cibil") && (res3.reply.includes("credit") || res3.reply.includes("score")),
    res3.reply.substring(0, 250)
  );

  // Test 4: Unrecognized gibberish string: "xyzrandom123"
  console.log("\n--- Test 4: Unrecognized gibberish input 'xyzrandom123' ---");
  const res4 = await runCentralAgent({
    conversationId: convId,
    message: "xyzrandom123",
    conversationHistory: [
      { role: "assistant", content: "Great! You've selected **Yes Bank**. Which city or area would you like to visit?" }
    ],
  });

  assert(
    "Returns helpful fallback prompt on unmatched location input",
    res4.reply.includes("couldn't find") && res4.reply.includes("Would you like to try another area or PIN code?"),
    res4.reply.substring(0, 250)
  );

  // Test 5: Providing actual city: "Pune"
  console.log("\n--- Test 5: Providing actual city 'Pune' ---");
  const res5 = await runCentralAgent({
    conversationId: convId,
    message: "Pune",
    conversationHistory: [
      { role: "assistant", content: "Great! You've selected **Yes Bank**. Which city or area would you like to visit?" }
    ],
  });

  assert(
    "Returns Yes Bank branches or manager details for Pune",
    res5.reply.toLowerCase().includes("yes bank") && (res5.reply.includes("branches in Pune") || res5.reply.includes("Manager")),
    res5.reply.substring(0, 250)
  );

  // Test 6: Providing PIN code: "411038"
  console.log("\n--- Test 6: Providing PIN code '411038' ---");
  const res6 = await runCentralAgent({
    conversationId: convId,
    message: "411038",
    conversationHistory: [
      { role: "assistant", content: "Great! You've selected **Yes Bank**. Which city or area would you like to visit?" }
    ],
  });

  assert(
    "Returns Yes Bank manager or contact information for PIN 411038",
    res6.reply.toLowerCase().includes("yes bank") && (res6.reply.includes("Manager") || res6.reply.includes("411038") || res6.reply.includes("Pune") || res6.reply.includes("Branch")),
    res6.reply.substring(0, 300)
  );

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
