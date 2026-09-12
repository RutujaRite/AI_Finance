// scratch/test-comprehensive-flow.ts
import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";

async function runComprehensiveTests() {
  console.log("===============================================================================");
  console.log("🚀 STARTING COMPREHENSIVE END-TO-END TEST OF FULLY LLM-DRIVEN ASSISTANT");
  console.log("===============================================================================\n");

  const conv1 = "conv_test_comp_1_" + Date.now();

  // -------------------------------------------------------------------------
  // TEST 1: Multi-parameter upfront input
  // -------------------------------------------------------------------------
  console.log("👉 TURN 1: Upfront Multi-Parameter Input");
  const msg1 = "I work at Tata Consultancy Services as a software engineer, earning 1.2 lakhs per month. Need 5 lakhs loan for 3 years.";
  console.log(`User: "${msg1}"`);
  const res1 = await runCentralAgent({ message: msg1, conversationId: conv1 });
  console.log(`\nAssistant:\n${res1.reply}\n`);

  // -------------------------------------------------------------------------
  // TEST 2: Question / Objection during active assessment
  // -------------------------------------------------------------------------
  console.log("👉 TURN 2: Question / Objection about CIBIL");
  const msg2 = "Why do you need my CIBIL score? Will this check hurt my credit score?";
  console.log(`User: "${msg2}"`);
  const res2 = await runCentralAgent({
    message: msg2,
    conversationId: conv1,
    conversationHistory: [
      { role: "user", content: msg1 },
      { role: "assistant", content: res1.reply },
    ],
  });
  console.log(`\nAssistant:\n${res2.reply}\n`);

  // -------------------------------------------------------------------------
  // TEST 3: Providing CIBIL Score
  // -------------------------------------------------------------------------
  console.log("👉 TURN 3: Providing CIBIL Score");
  const msg3 = "My CIBIL score is 780.";
  console.log(`User: "${msg3}"`);
  const res3 = await runCentralAgent({
    message: msg3,
    conversationId: conv1,
    conversationHistory: [
      { role: "user", content: msg1 },
      { role: "assistant", content: res1.reply },
      { role: "user", content: msg2 },
      { role: "assistant", content: res2.reply },
    ],
  });
  console.log(`\nAssistant:\n${res3.reply}\n`);

  // -------------------------------------------------------------------------
  // TEST 4: Existing EMI input
  // -------------------------------------------------------------------------
  console.log("👉 TURN 4: Providing Existing EMIs");
  const msg4 = "Zero EMIs, totally clean right now.";
  console.log(`User: "${msg4}"`);
  const res4 = await runCentralAgent({
    message: msg4,
    conversationId: conv1,
    conversationHistory: [
      { role: "user", content: msg1 },
      { role: "assistant", content: res1.reply },
      { role: "user", content: msg2 },
      { role: "assistant", content: res2.reply },
      { role: "user", content: msg3 },
      { role: "assistant", content: res3.reply },
    ],
  });
  console.log(`\nAssistant:\n${res4.reply}\n`);

  // -------------------------------------------------------------------------
  // TEST 5: Providing Age & Triggering Complete Evaluation Table
  // -------------------------------------------------------------------------
  console.log("👉 TURN 5: Providing Age & Triggering Evaluation Table");
  const msg5 = "I am 29 years old.";
  console.log(`User: "${msg5}"`);
  const res5 = await runCentralAgent({
    message: msg5,
    conversationId: conv1,
    conversationHistory: [
      { role: "user", content: msg1 },
      { role: "assistant", content: res1.reply },
      { role: "user", content: msg2 },
      { role: "assistant", content: res2.reply },
      { role: "user", content: msg3 },
      { role: "assistant", content: res3.reply },
      { role: "user", content: msg4 },
      { role: "assistant", content: res4.reply },
    ],
  });
  console.log(`\nAssistant:\n${res5.reply}\n`);

  // Verify Table format: | Bank | Status | CIBIL | Tenure | Est. EMI |
  const hasExactHeader = res5.reply.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |");
  console.log(`✅ Table Header Verification: ${hasExactHeader ? "PASSED (Exact header present)" : "FAILED"}`);

  // -------------------------------------------------------------------------
  // TEST 6: Bank Selection post-evaluation
  // -------------------------------------------------------------------------
  console.log("\n👉 TURN 6: Selecting Bank Post-Evaluation");
  const msg6 = "I want to apply with HDFC Bank";
  console.log(`User: "${msg6}"`);
  const res6 = await runCentralAgent({
    message: msg6,
    conversationId: conv1,
    conversationHistory: [
      { role: "user", content: msg5 },
      { role: "assistant", content: res5.reply },
    ],
  });
  console.log(`\nAssistant:\n${res6.reply}\n`);

  // -------------------------------------------------------------------------
  // TEST 7: Master Policy Inquiry (3-section 2-column table)
  // -------------------------------------------------------------------------
  console.log("👉 TEST 7: Master Bank Policy Inquiry");
  const msgPolicy = "What is ICICI bank policy?";
  console.log(`User: "${msgPolicy}"`);
  const resPolicy = await runCentralAgent({ message: msgPolicy, conversationId: "conv_policy_" + Date.now() });
  console.log(`\nAssistant:\n${resPolicy.reply}\n`);

  // -------------------------------------------------------------------------
  // TEST 8: Unsupported Bank Policy Inquiry
  // -------------------------------------------------------------------------
  console.log("👉 TEST 8: Unsupported Bank Policy Inquiry");
  const msgUnsupp = "What is Citibank policy?";
  console.log(`User: "${msgUnsupp}"`);
  const resUnsupp = await runCentralAgent({ message: msgUnsupp, conversationId: "conv_unsupp_" + Date.now() });
  console.log(`\nAssistant:\n${resUnsupp.reply}\n`);

  // -------------------------------------------------------------------------
  // TEST 9: EMI Calculation
  // -------------------------------------------------------------------------
  console.log("👉 TEST 9: EMI Calculation");
  const msgEmi = "Calculate EMI for 10 lakhs at 11% for 5 years";
  console.log(`User: "${msgEmi}"`);
  const resEmi = await runCentralAgent({ message: msgEmi, conversationId: "conv_emi_" + Date.now() });
  console.log(`\nAssistant:\n${resEmi.reply}\n`);

  // -------------------------------------------------------------------------
  // TEST 10: Corporate Employer Category Search
  // -------------------------------------------------------------------------
  console.log("👉 TEST 10: Corporate Employer Category Search");
  const msgComp = "What is TCS category rating across banks?";
  console.log(`User: "${msgComp}"`);
  const resComp = await runCentralAgent({ message: msgComp, conversationId: "conv_comp_" + Date.now() });
  console.log(`\nAssistant:\n${resComp.reply}\n`);
  console.log(`Company Data Attached:`, !!resComp.companyData);

  console.log("===============================================================================");
  console.log("🎉 ALL COMPREHENSIVE TESTS COMPLETED!");
  console.log("===============================================================================");
  process.exit(0);
}

runComprehensiveTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
