'use client';

import React, { useState } from 'react';
import { 
  User, 
  Phone, 
  CreditCard, 
  Mail, 
  Building, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  ShieldCheck
} from 'lucide-react';
import { CustomerInfo } from '@/lib/eligibility/eligibilityTypes';

interface CustomerInformationProps {
  customerInfo: CustomerInfo;
  onChange: (field: keyof CustomerInfo, value: string) => void;
}

export const CustomerInformation: React.FC<CustomerInformationProps> = ({
  customerInfo,
  onChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <section className="card customer-info-card">
      <div 
        className="card-header-clickable"
        onClick={() => setIsCollapsed(!isCollapsed)}
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsCollapsed(!isCollapsed);
          }
        }}
      >
        <div className="header-left">
          <div className="icon-wrapper">
            <User size={18} />
          </div>
          <div>
            <div className="title-row">
              <h2 className="card-title">Customer Information</h2>
              <span className="badge-tag">Applicant Profile</span>
              {isCollapsed && customerInfo.name && (
                <span className="applicant-summary-chip font-mono">
                  {customerInfo.name} • {customerInfo.mobile || 'No Mobile'} • {customerInfo.company || 'Salaried'} • CIBIL: {customerInfo.cibilScore || '750'}
                </span>
              )}
            </div>
            <p className="card-subtitle">
              Personal, KYC and employer identification details
            </p>
          </div>
        </div>

        <div className="header-right">
          <span className="collapse-hint">
            {isCollapsed ? 'Click to Expand' : 'Click to Collapse'}
          </span>
          <div className="collapse-icon-btn" aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="card-body">
          <div className="fields-grid">
            {/* 1. Name */}
            <div className="field-group">
              <label htmlFor="customer-name" className="field-label">
                <User size={14} className="field-icon" />
                <span>Name <span className="req-star">*</span></span>
              </label>
              <input
                id="customer-name"
                type="text"
                className="styled-input"
                placeholder="e.g. Rahul Sharma"
                value={customerInfo.name || ''}
                onChange={(e) => onChange('name', e.target.value)}
              />
            </div>

            {/* 2. Mobile */}
            <div className="field-group">
              <label htmlFor="customer-mobile" className="field-label">
                <Phone size={14} className="field-icon" />
                <span>Mobile</span>
              </label>
              <input
                id="customer-mobile"
                type="tel"
                maxLength={10}
                className="styled-input font-mono"
                placeholder="e.g. 9876543210"
                value={customerInfo.mobile || ''}
                onChange={(e) => onChange('mobile', e.target.value.replace(/\D/g, ''))}
              />
            </div>

            {/* 3. PAN */}
            <div className="field-group">
              <label htmlFor="customer-pan" className="field-label">
                <CreditCard size={14} className="field-icon" />
                <span>PAN Number</span>
              </label>
              <input
                id="customer-pan"
                type="text"
                maxLength={10}
                className="styled-input uppercase-text font-mono"
                placeholder="e.g. ABCDE1234F"
                value={customerInfo.pan || ''}
                onChange={(e) => onChange('pan', e.target.value.toUpperCase())}
              />
            </div>

            {/* 4. Email */}
            <div className="field-group">
              <label htmlFor="customer-email" className="field-label">
                <Mail size={14} className="field-icon" />
                <span>Email Address</span>
              </label>
              <input
                id="customer-email"
                type="email"
                className="styled-input"
                placeholder="e.g. rahul@example.com"
                value={customerInfo.email || ''}
                onChange={(e) => onChange('email', e.target.value)}
              />
            </div>

            {/* 5. Company */}
            <div className="field-group">
              <label htmlFor="customer-company" className="field-label">
                <Building size={14} className="field-icon" />
                <span>Company / Employer <span className="req-star">*</span></span>
              </label>
              <input
                id="customer-company"
                type="text"
                className="styled-input"
                placeholder="e.g. Tata Consultancy Services"
                value={customerInfo.company || ''}
                onChange={(e) => onChange('company', e.target.value)}
              />
            </div>
          </div>

          {/* 6. Remarks / Notes / Additional Details */}
          <div className="field-group full-width-field">
            <label htmlFor="customer-remarks" className="field-label">
              <FileText size={14} className="field-icon" />
              <span>Remarks / Notes / Additional Details</span>
            </label>
            <textarea
              id="customer-remarks"
              rows={2}
              className="styled-textarea"
              placeholder="e.g. Verified salary slip, applicant requesting tenure optimization, zero bounce track in bank statement..."
              value={customerInfo.remarks || ''}
              onChange={(e) => onChange('remarks', e.target.value)}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        .customer-info-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          transition: box-shadow 0.2s ease;
        }

        .customer-info-card:hover {
          box-shadow: 0 3px 6px -1px rgba(0, 0, 0, 0.07);
        }

        .card-header-clickable {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #ffffff;
          cursor: pointer;
          user-select: none;
          transition: background-color 0.15s ease;
        }

        .card-header-clickable:hover {
          background-color: #f8fafc;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon-wrapper {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .card-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .badge-tag {
          font-size: 0.7rem;
          font-weight: 600;
          background: #f1f5f9;
          color: #475569;
          padding: 1px 8px;
          border-radius: 9999px;
          border: 1px solid #e2e8f0;
        }

        .applicant-summary-chip {
          font-size: 0.72rem;
          font-weight: 600;
          color: #0d9488;
          background: rgba(13, 148, 136, 0.08);
          border: 1px solid rgba(13, 148, 136, 0.2);
          padding: 2px 8px;
          border-radius: 6px;
        }

        .card-subtitle {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 1px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .collapse-hint {
          font-size: 0.75rem;
          color: #94a3b8;
          font-weight: 500;
        }

        .collapse-icon-btn {
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-body {
          padding: 18px 20px 20px 20px;
          border-top: 1px solid #f1f5f9;
          background: #fafcff;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .fields-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }

        @media (max-width: 1200px) {
          .fields-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .fields-grid {
            grid-template-columns: 1fr;
          }
          .collapse-hint {
            display: none;
          }
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .full-width-field {
          width: 100%;
        }

        .field-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .field-icon {
          color: #64748b;
        }

        .req-star {
          color: #ef4444;
        }

        .styled-input {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-size: 0.86rem;
          outline: none;
          transition: all 0.18s ease;
          width: 100%;
        }

        .styled-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .uppercase-text {
          text-transform: uppercase;
        }

        .styled-textarea {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-size: 0.85rem;
          outline: none;
          resize: vertical;
          width: 100%;
          transition: all 0.18s ease;
        }

        .styled-textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .font-mono {
          font-family: monospace;
        }

        /* Dark Theme Support for CustomerInformation */
        :global([data-theme="dark"]) .customer-info-card,
        :global([data-bs-theme="dark"]) .customer-info-card,
        :global(.dark) .customer-info-card {
          background: var(--surface) !important;
          border-color: var(--border) !important;
        }

        :global([data-theme="dark"]) .card-header-clickable,
        :global([data-bs-theme="dark"]) .card-header-clickable,
        :global(.dark) .card-header-clickable {
          background: var(--surface) !important;
          border-color: var(--border) !important;
        }

        :global([data-theme="dark"]) .card-header-clickable:hover,
        :global([data-bs-theme="dark"]) .card-header-clickable:hover,
        :global(.dark) .card-header-clickable:hover {
          background: #1e293b !important;
        }

        :global([data-theme="dark"]) .card-title,
        :global([data-bs-theme="dark"]) .card-title,
        :global(.dark) .card-title {
          color: #f8fafc !important;
        }

        :global([data-theme="dark"]) .card-subtitle,
        :global([data-bs-theme="dark"]) .card-subtitle,
        :global(.dark) .card-subtitle {
          color: #94a3b8 !important;
        }

        :global([data-theme="dark"]) .card-body,
        :global([data-bs-theme="dark"]) .card-body,
        :global(.dark) .card-body {
          background: #090d16 !important;
          border-color: var(--border) !important;
        }

        :global([data-theme="dark"]) .field-label,
        :global([data-bs-theme="dark"]) .field-label,
        :global(.dark) .field-label {
          color: #cbd5e1 !important;
        }

        :global([data-theme="dark"]) .field-icon,
        :global([data-bs-theme="dark"]) .field-icon,
        :global(.dark) .field-icon {
          color: #94a3b8 !important;
        }

        :global([data-theme="dark"]) .styled-input,
        :global([data-theme="dark"]) .styled-textarea,
        :global([data-bs-theme="dark"]) .styled-input,
        :global([data-bs-theme="dark"]) .styled-textarea,
        :global(.dark) .styled-input,
        :global(.dark) .styled-textarea {
          background: #0f172a !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          color: #ffffff !important;
        }

        :global([data-theme="dark"]) .collapse-hint,
        :global([data-theme="dark"]) .collapse-icon-btn,
        :global([data-bs-theme="dark"]) .collapse-hint,
        :global([data-bs-theme="dark"]) .collapse-icon-btn,
        :global(.dark) .collapse-hint,
        :global(.dark) .collapse-icon-btn {
          color: #94a3b8 !important;
        }
      `}</style>
    </section>
  );
};
