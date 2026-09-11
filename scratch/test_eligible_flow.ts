import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function main() {
  console.log("===============================================================");
  console.log("🚀 Testing Full Eligible Borrower Flow with Master Policy Engine");
  console.log("===============================================================\n");

  const conversationId = "test-eligible-" + Date.now();
  const history: Array<{ role: string; content: string }> = [];

  async function chat(userMsg: string) {
    console.log(`💬 [User]: "${userMsg}"`);
    const result = await runCentralAgent({
      message: userMsg,
      conversationId,
      conversationHistory: [...history],
    });
    console.log(`🤖 [CreditWise AI]:\n${result.reply}\n`);
    history.push({ role: "user", content: userMsg });
    history.push({ role: "assistant", content: result.reply });
    return result;
  }

  // Opening message with all profile details
  const res = await chat(
    "I need a 5 lakh personal loan for 3 years. I work at Infosys, salary is 90000, CIBIL score is 770, age 30, and zero existing EMIs."
  );

  // Check table header format
  const hasRequiredTable = /\|\s*Bank\s*\|\s*Status\s*\|\s*CIBIL\s*\|\s*Tenure\s*\|\s*Est\.\s*EMI\s*\|/i.test(res.reply);
  console.log("Required Table Format Present:", hasRequiredTable);

  if (!hasRequiredTable) {
    throw new Error("Failed: Result table does not match required | Bank | Status | CIBIL | Tenure | Est. EMI | format!");
  }

  // Check that eligible banks were found
  if (!res.reply.includes("Eligible Partner Bank")) {
    throw new Error("Failed: Expected eligible partner banks to be listed!");
  }

  console.log("✅ Eligible borrower test passed with flying colors!");
  await clearEligibilityState(conversationId);
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
