import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function testMultiFieldInput() {
  console.log("================================================================================");
  console.log("   TESTING MULTI-FIELD SINGLE-TURN INPUT & PROFILE MAPPING                     ");
  console.log("================================================================================\n");

  const convId = "test-multifield-" + Date.now();
  await clearEligibilityState(convId);

  console.log("User: 'I want a personal loan. I work at Infosys Limited, earn 90000 per month, need 6 lakhs loan for 5 years, my CIBIL score is 760, age 32, and 0 existing EMI.'");
  const res = await runCentralAgent({
    message: "I want a personal loan. I work at Infosys Limited, earn 90000 per month, need 6 lakhs loan for 5 years, my CIBIL score is 760, age 32, and 0 existing EMI.",
    conversationId: convId,
  });

  console.log("\nAssistant Reply:\n", res.reply.slice(0, 400) + "...\n");

  const evaluatedImmediately =
    res.reply.includes("Approved Partner Banks") ||
    res.reply.includes("Eligibility Assessment Report") ||
    res.reply.includes("Eligible");

  console.log(`[${evaluatedImmediately ? "PASS" : "FAIL"}] Multi-field opening turn evaluated immediately without redundant questions`);
}

testMultiFieldInput().catch(console.error);
