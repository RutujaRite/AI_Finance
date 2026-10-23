// app/api/agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  listAgents,
  createAgent,
  getUserSubscription,
  pruneStoreAgents,
} from "@/lib/agent-studio/agentStore";
import { syncAgentToDb, loadAgentsFromDb } from "@/lib/agent-studio/dbStore";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getUserId(req: NextRequest): number | undefined {
  try {
    const token = req.cookies.get("token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    if (payload?.id && Number.isFinite(Number(payload.id))) {
      return Number(payload.id);
    }
  } catch {}
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    let agents = await loadAgentsFromDb(userId);
    if (!agents || agents.length === 0) {
      agents = listAgents();
      for (const a of agents) {
        await syncAgentToDb(a, userId);
      }
    }
    const subscription = getUserSubscription();
    return NextResponse.json({
      success: true,
      agents,
      subscription,
    });
  } catch (error: any) {
    console.error("[API_AGENTS_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const name = (body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Agent name is required" },
        { status: 400 }
      );
    }

    const systemPrompt =
      body.system_prompt ||
      body.systemPrompt ||
      body.instructions?.advancedPrompt ||
      body.goal ||
      body.purpose ||
      "For bank-specific values (minimum salary, cut-off CIBIL scores, LTV ratios, interest rates), rely strictly on verified knowledge base files. For general financial definitions or industry acronyms (e.g., FOIR, LTV, CIBIL, EMI), provide clear standard financial definitions while noting that exact percentage thresholds depend on individual lender policy.";

    const tone =
      body.tone ||
      body.instructions?.tone ||
      "Professional and friendly";

    const responseStyleRaw =
      body.response_style ||
      body.responseStyle ||
      "concise";

    let mappedResponseStyle: "concise" | "balanced" | "detailed" = "concise";
    if (responseStyleRaw.toLowerCase().includes("detail")) mappedResponseStyle = "detailed";
    else if (responseStyleRaw.toLowerCase().includes("step") || responseStyleRaw.toLowerCase().includes("balanced")) mappedResponseStyle = "balanced";

    const isActive = body.is_active === true || body.status === "active";
    const description = body.description || `${name} Assistant`;
    const model = body.model || "gpt-4o-mini";
    const role = body.agentRole || body.role || body.instructions?.agentRole || `${name} Specialist`;

    // Prune stale in-memory entries against PostgreSQL to avoid false limit exhaustion
    try {
      const dbAgentsRes = await pool.query("SELECT id FROM agents");
      const validDbIds = new Set(dbAgentsRes.rows.map((r: any) => r.id));
      pruneStoreAgents(validDbIds);
    } catch {}

    const result = createAgent({
      name,
      description,
      purpose: systemPrompt,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          limitReached: result.limitReached || false,
        },
        { status: result.limitReached ? 403 : 400 }
      );
    }

    if (result.agent) {
      if (userId !== undefined) {
        result.agent.userId = userId;
      }
      result.agent.status = isActive ? "active" : "draft";
      result.agent.isActiveForUser = isActive;
      result.agent.responseStyle = mappedResponseStyle;
      result.agent.operationalMode = body.operationalMode || (body.operational_mode || "standard");
      if (body.type) {
        (result.agent as any).type = body.type;
      }
      if (body.capabilities) {
        result.agent.capabilities = {
          ...result.agent.capabilities,
          ...body.capabilities,
        };
      }
      result.agent.goal = systemPrompt;
      result.agent.model = model;
      result.agent.appliedToAssistant = body.applied_to_assistant === true || body.appliedToAssistant === true;
      result.agent.supportedTopics = Array.isArray(body.supported_topics || body.supportedTopics)
        ? (body.supported_topics || body.supportedTopics)
        : [];
      result.agent.configVersion = body.config_version || 1;
      (result.agent as any).system_prompt = systemPrompt;
      (result.agent as any).tone = tone;
      (result.agent as any).response_style = responseStyleRaw;

      result.agent.instructions = {
        businessDescription: description,
        agentRole: role,
        tone: tone,
        escalationRules: body.instructions?.escalationRules || "Direct complex underwriting requests to a senior manager.",
        additionalInstructions: body.instructions?.additionalInstructions || "Verify employer name and net monthly income before evaluating bank eligibility.",
        advancedPrompt: systemPrompt,
        temperature: body.instructions?.temperature || 0.4,
        ...(typeof body.instructions === "object" ? body.instructions : {}),
      };

      if (body.guardrails) {
        result.agent.manualGuardrails = typeof body.guardrails === "string" ? body.guardrails : "";
      }

      try {
        await syncAgentToDb(result.agent, userId);
      } catch (syncErr) {
        console.warn("[SYNC_NEW_AGENT_DB_WARN]", syncErr);
      }
    }

    const subscription = getUserSubscription();
    return NextResponse.json({
      success: true,
      agent: result.agent,
      subscription,
    });
  } catch (error: any) {
    console.error("[API_AGENTS_POST_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
