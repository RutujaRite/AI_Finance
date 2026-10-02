/**
 * Universal AI Agent Tool Abstraction Types
 * Defines standardized tool interfaces, typed inputs/outputs, error envelopes, and provenance tracing.
 */

export type ToolProvenanceSource =
  | 'database'
  | 'live_api'
  | 'math_engine'
  | 'rag_vector'
  | 'policy_rules'
  | 'hybrid';

export interface ToolProvenance {
  source: ToolProvenanceSource;
  timestamp: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  provenance: ToolProvenance;
}

export interface AgentTool<TInput, TOutput> {
  name: string;
  description: string;
  execute(input: TInput, context?: Record<string, any>): Promise<ToolResult<TOutput>>;
}
