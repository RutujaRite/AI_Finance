// lib/agent-studio/types.ts
import { PlanTier, PlanLimits } from "./planLimits";

export type AgentStatus = "active" | "draft" | "archived";
export type ResponseStyle = "concise" | "balanced" | "detailed";

export interface AgentModes {
  /** Mode 1: Show only demo of the AI agent on the test AI agent playground */
  aiAgentMode: boolean;
  /** Mode 2: Allow the conversation with LLM on main AI assistant */
  conversations: boolean;
  /** Campaigns / Proactive outreach */
  campaigns: boolean;
}

export interface InstructionGuardrails {
  preventHallucinations?: boolean;
  piiProtection?: boolean;
  financialDisclaimer?: boolean;
  regulatoryCompliance?: boolean;
  restrictOutOfScope?: boolean;
  customGuardrails?: string;
}

export const GUARDRAIL_TEMPLATES: Record<string, string> = {
  "No Hallucination": "Do not make up facts. Never invent interest rates, eligibility criteria, or bank terms.",
  "Knowledge Accuracy": "Strictly adhere to verified details from the uploaded documents and official database records.",
  "Financial Information Safety": "Never offer binding financial commitments or legal contracts without underwriter review.",
  "Privacy Protection": "Never request or log personal passwords, OTPs, PINs, CVVs, or sensitive credentials.",
  "Strict Knowledge Usage": "When answering bank/policy-specific questions, base the answer strictly on retrieved knowledge.",
  "Professional Behaviour": "Maintain an empathetic, clear, helpful, and concise professional tone at all times.",
};

export interface KnowledgeInstructions {
  groundingPolicy?: "strict" | "standard" | "flexible";
  requireCitations?: boolean;
  fallbackMessage?: string;
  customKnowledgePrompt?: string;
}

export interface AgentInstructions {
  businessDescription: string;
  agentRole: string;
  tone: string;
  escalationRules: string;
  additionalInstructions: string;
  advancedPrompt?: string;
  temperature?: number;
  knowledgeInstructions?: KnowledgeInstructions;
  guardrails?: InstructionGuardrails;
}

export interface WelcomeMessageConfig {
  enabled: boolean;
  text: string;
  attachments: Array<{ id: string; name: string; url?: string } | string>;
}

export interface LeadQualificationField {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  required: boolean;
  type?: "text" | "number" | "phone" | "select" | "email";
  options?: string[];
}

export interface DocumentRequirement {
  id: string;
  name: string;
  required: boolean;
  description?: string;
}

export type DocumentProcessingStatus =
  | "UPLOADING"
  | "PROCESSING"
  | "EXTRACTING"
  | "CHUNKING"
  | "INDEXING"
  | "COMPLETED"
  | "FAILED";

export interface KnowledgeDocumentInstruction {
  id?: string;
  documentId?: string;
  agentId?: string;
  instructionText: string;
  whenToUse?: string;
  whenNotToUse?: string;
}

export interface KnowledgeDocumentGuardrail {
  id?: string;
  documentId?: string;
  agentId?: string;
  guardrailText: string;
}

export interface KnowledgeDocumentRecord {
  id: string;
  agentId: string;
  name: string;
  fileType: string;
  fileSize: string;
  filePath?: string;
  status: DocumentProcessingStatus;
  statusMessage?: string;
  chunkCount: number;
  vectorStatus: "Indexed" | "Pending" | "Failed";
  isActive: boolean;
  rawText?: string;
  metadata?: any;
  source?: string; // 'knowledge_agent_passed'
  is_policy_file?: boolean;
  uploadedAt: string;
  updatedAt: string;
  instruction?: KnowledgeDocumentInstruction;
  guardrail?: KnowledgeDocumentGuardrail;
}

export interface GeneralInstructionsConfig {
  role: string;
  goal: string;
  behaviour: string[];
  customRules?: string;
}

export interface GlobalGuardrailsConfig {
  neverFalseInfo?: boolean;
  protectSystemPrompt?: boolean;
  preventHallucinations?: boolean;
  askMissingInfo?: boolean;
  noDuplicateQuestions?: boolean;
  stayWithinCapabilities?: boolean;
  customGuardrails?: string;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  size: string;
  type: "pdf" | "docx" | "txt" | "csv" | "xls" | "xlsx" | "json";
  status: "processed" | "uploading" | "failed";
  uploadedAt: string;
  tokens?: number;
  chunks?: number;
  isActive?: boolean;
}

