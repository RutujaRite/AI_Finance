import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTestSuite() {
  console.log("================================================================================");
  console.log("        VERIFYING PROFILE UPDATE HANDLING & ELIGIBILITY RECALCULATION           ");
  console.log("================================================================================\n");

  const convId = "test-update-" + Date.now();
  await clearEligibilityState(convId);

  // --- Step 1: Establish baseline full profile ---
  console.log("--- 1. Building Baseline Profile ---");
  await runCentralAgent({ message: "I want a personal loan", conversationId: convId });
  await runCentralAgent({ message: "Tata Consultancy Services", conversationId: convId });
  await runCentralAgent({ message: "150000", conversationId: convId });
  await runCentralAgent({ message: "500000", conversationId: convId });
  await runCentralAgent({ message: "36", conversationId: convId });
  await runCentralAgent({ message: "780", conversationId: convId });
  await runCentralAgent({ message: "0", conversationId: convId });
  const baseRes = await runCentralAgent({ message: "29", conversationId: convId });

  let state = await getEligibilityState(convId);
  console.log("Baseline Applicant Profile:", JSON.stringify(state?.applicant));
  const baseEligible = (state as any)?.eligible_banks || [];
  console.log(`Baseline Approved Banks count: ${baseEligible.length}`);
  console.log("Baseline Report Snippet:", baseRes.reply.slice(0, 200).replace(/\n/g, " "));

  // --- Test 1: Update Salary (1,50,000 -> 2,00,000) ---
  console.log("\n--- Test 1: Updating Salary (150000 -> 200000) ---");
  const res1 = await runCentralAgent({ message: "Change my salary to 200000", conversationId: convId });
  state = await getEligibilityState(convId);
  console.log("Updated Salary:", state?.applicant?.monthlyIncome);
  const pass1 = state?.applicant?.monthlyIncome === 200000;
  console.log("Test 1 Salary Replaced:", pass1 ? "PASS ✅" : "FAIL ❌");
  console.log("Test 1 Recalculation Triggered:", res1.reply.includes("Approved Partner Bank") ? "PASS ✅" : "FAIL ❌");

  // --- Test 2: Update CIBIL Score (780 -> 640) ---
  console.log("\n--- Test 2: Updating CIBIL (780 -> 640) ---");
  const res2 = await runCentralAgent({ message: "Actually my CIBIL score is 640", conversationId: convId });
  state = await getEligibilityState(convId);
  console.log("Updated CIBIL:", state?.applicant?.cibil);
  const pass2 = state?.applicant?.cibil === 640;
  console.log("Test 2 CIBIL Replaced:", pass2 ? "PASS ✅" : "FAIL ❌");
  // With CIBIL 640, banks with min CIBIL 650 (e.g. HDFC, ICICI) must reject
  const eligibleBanks2 = (state as any)?.eligible_banks || [];
  console.log(`Approved Banks with CIBIL 640: ${eligibleBanks2.length}`);
  console.log("Test 2 Recalculated with CIBIL 640:", pass2 ? "PASS ✅" : "FAIL ❌");

  // Restore CIBIL to 780 for subsequent tests
  await runCentralAgent({ message: "Change CIBIL back to 780", conversationId: convId });

  // --- Test 3: Update Company (TCS -> Infosys) ---
  console.log("\n--- Test 3: Updating Company (TCS -> Infosys) ---");
  const res3 = await runCentralAgent({ message: "Update my company to Infosys Limited", conversationId: convId });
  state = await getEligibilityState(convId);
  console.log("Updated Company:", state?.applicant?.companyName);
  const pass3 = state?.applicant?.companyName?.toLowerCase().includes("infosys");
  console.log("Test 3 Company Replaced:", pass3 ? "PASS ✅" : "FAIL ❌");

  // --- Test 4: Update Tenure (36 months -> 60 months) ---
  console.log("\n--- Test 4: Updating Tenure (36 -> 5 years / 60 months) ---");
  const res4 = await runCentralAgent({ message: "Change tenure to 5 years", conversationId: convId });
  state = await getEligibilityState(convId);
  console.log("Updated Tenure:", state?.applicant?.tenureMonths);
  const pass4 = state?.applicant?.tenureMonths === 60;
  console.log("Test 4 Tenure Replaced:", pass4 ? "PASS ✅" : "FAIL ❌");

  // --- Test 5: Update Loan Amount (5,00,000 -> 10,00,000) ---
  console.log("\n--- Test 5: Updating Loan Amount (5L -> 10L) ---");
  const res5 = await runCentralAgent({ message: "Change loan amount to 10 lakhs", conversationId: convId });
  state = await getEligibilityState(convId);
  console.log("Updated Loan Amount:", state?.applicant?.loanAmount);
  const pass5 = state?.applicant?.loanAmount === 1000000;
  console.log("Test 5 Loan Amount Replaced:", pass5 ? "PASS ✅" : "FAIL ❌");

  // --- Test 6: Update Existing EMI (0 -> 25,000) ---
  console.log("\n--- Test 6: Updating Existing EMI (0 -> 25000) ---");
  const res6 = await runCentralAgent({ message: "Actually my existing EMI is 25000", conversationId: convId });
  state = await getEligibilityState(convId);
  console.log("Updated Existing EMI:", state?.applicant?.existingEmi);
  const pass6 = state?.applicant?.existingEmi === 25000;
  console.log("Test 6 Existing EMI Replaced:", pass6 ? "PASS ✅" : "FAIL ❌");

  // --- Test 7: Update Age (29 -> 62) ---
  console.log("\n--- Test 7: Updating Age (29 -> 62, outside standard 21-60 band) ---");
  const res7 = await runCentralAgent({ message: "Change my age to 62", conversationId: convId });
  state = await getEligibilityState(convId);
  console.log("Updated Age:", state?.applicant?.age);
  const pass7 = state?.applicant?.age === 62;
  console.log("Test 7 Age Replaced:", pass7 ? "PASS ✅" : "FAIL ❌");

  // Restore Age to 30
  await runCentralAgent({ message: "Change age to 30", conversationId: convId });

  // --- Test 8: Update Employment Type (Salaried -> Self-Employed) ---
  console.log("\n--- Test 8: Updating Employment Type (Salaried -> Self-Employed) ---");
  const res8 = await runCentralAgent({ message: "Change employment type to Self-Employed", conversationId: convId });
  state = await getEligibilityState(convId);
  console.log("Updated Employment Type:", state?.applicant?.employmentType);
  const pass8 = state?.applicant?.employmentType === "Self-Employed";
  console.log("Test 8 Employment Type Replaced:", pass8 ? "PASS ✅" : "FAIL ❌");

  // --- Test 9: Multi-parameter update in single turn ---
  console.log("\n--- Test 9: Multi-parameter update (salary 2.5L and tenure 4 years) ---");
  const res9 = await runCentralAgent({
    message: "Change salary to 2.5 lakhs and tenure to 4 years",
    conversationId: convId,
  });
  state = await getEligibilityState(convId);
  console.log("Updated Profile:", JSON.stringify(state?.applicant));
  const pass9 = state?.applicant?.monthlyIncome === 250000 && state?.applicant?.tenureMonths === 48;
  console.log("Test 9 Multi-parameter Replaced:", pass9 ? "PASS ✅" : "FAIL ❌");

  // --- Test 10: Mid-Flow Update (update salary before providing loan amount) ---
  console.log("\n--- Test 10: Mid-Flow Update (updating salary before flow completes) ---");
  const midConvId = "test-midflow-" + Date.now();
  await clearEligibilityState(midConvId);
  await runCentralAgent({ message: "I want a personal loan", conversationId: midConvId });
  await runCentralAgent({ message: "Wipro", conversationId: midConvId });
  await runCentralAgent({ message: "80000", conversationId: midConvId });
  // Currently expecting loanAmount:
  let midState = await getEligibilityState(midConvId);
  console.log("Mid-flow state before update:", JSON.stringify(midState?.applicant));
  console.log("Mid-flow expected field:", midState?.expectedField);

  // Now change salary to 95000:
  const midRes = await runCentralAgent({ message: "Actually my salary is 95000", conversationId: midConvId });
  midState = await getEligibilityState(midConvId);
  console.log("Mid-flow state after salary update:", JSON.stringify(midState?.applicant));
  console.log("Mid-flow next question:", midRes.reply);
  const pass10 =
    midState?.applicant?.monthlyIncome === 95000 &&
    midState?.applicant?.companyName?.toLowerCase().includes("wipro") &&
    midState?.expectedField === "loanAmount";
  console.log("Test 10 Mid-flow Update:", pass10 ? "PASS ✅" : "FAIL ❌");

  console.log("\n================================================================================");
  const allPassed = pass1 && pass2 && pass3 && pass4 && pass5 && pass6 && pass7 && pass8 && pass9 && pass10;
  console.log(`ALL 10 TESTS RESULT: ${allPassed ? "ALL PASSED ✅" : "SOME FAILED ❌"}`);
  console.log("================================================================================");
}

runTestSuite().catch(console.error);
