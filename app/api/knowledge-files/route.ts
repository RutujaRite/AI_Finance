// app/api/knowledge-files/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAgent, listAgents } from "@/lib/agent-studio/agentStore";
import { getAgentFromDb } from "@/lib/agent-studio/dbStore";
import { isKnowledgeBaseAgent } from "@/lib/agent-studio/types";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId") || searchParams.get("currentAgentId") || searchParams.get("agent_id");

    const token = req.cookies.get("token")?.value || req.cookies.get("auth_token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    const userId = payload?.id && Number.isFinite(Number(payload.id)) ? Number(payload.id) : undefined;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "agentId parameter is required" },
        { status: 400 }
      );
    }

    const agent = (await getAgentFromDb(agentId, userId)) || getAgent(agentId);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }

    const isKnowledgeAgent = isKnowledgeBaseAgent(agent);

    // If conversational or greeting agent: completely suppress policy files
    if (!isKnowledgeAgent) {
      return NextResponse.json({
        success: true,
        files: [],
        count: 0,
        isKnowledgeAgent: false,
        message:
          "This agent is configured as a conversational assistant. Document-level policy retrieval is handled independently by designated Knowledge Base agents.",
      });
    }

    // Knowledge Base Agent: Query files explicitly passed to this agent
    const client = await pool.connect();
    try {
      let rows: any[] = [];
      try {
        // Query from agent_knowledge_files view/table
        const res = await client.query(
          `SELECT * FROM agent_knowledge_files
           WHERE agent_id = $1 AND is_policy_file = false
           ORDER BY uploaded_at DESC`,
          [agentId]
        );
        rows = res.rows;
      } catch {
        // Fallback to knowledge_documents table directly
        const res = await client.query(
          `SELECT
             id,
             agent_id,
             name,
             file_type,
             file_size,
             status,
             chunk_count,
             is_active,
             COALESCE(source, 'knowledge_agent_passed') as source,
             COALESCE(is_policy_file, false) as is_policy_file,
             uploaded_at,
             updated_at
           FROM knowledge_documents
           WHERE agent_id = $1
           ORDER BY uploaded_at DESC`,
          [agentId]
        );
        rows = res.rows;
      }

      // Filter explicitly passed knowledge files, strictly scoped
      const files = rows.map((r: any) => ({
        id: r.id,
        agent_id: r.agent_id,
        name: r.name,
        file_type: (r.file_type || "pdf").toUpperCase(),
        file_size: r.file_size || "1.0 MB",
        status: r.status === "COMPLETED" ? "Active" : (r.status || "Active"),
        chunk_count: Number(r.chunk_count || 1),
        source: "knowledge_agent_passed",
        is_policy_file: false,
        uploaded_at: r.uploaded_at ? new Date(r.uploaded_at).toISOString() : new Date().toISOString(),
      }));

      return NextResponse.json({
        success: true,
        files,
        count: files.length,
        isKnowledgeAgent: true,
        agentName: agent.name,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[GET_KNOWLEDGE_FILES_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to query knowledge files" },
      { status: 500 }
    );
  }
}
