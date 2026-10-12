'use client';

import React from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  Calculator, 
  Sliders, 
  TrendingUp, 
  Mail, 
  ExternalLink,
  Globe,
  Share2,
  Bot
} from 'lucide-react';

export const InCraaxFooter: React.FC = () => {
  return (
    <footer className="incraax-footer">
      <div className="footer-container">
        <div className="footer-grid">
          {/* Col 1: Brand & Mission */}
          <div className="footer-col brand-col">
            <div className="brand-header">
              <div className="brand-icon">
                <Sparkles size={20} />
              </div>
              <span className="brand-title">
                InCraax <span className="brand-accent">AI Automation</span>
              </span>
            </div>
            <p className="brand-desc">
              Institutional loan underwriting intelligence, real-time FOIR Present Value (PV) discounting, and algorithmic debt consolidation platforms for lenders and borrowers.
            </p>
            <div className="security-pill">
              <Lock size={13} className="text-emerald-400" />
              <span>256-Bit Financial Encryption • Zero Credit Score Impact</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="footer-col">
            <h4 className="col-heading">Quick Links</h4>
            <ul className="footer-link-list">
              <li><a href="#calculator">Loan Eligibility Calculator</a></li>
              <li><a href="#calculator">FOIR Capacity Engine</a></li>
              <li><a href="#calculator">Salary Multiplier Model</a></li>
              <li><a href="#calculator">Balance Transfer Takeover</a></li>
              <li><a href="#calculator">Self Closure Debt Optimization</a></li>
            </ul>
          </div>

          {/* Col 3: Support */}
          <div className="footer-col">
            <h4 className="col-heading">Support & Compliance</h4>
            <ul className="footer-link-list">
              <li><a href="#support">Banking Policy Documentation</a></li>
              <li><a href="#support">RBI Regulatory Guidelines</a></li>
              <li><a href="#support">Partner Underwriting Directory</a></li>
              <li><a href="#support">Direct Underwriter Helpline</a></li>
              <li><a href="mailto:support@incraax.com">support@incraax.com</a></li>
            </ul>
          </div>

          {/* Col 4: Connect */}
          <div className="footer-col">
            <h4 className="col-heading">Connect With Us</h4>
            <p className="connect-text">
              Have complex underwriting questions or multi-lender portfolio inquiries? Reach out directly.
            </p>
            <div className="social-links-row">
              {/* X / Twitter */}
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="social-btn" aria-label="X (Twitter)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              {/* LinkedIn */}
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="social-btn" aria-label="LinkedIn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </a>
              {/* GitHub */}
              <a href="https://github.com" target="_blank" rel="noreferrer" className="social-btn" aria-label="GitHub">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </a>
              {/* Mail */}
              <a href="mailto:contact@incraax.com" className="social-btn" aria-label="Email">
                <Mail size={15} />
              </a>
            </div>
          </div>
        </div>

        {/* Disclaimer strip */}
        <div className="footer-disclaimer">
          <p>
            <strong>Underwriting Disclaimer:</strong> Calculations generated by InCraax AI Automation Loan Eligibility Calculator are institutional estimates based on standardized mathematical formulas, FOIR parameters, and bank benchmark multipliers. Actual loan sanctions, final interest rates, processing fees, and disbursements are subject to comprehensive credit appraisal, KYC verification, and policy approval by respective lending institutions.
          </p>
        </div>

        {/* Bottom copyright row */}
        <div className="footer-bottom-row">
          <p className="copyright-text">
            © {new Date().getFullYear()} InCraax AI Automation. All rights reserved.
          </p>

          <div className="legal-links">
            <a href="#privacy">Privacy Policy</a>
            <span className="dot-sep">•</span>
            <a href="#terms">Terms of Service</a>
            <span className="dot-sep">•</span>
            <a href="#security">Information Security</a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .incraax-footer {
          background: #090e1a;
          color: #94a3b8;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 50px 0 24px 0;
          margin-top: 40px;
        }

        .footer-container {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 36px;
          margin-bottom: 36px;
        }

        @media (max-width: 992px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .footer-grid {
            grid-template-columns: 1fr;
          }
        }

        .footer-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .brand-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brand-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
        }

        .brand-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .brand-accent {
          background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 800;
        }

        .brand-desc {
          font-size: 0.82rem;
          line-height: 1.6;
          color: #94a3b8;
        }

        .security-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          width: fit-content;
        }

        .col-heading {
          font-size: 0.88rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 2px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .footer-link-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .footer-link-list a {
          color: #94a3b8;
          font-size: 0.82rem;
          transition: color 0.15s ease;
        }

        .footer-link-list a:hover {
          color: #60a5fa;
        }

        .connect-text {
          font-size: 0.82rem;
          color: #94a3b8;
          line-height: 1.5;
        }

        .social-links-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
        }

        .social-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .social-btn:hover {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
          transform: translateY(-2px);
        }

        .footer-disclaimer {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 24px;
          font-size: 0.74rem;
          line-height: 1.55;
          color: #64748b;
        }

        .footer-disclaimer strong {
          color: #94a3b8;
        }

        .footer-bottom-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.78rem;
          flex-wrap: wrap;
          gap: 12px;
        }

        .copyright-text {
          color: #64748b;
        }

        .legal-links {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .legal-links a {
          color: #64748b;
          transition: color 0.15s ease;
        }

        .legal-links a:hover {
          color: #94a3b8;
        }

        .dot-sep {
          color: #334155;
        }

        .text-emerald-400 { color: #34d399; }
      `}</style>
    </footer>
  );
};

// Backwards-compatibility alias
export const CallNowFooter = InCraaxFooter;
