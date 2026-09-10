import dotenv from "dotenv";
dotenv.config();

import { SignJWT } from "jose";

async function getAuthToken() {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || "creditwise-ai-jwt-secret-change-in-productionss"
  );
  return await new SignJWT({ id: 2, email: "admin@creditwise.ai", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);
}

async function testChatEndpoint() {
  const token = await getAuthToken();
  let convId: string | undefined = undefined;

  const tests = [
    { msg: "Hello!", label: "1. Greeting" },
    { msg: "I want to apply for a personal loan", label: "2. Personal Loan Intent" },
    { msg: "What is the EMI for 10 lakhs for 5 years at 11%?", label: "3. Mid-flow EMI Calculation" },
    { msg: "What does FOIR mean?", label: "4. Mid-flow Concept Question" },
    { msg: "Tata Consultancy Services", label: "5. Resuming with Company Name" },
    { msg: "Actually change my monthly salary to 200000", label: "6. Changing Details" },
  ];

  for (const t of tests) {
    console.log(`Sending: "${t.msg}" (Conv ID: ${convId || "NEW"})`);
    const res = await fetch("http://localhost:3001/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({ message: t.msg, conversation_id: convId }),
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
      if (data.conversation_id) {
        convId = data.conversation_id;
      }
    } catch {
      console.log(`[HTTP TEST] ${t.label} -> Status ${res.status}, Body: ${text.slice(0, 100)}`);
      continue;
    }
    console.log(`[HTTP TEST] ${t.label}`);
    console.log(`   Status: ${res.status} | Conv ID: ${convId}`);
    console.log(`   Reply:\n${data.ai_message?.content}\n`);
    console.log("------------------------------------------------------------\n");
  }
}

testChatEndpoint().catch(console.error);
