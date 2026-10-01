'use client';

import React, { useState } from 'react';
import { X, Calculator, IndianRupee, PieChart, Download, FileSpreadsheet } from 'lucide-react';

interface EMICalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EMICalculatorModal: React.FC<EMICalculatorModalProps> = ({ isOpen, onClose }) => {
  const [loanAmount, setLoanAmount] = useState<number>(500000);
  const [interestRate, setInterestRate] = useState<number>(8.5);
  const [tenureYears, setTenureYears] = useState<number>(5);

  if (!isOpen) return null;

  const totalMonths = tenureYears * 12;
  const monthlyRate = interestRate / (12 * 100);

  // EMI = [P x R x (1+R)^N]/[(1+R)^N-1]
  const emi = Math.round(
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
    (Math.pow(1 + monthlyRate, totalMonths) - 1)
  );

  const totalPayment = emi * totalMonths;
  const totalInterest = totalPayment - loanAmount;

  const principalPercent = Math.round((loanAmount / totalPayment) * 100);
  const interestPercent = 100 - principalPercent;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-calc-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="calc-header">
          <div className="calc-title-box">
            <div className="calc-icon-badge">
              <Calculator size={20} />
            </div>
            <div>
              <h2 className="calc-title">Interactive EMI Calculator</h2>
              <p className="calc-sub">Calculate precise monthly installments, interest overhead, & amortization</p>
            </div>
          </div>
          <button onClick={onClose} className="calc-close-btn" type="button">
            <X size={18} />
          </button>
        </div>

