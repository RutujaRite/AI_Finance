'use client';

import React, { useState } from 'react';
import { 
  Building2, 
  TrendingUp, 
  CheckCircle, 
  ExternalLink, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  Percent
} from 'lucide-react';

interface BankRate {
  id: string;
  name: string;
  logoCode: string;
  bgColor: string;
  textColor: string;
  minRoi: string;
  maxTenure: string;
  processingFee: string;
  cibilMin: number;
  perk: string;
  popular?: boolean;
}

const BANKS_DATA: BankRate[] = [
  {
    id: 'sbi',
    name: 'State Bank of India',
    logoCode: 'SBI',
    bgColor: '#e0f2fe',
    textColor: '#0284c7',
    minRoi: '8.35%',
    maxTenure: '30 Years',
    processingFee: '0.35% (Max ₹10k)',
    cibilMin: 680,
    perk: 'Special 5 bps discount for women borrowers & lowest processing fees',
    popular: true
  },
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    logoCode: 'HDFC',
    bgColor: '#fee2e2',
    textColor: '#dc2626',
    minRoi: '8.40%',
    maxTenure: '30 Years',
    processingFee: '0.50% (Max ₹15k)',
    cibilMin: 720,
    perk: 'Fast-track digital approvals within 48 hours for salaried applicants',
    popular: true
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    logoCode: 'ICICI',
    bgColor: '#ffedd5',
    textColor: '#ea580c',
    minRoi: '8.45%',
    maxTenure: '30 Years',
    processingFee: '0.50%',
    cibilMin: 700,
    perk: 'Pre-approved digital sanction letter in 3 minutes via netbanking'
  },
  {
    id: 'axis',
    name: 'Axis Bank',
    logoCode: 'AXIS',
    bgColor: '#fce7f3',
    textColor: '#be185d',
    minRoi: '8.55%',
    maxTenure: '30 Years',
    processingFee: '0.50% (Max ₹10k)',
    cibilMin: 710,
    perk: 'Shubh Aarambh benefit: 12 EMI waivers on timely regular repayments'
  },
  {
    id: 'chase',
    name: 'Chase Mortgage Premier',
    logoCode: 'CHASE',
    bgColor: '#e0e7ff',
    textColor: '#4338ca',
    minRoi: '6.85%',
    maxTenure: '30 Years',
    processingFee: '$995 Fixed',
    cibilMin: 680,
    perk: '$5,000 on-time closing guarantee & relationship discounts'
  }
];

export const BankRatesSection: React.FC = () => {
  const [filterCibil, setFilterCibil] = useState<number>(680);

  const filteredBanks = BANKS_DATA.filter(b => b.cibilMin <= filterCibil);

  return (
    <section id="bank-rates" className="bank-rates-section">
      <div className="container">
        <div className="section-head">
          <div className="section-badge">
            <TrendingUp size={15} className="text-teal" />
            <span>Live Lending Benchmark</span>
          </div>
          <h2 className="section-title">Compare Leading Bank Rates</h2>
          <p className="section-subtitle">
            We continuously track real-time underwriting policies, interest spreads, and processing concessions across partner institutions.
          </p>

          {/* Filter by Credit Score */}
          <div className="credit-score-filter">
            <span className="filter-label">Filter by Your Credit / CIBIL Score:</span>
            <div className="filter-pills">
              <button 
                type="button" 
                onClick={() => setFilterCibil(680)}
                className={`cibil-pill ${filterCibil === 680 ? 'active' : ''}`}
              >
                680+ (Standard)
              </button>
              <button 
                type="button" 
                onClick={() => setFilterCibil(700)}
                className={`cibil-pill ${filterCibil === 700 ? 'active' : ''}`}
              >
                700+ (Good)
              </button>
              <button 
                type="button" 
                onClick={() => setFilterCibil(750)}
                className={`cibil-pill ${filterCibil === 750 ? 'active' : ''}`}
              >
                750+ (Excellent)
              </button>
            </div>
          </div>
        </div>

        {/* Bank Cards Grid */}
        <div className="banks-grid">
          {filteredBanks.map((bank) => (
            <div key={bank.id} className={`bank-card glass-panel ${bank.popular ? 'popular-glow' : ''}`}>
              {bank.popular && (
                <div className="popular-ribbon">
                  <Sparkles size={12} />
                  <span>Lowest Rate Pick</span>
                </div>
              )}

              <div className="bank-card-top">
                <div 
                  className="bank-logo-badge" 
                  style={{ backgroundColor: bank.bgColor, color: bank.textColor }}
                >
                  {bank.logoCode}
                </div>
                <div className="bank-meta">
                  <h4 className="bank-name">{bank.name}</h4>
                  <span className="cibil-req">Min Credit Score: {bank.cibilMin}</span>
                </div>
              </div>

              {/* Rate Highlight */}
              <div className="rate-highlight-box">
                <div className="rate-col">
                  <span className="rate-label">Starting APR</span>
                  <span className="rate-val">{bank.minRoi}</span>
                </div>
                <div className="rate-col">
                  <span className="rate-label">Max Tenure</span>
                  <span className="rate-val">{bank.maxTenure}</span>
                </div>
                <div className="rate-col">
                  <span className="rate-label">Fee</span>
                  <span className="rate-val-fee">{bank.processingFee}</span>
                </div>
              </div>

              {/* Perk */}
              <div className="bank-perk-row">
                <CheckCircle size={15} className="text-teal" />
                <span className="perk-text">{bank.perk}</span>
              </div>

              {/* CTA */}
              <a href="#emi-calculator" className="bank-calc-link">
                <span>Calculate EMI for {bank.name}</span>
                <ArrowRight size={14} />
              </a>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .bank-rates-section {
          padding: 80px 0;
          background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg-primary) 100%);
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

        .credit-score-filter {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .filter-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .filter-pills {
          display: flex;
          gap: 8px;
        }

        .cibil-pill {
          padding: 6px 14px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          transition: all 0.2s ease;
        }

        .cibil-pill.active {
          border-color: var(--teal-600);
          background: var(--teal-600);
          color: #ffffff;
        }

        /* Banks Grid */
        .banks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
        }

        .bank-card {
          position: relative;
          border-radius: var(--radius-lg);
          padding: 24px;
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 18px;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .bank-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-lg);
        }

        .popular-glow {
          border-color: var(--teal-400);
          box-shadow: var(--shadow-teal);
        }

        .popular-ribbon {
          position: absolute;
          top: -12px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, #0d9488, #2563eb);
          color: #ffffff;
          font-size: 0.72rem;
          font-weight: 800;
        }

        .bank-card-top {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .bank-logo-badge {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.95rem;
          letter-spacing: -0.02em;
        }

        .bank-meta {
          display: flex;
          flex-direction: column;
        }

        .bank-name {
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .cibil-req {
          font-size: 0.76rem;
          color: var(--text-muted);
        }

        /* Rate Highlight */
        .rate-highlight-box {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          padding: 12px 14px;
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
        }

        .rate-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .rate-label {
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .rate-val {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--teal-600);
        }

        .rate-val-fee {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .bank-perk-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 0.82rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .bank-calc-link {
          margin-top: auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.84rem;
          font-weight: 700;
          color: var(--teal-600);
          padding-top: 10px;
          border-top: 1px solid var(--border-color);
        }

        .bank-calc-link:hover {
          color: var(--teal-700);
          text-decoration: underline;
        }
      `}</style>
    </section>
  );
};
