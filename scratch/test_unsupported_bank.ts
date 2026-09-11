import "dotenv/config";
import { runCentralAgent } from "../lib/ai/agent";
import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";

async function main() {
  const queries = [
    "Tell me the policy of a bank that isn't available",
    "What is Citibank policy?",
    "Can you give me the policy of Bank of Baroda?",
    "Tell me PNB loan policy"
  ];

  for (const query of queries) {
    console.log(`\n======================================================`);
    console.log(`QUERY: "${query}"`);
    const intent = await classifyIntentWithLLM(query);
    console.log("CLASSIFICATION:", intent.intent, intent.subIntent, intent.extracted);

    const res = await runCentralAgent({
      message: query,
      conversationId: `test-unsupported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    });
    console.log("AGENT REPLY:\n" + res.reply + "\n");
  }
}

main().catch(console.error);

