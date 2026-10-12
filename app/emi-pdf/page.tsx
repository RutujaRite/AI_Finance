'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Printer, 
  ArrowLeft, 
  Sliders, 
  RotateCcw, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Check, 
  Share2, 
  Sparkles,
  FileText
} from 'lucide-react';
import { EmiPdfDocument } from '@/components/emi-pdf/EmiPdfDocument';
import { 
  CONTINUUM_SAMPLE_DATA, 
  calculateDynamicEmiReport, 
  EmiReportData, 
  formatIndianCurrency 
} from '@/lib/emi-pdf/emiPdfData';

export default function EmiPdfPage() {
  // Input parameters state
  const [loanAmount, setLoanAmount] = useState<number>(3180023);
  const [interestRate, setInterestRate] = useState<number>(12);
  const [periodMonths, setPeriodMonths] = useState<number>(72);
  const [processingFees, setProcessingFees] = useState<number>(0);
  const [appTitle, setAppTitle] = useState<string>('EMI Calculator');
  const [appSubtitle, setAppSubtitle] = useState<string>('by Continuum App');

  // UI state
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(0.92); // 92% fits nicely on standard laptops
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Synchronous calculation
  const reportData: EmiReportData = useMemo(() => {
    return calculateDynamicEmiReport(
      loanAmount,
      interestRate,
      periodMonths,
      processingFees,
      appTitle,
      appSubtitle
    );
  }, [loanAmount, interestRate, periodMonths, processingFees, appTitle, appSubtitle]);

  // Reset to the exact sample from user screenshot
  const handleResetToSample = () => {
    setLoanAmount(3180023);
    setInterestRate(12);
    setPeriodMonths(72);
    setProcessingFees(0);
    setAppTitle('EMI Calculator');
    setAppSubtitle('by Continuum App');
  };

  const handlePrint = () => {
    window.print();
  };

  // Download standalone offline HTML file
  const handleDownloadHtml = () => {
    const a = document.createElement('a');
    a.href = '/emi-calculator-sample.html';
    a.download = `EMI_Calculator_Statement_${loanAmount}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="pdf-view-wrapper">
      {/* 1. SCREEN TOOLBAR (Hidden in Print) */}
      <nav className="pdf-toolbar no-print">
        <div className="toolbar-container">
          <div className="tb-left">
            <Link href="/" className="tb-btn tb-btn-back">
              <ArrowLeft size={16} />
              <span>Back to App</span>
            </Link>

            <div className="doc-badge">
              <span className="badge-dot" />
              <span className="badge-text">Exact 4-Page Amortization PDF</span>
            </div>
          </div>

          <div className="tb-center">
            {/* Zoom Controls */}
            <div className="zoom-controls">
              <button
                type="button"
                className="zoom-btn"
                onClick={() => setZoomScale((z) => Math.max(0.5, z - 0.1))}
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <span className="zoom-label">{Math.round(zoomScale * 100)}%</span>
              <button
                type="button"
                className="zoom-btn"
                onClick={() => setZoomScale((z) => Math.min(1.3, z + 0.1))}
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          </div>

          <div className="tb-right">
            {/* Customize Drawer Toggle */}
            <button
              type="button"
              className={`tb-btn tb-btn-secondary ${showConfig ? 'active' : ''}`}
              onClick={() => setShowConfig(!showConfig)}
            >
              <Sliders size={16} />
              <span>Customize Data</span>
            </button>

            {/* Reset to Sample */}
            <button
              type="button"
              className="tb-btn tb-btn-ghost"
              onClick={handleResetToSample}
              title="Reset to exact figures from the uploaded PDF: ₹31,80,023 / 12% / 72 Mo"
            >
              <RotateCcw size={15} />
              <span>Reset to Sample</span>
            </button>

            {/* Download Offline HTML */}
            <button
              type="button"
              className="tb-btn tb-btn-secondary"
              onClick={handleDownloadHtml}
              title="Download standalone HTML file with identical styles"
            >
              {downloadSuccess ? <Check size={16} className="text-emerald-400" /> : <Download size={16} />}
              <span>{downloadSuccess ? 'Downloaded!' : 'Download File'}</span>
            </button>

            {/* Print / Save as PDF Primary Action */}
            <button
              type="button"
              className="tb-btn tb-btn-primary"
              onClick={handlePrint}
            >
              <Printer size={16} />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. CUSTOMIZATION PANEL (Collapsible, no-print) */}
      {showConfig && (
        <div className="custom-panel-wrap no-print">
          <div className="custom-panel-card">
            <div className="panel-header">
              <div className="panel-title-box">
                <Sliders size={16} className="text-blue-500" />
                <h3 className="panel-title">Interactive EMI Report Parameters</h3>
              </div>
              <span className="panel-sub">
                Adjust figures below to generate a new custom schedule, or reset anytime to the default PDF.
              </span>
            </div>

            <div className="panel-inputs-grid">
              <div className="input-field">
                <label>Loan Amount (₹)</label>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value) || 0)}
                  className="config-input font-mono"
                />
              </div>

              <div className="input-field">
                <label>Interest Rate (% p.a.)</label>
                <input
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value) || 0)}
                  className="config-input font-mono"
                />
              </div>

              <div className="input-field">
                <label>Tenure (Months)</label>
                <input
                  type="number"
                  value={periodMonths}
                  onChange={(e) => setPeriodMonths(Number(e.target.value) || 0)}
                  className="config-input font-mono"
                />
                <span className="field-hint">({(periodMonths / 12).toFixed(1)} years)</span>
              </div>

              <div className="input-field">
                <label>Processing Fees (₹)</label>
                <input
                  type="number"
                  value={processingFees}
                  onChange={(e) => setProcessingFees(Number(e.target.value) || 0)}
                  className="config-input font-mono"
                />
              </div>

              <div className="input-field">
                <label>Header Title</label>
                <input
                  type="text"
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  className="config-input"
                />
              </div>

              <div className="input-field">
                <label>Header Subtitle</label>
                <input
                  type="text"
                  value={appSubtitle}
                  onChange={(e) => setAppSubtitle(e.target.value)}
                  className="config-input"
                />
              </div>
            </div>

            <div className="panel-footer-row">
              <div className="stat-preview">
                <span>Calculated EMI: </span>
                <strong>₹ {formatIndianCurrency(reportData.monthlyEmi)}/mo</strong>
                <span className="stat-sep">•</span>
                <span>Total Payment: </span>
                <strong>₹ {formatIndianCurrency(reportData.totalPayment)}</strong>
              </div>

              <div className="panel-actions">
                <button
                  type="button"
                  className="btn-panel-reset"
                  onClick={handleResetToSample}
                >
                  Reset to Continuum Sample
                </button>
                <button
                  type="button"
                  className="btn-panel-done"
                  onClick={() => setShowConfig(false)}
                >
                  Apply & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DOCUMENT CANVAS (Scaled preview for on-screen inspection) */}
      <div 
        className="document-canvas-viewport" 
        style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center' }}
      >
        <EmiPdfDocument data={reportData} />
      </div>

      <style jsx>{`
        .pdf-view-wrapper {
          min-height: 100vh;
          background: #334155;
          display: flex;
          flex-direction: column;
        }

        /* 1. Screen Toolbar */
        .pdf-toolbar {
          position: sticky;
          top: 0;
          z-index: 50;
          background: #0f172a;
          border-bottom: 1px solid #1e293b;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
        }

        .toolbar-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 10px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .tb-left, .tb-center, .tb-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .doc-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #1e293b;
          border: 1px solid #334155;
          padding: 5px 12px;
          border-radius: 9999px;
          color: #94a3b8;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #0ea5e9;
        }

        .tb-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.16s ease;
          border: 1px solid transparent;
          text-decoration: none;
        }

        .tb-btn-back {
          background: #1e293b;
          color: #e2e8f0;
          border-color: #334155;
        }

        .tb-btn-back:hover {
          background: #334155;
          color: #ffffff;
        }

        .tb-btn-secondary {
          background: #1e293b;
          color: #f1f5f9;
          border-color: #334155;
        }

        .tb-btn-secondary:hover, .tb-btn-secondary.active {
          background: #2563eb;
          border-color: #3b82f6;
          color: #ffffff;
        }

        .tb-btn-ghost {
          background: transparent;
          color: #94a3b8;
          border-color: #334155;
        }

        .tb-btn-ghost:hover {
          background: #1e293b;
          color: #ffffff;
        }

        .tb-btn-primary {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
        }

        .tb-btn-primary:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
        }

        /* Zoom controls */
        .zoom-controls {
          display: flex;
          align-items: center;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 2px 4px;
        }

        .zoom-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          padding: 6px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zoom-btn:hover {
          background: #334155;
          color: #ffffff;
        }

        .zoom-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: #cbd5e1;
          padding: 0 8px;
          font-family: monospace;
          min-width: 44px;
          text-align: center;
        }

        /* 2. Customization Panel */
        .custom-panel-wrap {
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          padding: 14px 24px 0 24px;
        }

        .custom-panel-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 16px 20px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
        }

        .panel-header {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: 14px;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 10px;
        }

        .panel-title-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .panel-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .panel-sub {
          font-size: 0.78rem;
          color: #64748b;
        }

        .panel-inputs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .input-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .input-field label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
        }

        .config-input {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.85rem;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s;
        }

        .config-input:focus {
          border-color: #2563eb;
        }

        .field-hint {
          font-size: 0.7rem;
          color: #94a3b8;
        }

        .panel-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid #f1f5f9;
          padding-top: 12px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .stat-preview {
          font-size: 0.85rem;
          color: #334155;
        }

        .stat-preview strong {
          color: #0f172a;
        }

        .stat-sep {
          margin: 0 8px;
          color: #cbd5e1;
        }

        .panel-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-panel-reset {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
        }

        .btn-panel-reset:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .btn-panel-done {
          background: #2563eb;
          border: none;
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-panel-done:hover {
          background: #1d4ed8;
        }

        /* 3. Document canvas */
        .document-canvas-viewport {
          transition: transform 0.15s ease;
          width: 100%;
          display: flex;
          justify-content: center;
        }

        @media (max-width: 900px) {
          .toolbar-container {
            flex-direction: column;
            align-items: stretch;
          }
          .tb-left, .tb-center, .tb-right {
            justify-content: center;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}
