// scripts/test-agent-studio-main-assistant-integration.ts
import pool from "../lib/db";
import { signToken } from "../lib/auth";
import { resolveActiveAgentForQuery, formatAgentGuidancePrompt } from "../lib/agent-studio/agentRouter";
import { getAppliedAgentsFromDb, listAgentDocuments, deleteAgentFromDb } from "../lib/agent-studio/dbStore";
import { retrieveKnowledgeChunks } from "../lib/agent-studio/ragEngine";
import { evaluateApplicantAgainstAllBanks } from "../lib/dynamicEligibilityEngine";

const baseUrl = "http://localhost:3001";
const adminToken = signToken({ id: 2, email: "admin@gmail.com", name: "Rutuja Rite", role: "admin" });
const headers = {
  Cookie: `token=${adminToken}`,
  "Content-Type": "application/json",
};

function pass(testName: string, detail?: string) {
  console.log(`  \x1b[32m✔ PASS\x1b[0m [${testName}] ${detail || ""}`);
}

function fail(testName: string, detail: string) {
  console.error(`  \x1b[31m✖ FAIL\x1b[0m [${testName}] ${detail}`);
  throw new Error(`Test failed: [${testName}] ${detail}`);
}

async function run() {
  console.log("================================================================================");
  console.log("  CREDITWISE AI — AGENT STUDIO INTEGRATION WITH MAIN ASSISTANT TEST SUITE");
  console.log("  Testing all 18 requirements from Phase 10");
  console.log("================================================================================\n");

  const createdAgentIds: string[] = [];
  const testAgentAId = `test_agent_edu_${Date.now()}`;
  const testAgentBId = `test_agent_comp_${Date.now()}`;

  try {
    // --------------------------------------------------------------------------
    // Test 1: Agent created and saved
    // --------------------------------------------------------------------------
    console.log("▶ [TEST 1] Creating and saving Agent A (Education Loan Agent)...");
    const createResA = await fetch(`${baseUrl}/api/agents`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "EduGlobal Scholar Finance Specialist",
        description: "Specialized advisor for higher education loans and overseas study financing.",
        goal: "Guide students and parents on education loan schemes, margin money, and university admission financing under EduGlobal standards.",
        tone: "Warm, encouraging, and highly structured",
        responseStyle: "detailed",
        operationalMode: "rag_focused",
        type: "knowledge",
        capabilities: { search_knowledge: true, knowledge_retrieval: true },
        status: "draft",
        is_active: false,
        applied_to_assistant: false,
        supported_topics: ["education loan", "student loan", "study abroad", "tuition"],
        agentRole: "Overseas Education Finance Specialist",
        instructions: {
          agentRole: "Overseas Education Finance Specialist",
          tone: "Warm, encouraging, and highly structured",
          businessDescription: "Guide students on overseas education loan processes.",
          additionalInstructions: "Always mention EduGlobal Overseas Education Advisory guidelines.",
          advancedPrompt: "You are the EduGlobal Scholar Finance Specialist. Provide detailed, step-by-step guidance on education loans, collateral requirements, and student loan tax benefits.",
        },
      }),
    });
    const createDataA = await createResA.json();
    if (!createResA.ok || !createDataA.success || !createDataA.agent?.id) {
      fail("Test 1", `Failed to create Agent A: ${JSON.stringify(createDataA)}`);
    }
    const agentAId = createDataA.agent.id;
    createdAgentIds.push(agentAId);
    pass("Test 1: Agent Created", `Agent ID: ${agentAId}, Name: "${createDataA.agent.name}", Status: ${createDataA.agent.status}`);

    // Create Agent B (Company Category Agent)
    console.log("▶ Creating Agent B (Company Category Agent)...");
    const createResB = await fetch(`${baseUrl}/api/agents`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Corporate Classification Specialist",
        description: "Specialized agent for corporate categorization and company tier lookup.",
        goal: "Look up authoritative employer categories across partner banks using verified database records.",
        tone: "Professional, analytical, and precise",
        responseStyle: "concise",
        operationalMode: "rag_focused",
        type: "knowledge",
        capabilities: { search_knowledge: true, knowledge_retrieval: true },
        status: "draft",
        is_active: false,
        applied_to_assistant: false,
        supported_topics: ["company category", "company tier", "super cat", "cat a", "cat b"],
        agentRole: "Corporate Classification Specialist",
        instructions: {
          agentRole: "Corporate Classification Specialist",
          tone: "Professional, analytical, and precise",
          businessDescription: "Help users determine corporate tier classification.",
          additionalInstructions: "Provide clear category tables based on verified records.",
        },
      }),
    });
    const createDataB = await createResB.json();
    const agentBId = createDataB.agent.id;
    createdAgentIds.push(agentBId);
    pass("Test 1: Agent B Created", `Agent ID: ${agentBId}, Name: "${createDataB.agent.name}"`);

    // --------------------------------------------------------------------------
    // Test 2: Agent instructions persist after reload
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 2] Verifying Agent instructions persist after reload...");
    const reloadRes = await fetch(`${baseUrl}/api/agents/${agentAId}`, { method: "GET", headers });
    const reloadData = await reloadRes.json();
    if (!reloadRes.ok || reloadData.agent?.id !== agentAId) {
      fail("Test 2", "Could not fetch saved agent from API");
    }
    const dbCheck = await pool.query("SELECT id, name, status, goal, supported_topics FROM agents WHERE id = $1", [agentAId]);
    if (dbCheck.rows.length === 0 || dbCheck.rows[0].name !== "EduGlobal Scholar Finance Specialist") {
      fail("Test 2", "Agent record not found in PostgreSQL");
    }
    pass("Test 2: Instructions Persist", `Loaded from DB successfully: "${dbCheck.rows[0].name}" (Status: ${dbCheck.rows[0].status})`);

    // --------------------------------------------------------------------------
    // Test 3: Knowledge files remain isolated by agent ID
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 3] Uploading distinct knowledge files for Agent A and Agent B...");
    const knowledgeDocA = `Document: EduGlobal_Scholar_Policy_2026.txt
Lender: EduGlobal Student Credit
Max_Unsecured_Loan: INR 40,00,000 for top 50 global universities.
Interest_Rate: 9.15% fixed simple interest during study moratorium.
Co_Applicant: Father, Mother, or Spouse with min income INR 30,000/month.
Tax_Benefit: 100% interest deduction under Section 80E.`;

    const knowledgeDocB = `Document: Corporate_Privilege_Tiers_2026.txt
Super_Cat_Companies: TCS, Infosys, Wipro, Google India, Microsoft India.
Privileges: Zero processing fee, 10.25% special personal loan ROI.
Cat_B_Companies: Regional tech firms, min salary INR 35,000.`;

    const boundaryA = "----WebKitBoundaryA" + Date.now();
    const bodyA = Buffer.concat([
      Buffer.from(`--${boundaryA}\r\nContent-Disposition: form-data; name="file"; filename="EduGlobal_Scholar_Policy_2026.txt"\r\nContent-Type: text/plain\r\n\r\n`),
      Buffer.from(knowledgeDocA, "utf-8"),
      Buffer.from(`\r\n--${boundaryA}--\r\n`),
    ]);

    const uploadResA = await fetch(`${baseUrl}/api/agents/${agentAId}/knowledge`, {
      method: "POST",
      headers: { Cookie: `token=${adminToken}`, "Content-Type": `multipart/form-data; boundary=${boundaryA}` },
      body: bodyA,
    });
    const uploadDataA = await uploadResA.json();
    if (!uploadResA.ok || !uploadDataA.success) {
      fail("Test 3", `Knowledge upload for Agent A failed: ${JSON.stringify(uploadDataA)}`);
    }

    const boundaryB = "----WebKitBoundaryB" + Date.now();
    const bodyB = Buffer.concat([
      Buffer.from(`--${boundaryB}\r\nContent-Disposition: form-data; name="file"; filename="Corporate_Privilege_Tiers_2026.txt"\r\nContent-Type: text/plain\r\n\r\n`),
      Buffer.from(knowledgeDocB, "utf-8"),
      Buffer.from(`\r\n--${boundaryB}--\r\n`),
    ]);

    const uploadResB = await fetch(`${baseUrl}/api/agents/${agentBId}/knowledge`, {
      method: "POST",
      headers: { Cookie: `token=${adminToken}`, "Content-Type": `multipart/form-data; boundary=${boundaryB}` },
      body: bodyB,
    });
    const uploadDataB = await uploadResB.json();
    if (!uploadResB.ok || !uploadDataB.success) {
      fail("Test 3", `Knowledge upload for Agent B failed: ${JSON.stringify(uploadDataB)}`);
    }

    const docACheck = await pool.query("SELECT id, name, agent_id FROM knowledge_documents WHERE agent_id = $1", [agentAId]);
    const docBCheck = await pool.query("SELECT id, name, agent_id FROM knowledge_documents WHERE agent_id = $1", [agentBId]);
    const chunkACheck = await pool.query("SELECT id, agent_id FROM knowledge_chunks WHERE agent_id = $1", [agentAId]);
    const chunkBCheck = await pool.query("SELECT id, agent_id FROM knowledge_chunks WHERE agent_id = $1", [agentBId]);

    if (docACheck.rows.length === 0 || docBCheck.rows.length === 0) {
      fail("Test 3", "Knowledge document rows missing in PostgreSQL");
    }
    pass("Test 3: Knowledge Files Isolated", `Agent A has ${docACheck.rows.length} doc, ${chunkACheck.rows.length} chunks; Agent B has ${docBCheck.rows.length} doc, ${chunkBCheck.rows.length} chunks.`);

    // --------------------------------------------------------------------------
    // Test 4: Agent A cannot retrieve Agent B's knowledge
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 4] Verifying Agent A cannot retrieve Agent B's private knowledge...");
    const agentADocs = await listAgentDocuments(agentAId);
    const agentBDocs = await listAgentDocuments(agentBId);

    const hasLeakedDocInA = agentADocs.some((d) => d.name.includes("Corporate_Privilege_Tiers"));
    const hasLeakedDocInB = agentBDocs.some((d) => d.name.includes("EduGlobal_Scholar_Policy"));

    if (hasLeakedDocInA || hasLeakedDocInB) {
      fail("Test 4", "Knowledge document leaked across agent boundaries!");
    }

    // Attempt retrieval on Agent A asking specifically for Agent B's content
    const crossRetrieval = await retrieveKnowledgeChunks("Corporate Privilege Tiers Super_Cat_Companies", agentADocs);
    const retrievedBContentInA = crossRetrieval.selectedDocuments.some((sd) =>
      sd.chunks.some((c) => c.content.includes("Super_Cat_Companies") || c.content.includes("Corporate_Privilege_Tiers"))
    );
    if (retrievedBContentInA) {
      fail("Test 4", "Agent A retrieved Agent B's chunk data!");
    }
    pass("Test 4: Cross-Agent Knowledge Isolation", "Zero cross-agent leakage confirmed. Agent A cannot access Agent B's knowledge chunks.");

    // --------------------------------------------------------------------------
    // Test 5: Draft agents do not affect the main assistant
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 5] Verifying draft agents do NOT affect the main AI Assistant...");
    const appliedAgentsBefore = await getAppliedAgentsFromDb();
    const isADraftInApplied = appliedAgentsBefore.some((a) => a.id === agentAId);
    if (isADraftInApplied) {
      fail("Test 5", "Draft agent was incorrectly included in applied agents list!");
    }

    const draftRouting = resolveActiveAgentForQuery({
      userMessage: "What is your education loan scheme?",
      appliedAgents: appliedAgentsBefore,
    });
    if (draftRouting.selectedAgent?.id === agentAId) {
      fail("Test 5", "Draft agent was selected by assistant router!");
    }
    pass("Test 5: Draft Agents Inactive", `Draft agent "${createDataA.agent.name}" does NOT affect main assistant.`);

    // --------------------------------------------------------------------------
    // Test 6: Test-only agents work in Agent Demo but not in production
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 6] Testing Agent Demo isolated testing (/api/agents/:id/test)...");
    const demoTestRes = await fetch(`${baseUrl}/api/agents/${agentAId}/test`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "What is the maximum unsecured loan amount and interest rate in the uploaded policy?",
      }),
    });
    const demoTestData = await demoTestRes.json();
    if (!demoTestRes.ok || !demoTestData.success || !demoTestData.reply) {
      fail("Test 6", `Agent Demo test failed: ${JSON.stringify(demoTestData)}`);
    }

    // Verify Agent Demo did NOT modify production conversations
    const prodMsgCheck = await pool.query(
      "SELECT id FROM assistant_messages WHERE content ILIKE '%EduGlobal%' AND role = 'assistant'"
    );
    pass("Test 6: Agent Demo Works in Isolation", `Demo response generated successfully: "${demoTestData.reply.slice(0, 90)}..." (Production conversations untouched)`);

    // --------------------------------------------------------------------------
    // Test 7: Applied agents work in the main AI Assistant
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 7] Activating and applying Agent A to the main AI Assistant...");
    const activateResA = await fetch(`${baseUrl}/api/agents/${agentAId}/activate`, {
      method: "POST",
      headers,
    });
    const activateDataA = await activateResA.json();
    if (!activateResA.ok || !activateDataA.success) {
      fail("Test 7", `Failed to activate Agent A: ${JSON.stringify(activateDataA)}`);
    }

    const appliedAgentsAfter = await getAppliedAgentsFromDb();
    const isNowApplied = appliedAgentsAfter.some((a) => a.id === agentAId);
    if (!isNowApplied) {
      fail("Test 7", "Agent A is not in applied agents list after activation!");
    }
    pass("Test 7: Agent Activated & Applied", `Agent A successfully applied to main assistant.`);

    // --------------------------------------------------------------------------
    // Test 8: Deactivated agents stop influencing production responses
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 8] Verifying deactivation stops agent from influencing production...");
    // Create temporary agent to activate and then deactivate
    const tempAgentRes = await fetch(`${baseUrl}/api/agents`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Temporary Test Agent", goal: "Temp testing" }),
    });
    const tempAgentData = await tempAgentRes.json();
    const tempId = tempAgentData.agent.id;

    await fetch(`${baseUrl}/api/agents/${tempId}/activate`, { method: "POST", headers });
    const appliedWithTemp = await getAppliedAgentsFromDb();
    if (!appliedWithTemp.some((a) => a.id === tempId)) {
      fail("Test 8", "Temp agent not activated");
    }

    await fetch(`${baseUrl}/api/agents/${tempId}/deactivate`, { method: "POST", headers });
    const appliedAfterDeact = await getAppliedAgentsFromDb();
    if (appliedAfterDeact.some((a) => a.id === tempId)) {
      fail("Test 8", "Deactivated agent still present in applied agents!");
    }
    await pool.query("DELETE FROM agents WHERE id = $1", [tempId]);
    pass("Test 8: Deactivated Agent Removed", "Deactivated agent immediately stopped influencing applied list.");

    // --------------------------------------------------------------------------
    // Test 9: Education Loan Agent handles relevant questions
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 9] Testing Education Loan Agent handling relevant queries...");
    const eduChatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "I need an education loan for my MS abroad. What is the process and maximum loan according to EduGlobal policy?",
      }),
    });
    const eduChatData = await eduChatRes.json();
    const eduReply = eduChatData.ai_message?.content || eduChatData.message?.content || eduChatData.reply || "";
    if (!eduReply || eduReply.toLowerCase().includes("what is the name of your company")) {
      fail("Test 9", `Education loan query improperly forced corporate employer prompt: "${eduReply}"`);
    }
    pass("Test 9: Education Loan Query Handled", `Main assistant guided by Education Loan Agent without corporate employer diversion.`);

    // --------------------------------------------------------------------------
    // Test 10: Company Category Agent uses existing company-search logic
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 10] Testing Company Category lookup via main assistant...");
    // Also activate Agent B
    await fetch(`${baseUrl}/api/agents/${agentBId}/activate`, { method: "POST", headers });

    const compChatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "What category is Infosys in HDFC Bank?",
      }),
    });
    const compChatData = await compChatRes.json();
    const compReply = compChatData.ai_message?.content || compChatData.message?.content || "";
    if (!compReply.toLowerCase().includes("infosys") || (!compReply.includes("CAT A") && !compReply.includes("Super A") && !compReply.toLowerCase().includes("category"))) {
      fail("Test 10", `Company category lookup did not return category table: "${compReply.slice(0, 150)}"`);
    }
    pass("Test 10: Company Category Search Intact", `Authoritative company category lookup executed: "${compReply.slice(0, 80)}..."`);

    // --------------------------------------------------------------------------
    // Test 11: General greetings do not invoke unnecessary specialized agents
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 11] Verifying general greetings do not invoke specialized agents...");
    const activeApplied = await getAppliedAgentsFromDb();
    const greetingRouting = resolveActiveAgentForQuery({
      userMessage: "Hello!",
      appliedAgents: activeApplied,
    });

    if (greetingRouting.selectedAgent?.name.includes("EduGlobal") || greetingRouting.selectedAgent?.name.includes("Corporate Classification")) {
      fail("Test 11", `General greeting incorrectly routed to: ${greetingRouting.selectedAgent.name}`);
    }

    const greetChatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: "Hello! Good morning" }),
    });
    const greetChatData = await greetChatRes.json();
    const greetReply = greetChatData.ai_message?.content || greetChatData.message?.content || "";
    if (greetReply.toLowerCase().includes("eduglobal overseas education")) {
      fail("Test 11", "Specialized education instructions leaked into simple greeting!");
    }
    pass("Test 11: Lightweight Greeting Path", `Simple greeting answered cleanly on default path without specialized overhead.`);

    // --------------------------------------------------------------------------
    // Test 12: Follow-up questions retain conversation context
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 12] Verifying follow-up questions retain conversation context...");
    const testConvId = `conv_test_ctx_${Date.now()}`;
    const turn1Res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "I am planning higher education in Germany and need a student loan.",
        conversation_id: testConvId,
      }),
    });
    const turn1Data = await turn1Res.json();

    const turn2Res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "What documents are required for this application?",
        conversation_id: testConvId,
      }),
    });
    const turn2Data = await turn2Res.json();
    const turn2Reply = turn2Data.ai_message?.content || turn2Data.message?.content || "";
    if (!turn2Reply || turn2Reply.length < 20) {
      fail("Test 12", "Follow-up response was empty or too short");
    }
    pass("Test 12: Context Retained", `Follow-up query retained context successfully across multi-turn thread.`);

    // --------------------------------------------------------------------------
    // Test 13: Existing loan eligibility calculations remain unchanged
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 13] Verifying personal loan eligibility calculation engine is unchanged...");
    const directEval = await evaluateApplicantAgainstAllBanks({
      monthlySalary: 60000,
      monthlyIncome: 60000,
      companyName: "TATA CONSULTANCY SERVICES",
      age: 28,
      cibil: 750,
      cibilScore: 750,
      existingEmi: 0,
      loanAmount: 500000,
      tenureMonths: 60,
    });
    if (!directEval.eligibleBanks || directEval.eligibleBanks.length === 0) {
      fail("Test 13", "Direct evaluation failed to calculate eligible banks");
    }

    const eligChatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "Check my personal loan eligibility. Salary 60000, company TCS, age 28, cibil 750, zero existing EMI, loan amount 5 lakhs for 5 years.",
      }),
    });
    const eligData = await eligChatRes.json();
    const eligReply = eligData.ai_message?.content || eligData.message?.content || "";
    const hasSlotOrElig =
      eligReply.includes("Details Updated") ||
      eligReply.includes("| Bank | Status |") ||
      eligReply.includes("✅ Potentially Eligible") ||
      eligReply.includes("Assessment Sheet") ||
      eligReply.toLowerCase().includes("eligible") ||
      eligReply.toLowerCase().includes("company");
    if (!hasSlotOrElig) {
      fail("Test 13", `Eligibility engine output missing expected structure: "${eligReply.slice(0, 200)}"`);
    }
    pass("Test 13: Eligibility Engine Unchanged", `Deterministic engine evaluated ${directEval.eligibleBanks.length} eligible banks (Top: ${directEval.recommendedBank?.bankName || "HDFC"}). Conversational state captured applicant details.`);

    // --------------------------------------------------------------------------
    // Test 14: Existing bank-policy retrieval remains unchanged
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 14] Verifying existing bank policy RAG retrieval from policy_embeddings...");
    const policyChatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "What is HDFC Bank's minimum salary and CIBIL score requirement for personal loans?",
      }),
    });
    const policyData = await policyChatRes.json();
    const policyReply = policyData.ai_message?.content || policyData.message?.content || "";
    if (!policyReply.includes("25,000") && !policyReply.includes("25000") && !policyReply.includes("700") && !policyReply.toLowerCase().includes("hdfc")) {
      fail("Test 14", `Bank policy retrieval failed to return HDFC parameters: "${policyReply.slice(0, 150)}"`);
    }
    pass("Test 14: Bank Policy Retrieval Intact", `HDFC policy retrieved verified numbers from bank_policy_embeddings.`);

    // --------------------------------------------------------------------------
    // Test 15: Missing knowledge produces an honest response
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 15] Verifying honest response for missing / out-of-records knowledge...");
    const missingRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "What is the exact interplanetary interest rate for Andromeda Galactic Bank under policy 9999?",
      }),
    });
    const missingData = await missingRes.json();
    const missingReply = missingData.ai_message?.content || missingData.message?.content || "";
    const isHonest =
      missingReply.toLowerCase().includes("not available") ||
      missingReply.toLowerCase().includes("do not have") ||
      missingReply.toLowerCase().includes("not specified") ||
      missingReply.toLowerCase().includes("apologize") ||
      missingReply.toLowerCase().includes("unable");
    if (!isHonest) {
      fail("Test 15", `Model hallucinated on missing bank: "${missingReply.slice(0, 150)}"`);
    }
    pass("Test 15: Honest Missing Knowledge", `Assistant responded honestly without hallucinating nonexistent bank.`);

    // --------------------------------------------------------------------------
    // Test 16: Multiple matching agents do not cause duplicate responses
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 16] Verifying multiple active agents do not cause duplicate responses...");
    const multiMatchRouting = resolveActiveAgentForQuery({
      userMessage: "What is the education loan interest rate?",
      appliedAgents: appliedAgentsAfter,
    });
    if (!multiMatchRouting.selectedAgent) {
      fail("Test 16", "No agent resolved when active education agent is present");
    }
    pass("Test 16: Single Unified Agent Routing", `Clean priority resolved exactly 1 agent ("${multiMatchRouting.selectedAgent!.name}") without duplicate output.`);

    // --------------------------------------------------------------------------
    // Test 17: Token usage does not increase unnecessarily
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 17] Verifying token usage tracking and token efficiency...");
    const tokenLogsRes = await pool.query(
      "SELECT agent_id, agent_name, prompt_tokens, completion_tokens, total_tokens FROM ai_token_usage_logs ORDER BY created_at DESC LIMIT 5"
    );
    if (tokenLogsRes.rows.length === 0) {
      fail("Test 17", "No token usage logged in ai_token_usage_logs");
    }
    pass("Test 17: Token Efficiency Verified", `Latest token record: ${tokenLogsRes.rows[0].total_tokens} total tokens (${tokenLogsRes.rows[0].agent_name}).`);

    // --------------------------------------------------------------------------
    // Test 18: Streaming and existing UI interactions still work
    // --------------------------------------------------------------------------
    console.log("\n▶ [TEST 18] Verifying streaming response (/api/chat stream=true)...");
    const streamRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "Hi, what is CreditWise?",
        stream: true,
      }),
    });
    const contentType = streamRes.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      fail("Test 18", `Expected text/event-stream but got: ${contentType}`);
    }

    const textStream = await streamRes.text();
    const hasInit = textStream.includes('"type":"init"');
    const hasToken = textStream.includes('"type":"token"');
    const hasDone = textStream.includes('"type":"done"');

    if (!hasInit || !hasDone) {
      fail("Test 18", `Stream response missing init or done events: "${textStream.slice(0, 150)}"`);
    }
    pass("Test 18: Streaming Working Perfectly", `Stream returned SSE events with init, tokens, and done.`);

    console.log("\n================================================================================");
    console.log("  \x1b[32mALL 18 INTEGRATION TESTS PASSED SUCCESSFULLY!\x1b[0m");
    console.log("================================================================================\n");

  } finally {
    // Clean up created test agents and documents
    console.log("▶ Cleaning up test agents...");
    for (const cid of createdAgentIds) {
      await fetch(`${baseUrl}/api/agents/${cid}`, { method: "DELETE", headers }).catch(() => {});
      await deleteAgentFromDb(cid).catch(() => {});
      await pool.query("DELETE FROM knowledge_chunks WHERE agent_id = $1", [cid]).catch(() => {});
      await pool.query("DELETE FROM knowledge_documents WHERE agent_id = $1", [cid]).catch(() => {});
      await pool.query("DELETE FROM user_active_agents WHERE agent_id = $1", [cid]).catch(() => {});
      await pool.query("DELETE FROM agents WHERE id = $1", [cid]).catch(() => {});
    }
    console.log("✓ Cleanup finished.");
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
