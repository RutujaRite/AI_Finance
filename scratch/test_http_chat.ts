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
  const tests = [
    { msg: "Hi", label: "Greeting: 'Hi'" },
    { msg: "Hello", label: "Greeting: 'Hello'" },
    { msg: "How are you?", label: "Casual: 'How are you?'" },
    { msg: "What can you do?", label: "Casual: 'What can you do?'" },
    { msg: "I want a personal loan", label: "Loan Intent: 'I want a personal loan'" }
  ];

  for (const t of tests) {
    const res = await fetch("http://localhost:3001/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({ message: t.msg })
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      console.log(`[HTTP TEST] ${t.label} -> Status ${res.status}, Body: ${text.slice(0, 100)}`);
      continue;
    }
    console.log(`[HTTP TEST] ${t.label}`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Has company_data: ${!!data.ai_message?.company_data}`);
    console.log(`   Has bank_data: ${!!data.ai_message?.bank_data}`);
    console.log(`   Reply preview: ${data.ai_message?.content?.split("\n")[0]}`);
    console.log("");
  }
}

testChatEndpoint().catch(console.error);
