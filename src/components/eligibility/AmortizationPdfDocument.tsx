'use client';

import React from 'react';
import { CustomerInfo } from '@/lib/eligibility/eligibilityTypes';
import { formatIndianRupees } from '@/lib/eligibility/calculateEligibility';

export interface MonthItem {
  month: number;
  year: number;
  monthInYear: number;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
}

export interface YearSummary {
  year: number;
  openingBalance: number;
  totalEmi: number;
  totalPrincipal: number;
  totalInterest: number;
  closingBalance: number;
  months: MonthItem[];
}

export interface AmortizationPdfProps {
  customerInfo: CustomerInfo;
  salary: number;
  foirPercent: number;
  roiPercent: number;
  tenureMonths: number;
  principal: number;
  monthlyEmi: number;
  totalInterest: number;
  totalProcessingFees: number;
  totalPayment: number;
  yearSummaries: YearSummary[];
  schedule: MonthItem[];
}

// 1. Top-Left Corner Geometric Vector Art
export const CornerGeometryTopLeft: React.FC = () => (
  <svg
    className="corner-art top-left-art"
    viewBox="0 0 200 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
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

// 2. Bottom-Right Corner Geometric Vector Art
export const CornerGeometryBottomRight: React.FC = () => (
  <svg
    className="corner-art bottom-right-art"
    viewBox="0 0 200 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
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

// 3. Apple Store Icon SVG
export const AppleIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0f172a" aria-hidden="true">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.4c.64-.78 1.08-1.86.96-2.95-1 .04-2.14.67-2.8 1.44-.58.67-1.09 1.76-.95 2.82 1.11.09 2.16-.54 2.79-1.31z" />
  </svg>
);

// 4. Play Store Icon SVG
export const PlayStoreIcon: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="#0f172a" aria-hidden="true">
    <path d="M4.06 2.48C3.76 2.81 3.58 3.32 3.58 3.99v16.02c0 .67.18 1.18.48 1.51l.08.07 9-9v-.21l-9.08-9.39-.08.07zM16.59 15.02L13.14 11.57v-.14L16.59 7.98l.09.05 4.09 2.33c1.17.66 1.17 1.74 0 2.41l-4.09 2.33-.09.05zM13.14 11.57l-9.08 9.08c.41.43 1.08.49 1.84.06l10.7-6.09-3.46-3.05zM13.14 11.43l3.46-3.05L5.9 2.29c-.76-.43-1.43-.37-1.84.06l9.08 9.08z" />
  </svg>
);

// 5. Circular Donut Chart SVG matching the uploaded PDF
export const ContinuumDonutChart: React.FC<{
  principal: number;
  interest: number;
  total: number;
}> = ({ principal, interest, total }) => {
  const safeTotal = total > 0 ? total : 1;
  const princFrac = Math.min(1, Math.max(0.01, principal / safeTotal));

  const radius = 45;
  const strokeWidth = 26;
  const circ = 2 * Math.PI * radius;
  const princDash = circ * princFrac;

  return (
    <div className="donut-chart-box">
      <svg width="126" height="126" viewBox="0 0 128 128">
        {/* Cyan slice for Interest */}
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="transparent"
          stroke="#06b6d4"
          strokeWidth={strokeWidth}
        />
        {/* Orange slice for Principal */}
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="transparent"
          stroke="#f59e0b"
          strokeWidth={strokeWidth}
          strokeDasharray={`${princDash} ${circ}`}
          strokeDashoffset="0"
          transform="rotate(-90 64 64)"
        />
      </svg>
    </div>
  );
};

