require('dotenv').config();
const { openRouterChat } = require('../lib/openrouter.js');

async function testBrain(userMsg, context = []) {
  const systemPrompt = `You are the master conversation understanding brain for CreditWise AI, a personal loan and banking intelligence platform.
Analyze the user's message in the context of recent conversation history and the current applicant profile.

Current Applicant Profile: {}
Missing Fields for Loan Eligibility: ["companyName", "monthlyIncome", "loanAmount", "tenureMonths", "cibil", "existingEmi", "age"]

Return ONLY a valid JSON object matching this schema:
{
  "userIntent": "LOAN_ELIGIBILITY" | "BANK_POLICY" | "EMI_CALCULATION" | "BANK_MANAGER" | "QUESTION_OR_OBJECTION" | "CORRECTION" | "GREETING" | "CANCEL_RESET" | "GENERAL_CHAT",
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
  "naturalResponse": string
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...context,
    { role: 'user', content: userMsg }
  ];

  const res = await openRouterChat(messages, undefined, 'openrouter/auto');
  const raw = res.choices[0].message.content;
  console.log('--- USER MESSAGE:', userMsg);
  console.log('--- RAW RESPONSE:');
  console.log(raw);
}

async function run() {
  await testBrain('I need a personal loan of 5 lakhs, I work at TCS and make 80k');
  await testBrain('Why do you need my CIBIL score? Will this check affect it?', [
    { role: 'assistant', content: 'What is your current CIBIL credit score?' }
  ]);
  await testBrain('Actually my salary is 95,000, not 80k', [
    { role: 'user', content: 'I make 80k at TCS' },
    { role: 'assistant', content: 'Noted ₹80,000 salary at TCS. What is your age?' }
  ]);
  await testBrain('What is FOIR?');
}

run().catch(console.error);
