/**
 * Reusable Policy Embedding Semantic Retrieval Module
 * 
 * Embeds natural language queries using OpenRouter (google/gemini-embedding-2)
 * and retrieves the closest matching policy chunks from PostgreSQL using pgvector (<=>).
 */

import pool from "./db";
import * as dotenv from "dotenv";
import * as path from "path";

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export interface SearchPolicyEmbeddingsOptions {
  query: string;
  policyFileId?: number;
  bankId?: number;
  topK?: number;
}

export interface PolicySearchResult {
  id: number;
  policy_file_id: number;
  bank_id: number;
  file_name: string;
  chunk_index: number;
  content: string;
  distance: number;
  similarity: number;
  metadata: Record<string, any>;
}

/**
 * Generate 1536-dimensional query embedding via OpenRouter API with retry support.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.EMBEDDING_MODEL || "google/gemini-embedding-2";
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS) || 1536;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not defined in environment");
  }

  let attempt = 0;
  const maxRetries = 3;
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
          input: query,
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
          await new Promise((r) => setTimeout(r, delayMs));
          delayMs *= 2;
          continue;
        }

        throw new Error(`OpenRouter HTTP ${response.status}: ${bodyText}`);
      }

      const parsed = JSON.parse(bodyText);
      const vector = parsed?.data?.[0]?.embedding;

      if (!Array.isArray(vector)) {
        throw new Error("Invalid embedding response: vector is not an array");
      }

      if (vector.length !== dimensions) {
        throw new Error(
          `Dimension mismatch: expected ${dimensions}, but received ${vector.length}`
        );
      }

      return vector;
    } catch (err: any) {
      if (attempt < maxRetries && !err.message?.includes("HTTP 401") && !err.message?.includes("HTTP 400")) {
        attempt++;
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
      } else {
        throw err;
      }
    }
  }

  throw new Error(`Failed to generate query embedding after ${maxRetries} retries`);
}

/**
 * Searches policy_embeddings table using pgvector cosine distance (<=>).
 * Employs strictly parameterized SQL.
 */
export async function searchPolicyEmbeddings(
  options: SearchPolicyEmbeddingsOptions
): Promise<PolicySearchResult[]> {
  const { query, policyFileId, bankId, topK = 5 } = options;

  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("A non-empty query string is required for semantic search");
  }

  // 1. Generate query vector
  const queryVector = await generateQueryEmbedding(query.trim());
  const vectorStr = JSON.stringify(queryVector);

  // 2. Build parameterized query
  const conditions: string[] = [];
  const params: any[] = [vectorStr]; // $1 is query vector

  if (policyFileId !== undefined && policyFileId !== null) {
    params.push(policyFileId);
    conditions.push(`policy_file_id = $${params.length}`);
  }

  if (bankId !== undefined && bankId !== null) {
    params.push(bankId);
    conditions.push(`bank_id = $${params.length}`);
  }

  params.push(topK);
  const limitParamIndex = params.length;

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      id,
      policy_file_id,
      bank_id,
      file_name,
      chunk_index,
      content,
      metadata,
      (embedding <=> $1::vector) AS distance,
      (1 - (embedding <=> $1::vector)) AS similarity
    FROM policy_embeddings
    ${whereClause}
    ORDER BY distance ASC
    LIMIT $${limitParamIndex};
  `;

  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows.map((row) => ({
      id: Number(row.id),
      policy_file_id: Number(row.policy_file_id),
      bank_id: Number(row.bank_id),
      file_name: row.file_name,
      chunk_index: Number(row.chunk_index),
      content: row.content,
      distance: parseFloat(row.distance),
      similarity: parseFloat(row.similarity),
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {},
    }));
  } finally {
    client.release();
  }
}
