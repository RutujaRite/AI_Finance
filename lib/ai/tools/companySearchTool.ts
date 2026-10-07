/**
 * Company Search Tool
 * Wraps searchCompany from lib/companySearch.ts with typed inputs, outputs, error boundary, and provenance tracing.
 * Safety: Read-only query against bank_company_data; does NOT write to partner-bank tables.
 */

import { searchCompany, CompanySearchResult, findCompanySuggestions, CompanyCandidate } from '@/lib/companySearch';
import { AgentTool, ToolResult } from './types';

export interface CompanySearchInput {
  companyName?: string;
  company_name?: string;
  query?: string;
  limit?: number;
}

export interface CompanySearchOutput {
  query: string;
  found: boolean;
  searchResult: CompanySearchResult;
  suggestions?: CompanyCandidate[];
}

export class CompanySearchTool implements AgentTool<CompanySearchInput, CompanySearchOutput> {
  readonly name = 'companySearchTool';
  readonly description = 'Searches verified corporate intelligence in partner-bank records and live intelligence.';

  async execute(input: CompanySearchInput, context?: Record<string, any>): Promise<ToolResult<CompanySearchOutput>> {
    const startTime = new Date().toISOString();
    const query = String(input.companyName || input.company_name || input.query || '').trim();

    if (!query) {
      return {
        success: false,
        error: 'Company name cannot be empty.',
        provenance: {
          source: 'database',
          timestamp: startTime,
          confidence: 0,
        },
      };
    }

    try {
      const searchResult = await searchCompany(query, input.limit);
      let suggestions: CompanyCandidate[] | undefined;

      if (!searchResult.found && (!searchResult.candidates || searchResult.candidates.length === 0)) {
        try {
          suggestions = await findCompanySuggestions(query, 3);
        } catch (sugErr) {
          console.warn('[CompanySearchTool] Failed to find suggestions:', sugErr);
        }
      }

      const isLive = Boolean(searchResult.liveInformation || (searchResult.bankRecords?.length === 0 && searchResult.found));
      const provenanceSource = isLive ? 'live_api' : 'database';

      return {
        success: true,
        data: {
          query,
          found: searchResult.found,
          searchResult,
          suggestions,
        },
        provenance: {
          source: provenanceSource,
          timestamp: new Date().toISOString(),
          confidence: searchResult.found ? 1.0 : (suggestions && suggestions.length > 0 ? 0.6 : 0),
          metadata: {
            primaryName: searchResult.primaryName,
            partnerRecordCount: searchResult.bankRecords?.length || 0,
            hasLiveInfo: !!searchResult.basicInfo?.cin,
            needsDisambiguation: searchResult.needsDisambiguation,
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Error occurred while searching company.',
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

export const companySearchTool = new CompanySearchTool();
