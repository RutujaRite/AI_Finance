'use client';

import React from 'react';
import { Calculator, Bookmark, FolderOpen, Printer, Download, Sparkles } from 'lucide-react';

interface EligibilityHeaderProps {
  savedCount: number;
  onOpenSavedRecords: () => void;
  onSaveData: () => void;
  onExportPdf?: () => void;
}

export const EligibilityHeader: React.FC<EligibilityHeaderProps> = ({
  savedCount,
  onOpenSavedRecords,
  onSaveData,
  onExportPdf,
}) => {
  return (
    <header className="eligibility-header-card">
      <div className="header-left">
        <div className="header-icon-box">
          <Calculator size={24} className="header-icon" />
        </div>
        <div>
          <div className="title-row">
            <h1 className="header-title">Loan Eligibility Calculator</h1>
            <span className="badge-pill">Institutional Engine</span>
          </div>
          <p className="header-subtitle">
            Calculate borrowing capacity via real-time FOIR Present Value (PV) & Salary Multiplier models
          </p>
        </div>
      </div>

      <div className="header-actions">
        {/* 1. Saved Records */}
        <button
          type="button"
          onClick={onOpenSavedRecords}
          className="hdr-btn hdr-btn-secondary"
          title="View previously saved applicant assessments"
        >
          <FolderOpen size={16} />
          <span>Saved Records</span>
          {savedCount > 0 && <span className="count-badge">{savedCount}</span>}
        </button>

        {/* 3. Save Data (Green Positive Button) */}
        <button
          type="button"
          onClick={onSaveData}
          className="hdr-btn hdr-btn-save"
          title="Save current calculation and applicant data"
        >
          <Bookmark size={16} />
          <span>Save Data</span>
        </button>
      </div>

      <style jsx>{`
        .eligibility-header-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.05);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .header-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1px solid #bfdbfe;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          flex-shrink: 0;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .header-title {
          font-size: 1.45rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
          line-height: 1.2;
        }

        .badge-pill {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          padding: 2px 10px;
          border-radius: 9999px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .header-subtitle {
          font-size: 0.84rem;
          color: #64748b;
          margin-top: 3px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .hdr-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          border-radius: 10px;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s ease;
          border: 1px solid transparent;
        }

        .hdr-btn-secondary {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #334155;
        }

        .hdr-btn-secondary:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .count-badge {
          background: #2563eb;
          color: #ffffff;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 1px 7px;
          border-radius: 9999px;
        }

        /* Green button for positive/save actions */
        .hdr-btn-save {
          background: #10b981;
          border-color: #059669;
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(16, 185, 129, 0.25);
        }

        .hdr-btn-save:hover {
          background: #059669;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(16, 185, 129, 0.35);
        }

        /* Blue primary button for export */
        .hdr-btn-export {
          background: #2563eb;
          border-color: #1d4ed8;
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25);
        }

        .hdr-btn-export:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(37, 99, 235, 0.35);
        }


        @media (max-width: 768px) {
          .eligibility-header-card {
            flex-direction: column;
            align-items: flex-start;
          }
          .header-actions {
            width: 100%;
            justify-content: flex-start;
          }
        }

        @media print {
          .header-actions {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
};
