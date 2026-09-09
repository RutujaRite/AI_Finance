import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";

async function main() {
  const messages = [
    "Hi",
    "Hello",
    "Hey there",
    "Good morning",
    "How are you?",
    "What can you do?",
    "Who are you?",
    "Thanks",
    "I want a personal loan",
    "Check my loan eligibility",
    "Can I get a loan?",
    "I need 5 lakhs loan",
    "What is the interest rate for HDFC?",
    "Give me contact number of Pune manager",
    "Is TCS listed in your database?",
    "Calculate EMI for 500000 at 10.5% for 3 years"
  ];

  for (const msg of messages) {
    const res = await classifyIntentWithLLM(msg);
    console.log(`Message: "${msg}" -> Intent: ${res.intent}, LoanType: ${res.loanType}`);
  }
}

main().catch(console.error);
