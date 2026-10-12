// lib/agent-studio/agentStore.ts
import { Agent, UserSubscriptionState } from "./types";
import { PLAN_CONFIGS, PlanTier, getPlanConfig } from "./planLimits";

// Global in-memory cache preserved across requests in development/production Node process
declare global {
  var __agentStudioStore: {
    agents: Map<string, Agent>;
    subscription: UserSubscriptionState;
  } | undefined;
}

function initializeDefaultAgents(): Map<string, Agent> {
  const map = new Map<string, Agent>();

  const loanAssistant: Agent = {
    id: "agent_loan_assistant",
    name: "Loan Assistant",
    description: "AI assistant for loan policy and customer assistance.",
    status: "active",
    responseStyle: "balanced",
    modes: {
      aiAgentMode: true,
      conversations: true,
      campaigns: false,
    },
    operationalMode: "standard",
    goal: "Help users check loan eligibility using the configured bank knowledge, ask only for required missing information, and provide clear eligibility results.",
    guardrailTemplates: [
      "No Hallucination",
      "Knowledge Accuracy",
      "Financial Information Safety",
      "Privacy Protection",
      "Strict Knowledge Usage",
      "Professional Behaviour",
    ],
    manualGuardrails: "Never invent eligibility criteria or interest rates. Never offer binding loan approvals without official verification.",
    instructions: {
      businessDescription: "Leading financial marketplace partner helping retail and corporate applicants compare loan eligibility, calculate EMIs, and understand official bank policies.",
      agentRole: "Senior Loan & Credit Advisory Specialist",
      tone: "Warm, professional, empathetic, and transparent",
      escalationRules: "Connect applicant to verified branch manager in their city when requesting in-person support or high-ticket borrowing (> ₹40 Lakhs).",
      additionalInstructions: "Verify loan type first. Guide customers through KYC documents, CIBIL requirements, and repayment tenures clearly without rigid forms.",
      advancedPrompt: "Base bank policy responses strictly on verified knowledge and partner bank rules.",
      temperature: 0.6,
      knowledgeInstructions: {
        groundingPolicy: "strict",
        requireCitations: true,
        fallbackMessage: "I could not find this specific policy in the verified documents. Please allow me to connect you with an authorized loan officer.",
        customKnowledgePrompt: "Ground all interest rates, tenures, and eligibility thresholds strictly on uploaded partner bank policy documents.",
      },
      guardrails: {
        preventHallucinations: true,
        piiProtection: true,
        financialDisclaimer: true,
        regulatoryCompliance: true,
        restrictOutOfScope: true,
        customGuardrails: "Never offer binding loan approvals or guarantee interest rate reductions without official underwriter verification.",
      },
    },
    generalInstructions: {
      role: "You are a helpful financial assistant.",
      goal: "Help users understand loan eligibility, company policies, and financial processes.",
      behaviour: [
        "Be accurate",
        "Be conversational",
        "Be concise",
        "Ask only necessary questions",
        "Do not repeatedly ask the same question",
        "Maintain relevant conversation context",
      ],
      customRules: "Verify loan type first. Guide customers through KYC documents, CIBIL requirements, and repayment tenures clearly without rigid forms.",
    },
    allowGeneralKnowledge: true,
    globalGuardrails: {
      neverFalseInfo: true,
      protectSystemPrompt: true,
      preventHallucinations: true,
      askMissingInfo: true,
      noDuplicateQuestions: true,
      stayWithinCapabilities: true,
      customGuardrails: "Never offer binding loan approvals or guarantee interest rate reductions without official underwriter verification.",
    },
    welcomeMessage: {
      enabled: true,
      text: "Hi! I'm your Loan Assistant 👋\nI can help you understand loan policies, eligibility and required documents.",
      attachments: [],
    },
    qualification: {
      leadFields: [
        { id: "f1", name: "Customer Name", key: "customerName", enabled: true, required: true, type: "text" },
        { id: "f2", name: "Mobile Number", key: "mobileNumber", enabled: true, required: true, type: "phone" },
        { id: "f3", name: "Loan Type", key: "loanType", enabled: true, required: true, type: "select", options: ["Personal Loan", "Home Loan", "Education Loan", "Business Loan"] },
        { id: "f4", name: "Monthly Income", key: "monthlyIncome", enabled: true, required: true, type: "number" },
        { id: "f5", name: "Employment Type", key: "employmentType", enabled: true, required: true, type: "select", options: ["Salaried", "Self-Employed", "Business Owner"] },
        { id: "f6", name: "Loan Amount", key: "loanAmount", enabled: true, required: true, type: "number" },
        { id: "f7", name: "City", key: "city", enabled: true, required: true, type: "text" },
      ],
      documentCollection: [
        { id: "d1", name: "Identity Proof (PAN / Aadhaar)", required: true, description: "Official government ID" },
        { id: "d2", name: "Address Proof", required: true, description: "Utility bill / Passport / Aadhaar" },
        { id: "d3", name: "Salary Slip (Last 3 Months)", required: true, description: "Proof of salaried income" },
        { id: "d4", name: "Bank Statement (Last 6 Months)", required: false, description: "Salary account statement" },
      ],
      dataCollectionNotes: "Lead submissions are automatically routed to internal CRM liaisons and partner banks.",
    },
    knowledge: [
      {
        id: "k1",
        name: "Bank_Loan_Policy.pdf",
        size: "2.4 MB",
        type: "pdf",
        status: "processed",
        uploadedAt: "Oct 5, 2026",
        tokens: 2450,
      },
    ],
    capabilities: {
      answer_questions: true,
      search_knowledge: true,
      calculate_emi: true,
      check_eligibility: true,
      create_lead: true,
    },
    usage: {
      messagesUsed: 7,
      maxMessages: 10,
      knowledgeTokens: 2450,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  map.set(loanAssistant.id, loanAssistant);
  return map;
}

function getStore() {
  if (!global.__agentStudioStore) {
    const agents = initializeDefaultAgents();
    const basicPlan = PLAN_CONFIGS.basic;
    global.__agentStudioStore = {
      agents,
      subscription: {
        plan: "basic",
        messagesUsed: 7, // starts with 7 / 10 used as requested
        maxMessages: basicPlan.limits.testMessages,
        agentsCount: agents.size,
        maxAgents: basicPlan.limits.agents,
        knowledgeFilesCount: 1,
        maxKnowledgeFiles: basicPlan.limits.knowledgeFiles,
        planLimits: basicPlan.limits,
      },
    };
  }
  return global.__agentStudioStore;
}

export function listAgents(): Agent[] {
  const store = getStore();
  return Array.from(store.agents.values()).sort((a, b) => {
    if (a.id === "agent_loan_assistant") return -1;
    if (b.id === "agent_loan_assistant") return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function getAgent(id: string): Agent | null {
  const store = getStore();
  return store.agents.get(id) || null;
}

export function createAgent(data: {
  name: string;
  description: string;
  purpose?: string;
}): { success: boolean; agent?: Agent; error?: string; limitReached?: boolean } {
  const store = getStore();
  const planConfig = getPlanConfig(store.subscription.plan);
  const currentCount = store.agents.size;

  if (currentCount >= planConfig.limits.agents) {
    return {
      success: false,
      error: `You've reached your ${planConfig.name} plan limit of ${planConfig.limits.agents} agent${planConfig.limits.agents === 1 ? "" : "s"}. Upgrade to create more AI agents.`,
      limitReached: true,
    };
  }

  const newId = `agent_${Date.now()}`;
  const newAgent: Agent = {
    id: newId,
    name: data.name.trim() || "Untitled Agent",
    description: data.description.trim() || "Custom AI assistant",
    status: "draft",
    responseStyle: "balanced",
    modes: {
      aiAgentMode: true,
      conversations: true,
      campaigns: false,
    },
    operationalMode: "standard",
    goal: data.purpose || "Help users check loan eligibility using the configured bank knowledge, ask only for required missing information, and provide clear eligibility results.",
    guardrailTemplates: [
      "No Hallucination",
      "Knowledge Accuracy",
      "Financial Information Safety",
      "Privacy Protection",
      "Strict Knowledge Usage",
      "Professional Behaviour",
    ],
    manualGuardrails: "",
    instructions: {
      businessDescription: data.purpose || "Customer support and domain assistance.",
      agentRole: `${data.name} Specialist`,
      tone: "Helpful, friendly, and professional",
      escalationRules: "Direct complex requests to a team supervisor.",
      additionalInstructions: "Answer questions clearly and helpfully.",
      temperature: 0.6,
      knowledgeInstructions: {
        groundingPolicy: "standard",
        requireCitations: true,
        fallbackMessage: "I do not have that specific detail in my knowledge documents. Let me connect you with a representative.",
        customKnowledgePrompt: "",
      },
      guardrails: {
        preventHallucinations: true,
        piiProtection: true,
        financialDisclaimer: true,
        regulatoryCompliance: true,
        restrictOutOfScope: true,
        customGuardrails: "",
      },
    },
    generalInstructions: {
      role: `${data.name} Specialist`,
      goal: data.purpose || "Customer support and domain assistance.",
      behaviour: [
        "Be accurate",
        "Be conversational",
        "Be concise",
        "Ask only necessary questions",
        "Do not repeatedly ask the same question",
        "Maintain relevant conversation context",
      ],
      customRules: "Answer questions clearly and helpfully.",
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
      text: `Hi there! I'm your ${data.name} 👋 How can I help you today?`,
      attachments: [],
    },
    qualification: {
      leadFields: [
        { id: `f_${Date.now()}_1`, name: "Full Name", key: "fullName", enabled: true, required: true },
        { id: `f_${Date.now()}_2`, name: "Email", key: "email", enabled: true, required: true },
      ],
      documentCollection: [],
    },
    knowledge: [],
    capabilities: {
      answer_questions: true,
      search_knowledge: false,
      calculate_emi: false,
      check_eligibility: false,
      create_lead: false,
    },
    usage: {
      messagesUsed: 0,
      maxMessages: planConfig.limits.testMessages,
      knowledgeTokens: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.agents.set(newId, newAgent);
  store.subscription.agentsCount = store.agents.size;
  return { success: true, agent: newAgent };
}

export function updateAgent(id: string, updates: Partial<Agent>): Agent | null {
  const store = getStore();
  const existing = store.agents.get(id);
  if (!existing) return null;

  const updated: Agent = {
    ...existing,
    ...updates,
    id: existing.id, // cannot change id
    updatedAt: new Date().toISOString(),
  };

  store.agents.set(id, updated);
  return updated;
}

export function deleteAgent(id: string): { success: boolean; error?: string } {
  const store = getStore();
  store.agents.delete(id);
  store.subscription.agentsCount = store.agents.size;
  return { success: true };
}

export function getUserSubscription(): UserSubscriptionState {
  const store = getStore();
  const planConfig = getPlanConfig(store.subscription.plan);
  
  // Count total knowledge files
  let totalKnowledge = 0;
  for (const agent of store.agents.values()) {
    totalKnowledge += agent.knowledge?.length || 0;
  }

  store.subscription.agentsCount = store.agents.size;
  store.subscription.maxAgents = planConfig.limits.agents;
  store.subscription.maxMessages = planConfig.limits.testMessages;
  store.subscription.knowledgeFilesCount = totalKnowledge;
  store.subscription.maxKnowledgeFiles = planConfig.limits.knowledgeFiles;
  store.subscription.planLimits = planConfig.limits;

  return { ...store.subscription };
}

export function resetStore(): UserSubscriptionState {
  global.__agentStudioStore = {
    agents: initializeDefaultAgents(),
    subscription: {
      plan: "basic",
      messagesUsed: 7,
      maxMessages: 10,
      agentsCount: 1,
      maxAgents: 1,
      knowledgeFilesCount: 1,
      maxKnowledgeFiles: 1,
      planLimits: {
        agents: 1,
        testMessages: 10,
        knowledgeFiles: 1,
      },
    },
  };
  return getUserSubscription();
}

export function resetUsage(): UserSubscriptionState {
  const store = getStore();
  store.subscription.messagesUsed = 0;
  for (const agent of store.agents.values()) {
    agent.usage.messagesUsed = 0;
  }
  return getUserSubscription();
}

export function upgradePlan(targetPlan: PlanTier): UserSubscriptionState {
  const store = getStore();
  store.subscription.plan = targetPlan;
  const config = getPlanConfig(targetPlan);
  store.subscription.maxMessages = config.limits.testMessages;
  store.subscription.maxAgents = config.limits.agents;
  store.subscription.maxKnowledgeFiles = config.limits.knowledgeFiles;
  store.subscription.planLimits = config.limits;

  // Sync agent max limits
  for (const agent of store.agents.values()) {
    agent.usage.maxMessages = config.limits.testMessages;
  }

  return getUserSubscription();
}

export function checkAndIncrementMessageUsage(agentId: string): {
  allowed: boolean;
  messagesUsed: number;
  maxMessages: number;
  remaining: number;
  limitReached: boolean;
  nearLimit: boolean;
} {
  const store = getStore();
  const agent = store.agents.get(agentId) || store.agents.get("agent_loan_assistant");
  const planConfig = getPlanConfig(store.subscription.plan);
  const max = planConfig.limits.testMessages;
  const current = store.subscription.messagesUsed;

  if (current >= max) {
    return {
      allowed: false,
      messagesUsed: current,
      maxMessages: max,
      remaining: 0,
      limitReached: true,
      nearLimit: true,
    };
  }

  const nextUsed = current + 1;
  store.subscription.messagesUsed = nextUsed;
  if (agent) {
    agent.usage.messagesUsed = nextUsed;
    agent.usage.maxMessages = max;
  }

  const remaining = Math.max(0, max - nextUsed);
  return {
    allowed: true,
    messagesUsed: nextUsed,
    maxMessages: max,
    remaining,
    limitReached: nextUsed >= max,
    nearLimit: remaining === 1,
  };
}

export function addKnowledgeFile(
  agentId: string,
  file: { name: string; size: string; type: "pdf" | "docx" | "txt" }
): { success: boolean; document?: any; error?: string; limitReached?: boolean } {
  const store = getStore();
  const agent = store.agents.get(agentId);
  if (!agent) return { success: false, error: "Agent not found" };

  const planConfig = getPlanConfig(store.subscription.plan);
  const currentFiles = agent.knowledge.length;

  if (currentFiles >= planConfig.limits.knowledgeFiles) {
    return {
      success: false,
      error: `Your ${planConfig.name} plan includes ${planConfig.limits.knowledgeFiles} knowledge file${planConfig.limits.knowledgeFiles === 1 ? "" : "s"}. Upgrade to add more files.`,
      limitReached: true,
    };
  }

  const newDoc = {
    id: `k_${Date.now()}`,
    name: file.name,
    size: file.size,
    type: file.type,
    status: "processed" as const,
    uploadedAt: "Just now",
    tokens: Math.floor(Math.random() * 800) + 1200,
  };

  agent.knowledge.push(newDoc);
  agent.usage.knowledgeTokens += newDoc.tokens;
  agent.updatedAt = new Date().toISOString();

  return { success: true, document: newDoc };
}

export function removeKnowledgeFile(agentId: string, docId: string): { success: boolean } {
  const store = getStore();
  const agent = store.agents.get(agentId);
  if (!agent) return { success: false };

  agent.knowledge = agent.knowledge.filter((d) => d.id !== docId);
  agent.updatedAt = new Date().toISOString();
  return { success: true };
}
