import { runCentralAgent } from "../lib/ai/agent";

async function run() {
  const profileMsg = "Capgemini, Age 28, Salary ₹1.5 lakh, CIBIL 810, Loan ₹10 lakh, 60 months, Existing EMI ₹0";

  console.log("=== RUN 1 ===");
  const convId1 = "capgemini-run1-" + Date.now();
  const res1 = await runCentralAgent({
    message: profileMsg,
    conversationId: convId1,
  });
  console.log("RES 1 REPLY:\n" + res1.reply);

  console.log("\n=== RUN 2 (Exact same conversation, repeating profile) ===");
  const res2 = await runCentralAgent({
    message: profileMsg,
    conversationId: convId1,
    conversationHistory: [
      { role: "user", content: profileMsg },
      { role: "assistant", content: res1.reply }
    ],
  });
  console.log("RES 2 REPLY:\n" + res2.reply);

  process.exit(0);
}

run().catch(console.error);
