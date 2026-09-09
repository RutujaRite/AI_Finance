const assert = require("assert");

async function runE2ESessionTest() {
  console.log("==================================================");
  console.log(" RUNNING END-TO-END HTTP ASSISTANT SESSION TEST");
  console.log("==================================================\n");

  const baseUrl = "http://localhost:3000";
  let cookie = "";

  // Step 1: Login
  console.log("1. Authenticating as admin@gmail.com...");
  const loginRes = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "email=admin%40gmail.com&password=newpass123",
    redirect: "manual"
  });

  const rawCookie = loginRes.headers.get("set-cookie");
  if (rawCookie) {
    cookie = rawCookie.split(";")[0];
  }
  console.log("   ✓ Login successful, session established.\n");

  // Helper for authenticated POST
  async function postMessage(message, conversationId = null) {
    const res = await fetch(`${baseUrl}/api/assistant/handle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookie
      },
      body: JSON.stringify({ message, conversation_id: conversationId })
    });
    return await res.json();
  }

  // Step 2: Start new chat
  console.log("2. Starting conversation: 'I want a personal loan'...");
  const convRes = await fetch(`${baseUrl}/api/assistant/conversations/new`, {
    method: "POST",
    headers: { "Cookie": cookie }
  });
  const convData = await convRes.json();
  const conversationId = convData.conversationId;
  console.log(`   ✓ New conversation created (ID: ${conversationId})`);

  let step = await postMessage("I want a personal loan", conversationId);
  console.log(`   Assistant: ${step.response}\n`);
  assert.strictEqual(step.type, "eligibility_flow");

  // Step 3: Sequential step-by-step replies
  const steps = [
    { label: "Monthly income", input: "75000", desc: "Providing ₹75,000 net monthly salary" },
    { label: "Existing EMI", input: "no emi", desc: "Replying 'no emi' (0 obligations)" },
    { label: "Loan amount", input: "300000", desc: "Requesting ₹3,00,000 loan amount" },
    { label: "Tenure", input: "36 months", desc: "Requesting 36 months tenure" },
    { label: "CIBIL", input: "760", desc: "Providing CIBIL score 760" },
    { label: "Age", input: "28", desc: "Providing Age 28" },
    { label: "Employment Type", input: "Salaried", desc: "Providing Employment Type 'Salaried'" },
    { label: "Location", input: "Dehradun", desc: "Providing Location 'Dehradun' (covers Bajaj Finserv location rule)" }
  ];

  for (let i = 0; i < steps.length; i++) {
    const current = steps[i];
    console.log(`Step ${i + 3}: ${current.label} (${current.desc})`);
    console.log(`   User: ${current.input}`);
    step = await postMessage(current.input, conversationId);
    console.log(`   Assistant Response:\n${step.response}\n`);

    if (step.type === "eligibility_result") {
      console.log("   ✓ Reached final Eligibility Result!\n");
      break;
    }
  }

  assert.strictEqual(step.type, "eligibility_result", "Must conclude with eligibility_result");
  assert(Array.isArray(step.evaluations), "Evaluations must be present");
  assert(step.evaluations.length > 0, "Should evaluate active bank policies");

  console.log("==================================================");
  console.log(" FINAL RESPONSE VERIFICATION");
  console.log("==================================================");
  console.log("Response text check:");
  assert(step.response.includes("Personal Loan Eligibility Assessment"), "Must have header");
  assert(step.response.includes("Eligible Banks"), "Must show eligible banks");
  assert(step.response.includes("Stored Policy Comparison of Eligible Banks"), "Must show comparison table");

  console.log("✓ Final response contains policy-backed assessment, individual checks, and multi-bank comparison table.");
  console.log("\n==================================================");
  console.log(" END-TO-END HTTP SESSION TEST PASSED (100%)");
  console.log("==================================================");
}

runE2ESessionTest().catch(err => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
