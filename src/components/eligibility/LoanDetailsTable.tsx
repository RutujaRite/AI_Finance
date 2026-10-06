'use client';

import React from 'react';
import { 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  RotateCcw, 
  Layers, 
  ArrowRightLeft, 
  AlertCircle,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import { LoanRow, BalanceTransferOption } from '@/lib/eligibility/eligibilityTypes';
import { formatIndianRupees } from '@/lib/eligibility/calculateEligibility';

interface LoanDetailsTableProps {
  loans: LoanRow[];
  onAddLoan: () => void;
  onUpdateLoan: (id: string, field: keyof LoanRow, value: any) => void;
  onDeleteLoan: (id: string) => void;
  onLoadSampleLoans: () => void;
  onClearLoans: () => void;
}

const COMMON_LOAN_TYPES = [
  'Personal Loan',
  'Home Loan',
  'Auto Loan',
  'Credit Card',
  'Business Loan',
  'Education Loan',
  'Gold Loan',
  'Loan Against Property (LAP)',
  'Consumer Loan',
  'Other',
];

const COMMON_BANKS = [
  'Aditya Birla Capital',
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India (SBI)',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Bajaj Finserv',
  'Tata Capital',
  'IndusInd Bank',
  'IDFC FIRST Bank',
  'Yes Bank',
  'Standard Chartered',
  'Piramal Finance',
  'Fullerton India',
  'Other Bank / NBFC',
];

export const LoanDetailsTable: React.FC<LoanDetailsTableProps> = ({
  loans,
  onAddLoan,
  onUpdateLoan,
  onDeleteLoan,
  onLoadSampleLoans,
  onClearLoans,
}) => {
  // Compute totals dynamically
  const totalSanction = loans.reduce((acc, r) => acc + (Number(r.sanctionAmount) || 0), 0);
  const totalOutstanding = loans.reduce((acc, r) => acc + (Number(r.outstanding) || 0), 0);
  const totalEmi = loans.reduce((acc, r) => acc + (Number(r.emi) || 0), 0);

  const totalOngoingObligations = loans
    .filter((r) => r.balanceTransfer === 'No')
    .reduce((acc, r) => acc + (Number(r.emi) || 0), 0);

  const totalBtPos = loans
    .filter((r) => r.balanceTransfer === 'Yes')
    .reduce((acc, r) => acc + (Number(r.outstanding) || 0), 0);

  const totalSelfClosurePos = loans
    .filter((r) => r.balanceTransfer === 'Self Closure')
    .reduce((acc, r) => acc + (Number(r.outstanding) || 0), 0);

  return (
    <section className="card loan-table-card">
      {/* Table Header */}
      <div className="table-header-bar">
        <div className="table-header-left">
          <div className="icon-wrapper">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="card-title">Loan Details – Add / Edit / Delete Rows</h2>
            <p className="card-subtitle">
              Existing credit lines, EMIs, and balance transfer takeover or self closure decisions
            </p>
          </div>
        </div>

        <div className="table-header-actions">
          <button
            type="button"
            className="tbl-btn tbl-btn-secondary"
            onClick={onLoadSampleLoans}
            title="Reset table to reference demo sample loans"
          >
            <FileSpreadsheet size={15} />
            <span>Load Sample Loans</span>
          </button>

          {loans.length > 0 && (
            <button
              type="button"
              className="tbl-btn tbl-btn-secondary"
              onClick={onClearLoans}
              title="Remove all rows"
            >
              <RotateCcw size={15} />
              <span>Clear</span>
            </button>
          )}

          {/* Green button for positive/add action */}
          <button
            type="button"
            className="tbl-btn tbl-btn-add"
            onClick={onAddLoan}
          >
            <Plus size={16} />
            <span>Add New Row</span>
          </button>
        </div>
      </div>

      {/* Guide tags strip */}
      <div className="guide-tags-strip">
        <span className="guide-tag tag-bt-no">
          <strong>BT = &quot;No&quot;:</strong> Active obligation — EMI deducted from borrowing limit
        </span>
        <span className="guide-tag tag-bt-yes">
          <strong>BT = &quot;Yes&quot;:</strong> Balance Transfer — Outstanding taken over; EMI freed up!
        </span>
        <span className="guide-tag tag-bt-closure">
          <strong>BT = &quot;Self Closure&quot;:</strong> Closed by applicant — EMI freed up!
        </span>
      </div>

      {/* Responsive Table Scroll Container */}
      <div className="table-container">
        <table className="loan-table">
          <thead>
            <tr>
              <th style={{ width: '38px', textAlign: 'center' }}>#</th>
              <th style={{ minWidth: '125px' }}>Open Date</th>
              <th style={{ minWidth: '145px' }}>Type</th>
              <th style={{ minWidth: '170px' }}>Bank Name</th>
              <th style={{ minWidth: '130px', textAlign: 'right' }}>Sanction Amt (₹)</th>
              <th style={{ minWidth: '130px', textAlign: 'right' }}>Outstanding (₹)</th>
              <th style={{ minWidth: '120px', textAlign: 'right' }}>EMI (₹)</th>
              <th style={{ minWidth: '155px' }}>Balance Transfer</th>
              <th style={{ minWidth: '140px' }}>REMARK</th>
              <th style={{ minWidth: '130px' }}>Additional Info</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 ? (
              <tr>
                <td colSpan={11} className="empty-state-cell">
                  <div className="empty-box">
                    <CheckCircle2 size={32} className="text-emerald-500 mb-1" />
                    <p className="empty-title">Zero Existing Loans</p>
                    <p className="empty-desc">
                      No current obligations added. 100% of FOIR capacity is available for borrowing.
                    </p>
                    <div className="empty-btns">
                      <button type="button" className="tbl-btn tbl-btn-add" onClick={onAddLoan}>
                        <Plus size={15} /> Add First Row
                      </button>
                      <button type="button" className="tbl-btn tbl-btn-secondary" onClick={onLoadSampleLoans}>
                        <FileSpreadsheet size={15} /> Load Demo Portfolio
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              loans.map((row, idx) => (
                <tr 
                  key={row.id} 
                  className={`loan-row ${
                    row.balanceTransfer === 'Yes' 
                      ? 'row-transfer-yes' 
                      : row.balanceTransfer === 'Self Closure' 
                      ? 'row-transfer-closure' 
                      : ''
                  }`}
                >
                  {/* # */}
                  <td className="row-num">{idx + 1}</td>

                  {/* 1. Open Date */}
                  <td>
                    <input
                      type="date"
                      className="tbl-input font-mono"
                      value={row.openDate}
                      onChange={(e) => onUpdateLoan(row.id, 'openDate', e.target.value)}
                    />
                  </td>

                  {/* 2. Type */}
                  <td>
                    <select
                      className="tbl-select"
                      value={row.type}
                      onChange={(e) => onUpdateLoan(row.id, 'type', e.target.value)}
                    >
                      {COMMON_LOAN_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>

                  {/* 3. Bank Name */}
                  <td>
                    <input
                      type="text"
                      list={`banks-${row.id}`}
                      className="tbl-input"
                      placeholder="e.g. HDFC Bank"
                      value={row.bankName}
                      onChange={(e) => onUpdateLoan(row.id, 'bankName', e.target.value)}
                    />
                    <datalist id={`banks-${row.id}`}>
                      {COMMON_BANKS.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </td>

                  {/* 4. Sanction Amt */}
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      className="tbl-input text-right font-mono"
                      placeholder="0"
                      value={row.sanctionAmount === 0 ? '' : row.sanctionAmount}
                      onChange={(e) => onUpdateLoan(row.id, 'sanctionAmount', Number(e.target.value) || 0)}
                    />
                  </td>

                  {/* 5. Outstanding */}
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      className="tbl-input text-right font-mono font-semibold"
                      placeholder="0"
                      value={row.outstanding === 0 ? '' : row.outstanding}
                      onChange={(e) => onUpdateLoan(row.id, 'outstanding', Number(e.target.value) || 0)}
                    />
                  </td>

                  {/* 6. EMI */}
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      className="tbl-input text-right font-mono font-semibold"
                      placeholder="0"
                      value={row.emi === 0 ? '' : row.emi}
                      onChange={(e) => onUpdateLoan(row.id, 'emi', Number(e.target.value) || 0)}
                    />
                  </td>

                  {/* 7. Balance Transfer */}
                  <td>
                    <select
                      className={`tbl-select bt-dropdown ${
                        row.balanceTransfer === 'Yes' 
                          ? 'bt-yes' 
                          : row.balanceTransfer === 'Self Closure' 
                          ? 'bt-closure' 
                          : 'bt-no'
                      }`}
                      value={row.balanceTransfer}
                      onChange={(e) => onUpdateLoan(row.id, 'balanceTransfer', e.target.value as BalanceTransferOption)}
                    >
                      <option value="No">No (Ongoing Debt)</option>
                      <option value="Yes">Yes (BT Takeover)</option>
                      <option value="Self Closure">Self Closure</option>
                    </select>
                  </td>

                  {/* 8. REMARK */}
                  <td>
                    <input
                      type="text"
                      className="tbl-input"
                      placeholder="Remarks..."
                      value={row.remark}
                      onChange={(e) => onUpdateLoan(row.id, 'remark', e.target.value)}
                    />
                  </td>

                  {/* 9. Additional Info */}
                  <td>
                    <input
                      type="text"
                      className="tbl-input"
                      placeholder="Tenure, info..."
                      value={row.additionalInfo}
                      onChange={(e) => onUpdateLoan(row.id, 'additionalInfo', e.target.value)}
                    />
                  </td>

                  {/* 10. Action (Red Delete Button) */}
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => onDeleteLoan(row.id)}
                      title="Delete row"
                      aria-label="Delete loan row"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Dynamic Totals Footer */}
          {loans.length > 0 && (
            <tfoot>
              <tr className="totals-row">
                <td colSpan={4} className="totals-label">
                  <strong>Total Portfolio Sum ({loans.length} {loans.length === 1 ? 'Row' : 'Rows'})</strong>
                </td>
                <td className="totals-val text-right">
                  <strong>{formatIndianRupees(totalSanction)}</strong>
                </td>
                <td className="totals-val text-right font-bold text-blue-700">
                  <strong>{formatIndianRupees(totalOutstanding)}</strong>
                </td>
                <td className="totals-val text-right font-bold text-slate-900">
                  <strong>{formatIndianRupees(totalEmi)}</strong>
                </td>
                <td colSpan={4} className="totals-pills-cell">
                  <div className="totals-pills">
                    <span className="stat-pill pill-blue">
                      Ongoing Obligations: <strong>{formatIndianRupees(totalOngoingObligations)}</strong>
                    </span>
                    <span className="stat-pill pill-green">
                      BT POS: <strong>{formatIndianRupees(totalBtPos)}</strong>
                    </span>
                    <span className="stat-pill pill-amber">
                      Self Closure POS: <strong>{formatIndianRupees(totalSelfClosurePos)}</strong>
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <style jsx>{`
        .loan-table-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .table-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          flex-wrap: wrap;
          gap: 12px;
        }

        .table-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon-wrapper {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .card-subtitle {
          font-size: 0.78rem;
          color: #64748b;
          margin-top: 2px;
        }

        .table-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tbl-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.16s ease;
          border: 1px solid transparent;
        }

        .tbl-btn-secondary {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #334155;
        }

        .tbl-btn-secondary:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }

        /* Green button for positive/add actions */
        .tbl-btn-add {
          background: #10b981;
          border-color: #059669;
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(16, 185, 129, 0.2);
        }

        .tbl-btn-add:hover {
          background: #059669;
          transform: translateY(-1px);
        }

        .guide-tags-strip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.76rem;
          flex-wrap: wrap;
        }

        .guide-tag {
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid transparent;
        }

        .tag-bt-no {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .tag-bt-yes {
          background: #ecfdf5;
          border-color: #a7f3d0;
          color: #065f46;
        }

        .tag-bt-closure {
          background: #fffbeb;
          border-color: #fde68a;
          color: #92400e;
        }

        .table-container {
          width: 100%;
          overflow-x: auto;
        }

        .loan-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.83rem;
        }

        .loan-table th {
          background: #f1f5f9;
          color: #475569;
          font-weight: 700;
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1.5px solid #cbd5e1;
          white-space: nowrap;
          font-size: 0.78rem;
          letter-spacing: 0.02em;
        }

        .loan-row {
          border-bottom: 1px solid #e2e8f0;
          transition: background-color 0.12s ease;
        }

        .loan-row:hover {
          background-color: #f8fafc;
        }

        .row-transfer-yes {
          background-color: rgba(16, 185, 129, 0.04);
        }

        .row-transfer-closure {
          background-color: rgba(245, 158, 11, 0.04);
        }

        .row-num {
          text-align: center;
          color: #94a3b8;
          font-weight: 600;
        }

        .tbl-input, .tbl-select {
          width: 100%;
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-size: 0.82rem;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .tbl-input:focus, .tbl-select:focus {
          border-color: #2563eb;
        }

        .bt-dropdown {
          font-weight: 600;
        }

        .bt-no {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        .bt-yes {
          background: #ecfdf5;
          color: #047857;
          border-color: #a7f3d0;
        }

        .bt-closure {
          background: #fffbeb;
          color: #b45309;
          border-color: #fde68a;
        }

        /* Red delete button */
        .btn-delete {
          color: #ef4444;
          background: #fee2e2;
          border: 1px solid #fecaca;
          padding: 5px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .btn-delete:hover {
          background: #fca5a5;
          color: #b91c1c;
          transform: scale(1.05);
        }

        .empty-state-cell {
          padding: 36px 16px;
          text-align: center;
        }

        .empty-box {
          max-width: 400px;
          margin: 0 auto;
        }

        .empty-title {
          font-weight: 700;
          color: #0f172a;
          font-size: 0.95rem;
        }

        .empty-desc {
          color: #64748b;
          font-size: 0.8rem;
          margin-top: 4px;
        }

        .empty-btns {
          margin-top: 14px;
          display: flex;
          gap: 8px;
          justify-content: center;
        }

        .totals-row {
          background: #f8fafc;
          border-top: 2px solid #cbd5e1;
        }

        .totals-label {
          padding: 12px 14px;
          color: #0f172a;
          font-size: 0.82rem;
        }

        .totals-val {
          padding: 12px 10px;
          font-family: monospace;
          font-size: 0.88rem;
          white-space: nowrap;
        }

        .totals-pills-cell {
          padding: 12px 14px;
        }

        .totals-pills {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .stat-pill {
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.74rem;
          border: 1px solid transparent;
        }

        .pill-blue {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1e40af;
        }

        .pill-green {
          background: #ecfdf5;
          border-color: #a7f3d0;
          color: #065f46;
        }

        .pill-amber {
          background: #fffbeb;
          border-color: #fde68a;
          color: #92400e;
        }

        .text-right { text-align: right; }
        .font-mono { font-family: monospace; }
        .font-semibold { font-weight: 600; }
        .font-bold { font-weight: 700; }
        .text-blue-700 { color: #1d4ed8; }
        .text-slate-900 { color: #0f172a; }
      `}</style>
    </section>
  );
};
