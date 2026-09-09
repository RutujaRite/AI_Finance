import dotenv from "dotenv";
dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const configuredModel = process.env.OPENROUTER_MODEL || "openrouter/free";

async function testModel(modelName: string) {
  console.log("Testing:", modelName);
  const start = Date.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "CreditWise AI",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 150,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "You are an AI intent classifier. Classify user message into: PERSONAL_LOAN_REQUEST, OTHER_LOAN_REQUEST, BANK_MANAGER_SEARCH, COMPANY_SEARCH, POLICY_INQUIRY, EMI_CALCULATION, GREETING, GENERAL_INQUIRY. Output JSON only: {\"intent\": \"...\"}"
          },
          {
            role: "user",
            content: "I want a personal loan"
          }
        ]
      })
    });
    const duration = Date.now() - start;
    console.log(`Model: ${modelName} -> Status: ${res.status} in ${duration}ms`);
    const data = await res.json();
    console.log("Content:", data?.choices?.[0]?.message?.content);
  } catch (e: any) {
    console.error(`Model: ${modelName} Error:`, e.message);
  }
}

async function main() {
  await testModel(configuredModel);
}

main();
