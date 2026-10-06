'use client';

import React, { useState } from 'react';
import { 
  Calculator, 
  HelpCircle, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  TrendingUp,
  Percent
} from 'lucide-react';
import { EligibilityResult, LoanRow } from '@/lib/eligibility/eligibilityTypes';

interface CalculationBreakdownProps {
  salary: number;
  foirPercent: number;
  roiPercent: number;
  tenureMonths: number;
  multiplier: number;
  loans: LoanRow[];
  result: EligibilityResult;
}

export const CalculationBreakdown: React.FC<CalculationBreakdownProps> = ({
  salary,
  foirPercent,
  roiPercent,
  tenureMonths,
  multiplier,
  loans,
  result,
}) => {
  const [expanded, setExpanded] = useState(true);

  const formatRupees = (num: number) => {
    return '₹' + (Number(num) || 0).toLocaleString('en-IN');
  };

  // Compare scenario: What if applicant did NO balance transfers?
  const totalRawEmi = loans.reduce((acc, r) => acc + (Number(r.emi) || 0), 0);
  const rawFinalEmi = result.foirAllowedEmi - totalRawEmi;
  const rawMonthlyRate = (roiPercent / 100) / 12;
  let noBtFoirEligibility = 0;
  if (rawFinalEmi > 0 && tenureMonths > 0) {
    noBtFoirEligibility = Math.round(
      rawFinalEmi * ((1 - Math.pow(1 + rawMonthlyRate, -tenureMonths)) / rawMonthlyRate)
    );
  }

  const btBenefitAmount = Math.max(0, result.foirEligibility - noBtFoirEligibility);

  return (
    <div className="card breakdown-card">
      <div className="card-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <div className="card-header-left">
          <div className="card-icon-wrapper bg-indigo-subtle text-indigo-600">
            <Calculator size={20} />
          </div>
          <div>
            <h3 className="card-title">Mathematical Calculation Audit & Step-by-Step Breakdown</h3>
            <p className="card-subtitle">
              Transparent, audit-ready banking formulas matching Excel reference logic
            </p>
          </div>
        </div>

        <div className="card-header-right">
          <span className="badge-pill badge-neutral">Formula Transparency</span>
          <button type="button" className="collapse-toggle-btn" aria-label="Toggle Breakdown">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="card-body">
          {/* Balance Transfer Optimization Highlight */}
          {result.balanceTransferPOS > 0 && btBenefitAmount > 0 && (
            <div className="optimization-banner">
              <div className="opt-icon-box">
                <Sparkles size={20} className="text-emerald-600" />
              </div>
              <div className="opt-content">
                <h5 className="opt-title">Balance Transfer Optimization Impact</h5>
                <p className="opt-text">
                  By marking eligible loans for <strong>Balance Transfer Takeover</strong>, you removed their monthly EMIs from active obligations.
                  This unlocked an additional <strong>{formatRupees(btBenefitAmount)}</strong> in borrowing capacity!
                </p>
              </div>
              <div className="opt-badge">
                +{formatRupees(btBenefitAmount)}
              </div>
            </div>
          )}

          {/* Step by Step Formula Walkthrough */}
          <div className="steps-container">
            {/* Step 1 */}
            <div className="step-card">
              <div className="step-number-col">
                <span className="step-num">1</span>
              </div>
              <div className="step-content-col">
                <div className="step-title-row">
                  <h5 className="step-title">FOIR Permissible Debt Capacity</h5>
                  <span className="step-result-val text-teal-700">{formatRupees(result.foirAllowedEmi)}/mo</span>
                </div>
                <p className="step-desc">
                  Banks allow a maximum of <strong>{foirPercent}%</strong> of your net monthly salary for all ongoing EMI commitments.
                </p>
                <div className="formula-box font-mono">
                  <span className="formula-label">Formula:</span> Salary ({formatRupees(salary)}) × FOIR ({foirPercent}%) = <strong>{formatRupees(result.foirAllowedEmi)}</strong>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="step-card">
              <div className="step-number-col">
                <span className="step-num">2</span>
              </div>
              <div className="step-content-col">
                <div className="step-title-row">
                  <h5 className="step-title">Existing Debt Obligations Assessment</h5>
                  <span className="step-result-val text-amber-700">{formatRupees(result.existingObligations)}/mo</span>
                </div>
                <p className="step-desc">
                  Only loans marked with <strong>Balance Transfer = &quot;No&quot;</strong> will continue after disbursement and count as obligations.
                </p>
                <div className="formula-box font-mono">
                  <span className="formula-label">Formula:</span> SUMIF(BT = &quot;No&quot;, EMI) = <strong>{formatRupees(result.existingObligations)}</strong>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="step-card">
              <div className="step-number-col">
                <span className="step-num">3</span>
              </div>
              <div className="step-content-col">
                <div className="step-title-row">
                  <h5 className="step-title">Net Available EMI for New Loan</h5>
                  <span className={`step-result-val ${result.finalEligibleEmi > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatRupees(result.finalEligibleEmi)}/mo
                  </span>
                </div>
                <p className="step-desc">
                  Remaining monthly repayment bandwidth after servicing ongoing debt obligations.
                </p>
                <div className="formula-box font-mono">
                  <span className="formula-label">Formula:</span> FOIR Allowed ({formatRupees(result.foirAllowedEmi)}) - Obligations ({formatRupees(result.existingObligations)}) = <strong>{formatRupees(result.finalEligibleEmi)}</strong>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="step-card">
              <div className="step-number-col">
                <span className="step-num">4</span>
              </div>
              <div className="step-content-col">
                <div className="step-title-row">
                  <h5 className="step-title">FOIR Eligibility Present Value (PV)</h5>
                  <span className="step-result-val text-emerald-700 font-bold">{formatRupees(result.foirEligibility)}</span>
                </div>
                <p className="step-desc">
                  Financial Present Value of {tenureMonths} monthly payments of {formatRupees(result.finalEligibleEmi)} at {roiPercent}% p.a.
                </p>
                <div className="formula-box font-mono">
                  <span className="formula-label">Formula:</span> PV(rate = {roiPercent}%/12, nper = {tenureMonths}, pmt = -{formatRupees(result.finalEligibleEmi)}) = <strong>{formatRupees(result.foirEligibility)}</strong>
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="step-card">
              <div className="step-number-col">
                <span className="step-num">5</span>
              </div>
              <div className="step-content-col">
                <div className="step-title-row">
                  <h5 className="step-title">Salary Multiplier Eligibility</h5>
                  <span className="step-result-val text-blue-700 font-bold">{formatRupees(result.multiplierEligibility)}</span>
                </div>
                <p className="step-desc">
                  Benchmark unsecured cap based on Considered Salary (Gross Take-Home minus Obligations).
                </p>
                <div className="formula-box font-mono">
                  <span className="formula-label">Formula:</span> Considered Salary ({formatRupees(result.consideredSalary)}) × Multiplier ({multiplier}x) = <strong>{formatRupees(result.multiplierEligibility)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .breakdown-card {
          background: var(--bg-surface, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: var(--radius-lg, 16px);
          box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.05));
          overflow: hidden;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          user-select: none;
        }

        .card-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .card-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .card-icon-wrapper {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eef2ff;
          color: #4f46e5;
        }

        :global([data-theme='dark']) .card-icon-wrapper {
          background: rgba(79, 70, 229, 0.18);
          color: #818cf8;
        }

        .card-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
          margin-bottom: 2px;
        }

        .card-subtitle {
          font-size: 0.82rem;
          color: var(--text-muted, #64748b);
        }

        .collapse-toggle-btn {
          color: var(--text-muted, #64748b);
          padding: 4px;
          display: flex;
          align-items: center;
        }

        .badge-pill {
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .badge-neutral {
          background: var(--bg-subtle, #f1f5f9);
          color: var(--text-secondary, #475569);
          border: 1px solid var(--border-color, #cbd5e1);
        }

        .card-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .optimization-banner {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
          border: 1.5px solid #a7f3d0;
          border-radius: 12px;
        }

        :global([data-theme='dark']) .optimization-banner {
          background: linear-gradient(135deg, #062b1a 0%, #064e3b 100%);
          border-color: #059669;
        }

        .opt-icon-box {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .opt-content {
          flex: 1;
        }

        .opt-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: #065f46;
          margin-bottom: 2px;
        }

        :global([data-theme='dark']) .opt-title {
          color: #6ee7b7;
        }

        .opt-text {
          font-size: 0.8rem;
          color: #047857;
          line-height: 1.45;
        }

        :global([data-theme='dark']) .opt-text {
          color: #a7f3d0;
        }

        .opt-badge {
          font-size: 1.1rem;
          font-weight: 800;
          color: #059669;
          font-family: var(--font-mono, monospace);
          background: #ffffff;
          padding: 6px 14px;
          border-radius: 9999px;
          border: 1px solid #a7f3d0;
          white-space: nowrap;
        }

        :global([data-theme='dark']) .opt-badge {
          background: #064e3b;
          color: #34d399;
          border-color: #047857;
        }

        .steps-container {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .step-card {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: var(--bg-subtle, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 12px;
        }

        :global([data-theme='dark']) .step-card {
          background: #141c2e;
        }

        .step-number-col {
          display: flex;
          align-items: flex-start;
        }

        .step-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #2563eb;
          color: #ffffff;
          font-weight: 800;
          font-size: 0.82rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .step-content-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .step-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .step-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
        }

        .step-result-val {
          font-size: 1rem;
          font-weight: 700;
          font-family: var(--font-mono, monospace);
        }

        .step-desc {
          font-size: 0.8rem;
          color: var(--text-muted, #64748b);
          line-height: 1.4;
        }

        .formula-box {
          background: var(--bg-surface, #ffffff);
          border: 1px solid var(--border-color, #cbd5e1);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 0.78rem;
          color: var(--text-secondary, #475569);
          margin-top: 4px;
        }

        :global([data-theme='dark']) .formula-box {
          background: #0f172a;
          color: #cbd5e1;
        }

        .formula-label {
          color: var(--text-muted, #64748b);
          font-weight: 600;
          margin-right: 6px;
        }
      `}</style>
    </div>
  );
};
