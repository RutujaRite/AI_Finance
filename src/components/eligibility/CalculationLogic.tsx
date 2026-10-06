'use client';

import React, { useState } from 'react';
import { 
  Calculator, 
  HelpCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  FileCode2, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { EligibilityResult, LoanRow } from '@/lib/eligibility/eligibilityTypes';
import { formatIndianRupees } from '@/lib/eligibility/calculateEligibility';

interface CalculationLogicProps {
  salary: number;
  foirPercent: number;
  roiPercent: number;
  tenureMonths: number;
  multiplier: number;
  loans: LoanRow[];
  result: EligibilityResult;
}

export const CalculationLogic: React.FC<CalculationLogicProps> = ({
  salary,
  foirPercent,
  roiPercent,
  tenureMonths,
  multiplier,
  loans,
  result,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const monthlyRatePercent = Number(((roiPercent / 12)).toFixed(4));

  return (
    <section className="card calculation-logic-card">
      <div 
        className="card-header-bar"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="header-left">
          <div className="icon-wrapper">
            <Calculator size={18} />
          </div>
          <div>
            <div className="title-row">
              <h2 className="card-title">Calculation Logic</h2>
              <span className="badge-pill">Step-by-Step Mathematical Audit</span>
            </div>
            <p className="card-subtitle">
              Live mathematical breakdown demonstrating exact Excel/banking algorithmic alignment
            </p>
          </div>
        </div>

        <div className="header-right">
          <span className="toggle-hint">{isExpanded ? 'Collapse' : 'Expand'}</span>
          <div className="toggle-btn" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="card-body">
          <div className="steps-grid">
            {/* Step 1: FOIR EMI */}
            <div className="step-card">
              <div className="step-badge">Step 1 • FOIR EMI</div>
              <div className="step-formula">
                <code>FOIR EMI = Salary × FOIR %</code>
              </div>
              <div className="step-live-calc font-mono">
                {formatIndianRupees(salary)} × {foirPercent}% = <strong className="text-blue-700">{formatIndianRupees(result.foirAllowedEmi)}</strong>
              </div>
              <p className="step-expl">
                Maximum gross monthly installment allowable under bank underwriting guidelines.
              </p>
            </div>

            {/* Step 2: Final EMI */}
            <div className="step-card">
              <div className="step-badge">Step 2 • Final EMI</div>
              <div className="step-formula">
                <code>Final EMI = FOIR EMI − Obligations</code>
              </div>
              <div className="step-live-calc font-mono">
                {formatIndianRupees(result.foirAllowedEmi)} − {formatIndianRupees(result.existingObligations)} = <strong className="text-emerald-700">{formatIndianRupees(result.finalEligibleEmi)}</strong>
              </div>
              <p className="step-expl">
                Monthly repayment capacity remaining after deducting active ongoing debts (BT=&quot;No&quot;).
              </p>
            </div>

            {/* Step 3: FOIR Loan Eligibility */}
            <div className="step-card highlight-step">
              <div className="step-badge badge-green">Step 3 • FOIR Loan (Present Value)</div>
              <div className="step-formula">
                <code>PV = EMI × [ (1 − (1 + r)⁻ⁿ) ÷ r ]</code>
              </div>
              <div className="step-live-calc font-mono">
                PV(r = {roiPercent}%/12, n = {tenureMonths}m, PMT = -{formatIndianRupees(result.finalEligibleEmi)}) = <strong className="text-emerald-800">{formatIndianRupees(result.foirEligibilityExact, true)}</strong>
              </div>
              <p className="step-expl">
                Discounted Present Value of {tenureMonths} future payments discounted at {roiPercent}% p.a. ({monthlyRatePercent}% monthly).
              </p>
            </div>

            {/* Step 4: Considered Salary */}
            <div className="step-card">
              <div className="step-badge">Step 4 • Considered Salary</div>
              <div className="step-formula">
                <code>Considered Salary = Salary − Obligations</code>
              </div>
              <div className="step-live-calc font-mono">
                {formatIndianRupees(salary)} − {formatIndianRupees(result.existingObligations)} = <strong className="text-indigo-700">{formatIndianRupees(result.consideredSalary)}</strong>
              </div>
              <p className="step-expl">
                Adjusted net take-home salary available for multiplying loan sanction limits.
              </p>
            </div>

            {/* Step 5: Multiplier Loan */}
            <div className="step-card highlight-step-blue">
              <div className="step-badge badge-blue">Step 5 • Multiplier Loan</div>
              <div className="step-formula">
                <code>Multiplier Loan = Considered Salary × Multiplier</code>
              </div>
              <div className="step-live-calc font-mono">
                {formatIndianRupees(result.consideredSalary)} × {multiplier}x = <strong className="text-blue-800">{formatIndianRupees(result.multiplierEligibility)}</strong>
              </div>
              <p className="step-expl">
                Institutional unsecured loan benchmark capping borrowing to {multiplier}x of Considered Pay.
              </p>
            </div>
          </div>

          {/* POS & Portfolio Legend Strip */}
          <div className="pos-audit-strip">
            <div className="pos-item">
              <span className="pos-dot bg-blue" />
              <span>
                <strong>Ongoing Obligations:</strong> {formatIndianRupees(result.existingObligations)}/mo (Sum of EMIs where BT = &quot;No&quot;)
              </span>
            </div>
            <div className="pos-item">
              <span className="pos-dot bg-green" />
              <span>
                <strong>Balance Transfer POS:</strong> {formatIndianRupees(result.balanceTransferPOS)} (Sum of Outstanding where BT = &quot;Yes&quot; to take over)
              </span>
            </div>
            <div className="pos-item">
              <span className="pos-dot bg-amber" />
              <span>
                <strong>Self Closure POS:</strong> {formatIndianRupees(result.selfClosurePOS)} (Sum of Outstanding where BT = &quot;Self Closure&quot;)
              </span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .calculation-logic-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .card-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          background: #ffffff;
          cursor: pointer;
          user-select: none;
          transition: background-color 0.15s ease;
        }

        .card-header-bar:hover {
          background-color: #f8fafc;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon-wrapper {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .card-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .badge-pill {
          font-size: 0.7rem;
          font-weight: 700;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .card-subtitle {
          font-size: 0.78rem;
          color: #64748b;
          margin-top: 2px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toggle-hint {
          font-size: 0.75rem;
          color: #94a3b8;
          font-weight: 500;
        }

        .toggle-btn {
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-body {
          padding: 18px 20px 20px 20px;
          border-top: 1px solid #f1f5f9;
          background: #fafcff;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .step-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .highlight-step {
          background: #f0fdf4;
          border-color: #86efac;
        }

        .highlight-step-blue {
          background: #eff6ff;
          border-color: #93c5fd;
        }

        .step-badge {
          font-size: 0.72rem;
          font-weight: 700;
          color: #475569;
          letter-spacing: 0.02em;
        }

        .badge-green { color: #047857; }
        .badge-blue { color: #1d4ed8; }

        .step-formula {
          font-size: 0.74rem;
        }

        .step-formula code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          color: #0f172a;
          font-family: monospace;
          font-weight: 600;
          display: inline-block;
        }

        .step-live-calc {
          font-size: 0.8rem;
          color: #334155;
          padding: 4px 0;
          word-break: break-all;
        }

        .step-expl {
          font-size: 0.7rem;
          color: #64748b;
          line-height: 1.35;
        }

        .pos-audit-strip {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 0.76rem;
          color: #334155;
        }

        .pos-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pos-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .bg-blue { background: #3b82f6; }
        .bg-green { background: #10b981; }
        .bg-amber { background: #f59e0b; }

        .font-mono { font-family: monospace; }
        .text-blue-700 { color: #1d4ed8; }
        .text-blue-800 { color: #1e40af; }
        .text-emerald-700 { color: #047857; }
        .text-emerald-800 { color: #065f46; }
        .text-indigo-700 { color: #4338ca; }
      `}</style>
    </section>
  );
};
