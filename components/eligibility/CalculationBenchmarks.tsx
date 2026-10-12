'use client';

import React from 'react';
import { 
  Sliders, 
  Percent, 
  Calendar, 
  Zap, 
  IndianRupee, 
  ShieldAlert, 
  RotateCcw,
  RefreshCw,
  Lock,
  Unlock
} from 'lucide-react';
import { formatIndianRupees } from '@/lib/eligibility/calculateEligibility';

interface CalculationBenchmarksProps {
  salary: number;
  foirPercent: number;
  roiPercent: number;
  tenureMonths: number;
  multiplier: number;
  tableObligations?: number;
  currentObligationsOverride?: number | null;
  onSalaryChange: (val: number) => void;
  onFoirChange: (val: number) => void;
  onRoiChange: (val: number) => void;
  onTenureChange: (val: number) => void;
  onMultiplierChange: (val: number) => void;
  onObligationsOverrideChange?: (val: number | null) => void;
  onResetBenchmarks: () => void;
}

const SALARY_PRESETS = [50000, 75000, 100000, 150000, 200000];
const FOIR_PRESETS = [50, 55, 60, 65, 70, 75];
const ROI_PRESETS = [8.5, 9.99, 10.5, 11.0, 12.5, 14.0];
const TENURE_PRESETS = [12, 24, 36, 48, 60, 72, 84];
const MULTIPLIER_PRESETS = [15, 18, 20, 22, 25, 30];

