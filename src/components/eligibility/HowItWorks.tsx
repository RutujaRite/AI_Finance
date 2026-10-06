'use client';

import React, { useState } from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRightLeft,
  Percent,
  Award
} from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is FOIR (Fixed Obligation to Income Ratio) and how do banks use it?',
    answer:
      'FOIR represents the percentage of your monthly net income that is currently servicing or can be committed to loan repayments. Leading Indian banks typically cap FOIR between 50% and 75% depending on your monthly salary bracket (e.g. ₹50k–₹1L salary: 60% FOIR; >₹1L: 65%–70% FOIR; >₹2.5L: up to 75% FOIR).',
  },
  {
    question: 'How does Balance Transfer (BT) increase my maximum eligible loan amount?',
    answer:
      'When you opt for a Balance Transfer (BT), the new lender takes over and pays off your existing high-EMI loans directly. Because those existing loans are fully settled at disbursal, their EMIs are excluded from your ongoing obligations. This frees up monthly repayment bandwidth, allowing the bank to sanction a significantly higher loan amount.',
  },
  {
    question: 'What is "Self Closure" and how is it different from Balance Transfer?',
    answer:
      '"Self Closure" means the applicant undertakes to close an existing loan using their own savings or bonuses prior to the loan disbursal. Like BT, the closed loan EMI is removed from existing obligations, but the new lender does not need to pay out funds for takeover.',
  },
  {
    question: 'What is the Salary Multiplier method vs the FOIR Present Value method?',
    answer:
      'The Salary Multiplier method calculates maximum eligibility as a straight multiple of your considered net salary (typically 18x to 27x). The FOIR Present Value (PV) method calculates the actual loan amount that can be financed by your remaining available EMI capacity over the chosen tenure and interest rate. Most banks approve the lower or higher of the two based on your CIBIL score and employer category.',
  },
  {
    question: 'Does my CIBIL credit score change the FOIR or interest rate offered?',
    answer:
      'Yes! A prime credit score of 750+ qualifies you for the highest permissible FOIR (up to 70%–75%), minimum processing fees, and prime interest rates (10.5%–11.0% p.a.). Scores below 700 may restrict FOIR to 50% or require co-applicants.',
  },
];

export const HowItWorks: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="card how-it-works-card">
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-icon-wrapper bg-blue-subtle text-blue-600">
            <BookOpen size={20} />
          </div>
          <div>
            <h3 className="card-title">Banking Underwriting Guide & Methodologies</h3>
            <p className="card-subtitle">
              Learn how commercial lenders evaluate eligibility, FOIR ceilings, and loan consolidation
            </p>
          </div>
        </div>

        <span className="badge-pill badge-primary">Knowledge Hub</span>
      </div>

      <div className="card-body">
        {/* Core Concepts Grid */}
        <div className="concepts-grid">
          <div className="concept-box">
            <div className="concept-icon-box text-teal-600">
              <Percent size={22} />
            </div>
            <h4 className="concept-title">1. FOIR Limit Rule</h4>
            <p className="concept-text">
              Banks never let total debt payments exceed 50%–75% of net income. This ensures you have adequate liquidity for living expenses, rent, and family needs.
            </p>
          </div>

          <div className="concept-box">
            <div className="concept-icon-box text-blue-600">
              <ArrowRightLeft size={22} />
            </div>
            <h4 className="concept-title">2. Balance Transfer Boost</h4>
            <p className="concept-text">
              Consolidating multiple high-interest EMIs into one long-tenure personal loan slashes your monthly outflow, instantly boosting your net eligible borrowing capacity.
            </p>
          </div>

          <div className="concept-box">
            <div className="concept-icon-box text-purple-600">
              <TrendingUp size={22} />
            </div>
            <h4 className="concept-title">3. Multiplier Cap</h4>
            <p className="concept-text">
              Lenders benchmark personal loans at 18x to 27x of net salary. Super-prime tier corporate employees (TCS, Infosys, Google, etc.) can access up to 30x salary multipliers.
            </p>
          </div>
        </div>

        {/* FAQs Section */}
        <div className="faqs-wrapper">
          <h4 className="faqs-heading">
            <HelpCircle size={18} className="text-blue-600" />
            Frequently Asked Questions
          </h4>

          <div className="faqs-list">
            {FAQ_ITEMS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={faq.question} className={`faq-item ${isOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => toggleFaq(idx)}
                  >
                    <span className="faq-q-text">{faq.question}</span>
                    <span className="faq-icon-arrow">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="faq-answer-panel">
                      <p className="faq-a-text">{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .how-it-works-card {
          background: var(--bg-surface, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: var(--radius-lg, 16px);
          box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.05));
          overflow: hidden;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }

        .card-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .card-icon-wrapper {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #2563eb;
        }

        :global([data-theme='dark']) .card-icon-wrapper {
          background: rgba(37, 99, 235, 0.18);
          color: #60a5fa;
        }

        .card-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
          margin-bottom: 2px;
        }

        .card-subtitle {
          font-size: 0.82rem;
          color: var(--text-muted, #64748b);
        }

        .badge-pill {
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .badge-primary {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
        }

        :global([data-theme='dark']) .badge-primary {
          background: rgba(37, 99, 235, 0.2);
          color: #93c5fd;
        }

        .card-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .concepts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 18px;
        }

        .concept-box {
          background: var(--bg-subtle, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: all 0.2s ease;
        }

        :global([data-theme='dark']) .concept-box {
          background: #141c2e;
        }

        .concept-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .concept-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: var(--bg-surface, #ffffff);
          border: 1px solid var(--border-color, #cbd5e1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .concept-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
        }

        .concept-text {
          font-size: 0.82rem;
          color: var(--text-secondary, #475569);
          line-height: 1.5;
        }

        .faqs-wrapper {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .faqs-heading {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .faqs-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .faq-item {
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 10px;
          overflow: hidden;
          background: var(--bg-surface, #ffffff);
          transition: all 0.15s ease;
        }

        .faq-item.open {
          border-color: #93c5fd;
        }

        .faq-question-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          text-align: left;
          background: var(--bg-surface, #ffffff);
          color: var(--text-primary, #0f172a);
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
        }

        .faq-question-btn:hover {
          background: var(--bg-hover, #f8fafc);
        }

        .faq-q-text {
          flex: 1;
        }

        .faq-icon-arrow {
          color: var(--text-muted, #64748b);
          margin-left: 12px;
        }

        .faq-answer-panel {
          padding: 0 18px 16px 18px;
          border-top: 1px solid var(--border-color, #e2e8f0);
          background: var(--bg-subtle, #f8fafc);
        }

        :global([data-theme='dark']) .faq-answer-panel {
          background: #141c2e;
        }

        .faq-a-text {
          font-size: 0.82rem;
          color: var(--text-secondary, #475569);
          line-height: 1.55;
          padding-top: 12px;
        }
      `}</style>
    </div>
  );
};
