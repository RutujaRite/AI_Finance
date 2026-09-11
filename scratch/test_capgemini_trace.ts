import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState, extractApplicantDetails, evaluateApplicantAgainstAllBanks } from "../lib/dynamicEligibilityEngine";
import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";
import { resolveCompanyCategories } from "../lib/companyCategoryResolver";

async function trace() {
  const message = "Capgemini, Age 28, Salary ₹1.5 lakh, CIBIL 810, Loan ₹10 lakh, 60 months, Existing EMI ₹0";
  console.log("==================== TRACING MESSAGE ====================");
  console.log("Message:", message);

  // 1. Check Intent Classification directly
  const classification = await classifyIntentWithLLM(message);
  console.log("\n[1] Intent Classification Result:");
  console.log(JSON.stringify(classification, null, 2));

  // 2. Check Entity Extraction directly
  const extracted = extractApplicantDetails(message, {}, [], classification.extracted);
  console.log("\n[2] Extracted Applicant Profile from extractApplicantDetails:");
  console.log(JSON.stringify(extracted, null, 2));

  // 3. Check Company Resolution directly
  const companyRes = await resolveCompanyCategories(extracted.companyName || "Capgemini");
  console.log("\n[3] Company Category Resolution:");
  console.log("Matched name:", companyRes.matchedName);
  console.log("Is found:", companyRes.isFound);
  console.log("Overall tier:", companyRes.overallCategoryDisplay);
  console.log("Bank categories count:", Object.keys(companyRes.bankCategories).length);

  // 4. Run Central Agent First Evaluation
  const convId = "capgemini-trace-" + Date.now();
  console.log("\n[4] Running runCentralAgent (Evaluation 1)...");
  const res1 = await runCentralAgent({
    message,
    conversationId: convId,
  });
  console.log("\n>>> EVALUATION 1 REPLY:\n" + res1.reply);

  const state1 = await getEligibilityState(convId);
  console.log("\n[4b] State after Evaluation 1 in DB/Memory:");
  console.log(JSON.stringify(state1, null, 2));

  // 5. Run Central Agent Second Evaluation (same conversation or new conversation)
  console.log("\n[5] Running runCentralAgent (Evaluation 2 - Same Conv)...");
  const res2 = await runCentralAgent({
    message,
    conversationId: convId,
    conversationHistory: [
      { role: "user", content: message },
      { role: "assistant", content: res1.reply },
    ],
  });
  console.log("\n>>> EVALUATION 2 REPLY:\n" + res2.reply);

  process.exit(0);
}

trace().catch(err => {
  console.error("Trace error:", err);
  process.exit(1);
});
