// scripts/seed-screenshot-data.ts
import pool from "../lib/db";
import { syncAgentToDb } from "../lib/agent-studio/dbStore";

async function seedScreenshotData() {
  console.log("Seeding exact screenshot records...");

  // 1. Ensure the 4 agents exist matching the screenshot
  const agents = [
    {
      id: "agent_loan_assistant",
      name: "Loan Eligibility Assistant",
      operationalMode: "rag_focused",
      status: "active",
      goal: "Help users check loan eligibility based on the provided bank policy documents.",
      description: "Bank policy document evaluation and loan eligibility assistant.",
      updatedAt: "12 Apr 2025 10:32 AM",
    },
    {
      id: "agent_greeting_assistant",
      name: "Greeting Assistant",
      operationalMode: "standard",
      status: "active",
      goal: "Respond warmly and naturally to user greetings and pleasantries without forcing financial questionnaires.",
      description: "Front-desk greeting specialist.",
      updatedAt: "10 Apr 2025 02:15 PM",
    },
    {
      id: "agent_hr_policy_assistant",
      name: "HR Policy Assistant",
      operationalMode: "rag_focused",
      status: "draft", // Inactive
      goal: "Provide clear and accurate guidance on organization HR policies, leave entitlements, and workplace procedures.",
      description: "Employee HR guidance specialist.",
      updatedAt: "05 Apr 2025 11:20 AM",
    },
    {
      id: "agent_company_support",
      name: "Company Support Assistant",
      operationalMode: "task_focused",
      status: "active",
      goal: "Automate company verification, employer categorization, and corporate support workflows.",
      description: "Corporate policy and support assistant.",
      updatedAt: "02 Apr 2025 09:45 AM",
    },
  ];

  for (const a of agents) {
    const fullAgent: any = {
      id: a.id,
      name: a.name,
      description: a.description,
      status: a.status,
      operationalMode: a.operationalMode,
      goal: a.goal,
      responseStyle: "balanced",
      modes: { aiAgentMode: true, conversations: true, campaigns: false },
      guardrailTemplates: ["No Hallucination", "Knowledge Accuracy", "Privacy Protection"],
      manualGuardrails: "Do not assume missing applicant information.",
      instructions: {
        businessDescription: a.description,
        agentRole: `${a.name} Specialist`,
        tone: "Professional, clear, and empathetic",
        escalationRules: "Direct complex requests to a manager.",
        additionalInstructions: "Use uploaded documents as authoritative source.",
      },
      generalInstructions: {
        role: `${a.name} Specialist`,
        goal: a.goal,
        behaviour: ["Be accurate", "Be conversational", "Be concise"],
        customRules: "",
      },
      allowGeneralKnowledge: true,
      globalGuardrails: {
        neverFalseInfo: true,
        protectSystemPrompt: true,
        preventHallucinations: true,
        askMissingInfo: true,
        noDuplicateQuestions: true,
        stayWithinCapabilities: true,
        customGuardrails: "",
      },
      welcomeMessage: {
        enabled: true,
        text: `Hello! 👋 Welcome to ${a.name}. How can I help you today?`,
        attachments: [],
      },
      capabilities: {
        answer_questions: true,
        search_knowledge: true,
        calculate_emi: true,
        check_eligibility: true,
        create_lead: true,
      },
      usage: { messagesUsed: 2, maxMessages: 50, knowledgeTokens: 3200 },
      updatedAt: new Date().toISOString(),
    };
    await syncAgentToDb(fullAgent);
  }
  console.log("✓ Seeded the 4 agents.");

  // 2. Ensure knowledge_documents table has the exact 3 files matching the screenshot for agent_loan_assistant
  const docs = [
    {
      id: "kdoc_bank_abc_policy",
      agent_id: "agent_loan_assistant",
      name: "Bank_ABC_Personal_Loan_Policy.pdf",
      file_type: "pdf",
      file_size: "1.2 MB",
      status: "COMPLETED",
      status_message: "Bank policy document for personal loan eligibility",
      chunk_count: 24,
      is_active: true,
      uploaded_at: "2025-04-12 10:32:00",
      instruction: "Use this document as the authoritative source for Bank ABC personal-loan eligibility. Identify the eligibility criteria relevant to the user's request. Check which information is already available in the conversation. Ask only for missing information. Evaluate each applicable criterion and explain the result clearly. Do not invent or modify eligibility criteria.",
      guardrails: "• Do not assume missing applicant information.\n• Do not create criteria that are not present in the document.\n• Do not use this document for another bank.\n• If required information is unavailable, clearly state that.",
    },
    {
      id: "kdoc_education_loan_policy",
      agent_id: "agent_loan_assistant",
      name: "Education_Loan_Policy.docx",
      file_type: "docx",
      file_size: "850 KB",
      status: "COMPLETED",
      status_message: "Education loan eligibility criteria",
      chunk_count: 18,
      is_active: true,
      uploaded_at: "2025-04-10 14:15:00",
      instruction: "Use this document for student loan criteria, accredited university lists, co-applicant requirements, and interest subsidies.",
      guardrails: "• Validate student enrollment proof.\n• Require parent or guardian co-applicant verification.",
    },
    {
      id: "kdoc_company_policy",
      agent_id: "agent_loan_assistant",
      name: "Company_Policy.xlsx",
      file_type: "xlsx",
      file_size: "420 KB",
      status: "PROCESSING",
      status_message: "Company loan policy and eligibility",
      chunk_count: 12,
      is_active: true,
      uploaded_at: "2025-04-08 11:20:00",
      instruction: "Use this spreadsheet for company tier classification (CAT A, CAT B, CAT C) and corporate loan limits.",
      guardrails: "• Never promote unlisted companies without approval.",
    },
  ];

  for (const doc of docs) {
    await pool.query(
      `INSERT INTO knowledge_documents (id, agent_id, name, file_type, file_size, status, status_message, chunk_count, is_active, uploaded_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         file_type = EXCLUDED.file_type,
         file_size = EXCLUDED.file_size,
         status = EXCLUDED.status,
         status_message = EXCLUDED.status_message,
         chunk_count = EXCLUDED.chunk_count,
         is_active = EXCLUDED.is_active`,
      [
        doc.id,
        doc.agent_id,
        doc.name,
        doc.file_type,
        doc.file_size,
        doc.status,
        doc.status_message,
        doc.chunk_count,
        doc.is_active,
        doc.uploaded_at,
      ]
    );

    // Seed instruction
    await pool.query(
      `INSERT INTO knowledge_document_instructions (id, document_id, agent_id, instruction_text, when_to_use, updated_at)
       VALUES ($1, $2, $3, $4, 'When evaluating loan eligibility', NOW())
       ON CONFLICT (id) DO UPDATE SET instruction_text = EXCLUDED.instruction_text`,
      [`inst_${doc.id}`, doc.id, doc.agent_id, doc.instruction]
    );

    // Seed guardrail
    await pool.query(
      `INSERT INTO knowledge_document_guardrails (id, document_id, agent_id, guardrail_text, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET guardrail_text = EXCLUDED.guardrail_text`,
      [`guard_${doc.id}`, doc.id, doc.agent_id, doc.guardrails]
    );
  }

  console.log("✓ Seeded all knowledge documents with instructions and guardrails.");
}

seedScreenshotData().then(() => process.exit(0)).catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
