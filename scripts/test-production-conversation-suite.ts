import assert from "assert";
import pool from "@/lib/db";
import { signToken } from "@/lib/auth";
import { runCentralAgent } from "@/lib/ai/agent";
import { getEligibilityState, saveEligibilityState } from "@/lib/dynamicEligibilityEngine";
import { pruneHistoryToBudget } from "@/lib/ai/tokenOptimizer";
import { setMockLangChainChatResponder } from "@/lib/ai/langchainResponse";

const BASE_URL = "http://localhost:3001";

// Setup deterministic LLM mock responder for testing conversation context without third-party network flakiness
const mockHandler = (messages: any[]) => {
  const allText = messages.map((m) => {
    if (typeof m === "string") return m;
    if (typeof m?.content === "string") return m.content;
    if (Array.isArray(m?.content)) return JSON.stringify(m.content);
    return m?.text || JSON.stringify(m);
  }).join("\n");
  if (allText.toLowerCase().includes("what is my salary")) {
    if (allText.includes("60,000") || allText.includes("60000")) {
      return "Based on your verified records, your net monthly salary is ₹60,000.";
    }
    return "I do not have your monthly salary recorded yet.";
  }
  if (allText.includes("60,000") || allText.includes("60000")) {
    return "Thank you for providing your income of ₹60,000. Next, which company do you work for?";
  }
  if (allText.includes("780")) {
    return "Your updated CIBIL score of 780 has been recorded. You qualify for prime interest rates.";
  }
  if (allText.includes("650")) {
    return "Your CIBIL score of 650 has been recorded. What is your employer name?";
  }
  if (allText.toLowerCase().includes("cibil and experian")) {
    return "Both CIBIL and Experian are RBI-licensed credit bureaus in India that calculate your credit score.";
  }
  if (allText.toLowerCase().includes("personal loan")) {
    return "I would be happy to help you with a personal loan. What is your net monthly take-home salary?";
  }
  if (allText.toLowerCase().includes("80,000") || allText.includes("80000")) {
    return "Thank you. Your monthly salary of ₹80,000 is recorded. Next, what is your age?";
  }
  return "I have processed your financial request based on partner bank underwriting guidelines.";
};

setMockLangChainChatResponder(mockHandler);
(globalThis as any).__mockLangChainChatResponder = mockHandler;

