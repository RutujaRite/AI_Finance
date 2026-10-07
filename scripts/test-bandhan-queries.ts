/**
 * Test Bandhan Bank policy queries
 */
import { answerPolicyWithRag } from "../lib/policyRag";
import pool from "../lib/db";

async function runBandhanTests() {
  console.log("========================================");
  console.log("TESTING BANDHAN BANK POLICY QUERIES");
  console.log("========================================\n");

  const queries = [
    "minimum cibil score for the Bandhan Bank",
    "For Bandhan Bank, give me the minimum salary, minimum CIBIL, maximum age, and employment criteria for each company category.",
  ];

  for (const query of queries) {
    console.log(`\n>>> QUERY: "${query}"`);
    const res = await answerPolicyWithRag({
      query,
      bankName: "Bandhan Bank",
      policyFileId: 6, // Bandhan Bank policy ID
      topK: 6,
    });
    console.log(`RETRIEVED CHUNKS: ${res.retrievedChunks}`);
    console.log(`SOURCES: ${res.sources.map(s => `${s.fileName}#${s.chunkIndex}`).join(", ")}`);
    console.log(`\nANSWER:\n${res.answer}\n`);
    console.log("------------------------------------------------------------");
  }

  await pool.end();
}

runBandhanTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
