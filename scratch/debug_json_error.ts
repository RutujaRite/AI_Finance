// scratch/debug_json_error.ts
import dotenv from "dotenv";
dotenv.config();

import { cleanLlmJsonOutput } from "../lib/ai/intentClassifier";

async function test() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const userMessage = "I work at Tata Consultancy Services as a software engineer, earning 1.2 lakhs per month. Need 5 lakhs loan for 3 years.";
  
  const systemPrompt = `You are the master conversational understanding brain for CreditWise AI, a personal loan and banking intelligence platform.
Analyze the user's message in the context of recent conversation history and the current applicant profile.

CURRENT CONTEXT:
- Accumulated Applicant Profile: {}
- Missing Fields for Loan Eligibility: ["companyName","monthlyIncome","loanAmount","tenureMonths","cibil","existingEmi","age"]
- Eligibility Flow In Progress: false

CRITICAL ANALYSIS GUIDELINES:
1. NATURAL INTENT UNDERSTANDING:
   - Detect loan intent naturally from diverse user phrases. Set isLoanIntent to true.
2. EXTRACT APPLICANT DETAILS:
   - companyName: corporate employer name
   - monthlyIncome: net monthly take-home salary in INR
   - loanAmount: requested loan amount in INR
   - tenureMonths: repayment tenure in months
   - cibil: credit score or 0 for new to credit
   - existingEmi: ongoing monthly loan EMIs (0 if none)
   - age: applicant age in years
   - employmentType: Salaried / Self-Employed
3. Return ONLY a strictly valid JSON object matching this schema:
{
  "userIntent": "LOAN_ELIGIBILITY" | "BANK_POLICY" | "EMI_CALCULATION" | "BANK_MANAGER" | "COMPANY_SEARCH" | "WEB_SEARCH" | "QUESTION_OR_OBJECTION" | "CORRECTION" | "GREETING" | "CANCEL_RESET" | "GENERAL_CHAT",
  "isLoanIntent": boolean,
  "hasQuestionOrObjection": boolean,
  "questionAnswer": string | null,
  "extractedDetails": {
    "companyName": string | null,
    "monthlyIncome": number | null,
    "loanAmount": number | null,
    "tenureMonths": number | null,
    "cibil": number | null,
    "existingEmi": number | null,
    "age": number | null,
    "employmentType": "Salaried" | "Self-Employed" | "Unemployed" | "Student" | null
  },
  "isCorrection": boolean,
  "correctedFields": string[],
  "targetBank": string | null,
  "emiDetails": { "principal": number | null, "rate": number | null, "tenureMonths": number | null } | null,
  "managerSearch": { "bankName": string | null, "city": string | null } | null,
  "companyQuery": string | null,
  "webSearchQuery": string | null,
  "naturalResponse": string
}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "CreditWise AI",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      temperature: 0.1,
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const data = await res.json();
  const rawContent = data?.choices?.[0]?.message?.content || "";
  console.log("=== RAW CONTENT ===");
  console.log(rawContent);
  console.log("=== CLEANED ===");
  const cleaned = cleanLlmJsonOutput(rawContent);
  console.log(cleaned);
  try {
    const parsed = JSON.parse(cleaned);
    console.log("=== PARSED SUCCESSFULLY ===");
    console.log(parsed);
  } catch (err) {
    console.error("=== PARSE ERROR ===", err);
  }
}

test();
