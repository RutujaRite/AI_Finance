import "dotenv/config";
import { runCentralAgent } from "../lib/ai/agent";

async function testAgent() {
  const queries = [
    "What banks am I eligible for?",
    "Which banks can I get a loan from?",
    "Which bank is best for my loan?",
    "Am I eligible for a loan?",
    "What is HDFC bank policy?"
  ];

  for (const q of queries) {
    const convId = `test-agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const res = await runCentralAgent({
      message: q,
      conversationId: convId,
    });
    console.log(`\n======================================================`);
    console.log(`QUERY: "${q}"`);
    console.log(`REPLY:\n${res.reply.slice(0, 300)}...`);
  }
}

testAgent().catch(console.error);
