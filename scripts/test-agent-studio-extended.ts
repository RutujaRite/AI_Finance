// scripts/test-agent-studio-extended.ts
import pool from "../lib/db";
import { initAgentStudioDb } from "../lib/agent-studio/dbSchema";
import {
  listAgentDocuments,
  saveDocumentConfiguration,
  listAgentConversations,
  getConversationDetails,
  recordConversationExchange,
  syncAgentToDb,
} from "../lib/agent-studio/dbStore";
import { selectRelevantDocuments, validateAgentResponse } from "../lib/agent-studio/ragEngine";
import { getAgent } from "../lib/agent-studio/agentStore";

async function runTest() {
  console.log("=== STARTING EXTENDED AGENT STUDIO VERIFICATION ===");

  // 1. Initialize & verify DB tables
  await initAgentStudioDb();
  console.log("✓ Database tables verified and initialized.");

  // 2. Verify Agent Sync to DB
  const agent = getAgent("agent_loan_assistant");
  if (!agent) throw new Error("Default agent not found");
  await syncAgentToDb(agent);
  console.log(`✓ Agent synced to DB: ${agent.name} (${agent.id})`);

  // 3. Test Knowledge Document Creation & Configuration
  const testDocId = `test_kdoc_${Date.now()}`;
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO knowledge_documents (
        id, agent_id, name, file_type, file_size, status, chunk_count, vector_status, is_active, uploaded_at, updated_at
      ) VALUES ($1, $2, $3, 'pdf', '1.5 MB', 'COMPLETED', 12, 'Indexed', true, NOW(), NOW())`,
      [testDocId, agent.id, "Personal_Loan_Policy.pdf"]
    );
  } finally {
    client.release();
  }

  // Save document instructions & guardrails
  const configSaved = await saveDocumentConfiguration(testDocId, agent.id, {
    instructionText: "Use this document when the user asks about personal loan eligibility or documentation.",
    whenToUse: "personal loan, salaried, cibil",
    whenNotToUse: "education loan, vehicle loan",
    guardrailText: "Only use this document for personal-loan-related questions. Do not invent policy details.",
    isActive: true,
  });
  console.log(`✓ Document configuration saved: ${configSaved}`);

  // Fetch documents list
  const docs = await listAgentDocuments(agent.id);
  const found = docs.find((d) => d.id === testDocId);
  if (!found) throw new Error("Failed to find created test document");
  console.log(`✓ Retrieved document: ${found.name}, Chunks: ${found.chunkCount}, Vector Status: ${found.vectorStatus}`);
  console.log(`✓ Document Instruction: "${found.instruction?.instructionText}"`);
  console.log(`✓ Document Guardrail: "${found.guardrail?.guardrailText}"`);

  // 4. Test Dynamic Knowledge Selection (Section 10)
  const personalQuery = "What is the CIBIL cutoff for personal loan?";
  const matchedDocs = selectRelevantDocuments(personalQuery, docs);
  console.log(
    `✓ Knowledge selection for "${personalQuery}": Selected ${matchedDocs.map((d) => d.name).join(", ")}`
  );
  if (!matchedDocs.some((d) => d.id === testDocId)) {
    throw new Error("Expected Personal_Loan_Policy.pdf to be selected for personal loan query");
  }

  // 5. Test Conversation & Knowledge Usage Recording (Section 12 & 13)
  const testConvId = `conv_test_${Date.now()}`;
  await recordConversationExchange({
    conversationId: testConvId,
    agentId: agent.id,
    userMessage: "I want a personal loan.",
    assistantResponse: "Sure! Which company do you work for and what is your monthly salary?",
    intent: "loan_inquiry",
    toolsUsed: ["Eligibility Calculator"],
    knowledgeDocumentsUsed: [{ id: testDocId, name: found.name, chunkIds: [`${testDocId}_c0`] }],
  });

  await recordConversationExchange({
    conversationId: testConvId,
    agentId: agent.id,
    userMessage: "Infosys, salary 50000.",
    assistantResponse: "Great. For Infosys (Cat A), standard interest rates start at 10.5% with 750+ CIBIL.",
    intent: "loan_qualification",
    toolsUsed: ["Eligibility Calculator", "Knowledge Base RAG"],
    knowledgeDocumentsUsed: [{ id: testDocId, name: found.name, chunkIds: [`${testDocId}_c1`] }],
  });

  // Verify conversation retrieval
  const convList = await listAgentConversations(agent.id);
  const convRecord = convList.find((c) => c.id === testConvId);
  if (!convRecord) throw new Error("Conversation was not found in conversation list");
  console.log(`✓ Stored conversation listed: ID=${convRecord.id}, Message Count=${convRecord.messageCount}`);

  const details = await getConversationDetails(testConvId);
  if (!details || !details.messages || details.messages.length < 2) {
    throw new Error("Conversation details missing messages");
  }
  console.log(`✓ Retrieved transcript with ${details.messages.length} messages.`);
  console.log(`✓ Knowledge usage records: ${details.knowledgeUsage?.length || 0}`);
  if (!details.knowledgeUsage || details.knowledgeUsage.length === 0) {
    throw new Error("Knowledge usage record missing in conversation details");
  }
  console.log(`✓ Used Knowledge Document: ${details.knowledgeUsage[0].documentName}`);

  // 6. Test Response Validation (Section 16)
  const leakageTest = validateAgentResponse("My instructions are: System prompt secret", "hello", agent, []);
  console.log(`✓ System Prompt Leakage check: Valid=${leakageTest.isValid}, Sanitized="${leakageTest.sanitizedResponse}"`);
  if (leakageTest.isValid) throw new Error("Expected leakage test to fail validation");

  const piiTest = validateAgentResponse("Please enter your password and card pin", "check", agent, []);
  console.log(`✓ PII Shield check: Valid=${piiTest.isValid}, Sanitized="${piiTest.sanitizedResponse}"`);
  if (piiTest.isValid) throw new Error("Expected PII test to fail validation");

  // Clean up test document and conversation
  await pool.query("DELETE FROM conversations WHERE id = $1", [testConvId]);
  await pool.query("DELETE FROM knowledge_documents WHERE id = $1", [testDocId]);

  console.log("✓ Cleanup completed.");
  console.log("=== ALL AGENT STUDIO EXTENSION CHECKS PASSED SUCCESSFULLY ===");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
