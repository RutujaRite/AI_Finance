import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function run() {
  const profileMsg = "Capgemini, Age 28, Salary ₹1.5 lakh, CIBIL 810, Loan ₹10 lakh, 60 months, Existing EMI ₹0";

  console.log("=== RUN 1: Fresh conversation ===");
  const convId1 = "capgemini-test-1-" + Date.now();
  const res1 = await runCentralAgent({
    message: profileMsg,
    conversationId: convId1,
  });
  console.log("Res 1 reply:\n", res1.reply);

  console.log("\n=== RUN 2: Repeating exact same message in same conversation ===");
  const res2 = await runCentralAgent({
    message: profileMsg,
    conversationId: convId1,
    conversationHistory: [
      { role: "user", content: profileMsg },
      { role: "assistant", content: res1.reply }
    ],
  });
  console.log("Res 2 reply:\n", res2.reply);

  console.log("\n=== RUN 3: Fresh conversation 2 ===");
  const convId2 = "capgemini-test-2-" + Date.now();
  const res3 = await runCentralAgent({
    message: profileMsg,
    conversationId: convId2,
  });
  console.log("Res 3 reply:\n", res3.reply);

  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
