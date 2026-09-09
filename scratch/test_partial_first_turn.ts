import pool from "../lib/db";
import { runCentralAgent } from "../lib/ai/agent";

async function testPartialFirstTurn() {
  console.log("--- Testing Partial Inputs in First Turn ---");
  const convId = "test_partial_" + Date.now();

  const turn1 = await runCentralAgent({
    message: "I work at TCS, earn 85000 per month, and need a 5 lakh personal loan",
    conversationId: convId,
  });

  console.log("User Turn 1: I work at TCS, earn 85000 per month, and need a 5 lakh personal loan");
  console.log("AI Turn 1 Reply:\n" + turn1.reply);

  // Verify AI does NOT ask for company, salary, or loan amount
  const replyLower = turn1.reply.toLowerCase();
  const asksCompany = replyLower.includes("what is your company") || replyLower.includes("what is your employer");
  const asksSalary = replyLower.includes("what is your salary") || replyLower.includes("what is your monthly income") || replyLower.includes("take-home");
  const asksLoanAmount = replyLower.includes("how much loan") || replyLower.includes("loan amount");

  console.log("\nAssertions:");
  console.log("Does NOT re-ask company:", !asksCompany);
  console.log("Does NOT re-ask salary:", !asksSalary);
  console.log("Does NOT re-ask loan amount:", !asksLoanAmount);

  if (asksCompany || asksSalary || asksLoanAmount) {
    throw new Error("AI should not re-ask details already provided!");
  }

  console.log("✅ Partial input handling verified successfully!\n");
  await pool.end();
}

testPartialFirstTurn().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
