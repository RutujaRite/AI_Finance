import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";
import { extractApplicantDetails } from "../lib/dynamicEligibilityEngine";
import { runCentralAgent } from "../lib/ai/agent";

async function compare() {
  const msg = "Capgemini, Age 28, Salary ₹1.5 lakh, CIBIL 810, Loan ₹10 lakh, 60 months, Existing EMI ₹0";
  console.log("=== COMPARING EVALUATION 1 vs EVALUATION 2 ===");
  
  console.log("\n1. Direct classifyIntentWithLLM on message:");
  const c1 = await classifyIntentWithLLM(msg);
  console.log("c1 intent:", c1.intent);
  console.log("c1 extracted:", JSON.stringify(c1.extracted, null, 2));

  console.log("\n2. Direct extractApplicantDetails with empty applicant & missingContext=[]:");
  const a1 = extractApplicantDetails(msg, {}, [], c1.extracted);
  console.log("a1 applicant:", JSON.stringify(a1, null, 2));

  console.log("\n3. If targetExpectedField was 'companyName' (Evaluation 2 condition):");
  const a2 = extractApplicantDetails(msg, { ...a1, companyName: undefined }, ["companyName"], c1.extracted);
  console.log("a2 applicant:", JSON.stringify(a2, null, 2));

  process.exit(0);
}

compare().catch(e => {
  console.error(e);
  process.exit(1);
});
