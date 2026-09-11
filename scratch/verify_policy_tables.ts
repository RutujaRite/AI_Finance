import "dotenv/config";
import { runCentralAgent } from "../lib/ai/agent";

async function main() {
  console.log("=== Testing Bank Policy Table UI with runCentralAgent ===");

  console.log("\n--- Query 1: HDFC Bank Policy ---");
  const res1 = await runCentralAgent({
    message: "What is HDFC bank policy?",
    conversationId: "test-conv-1",
  });
  console.log("Response 1:\n", res1.reply);

  console.log("\n--- Query 2: ICICI Bank Policy ---");
  const res2 = await runCentralAgent({
    message: "Show ICICI bank policy",
    conversationId: "test-conv-2",
  });
  console.log("Response 2:\n", res2.reply);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
