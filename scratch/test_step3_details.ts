import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";
import { extractApplicantDetails, checkDefinitiveIneligibility } from "../lib/dynamicEligibilityEngine";

async function test() {
  const existingApplicant = {
    loanType: 'Personal Loan',
    companyName: 'CAPGEMINI TECHNOLOGY SERVICES INDIA LIMITED',
    monthlyIncome: 150000,
    loanAmount: 1000000,
    cibil: 810,
    age: 28,
    employmentType: 'Salaried',
    tenureMonths: 60
  };

  const userMsg = "0";

  console.log("--- 1. Testing classifyIntentWithLLM(\"0\") ---");
  const intentResult = await classifyIntentWithLLM(userMsg, {
    isFlowActive: true,
    expectedField: "existingEmi",
    existingApplicant: existingApplicant,
  });
  console.log("Intent result:\n", JSON.stringify(intentResult, null, 2));

  console.log("\n--- 2. Testing extractApplicantDetails(\"0\") ---");
  const updatedApplicant = extractApplicantDetails(
    userMsg,
    existingApplicant,
    ["existingEmi"],
    intentResult?.extracted
  );
  console.log("Updated applicant:\n", JSON.stringify(updatedApplicant, null, 2));

  console.log("\n--- 3. Testing checkDefinitiveIneligibility ---");
  const check = checkDefinitiveIneligibility(updatedApplicant);
  console.log("Definitive check:", check);

  process.exit(0);
}

test().catch(console.error);
