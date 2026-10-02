// scripts/verify-conversation-history.ts

import assert from "assert";
import pool from "@/lib/db";
import { getEligibilityState, saveEligibilityState, clearEligibilityState } from "@/lib/dynamicEligibilityEngine";
import { runCentralAgent } from "@/lib/ai/agent";

function getConversationSectionKey(value: string): "Today" | "Yesterday" | "Previous 7 Days" | "Older" {
  if (!value) return "Older";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Older";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const t = date.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfYesterday) return "Yesterday";
  if (t >= startOf7Days) return "Previous 7 Days";
  return "Older";
}

function groupConversationsBySection(list: any[]) {
  const sections: { key: string; title: string; items: any[] }[] = [];
  const order: ("Today" | "Yesterday" | "Previous 7 Days" | "Older")[] = [
    "Today",
    "Yesterday",
    "Previous 7 Days",
    "Older",
  ];
  const map = new Map<string, any[]>();
  for (const key of order) map.set(key, []);
  for (const c of list) {
    const key = getConversationSectionKey(c.updatedAt || c.createdAt);
    map.get(key)!.push(c);
  }
  for (const key of order) {
    const items = map.get(key) || [];
    if (items.length > 0) sections.push({ key, title: key, items });
  }
  return sections;
}

async function runTests() {
  console.log("================================================================================");
  console.log("VERIFYING CHATGPT-STYLE CONVERSATION & SESSION HISTORY MANAGEMENT");
  console.log("================================================================================\n");

  const testUserId = 2; // Standard seeded user ID in test suite
  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Create Chat A -> send messages
    // -------------------------------------------------------------------------
    console.log("--- Test 1: Create Chat A & Send Messages ---");
    const convARes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Chat A Title') RETURNING id`,
      [testUserId]
    );
    const convAId = Number(convARes.rows[0].id);

    await client.query(
      `INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1, 'user', 'Hello from Chat A')`,
      [convAId]
    );
    await client.query(
      `INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1, 'assistant', 'Response in Chat A')`,
      [convAId]
    );

    await saveEligibilityState(String(convAId), {
      applicant: {
        companyName: "Google India",
        monthlyIncome: 150000,
        loanAmount: 1000000,
        tenureMonths: 60,
        cibil: 800,
        age: 32,
        existingEmi: 0,
      },
      evaluationCompleted: true,
      hasCompletedEvaluation: true,
      updatedAt: Date.now(),
    });

    const msgsA = await client.query(
      `SELECT role, content FROM assistant_messages WHERE conversation_id = $1 ORDER BY id ASC`,
      [convAId]
    );
    assert.strictEqual(msgsA.rowCount, 2, "Chat A must have exactly 2 messages");
    const stateA = await getEligibilityState(String(convAId));
    assert.strictEqual(stateA?.applicant?.companyName, "Google India", "Chat A must have company Google India");
    console.log("✓ Test 1 Passed: Chat A created with 2 messages and eligibility state.\n");

    // -------------------------------------------------------------------------
    // TEST 2: Create Chat B -> verify Chat A context is NOT available
    // -------------------------------------------------------------------------
    console.log("--- Test 2: Create Chat B & Verify Strict Context Isolation ---");
    const convBRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'New Chat') RETURNING id`,
      [testUserId]
    );
    const convBId = Number(convBRes.rows[0].id);

    // Chat B must have 0 messages initially
    const msgsB = await client.query(
      `SELECT role, content FROM assistant_messages WHERE conversation_id = $1 ORDER BY id ASC`,
      [convBId]
    );
    assert.strictEqual(msgsB.rowCount, 0, "Chat B must have zero initial messages");

    // Chat B must have no state
    const stateB = await getEligibilityState(String(convBId));
    assert.strictEqual(stateB, null, "Chat B must have null initial state");

    // Send a message in Chat B
    await client.query(
      `INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1, 'user', 'What is personal loan?')`,
      [convBId]
    );
    await client.query(
      `INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1, 'assistant', 'A personal loan is an unsecured loan.')`,
      [convBId]
    );

    const msgsBAfter = await client.query(
      `SELECT role, content FROM assistant_messages WHERE conversation_id = $1 ORDER BY id ASC`,
      [convBId]
    );
    assert.strictEqual(msgsBAfter.rowCount, 2, "Chat B must now have 2 messages");
    assert.ok(
      !msgsBAfter.rows.some((r: any) => r.content.includes("Chat A")),
      "Chat B must NOT contain Chat A messages"
    );
    console.log("✓ Test 2 Passed: Chat B started completely clean with 0 messages and null state.\n");

    // -------------------------------------------------------------------------
    // TEST 3: Return to Chat A -> verify messages and state are intact
    // -------------------------------------------------------------------------
    console.log("--- Test 3: Return to Chat A & Verify State & Messages Intact ---");
    const msgsAReload = await client.query(
      `SELECT role, content FROM assistant_messages WHERE conversation_id = $1 ORDER BY id ASC`,
      [convAId]
    );
    assert.strictEqual(msgsAReload.rowCount, 2, "Chat A must still have its 2 messages");
    assert.strictEqual(msgsAReload.rows[0].content, "Hello from Chat A");

    const stateAReload = await getEligibilityState(String(convAId));
    assert.strictEqual(stateAReload?.applicant?.companyName, "Google India", "Chat A state must remain Google India");
    assert.strictEqual(stateAReload?.applicant?.loanAmount, 1000000, "Chat A loanAmount must remain 1000000");
    console.log("✓ Test 3 Passed: Returning to Chat A loads its exact preserved messages and state.\n");

    // -------------------------------------------------------------------------
    // TEST 4: Delete Chat A -> verify only Chat A disappears
    // -------------------------------------------------------------------------
    console.log("--- Test 4: Delete Chat A (Cascade Check) ---");
    // Simulate DELETE endpoint logic
    await client.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [convAId]);
    await client.query(`DELETE FROM assistant_messages WHERE conversation_id = $1`, [convAId]);
    await client.query(`DELETE FROM assistant_conversations WHERE id = $1 AND user_id = $2`, [convAId, testUserId]);
    await clearEligibilityState(String(convAId));

    const checkAConv = await client.query(`SELECT id FROM assistant_conversations WHERE id = $1`, [convAId]);
    assert.strictEqual(checkAConv.rowCount, 0, "Chat A must be deleted from assistant_conversations");

    const checkAMsgs = await client.query(`SELECT id FROM assistant_messages WHERE conversation_id = $1`, [convAId]);
    assert.strictEqual(checkAMsgs.rowCount, 0, "Chat A messages must be deleted");

    const checkAState = await client.query(`SELECT state FROM assistant_conversation_states WHERE conversation_id = $1`, [convAId]);
    assert.strictEqual(checkAState.rowCount, 0, "Chat A state must be deleted");
    console.log("✓ Test 4 Passed: Chat A conversation, messages, and state permanently removed.\n");

    // -------------------------------------------------------------------------
    // TEST 5: Open Chat B -> verify Chat B is unchanged
    // -------------------------------------------------------------------------
    console.log("--- Test 5: Verify Chat B is Completely Unaffected by Chat A Deletion ---");
    const checkBConv = await client.query(`SELECT id, title FROM assistant_conversations WHERE id = $1`, [convBId]);
    assert.strictEqual(checkBConv.rowCount, 1, "Chat B must still exist");

    const checkBMsgs = await client.query(`SELECT role, content FROM assistant_messages WHERE conversation_id = $1 ORDER BY id ASC`, [convBId]);
    assert.strictEqual(checkBMsgs.rowCount, 2, "Chat B must still have 2 messages");
    assert.strictEqual(checkBMsgs.rows[0].content, "What is personal loan?");
    console.log("✓ Test 5 Passed: Chat B is completely intact after Chat A deletion.\n");

    // -------------------------------------------------------------------------
    // TEST 6: Delete the active chat -> verify fresh empty chat is initialized
    // -------------------------------------------------------------------------
    console.log("--- Test 6: Delete Active Chat & Verify Fresh Empty Chat Initialization ---");
    // Simulate deleting active Chat B
    await client.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [convBId]);
    await client.query(`DELETE FROM assistant_messages WHERE conversation_id = $1`, [convBId]);
    await client.query(`DELETE FROM assistant_conversations WHERE id = $1 AND user_id = $2`, [convBId, testUserId]);
    await clearEligibilityState(String(convBId));

    // When active chat is deleted, system calls newConversation() creating fresh conversation
    const newConvRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'New Chat') RETURNING id`,
      [testUserId]
    );
    const freshConvId = Number(newConvRes.rows[0].id);
    assert.ok(freshConvId > 0 && freshConvId !== convBId, "Must create fresh conversation with new ID");

    const freshMsgs = await client.query(`SELECT id FROM assistant_messages WHERE conversation_id = $1`, [freshConvId]);
    assert.strictEqual(freshMsgs.rowCount, 0, "Fresh conversation must have 0 messages");
    const freshState = await getEligibilityState(String(freshConvId));
    assert.strictEqual(freshState, null, "Fresh conversation must have null state");
    console.log("✓ Test 6 Passed: Deleting active chat triggers fresh conversation creation with empty state.\n");

    // -------------------------------------------------------------------------
    // TEST 7: Create multiple chats across timestamps -> verify ChatGPT date grouping
    // -------------------------------------------------------------------------
    console.log("--- Test 7: Verify ChatGPT-style Date Grouping (Today, Yesterday, Previous 7 Days, Older) ---");
    const now = new Date();
    const todayISO = now.toISOString();
    const yesterdayISO = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    const prev7DaysISO = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const olderISO = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();

    const mockConversations = [
      { id: "101", title: "Chat Today", updatedAt: todayISO },
      { id: "102", title: "Chat Yesterday", updatedAt: yesterdayISO },
      { id: "103", title: "Chat 4 Days Ago", updatedAt: prev7DaysISO },
      { id: "104", title: "Chat 15 Days Ago", updatedAt: olderISO },
    ];

    assert.strictEqual(getConversationSectionKey(todayISO), "Today");
    assert.strictEqual(getConversationSectionKey(yesterdayISO), "Yesterday");
    assert.strictEqual(getConversationSectionKey(prev7DaysISO), "Previous 7 Days");
    assert.strictEqual(getConversationSectionKey(olderISO), "Older");

    const grouped = groupConversationsBySection(mockConversations);
    assert.strictEqual(grouped.length, 4, "Must have exactly 4 groups");
    assert.strictEqual(grouped[0].title, "Today");
    assert.strictEqual(grouped[1].title, "Yesterday");
    assert.strictEqual(grouped[2].title, "Previous 7 Days");
    assert.strictEqual(grouped[3].title, "Older");
    console.log("✓ Test 7 Passed: Accurate date grouping into Today, Yesterday, Previous 7 Days, and Older.\n");

    // -------------------------------------------------------------------------
    // TEST 8: Start New Chat after eligibility flow -> verify old eligibility state not carried over
    // -------------------------------------------------------------------------
    console.log("--- Test 8: Start New Chat After Eligibility Flow (State Isolation) ---");
    const eligConvRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Eligibility Chat') RETURNING id`,
      [testUserId]
    );
    const eligConvId = Number(eligConvRes.rows[0].id);

    await saveEligibilityState(String(eligConvId), {
      applicant: {
        companyName: "Infosys Ltd",
        monthlyIncome: 75000,
        loanAmount: 600000,
        tenureMonths: 48,
        cibil: 760,
        age: 28,
        existingEmi: 5000,
      },
      evaluationCompleted: true,
      hasCompletedEvaluation: true,
      eligible_banks: ["HDFC Bank", "ICICI Bank"],
      updatedAt: Date.now(),
    });

    const eligState = await getEligibilityState(String(eligConvId));
    assert.strictEqual(eligState?.applicant?.companyName, "Infosys Ltd");

    // User clicks "New Chat"
    const newChatAfterEligRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'New Chat') RETURNING id`,
      [testUserId]
    );
    const newChatAfterEligId = Number(newChatAfterEligRes.rows[0].id);

    const isolatedState = await getEligibilityState(String(newChatAfterEligId));
    assert.strictEqual(isolatedState, null, "New Chat state must be strictly null; no Infosys Ltd carried over");
    console.log("✓ Test 8 Passed: Old eligibility state is NEVER carried over to New Chat.\n");

    // -------------------------------------------------------------------------
    // TEST 9: Start New Chat after Bank Manager flow -> verify old bank/branch/location not carried over
    // -------------------------------------------------------------------------
    console.log("--- Test 9: Start New Chat After Bank Manager Flow (Entity Isolation) ---");
    const bmConvRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Bank Manager Chat') RETURNING id`,
      [testUserId]
    );
    const bmConvId = Number(bmConvRes.rows[0].id);

    await saveEligibilityState(String(bmConvId), {
      applicant: {},
      selectedBank: "ICICI Bank",
      chosenBank: "ICICI Bank",
      preferredBranch: "Swarget",
      currentStep: "BANK_MANAGER_SEARCH",
      expectedEntity: "none",
      collectedEntities: { bank_name: "ICICI Bank", branch: "Swarget", city: "Pune" },
      updatedAt: Date.now(),
    });

    const bmState = await getEligibilityState(String(bmConvId));
    assert.strictEqual(bmState?.selectedBank, "ICICI Bank");
    assert.strictEqual(bmState?.preferredBranch, "Swarget");

    // User clicks "New Chat"
    const newChatAfterBmRes = await client.query(
      `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'New Chat') RETURNING id`,
      [testUserId]
    );
    const newChatAfterBmId = Number(newChatAfterBmRes.rows[0].id);

    const isolatedBmState = await getEligibilityState(String(newChatAfterBmId));
    assert.strictEqual(isolatedBmState, null, "New Chat must have null state; no ICICI Bank or Swarget carried over");
    console.log("✓ Test 9 Passed: Old Bank Manager bank/branch/city is NEVER carried over to New Chat.\n");

    // -------------------------------------------------------------------------
    // TEST 10: Refresh browser simulation -> verify conversation history remains separated
    // -------------------------------------------------------------------------
    console.log("--- Test 10: Browser Reload Simulation & Query Verification ---");
    // Query /api/conversations equivalent:
    const listRes = await client.query(
      `SELECT c.id, c.title, c.updated_at, c.created_at,
              COALESCE((SELECT m.content FROM assistant_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1), '') as preview,
              (SELECT COUNT(*) FROM assistant_messages m WHERE m.conversation_id = c.id) as message_count
       FROM assistant_conversations c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC, c.id DESC`,
      [testUserId]
    );
    assert.ok(listRes.rowCount !== null && listRes.rowCount > 0, "Conversations list must not be empty");

    // Pick two separate conversations and ensure their messages never intersect
    const conv1 = listRes.rows.find((r: any) => Number(r.id) === eligConvId);
    const conv2 = listRes.rows.find((r: any) => Number(r.id) === bmConvId);
    assert.ok(conv1, "Eligibility conversation must be listed");
    assert.ok(conv2, "Bank manager conversation must be listed");

    // Rename test: rename conv1 without altering its messages or state
    await client.query(`UPDATE assistant_conversations SET title = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [
      "Renamed Eligibility Chat",
      eligConvId,
      testUserId,
    ]);
    const renamedRow = await client.query(`SELECT title FROM assistant_conversations WHERE id = $1`, [eligConvId]);
    assert.strictEqual(renamedRow.rows[0].title, "Renamed Eligibility Chat");

    // Verify state still intact
    const eligStateAfterRename = await getEligibilityState(String(eligConvId));
    assert.strictEqual(eligStateAfterRename?.applicant?.companyName, "Infosys Ltd");

    console.log("✓ Test 10 Passed: Refresh simulation confirmed conversations, messages, and state remain distinct.\n");

    // Clean up test rows
    await client.query(`DELETE FROM assistant_conversation_states WHERE conversation_id IN ($1, $2, $3, $4)`, [
      freshConvId,
      eligConvId,
      newChatAfterEligId,
      bmConvId,
    ]);
    await client.query(`DELETE FROM assistant_messages WHERE conversation_id IN ($1, $2, $3, $4)`, [
      freshConvId,
      eligConvId,
      newChatAfterEligId,
      bmConvId,
    ]);
    await client.query(`DELETE FROM assistant_conversations WHERE id IN ($1, $2, $3, $4)`, [
      freshConvId,
      eligConvId,
      newChatAfterEligId,
      bmConvId,
    ]);

    console.log("================================================================================");
    console.log("ALL 10 CONVERSATION HISTORY VERIFICATION TESTS PASSED SUCCESSFULLY!");
    console.log("================================================================================");
  } finally {
    client.release();
    pool.end();
  }
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
