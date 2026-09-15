import dotenv from "dotenv";
dotenv.config();

import { SignJWT } from "jose";
import pool from "../lib/db";

async function getAuthToken() {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || "creditwise-ai-jwt-secret-change-in-productionss"
  );
  return await new SignJWT({ id: 2, email: "admin@creditwise.ai", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);
}

async function traceFlow() {
  console.log("===============================================================================");
  console.log("🔍 TRACING CONVERSATION TO FINAL REQUIRED FIELD (existing EMI = 0)");
  console.log("===============================================================================\n");

  const token = await getAuthToken();
  let convId: string | undefined = undefined;

  const turns = [
    { msg: "I need a personal loan", label: "Turn 1: Initial Intent" },
    { msg: "Tata Consultancy Services", label: "Turn 2: Company Name" },
    { msg: "100000", label: "Turn 3: Salary" },
    { msg: "500000", label: "Turn 4: Loan Amount" },
    { msg: "3 years", label: "Turn 5: Tenure" },
    { msg: "750", label: "Turn 6: CIBIL Score" },
    { msg: "28", label: "Turn 7: Age" },
    { msg: "0", label: "Turn 8: existing EMI = 0 (FINAL REQUIRED FIELD)" },
  ];

  for (const t of turns) {
    console.log(`\n============================================================`);
    console.log(`👉 ${t.label}`);
    console.log(`   User Message: "${t.msg}"`);
    console.log(`   Target Conversation ID: ${convId || "NEW"}`);

    const res = await fetch("http://localhost:3001/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({ message: t.msg, conversation_id: convId }),
    });

    console.log(`   HTTP Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
      if (data.conversation_id) convId = data.conversation_id;
    } catch {
      console.log(`   Raw Response Body (non-JSON): ${text}`);
      continue;
    }

    console.log(`   Success: ${data.success}`);
    console.log(`   Returned Conversation ID: ${data.conversation_id}`);
    console.log(`   AI Message Content:\n${data.ai_message?.content}\n`);

    if (convId) {
      try {
        const stateRes = await pool.query(
          `SELECT state FROM assistant_conversation_states WHERE conversation_id = $1`,
          [Number(convId)]
        );
        if ((stateRes.rowCount ?? 0) > 0) {
          console.log("   DB State Snapshot:", JSON.stringify(stateRes.rows[0].state, null, 2));
        } else {
          console.log("   DB State Snapshot: (No row in assistant_conversation_states)");
        }
      } catch (dbErr: any) {
        console.log("   DB State read error:", dbErr.message);
      }
    }
  }

  process.exit(0);
}

traceFlow().catch((err) => {
  console.error("FATAL ERROR in traceFlow:", err);
  process.exit(1);
});
