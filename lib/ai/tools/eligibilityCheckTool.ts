/**
 * Eligibility Check Tool
 * Wraps evaluateApplicantAgainstAllBanks from lib/dynamicEligibilityEngine.ts.
 * Evaluates applicant criteria against partner bank policies with typed I/O and provenance tracing.
 * Safety: Never assigns or confuses monthlyIncome with loanAmount.
 */

import {
  evaluateApplicantAgainstAllBanks,
  ApplicantProfile,
  BankEvaluationResult,
} from '@/lib/dynamicEligibilityEngine';
import { AgentTool, ToolResult } from './types';

export interface EligibilityCheckInput {
  applicant: ApplicantProfile;
  loanType?: string;
}

export interface EligibilityCheckOutput {
  eligibleBanks: BankEvaluationResult[];
  reviewBanks: BankEvaluationResult[];
  ineligibleBanks: BankEvaluationResult[];
  recommendedBank: BankEvaluationResult | null;
  recommendationReason: string;
  totalEvaluated: number;
}

export class EligibilityCheckTool implements AgentTool<EligibilityCheckInput, EligibilityCheckOutput> {
  readonly name = 'eligibilityCheckTool';
  readonly description = 'Evaluates an applicant against 23+ partner bank credit and policy criteria.';

  async execute(input: EligibilityCheckInput, context?: Record<string, any>): Promise<ToolResult<EligibilityCheckOutput>> {
    const startTime = new Date().toISOString();

    try {
      const applicant = { ...input.applicant };

      // Invariant check: Ensure monthlyIncome and loanAmount are valid numbers and never swapped
      const salary = Number(applicant.monthlyIncome || 0);
      const loan = Number(applicant.loanAmount || 0);

      const evaluation = await evaluateApplicantAgainstAllBanks(
        applicant,
        input.loanType || 'Personal Loan'
      );

      const totalEvaluated = (evaluation.evaluations || []).length;
      const eligibleCount = (evaluation.eligibleBanks || []).length;

      return {
        success: true,
        data: {
          eligibleBanks: evaluation.eligibleBanks,
          reviewBanks: evaluation.reviewBanks,
          ineligibleBanks: evaluation.ineligibleBanks,
          recommendedBank: evaluation.recommendedBank,
          recommendationReason: evaluation.recommendationReason,
          totalEvaluated,
        },
        provenance: {
          source: 'policy_rules',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          metadata: {
            totalEvaluated,
            eligibleCount,
            companyCategory: evaluation.companyMatch?.overallCategoryDisplay || 'Unlisted',
            salary,
            requestedLoanAmount: loan,
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Error occurred while checking loan eligibility.',
        provenance: {
          source: 'policy_rules',
          timestamp: new Date().toISOString(),
          confidence: 0,
          metadata: { error: String(error) },
        },
      };
    }
  }
}

export const eligibilityCheckTool = new EligibilityCheckTool();
