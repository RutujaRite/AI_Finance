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
                <IndianRupee size={14} className="text-blue-600" />
                <span>Net Monthly Salary</span>
              </label>
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
                <Percent size={14} className="text-emerald-600" />
                <span>FOIR % (Debt Limit Cap)</span>
              </label>
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
                <Percent size={14} className="text-blue-600" />
                <span>ROI % (Interest Rate p.a.)</span>
              </label>
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
                <Calendar size={14} className="text-indigo-600" />
                <span>Tenure ({((tenureMonths || 0) / 12).toFixed(1)} Yrs)</span>
              </label>
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
                <Zap size={14} className="text-purple-600" />
                <span>Multiplier (Salary Cap)</span>
              </label>
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
          padding: 10px 16px;
          border-bottom: 1px solid #e2e8f0;
          background: #ffffff;
          flex-wrap: wrap;
          gap: 8px;
        }

        .hdr-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .icon-wrapper {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .section-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .section-subtitle {
          font-size: 0.72rem;
          color: #64748b;
          margin-top: 1px;
        }

        .reset-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.72rem;
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
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: #fafcff;
        }

        .param-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 7px 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
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
          font-size: 0.8rem;
          font-weight: 700;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .param-display-value {
          font-size: 0.95rem;
          font-weight: 800;
        }

        .slider-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .styled-range {
          flex: 1;
          height: 5px;
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
          padding: 0 4px;
          transition: border-color 0.15s ease;
        }

        .input-with-symbol:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
        }

        .sym-prefix, .sym-suffix {
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 600;
        }

        .param-num-input {
          border: none;
          outline: none;
          padding: 4px 4px;
          font-size: 0.8rem;
          font-weight: 700;
          color: #0f172a;
          width: 82px;
          text-align: right;
        }

        .chips-row {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
          padding-top: 1px;
        }

        .chips-label {
          font-size: 0.68rem;
          font-weight: 600;
          color: #94a3b8;
        }

        .quick-chip {
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 0.68rem;
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

        /* Dark Theme Support for CalculationBenchmarks */
        :global([data-theme="dark"]) .benchmarks-box,
        :global([data-bs-theme="dark"]) .benchmarks-box,
        :global(.dark) .benchmarks-box {
          background: var(--surface) !important;
          border-color: var(--border) !important;
        }

        :global([data-theme="dark"]) .benchmarks-header,
        :global([data-bs-theme="dark"]) .benchmarks-header,
        :global(.dark) .benchmarks-header {
          background: var(--surface) !important;
          border-color: var(--border) !important;
        }

        :global([data-theme="dark"]) .section-title,
        :global([data-bs-theme="dark"]) .section-title,
        :global(.dark) .section-title {
          color: #f8fafc !important;
        }

        :global([data-theme="dark"]) .section-subtitle,
        :global([data-bs-theme="dark"]) .section-subtitle,
        :global(.dark) .section-subtitle {
          color: #94a3b8 !important;
        }

        :global([data-theme="dark"]) .benchmarks-content,
        :global([data-bs-theme="dark"]) .benchmarks-content,
        :global(.dark) .benchmarks-content {
          background: #090d16 !important;
        }

        :global([data-theme="dark"]) .param-card,
        :global([data-bs-theme="dark"]) .param-card,
        :global(.dark) .param-card {
          background: #0f172a !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }

        :global([data-theme="dark"]) .param-title,
        :global([data-bs-theme="dark"]) .param-title,
        :global(.dark) .param-title {
          color: #cbd5e1 !important;
        }

        :global([data-theme="dark"]) .input-with-symbol,
        :global([data-bs-theme="dark"]) .input-with-symbol,
        :global(.dark) .input-with-symbol {
          background: #090d16 !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }

        :global([data-theme="dark"]) .param-num-input,
        :global([data-bs-theme="dark"]) .param-num-input,
        :global(.dark) .param-num-input {
          background: transparent !important;
          color: #ffffff !important;
        }

        :global([data-theme="dark"]) .quick-chip,
        :global([data-bs-theme="dark"]) .quick-chip,
        :global(.dark) .quick-chip {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #cbd5e1 !important;
        }

        :global([data-theme="dark"]) .quick-chip:hover,
        :global([data-bs-theme="dark"]) .quick-chip:hover,
        :global(.dark) .quick-chip:hover {
          background: #334155 !important;
          color: #ffffff !important;
        }

        :global([data-theme="dark"]) .quick-chip.active,
        :global([data-bs-theme="dark"]) .quick-chip.active,
        :global(.dark) .quick-chip.active {
          background: #2563eb !important;
          border-color: #2563eb !important;
          color: #ffffff !important;
        }

        :global([data-theme="dark"]) .reset-btn,
        :global([data-bs-theme="dark"]) .reset-btn,
        :global(.dark) .reset-btn {
          background: var(--surface-2) !important;
          border-color: var(--border) !important;
          color: var(--ink-soft) !important;
        }

        :global([data-theme="dark"]) .reset-btn:hover,
        :global([data-bs-theme="dark"]) .reset-btn:hover,
        :global(.dark) .reset-btn:hover {
          background: #334155 !important;
          border-color: #60a5fa !important;
          color: #ffffff !important;
        }

        :global([data-theme="dark"]) .text-blue-700,
        :global([data-bs-theme="dark"]) .text-blue-700,
        :global(.dark) .text-blue-700 {
          color: #60a5fa !important;
        }

        :global([data-theme="dark"]) .text-emerald-700,
        :global([data-bs-theme="dark"]) .text-emerald-700,
        :global(.dark) .text-emerald-700 {
          color: #34d399 !important;
        }

        :global([data-theme="dark"]) .text-indigo-700,
        :global([data-bs-theme="dark"]) .text-indigo-700,
        :global(.dark) .text-indigo-700 {
          color: #818cf8 !important;
        }

        :global([data-theme="dark"]) .text-purple-700,
        :global([data-bs-theme="dark"]) .text-purple-700,
        :global(.dark) .text-purple-700 {
          color: #c084fc !important;
        }

        :global([data-theme="dark"]) .text-amber-700,
        :global([data-bs-theme="dark"]) .text-amber-700,
        :global(.dark) .text-amber-700 {
          color: #fbbf24 !important;
        }
      `}</style>
    </div>
  );
};
