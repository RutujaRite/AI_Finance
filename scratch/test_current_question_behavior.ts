import { runCentralAgent } from "../lib/ai/agent";

async function test() {
  console.log("--- Test 1: What is Infosys? ---");
  const r1 = await runCentralAgent({ message: "What is Infosys?", conversationId: "test_q_1" });
  console.log("R1 reply:\n", r1.reply);

  console.log("\n--- Test 2: What is CIBIL score? (fresh) ---");
  const r2 = await runCentralAgent({ message: "What is CIBIL score?", conversationId: "test_q_2" });
  console.log("R2 reply:\n", r2.reply);

  console.log("\n--- Test 3: What is EMI? (fresh) ---");
  const r3 = await runCentralAgent({ message: "What is EMI?", conversationId: "test_q_3" });
  console.log("R3 reply:\n", r3.reply);

  console.log("\n--- Test 4: What is the policy of HDFC Bank? (fresh) ---");
  const r4 = await runCentralAgent({ message: "What is the policy of HDFC Bank?", conversationId: "test_q_4" });
  console.log("R4 reply:\n", r4.reply);
}

test().catch(console.error);
