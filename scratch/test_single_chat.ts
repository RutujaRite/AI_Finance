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

async function testSingle(msg: string, convId: string) {
  const token = await getAuthToken();
  const start = Date.now();
  console.log(`\nSending: "${msg}" to /api/chat (Conv: ${convId})`);
  const res = await fetch("http://localhost:3001/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${token}`,
    },
    body: JSON.stringify({ message: msg, conversation_id: convId }),
  });
  const duration = Date.now() - start;
  console.log(`Status: ${res.status} in ${duration}ms`);
  const data = await res.json();
  console.log("Reply:\n", data.ai_message?.content);
  return data;
}

async function main() {
  const convId = "7701";
  await testSingle("I want a personal loan", convId);
  await testSingle("What is the EMI for 10 lakhs for 5 years at 11%?", convId);
  await testSingle("Tata Consultancy Services", convId);
}

main().catch(console.error);
