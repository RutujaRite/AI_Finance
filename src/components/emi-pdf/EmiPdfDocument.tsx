'use client';

import React from 'react';
import { EmiReportData, EmiYearSummary, formatIndianCurrency } from '@/lib/emi-pdf/emiPdfData';

interface EmiPdfDocumentProps {
  data: EmiReportData;
}

// 1. Top-Left Corner Geometric Crystal Facets
export const CornerGeometryTopLeft: React.FC = () => (
  <svg
    className="corner-art top-left-art"
    viewBox="0 0 200 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Interlocking low-poly cyan & light-blue triangles */}
    <polygon points="0,0 130,0 0,65" fill="#bae6fd" fillOpacity="0.75" />
    <polygon points="130,0 190,0 145,55" fill="#7dd3fc" fillOpacity="0.6" />
    <polygon points="0,65 130,0 85,85" fill="#38bdf8" fillOpacity="0.5" />
    <polygon points="0,65 85,85 0,120" fill="#e0f2fe" fillOpacity="0.9" />
    <polygon points="85,85 145,55 125,105" fill="#0284c7" fillOpacity="0.35" />
    <polygon points="0,120 85,85 45,140" fill="#7dd3fc" fillOpacity="0.65" />
    <polygon points="0,120 45,140 0,160" fill="#bae6fd" fillOpacity="0.8" />
    <polygon points="45,140 125,105 75,155" fill="#0ea5e9" fillOpacity="0.3" />
  </svg>
);

// 2. Bottom-Right Corner Geometric Crystal Facets
export const CornerGeometryBottomRight: React.FC = () => (
  <svg
    className="corner-art bottom-right-art"
    viewBox="0 0 200 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Inverted matching low-poly cyan & light-blue triangles */}
    <polygon points="200,160 70,160 200,95" fill="#bae6fd" fillOpacity="0.75" />
    <polygon points="70,160 10,160 55,105" fill="#7dd3fc" fillOpacity="0.6" />
    <polygon points="200,95 70,160 115,75" fill="#38bdf8" fillOpacity="0.5" />
    <polygon points="200,95 115,75 200,40" fill="#e0f2fe" fillOpacity="0.9" />
    <polygon points="115,75 55,105 75,55" fill="#0284c7" fillOpacity="0.35" />
    <polygon points="200,40 115,75 155,20" fill="#7dd3fc" fillOpacity="0.65" />
    <polygon points="200,40 155,20 200,0" fill="#bae6fd" fillOpacity="0.8" />
    <polygon points="155,20 75,55 125,5" fill="#0ea5e9" fillOpacity="0.3" />
  </svg>
);

// 3. Apple Logo SVG
export const AppleIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="#0f172a" aria-hidden="true">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.4c.64-.78 1.08-1.86.96-2.95-1 .04-2.14.67-2.8 1.44-.58.67-1.09 1.76-.95 2.82 1.11.09 2.16-.54 2.79-1.31z" />
  </svg>
);

// 4. Google Play Icon SVG
export const PlayStoreIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0f172a" aria-hidden="true">
    <path d="M4.06 2.48C3.76 2.81 3.58 3.32 3.58 3.99v16.02c0 .67.18 1.18.48 1.51l.08.07 9-9v-.21l-9.08-9.39-.08.07zM16.59 15.02L13.14 11.57v-.14L16.59 7.98l.09.05 4.09 2.33c1.17.66 1.17 1.74 0 2.41l-4.09 2.33-.09.05zM13.14 11.57l-9.08 9.08c.41.43 1.08.49 1.84.06l10.7-6.09-3.46-3.05zM13.14 11.43l3.46-3.05L5.9 2.29c-.76-.43-1.43-.37-1.84.06l9.08 9.08z" />
  </svg>
);

// 5. Circular Donut Chart SVG
export const DonutChart: React.FC<{
  principal: number;
  interest: number;
  total: number;
}> = ({ principal, interest, total }) => {
  const safeTotal = total > 0 ? total : 1;
  const princFrac = Math.min(1, Math.max(0, principal / safeTotal));
  
  // Circumference of radius 45 is 2 * PI * 45 = 282.74
  const radius = 45;
  const strokeWidth = 26;
  const circ = 2 * Math.PI * radius;
  const princDash = circ * princFrac;
  const intDash = circ * (1 - princFrac);

  return (
    <div className="donut-chart-container">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="transparent"
          stroke="#06b6d4" // Cyan for Interest
          strokeWidth={strokeWidth}
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="transparent"
          stroke="#f59e0b" // Orange for Principal
          strokeWidth={strokeWidth}
          strokeDasharray={`${princDash} ${circ}`}
          strokeDashoffset="0"
          transform="rotate(-90 64 64)"
        />
      </svg>
    </div>
  );
};

