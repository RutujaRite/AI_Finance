// lib/ai/policyRetrieval.ts
/**
 * Reusable Policy Embedding Semantic Retrieval Module with Strict SQL Parameterized Filtering
 *
 * Enforces PostgreSQL-level parameterized WHERE filters for:
 * 1. Lender ID (`bank_id = $x` and `policy_file_id = $y`) preventing Cross-Lender Leakage (Failure D).
 * 2. Loan Category (`loan_category = 'PERSONAL_LOAN'` and `file_name NOT ILIKE '%home_loan%'`) preventing Product Misclassification (Failures A & E).
 * 3. Demo document exclusion from normal queries.
 */

import pool from "@/lib/db";
import * as dotenv from "dotenv";
import * as path from "path";
import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import type { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { resolvePolicyTarget, PolicyTarget } from "@/lib/policyRag";

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export interface SearchPolicyEmbeddingsOptions {
  query: string;
  policyFileId?: number;
  bankId?: number;
  bankName?: string;
  loanCategory?: "PERSONAL_LOAN" | "HOME_LOAN" | "ALL";
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
  loan_category?: string;
  metadata: Record<string, any>;
}

// In-memory cache for query embeddings to deduplicate identical calls within the same turn/session (60s TTL)
const queryEmbeddingCache = new Map<string, { embedding: number[]; expiresAt: number }>();

/**
 * Generate 1536-dimensional query embedding via OpenRouter API with retry support and in-memory deduplication.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const normalizedQuery = (query || "").trim().toLowerCase();
  const cached = queryEmbeddingCache.get(normalizedQuery);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.embedding;
  }

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
        if (response.status === 400 || response.status === 401 || response.status === 402 || response.status === 403) {
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

      // Cache for 60 seconds (deduplicates parallel/consecutive calls in same turn)
      queryEmbeddingCache.set(normalizedQuery, {
        embedding: vector,
        expiresAt: Date.now() + 60000,
      });

      return vector;
    } catch (err: any) {
      if (
        attempt < maxRetries &&
        !err.message?.includes("HTTP 401") &&
        !err.message?.includes("HTTP 402") &&
        !err.message?.includes("HTTP 400") &&
        !err.message?.includes("HTTP 403")
      ) {
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
    additions.push("Monthly NTH Requirements Minimum Salary Net Take Home Income Section 7");
    highSignalTerms.push("salary", "nth", "income", "monthly", "1,07,874", "30,000", "20,000");
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

  if (additions.length === 0) {
    additions.push("Eligibility Criteria Minimum CIBIL Score Net Take Home Salary NTH Age Limits FOIR Norms Loan Parameters Mandatory Documents Rejection Rules");
    highSignalTerms.push("eligibility", "criteria", "cibil", "salary", "nth", "age", "foir", "documents");
    targetDomain = "General_Policy";
  }

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
 * Searches policy embeddings using PostgreSQL pgvector similarity search with Reciprocal Rank Fusion (RRF).
 * Strictly enforces SQL-level parameterized WHERE filters for lender ID and product category.
 */
export async function searchPolicyEmbeddings(
  options: SearchPolicyEmbeddingsOptions
): Promise<PolicySearchResult[]> {
  let { query, policyFileId, bankId, bankName, loanCategory, topK = 5 } = options;
  const targetK = Math.max(topK ?? 5, 4);

  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("A non-empty query string is required for semantic search");
  }

  // If lender is not specified by ID, resolve target strictly from query or bankName
  if (!policyFileId && !bankId) {
    const target = await resolvePolicyTarget(bankName || query);
    if (target) {
      policyFileId = target.policyFileId;
      bankId = target.bankId;
    }
  }

  const rewrite = rewritePolicyQuery(query);

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
      loan_category?: string;
      metadata: Record<string, any>;
      denseRank?: number;
      sparseRank?: number;
      rrfScore?: number;
    }

    const candidateMap = new Map<number, CandidateChunk>();

    // 1. Dense Vector Search with Strict PostgreSQL Parameterized WHERE Filters
    if (queryVector) {
      const vectorStr = JSON.stringify(queryVector);
      const conditions: string[] = ["embedding IS NOT NULL"];
      const params: any[] = [vectorStr]; // $1 = query vector

      // Strict Lender Parameterization (Failure D isolation)
      if (policyFileId !== undefined && policyFileId !== null) {
        params.push(policyFileId);
        conditions.push(`policy_file_id = $${params.length}`);
      }
      if (bankId !== undefined && bankId !== null) {
        params.push(bankId);
        conditions.push(`bank_id = $${params.length}`);
      }

      // Strict Loan Product Category Isolation (Failure E isolation)
      if (loanCategory === "HOME_LOAN") {
        conditions.push("(file_name ILIKE '%home_loan%' OR bank_id = 19 OR loan_category = 'HOME_LOAN')");
      } else if (loanCategory === "PERSONAL_LOAN" || !loanCategory) {
        if (bankId !== 19) {
          conditions.push("(file_name NOT ILIKE '%home_loan%' AND bank_id != 19 AND (loan_category = 'PERSONAL_LOAN' OR loan_category IS NULL))");
        }
      }

      // Strict Demo Document Exclusion
      conditions.push("(file_name NOT ILIKE '%demo%' AND file_name NOT ILIKE '%sample%')");

      params.push(25);
      const limitParamIndex = params.length;
      const whereClause = `WHERE ${conditions.join(" AND ")}`;

      const vectorSql = `
        SELECT
          id,
          policy_file_id,
          bank_id,
          file_name,
          chunk_index,
          content,
          metadata,
          loan_category,
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
          loan_category: row.loan_category,
          metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {},
          denseRank: rank,
        });
      }
    }

    // 2. Sparse Keyword Search with Identical Strict Parameterized WHERE Filters
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

      if (loanCategory === "HOME_LOAN") {
        kConditions.push("(file_name ILIKE '%home_loan%' OR bank_id = 19 OR loan_category = 'HOME_LOAN')");
      } else if (loanCategory === "PERSONAL_LOAN" || !loanCategory) {
        if (bankId !== 19) {
          kConditions.push("(file_name NOT ILIKE '%home_loan%' AND bank_id != 19 AND (loan_category = 'PERSONAL_LOAN' OR loan_category IS NULL))");
        }
      }

      kConditions.push("(file_name NOT ILIKE '%demo%' AND file_name NOT ILIKE '%sample%')");

      const orClauses = rewrite.highSignalTerms.map((t) => {
        kParams.push(`%${t}%`);
        return `content ILIKE $${kParams.length}`;
      });
      kConditions.push(`(${orClauses.join(" OR ")})`);

      kParams.push(40);
      const kLimitIndex = kParams.length;
      const kWhereClause = `WHERE ${kConditions.join(" AND ")}`;

      const keywordSql = `
        SELECT
          id,
          policy_file_id,
          bank_id,
          file_name,
          chunk_index,
          content,
          metadata,
          loan_category
        FROM policy_embeddings
        ${kWhereClause}
        LIMIT $${kLimitIndex};
      `;

      const keywordRes = await client.query(keywordSql, kParams);

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
            loan_category: row.loan_category,
            metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {},
            sparseRank: rank,
          });
        }
      }
    }

    // 3. Reciprocal Rank Fusion (RRF) & Re-ranking
    const candidates = Array.from(candidateMap.values());
    const RRF_K = 60;

    for (const c of candidates) {
      const denseScore = c.denseRank !== undefined ? 1 / (RRF_K + c.denseRank) : 0;
      const sparseScore = c.sparseRank !== undefined ? 1 / (RRF_K + c.sparseRank) : 0;
      let rrf = denseScore + sparseScore;

      if (c.similarity && !isNaN(c.similarity)) {
        rrf += Math.max(0, c.similarity) * 0.15;
      }

      const chunkDomain = c.metadata?.eligibilityDomain;
      if (rewrite.targetDomain && chunkDomain && chunkDomain === rewrite.targetDomain) {
        rrf += 0.025;
      }

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

    candidates.sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0));
    const selected = candidates.slice(0, targetK);
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
      loan_category: s.loan_category,
      metadata: s.metadata,
    }));
  } finally {
    client.release();
  }
}

export interface PolicyRetrieverInput extends BaseRetrieverInput {
  policyFileId?: number;
  bankId?: number;
  bankName?: string;
  bankCode?: string;
  fileName?: string;
  loanCategory?: "PERSONAL_LOAN" | "HOME_LOAN" | "ALL";
  topK?: number;
}

/**
 * LangChain native BaseRetriever wrapper for pgvector policy chunks.
 */
export class PolicyPgVectorRetriever extends BaseRetriever {
  lc_namespace = ["langchain", "retrievers", "policy_pgvector"];
  policyFileId?: number;
  bankId?: number;
  bankName?: string;
  bankCode?: string;
  fileName?: string;
  loanCategory?: "PERSONAL_LOAN" | "HOME_LOAN" | "ALL";
  topK: number;

  constructor(fields?: PolicyRetrieverInput) {
    super(fields);
    this.policyFileId = fields?.policyFileId;
    this.bankId = fields?.bankId;
    this.bankName = fields?.bankName;
    this.bankCode = fields?.bankCode;
    this.fileName = fields?.fileName;
    this.loanCategory = fields?.loanCategory;
    this.topK = Math.max(fields?.topK ?? 6, 6);
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    if (!this.policyFileId && !this.bankId) {
      const target = this.bankName ? await resolvePolicyTarget(this.bankName) : await resolvePolicyTarget(query);
      if (target) {
        this.bankId = target.bankId;
        this.policyFileId = target.policyFileId;
        this.bankName = target.bankName;
        this.fileName = target.fileName;
      } else {
        console.warn(
          "[PolicyPgVectorRetriever] Invoked without lender constraint and unable to resolve lender from query. Refusing unconstrained retrieval."
        );
        return [];
      }
    }

    const results = await searchPolicyEmbeddings({
      query,
      policyFileId: this.policyFileId,
      bankId: this.bankId,
      loanCategory: this.loanCategory,
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
            loanCategory: r.loan_category,
            ...(typeof r.metadata === "object" ? r.metadata : {}),
          },
        })
    );
  }
}
