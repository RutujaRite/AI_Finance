import { runCentralAgent } from "../lib/ai/agent";

async function main() {
  const testMessages = [
    "Hi",
    "Hello",
    "Hey there",
    "Good morning",
    "How are you?",
    "What can you do?",
    "Thanks",
    "I want a personal loan"
  ];

  for (const msg of testMessages) {
    const convId = "test_audit_" + Math.random().toString(36).slice(2);
    console.log(`\n======================================================`);
    console.log(`TESTING USER MESSAGE: "${msg}"`);
    console.log(`======================================================`);
    const start = Date.now();
    const result = await runCentralAgent({
      message: msg,
      conversationId: convId,
    });
    console.log(`Elapsed: ${Date.now() - start}ms`);
    console.log(`Has companyData:`, !!result.companyData);
    console.log(`Has companyQuery:`, !!result.companyQuery);
    console.log(`Has bankData:`, !!result.bankData);
    console.log(`Reply preview:\n${result.reply.slice(0, 300)}...`);
  }
}

main().catch(console.error);
