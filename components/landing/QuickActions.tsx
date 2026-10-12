'use client';

import React from 'react';
import { Bot, Calculator, FileText, Shield } from 'lucide-react';

interface QuickActionsProps {
  onOpenAI: () => void;
  onOpenEMI: () => void;
  onOpenPolicies: () => void;
  onOpenAdmin: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onOpenAI,
  onOpenEMI,
  onOpenPolicies,
  onOpenAdmin,
}) => {
  return (
    <section className="quick-actions-bar">
      <div className="quick-actions-container">
        {/* Primary Action: Launch AI Assistant */}
        <button 
          onClick={onOpenAI}
          className="quick-action-pill primary-pill"
          type="button"
          id="qa-launch-ai"
        >
          <Bot size={17} className="pill-icon-spin" />
          <span className="pill-text">Launch AI Assistant</span>
          <span className="pill-status-dot" />
        </button>

        {/* Secondary Action: Open EMI Calculator */}
        <button 
          onClick={onOpenEMI}
          className="quick-action-pill secondary-pill"
          type="button"
          id="qa-open-emi"
        >
          <Calculator size={16} />
          <span className="pill-text">Open EMI Calculator</span>
        </button>

        {/* Secondary Action: View Bank Policies */}
        <button 
          onClick={onOpenPolicies}
          className="quick-action-pill secondary-pill"
          type="button"
          id="qa-view-policies"
        >
          <FileText size={16} />
          <span className="pill-text">View Bank Policies</span>
        </button>

        {/* Secondary Action: Admin Workspace */}
        <button 
          onClick={onOpenAdmin}
          className="quick-action-pill secondary-pill"
          type="button"
          id="qa-admin-workspace"
        >
          <Shield size={16} />
          <span className="pill-text">Admin Workspace</span>
        </button>
      </div>

      <style jsx>{`
        .quick-actions-bar {
          padding: 1.25rem 1.5rem 0.5rem;
          max-width: 1360px;
          margin: 0 auto;
        }

        .quick-actions-container {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .quick-action-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.55rem 1.15rem;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          font-weight: 600;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
        }

        /* Launch AI Assistant button - matching the blue pill in screenshot */
        .primary-pill {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .primary-pill:hover {
          background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%);
          transform: translateY(-1.5px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.38);
        }

        .primary-pill:active {
          transform: translateY(0);
        }

        .pill-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #67e8f9;
          box-shadow: 0 0 8px #67e8f9;
        }

        /* Secondary pills */
        .secondary-pill {
          background: var(--bg-surface);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
        }

        .secondary-pill:hover {
          background: var(--bg-subtle);
          color: var(--text-primary);
          border-color: #cbd5e1;
          transform: translateY(-1.5px);
          box-shadow: var(--shadow-md);
        }

        .secondary-pill:active {
          transform: translateY(0);
        }

        [data-theme='dark'] .secondary-pill {
          background: var(--bg-surface);
          border-color: rgba(255, 255, 255, 0.08);
        }

        [data-theme='dark'] .secondary-pill:hover {
          background: var(--bg-subtle);
          border-color: rgba(255, 255, 255, 0.2);
        }

        @media (max-width: 640px) {
          .quick-actions-container {
            gap: 0.5rem;
          }
          .quick-action-pill {
            font-size: 0.775rem;
            padding: 0.45rem 0.85rem;
          }
        }
      `}</style>
    </section>
  );
};
