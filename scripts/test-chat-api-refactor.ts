// scripts/test-chat-api-refactor.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import pool from "../lib/db";
import { signToken } from "../lib/auth";

async function runRefactorTests() {
  console.log("================================================================================");
  console.log("TESTING REFACTORED AI ASSISTANT CHAT API & RETRIEVAL PIPELINE");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3001";
  const token = signToken({ id: 1, email: "admin@gmail.com", name: "Rutuja Rite", role: "admin" });
  const headers = {
    Cookie: `token=${token}`,
    "Content-Type": "application/json",
  };

  const convId = `test-refactor-${Date.now()}`;

  // ---------------------------------------------------------------------------
  // TEST 1: Policy Intent Retrieval & Response
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 1: POLICY Intent via /api/chat");
  console.log("--------------------------------------------------------------------------------");

  const policyQuery = "What is the minimum CIBIL cutoff and salary requirement for HDFC Bank personal loan?";
  const policyRes = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: policyQuery,
      conversation_id: convId,
      stream: false,
    }),
  });

  const policyData = await policyRes.json();
  console.log("Status:", policyRes.status);
  console.log("Response Success:", policyData.success);
  console.log("Retrieval Intent:", policyData.message?.retrieval_intent);
  console.log("Used Knowledge Documents:", policyData.message?.used_knowledge_documents);
  console.log("\nReply Snippet:\n", String(policyData.message?.content || "").slice(0, 300), "...\n");

  const passTest1 =
    policyRes.status === 200 &&
    policyData.success &&
    policyData.message?.retrieval_intent === "POLICY" &&
    String(policyData.message?.content || "").length > 50;

  console.log(`TEST 1 (POLICY Intent): ${passTest1 ? "PASS ✅" : "FAIL ❌"}\n`);

  // ---------------------------------------------------------------------------
  // TEST 2: Agent Knowledge Intent via /api/chat
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 2: AGENT_KNOWLEDGE Intent via /api/chat");
  console.log("--------------------------------------------------------------------------------");

  const akQuery = "What are your agent instructions, rules, and guardrails configured in studio?";
  const akRes = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: akQuery,
      conversation_id: convId,
      stream: false,
    }),
  });

  const akData = await akRes.json();
  console.log("Status:", akRes.status);
  console.log("Response Success:", akData.success);
  console.log("Retrieval Intent:", akData.message?.retrieval_intent);
  console.log("\nReply Snippet:\n", String(akData.message?.content || "").slice(0, 300), "...\n");

  const passTest2 =
    akRes.status === 200 &&
    akData.success &&
    akData.message?.retrieval_intent === "AGENT_KNOWLEDGE";

  console.log(`TEST 2 (AGENT_KNOWLEDGE Intent): ${passTest2 ? "PASS ✅" : "FAIL ❌"}\n`);

  // ---------------------------------------------------------------------------
  // TEST 3: General Intent via /api/chat (Bypasses vector filtering & uses foundational intelligence)
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 3: GENERAL Intent via /api/chat");
  console.log("--------------------------------------------------------------------------------");

  const genQuery = "Hello! How does compound interest differ from simple interest?";
  const genRes = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: genQuery,
      conversation_id: convId,
      stream: false,
    }),
  });

  const genData = await genRes.json();
  console.log("Status:", genRes.status);
  console.log("Response Success:", genData.success);
  console.log("Retrieval Intent:", genData.message?.retrieval_intent);
  console.log("\nReply Snippet:\n", String(genData.message?.content || "").slice(0, 300), "...\n");

  const passTest3 =
    genRes.status === 200 &&
    genData.success &&
    genData.message?.retrieval_intent === "GENERAL" &&
    String(genData.message?.content || "").length > 50;

  console.log(`TEST 3 (GENERAL Intent): ${passTest3 ? "PASS ✅" : "FAIL ❌"}\n`);

  // ---------------------------------------------------------------------------
  // TEST 4: Seamless Streaming (ReadableStream / SSE)
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 4: Seamless SSE Streaming (stream: true)");
  console.log("--------------------------------------------------------------------------------");

  const streamQuery = "Explain personal loan eligibility in 3 concise bullet points";
  const streamRes = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: streamQuery,
      conversation_id: convId,
      stream: true,
    }),
  });

  console.log("Status:", streamRes.status);
  console.log("Content-Type:", streamRes.headers.get("content-type"));

  let initReceived = false;
  let tokenCount = 0;
  let doneReceived = false;
  let fullStreamedText = "";

  if (streamRes.body) {
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = JSON.parse(trimmed.slice(5).trim());

        if (payload.type === "init") {
          initReceived = true;
        } else if (payload.type === "token") {
          tokenCount++;
          fullStreamedText += payload.text;
        } else if (payload.type === "done") {
          doneReceived = true;
        }
      }
    }
  }

  console.log(`Stream Event Summary: init=${initReceived}, tokens=${tokenCount}, done=${doneReceived}`);
  console.log("Full Streamed Text Snippet:\n", fullStreamedText.slice(0, 250), "...\n");

  const passTest4 = initReceived && tokenCount > 0 && doneReceived && fullStreamedText.length > 50;
  console.log(`TEST 4 (SSE Streaming): ${passTest4 ? "PASS ✅" : "FAIL ❌"}\n`);

  // ---------------------------------------------------------------------------
  // TEST 5: Session Memory & Variable Tracking Over Multi-Turn Conversation
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 5: Multi-Turn Session Memory & Variable Updates");
  console.log("--------------------------------------------------------------------------------");

  const memoryConvId = `memory-test-${Date.now()}`;

  // Turn 1: Provide salary, EMI, and loan amount
  console.log("Turn 1: User provides salary 55,000, EMI 4,000, loan amount 5 lakhs");
  const turn1Res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: "My monthly salary is 55000 and my existing EMI is 4000. I need a loan of 5 lakhs.",
      conversation_id: memoryConvId,
      stream: false,
    }),
  });
  const turn1Data = await turn1Res.json();
  console.log("Turn 1 status:", turn1Res.status);

  // Turn 2: User asks follow-up relying on memory from Turn 1
  console.log("\nTurn 2: User asks 'Which partner banks can I apply to?' (relying on memory)");
  const turn2Res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: "Which partner banks can I apply to?",
      conversation_id: memoryConvId,
      stream: false,
    }),
  });
  const turn2Data = await turn2Res.json();
  console.log("Turn 2 reply:\n", String(turn2Data.message?.content || "").slice(0, 250), "...\n");

  // Turn 3: User updates/corrects salary to 85,000 and CIBIL to 790
  console.log("Turn 3: User updates salary to 85,000 and CIBIL to 790");
  const turn3Res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: "Actually my salary is 85000 and my CIBIL score is 790. Recalculate my eligibility.",
      conversation_id: memoryConvId,
      stream: false,
    }),
  });
  const turn3Data = await turn3Res.json();
  console.log("Turn 3 status:", turn3Res.status);

  // Verify PostgreSQL state has updated variables
  const dbStateRes = await pool.query(
    `SELECT state FROM assistant_conversation_states WHERE conversation_id = $1`,
    [memoryConvId]
  );
  const savedState = dbStateRes.rows[0]?.state;
  console.log("\nPersisted State in PostgreSQL assistant_conversation_states:");
  console.log("- Applicant:", savedState?.applicant);
  console.log("- Session Variables:", savedState?.sessionVariables);

  const passMemoryAndVars =
    savedState?.sessionVariables?.monthlySalary === 85000 &&
    savedState?.sessionVariables?.cibilScore === 790 &&
    savedState?.sessionVariables?.existingEmi === 4000 &&
    savedState?.sessionVariables?.loanAmount === 500000;

  console.log(`\nTEST 5 (Session Memory & Variable Tracking): ${passMemoryAndVars ? "PASS ✅" : "FAIL ❌"}\n`);

  // Cleanup test conversations
  await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id IN ($1, $2)`, [convId, memoryConvId]);

  console.log("================================================================================");
  console.log("ALL TESTS FINISHED SUCCESSFULLY");
  console.log("================================================================================");
}

runRefactorTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
