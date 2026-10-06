'use client';

import React from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  Heart, 
  Calculator, 
  Sliders, 
  Bot, 
  TrendingUp,
  Mail
} from 'lucide-react';

interface FooterProps {
  onOpenLegal?: (doc: 'privacy' | 'terms' | 'security') => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenLegal }) => {
  return (
    <footer className="site-footer">
      <div className="container">
        {/* Top Footer Grid */}
        <div className="footer-top-grid">
          {/* Brand Info */}
          <div className="footer-col brand-col">
            <div className="footer-brand">
              <div className="logo-badge">
                <Sparkles size={18} />
              </div>
              <span className="brand-name">CreditWise<span className="text-teal">AI</span></span>
            </div>
            <p className="footer-mission">
              Empowering individuals and financial advisors with transparent, real-time AI loan calculators, amortization models, and lender underwriting benchmarks.
            </p>
            <div className="security-badge-row">
              <Lock size={14} className="text-teal" />
              <span>256-Bit SSL Encryption • Zero Credit Pull</span>
            </div>
          </div>

          {/* Calculators Links */}
          <div className="footer-col">
            <h4 className="footer-heading">Calculators</h4>
            <ul className="footer-links">
              <li><a href="#emi-calculator">Smart EMI Calculator</a></li>
              <li><a href="#emi-calculator">Amortization Schedule</a></li>
              <li><a href="#emi-calculator">Prepayment Optimizer</a></li>
              <li><a href="#bank-rates">FOIR & DTI Debt Ratio</a></li>
            </ul>
          </div>

          {/* Underwriting Tools */}
          <div className="footer-col">
            <h4 className="footer-heading">Platform</h4>
            <ul className="footer-links">
              <li><a href="#ai-assistant">AI Financial Assistant</a></li>
              <li><a href="#company-search">Company Category Search</a></li>
              <li><a href="#bank-rates">Partner Bank Benchmarks</a></li>
              <li><a href="#features">Underwriting Rules</a></li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onOpenLegal && onOpenLegal('security')}
                  className="footer-platform-btn"
                >
                  Data Privacy & Security
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="footer-disclaimer-box">
          <p>
            <strong>Financial Disclaimer:</strong> Calculations provided by CreditWiseAI are for estimated informational and scenario planning purposes only. Actual interest rates, processing fees, and final loan sanctions are subject to individual credit assessment, official bank underwriting, and verification of income documents by respective lenders.
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom-bar">
          <p className="copyright-text">
            © {new Date().getFullYear()} InCraax AI Automation. All rights reserved.
          </p>
          <div className="bottom-links">
            <button 
              type="button" 
              onClick={() => onOpenLegal && onOpenLegal('privacy')}
              className="footer-legal-btn"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button 
              type="button" 
              onClick={() => onOpenLegal && onOpenLegal('terms')}
              className="footer-legal-btn"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button 
              type="button" 
              onClick={() => onOpenLegal && onOpenLegal('security')}
              className="footer-legal-btn"
            >
              Security Statement
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .site-footer {
          background: var(--navy-950);
          color: #94a3b8;
          padding: 70px 0 30px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .footer-top-grid {
          display: grid;
          grid-template-columns: 1.8fr 1fr 1fr;
          gap: 48px;
          margin-bottom: 48px;
        }

        .footer-col {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-badge {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-sm);
          background: linear-gradient(135deg, #0d9488, #2563eb);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-name {
          font-size: 1.25rem;
          font-weight: 800;
          color: #ffffff;
        }

        .text-teal {
          color: #2dd4bf;
        }

        .footer-mission {
          font-size: 0.88rem;
          line-height: 1.6;
          color: #94a3b8;
          max-width: 360px;
        }

        .security-badge-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.76rem;
          font-weight: 600;
          color: #cbd5e1;
        }

        .footer-heading {
          font-size: 0.95rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 6px;
        }

        .footer-links {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .footer-links a,
        .footer-links span {
          font-size: 0.85rem;
          color: #94a3b8;
          transition: color 0.2s ease;
        }

        .footer-links a:hover {
          color: #2dd4bf;
        }

        /* Disclaimer */
        .footer-disclaimer-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-md);
          padding: 16px 20px;
          margin-bottom: 32px;
          font-size: 0.78rem;
          line-height: 1.6;
          color: #64748b;
        }

        .footer-disclaimer-box strong {
          color: #94a3b8;
        }

        /* Bottom Bar */
        .footer-bottom-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.8rem;
        }

        .copyright-text {
          color: #64748b;
        }

        .bottom-links {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .bottom-links a,
        .footer-legal-btn {
          color: #64748b;
          font-size: 0.8rem;
          transition: color 0.2s ease;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
        }

        .bottom-links a:hover,
        .footer-legal-btn:hover {
          color: #2dd4bf;
          text-decoration: underline;
        }

        .footer-platform-btn {
          color: #94a3b8;
          font-size: 0.85rem;
          transition: color 0.2s ease;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
        }

        .footer-platform-btn:hover {
          color: #2dd4bf;
        }

        @media (max-width: 960px) {
          .footer-top-grid {
            grid-template-columns: 1fr 1fr;
            gap: 32px;
          }
        }

        @media (max-width: 640px) {
          .footer-top-grid {
            grid-template-columns: 1fr;
          }
          .footer-bottom-bar {
            flex-direction: column;
            gap: 12px;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  );
};
