import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runConv207() {
  const convId = "reproduce-conv207-" + Date.now();
  console.log("=== STEP 1 ===");
  const msg1 = "I want a personal loan. I work at capgemini, I'm 28 years old, earn 1.5 lakh per month, my CIBIL is 810, I need 10 lakh";
  const res1 = await runCentralAgent({ message: msg1, conversationId: convId });
  console.log("Res 1:\n", res1.reply);
  console.log("State 1:", await getEligibilityState(convId));

  console.log("\n=== STEP 2 ===");
  const msg2 = "60 months";
  const res2 = await runCentralAgent({ message: msg2, conversationId: convId });
  console.log("Res 2:\n", res2.reply);
  console.log("State 2:", await getEligibilityState(convId));

  console.log("\n=== STEP 3 ===");
  const msg3 = "0";
  const res3 = await runCentralAgent({ message: msg3, conversationId: convId });
  console.log("Res 3:\n", res3.reply);
  console.log("State 3:", await getEligibilityState(convId));

  process.exit(0);
}

runConv207().catch(console.error);