export const CalculationBenchmarks: React.FC<CalculationBenchmarksProps> = ({
  salary,
  foirPercent,
  roiPercent,
  tenureMonths,
  multiplier,
  onSalaryChange,
  onFoirChange,
  onRoiChange,
  onTenureChange,
  onMultiplierChange,
  onResetBenchmarks,
}) => {
  return (
    <div className="benchmarks-box card">
      <div className="benchmarks-header">
        <div className="hdr-left">
          <div className="icon-wrapper">
            <Sliders size={18} />
          </div>
          <div>
            <h3 className="section-title">Calculation Benchmarks</h3>
            <p className="section-subtitle">
              Configure salary, debt ratio cap, interest rate & repayment tenure
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onResetBenchmarks}
          className="reset-btn"
          title="Reset benchmarks to default reference values (Salary ₹100k, FOIR 60%, ROI 9.99%, Tenure 60m, Mult 20x)"
        >
          <RotateCcw size={13} />
          <span>Reset Benchmarks</span>
        </button>
      </div>

      <div className="benchmarks-content">
        {/* 1. Net Monthly Salary */}
        <div className="param-card salary-special-card">
          <div className="param-header">
            <div className="param-label-group">
              <label htmlFor="input-salary" className="param-title">
                <IndianRupee size={15} className="text-blue-600" />
                <span>Net Monthly Salary</span>
              </label>
              <span className="param-helper">Applicant credited in-hand monthly pay</span>
            </div>
            <div className="param-display-value text-blue-700">
              {formatIndianRupees(salary)}
            </div>
          </div>

          <div className="slider-row">
            <input
              id="salary-slider"
              type="range"
              min="20000"
              max="500000"
              step="5000"
              className="styled-range"
              value={salary}
              onChange={(e) => onSalaryChange(Number(e.target.value) || 0)}
            />
            <div className="input-with-symbol">
              <span className="sym-prefix">₹</span>
              <input
                id="input-salary"
                type="number"
                min="0"
                step="1000"
                className="param-num-input font-mono"
                value={salary === 0 ? '' : salary}
                onChange={(e) => onSalaryChange(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="chips-row">
            <span className="chips-label">Quick:</span>
            {SALARY_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`quick-chip ${salary === p ? 'active' : ''}`}
                onClick={() => onSalaryChange(p)}
              >
                ₹{(p / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
        </div>

        {/* 2. FOIR % (Fixed Obligation to Income Ratio) */}
        <div className="param-card">
          <div className="param-header">
            <div className="param-label-group">
              <label htmlFor="input-foir" className="param-title">
                <Percent size={15} className="text-emerald-600" />
                <span>FOIR % (Debt Limit Cap)</span>
              </label>
              <span className="param-helper">Max permissible percentage of income for EMIs</span>
            </div>
            <div className="param-display-value text-emerald-700 font-mono">
              {foirPercent}%
            </div>
          </div>

          <div className="slider-row">
            <input
              id="foir-slider"
              type="range"
              min="30"
              max="85"
              step="1"
              className="styled-range"
              value={foirPercent}
              onChange={(e) => onFoirChange(Number(e.target.value) || 0)}
            />
            <div className="input-with-symbol">
              <input
                id="input-foir"
                type="number"
                min="10"
                max="90"
                step="1"
                className="param-num-input font-mono"
                value={foirPercent}
                onChange={(e) => onFoirChange(Number(e.target.value) || 0)}
              />
              <span className="sym-suffix">%</span>
            </div>
          </div>

          <div className="chips-row">
            <span className="chips-label">Common:</span>
            {FOIR_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`quick-chip ${foirPercent === p ? 'active' : ''}`}
                onClick={() => onFoirChange(p)}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* 3. Expected ROI % (p.a.) */}
        <div className="param-card">
          <div className="param-header">
            <div className="param-label-group">
              <label htmlFor="input-roi" className="param-title">
                <Percent size={15} className="text-blue-600" />
                <span>ROI % (Interest Rate p.a.)</span>
              </label>
              <span className="param-helper">Annual interest rate applied for amortization</span>
            </div>
            <div className="param-display-value text-blue-700 font-mono">
              {roiPercent}%
            </div>
          </div>

          <div className="slider-row">
            <input
              id="roi-slider"
              type="range"
              min="8.0"
              max="24.0"
              step="0.01"
              className="styled-range"
              value={roiPercent}
              onChange={(e) => onRoiChange(Number(e.target.value) || 0)}
            />
            <div className="input-with-symbol">
              <input
                id="input-roi"
                type="number"
                min="1.0"
                max="36.0"
                step="0.01"
                className="param-num-input font-mono"
                value={roiPercent}
                onChange={(e) => onRoiChange(Number(e.target.value) || 0)}
              />
              <span className="sym-suffix">%</span>
            </div>
          </div>

          <div className="chips-row">
            <span className="chips-label">Benchmarks:</span>
            {ROI_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`quick-chip ${Math.abs(roiPercent - p) < 0.01 ? 'active' : ''}`}
                onClick={() => onRoiChange(p)}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* 4. Tenure (M) */}
        <div className="param-card">
          <div className="param-header">
            <div className="param-label-group">
              <label htmlFor="input-tenure" className="param-title">
                <Calendar size={15} className="text-indigo-600" />
                <span>Tenure (M)</span>
              </label>
              <span className="param-helper">Repayment period in months ({((tenureMonths || 0) / 12).toFixed(1)} Yrs)</span>
            </div>
            <div className="param-display-value text-indigo-700 font-mono">
              {tenureMonths}m
            </div>
          </div>

          <div className="slider-row">
            <input
              id="tenure-slider"
              type="range"
              min="12"
              max="84"
              step="6"
              className="styled-range"
              value={tenureMonths}
              onChange={(e) => onTenureChange(Number(e.target.value) || 0)}
            />
            <div className="input-with-symbol">
              <input
                id="input-tenure"
                type="number"
                min="6"
                max="360"
                step="6"
                className="param-num-input font-mono"
                value={tenureMonths}
                onChange={(e) => onTenureChange(Number(e.target.value) || 0)}
              />
              <span className="sym-suffix">mo</span>
            </div>
          </div>

          <div className="chips-row">
            <span className="chips-label">Standard:</span>
            {TENURE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`quick-chip ${tenureMonths === p ? 'active' : ''}`}
                onClick={() => onTenureChange(p)}
              >
                {p}m
              </button>
            ))}
          </div>
        </div>

        {/* 5. Multiplier (x) */}
        <div className="param-card">
          <div className="param-header">
            <div className="param-label-group">
              <label htmlFor="input-multiplier" className="param-title">
                <Zap size={15} className="text-purple-600" />
                <span>Multiplier (x)</span>
              </label>
              <span className="param-helper">Salary multiple cap (Applied to Considered Salary)</span>
            </div>
            <div className="param-display-value text-purple-700 font-mono">
              {multiplier}x
            </div>
          </div>

          <div className="slider-row">
            <input
              id="multiplier-slider"
              type="range"
              min="10"
              max="35"
              step="1"
              className="styled-range"
              value={multiplier}
              onChange={(e) => onMultiplierChange(Number(e.target.value) || 0)}
            />
            <div className="input-with-symbol">
              <input
                id="input-multiplier"
                type="number"
                min="1"
                max="45"
                step="1"
                className="param-num-input font-mono"
                value={multiplier}
                onChange={(e) => onMultiplierChange(Number(e.target.value) || 0)}
              />
              <span className="sym-suffix">x</span>
            </div>
          </div>

          <div className="chips-row">
            <span className="chips-label">Multiples:</span>
            {MULTIPLIER_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`quick-chip ${multiplier === p ? 'active' : ''}`}
                onClick={() => onMultiplierChange(p)}
              >
                {p}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .benchmarks-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .benchmarks-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #ffffff;
          flex-wrap: wrap;
          gap: 10px;
        }

        .hdr-left {
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
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .section-subtitle {
          font-size: 0.78rem;
          color: #64748b;
          margin-top: 2px;
        }

        .reset-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 0.76rem;
          font-weight: 600;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .reset-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }

        .benchmarks-content {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: #fafcff;
        }

        .param-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }

        .salary-special-card {
          border-color: #bfdbfe;
          background: #ffffff;
        }

        .obligations-card {
          border-color: #fde68a;
          background: #fffdf7;
        }

        .param-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .param-label-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .param-title {
          font-size: 0.84rem;
          font-weight: 700;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .param-helper {
          font-size: 0.72rem;
          color: #64748b;
        }

        .param-display-value {
          font-size: 1.05rem;
          font-weight: 800;
        }

        .slider-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .styled-range {
          flex: 1;
          height: 6px;
          border-radius: 9999px;
          background: #e2e8f0;
          outline: none;
          accent-color: #2563eb;
          cursor: pointer;
        }

        .input-with-symbol {
          display: inline-flex;
          align-items: center;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #ffffff;
          overflow: hidden;
          padding: 0 6px;
          transition: border-color 0.15s ease;
        }

        .input-with-symbol:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
        }

        .sym-prefix, .sym-suffix {
          font-size: 0.76rem;
          color: #64748b;
          font-weight: 600;
        }

        .param-num-input {
          border: none;
          outline: none;
          padding: 6px 4px;
          font-size: 0.84rem;
          font-weight: 700;
          color: #0f172a;
          width: 90px;
          text-align: right;
        }

        .chips-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          padding-top: 2px;
        }

        .chips-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: #94a3b8;
        }

        .quick-chip {
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 0.72rem;
          font-weight: 600;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #475569;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .quick-chip:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .quick-chip.active {
          background: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
        }

        .obligations-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .sync-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.74rem;
          font-weight: 600;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #2563eb;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .sync-btn:hover {
          background: #dbeafe;
        }

        .sync-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #065f46;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          padding: 5px 10px;
          border-radius: 6px;
        }

        .font-mono { font-family: monospace; }
        .text-blue-600 { color: #2563eb; }
        .text-blue-700 { color: #1d4ed8; }
        .text-emerald-600 { color: #059669; }
        .text-emerald-700 { color: #047857; }
        .text-indigo-600 { color: #4f46e5; }
        .text-indigo-700 { color: #4338ca; }
        .text-purple-600 { color: #9333ea; }
        .text-purple-700 { color: #7e22ce; }
        .text-amber-600 { color: #d97706; }
        .text-amber-700 { color: #b45309; }
        .w-full { width: 100%; }
        .flex-1 { flex: 1; }
      `}</style>
    </div>
  );
};
