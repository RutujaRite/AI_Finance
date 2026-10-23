// lib/ai/dualSourceRag.ts
/**
 * Dual-Source PostgreSQL Vector DB Search Module
 *
 * Implements HNSW cosine similarity search across two distinct vector tables:
 * 1. Bank Policies: `bank_policy_embeddings` (23 Bank Policies, 1536-dim vector embeddings)
 * 2. Agent Knowledge Base: `agent_knowledge_embeddings` (Knowledge Chunks, 1536-dim vector embeddings)
 *
 * Routing logic:
 * - POLICY: Cosine similarity search in `bank_policy_embeddings` using pgvector `<=>` operator.
 * - AGENT_KNOWLEDGE: Cosine similarity search in `agent_knowledge_embeddings` using pgvector `<=>` operator.
 * - GENERAL: Bypasses strict vector document filtering, passing context directly to the LLM.
 */

import pool from "@/lib/db";
import { generateQueryEmbedding } from "@/lib/policyRetrieval";
import { resolvePolicyTarget } from "@/lib/policyRag";
import { QueryIntentMode, IntentRoutingResult } from "./intentRouting";

export interface BankPolicyChunkResult {
  id: number | string;
  policyFileId: number;
  bankId: number;
  fileName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  distance: number;
  loanCategory?: string;
  metadata?: Record<string, any>;
}

export interface AgentKnowledgeChunkResult {
  id: string;
  documentId: string;
  agentId?: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  distance: number;
  charCount?: number;
  metadata?: Record<string, any>;
  documentName?: string;
  documentInstruction?: string;
  documentGuardrail?: string;
}

export interface DualSourceRagResult {
  intent: QueryIntentMode;
  hasRelevantKnowledge: boolean;
  policyChunks: BankPolicyChunkResult[];
  agentChunks: AgentKnowledgeChunkResult[];
  groundingContext: string;
  sources: Array<{ name: string; type: "bank_policy" | "agent_knowledge"; similarity: number }>;
  confidence: number;
}

/**
 * Executes HNSW cosine similarity search across bank_policy_embeddings with strict product isolation.
 */
