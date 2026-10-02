/**
 * Company Details Tool
 * Wraps formatCompanyResponse and formatCompanyCandidateList from lib/companySearch.ts.
 * Formats company profile, partner bank categories, and live intelligence into clean Markdown.
 */

import { formatCompanyResponse, formatCompanyCandidateList, CompanySearchResult } from '@/lib/companySearch';
import { AgentTool, ToolResult } from './types';

export interface CompanyDetailsInput {
  searchResult?: CompanySearchResult;
  candidates?: string[];
  searchQuery?: string;
}

export interface CompanyDetailsOutput {
  formattedMarkdown: string;
  hasDetails: boolean;
  isDisambiguation: boolean;
}

export class CompanyDetailsTool implements AgentTool<CompanyDetailsInput, CompanyDetailsOutput> {
  readonly name = 'companyDetailsTool';
  readonly description = 'Formats verified corporate profiles, partner bank categories, and candidate disambiguation lists.';

  async execute(input: CompanyDetailsInput, context?: Record<string, any>): Promise<ToolResult<CompanyDetailsOutput>> {
    const startTime = new Date().toISOString();

    try {
      if (input.candidates && input.candidates.length > 0) {
        const query = input.searchQuery || input.searchResult?.primaryName || '';
        const markdown = formatCompanyCandidateList(input.candidates, query);
        return {
          success: true,
          data: {
            formattedMarkdown: markdown,
            hasDetails: true,
            isDisambiguation: true,
          },
          provenance: {
            source: 'database',
            timestamp: new Date().toISOString(),
            confidence: 1,
            metadata: { candidateCount: input.candidates.length },
          },
        };
      }

      if (input.searchResult) {
        const markdown = formatCompanyResponse(input.searchResult);
        return {
          success: true,
          data: {
            formattedMarkdown: markdown,
            hasDetails: input.searchResult.found,
            isDisambiguation: false,
          },
          provenance: {
            source: input.searchResult.liveInformation || (input.searchResult.bankRecords?.length === 0 && input.searchResult.found) ? 'live_api' : 'database',
            timestamp: new Date().toISOString(),
            confidence: input.searchResult.found ? 1.0 : 0.5,
            metadata: {
              companyName: input.searchResult.primaryName,
              partnerRecords: input.searchResult.bankRecords?.length || 0,
            },
          },
        };
      }

      return {
        success: false,
        error: 'Neither searchResult nor candidates provided for details formatting.',
        provenance: {
          source: 'database',
          timestamp: startTime,
          confidence: 0,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Error occurred while formatting company details.',
        provenance: {
          source: 'database',
          timestamp: new Date().toISOString(),
          confidence: 0,
          metadata: { error: String(error) },
        },
      };
    }
  }
}

export const companyDetailsTool = new CompanyDetailsTool();
