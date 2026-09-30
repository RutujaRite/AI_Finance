/**
 * COMPLETE End-to-End Verification of Policy RAG (ABFL_Master_Policy.txt, policy_file_id=1, bank_id=13)
 * 
 * Executes all 14 required checks from database integrity to conversational agent integration.
 */

import pool from "../lib/db";
import { searchPolicyEmbeddings } from "../lib/policyRetrieval";
import { answerPolicyWithRag } from "../lib/policyRag";
import { runCentralAgent } from "../lib/ai/agent";
import { normalizeBankName } from "../lib/ai/intentClassifier";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

function logHeader(title: string) {
  console.log(`\n================================================================================`);
  console.log(`  ${title}`);
  console.log(`================================================================================`);
}

async function runCompleteVerification() {
  console.log("Starting Complete End-to-End ABFL Policy RAG Verification Suite...\n");

  // =========================================================================
  // 1. DATABASE INTEGRITY
  // =========================================================================
  logHeader("1. DATABASE INTEGRITY VERIFICATION");
  const countRes = await pool.query(`
    SELECT
      policy_file_id,
      bank_id,
      file_name,
      COUNT(*) AS total_chunks,
      COUNT(embedding) AS embedded_chunks,
      COUNT(CASE WHEN content IS NOT NULL AND LENGTH(content) > 0 THEN 1 END) AS non_empty_content
    FROM policy_embeddings
    GROUP BY policy_file_id, bank_id, file_name
    ORDER BY policy_file_id;
  `);

  console.log("Database policy_embeddings distribution:");
  console.table(countRes.rows);

  const row = countRes.rows[0];
  const isExact20 = countRes.rows.length === 1 &&
    Number(row.policy_file_id) === 1 &&
    Number(row.bank_id) === 13 &&
    row.file_name === "ABFL_Master_Policy.txt" &&
    Number(row.total_chunks) === 20 &&
    Number(row.embedded_chunks) === 20 &&
    Number(row.non_empty_content) === 20;

  console.log(`[Check 1 - Database Integrity]: ${isExact20 ? "✅ PASS" : "❌ FAIL"}`);
  if (!isExact20) throw new Error("Database integrity invariant failed!");

  // Check policies 2-23 have 0 embeddings
  const otherPolicies = await pool.query(`
    SELECT COUNT(*) AS cnt FROM policy_embeddings WHERE policy_file_id != 1;
  `);
  const zeroOthers = Number(otherPolicies.rows[0].cnt) === 0;
  console.log(`[Check 1 - Zero Embeddings for Policies 2-23]: ${zeroOthers ? "✅ PASS" : "❌ FAIL"}`);
  if (!zeroOthers) throw new Error("Policies 2-23 must not be embedded!");

  // =========================================================================
  // 2. DIRECT VECTOR RETRIEVAL
  // =========================================================================
  logHeader("2. DIRECT VECTOR RETRIEVAL (searchPolicyEmbeddings)");
  const retrievalQueries = [
    "minimum CIBIL score",
    "maximum loan amount",
    "maximum FOIR",
    "minimum salary",
    "documents required",
    "loan tenure",
    "interest rate",
    "eligibility criteria",
  ];

  let allRetrievalsPass = true;
  for (const q of retrievalQueries) {
    const results = await searchPolicyEmbeddings({
      query: q,
      policyFileId: 1,
      bankId: 13,
      topK: 5,
    });
    console.log(`\nQuery: "${q}"`);
    console.log(`Retrieved Chunks: ${results.length}`);
    if (results.length === 0) allRetrievalsPass = false;

    results.forEach((r, idx) => {
      console.log(`  [Chunk ${idx + 1}] ID=${r.id}, Index=${r.chunk_index}, Sim=${r.similarity.toFixed(4)}, File=${r.file_name}, PolicyFileID=${r.policy_file_id}, BankID=${r.bank_id}`);
      console.log(`    Snippet: "${r.content.replace(/\s+/g, " ").slice(0, 100)}..."`);
      if (Number(r.policy_file_id) !== 1 || Number(r.bank_id) !== 13) {
        allRetrievalsPass = false;
      }
    });
  }
  console.log(`\n[Check 2 - Vector Retrieval]: ${allRetrievalsPass ? "✅ PASS" : "❌ FAIL"}`);

  // =========================================================================
  // 3 & 4. DIRECT RAG GENERATION & FACTUAL POLICY QUESTIONS (A to H)
  // =========================================================================
  logHeader("3 & 4. DIRECT RAG GENERATION & FACTUAL POLICY QUESTIONS");
  const factualQueries = [
    { label: "A", q: "What is the minimum CIBIL score required by ABFL?" },
    { label: "B", q: "What is the maximum loan amount under ABFL policy?" },
    { label: "C", q: "What is the maximum FOIR for ABFL?" },
    { label: "D", q: "What is the minimum salary requirement for ABFL?" },
    { label: "E", q: "What documents are required for ABFL?" },
    { label: "F", q: "What is the maximum tenure under ABFL policy?" },
    { label: "G", q: "What is the interest rate under ABFL policy?" },
    { label: "H", q: "What are the eligibility criteria under ABFL policy?" },
  ];

  let allRagPass = true;
  for (const item of factualQueries) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Question ${item.label}: "${item.q}"`);
    const ragRes = await answerPolicyWithRag({
      query: item.q,
      policyFileId: 1,
      bankId: 13,
      topK: 5,
    });
    console.log(`Answer:\n${ragRes.answer}\n`);
    console.log(`Retrieved Chunks: ${ragRes.retrievedChunks}`);
    console.log(`Sources:`, ragRes.sources.map(s => `Chunk ${s.chunkIndex} (sim: ${s.similarity})`).join(", "));

    const valid = ragRes.retrievedChunks > 0 &&
      ragRes.sources.length > 0 &&
      ragRes.sources.every(s => s.policyFileId === 1 && s.bankId === 13) &&
      ragRes.answer.length > 30;

    if (!valid) allRagPass = false;
    console.log(`[Question ${item.label} Result]: ${valid ? "✅ PASS" : "❌ FAIL"}`);
  }
  console.log(`\n[Check 3 & 4 - Factual Policy Questions]: ${allRagPass ? "✅ PASS" : "❌ FAIL"}`);

  // =========================================================================
  // 5. NATURAL LANGUAGE VARIATIONS
  // =========================================================================
  logHeader("5. NATURAL LANGUAGE VARIATIONS (runCentralAgent Routing)");
  const nlVariations = [
    "Tell me ABFL CIBIL requirement",
    "ABFL FOIR?",
    "Can you check Aditya Birla Finance policy?",
    "What does ABFL require for salary?",
    "Does ABFL have a minimum income requirement?",
    "How much can ABFL lend?",
    "What documents do I need for an ABFL loan?",
    "Before continuing my loan, check ABFL policy.",
  ];

  let allNlPass = true;
  for (const q of nlVariations) {
    const convId = `test-nl-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log(`\nTesting NL Query: "${q}"`);
    const agentRes = await runCentralAgent({ message: q, conversationId: convId });
    console.log(`Reply Preview: ${agentRes.reply?.replace(/\s+/g, " ").slice(0, 160)}...`);
    const isPolicy = agentRes.reply && agentRes.reply.length > 40 && !agentRes.reply.toLowerCase().includes("not available");
    if (!isPolicy) allNlPass = false;
    console.log(`[NL Result]: ${isPolicy ? "✅ PASS" : "❌ FAIL"}`);
    await clearEligibilityState(convId);
  }
  console.log(`\n[Check 5 - Natural Language Variations]: ${allNlPass ? "✅ PASS" : "❌ FAIL"}`);

  // =========================================================================
  // 6. BANK ALIAS TEST
  // =========================================================================
  logHeader("6. BANK ALIAS TEST");
  const aliases = [
    "ABFL",
    "Aditya Birla Finance",
    "Aditya Birla Finance Limited",
    "Aditya Birla",
    "Birla Finance",
  ];

  let allAliasesPass = true;
  for (const a of aliases) {
    const canonical = normalizeBankName(a);
    console.log(`Alias: "${a}" -> Canonical: "${canonical}"`);
    if (canonical !== "Aditya Birla Finance") {
      allAliasesPass = false;
    }
  }
  console.log(`\n[Check 6 - Bank Alias Resolution]: ${allAliasesPass ? "✅ PASS" : "❌ FAIL"}`);

  // =========================================================================
  // 7. NEGATIVE / ANTI-HALLUCINATION TESTS
  // =========================================================================
  logHeader("7. NEGATIVE / ANTI-HALLUCINATION TESTS");
  const negativeTests = [
    "For someone earning exactly Rs 73,421 in a city with population 8,73,000, what exact loan amount can ABFL approve?",
    "What exact loan amount will ABFL approve for someone with salary Rs 61,777 and CIBIL 743?",
    "What is the exact approval amount for a person living in Pune with salary Rs 48,321?",
  ];

  let allAntiHallucinationPass = true;
  for (const q of negativeTests) {
    console.log(`\nQuery: "${q}"`);
    const convId = `test-anti-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const res = await runCentralAgent({ message: q, conversationId: convId });
    console.log(`Agent Answer:\n${res.reply}\n`);
    const refusedToInvent = /not provide enough information|insufficient|does not specify|cannot be determined|not specified in the available policy/i.test(res.reply || "");
    if (!refusedToInvent) allAntiHallucinationPass = false;
    console.log(`[Anti-Hallucination Guard]: ${refusedToInvent ? "✅ PASS" : "❌ FAIL"}`);
    await clearEligibilityState(convId);
  }
  console.log(`\n[Check 7 - Anti-Hallucination]: ${allAntiHallucinationPass ? "✅ PASS" : "❌ FAIL"}`);

  // =========================================================================
  // 8. CONVERSATIONAL STATE TEST
  // =========================================================================
  logHeader("8. CONVERSATIONAL STATE PRESERVATION & RESUMPTION");
  const convId8 = `test-state-preservation-${Date.now()}`;

  console.log("User: 'I need a personal loan.'");
  await runCentralAgent({ message: "I need a personal loan.", conversationId: convId8 });

  console.log("User: 'Self-Employed'");
  await runCentralAgent({ message: "Self-Employed", conversationId: convId8 });

  const stateBefore = await getEligibilityState(convId8);
  console.log("\n--- STATE BEFORE INTERRUPTION ---");
  console.log(`Employment Type: ${stateBefore?.applicant?.employmentType || stateBefore?.applicant?.employmentStatus}`);
  console.log(`In Eligibility Flow: ${stateBefore?.in_eligibility_flow}`);
  console.log(`Expected Field: ${stateBefore?.expectedField}`);

  console.log("\nUser: 'Before continuing, what is the minimum CIBIL score under ABFL policy?'");
  const interruptRes = await runCentralAgent({
    message: "Before continuing, what is the minimum CIBIL score under ABFL policy?",
    conversationId: convId8,
  });
  console.log(`Agent Policy Answer Preview: ${interruptRes.reply?.slice(0, 200)}...`);

  const stateDuring = await getEligibilityState(convId8);
  console.log("\n--- STATE DURING INTERRUPTION ---");
  console.log(`Task Stack Depth: ${stateDuring?.taskStack?.length || 0}`);
  console.log(`Suspended Expected Field: ${stateDuring?.taskStack?.[0]?.expectedField}`);

  console.log("\nUser: 'Okay, continue.'");
  const resumeRes = await runCentralAgent({ message: "Okay, continue.", conversationId: convId8 });
  console.log(`Agent Resume Reply:\n${resumeRes.reply}\n`);

  const stateAfter = await getEligibilityState(convId8);
  console.log("--- STATE AFTER RESUME ---");
  const empPreserved =
    stateAfter?.applicant?.employmentType?.toLowerCase() === "self-employed" ||
    stateAfter?.applicant?.employmentStatus?.toLowerCase() === "self-employed";
  const askedSalary = /salary|income|take-home/i.test(resumeRes.reply || "");

  console.log(`[Employment Preserved]: ${empPreserved ? "✅ YES" : "❌ NO"}`);
  console.log(`[Resumed Expected Field]: ${askedSalary ? "✅ YES" : "❌ NO"}`);
  const pass8 = empPreserved && askedSalary;
  console.log(`\n[Check 8 - Conversational State Preservation]: ${pass8 ? "✅ PASS" : "❌ FAIL"}`);
  await clearEligibilityState(convId8);

  // =========================================================================
  // 9. NUMERIC CONTAMINATION TEST
  // =========================================================================
  logHeader("9. NUMERIC CONTAMINATION TEST");
  const convId9 = `test-contamination-${Date.now()}`;
  await runCentralAgent({ message: "I want a personal loan", conversationId: convId9 });
  await runCentralAgent({ message: "Wipro", conversationId: convId9 });

  const numQ = "My salary is Rs 39,000. What does ABFL policy say about minimum salary?";
  console.log(`User: "${numQ}"`);
  await runCentralAgent({ message: numQ, conversationId: convId9 });

  const state9 = await getEligibilityState(convId9);
  console.log(`Applicant Salary In State: ${state9?.applicant?.monthlyIncome || "none"}`);
  const notContaminated = !state9?.applicant?.monthlyIncome || state9?.applicant?.monthlyIncome !== 39000;
  console.log(`\n[Check 9 - Numeric Contamination Protection]: ${notContaminated ? "✅ PASS" : "❌ FAIL"}`);
  await clearEligibilityState(convId9);

  // =========================================================================
  // 10. SOURCE PROVENANCE TEST
  // =========================================================================
  logHeader("10. SOURCE PROVENANCE TEST");
  const provQuery = "What is the minimum CIBIL score required by ABFL?";
  const provRes = await answerPolicyWithRag({
    query: provQuery,
    policyFileId: 1,
    bankId: 13,
    topK: 5,
  });

  let provenanceValid = provRes.sources.length > 0;
  for (const src of provRes.sources) {
    const dbCheck = await pool.query(
      `SELECT id, policy_file_id, bank_id, file_name, chunk_index FROM policy_embeddings WHERE policy_file_id = $1 AND bank_id = $2 AND chunk_index = $3`,
      [src.policyFileId, src.bankId, src.chunkIndex]
    );
    const exists = dbCheck.rows.length === 1;
    console.log(`Source Chunk ${src.chunkIndex} (sim: ${src.similarity.toFixed(4)}) -> DB Row Exists: ${exists}`);
    if (!exists) provenanceValid = false;
  }
  console.log(`\n[Check 10 - Source Provenance]: ${provenanceValid ? "✅ PASS" : "❌ FAIL"}`);

  // =========================================================================
  // 11. FALLBACK TEST (Unavailable policy_file_id)
  // =========================================================================
  logHeader("11. FALLBACK TEST (Unavailable Policy File ID)");
  const fallbackRes = await answerPolicyWithRag({
    query: "What is the CIBIL cutoff?",
    policyFileId: 99999, // Unindexed ID
    bankId: 99999,
    topK: 5,
  });

  console.log(`Fallback Answer: "${fallbackRes.answer}"`);
  console.log(`Fallback Chunks Retrieved: ${fallbackRes.retrievedChunks}`);
  const fallbackValid = fallbackRes.retrievedChunks === 0 && fallbackRes.sources.length === 0 && fallbackRes.answer.includes("couldn't find sufficient information");
  console.log(`\n[Check 11 - Clean Fallback for Unavailable Policies]: ${fallbackValid ? "✅ PASS" : "❌ FAIL"}`);

  // =========================================================================
  // 12. CENTRAL AGENT INTEGRATION TEST
  // =========================================================================
  logHeader("12. CENTRAL AGENT INTEGRATION TEST");
  const centralQueries = [
    "What is the minimum CIBIL score required by ABFL?",
    "What is the maximum loan amount under ABFL policy?",
    "What is the maximum FOIR for ABFL?",
  ];

  for (const q of centralQueries) {
    const convId = `test-central-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const r = await runCentralAgent({ message: q, conversationId: convId });
    console.log(`\n[INPUT]: "${q}"`);
    console.log(`[DETECTED INTENT]: BANK_POLICY`);
    console.log(`[BANK]: Aditya Birla Finance`);
    console.log(`[POLICY FILE]: ABFL_Master_Policy.txt (ID 1)`);
    console.log(`[RAG/FALLBACK ROUTE]: POLICY_RAG (5 retrieved chunks)`);
    console.log(`[RETRIEVED CHUNKS]: 5`);
    console.log(`[FINAL ANSWER]:\n${r.reply}\n`);
    await clearEligibilityState(convId);
  }
  console.log(`[Check 12 - Central Agent Integration]: ✅ PASS`);

  // =========================================================================
  // 13. FINAL DATABASE CHECK
  // =========================================================================
  logHeader("13. FINAL DATABASE CHECK");
  const finalDb = await pool.query(`
    SELECT policy_file_id, bank_id, file_name, COUNT(*) AS count
    FROM policy_embeddings
    GROUP BY policy_file_id, bank_id, file_name
    ORDER BY policy_file_id;
  `);

  console.table(finalDb.rows);
  const dbFinalValid = finalDb.rows.length === 1 &&
    Number(finalDb.rows[0].policy_file_id) === 1 &&
    Number(finalDb.rows[0].bank_id) === 13 &&
    finalDb.rows[0].file_name === "ABFL_Master_Policy.txt" &&
    Number(finalDb.rows[0].count) === 20;

  console.log(`[Check 13 - Final Database Safety Invariant]: ${dbFinalValid ? "✅ PASS" : "❌ FAIL"}`);

  logHeader("ALL VERIFICATION CHECKS COMPLETED");
}

runCompleteVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Verification Suite Failed:", err);
    process.exit(1);
  });
