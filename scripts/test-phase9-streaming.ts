/**
 * PHASE 9 — Test Policy RAG Response Streaming
 * Tests progressive streaming, TTFT, Yes Bank, and multi-turn policy questions.
 */

import { runCentralAgent } from "../lib/ai/agent";
import { answerPolicyWithRag, resolvePolicyTarget } from "../lib/policyRag";

async function main() {
  console.log("================================================================================");
  console.log("PHASE 9 — STREAM POLICY RAG RESPONSE VERIFICATION");
  console.log("================================================================================\n");

  let allPassed = true;

  // ---------------------------------------------------------------------------
  // TEST 1: Yes Bank Policy Streaming
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 1: Yes Bank Full Policy Streaming (\"policy of the Yes Bank\")");
  console.log("--------------------------------------------------------------------------------");

  const yesBankTarget = await resolvePolicyTarget("Yes Bank");
  console.log(`Resolved Target: bank=${yesBankTarget?.bankName}, policyFileId=${yesBankTarget?.policyFileId}`);

  let tokenCount = 0;
  let firstTokenTime: number | null = null;
  const startT1 = Date.now();
  let fullStreamedText = "";

  const ragResult = await answerPolicyWithRag({
    query: "policy of the Yes Bank",
    policyFileId: yesBankTarget?.policyFileId,
    bankId: yesBankTarget?.bankId,
    bankName: yesBankTarget?.bankName,
    topK: 10,
    onToken: (tok: string) => {
      tokenCount++;
      if (!firstTokenTime) {
        firstTokenTime = Date.now();
      }
      fullStreamedText += tok;
    },
  });

  const totalT1 = Date.now() - startT1;
  const ttftT1 = firstTokenTime ? firstTokenTime - startT1 : totalT1;

  console.log(`- Tokens received:        ${tokenCount}`);
  console.log(`- TTFT (Time To First Token): ${ttftT1}ms`);
  console.log(`- Total Duration:         ${totalT1}ms`);
  console.log(`- Streamed chars:         ${fullStreamedText.length}`);
  console.log(`- Final answer chars:     ${ragResult.answer.length}`);
  console.log(`- Answer preview:         ${ragResult.answer.slice(0, 150).replace(/\n/g, " ")}...`);

  const pass1 =
    tokenCount > 5 &&
    ragResult.answer.includes("Yes Bank") &&
    ragResult.sources.every((s) => s.fileName.includes("Yes_Bank"));
  console.log(`STATUS: ${pass1 ? "PASS ✅" : "FAIL ❌"}\n`);
  if (!pass1) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 2: Focused Policy Queries
  // ---------------------------------------------------------------------------
  const focusedQueries = [
    { query: "What is the minimum CIBIL requirement for Yes Bank?", bank: "Yes Bank" },
    { query: "What is the FOIR for Yes Bank?", bank: "Yes Bank" },
    { query: "What documents are required for Yes Bank?", bank: "Yes Bank" },
    { query: "What is the maximum tenure for Yes Bank?", bank: "Yes Bank" },
    { query: "What is the policy of Axis Finance?", bank: "Axis Finance" },
    { query: "What is the policy of HDFC?", bank: "HDFC Bank" },
  ];

  for (const item of focusedQueries) {
    console.log("--------------------------------------------------------------------------------");
    console.log(`TEST: "${item.query}" (${item.bank})`);
    console.log("--------------------------------------------------------------------------------");

    let tokens = 0;
    let ftTime: number | null = null;
    const qStart = Date.now();

    const target = await resolvePolicyTarget(item.bank);
    const res = await answerPolicyWithRag({
      query: item.query,
      policyFileId: target?.policyFileId,
      bankId: target?.bankId,
      bankName: target?.bankName,
      topK: 5,
      onToken: () => {
        tokens++;
        if (!ftTime) ftTime = Date.now();
      },
    });

    const qDur = Date.now() - qStart;
    const ttft = ftTime ? ftTime - qStart : qDur;

    console.log(`- Tokens streamed:    ${tokens}`);
    console.log(`- TTFT:               ${ttft}ms`);
    console.log(`- Total duration:     ${qDur}ms`);
    console.log(`- Sources cited:      ${res.sources.map(s => s.fileName).join(", ")}`);
    console.log(`- Answer preview:     ${res.answer.slice(0, 120).replace(/\n/g, " ")}...`);

    const qPass = tokens > 0 && res.answer.length > 50 && res.sources.length > 0;
    console.log(`STATUS: ${qPass ? "PASS ✅" : "FAIL ❌"}\n`);
    if (!qPass) allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Multi-turn Conversation & Context Switching
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 3: Multi-turn Streaming Conversation & Context Switching");
  console.log("--------------------------------------------------------------------------------");

  const convId = "test-streaming-conv-" + Date.now();
  let history: Array<{ role: string; content: string }> = [];

  // Turn 1: Yes Bank
  let turn1Tokens = 0;
  const t1 = await runCentralAgent({
    message: "policy of Yes Bank",
    conversationId: convId,
    conversationHistory: history,
    onToken: () => { turn1Tokens++; },
  });
  console.log(`Turn 1 ("policy of Yes Bank") -> tokens: ${turn1Tokens}, reply length: ${t1.reply.length}`);
  history.push({ role: "user", content: "policy of Yes Bank" });
  history.push({ role: "assistant", content: t1.reply });

  // Turn 2: Coreference follow-up
  let turn2Tokens = 0;
  const t2 = await runCentralAgent({
    message: "What is the minimum CIBIL?",
    conversationId: convId,
    conversationHistory: history,
    onToken: () => { turn2Tokens++; },
  });
  console.log(`Turn 2 ("What is the minimum CIBIL?") -> tokens: ${turn2Tokens}, reply preview: ${t2.reply.slice(0, 100).replace(/\n/g, " ")}...`);
  history.push({ role: "user", content: "What is the minimum CIBIL?" });
  history.push({ role: "assistant", content: t2.reply });

  // Turn 3: Switch bank to Axis Finance
  let turn3Tokens = 0;
  const t3 = await runCentralAgent({
    message: "What about Axis Finance?",
    conversationId: convId,
    conversationHistory: history,
    onToken: () => { turn3Tokens++; },
  });
  console.log(`Turn 3 ("What about Axis Finance?") -> tokens: ${turn3Tokens}, reply preview: ${t3.reply.slice(0, 100).replace(/\n/g, " ")}...`);

  const pass3 =
    turn1Tokens > 0 &&
    turn2Tokens > 0 &&
    turn3Tokens > 0 &&
    t2.reply.toLowerCase().includes("yes bank") &&
    t3.reply.toLowerCase().includes("axis finance");

  console.log(`STATUS: ${pass3 ? "PASS ✅" : "FAIL ❌"}\n`);
  if (!pass3) allPassed = false;

  console.log("================================================================================");
  console.log(`FINAL RESULT: ${allPassed ? "ALL STREAMING TESTS PASSED ✅" : "FAILURES DETECTED ❌"}`);
  console.log("================================================================================");

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error in test script:", err);
  process.exit(1);
});
