import dotenv from "dotenv";
dotenv.config();

async function testDialogueContext() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "inclusionai/ling-3.0-flash-vl:free";

  const systemPrompt = `You are the master conversational understanding brain for CreditWise AI, a personal loan and banking intelligence platform.
Analyze the user's message in the context of recent conversation history and current applicant profile.

CURRENT CONTEXT:
- Accumulated Applicant Profile: {"loanType":"Personal Loan"}
- Missing Fields for Initial Eligibility: ["companyName","monthlyIncome","loanAmount","tenureMonths","cibil","existingEmi","age"]
- Eligibility Flow In Progress: true

CRITICAL RULES:
1. You MUST ALWAYS return ONLY a strictly valid JSON object. NEVER return plain conversational text.
2. In extractedDetails, populate any parameter provided by the user in this turn (e.g. companyName, monthlyIncome, loanAmount, tenureMonths, cibil, existingEmi, age).
3. If the user provides a numeric value answering the current missing field (e.g. "750" for CIBIL, "28" for age, "0" for existing EMI), you MUST set that key in extractedDetails.

Return ONLY a strictly valid JSON object matching this schema:
{
  "userIntent": "LOAN_ELIGIBILITY",
  "isLoanIntent": boolean,
  "hasQuestionOrObjection": boolean,
  "questionAnswer": string | null,
  "extractedDetails": {
    "companyName": string | null,
    "monthlyIncome": number | null,
    "loanAmount": number | null,
    "tenureMonths": number | null,
    "cibil": number | string | null,
    "existingEmi": number | null,
    "age": number | null,
    "location": string | null,
    "employmentType": string | null
  },
  "isCorrection": boolean,
  "correctedFields": string[],
  "targetBank": string | null,
  "selectedBank": string | null,
  "rejectedBank": string | null,
  "city": string | null,
  "wantsReevaluation": boolean,
  "emiDetails": null,
  "managerSearch": null,
  "companyQuery": null,
  "webSearchQuery": null,
  "naturalResponse": string
}`;

  const turns = [
    {
      userMsg: "Tata Consultancy Services",
      history: "User: I need a personal loan\nAssistant: To begin, which company do you work for?",
      pending: "companyName",
    },
    {
      userMsg: "100000",
      history: "User: Tata Consultancy Services\nAssistant: What is your monthly salary?",
      pending: "monthlyIncome",
    },
    {
      userMsg: "750",
      history: "User: 3 years\nAssistant: What is your CIBIL score?",
      pending: "cibil",
    },
    {
      userMsg: "28",
      history: "User: 750\nAssistant: What is your age?",
      pending: "age",
    },
    {
      userMsg: "0",
      history: "User: 28\nAssistant: Do you have any existing monthly EMIs?",
      pending: "existingEmi",
    },
  ];

  for (const t of turns) {
    console.log(`\n========================================`);
    console.log(`Testing turn: "${t.userMsg}" (pending: ${t.pending})`);

    const messages = [
      { role: "system", content: `${systemPrompt}\n\nCONVERSATION HISTORY:\n${t.history}\n\nCURRENT PENDING FIELD: "${t.pending}"` },
      { role: "user", content: t.userMsg },
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
        max_tokens: 800,
        messages,
      }),
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    console.log("Raw output:\n", content);
    try {
      const parsed = JSON.parse(content);
      console.log("Parsed extractedDetails:", parsed.extractedDetails);
      console.log("Parsed userIntent:", parsed.userIntent);
      console.log("Parsed naturalResponse:", parsed.naturalResponse);
    } catch (e: any) {
      console.log("Failed to parse JSON:", e.message);
    }
  }

  process.exit(0);
}

testDialogueContext().catch(console.error);
