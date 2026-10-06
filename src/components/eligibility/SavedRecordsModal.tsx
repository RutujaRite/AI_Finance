'use client';

import React from 'react';
import { 
  X, 
  Trash2, 
  RotateCcw, 
  FolderOpen, 
  Calendar, 
  User, 
  IndianRupee, 
  CheckCircle2,
  Clock
} from 'lucide-react';
import { SavedRecord } from '@/lib/eligibility/eligibilityTypes';
import { formatIndianRupees } from '@/lib/eligibility/calculateEligibility';

interface SavedRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedRecords: SavedRecord[];
  onLoadRecord: (record: SavedRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
}

export const SavedRecordsModal: React.FC<SavedRecordsModalProps> = ({
  isOpen,
  onClose,
  savedRecords,
  onLoadRecord,
  onDeleteRecord,
  onClearAll,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="hdr-title-group">
            <div className="hdr-icon">
              <FolderOpen size={18} />
            </div>
            <div>
              <h3 className="modal-title">Saved Records ({savedRecords.length})</h3>
              <p className="modal-subtitle">Previously saved loan eligibility assessments</p>
            </div>
          </div>

          <div className="hdr-actions">
            {savedRecords.length > 0 && (
              <button
                type="button"
                className="btn-clear-all"
                onClick={onClearAll}
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {savedRecords.length === 0 ? (
            <div className="empty-saved-state">
              <FolderOpen size={36} className="text-slate-400 mb-2" />
              <p className="font-semibold text-slate-800">No Saved Records Yet</p>
              <p className="text-slate-500 text-xs mt-1 max-w-xs">
                Click the <strong>&quot;Save Data&quot;</strong> button in the top header to save the current applicant profile, obligations, and calculation results for later review.
              </p>
            </div>
          ) : (
            <div className="records-list">
              {savedRecords.map((rec) => (
                <div key={rec.id} className="record-item">
                  <div className="record-item-main">
                    <div className="record-top-line">
                      <span className="applicant-name">
                        <User size={13} className="text-blue-600" />
                        {rec.customerInfo?.name || rec.customerInfo?.customerName || 'Unnamed Applicant'}
                      </span>
                      {rec.customerInfo?.company && (
                        <span className="company-badge">
                          {rec.customerInfo.company}
                        </span>
                      )}
                      <span className="record-timestamp">
                        <Clock size={11} />
                        {new Date(rec.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="record-figures-row">
                      <div className="figure-chip">
                        <span className="chip-lbl">Salary:</span>
                        <span className="chip-val font-mono">{formatIndianRupees(rec.salary)}</span>
                      </div>
                      <div className="figure-chip">
                        <span className="chip-lbl">FOIR:</span>
                        <span className="chip-val font-mono">{rec.foirPercent}%</span>
                      </div>
                      <div className="figure-chip">
                        <span className="chip-lbl">FOIR Limit:</span>
                        <span className="chip-val font-mono text-emerald-700">
                          {formatIndianRupees(rec.result.foirEligibility)}
                        </span>
                      </div>
                      <div className="figure-chip">
                        <span className="chip-lbl">Multiplier Limit:</span>
                        <span className="chip-val font-mono text-blue-700">
                          {formatIndianRupees(rec.result.multiplierEligibility)}
                        </span>
                      </div>
                      <div className="figure-chip">
                        <span className="chip-lbl">Loans:</span>
                        <span className="chip-val">{rec.loans?.length || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="record-actions">
                    <button
                      type="button"
                      className="btn-load-record"
                      onClick={() => onLoadRecord(rec)}
                      title="Load this record into the calculator"
                    >
                      <RotateCcw size={13} />
                      <span>Load</span>
                    </button>
                    <button
                      type="button"
                      className="btn-delete-record"
                      onClick={() => onDeleteRecord(rec.id)}
                      title="Delete record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-done" onClick={onClose}>
            Close
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
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
        }

        .modal-card {
          background: #ffffff;
          border-radius: 16px;
          max-width: 650px;
          width: 100%;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          animation: popIn 0.2s ease;
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #fafcff;
        }

        .hdr-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hdr-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .modal-subtitle {
          font-size: 0.76rem;
          color: #64748b;
        }

        .hdr-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-clear-all {
          font-size: 0.74rem;
          color: #ef4444;
          background: transparent;
          border: none;
          cursor: pointer;
          font-weight: 600;
        }

        .btn-clear-all:hover {
          text-decoration: underline;
        }

        .btn-close {
          color: #64748b;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
        }

        .btn-close:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .modal-body {
          padding: 16px 20px;
          overflow-y: auto;
          flex: 1;
        }

        .empty-saved-state {
          padding: 40px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .records-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .record-item {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: #f8fafc;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .record-item:hover {
          background: #ffffff;
          border-color: #cbd5e1;
        }

        .record-item-main {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .record-top-line {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .applicant-name {
          font-size: 0.88rem;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .company-badge {
          font-size: 0.7rem;
          padding: 1px 6px;
          border-radius: 4px;
          background: #e2e8f0;
          color: #475569;
          font-weight: 500;
        }

        .record-timestamp {
          font-size: 0.7rem;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
        }

        .record-figures-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .figure-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 2px 7px;
          border-radius: 6px;
          font-size: 0.74rem;
        }

        .chip-lbl { color: #64748b; }
        .chip-val { font-weight: 600; color: #0f172a; }

        .record-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-load-record {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: 6px;
          background: #2563eb;
          color: #ffffff;
          font-size: 0.74rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
        }

        .btn-load-record:hover {
          background: #1d4ed8;
        }

        .btn-delete-record {
          padding: 6px;
          border-radius: 6px;
          color: #ef4444;
          background: #fee2e2;
          border: none;
          cursor: pointer;
        }

        .btn-delete-record:hover {
          background: #fca5a5;
        }

        .modal-footer {
          padding: 12px 20px;
          border-top: 1px solid #e2e8f0;
          background: #fafcff;
          display: flex;
          justify-content: flex-end;
        }

        .btn-done {
          padding: 7px 16px;
          border-radius: 8px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-done:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .font-mono { font-family: monospace; }
        .text-emerald-700 { color: #047857; }
        .text-blue-700 { color: #1d4ed8; }
        .text-blue-600 { color: #2563eb; }
      `}</style>
    </div>
  );
};
