'use client';

import React from 'react';
import { 
  TrendingUp, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';
import { EligibilityResult } from '@/lib/eligibility/eligibilityTypes';
import { formatIndianRupees } from '@/lib/eligibility/calculateEligibility';

interface EligibilitySummaryProps {
  salary: number;
  foirPercent: number;
  roiPercent: number;
  tenureMonths: number;
  multiplier: number;
  result: EligibilityResult;
}

export const EligibilitySummary: React.FC<EligibilitySummaryProps> = ({
  salary,
  foirPercent,
  roiPercent,
  tenureMonths,
  multiplier,
  result,
}) => {
  return (
    <div className="summary-box card">
      {/* Header */}
      <div className="summary-header">
        <div className="hdr-left">
          <div className="icon-wrapper">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="section-title">Eligibility Summary</h3>
            <p className="section-subtitle">
              Calculated sanction limits & permissible EMI benchmarks
            </p>
          </div>
        </div>

        <div className="salary-pill font-mono">
          Salary: <strong>{formatIndianRupees(salary)}</strong>
        </div>
      </div>

      <div className="summary-content">
        {/* Two Primary Eligibility Highlight Cards */}
        <div className="highlight-cards-row">
          {/* 1. FOIR Based Eligibility (Green Positive/Hero Card) */}
          <div className="hero-card foir-hero-card hero-emerald">
            <div className="hero-top-row">
              <div className="hero-badge">
                <ShieldCheck size={14} />
                <span>FOIR Based Limit</span>
              </div>
              <span className="method-pill">PV Standard</span>
            </div>

            <div className="hero-metric-body">
              <div className="hero-main-amount font-mono">
                {formatIndianRupees(result.foirEligibility, true)}
              </div>
              <div className="hero-sub-amount">
                {result.foirEligibility >= 100000 ? `₹${(result.foirEligibility / 100000).toFixed(2)} Lakhs` : ''} 
                <span className="exact-excel-note"> (Excel PV)</span>
              </div>
            </div>

            <div className="hero-meta-strip">
              <div className="meta-item">
                <span className="meta-lbl">Eligible EMI:</span>
                <span className="meta-val font-mono">₹{formatIndianRupees(result.finalEligibleEmi)}/mo</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl">Terms:</span>
                <span className="meta-val font-mono">{roiPercent}% • {tenureMonths}m</span>
              </div>
            </div>
          </div>

          {/* 2. Multiplier Based Eligibility (Blue Hero Card) */}
          <div className="hero-card multiplier-hero-card">
            <div className="hero-top-row">
              <div className="hero-badge">
                <Sparkles size={14} />
                <span>Multiplier Based Limit</span>
              </div>
              <span className="method-pill bg-blue-subtle text-blue-900">{multiplier}x Multiple</span>
            </div>

            <div className="hero-metric-body">
              <div className="hero-main-amount font-mono text-blue-900">
                {formatIndianRupees(result.multiplierEligibility)}
              </div>
              <div className="hero-sub-amount text-blue-700">
                {result.multiplierEligibility >= 100000 ? `₹${(result.multiplierEligibility / 100000).toFixed(2)} Lakhs` : ''}
                <span className="exact-excel-note text-blue-600"> (Policy Cap)</span>
              </div>
            </div>

            <div className="hero-meta-strip bg-blue-subtle">
              <div className="meta-item">
                <span className="meta-lbl text-blue-800">Considered Pay:</span>
                <span className="meta-val font-mono text-blue-950">₹{formatIndianRupees(result.consideredSalary)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl text-blue-800">Multiple:</span>
                <span className="meta-val font-mono text-blue-950">{multiplier}x Salary</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .summary-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .summary-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
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

        .salary-pill {
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 0.72rem;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #334155;
        }

        .summary-content {
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: #fafcff;
        }

        .highlight-cards-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        @media (max-width: 900px) {
          .highlight-cards-row {
            grid-template-columns: 1fr;
          }
        }

        .hero-card {
          border-radius: 10px;
          padding: 9px 12px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          transition: transform 0.15s ease;
        }

        .hero-emerald {
          background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
          border: 1px solid #047857;
          color: #ffffff;
          box-shadow: 0 2px 8px -1px rgba(6, 78, 59, 0.3);
        }

        .multiplier-hero-card {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1.5px solid #93c5fd;
          box-shadow: 0 2px 8px -1px rgba(37, 99, 235, 0.12);
        }

        .hero-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .hero-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .hero-emerald .hero-badge { color: #a7f3d0; }
        .multiplier-hero-card .hero-badge { color: #1e40af; }

        .method-pill {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        .hero-main-amount {
          font-size: 1.45rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .hero-emerald .hero-main-amount { color: #ffffff; }

        .hero-sub-amount {
          font-size: 0.74rem;
          font-weight: 600;
          opacity: 0.92;
          margin-top: 1px;
        }

        .hero-emerald .hero-sub-amount { color: #a7f3d0; }

        .exact-excel-note {
          font-size: 0.7rem;
          opacity: 0.85;
          font-family: monospace;
        }

        .hero-meta-strip {
          border-radius: 6px;
          padding: 4px 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.12);
          font-size: 0.72rem;
        }

        .multiplier-hero-card .hero-meta-strip {
          background: rgba(255, 255, 255, 0.65);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .meta-lbl { opacity: 0.8; }
        .meta-val { font-weight: 700; }

        .hero-footer-status {
          font-size: 0.74rem;
          margin-top: 2px;
        }

        .status-msg {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .text-emerald-100 { color: #d1fae5; }
        .text-blue-800 { color: #1e40af; }
        .text-blue-900 { color: #1e3a8a; }
        .text-blue-950 { color: #172554; }
        .bg-blue-subtle { background: rgba(219, 234, 254, 0.7); }
        .font-mono { font-family: monospace; }

        /* Dark Theme Support for EligibilitySummary */
        :global([data-theme="dark"]) .summary-box,
        :global([data-bs-theme="dark"]) .summary-box,
        :global(.dark) .summary-box {
          background: var(--surface) !important;
          border-color: var(--border) !important;
        }

        :global([data-theme="dark"]) .summary-header,
        :global([data-bs-theme="dark"]) .summary-header,
        :global(.dark) .summary-header {
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

        :global([data-theme="dark"]) .salary-pill,
        :global([data-bs-theme="dark"]) .salary-pill,
        :global(.dark) .salary-pill {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #cbd5e1 !important;
        }

        :global([data-theme="dark"]) .summary-content,
        :global([data-bs-theme="dark"]) .summary-content,
        :global(.dark) .summary-content {
          background: #090d16 !important;
        }

        :global([data-theme="dark"]) .text-blue-900,
        :global([data-bs-theme="dark"]) .text-blue-900,
        :global(.dark) .text-blue-900 {
          color: #ffffff !important;
        }

        :global([data-theme="dark"]) .text-blue-700,
        :global([data-bs-theme="dark"]) .text-blue-700,
        :global(.dark) .text-blue-700 {
          color: #93c5fd !important;
        }

        :global([data-theme="dark"]) .text-blue-800,
        :global([data-bs-theme="dark"]) .text-blue-800,
        :global(.dark) .text-blue-800 {
          color: #bfdbfe !important;
        }

        :global([data-theme="dark"]) .text-blue-950,
        :global([data-bs-theme="dark"]) .text-blue-950,
        :global(.dark) .text-blue-950 {
          color: #f8fafc !important;
        }

        :global([data-theme="dark"]) .bg-blue-subtle,
        :global([data-bs-theme="dark"]) .bg-blue-subtle,
        :global(.dark) .bg-blue-subtle {
          background: rgba(30, 58, 138, 0.4) !important;
        }
      `}</style>
    </div>
  );
};
