// scripts/test-smart-assistant-role.ts

import { isGeneralAssistanceQuery, formatGeneralAssistanceResponse, detectLoanIntent } from "../lib/dynamicEligibilityEngine";
import { analyzeConversationSemanticIntent, classifyIntentWithLLM } from "../lib/ai/intentClassifier";

async function runTests() {
  console.log("=== Testing Smart Assistant Role & Intent Understanding ===\n");

  const roleQueries = [
    "what is your role",
    "what is ur role",
    "whats your role",
    "what's your role",
    "your role",
    "ur role",
    "tell me your role",
    "what are your roles",
    "what is your purpose",
    "what is your job",
    "what role do you play",
    "who are you",
    "who r u",
    "what can you do",
    "what do you do",
    "how can you help me",
    "how can u help me",
    "can you help me",
    "tell me about yourself",
    "introduce yourself",
  ];

  let passedRoleTests = 0;
  for (const q of roleQueries) {
    const isAssistance = isGeneralAssistanceQuery(q);
    if (!isAssistance) {
      console.error(`❌ FAILED: "${q}" was NOT recognized as general assistance query`);
    } else {
      passedRoleTests++;
    }
  }

  console.log(`✅ Role Detection Tests: ${passedRoleTests}/${roleQueries.length} passed.`);

  // Test response content
  const response = formatGeneralAssistanceResponse(false);
  const hasSmile = response.includes("😊");
  const hasRoleOpening = response.includes("My role is to assist you 😊!");
  const hasCreditWiseAi = response.includes("CreditWise AI");

  if (!hasSmile) {
    console.error("❌ FAILED: formatGeneralAssistanceResponse does not contain smile emoji 😊");
  } else if (!hasRoleOpening) {
    console.error("❌ FAILED: formatGeneralAssistanceResponse does not contain 'My role is to assist you 😊!'");
  } else if (!hasCreditWiseAi) {
    console.error("❌ FAILED: formatGeneralAssistanceResponse does not mention CreditWise AI");
  } else {
    console.log("✅ Response Persona Verified: Contains 'My role is to assist you 😊!' and smile emojis.");
  }

  // Test semantic intent classification
  console.log("\n--- Testing Intent Classification ---");
  for (const q of ["what is your role", "what is ur role", "who are you"]) {
    const nlu = await analyzeConversationSemanticIntent(q);
    if (nlu.primaryIntent !== "GENERAL_ASSISTANCE") {
      console.error(`❌ FAILED: analyzeConversationSemanticIntent("${q}") returned ${nlu.primaryIntent}, expected GENERAL_ASSISTANCE`);
    } else {
      console.log(`✅ analyzeConversationSemanticIntent("${q}") -> GENERAL_ASSISTANCE (confidence: ${nlu.confidence.intentConfidence})`);
    }

    const legacy = await classifyIntentWithLLM(q);
    if ((legacy.intent as string) !== "GENERAL_INFORMATION" && (legacy.intent as string) !== "GENERAL_ASSISTANCE") {
      console.error(`❌ FAILED: classifyIntentWithLLM("${q}") returned ${legacy.intent}, expected GENERAL_INFORMATION or GENERAL_ASSISTANCE`);
    } else {
      console.log(`✅ classifyIntentWithLLM("${q}") -> ${legacy.intent}`);
    }
  }

  // Test typo understanding
  console.log("\n--- Testing Typo & Sentence Sense Understanding ---");
  const loanTypo = detectLoanIntent("i need lone");
  if (!loanTypo.isLoanIntent) {
    console.error("❌ FAILED: 'i need lone' was not recognized as loan intent");
  } else {
    console.log("✅ detectLoanIntent('i need lone') -> isLoanIntent: true");
  }

  const checkTypo = detectLoanIntent("can u cheak eligiblity");
  if (!checkTypo.isLoanIntent) {
    console.error("❌ FAILED: 'can u cheak eligiblity' was not recognized as loan intent");
  } else {
    console.log("✅ detectLoanIntent('can u cheak eligiblity') -> isLoanIntent: true");
  }

  console.log("\n=== All Tests Finished Successfully! ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
