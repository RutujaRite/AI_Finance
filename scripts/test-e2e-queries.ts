import { runCentralAgent } from "../lib/ai/agent";
import { resolveDbPolicy, answerPolicyWithRag } from "../lib/policyRag";

const queries = [
  {
    id: 1,
    query: "What is the minimum CIBIL for Axis Finance?",
    expectedBank: "Axis Finance",
    expectedPolicyFileId: 2,
    expectedFileName: "Axis_Finance_Master_Policy.txt",
    expectedBankId: 15,
  },
  {
    id: 2,
    query: "What is the minimum age for Axis Finance?",
    expectedBank: "Axis Finance",
    expectedPolicyFileId: 2,
    expectedFileName: "Axis_Finance_Master_Policy.txt",
    expectedBankId: 15,
  },
  {
    id: 3,
    query: "What is the standard FOIR for Axis Finance?",
    expectedBank: "Axis Finance",
    expectedPolicyFileId: 2,
    expectedFileName: "Axis_Finance_Master_Policy.txt",
    expectedBankId: 15,
  },
  {
    id: 4,
    query: "What is the maximum loan amount for Axis Finance?",
    expectedBank: "Axis Finance",
    expectedPolicyFileId: 2,
    expectedFileName: "Axis_Finance_Master_Policy.txt",
    expectedBankId: 15,
  },
  {
    id: 5,
    query: "What documents are required for Axis Finance?",
    expectedBank: "Axis Finance",
    expectedPolicyFileId: 2,
    expectedFileName: "Axis_Finance_Master_Policy.txt",
    expectedBankId: 15,
  },
  {
    id: 6,
    query: "Can a contractual employee apply to Axis Finance?",
    expectedBank: "Axis Finance",
    expectedPolicyFileId: 2,
    expectedFileName: "Axis_Finance_Master_Policy.txt",
    expectedBankId: 15,
  },
  {
    id: 7,
    query: "What is the eligibility for Super CAT A in Axis Finance?",
    expectedBank: "Axis Finance",
    expectedPolicyFileId: 2,
    expectedFileName: "Axis_Finance_Master_Policy.txt",
    expectedBankId: 15,
  },
  {
    id: 8,
    query: "What are the Axis Finance eligibility exceptions?",
    expectedBank: "Axis Finance",
    expectedPolicyFileId: 2,
    expectedFileName: "Axis_Finance_Master_Policy.txt",
    expectedBankId: 15,
  },
  {
    id: 9,
    query: "What is the eligibility criteria of Axis Bank?",
    expectedBank: "Axis Bank",
    expectedPolicyFileId: 3,
    expectedFileName: "AXIS_Master_Policy.txt",
    expectedBankId: 14,
  },
];

async function runTests() {
  console.log("================================================================================");
  console.log("STARTING 9 UI-LEVEL END-TO-END POLICY QUERIES THROUGH runCentralAgent()");
  console.log("================================================================================\n");

  const results = [];

  for (const t of queries) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`RUNNING TEST #${t.id}: "${t.query}"`);
    console.log(`--------------------------------------------------------------------------------`);

    const convId = `e2e-sub-${t.id}-${Date.now()}`;
    const startTime = Date.now();

    // 1. Trace resolution
    const resolved = await resolveDbPolicy(t.expectedBank);
    
    // 2. Trace retrieval directly to verify chunks & contamination
    const ragTrace = await answerPolicyWithRag({
      query: t.query,
      policyFileId: resolved?.policyFileId,
      bankId: resolved?.bankId,
      topK: 5,
    });

    const isAxisFinance = t.expectedBank === "Axis Finance";
    const contaminated = isAxisFinance
      ? ragTrace.sources.some(s => s.fileName.toLowerCase().includes("axis_master") || s.bankId === 14)
      : ragTrace.sources.some(s => s.fileName.toLowerCase().includes("axis_finance") || s.bankId === 15);

    const wrongPolicyFileChunks = ragTrace.sources.filter(
      s => s.policyFileId !== t.expectedPolicyFileId
    );
    const passExactPolicyFile = wrongPolicyFileChunks.length === 0 && ragTrace.sources.length > 0;

    // 3. Run full UI-level pipeline via runCentralAgent
    const agentRes = await runCentralAgent({
      message: t.query,
      conversationId: convId,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const passPolicyResolution = resolved?.policyFileId === t.expectedPolicyFileId;
    const passNoContamination = !contaminated;
    const hasReply = !!agentRes.reply && agentRes.reply.length > 20;
    const passed = passPolicyResolution && passExactPolicyFile && passNoContamination && hasReply;

    results.push({
      id: t.id,
      query: t.query,
      targetBank: t.expectedBank,
      resolvedPolicyFileId: resolved?.policyFileId,
      resolvedFileName: resolved?.fileName,
      resolvedBankId: resolved?.bankId,
      retrievedChunkCount: ragTrace.retrievedChunks,
      retrievedIndexes: ragTrace.sources.map(s => s.chunkIndex),
      exactPolicyFile: passExactPolicyFile,
      wrongPolicyFileChunks,
      contaminated,
      duration,
      passed,
      reply: agentRes.reply,
    });

    console.log(`TEST #${t.id} RESULT: ${passed ? "PASS" : "FAIL"}`);
    console.log(`- Resolved Policy ID: ${resolved?.policyFileId} (${resolved?.fileName})`);
    console.log(`- Bank ID: ${resolved?.bankId}`);
    console.log(`- Retrieved Chunks: ${ragTrace.retrievedChunks} [${ragTrace.sources.map(s => s.chunkIndex).join(", ")}]`);
    console.log(`- Exact Policy File: ${passExactPolicyFile ? "YES (PASS)" : "NO (FAIL)"}`);
    if (!passExactPolicyFile) {
      console.log("- WRONG POLICY FILE CHUNKS:", wrongPolicyFileChunks);
    }
    console.log(`- Cross-Contamination: ${contaminated ? "YES (FAIL)" : "NO (PASS)"}`);
    console.log(`- Response Length: ${agentRes.reply.length} chars`);
    console.log(`- Response Preview: ${agentRes.reply.slice(0, 180).replace(/\n/g, " ")}...`);
    console.log(`- Duration: ${duration}s`);
  }

  console.log("\n================================================================================");
  console.log("FINAL SUMMARY REPORT");
  console.log("================================================================================");
  console.table(
    results.map(r => ({
      Test: `#${r.id}`,
      Query: r.query.length > 35 ? r.query.slice(0, 32) + "..." : r.query,
      PolicyFile: r.resolvedFileName,
      Chunks: r.retrievedChunkCount,
      ExactPolicyFile: r.exactPolicyFile ? "PASS" : "FAIL",
      CrossContam: r.contaminated ? "FAIL" : "NONE",
      Status: r.passed ? "PASS" : "FAIL",
    }))
  );

  console.log("\nFULL RESPONSES FOR AUDIT:");
  for (const r of results) {
    console.log(`\n========================================`);
    console.log(`QUERY #${r.id}: ${r.query}`);
    console.log(`Resolved: file_id=${r.resolvedPolicyFileId}, bank_id=${r.resolvedBankId} (${r.resolvedFileName})`);
    console.log(`========================================`);
    console.log(r.reply);
  }
}

runTests().catch(console.error);
