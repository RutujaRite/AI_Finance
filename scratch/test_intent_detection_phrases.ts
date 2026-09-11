import "dotenv/config";
import { detectLoanIntent } from "../lib/dynamicEligibilityEngine";
import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";

const phrases = [
  "What banks am I eligible for?",
  "Which banks can I get a loan from?",
  "Which bank is best for my loan?",
  "Am I eligible for a loan?",
  // Policy questions that MUST stay separate:
  "What is HDFC bank policy?",
  "What are ICICI guidelines?",
  "Axis Bank CIBIL cutoff policy"
];

async function main() {
  for (const p of phrases) {
    const d = detectLoanIntent(p);
    const c = await classifyIntentWithLLM(p);
    console.log(`=== Query: "${p}" ===`);
    console.log(`  detectLoanIntent: isLoanIntent=${d.isLoanIntent}, loanType=${d.loanType}`);
    console.log(`  classifyIntentWithLLM: intent=${c.intent}, subIntent=${c.subIntent || "none"}`);
  }
}

main().catch(console.error);

