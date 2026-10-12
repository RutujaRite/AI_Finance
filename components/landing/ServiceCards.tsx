'use client';

import React, { useState } from 'react';
import { 
  Bot, 
  Calculator, 
  FileText, 
  Users, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Search, 
  Sliders, 
  Building2,
  PhoneCall,
  Clock
} from 'lucide-react';

interface ServiceCardsProps {
  onOpenAIWithPrompt: (prompt: string) => void;
  onOpenEMI: () => void;
  onOpenPolicies: (bankId?: string) => void;
  onOpenManagers: (city?: string) => void;
}

export const ServiceCards: React.FC<ServiceCardsProps> = ({
  onOpenAIWithPrompt,
  onOpenEMI,
  onOpenPolicies,
  onOpenManagers,
}) => {
  // Card 2 interactive slider demo
  const [demoPrincipal, setDemoPrincipal] = useState(500000);
  const demoRate = 8.5;
  const demoTenure = 60; // 5 years

  const calcMonthlyEmi = (principal: number, annualRate: number, months: number) => {
    const monthlyRate = annualRate / (12 * 100);
    return Math.round(
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1)
    );
  };

  const currentEmi = calcMonthlyEmi(demoPrincipal, demoRate, demoTenure);

  // Card 4 quick search state
  const [managerSearchQuery, setManagerSearchQuery] = useState('');

  return (
    <section className="services-section">
      <div className="section-header-row">
        <div>
          <span className="section-eyebrow">EXPLORE DASHBOARD TOOLS</span>
          <h2 className="section-title">Application Services & Underwriting Suite</h2>
        </div>
        <p className="section-subtitle">
          Intelligent automated banking tools designed to streamline loan sourcing, policy verification, and client conversion.
        </p>
      </div>

      <div className="services-grid">
        {/* CARD 1: AI Loan Assistant */}
        <div className="service-card ai-card">
          <div className="card-top-header">
            <div className="service-icon-box ai-icon-box">
              <Bot size={22} className="card-service-icon" />
            </div>
            <span className="service-tag tag-ai">
              <Sparkles size={12} className="tag-sparkle" />
              AI Powered
            </span>
          </div>

          <div className="card-body">
            <h3 className="card-title">AI Loan Assistant</h3>
            <p className="card-description">
              Ask natural language questions about loan eligibility, employer ratings, interest rates, and required documentation.
            </p>

            <div className="prompt-chips-container">
              <span className="chips-label">Quick query examples:</span>
              <button 
                onClick={() => onOpenAIWithPrompt('Calculate EMI for 5L home loan at 9.5%')}
                className="prompt-chip"
                type="button"
              >
                <span className="chip-bullet">•</span>
                <span>Calculate EMI for 5L home loan at 9.5%</span>
              </button>
              <button 
                onClick={() => onOpenAIWithPrompt('Loan processing fees & charges')}
                className="prompt-chip"
                type="button"
              >
                <span className="chip-bullet">•</span>
                <span>Loan processing fees & charges</span>
              </button>
              <button 
                onClick={() => onOpenAIWithPrompt('Find ICICI manager details in Pune')}
                className="prompt-chip"
                type="button"
              >
                <span className="chip-bullet">•</span>
                <span>Find ICICI manager details in Pune</span>
              </button>
            </div>
          </div>

          <div className="card-footer">
            <button 
              onClick={() => onOpenAIWithPrompt('')}
              className="card-cta-btn"
              type="button"
            >
              <span>Chat with Assistant</span>
              <ArrowRight size={16} className="cta-arrow" />
            </button>
          </div>
        </div>

        {/* CARD 2: EMI Calculator */}
        <div className="service-card emi-card">
          <div className="card-top-header">
            <div className="service-icon-box emi-icon-box">
              <Calculator size={22} className="card-service-icon" />
            </div>
            <span className="service-tag tag-interactive">
              <Sliders size={12} />
              Interactive
            </span>
          </div>

          <div className="card-body">
            <h3 className="card-title">EMI Calculator</h3>
            <p className="card-description">
              Calculate accurate monthly EMI, principal vs interest breakdown, and export or print complete amortization tables.
            </p>

            {/* Interactive Live Mini Calculator */}
            <div className="mini-calculator-box">
              <div className="calc-slider-header">
                <span className="calc-spec-label">Loan Amount</span>
                <span className="calc-spec-val">₹{(demoPrincipal / 100000).toFixed(1)} Lakh</span>
              </div>
              <input 
                type="range" 
                min={100000} 
                max={5000000} 
                step={50000}
                value={demoPrincipal} 
                onChange={(e) => setDemoPrincipal(Number(e.target.value))}
                className="demo-range-slider"
              />

              <div className="calc-result-row">
                <div>
                  <span className="calc-result-label">Monthly EMI</span>
                  <div className="calc-result-number">₹{currentEmi.toLocaleString('en-IN')}<span className="calc-per-mo"> / mo</span></div>
                </div>
                <div className="calc-rate-badge">
                  <span>8.5% • 5 Yrs</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card-footer">
            <button 
              onClick={onOpenEMI}
              className="card-cta-btn"
              type="button"
            >
              <span>Open EMI Calculator</span>
              <ArrowRight size={16} className="cta-arrow" />
            </button>
          </div>
        </div>

        {/* CARD 3: Bank Policy Guidelines */}
        <div className="service-card policy-card">
          <div className="card-top-header">
            <div className="service-icon-box policy-icon-box">
              <FileText size={22} className="card-service-icon" />
            </div>
            <span className="service-tag tag-rules">
              <Building2 size={12} />
              Bank Rules
            </span>
          </div>

          <div className="card-body">
            <h3 className="card-title">Bank Policy Guidelines</h3>
            <p className="card-description">
              Explore underwriting policy guidelines, FOIR multipliers, minimum salary requirements, and view official bank documents.
            </p>

            <div className="policy-highlights-box">
              <div className="policy-spec-row">
                <span className="spec-title">Bank Coverage</span>
                <div className="bank-badges-row">
                  {['HDFC', 'ICICI', 'SBI', 'Axis'].map(b => (
                    <button 
                      key={b} 
                      onClick={() => onOpenPolicies(b.toLowerCase())}
                      className="bank-mini-pill"
                      type="button"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="policy-criteria-list">
                <div className="criteria-item">
                  <CheckCircle2 size={14} className="criteria-check" />
                  <span>CIBIL, FOIR, multipliers & policy statements</span>
                </div>
                <div className="criteria-item">
                  <CheckCircle2 size={14} className="criteria-check" />
                  <span>Instant eligibility checker with net salary</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card-footer">
            <button 
              onClick={() => onOpenPolicies()}
              className="card-cta-btn"
              type="button"
            >
              <span>View Bank Policies</span>
              <ArrowRight size={16} className="cta-arrow" />
            </button>
          </div>
        </div>

        {/* CARD 4: Bank Managers */}
        <div className="service-card managers-card">
          <div className="card-top-header">
            <div className="service-icon-box managers-icon-box">
              <Users size={22} className="card-service-icon" />
            </div>
            <span className="service-tag tag-directory">
              <PhoneCall size={12} />
              Directory
            </span>
          </div>

          <div className="card-body">
            <h3 className="card-title">Bank Managers</h3>
            <p className="card-description">
              Locate verified branch managers, regional credit officers, and loan executives in your target city.
            </p>

            <div className="manager-preview-box">
              <div className="manager-stat-row">
                <span className="manager-spec-label">City Coverage</span>
                <span className="manager-pan-badge">Pan-India (Tier 1-3)</span>
              </div>

              {/* Quick city filter chips */}
              <div className="manager-city-chips">
                {['Pune', 'Mumbai', 'Delhi', 'Bengaluru'].map(city => (
                  <button 
                    key={city}
                    onClick={() => onOpenManagers(city)}
                    className="city-filter-chip"
                    type="button"
                  >
                    {city}
                  </button>
                ))}
              </div>

              <div className="manager-info-line">
                <Clock size={13} className="info-icon" />
                <span>Phone, email, and direct branch escalation matrix</span>
              </div>
            </div>
          </div>

          <div className="card-footer">
            <button 
              onClick={() => onOpenManagers()}
              className="card-cta-btn"
              type="button"
            >
              <span>Search Bank Managers</span>
              <ArrowRight size={16} className="cta-arrow" />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .services-section {
          max-width: 1360px;
          margin: 0 auto;
          padding: 1.5rem 1.5rem 3rem;
        }

        .section-header-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 2rem;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .section-eyebrow {
          display: block;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--primary-500);
          margin-bottom: 0.35rem;
        }

        .section-title {
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary);
        }

        .section-subtitle {
          max-width: 480px;
          font-size: 0.875rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
        }

        .service-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 1.6rem 1.4rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: var(--shadow-sm);
          transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }

        .service-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-xl);
          border-color: #cbd5e1;
        }

        [data-theme='dark'] .service-card:hover {
          border-color: #3b82f6;
        }

        .card-top-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
        }

        .service-icon-box {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ai-icon-box {
          background: #eff6ff;
          color: #2563eb;
        }
        .emi-icon-box {
          background: #f0fdf4;
          color: #16a34a;
        }
        .policy-icon-box {
          background: #fdf2f8;
          color: #db2777;
        }
        .managers-icon-box {
          background: #f5f3ff;
          color: #7c3aed;
        }

        [data-theme='dark'] .ai-icon-box { background: rgba(37, 99, 235, 0.2); }
        [data-theme='dark'] .emi-icon-box { background: rgba(22, 163, 74, 0.2); }
        [data-theme='dark'] .policy-icon-box { background: rgba(219, 39, 119, 0.2); }
        [data-theme='dark'] .managers-icon-box { background: rgba(124, 58, 237, 0.2); }

        .service-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 0.25rem 0.65rem;
          border-radius: var(--radius-full);
        }

        .tag-ai {
          background: #dbeafe;
          color: #1e40af;
        }
        .tag-interactive {
          background: #dcfce7;
          color: #15803d;
        }
        .tag-rules {
          background: #fce7f3;
          color: #9d174d;
        }
        .tag-directory {
          background: #ede9fe;
          color: #6d28d9;
        }

        [data-theme='dark'] .tag-ai { background: #1e3a8a; color: #93c5fd; }
        [data-theme='dark'] .tag-interactive { background: #14532d; color: #86efac; }
        [data-theme='dark'] .tag-rules { background: #831843; color: #fbcfe8; }
        [data-theme='dark'] .tag-directory { background: #4c1d95; color: #c4b5fd; }

        .card-body {
          flex-grow: 1;
          margin-bottom: 1.5rem;
        }

        .card-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
          letter-spacing: -0.01em;
        }

        .card-description {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 1.25rem;
        }

        /* Card 1 prompts */
        .prompt-chips-container {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .chips-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 0.2rem;
        }

        .prompt-chip {
          text-align: left;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 0.45rem 0.65rem;
          font-size: 0.775rem;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          transition: all 0.18s ease;
        }

        .prompt-chip:hover {
          background: var(--primary-50);
          border-color: var(--primary-500);
          color: var(--primary-600);
          transform: translateX(2px);
        }

        .chip-bullet {
          color: var(--primary-500);
          font-weight: bold;
        }

        /* Card 2 mini interactive calculator */
        .mini-calculator-box {
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 0.85rem;
        }

        .calc-slider-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.78rem;
          margin-bottom: 0.35rem;
        }

        .calc-spec-label {
          color: var(--text-muted);
          font-weight: 600;
        }

        .calc-spec-val {
          color: var(--primary-600);
          font-weight: 700;
        }

        .demo-range-slider {
          width: 100%;
          accent-color: var(--primary-500);
          cursor: pointer;
          margin-bottom: 0.75rem;
        }

        .calc-result-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 0.5rem;
          border-top: 1px dashed var(--border-color);
        }

        .calc-result-label {
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .calc-result-number {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .calc-per-mo {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted);
        }

        .calc-rate-badge {
          font-size: 0.72rem;
          font-weight: 600;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
        }

        /* Card 3 Policy highlights */
        .policy-highlights-box {
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .policy-spec-row {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .spec-title {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .bank-badges-row {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }

        .bank-mini-pill {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.25rem 0.55rem;
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          transition: all 0.18s ease;
        }

        .bank-mini-pill:hover {
          border-color: var(--primary-500);
          color: var(--primary-500);
          transform: translateY(-1px);
        }

        .policy-criteria-list {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .criteria-item {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .criteria-check {
          color: var(--accent-emerald);
          flex-shrink: 0;
        }

        /* Card 4 Managers preview */
        .manager-preview-box {
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .manager-stat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .manager-spec-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .manager-pan-badge {
          font-size: 0.7rem;
          font-weight: 700;
          color: #7c3aed;
          background: #ede9fe;
          padding: 0.15rem 0.45rem;
          border-radius: var(--radius-sm);
        }

        [data-theme='dark'] .manager-pan-badge {
          background: #4c1d95;
          color: #c4b5fd;
        }

        .manager-city-chips {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }

        .city-filter-chip {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }

        .city-filter-chip:hover {
          background: var(--primary-50);
          color: var(--primary-600);
          border-color: var(--primary-200);
        }

        .manager-info-line {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .info-icon {
          flex-shrink: 0;
        }

        /* Footer CTA Buttons */
        .card-footer {
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .card-cta-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--primary-600);
          padding: 0.5rem 0.25rem;
          transition: all 0.2s ease;
        }

        .card-cta-btn:hover {
          color: var(--primary-700);
        }

        .cta-arrow {
          transition: transform 0.2s ease;
        }

        .card-cta-btn:hover .cta-arrow {
          transform: translateX(4px);
        }

        @media (max-width: 1200px) {
          .services-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .section-header-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }
        }

        @media (max-width: 640px) {
          .services-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
};
