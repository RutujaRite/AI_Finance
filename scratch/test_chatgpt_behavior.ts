import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function testNaturalChatGPTBehavior() {
  console.log("================================================================================");
  console.log("🤖 TESTING NATURAL CHATGPT-LIKE ASSISTANT BEHAVIOR & CONVERSATIONAL FLOW");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  const convId = "test-chatgpt-" + Date.now();
  await clearEligibilityState(convId);

  // 1. NON-LOAN INTENTS MUST NOT START ELIGIBILITY
  console.log("--- 1. Testing that non-loan intents DO NOT trigger eligibility ---");
  
  // A. Greeting
  const rGreeting = await runCentralAgent({ message: "Hello! How are you?", conversationId: convId });
  let state = await getEligibilityState(convId);
  assert(!state || !state.expectedField, "Greeting does not trigger loan eligibility");
  assert(rGreeting.reply.toLowerCase().includes("creditwise") || rGreeting.reply.toLowerCase().includes("how can i assist") || rGreeting.reply.toLowerCase().includes("hello"), "Greeting responds warmly");

  // B. FOIR Side Question
  const rFoir = await runCentralAgent({ message: "What is FOIR?", conversationId: convId });
  state = await getEligibilityState(convId);
  assert(!state || !state.expectedField, "'What is FOIR?' does not trigger loan eligibility");
  assert(rFoir.reply.includes("Fixed Obligation to Income Ratio"), "Explains FOIR accurately");

  // C. Policy Inquiry
  const rPolicy = await runCentralAgent({ message: "What is ICICI Bank's minimum CIBIL cutoff?", conversationId: convId });
  state = await getEligibilityState(convId);
  assert(!state || !state.expectedField, "Policy inquiry does not trigger loan eligibility");
  assert(!rPolicy.reply.includes("NOT_DEFINED"), "Policy inquiry does not show NOT_DEFINED");
  assert(!rPolicy.reply.includes("NEEDS_REVIEW"), "Policy inquiry does not show NEEDS_REVIEW");

  // D. Calculation
  const rCalc = await runCentralAgent({ message: "Calculate EMI for 500000 at 10.5% for 3 years", conversationId: convId });
  state = await getEligibilityState(convId);
  assert(!state || !state.expectedField, "Calculation does not trigger loan eligibility");
  assert(rCalc.reply.includes("Estimated Monthly EMI"), "Calculates EMI accurately");

  // 2. LOAN INTENT STARTS ELIGIBILITY & ASKS MISSING DETAILS ONE AT A TIME
  console.log("\n--- 2. Testing Loan Intent Initiation & Step-by-Step Questioning ---");
  
  // Step 1: User wants loan at TCS
  const rStep1 = await runCentralAgent({ message: "I work at Tata Consultancy Services and want a personal loan", conversationId: convId });
  state = await getEligibilityState(convId);
  assert(Boolean(state?.applicant?.companyName?.includes("Tata Consultancy Services")), "Captured company name");
  assert(rStep1.reply.toLowerCase().includes("salary") || rStep1.reply.toLowerCase().includes("income"), "Asks for monthly salary");

  // Step 2: User provides salary
  const rStep2 = await runCentralAgent({ message: "My net monthly salary is 90,000", conversationId: convId });
  state = await getEligibilityState(convId);
  assert(state?.applicant?.monthlyIncome === 90000, "Captured salary 90,000");
  assert(rStep2.reply.toLowerCase().includes("loan amount") || rStep2.reply.toLowerCase().includes("borrow"), "Asks for loan amount");

  // Step 3: User provides loan amount
  const rStep3 = await runCentralAgent({ message: "I need 5 lakhs loan", conversationId: convId });
  state = await getEligibilityState(convId);
  assert(state?.applicant?.loanAmount === 500000, "Captured loan amount 500,000");
  assert(rStep3.reply.toLowerCase().includes("tenure") || rStep3.reply.toLowerCase().includes("years") || rStep3.reply.toLowerCase().includes("months"), "Asks for repayment tenure");

  // 3. SIDE QUESTIONS DURING ACTIVE FLOW DO NOT BREAK OR REPEAT FLOW
  console.log("\n--- 3. Testing Side Questions & Seamless Flow Resumption ---");

  // Side Question during flow: User asks "What is FOIR?"
  const rSideQ1 = await runCentralAgent({ message: "Wait, what is FOIR?", conversationId: convId });
  assert(rSideQ1.reply.includes("Fixed Obligation to Income Ratio"), "Answers side question on FOIR");
  assert(rSideQ1.reply.includes("Tata Consultancy Services") || rSideQ1.reply.includes("continue"), "Includes continuation reminder for active flow");
  state = await getEligibilityState(convId);
  assert(state?.applicant?.loanAmount === 500000, "Active applicant state preserved during side question");

  // User says "Understood, thanks!" -> Assistant prompts for next pending field (tenure)
  const rAck = await runCentralAgent({ message: "Understood, thanks!", conversationId: convId });
  assert(rAck.reply.toLowerCase().includes("tenure") || rAck.reply.toLowerCase().includes("pick right back up") || rAck.reply.toLowerCase().includes("proceed"), "Seamlessly resumes flow and prompts for tenure");

  // Side Question 2: User asks HDFC tenure for Super A
  const rSideQ2 = await runCentralAgent({ message: "What is HDFC Bank's maximum tenure for Super A category?", conversationId: convId });
  assert(rSideQ2.reply.includes("84 months") || rSideQ2.reply.includes("7 years"), "Retrieves exact HDFC Master Policy tenure");
  assert(!rSideQ2.reply.includes("NOT_DEFINED"), "No NOT_DEFINED in policy answer");

  // User provides tenure: "3 years"
  const rTenure = await runCentralAgent({ message: "3 years", conversationId: convId });
  state = await getEligibilityState(convId);
  assert(state?.applicant?.tenureMonths === 36, "Captured tenure as 36 months");
  assert(rTenure.reply.toLowerCase().includes("cibil") || rTenure.reply.toLowerCase().includes("credit score"), "Asks for CIBIL");

  // 4. CORRECTIONS & MID-FLOW RECALCULATION
  console.log("\n--- 4. Testing Mid-Flow Corrections ---");

  // User corrects salary: "Actually change my salary to 1.2 lakhs"
  const rCorrection = await runCentralAgent({ message: "Actually change my salary to 1.2 lakhs", conversationId: convId });
  state = await getEligibilityState(convId);
  assert(state?.applicant?.monthlyIncome === 120000, "Salary updated to 120,000");
  assert(state?.applicant?.loanAmount === 500000, "Preserved loan amount 500,000");
  assert(state?.applicant?.tenureMonths === 36, "Preserved tenure 36 months");
  assert(rCorrection.reply.toLowerCase().includes("cibil") || rCorrection.reply.toLowerCase().includes("credit score"), "Continues asking for CIBIL without repeating salary or loan amount");

  // 5. FINISHING PROFILE & EVALUATING ALL APPLICABLE BANKS
  console.log("\n--- 5. Completing Profile & Final Multi-Bank Policy Evaluation ---");

  // User provides CIBIL
  const rCibil = await runCentralAgent({ message: "My CIBIL is 780", conversationId: convId });
  state = await getEligibilityState(convId);
  assert(state?.applicant?.cibil === 780, "Captured CIBIL 780");
  assert(rCibil.reply.toLowerCase().includes("emi"), "Asks for existing EMIs");

  // User provides EMI
  const rEmi = await runCentralAgent({ message: "No existing EMIs", conversationId: convId });
  state = await getEligibilityState(convId);
  assert(state?.applicant?.existingEmi === 0, "Captured EMI 0");
  assert(rEmi.reply.toLowerCase().includes("age"), "Asks for age");

  // User provides Age
  const rFinal = await runCentralAgent({ message: "I am 29 years old", conversationId: convId });
  assert(rFinal.reply.includes("Eligible Partner Bank"), "Generated final multi-bank eligibility report");
  assert(!rFinal.reply.includes("Approved Partner Bank"), "Banks are never falsely called 'Approved'");
  assert(rFinal.reply.includes("Tata Consultancy Services"), "Report includes verified employer");
  assert(rFinal.reply.includes("₹1,20,000"), "Report includes updated salary");
  assert(rFinal.reply.includes("780"), "Report includes verified CIBIL");
  assert(!rFinal.reply.includes("NOT_DEFINED"), "Zero NOT_DEFINED in report");

  console.log("\n================================================================================");
  console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

testNaturalChatGPTBehavior().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
