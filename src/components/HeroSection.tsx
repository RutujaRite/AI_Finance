'use client';

import React from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Calculator, 
  ShieldCheck, 
  CheckCircle, 
  TrendingUp, 
  Bot, 
  BadgePercent,
  Sliders,
  Award,
  Building2
} from 'lucide-react';

interface HeroSectionProps {
  onOpenRegister: () => void;
  isLoggedIn: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenRegister,
  isLoggedIn
}) => {
  return (
    <section className="hero-section">
      <div className="container hero-container">
        {/* Left Column: Headline, Subtitle, Badges & CTAs */}
        <div className="hero-content">
          {/* AI Platform Chip */}
          <div className="hero-pill-badge">
            <span className="pill-dot" />
            <Bot size={14} className="text-teal" />
            <span>Next-Gen AI Loan Intelligence</span>
          </div>

          {/* Strong Headline specifically required */}
          <h1 className="hero-title">
            Smarter Loan Decisions <br />
            <span className="gradient-text">with AI.</span>
          </h1>

          {/* Subtitle specifically required */}
          <p className="hero-subtitle">
            Calculate accurate monthly EMIs instantly, explore corporate employer underwriting categories, and unlock personalized banking insights—all with zero credit score impact.
          </p>

          {/* CTAs */}
          <div className="hero-cta-group">
            <a href="#emi-calculator" className="btn-primary-cta">
              <Calculator size={18} />
              <span>Calculate EMI Instantly</span>
              <ArrowRight size={16} />
            </a>

            <a href="#company-search" className="btn-secondary-cta">
              <Building2 size={18} />
              <span>Search Company Category</span>
            </a>
          </div>

          {/* Trust Highlights */}
          <div className="hero-trust-row">
            <div className="trust-item">
              <CheckCircle size={16} className="text-teal" />
              <span>No Hard Credit Pull</span>
            </div>
            <div className="trust-item">
              <CheckCircle size={16} className="text-teal" />
              <span>20+ Partner Lenders</span>
            </div>
            <div className="trust-item">
              <CheckCircle size={16} className="text-teal" />
              <span>Instant Real-Time Math</span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive FinTech Visual Card */}
        <div className="hero-visual">
          <div className="hero-card-stack">
            {/* Main AI Approval Snapshot Card */}
            <div className="preview-card-main glass-panel">
              <div className="card-top-bar">
                <div className="bank-status-chip">
                  <span className="status-indicator-green" />
                  <span>AI Pre-Approval Simulator</span>
                </div>
                <span className="rate-badge">8.25% Best APR</span>
              </div>

              <div className="metric-highlight">
                <span className="metric-label">Estimated Loan Eligibility</span>
                <div className="metric-amount-row">
                  <span className="currency-symbol">$</span>
                  <span className="metric-val">450,000</span>
                  <span className="verified-tag">High Approval Odds</span>
                </div>
              </div>

              {/* Progress / FOIR bar */}
              <div className="foir-preview-bar">
                <div className="foir-text-row">
                  <span>Debt-to-Income (DTI) Ratio</span>
                  <span className="dti-val">28% (Healthy)</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: '28%' }} />
                </div>
              </div>

              {/* Two Column Mini Stats */}
              <div className="preview-stats-grid">
                <div className="stat-mini-box">
                  <span className="stat-label">Estimated Monthly EMI</span>
                  <span className="stat-figure">$2,842 / mo</span>
                </div>
                <div className="stat-mini-box">
                  <span className="stat-label">Tenure Benchmark</span>
                  <span className="stat-figure">20 Years (240 mo)</span>
                </div>
              </div>

              {/* Dynamic AI Tip Floating inside card */}
              <div className="ai-inline-insight">
                <Sparkles size={16} className="ai-sparkle-icon" />
                <p>
                  <strong>AI Smart Recommendation:</strong> Increasing tenure by 2 years can reduce monthly obligations by $240/mo, expanding approval margins.
                </p>
              </div>

              {/* Interactive prompt trigger */}
              <div className="card-footer-action">
                <a href="#emi-calculator" className="card-action-link">
                  <span>Customize your personal numbers below</span>
                  <ArrowRight size={14} />
                </a>
              </div>
            </div>

            {/* Floating Floating Stat 1 */}
            <div className="floating-badge badge-top-right">
              <Award size={18} className="badge-icon-gold" />
              <div>
                <p className="floating-title">99.4% Accuracy</p>
                <p className="floating-desc">Bank Underwriting Rules</p>
              </div>
            </div>

            {/* Floating Stat 2 */}
            <div className="floating-badge badge-bottom-left">
              <TrendingUp size={18} className="badge-icon-teal" />
              <div>
                <p className="floating-title">$14,200 Average Saved</p>
                <p className="floating-desc">Via AI Tenure Optimization</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero-section {
          position: relative;
          padding: 60px 0 70px 0;
          overflow: hidden;
          background: radial-gradient(circle at 10% 20%, rgba(13, 148, 136, 0.08) 0%, transparent 40%),
                      radial-gradient(circle at 90% 70%, rgba(30, 58, 138, 0.07) 0%, transparent 45%);
        }

        :global([data-theme='dark']) .hero-section {
          background: radial-gradient(circle at 10% 20%, rgba(13, 148, 136, 0.12) 0%, transparent 40%),
                      radial-gradient(circle at 90% 70%, rgba(37, 99, 235, 0.08) 0%, transparent 45%);
        }

        .hero-container {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 48px;
          align-items: center;
        }

        /* Left Column */
        .hero-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .hero-pill-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: var(--radius-full);
          background: var(--teal-50);
          border: 1px solid var(--teal-200);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--teal-800);
          margin-bottom: 20px;
        }

        :global([data-theme='dark']) .hero-pill-badge {
          background: rgba(13, 148, 136, 0.15);
          border-color: rgba(13, 148, 136, 0.35);
          color: var(--teal-300);
        }

        .pill-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .hero-title {
          font-size: 3.4rem;
          font-weight: 800;
          line-height: 1.12;
          letter-spacing: -0.03em;
          color: var(--navy-900);
          margin-bottom: 20px;
        }

        :global([data-theme='dark']) .hero-title {
          color: #f8fafc;
        }

        .gradient-text {
          background: linear-gradient(135deg, #0d9488 0%, #06b6d4 50%, #2563eb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
          font-size: 1.12rem;
          line-height: 1.6;
          color: var(--text-secondary);
          max-width: 540px;
          margin-bottom: 32px;
        }

        .hero-cta-group {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 36px;
        }

        .btn-primary-cta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 26px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #1e40af 100%);
          color: #ffffff;
          font-size: 0.98rem;
          font-weight: 700;
          box-shadow: 0 8px 24px rgba(13, 148, 136, 0.35);
          transition: all 0.25s ease;
        }

        .btn-primary-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(13, 148, 136, 0.45);
          filter: brightness(1.06);
        }

        .btn-secondary-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 24px;
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          border: 1.5px solid var(--border-color);
          color: var(--text-primary);
          font-size: 0.98rem;
          font-weight: 600;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }

        .btn-secondary-cta:hover {
          border-color: var(--teal-600);
          color: var(--teal-600);
          background: var(--bg-hover);
          transform: translateY(-2px);
        }

        .hero-trust-row {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .trust-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        /* Right Column: Visual Card */
        .hero-visual {
          position: relative;
          display: flex;
          justify-content: center;
        }

        .hero-card-stack {
          position: relative;
          width: 100%;
          max-width: 460px;
        }

        .preview-card-main {
          border-radius: var(--radius-xl);
          padding: 28px;
          box-shadow: var(--shadow-xl), 0 20px 40px -15px rgba(15, 23, 42, 0.12);
          border: 1px solid var(--border-color);
          position: relative;
          z-index: 2;
        }

        .card-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .bank-status-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-secondary);
        }

        .status-indicator-green {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
        }

        .rate-badge {
          padding: 4px 10px;
          border-radius: var(--radius-full);
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 700;
          font-size: 0.8rem;
        }

        :global([data-theme='dark']) .rate-badge {
          background: rgba(37, 99, 235, 0.2);
          color: #93c5fd;
        }

        .metric-highlight {
          margin-bottom: 20px;
        }

        .metric-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metric-amount-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-top: 4px;
        }

        .currency-symbol {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--teal-600);
        }

        .metric-val {
          font-size: 2.4rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }

        .verified-tag {
          margin-left: 10px;
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          background: #ecfdf5;
          color: #065f46;
          font-size: 0.72rem;
          font-weight: 700;
        }

        :global([data-theme='dark']) .verified-tag {
          background: rgba(16, 185, 129, 0.2);
          color: #6ee7b7;
        }

        /* FOIR bar */
        .foir-preview-bar {
          margin-bottom: 20px;
        }

        .foir-text-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          margin-bottom: 6px;
        }

        .dti-val {
          font-weight: 700;
          color: var(--teal-600);
        }

        .progress-track {
          width: 100%;
          height: 8px;
          background: var(--bg-subtle);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981 0%, #0d9488 100%);
          border-radius: var(--radius-full);
        }

        /* Mini stats */
        .preview-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat-mini-box {
          background: var(--bg-subtle);
          padding: 12px 14px;
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
        }

        .stat-figure {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        /* Inline AI Tip */
        .ai-inline-insight {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: var(--radius-md);
          background: var(--teal-50);
          border: 1px solid var(--teal-200);
          font-size: 0.8rem;
          line-height: 1.45;
          color: var(--navy-900);
          margin-bottom: 18px;
        }

        :global([data-theme='dark']) .ai-inline-insight {
          background: rgba(13, 148, 136, 0.12);
          border-color: rgba(13, 148, 136, 0.3);
          color: #f1f5f9;
        }

        .ai-sparkle-icon {
          color: var(--teal-600);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .card-footer-action {
          padding-top: 14px;
          border-top: 1px solid var(--border-color);
          text-align: center;
        }

        .card-action-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--teal-600);
        }

        .card-action-link:hover {
          color: var(--teal-700);
          text-decoration: underline;
        }

        /* Floating Badges */
        .floating-badge {
          position: absolute;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 10px 16px;
          box-shadow: var(--shadow-lg);
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 3;
          animation: floatSlow 4s ease-in-out infinite alternate;
        }

        .badge-top-right {
          top: -20px;
          right: -20px;
        }

        .badge-bottom-left {
          bottom: -20px;
          left: -20px;
          animation-delay: -2s;
        }

        @keyframes floatSlow {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-8px); }
        }

        .badge-icon-gold {
          color: #f59e0b;
        }

        .badge-icon-teal {
          color: var(--teal-600);
        }

        .floating-title {
          font-size: 0.82rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .floating-desc {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        /* Responsive */
        @media (max-width: 960px) {
          .hero-container {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          .hero-title {
            font-size: 2.6rem;
          }

          .badge-top-right {
            right: 0;
            top: -10px;
          }

          .badge-bottom-left {
            left: 0;
            bottom: -10px;
          }
        }

        @media (max-width: 640px) {
          .hero-title {
            font-size: 2.1rem;
          }
          .floating-badge {
            display: none;
          }
        }
      `}</style>
    </section>
  );
};
