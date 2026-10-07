/**
 * Policy RAG Embedding Ingestion Pipeline
 * 
 * Ingests .txt master policies from bank_policy_files table into policy_embeddings table.
 * Generates 1536-dimensional embeddings using OpenRouter's google/gemini-embedding-2.
 * 
 * Usage:
 *   npm run ingest:policy-embeddings -- --policy-id=1 --dry-run
 *   npm run ingest:policy-embeddings -- --policy-id=1
 *   npm run ingest:policy-embeddings
 */

import { Pool } from "pg";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables (.env.local with fallback to .env)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import { chunkPolicyWithMetadata } from "../lib/policyChunker";

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "127.0.0.1",
  database: process.env.DB_NAME || "login_db",
  password: process.env.DB_PASSWORD || "system123",
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

interface PolicyRecord {
  id: number;
  bank_id: number;
  file_name: string;
  file_type: string;
  extracted_text: string;
}

interface Chunk {
  index: number;
  content: string;
  charCount: number;
}

interface IngestOptions {
  policyId?: number;
  dryRun: boolean;
  limit?: number;
  skipExisting: boolean;
}

/**
 * Parse command line arguments:
 *   --policy-id=<id> | --policy-id <id>
 *   --dry-run
 *   --limit=<n> | --limit <n>
 *   --force (disables skipExisting)
 *   --skip-existing (default true)
 */
function parseArgs(): IngestOptions {
  const args = process.argv.slice(2);
  const options: IngestOptions = {
    dryRun: false,
    skipExisting: true, // Default to true to prevent overwriting existing embeddings (especially policy 1)
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.skipExisting = false;
    } else if (arg === "--skip-existing") {
      options.skipExisting = true;
    } else if (arg.startsWith("--policy-id=")) {
      const val = parseInt(arg.split("=")[1], 10);
      if (!isNaN(val)) options.policyId = val;
    } else if (arg === "--policy-id" && i + 1 < args.length) {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) options.policyId = val;
    } else if (arg.startsWith("--limit=")) {
      const val = parseInt(arg.split("=")[1], 10);
      if (!isNaN(val)) options.limit = val;
    } else if (arg === "--limit" && i + 1 < args.length) {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) options.limit = val;
    }
  }

  return options;
}

/**
 * Paragraph- and section-aware text chunker.
 * 
 * Target size: 1000 - 1200 characters
 * Overlap: 150 - 200 characters
 * 
 * Boundary priority:
 *   1. Double newline / paragraph boundary (\n\s*\n)
 *   2. Single newline (\n)
 *   3. Sentence boundary ([.!?]\s+)
 *   4. Word boundary (\s+)
 */
export function chunkPolicyText(
  text: string,
  targetSize = 1100,
  overlap = 180
): Chunk[] {
  if (!text || typeof text !== "string") return [];

  // Normalize line endings
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Step 1: Split into atomic logical units by paragraph boundaries
  const rawParagraphs = normalized.split(/\n\s*\n/);
  const units: string[] = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (trimmed.length <= targetSize) {
      units.push(trimmed);
    } else {
      // Split large paragraphs by single line
      const lines = trimmed.split("\n");
      for (const line of lines) {
        const lTrimmed = line.trim();
        if (!lTrimmed) continue;

        if (lTrimmed.length <= targetSize) {
          units.push(lTrimmed);
        } else {
          // Split long lines by sentences
          const sentences = lTrimmed.split(/(?<=[.!?])\s+/);
          for (const s of sentences) {
            const sTrimmed = s.trim();
            if (!sTrimmed) continue;

            if (sTrimmed.length <= targetSize) {
              units.push(sTrimmed);
            } else {
              // Fallback: split by words if a single sentence exceeds target size
              const words = sTrimmed.split(/\s+/);
              let temp = "";
              for (const w of words) {
                if (temp.length + w.length + 1 <= targetSize) {
                  temp = temp ? `${temp} ${w}` : w;
                } else {
                  if (temp) units.push(temp);
                  temp = w;
                }
              }
              if (temp) units.push(temp);
            }
          }
        }
      }
    }
  }

  // Step 2: Accumulate units into chunks with overlap
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];

    if (!currentChunk) {
      currentChunk = unit;
    } else if (currentChunk.length + 2 + unit.length <= targetSize) {
      currentChunk += "\n\n" + unit;
    } else {
      // Finalize current chunk
      const finalized = currentChunk.trim();
      if (finalized.length > 0) {
        chunks.push({
          index: chunkIndex++,
          content: finalized,
          charCount: finalized.length,
        });
      }

      // Calculate overlap from end of current chunk
      if (overlap > 0 && finalized.length > overlap) {
        const overlapSlice = finalized.slice(-overlap);
        // Find natural boundary (line break or sentence end) within overlap
        const boundaryIdx = overlapSlice.search(/[\n.!?]\s+/);
        let overlapText = boundaryIdx !== -1
          ? overlapSlice.slice(boundaryIdx + 1).trim()
          : overlapSlice.trim();

        if (overlapText.length >= 40) {
          currentChunk = overlapText + "\n\n" + unit;
        } else {
          currentChunk = unit;
        }
      } else {
        currentChunk = unit;
      }
    }
  }

  // Final remaining chunk
  if (currentChunk.trim().length > 0) {
    const finalized = currentChunk.trim();
    chunks.push({
      index: chunkIndex++,
      content: finalized,
      charCount: finalized.length,
    });
  }

  return chunks;
}

