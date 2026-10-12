'use client';

import React, { useState } from 'react';
import { 
  Calculator, 
  IndianRupee, 
  ArrowRight, 
  Percent, 
  Calendar, 
  Sparkles, 
  CheckCircle2,
  ExternalLink,
  Layers
} from 'lucide-react';
import { 
  calculateQuickEmi, 
  calculateQuickLoanFromEmi, 
  formatIndianRupees 
} from '@/lib/eligibility/calculateEligibility';

interface QuickCalculatorsProps {
  onOpenFullCalculator: () => void;
  defaultRoi?: number;
  defaultTenure?: number;
}

export const QuickCalculators: React.FC<QuickCalculatorsProps> = ({
  onOpenFullCalculator,
  defaultRoi = 9.99,
  defaultTenure = 60,
}) => {
  // Calculator A: Quick EMI State
  const [emiPrincipal, setEmiPrincipal] = useState<number>(1000000);
  const [emiRate, setEmiRate] = useState<number>(defaultRoi);
  const [emiMonths, setEmiMonths] = useState<number>(defaultTenure);
  const [calculatedEmi, setCalculatedEmi] = useState<number | null>(null);

  // Calculator B: Quick Amount from EMI State
  const [loanEmi, setLoanEmi] = useState<number>(21241);
  const [loanRate, setLoanRate] = useState<number>(defaultRoi);
  const [loanMonths, setLoanMonths] = useState<number>(defaultTenure);
  const [calculatedLoanAmount, setCalculatedLoanAmount] = useState<number | null>(null);

  // Handle A: Get Monthly EMI
  const handleGetEmi = () => {
    const res = calculateQuickEmi(emiPrincipal, emiRate, emiMonths);
    setCalculatedEmi(res);
  };

  // Handle B: Get Loan Amount
  const handleGetLoanAmount = () => {
    const res = calculateQuickLoanFromEmi(loanEmi, loanRate, loanMonths);
    setCalculatedLoanAmount(res);
  };

  return (
    <section className="quick-calculators-section">
      <div className="section-head">
        <div className="icon-wrapper">
          <Calculator size={18} />
        </div>
        <div>
          <h2 className="section-title">Quick Calculators</h2>
          <p className="section-subtitle">
            Fast financial tools for estimating monthly installments and reverse borrowing limits
          </p>
        </div>
      </div>

      <div className="cards-grid">
        {/* Card A: Quick EMI Calculator */}
        <div className="calc-card">
          <div className="card-top">
            <span className="card-badge">Calculator A</span>
            <h3 className="card-heading">Quick EMI Calculator</h3>
            <p className="card-desc">Calculate estimated monthly payment from principal loan amount</p>
          </div>

          <div className="card-inputs">
            {/* Input 1: Loan Amount */}
            <div className="input-group">
              <label htmlFor="quick-emi-amount" className="input-label">Loan Amount (₹)</label>
              <div className="input-wrapper">
                <span className="prefix-sym">₹</span>
                <input
                  id="quick-emi-amount"
                  type="number"
                  min="0"
                  step="10000"
                  className="styled-input font-mono"
                  placeholder="e.g. 1000000"
                  value={emiPrincipal === 0 ? '' : emiPrincipal}
                  onChange={(e) => setEmiPrincipal(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="inputs-split">
              {/* Input 2: Rate % */}
              <div className="input-group">
                <label htmlFor="quick-emi-rate" className="input-label">Rate % (p.a.)</label>
                <div className="input-wrapper">
                  <input
                    id="quick-emi-rate"
                    type="number"
                    min="1"
                    max="40"
                    step="0.05"
                    className="styled-input font-mono"
                    value={emiRate === 0 ? '' : emiRate}
                    onChange={(e) => setEmiRate(Number(e.target.value) || 0)}
                  />
                  <span className="suffix-sym">%</span>
                </div>
              </div>

              {/* Input 3: Months */}
              <div className="input-group">
                <label htmlFor="quick-emi-months" className="input-label">Months</label>
                <div className="input-wrapper">
                  <input
                    id="quick-emi-months"
                    type="number"
                    min="1"
                    max="360"
                    step="6"
                    className="styled-input font-mono"
                    value={emiMonths === 0 ? '' : emiMonths}
                    onChange={(e) => setEmiMonths(Number(e.target.value) || 0)}
                  />
                  <span className="suffix-sym">mo</span>
                </div>
              </div>
            </div>

            {/* Button: Get Monthly EMI (Green Button) */}
            <button
              type="button"
              className="calc-btn btn-green"
              onClick={handleGetEmi}
            >
              <span>Get Monthly EMI</span>
              <ArrowRight size={15} />
            </button>

            {/* Output Display */}
            <div className="calc-result-box">
              <span className="result-lbl">Estimated Monthly EMI</span>
              <div className="result-val font-mono text-emerald-700">
                {calculatedEmi !== null ? formatIndianRupees(calculatedEmi) : formatIndianRupees(calculateQuickEmi(emiPrincipal, emiRate, emiMonths))}
                <span className="per-month-text"> / month</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card B: Quick Amount Calculator from EMI */}
        <div className="calc-card">
          <div className="card-top">
            <span className="card-badge">Calculator B</span>
            <h3 className="card-heading">Quick Amount Calculator from EMI</h3>
            <p className="card-desc">Determine eligible loan limit based on affordable monthly EMI</p>
          </div>

          <div className="card-inputs">
            {/* Input 1: EMI */}
            <div className="input-group">
              <label htmlFor="quick-loan-emi" className="input-label">Affordable Monthly EMI (₹)</label>
              <div className="input-wrapper">
                <span className="prefix-sym">₹</span>
                <input
                  id="quick-loan-emi"
                  type="number"
                  min="0"
                  step="500"
                  className="styled-input font-mono"
                  placeholder="e.g. 21241"
                  value={loanEmi === 0 ? '' : loanEmi}
                  onChange={(e) => setLoanEmi(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="inputs-split">
              {/* Input 2: Rate % */}
              <div className="input-group">
                <label htmlFor="quick-loan-rate" className="input-label">Rate % (p.a.)</label>
                <div className="input-wrapper">
                  <input
                    id="quick-loan-rate"
                    type="number"
                    min="1"
                    max="40"
                    step="0.05"
                    className="styled-input font-mono"
                    value={loanRate === 0 ? '' : loanRate}
                    onChange={(e) => setLoanRate(Number(e.target.value) || 0)}
                  />
                  <span className="suffix-sym">%</span>
                </div>
              </div>

              {/* Input 3: Months */}
              <div className="input-group">
                <label htmlFor="quick-loan-months" className="input-label">Months</label>
                <div className="input-wrapper">
                  <input
                    id="quick-loan-months"
                    type="number"
                    min="1"
                    max="360"
                    step="6"
                    className="styled-input font-mono"
                    value={loanMonths === 0 ? '' : loanMonths}
                    onChange={(e) => setLoanMonths(Number(e.target.value) || 0)}
                  />
                  <span className="suffix-sym">mo</span>
                </div>
              </div>
            </div>

            {/* Button: Get Loan Amount (Green Button) */}
            <button
              type="button"
              className="calc-btn btn-green"
              onClick={handleGetLoanAmount}
            >
              <span>Get Loan Amount</span>
              <ArrowRight size={15} />
            </button>

            {/* Output Display */}
            <div className="calc-result-box">
              <span className="result-lbl">Eligible Loan</span>
              <div className="result-val font-mono text-blue-700">
                {calculatedLoanAmount !== null ? formatIndianRupees(calculatedLoanAmount) : formatIndianRupees(calculateQuickLoanFromEmi(loanEmi, loanRate, loanMonths))}
              </div>
            </div>
          </div>
        </div>

        {/* Card C: External Access */}
        <div className="calc-card external-card">
          <div className="card-top">
            <span className="card-badge bg-blue-100 text-blue-800">Advanced Analytics</span>
            <h3 className="card-heading">Full Amortization Suite</h3>
            <p className="card-desc">
              Access complete year-by-year amortization schedules, principal vs interest graphs, and early prepayment simulation models.
            </p>
          </div>

          <div className="external-content">
            <div className="feature-bullets">
              <div className="feature-line">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>Month-by-month principal & interest breakdown</span>
              </div>
              <div className="feature-line">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>Prepayment savings & tenure reduction analyzer</span>
              </div>
              <div className="feature-line">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>Instant printable PDF statement generation</span>
              </div>
            </div>

            <div className="external-btn-wrap">
              <button
                type="button"
                className="calc-btn btn-blue"
                onClick={onOpenFullCalculator}
              >
                <Layers size={16} />
                <span>Open Full EMI Calculator</span>
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .quick-calculators-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .section-head {
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

        .section-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .section-subtitle {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 2px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        @media (max-width: 1024px) {
          .cards-grid {
            grid-template-columns: 1fr;
          }
        }

        .calc-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          gap: 16px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .calc-card:hover {
          box-shadow: 0 4px 10px -2px rgba(15, 23, 42, 0.07);
        }

        .external-card {
          background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
          border-color: #bfdbfe;
        }

        .card-top {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .card-badge {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          background: #f1f5f9;
          color: #475569;
          padding: 2px 8px;
          border-radius: 9999px;
          width: fit-content;
          letter-spacing: 0.03em;
        }

        .card-heading {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
          margin-top: 4px;
        }

        .card-desc {
          font-size: 0.78rem;
          color: #64748b;
          line-height: 1.35;
        }

        .card-inputs {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .input-label {
          font-size: 0.76rem;
          font-weight: 600;
          color: #334155;
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          padding: 0 10px;
          overflow: hidden;
          transition: border-color 0.15s ease;
        }

        .input-wrapper:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
        }

        .prefix-sym, .suffix-sym {
          font-size: 0.78rem;
          color: #64748b;
          font-weight: 600;
        }

        .styled-input {
          border: none;
          outline: none;
          padding: 8px 6px;
          font-size: 0.85rem;
          color: #0f172a;
          width: 100%;
          background: transparent;
        }

        .inputs-split {
          display: flex;
          gap: 10px;
        }

        /* Green button for positive/calculation actions */
        .calc-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px 16px;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.16s ease;
          border: 1px solid transparent;
          margin-top: 4px;
        }

        .btn-green {
          background: #10b981;
          border-color: #059669;
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(16, 185, 129, 0.2);
        }

        .btn-green:hover {
          background: #059669;
          transform: translateY(-1px);
        }

        /* Blue button for primary actions */
        .btn-blue {
          background: #2563eb;
          border-color: #1d4ed8;
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
          width: 100%;
        }

        .btn-blue:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
        }

        .calc-result-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 4px;
        }

        .result-lbl {
          font-size: 0.7rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .result-val {
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .per-month-text {
          font-size: 0.72rem;
          font-weight: 500;
          color: #64748b;
        }

        .external-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
          justify-content: space-between;
          height: 100%;
        }

        .feature-bullets {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 4px;
        }

        .feature-line {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.78rem;
          color: #334155;
        }

        .external-btn-wrap {
          margin-top: auto;
        }

        .font-mono { font-family: monospace; }
        .text-emerald-700 { color: #047857; }
        .text-blue-700 { color: #1d4ed8; }
        .bg-blue-100 { background: #dbeafe; }
        .text-blue-800 { color: #1e40af; }
      `}</style>
    </section>
  );
};
