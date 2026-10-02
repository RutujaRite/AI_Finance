/**
 * Bank Manager Search Tool
 * Wraps searchBankManager and formatManagers from lib/bankSearch.ts.
 * Direct PostgreSQL lookup with verified branch/city filtering and clean markdown table generation.
 */

import {
  searchBankManager,
  formatManagers,
  BankManagerSearchParams,
  BankManagerRecord,
} from '@/lib/bankSearch';
import { AgentTool, ToolResult } from './types';

export interface BankManagerSearchInput {
  bankName?: string;
  city?: string;
  area?: string;
  pincode?: string;
  role?: string;
  query?: string;
}

export interface BankManagerSearchOutput {
  managers: BankManagerRecord[];
  formattedMarkdown: string;
  count: number;
}

export class BankManagerSearchTool implements AgentTool<BankManagerSearchInput, BankManagerSearchOutput> {
  readonly name = 'bankManagerSearchTool';
  readonly description = 'Searches verified bank branch managers, loan officers, and regional credit heads.';

  async execute(input: BankManagerSearchInput, context?: Record<string, any>): Promise<ToolResult<BankManagerSearchOutput>> {
    const startTime = new Date().toISOString();

    try {
      const searchParams: BankManagerSearchParams = {
        bank_name: input.bankName,
        city: input.city,
        area: input.area,
        pincode: input.pincode,
        role: input.role,
        query: input.query,
      };

      const managers = await searchBankManager(searchParams);
      const formattedMarkdown = formatManagers(managers, input.query || input.city || input.bankName);

      return {
        success: true,
        data: {
          managers,
          formattedMarkdown,
          count: managers.length,
        },
        provenance: {
          source: 'database',
          timestamp: new Date().toISOString(),
          confidence: managers.length > 0 ? 1.0 : 0.5,
          metadata: {
            bankName: input.bankName,
            city: input.city,
            pincode: input.pincode,
            count: managers.length,
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Error occurred while searching bank managers.',
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

export const bankManagerSearchTool = new BankManagerSearchTool();