export async function searchBankPolicyEmbeddings(options: {
  query: string;
  bankId?: number;
  policyFileId?: number;
  bankName?: string;
  loanCategory?: "PERSONAL_LOAN" | "HOME_LOAN" | "BUSINESS_LOAN" | "EDUCATION_LOAN" | "ALL";
  topK?: number;
}): Promise<BankPolicyChunkResult[]> {
  let { query, bankId, policyFileId, bankName, loanCategory = "PERSONAL_LOAN", topK = 6 } = options;
  if (!query || !query.trim()) return [];

  // Strict SQL Parameterized Filtering: Resolve lender target from query or bankName if IDs omitted
  if (!policyFileId && !bankId) {
    const target = await resolvePolicyTarget(bankName || query);
    if (target) {
      policyFileId = target.policyFileId;
      bankId = target.bankId;
      bankName = target.bankName;
    }
  }

  const client = await pool.connect();
  try {
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await generateQueryEmbedding(query);
    } catch (embedErr) {
      console.warn("[DualSourceRAG] Query embedding generation failed, using keyword fallback:", embedErr);
    }

    if (queryEmbedding && Array.isArray(queryEmbedding)) {
      const vectorStr = JSON.stringify(queryEmbedding);
      const conditions: string[] = ["embedding IS NOT NULL"];
      const params: any[] = [vectorStr];

      // Strict Lender Parameterization (Failure D isolation)
      if (policyFileId !== undefined && policyFileId !== null) {
        params.push(policyFileId);
        conditions.push(`policy_file_id = $${params.length}`);
      }
      if (bankId !== undefined && bankId !== null) {
        params.push(bankId);
        conditions.push(`bank_id = $${params.length}`);
      } else if (bankName) {
        params.push(`%${bankName.toLowerCase().trim()}%`);
        conditions.push(`LOWER(file_name) LIKE $${params.length}`);
      }

      // Strict Loan Product Isolation (Failures A & E isolation)
      if (loanCategory === "HOME_LOAN") {
        conditions.push("(file_name ILIKE '%home_loan%' OR bank_id = 19 OR loan_category = 'HOME_LOAN')");
      } else if (loanCategory === "PERSONAL_LOAN") {
        conditions.push("(file_name NOT ILIKE '%home_loan%' AND bank_id != 19 AND (loan_category = 'PERSONAL_LOAN' OR loan_category IS NULL))");
      }

      // Strict Demo Document Exclusion
      conditions.push("(file_name NOT ILIKE '%demo%' AND file_name NOT ILIKE '%sample%')");

      params.push(topK);
      const limitIdx = params.length;
      const whereClause = `WHERE ${conditions.join(" AND ")}`;

      const sql = `
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
        FROM bank_policy_embeddings
        ${whereClause}
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $${limitIdx};
      `;

      try {
        const res = await client.query(sql, params);
        if (res.rows.length > 0) {
          return res.rows.map((r: any) => ({
            id: r.id,
            policyFileId: Number(r.policy_file_id),
            bankId: Number(r.bank_id),
            fileName: r.file_name,
            chunkIndex: Number(r.chunk_index),
            content: r.content,
            distance: parseFloat(r.distance),
            similarity: parseFloat(r.similarity),
            loanCategory: r.loan_category,
            metadata: r.metadata,
          }));
        }
      } catch (sqlErr) {
        console.warn("[DualSourceRAG] pgvector search in bank_policy_embeddings error:", sqlErr);
      }
    }

    // High-recall lexical fallback if vector search yielded no results or embedding failed
    const words = query
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 6);

    const conditions: string[] = [];
    const params: any[] = [];

    if (policyFileId !== undefined && policyFileId !== null) {
      params.push(policyFileId);
      conditions.push(`policy_file_id = $${params.length}`);
    }
    if (bankId !== undefined && bankId !== null) {
      params.push(bankId);
      conditions.push(`bank_id = $${params.length}`);
    } else if (bankName) {
      params.push(`%${bankName.toLowerCase().trim()}%`);
      conditions.push(`LOWER(file_name) LIKE $${params.length}`);
    }

    // Strict Loan Product Isolation in lexical fallback
    if (loanCategory === "HOME_LOAN") {
      conditions.push("(file_name ILIKE '%home_loan%' OR bank_id = 19 OR loan_category = 'HOME_LOAN')");
    } else if (loanCategory === "PERSONAL_LOAN") {
      conditions.push("(file_name NOT ILIKE '%home_loan%' AND bank_id != 19 AND (loan_category = 'PERSONAL_LOAN' OR loan_category IS NULL))");
    }

    // Strict Demo Document Exclusion in fallback
    conditions.push("(file_name NOT ILIKE '%demo%' AND file_name NOT ILIKE '%sample%')");

    if (words.length > 0) {
      const wordConds = words.map((w) => {
        params.push(`%${w}%`);
        return `content ILIKE $${params.length}`;
      });
      conditions.push(`(${wordConds.join(" OR ")})`);
    }

    params.push(topK);
    const limitIdx = params.length;
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const fallbackRes = await client.query(
      `SELECT id, policy_file_id, bank_id, file_name, chunk_index, content, metadata, loan_category
       FROM bank_policy_embeddings
       ${whereSql}
       ORDER BY chunk_index ASC
       LIMIT $${limitIdx};`,
      params
    );

    return fallbackRes.rows.map((r: any) => ({
      id: r.id,
      policyFileId: Number(r.policy_file_id),
      bankId: Number(r.bank_id),
      fileName: r.file_name,
      chunkIndex: Number(r.chunk_index),
      content: r.content,
      distance: 0.25,
      similarity: 0.75,
      loanCategory: r.loan_category,
      metadata: r.metadata,
    }));
  } finally {
    client.release();
  }
}

/**
 * Executes HNSW cosine similarity search across agent_knowledge_embeddings with strict demo isolation.
 */
