import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { saveEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function testFinalEmiZero() {
  console.log("=== Testing Submission of Final Field: existing EMI = 0 ===");

  const convId = "test_emi_zero_" + Date.now();

  // Setup state as if all prior fields were collected:
  // company, salary, loan amount, tenure, cibil, age
  await saveEligibilityState(convId, {
    applicant: {
      loanType: "Personal Loan",
      companyName: "Tata Consultancy Services",
      monthlyIncome: 100000,
      loanAmount: 500000,
      tenureMonths: 36,
      cibil: 750,
      age: 28,
      employmentType: "Salaried",
    },
    expectedField: "existingEmi",
    missingFields: ["existingEmi"],
    in_eligibility_flow: true,
    updatedAt: Date.now(),
    conversationHistory: [
      { role: "user", content: "I work at TCS, salary 1 lakh, loan 5 lakhs for 3 years, CIBIL 750, age 28" },
      { role: "assistant", content: "Do you have any existing monthly loan EMIs? (You can say 0 or none if none)" },
    ],
  } as any);

  console.log("State prepared. Now sending final field: '0' (or 'existing EMI = 0')...");

  try {
    const result = await runCentralAgent({
      message: "0",
      conversationId: convId,
      conversationHistory: [
        { role: "user", content: "I work at TCS, salary 1 lakh, loan 5 lakhs for 3 years, CIBIL 750, age 28" },
        { role: "assistant", content: "Do you have any existing monthly loan EMIs? (You can say 0 or none if none)" },
      ],
    });

    console.log("Result reply length:", result.reply?.length);
    console.log("Result reply preview:\n", result.reply?.slice(0, 500));
  } catch (err: any) {
    console.error("CAUGHT EXCEPTION in runCentralAgent:", err);
    console.error("Stack:", err.stack);
  }
}

testFinalEmiZero().catch(console.error);
