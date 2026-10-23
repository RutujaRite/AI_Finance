// scripts/test-dual-source-rag-pipeline.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import pool from "../lib/db";
import { classifyRetrievalIntent } from "../lib/ai/intentRouting";
import {
  performDualSourceRetrieval,
  searchBankPolicyEmbeddings,
  searchAgentKnowledgeEmbeddings,
} from "../lib/ai/dualSourceRag";
import {
  extractVariableUpdatesFromText,
  loadSessionVariables,
  persistUpdatedVariables,
  formatActiveVariablesPrompt,
} from "../lib/ai/variableTracker";

async function runPipelineTests() {
  console.log("================================================================================");
  console.log("DUAL-SOURCE VECTOR RAG & INTENT ROUTING RETRIEVAL PIPELINE TEST");
  console.log("================================================================================\n");

  // TEST 1: Intent Classification & Routing Layer
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 1: Intent Classification & Routing Layer (POLICY, AGENT_KNOWLEDGE, GENERAL)");
  console.log("--------------------------------------------------------------------------------");

  const testQueries = [
    { query: "What is the CIBIL cutoff for HDFC Bank personal loan?", expected: "POLICY" },
    { query: "Tell me the minimum salary required for Finnable Credit", expected: "POLICY" },
    { query: "What are the rules and guidelines for Bajaj Finserv?", expected: "POLICY" },
    { query: "Check my eligibility across partner banks", expected: "POLICY" },
    { query: "What are your agent instructions and system prompt?", expected: "AGENT_KNOWLEDGE" },
    { query: "What guardrails and studio rules do you have?", expected: "AGENT_KNOWLEDGE" },
    { query: "Show me the knowledge base rules configured for this assistant", expected: "AGENT_KNOWLEDGE" },
    { query: "Hello! Good morning, how are you?", expected: "GENERAL" },
    { query: "What is a CIBIL score and how can I improve it?", expected: "GENERAL" },
    { query: "How is compound interest calculated on loans?", expected: "GENERAL" },
  ];

  let passedClassification = 0;
  for (const item of testQueries) {
    const res = classifyRetrievalIntent(item.query);
    const pass = res.intent === item.expected;
    if (pass) passedClassification++;
    console.log(`- Query: "${item.query}"`);
    console.log(`  Expected: ${item.expected} | Got: ${res.intent} (${pass ? "PASS ✅" : "FAIL ❌"}) | Reason: ${res.reason}`);
  }
  console.log(`\nIntent Classification Score: ${passedClassification}/${testQueries.length}\n`);

  // TEST 2: Dual-Source Vector DB Search - POLICY (bank_policy_embeddings)
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 2: Dual-Source Vector DB Search - POLICY (bank_policy_embeddings)");
  console.log("--------------------------------------------------------------------------------");

  const policySearchRes = await searchBankPolicyEmbeddings({
    query: "What is the minimum CIBIL score and salary requirement for HDFC Bank?",
    bankName: "HDFC Bank",
    topK: 3,
  });

  console.log(`Retrieved ${policySearchRes.length} chunks from bank_policy_embeddings:`);
  policySearchRes.forEach((chunk, i) => {
    console.log(`  [Chunk ${i + 1}] File: ${chunk.fileName} | Sim: ${(chunk.similarity * 100).toFixed(1)}% | Dist: ${chunk.distance.toFixed(4)}`);
    console.log(`  Snippet: ${chunk.content.slice(0, 120)}...`);
  });

  const passPolicySearch = policySearchRes.length > 0;
  console.log(`POLICY Search Result: ${passPolicySearch ? "PASS ✅" : "FAIL ❌"}\n`);

  // TEST 3: Dual-Source Vector DB Search - AGENT_KNOWLEDGE (agent_knowledge_embeddings)
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 3: Dual-Source Vector DB Search - AGENT_KNOWLEDGE (agent_knowledge_embeddings)");
  console.log("--------------------------------------------------------------------------------");

  const agentSearchRes = await searchAgentKnowledgeEmbeddings({
    query: "assistant greeting guidelines and behavioral rules",
    topK: 3,
  });

  console.log(`Retrieved ${agentSearchRes.length} chunks from agent_knowledge_embeddings:`);
  agentSearchRes.forEach((chunk, i) => {
    console.log(`  [Chunk ${i + 1}] Doc: ${chunk.documentName} | Sim: ${(chunk.similarity * 100).toFixed(1)}%`);
    console.log(`  Snippet: ${chunk.content.slice(0, 120)}...`);
  });

  const passAgentSearch = agentSearchRes.length > 0;
  console.log(`AGENT_KNOWLEDGE Search Result: ${passAgentSearch ? "PASS ✅" : "FAIL ❌"}\n`);

  // TEST 4: GENERAL Intent Retrieval - Bypass strict vector filtering
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 4: Dual-Source Coordinator - GENERAL Intent (Bypasses strict vector filter)");
  console.log("--------------------------------------------------------------------------------");

  const generalRouting = classifyRetrievalIntent("How does compound interest work?");
  const generalRag = await performDualSourceRetrieval({
    query: "How does compound interest work?",
    routing: generalRouting,
  });

  console.log(`General RAG hasRelevantKnowledge: ${generalRag.hasRelevantKnowledge}`);
  console.log(`General RAG sources count: ${generalRag.sources.length}`);
  const passGeneral = generalRag.intent === "GENERAL" && generalRag.hasRelevantKnowledge === false;
  console.log(`GENERAL Bypass Result: ${passGeneral ? "PASS ✅" : "FAIL ❌"}\n`);

  // TEST 5: Session Memory & Context Variable Tracking
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 5: Session Memory & Variable Tracking");
  console.log("--------------------------------------------------------------------------------");

  const testConvId = `test-vars-${Date.now()}`;
  const userMsg1 = "I earn 65,000 per month and have an existing EMI of 8000. Looking for 5 lakh loan";
  const updates1 = extractVariableUpdatesFromText(userMsg1);
  console.log("Extracted from Turn 1:", updates1);

  const initialVars = await loadSessionVariables(testConvId);
  const activeVars1 = await persistUpdatedVariables(testConvId, updates1, initialVars);
  console.log("Persisted variables after Turn 1:", activeVars1);

  // Turn 2: User updates / corrects salary and CIBIL
  const userMsg2 = "Actually my salary is 75000 and my CIBIL is 780. I work at Infosys";
  const updates2 = extractVariableUpdatesFromText(userMsg2);
  console.log("\nExtracted from Turn 2 (Update/Override):", updates2);

  const activeVars2 = await persistUpdatedVariables(testConvId, updates2, activeVars1);
  console.log("Persisted variables after Turn 2:", activeVars2);

  const formattedPrompt = formatActiveVariablesPrompt(activeVars2);
  console.log("\nFormatted Active Variables Prompt Block:\n", formattedPrompt);

  const passVars =
    activeVars2.monthlySalary === 75000 &&
    activeVars2.existingEmi === 8000 &&
    activeVars2.loanAmount === 500000 &&
    activeVars2.cibilScore === 780 &&
    activeVars2.companyName === "Infosys";

  console.log(`Variable Tracking & Override Result: ${passVars ? "PASS ✅" : "FAIL ❌"}\n`);

  // Cleanup test state row
  await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [testConvId]);

  console.log("================================================================================");
  console.log("ALL DUAL-SOURCE RAG & INTENT ROUTING TESTS COMPLETED");
  console.log("================================================================================");
}

runPipelineTests()
  .catch((err) => {
    console.error("Test error:", err);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
