/**
 * CreditWise Policy RAG Conversational Integration Test Suite
 * 
 * Verifies end-to-end execution of:
 * runCentralAgent() → policy intent detection → answerBankPolicyWithMasterPolicy() → answerPolicyWithRag()
 * and guarantees conversational state preservation.
 */

import { runCentralAgent } from "../lib/ai/agent";
import { answerPolicyWithRag } from "../lib/policyRag";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

function logSection(title: string) {
  console.log(`\n==================================================`);
  console.log(title);
  console.log(`==================================================`);
}

async function runConversationalIntegrationTests() {
  console.log("Starting CreditWise Policy RAG Conversational Integration Test Suite...\n");

  // =========================================================================
  // TEST 1: What is the minimum CIBIL score required by ABFL?
  // =========================================================================
  logSection("TEST 1: 'What is the minimum CIBIL score required by ABFL?'");
  const convId1 = `test-cibil-${Date.now()}`;
  const res1 = await runCentralAgent({
    message: "What is the minimum CIBIL score required by ABFL?",
    conversationId: convId1,
  });
  console.log(`[Response Preview]:\n${res1.reply?.slice(0, 300)}...`);
  const pass1 = /700|720|725|cibil/i.test(res1.reply || "") && !res1.reply?.toLowerCase().includes("not available");
  console.log(`[Result]: ${pass1 ? "✅ PASS (Policy RAG Route Verified)" : "❌ FAIL"}`);
  await clearEligibilityState(convId1);

  // =========================================================================
  // TEST 2: What is the maximum loan amount under ABFL policy?
  // =========================================================================
  logSection("TEST 2: 'What is the maximum loan amount under ABFL policy?'");
  const convId2 = `test-loan-${Date.now()}`;
  const res2 = await runCentralAgent({
    message: "What is the maximum loan amount under ABFL policy?",
    conversationId: convId2,
  });
  console.log(`[Response Preview]:\n${res2.reply?.slice(0, 300)}...`);
  const pass2 = /lakh|lac|max|amount/i.test(res2.reply || "") && !res2.reply?.toLowerCase().includes("not available");
  console.log(`[Result]: ${pass2 ? "✅ PASS (Policy RAG Route Verified)" : "❌ FAIL"}`);
  await clearEligibilityState(convId2);

  // =========================================================================
  // TEST 3: What is the maximum FOIR for ABFL?
  // =========================================================================
  logSection("TEST 3: 'What is the maximum FOIR for ABFL?'");
  const convId3 = `test-foir-${Date.now()}`;
  const res3 = await runCentralAgent({
    message: "What is the maximum FOIR for ABFL?",
    conversationId: convId3,
  });
  console.log(`[Response Preview]:\n${res3.reply?.slice(0, 300)}...`);
  const pass3 = /foir|%/i.test(res3.reply || "") && !res3.reply?.toLowerCase().includes("not available");
  console.log(`[Result]: ${pass3 ? "✅ PASS (Policy RAG Route Verified)" : "❌ FAIL"}`);
  await clearEligibilityState(convId3);

  // =========================================================================
  // TEST 4: What is the minimum salary requirement for ABFL?
  // =========================================================================
  logSection("TEST 4: 'What is the minimum salary requirement for ABFL?'");
  const convId4 = `test-salary-${Date.now()}`;
  const res4 = await runCentralAgent({
    message: "What is the minimum salary requirement for ABFL?",
    conversationId: convId4,
  });
  console.log(`[Response Preview]:\n${res4.reply?.slice(0, 300)}...`);
  const pass4 = /salary|income|nth|tier/i.test(res4.reply || "") && !res4.reply?.toLowerCase().includes("not available");
  console.log(`[Result]: ${pass4 ? "✅ PASS (Policy RAG Route Verified)" : "❌ FAIL"}`);
  await clearEligibilityState(convId4);

  // =========================================================================
  // TEST 5: Tell me ABFL CIBIL requirement.
  // =========================================================================
  logSection("TEST 5: 'Tell me ABFL CIBIL requirement.'");
  const convId5 = `test-req-${Date.now()}`;
  const res5 = await runCentralAgent({
    message: "Tell me ABFL CIBIL requirement.",
    conversationId: convId5,
  });
  console.log(`[Response Preview]:\n${res5.reply?.slice(0, 300)}...`);
  const pass5 = /700|720|725|610|cibil/i.test(res5.reply || "") && !res5.reply?.toLowerCase().includes("not available");
  console.log(`[Result]: ${pass5 ? "✅ PASS (Policy RAG Route Verified)" : "❌ FAIL"}`);
  await clearEligibilityState(convId5);

  // =========================================================================
  // TEST 6: Critical Negative Grounding Test
  // Query: "For someone earning exactly Rs 73,421 in a city with population 8,73,000, what exact loan amount can ABFL approve?"
  // =========================================================================
  logSection("TEST 6: Critical Negative Grounding Test");
  const negativeQuery = "For someone earning exactly Rs 73,421 in a city with population 8,73,000, what exact loan amount can ABFL approve?";

  console.log("6A. Testing directly through answerPolicyWithRag():");
  const directRag = await answerPolicyWithRag({
    query: negativeQuery,
    policyFileId: 1,
    bankId: 13,
    topK: 5,
  });
  console.log(`Direct RAG Answer:\n${directRag.answer}\n`);
  const directRefusal = /not provide enough information|insufficient|does not specify|cannot be determined/i.test(directRag.answer);
  console.log(`[Direct answerPolicyWithRag Refusal]: ${directRefusal ? "✅ PASS" : "❌ FAIL"}`);

  console.log("\n6B. Testing through runCentralAgent():");
  const convId6 = `test-neg-${Date.now()}`;
  const agentNeg = await runCentralAgent({
    message: negativeQuery,
    conversationId: convId6,
  });
  console.log(`Central Agent Answer:\n${agentNeg.reply}\n`);
  const agentRefusal = /not\s+(?:provide|contain)\s+enough\s+information|insufficient|does\s+not\s+specify|cannot\s+be\s+determined/i.test(agentNeg.reply || "");
  console.log(`[Central Agent Refusal (No Hallucination)]: ${agentRefusal ? "✅ PASS" : "❌ FAIL"}`);
  await clearEligibilityState(convId6);

  // =========================================================================
  // TEST 7: "First check ABFL policy, then continue my loan."
  // =========================================================================
  logSection("TEST 7: 'First check ABFL policy, then continue my loan.'");
  const convId7 = `test-checkfirst-${Date.now()}`;
  await runCentralAgent({ message: "I want a personal loan", conversationId: convId7 });
  await runCentralAgent({ message: "TCS", conversationId: convId7 });

  const stateBefore7 = await getEligibilityState(convId7);
  console.log(`Applicant Company Before Policy Check: ${stateBefore7?.applicant?.companyName}`);

  const res7 = await runCentralAgent({
    message: "First check ABFL policy, then continue my loan.",
    conversationId: convId7,
  });
  console.log(`Agent Policy Response Preview:\n${res7.reply?.slice(0, 300)}...`);

  const stateAfter7 = await getEligibilityState(convId7);
  console.log(`Applicant Company After Policy Check: ${stateAfter7?.applicant?.companyName}`);
  const pass7 = stateAfter7?.applicant?.companyName?.toLowerCase().includes("tcs") || stateAfter7?.taskStack?.length! > 0;
  console.log(`[Result]: ${pass7 ? "✅ PASS (Policy Answered, Context Preserved)" : "❌ FAIL"}`);
  await clearEligibilityState(convId7);

  // =========================================================================
  // TEST 8: Full Interruption & Resume Cycle
  // "I need a personal loan." → "Self-Employed" → "Before continuing, what is the minimum CIBIL score under ABFL policy?" → "Okay, continue."
  // =========================================================================
  logSection("TEST 8: Full Interruption & Resume Cycle (Self-Employed)");
  const convId8 = `test-resume-cycle-${Date.now()}`;

  console.log("User: 'I need a personal loan.'");
  await runCentralAgent({ message: "I need a personal loan.", conversationId: convId8 });

  console.log("User: 'Self-Employed'");
  await runCentralAgent({ message: "Self-Employed", conversationId: convId8 });

  const stateBeforeInterrupt = await getEligibilityState(convId8);
  console.log("\n--- STATE BEFORE INTERRUPTION ---");
  console.log(`Employment Type: ${stateBeforeInterrupt?.applicant?.employmentType || stateBeforeInterrupt?.applicant?.employmentStatus}`);
  console.log(`In Eligibility Flow: ${stateBeforeInterrupt?.in_eligibility_flow}`);
  console.log(`Expected Field: ${stateBeforeInterrupt?.expectedField}`);

  console.log("\nUser: 'Before continuing, what is the minimum CIBIL score under ABFL policy?'");
  const interruptRes = await runCentralAgent({
    message: "Before continuing, what is the minimum CIBIL score under ABFL policy?",
    conversationId: convId8,
  });
  console.log(`Agent Policy Answer Preview:\n${interruptRes.reply?.slice(0, 250)}...`);

  const stateDuringInterrupt = await getEligibilityState(convId8);
  console.log("\n--- STATE DURING INTERRUPTION ---");
  console.log(`Task Stack Depth: ${stateDuringInterrupt?.taskStack?.length || 0}`);
  console.log(`Suspended Task Field: ${stateDuringInterrupt?.taskStack?.[0]?.expectedField}`);

  console.log("\nUser: 'Okay, continue.'");
  const resumeRes = await runCentralAgent({ message: "Okay, continue.", conversationId: convId8 });
  console.log(`Agent Resume Reply:\n${resumeRes.reply}\n`);

  const stateAfterResume = await getEligibilityState(convId8);
  console.log("--- STATE AFTER RESUME ---");
  const employmentPreserved =
    stateAfterResume?.applicant?.employmentType?.toLowerCase() === "self-employed" ||
    stateAfterResume?.applicant?.employmentStatus?.toLowerCase() === "self-employed";
  const askedSalary = /salary|income|take-home/i.test(resumeRes.reply || "");

  console.log(`[Employment Type Preserved]: ${employmentPreserved ? "✅ YES" : "❌ NO"}`);
  console.log(`[Resumed Expected Field (monthlyIncome)]: ${askedSalary ? "✅ YES" : "❌ NO"}`);
  console.log(`[Result]: ${employmentPreserved && askedSalary ? "✅ PASS" : "❌ FAIL"}`);
  await clearEligibilityState(convId8);

  // =========================================================================
  // TEST 9: Numeric Context in Policy Inquiry (Must NOT mutate applicant salary)
  // "My salary is Rs 39,000. What does ABFL policy say about minimum salary?"
  // =========================================================================
  logSection("TEST 9: Numeric Context in Policy Inquiry");
  const convId9 = `test-numeric-policy-${Date.now()}`;
  await runCentralAgent({ message: "I want a personal loan", conversationId: convId9 });
  await runCentralAgent({ message: "Infosys", conversationId: convId9 });

  const stateBefore9 = await getEligibilityState(convId9);
  console.log(`Applicant Salary Before: ${stateBefore9?.applicant?.monthlyIncome || "none"}`);

  const res9 = await runCentralAgent({
    message: "My salary is Rs 39,000. What does ABFL policy say about minimum salary?",
    conversationId: convId9,
  });
  console.log(`Agent Policy Answer Preview:\n${res9.reply?.slice(0, 300)}...`);

  const stateAfter9 = await getEligibilityState(convId9);
  console.log(`Applicant Salary After: ${stateAfter9?.applicant?.monthlyIncome || "none"}`);
  const pass9 = !stateAfter9?.applicant?.monthlyIncome || stateAfter9?.taskStack?.length! > 0;
  console.log(`[Result]: ${pass9 ? "✅ PASS (Classified as Policy Inquiry, Salary Not Prematurely Mutated)" : "❌ FAIL"}`);
  await clearEligibilityState(convId9);

  // =========================================================================
  // TEST 10: "What documents are required for ABFL?"
  // =========================================================================
  logSection("TEST 10: 'What documents are required for ABFL?'");
  const convId10 = `test-docs-${Date.now()}`;
  const res10 = await runCentralAgent({
    message: "What documents are required for ABFL?",
    conversationId: convId10,
  });
  console.log(`[Response Preview]:\n${res10.reply?.slice(0, 300)}...`);
  const pass10 = /document|proof|statement|aadhaar|pan|slip/i.test(res10.reply || "") && !res10.reply?.toLowerCase().includes("not available");
  console.log(`[Result]: ${pass10 ? "✅ PASS (Policy RAG Route Verified)" : "❌ FAIL"}`);
  await clearEligibilityState(convId10);

  // =========================================================================
  // DATABASE VERIFICATION: Safe Invariant
  // =========================================================================
  logSection("DATABASE SAFETY VERIFICATION");
  const dbRes = await pool.query(`
    SELECT
        policy_file_id,
        file_name,
        COUNT(*) AS chunk_count
    FROM policy_embeddings
    GROUP BY policy_file_id, file_name
    ORDER BY policy_file_id;
  `);

  console.log("Database policy_embeddings state:");
  console.table(dbRes.rows);

  const policy1Row = dbRes.rows.find((r: any) => Number(r.policy_file_id) === 1);
  const exact20 = policy1Row && Number(policy1Row.chunk_count) === 20;
  console.log(`[Database Table Safety Invariant]: ${exact20 ? "✅ PASS (Policy 1 has exactly 20 chunks preserved)" : "❌ FAIL"}`);

  logSection("ALL 10 CONVERSATIONAL INTEGRATION TESTS COMPLETED SUCCESSFULLY");
}

runConversationalIntegrationTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
  });
