'use client';

import React from 'react';
import { 
  Building2,
  Bot, 
  ShieldCheck, 
  Zap, 
  Lock, 
  TrendingDown, 
  FileCheck, 
  CheckCircle,
  Sparkles
} from 'lucide-react';

export const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: Building2,
      title: '339K+ Company Category Search',
      desc: 'Instant employer risk tier lookup across HDFC, ICICI, SBI & Axis to unlock up to 0.35% lower ROI and higher loan multipliers.'
    },
    {
      icon: Zap,
      title: 'Real-Time Dynamic Math',
      desc: 'Instant slider-driven recalculation of EMIs, interest totals, and amortization schedules with zero lag.'
    },
    {
      icon: ShieldCheck,
      title: 'Zero Credit Impact',
      desc: 'Simulate loan eligibility and Debt-to-Income scenarios safely without leaving hard inquiries on your credit history.'
    },
    {
      icon: Bot,
      title: 'AI Underwriting Advisor',
      desc: 'Get personalized suggestions to improve your FOIR ratio, optimize tenure, and maximize lender approvals.'
    },
    {
      icon: TrendingDown,
      title: 'Smart Prepayment Engine',
      desc: 'See exactly how partial prepayments or annual step-ups save thousands in compound interest over the loan life.'
    },
    {
      icon: Lock,
      title: 'Bank-Grade Security',
      desc: 'Industry-standard 256-bit encryption ensures your financial calculations remain private and confidential.'
    },
    {
      icon: FileCheck,
      title: '20+ Lender Alignment',
      desc: 'Algorithms benchmarked against credit policies from leading institutions like HDFC, SBI, ICICI, and Chase.'
    }
  ];

  return (
    <section id="features" className="features-section">
      <div className="container">
        <div className="section-head">
          <div className="section-badge">
            <Sparkles size={15} className="text-teal" />
            <span>Why Choose Us</span>
          </div>
          <h2 className="section-title">Built for Smarter Borrowing</h2>
          <p className="section-subtitle">
            Everything you need to make confident, data-backed loan decisions without confusing banking jargon or pushy sales calls.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={idx} className="feature-card glass-panel">
                <div className="feature-icon-box">
                  <Icon size={24} className="text-teal" />
                </div>
                <h3 className="feature-title">{feat.title}</h3>
                <p className="feature-desc">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .features-section {
          padding: 80px 0;
          background: var(--bg-primary);
        }

        .section-head {
          text-align: center;
          max-width: 680px;
          margin: 0 auto 52px auto;
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
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 28px;
        }

        .feature-card {
          border-radius: var(--radius-lg);
          padding: 30px;
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-xl);
          border-color: var(--teal-400);
        }

        .feature-icon-box {
          width: 52px;
          height: 52px;
          border-radius: var(--radius-md);
          background: var(--teal-50);
          border: 1px solid var(--teal-200);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        :global([data-theme='dark']) .feature-icon-box {
          background: rgba(13, 148, 136, 0.15);
          border-color: rgba(13, 148, 136, 0.35);
        }

        .feature-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 10px;
        }

        .feature-desc {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }
      `}</style>
    </section>
  );
};
