import "dotenv/config";
import { runCentralAgent } from "../lib/ai/agent";

async function testBankQA() {
  const convId = "test-bank-qa-" + Date.now();

  console.log("=== TEST 1: ICICI Bank CIBIL Cutoff ===");
  const q1 = await runCentralAgent({
    message: "What is ICICI Bank's minimum CIBIL cutoff?",
    conversationId: convId,
  });
  console.log("Q1 Reply:\n", q1.reply);

  console.log("\n=== TEST 2: HDFC Bank Tenure ===");
  const q2 = await runCentralAgent({
    message: "What is HDFC Bank's maximum tenure for Super A category?",
    conversationId: convId,
  });
  console.log("Q2 Reply:\n", q2.reply);

  console.log("\n=== TEST 3: What is FOIR? ===");
  const q3 = await runCentralAgent({
    message: "What is FOIR?",
    conversationId: convId,
  });
  console.log("Q3 Reply:\n", q3.reply);

  process.exit(0);
}

testBankQA();
