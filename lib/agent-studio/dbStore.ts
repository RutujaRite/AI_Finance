// lib/agent-studio/dbStore.ts
import pool from "@/lib/db";
import {
  Agent,
  KnowledgeDocumentRecord,
  ConversationRecord,
  ConversationMessageRecord,
  ConversationKnowledgeUsageRecord,
  GeneralInstructionsConfig,
  GlobalGuardrailsConfig,
} from "./types";
import { initAgentStudioDb } from "./dbSchema";

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    try {
      await initAgentStudioDb();
      dbInitialized = true;
    } catch (e) {
      console.warn("[DB_INIT_WARN]", e);
    }
  }
}

/**
 * Ensures the agent row exists in PostgreSQL with optional user_id tenant association.
 */
export async function syncAgentToDb(agent: Agent, userId?: number): Promise<void> {
  await ensureDb();
  const client = await pool.connect();
  try {
    const effectiveUserId = agent.userId !== undefined ? agent.userId : (userId !== undefined ? userId : null);
    await client.query(
      `INSERT INTO agents (
        id, name, description, status, response_style, modes,
        operational_mode, goal, guardrail_templates, manual_guardrails,
        general_instructions, allow_general_knowledge, global_guardrails,
        welcome_message, capabilities, qualification, usage, user_id, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        response_style = EXCLUDED.response_style,
        modes = EXCLUDED.modes,
        operational_mode = EXCLUDED.operational_mode,
        goal = EXCLUDED.goal,
        guardrail_templates = EXCLUDED.guardrail_templates,
        manual_guardrails = EXCLUDED.manual_guardrails,
        general_instructions = EXCLUDED.general_instructions,
        allow_general_knowledge = EXCLUDED.allow_general_knowledge,
        global_guardrails = EXCLUDED.global_guardrails,
        welcome_message = EXCLUDED.welcome_message,
        capabilities = EXCLUDED.capabilities,
        qualification = EXCLUDED.qualification,
        usage = EXCLUDED.usage,
        user_id = COALESCE(EXCLUDED.user_id, agents.user_id),
        updated_at = NOW()`,
      [
        agent.id,
        agent.name,
        agent.description || "",
        agent.status || "active",
        agent.responseStyle || "balanced",
        JSON.stringify(agent.modes || {}),
        agent.operationalMode || "standard",
        agent.goal || "",
        JSON.stringify(agent.guardrailTemplates || []),
        agent.manualGuardrails || "",
        JSON.stringify(
          agent.generalInstructions || {
            role: agent.instructions?.agentRole || "Senior Loan & Credit Advisory Specialist",
            goal: agent.instructions?.businessDescription || "Help users compare loan eligibility and bank policies.",
            behaviour: [
              "Be accurate",
              "Be conversational",
              "Be concise",
              "Ask only necessary questions",
              "Do not repeatedly ask the same question",
              "Maintain relevant conversation context",
            ],
            customRules: agent.instructions?.additionalInstructions || "",
          }
        ),
        agent.allowGeneralKnowledge !== false,
        JSON.stringify(
          agent.globalGuardrails || {
            neverFalseInfo: true,
            protectSystemPrompt: true,
            preventHallucinations: true,
            askMissingInfo: true,
            noDuplicateQuestions: true,
            stayWithinCapabilities: true,
            customGuardrails: agent.instructions?.guardrails?.customGuardrails || "",
          }
        ),
        JSON.stringify(agent.welcomeMessage || {}),
        JSON.stringify(agent.capabilities || {}),
        JSON.stringify(agent.qualification || {}),
        JSON.stringify(agent.usage || {}),
        effectiveUserId,
      ]
    );
  } catch (err) {
    console.error("[SYNC_AGENT_TO_DB_ERROR]", err);
  } finally {
    client.release();
  }
}

