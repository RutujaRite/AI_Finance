import fs from 'fs';
import path from 'path';

async function runHttpE2eTest() {
  console.log("==========================================================");
  console.log("  HTTP REST API END-TO-END VERIFICATION");
  console.log("==========================================================\n");

  const baseUrl = "http://localhost:3001";
  
  // 1. Read cookie from cookies.txt or login directly
  console.log("▶ 1. Authenticating as Admin via /api/auth/login...");
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@gmail.com", password: "12345" }),
  });
  
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const tokenMatch = setCookie.match(/token=([^;]+)/);
  if (!tokenMatch) {
    throw new Error("No token cookie returned from login!");
  }
  const tokenCookie = `token=${tokenMatch[1]}`;
  console.log("✓ Successfully authenticated. Cookie acquired.");

  const authHeaders = {
    "Cookie": tokenCookie,
    "Content-Type": "application/json",
  };

  // 2. GET /api/agents
  console.log("\n▶ 2. GET /api/agents (List agents)...");
  const listRes = await fetch(`${baseUrl}/api/agents`, { headers: authHeaders });
  if (!listRes.ok) {
    throw new Error(`Failed to list agents: ${listRes.status} ${await listRes.text()}`);
  }
  const listData = await listRes.json();
  console.log(`✓ Fetched ${listData.agents.length} agents:`);
  for (const a of listData.agents) {
    console.log(`   - ${a.name} (ID: ${a.id}, Mode: ${a.operationalMode || 'standard'}, Status: ${a.status}, Docs: ${a.documentCount || 0})`);
  }

  // 3. POST /api/agents (Create Agent)
  console.log("\n▶ 3. POST /api/agents (Create new 'E2E Compliance Agent')...");
  const newAgentPayload = {
    name: "E2E Compliance Agent",
    description: "Configured agent for compliance and policy queries",
    operationalMode: "rag_focused",
    goal: "Enforce strict compliance guidelines on loan policies.",
    instructions: {
      businessDescription: "Financial Compliance",
      agentRole: "Compliance Officer",
      tone: "Strict, professional, clear",
      escalationRules: "Escalate compliance exceptions to Legal.",
      additionalInstructions: "Always reference compliance rules.",
    },
    generalInstructions: {
      role: "Compliance Officer",
      goal: "Enforce compliance rules without exception.",
      behaviour: ["Be precise", "Cite policy"],
      customRules: "Never approve without full documentation.",
    },
    guardrailTemplates: ["No Hallucination", "Privacy Protection"],
    manualGuardrails: "Do not invent approval terms.",
    globalGuardrails: {
      neverFalseInfo: true,
      protectSystemPrompt: true,
      preventHallucinations: true,
      customGuardrails: "Do not bypass any document requirement.",
    },
    capabilities: {
      answer_questions: true,
      search_knowledge: true,
    },
  };

  const createRes = await fetch(`${baseUrl}/api/agents`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(newAgentPayload),
  });
  if (!createRes.ok) {
    throw new Error(`Create agent failed: ${createRes.status} ${await createRes.text()}`);
  }
  const createData = await createRes.json();
  const createdAgentId = createData.agent.id;
  console.log(`✓ Created agent successfully: ID = ${createdAgentId}`);

  // 4. GET /api/agents/:id
  console.log(`\n▶ 4. GET /api/agents/${createdAgentId}...`);
  const getRes = await fetch(`${baseUrl}/api/agents/${createdAgentId}`, { headers: authHeaders });
  if (!getRes.ok) {
    throw new Error(`Get agent failed: ${getRes.status}`);
  }
  const getData = await getRes.json();
  console.log(`✓ Retrieved agent: ${getData.agent.name}, Mode: ${getData.agent.operationalMode}`);

  // 5. PATCH /api/agents/:id (Update Mode & Goal)
  console.log(`\n▶ 5. PATCH /api/agents/${createdAgentId} (Update Goal)...`);
  const patchRes = await fetch(`${baseUrl}/api/agents/${createdAgentId}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      goal: "Updated Goal: Strict loan compliance with verified documents only.",
      operationalMode: "task_focused",
    }),
  });
  if (!patchRes.ok) {
    throw new Error(`Update agent failed: ${patchRes.status}`);
  }
  const patchData = await patchRes.json();
  console.log(`✓ Updated agent goal: "${patchData.agent.goal}", Mode: ${patchData.agent.operationalMode}`);

  // 6. POST /api/agents/:id/test (Isolated Test Agent)
  console.log(`\n▶ 6. POST /api/agents/${createdAgentId}/test (Isolated Test Agent Chat)...`);
  const testRes = await fetch(`${baseUrl}/api/agents/${createdAgentId}/test`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      message: "What are the compliance requirements for personal loans?",
      history: [],
    }),
  });
  if (!testRes.ok) {
    throw new Error(`Test agent failed: ${testRes.status} ${await testRes.text()}`);
  }
  const testData = await testRes.json();
  console.log(`✓ Test Agent Reply: "${testData.reply.slice(0, 140)}..."`);
  console.log("✓ Debug Info returned:");
  console.log(`   - Agent Used: ${testData.debug?.agentName || createdAgentId}`);
  console.log(`   - Mode: ${testData.debug?.operationalMode}`);
  console.log(`   - Chunks Retrieved: ${testData.debug?.chunksRetrieved}`);
  console.log(`   - Document Instructions Applied: ${testData.debug?.documentInstructionsApplied}`);
  console.log(`   - Guardrails Applied: ${testData.debug?.guardrailsApplied}`);
  console.log(`   - Production Data Used: ${testData.debug?.productionDataUsed ? "YES (ERROR)" : "Not Used ✓"}`);

  if (testData.debug?.productionDataUsed !== false) {
    throw new Error("Production data isolation violated!");
  }

  // 7. PATCH /api/agents/:id (Activate Agent)
  console.log(`\n▶ 7. PATCH /api/agents/${createdAgentId} (Activate Agent)...`);
  const activateRes = await fetch(`${baseUrl}/api/agents/${createdAgentId}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ status: "active" }),
  });
  if (!activateRes.ok) {
    throw new Error(`Activate failed: ${activateRes.status}`);
  }
  console.log("✓ Agent activated. Verifying single active agent rule...");
  const listAfterActRes = await fetch(`${baseUrl}/api/agents`, { headers: authHeaders });
  const listAfterAct = await listAfterActRes.json();
  const activeAgents = listAfterAct.agents.filter((a: any) => a.status === "active");
  console.log(`✓ Total active agents: ${activeAgents.length} (Active: ${activeAgents[0]?.name})`);
  if (activeAgents.length !== 1 || activeAgents[0]?.id !== createdAgentId) {
    throw new Error("Single active agent rule not satisfied!");
  }

  // 8. Test live /api/chat with the active agent
  console.log("\n▶ 8. POST /api/chat (Test live assistant steered by active agent)...");
  const chatRes = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      message: "Hello, what are your compliance instructions?",
    }),
  });
  if (!chatRes.ok) {
    throw new Error(`Chat failed: ${chatRes.status} ${await chatRes.text()}`);
  }
  const chatData = await chatRes.json();
  const replyText = chatData.ai_message?.content || chatData.reply || "";
  console.log(`✓ Live Assistant Response: "${replyText.slice(0, 140)}..."`);
  if (!replyText) {
    throw new Error("Live Assistant did not return a response message!");
  }

  // 9. DELETE /api/agents/:id (Delete Agent)
  console.log(`\n▶ 9. DELETE /api/agents/${createdAgentId} (Delete Agent)...`);
  const deleteRes = await fetch(`${baseUrl}/api/agents/${createdAgentId}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  if (!deleteRes.ok) {
    throw new Error(`Delete agent failed: ${deleteRes.status} ${await deleteRes.text()}`);
  }
  console.log("✓ Agent successfully deleted.");

  // 10. Restore agent_loan_assistant to active
  console.log("\n▶ 10. Restoring 'agent_loan_assistant' to active...");
  await fetch(`${baseUrl}/api/agents/agent_loan_assistant`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ status: "active" }),
  });
  const finalListRes = await fetch(`${baseUrl}/api/agents`, { headers: authHeaders });
  const finalList = await finalListRes.json();
  const finalActive = finalList.agents.find((a: any) => a.status === "active");
  console.log(`✓ Restored active agent: "${finalActive?.name}" (${finalActive?.id})`);

  console.log("\n==========================================================");
  console.log("  ALL HTTP REST API TESTS PASSED 100%!");
  console.log("==========================================================");
}

runHttpE2eTest().catch((err) => {
  console.error("FATAL ERROR in HTTP E2E Test:", err);
  process.exit(1);
});
