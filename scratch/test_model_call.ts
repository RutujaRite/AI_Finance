import dotenv from "dotenv";
dotenv.config();

async function testPromptOrder() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "inclusionai/ling-3.0-flash-vl:free";

  const systemPrompt = `CRITICAL REQUIREMENT: You are an API backend. You MUST output ONLY a valid JSON object. NEVER output plain text or conversation outside the JSON.

SCHEMA:
{
  "userIntent": "LOAN_ELIGIBILITY" | "BANK_POLICY" | "EMI_CALCULATION" | "GENERAL_CHAT",
  "isLoanIntent": boolean,
  "hasQuestionOrObjection": boolean,
  "questionAnswer": string | null,
  "extractedDetails": {
    "companyName": string | null,
    "monthlyIncome": number | string | null,
    "loanAmount": number | string | null,
    "tenureMonths": number | string | null,
    "cibil": number | string | null,
    "existingEmi": number | string | null,
    "age": number | string | null,
    "location": string | null,
    "employmentType": string | null
  },
  "naturalResponse": string
}

CURRENT CONTEXT:
- Missing Fields: ["companyName", "monthlyIncome", "loanAmount", "tenureMonths", "cibil", "existingEmi", "age"]
- Current Pending Field: "companyName"

Analyze the user's message and return the JSON object:`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "I need a personal loan\n\n[OUTPUT ONLY JSON]" },
  ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 600,
      messages,
    }),
  });

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";
  console.log("RAW OUTPUT:\n", raw);
  process.exit(0);
}

testPromptOrder().catch(console.error);