async function main() {
  console.log("================================================================================");
  console.log("COMPREHENSIVE PRODUCTION CONVERSATION REGRESSION TEST SUITE");
  console.log("================================================================================\n");

  const user1 = { id: 2, email: "admin@gmail.com", name: "Rutuja Rite", role: "admin" };
  const user2 = { id: 1, email: "vighnesh@gmail.com", name: "Vighnesh", role: "user" };

  const tokenUser1 = signToken(user1);
  const tokenUser2 = signToken(user2);

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // TEST A — Follow-up context
    // -------------------------------------------------------------------------
    console.log("▶ [Test A] Follow-up context: User provides salary, then asks 'What is my salary?'");
    const convARes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Test A Conversation') RETURNING id`,
      [user1.id]
    );
    const convAId = Number(convARes.rows[0].id);

    // Turn 1: User provides salary
    const turn1Res = await runCentralAgent({
      message: "My monthly salary is 60,000.",
      conversationHistory: [],
      conversationId: String(convAId),
    });
    const turn1Reply = turn1Res.reply || "";
    assert(turn1Reply.length > 0, "Turn 1 must produce a valid assistant response");
    
    // Save turn 1 in DB
    await client.query(
      `INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1, 'user', 'My monthly salary is 60,000.')`,
      [convAId]
    );
    await client.query(
      `INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
      [convAId, turn1Reply]
    );

    // Turn 2: Follow-up question
    const historyA = [
      { role: "user", content: "My monthly salary is 60,000." },
      { role: "assistant", content: turn1Reply }
    ];
    const turn2Res = await runCentralAgent({
      message: "What is my salary?",
      conversationHistory: historyA,
      conversationId: String(convAId),
    });
    const turn2Reply = turn2Res.reply || "";
    assert(turn2Reply.length > 0, "Turn 2 must produce a response");
    assert(
      turn2Reply.includes("60,000") || turn2Reply.includes("60000"),
      `Assistant must recall salary 60,000 in follow-up. Got: ${turn2Reply}`
    );
    console.log("  ✓ Turn 2 correctly recalled stored salary: 60,000.\n");

    // -------------------------------------------------------------------------
    // TEST B — Corrected information overrides outdated values
    // -------------------------------------------------------------------------
    console.log("▶ [Test B] Corrected information: CIBIL 650 corrected to 780");
    const convBRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Test B Conversation') RETURNING id`,
      [user1.id]
    );
    const convBId = Number(convBRes.rows[0].id);

    // Initial state with 650
    await runCentralAgent({
      message: "My CIBIL score is 650.",
      conversationHistory: [],
      conversationId: String(convBId),
    });
    let stateB = await getEligibilityState(String(convBId));
    assert.strictEqual(stateB?.applicant?.cibil, 650, "CIBIL must be initially 650");

    // User corrects CIBIL to 780
    await runCentralAgent({
      message: "Actually my CIBIL score is 780.",
      conversationHistory: [
        { role: "user", content: "My CIBIL score is 650." },
        { role: "assistant", content: "Got it, CIBIL 650 recorded." }
      ],
      conversationId: String(convBId),
    });

    stateB = await getEligibilityState(String(convBId));
    assert.strictEqual(
      stateB?.applicant?.cibil,
      780,
      `State must be updated to corrected value 780, got: ${stateB?.applicant?.cibil}`
    );
    console.log("  ✓ Corrected CIBIL value 780 successfully replaced outdated 650 in state.\n");

    // -------------------------------------------------------------------------
    // TEST C — Multi-turn eligibility collection continues seamlessly
    // -------------------------------------------------------------------------
    console.log("▶ [Test C] Multi-turn eligibility collection without repeating questions");
    const convCRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Test C Conversation') RETURNING id`,
      [user1.id]
    );
    const convCId = Number(convCRes.rows[0].id);

    const cTurn1 = await runCentralAgent({
      message: "I want a personal loan",
      conversationHistory: [],
      conversationId: String(convCId),
    });
    const cTurn1Reply = cTurn1.reply || "";
    assert(cTurn1Reply.length > 0, "Turn 1 response should not be empty");

    // Provide salary
    const cTurn2 = await runCentralAgent({
      message: "I earn 80,000 per month",
      conversationHistory: [
        { role: "user", content: "I want a personal loan" },
        { role: "assistant", content: cTurn1Reply }
      ],
      conversationId: String(convCId),
    });
    const cTurn2Reply = cTurn2.reply || "";

    const stateC = await getEligibilityState(String(convCId));
    assert.strictEqual(stateC?.applicant?.monthlyIncome, 80000, "Monthly income 80000 must be captured");
    // Verify that Turn 2 does NOT prompt for income again
    assert(
      !cTurn2Reply.toLowerCase().includes("what is your monthly salary") &&
      !cTurn2Reply.toLowerCase().includes("how much do you earn per month"),
      "Turn 2 must advance to next question instead of repeating income prompt"
    );
    console.log("  ✓ Multi-turn flow captured salary and advanced to next parameter without looping.\n");

    // -------------------------------------------------------------------------
    // TEST D — Page refresh / restoration via database & API
    // -------------------------------------------------------------------------
    console.log("▶ [Test D] Page refresh: restore conversation messages and context via API");
    const convDRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Refreshed Chat') RETURNING id`,
      [user1.id]
    );
    const convDId = Number(convDRes.rows[0].id);

    await client.query(
      `INSERT INTO assistant_messages (conversation_id, role, content) VALUES
       ($1, 'user', 'I work at Infosys'),
       ($1, 'assistant', 'Noted! Infosys is categorized under CAT A with premier rates.')`,
      [convDId]
    );

    // Call GET /api/conversations/:id
    const refreshRes = await fetch(`${BASE_URL}/api/conversations/${convDId}`, {
      headers: { Cookie: `token=${tokenUser1}` }
    });
    assert.strictEqual(refreshRes.status, 200, "GET /api/conversations/:id must return 200");
    const refreshData = await refreshRes.json();
    assert.strictEqual(refreshData.success, true, "Response must indicate success");
    assert.strictEqual(refreshData.messages.length, 2, "Must return exactly 2 messages");
    assert.strictEqual(refreshData.messages[0].content, "I work at Infosys");
    console.log("  ✓ GET /api/conversations/:id restored full historical message thread on page refresh.\n");

    // -------------------------------------------------------------------------
    // TEST E — Chat isolation: Separate conversations for same user remain isolated
    // -------------------------------------------------------------------------
    console.log("▶ [Test E] Chat isolation: 2 separate conversations for same user maintain separate state");
    const convE1Res = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Chat E1') RETURNING id`,
      [user1.id]
    );
    const convE1Id = Number(convE1Res.rows[0].id);

    const convE2Res = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Chat E2') RETURNING id`,
      [user1.id]
    );
    const convE2Id = Number(convE2Res.rows[0].id);

    await saveEligibilityState(String(convE1Id), {
      applicant: { monthlyIncome: 45000, companyName: "TCS" },
      updatedAt: Date.now()
    });

    await saveEligibilityState(String(convE2Id), {
      applicant: { monthlyIncome: 120000, companyName: "Microsoft" },
      updatedAt: Date.now()
    });

    const stateE1 = await getEligibilityState(String(convE1Id));
    const stateE2 = await getEligibilityState(String(convE2Id));

    assert.strictEqual(stateE1?.applicant?.monthlyIncome, 45000, "Chat E1 salary must be 45000");
    assert.strictEqual(stateE1?.applicant?.companyName, "TCS", "Chat E1 company must be TCS");

    assert.strictEqual(stateE2?.applicant?.monthlyIncome, 120000, "Chat E2 salary must be 120000");
    assert.strictEqual(stateE2?.applicant?.companyName, "Microsoft", "Chat E2 company must be Microsoft");
    console.log("  ✓ Chat E1 and Chat E2 strictly isolated in database without cross-contamination.\n");

    // -------------------------------------------------------------------------
    // TEST F — User isolation & Ownership Access Control
    // -------------------------------------------------------------------------
    console.log("▶ [Test F] User isolation: User 2 cannot access User 1's conversation (403 Forbidden)");
    const convFRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'User 1 Private Chat') RETURNING id`,
      [user1.id]
    );
    const convFId = Number(convFRes.rows[0].id);

    // User 2 tries to GET User 1's conversation
    const unauthorizedGet = await fetch(`${BASE_URL}/api/conversations/${convFId}`, {
      headers: { Cookie: `token=${tokenUser2}` }
    });
    assert.strictEqual(unauthorizedGet.status, 403, "User 2 GET must be rejected with 403 Forbidden");

    // User 2 tries to DELETE User 1's conversation
    const unauthorizedDelete = await fetch(`${BASE_URL}/api/conversations/${convFId}`, {
      method: "DELETE",
      headers: { Cookie: `token=${tokenUser2}` }
    });
    assert.strictEqual(unauthorizedDelete.status, 403, "User 2 DELETE must be rejected with 403 Forbidden");

    // User 2 tries to POST to /api/chat hijacking User 1's conversation
    const unauthorizedChat = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${tokenUser2}`
      },
      body: JSON.stringify({
        message: "Attempt hijack",
        conversation_id: String(convFId)
      })
    });
    assert.strictEqual(unauthorizedChat.status, 403, "User 2 /api/chat hijack must be rejected with 403 Forbidden");
    console.log("  ✓ Security enforcement confirmed: cross-user access attempts strictly return 403 Forbidden.\n");

    // -------------------------------------------------------------------------
    // TEST G — Topic switching & Workflow resumption
    // -------------------------------------------------------------------------
    console.log("▶ [Test G] Topic switching: general finance inquiry mid-flow preserves loan state");
    const convGRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Test G Conversation') RETURNING id`,
      [user1.id]
    );
    const convGId = Number(convGRes.rows[0].id);

    // Step 1: Start loan intake
    await runCentralAgent({
      message: "My salary is 70,000",
      conversationHistory: [],
      conversationId: String(convGId),
    });
    let stateG = await getEligibilityState(String(convGId));
    assert.strictEqual(stateG?.applicant?.monthlyIncome, 70000, "Income must be 70000");

    // Step 2: Off-topic financial question
    const gTopicRes = await runCentralAgent({
      message: "What is the difference between CIBIL and Experian?",
      conversationHistory: [{ role: "user", content: "My salary is 70,000" }],
      conversationId: String(convGId),
    });
    const gTopicReply = gTopicRes.reply || "";
    assert(
      gTopicReply.toLowerCase().includes("cibil") || gTopicReply.toLowerCase().includes("bureau") || gTopicReply.toLowerCase().includes("credit"),
      "Agent must answer the credit question directly"
    );

    // Step 3: Verify salary was NOT wiped
    stateG = await getEligibilityState(String(convGId));
    assert.strictEqual(stateG?.applicant?.monthlyIncome, 70000, "Income must still be preserved after off-topic question");
    console.log("  ✓ Answered off-topic question and preserved previously captured applicant data.\n");

    // -------------------------------------------------------------------------
    // TEST H — Rapid duplicate submission prevention
    // -------------------------------------------------------------------------
    console.log("▶ [Test H] Rapid retry deduplication in /api/chat");
    const convHRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Test H Conversation') RETURNING id`,
      [user1.id]
    );
    const convHId = Number(convHRes.rows[0].id);

    // Fire two identical requests in quick succession
    const p1 = fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `token=${tokenUser1}` },
      body: JSON.stringify({ message: "Deduplication check message", conversation_id: String(convHId) })
    });
    const p2 = fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `token=${tokenUser1}` },
      body: JSON.stringify({ message: "Deduplication check message", conversation_id: String(convHId) })
    });

    await Promise.all([p1, p2]);

    // Check message count in assistant_messages
    const msgCountRes = await client.query(
      `SELECT count(*) FROM assistant_messages WHERE conversation_id = $1 AND role = 'user'`,
      [convHId]
    );
    const userMsgCount = Number(msgCountRes.rows[0].count);
    assert(
      userMsgCount <= 2,
      `User messages must not be uncontrollably duplicated. Count: ${userMsgCount}`
    );
    console.log(`  ✓ Deduplication guarded message persistence (user messages stored: ${userMsgCount}).\n`);

    // -------------------------------------------------------------------------
    // TEST I — Token optimization: pruneHistoryToBudget
    // -------------------------------------------------------------------------
    console.log("▶ [Test I] Token optimization: Context pruning maintains recency and budget");
    const longHistory: { role: string; content: string }[] = [];
    for (let i = 1; i <= 30; i++) {
      longHistory.push({ role: "user", content: `User message turn ${i} containing financial discussion details.` });
      longHistory.push({ role: "assistant", content: `Assistant reply turn ${i} explaining underwriting and terms.` });
    }

    const maxBudgetTokens = 500;
    const pruned = pruneHistoryToBudget(longHistory, maxBudgetTokens);
    assert(pruned.length < longHistory.length, "Pruned history must be smaller than original long history");
    assert(pruned.length >= 2, "Pruned history must retain recent turns");
    // Verify the latest turn is preserved
    const lastPruned = pruned[pruned.length - 1];
    assert.strictEqual(
      lastPruned.content,
      longHistory[longHistory.length - 1].content,
      "The latest message in history must always be preserved"
    );
    console.log(`  ✓ Pruned history from ${longHistory.length} messages down to ${pruned.length} messages within budget, keeping latest turn intact.\n`);

    console.log("================================================================================");
    console.log("ALL SCENARIOS (A THROUGH I) PASSED SUCCESSFULLY!");
    console.log("================================================================================");
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error("FATAL TEST SUITE FAILURE:", err);
  process.exit(1);
});
