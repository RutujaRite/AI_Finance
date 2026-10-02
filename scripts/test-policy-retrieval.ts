/**
 * Semantic Retrieval Test Script for Policy Embeddings
 * 
 * Tests vector similarity search over policy_embeddings for policy_file_id = 1 (ABFL_Master_Policy.txt).
 * Runs 4 key underwriting queries and outputs the TOP 5 closest chunks by cosine distance.
 * 
 * Usage:
 *   npx tsx scripts/test-policy-retrieval.ts
 */

import { searchPolicyEmbeddings, PolicySearchResult } from "../lib/policyRetrieval";
import pool from "../lib/db";

const TEST_QUERIES = [
  "What is the minimum CIBIL score required for a personal loan?",
  "What is the maximum loan amount?",
  "What is the maximum FOIR?",
  "What is the minimum salary requirement?",
];

const TARGET_POLICY_FILE_ID = 1;

async function runRetrievalTests() {
  console.log("================================================================================");
  console.log("POLICY RAG SEMANTIC RETRIEVAL TEST");
  console.log("================================================================================");
  console.log(`Target Policy File ID: ${TARGET_POLICY_FILE_ID} (ABFL_Master_Policy.txt)`);
  console.log(`Total Queries to Run:  ${TEST_QUERIES.length}`);
  console.log("================================================================================\n");

  for (let qIdx = 0; qIdx < TEST_QUERIES.length; qIdx++) {
    const query = TEST_QUERIES[qIdx];

    console.log("────────────────────────────────────────────────────────────────────────────────");
    console.log(`QUERY ${qIdx + 1}/${TEST_QUERIES.length}: "${query}"`);
    console.log("────────────────────────────────────────────────────────────────────────────────");

    try {
      const startTime = Date.now();
      const results: PolicySearchResult[] = await searchPolicyEmbeddings({
        query,
        policyFileId: TARGET_POLICY_FILE_ID,
        topK: 5,
      });
      const elapsedMs = Date.now() - startTime;

      if (!results || results.length === 0) {
        console.log("  ⚠️ No matching policy chunks found.\n");
        continue;
      }

      console.log(`Retrieved ${results.length} chunks in ${elapsedMs}ms:\n`);

      for (let rank = 0; rank < results.length; rank++) {
        const item = results[rank];
        const preview = item.content.replace(/\s+/g, " ").slice(0, 160);

        console.log(`  [Rank ${rank + 1}]`);
        console.log(`    Chunk Index:     ${item.chunk_index}`);
        console.log(`    Cosine Distance: ${item.distance.toFixed(4)} (Similarity: ${(item.similarity * 100).toFixed(2)}%)`);
        console.log(`    Content Length:  ${item.content.length} characters`);
        console.log(`    Content Preview: "${preview}..."`);
        console.log();
      }
    } catch (err: any) {
      console.error(`  ❌ Error searching for query "${query}":`, err.message);
    }
  }

  console.log("================================================================================");
  console.log("SEMANTIC RETRIEVAL TEST COMPLETE (No LLM generation performed)");
  console.log("================================================================================\n");
}

runRetrievalTests()
  .catch((err) => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
