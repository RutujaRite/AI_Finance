'use client';

import React, { useState, useMemo } from 'react';
import { 
  Sliders, 
  DollarSign, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Briefcase, 
  UserCheck, 
  Layers,
  Award
} from 'lucide-react';
import { User } from '@/types';

interface EligibilityCalculatorSectionProps {
  currentUser: User | null;
  onOpenRegister: () => void;
  onOpenLogin: () => void;
}

export const EligibilityCalculatorSection: React.FC<EligibilityCalculatorSectionProps> = ({
  currentUser,
  onOpenRegister,
  onOpenLogin,
}) => {
  // Currency unit state
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');

  // Core required inputs: Monthly Income & Existing Obligations
  const [monthlyIncome, setMonthlyIncome] = useState<number>(7500);
  const [existingObligations, setExistingObligations] = useState<number>(800);
  const [interestRate, setInterestRate] = useState<number>(8.5);
  const [tenureYears, setTenureYears] = useState<number>(20);
  const [employmentType, setEmploymentType] = useState<'salaried' | 'self-employed'>('salaried');
  const [savedStatus, setSavedStatus] = useState(false);

  const currSymbol = currency === 'USD' ? '$' : '₹';
  const formatNumber = (num: number) => {
    if (currency === 'INR') {
      return num.toLocaleString('en-IN');
    }
    return num.toLocaleString('en-US');
  };

  // Eligibility Calculation Logic (Banking FOIR Standard)
  const { 
    maxEligibleLoan, 
    maxAffordableEmi, 
    foirPercent, 
    dtiStatus, 
    statusColor,
    bonusIfCleared
  } = useMemo(() => {
    const income = monthlyIncome;
    const debts = existingObligations;
    
    // FOIR tier: standard 50% for normal income, up to 60% for higher income
    const foirTier = income >= (currency === 'USD' ? 10000 : 150000) ? 0.60 : 0.50;
    const maxTotalPermissibleEMI = income * foirTier;
    const availableEMI = Math.max(0, maxTotalPermissibleEMI - debts);

    // Current FOIR / Debt burden ratio
    const currentFoir = income > 0 ? Math.round((debts / income) * 100) : 0;

    // Monthly interest rate & total months
    const r = interestRate / 12 / 100;
    const n = tenureYears * 12;

    let eligiblePrincipal = 0;
    if (r > 0 && n > 0 && availableEMI > 0) {
      // PV formula: P = EMI * ( (1+r)^n - 1 ) / ( r * (1+r)^n )
      eligiblePrincipal = Math.round(
        (availableEMI * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n))
      );
    }

    // Potential extra loan amount if obligations were cleared
    let clearedPrincipal = 0;
    if (r > 0 && n > 0 && debts > 0) {
      clearedPrincipal = Math.round(
        (debts * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n))
      );
    }

    // DTI Status
    let statusText = 'Optimal Eligibility (Low Risk)';
    let colorClass = 'status-green';
    if (currentFoir > 45) {
      statusText = 'High Debt Burden (Strict Approval)';
      colorClass = 'status-red';
    } else if (currentFoir > 30) {
      statusText = 'Moderate Eligibility (Standard Approval)';
      colorClass = 'status-yellow';
    }

    return {
      maxEligibleLoan: eligiblePrincipal,
      maxAffordableEmi: Math.round(availableEMI),
      foirPercent: currentFoir,
      dtiStatus: statusText,
      statusColor: colorClass,
      bonusIfCleared: clearedPrincipal
    };
  }, [monthlyIncome, existingObligations, interestRate, tenureYears, currency]);

  const handleSaveReport = () => {
    if (!currentUser) {
      onOpenRegister();
      return;
    }
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 4000);
  };

  return (
    <section id="eligibility-calculator" className="eligibility-section">
      <div className="container">
        {/* Section Header */}
        <div className="section-head">
          <div className="section-badge">
            <Sliders size={15} className="text-teal" />
            <span>Underwriting Intelligence</span>
          </div>
          <h2 className="section-title">Loan Eligibility Calculator</h2>
          <p className="section-subtitle">
            Find out how much you can borrow based on your monthly income and current obligations according to verified banking FOIR standards.
          </p>

          {/* Currency Toggle */}
          <div className="currency-selector">
            <button 
              type="button"
              onClick={() => {
                setCurrency('USD');
                if (monthlyIncome > 50000) setMonthlyIncome(7500);
                if (existingObligations > 10000) setExistingObligations(800);
              }}
              className={`currency-pill ${currency === 'USD' ? 'active' : ''}`}
            >
              USD ($)
            </button>
            <button 
              type="button"
              onClick={() => {
                setCurrency('INR');
                if (monthlyIncome < 30000) setMonthlyIncome(85000);
                if (existingObligations < 5000) setExistingObligations(12000);
              }}
              className={`currency-pill ${currency === 'INR' ? 'active' : ''}`}
            >
              INR (₹)
            </button>
          </div>
        </div>

        {/* Eligibility Main Box */}
        <div className="eligibility-card glass-panel">
          <div className="calc-layout-grid">
            {/* Left Inputs Column */}
            <div className="inputs-panel">
              {/* Employment Type Switch */}
              <div className="employment-switch-group">
                <label className="input-group-label">Employment Profile</label>
                <div className="emp-toggle-pills">
                  <button 
                    type="button"
                    onClick={() => setEmploymentType('salaried')}
                    className={`emp-btn ${employmentType === 'salaried' ? 'active' : ''}`}
                  >
                    <Briefcase size={15} />
                    <span>Salaried Professional</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEmploymentType('self-employed')}
                    className={`emp-btn ${employmentType === 'self-employed' ? 'active' : ''}`}
                  >
                    <UserCheck size={15} />
                    <span>Business / Self-Employed</span>
                  </button>
                </div>
              </div>

              {/* 1. Monthly Net Income (Required) */}
              <div className="field-group">
                <div className="field-head">
                  <label className="input-group-label">
                    Monthly Net Income 
                    <span className="info-tooltip-text">(Take-home pay after taxes)</span>
                  </label>
                  <div className="field-box">
                    <span className="unit-prefix">{currSymbol}</span>
                    <input
                      type="number"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(Math.max(0, Number(e.target.value)))}
                      className="numeric-input"
                    />
                  </div>
                </div>

                <input
                  type="range"
                  min={currency === 'USD' ? 1000 : 20000}
                  max={currency === 'USD' ? 40000 : 800000}
                  step={currency === 'USD' ? 250 : 5000}
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                  className="teal-range-slider"
                />

                <div className="preset-chips">
                  {currency === 'USD' ? (
                    <>
                      <button type="button" onClick={() => setMonthlyIncome(3500)} className="preset-chip">$3,500/mo</button>
                      <button type="button" onClick={() => setMonthlyIncome(5000)} className="preset-chip">$5,000/mo</button>
                      <button type="button" onClick={() => setMonthlyIncome(7500)} className="preset-chip">$7,500/mo</button>
                      <button type="button" onClick={() => setMonthlyIncome(12000)} className="preset-chip">$12,000/mo</button>
                      <button type="button" onClick={() => setMonthlyIncome(20000)} className="preset-chip">$20,000/mo</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setMonthlyIncome(35000)} className="preset-chip">₹35k/mo</button>
                      <button type="button" onClick={() => setMonthlyIncome(60000)} className="preset-chip">₹60k/mo</button>
                      <button type="button" onClick={() => setMonthlyIncome(100000)} className="preset-chip">₹1 Lakh/mo</button>
                      <button type="button" onClick={() => setMonthlyIncome(175000)} className="preset-chip">₹1.75 Lakh/mo</button>
                      <button type="button" onClick={() => setMonthlyIncome(300000)} className="preset-chip">₹3 Lakh/mo</button>
                    </>
                  )}
                </div>
              </div>

              {/* 2. Existing Obligations (Required) */}
              <div className="field-group">
                <div className="field-head">
                  <label className="input-group-label">
                    Existing Monthly Obligations
                    <span className="info-tooltip-text">(Active loan EMIs & card payments)</span>
                  </label>
                  <div className="field-box">
                    <span className="unit-prefix">{currSymbol}</span>
                    <input
                      type="number"
                      value={existingObligations}
                      onChange={(e) => setExistingObligations(Math.max(0, Number(e.target.value)))}
                      className="numeric-input"
                    />
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={currency === 'USD' ? 15000 : 200000}
                  step={currency === 'USD' ? 50 : 1000}
                  value={existingObligations}
                  onChange={(e) => setExistingObligations(Number(e.target.value))}
                  className="teal-range-slider"
                />

                <div className="range-bounds">
                  <span>{currSymbol}0 (Debt Free)</span>
                  <span>{currSymbol}{formatNumber(Math.round(monthlyIncome * 0.3))} (30% Burden)</span>
                  <span>Max limit</span>
                </div>
              </div>

              {/* 3. Expected Interest Rate & Tenure (Dual row) */}
              <div className="dual-inputs-row">
                <div className="mini-field-group">
                  <div className="mini-head">
                    <label className="mini-label">Expected Rate</label>
                    <span className="mini-val">{interestRate}% p.a.</span>
                  </div>
                  <input
                    type="range"
                    min="6.5"
                    max="18"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="teal-range-slider"
                  />
                </div>

                <div className="mini-field-group">
                  <div className="mini-head">
                    <label className="mini-label">Desired Tenure</label>
                    <span className="mini-val">{tenureYears} Years</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={tenureYears}
                    onChange={(e) => setTenureYears(Number(e.target.value))}
                    className="teal-range-slider"
                  />
                </div>
              </div>
            </div>

            {/* Right Output Column */}
            <div className="results-panel">
              {/* Main Estimated Eligibility Display Card */}
              <div className="eligibility-scorecard">
                <div className="scorecard-top">
                  <span className="scorecard-label">Estimated Eligible Loan Amount</span>
                  <span className="badge-ai-approved">
                    <ShieldCheck size={13} />
                    <span>Instant Underwriting</span>
                  </span>
                </div>

                <div className="loan-amount-row">
                  <span className="curr-sym">{currSymbol}</span>
                  <span className="main-eligible-num">{formatNumber(maxEligibleLoan)}</span>
                </div>

                {/* Sub-metric bar */}
                <div className="sub-metric-grid">
                  <div className="sub-metric-box">
                    <span className="sub-metric-title">Max Permissible EMI</span>
                    <span className="sub-metric-val">{currSymbol}{formatNumber(maxAffordableEmi)} / mo</span>
                  </div>
                  <div className="sub-metric-box">
                    <span className="sub-metric-title">Debt Burden (FOIR)</span>
                    <span className={`sub-metric-val ${statusColor}`}>{foirPercent}%</span>
                  </div>
                </div>

                {/* DTI Gauge Bar */}
                <div className="dti-gauge-section">
                  <div className="gauge-label-row">
                    <span className="gauge-status-text">{dtiStatus}</span>
                    <span className="gauge-pct-text">{foirPercent}% of income</span>
                  </div>
                  <div className="gauge-track">
                    <div 
                      className={`gauge-fill ${statusColor}-bg`} 
                      style={{ width: `${Math.min(100, Math.max(8, foirPercent))}%` }} 
                    />
                  </div>
                </div>
              </div>

              {/* AI Recommendations to Boost Eligibility */}
              <div className="ai-booster-box">
                <div className="booster-header">
                  <Sparkles size={16} className="text-teal" />
                  <span>AI Eligibility Boosters</span>
                </div>

                <ul className="booster-list">
                  {existingObligations > 0 && (
                    <li className="booster-item">
                      <TrendingUp size={15} className="booster-icon text-teal" />
                      <span>
                        Paying off your current <strong>{currSymbol}{formatNumber(existingObligations)}/mo</strong> obligations will unlock an extra <strong>+{currSymbol}{formatNumber(bonusIfCleared)}</strong> in borrowing eligibility!
                      </span>
                    </li>
                  )}
                  <li className="booster-item">
                    <Award size={15} className="booster-icon text-teal" />
                    <span>
                      Adding a working co-applicant (spouse/family) can expand your eligible loan envelope by up to <strong>45% to 60%</strong>.
                    </span>
                  </li>
                  <li className="booster-item">
                    <CheckCircle2 size={15} className="booster-icon text-teal" />
                    <span>
                      Maintaining a credit score above 750 grants preferential interest rates (down to 8.25%), lowering monthly EMIs by up to <strong>12%</strong>.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Action Button */}
              <div className="eligibility-actions">
                <button 
                  type="button"
                  onClick={handleSaveReport}
                  className="btn-apply-assessment"
                >
                  <ShieldCheck size={17} />
                  <span>{currentUser ? 'Save Eligibility Assessment' : 'Sign In to Save Full Report'}</span>
                  <ArrowRight size={15} />
                </button>
              </div>

              {savedStatus && (
                <div className="save-confirmation animate-fade-in">
                  <CheckCircle2 size={16} className="text-teal" />
                  <span>Eligibility Assessment saved to your FinAI Portfolio!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .eligibility-section {
          padding: 80px 0;
          background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-subtle) 100%);
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
          background: var(--bg-surface);
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

        /* Eligibility Card */
        .eligibility-card {
          border-radius: var(--radius-xl);
          padding: 36px;
          box-shadow: var(--shadow-xl);
        }

        .calc-layout-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 48px;
        }

        /* Inputs Panel */
        .inputs-panel {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .employment-switch-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group-label {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .info-tooltip-text {
          font-size: 0.76rem;
          font-weight: 500;
          color: var(--text-muted);
        }

        .emp-toggle-pills {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .emp-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          border: 1.5px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 0.86rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .emp-btn.active {
          border-color: var(--teal-600);
          color: var(--teal-700);
          background: var(--teal-50);
        }

        :global([data-theme='dark']) .emp-btn.active {
          background: rgba(13, 148, 136, 0.15);
          color: var(--teal-300);
          border-color: var(--teal-400);
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .field-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .field-box {
          display: flex;
          align-items: center;
          background: var(--bg-subtle);
          border: 1.5px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 6px 12px;
        }

        .field-box:focus-within {
          border-color: var(--teal-600);
          background: var(--bg-surface);
        }

        .unit-prefix {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--teal-600);
        }

        .numeric-input {
          border: none;
          background: transparent;
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          width: 100px;
          text-align: right;
          outline: none;
          padding: 0 4px;
        }

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
        }

        .dual-inputs-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          padding: 16px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
        }

        .mini-field-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .mini-head {
          display: flex;
          justify-content: space-between;
        }

        .mini-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .mini-val {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--teal-600);
        }

        /* Results Panel */
        .results-panel {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .eligibility-scorecard {
          background: linear-gradient(135deg, #09172f 0%, #0d2c48 100%);
          border-radius: var(--radius-lg);
          padding: 26px;
          color: #ffffff;
          box-shadow: 0 10px 25px -5px rgba(9, 23, 47, 0.4);
        }

        .scorecard-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .scorecard-label {
          font-size: 0.82rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
        }

        .badge-ai-approved {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: var(--radius-full);
          background: rgba(13, 148, 136, 0.25);
          color: #2dd4bf;
          font-size: 0.72rem;
          font-weight: 700;
        }

        .loan-amount-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin: 6px 0 20px 0;
        }

        .curr-sym {
          font-size: 1.8rem;
          font-weight: 800;
          color: #2dd4bf;
        }

        .main-eligible-num {
          font-size: 2.8rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #ffffff;
        }

        .sub-metric-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 14px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          margin-bottom: 16px;
        }

        .sub-metric-box {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sub-metric-title {
          font-size: 0.7rem;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .sub-metric-val {
          font-size: 1.05rem;
          font-weight: 700;
          color: #ffffff;
        }

        /* Status Colors */
        .status-green {
          color: #10b981 !important;
        }
        .status-green-bg {
          background: #10b981 !important;
        }

        .status-yellow {
          color: #f59e0b !important;
        }
        .status-yellow-bg {
          background: #f59e0b !important;
        }

        .status-red {
          color: #ef4444 !important;
        }
        .status-red-bg {
          background: #ef4444 !important;
        }

        /* Gauge Section */
        .dti-gauge-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .gauge-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.78rem;
        }

        .gauge-status-text {
          font-weight: 700;
          color: #cbd5e1;
        }

        .gauge-pct-text {
          color: #94a3b8;
        }

        .gauge-track {
          width: 100%;
          height: 7px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .gauge-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.3s ease;
        }

        /* AI Booster Box */
        .ai-booster-box {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 20px;
        }

        .booster-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.84rem;
          font-weight: 800;
          color: var(--teal-700);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 12px;
        }

        :global([data-theme='dark']) .booster-header {
          color: var(--teal-300);
        }

        .booster-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .booster-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 0.84rem;
          line-height: 1.45;
          color: var(--text-secondary);
        }

        .booster-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }

        /* Action */
        .btn-apply-assessment {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 13px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #1e40af 100%);
          color: #ffffff;
          font-size: 0.95rem;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35);
          transition: all 0.2s ease;
        }

        .btn-apply-assessment:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(13, 148, 136, 0.45);
        }

        .save-confirmation {
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

        /* Responsive */
        @media (max-width: 960px) {
          .calc-layout-grid {
            grid-template-columns: 1fr;
            gap: 36px;
          }
        }
      `}</style>
    </section>
  );
};
