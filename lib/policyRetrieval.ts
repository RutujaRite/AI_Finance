/**
 * Reusable Policy Embedding Semantic Retrieval Module
 * 
 * Embeds natural language queries using OpenRouter (google/gemini-embedding-2)
 * and retrieves the closest matching policy chunks from PostgreSQL using pgvector (<=>).
 */

import pool from "./db";
import * as dotenv from "dotenv";
import * as path from "path";
import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import type { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";

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

export interface QueryRewriteResult {
  expandedQuery: string;
  highSignalTerms: string[];
  targetDomain?: string;
}

/**
 * Lightweight Query Rewriter: Converts colloquial user queries into formal policy document taxonomy.
 */
export function rewritePolicyQuery(rawQuery: string): QueryRewriteResult {
  const q = rawQuery.toLowerCase();
  const additions: string[] = [];
  const highSignalTerms: string[] = [];
  let targetDomain: string | undefined = undefined;

  if (/\b(?:cibil|credit\s*score|score)\b/i.test(q)) {
    additions.push("CIBIL Score Requirements Minimum CIBIL inquiry score cutoff");
    highSignalTerms.push("cibil", "score", "inquiry");
    targetDomain = "CIBIL";
  }
  if (/\b(?:salary|nth|income|nmi|net|take[\s-]*home|pay)\b/i.test(q)) {
    additions.push("Monthly NTH Requirements Minimum Salary Net Take Home Income");
    highSignalTerms.push("salary", "nth", "income", "monthly");
    targetDomain = targetDomain ? "Multi_Domain" : "Salary_Income";
  }
  if (/\b(?:age|years?\s*old|maximum\s*age|min(?:imum)?\s*age)\b/i.test(q)) {
    additions.push("Age Requirements Minimum Age Maximum Age Salaried SEP");
    highSignalTerms.push("age", "salaried", "sep", "years");
    targetDomain = targetDomain ? "Multi_Domain" : "Age_Employment";
  }
  if (/\b(?:category|categories|cat\s*[a-e]|company\s*cat\w*|employer|super\s*cat)\b/i.test(q)) {
    additions.push("Company Employer Categories Listed Unlisted CAT A CAT B CAT C CAT D Super Cat A Minimum Salary Net Take Home NTH");
    highSignalTerms.push("cat a", "cat b", "cat c", "cat d", "categories", "category", "super cat a");
    targetDomain = targetDomain ? "Multi_Domain" : "Company_Category";
  }
  if (/\b(?:roi|interest|rate|pricing|charges|fee|fees)\b/i.test(q)) {
    additions.push("Pricing ROI Interest Rate Processing Fees Grid Special Rates");
    highSignalTerms.push("pricing", "roi", "interest", "fee");
    targetDomain = targetDomain ? "Multi_Domain" : "Pricing_ROI";
  }
  if (/\b(?:doc|document|documents|paperwork|statement|payslip|itr|kyc)\b/i.test(q)) {
    additions.push("Mandatory Documents KYC Bank Statement Salary Slip ITR");
    highSignalTerms.push("document", "documents", "statement", "payslip", "itr");
    targetDomain = targetDomain ? "Multi_Domain" : "Documents";
  }
  if (/\b(?:employment|work\s*exp\w*|vintage|stability|contractual)\b/i.test(q)) {
    additions.push("Work Experience Business Stability Residence Stability Employment Types");
    highSignalTerms.push("experience", "vintage", "stability", "employment");
    targetDomain = targetDomain ? "Multi_Domain" : "Age_Employment";
  }
  if (/\b(?:loan\s*amount|max\s*loan|min\s*loan|tenure|months)\b/i.test(q)) {
    additions.push("Loan Parameters Loan Amount Limits Minimum Maximum Tenure Months");
    highSignalTerms.push("loan", "tenure", "limit");
    targetDomain = targetDomain ? "Multi_Domain" : "Loan_Parameters";
  }
  if (/\b(?:foir|multiplier|obligation)\b/i.test(q)) {
    additions.push("FOIR Multiplier Rules Existing Obligations");
    highSignalTerms.push("foir", "multiplier", "obligation");
    targetDomain = targetDomain ? "Multi_Domain" : "FOIR_Obligations";
  }

  // Extract residual high-signal tokens
  const extractedWords = q
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !["what", "which", "are", "the", "for", "and", "bank", "policy", "tell", "give", "please", "with", "from", "each", "does", "have"].includes(w)
    );

  for (const w of extractedWords) {
    if (!highSignalTerms.includes(w)) highSignalTerms.push(w);
  }

  const expandedQuery = additions.length > 0 ? `${rawQuery.trim()} ${additions.join(" ")}` : rawQuery.trim();

  return {
    expandedQuery,
    highSignalTerms,
    targetDomain,
  };
}

