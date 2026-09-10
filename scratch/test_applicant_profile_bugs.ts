import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function testApplicantProfilePreservation() {
  console.log("================================================================================");
  console.log("   TESTING APPLICANT PROFILE PRESERVATION & FIELD MAPPING                      ");
  console.log("================================================================================\n");

  const convId = "test-profile-" + Date.now();
  await clearEligibilityState(convId);

  // Turn 1: Start loan
  console.log("--- Turn 1: 'I want a personal loan' ---");
  const t1 = await runCentralAgent({ message: "I want a personal loan", conversationId: convId });
  console.log("Assistant:", t1.reply);
  let state = await getEligibilityState(convId);
  console.log("State 1:", JSON.stringify(state?.applicant));
  console.log("Expected Field 1:", state?.expectedField);

  // Turn 2: Company
  console.log("\n--- Turn 2: 'Tata Consultancy Services' ---");
  const t2 = await runCentralAgent({ message: "Tata Consultancy Services", conversationId: convId });
  console.log("Assistant:", t2.reply);
  state = await getEligibilityState(convId);
  console.log("State 2:", JSON.stringify(state?.applicant));
  console.log("Expected Field 2:", state?.expectedField);

  // Turn 3: Monthly Salary with '1.5 lakhs'
  console.log("\n--- Turn 3: '1.5 lakhs' (Expected: monthlyIncome=150000, NOT loanAmount) ---");
  const t3 = await runCentralAgent({ message: "1.5 lakhs", conversationId: convId });
  console.log("Assistant:", t3.reply);
  state = await getEligibilityState(convId);
  console.log("State 3:", JSON.stringify(state?.applicant));
  console.log("Expected Field 3:", state?.expectedField);
  console.log("monthlyIncome check:", state?.applicant?.monthlyIncome === 150000 ? "PASS" : "FAIL (actual: " + state?.applicant?.monthlyIncome + ")");
  console.log("loanAmount NOT polluted check:", (state?.applicant?.loanAmount === undefined) ? "PASS" : "FAIL (actual: " + state?.applicant?.loanAmount + ")");

  // Turn 4: Loan Amount with '500000'
  console.log("\n--- Turn 4: '500000' (Expected: loanAmount=500000, monthlyIncome stays 150000) ---");
  const t4 = await runCentralAgent({ message: "500000", conversationId: convId });
  console.log("Assistant:", t4.reply);
  state = await getEligibilityState(convId);
  console.log("State 4:", JSON.stringify(state?.applicant));
  console.log("Expected Field 4:", state?.expectedField);
  console.log("loanAmount check:", state?.applicant?.loanAmount === 500000 ? "PASS" : "FAIL (actual: " + state?.applicant?.loanAmount + ")");
  console.log("monthlyIncome preserved check:", state?.applicant?.monthlyIncome === 150000 ? "PASS" : "FAIL (actual: " + state?.applicant?.monthlyIncome + ")");

  // Turn 5: Tenure with '3' (years)
  console.log("\n--- Turn 5: '3' (Expected: tenureMonths=36, age not set) ---");
  const t5 = await runCentralAgent({ message: "3", conversationId: convId });
  console.log("Assistant:", t5.reply);
  state = await getEligibilityState(convId);
  console.log("State 5:", JSON.stringify(state?.applicant));
  console.log("Expected Field 5:", state?.expectedField);
  console.log("tenureMonths check:", state?.applicant?.tenureMonths === 36 ? "PASS" : "FAIL (actual: " + state?.applicant?.tenureMonths + ")");

  // Turn 6: CIBIL with '780'
  console.log("\n--- Turn 6: '780' (Expected: cibil=780) ---");
  const t6 = await runCentralAgent({ message: "780", conversationId: convId });
  console.log("Assistant:", t6.reply);
  state = await getEligibilityState(convId);
  console.log("State 6:", JSON.stringify(state?.applicant));
  console.log("Expected Field 6:", state?.expectedField);
  console.log("cibil check:", state?.applicant?.cibil === 780 ? "PASS" : "FAIL (actual: " + state?.applicant?.cibil + ")");

  // Turn 7: Existing EMI with 'None'
  console.log("\n--- Turn 7: 'None' (Expected: existingEmi=0, salary preserved) ---");
  const t7 = await runCentralAgent({ message: "None", conversationId: convId });
  console.log("Assistant:", t7.reply);
  state = await getEligibilityState(convId);
  console.log("State 7:", JSON.stringify(state?.applicant));
  console.log("Expected Field 7:", state?.expectedField);
  console.log("existingEmi check:", state?.applicant?.existingEmi === 0 ? "PASS" : "FAIL (actual: " + state?.applicant?.existingEmi + ")");
  console.log("monthlyIncome preserved check:", state?.applicant?.monthlyIncome === 150000 ? "PASS" : "FAIL (actual: " + state?.applicant?.monthlyIncome + ")");

  // Turn 8: Age with '29'
  console.log("\n--- Turn 8: '29' (Expected: age=29, tenure stays 36, evaluation triggers) ---");
  const t8 = await runCentralAgent({ message: "29", conversationId: convId });
  console.log("Assistant:", t8.reply.slice(0, 300) + "...");
  state = await getEligibilityState(convId);
  console.log("Final State:", JSON.stringify(state?.applicant));
  const isEvaluationReport = t8.reply.includes("Approved Partner Banks") || t8.reply.includes("Eligibility Assessment Report");
  console.log("Evaluation triggered check:", isEvaluationReport ? "PASS" : "FAIL");
}

testApplicantProfilePreservation().catch(console.error);
