import assert from "assert";
import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState, saveEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTest() {
  console.log("================================================================================");
  console.log("🧪 TESTING SALARY '40 k' FOLLOWED BY EMI '0'");
  console.log("================================================================================\n");

  const conversationId = `zero_emi_test_${Date.now()}`;
  await clearEligibilityState(conversationId);

  // Set initial state: company selected as 'Cognizant Foundation', expectedField 'monthlyIncome'
  await saveEligibilityState(conversationId, {
    applicant: {
      companyName: "Cognizant Foundation",
    },
    expectedField: "monthlyIncome",
    missingFields: ["monthlyIncome", "existingEmi", "age", "cibil", "loanAmount", "tenureMonths"],
    in_eligibility_flow: true,
    updatedAt: Date.now(),
  });

  const history: Array<{ role: string; content: string }> = [
    { role: "user", content: "I work at Cognizant Foundation and want to apply for a loan" },
    {
      role: "assistant",
      content: "Now let's continue with your eligibility assessment. What is your monthly take-home salary?",
    },
  ];

  // Turn 1: User says "40 k"
  console.log("--- Turn 1: User sends '40 k' ---");
  const res1 = await runCentralAgent({
    conversationId,
    message: "40 k",
    conversationHistory: history,
  });

  console.log("Reply 1:\n", res1.reply, "\n");
  history.push({ role: "user", content: "40 k" });
  history.push({ role: "assistant", content: res1.reply });

  assert.ok(
    res1.reply.includes("40,000") || res1.reply.includes("40000"),
    "Reply 1 must acknowledge monthly income of 40,000"
  );
  assert.ok(
    res1.reply.toLowerCase().includes("emi") || res1.reply.toLowerCase().includes("existing"),
    "Reply 1 must ask for existing monthly EMIs"
  );

  const state1 = await getEligibilityState(conversationId);
  console.log("State after Turn 1:", JSON.stringify(state1?.applicant, null, 2));
  assert.strictEqual(state1?.applicant?.monthlyIncome, 40000, "Salary must be saved as 40000");

  // Turn 2: User says "0"
  console.log("--- Turn 2: User sends '0' ---");
  const res2 = await runCentralAgent({
    conversationId,
    message: "0",
    conversationHistory: history,
  });

  console.log("Reply 2:\n", res2.reply, "\n");
  const state2 = await getEligibilityState(conversationId);
  console.log("State after Turn 2:", JSON.stringify(state2?.applicant, null, 2));

  // Assertions:
  // 1. Existing EMI must be 0, NOT 40000!
  assert.strictEqual(state2?.applicant?.existingEmi, 0, "Existing EMI must be 0, NOT 40000!");
  // 2. Monthly income must stay 40000!
  assert.strictEqual(state2?.applicant?.monthlyIncome, 40000, "Monthly income must remain 40000!");
  // 3. Reply must NOT say 'existing EMI as ₹40,000'
  assert.ok(
    !res2.reply.includes("existing EMI as ₹40,000") && !res2.reply.includes("existing EMI as 40,000") && !res2.reply.includes("existing EMI as **₹40,000**"),
    "Reply 2 must NOT claim existing EMI is ₹40,000!"
  );
  assert.ok(
    res2.reply.includes("₹0") || res2.reply.toLowerCase().includes("0") || res2.reply.toLowerCase().includes("none"),
    "Reply 2 must acknowledge existing EMI as ₹0"
  );

  history.push({ role: "user", content: "0" });
  history.push({ role: "assistant", content: res2.reply });

  // Turn 3: User says "750" for CIBIL
  console.log("--- Turn 3: User sends '750' ---");
  const res3 = await runCentralAgent({
    conversationId,
    message: "750",
    conversationHistory: history,
  });
  console.log("Reply 3:\n", res3.reply, "\n");
  const state3 = await getEligibilityState(conversationId);
  assert.strictEqual(state3?.applicant?.cibil, 750, "CIBIL must be 750");
  assert.strictEqual(state3?.applicant?.existingEmi, 0, "EMI must remain 0");
  assert.strictEqual(state3?.applicant?.monthlyIncome, 40000, "Salary must remain 40000");

  history.push({ role: "user", content: "750" });
  history.push({ role: "assistant", content: res3.reply });

  // Turn 4: User says "28" for age
  console.log("--- Turn 4: User sends '28' ---");
  const res4 = await runCentralAgent({
    conversationId,
    message: "28",
    conversationHistory: history,
  });
  console.log("Reply 4:\n", res4.reply, "\n");
  const state4 = await getEligibilityState(conversationId);
  assert.strictEqual(state4?.applicant?.age, 28, "Age must be 28");
  assert.strictEqual(state4?.applicant?.existingEmi, 0, "EMI must remain 0");
  assert.strictEqual(state4?.applicant?.monthlyIncome, 40000, "Salary must remain 40000");

  history.push({ role: "user", content: "28" });
  history.push({ role: "assistant", content: res4.reply });

  // Turn 5: User says "3 lakhs" for loan amount
  console.log("--- Turn 5: User sends '3 lakhs' ---");
  const res5 = await runCentralAgent({
    conversationId,
    message: "3 lakhs",
    conversationHistory: history,
  });
  console.log("Reply 5:\n", res5.reply, "\n");
  const state5 = await getEligibilityState(conversationId);
  assert.strictEqual(state5?.applicant?.loanAmount, 300000, "Loan amount must be 300000");
  assert.strictEqual(state5?.applicant?.existingEmi, 0, "EMI must remain 0");
  assert.strictEqual(state5?.applicant?.monthlyIncome, 40000, "Salary must remain 40000");

  history.push({ role: "user", content: "3 lakhs" });
  history.push({ role: "assistant", content: res5.reply });

  // Turn 6: User says "3 years" for tenure
  console.log("--- Turn 6: User sends '3 years' ---");
  const res6 = await runCentralAgent({
    conversationId,
    message: "3 years",
    conversationHistory: history,
  });
  console.log("Reply 6:\n", res6.reply, "\n");
  const state6 = await getEligibilityState(conversationId);
  assert.strictEqual(state6?.applicant?.tenureMonths, 36, "Tenure must be 36 months");
  assert.strictEqual(state6?.applicant?.existingEmi, 0, "EMI must remain 0");
  assert.strictEqual(state6?.applicant?.monthlyIncome, 40000, "Salary must remain 40000");
  assert.ok(
    res6.reply.includes("Evaluation Complete") || res6.reply.toLowerCase().includes("eligible"),
    "Turn 6 must complete eligibility evaluation and display eligible bank results table"
  );

  console.log("================================================================================");
  console.log("🎉 FULL END-TO-END JOURNEY PASSED! All 6 turns accurately captured & preserved.");
  console.log("================================================================================");

  await clearEligibilityState(conversationId);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

