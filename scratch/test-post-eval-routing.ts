import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";

async function testPostEvaluationRouting() {
  console.log("===============================================================================");
  console.log("🔍 TESTING POST-EVALUATION GENERIC ROUTING (NO REPEATED RESULTS)");
  console.log("===============================================================================\n");

  const convId = "conv_post_eval_" + Date.now();

  // ---------------------------------------------------------------------------
  // STEP 1: Complete applicant profile upfront to generate the eligibility result
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 1: Complete applicant profile provided upfront");
  const msg1 = "I work at Tata Consultancy Services, earning 1.2 lakhs per month. Need 5 lakhs loan for 3 years. CIBIL is 780, zero existing EMIs, age 29.";
  console.log(`User: "${msg1}"`);
  const res1 = await runCentralAgent({ message: msg1, conversationId: convId });
  console.log("\nAssistant (Summary of result):\n", res1.reply.slice(0, 350) + "...\n");

  const tableHeader = "| Bank | Status | CIBIL | Tenure | Est. EMI |";
  if (!res1.reply.includes(tableHeader)) {
    throw new Error("TURN 1 FAILED: Expected eligibility table was not generated.");
  }
  console.log("✅ TURN 1 PASSED: Initial eligibility evaluation table successfully generated.\n");

  // ---------------------------------------------------------------------------
  // STEP 2: User says "proceed"
  // MUST NOT regenerate the 22-bank table!
  // MUST interpret from context and move to next required action.
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 2: User says 'proceed'");
  const msg2 = "proceed";
  console.log(`User: "${msg2}"`);
  const res2 = await runCentralAgent({
    message: msg2,
    conversationId: convId,
    conversationHistory: [
      { role: "user", content: msg1 },
      { role: "assistant", content: res1.reply },
    ],
  });
  console.log("\nAssistant:\n", res2.reply);

  if (res2.reply.includes(tableHeader)) {
    throw new Error("TURN 2 FAILED: Assistant regenerated the full eligibility table on 'proceed'!");
  }
  console.log("✅ TURN 2 PASSED: Assistant did NOT repeat the evaluation table on 'proceed'.\n");

  // ---------------------------------------------------------------------------
  // STEP 3: User says "okay, continue"
  // MUST NOT regenerate the 22-bank table!
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 3: User says 'okay, continue'");
  const msg3 = "okay, continue";
  console.log(`User: "${msg3}"`);
  const res3 = await runCentralAgent({
    message: msg3,
    conversationId: convId,
    conversationHistory: [
      { role: "user", content: msg1 },
      { role: "assistant", content: res1.reply },
      { role: "user", content: msg2 },
      { role: "assistant", content: res2.reply },
    ],
  });
  console.log("\nAssistant:\n", res3.reply);

  if (res3.reply.includes(tableHeader)) {
    throw new Error("TURN 3 FAILED: Assistant regenerated the full eligibility table on 'okay, continue'!");
  }
  console.log("✅ TURN 3 PASSED: Assistant did NOT repeat the evaluation table on 'okay, continue'.\n");

  // ---------------------------------------------------------------------------
  // STEP 4: User selects a bank: "I want to apply with HDFC Bank"
  // MUST connect them with bank manager / next application action.
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 4: User selects bank 'I want to apply with HDFC Bank'");
  const msg4 = "I want to apply with HDFC Bank";
  console.log(`User: "${msg4}"`);
  const res4 = await runCentralAgent({
    message: msg4,
    conversationId: convId,
    conversationHistory: [
      { role: "user", content: msg1 },
      { role: "assistant", content: res1.reply },
      { role: "user", content: msg2 },
      { role: "assistant", content: res2.reply },
      { role: "user", content: msg3 },
      { role: "assistant", content: res3.reply },
    ],
  });
  console.log("\nAssistant:\n", res4.reply);

  if (!/HDFC/i.test(res4.reply) || (!/manager|representative|application/i.test(res4.reply))) {
    throw new Error("TURN 4 FAILED: Bank selection next action not initiated for HDFC Bank.");
  }
  console.log("✅ TURN 4 PASSED: Successfully moved to next required action for chosen bank.\n");

  // ---------------------------------------------------------------------------
  // STEP 5: Explicit re-evaluation request: "Please recalculate my eligibility"
  // In a new conversation with completed evaluation, user explicitly asks for re-evaluation.
  // MUST generate the table because user explicitly requested it!
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 5: Explicit re-evaluation request");
  const convId2 = "conv_post_eval_recalc_" + Date.now();
  await runCentralAgent({ message: msg1, conversationId: convId2 });
  
  const msgRecalc = "Can you recalculate my eligibility and show the table again?";
  console.log(`User: "${msgRecalc}"`);
  const resRecalc = await runCentralAgent({ message: msgRecalc, conversationId: convId2 });
  console.log("\nAssistant:\n", resRecalc.reply.slice(0, 350) + "...\n");

  if (!resRecalc.reply.includes(tableHeader)) {
    throw new Error("TURN 5 FAILED: Expected eligibility table upon explicit re-evaluation request.");
  }
  console.log("✅ TURN 5 PASSED: Table successfully shown when user explicitly requested it.\n");

  console.log("===============================================================================");
  console.log("🎉 ALL POST-EVALUATION ROUTING TESTS PASSED PERFECTLY!");
  console.log("===============================================================================");
}

testPostEvaluationRouting().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
