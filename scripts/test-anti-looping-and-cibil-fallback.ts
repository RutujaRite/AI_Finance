import { runCentralAgent } from "@/lib/ai/agent";

async function runAntiLoopingAndCibilTests() {
  console.log("================================================================================");
  console.log("TESTING ANTI-LOOPING, CIBIL FALLBACK & 3-STEP EVALUATION RULES");
  console.log("================================================================================\n");

  // --------------------------------------------------------------------------
  // TEST 1: Anti-Looping & Automatic Fallback on Uncertainty/Stuck Input
  // --------------------------------------------------------------------------
  console.log(">>> TEST 1: ANTI-LOOPING & AUTOMATIC BENCHMARK ASSUMPTIONS <<<\n");
  const stuckConvId = `test-stuck-${Date.now()}`;

  // Turn 1: Start loan eligibility flow
  console.log("User: 'Check loan eligibility, salary 50000'");
  const t1 = await runCentralAgent({ message: "Check loan eligibility, salary 50000", conversationId: stuckConvId });
  console.log(`Assistant (Turn 1):\n${t1.reply}\n`);
  if (!t1.reply.toLowerCase().includes("employer") && !t1.reply.toLowerCase().includes("company")) {
    throw new Error("Test 1 failed! Expected prompt for employer.");
  }

  // Turn 2: User provides employer
  console.log("User: 'Google India Private Limited'");
  const t2 = await runCentralAgent({ message: "Google India Private Limited", conversationId: stuckConvId });
  console.log(`Assistant (Turn 2):\n${t2.reply}\n`);

  let targetReply = t2.reply;
  if (t2.reply.includes("Matching Companies Found")) {
    console.log("User: '1'");
    const t2b = await runCentralAgent({ message: "1", conversationId: stuckConvId });
    console.log(`Assistant (Turn 2b):\n${t2b.reply}\n`);
    targetReply = t2b.reply;
  }

  if (!targetReply.includes("How much loan amount would you like to borrow") && !targetReply.toLowerCase().includes("loan amount")) {
    throw new Error("Test 1 failed! Expected prompt for loan amount.");
  }

  // Turn 3: User is stuck / uncertain ("I am not sure, you choose" or "idk, whatever is standard")
  console.log("User: 'I am not sure, you choose standard defaults'");
  const t3 = await runCentralAgent({ message: "I am not sure, you choose standard defaults", conversationId: stuckConvId });
  console.log(`Assistant (Turn 3):\n${t3.reply}\n`);

  // Rule verification:
  // 1. Did NOT repeat "How much loan amount would you like to borrow"
  if (t3.reply.includes("How much loan amount would you like to borrow")) {
    throw new Error("Test 1 failed! Agent repeated the missing question instead of falling back.");
  }
  // 2. Evaluated immediately with assumptions
  if (!t3.reply.includes("Assumptions Used") || !t3.reply.includes("Bank Policy Financial Calculations") || !t3.reply.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |")) {
    throw new Error("Test 1 failed! Expected full 3-step evaluation with Assumptions Used and Calculations.");
  }
  // 3. Fallback notice displayed since CIBIL was not specified
  if (!t3.reply.includes("Since no CIBIL score was provided, I am assuming a baseline CIBIL score of 700")) {
    throw new Error("Test 1 failed! Expected CIBIL fallback notice.");
  }

  console.log("✅ TEST 1 PASSED: Anti-looping triggered, no question repeated, standard benchmark assumptions applied!\n");

  // --------------------------------------------------------------------------
  // TEST 2: Specified CIBIL Score (Notice MUST be omitted)
  // --------------------------------------------------------------------------
  console.log(">>> TEST 2: SPECIFIED CIBIL SCORE DIRECT USAGE <<<\n");
  const specifiedCibilConvId = `test-spec-cibil-${Date.now()}`;

  // User provides full details including explicit CIBIL = 765
  console.log("User: 'I work at Microsoft, need 8 lakhs for 4 years, my CIBIL is 765 and age is 29'");
  const tSpec = await runCentralAgent({
    message: "I work at Microsoft, need 8 lakhs for 4 years, my CIBIL is 765 and age is 29",
    conversationId: specifiedCibilConvId,
  });
  console.log(`Assistant:\n${tSpec.reply}\n`);

  // Rule verification:
  // 1. Evaluation completed
  if (!tSpec.reply.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |")) {
    throw new Error("Test 2 failed! Expected evaluation table.");
  }
  // 2. Fallback notice MUST NOT be present
  if (tSpec.reply.includes("Since no CIBIL score was provided")) {
    throw new Error("Test 2 failed! CIBIL fallback notice was unexpectedly displayed when CIBIL was specified.");
  }
  // 3. Financial calculations and results table present
  if (!tSpec.reply.includes("Bank Policy Financial Calculations")) {
    throw new Error("Test 2 failed! Expected Bank Policy Financial Calculations.");
  }

  console.log("✅ TEST 2 PASSED: Specified CIBIL score used directly, notice omitted as required!\n");

  // --------------------------------------------------------------------------
  // TEST 3: Stating "No CIBIL score" / Zero Credit History
  // --------------------------------------------------------------------------
  console.log(">>> TEST 3: EXPLICIT 'NO CIBIL SCORE' / ZERO CREDIT HISTORY <<<\n");
  const zeroCreditConvId = `test-zero-credit-${Date.now()}`;

  console.log("User: 'I want a loan of 5 lakhs for 5 years, working at Infosys, age 28, but I have no CIBIL score'");
  const tZero = await runCentralAgent({
    message: "I want a loan of 5 lakhs for 5 years, working at Infosys, age 28, but I have no CIBIL score",
    conversationId: zeroCreditConvId,
  });
  console.log(`Assistant:\n${tZero.reply}\n`);

  // Rule verification:
  // 1. Notice MUST be prominently displayed
  if (!tZero.reply.includes("Since no CIBIL score was provided, I am assuming a baseline CIBIL score of 700 to calculate your eligibility.")) {
    throw new Error("Test 3 failed! Expected CIBIL benchmark 700 notice.");
  }
  // 2. Assumptions used section present
  if (!tZero.reply.includes("Assumptions Used")) {
    throw new Error("Test 3 failed! Expected Assumptions Used section.");
  }
  // 3. Bank Policy Financial Calculations present
  if (!tZero.reply.includes("Bank Policy Financial Calculations") || !tZero.reply.includes("Maximum Eligible EMI Capacity")) {
    throw new Error("Test 3 failed! Expected Bank Policy Financial Calculations.");
  }

  console.log("✅ TEST 3 PASSED: Zero credit history captured, benchmark 700 assumed and notice displayed!\n");

  console.log("================================================================================");
  console.log("ALL ANTI-LOOPING, CIBIL FALLBACK & EVALUATION STEP TESTS PASSED! 🚀");
  console.log("================================================================================\n");
}

runAntiLoopingAndCibilTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
