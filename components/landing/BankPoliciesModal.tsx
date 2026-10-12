'use client';

import React, { useState } from 'react';
import { X, FileText, CheckCircle2, ShieldCheck, Percent, Building, Layers } from 'lucide-react';
import { BANK_POLICIES } from '@/data/mockData';
import { BankPolicy } from '@/types';

interface BankPoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBankId?: string;
}

export const BankPoliciesModal: React.FC<BankPoliciesModalProps> = ({
  isOpen,
  onClose,
  selectedBankId,
}) => {
  const [activeBankId, setActiveBankId] = useState<string>(selectedBankId || 'hdfc');

  React.useEffect(() => {
    if (selectedBankId) {
      setActiveBankId(selectedBankId);
    }
  }, [selectedBankId]);

  if (!isOpen) return null;

  const activePolicy: BankPolicy = 
    BANK_POLICIES.find(p => p.id === activeBankId) || BANK_POLICIES[0];

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-policy-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-badge-title">
            <div className="policy-badge-icon">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="header-title">Live Bank Policy Guidelines & Underwriting</h2>
              <p className="header-desc">Standardized underwriting criteria across top tier partner institutions</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn" type="button">
            <X size={18} />
          </button>
        </div>

        {/* Bank Selector Tabs */}
        <div className="bank-tabs-bar">
          {BANK_POLICIES.map((bank) => (
            <button
              key={bank.id}
              onClick={() => setActiveBankId(bank.id)}
              className={`bank-tab-item ${activeBankId === bank.id ? 'active' : ''}`}
              type="button"
            >
              <span className="bank-code">{bank.code}</span>
              <span className="bank-full-name">{bank.bankName}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="policy-details-body">
          {/* Top Key Metrics Row */}
          <div className="policy-metrics-grid">
            <div className="policy-metric-box">
              <span className="pm-label">Min CIBIL Score</span>
              <div className="pm-value">{activePolicy.minCibil}+</div>
              <span className="pm-note">Bureau score required</span>
            </div>

            <div className="policy-metric-box">
              <span className="pm-label">Max FOIR Multiplier</span>
              <div className="pm-value">{activePolicy.maxFoir}%</div>
              <span className="pm-note">Fixed Obligation Income</span>
            </div>

            <div className="policy-metric-box">
              <span className="pm-label">Min Net Salary</span>
              <div className="pm-value">₹{(activePolicy.minSalary / 1000).toFixed(0)}k/mo</div>
              <span className="pm-note">Credited to Bank A/c</span>
            </div>

            <div className="policy-metric-box">
              <span className="pm-label">ROI Range</span>
              <div className="pm-value pm-roi">{activePolicy.roiRange}</div>
              <span className="pm-note">Floating benchmark</span>
            </div>
          </div>

          {/* Employer Categories & Fee Details */}
          <div className="policy-two-col">
            <div className="policy-card-panel">
              <h4 className="panel-title">
                <Layers size={16} />
                <span>Eligible Employer Categories</span>
              </h4>
              <div className="category-tags-list">
                {activePolicy.employerCategories.map(cat => (
                  <span key={cat} className="category-pill">{cat}</span>
                ))}
              </div>
              <div className="fee-info-row">
                <span className="fee-label">Processing Fee:</span>
                <span className="fee-val">{activePolicy.processingFee}</span>
              </div>
            </div>

            <div className="policy-card-panel">
              <h4 className="panel-title">
                <ShieldCheck size={16} />
                <span>Underwriting Highlights & Exceptions</span>
              </h4>
              <ul className="special-rules-list">
                {activePolicy.specialRules.map((rule, idx) => (
                  <li key={idx} className="rule-item">
                    <CheckCircle2 size={15} className="rule-check" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-policy-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 820px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .modal-header {
          padding: 1.25rem 1.75rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-badge-title {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .policy-badge-icon {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          background: #fce7f3;
          color: #db2777;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        [data-theme='dark'] .policy-badge-icon {
          background: rgba(219, 39, 119, 0.2);
          color: #f472b6;
        }

        .header-title {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .header-desc {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .modal-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bank-tabs-bar {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem 1.75rem;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          overflow-x: auto;
        }

        .bank-tab-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.9rem;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          font-size: 0.825rem;
          color: var(--text-secondary);
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .bank-tab-item.active {
          background: var(--primary-50);
          color: var(--primary-600);
          border-color: var(--primary-500);
          font-weight: 700;
        }

        .bank-code {
          font-weight: 800;
        }

        .policy-details-body {
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .policy-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .policy-metric-box {
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 1rem;
          text-align: center;
        }

        .pm-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .pm-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0.35rem 0 0.15rem;
        }

        .pm-roi {
          font-size: 1.15rem;
          color: var(--primary-600);
        }

        .pm-note {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .policy-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        .policy-card-panel {
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 1.25rem;
        }

        .panel-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.85rem;
        }

        .category-tags-list {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .category-pill {
          font-size: 0.75rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          padding: 0.25rem 0.55rem;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
        }

        .fee-info-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          padding-top: 0.65rem;
          border-top: 1px dashed var(--border-color);
        }

        .fee-label {
          color: var(--text-muted);
        }

        .fee-val {
          font-weight: 700;
          color: var(--text-primary);
        }

        .special-rules-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .rule-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .rule-check {
          color: var(--accent-emerald);
          flex-shrink: 0;
          margin-top: 2px;
        }

        @media (max-width: 768px) {
          .policy-metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .policy-two-col {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