/**
 * Internal low-level SQL execution for pgvector similarity search with Reciprocal Rank Fusion (RRF).
 * Constrains retrieval directly in PostgreSQL (WHERE policy_file_id = $policyFileId).
 * Strictly called by PolicyPgVectorRetriever.
 */
async function searchPolicyEmbeddingsInternal(
  options: SearchPolicyEmbeddingsOptions
): Promise<PolicySearchResult[]> {
  const { query, policyFileId, bankId, topK = 5 } = options;
  const targetK = Math.max(topK ?? 5, 4);

  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("A non-empty query string is required for semantic search");
  }

  // 1. Lightweight Query Rewriting
  const rewrite = rewritePolicyQuery(query);

  // 2. Concurrently generate query embedding and acquire PostgreSQL connection
  const [queryVector, client] = await Promise.all([
    generateQueryEmbedding(rewrite.expandedQuery).catch((embedErr) => {
      console.warn(
        "[PolicyRetrieval] Query embedding generation failed or rate-limited, falling back to PostgreSQL lexical search:",
        embedErr instanceof Error ? embedErr.message : embedErr
      );
      return null;
    }),
    pool.connect(),
  ]);

  try {
    interface CandidateChunk {
      id: number;
      policy_file_id: number;
      bank_id: number;
      file_name: string;
      chunk_index: number;
      content: string;
      distance: number;
      similarity: number;
      metadata: Record<string, any>;
      denseRank?: number;
      sparseRank?: number;
      rrfScore?: number;
    }

    const candidateMap = new Map<number, CandidateChunk>();

    // 3. Dense Vector Search (Top 10 candidates)
    if (queryVector) {
      const vectorStr = JSON.stringify(queryVector);
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

      params.push(25); // Dense candidate pool (increased for higher recall and similarity)
      const limitParamIndex = params.length;
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const vectorSql = `
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

      const vectorRes = await client.query(vectorSql, params);
      for (let rank = 0; rank < vectorRes.rows.length; rank++) {
        const row = vectorRes.rows[rank];
        const idx = Number(row.chunk_index);
        candidateMap.set(idx, {
          id: Number(row.id),
          policy_file_id: Number(row.policy_file_id),
          bank_id: Number(row.bank_id),
          file_name: row.file_name,
          chunk_index: idx,
          content: row.content,
          distance: parseFloat(row.distance),
          similarity: parseFloat(row.similarity),
          metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {},
          denseRank: rank,
        });
      }
    }

    // 4. Sparse Keyword Search (Top 25 candidates, ranked by keyword relevance)
    if (rewrite.highSignalTerms.length > 0) {
      const kConditions: string[] = [];
      const kParams: any[] = [];

      if (policyFileId !== undefined && policyFileId !== null) {
        kParams.push(policyFileId);
        kConditions.push(`policy_file_id = $${kParams.length}`);
      }

      if (bankId !== undefined && bankId !== null) {
        kParams.push(bankId);
        kConditions.push(`bank_id = $${kParams.length}`);
      }

      const orClauses = rewrite.highSignalTerms.map((t) => {
        kParams.push(`%${t}%`);
        return `content ILIKE $${kParams.length}`;
      });
      kConditions.push(`(${orClauses.join(" OR ")})`);

      kParams.push(40); // Expanded sparse candidate pool across entire document
      const kLimitIndex = kParams.length;
      const kWhereClause = kConditions.length > 0 ? `WHERE ${kConditions.join(" AND ")}` : "";

      const keywordSql = `
        SELECT
          id,
          policy_file_id,
          bank_id,
          file_name,
          chunk_index,
          content,
          metadata
        FROM policy_embeddings
        ${kWhereClause}
        LIMIT $${kLimitIndex};
      `;

      const keywordRes = await client.query(keywordSql, kParams);

      // Rank keyword candidate rows by number of matched high-signal terms
      const sortedKeywordRows = [...keywordRes.rows].sort((a: any, b: any) => {
        const aContent = (a.content || "").toLowerCase();
        const bContent = (b.content || "").toLowerCase();
        let aScore = 0;
        let bScore = 0;
        for (const t of rewrite.highSignalTerms) {
          const tLower = t.toLowerCase();
          if (aContent.includes(tLower)) aScore++;
          if (bContent.includes(tLower)) bScore++;
        }
        return bScore - aScore;
      });

      for (let rank = 0; rank < sortedKeywordRows.length; rank++) {
        const row = sortedKeywordRows[rank];
        const idx = Number(row.chunk_index);
        if (candidateMap.has(idx)) {
          candidateMap.get(idx)!.sparseRank = rank;
        } else {
          candidateMap.set(idx, {
            id: Number(row.id),
            policy_file_id: Number(row.policy_file_id),
            bank_id: Number(row.bank_id),
            file_name: row.file_name,
            chunk_index: idx,
            content: row.content,
            distance: 0.25 + 0.01 * rank,
            similarity: 0.85 - 0.01 * rank,
            metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {},
            sparseRank: rank,
          });
        }
      }
    }

    // 5. Reciprocal Rank Fusion (RRF) & Fast Reranking
    // Formula: RRF(d) = (1 / (60 + denseRank)) + (1 / (60 + sparseRank)) + similarity_bonus
    const candidates = Array.from(candidateMap.values());
    const RRF_K = 60;

    for (const c of candidates) {
      const denseScore = c.denseRank !== undefined ? 1 / (RRF_K + c.denseRank) : 0;
      const sparseScore = c.sparseRank !== undefined ? 1 / (RRF_K + c.sparseRank) : 0;
      let rrf = denseScore + sparseScore;

      // Direct Vector DB Cosine Similarity weighting bonus: boosts chunks with high vector similarity
      if (c.similarity && !isNaN(c.similarity)) {
        rrf += Math.max(0, c.similarity) * 0.15;
      }

      // Fast reranking bonus: Domain match
      const chunkDomain = c.metadata?.eligibilityDomain;
      if (rewrite.targetDomain && chunkDomain && chunkDomain === rewrite.targetDomain) {
        rrf += 0.025;
      }

      // Fast reranking bonus: High-signal keyword density
      const textLower = c.content.toLowerCase();
      let termHits = 0;
      for (const term of rewrite.highSignalTerms) {
        if (textLower.includes(term.toLowerCase())) {
          termHits++;
        }
      }
      rrf += termHits * 0.005;

      c.rrfScore = rrf;
    }

    // Sort by fused RRF score descending
    candidates.sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0));

    // Trim down context size to Top-K (K=4 to 6)
    const selected = candidates.slice(0, targetK);

    // Sort selected chunks deterministically by chunk_index ascending
    selected.sort((a, b) => a.chunk_index - b.chunk_index);

    return selected.map((s) => ({
      id: s.id,
      policy_file_id: s.policy_file_id,
      bank_id: s.bank_id,
      file_name: s.file_name,
      chunk_index: s.chunk_index,
      content: s.content,
      distance: s.distance,
      similarity: s.similarity,
      metadata: s.metadata,
    }));
  } finally {
    client.release();
  }
}

/**
 * @internal Retained strictly for backward compatibility with isolated test harness scripts.
 * Direct application-level callers must use PolicyPgVectorRetriever.
 */
export const searchPolicyEmbeddings = searchPolicyEmbeddingsInternal;

export interface PolicyRetrieverInput extends BaseRetrieverInput {
  policyFileId?: number;
  bankId?: number;
  bankName?: string;
  bankCode?: string;
  fileName?: string;
  topK?: number;
}

/**
 * LangChain native BaseRetriever wrapper for pgvector policy chunks.
 * Canonical retrieval entry point for all policy RAG operations.
 */
export class PolicyPgVectorRetriever extends BaseRetriever {
  lc_namespace = ["langchain", "retrievers", "policy_pgvector"];
  policyFileId?: number;
  bankId?: number;
  bankName?: string;
  bankCode?: string;
  fileName?: string;
  topK: number;

  constructor(fields?: PolicyRetrieverInput) {
    super(fields);
    this.policyFileId = fields?.policyFileId;
    this.bankId = fields?.bankId;
    this.bankName = fields?.bankName;
    this.bankCode = fields?.bankCode;
    this.fileName = fields?.fileName;
    this.topK = Math.max(fields?.topK ?? 6, 6);
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    // Constraint check: Refuse unconstrained retrieval across all banks
    if (!this.policyFileId && !this.bankId) {
      console.warn(
        "[PolicyPgVectorRetriever] Invoked without policyFileId or bankId constraint. Refusing unconstrained retrieval."
      );
      return [];
    }

    const results = await searchPolicyEmbeddingsInternal({
      query,
      policyFileId: this.policyFileId,
      bankId: this.bankId,
      topK: this.topK,
    });

    return results.map(
      (r) =>
        new Document({
          pageContent: r.content,
          metadata: {
            id: r.id,
            policyFileId: r.policy_file_id,
            bankId: r.bank_id,
            bankName: this.bankName || (r.metadata?.bankName as string) || "",
            bankCode: this.bankCode || (r.metadata?.bankCode as string) || "",
            fileName: this.fileName || r.file_name,
            chunkIndex: r.chunk_index,
            distance: r.distance,
            similarity: r.similarity,
            ...(typeof r.metadata === "object" ? r.metadata : {}),
          },
        })
    );
  }
}