        {/* Body Grid */}
        <div className="calc-body-grid">
          {/* Left Column: Sliders & Controls */}
          <div className="calc-controls-col">
            {/* 1. Loan Amount */}
            <div className="control-card">
              <div className="control-header">
                <span className="control-label">Loan Amount</span>
                <div className="control-val-display">
                  <span>₹</span>
                  <input 
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(Number(e.target.value))}
                    className="control-number-input"
                  />
                </div>
              </div>
              <input 
                type="range"
                min={100000}
                max={20000000}
                step={50000}
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="calc-range"
              />
              <div className="range-range-labels">
                <span>₹1 Lakh</span>
                <span>₹2 Crore</span>
              </div>
            </div>

            {/* 2. Interest Rate */}
            <div className="control-card">
              <div className="control-header">
                <span className="control-label">Interest Rate (p.a.)</span>
                <div className="control-val-display">
                  <input 
                    type="number"
                    step="0.05"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="control-number-input"
                  />
                  <span>%</span>
                </div>
              </div>
              <input 
                type="range"
                min={6.5}
                max={18.0}
                step={0.1}
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="calc-range"
              />
              <div className="range-range-labels">
                <span>6.5%</span>
                <span>18.0%</span>
              </div>
            </div>

            {/* 3. Loan Tenure */}
            <div className="control-card">
              <div className="control-header">
                <span className="control-label">Loan Tenure</span>
                <div className="control-val-display">
                  <input 
                    type="number"
                    value={tenureYears}
                    onChange={(e) => setTenureYears(Number(e.target.value))}
                    className="control-number-input"
                  />
                  <span>Years ({totalMonths} Mos)</span>
                </div>
              </div>
              <input 
                type="range"
                min={1}
                max={30}
                step={1}
                value={tenureYears}
                onChange={(e) => setTenureYears(Number(e.target.value))}
                className="calc-range"
              />
              <div className="range-range-labels">
                <span>1 Year</span>
                <span>30 Years</span>
              </div>
            </div>
          </div>

          {/* Right Column: Breakdown & Summary */}
          <div className="calc-summary-col">
            <div className="emi-highlight-box">
              <span className="highlight-tag">Monthly Installment (EMI)</span>
              <div className="highlight-amount">
                ₹{emi.toLocaleString('en-IN')}
                <span className="highlight-period">/ month</span>
              </div>
            </div>

            <div className="stats-breakdown-list">
              <div className="summary-row">
                <span className="sum-label">Principal Amount</span>
                <span className="sum-val">₹{loanAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="summary-row">
                <span className="sum-label">Total Interest Payable</span>
                <span className="sum-val text-amber">₹{totalInterest.toLocaleString('en-IN')}</span>
              </div>
              <div className="summary-row total-highlight">
                <span className="sum-label">Total Amount Payable</span>
                <span className="sum-val">₹{totalPayment.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Visual Proportion Bar */}
            <div className="proportion-section">
              <div className="proportion-bar">
                <div 
                  className="bar-principal" 
                  style={{ width: `${principalPercent}%` }} 
                  title={`Principal: ${principalPercent}%`}
                />
                <div 
                  className="bar-interest" 
                  style={{ width: `${interestPercent}%` }} 
                  title={`Interest: ${interestPercent}%`}
                />
              </div>
              <div className="proportion-legend">
                <div className="legend-item">
                  <span className="legend-dot dot-principal" />
                  <span>Principal ({principalPercent}%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot dot-interest" />
                  <span>Interest ({interestPercent}%)</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="calc-actions">
              <button 
                onClick={() => alert(`Amortization table generated for ₹${loanAmount.toLocaleString('en-IN')} loan at ${interestRate}% for ${tenureYears} years.`)}
                className="btn-download-schedule"
                type="button"
              >
                <FileSpreadsheet size={15} />
                <span>Export Schedule (Excel)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-calc-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 820px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .calc-header {
          padding: 1.25rem 1.75rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .calc-title-box {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .calc-icon-badge {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          background: #dcfce7;
          color: #16a34a;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        [data-theme='dark'] .calc-icon-badge {
          background: rgba(22, 163, 74, 0.2);
          color: #86efac;
        }

        .calc-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .calc-sub {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .calc-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .calc-body-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          padding: 1.75rem;
          gap: 2rem;
        }

        .calc-controls-col {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .control-card {
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 1rem;
        }

        .control-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .control-label {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .control-val-display {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 0.2rem 0.6rem;
          font-weight: 700;
          color: var(--primary-600);
          font-size: 0.9rem;
        }

        .control-number-input {
          border: none;
          background: transparent;
          font-weight: 700;
          font-size: 0.95rem;
          color: inherit;
          width: 90px;
          text-align: right;
          outline: none;
        }

        .calc-range {
          width: 100%;
          accent-color: var(--primary-500);
          cursor: pointer;
        }

        .range-range-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 0.35rem;
        }

        /* Summary Column */
        .calc-summary-col {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .emi-highlight-box {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          color: #ffffff;
          padding: 1.5rem;
          border-radius: var(--radius-lg);
          box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.35);
          text-align: center;
        }

        .highlight-tag {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.85;
          font-weight: 600;
        }

        .highlight-amount {
          font-size: 2.1rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-top: 0.25rem;
        }

        .highlight-period {
          font-size: 0.9rem;
          font-weight: 500;
          opacity: 0.85;
        }

        .stats-breakdown-list {
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }

        .sum-label {
          color: var(--text-secondary);
        }

        .sum-val {
          font-weight: 700;
          color: var(--text-primary);
        }

        .text-amber {
          color: #d97706;
        }

        .total-highlight {
          padding-top: 0.5rem;
          border-top: 1px dashed var(--border-color);
          font-size: 0.95rem;
        }

        .proportion-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .proportion-bar {
          height: 10px;
          border-radius: var(--radius-full);
          background: var(--bg-hover);
          display: flex;
          overflow: hidden;
        }

        .bar-principal {
          background: #2563eb;
          height: 100%;
        }

        .bar-interest {
          background: #f59e0b;
          height: 100%;
        }

        .proportion-legend {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .dot-principal { background: #2563eb; }
        .dot-interest { background: #f59e0b; }

        .btn-download-schedule {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.65rem;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          transition: all 0.2s ease;
        }

        .btn-download-schedule:hover {
          border-color: var(--primary-500);
          color: var(--primary-600);
          background: var(--primary-50);
        }

        @media (max-width: 768px) {
          .calc-body-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
