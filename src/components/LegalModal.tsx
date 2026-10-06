'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  FileText, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  Scale, 
  Eye,
  Calendar,
  Building2,
  Printer
} from 'lucide-react';

export type LegalDocType = 'privacy' | 'terms' | 'security';

interface LegalModalProps {
  isOpen: boolean;
  initialDoc?: LegalDocType;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialDoc = 'privacy',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalDocType>(initialDoc);

  useEffect(() => {
    if (initialDoc) {
      setActiveTab(initialDoc);
    }
  }, [initialDoc]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-container glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-title-box">
            <Scale size={20} className="text-teal" />
            <div>
              <h2 className="header-title">Legal & Security Governance</h2>
              <span className="last-updated">Last Updated: October 2026 • Version 2.4</span>
            </div>
          </div>

          <div className="header-actions">
            <button 
              type="button" 
              onClick={() => window.print()}
              className="print-action-btn"
              title="Print this document"
            >
              <Printer size={16} />
              <span>Print</span>
            </button>
            <button 
              type="button" 
              onClick={onClose}
              className="close-modal-btn"
              aria-label="Close legal modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="legal-tabs-bar">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`legal-tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
          >
            <Eye size={16} />
            <span>Privacy Policy</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`legal-tab-btn ${activeTab === 'terms' ? 'active' : ''}`}
          >
            <FileText size={16} />
            <span>Terms of Service</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`legal-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          >
            <Lock size={16} />
            <span>Security Statement</span>
          </button>
        </div>

        {/* Scrollable Document Content */}
        <div className="document-content-scroll">
          {/* ================= PRIVACY POLICY ================= */}
          {activeTab === 'privacy' && (
            <div className="document-body animate-fade-in">
              <div className="doc-hero-badge">
                <ShieldCheck size={18} className="text-teal" />
                <span>Zero Telemarketing Guarantee • 100% Data Confidentiality</span>
              </div>

              <h3 className="doc-section-title">1. Introduction</h3>
              <p>
                At <strong>CreditWiseAI</strong> (operated by <strong>InCraax AI Automation</strong>), protecting your privacy and confidential financial data is our highest priority. This Privacy Policy details our transparent practices regarding data collection, real-time algorithmic calculation, and protection when you interact with our AI loan calculators, amortization tools, and banking comparison features.
              </p>

              <h3 className="doc-section-title">2. Information We Process</h3>
              <ul className="doc-list">
                <li>
                  <strong>Anonymous Financial Parameters:</strong> Loan amounts, tenures, expected interest rates, monthly income brackets, and existing obligations entered into real-time calculators.
                </li>
                <li>
                  <strong>Account Information:</strong> When you register or save calculation portfolios, we collect your name, encrypted credentials, and email address to preserve your quotes.
                </li>
                <li>
                  <strong>Corporate Lookups:</strong> Employer search queries performed via our 339K+ corporate categorization engine to benchmark lender policy categories.
                </li>
              </ul>

              <h3 className="doc-section-title">3. No Hard Credit Inquiries Guarantee</h3>
              <div className="doc-alert-box alert-teal">
                <CheckCircle2 size={18} className="alert-icon" />
                <div>
                  <strong>Safe Soft Exploration:</strong> Using CreditWiseAI will never trigger a hard inquiry on your CIBIL, Equifax, Experian, or TransUnion credit profile. All estimates are calculated via client-side algorithms based on publicly benchmarked bank underwriting criteria.
                </div>
              </div>

              <h3 className="doc-section-title">4. Strict No-Sale & Anti-Spam Policy</h3>
              <p>
                We do not sell, rent, monetize, or transmit your contact details or financial figures to third-party telemarketers, insurance brokers, or unsolicited loan aggregators.
              </p>

              <h3 className="doc-section-title">5. Data Retention & Deletion</h3>
              <p>
                You may request complete deletion of your saved calculation quotes, account profile, and historical data at any time by accessing your account preferences or contacting our privacy officer at <code>privacy@creditwise.ai</code>.
              </p>
            </div>
          )}

          {/* ================= TERMS OF SERVICE ================= */}
          {activeTab === 'terms' && (
            <div className="document-body animate-fade-in">
              <div className="doc-hero-badge">
                <Scale size={18} className="text-teal" />
                <span>Informational Financial Tool Terms • Fair Usage Guidelines</span>
              </div>

              <h3 className="doc-section-title">1. Acceptance of Terms</h3>
              <p>
                By visiting, accessing, or utilizing <strong>CreditWiseAI</strong>, you agree to comply with and be legally bound by these Terms of Service. If you disagree with any part of these terms, please discontinue use of our calculations and advisory platform.
              </p>

              <h3 className="doc-section-title">2. Nature of Platform & Financial Disclaimer</h3>
              <div className="doc-alert-box alert-amber">
                <AlertTriangle size={18} className="alert-icon text-amber" />
                <div>
                  <strong>Informational Calculator Only:</strong> CreditWiseAI is an algorithmic simulation and financial planning interface. We are not a bank, non-banking financial company (NBFC), or licensed credit dispensary. All EMI math, FOIR ratios, and loan multipliers represent estimated approximations. Final loan sanction, loan-to-value (LTV), processing fees, and interest pricing remain subject to official bank underwriting, credit appraisal, and legal document verification by individual financial institutions.
                </div>
              </div>

              <h3 className="doc-section-title">3. Permitted & Acceptable Use</h3>
              <p>
                You are granted a revocable, non-exclusive, non-transferable license to use CreditWiseAI strictly for personal loan scenario evaluation or authorized client loan advisory. You agree not to:
              </p>
              <ul className="doc-list">
                <li>Deploy automated scrapers, bots, or extraction scripts to harvest data from our partner bank tables or company databases.</li>
                <li>Reverse-engineer or tamper with mathematical calculation routines or proprietary underwriting matrices.</li>
                <li>Submit intentionally fraudulent or impersonated identity records through registration forms.</li>
              </ul>

              <h3 className="doc-section-title">4. Intellectual Property Rights</h3>
              <p>
                All software algorithms, dynamic SVG amortization visualizations, design systems, trademarks, and content on CreditWiseAI are the exclusive proprietary property of <strong>InCraax AI Automation</strong> and are protected under international copyright and intellectual property treaties.
              </p>

              <h3 className="doc-section-title">5. Limitation of Liability</h3>
              <p>
                In no event shall InCraax AI Automation or its officers be liable for any indirect, consequential, or punitive damages resulting from loan application rejections, rate fluctuations initiated by third-party lenders, or decisions made based on calculator estimates.
              </p>
            </div>
          )}

          {/* ================= SECURITY STATEMENT ================= */}
          {activeTab === 'security' && (
            <div className="document-body animate-fade-in">
              <div className="doc-hero-badge">
                <Lock size={18} className="text-teal" />
                <span>Bank-Grade 256-Bit Cryptographic Standards • Zero-Trust Architecture</span>
              </div>

              <h3 className="doc-section-title">1. Security Architecture Overview</h3>
              <p>
                CreditWiseAI employs bank-grade security protocols designed to safeguard financial figures, user sessions, and API communications against unauthorized interception or tampering.
              </p>

              <div className="security-pillars-grid">
                <div className="security-pillar-card">
                  <div className="pillar-icon-box">
                    <Lock size={20} className="text-teal" />
                  </div>
                  <h4>256-Bit SSL/TLS Encryption</h4>
                  <p>All data exchanged between your browser and our servers is encrypted in transit using TLS 1.3 cryptographic protocols with modern cipher suites.</p>
                </div>

                <div className="security-pillar-card">
                  <div className="pillar-icon-box">
                    <ShieldCheck size={20} className="text-teal" />
                  </div>
                  <h4>Zero-Knowledge Computations</h4>
                  <p>Our EMI and amortization math is executed locally in your browser session whenever possible, eliminating server storage of draft calculations.</p>
                </div>

                <div className="security-pillar-card">
                  <div className="pillar-icon-box">
                    <CheckCircle2 size={20} className="text-teal" />
                  </div>
                  <h4>Strict Access Controls</h4>
                  <p>Administrative authentication requires multi-factor verification, rate limiting, and role-based permissions to prevent credential stuffing attacks.</p>
                </div>

                <div className="security-pillar-card">
                  <div className="pillar-icon-box">
                    <Building2 size={20} className="text-teal" />
                  </div>
                  <h4>Hardened Infrastructure</h4>
                  <p>Hosted on enterprise cloud infrastructure with continuous DDoS mitigation, automated vulnerability scanning, and isolated container execution.</p>
                </div>
              </div>

              <h3 className="doc-section-title">2. Vulnerability Disclosure & Audit</h3>
              <p>
                We welcome responsible security research. If you detect any potential vulnerability or anomaly within our platform, please notify our security engineering response team at <code>security@creditwise.ai</code>. We investigate all verifiable reports within 24 business hours.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="modal-footer">
          <div className="footer-left-info">
            <span>Operated by <strong>InCraax AI Automation</strong></span>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="btn-acknowledge"
          >
            <span>Close & Return to Platform</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 17, 34, 0.72);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }

        .modal-container {
          position: relative;
          width: 100%;
          max-width: 820px;
          max-height: 88vh;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl), 0 25px 60px -15px rgba(15, 23, 42, 0.35);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: popUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes popUp {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(12px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 28px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-surface);
        }

        .header-title-box {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .last-updated {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .print-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          transition: all 0.2s ease;
        }

        .print-action-btn:hover {
          background: var(--bg-hover);
          color: var(--teal-600);
        }

        .close-modal-btn {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-subtle);
          color: var(--text-muted);
          transition: all 0.2s ease;
        }

        .close-modal-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        /* Tabs */
        .legal-tabs-bar {
          display: flex;
          background: var(--bg-subtle);
          border-bottom: 1px solid var(--border-color);
          padding: 4px 28px;
          gap: 8px;
        }

        .legal-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: var(--radius-md);
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text-muted);
          transition: all 0.2s ease;
          border-bottom: 2px solid transparent;
        }

        .legal-tab-btn:hover {
          color: var(--text-primary);
        }

        .legal-tab-btn.active {
          color: var(--teal-700);
          background: var(--bg-surface);
          border-bottom-color: var(--teal-600);
          box-shadow: var(--shadow-sm);
        }

        :global([data-theme='dark']) .legal-tab-btn.active {
          color: var(--teal-300);
          background: var(--bg-surface);
        }

        /* Content */
        .document-content-scroll {
          padding: 28px;
          overflow-y: auto;
          flex: 1;
          line-height: 1.65;
          font-size: 0.92rem;
          color: var(--text-secondary);
        }

        .doc-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: var(--radius-full);
          background: var(--teal-50);
          border: 1px solid var(--teal-200);
          color: var(--teal-800);
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 20px;
        }

        :global([data-theme='dark']) .doc-hero-badge {
          background: rgba(13, 148, 136, 0.15);
          color: var(--teal-300);
          border-color: rgba(13, 148, 136, 0.3);
        }

        .doc-section-title {
          font-size: 1.12rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 22px 0 8px 0;
        }

        .doc-section-title:first-of-type {
          margin-top: 0;
        }

        .doc-list {
          padding-left: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 10px 0 16px 0;
        }

        .doc-list li strong {
          color: var(--text-primary);
        }

        .doc-alert-box {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 18px;
          border-radius: var(--radius-md);
          margin: 16px 0;
          font-size: 0.86rem;
          line-height: 1.5;
        }

        .alert-teal {
          background: var(--teal-50);
          border: 1px solid var(--teal-200);
          color: var(--navy-900);
        }

        :global([data-theme='dark']) .alert-teal {
          background: rgba(13, 148, 136, 0.15);
          border-color: rgba(13, 148, 136, 0.3);
          color: #f1f5f9;
        }

        .alert-amber {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
        }

        :global([data-theme='dark']) .alert-amber {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.3);
          color: #fde68a;
        }

        .alert-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .text-amber {
          color: #d97706;
        }

        /* Security Pillars Grid */
        .security-pillars-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin: 18px 0;
        }

        .security-pillar-card {
          padding: 16px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pillar-icon-box {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: var(--teal-50);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px;
        }

        :global([data-theme='dark']) .pillar-icon-box {
          background: rgba(13, 148, 136, 0.2);
        }

        .security-pillar-card h4 {
          font-size: 0.92rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .security-pillar-card p {
          font-size: 0.8rem;
          line-height: 1.5;
          color: var(--text-secondary);
        }

        code {
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          background: var(--bg-subtle);
          color: var(--teal-700);
          font-family: var(--font-mono);
          font-size: 0.85em;
        }

        /* Footer */
        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 28px;
          border-top: 1px solid var(--border-color);
          background: var(--bg-surface);
        }

        .footer-left-info {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .btn-acknowledge {
          padding: 10px 22px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #0d9488 0%, #1e40af 100%);
          color: #ffffff;
          font-size: 0.88rem;
          font-weight: 700;
          transition: all 0.2s ease;
        }

        .btn-acknowledge:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        @media (max-width: 640px) {
          .security-pillars-grid {
            grid-template-columns: 1fr;
          }
          .legal-tabs-bar {
            overflow-x: auto;
            padding: 4px 16px;
          }
          .modal-header, .document-content-scroll, .modal-footer {
            padding: 18px 16px;
          }
          .modal-footer {
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
};