export async function searchAgentKnowledgeEmbeddings(options: {
  query: string;
  agentId?: string;
  documentId?: string;
  includeDemo?: boolean;
  topK?: number;
}): Promise<AgentKnowledgeChunkResult[]> {
  const { query, agentId, documentId, includeDemo, topK = 6 } = options;
  if (!query || !query.trim()) return [];
  // Strict Agent Isolation: Never search agent knowledge without an explicit agentId
  if (!agentId) return [];

  const isDemoExplicitlyRequested =
    includeDemo === true ||
    /\b(?:demo|test\s*data|sample\s*data|fictional)\b/i.test(query);

  const client = await pool.connect();
  try {
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await generateQueryEmbedding(query);
    } catch (embedErr) {
      console.warn("[DualSourceRAG] Query embedding generation failed, using keyword fallback for agent knowledge:", embedErr);
    }

    let chunks: any[] = [];

    if (queryEmbedding && Array.isArray(queryEmbedding)) {
      const vectorStr = JSON.stringify(queryEmbedding);
      const conditions: string[] = ["embedding IS NOT NULL"];
      const params: any[] = [vectorStr];

      if (agentId) {
        params.push(agentId);
        conditions.push(`agent_id = $${params.length}`);
      }

      if (documentId) {
        params.push(documentId);
        conditions.push(`document_id = $${params.length}`);
      }

      // Strict Demo Isolation: Exclude demo chunks unless explicitly requested
      if (!isDemoExplicitlyRequested) {
        conditions.push("(metadata->>'documentName' NOT ILIKE '%demo%' AND metadata->>'documentName' NOT ILIKE '%sample%')");
      }

      params.push(topK);
      const limitIdx = params.length;
      const whereClause = `WHERE ${conditions.join(" AND ")}`;

      const sql = `
        SELECT
          id,
          document_id,
          agent_id,
          chunk_index,
          content,
          char_count,
          metadata,
          (embedding <=> $1::vector) AS distance,
          (1 - (embedding <=> $1::vector)) AS similarity
        FROM agent_knowledge_embeddings
        ${whereClause}
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $${limitIdx};
      `;

      try {
        const res = await client.query(sql, params);
        chunks = res.rows;
      } catch (sqlErr) {
        console.warn("[DualSourceRAG] pgvector search in agent_knowledge_embeddings error:", sqlErr);
      }
    }

    // Fallback if vector search was empty
    if (chunks.length === 0) {
      const words = query
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 6);

      const conditions: string[] = [];
      const params: any[] = [];

      if (agentId) {
        params.push(agentId);
        conditions.push(`agent_id = $${params.length}`);
      }
      if (documentId) {
        params.push(documentId);
        conditions.push(`document_id = $${params.length}`);
      }

      if (!isDemoExplicitlyRequested) {
        conditions.push("(metadata->>'documentName' NOT ILIKE '%demo%' AND metadata->>'documentName' NOT ILIKE '%sample%')");
      }

      if (words.length > 0) {
        const wordConds = words.map((w) => {
          params.push(`%${w}%`);
          return `content ILIKE $${params.length}`;
        });
        conditions.push(`(${wordConds.join(" OR ")})`);
      }

      params.push(topK);
      const limitIdx = params.length;
      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const fallbackRes = await client.query(
        `SELECT id, document_id, agent_id, chunk_index, content, char_count, metadata
         FROM agent_knowledge_embeddings
         ${whereSql}
         ORDER BY chunk_index ASC
         LIMIT $${limitIdx};`,
        params
      );
      chunks = fallbackRes.rows.map((r) => ({
        ...r,
        distance: 0.25,
        similarity: 0.75,
      }));
    }

    if (chunks.length === 0) return [];

    // Load document metadata, guardrails, and instructions
    const docIds = Array.from(new Set(chunks.map((c) => c.document_id).filter(Boolean)));
    const docMetaMap = new Map<string, { name: string; instruction?: string; guardrail?: string }>();

    if (docIds.length > 0) {
      try {
        const docSql = !isDemoExplicitlyRequested
          ? `SELECT id, name FROM knowledge_documents WHERE id = ANY($1) AND (is_demo IS NOT TRUE)`
          : `SELECT id, name FROM knowledge_documents WHERE id = ANY($1)`;
        const docRes = await client.query(docSql, [docIds]);
        for (const r of docRes.rows) {
          docMetaMap.set(r.id, { name: r.name });
        }

        const instRes = await client.query(
          `SELECT document_id, instruction_text FROM knowledge_document_instructions WHERE document_id = ANY($1)`,
          [docIds]
        );
        for (const r of instRes.rows) {
          const entry = docMetaMap.get(r.document_id) || { name: "Knowledge Document" };
          entry.instruction = r.instruction_text;
          docMetaMap.set(r.document_id, entry);
        }

        const guardRes = await client.query(
          `SELECT document_id, guardrail_text FROM knowledge_document_guardrails WHERE document_id = ANY($1)`,
          [docIds]
        );
        for (const r of guardRes.rows) {
          const entry = docMetaMap.get(r.document_id) || { name: "Knowledge Document" };
          entry.guardrail = r.guardrail_text;
          docMetaMap.set(r.document_id, entry);
        }
      } catch (metaErr) {
        console.warn("[DualSourceRAG] Error fetching document instructions/guardrails:", metaErr);
      }
    }

    return chunks
      .filter((c) => {
        if (!isDemoExplicitlyRequested) {
          const docName = (c.metadata?.documentName || "").toLowerCase();
          if (docName.includes("demo") || docName.includes("sample")) return false;
          if (c.document_id && !docMetaMap.has(c.document_id)) return false;
        }
        return true;
      })
      .map((c) => {
        const meta = docMetaMap.get(c.document_id);
        return {
          id: c.id,
          documentId: c.document_id,
          agentId: c.agent_id,
          chunkIndex: Number(c.chunk_index),
          content: c.content,
          similarity: parseFloat(c.similarity || "0.75"),
          distance: parseFloat(c.distance || "0.25"),
          charCount: c.char_count,
          metadata: c.metadata,
          documentName: meta?.name || "Knowledge Document",
          documentInstruction: meta?.instruction,
          documentGuardrail: meta?.guardrail,
        };
      });
  } finally {
    client.release();
  }
}