export const AmortizationPdfDocument: React.FC<AmortizationPdfProps> = ({
  customerInfo,
  salary,
  foirPercent,
  roiPercent,
  tenureMonths,
  principal,
  monthlyEmi,
  totalInterest,
  totalProcessingFees,
  totalPayment,
  yearSummaries,
}) => {
  const applicantName = customerInfo.name || customerInfo.customerName || 'Institutional Client';
  const applicantPhone = customerInfo.mobile || 'N/A';
  const applicantEmail = customerInfo.email || 'N/A';
  const applicantPan = customerInfo.pan || 'N/A';
  const applicantCompany = customerInfo.company || customerInfo.companyName || 'Corporate Salaried';

  const tenureYears = (tenureMonths / 12).toFixed(1);
  const tenureDisplay = `${tenureMonths} (${tenureYears} yr)`;

  // Split into pages:
  // Page 1: Year 1
  // Page 2: Year 2 & 3
  // Page 3: Year 4 & 5
  // Page 4: Year 6 & 7 ... dynamically for full tenure
  const page1Year = yearSummaries[0] || null;
  const subsequentPages: YearSummary[][] = [];

  for (let i = 1; i < yearSummaries.length; i += 2) {
    subsequentPages.push(yearSummaries.slice(i, i + 2));
  }

  return (
    <div className="amort-pdf-document-root">
      {/* ==============================================================
          PAGE 1: Header, User Details, EMI Details Card, Monthly Report, Year 1
      ============================================================== */}
      <div className="pdf-page page-1">
        <CornerGeometryTopLeft />
        <CornerGeometryBottomRight />

        <div className="page-inner-content">
          {/* Main Title Header */}
          <div className="document-header">
            <h1 className="doc-main-title">EMI Calculator</h1>
            <p className="doc-sub-title">by InCraax Underwriting Engine</p>
          </div>

          {/* USER ALL DETAILS: Applicant Information Strip */}
          <div className="applicant-details-card">
            <div className="applicant-header-strip">
              <span className="applicant-title">✦ Applicant & Underwriting Profile</span>
              <span className="applicant-salary-badge">
                Net Salary: <strong>{formatIndianRupees(salary)}/mo</strong>
              </span>
            </div>
            <div className="applicant-grid">
              <div className="app-field">
                <span className="app-lbl">Applicant Name:</span>
                <span className="app-val font-semibold">{applicantName}</span>
              </div>
              <div className="app-field">
                <span className="app-lbl">Contact Mobile:</span>
                <span className="app-val font-mono">{applicantPhone}</span>
              </div>
              <div className="app-field">
                <span className="app-lbl">Email Address:</span>
                <span className="app-val">{applicantEmail}</span>
              </div>
              <div className="app-field">
                <span className="app-lbl">PAN Identifier:</span>
                <span className="app-val font-mono">{applicantPan}</span>
              </div>
              <div className="app-field">
                <span className="app-lbl">Company / Employer:</span>
                <span className="app-val">{applicantCompany}</span>
              </div>
              <div className="app-field">
                <span className="app-lbl">FOIR Ceiling:</span>
                <span className="app-val font-semibold">{foirPercent}%</span>
              </div>
            </div>
          </div>

          {/* EMI DETAILS CARD WITH DONUT CHART & AMOUNTS */}
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
                    <span className="metric-value font-mono">₹ {formatIndianRupees(principal)}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Interest Rate</span>
                    <span className="metric-value">{roiPercent} %</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Period (Months)</span>
                    <span className="metric-value">{tenureDisplay}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Processing Fees</span>
                    <span className="metric-value font-mono">
                      {totalProcessingFees > 0 ? `₹ ${formatIndianRupees(totalProcessingFees)}` : '0'}
                    </span>
                  </div>
                </div>

                <div className="your-emi-row">
                  <span className="your-emi-label">Your EMI</span>
                  <div className="your-emi-pill">
                    <span className="your-emi-value font-mono">₹ {formatIndianRupees(monthlyEmi)}</span>
                  </div>
                </div>
              </div>

              {/* Vertical Divider Line */}
              <div className="card-vertical-divider" />

              {/* Right Column: Donut Chart & Legend */}
              <div className="card-right-col">
                <ContinuumDonutChart
                  principal={principal}
                  interest={totalInterest}
                  total={totalPayment}
                />
                <div className="chart-legend-list">
                  <div className="legend-entry">
                    <div className="legend-bullet-box">
                      <span className="bullet-dot bullet-orange" />
                      <span className="legend-name">Principal</span>
                    </div>
                    <span className="legend-amount font-mono">₹ {formatIndianRupees(principal)}</span>
                  </div>
                  <div className="legend-entry">
                    <div className="legend-bullet-box">
                      <span className="bullet-dot bullet-cyan" />
                      <span className="legend-name">Interest</span>
                    </div>
                    <span className="legend-amount font-mono">₹ {formatIndianRupees(totalInterest)}</span>
                  </div>
                  <div className="legend-entry">
                    <div className="legend-bullet-box">
                      <span className="bullet-dot bullet-gray" />
                      <span className="legend-name">Total Payment</span>
                    </div>
                    <span className="legend-amount font-mono">₹ {formatIndianRupees(totalPayment)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MONTHLY REPORT BANNER */}
          <div className="monthly-report-banner">
            <span className="star-icon">✦</span>
            <span className="banner-title">Monthly Report</span>
          </div>

          {/* Year 1 Table */}
          {page1Year && (
            <div className="schedule-table-wrap">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th className="col-month">Month</th>
                    <th className="col-principal">Principal (₹)</th>
                    <th className="col-interest">Interest (₹)</th>
                    <th className="col-balance">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {page1Year.months.map((m) => (
                    <tr key={`p1-m-${m.month}`}>
                      <td className="col-month font-mono">{m.month}</td>
                      <td className="col-principal font-mono">{formatIndianRupees(m.principal)}</td>
                      <td className="col-interest font-mono">{formatIndianRupees(m.interest)}</td>
                      <td className="col-balance font-mono">{formatIndianRupees(m.closingBalance)}</td>
                    </tr>
                  ))}
                  <tr className="year-summary-row">
                    <td className="col-month font-bold">Year {page1Year.year}</td>
                    <td className="col-principal font-bold font-mono">{formatIndianRupees(page1Year.totalPrincipal)}</td>
                    <td className="col-interest font-bold font-mono">{formatIndianRupees(page1Year.totalInterest)}</td>
                    <td className="col-balance font-bold font-mono">{formatIndianRupees(page1Year.closingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Page 1 Footer */}
        <div className="document-footer">
          <div className="footer-brand">
            <div className="app-icon-badge"><span className="app-icon-text">EMI</span></div>
            <div className="app-brand-info">
              <span className="app-name">EMI Calculator</span>
              <span className="app-sub">by InCraax Underwriting Platform</span>
            </div>
          </div>
          <div className="footer-badges">
            <div className="store-icon" title="Google Play Store"><PlayStoreIcon /></div>
            <div className="store-icon" title="Apple App Store"><AppleIcon /></div>
          </div>
        </div>
      </div>

      {/* ==============================================================
          SUBSEQUENT PAGES: (Year 2 & 3, Year 4 & 5, etc. for full duration)
      ============================================================== */}
      {subsequentPages.map((pageYears, pageIdx) => (
        <div key={`subsequent-page-${pageIdx + 2}`} className={`pdf-page page-${pageIdx + 2}`}>
          <CornerGeometryTopLeft />
          <CornerGeometryBottomRight />

          <div className="page-inner-content">
            <div className="document-header">
              <h1 className="doc-main-title">EMI Calculator</h1>
              <p className="doc-sub-title">by InCraax Underwriting Engine</p>
            </div>

            <div className="multi-table-page">
              {pageYears.map((yr, idx) => (
                <div key={`page-yr-${yr.year}`} className={idx > 0 ? 'table-gap-wrap' : ''}>
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th className="col-month">Month</th>
                        <th className="col-principal">Principal (₹)</th>
                        <th className="col-interest">Interest (₹)</th>
                        <th className="col-balance">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yr.months.map((m) => (
                        <tr key={`p${pageIdx + 2}-m-${m.month}`}>
                          <td className="col-month font-mono">{m.month}</td>
                          <td className="col-principal font-mono">{formatIndianRupees(m.principal)}</td>
                          <td className="col-interest font-mono">{formatIndianRupees(m.interest)}</td>
                          <td className="col-balance font-mono">{formatIndianRupees(m.closingBalance)}</td>
                        </tr>
                      ))}
                      <tr className="year-summary-row">
                        <td className="col-month font-bold">Year {yr.year}</td>
                        <td className="col-principal font-bold font-mono">{formatIndianRupees(yr.totalPrincipal)}</td>
                        <td className="col-interest font-bold font-mono">{formatIndianRupees(yr.totalInterest)}</td>
                        <td className="col-balance font-bold font-mono">{formatIndianRupees(yr.closingBalance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          <div className="document-footer">
            <div className="footer-brand">
              <div className="app-icon-badge"><span className="app-icon-text">EMI</span></div>
              <div className="app-brand-info">
                <span className="app-name">EMI Calculator</span>
                <span className="app-sub">by InCraax Underwriting Platform</span>
              </div>
            </div>
            <div className="footer-badges">
              <div className="store-icon" title="Google Play Store"><PlayStoreIcon /></div>
              <div className="store-icon" title="Apple App Store"><AppleIcon /></div>
            </div>
          </div>
        </div>
      ))}

      <style jsx global>{`
        /* -------------------------------------------------------------
           CONTINUUM STYLE MULTI-PAGE PDF STYLES
        ------------------------------------------------------------- */
        .amort-pdf-document-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          box-sizing: border-box;
          width: 100%;
        }

        .pdf-page {
          position: relative;
          width: 210mm;
          min-height: 297mm;
          height: 297mm;
          background: #ffffff;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
          border-radius: 2px;
          padding: 22mm 18mm 16mm 18mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          margin: 0 auto;
        }

        .page-inner-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        /* Corner Vectors */
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
          margin-bottom: 14px;
        }

        .doc-main-title {
          font-size: 25px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #1e293b;
          margin: 0;
          line-height: 1.15;
        }

        .doc-sub-title {
          font-size: 13px;
          color: #0284c7;
          margin: 3px 0 0 0;
          font-weight: 500;
        }

        /* Applicant Profile Card */
        .applicant-details-card {
          border: 1px solid #e0f2fe;
          border-radius: 10px;
          background: #f8fafc;
          overflow: hidden;
          margin-bottom: 14px;
        }

        .applicant-header-strip {
          background: #e0f2fe;
          padding: 6px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .applicant-title {
          font-size: 11.5px;
          font-weight: 700;
          color: #0369a1;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .applicant-salary-badge {
          font-size: 11.5px;
          color: #0f172a;
        }

        .applicant-salary-badge strong {
          color: #0369a1;
        }

        .applicant-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px 16px;
          padding: 8px 14px;
          font-size: 11px;
        }

        .app-field {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .app-lbl {
          color: #64748b;
          flex-shrink: 0;
        }

        .app-val {
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* EMI Details Card */
        .emi-details-card {
          border: 1px solid #dbeafe;
          border-radius: 12px;
          background: #ffffff;
          overflow: hidden;
          margin-bottom: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }

        .card-top-bar {
          background: #cce7ff;
          padding: 7px 16px;
          border-bottom: 1px solid #bfdbfe;
        }

        .card-bar-title {
          font-size: 12.5px;
          font-weight: 700;
          color: #0f172a;
        }

        .card-content-grid {
          display: flex;
          align-items: stretch;
          padding: 14px 18px;
        }

        .card-left-col {
          flex: 1.15;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding-right: 16px;
        }

        .metrics-2x2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 16px;
          margin-bottom: 12px;
        }

        .metric-item {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .metric-label {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }

        .metric-value {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .your-emi-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 8px;
          border-top: 1px solid #f1f5f9;
        }

        .your-emi-label {
          font-size: 12.5px;
          color: #475569;
          font-weight: 500;
        }

        .your-emi-pill {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 5px 18px;
          display: inline-flex;
          align-items: center;
        }

        .your-emi-value {
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
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
          padding-left: 18px;
          gap: 14px;
        }

        .donut-chart-box {
          flex-shrink: 0;
          width: 126px;
          height: 126px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chart-legend-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
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
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          padding-left: 14px;
        }

        /* Monthly Report Banner */
        .monthly-report-banner {
          background: #1e75bb;
          border-radius: 8px 8px 0 0;
          padding: 7px 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #ffffff;
        }

        .star-icon {
          font-size: 12px;
          color: #ffffff;
        }

        .banner-title {
          font-size: 13px;
          font-weight: 700;
        }

        /* Schedule Table */
        .schedule-table-wrap {
          width: 100%;
        }

        .schedule-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
        }

        .schedule-table th {
          background: #ffffff;
          padding: 6px 8px;
          font-size: 11.5px;
          font-weight: 700;
          color: #1e293b;
          border: 1px solid #e2e8f0;
          text-align: center;
        }

        .schedule-table td {
          padding: 5px 8px;
          color: #334155;
          border: 1px solid #e2e8f0;
          text-align: center;
        }

        .col-month { width: 18%; }
        .col-principal { width: 27%; }
        .col-interest { width: 27%; }
        .col-balance { width: 28%; }

        .year-summary-row td {
          background: #f8fafc;
          font-weight: 700 !important;
          color: #0f172a !important;
          padding: 6px 8px;
          border-top: 1.5px solid #cbd5e1;
          border-bottom: 1.5px solid #cbd5e1;
        }

        .multi-table-page {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .table-gap-wrap {
          margin-top: 12px;
        }

        /* Document Footer */
        .document-footer {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          margin-top: auto;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .app-icon-badge {
          width: 36px;
          height: 36px;
          background: #00a2e8;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .app-icon-text {
          color: #ffffff;
          font-weight: 900;
          font-size: 12px;
        }

        .app-brand-info {
          display: flex;
          flex-direction: column;
        }

        .app-name {
          font-size: 12.5px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }

        .app-sub {
          font-size: 10px;
          color: #0284c7;
          font-weight: 500;
        }

        .footer-badges {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .store-icon {
          width: 28px;
          height: 28px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* -------------------------------------------------------------
           PRINT-SPECIFIC OPTIMIZATION
        ------------------------------------------------------------- */
        @media print {
          .amort-pdf-document-root {
            gap: 0 !important;
            padding: 0 !important;
          }

          .pdf-page {
            box-shadow: none !important;
            border-radius: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding: 18mm 16mm 14mm 16mm !important;
            page-break-after: always !important;
            break-after: page !important;
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
