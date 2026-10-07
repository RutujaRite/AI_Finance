/**
 * Agent Tools Registry
 * Central access point and dispatcher for all AI tools with typed contracts and provenance.
 */

export * from './types';
export * from './companySearchTool';
export * from './companyDetailsTool';
export * from './eligibilityCheckTool';
export * from './emiCalculatorTool';
export * from './policyRagSearchTool';
export * from './bankManagerSearchTool';

import { companySearchTool } from './companySearchTool';
import { companyDetailsTool } from './companyDetailsTool';
import { eligibilityCheckTool } from './eligibilityCheckTool';
import { emiCalculatorTool } from './emiCalculatorTool';
import { policyRagSearchTool } from './policyRagSearchTool';
import { bankManagerSearchTool } from './bankManagerSearchTool';
import { AgentTool } from './types';

export const agentToolRegistry: Record<string, AgentTool<any, any>> = {
  companySearchTool,
  companyDetailsTool,
  eligibilityCheckTool,
  emiCalculatorTool,
  policyRagSearchTool,
  bankManagerSearchTool,
};

export async function executeAgentTool<TInput, TOutput>(
  toolName: string,
  input: TInput,
  context?: Record<string, any>
) {
  const tool = agentToolRegistry[toolName];
  if (!tool) {
    return {
      success: false,
      error: `Tool '${toolName}' not found in registry.`,
      provenance: {
        source: 'database' as const,
        timestamp: new Date().toISOString(),
        confidence: 0,
      },
    };
  }
  return tool.execute(input, context);
}
