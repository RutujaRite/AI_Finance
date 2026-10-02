/**
 * Policy RAG Answer Pipeline Test Runner
 * 
 * Verifies the end-to-end Policy RAG pipeline:
 * QUERY → EMBEDDING → VECTOR SEARCH → CONTEXT → LLM → ANSWER → SOURCES
 * 
 * Tests strictly against policy_file_id = 1 (ABFL_Master_Policy.txt).
 * 
 * Usage:
 *   npm run test:policy-rag
 */

import { answerPolicyWithRag } from "../lib/policyRag";
import pool from "../lib/db";

const TEST_QUESTIONS = [
  "What is the minimum CIBIL score required for a personal loan?",
  "What is the maximum loan amount?",
  "What is the maximum FOIR?",
  "What is the minimum salary requirement?",
  // Negative test: specific unstated criteria to test hallucination resistance
  "What is ABFL's maximum loan amount for customers earning exactly Rs 73,421 in a city with population 8,73,000?",
];

const TARGET_POLICY_FILE_ID = 1;

async function runTests() {
  console.log("========================================");
  console.log("CREDITWISE POLICY RAG GENERATION TEST");
  console.log("========================================");
  console.log(`Target Policy File ID: ${TARGET_POLICY_FILE_ID} (ABFL_Master_Policy.txt)`);
  console.log(`Total Questions:       ${TEST_QUESTIONS.length}`);
  console.log("========================================\n");

  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const query = TEST_QUESTIONS[i];

    console.log("----------------------------------------");
    console.log(`QUERY:\n${query}\n`);

    try {
      const res = await answerPolicyWithRag({
        query,
        policyFileId: TARGET_POLICY_FILE_ID,
        topK: 5,
      });

      console.log(`RETRIEVED CHUNKS:\n${res.retrievedChunks}\n`);
      console.log(`ANSWER:\n${res.answer}\n`);

      console.log("SOURCES:");
      if (res.sources && res.sources.length > 0) {
        res.sources.forEach((s) => {
          console.log(`- ${s.fileName}`);
          console.log(`  Chunk: ${s.chunkIndex}`);
          console.log(`  Similarity: ${s.similarity}`);
        });
      } else {
        console.log("- None");
      }
    } catch (err: any) {
      console.error(`❌ Error during test:`, err.message);
    }

    console.log("----------------------------------------\n");
  }

  console.log("========================================");
  console.log("POLICY RAG TEST COMPLETED");
  console.log("========================================\n");
}

runTests()
  .catch((err) => {
    console.error("Fatal test runner failure:", err);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