/**
 * Generate 1536-dimensional embedding using OpenRouter API with exponential backoff.
 */
/**
 * Generate 1536-dimensional embeddings for multiple texts using OpenRouter API in batches.
 */
async function generateEmbeddingsBatch(
  contents: string[],
  model: string,
  dimensions: number,
  apiKey: string,
  maxRetries = 3
): Promise<number[][]> {
  if (contents.length === 0) return [];
  let attempt = 0;
  let delayMs = 1000;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: contents,
          dimensions,
        }),
      });

      const bodyText = await response.text();

      if (!response.ok) {
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          throw new Error(`OpenRouter HTTP ${response.status}: ${bodyText}`);
        }

        if (attempt < maxRetries && (response.status === 429 || response.status >= 500)) {
          attempt++;
          console.warn(`[WARN] Embedding API returned HTTP ${response.status}. Retrying in ${delayMs}ms (Attempt ${attempt}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, delayMs));
          delayMs *= 2;
          continue;
        }

        throw new Error(`OpenRouter HTTP ${response.status}: ${bodyText}`);
      }

      let parsed: any;
      try {
        parsed = JSON.parse(bodyText);
      } catch (jsonErr) {
        throw new Error(`Failed to parse embedding API response JSON: ${bodyText.slice(0, 200)}`);
      }

      const dataArr = parsed?.data;
      if (!Array.isArray(dataArr) || dataArr.length !== contents.length) {
        throw new Error(`Invalid embedding response: expected ${contents.length} vectors, got ${dataArr?.length}`);
      }

      const vectors: number[][] = [];
      for (let i = 0; i < dataArr.length; i++) {
        const vec = dataArr[i]?.embedding;
        if (!Array.isArray(vec) || vec.length !== dimensions) {
          throw new Error(`Dimension mismatch for chunk ${i}: expected ${dimensions}, got ${vec?.length}`);
        }
        vectors.push(vec);
      }

      return vectors;
    } catch (err: any) {
      if (attempt < maxRetries && !err.message?.includes("HTTP 401") && !err.message?.includes("HTTP 400")) {
        attempt++;
        console.warn(`[WARN] Network error (${err.message}). Retrying in ${delayMs}ms (Attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
      } else {
        throw err;
      }
    }
  }

  throw new Error(`Failed to generate embeddings batch after ${maxRetries} retries`);
}

/**
 * Generate 1536-dimensional embedding using OpenRouter API with exponential backoff.
 */
async function generateEmbedding(
  content: string,
  model: string,
  dimensions: number,
  apiKey: string,
  maxRetries = 3
): Promise<number[]> {
  const vectors = await generateEmbeddingsBatch([content], model, dimensions, apiKey, maxRetries);
  return vectors[0];
}

