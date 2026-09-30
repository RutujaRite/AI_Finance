/**
 * CreditWise Policy RAG Answer Pipeline
 * 
 * Flow:
 *   User policy question
 *       ↓
 *   Policy RAG retrieval (searchPolicyEmbeddings)
 *       ↓
 *   Retrieved policy chunks
 *       ↓
 *   Grounded RAG prompt
 *       ↓
 *   OpenRouter chat LLM (simpleOpenRouterChat)
 *       ↓
 *   Answer + sources
 */

import pool from "./db";
import { searchPolicyEmbeddings, PolicySearchResult } from "./policyRetrieval";
import { simpleOpenRouterChat, OpenRouterMessage } from "./openrouter";

export interface PolicyRecordLookup {
  policyFileId: number;
  bankId: number;
  bankName: string;
  bankCode: string;
  fileName: string;
}

let cachedDbPolicies: PolicyRecordLookup[] | null = null;
let lastDbPolicyFetch = 0;

export async function getDbPolicyLookup(): Promise<PolicyRecordLookup[]> {
  const now = Date.now();
  if (cachedDbPolicies && now - lastDbPolicyFetch < 60000) {
    return cachedDbPolicies;
  }
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT
        bpf.id AS policy_file_id,
        bpf.bank_id,
        b.name AS bank_name,
        b.code AS bank_code,
        bpf.file_name
      FROM bank_policy_files bpf
      JOIN banks b ON b.id = bpf.bank_id
      WHERE bpf.file_type = '.txt'
      ORDER BY bpf.id ASC
    `);
    cachedDbPolicies = res.rows.map((r: any) => ({
      policyFileId: Number(r.policy_file_id),
      bankId: Number(r.bank_id),
      bankName: r.bank_name,
      bankCode: r.bank_code,
      fileName: r.file_name,
    }));
    lastDbPolicyFetch = now;
    return cachedDbPolicies;
  } catch (err) {
    console.error("Error fetching db policy lookup:", err);
    return cachedDbPolicies || [];
  } finally {
    client.release();
  }
}

export async function resolveDbPolicy(bankNameOrQuery: string): Promise<PolicyRecordLookup | null> {
  const policies = await getDbPolicyLookup();
  const q = (bankNameOrQuery || "").toLowerCase().trim();
  if (!q) return null;

  // 1. Exact match on bankCode or bankName
  let found = policies.find(
    (p) => p.bankCode.toLowerCase() === q || p.bankName.toLowerCase() === q
  );
  if (found) return found;

  // 2. Specific multi-word distinctions:
  // Axis Finance (policy 2, AFL) vs Axis Bank (policy 3, AXIS)
  if (q.includes("axis") && (q.includes("finance") || q.includes("afl"))) {
    return policies.find((p) => p.policyFileId === 2) || null;
  }
  if (q.includes("axis")) {
    return policies.find((p) => p.policyFileId === 3) || null;
  }

  // Bajaj Markets (policy 5) vs Bajaj Finserv (policy 4)
  if (q.includes("bajaj") && (q.includes("market") || q.includes("bfl"))) {
    return policies.find((p) => p.policyFileId === 5) || null;
  }
  if (q.includes("bajaj")) {
    return policies.find((p) => p.policyFileId === 4) || null;
  }

  // L&T Finance (policy 8)
  if (q.includes("l&t") || q.includes("ltf") || q.includes("lt finance")) {
    return policies.find((p) => p.policyFileId === 8) || null;
  }

  // 3. Normalized substring match
  const qNorm = q.replace(/bank|finance|capital|limited|ltd/gi, "").trim();
  if (qNorm) {
    found = policies.find((p) => {
      const pNorm = p.bankName.toLowerCase().replace(/bank|finance|capital|limited|ltd/gi, "").trim();
      return pNorm.includes(qNorm) || qNorm.includes(pNorm) || p.bankCode.toLowerCase().includes(qNorm);
    });
    if (found) return found;

    // 4. File name match
    found = policies.find((p) => p.fileName.toLowerCase().includes(qNorm));
    if (found) return found;
  }

  return null;
}

export interface PolicyRagOptions {
  query: string;
  policyFileId?: number;
  bankId?: number;
  topK?: number;
}

export interface PolicyRagSource {
  policyFileId: number;
  bankId: number;
  fileName: string;
  chunkIndex: number;
  similarity: number;
}

export interface PolicyRagAnswer {
  answer: string;
  sources: PolicyRagSource[];
  retrievedChunks: number;
}

const RAG_SYSTEM_PROMPT = `You are answering a banking policy question using the supplied policy context.

Use ONLY the supplied policy context for policy-specific factual claims.

Do not invent, infer, estimate, or fill missing policy values.

If the supplied context does not contain enough information, explicitly say that the available policy context does not provide enough information.

Do not claim that a policy says something unless the retrieved context supports it.

When multiple retrieved chunks contain different conditions, preserve those conditions instead of collapsing them into one universal rule.

Keep the answer concise and directly answer the user's question.

If useful, mention the relevant condition/category/location/customer type from the policy.

Do not mention embeddings, vector databases, pgvector, retrieval pipelines, or internal implementation details to the user.

Do not output internal tokens, parser notes, or instructions (such as NOT_DEFINED, NEEDS_REVIEW, [REVIEW], [CONFLICT], postgresql). Explicitly state "Not specified in the available policy." instead.

Do not fabricate citations.`;

/**
 * Answers a user policy question strictly grounded in retrieved vector chunks.
 */
export async function answerPolicyWithRag(
  options: PolicyRagOptions
): Promise<PolicyRagAnswer> {
  const { query, policyFileId, bankId, topK = 5 } = options;

  // A. Validate query: Reject empty/whitespace-only queries
  if (!query || typeof query !== "string" || !query.trim()) {
    return {
      answer: "A valid, non-empty policy question is required.",
      sources: [],
      retrievedChunks: 0,
    };
  }

  // B. Retrieve policy chunks via pgvector semantic search
  const retrievedChunks: PolicySearchResult[] = await searchPolicyEmbeddings({
    query: query.trim(),
    policyFileId,
    bankId,
    topK,
  });

  // C. Handle zero results
  if (!retrievedChunks || retrievedChunks.length === 0) {
    return {
      answer: "I couldn't find sufficient information in the available bank policy data to answer that question.",
      sources: [],
      retrievedChunks: 0,
    };
  }

  // D. Build grounded context
  let policyContext = "";
  retrievedChunks.forEach((chunk, index) => {
    policyContext += `[POLICY SOURCE ${index + 1}]\n`;
    policyContext += `Bank: Bank ID ${chunk.bank_id}\n`;
    policyContext += `File: ${chunk.file_name}\n`;
    policyContext += `Chunk: ${chunk.chunk_index}\n`;
    policyContext += `Similarity: ${chunk.similarity.toFixed(4)}\n\n`;
    policyContext += `${chunk.content}\n\n`;
  });

  const userContent = `USER QUESTION:\n${query.trim()}\n\nPOLICY CONTEXT:\n${policyContext.trim()}`;

  const messages: OpenRouterMessage[] = [
    { role: "system", content: RAG_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  // E. Call the existing LLM client (simpleOpenRouterChat)
  const rawAnswer = await simpleOpenRouterChat(messages);
  let cleanAnswer = (rawAnswer || "").trim() || "The available policy context does not provide enough information.";
  cleanAnswer = cleanAnswer
    .replace(/\[REVIEW\]/gi, "")
    .replace(/\[CONFLICT\]/gi, "")
    .replace(/\bNOT_DEFINED\s*\/\s*NEEDS_REVIEW\b/gi, "Not specified in the available policy.")
    .replace(/\bNOT_DEFINED\b/gi, "Not specified in the available policy.")
    .replace(/\bNEEDS_REVIEW\b/gi, "Not specified in the available policy.")
    .replace(/\s{2,}/g, " ")
    .trim();

  // F. Return answer with genuine source metadata directly from searchPolicyEmbeddings
  const sources: PolicyRagSource[] = retrievedChunks.map((chunk) => ({
    policyFileId: chunk.policy_file_id,
    bankId: chunk.bank_id,
    fileName: chunk.file_name,
    chunkIndex: chunk.chunk_index,
    similarity: parseFloat(chunk.similarity.toFixed(4)),
  }));

  return {
    answer: cleanAnswer,
    sources,
    retrievedChunks: sources.length,
  };
}

// Backward-compatible alias
export const answerPolicyQuestion = answerPolicyWithRag;
