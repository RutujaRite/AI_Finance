import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";

const BANNED_CANNED_STRINGS = [
  "Hello! 👋 Welcome to CreditWise AI. How can I assist you today?",
  "How can I assist you with your banking or loan inquiries today?",
  "I am ready to help you with your loan eligibility, bank policies, or EMI calculations. How can I assist you?",
  "Could you please share your approximate CIBIL score? (If you're not sure, feel free to say 0 or unknown.)",
  "To check partner bank policies tailored to your organization, what is your company or employer name?",
  "What is your approximate net monthly in-hand salary?",
  "How much loan amount are you looking to borrow?",
  "What repayment tenure would you prefer (e.g. 3 years, 5 years)?",
  "Do you currently pay any monthly loan or card EMIs?",
  "Lastly, what is your current age in years?",
  "Got it, I have updated your information. To proceed with checking your loan eligibility",
  "Could you please provide your",
  "Whenever you're ready to proceed with your eligibility assessment",
  "Whenever you're ready to proceed with your loan assessment",
  "### What is FOIR (Fixed Obligation to Income Ratio)?",
  "### Understanding CIBIL Score in Loan Approvals",
  "### Understanding Reducing Balance Interest Rate",
  "### Do Personal Loans Require Collateral?",
];

function assertZeroCanned(text: string, label: string) {
  for (const banned of BANNED_CANNED_STRINGS) {
    if (text.includes(banned)) {
      throw new Error(`[FAIL: CANNED STRING DETECTED in ${label}]: Found "${banned}"\nFull text:\n${text}`);
    }
  }
}

async function runNoFallbackTests() {
  console.log("===============================================================================");
  console.log("🔍 TESTING ZERO CANNED STRINGS & 100% LLM-DRIVEN CONVERSATION");
  console.log("===============================================================================\n");

  const convId = "conv_dynamic_" + Date.now();

  // Test 1: Dynamic Greeting
  console.log("👉 TEST 1: Greeting");
  const gRes = await runCentralAgent({ message: "Hi there, good evening!", conversationId: convId });
  console.log("Greeting Reply:\n", gRes.reply);
  assertZeroCanned(gRes.reply, "Greeting");
  if (!gRes.reply || gRes.reply.length < 10) throw new Error("Greeting reply too short");
  console.log("✅ TEST 1 PASSED: Dynamic greeting without canned templates.\n");

  // Test 2: General Concept Question
  console.log("👉 TEST 2: General Concept Question (What is FOIR?)");
  const qRes = await runCentralAgent({ message: "What is FOIR in banking?", conversationId: convId });
  console.log("FOIR Reply:\n", qRes.reply);
  assertZeroCanned(qRes.reply, "FOIR question");
  if (!/foir|obligation|income|ratio/i.test(qRes.reply)) throw new Error("FOIR explanation missing expected concepts");
  console.log("✅ TEST 2 PASSED: Dynamic FOIR explanation without canned fallback.\n");

  // Test 3: Loan Intent + Natural Missing Detail Prompt
  console.log("👉 TEST 3: Loan Intent with partial details");
  const lRes = await runCentralAgent({
    message: "I work at Infosys earning 90k per month. Need a personal loan.",
    conversationId: convId,
  });
  console.log("Loan Prompt Reply:\n", lRes.reply);
  assertZeroCanned(lRes.reply, "Loan prompt");
  if (!lRes.reply || lRes.reply.length < 15) throw new Error("Loan reply too short");
  console.log("✅ TEST 3 PASSED: Natural missing field prompt without canned templates.\n");

  // Test 4: Casual acknowledgement
  console.log("👉 TEST 4: Casual Acknowledgement");
  const cRes = await runCentralAgent({
    message: "Thanks! That makes total sense.",
    conversationId: convId,
    conversationHistory: [
      { role: "user", content: "What is FOIR in banking?" },
      { role: "assistant", content: qRes.reply },
    ],
  });
  console.log("Casual Reply:\n", cRes.reply);
  assertZeroCanned(cRes.reply, "Casual chat");
  console.log("✅ TEST 4 PASSED: Dynamic casual response without canned templates.\n");

  // Test 5: Correction Handling
  console.log("👉 TEST 5: Correction Handling");
  const corrRes = await runCentralAgent({
    message: "Actually my salary is 1.1 lakhs not 90k. And I need 4 lakhs.",
    conversationId: convId,
  });
  console.log("Correction Reply:\n", corrRes.reply);
  assertZeroCanned(corrRes.reply, "Correction");
  console.log("✅ TEST 5 PASSED: Dynamic correction acknowledgement without canned templates.\n");

  console.log("===============================================================================");
  console.log("🎉 ALL TESTS PASSED: Assistant is 100% LLM-driven with ZERO canned responses!");
  console.log("===============================================================================");
}

runNoFallbackTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