/**
 * Main dual-source retrieval coordinator adhering to routing rules:
 * - If intent is POLICY: search bank_policy_embeddings with strict loan product isolation.
 * - If intent is AGENT_KNOWLEDGE: search agent_knowledge_embeddings with demo isolation.
 * - If intent is GENERAL: bypass strict vector document filtering and allow LLM general intelligence.
 */
export async function performDualSourceRetrieval(options: {
  query: string;
  routing: IntentRoutingResult;
  agentId?: string;
  topK?: number;
}): Promise<DualSourceRagResult> {
  const { query, routing, agentId, topK = 6 } = options;

  // 1. GENERAL INTENT: Bypass strict vector document filtering
  if (routing.intent === "GENERAL") {
    return {
      intent: "GENERAL",
      hasRelevantKnowledge: false,
      policyChunks: [],
      agentChunks: [],
      groundingContext: "",
      sources: [],
      confidence: routing.confidence,
    };
  }

  // 2. AGENT_KNOWLEDGE INTENT: HNSW cosine similarity on agent_knowledge_embeddings
  if (routing.intent === "AGENT_KNOWLEDGE") {
    const agentChunks = await searchAgentKnowledgeEmbeddings({
      query,
      agentId,
      includeDemo: routing.isExplicitDemoRequest,
      topK,
    });

    if (agentChunks.length === 0) {
      return {
        intent: "AGENT_KNOWLEDGE",
        hasRelevantKnowledge: false,
        policyChunks: [],
        agentChunks: [],
        groundingContext: "",
        sources: [],
        confidence: 0,
      };
    }

    let grounding = "### [DATA CONTEXT: AGENT KNOWLEDGE BASE & STUDIO RULES]\n";
    grounding += "CRITICAL: The following verified custom instructions, studio rules, and guardrails govern the agent's behavior.\n\n";

    const uniqueDocs = new Map<string, AgentKnowledgeChunkResult[]>();
    for (const chunk of agentChunks) {
      const list = uniqueDocs.get(chunk.documentId) || [];
      list.push(chunk);
      uniqueDocs.set(chunk.documentId, list);
    }

    for (const [docId, chunks] of uniqueDocs.entries()) {
      const first = chunks[0];
      grounding += `#### Document: ${first.documentName || docId}\n`;
      if (first.documentInstruction) {
        grounding += `> Document Instruction: ${first.documentInstruction}\n`;
      }
      if (first.documentGuardrail) {
        grounding += `> Document Guardrail: ${first.documentGuardrail}\n`;
      }
      grounding += "Relevant Rules / Chunks:\n";
      chunks.forEach((c) => {
        grounding += `[Chunk ${c.chunkIndex}]:\n${c.content}\n\n`;
      });
    }

    const avgSim =
      agentChunks.reduce((acc, c) => acc + c.similarity, 0) / agentChunks.length;

    return {
      intent: "AGENT_KNOWLEDGE",
      hasRelevantKnowledge: true,
      policyChunks: [],
      agentChunks,
      groundingContext: grounding,
      sources: agentChunks.map((c) => ({
        name: c.documentName || "Agent Knowledge Document",
        type: "agent_knowledge",
        similarity: c.similarity,
      })),
      confidence: avgSim,
    };
  }

  // 3. POLICY INTENT: HNSW cosine similarity on bank_policy_embeddings with product mapping
  const policyChunks = await searchBankPolicyEmbeddings({
    query,
    bankId: routing.detectedBankId,
    bankName: routing.detectedBank,
    loanCategory: (routing.loanCategory as any) || "PERSONAL_LOAN",
    topK,
  });

  if (policyChunks.length === 0) {
    if (agentId) {
      const fallbackAgentChunks = await searchAgentKnowledgeEmbeddings({
        query,
        agentId,
        includeDemo: routing.isExplicitDemoRequest,
        topK,
      });

      if (fallbackAgentChunks.length > 0) {
        let grounding = "### [DATA CONTEXT: AGENT KNOWLEDGE BASE & STUDIO RULES]\n";
        grounding += "CRITICAL: The following verified custom instructions, studio rules, and knowledge chunks govern the agent's behavior.\n\n";

        const uniqueDocs = new Map<string, AgentKnowledgeChunkResult[]>();
        for (const chunk of fallbackAgentChunks) {
          const list = uniqueDocs.get(chunk.documentId) || [];
          list.push(chunk);
          uniqueDocs.set(chunk.documentId, list);
        }

        for (const [docId, chunks] of uniqueDocs.entries()) {
          const first = chunks[0];
          grounding += `#### Document: ${first.documentName || docId}\n`;
          if (first.documentInstruction) {
            grounding += `> Document Instruction: ${first.documentInstruction}\n`;
          }
          if (first.documentGuardrail) {
            grounding += `> Document Guardrail: ${first.documentGuardrail}\n`;
          }
          grounding += "Relevant Rules / Chunks:\n";
          chunks.forEach((c) => {
            grounding += `[Chunk ${c.chunkIndex}]:\n${c.content}\n\n`;
          });
        }

        const avgSim =
          fallbackAgentChunks.reduce((acc, c) => acc + c.similarity, 0) / fallbackAgentChunks.length;

        return {
          intent: "AGENT_KNOWLEDGE",
          hasRelevantKnowledge: true,
          policyChunks: [],
          agentChunks: fallbackAgentChunks,
          groundingContext: grounding,
          sources: fallbackAgentChunks.map((c) => ({
            name: c.documentName || "Agent Knowledge Document",
            type: "agent_knowledge",
            similarity: c.similarity,
          })),
          confidence: avgSim,
        };
      }
    }

    return {
      intent: "POLICY",
      hasRelevantKnowledge: false,
      policyChunks: [],
      agentChunks: [],
      groundingContext: "",
      sources: [],
      confidence: 0,
    };
  }

  let grounding = "### [DATA CONTEXT: VERIFIED BANK POLICIES (RAG)]\n";
  grounding += "CRITICAL SOURCE GROUNDING DIRECTIVE:\n";
  grounding += "1. Base all answers strictly on the verified policy chunks below. Cite the exact file name and chunk index (e.g., [Doc: <FileName>, Chunk #<chunkIndex>]).\n";
  grounding += "2. Never speculate, guess, or borrow criteria from other lenders or demo documents.\n";
  grounding += "3. If a specific parameter (such as maximum age limit, salary requirement, or exact employment duration) is genuinely absent from the retrieved chunks below, transparently respond:\n";
  grounding += "   \"The available bank policy documents do not specify this requirement. Please refer to your lender's official underwriting guidelines for exact confirmation.\"\n\n";

  for (const chunk of policyChunks) {
    grounding += `#### Policy File: ${chunk.fileName} (Chunk #${chunk.chunkIndex}, Product: ${chunk.loanCategory || 'PERSONAL_LOAN'}, Similarity: ${(chunk.similarity * 100).toFixed(1)}%)\n`;
    grounding += `${chunk.content}\n\n`;
  }

  const avgSim =
    policyChunks.reduce((acc, c) => acc + c.similarity, 0) / policyChunks.length;

  return {
    intent: "POLICY",
    hasRelevantKnowledge: true,
    policyChunks,
    agentChunks: [],
    groundingContext: grounding,
    sources: policyChunks.map((c) => ({
      name: c.fileName,
      type: "bank_policy",
      similarity: c.similarity,
    })),
    confidence: avgSim,
  };
}
