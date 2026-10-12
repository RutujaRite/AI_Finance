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
  capabilities: Record<string, boolean>;
  usage: AgentUsageStats;
  createdAt: string;
  updatedAt: string;
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
