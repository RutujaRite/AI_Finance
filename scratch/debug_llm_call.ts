// scratch/debug_llm_call.ts
import { analyzeConversationWithLLM } from "../lib/ai/agent";

async function test() {
  try {
    console.log("Testing analyzeConversationWithLLM...");
    const res = await analyzeConversationWithLLM({
      userMessage: "I work at Tata Consultancy Services as a software engineer, earning 1.2 lakhs per month. Need 5 lakhs loan for 3 years.",
    });
    console.log("Analysis Result:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("Caught error:", e);
  }
}

test();
