import dotenv from "dotenv";
dotenv.config();

import { analyzeConversationWithLLM } from "../lib/ai/agent";

async function inspectTurn8() {
  const history = [
    { role: "user", content: "I need a personal loan" },
    { role: "assistant", content: "To begin, could you tell me the name of the company you're currently employed with?" },
    { role: "user", content: "Tata Consultancy Services" },
    { role: "assistant", content: "Next, could you let me know your monthly take-home salary?" },
    { role: "user", content: "100000" },
    { role: "assistant", content: "How much loan amount you're looking for?" },
    { role: "user", content: "500000" },
    { role: "assistant", content: "How many months or years would you like to repay the loan over?" },
    { role: "user", content: "3 years" },
    { role: "assistant", content: "Could you share your age so I can complete your profile?" },
    { role: "user", content: "750" },
    { role: "assistant", content: "It looks like 750 might be your CIBIL score... could you share your age? Also do you have any existing monthly EMIs?" },
    { role: "user", content: "28" },
    { role: "assistant", content: "Great, 28 years old... Just one more thing — do you have any existing monthly EMIs on other loans?" },
  ];

  const applicant = {
    loanType: "Personal Loan",
    companyName: "Tata Consultancy Services Limited",
    monthlyIncome: 100000,
    loanAmount: 500000,
    tenureMonths: 36,
    employmentType: "Salaried",
  };

  const missingFields = ["cibil", "existingEmi", "age"];

  console.log("Analyzing Turn 8 (user says '0')...");
  const analysis = await analyzeConversationWithLLM({
    userMessage: "0",
    conversationHistory: history,
    applicant,
    missingFields,
    isFlowActive: true,
  });

  console.log("Turn 8 Analysis Result:\n", JSON.stringify(analysis, null, 2));
}

inspectTurn8().catch(console.error);
