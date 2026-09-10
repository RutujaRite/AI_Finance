export {};

import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";

async function runE2eTests() {
  console.log("====================================================================");
  console.log("STARTING E2E GENERAL_INFORMATION VERIFICATION");
  console.log("====================================================================\n");

  const convId = "conv-geninfo-" + Date.now();

  // Test 1: Financial concept without bank (FOIR)
  console.log("--- TEST 1: Concept Question: 'What does FOIR mean?' ---");
  const res1 = await runCentralAgent({
    message: "What does FOIR mean?",
    conversationId: convId,
  });
  console.log("Response 1:\n", res1.reply);
  console.log("\n--------------------------------------------------------------------\n");

  // Verify no generic benchmarks (like "50% to 60%")
  const hasGenericBenchmark = /50%\s*to\s*60%|typically\s*50%/i.test(res1.reply);
  console.log("Assert no generic benchmark (50% to 60%):", !hasGenericBenchmark ? "PASSED ✅" : "FAILED ❌");

  // Test 2: Specific bank policy (HDFC Bank)
  console.log("\n--- TEST 2: Bank Policy: 'What is HDFC Bank CIBIL score cutoff and maximum tenure?' ---");
  const res2 = await runCentralAgent({
    message: "What is HDFC Bank CIBIL score cutoff and maximum tenure?",
    conversationId: convId,
  });
  console.log("Response 2:\n", res2.reply);
  console.log("\n--------------------------------------------------------------------\n");

  // Test 3: Specific bank policy (Kotak Mahindra Bank)
  console.log("\n--- TEST 3: Bank Policy: 'What is Kotak Bank FOIR limit and interest rate?' ---");
  const res3 = await runCentralAgent({
    message: "What is Kotak Bank FOIR limit and interest rate?",
    conversationId: convId,
  });
  console.log("Response 3:\n", res3.reply);
  console.log("\n--------------------------------------------------------------------\n");

  // Test 4: Specific bank policy (ICICI Bank)
  console.log("\n--- TEST 4: Bank Policy: 'What is ICICI Bank CIBIL cutoff and tenure?' ---");
  const res4 = await runCentralAgent({
    message: "What is ICICI Bank CIBIL cutoff and tenure?",
    conversationId: convId,
  });
  console.log("Response 4:\n", res4.reply);
  console.log("\n--------------------------------------------------------------------\n");

  // Test 5: Mid-flow interruption
  console.log("\n--- TEST 5: Mid-flow Interruption ---");
  const convFlowId = "conv-flow-" + Date.now();
  const flowStart = await runCentralAgent({
    message: "I want a personal loan of 5 lakhs. My salary is 65000.",
    conversationId: convFlowId,
  });
  console.log("Eligibility Flow started. Agent asked:\n", flowStart.reply.slice(0, 250));

  // User asks policy question instead of answering the missing field
  const flowInterruption = await runCentralAgent({
    message: "Before that, can you tell me what is the FOIR ratio formula?",
    conversationId: convFlowId,
  });
  console.log("\nUser interrupted with FOIR concept question. Agent replied:\n", flowInterruption.reply);

  const didAnswerConcept = /formula|fixed\s*obligation|income/i.test(flowInterruption.reply);
  const didNotForceNextField = !/please provide your|what is your/i.test(flowInterruption.reply);
  console.log("\nDid answer concept question directly:", didAnswerConcept ? "PASSED ✅" : "FAILED ❌");
  console.log("Did not force next eligibility question:", didNotForceNextField ? "PASSED ✅" : "FAILED ❌");
}

runE2eTests().catch(console.error);