// 6. Header Section Component (Shared across every page)
export const DocumentHeader: React.FC<{
  title: string;
  subtitle: string;
}> = ({ title, subtitle }) => (
  <div className="document-header">
    <h1 className="doc-main-title">{title}</h1>
    <p className="doc-sub-title">{subtitle}</p>
  </div>
);

// 7. Footer Section Component (Shared across every page)
export const DocumentFooter: React.FC<{
  title: string;
  subtitle: string;
}> = ({ title, subtitle }) => (
  <div className="document-footer">
    <div className="footer-brand">
      <div className="app-icon-badge">
        <span className="app-icon-text">EMI</span>
      </div>
      <div className="app-brand-info">
        <span className="app-name">{title}</span>
        <span className="app-sub">{subtitle}</span>
      </div>
    </div>
    <div className="footer-badges">
      <div className="store-icon" title="Google Play">
        <PlayStoreIcon />
      </div>
      <div className="store-icon" title="Apple App Store">
        <AppleIcon />
      </div>
    </div>
  </div>
);

// 8. Monthly Schedule Table Component
export const AmortizationTable: React.FC<{
  yearSummary: EmiYearSummary;
  showHeader?: boolean;
}> = ({ yearSummary, showHeader = true }) => (
  <div className="schedule-table-wrap">
    <table className="schedule-table">
      {showHeader && (
        <thead>
          <tr>
            <th className="col-month">Month</th>
            <th className="col-principal">Principal (₹)</th>
            <th className="col-interest">Interest (₹)</th>
            <th className="col-balance">Balance (₹)</th>
          </tr>
        </thead>
      )}
      <tbody>
        {yearSummary.months.map((m) => (
          <tr key={`month-${m.month}`}>
            <td className="col-month">{m.month}</td>
            <td className="col-principal">{formatIndianCurrency(m.principal)}</td>
            <td className="col-interest">{formatIndianCurrency(m.interest)}</td>
            <td className="col-balance">{formatIndianCurrency(m.balance)}</td>
          </tr>
        ))}
        {/* Year Summary Row */}
        <tr className="year-summary-row">
          <td className="col-month font-bold">Year {yearSummary.year}</td>
          <td className="col-principal font-bold">{formatIndianCurrency(yearSummary.totalPrincipal)}</td>
          <td className="col-interest font-bold">{formatIndianCurrency(yearSummary.totalInterest)}</td>
          <td className="col-balance font-bold">{formatIndianCurrency(yearSummary.closingBalance)}</td>
        </tr>
      </tbody>
    </table>
  </div>
);

