import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";
import { clearEligibilityState, getEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("================================================================================");
  console.log("   TEST SUITE: LLM-FIRST INTENT DETECTION & CONVERSATIONAL ASSISTANT            ");
  console.log("================================================================================\n");

  // TEST 1: Direct Intent Classification across all 6 categories
  console.log("--- TEST 1: Verifying 6 Canonical Intent Categories via LLM ---");
  const classificationCases = [
    { msg: "Hello, good morning!", expected: "GREETINGS" },
    { msg: "I want to apply for a personal loan", expected: "LOAN_ELIGIBILITY" },
    { msg: "Can you calculate my EMI for 10 lakhs at 11% for 5 years?", expected: "CALCULATION" },
    { msg: "Calculate monthly payment for 500000", expected: "CALCULATION" },
    { msg: "What is HDFC Bank's minimum CIBIL cutoff?", expected: "GENERAL_INFORMATION" },
    { msg: "What does FOIR mean in personal loans?", expected: "GENERAL_INFORMATION" },
    { msg: "Who is the manager for ICICI in Pune?", expected: "GENERAL_INFORMATION" },
    { msg: "Actually change my monthly salary to 200000", expected: "CHANGING_DETAILS" },
    { msg: "Update my CIBIL score to 780", expected: "CHANGING_DETAILS" },
    { msg: "Cancel this assessment", expected: "ANOTHER_TOPIC" },
    { msg: "Who created you and what can you do?", expected: "ANOTHER_TOPIC" },
  ];

  for (const tc of classificationCases) {
    const res = await classifyIntentWithLLM(tc.msg);
    const passed = res.intent === tc.expected;
    console.log(`[${passed ? "PASS" : "FAIL"}] "${tc.msg}" -> ${res.intent} (Expected: ${tc.expected})`);
    if (!passed) {
      console.warn(`      Mismatch! SubIntent: ${res.subIntent}, Raw: ${res.rawResponse?.slice(0, 80)}`);
    }
  }

  // TEST 2: Mid-flow side question handling in central agent
  console.log("\n--- TEST 2: Mid-Flow Side-Question Handling (Never force next question) ---");
  const convId = "test-intent-flow-" + Date.now();
  await clearEligibilityState(convId);

  // Turn 1: Start eligibility
  console.log("\nUser: 'I want a personal loan'");
  const t1 = await runCentralAgent({ message: "I want a personal loan", conversationId: convId });
  console.log("Assistant Turn 1 Reply:\n", t1.reply);
  let state = await getEligibilityState(convId);
  console.log(`State after Turn 1: Active = ${!!state}, Expected = ${state?.expectedField}`);

  // Turn 2: User asks a CALCULATION question in the middle of flow!
  console.log("\nUser: 'What is the EMI for 10 lakhs at 11% for 5 years?' (Side Calculation Question)");
  const t2 = await runCentralAgent({
    message: "What is the EMI for 10 lakhs at 11% for 5 years?",
    conversationId: convId,
  });
  console.log("Assistant Turn 2 Reply:\n", t2.reply);
  const isEmiCalculated = t2.reply.includes("EMI") && t2.reply.includes("21,742");
  const notForcingNextQuestion = !t2.reply.includes("what is your company");
  console.log(`[${isEmiCalculated ? "PASS" : "FAIL"}] EMI calculation answered directly`);
  console.log(`[${notForcingNextQuestion ? "PASS" : "FAIL"}] Did NOT force next eligibility question in place of answer`);

  // State should STILL be intact waiting for company name!
  state = await getEligibilityState(convId);
  console.log(`State preserved after Turn 2: Active = ${!!state}, Expected = ${state?.expectedField}`);

  // Turn 3: User asks a GENERAL INFORMATION question (What is FOIR?)
  console.log("\nUser: 'What does FOIR mean?' (Side General Information Question)");
  const t3 = await runCentralAgent({
    message: "What does FOIR mean?",
    conversationId: convId,
  });
  console.log("Assistant Turn 3 Reply:\n", t3.reply);
  const answeredFoir = /foir|fixed\s*obligation|income/i.test(t3.reply);
  console.log(`[${answeredFoir ? "PASS" : "FAIL"}] FOIR definition answered directly`);

  // Turn 4: User resumes eligibility by providing company
  console.log("\nUser: 'Tata Consultancy Services' (Resuming eligibility with company name)");
  const t4 = await runCentralAgent({
    message: "Tata Consultancy Services",
    conversationId: convId,
  });
  console.log("Assistant Turn 4 Reply:\n", t4.reply);
  state = await getEligibilityState(convId);
  console.log(`State after Turn 4: Company = ${state?.applicant?.companyName}, Next Field = ${state?.expectedField}`);
  const progressed = state?.applicant?.companyName?.includes("Tata Consultancy Services") && state?.expectedField !== "companyName";
  console.log(`[${progressed ? "PASS" : "FAIL"}] Resumed eligibility flow and progressed to ${state?.expectedField}`);

  // Turn 5: User says greeting mid-flow
  console.log("\nUser: 'Good morning' (Mid-flow greeting)");
  const t5 = await runCentralAgent({
    message: "Good morning",
    conversationId: convId,
  });
  console.log("Assistant Turn 5 Reply:\n", t5.reply);
  const friendlyGreeting = /good morning|hello|assist/i.test(t5.reply);
  console.log(`[${friendlyGreeting ? "PASS" : "FAIL"}] Polite greeting returned without losing session`);

  // Turn 6: Partial calculation support
  console.log("\n--- TEST 3: Partial Calculation Support ---");
  const t6 = await runCentralAgent({
    message: "Calculate EMI for 5 lakhs",
    conversationId: "calc-test-" + Date.now(),
  });
  console.log("Assistant Partial Calc Reply:\n", t6.reply);
  const partialCalcWorking = t6.reply.includes("5,00,000") && t6.reply.includes("EMI");
  console.log(`[${partialCalcWorking ? "PASS" : "FAIL"}] Partial calculation calculated EMI with indicative benchmark`);

  // Turn 7: Changing details mid-flow
  console.log("\n--- TEST 4: Changing Details and Updating Profile ---");
  const t7 = await runCentralAgent({
    message: "Actually my monthly salary is 200000",
    conversationId: convId,
  });
  console.log("Assistant Changing Details Reply:\n", t7.reply);
  state = await getEligibilityState(convId);
  console.log(`Updated salary in state: ₹${state?.applicant?.monthlyIncome}`);
  const salaryUpdated = state?.applicant?.monthlyIncome === 200000;
  console.log(`[${salaryUpdated ? "PASS" : "FAIL"}] Salary updated and confirmed to user`);

  console.log("\n================================================================================");
  console.log("   ALL TEST SCENARIOS COMPLETED");
  console.log("================================================================================\n");
  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test Suite Error:", e);
  process.exit(1);
});