function mapRowToAgent(row: any): Agent {
  const generalInst = typeof row.general_instructions === "string" ? JSON.parse(row.general_instructions) : (row.general_instructions || {});
  const globalGuard = typeof row.global_guardrails === "string" ? JSON.parse(row.global_guardrails) : (row.global_guardrails || {});
  const guardTemplates = Array.isArray(row.guardrail_templates) ? row.guardrail_templates : (typeof row.guardrail_templates === "string" ? JSON.parse(row.guardrail_templates) : []);

  return {
    id: row.id,
    userId: row.user_id !== null && row.user_id !== undefined ? Number(row.user_id) : undefined,
    isActiveForUser: row.is_active_for_user === true || row.status === "active",
    name: row.name,
    description: row.description || "",
    status: (row.status === "active" ? "active" : "draft") as any,
    responseStyle: (row.response_style || "balanced") as any,
    modes: typeof row.modes === "string" ? JSON.parse(row.modes) : (row.modes || { aiAgentMode: true, conversations: true, campaigns: false }),
    operationalMode: (row.operational_mode || "standard") as any,
    goal: row.goal || "",
    guardrailTemplates: guardTemplates,
    manualGuardrails: row.manual_guardrails || "",
    instructions: {
      businessDescription: row.goal || "Help users compare loan eligibility and bank policies.",
      agentRole: generalInst.role || `${row.name} Specialist`,
      tone: "Warm, professional, empathetic, and transparent",
      escalationRules: "Direct complex requests to a supervisor.",
      additionalInstructions: generalInst.customRules || "",
      advancedPrompt: "Base bank policy responses strictly on verified knowledge.",
      temperature: 0.6,
      knowledgeInstructions: {
        groundingPolicy: "strict",
        requireCitations: true,
        fallbackMessage: "I could not find this specific policy in the verified documents.",
        customKnowledgePrompt: "",
      },
      guardrails: {
        preventHallucinations: true,
        piiProtection: true,
        financialDisclaimer: true,
        regulatoryCompliance: true,
        restrictOutOfScope: true,
        customGuardrails: row.manual_guardrails || "",
      },
    },
    generalInstructions: generalInst,
    allowGeneralKnowledge: row.allow_general_knowledge !== false,
    globalGuardrails: globalGuard,
    welcomeMessage: typeof row.welcome_message === "string" ? JSON.parse(row.welcome_message) : (row.welcome_message || { enabled: true, text: `Hi! I'm your ${row.name} 👋`, attachments: [] }),
    qualification: typeof row.qualification === "string" ? JSON.parse(row.qualification) : (row.qualification || { leadFields: [], documentCollection: [], dataCollectionNotes: "" }),
    knowledge: [],
    capabilities: typeof row.capabilities === "string" ? JSON.parse(row.capabilities) : (row.capabilities || { answer_questions: true, search_knowledge: true, calculate_emi: true, check_eligibility: true, create_lead: true }),
    usage: typeof row.usage === "string" ? JSON.parse(row.usage) : (row.usage || { messagesUsed: 0, maxMessages: 50, knowledgeTokens: 0 }),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Loads agents visible to a user directly from PostgreSQL.
 * If userId is provided, returns user's agents plus shared system templates (user_id IS NULL),
 * protecting private agents from other users.
 */
export async function loadAgentsFromDb(userId?: number): Promise<Agent[]> {
  await ensureDb();
  const client = await pool.connect();
  try {
    let query = `
      SELECT a.*,
        COALESCE(
          (SELECT COUNT(*) FROM knowledge_documents WHERE agent_id = a.id),
          0
        ) as doc_count,
        CASE WHEN a.status = 'active' THEN true ELSE false END as is_active_for_user
      FROM agents a
      ORDER BY a.updated_at DESC
    `;
    let params: any[] = [];

    if (userId !== undefined && userId !== null) {
      query = `
        SELECT a.*,
          COALESCE(
            (SELECT COUNT(*) FROM knowledge_documents WHERE agent_id = a.id),
            0
          ) as doc_count,
          CASE WHEN uaa.agent_id IS NOT NULL THEN true WHEN a.status = 'active' THEN true ELSE false END as is_active_for_user
        FROM agents a
        LEFT JOIN user_active_agents uaa ON uaa.user_id = $1 AND uaa.agent_id = a.id
        WHERE a.user_id = $1 OR a.user_id IS NULL
        ORDER BY (CASE WHEN a.user_id = $1 THEN 0 ELSE 1 END), a.updated_at DESC
      `;
      params = [userId];
    }

    const res = await client.query(query, params);
    return res.rows.map((row: any) => {
      const agent = mapRowToAgent(row);
      agent.documentCount = Number(row.doc_count || 0);
      return agent;
    });
  } catch (err) {
    console.error("[LOAD_AGENTS_FROM_DB_ERROR]", err);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Loads a single agent by ID from PostgreSQL, verifying tenant ownership if userId provided.
 */
export async function getAgentFromDb(id: string, userId?: number): Promise<Agent | null> {
  await ensureDb();
  const client = await pool.connect();
  try {
    let query = `
      SELECT a.*,
        COALESCE(
          (SELECT COUNT(*) FROM knowledge_documents WHERE agent_id = a.id),
          0
        ) as doc_count
      FROM agents a
      WHERE a.id = $1
    `;
    let params: any[] = [id];

    if (userId !== undefined && userId !== null) {
      query = `
        SELECT a.*,
          COALESCE(
            (SELECT COUNT(*) FROM knowledge_documents WHERE agent_id = a.id),
            0
          ) as doc_count,
          CASE WHEN uaa.agent_id IS NOT NULL THEN true WHEN a.status = 'active' THEN true ELSE false END as is_active_for_user
        FROM agents a
        LEFT JOIN user_active_agents uaa ON uaa.user_id = $2 AND uaa.agent_id = a.id
        WHERE a.id = $1 AND (a.user_id = $2 OR a.user_id IS NULL)
      `;
      params = [id, userId];
    }

    const res = await client.query(query, params);
    if (res.rows.length === 0) return null;
    const agent = mapRowToAgent(res.rows[0]);
    agent.documentCount = Number(res.rows[0].doc_count || 0);
    return agent;
  } catch (err) {
    console.error("[GET_AGENT_FROM_DB_ERROR]", err);
    return null;
  } finally {
    client.release();
  }
}

/**
 * Loads the active agent for a specific user, or falls back to system active agent.
 */
export async function getUserActiveAgent(userId?: number): Promise<Agent | null> {
  await ensureDb();
  const client = await pool.connect();
  try {
    if (userId !== undefined && userId !== null) {
      const uRes = await client.query(
        `SELECT a.*,
           COALESCE((SELECT COUNT(*) FROM knowledge_documents WHERE agent_id = a.id), 0) as doc_count,
           true as is_active_for_user
         FROM user_active_agents uaa
         JOIN agents a ON uaa.agent_id = a.id
         WHERE uaa.user_id = $1
         LIMIT 1`,
        [userId]
      );
      if (uRes.rows.length > 0) {
        const agent = mapRowToAgent(uRes.rows[0]);
        agent.documentCount = Number(uRes.rows[0].doc_count || 0);
        return agent;
      }
    }

    // Fallback: active agent for this user or system default
    const fallbackRes = await client.query(
      `SELECT a.*,
         COALESCE((SELECT COUNT(*) FROM knowledge_documents WHERE agent_id = a.id), 0) as doc_count
       FROM agents a
       WHERE a.status = 'active'
       ORDER BY (CASE WHEN a.user_id IS NOT NULL THEN 0 ELSE 1 END), a.updated_at DESC
       LIMIT 1`
    );
    if (fallbackRes.rows.length === 0) return null;
    const agent = mapRowToAgent(fallbackRes.rows[0]);
    agent.documentCount = Number(fallbackRes.rows[0].doc_count || 0);
    return agent;
  } catch (err) {
    console.error("[GET_USER_ACTIVE_AGENT_ERROR]", err);
    return null;
  } finally {
    client.release();
  }
}

/**
 * Sets an agent as active specifically for an authenticated user.
 */
export async function setUserActiveAgent(userId: number, agentId: string): Promise<boolean> {
  await ensureDb();
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO user_active_agents (user_id, agent_id, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET agent_id = EXCLUDED.agent_id, updated_at = NOW()`,
      [userId, agentId]
    );
    return true;
  } catch (err) {
    console.error("[SET_USER_ACTIVE_AGENT_ERROR]", err);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Clears active agent preference for a user (reverts to default assistant).
 */
export async function clearUserActiveAgent(userId: number): Promise<boolean> {
  await ensureDb();
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM user_active_agents WHERE user_id = $1`, [userId]);
    return true;
  } catch (err) {
    console.error("[CLEAR_USER_ACTIVE_AGENT_ERROR]", err);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Loads the active agent from PostgreSQL (backward compatible).
 */
export async function getActiveAgentFromDb(): Promise<Agent | null> {
  return getUserActiveAgent();
}

/**
 * Fetch all documents for a given agent with their instructions and guardrails.
 */
export async function listAgentDocuments(
  agentId: string
): Promise<KnowledgeDocumentRecord[]> {
  await ensureDb();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT
        kd.id,
        kd.agent_id as "agentId",
        kd.name,
        kd.file_type as "fileType",
        kd.file_size as "fileSize",
        kd.file_path as "filePath",
        kd.status,
        kd.status_message as "statusMessage",
        kd.chunk_count as "chunkCount",
        kd.vector_status as "vectorStatus",
        kd.is_active as "isActive",
        kd.metadata,
        kd.uploaded_at as "uploadedAt",
        kd.updated_at as "updatedAt",
        kdi.id as "instructionId",
        kdi.instruction_text as "instructionText",
        kdi.when_to_use as "whenToUse",
        kdi.when_not_to_use as "whenNotToUse",
        kdg.id as "guardrailId",
        kdg.guardrail_text as "guardrailText"
      FROM knowledge_documents kd
      LEFT JOIN knowledge_document_instructions kdi ON kd.id = kdi.document_id
      LEFT JOIN knowledge_document_guardrails kdg ON kd.id = kdg.document_id
      WHERE kd.agent_id = $1
      ORDER BY kd.uploaded_at DESC`,
      [agentId]
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      agentId: r.agentId,
      name: r.name,
      fileType: r.fileType,
      fileSize: r.fileSize || "1.0 MB",
      filePath: r.filePath,
      status: r.status,
      statusMessage: r.statusMessage,
      chunkCount: Number(r.chunkCount || 0),
      vectorStatus: r.vectorStatus || "Indexed",
      isActive: r.isActive !== false,
      metadata: r.metadata,
      uploadedAt: r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Today",
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      instruction: r.instructionText
        ? {
            id: r.instructionId,
            instructionText: r.instructionText,
            whenToUse: r.whenToUse,
            whenNotToUse: r.whenNotToUse,
          }
        : undefined,
      guardrail: r.guardrailText
        ? {
            id: r.guardrailId,
            guardrailText: r.guardrailText,
          }
        : undefined,
    }));
  } catch (err) {
    console.error("[LIST_AGENT_DOCUMENTS_ERROR]", err);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Creates or updates knowledge document configuration (instructions & guardrails).
 */
export async function saveDocumentConfiguration(
  documentId: string,
  agentId: string,
  config: {
    instructionText?: string;
    whenToUse?: string;
    whenNotToUse?: string;
    guardrailText?: string;
    isActive?: boolean;
  }
): Promise<boolean> {
  await ensureDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (config.isActive !== undefined) {
      await client.query(
        `UPDATE knowledge_documents SET is_active = $2, updated_at = NOW() WHERE id = $1`,
        [documentId, config.isActive]
      );
    }

    if (config.instructionText !== undefined) {
      const instId = `inst_${documentId}`;
      await client.query(
        `INSERT INTO knowledge_document_instructions (id, document_id, agent_id, instruction_text, when_to_use, when_not_to_use, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET
           instruction_text = EXCLUDED.instruction_text,
           when_to_use = EXCLUDED.when_to_use,
           when_not_to_use = EXCLUDED.when_not_to_use,
           updated_at = NOW()`,
        [
          instId,
          documentId,
          agentId,
          config.instructionText,
          config.whenToUse || null,
          config.whenNotToUse || null,
        ]
      );
    }

    if (config.guardrailText !== undefined) {
      const guardId = `guard_${documentId}`;
      await client.query(
        `INSERT INTO knowledge_document_guardrails (id, document_id, agent_id, guardrail_text, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET
           guardrail_text = EXCLUDED.guardrail_text,
           updated_at = NOW()`,
        [guardId, documentId, agentId, config.guardrailText]
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[SAVE_DOCUMENT_CONFIGURATION_ERROR]", err);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Delete a knowledge document and all its chunks/instructions.
 */
export async function deleteKnowledgeDocument(
  documentId: string
): Promise<boolean> {
  await ensureDb();
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM knowledge_chunks WHERE document_id = $1`, [documentId]);
    await client.query(`DELETE FROM knowledge_documents WHERE id = $1`, [documentId]);
    return true;
  } catch (err) {
    console.error("[DELETE_KNOWLEDGE_DOCUMENT_ERROR]", err);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Fetch raw document text and extracted chunks for View modal.
 */
export async function getDocumentDetailsWithChunks(
  documentId: string
): Promise<{ document: any; chunks: any[] } | null> {
  await ensureDb();
  const client = await pool.connect();
  try {
    const docRes = await client.query(
      `SELECT * FROM knowledge_documents WHERE id = $1`,
      [documentId]
    );
    if (docRes.rows.length === 0) return null;

    const chunksRes = await client.query(
      `SELECT id, chunk_index as "chunkIndex", content, char_count as "charCount", created_at as "createdAt"
       FROM knowledge_chunks
       WHERE document_id = $1
       ORDER BY chunk_index ASC`,
      [documentId]
    );

    return {
      document: docRes.rows[0],
      chunks: chunksRes.rows,
    };
  } catch (err) {
    console.error("[GET_DOCUMENT_CHUNKS_ERROR]", err);
    return null;
  } finally {
    client.release();
  }
}

/**
 * List conversations for an agent.
 */
export async function listAgentConversations(
  agentId: string
): Promise<ConversationRecord[]> {
  await ensureDb();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT
        c.id,
        c.agent_id as "agentId",
        c.user_id as "userId",
        c.title,
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        COUNT(cm.id) as "messageCount"
      FROM conversations c
      LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
      WHERE c.agent_id = $1
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT 50`,
      [agentId]
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      agentId: r.agentId,
      userId: r.userId,
      title: r.title || "Agent Conversation",
      createdAt: new Date(r.createdAt).toLocaleString(),
      updatedAt: new Date(r.updatedAt).toLocaleString(),
      messageCount: Number(r.messageCount || 0),
    }));
  } catch (err) {
    console.error("[LIST_AGENT_CONVERSATIONS_ERROR]", err);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Fetch full conversation messages and knowledge usage history.
 */
export async function getConversationDetails(
  conversationId: string
): Promise<ConversationRecord | null> {
  await ensureDb();
  const client = await pool.connect();
  try {
    const convRes = await client.query(
      `SELECT * FROM conversations WHERE id = $1`,
      [conversationId]
    );
    if (convRes.rows.length === 0) return null;

    const msgRes = await client.query(
      `SELECT
        id,
        conversation_id as "conversationId",
        agent_id as "agentId",
        role,
        content,
        intent,
        tools_used as "toolsUsed",
        knowledge_documents_used as "knowledgeDocumentsUsed",
        created_at as "createdAt"
       FROM conversation_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    const usageRes = await client.query(
      `SELECT
        cku.id,
        cku.conversation_id as "conversationId",
        cku.agent_id as "agentId",
        cku.knowledge_document_id as "knowledgeDocumentId",
        kd.name as "documentName",
        cku.retrieved_chunk_ids as "retrievedChunkIds",
        cku.created_at as "createdAt"
       FROM conversation_knowledge_usage cku
       LEFT JOIN knowledge_documents kd ON cku.knowledge_document_id = kd.id
       WHERE cku.conversation_id = $1
       ORDER BY cku.created_at DESC`,
      [conversationId]
    );

    const c = convRes.rows[0];
    return {
      id: c.id,
      agentId: c.agent_id,
      userId: c.user_id,
      title: c.title || "Agent Conversation",
      createdAt: new Date(c.created_at).toLocaleString(),
      updatedAt: new Date(c.updated_at).toLocaleString(),
      messageCount: msgRes.rows.length,
      messages: msgRes.rows,
      knowledgeUsage: usageRes.rows,
    };
  } catch (err) {
    console.error("[GET_CONVERSATION_DETAILS_ERROR]", err);
    return null;
  } finally {
    client.release();
  }
}

/**
 * Stores a conversation exchange and records knowledge document usage (Section 12 & 13).
 */
export async function recordConversationExchange(params: {
  conversationId: string;
  agentId: string;
  userId?: number;
  userMessage: string;
  assistantResponse: string;
  intent?: string;
  toolsUsed?: string[];
  knowledgeDocumentsUsed?: Array<{ id: string; name: string; chunkIds?: string[] }>;
}): Promise<void> {
  await ensureDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Ensure conversation record exists
    const title = params.userMessage.slice(0, 40) + "...";
    await client.query(
      `INSERT INTO conversations (id, agent_id, user_id, title, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
      [params.conversationId, params.agentId, params.userId || null, title]
    );

    // 2. Insert user message
    const userMsgId = `msg_${Date.now()}_u`;
    await client.query(
      `INSERT INTO conversation_messages (id, conversation_id, agent_id, role, content, created_at)
       VALUES ($1, $2, $3, 'user', $4, NOW())`,
      [userMsgId, params.conversationId, params.agentId, params.userMessage]
    );

    // 3. Insert assistant response with metadata
    const docNames = (params.knowledgeDocumentsUsed || []).map((d) => d.name);
    const asstMsgId = `msg_${Date.now()}_a`;
    await client.query(
      `INSERT INTO conversation_messages (id, conversation_id, agent_id, role, content, intent, tools_used, knowledge_documents_used, created_at)
       VALUES ($1, $2, $3, 'assistant', $4, $5, $6, $7, NOW())`,
      [
        asstMsgId,
        params.conversationId,
        params.agentId,
        params.assistantResponse,
        params.intent || "general",
        JSON.stringify(params.toolsUsed || []),
        JSON.stringify(docNames),
      ]
    );

    // 4. Record knowledge usage (Section 13)
    if (params.knowledgeDocumentsUsed && params.knowledgeDocumentsUsed.length > 0) {
      for (const doc of params.knowledgeDocumentsUsed) {
        const usageId = `usage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await client.query(
          `INSERT INTO conversation_knowledge_usage (id, conversation_id, agent_id, knowledge_document_id, retrieved_chunk_ids, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            usageId,
            params.conversationId,
            params.agentId,
            doc.id,
            JSON.stringify(doc.chunkIds || []),
          ]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[RECORD_CONVERSATION_EXCHANGE_ERROR]", err);
  } finally {
    client.release();
  }
}

/**
 * Deletes an agent and all related documents, chunks, and conversations from PostgreSQL,
 * verifying ownership if userId is provided.
 */
export async function deleteAgentFromDb(agentId: string, userId?: number): Promise<boolean> {
  await ensureDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (userId !== undefined && userId !== null) {
      const checkRes = await client.query(`SELECT user_id FROM agents WHERE id = $1`, [agentId]);
      if (checkRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const ownerId = checkRes.rows[0].user_id;
      // If agent is private to another user, deny deletion
      if (ownerId !== null && ownerId !== undefined && Number(ownerId) !== userId) {
        await client.query("ROLLBACK");
        return false;
      }
    }

    await client.query("DELETE FROM user_active_agents WHERE agent_id = $1", [agentId]);
    await client.query(
      "DELETE FROM knowledge_chunks WHERE document_id IN (SELECT id FROM knowledge_documents WHERE agent_id = $1)",
      [agentId]
    );
    await client.query("DELETE FROM knowledge_document_instructions WHERE document_id IN (SELECT id FROM knowledge_documents WHERE agent_id = $1)", [agentId]);
    await client.query("DELETE FROM knowledge_document_guardrails WHERE document_id IN (SELECT id FROM knowledge_documents WHERE agent_id = $1)", [agentId]);
    await client.query("DELETE FROM conversation_knowledge_usage WHERE agent_id = $1", [agentId]);
    await client.query("DELETE FROM conversation_messages WHERE agent_id = $1", [agentId]);
    await client.query("DELETE FROM conversations WHERE agent_id = $1", [agentId]);
    await client.query("DELETE FROM knowledge_documents WHERE agent_id = $1", [agentId]);
    await client.query("DELETE FROM agents WHERE id = $1", [agentId]);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[DELETE_AGENT_FROM_DB_ERROR]", err);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Fetches all uploaded knowledge base files across all agents from PostgreSQL,
 * returning the respective agent name and processing status.
 */
export async function listAllKnowledgeDocumentsAcrossAgents(): Promise<Array<{
  id: string;
  agentId: string;
  agentName: string;
  name: string;
  fileType: string;
  category: string;
  fileSize: string;
  status: string;
  chunkCount: number;
  uploadedAt: string;
  rawText?: string;
}>> {
  await ensureDb();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT
        kd.id,
        kd.agent_id as "agentId",
        COALESCE(
          CASE 
            WHEN a.name = 'Loan Eligibility Assistant' THEN 'CreditWise Assistant'
            WHEN a.name = 'C New Agent' THEN 'CreditWise Assistant'
            ELSE a.name
          END,
          'CreditWise Assistant'
        ) as "agentName",
        kd.name,
        kd.file_type as "fileType",
        kd.file_size as "fileSize",
        kd.status,
        kd.chunk_count as "chunkCount",
        kd.uploaded_at as "uploadedAt",
        kd.raw_text as "rawText"
      FROM knowledge_documents kd
      LEFT JOIN agents a ON kd.agent_id = a.id
      ORDER BY kd.uploaded_at DESC`
    );

    const docs = res.rows.map((r: any) => ({
      id: r.id,
      agentId: r.agentId,
      agentName: r.agentName || "CreditWise Assistant",
      name: r.name,
      fileType: (r.fileType || "pdf").toUpperCase(),
      category: r.name.toLowerCase().includes("policy") ? "Bank Policy" : "Agent Knowledge",
      fileSize: r.fileSize || "1.0 MB",
      status: r.status === "COMPLETED" ? "Processed" : (r.status || "Processed"),
      chunkCount: Number(r.chunkCount || 0),
      uploadedAt: r.uploadedAt ? new Date(r.uploadedAt).toISOString() : new Date().toISOString(),
      rawText: r.rawText || "",
    }));

    // Also include custom_agents files if any
    try {
      const caRes = await client.query(`SELECT id, name, knowledge_files FROM custom_agents WHERE knowledge_files IS NOT NULL`);
      for (const ca of caRes.rows) {
        if (Array.isArray(ca.knowledge_files)) {
          for (const kf of ca.knowledge_files) {
            const fileName = String(kf);
            if (!docs.some((d) => d.name.toLowerCase() === fileName.toLowerCase())) {
              docs.push({
                id: `ca_doc_${ca.id}_${fileName.replace(/[^a-zA-Z0-9]/g, "_")}`,
                agentId: ca.id,
                agentName: ca.name || "Test Bank Assistant",
                name: fileName,
                fileType: fileName.split(".").pop()?.toUpperCase() || "PDF",
                category: "Agent Knowledge",
                fileSize: "1.2 MB",
                status: "Processed",
                chunkCount: 1,
                uploadedAt: new Date().toISOString(),
                rawText: "Indexed in custom agent RAG knowledge base.",
              });
            }
          }
        }
      }
    } catch {}
    return docs;
  } catch (err) {
    console.error("[LIST_ALL_KNOWLEDGE_DOCUMENTS_ERROR]", err);
    return [];
  } finally {
    client.release();
  }
}