// 9. Main 4-Page Document Component
export const EmiPdfDocument: React.FC<EmiPdfDocumentProps> = ({ data }) => {
  const {
    loanAmount,
    interestRate,
    periodMonths,
    processingFees,
    monthlyEmi,
    totalPrincipal,
    totalInterest,
    totalPayment,
    appTitle,
    appSubtitle,
    years,
  } = data;

  // Split into pages matching the Continuum App design:
  // Page 1: Year 1
  // Page 2: Year 2 & Year 3
  // Page 3: Year 4 & Year 5
  // Page 4: Year 6
  // (Or dynamically grouped if tenure differs)
  const page1Year = years[0] || null;
  const page2Years = years.slice(1, 3);
  const page3Years = years.slice(3, 5);
  const page4Years = years.slice(5, 7);

  const tenureYearsText = Math.floor(periodMonths / 12);
  const tenureDisplay = `${periodMonths} (${tenureYearsText} yr)`;

  return (
    <div className="emi-pdf-container">
      {/* ==============================================================
          PAGE 1: Header, EMI Details Card, Monthly Report, Year 1
      ============================================================== */}
      <div className="pdf-page page-1">
        <CornerGeometryTopLeft />
        <CornerGeometryBottomRight />

        <div className="page-inner-content">
          <DocumentHeader title={appTitle} subtitle={appSubtitle} />

          {/* EMI Details Card */}
          <div className="emi-details-card">
            <div className="card-top-bar">
              <span className="card-bar-title">EMI Details</span>
            </div>

            <div className="card-content-grid">
              {/* Left Column: 2x2 Grid + Your EMI */}
              <div className="card-left-col">
                <div className="metrics-2x2">
                  <div className="metric-item">
                    <span className="metric-label">Loan Amount</span>
                    <span className="metric-value">₹ {formatIndianCurrency(loanAmount)}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Interest Rate</span>
                    <span className="metric-value">{interestRate} %</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Period (Months)</span>
                    <span className="metric-value">{tenureDisplay}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Processing Fees</span>
                    <span className="metric-value">{processingFees}</span>
                  </div>
                </div>

                <div className="your-emi-row">
                  <span className="your-emi-label">Your EMI</span>
                  <div className="your-emi-pill">
                    <span className="your-emi-value">₹ {formatIndianCurrency(monthlyEmi)}</span>
                  </div>
                </div>
              </div>

              {/* Vertical Divider Line */}
              <div className="card-vertical-divider" />

              {/* Right Column: Donut Chart & Legend */}
              <div className="card-right-col">
                <DonutChart
                  principal={totalPrincipal}
                  interest={totalInterest}
                  total={totalPayment}
                />
                <div className="chart-legend-list">
                  <div className="legend-entry">
                    <div className="legend-bullet-box">
                      <span className="bullet-dot bullet-orange" />
                      <span className="legend-name">Principal</span>
                    </div>
                    <span className="legend-amount">₹ {formatIndianCurrency(totalPrincipal)}</span>
                  </div>
                  <div className="legend-entry">
                    <div className="legend-bullet-box">
                      <span className="bullet-dot bullet-cyan" />
                      <span className="legend-name">Interest</span>
                    </div>
                    <span className="legend-amount">₹ {formatIndianCurrency(totalInterest)}</span>
                  </div>
                  <div className="legend-entry">
                    <div className="legend-bullet-box">
                      <span className="bullet-dot bullet-gray" />
                      <span className="legend-name">Total Payment</span>
                    </div>
                    <span className="legend-amount">₹ {formatIndianCurrency(totalPayment)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Report Banner */}
          <div className="monthly-report-banner">
            <span className="star-icon">✦</span>
            <span className="banner-title">Monthly Report</span>
          </div>

          {/* Year 1 Table */}
          {page1Year && <AmortizationTable yearSummary={page1Year} showHeader={true} />}
        </div>

        <DocumentFooter title={appTitle} subtitle={appSubtitle} />
      </div>

      {/* ==============================================================
          PAGE 2: Year 2 and Year 3 (Months 13 - 36)
      ============================================================== */}
      {page2Years.length > 0 && (
        <div className="pdf-page page-2">
          <CornerGeometryTopLeft />
          <CornerGeometryBottomRight />

          <div className="page-inner-content">
            <DocumentHeader title={appTitle} subtitle={appSubtitle} />

            <div className="multi-table-page">
              {page2Years.map((yr, idx) => (
                <div key={`page2-yr-${yr.year}`} className={idx > 0 ? 'table-gap-wrap' : ''}>
                  <AmortizationTable yearSummary={yr} showHeader={true} />
                </div>
              ))}
            </div>
          </div>

          <DocumentFooter title={appTitle} subtitle={appSubtitle} />
        </div>
      )}

      {/* ==============================================================
          PAGE 3: Year 4 and Year 5 (Months 37 - 60)
      ============================================================== */}
      {page3Years.length > 0 && (
        <div className="pdf-page page-3">
          <CornerGeometryTopLeft />
          <CornerGeometryBottomRight />

          <div className="page-inner-content">
            <DocumentHeader title={appTitle} subtitle={appSubtitle} />

            <div className="multi-table-page">
              {page3Years.map((yr, idx) => (
                <div key={`page3-yr-${yr.year}`} className={idx > 0 ? 'table-gap-wrap' : ''}>
                  <AmortizationTable yearSummary={yr} showHeader={true} />
                </div>
              ))}
            </div>
          </div>

          <DocumentFooter title={appTitle} subtitle={appSubtitle} />
        </div>
      )}

      {/* ==============================================================
          PAGE 4: Year 6 (Months 61 - 72)
      ============================================================== */}
      {page4Years.length > 0 && (
        <div className="pdf-page page-4">
          <CornerGeometryTopLeft />
          <CornerGeometryBottomRight />

          <div className="page-inner-content">
            <DocumentHeader title={appTitle} subtitle={appSubtitle} />

            <div className="multi-table-page">
              {page4Years.map((yr) => (
                <div key={`page4-yr-${yr.year}`}>
                  <AmortizationTable yearSummary={yr} showHeader={true} />
                </div>
              ))}
            </div>
          </div>

          <DocumentFooter title={appTitle} subtitle={appSubtitle} />
        </div>
      )}

      <style jsx global>{`
        /* -------------------------------------------------------------
           EXACT CONTINUUM APP EMI CALCULATOR STYLES
        ------------------------------------------------------------- */
        .emi-pdf-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
          padding: 30px 16px;
          background: #e2e8f0;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          box-sizing: border-box;
        }

        /* Standard A4 Physical Aspect Ratio Sheet: 210mm x 297mm */
        .pdf-page {
          position: relative;
          width: 210mm;
          min-height: 297mm;
          height: 297mm;
          background: #ffffff;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
          border-radius: 2px;
          padding: 24mm 20mm 18mm 20mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }

        .page-inner-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        /* Corner Vector Art */
        .corner-art {
          position: absolute;
          width: 170px;
          height: 140px;
          z-index: 1;
          pointer-events: none;
        }

        .top-left-art {
          top: 0;
          left: 0;
        }

        .bottom-right-art {
          bottom: 0;
          right: 0;
        }

        /* Document Header */
        .document-header {
          text-align: center;
          margin-bottom: 22px;
          position: relative;
          z-index: 2;
        }

        .doc-main-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #1e293b;
          margin: 0;
          line-height: 1.15;
        }

        .doc-sub-title {
          font-size: 13.5px;
          color: #0284c7;
          margin: 4px 0 0 0;
          font-weight: 500;
        }

        /* 1. EMI Details Card */
        .emi-details-card {
          border: 1px solid #dbeafe;
          border-radius: 12px;
          background: #ffffff;
          overflow: hidden;
          margin-bottom: 20px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
        }

        .card-top-bar {
          background: #cce7ff;
          padding: 9px 18px;
          border-bottom: 1px solid #bfdbfe;
        }

        .card-bar-title {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .card-content-grid {
          display: flex;
          align-items: stretch;
          padding: 18px 22px 20px 22px;
        }

        .card-left-col {
          flex: 1.15;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding-right: 18px;
        }

        .metrics-2x2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 18px;
          margin-bottom: 16px;
        }

        .metric-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .metric-label {
          font-size: 11.5px;
          color: #64748b;
          font-weight: 500;
        }

        .metric-value {
          font-size: 15.5px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .your-emi-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid #f1f5f9;
        }

        .your-emi-label {
          font-size: 13px;
          color: #475569;
          font-weight: 500;
        }

        .your-emi-pill {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .your-emi-value {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .card-vertical-divider {
          width: 1px;
          background: #e2e8f0;
          margin: 0 4px;
        }

        .card-right-col {
          flex: 1.05;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-left: 20px;
          gap: 16px;
        }

        .donut-chart-container {
          flex-shrink: 0;
          width: 128px;
          height: 128px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chart-legend-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }

        .legend-entry {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .legend-bullet-box {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .bullet-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }

        .bullet-orange { background: #f59e0b; }
        .bullet-cyan { background: #06b6d4; }
        .bullet-gray { background: #94a3b8; }

        .legend-name {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }

        .legend-amount {
          font-size: 14.5px;
          font-weight: 700;
          color: #0f172a;
          padding-left: 14px;
          letter-spacing: -0.01em;
        }

        /* Monthly Report Blue Header Banner */
        .monthly-report-banner {
          background: #1e75bb;
          border-radius: 8px 8px 0 0;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ffffff;
        }

        .star-icon {
          font-size: 13px;
          color: #ffffff;
        }

        .banner-title {
          font-size: 13.5px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        /* Schedule Table */
        .schedule-table-wrap {
          width: 100%;
        }

        .schedule-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
        }

        .schedule-table th {
          background: #ffffff;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
          color: #1e293b;
          border: 1px solid #e2e8f0;
          text-align: center;
        }

        .schedule-table td {
          padding: 6px 10px;
          color: #334155;
          border: 1px solid #e2e8f0;
          text-align: center;
          font-weight: 400;
        }

        .col-month { width: 18%; }
        .col-principal { width: 27%; }
        .col-interest { width: 27%; }
        .col-balance { width: 28%; }

        .year-summary-row {
          background: #f8fafc;
          border-top: 1.5px solid #cbd5e1;
          border-bottom: 1.5px solid #cbd5e1;
        }

        .year-summary-row td {
          font-weight: 700 !important;
          color: #0f172a !important;
          padding: 7px 10px;
        }

        .font-bold {
          font-weight: 700 !important;
        }

        /* Multi table per page spacing */
        .multi-table-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .table-gap-wrap {
          margin-top: 14px;
        }

        /* Document Footer */
        .document-footer {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          margin-top: auto;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .app-icon-badge {
          width: 38px;
          height: 38px;
          background: #00a2e8;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0, 162, 232, 0.25);
        }

        .app-icon-text {
          color: #ffffff;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: -0.02em;
        }

        .app-brand-info {
          display: flex;
          flex-direction: column;
        }

        .app-name {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }

        .app-sub {
          font-size: 10.5px;
          color: #0284c7;
          font-weight: 500;
        }

        .footer-badges {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .store-icon {
          width: 30px;
          height: 30px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .store-icon:hover {
          background: #f1f5f9;
        }

        /* -------------------------------------------------------------
           PRINT-SPECIFIC CSS: WINDOW.PRINT() / SAVE AS PDF
        ------------------------------------------------------------- */
        @media print {
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide everything outside of print page */
          .no-print,
          .screen-toolbar,
          .floating-toast,
          header,
          footer,
          .site-header,
          .site-footer {
            display: none !important;
          }

          .emi-pdf-container {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            gap: 0 !important;
          }

          .pdf-page {
            box-shadow: none !important;
            border-radius: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding: 20mm 18mm 16mm 18mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .pdf-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};
