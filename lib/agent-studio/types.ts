// lib/agent-studio/types.ts
import { PlanTier, PlanLimits } from "./planLimits";

export type AgentStatus = "active" | "draft" | "archived";
export type ResponseStyle = "concise" | "balanced" | "detailed";

export interface AgentModes {
  aiAgentMode: boolean;
  conversations: boolean;
  campaigns: boolean;
}

export interface AgentInstructions {
  businessDescription: string;
  agentRole: string;
  tone: string;
  escalationRules: string;
  additionalInstructions: string;
  advancedPrompt?: string;
  temperature?: number;
}

export interface WelcomeMessageConfig {
  enabled: boolean;
  text: string;
  attachments: Array<{ id: string; name: string; url?: string }>;
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

export interface KnowledgeDocument {
  id: string;
  name: string;
  size: string;
  type: "pdf" | "docx" | "txt";
  status: "processed" | "uploading" | "failed";
  uploadedAt: string;
  tokens?: number;
}

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

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  responseStyle: ResponseStyle;
  modes: AgentModes;
  instructions: AgentInstructions;
  welcomeMessage: WelcomeMessageConfig;
  qualification: {
    leadFields: LeadQualificationField[];
    documentCollection: DocumentRequirement[];
    dataCollectionNotes?: string;
  };
  knowledge: KnowledgeDocument[];
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
}
