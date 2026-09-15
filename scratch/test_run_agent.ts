import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function testTurns() {
  const convId = "99999";
  // Clean up
  await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [99999]);
  await pool.query(`DELETE FROM assistant_messages WHERE conversation_id = $1`, [99999]);
  await pool.query(`INSERT INTO assistant_conversations (id, user_id, title) VALUES (99999, 2, 'Test') ON CONFLICT (id) DO NOTHING`);

  const turns = [
    "I need a personal loan",
    "Tata Consultancy Services",
    "100000",
    "500000",
    "3 years",
    "750",
    "28",
    "0",
  ];

  const history: Array<{ role: string; content: string }> = [];

  for (let i = 0; i < turns.length; i++) {
    const msg = turns[i];
    console.log(`\n========================================`);
    console.log(`Turn ${i + 1}: User says "${msg}"`);
    
    const beforeState = await getEligibilityState(convId);
    console.log("State BEFORE:", JSON.stringify(beforeState?.applicant || {}));

    const res = await runCentralAgent({
      message: msg,
      conversationId: convId,
      conversationHistory: [...history],
    });

    console.log("Agent reply snippet:", res.reply.slice(0, 150) + "...");
    
    const afterState = await getEligibilityState(convId);
    console.log("State AFTER:", JSON.stringify(afterState?.applicant || {}));
    console.log("Missing fields AFTER:", afterState?.missingFields);

    history.push({ role: "user", content: msg });
    history.push({ role: "assistant", content: res.reply });
  }

  process.exit(0);
}

testTurns().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