export type CapabilityKey = string;

export interface CapabilityItem {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  available: boolean; // if false -> "Coming Soon"
}

export interface AgentUsageStats {
  messagesUsed: number;
  maxMessages: number;
  knowledgeTokens: number;
}

export type OperationalMode = "standard" | "rag_focused" | "task_focused";

export interface Agent {
  id: string;
  userId?: number;
  isActiveForUser?: boolean;
  name: string;
  description: string;
  status: AgentStatus;
  responseStyle: ResponseStyle;
  modes: AgentModes;
  operationalMode?: OperationalMode;
  goal?: string;
  model?: string;
  guardrailTemplates?: string[];
  manualGuardrails?: string;
  instructions: AgentInstructions;
  generalInstructions?: GeneralInstructionsConfig;
  allowGeneralKnowledge?: boolean;
  globalGuardrails?: GlobalGuardrailsConfig;
  welcomeMessage: WelcomeMessageConfig;
  qualification: {
    leadFields: LeadQualificationField[];
    documentCollection: DocumentRequirement[];
    dataCollectionNotes?: string;
  };
  knowledge: KnowledgeDocument[];
  documents?: KnowledgeDocumentRecord[];
  documentCount?: number;
  type?: "knowledge" | "conversational" | "greeting" | "standard";
  capabilities: Record<string, boolean>;
  usage: AgentUsageStats;
  createdAt: string;
  updatedAt: string;
}

/**
 * Checks whether an agent is explicitly configured as a Knowledge Base agent.
 * Conversational and greeting assistants return false.
 */
export function isKnowledgeBaseAgent(agent?: Agent | any): boolean {
  if (!agent) return false;

  // 1. Explicit type field
  if (agent.type === "knowledge" || agent.type === "knowledge_base" || agent.type === "rag") {
    return true;
  }
  if (agent.type === "greeting" || agent.type === "conversational") {
    return false;
  }

  // 2. Capabilities check
  if (agent.capabilities?.search_knowledge === true || agent.capabilities?.knowledge_retrieval === true) {
    return true;
  }
  if (agent.capabilities && agent.capabilities.search_knowledge === false) {
    return false;
  }

  // 3. Operational mode check
  if (agent.operationalMode === "rag_focused") {
    return true;
  }

  // 4. Role or name indicators
  const role = String(agent.instructions?.agentRole || agent.generalInstructions?.role || "").toLowerCase();
  const name = String(agent.name || "").toLowerCase();

  // Greeting or conversational welcome is explicitly not a knowledge agent
  if (
    name.includes("greeting") ||
    name.includes("welcome") ||
    role.includes("greeting") ||
    role.includes("welcome") ||
    role.includes("front-desk")
  ) {
    return false;
  }

  // Knowledge, underwriter, policy, or loan eligibility agents
  if (
    role.includes("knowledge") ||
    role.includes("policy") ||
    role.includes("underwrit") ||
    name.includes("knowledge") ||
    name.includes("policy") ||
    name.includes("loan eligibility")
  ) {
    return true;
  }

  return false;
}

export interface UserSubscriptionState {
  plan: PlanTier;
  messagesUsed: number;
  maxMessages: number;
  agentsCount: number;
  maxAgents: number;
  knowledgeFilesCount: number;
  maxKnowledgeFiles: number;
  planLimits: PlanLimits;
}

export interface TestChatMessage {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  timestamp: string;
  stepTrace?: string[];
  trace?: any;
}

export interface ConversationKnowledgeUsageRecord {
  id: string;
  conversationId: string;
  agentId: string;
  knowledgeDocumentId: string;
  documentName?: string;
  retrievedChunkIds: string[];
  createdAt: string;
}

export interface ConversationMessageRecord {
  id: string;
  conversationId: string;
  agentId: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string;
  toolsUsed?: string[];
  knowledgeDocumentsUsed?: string[];
  createdAt: string;
}

export interface ConversationRecord {
  id: string;
  agentId: string;
  userId?: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  messages?: ConversationMessageRecord[];
  knowledgeUsage?: ConversationKnowledgeUsageRecord[];
}
