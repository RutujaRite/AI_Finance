import "dotenv/config";
import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";
import { runCentralAgent } from "../lib/ai/agent";

async function test() {
  console.log("Testing classifyIntentWithLLM(\"What is FOIR?\")...");
  const classification = await classifyIntentWithLLM("What is FOIR?");
  console.log("Classification:", JSON.stringify(classification, null, 2));

  console.log("\nTesting runCentralAgent(\"What is FOIR?\")...");
  const agentRes = await runCentralAgent({ message: "What is FOIR?", conversationId: "test-foir-" + Date.now() });
  console.log("Agent Response:\n", agentRes.reply);
  process.exit(0);
}
test();
