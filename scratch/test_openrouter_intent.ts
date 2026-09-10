import dotenv from "dotenv";
dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

async function testIntentClassification(userMessage: string, context?: any) {
  const prompt = [
    {
      role: "system",
      content:
        `You are the Intent Classification and Entity Extraction Engine for CreditWise AI, a banking and loan intelligence platform.\n` +
        `Analyze the user's message semantically and classify it into EXACTLY ONE of the following 6 intents:\n` +
        `1. "LOAN_ELIGIBILITY": User is asking to check personal loan eligibility, apply for a personal loan, start an eligibility assessment, or providing profile details (salary, cibil, company name, age, tenure, emi) to evaluate eligibility.\n` +
        `2. "CALCULATION": User is asking to calculate monthly EMI, loan installment, interest amount, or loan borrowing capacity.\n` +
        `3. "GENERAL_INFORMATION": User is asking questions about bank policies (e.g. CIBIL cutoffs, FOIR percentage, interest rates, age limits), bank manager contacts, company category ratings (Cat A, Elite, Diamond), general banking concepts (e.g. "What is FOIR?"), or assistant capabilities/help.\n` +
        `4. "CHANGING_DETAILS": User wants to change, update, modify, or correct previously provided details (e.g. "Change my salary to 2 lakhs", "Actually my CIBIL is 750", "Update my company to TCS", "Make tenure 3 years").\n` +
        `5. "GREETINGS": User is greeting or saying hello (e.g. "hi", "hello", "good morning", "hey there", "namaste").\n` +
        `6. "ANOTHER_TOPIC": User is asking an off-topic question, making casual small talk ("who made you", "thank you", "bye"), or requesting to cancel/reset ("cancel", "reset", "start over").\n\n` +
        `CRITICAL RULES:\n` +
        `- Do NOT use hardcoded keyword matching. Understand the user's semantic intent from the message.\n` +
        `- If an eligibility conversation is active, but the user asks a policy question, an EMI calculation, a bank manager question, or a general question, you MUST classify it as "GENERAL_INFORMATION" or "CALCULATION", NOT "LOAN_ELIGIBILITY".\n` +
        `- If the user wants to update or correct a field they already gave, classify as "CHANGING_DETAILS".\n\n` +
        `Context: Eligibility Flow Active = ${context?.isFlowActive ? `true (current expected field: ${context?.expectedField || "next detail"})` : "false"}.\n\n` +
        `Entity Extraction: Extract any explicitly mentioned parameters: companyName, monthlyIncome, loanAmount, tenureMonths, cibil, existingEmi, age, employmentType, targetBank, city.\n\n` +
        `Return JSON ONLY in this format:\n` +
        `{\n` +
        `  "intent": "LOAN_ELIGIBILITY" | "CALCULATION" | "GENERAL_INFORMATION" | "CHANGING_DETAILS" | "GREETINGS" | "ANOTHER_TOPIC",\n` +
        `  "confidence": 0.95,\n` +
        `  "extracted": {\n` +
        `    "companyName": null,\n` +
        `    "monthlyIncome": null,\n` +
        `    "loanAmount": null,\n` +
        `    "tenureMonths": null,\n` +
        `    "cibil": null,\n` +
        `    "existingEmi": null,\n` +
        `    "age": null,\n` +
        `    "employmentType": null,\n` +
        `    "targetBank": null\n` +
        `  }\n` +
        `}`
    },
    {
      role: "user",
      content: userMessage
    }
  ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "CreditWise AI",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      max_tokens: 300,
      temperature: 0.1,
      messages: prompt
    })
  });

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  console.log(`\nInput: "${userMessage}" [Active: ${context?.isFlowActive ? context.expectedField : 'no'}]`);
  console.log("Raw output:", content);
}

async function main() {
  const testCases = [
    { msg: "Hi there, good morning", ctx: { isFlowActive: false } },
    { msg: "I want to check my personal loan eligibility", ctx: { isFlowActive: false } },
    { msg: "Tata Consultancy Services", ctx: { isFlowActive: true, expectedField: "companyName" } },
    { msg: "My salary is 150000 per month", ctx: { isFlowActive: true, expectedField: "monthlyIncome" } },
    { msg: "What is the EMI for 20 lakhs at 11% for 5 years?", ctx: { isFlowActive: true, expectedField: "monthlyIncome" } },
    { msg: "What is HDFC minimum CIBIL score?", ctx: { isFlowActive: true, expectedField: "monthlyIncome" } },
    { msg: "What does FOIR mean?", ctx: { isFlowActive: true, expectedField: "cibil" } },
    { msg: "Actually change my salary to 200000", ctx: { isFlowActive: true, expectedField: "cibil" } },
    { msg: "Who is the manager for ICICI in Pune?", ctx: { isFlowActive: true, expectedField: "tenureMonths" } },
    { msg: "Cancel this assessment", ctx: { isFlowActive: true, expectedField: "age" } },
  ];

  for (const tc of testCases) {
    await testIntentClassification(tc.msg, tc.ctx);
  }
}

main();
