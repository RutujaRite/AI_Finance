/**
 * Comprehensive Verification Suite for CreditWise Policy RAG Phase:
 * Full Ingestion and Retrieval across all 23 UI-Uploaded Master Policies
 */

import pool from "../lib/db";
import { searchPolicyEmbeddings } from "../lib/policyRetrieval";
import { getDbPolicyLookup, resolveDbPolicy } from "../lib/policyRag";
import { runCentralAgent } from "../lib/ai/agent";

interface PolicyTestResult {
  policyFileId: number;
  bankId: number;
  fileName: string;
  bankName: string;
  chunkCount: number;
  dbValid: boolean;
  retrievalSuccess: boolean;
  topSimilarity: number;
  isolationSuccess: boolean;
  agentSuccess: boolean;
  agentReplySnippet: string;
}

async function runVerification() {
  console.log("================================================================================");
  console.log("CREDITWISE POLICY RAG — COMPREHENSIVE VERIFICATION FOR POLICIES 1 TO 23");
  console.log("================================================================================\n");

  const results: PolicyTestResult[] = [];
  const allDbPolicies = await getDbPolicyLookup();
  console.log(`Loaded ${allDbPolicies.length} master policies from database.\n`);

  // PART 1 & 2: Database Integrity & Direct Vector Retrieval for EVERY Policy 1–23
  console.log(">>> CHECKING DATABASE INTEGRITY & DIRECT RETRIEVAL FOR ALL 23 POLICIES <<<\n");

  for (const p of allDbPolicies) {
    // 1. Database chunk verification
    const dbRes = await pool.query(
      `SELECT
         COUNT(*) as total_chunks,
         COUNT(embedding) as non_null_embeds,
         COUNT(CASE WHEN LENGTH(TRIM(content)) > 0 THEN 1 END) as non_empty_contents,
         COUNT(DISTINCT chunk_index) as unique_chunks
       FROM policy_embeddings
       WHERE policy_file_id = $1 AND bank_id = $2`,
      [p.policyFileId, p.bankId]
    );

    const row = dbRes.rows[0];
    const totalChunks = Number(row.total_chunks);
    const nonNullEmbeds = Number(row.non_null_embeds);
    const nonEmptyContents = Number(row.non_empty_contents);
    const uniqueChunks = Number(row.unique_chunks);

    const dbValid =
      totalChunks > 0 &&
      totalChunks === nonNullEmbeds &&
      totalChunks === nonEmptyContents &&
      totalChunks === uniqueChunks;

    if (p.policyFileId === 1 && totalChunks !== 20) {
      console.error(`❌ CRITICAL: policy_file_id=1 chunk count modified! Expected 20, got ${totalChunks}`);
    }

    // 2. Direct Semantic Retrieval
    let retrievalSuccess = false;
    let topSimilarity = 0;
    try {
      const chunks = await searchPolicyEmbeddings({
        query: `What is the minimum CIBIL cutoff and loan eligibility criteria for ${p.bankName}?`,
        policyFileId: p.policyFileId,
        bankId: p.bankId,
        topK: 3,
      });

      if (chunks.length > 0) {
        topSimilarity = chunks[0].similarity;
        // Verify all returned chunks strictly belong to this bank
        retrievalSuccess = chunks.every(
          (c) => c.policy_file_id === p.policyFileId && c.bank_id === p.bankId
        );
      }
    } catch (err: any) {
      console.error(`Retrieval error for policy ${p.policyFileId}:`, err.message);
    }

    results.push({
      policyFileId: p.policyFileId,
      bankId: p.bankId,
      fileName: p.fileName,
      bankName: p.bankName,
      chunkCount: totalChunks,
      dbValid,
      retrievalSuccess,
      topSimilarity,
      isolationSuccess: false,
      agentSuccess: false,
      agentReplySnippet: "",
    });

    console.log(
      `Policy ${p.policyFileId.toString().padStart(2, " ")} | Bank ID ${p.bankId.toString().padStart(2, " ")} | ${p.bankName.padEnd(35, " ")} | Chunks: ${totalChunks.toString().padStart(2, " ")} | DB: ${dbValid ? "✓" : "✗"} | Retr: ${retrievalSuccess ? "✓ (" + topSimilarity.toFixed(3) + ")" : "✗"}`
    );
  }

  // PART 3: Strict Bank Isolation Test
  console.log("\n>>> TESTING BANK ISOLATION (ZERO CROSS-BANK CONTAMINATION) <<<\n");
  const testPairs = [
    { nameA: "HDFC Bank", fileIdA: 16, bankIdA: 5, nameB: "ICICI Bank", fileIdB: 17, bankIdB: 6 },
    { nameA: "Aditya Birla Capital", fileIdA: 1, bankIdA: 13, nameB: "Kotak Mahindra Bank", fileIdB: 20, bankIdB: 9 },
    { nameA: "Axis Bank", fileIdA: 3, bankIdA: 14, nameB: "TATA Capital", fileIdB: 10, bankIdB: 22 },
    { nameA: "Finnable Credit", fileIdA: 15, bankIdA: 4, nameB: "Poonawalla Fincorp", fileIdB: 22, bankIdB: 11 },
  ];

  let allIsolationPassed = true;
  for (const pair of testPairs) {
    // Query Bank A's policy scoped to Bank A
    const resA = await searchPolicyEmbeddings({
      query: `What is ${pair.nameA} interest rate and tenure?`,
      policyFileId: pair.fileIdA,
      bankId: pair.bankIdA,
      topK: 5,
    });

    const contaminatedA = resA.some(
      (c) => c.policy_file_id !== pair.fileIdA || c.bank_id !== pair.bankIdA
    );

    // Query Bank B's policy scoped to Bank B
    const resB = await searchPolicyEmbeddings({
      query: `What is ${pair.nameB} interest rate and tenure?`,
      policyFileId: pair.fileIdB,
      bankId: pair.bankIdB,
      topK: 5,
    });

    const contaminatedB = resB.some(
      (c) => c.policy_file_id !== pair.fileIdB || c.bank_id !== pair.bankIdB
    );

    const pairPass = !contaminatedA && !contaminatedB && resA.length > 0 && resB.length > 0;
    if (!pairPass) allIsolationPassed = false;

    console.log(
      `Isolation Pair: [${pair.nameA} (id=${pair.fileIdA})] vs [${pair.nameB} (id=${pair.fileIdB})] -> ${pairPass ? "PASS (Zero Leaks)" : "FAIL"}`
    );
  }

  // Mark isolation for all policies
  results.forEach((r) => (r.isolationSuccess = allIsolationPassed));

  // PART 4: End-to-End Central Agent Tests for EVERY Policy 1–23
  console.log("\n>>> TESTING AI ASSISTANT (runCentralAgent) FOR EVERY POLICY 1 TO 23 <<<\n");

  for (let i = 0; i < allDbPolicies.length; i++) {
    const p = allDbPolicies[i];
    const q = `What is the CIBIL score cutoff for ${p.bankName}?`;
    try {
      const agentRes = await runCentralAgent({
        message: q,
        conversationId: `verify-conv-${p.policyFileId}`,
      });

      const reply = agentRes.reply || "";
      const isGrounded =
        reply.length > 40 &&
        !reply.includes("NOT_DEFINED") &&
        !reply.includes("[REVIEW]");

      const r = results.find((item) => item.policyFileId === p.policyFileId);
      if (r) {
        r.agentSuccess = isGrounded;
        r.agentReplySnippet = reply.replace(/\n+/g, " ").slice(0, 85) + "...";
      }

      console.log(`Agent Policy ${p.policyFileId.toString().padStart(2, " ")} (${p.bankName.slice(0, 18).padEnd(18, " ")}): ${isGrounded ? "PASS" : "FAIL"}`);
      console.log(`   Reply: ${reply.replace(/\n+/g, " ").slice(0, 95)}...\n`);
    } catch (err: any) {
      console.error(`Agent error on policy ${p.policyFileId}:`, err.message);
    }
  }

  // PART 5: Unknown/Unavailable Bank Policy Test
  console.log(">>> TESTING UNKNOWN/UNAVAILABLE BANK POLICY <<<\n");
  const unknownRes = await runCentralAgent({
    message: "What is the minimum salary required by Atlantis Moon Bank?",
    conversationId: "test-unknown-bank",
  });
  const unknownReply = unknownRes.reply || "";
  const unknownPass =
    unknownReply.toLowerCase().includes("not available") ||
    unknownReply.toLowerCase().includes("do not have access") ||
    unknownReply.toLowerCase().includes("not find") ||
    unknownReply.toLowerCase().includes("not specified") ||
    unknownReply.toLowerCase().includes("official policy documents");

  console.log(`Unknown Bank Query: "${unknownReply.replace(/\n+/g, " ").slice(0, 100)}..."`);
  console.log(`Unknown Bank Test: ${unknownPass ? "PASS (Zero hallucination)" : "FAIL"}\n`);

  // PART 6: Conversational Interruption & State Preservation
  console.log(">>> TESTING CONVERSATIONAL INTERRUPTION & ELIGIBILITY STATE PRESERVATION <<<\n");
  const convId = `test-interrupt-${Date.now()}`;

  // Step A: Start Loan Flow
  const stepA = await runCentralAgent({
    message: "I need a loan of 5 lakhs",
    conversationId: convId,
  });
  console.log(`Step A (Start Flow): ${stepA.reply.replace(/\n+/g, " ").slice(0, 80)}...`);

  // Step B: Interrupt with Policy Question
  const stepB = await runCentralAgent({
    message: "What is HDFC Bank CIBIL cutoff?",
    conversationId: convId,
  });
  const stepBHasPolicy =
    stepB.reply.toLowerCase().includes("cibil") ||
    stepB.reply.toLowerCase().includes("hdfc");
  console.log(`Step B (Interruption): ${stepB.reply.replace(/\n+/g, " ").slice(0, 80)}...`);

  // Step C: Resume Flow
  const stepC = await runCentralAgent({
    message: "My company is Infosys",
    conversationId: convId,
  });
  console.log(`Step C (Resume): ${stepC.reply.replace(/\n+/g, " ").slice(0, 80)}...`);

  const interruptPass = stepBHasPolicy && stepC.reply.length > 20;
  console.log(`Conversational Interruption Test: ${interruptPass ? "PASS (State preserved & resumed)" : "FAIL"}\n`);

  // PART 7: Numeric Contamination Guard Test
  console.log(">>> TESTING NUMERIC CONTAMINATION GUARD <<<\n");
  const convContam = `test-contam-${Date.now()}`;
  const contamRes = await runCentralAgent({
    message: "My salary is Rs 39,000. What does Kotak Bank policy say about CIBIL?",
    conversationId: convContam,
  });

  const contamReply = contamRes.reply || "";
  const contamPass =
    (contamReply.toLowerCase().includes("cibil") || contamReply.toLowerCase().includes("kotak")) &&
    !contamReply.toLowerCase().includes("table of eligible banks");

  console.log(`Numeric Contamination Query Reply: ${contamReply.replace(/\n+/g, " ").slice(0, 100)}...`);
  console.log(`Numeric Contamination Guard: ${contamPass ? "PASS (Policy answered, no spurious premature loan evaluation)" : "FAIL"}\n`);

  // FINAL SUMMARY REPORT
  console.log("================================================================================");
  console.log("FINAL POLICY RAG VERIFICATION REPORT TABLE");
  console.log("================================================================================\n");

  console.table(
    results.map((r) => ({
      ID: r.policyFileId,
      BankID: r.bankId,
      Bank: r.bankName.slice(0, 22),
      File: r.fileName.slice(0, 25),
      Chunks: r.chunkCount,
      DB: r.dbValid ? "OK" : "ERR",
      Retr: r.retrievalSuccess ? `OK (${r.topSimilarity.toFixed(2)})` : "FAIL",
      Isol: r.isolationSuccess ? "OK" : "FAIL",
      Agent: r.agentSuccess ? "OK" : "FAIL",
    }))
  );

  const allPassed =
    results.every((r) => r.dbValid && r.retrievalSuccess && r.agentSuccess) &&
    allIsolationPassed &&
    unknownPass &&
    interruptPass &&
    contamPass;

  console.log(`\nOVERALL VERIFICATION STATUS: ${allPassed ? "✅ ALL 23 POLICIES AND SAFETY GUARDS PASSED!" : "❌ SOME CHECKS FAILED"}`);

  await pool.end();
}

runVerification().catch((err) => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
