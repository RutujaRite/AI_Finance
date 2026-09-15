import dotenv from "dotenv";
dotenv.config();

async function inspectRaw() {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  const model = "google/gemini-2.0-flash-001";

  console.log("Model:", model);
  console.log("API Key present:", !!apiKey);

  const systemPrompt = `You are the master conversational understanding brain for CreditWise AI, a personal loan and banking intelligence platform.
Analyze the user's message in the context of recent conversation history and the current applicant profile.

CURRENT CONTEXT:
- Accumulated Applicant Profile: {"loanType":"Personal Loan"}
- Missing Fields for Initial Eligibility: ["companyName","monthlyIncome","loanAmount","tenureMonths","cibil","existingEmi","age"]
- Eligibility Flow In Progress: true
- Eligibility Assessment Status: IN_PROGRESS
- Eligible Banks from Assessment: []
- Top Recommended Bank: None
- Currently Chosen Bank: None yet chosen by user
- Current Known City / Location: None provided yet
- Banks Rejected by User: []
- Actual Bank Eligibility Evaluations & Failed Criteria from Policy Engine:
  No failed bank evaluations recorded yet

CRITICAL ANALYSIS GUIDELINES:
1. NATURAL INTENT UNDERSTANDING:
   - Detect loan intent naturally. Set isLoanIntent to true.
2. EXTRACT APPLICANT DETAILS (Extract explicitly stated or clearly implied parameters):
   - companyName: corporate employer name (e.g. "TCS", "Google", "work at Infosys").
   - monthlyIncome: net monthly take-home salary in INR as a number (e.g. "80k" -> 80000, "1.2 lakh" -> 120000).
   - loanAmount: requested loan amount in INR as a number (e.g. "5 lakhs" -> 500000).
   - tenureMonths: repayment tenure in months as a number (e.g. "3 years" -> 36).
   - cibil: credit bureau score (300-900).
   - existingEmi: ongoing monthly loan EMIs in INR as a number (e.g. 0 if none/no loans/nil/all clear).
   - age: applicant age in years as a number.
   - location: city name if mentioned.
   - employmentType: "Salaried", "Self-Employed", "Unemployed", or "Student".

Return ONLY a strictly valid JSON object matching this schema:
{
  "userIntent": "LOAN_ELIGIBILITY" | "BANK_POLICY" | "EMI_CALCULATION" | "BANK_MANAGER" | "COMPANY_SEARCH" | "WEB_SEARCH" | "QUESTION_OR_OBJECTION" | "CORRECTION" | "GREETING" | "CANCEL_RESET" | "SELECT_BANK" | "REJECT_BANK" | "PROCEED_NEXT_STEP" | "GENERAL_CHAT",
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
    "employmentType": "Salaried" | "Self-Employed" | "Unemployed" | "Student" | null
  },
  "isCorrection": boolean,
  "correctedFields": string[],
  "targetBank": string | null,
  "selectedBank": string | null,
  "rejectedBank": string | null,
  "city": string | null,
  "wantsReevaluation": boolean,
  "emiDetails": { "principal": number | null, "rate": number | null, "tenureMonths": number | null } | null,
  "managerSearch": { "bankName": string | null, "city": string | null } | null,
  "companyQuery": string | null,
  "webSearchQuery": string | null,
  "naturalResponse": string
}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "I need a personal loan" },
    { role: "assistant", content: "To begin, could you tell me which company you work for?" },
    { role: "user", content: "Tata Consultancy Services" },
  ];

  const payload = {
    model,
    temperature: 0.1,
    max_tokens: 1200,
    messages,
    response_format: { type: "json_object" },
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "CreditWise AI",
    },
    body: JSON.stringify(payload),
  });

  console.log("HTTP Status:", res.status, res.statusText);
  const raw = await res.text();
  console.log("RAW RESPONSE BODY:\n", raw);

  process.exit(0);
}

inspectRaw().catch(console.error);
