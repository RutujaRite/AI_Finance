/**
 * Policy RAG Search Tool
 * Wraps answerPolicyWithRag and resolveDbPolicy from lib/policyRag.ts.
 * Grounded pgvector retrieval with chunk citation provenance and strict anti-hallucination cleanup.
 */

import {
  answerPolicyWithRag,
  resolveDbPolicy,
  PolicyRagOptions,
  PolicyRagAnswer,
  PolicyRagSource,
} from '@/lib/policyRag';
import { AgentTool, ToolResult } from './types';

export interface PolicyRagSearchInput {
  query: string;
  bankName?: string;
  policyFileId?: number;
  bankId?: number;
  topK?: number;
}

export interface PolicyRagSearchOutput {
  answer: string;
  sources: PolicyRagSource[];
  retrievedChunks: number;
  matchedBank?: string;
}

export class PolicyRagSearchTool implements AgentTool<PolicyRagSearchInput, PolicyRagSearchOutput> {
  readonly name = 'policyRagSearchTool';
  readonly description = 'Performs grounded semantic RAG retrieval across verified bank policy documents.';

  async execute(input: PolicyRagSearchInput, context?: Record<string, any>): Promise<ToolResult<PolicyRagSearchOutput>> {
    const startTime = new Date().toISOString();
    const query = String(input.query || '').trim();

    if (!query) {
      return {
        success: false,
        error: 'Policy query cannot be empty.',
        provenance: {
          source: 'rag_vector',
          timestamp: startTime,
          confidence: 0,
        },
      };
    }

    try {
      let resolvedBank: any = null;
      let policyFileId = input.policyFileId;
      let bankId = input.bankId;

      if (!policyFileId && input.bankName) {
        resolvedBank = await resolveDbPolicy(input.bankName);
        if (resolvedBank) {
          policyFileId = resolvedBank.policyFileId;
          bankId = resolvedBank.bankId;
        }
      }

      const ragOptions: PolicyRagOptions = {
        query,
        policyFileId,
        bankId,
        topK: input.topK || 4,
      };

      const ragResult: PolicyRagAnswer = await answerPolicyWithRag(ragOptions);

      return {
        success: true,
        data: {
          answer: ragResult.answer,
          sources: ragResult.sources,
          retrievedChunks: ragResult.retrievedChunks,
          matchedBank: resolvedBank?.bankName,
        },
        provenance: {
          source: 'rag_vector',
          timestamp: new Date().toISOString(),
          confidence: ragResult.sources.length > 0 ? ragResult.sources[0].similarity : 0.85,
          metadata: {
            retrievedChunks: ragResult.retrievedChunks,
            policyFileId,
            bankId,
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Error occurred while querying bank policies.',
        provenance: {
          source: 'rag_vector',
          timestamp: new Date().toISOString(),
          confidence: 0,
          metadata: { error: String(error) },
        },
      };
    }
  }
}

export const policyRagSearchTool = new PolicyRagSearchTool();
