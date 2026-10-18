import fs from "fs";

async function runTestSuite() {
  console.log("================================================================================");
  console.log("  AI AGENT CONFIGURATION — FULL COMPREHENSIVE VERIFICATION SUITE");
  console.log("================================================================================\n");

  const rawCookie = fs.readFileSync("/tmp/cw_cookies.txt", "utf8");
  const match = rawCookie.match(/token\s+([A-Za-z0-9_\-\.]+)/);
  const cookie = "token=" + (match ? match[1] : "");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (details) console.error(`   ${details}`);
      failed++;
    }
  }

  // 1. Verify /agent-studio HTML renders "AI Agent Configuration"
  console.log("▶ [CHECK 1] AI Agent Configuration Page Rendering & Branding...");
  const studioRes = await fetch("http://localhost:3001/agent-studio", {
    headers: { Cookie: cookie },
  });
  const studioHtml = await studioRes.text();
  assert(studioRes.status === 200, "GET /agent-studio returns HTTP 200");
  assert(
    studioHtml.includes("AI Agent Configuration"),
    "Page title and breadcrumbs display 'AI Agent Configuration'"
  );
  assert(
    !studioHtml.includes("title=\"AI Agent Studio\""),
    "Old title 'AI Agent Studio' is completely removed"
  );

  // 2. Verify /admin Dashboard card & table rows
  console.log("\n▶ [CHECK 2] Admin Dashboard Integration...");
  const adminPageContent = fs.readFileSync("app/admin/page.tsx", "utf8");
  assert(
    adminPageContent.includes('title: "AI Agent Configuration"'),
    "Dashboard card configured with title 'AI Agent Configuration'"
  );
  assert(
    adminPageContent.includes("AI Agent Configuration</div>"),
    "Recent activity table displays 'AI Agent Configuration'"
  );

  // 3. Verify Topbar & AdminHeader components
  console.log("\n▶ [CHECK 3] Global Navigation & Topbars...");
  const topbarContent = fs.readFileSync("components/Topbar.tsx", "utf8");
  assert(
    topbarContent.includes('label: "AI Agent Configuration"'),
    "Topbar admin tools dropdown lists 'AI Agent Configuration'"
  );
  const adminHeaderContent = fs.readFileSync("components/admin/AdminHeader.tsx", "utf8");
  assert(
    adminHeaderContent.includes("AI Agent Configuration</span>"),
    "AdminHeader profile menu and mobile drawer display 'AI Agent Configuration'"
  );
  const studioSidebarContent = fs.readFileSync("components/agent-studio/StudioSidebar.tsx", "utf8");
  assert(
    studioSidebarContent.includes("AI Agent Configuration"),
    "StudioSidebar brand header displays 'AI Agent Configuration'"
  );

  // 4. Module 1: AI Instructions
  console.log("\n▶ [CHECK 4] Module 1: AI Instructions Connectivity...");
  const agentsRes = await fetch("http://localhost:3001/api/agents", {
    headers: { Cookie: cookie },
  });
  const agentsData = await agentsRes.json();
  assert(
    agentsRes.status === 200 && agentsData.success === true,
    "GET /api/agents connects and returns agent list (Status 200)"
  );
  assert(
    Array.isArray(agentsData.agents) && agentsData.agents.length > 0,
    `Agents loaded successfully (${agentsData.agents?.length || 0} agents found)`
  );

  // 5. Module 2: Knowledge Base
  console.log("\n▶ [CHECK 5] Module 2: Knowledge Base Connectivity...");
  const kbRes = await fetch(
    "http://localhost:3001/api/knowledge-files?agentId=agent_loan_assistant",
    {
      headers: { Cookie: cookie },
    }
  );
  const kbData = await kbRes.json();
  assert(
    kbRes.status === 200 && kbData.success === true,
    "GET /api/knowledge-files responds with 200 and success status"
  );
  assert(
    kbData.isKnowledgeAgent === true,
    "Knowledge Base engine correctly identifies Knowledge Base Agent"
  );

  // 6. Module 3: Agent Test / Demo
  console.log("\n▶ [CHECK 6] Module 3: Agent Test / Demo Connectivity...");
  const testRes = await fetch(
    "http://localhost:3001/api/agents/agent_loan_assistant/test",
    {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "What is the CIBIL cutoff and salary requirement for TCS?",
      }),
    }
  );
  const testData = await testRes.json();
  assert(
    testRes.status === 200 && testData.success === true,
    "POST /api/agents/[id]/test executes end-to-end simulation pipeline (Status 200)"
  );
  assert(
    Array.isArray(testData.pipeline) && testData.pipeline.length > 0,
    `Pipeline executed with ${testData.pipeline?.length || 0} steps (Question, Knowledge, Guardrails)`
  );

  // 7. Module 4: Token Analytics
  console.log("\n▶ [CHECK 7] Module 4: Token Analytics Connectivity...");
  const tokensRes = await fetch("http://localhost:3001/api/agents/tokens", {
    headers: { Cookie: cookie },
  });
  const tokensData = await tokensRes.json();
  assert(
    tokensRes.status === 200 && tokensData.success === true,
    "GET /api/agents/tokens returns 200 with live token summary"
  );
  assert(
    typeof tokensData.summary?.totalTokens === "number",
    `Token metrics active: ${tokensData.summary?.totalTokens} total tokens tracked across ${tokensData.summary?.totalCalls} calls`
  );

  // 8. Module 5: Model Configuration
  console.log("\n▶ [CHECK 8] Module 5: Model Configuration Connectivity...");
  const modelRes = await fetch("http://localhost:3001/api/admin/studio-model", {
    headers: { Cookie: cookie },
  });
  const modelData = await modelRes.json();
  assert(
    modelRes.status === 200 && modelData.success === true,
    "GET /api/admin/studio-model returns active provider and config"
  );
  assert(
    modelData.config?.provider === "OpenRouter",
    `Active model provider verified: ${modelData.config?.provider} (${modelData.config?.model_identifier})`
  );

  // 9. Module 6: Settings & Alias Routes
  console.log("\n▶ [CHECK 9] Module 6: Settings & Backward-Compatible Aliases...");
  const aliasRes = await fetch("http://localhost:3001/ai-agent-configuration", {
    headers: { Cookie: cookie },
  });
  assert(
    aliasRes.status === 200,
    "Alias route /ai-agent-configuration renders with HTTP 200"
  );
  const adminAliasRes = await fetch(
    "http://localhost:3001/admin/ai-agent-configuration",
    {
      headers: { Cookie: cookie },
    }
  );
  assert(
    adminAliasRes.status === 200,
    "Admin alias /admin/ai-agent-configuration renders with HTTP 200"
  );

  console.log("\n================================================================================");
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
