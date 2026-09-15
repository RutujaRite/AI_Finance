import dotenv from "dotenv";
dotenv.config();

import { analyzeConversationWithLLM } from "../lib/ai/agent";

async function testSingleFieldAnalysis() {
  console.log("--- Testing CIBIL 750 ---");
  const resCibil = await analyzeConversationWithLLM({
    userMessage: "750",
    conversationHistory: [
      { role: "user", content: "I work at TCS, salary 1 lakh, loan 5 lakhs for 3 years" },
      { role: "assistant", content: "Could you share your approximate CIBIL credit score?" },
    ],
    applicant: {
      loanType: "Personal Loan",
      companyName: "Tata Consultancy Services Limited",
      monthlyIncome: 100000,
      loanAmount: 500000,
      tenureMonths: 36,
      employmentType: "Salaried",
    },
    missingFields: ["cibil", "existingEmi", "age"],
    isFlowActive: true,
  });
  console.log("resCibil.extractedDetails:", resCibil.extractedDetails);
  console.log("resCibil.naturalResponse:", resCibil.naturalResponse);

  console.log("\n--- Testing Age 28 ---");
  const resAge = await analyzeConversationWithLLM({
    userMessage: "28",
    conversationHistory: [
      { role: "user", content: "750" },
      { role: "assistant", content: "Got it, CIBIL 750. What is your age in years?" },
    ],
    applicant: {
      loanType: "Personal Loan",
      companyName: "Tata Consultancy Services Limited",
      monthlyIncome: 100000,
      loanAmount: 500000,
      tenureMonths: 36,
      cibil: 750,
      employmentType: "Salaried",
    },
    missingFields: ["existingEmi", "age"],
    isFlowActive: true,
  });
  console.log("resAge.extractedDetails:", resAge.extractedDetails);
  console.log("resAge.naturalResponse:", resAge.naturalResponse);

  console.log("\n--- Testing Existing EMI 0 ---");
  const resEmi = await analyzeConversationWithLLM({
    userMessage: "0",
    conversationHistory: [
      { role: "user", content: "28" },
      { role: "assistant", content: "Do you have any existing monthly loan EMIs? (Say 0 or none if none)" },
    ],
    applicant: {
      loanType: "Personal Loan",
      companyName: "Tata Consultancy Services Limited",
      monthlyIncome: 100000,
      loanAmount: 500000,
      tenureMonths: 36,
      cibil: 750,
      age: 28,
      employmentType: "Salaried",
    },
    missingFields: ["existingEmi"],
    isFlowActive: true,
  });
  console.log("resEmi.extractedDetails:", resEmi.extractedDetails);
  console.log("resEmi.naturalResponse:", resEmi.naturalResponse);
}

testSingleFieldAnalysis().catch(console.error);
