/**
 * EMI Calculator Tool
 * Wraps calculateEmi and formatEmiResult from lib/eligibilityWizard.ts.
 * Enforces standard financial amortization formula: E = P * r * (1 + r)^n / ((1 + r)^n - 1)
 * Safety: Preserves exact mathematical calculations and validates parameter boundaries.
 */

import { calculateEmi, formatEmiResult } from '@/lib/eligibilityWizard';
import { AgentTool, ToolResult } from './types';

export interface EmiCalculatorInput {
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
  followUpText?: string;
}

export interface EmiCalculatorOutput {
  monthlyEmi: number;
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
  totalInterest: number;
  totalPayable: number;
  formattedMarkdown: string;
}

export class EmiCalculatorTool implements AgentTool<EmiCalculatorInput, EmiCalculatorOutput> {
  readonly name = 'emiCalculatorTool';
  readonly description = 'Calculates monthly EMI, total interest, and total payable amount with full amortization schedule.';

  async execute(input: EmiCalculatorInput, context?: Record<string, any>): Promise<ToolResult<EmiCalculatorOutput>> {
    const startTime = new Date().toISOString();

    const principal = Number(input.principal);
    const annualRatePct = Number(input.annualRatePct);
    const tenureMonths = Number(input.tenureMonths);

    if (isNaN(principal) || principal <= 0) {
      return {
        success: false,
        error: 'Principal must be a positive number.',
        provenance: {
          source: 'math_engine',
          timestamp: startTime,
          confidence: 0,
        },
      };
    }

    if (isNaN(annualRatePct) || annualRatePct <= 0) {
      return {
        success: false,
        error: 'Annual interest rate must be greater than 0%.',
        provenance: {
          source: 'math_engine',
          timestamp: startTime,
          confidence: 0,
        },
      };
    }

    if (isNaN(tenureMonths) || tenureMonths <= 0) {
      return {
        success: false,
        error: 'Tenure must be a positive number of months.',
        provenance: {
          source: 'math_engine',
          timestamp: startTime,
          confidence: 0,
        },
      };
    }

    try {
      const monthlyEmi = calculateEmi(principal, annualRatePct, tenureMonths);
      const totalPayable = monthlyEmi * tenureMonths;
      const totalInterest = Math.max(0, totalPayable - principal);

      const formattedMarkdown = formatEmiResult(
        { principal, rate: annualRatePct, tenure: tenureMonths },
        monthlyEmi,
        input.followUpText
      );

      return {
        success: true,
        data: {
          monthlyEmi,
          principal,
          annualRatePct,
          tenureMonths,
          totalInterest,
          totalPayable,
          formattedMarkdown,
        },
        provenance: {
          source: 'math_engine',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          metadata: {
            formula: 'P * r * (1+r)^n / ((1+r)^n - 1)',
            principal,
            annualRatePct,
            tenureMonths,
            monthlyEmi,
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Error occurred while calculating EMI.',
        provenance: {
          source: 'math_engine',
          timestamp: new Date().toISOString(),
          confidence: 0,
          metadata: { error: String(error) },
        },
      };
    }
  }
}

export const emiCalculatorTool = new EmiCalculatorTool();
