import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent, OPENROUTER_TOOLS } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";
import { searchTavilyWeb } from "../lib/ai/tavilyService";

async function runToolArchitectureVerification() {
  console.log("================================================================================");
  console.log("🛠️ VERIFYING OPENROUTER DECISION-MAKER BRAIN & 8 ACTION TOOLS ARCHITECTURE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Verify Tool Schemas Defined
  console.log("--- 1. Testing OpenRouter Tool Schemas ---");
  const toolNames = OPENROUTER_TOOLS.map((t: any) => t.function.name);
  assert(toolNames.includes("calculate_emi"), "Tool schema defined: calculate_emi");
  assert(toolNames.includes("lookup_master_policy"), "Tool schema defined: lookup_master_policy");
  assert(toolNames.includes("search_company_category"), "Tool schema defined: search_company_category");
  assert(toolNames.includes("check_loan_eligibility"), "Tool schema defined: check_loan_eligibility");
  assert(toolNames.includes("update_applicant_profile"), "Tool schema defined: update_applicant_profile");
  assert(toolNames.includes("answer_general_question"), "Tool schema defined: answer_general_question");
  assert(toolNames.includes("tavily_search"), "Tool schema defined: tavily_search");
  assert(toolNames.includes("search_bank_managers"), "Tool schema defined: search_bank_managers");

  const convId = "test-tools-" + Date.now();
  await clearEligibilityState(convId);

  // 2. Test calculate_emi
  console.log("\n--- 2. Testing calculate_emi Tool Action ---");
  const emiRes = await runCentralAgent({
    message: "Calculate my EMI for 10 lakhs loan at 11% interest for 5 years",
    conversationId: convId,
  });
  assert(emiRes.reply.includes("Loan EMI Calculation") || emiRes.reply.includes("Estimated Monthly EMI"), "Calculates EMI");
  assert(emiRes.reply.includes("₹10,00,000"), "Includes formatted principal amount");

  // 3. Test lookup_master_policy
  console.log("\n--- 3. Testing lookup_master_policy Tool Action ---");
  const policyRes = await runCentralAgent({
    message: "What is HDFC Bank's maximum loan amount policy for Super A category?",
    conversationId: convId,
  });
  assert(policyRes.reply.toLowerCase().includes("hdfc"), "Identifies HDFC policy");
  assert(!policyRes.reply.includes("NOT_DEFINED"), "Scrubs NOT_DEFINED");
  assert(!policyRes.reply.includes("NEEDS_REVIEW"), "Scrubs NEEDS_REVIEW");

  // 4. Test search_company_category
  console.log("\n--- 4. Testing search_company_category Tool Action ---");
  const compRes = await runCentralAgent({
    message: "What is the corporate category rating for Tata Consultancy Services?",
    conversationId: convId,
  });
  assert(
    compRes.reply.toLowerCase().includes("tata consultancy") ||
    compRes.reply.toLowerCase().includes("super cat a") ||
    compRes.reply.toLowerCase().includes("cat a") ||
    compRes.reply.toLowerCase().includes("tier"),
    "Returns corporate category rating"
  );

  // 5. Test search_bank_managers
  console.log("\n--- 5. Testing search_bank_managers Tool Action ---");
  const mgrRes = await runCentralAgent({
    message: "Find HDFC Bank manager contact details in Pune",
    conversationId: convId,
  });
  assert(typeof mgrRes.reply === "string" && mgrRes.reply.length > 0, "Handles manager inquiry");

  // 6. Test answer_general_question (Concept & Reset)
  console.log("\n--- 6. Testing answer_general_question Tool Action ---");
  const genRes = await runCentralAgent({
    message: "What is reducing balance interest rate?",
    conversationId: convId,
  });
  assert(
    genRes.reply.toLowerCase().includes("reducing") || genRes.reply.toLowerCase().includes("principal"),
    "Defines financial concept clearly"
  );

  // 7. Test tavily_search service
  console.log("\n--- 7. Testing tavily_search Tool Action ---");
  const tavilyOutput = await searchTavilyWeb("RBI repo rate latest announcement 2024");
  assert(typeof tavilyOutput === "string" && tavilyOutput.length > 0, "Tavily search service executes gracefully");

  // 8. Test Non-Interference: Active Eligibility NEVER Blocks Side Request
  console.log("\n--- 8. Testing Active Eligibility Flow Non-Interference ---");
  const flowConvId = "test-flow-" + Date.now();
  await clearEligibilityState(flowConvId);

  // Step 1: Start loan assessment
  await runCentralAgent({
    message: "I work at Infosys and want a personal loan",
    conversationId: flowConvId,
  });
  let flowState = await getEligibilityState(flowConvId);
  assert(Boolean(flowState?.applicant?.companyName?.includes("Infosys")), "Loan flow started for Infosys");

  // Step 2: Mid-flow side question (EMI calculation)
  const sideEmi = await runCentralAgent({
    message: "Wait, calculate EMI for 4 lakhs at 12% for 2 years first",
    conversationId: flowConvId,
  });
  assert(sideEmi.reply.includes("Estimated Monthly EMI") || sideEmi.reply.includes("Loan EMI Calculation"), "Side EMI answered without blocking");
  assert(sideEmi.reply.includes("continue") || sideEmi.reply.includes("Infosys"), "Continuation hint appended");
  flowState = await getEligibilityState(flowConvId);
  assert(Boolean(flowState?.applicant?.companyName?.includes("Infosys")), "Infosys applicant preserved during side EMI");

  // Step 3: Mid-flow side question (Bank Policy Lookup)
  const sidePolicy = await runCentralAgent({
    message: "What is ICICI Bank's minimum CIBIL cutoff?",
    conversationId: flowConvId,
  });
  assert(sidePolicy.reply.toLowerCase().includes("icici"), "Side policy query answered directly");
  assert(sidePolicy.reply.includes("continue") || sidePolicy.reply.includes("Infosys"), "Continuation hint appended");
  flowState = await getEligibilityState(flowConvId);
  assert(Boolean(flowState?.applicant?.companyName?.includes("Infosys")), "Infosys applicant preserved during side policy QA");

  // Step 4: Flow Resumption via Acknowledgment
  const resumeRes = await runCentralAgent({
    message: "Got it, let's proceed!",
    conversationId: flowConvId,
  });
  assert(
    resumeRes.reply.toLowerCase().includes("salary") || resumeRes.reply.toLowerCase().includes("income"),
    "Resumes next missing field (salary) after acknowledgment"
  );

  // Step 5: Reset
  const resetRes = await runCentralAgent({
    message: "Cancel my loan request",
    conversationId: flowConvId,
  });
  flowState = await getEligibilityState(flowConvId);
  assert(!flowState || !flowState.expectedField, "Session reset successfully");
  assert(resetRes.reply.includes("Reset"), "Reset confirmation provided");

  console.log("\n================================================================================");
  console.log(`TOOL ARCHITECTURE SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runToolArchitectureVerification().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
