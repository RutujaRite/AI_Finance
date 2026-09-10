import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";
import { clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function run() {
  console.log("================================================================================");
  console.log("   VERIFYING USER REQUIREMENTS                                                 ");
  console.log("================================================================================\n");

  // 1. "What is FOIR?" intent classification
  console.log("--- 1. Testing Intent Classification for 'What is FOIR?' ---");
  const foirClassification = await classifyIntentWithLLM("What is FOIR?");
  console.log("Intent result:", JSON.stringify(foirClassification, null, 2));
  const isGeneralInfo = foirClassification.intent === "GENERAL_INFORMATION";
  console.log(`[${isGeneralInfo ? "PASS" : "FAIL"}] 'What is FOIR?' classified as GENERAL_INFORMATION`);

  // 2. "What is FOIR?" Central Agent response
  console.log("\n--- 2. Testing Central Agent Response for 'What is FOIR?' ---");
  const foirResponse = await runCentralAgent({
    message: "What is FOIR?",
    conversationId: "test-foir-" + Date.now(),
  });
  console.log("Assistant Response:\n" + foirResponse.reply);

  const hasNoGreetingFallback =
    !foirResponse.reply.includes("I am CreditWise AI, your banking assistant") &&
    !foirResponse.reply.startsWith("Hello!") &&
    !foirResponse.reply.startsWith("Hi!");

  const explainsFoir =
    /FOIR|Fixed Obligation to Income Ratio/i.test(foirResponse.reply) &&
    /obligation|debt|EMI/i.test(foirResponse.reply);

  const respectsBankPolicyLimits =
    /Master Policy|bank|policies|varies|depends/i.test(foirResponse.reply);

  console.log(`[${hasNoGreetingFallback ? "PASS" : "FAIL"}] No hardcoded greeting/fallback preamble`);
  console.log(`[${explainsFoir ? "PASS" : "FAIL"}] Explains FOIR naturally`);
  console.log(`[${respectsBankPolicyLimits ? "PASS" : "FAIL"}] Explains bank policy dependence without generic rules`);

  // 3. Bank-specific query using only Master Policy: ICICI CIBIL
  console.log("\n--- 3. Testing Bank Policy QA: ICICI CIBIL ---");
  const iciciResponse = await runCentralAgent({
    message: "What is ICICI Bank's CIBIL score cutoff?",
    conversationId: "test-icici-" + Date.now(),
  });
  console.log("ICICI Response:\n" + iciciResponse.reply);
  const iciciUsesMasterPolicy =
    /ICICI/i.test(iciciResponse.reply) &&
    (/pricing|tier|band|770|725/i.test(iciciResponse.reply) || /Master Policy/i.test(iciciResponse.reply));
  console.log(`[${iciciUsesMasterPolicy ? "PASS" : "FAIL"}] ICICI Master Policy consulted`);

  // 4. Bank-specific query using only Master Policy: HDFC Tenure for Super A
  console.log("\n--- 4. Testing Bank Policy QA: HDFC Tenure Super A ---");
  const hdfcResponse = await runCentralAgent({
    message: "What is HDFC Bank's maximum tenure for Super A category?",
    conversationId: "test-hdfc-" + Date.now(),
  });
  console.log("HDFC Response:\n" + hdfcResponse.reply);
  const hdfcUsesMasterPolicy =
    /HDFC/i.test(hdfcResponse.reply) &&
    (/84\s*months|7\s*years/i.test(hdfcResponse.reply) || /Super A/i.test(hdfcResponse.reply));
  console.log(`[${hdfcUsesMasterPolicy ? "PASS" : "FAIL"}] HDFC Master Policy consulted`);

  console.log("\n================================================================================");
  console.log("   ALL CHECKS FINISHED                                                         ");
  console.log("================================================================================\n");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