/**
 * Main Ingestion Execution Function
 */
async function main() {
  const options = parseArgs();

  const apiKey = process.env.OPENROUTER_API_KEY;
  const embeddingModel = process.env.EMBEDDING_MODEL || "google/gemini-embedding-2";
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS) || 1536;

  console.log("========================================");
  console.log("Policy Embedding Ingestion Pipeline");
  console.log("========================================");
  console.log(`Mode:            ${options.dryRun ? "DRY RUN (No API calls, No DB writes)" : "LIVE INGESTION"}`);
  console.log(`Target Model:    ${embeddingModel}`);
  console.log(`Dimensions:      ${dimensions}`);
  if (options.policyId) {
    console.log(`Filter Policy:   policy_id = ${options.policyId}`);
  }
  if (options.limit) {
    console.log(`Limit:           ${options.limit}`);
  }
  console.log("========================================\n");

  if (!options.dryRun && !apiKey) {
    console.error("❌ ERROR: OPENROUTER_API_KEY is not defined in environment.");
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    // Retrieve policies strictly from bank_policy_files
    let query = `
      SELECT id, bank_id, file_name, file_type, extracted_text
      FROM bank_policy_files
      WHERE file_type = '.txt'
        AND extracted_text IS NOT NULL
        AND LENGTH(TRIM(extracted_text)) > 0
    `;
    const params: any[] = [];

    if (options.policyId) {
      params.push(options.policyId);
      query += ` AND id = $${params.length}`;
    }

    query += " ORDER BY id ASC";

    if (options.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }

    const res = await client.query<PolicyRecord>(query, params);
    const policies = res.rows;

    if (policies.length === 0) {
      console.log("No eligible policy files found matching the criteria.");
      return;
    }

    console.log(`Found ${policies.length} eligible policy file(s) for processing.\n`);

    const summary = {
      processed: 0,
      skipped: 0,
      totalChunks: 0,
      failed: 0,
      failedFiles: [] as string[],
    };

    for (let pIdx = 0; pIdx < policies.length; pIdx++) {
      const policy = policies[pIdx];
      const textLen = policy.extracted_text.length;

      console.log("----------------------------------------");
      console.log(`Policy ${pIdx + 1}/${policies.length}: ID ${policy.id}`);
      console.log(`Bank ID:     ${policy.bank_id}`);
      console.log(`File:        ${policy.file_name}`);
      console.log(`Characters:  ${textLen}`);

      // Chunk the policy text using header-aware, metadata-enriched chunking
      const bankDerivedName = policy.file_name.replace(/_Master_Policy\.txt$/i, "").replace(/_/g, " ");
      const chunks = chunkPolicyWithMetadata(policy.extracted_text, {
        bankName: bankDerivedName,
        targetCharSize: 1800,
        overlapCharSize: 200,
      });
      const chunkLens = chunks.map((c) => c.charCount);
      const minLen = Math.min(...chunkLens);
      const maxLen = Math.max(...chunkLens);
      const avgLen = Math.round(chunkLens.reduce((a, b) => a + b, 0) / chunks.length);

      console.log(`Chunks:      ${chunks.length}`);
      console.log(`Min Length:  ${minLen} chars`);
      console.log(`Max Length:  ${maxLen} chars`);
      console.log(`Avg Length:  ${avgLen} chars`);

      // Check if policy already has embeddings
      const existingCountRes = await client.query(
        "SELECT COUNT(*) AS cnt FROM policy_embeddings WHERE policy_file_id = $1",
        [policy.id]
      );
      const existingCount = Number(existingCountRes.rows[0]?.cnt || 0);

      if (existingCount > 0 && options.skipExisting) {
        console.log(`[SKIP]
policy_file_id: ${policy.id}
bank_id: ${policy.bank_id}
file_name: ${policy.file_name}
chunk count: ${chunks.length}
inserted count: 0
skipped count: ${existingCount}
errors: 0
(Already embedded, skipping)\n`);
        summary.skipped++;
        continue;
      }

      if (options.dryRun) {
        console.log("\n[DRY RUN PREVIEWS]");
        const previewCount = Math.min(3, chunks.length);
        for (let i = 0; i < previewCount; i++) {
          const c = chunks[i];
          console.log(`\n--- Chunk ${c.index} Preview (${c.charCount} chars) ---`);
          console.log(c.content.slice(0, 220) + (c.charCount > 220 ? "\n..." : ""));
        }
        console.log("\n✓ Dry run completed for this policy. (No database or API changes)");
        summary.processed++;
        summary.totalChunks += chunks.length;
        continue;
      }

      // Live Ingestion with Transaction and Idempotency
      console.log("\nBeginning embedding generation and database insertion...");

      try {
        await client.query("BEGIN");

        // Idempotency: Safely remove existing embeddings for this policy file if force was requested
        const delRes = await client.query(
          "DELETE FROM policy_embeddings WHERE policy_file_id = $1",
          [policy.id]
        );
        if (delRes.rowCount && delRes.rowCount > 0) {
          console.log(`Cleared ${delRes.rowCount} previous embedding(s) for policy ID ${policy.id}.`);
        }

        // Generate embeddings in batches of 10 for efficiency and reliability
        const batchSize = 10;
        const allVectors: number[][] = [];
        for (let b = 0; b < chunks.length; b += batchSize) {
          const batchChunks = chunks.slice(b, b + batchSize);
          process.stdout.write(`  Generating embeddings for chunks ${b + 1} to ${b + batchChunks.length} of ${chunks.length}... `);
          const vectors = await generateEmbeddingsBatch(
            batchChunks.map((c) => c.content),
            embeddingModel,
            dimensions,
            apiKey!
          );
          allVectors.push(...vectors);
          console.log("✓ Done");
        }

        // Insert chunks into policy_embeddings
        for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
          const chunk = chunks[cIdx];
          const vector = allVectors[cIdx];
          const metadata = {
            ...chunk.metadata,
            embedding_model: embeddingModel,
            dimensions,
            source_type: "bank_policy_files",
            chunk_index: chunk.index,
            total_chunks: chunks.length,
            char_count: chunk.charCount,
          };

          await client.query(
            `INSERT INTO policy_embeddings (
              policy_file_id,
              bank_id,
              file_name,
              chunk_index,
              content,
              embedding,
              metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              policy.id,
              policy.bank_id,
              policy.file_name,
              chunk.index,
              chunk.content,
              JSON.stringify(vector),
              JSON.stringify(metadata),
            ]
          );
        }

        await client.query("COMMIT");
        console.log(`[INGEST]
policy_file_id: ${policy.id}
bank_id: ${policy.bank_id}
file_name: ${policy.file_name}
chunk count: ${chunks.length}
inserted count: ${chunks.length}
skipped count: 0
errors: 0
\n`);
        summary.processed++;
        summary.totalChunks += chunks.length;
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error(`[ERROR]
policy_file_id: ${policy.id}
bank_id: ${policy.bank_id}
file_name: ${policy.file_name}
chunk count: ${chunks.length}
inserted count: 0
skipped count: 0
errors: 1 (${err.message})
\n`);
        summary.failed++;
        summary.failedFiles.push(policy.file_name);
        throw err; // Stop on error as instructed
      }
    }

    console.log("========================================");
    console.log("Ingestion Summary");
    console.log("========================================");
    console.log(`Policies Processed: ${summary.processed}`);
    console.log(`Policies Skipped:   ${summary.skipped}`);
    console.log(`Total Chunks:       ${summary.totalChunks}`);
    console.log(`Failed Policies:    ${summary.failed}`);
    if (summary.failedFiles.length > 0) {
      console.log(`Failed Files:       ${summary.failedFiles.join(", ")}`);
    }
    console.log("========================================\n");
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute if run directly
if (require.main === module || process.argv[1]?.endsWith("ingest-policy-embeddings.ts")) {
  main().catch((err) => {
    console.error("\n❌ Fatal Ingestion Script Failure:", err.message);
    process.exit(1);
  });
}
