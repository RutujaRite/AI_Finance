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
                <span>FOIR Based Eligibility</span>
              </div>
              <span className="method-pill">PV Standard</span>
            </div>

            <div className="hero-metric-body">
              <div className="hero-main-amount font-mono">
                {formatIndianRupees(result.foirEligibility)}
              </div>
            </div>

            <div className="hero-meta-strip">
              <div className="meta-item">
                <span className="meta-lbl">FOIR EMI Limit:</span>
                <span className="meta-val font-mono">{formatIndianRupees(result.foirAllowedEmi)}/mo</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl">Terms:</span>
                <span className="meta-val font-mono">{roiPercent}% p.a. • {tenureMonths}m</span>
              </div>
            </div>

            <div className="hero-footer-status">
              <span className="status-msg text-emerald-100">
                <CheckCircle2 size={14} /> Approved for institutional loan sanction
              </span>
            </div>
          </div>

          {/* 2. Multiplier Based Eligibility (Blue Hero Card) */}
          <div className="hero-card multiplier-hero-card">
            <div className="hero-top-row">
              <div className="hero-badge">
                <Sparkles size={14} />
                <span>Multiplier Based Eligibility</span>
              </div>
              <span className="method-pill bg-blue-subtle text-blue-900">{multiplier}x Multiple</span>
            </div>

            <div className="hero-metric-body">
              <div className="hero-main-amount font-mono text-blue-900">
                {formatIndianRupees(result.multiplierEligibility)}
              </div>
            </div>

            <div className="hero-meta-strip bg-blue-subtle">
              <div className="meta-item">
                <span className="meta-lbl text-blue-800">Monthly Salary:</span>
                <span className="meta-val font-mono text-blue-950">{formatIndianRupees(salary)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl text-blue-800">Multiple:</span>
                <span className="meta-val font-mono text-blue-950">{multiplier}x of Salary</span>
              </div>
            </div>

            <div className="hero-footer-status">
              <span className="status-msg text-blue-800">
                <CheckCircle2 size={14} /> Policy cap based on salary multiplier
              </span>
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

        .salary-pill {
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 0.78rem;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #334155;
        }

        .summary-content {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #fafcff;
        }

        .highlight-cards-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 900px) {
          .highlight-cards-row {
            grid-template-columns: 1fr;
          }
        }

        .hero-card {
          border-radius: 12px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: transform 0.15s ease;
        }

        .hero-emerald {
          background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
          border: 1px solid #047857;
          color: #ffffff;
          box-shadow: 0 4px 14px -2px rgba(6, 78, 59, 0.35);
        }

        .multiplier-hero-card {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1.5px solid #93c5fd;
          box-shadow: 0 4px 14px -2px rgba(37, 99, 235, 0.15);
        }

        .hero-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .hero-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .hero-emerald .hero-badge { color: #a7f3d0; }
        .multiplier-hero-card .hero-badge { color: #1e40af; }

        .method-pill {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        .hero-main-amount {
          font-size: 2.1rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .hero-emerald .hero-main-amount { color: #ffffff; }

        .hero-meta-strip {
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.1);
          font-size: 0.76rem;
        }

        .multiplier-hero-card .hero-meta-strip {
          background: rgba(255, 255, 255, 0.6);
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
      `}</style>
    </div>
  );
};
