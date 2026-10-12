import fs from "fs";
import path from "path";
import pool from "../lib/db";
import { signToken } from "../lib/auth";

async function runTest() {
  console.log("================================================================================");
  console.log("  TESTING ACTIVE AI AGENT: INSTRUCTIONS, KNOWLEDGE BASE & ASSISTANT BEHAVIOR");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3001";
  const user1Token = signToken({ id: 2, email: "admin@gmail.com", name: "Rutuja Rite", role: "admin" });
  const user1Headers = {
    Cookie: `token=${user1Token}`,
    "Content-Type": "application/json",
  };

  // 1. Create a custom agent with distinct persona & instructions
  console.log("▶ [STEP 1] Creating Custom Agent with distinct persona and instructions...");
  const agentPayload = {
    name: "Nova Financial Underwriting Specialist",
    description: "Specialized underwriting agent with custom policy knowledge and rules",
    goal: "Provide premier loan advisory and enforce the Nova Enterprise 2026 lending policy.",
    responseStyle: "detailed",
    operationalMode: "rag_focused",
    instructions: {
      agentRole: "Chief Underwriting Specialist at Nova Capital",
      tone: "Authoritative, courteous, highly structured",
      businessDescription: "Enforce the Nova Enterprise 2026 lending guidelines.",
      additionalInstructions: "Always identify yourself as Nova Underwriting Specialist and mention that you evaluate loans under Nova Enterprise 2026 policy.",
    },
    generalInstructions: {
      role: "Chief Underwriting Specialist at Nova Capital",
      goal: "Enforce the Nova Enterprise 2026 lending guidelines with zero margin for error.",
      behaviour: [
        "Be authoritative and professional",
        "Ground answers strictly in Nova policy documents",
        "Cite verified numbers directly from uploaded knowledge"
      ],
      customRules: "Always mention Nova Enterprise 2026 policy standards when explaining terms.",
    },
    guardrailTemplates: ["No Hallucination", "Strict Knowledge Usage", "Privacy Protection"],
    manualGuardrails: "Never invent rates. State 'Not covered in policy' if not found in knowledge base.",
  };

  const createRes = await fetch(`${baseUrl}/api/agents`, {
    method: "POST",
    headers: user1Headers,
    body: JSON.stringify(agentPayload),
  });

  const createData = await createRes.json();
  const agentId = createData.agent.id;
  console.log(`✓ Agent Created: "${createData.agent.name}" (ID: ${agentId})`);

  try {
    // 2. Upload a custom knowledge base document with unique, non-standard rules
    console.log("\n▶ [STEP 2] Uploading custom Knowledge Base document (Nova_Enterprise_Policy_2026.csv)...");
    const customPolicyData = `Company,Lender,Min_Salary,Min_CIBIL,Max_Loan,Special_Rate,Processing_Fee,Zero_Prepayment_Lockin
Nova Tech,Nova Capital Bank,45000,740,5000000,8.75%,Zero Fee,6 Months
Acme Global,Nova Capital Bank,35000,710,3500000,9.25%,0.5%,12 Months
Zeta Corp,Nova Capital Bank,60000,760,7500000,8.25%,Zero Fee,Zero Lockin`;

    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    const bodyBuffer = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="Nova_Enterprise_Policy_2026.csv"\r\n` +
        `Content-Type: text/csv\r\n\r\n`
      ),
      Buffer.from(customPolicyData, "utf-8"),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadRes = await fetch(`${baseUrl}/api/agents/${agentId}/knowledge`, {
      method: "POST",
      headers: {
        Cookie: `token=${user1Token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    const uploadData = await uploadRes.json();
    const docId = uploadData.document?.id || uploadData.docId;
    console.log(`✓ Knowledge uploaded: "${uploadData.document?.name}" (Doc ID: ${docId}, Chunks: ${uploadData.document?.chunkCount})`);

    // 3. Test Agent Playground in Studio (/api/agents/:id/test)
    console.log("\n▶ [STEP 3] Testing Agent Studio Playground (/api/agents/:id/test)...");
    const testRes = await fetch(`${baseUrl}/api/agents/${agentId}/test`, {
      method: "POST",
      headers: user1Headers,
      body: JSON.stringify({
        message: "What is the special interest rate and processing fee for Zeta Corp?",
        history: [],
      }),
    });
    const testData = await testRes.json();
    console.log(`✓ Playground Response:\n"${testData.reply}"\n`);
    console.log(`  Source: ${testData.knowledgeSource}`);

    // 4. Activate the Agent for User 1
    console.log("\n▶ [STEP 4] Activating the Agent for User 1 (/api/agents/:id/activate)...");
    const activateRes = await fetch(`${baseUrl}/api/agents/${agentId}/activate`, {
      method: "POST",
      headers: user1Headers,
    });
    const activateData = await activateRes.json();
    console.log(`✓ Agent activated: ${activateData.message}`);

    // 5. Test Chat Assistant with Active Agent: Persona & Role Greeting
    console.log("\n▶ [STEP 5] Testing AI Assistant (/api/chat) Greeting with Active Agent...");
    const greetRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: user1Headers,
      body: JSON.stringify({
        message: "Hello, who are you and what do you do?",
      }),
    });
    const greetData = await greetRes.json();
    const greetReply = greetData.ai_message?.content || greetData.reply || "";
    console.log(`✓ AI Assistant Greeting Response:\n"${greetReply}"\n`);

    // 6. Test Chat Assistant with Active Agent: Query Knowledge Base
    console.log("\n▶ [STEP 6] Testing AI Assistant (/api/chat) Knowledge Base Retrieval...");
    const kbRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: user1Headers,
      body: JSON.stringify({
        message: "According to Nova Enterprise Policy 2026, what are the loan terms, interest rate, and prepayment lock-in for Zeta Corp?",
      }),
    });
    const kbData = await kbRes.json();
    const kbReply = kbData.ai_message?.content || kbData.reply || "";
    console.log(`✓ AI Assistant Knowledge Response:\n"${kbReply}"\n`);

    // 7. Test Updating Agent Instructions and verifying changes in AI Assistant
    console.log("\n▶ [STEP 7] Updating Agent Instructions (adding custom keyword 'NOVA-VERIFIED-V2')...");
    const patchRes = await fetch(`${baseUrl}/api/agents/${agentId}`, {
      method: "PATCH",
      headers: user1Headers,
      body: JSON.stringify({
        instructions: {
          ...agentPayload.instructions,
          additionalInstructions: "Every single response must explicitly include the verification seal code: [NOVA-VERIFIED-V2].",
        },
        generalInstructions: {
          ...agentPayload.generalInstructions,
          customRules: "Every single response must explicitly include the verification seal code: [NOVA-VERIFIED-V2].",
        },
      }),
    });
    console.log(`✓ Agent updated: Status ${patchRes.status}`);

    const verifyUpdateRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: user1Headers,
      body: JSON.stringify({
        message: "What is your underwriting policy for Nova Tech employees?",
      }),
    });
    const verifyUpdateData = await verifyUpdateRes.json();
    const verifyReply = verifyUpdateData.ai_message?.content || verifyUpdateData.reply || "";
    console.log(`✓ AI Assistant Updated Instructions Response:\n"${verifyReply}"\n`);

    // 8. Deactivate Agent & Verify Clean Default AI Assistant
    console.log("\n▶ [STEP 8] Deactivating Agent & Verifying Default Assistant...");
    await fetch(`${baseUrl}/api/agents/${agentId}/deactivate`, {
      method: "POST",
      headers: user1Headers,
    });
    const deactCheckRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: user1Headers,
      body: JSON.stringify({
        message: "Hello!",
      }),
    });
    const deactCheckData = await deactCheckRes.json();
    const deactReply = deactCheckData.ai_message?.content || deactCheckData.reply || "";
    console.log(`✓ Deactivated Default Assistant Response:\n"${deactReply}"\n`);

  } finally {
    // Cleanup agent
    console.log("▶ [CLEANUP] Deleting test agent...");
    await fetch(`${baseUrl}/api/agents/${agentId}`, {
      method: "DELETE",
      headers: user1Headers,
    });
    console.log("✓ Cleanup finished.");
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
