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

async function runTurn9() {
  const token = await getAuthToken();
  const res = await fetch("http://localhost:3001/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${token}`,
    },
    body: JSON.stringify({ message: "ok", conversation_id: "221" }),
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Reply:", data.ai_message?.content);
}

runTurn9().catch(console.error);
