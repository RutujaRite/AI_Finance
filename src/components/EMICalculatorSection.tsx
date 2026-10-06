'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  DollarSign, 
  Percent, 
  Calendar, 
  Sparkles, 
  Download, 
  Bookmark, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Info,
  TrendingDown,
  Layers
} from 'lucide-react';
import { User } from '@/types';

interface EMICalculatorSectionProps {
  currentUser: User | null;
  onOpenRegister: () => void;
  onOpenLogin: () => void;
}

export const EMICalculatorSection: React.FC<EMICalculatorSectionProps> = ({
  currentUser,
  onOpenRegister,
  onOpenLogin,
}) => {
  // Currency unit state: USD or INR
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');

  // Input states
  const [loanAmount, setLoanAmount] = useState<number>(100000);
  const [interestRate, setInterestRate] = useState<number>(8.5);
  const [tenureYears, setTenureYears] = useState<number>(15);
  const [tenureType, setTenureType] = useState<'years' | 'months'>('years');
  const [showAmortization, setShowAmortization] = useState(false);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // Currency configuration
  const currSymbol = currency === 'USD' ? '$' : '₹';
  const formatNumber = (num: number) => {
    if (currency === 'INR') {
      return num.toLocaleString('en-IN');
    }
    return num.toLocaleString('en-US');
  };

  // Calculate EMI in real-time
  const { emi, totalInterest, totalPayment, principalPercent, interestPercent, schedule } = useMemo(() => {
    const P = loanAmount;
    const r = interestRate / 12 / 100;
    const n = tenureType === 'years' ? tenureYears * 12 : tenureYears;

    if (P <= 0 || r <= 0 || n <= 0) {
      return {
        emi: 0,
        totalInterest: 0,
        totalPayment: 0,
        principalPercent: 100,
        interestPercent: 0,
        schedule: []
      };
    }

    const calculatedEMI = Math.round(
      (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    );
    const totalAmt = calculatedEMI * n;
    const totInterest = Math.max(0, totalAmt - P);

    const princPct = Math.round((P / totalAmt) * 100) || 50;
    const intPct = 100 - princPct;

    // Generate year-by-year amortization preview (up to 10 years or all)
    const amortization = [];
    let balance = P;
    const yearsCount = Math.ceil(n / 12);

    for (let yr = 1; yr <= Math.min(yearsCount, 15); yr++) {
      let yearlyInterest = 0;
      let yearlyPrincipal = 0;
      const startBalance = balance;

      for (let m = 1; m <= 12; m++) {
        if (balance <= 0) break;
        const interestMonth = balance * r;
        const principalMonth = Math.min(balance, calculatedEMI - interestMonth);
        yearlyInterest += interestMonth;
        yearlyPrincipal += principalMonth;
        balance -= principalMonth;
      }

      amortization.push({
        year: yr,
        startBalance: Math.round(startBalance),
        principalPaid: Math.round(yearlyPrincipal),
        interestPaid: Math.round(yearlyInterest),
        endBalance: Math.max(0, Math.round(balance))
      });
    }

    return {
      emi: calculatedEMI,
      totalInterest: totInterest,
      totalPayment: totalAmt,
      principalPercent: princPct,
      interestPercent: intPct,
      schedule: amortization
    };
  }, [loanAmount, interestRate, tenureYears, tenureType]);

  // AI Savings Tip calculation
  const potentialSavings = useMemo(() => {
    const extraPerMonth = Math.round(emi * 0.1);
    const approxInterestSaved = Math.round(totalInterest * 0.22);
    return { extraPerMonth, approxInterestSaved };
  }, [emi, totalInterest]);

  // Handle Save Quote
  const handleSaveCalculation = () => {
    if (!currentUser) {
      onOpenRegister();
      return;
    }
    setSavedNotification(`Saved quote: ${currSymbol}${formatNumber(loanAmount)} @ ${interestRate}% for ${tenureYears} yrs`);
    setTimeout(() => setSavedNotification(null), 4000);
  };

  return (
    <section id="emi-calculator" className="emi-section">
      <div className="container">
        {/* Section Header */}
        <div className="section-head">
          <div className="section-badge">
            <Calculator size={15} className="text-teal" />
            <span>Interactive Financial Tool</span>
          </div>
          <h2 className="section-title">Smart EMI Calculator</h2>
          <p className="section-subtitle">
            Fine-tune your loan parameters with real-time sliders and discover your exact monthly repayment, total interest, and AI-powered prepayment savings.
          </p>

          {/* Currency Toggle */}
          <div className="currency-selector">
            <button 
              type="button"
              onClick={() => {
                setCurrency('USD');
                if (loanAmount > 1000000) setLoanAmount(100000);
              }}
              className={`currency-pill ${currency === 'USD' ? 'active' : ''}`}
            >
              USD ($)
            </button>
            <button 
              type="button"
              onClick={() => {
                setCurrency('INR');
                if (loanAmount < 500000) setLoanAmount(2500000);
              }}
              className={`currency-pill ${currency === 'INR' ? 'active' : ''}`}
            >
              INR (₹)
            </button>
          </div>
        </div>

        {/* Calculator Main Grid */}
        <div className="calculator-card glass-panel">
          <div className="calc-grid">
            {/* Left Column: Sliders and Direct Inputs */}
            <div className="inputs-column">
              {/* 1. Loan Amount */}
              <div className="slider-input-group">
                <div className="group-header">
                  <label className="input-title">Loan Amount</label>
                  <div className="field-box">
                    <span className="unit-prefix">{currSymbol}</span>
                    <input
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(Math.max(0, Number(e.target.value)))}
                      className="numeric-input"
                    />
                  </div>
                </div>

                <input
                  type="range"
                  min={currency === 'USD' ? 5000 : 100000}
                  max={currency === 'USD' ? 1000000 : 20000000}
                  step={currency === 'USD' ? 1000 : 25000}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="teal-range-slider"
                />

                {/* Quick Presets */}
                <div className="preset-chips">
                  {currency === 'USD' ? (
                    <>
                      <button type="button" onClick={() => setLoanAmount(25000)} className="preset-chip">$25k</button>
                      <button type="button" onClick={() => setLoanAmount(50000)} className="preset-chip">$50k</button>
                      <button type="button" onClick={() => setLoanAmount(100000)} className="preset-chip">$100k</button>
                      <button type="button" onClick={() => setLoanAmount(250000)} className="preset-chip">$250k</button>
                      <button type="button" onClick={() => setLoanAmount(500000)} className="preset-chip">$500k</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setLoanAmount(500000)} className="preset-chip">₹5 Lakh</button>
                      <button type="button" onClick={() => setLoanAmount(1500000)} className="preset-chip">₹15 Lakh</button>
                      <button type="button" onClick={() => setLoanAmount(2500000)} className="preset-chip">₹25 Lakh</button>
                      <button type="button" onClick={() => setLoanAmount(5000000)} className="preset-chip">₹50 Lakh</button>
                      <button type="button" onClick={() => setLoanAmount(10000000)} className="preset-chip">₹1 Crore</button>
                    </>
                  )}
                </div>
              </div>

              {/* 2. Interest Rate */}
              <div className="slider-input-group">
                <div className="group-header">
                  <label className="input-title">Interest Rate (p.a.)</label>
                  <div className="field-box">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="30"
                      value={interestRate}
                      onChange={(e) => setInterestRate(Number(e.target.value))}
                      className="numeric-input"
                    />
                    <span className="unit-suffix">%</span>
                  </div>
                </div>

                <input
                  type="range"
                  min="5"
                  max="20"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="teal-range-slider"
                />

                <div className="range-bounds">
                  <span>5.0% (Premier)</span>
                  <span>12.5% (Standard)</span>
                  <span>20.0% (Max)</span>
                </div>
              </div>

              {/* 3. Tenure */}
              <div className="slider-input-group">
                <div className="group-header">
                  <div className="tenure-label-row">
                    <label className="input-title">Loan Tenure</label>
                    <div className="tenure-toggle-mini">
                      <button 
                        type="button"
                        onClick={() => {
                          if (tenureType === 'months') {
                            setTenureYears(Math.max(1, Math.round(tenureYears / 12)));
                            setTenureType('years');
                          }
                        }}
                        className={`toggle-tab ${tenureType === 'years' ? 'active' : ''}`}
                      >
                        Yr
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          if (tenureType === 'years') {
                            setTenureYears(tenureYears * 12);
                            setTenureType('months');
                          }
                        }}
                        className={`toggle-tab ${tenureType === 'months' ? 'active' : ''}`}
                      >
                        Mo
                      </button>
                    </div>
                  </div>
                  <div className="field-box">
                    <input
                      type="number"
                      min="1"
                      max={tenureType === 'years' ? 30 : 360}
                      value={tenureYears}
                      onChange={(e) => setTenureYears(Number(e.target.value))}
                      className="numeric-input"
                    />
                    <span className="unit-suffix">{tenureType === 'years' ? 'Yrs' : 'Mos'}</span>
                  </div>
                </div>

                <input
                  type="range"
                  min="1"
                  max={tenureType === 'years' ? 30 : 360}
                  step="1"
                  value={tenureYears}
                  onChange={(e) => setTenureYears(Number(e.target.value))}
                  className="teal-range-slider"
                />

                <div className="range-bounds">
                  <span>1 {tenureType}</span>
                  <span>{tenureType === 'years' ? '15 Yrs' : '180 Mos'}</span>
                  <span>{tenureType === 'years' ? '30 Yrs' : '360 Mos'}</span>
                </div>
              </div>

              {/* AI Strategy Box */}
              <div className="ai-tip-card">
                <div className="ai-tip-header">
                  <Sparkles size={16} className="text-teal" />
                  <span>AI Prepayment Optimization</span>
                </div>
                <p className="ai-tip-body">
                  Paying an extra <strong>{currSymbol}{formatNumber(potentialSavings.extraPerMonth)}/month</strong> will save approximately <strong>{currSymbol}{formatNumber(potentialSavings.approxInterestSaved)}</strong> in total interest and settle this loan years earlier!
                </p>
              </div>
            </div>

            {/* Right Column: Visual Breakdown & Output Metrics */}
            <div className="results-column">
              {/* Main EMI Highlight Box */}
              <div className="emi-result-card">
                <span className="emi-result-label">Monthly EMI Payable</span>
                <div className="emi-figure-row">
                  <span className="emi-curr">{currSymbol}</span>
                  <span className="emi-amount">{formatNumber(emi)}</span>
                  <span className="per-month-text">/ month</span>
                </div>

                <div className="metric-pills-row">
                  <div className="summary-pill">
                    <span className="pill-lbl">Principal</span>
                    <span className="pill-val">{currSymbol}{formatNumber(loanAmount)}</span>
                  </div>
                  <div className="summary-pill">
                    <span className="pill-lbl">Total Interest</span>
                    <span className="pill-val teal-color">{currSymbol}{formatNumber(totalInterest)}</span>
                  </div>
                  <div className="summary-pill">
                    <span className="pill-lbl">Total Payable</span>
                    <span className="pill-val">{currSymbol}{formatNumber(totalPayment)}</span>
                  </div>
                </div>
              </div>

              {/* SVG Donut Chart Visual */}
              <div className="chart-wrapper">
                <div className="donut-chart-container">
                  <svg viewBox="0 0 36 36" className="donut-svg">
                    {/* Background Circle */}
                    <path
                      className="donut-bg"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Principal Segment */}
                    <path
                      className="donut-segment-principal"
                      strokeDasharray={`${principalPercent}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Interest Segment */}
                    <path
                      className="donut-segment-interest"
                      strokeDasharray={`${interestPercent}, 100`}
                      strokeDashoffset={`-${principalPercent}`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>

                  <div className="donut-center-label">
                    <span className="donut-center-pct">{principalPercent}%</span>
                    <span className="donut-center-sub">Principal</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="chart-legend">
                  <div className="legend-row">
                    <span className="legend-dot dot-principal" />
                    <span className="legend-label">Principal Amount:</span>
                    <strong className="legend-pct">{principalPercent}%</strong>
                  </div>
                  <div className="legend-row">
                    <span className="legend-dot dot-interest" />
                    <span className="legend-label">Total Interest:</span>
                    <strong className="legend-pct teal-color">{interestPercent}%</strong>
                  </div>
                </div>
              </div>

              {/* Save / Access Action */}
              <div className="results-action-row">
                <button 
                  type="button" 
                  onClick={handleSaveCalculation}
                  className="btn-save-quote"
                >
                  <Bookmark size={16} />
                  <span>{currentUser ? 'Save Calculation to Portfolio' : 'Sign In to Save Quote'}</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setShowAmortization(!showAmortization)}
                  className="btn-view-schedule"
                >
                  <Layers size={16} />
                  <span>{showAmortization ? 'Hide Amortization' : 'Amortization Schedule'}</span>
                  {showAmortization ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {savedNotification && (
                <div className="save-toast animate-fade-in">
                  <CheckCircle2 size={16} className="text-teal" />
                  <span>{savedNotification}</span>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Amortization Schedule */}
          {showAmortization && (
            <div className="amortization-table-wrapper animate-fade-in">
              <div className="schedule-header">
                <h4 className="schedule-title">Annual Repayment Schedule (Amortization)</h4>
                <span className="schedule-note">Detailed breakdown of principal reduction & interest payments</span>
              </div>

              <div className="table-responsive">
                <table className="amortization-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Opening Balance</th>
                      <th>Principal Paid</th>
                      <th>Interest Paid</th>
                      <th>Closing Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((row) => (
                      <tr key={row.year}>
                        <td className="year-cell">Year {row.year}</td>
                        <td>{currSymbol}{formatNumber(row.startBalance)}</td>
                        <td className="principal-cell">+{currSymbol}{formatNumber(row.principalPaid)}</td>
                        <td className="interest-cell">{currSymbol}{formatNumber(row.interestPaid)}</td>
                        <td className="closing-cell">{currSymbol}{formatNumber(row.endBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .emi-section {
          padding: 80px 0;
          background: var(--bg-primary);
        }

        .section-head {
          text-align: center;
          max-width: 680px;
          margin: 0 auto 48px auto;
        }

        .section-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: var(--radius-full);
          background: var(--teal-50);
          color: var(--teal-800);
          font-size: 0.78rem;
          font-weight: 700;
          margin-bottom: 14px;
          border: 1px solid var(--teal-200);
        }

        :global([data-theme='dark']) .section-badge {
          background: rgba(13, 148, 136, 0.15);
          color: var(--teal-300);
          border-color: rgba(13, 148, 136, 0.3);
        }

        .section-title {
          font-size: 2.4rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin-bottom: 12px;
        }

        .section-subtitle {
          font-size: 1.02rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .currency-selector {
          display: inline-flex;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          padding: 4px;
        }

        .currency-pill {
          padding: 6px 16px;
          border-radius: var(--radius-full);
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          transition: all 0.2s ease;
        }

        .currency-pill.active {
          background: var(--teal-600);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3);
        }

        /* Calculator Card */
        .calculator-card {
          border-radius: var(--radius-xl);
          padding: 36px;
          box-shadow: var(--shadow-xl);
        }

        .calc-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 48px;
        }

        /* Inputs Column */
        .inputs-column {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .slider-input-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .input-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .tenure-label-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .tenure-toggle-mini {
          display: inline-flex;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 2px;
        }

        .toggle-tab {
          padding: 2px 8px;
          font-size: 0.72rem;
          font-weight: 700;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
        }

        .toggle-tab.active {
          background: var(--teal-600);
          color: #ffffff;
        }

        .field-box {
          display: flex;
          align-items: center;
          background: var(--bg-subtle);
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 6px 12px;
          transition: border-color 0.2s ease;
        }

        .field-box:focus-within {
          border-color: var(--teal-600);
          background: var(--bg-surface);
        }

        .unit-prefix, .unit-suffix {
          font-weight: 700;
          font-size: 0.92rem;
          color: var(--teal-600);
        }

        .numeric-input {
          border: none;
          background: transparent;
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          width: 110px;
          text-align: right;
          outline: none;
          padding: 0 4px;
        }

        /* Preset Chips */
        .preset-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .preset-chip {
          padding: 5px 12px;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          font-size: 0.76rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .preset-chip:hover {
          border-color: var(--teal-600);
          color: var(--teal-600);
          background: var(--teal-50);
        }

        .range-bounds {
          display: flex;
          justify-content: space-between;
          font-size: 0.74rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* AI Tip Card */
        .ai-tip-card {
          background: linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(30, 58, 138, 0.04) 100%);
          border: 1px solid rgba(13, 148, 136, 0.25);
          border-radius: var(--radius-lg);
          padding: 16px 20px;
          margin-top: 6px;
        }

        .ai-tip-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--teal-700);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }

        :global([data-theme='dark']) .ai-tip-header {
          color: var(--teal-300);
        }

        .ai-tip-body {
          font-size: 0.86rem;
          line-height: 1.5;
          color: var(--text-secondary);
        }

        /* Results Column */
        .results-column {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .emi-result-card {
          background: linear-gradient(135deg, #0a1733 0%, #0f2744 100%);
          color: #ffffff;
          border-radius: var(--radius-lg);
          padding: 26px;
          box-shadow: 0 10px 25px -5px rgba(10, 23, 51, 0.4);
        }

        .emi-result-label {
          font-size: 0.82rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
        }

        .emi-figure-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin: 6px 0 20px 0;
        }

        .emi-curr {
          font-size: 1.6rem;
          font-weight: 800;
          color: #2dd4bf;
        }

        .emi-amount {
          font-size: 2.7rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #ffffff;
        }

        .per-month-text {
          font-size: 0.95rem;
          color: #cbd5e1;
          margin-left: 6px;
        }

        .metric-pills-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }

        .summary-pill {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .pill-lbl {
          font-size: 0.68rem;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .pill-val {
          font-size: 0.92rem;
          font-weight: 700;
          color: #ffffff;
        }

        .teal-color {
          color: #2dd4bf !important;
        }

        /* SVG Donut Chart */
        .chart-wrapper {
          display: flex;
          align-items: center;
          gap: 24px;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 20px 24px;
        }

        .donut-chart-container {
          position: relative;
          width: 110px;
          height: 110px;
          flex-shrink: 0;
        }

        .donut-svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }

        .donut-bg {
          fill: none;
          stroke: #e2e8f0;
          stroke-width: 3.8;
        }

        :global([data-theme='dark']) .donut-bg {
          stroke: #1e293b;
        }

        .donut-segment-principal {
          fill: none;
          stroke: #1e3a8a;
          stroke-width: 3.8;
          transition: stroke-dasharray 0.3s ease;
        }

        :global([data-theme='dark']) .donut-segment-principal {
          stroke: #3b82f6;
        }

        .donut-segment-interest {
          fill: none;
          stroke: #0d9488;
          stroke-width: 3.8;
          transition: stroke-dasharray 0.3s ease, stroke-dashoffset 0.3s ease;
        }

        .donut-center-label {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .donut-center-pct {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .donut-center-sub {
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .chart-legend {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }

        .legend-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .dot-principal {
          background: #1e3a8a;
        }

        :global([data-theme='dark']) .dot-principal {
          background: #3b82f6;
        }

        .dot-interest {
          background: #0d9488;
        }

        .legend-label {
          color: var(--text-secondary);
        }

        .legend-pct {
          margin-left: auto;
          font-weight: 800;
          color: var(--text-primary);
        }

        /* Action Buttons */
        .results-action-row {
          display: flex;
          gap: 12px;
        }

        .btn-save-quote {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 18px;
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          border: 1.5px solid var(--teal-600);
          color: var(--teal-600);
          font-size: 0.88rem;
          font-weight: 700;
          transition: all 0.2s ease;
        }

        .btn-save-quote:hover {
          background: var(--teal-600);
          color: #ffffff;
        }

        .btn-view-schedule {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px 18px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          font-size: 0.88rem;
          font-weight: 600;
        }

        .btn-view-schedule:hover {
          background: var(--bg-hover);
        }

        .save-toast {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--teal-50);
          border: 1px solid var(--teal-200);
          border-radius: var(--radius-md);
          font-size: 0.84rem;
          color: var(--teal-800);
          font-weight: 600;
        }

        /* Amortization Table */
        .amortization-table-wrapper {
          margin-top: 36px;
          padding-top: 28px;
          border-top: 1px solid var(--border-color);
        }

        .schedule-header {
          margin-bottom: 16px;
        }

        .schedule-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .schedule-note {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .table-responsive {
          overflow-x: auto;
        }

        .amortization-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.86rem;
          text-align: right;
        }

        .amortization-table th {
          background: var(--bg-subtle);
          color: var(--text-secondary);
          font-weight: 700;
          padding: 10px 14px;
          border-bottom: 2px solid var(--border-color);
        }

        .amortization-table td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-primary);
        }

        .amortization-table th:first-child,
        .amortization-table td:first-child {
          text-align: left;
        }

        .year-cell {
          font-weight: 700;
          color: var(--text-primary);
        }

        .principal-cell {
          color: #16a34a;
          font-weight: 600;
        }

        .interest-cell {
          color: var(--teal-600);
          font-weight: 600;
        }

        .closing-cell {
          font-weight: 700;
        }

        /* Responsive */
        @media (max-width: 960px) {
          .calc-grid {
            grid-template-columns: 1fr;
            gap: 36px;
          }

          .results-action-row {
            flex-direction: column;
          }
        }
      `}</style>
    </section>
  );
};
