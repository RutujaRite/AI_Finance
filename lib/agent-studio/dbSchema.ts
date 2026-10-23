// lib/agent-studio/dbSchema.ts
import pool from "@/lib/db";

/**
 * Initializes all required PostgreSQL tables for the AI Agent Studio.
 * Complies with Section 3 of specifications.
 * Uses CREATE TABLE IF NOT EXISTS and graceful error handling.
 */
export async function initAgentStudioDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Agents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        response_style VARCHAR(50) DEFAULT 'balanced',
        modes JSONB DEFAULT '{"aiAgentMode": true, "conversations": true, "campaigns": false}',
        operational_mode VARCHAR(50) DEFAULT 'standard',
        goal TEXT,
        guardrail_templates JSONB DEFAULT '[]',
        manual_guardrails TEXT,
        general_instructions JSONB DEFAULT '{}',
        allow_general_knowledge BOOLEAN DEFAULT TRUE,
        global_guardrails JSONB DEFAULT '{}',
        welcome_message JSONB DEFAULT '{}',
        capabilities JSONB DEFAULT '{}',
        qualification JSONB DEFAULT '{}',
        usage JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS operational_mode VARCHAR(50) DEFAULT 'standard';
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS goal TEXT;
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS guardrail_templates JSONB DEFAULT '[]';
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS manual_guardrails TEXT;
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS user_id INTEGER;
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS applied_to_assistant BOOLEAN DEFAULT false;
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS supported_topics JSONB DEFAULT '[]';
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS config_version INTEGER DEFAULT 1;

      -- Per-user active / applied agent configuration table
      CREATE TABLE IF NOT EXISTS user_active_agents (
        user_id INTEGER,
        agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, agent_id)
      );

      CREATE INDEX IF NOT EXISTS idx_agents_status_applied ON agents(status, applied_to_assistant);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_agent_id ON knowledge_chunks(agent_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_docs_agent_id ON knowledge_documents(agent_id);
    `);

    // 2. Knowledge Bases table
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Agent Knowledge Bases join table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_knowledge_bases (
        id VARCHAR(100) PRIMARY KEY,
        agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
        knowledge_base_id VARCHAR(100) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Knowledge Documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id VARCHAR(100) PRIMARY KEY,
        agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
        knowledge_base_id VARCHAR(100) REFERENCES knowledge_bases(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size VARCHAR(50),
        file_path TEXT,
        status VARCHAR(50) DEFAULT 'COMPLETED', -- UPLOADING, PROCESSING, EXTRACTING, CHUNKING, INDEXING, COMPLETED, FAILED
        status_message TEXT,
        chunk_count INTEGER DEFAULT 0,
        vector_status VARCHAR(50) DEFAULT 'Indexed', -- Indexed, Pending, Failed
        is_active BOOLEAN DEFAULT TRUE,
        raw_text TEXT,
        metadata JSONB DEFAULT '{}',
        uploaded_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS user_id INTEGER;
      ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'knowledge_agent_passed';
      ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS is_policy_file BOOLEAN DEFAULT false;

      CREATE OR REPLACE VIEW agent_knowledge_files AS
      SELECT 
        kd.id,
        kd.agent_id,
        kd.name,
        kd.file_type,
        kd.file_size,
        kd.status,
        kd.chunk_count,
        kd.is_active,
        COALESCE(kd.source, 'knowledge_agent_passed') AS source,
        COALESCE(kd.is_policy_file, false) AS is_policy_file,
        kd.uploaded_at,
        kd.updated_at
      FROM knowledge_documents kd;
    `);

    // 5. Knowledge Chunks table (with pgvector if vector type exists, or jsonb embedding)
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id VARCHAR(100) PRIMARY KEY,
        document_id VARCHAR(100) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536),
        char_count INTEGER,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 6. Knowledge Document Instructions
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_document_instructions (
        id VARCHAR(100) PRIMARY KEY,
        document_id VARCHAR(100) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
        instruction_text TEXT NOT NULL,
        when_to_use TEXT,
        when_not_to_use TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 7. Knowledge Document Guardrails
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_document_guardrails (
        id VARCHAR(100) PRIMARY KEY,
        document_id VARCHAR(100) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
        guardrail_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 8. Conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(100) PRIMARY KEY,
        agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
        user_id INTEGER,
        title VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 9. Conversation Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id VARCHAR(100) PRIMARY KEY,
        conversation_id VARCHAR(100) REFERENCES conversations(id) ON DELETE CASCADE,
        agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        intent VARCHAR(100),
        tools_used JSONB DEFAULT '[]',
        knowledge_documents_used JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 10. Conversation Knowledge Usage table (Section 13)
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_knowledge_usage (
        id VARCHAR(100) PRIMARY KEY,
        conversation_id VARCHAR(100) REFERENCES conversations(id) ON DELETE CASCADE,
        agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
        knowledge_document_id VARCHAR(100) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        retrieved_chunk_ids JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 11. AI Token Usage Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_token_usage_logs (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(100),
        agent_name VARCHAR(255),
        model_name VARCHAR(150),
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        source VARCHAR(50) DEFAULT 'chat',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_token_logs_agent ON ai_token_usage_logs(agent_id);
      CREATE INDEX IF NOT EXISTS idx_token_logs_created ON ai_token_usage_logs(created_at);

      -- 12. Token Budget & Alert Settings
      CREATE TABLE IF NOT EXISTS ai_token_settings (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
        monthly_budget_tokens BIGINT DEFAULT 1000000,
        alert_threshold_percent INTEGER DEFAULT 80,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO ai_token_settings (id, monthly_budget_tokens, alert_threshold_percent)
      VALUES ('default', 1000000, 80)
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query("COMMIT");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[INIT_AGENT_STUDIO_DB_ERROR]", err);
    throw err;
  } finally {
    client.release();
  }
}
