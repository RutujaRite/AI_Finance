'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarClock,
  Printer,
  ChevronDown,
  ChevronUp,
  FileText,
  User,
  Phone,
  Mail,
  CreditCard,
  Building,
  IndianRupee,
  Percent,
  Coins,
  ShieldCheck,
  ArrowRight,
  Eye,
  Download,
  Loader2,
  CheckCircle2,
  PieChart as PieChartIcon,
  FileSpreadsheet
} from 'lucide-react';
import { CustomerInfo, EligibilityResult } from '@/lib/eligibility/eligibilityTypes';
import { formatIndianRupees, formatLakhsCrores } from '@/lib/eligibility/calculateEligibility';
import { AmortizationPdfDocument } from './AmortizationPdfDocument';
import { downloadAmortizationPdfFromElement } from '@/lib/eligibility/downloadAmortizationPdf';

interface RepaymentScheduleProps {
  salary: number;
  foirPercent: number;
  roiPercent: number;
  tenureMonths: number;
  result: EligibilityResult;
  customerInfo: CustomerInfo;
  onExportExcel?: () => void;
}

interface MonthItem {
  month: number;
  year: number;
  monthInYear: number;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
}

interface YearSummary {
  year: number;
  openingBalance: number;
  totalEmi: number;
  totalPrincipal: number;
  totalInterest: number;
  closingBalance: number;
  months: MonthItem[];
}

export const RepaymentSchedule: React.FC<RepaymentScheduleProps> = ({
  salary,
  foirPercent,
  roiPercent,
  tenureMonths,
  result,
  customerInfo,
  onExportExcel,
}) => {
  const [activeTab, setActiveTab] = useState<'yearly' | 'monthly' | 'chart'>('yearly');
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({ 1: true });
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(0.85);
  const [mounted, setMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const printableReportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Calculate Monthly EMI & Amortization Schedule
  const principal = Math.max(0, result.foirEligibility);
  const tenure = Math.max(1, Math.round(Number(tenureMonths) || 1));
  const annualRoi = Number(roiPercent) || 0;
  const monthlyRate = (annualRoi / 100) / 12;

  // Monthly EMI via standard amortization formula
  const monthlyEmi = useMemo(() => {
    if (principal <= 0 || tenure <= 0) return 0;
    if (monthlyRate === 0) return Math.round(principal / tenure);
    const factor = Math.pow(1 + monthlyRate, tenure);
    const emi = (principal * monthlyRate * factor) / (factor - 1);
    return isFinite(emi) ? Math.round(emi) : 0;
  }, [principal, monthlyRate, tenure]);

  // Standard processing fee (1.0% + 18% GST = 1.18% gross)
  const processingFeeBase = Math.round(principal * 0.01);
  const processingFeeGst = Math.round(processingFeeBase * 0.18);
  const totalProcessingFees = processingFeeBase + processingFeeGst;

  // Generate Month-by-Month Amortization
  const { schedule, totalInterest, totalPayment, yearSummaries } = useMemo(() => {
    if (principal <= 0 || tenure <= 0) {
      return {
        schedule: [] as MonthItem[],
        totalInterest: 0,
        totalPayment: 0,
        yearSummaries: [] as YearSummary[],
      };
    }

    let currentBalance = principal;
    let accumulatedInterest = 0;
    const items: MonthItem[] = [];

    for (let m = 1; m <= tenure; m++) {
      const year = Math.ceil(m / 12);
      const monthInYear = ((m - 1) % 12) + 1;
      const opening = currentBalance;

      let interestForMonth = Math.round(opening * monthlyRate);
      let principalForMonth = monthlyEmi - interestForMonth;

      // Handle final month adjustments to zero out balance
      if (m === tenure || principalForMonth >= opening) {
        principalForMonth = opening;
        interestForMonth = Math.max(0, Math.round(opening * monthlyRate));
        currentBalance = 0;
      } else {
        currentBalance = Math.max(0, opening - principalForMonth);
      }

      accumulatedInterest += interestForMonth;

      items.push({
        month: m,
        year,
        monthInYear,
        openingBalance: opening,
        emi: principalForMonth + interestForMonth,
        principal: principalForMonth,
        interest: interestForMonth,
        closingBalance: currentBalance,
      });
    }

    // Group into yearly summaries
    const yearsMap = new Map<number, MonthItem[]>();
    for (const item of items) {
      if (!yearsMap.has(item.year)) {
        yearsMap.set(item.year, []);
      }
      yearsMap.get(item.year)!.push(item);
    }

    const summaries: YearSummary[] = [];
    yearsMap.forEach((months, yr) => {
      const yrOpening = months[0].openingBalance;
      const yrClosing = months[months.length - 1].closingBalance;
      const yrEmi = months.reduce((acc, m) => acc + m.emi, 0);
      const yrPrincipal = months.reduce((acc, m) => acc + m.principal, 0);
      const yrInterest = months.reduce((acc, m) => acc + m.interest, 0);

      summaries.push({
        year: yr,
        openingBalance: yrOpening,
        totalEmi: yrEmi,
        totalPrincipal: yrPrincipal,
        totalInterest: yrInterest,
        closingBalance: yrClosing,
        months,
      });
    });

    const totalPay = principal + accumulatedInterest + totalProcessingFees;

    return {
      schedule: items,
      totalInterest: accumulatedInterest,
      totalPayment: totalPay,
      yearSummaries: summaries,
    };
  }, [principal, tenure, monthlyRate, monthlyEmi, totalProcessingFees]);

  // Donut Pie Chart Slice Calculation for Total Cost Breakdown
  const pieData = useMemo(() => {
    if (totalPayment <= 0) return [];
    const pPct = Number(((principal / totalPayment) * 100).toFixed(1));
    const iPct = Number(((totalInterest / totalPayment) * 100).toFixed(1));
    const fPct = Number(((totalProcessingFees / totalPayment) * 100).toFixed(1));

    return [
      { id: 'principal', label: 'Principal Loan Amount', value: principal, percent: pPct, color: '#2563eb' },
      { id: 'interest', label: 'Total Interest Amount', value: totalInterest, percent: iPct, color: '#8b5cf6' },
      { id: 'fees', label: 'Processing Fees (incl. GST)', value: totalProcessingFees, percent: fPct, color: '#f59e0b' },
    ];
  }, [principal, totalInterest, totalProcessingFees, totalPayment]);

  const toggleYear = (yr: number) => {
    setExpandedYears((prev) => ({
      ...prev,
      [yr]: !prev[yr],
    }));
  };

  const handleExportPdf = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      setDownloadStatus('Preparing PDF...');

      const container = printableReportRef.current || document.getElementById('printable-assessment-report');
      if (!container) {
        throw new Error('Assessment report container not found.');
      }

      const applicantName = customerInfo.name || customerInfo.customerName || 'Loan_Applicant';
      await downloadAmortizationPdfFromElement(container, {
        applicantName,
        onProgress: (status) => setDownloadStatus(status),
      });

      setDownloadStatus('Downloaded!');
      setTimeout(() => {
        setDownloadStatus(null);
      }, 3000);
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
      alert('Could not generate PDF file automatically. You can also click "Print / Save as PDF".');
      setDownloadStatus(null);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section className="card repayment-section-card">
      {/* 1. Header with Export PDF Action */}
      <div className="repayment-header">
        <div className="hdr-left">
          <div className="icon-wrapper">
            <CalendarClock size={18} />
          </div>
          <div>
            <h3 className="section-title">Repayment Schedule & Amortization Engine</h3>
            <p className="section-subtitle">
              Comprehensive month-by-month debt service audit & remaining balance tracking
            </p>
          </div>
        </div>

        <div className="header-actions">
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="rep-btn rep-btn-excel"
              title="Download live loan portfolio and amortization schedule in Excel (.xlsx)"
            >
              <FileSpreadsheet size={15} />
              <span>Download Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            className="rep-btn rep-btn-preview"
            title="Preview statement with user details, donut chart and complete schedule"
          >
            <Eye size={15} />
            <span>Preview Statement</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="rep-btn rep-btn-download"
            title="Download complete statement as PDF"
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            <span>{downloadStatus || 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="rep-btn rep-btn-print"
            title="Print or Save as PDF"
          >
            <Printer size={15} />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      <div className="repayment-content">
        {/* 2. Primary Loan Metrics Bar */}
        <div className="metrics-grid">
          <div className="metric-box">
            <span className="metric-lbl">Monthly EMI</span>
            <span className="metric-val font-mono text-emerald-700">
              {formatIndianRupees(monthlyEmi)}
              <span className="metric-period">/mo</span>
            </span>
            <span className="metric-sub">{tenure} Months</span>
          </div>

          <div className="metric-box">
            <span className="metric-lbl">Total Interest</span>
            <span className="metric-val font-mono text-purple-700">
              {formatIndianRupees(totalInterest)}
            </span>
            <span className="metric-sub">@ {roiPercent}% p.a.</span>
          </div>

          <div className="metric-box">
            <span className="metric-lbl">Processing Fees</span>
            <span className="metric-val font-mono text-amber-700">
              {formatIndianRupees(totalProcessingFees)}
            </span>
            <span className="metric-sub">1.0% + 18% GST</span>
          </div>

          <div className="metric-box highlight-box">
            <span className="metric-lbl">Total Payment</span>
            <span className="metric-val font-mono text-blue-800">
              {formatIndianRupees(totalPayment)}
            </span>
            <span className="metric-sub">Principal + Int + Fees</span>
          </div>
        </div>

        {/* 3. Schedule Table View Tabs (Yearly vs Monthly vs Donut) */}
        <div className="table-nav-row">
          <div className="tab-pills">
            <button
              type="button"
              className={`tab-pill ${activeTab === 'yearly' ? 'active' : ''}`}
              onClick={() => setActiveTab('yearly')}
            >
              <span>Yearly Summary ({yearSummaries.length}Y)</span>
            </button>
            <button
              type="button"
              className={`tab-pill ${activeTab === 'monthly' ? 'active' : ''}`}
              onClick={() => setActiveTab('monthly')}
            >
              <span>Monthly Schedule ({schedule.length}M)</span>
            </button>
            <button
              type="button"
              className={`tab-pill ${activeTab === 'chart' ? 'active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              <PieChartIcon size={13} />
              <span>Cost Donut Chart</span>
            </button>
          </div>

          <span className="table-hint text-slate-500">
            {activeTab === 'yearly'
              ? 'Click year row to expand 12-month breakdown'
              : activeTab === 'monthly'
                ? 'Continuous month-by-month repayment breakdown'
                : 'Principal vs Interest vs Fees distribution'}
          </span>
        </div>

        {/* 4. Cost Breakdown Donut Chart (Displayed only on 'chart' tab) */}
        {activeTab === 'chart' ? (
          <div className="cost-breakdown-card">
            <div className="breakdown-header">
              <div className="breakdown-title-group">
                <PieChartIcon size={15} className="text-blue-600" />
                <span className="breakdown-title">EMI & Total Cost Breakdown</span>
              </div>
              <span className="badge-soft">Institutional Amortization Model</span>
            </div>

            <div className="breakdown-body">
              <div className="mini-donut-wrapper">
                <svg viewBox="0 0 160 160" className="mini-donut-svg">
                  {/* SVG Segments */}
                  {(() => {
                    let accum = 0;
                    return pieData.map((slice) => {
                      const startP = accum;
                      const frac = slice.value / totalPayment;
                      const endP = accum + frac;
                      accum = endP;

                      if (frac >= 0.999) {
                        return (
                          <circle
                            key={slice.id}
                            cx="80"
                            cy="80"
                            r="55"
                            stroke={slice.color}
                            strokeWidth="24"
                            fill="transparent"
                          />
                        );
                      }

                      const sAngle = startP * 2 * Math.PI - Math.PI / 2;
                      const eAngle = endP * 2 * Math.PI - Math.PI / 2;

                      const x1 = 80 + 64 * Math.cos(sAngle);
                      const y1 = 80 + 64 * Math.sin(sAngle);
                      const x2 = 80 + 64 * Math.cos(eAngle);
                      const y2 = 80 + 64 * Math.sin(eAngle);

                      const x3 = 80 + 42 * Math.cos(eAngle);
                      const y3 = 80 + 42 * Math.sin(eAngle);
                      const x4 = 80 + 42 * Math.cos(sAngle);
                      const y4 = 80 + 42 * Math.sin(sAngle);

                      const largeArc = frac > 0.5 ? 1 : 0;
                      const d = `M ${x1} ${y1} A 64 64 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A 42 42 0 ${largeArc} 0 ${x4} ${y4} Z`;

                      return (
                        <path
                          key={slice.id}
                          d={d}
                          fill={slice.color}
                          className="pie-slice-path"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="mini-donut-center">
                  <span className="center-amount font-mono">{formatLakhsCrores(totalPayment)}</span>
                  <span className="center-tag">Total Outflow</span>
                </div>
              </div>

              <div className="breakdown-legend">
                {pieData.map((item) => (
                  <div key={item.id} className="legend-row">
                    <div className="legend-label-col">
                      <span className="dot" style={{ backgroundColor: item.color }} />
                      <span className="lbl-text">{item.label}</span>
                    </div>
                    <div className="legend-val-col font-mono">
                      <span className="val-text">{formatIndianRupees(item.value)}</span>
                      <span className="pct-badge" style={{ color: item.color, backgroundColor: `${item.color}15` }}>
                        {item.percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 5. Schedule Data Table */
          <div className="table-responsive">
            {activeTab === 'yearly' ? (
              <div className="yearly-table-container">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th>Year / Milestone</th>
                      <th className="text-right">Opening Balance</th>
                      <th className="text-right">Total EMI Paid</th>
                      <th className="text-right">Principal Paid</th>
                      <th className="text-right">Interest Paid</th>
                      <th className="text-right">Remaining Balance</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearSummaries.map((yr) => {
                      const isExpanded = !!expandedYears[yr.year];
                      return (
                        <React.Fragment key={`yr-${yr.year}`}>
                          <tr
                            className="yearly-summary-row"
                            onClick={() => toggleYear(yr.year)}
                          >
                            <td className="year-title font-semibold">
                              <span className="year-badge">Year {yr.year}</span>
                              <span className="month-range">Months {(yr.year - 1) * 12 + 1}–{Math.min(tenure, yr.year * 12)}</span>
                            </td>
                            <td className="text-right font-mono col-opening font-semibold">{formatIndianRupees(yr.openingBalance)}</td>
                            <td className="text-right font-mono col-emi font-semibold">{formatIndianRupees(yr.totalEmi)}</td>
                            <td className="text-right font-mono col-principal font-semibold">{formatIndianRupees(yr.totalPrincipal)}</td>
                            <td className="text-right font-mono col-interest font-semibold">{formatIndianRupees(yr.totalInterest)}</td>
                            <td className="text-right font-mono col-balance font-bold">{formatIndianRupees(yr.closingBalance)}</td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="expand-btn"
                                aria-label={isExpanded ? 'Collapse year' : 'Expand year'}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && yr.months.map((m) => (
                            <tr key={`m-${m.month}`} className="monthly-sub-row">
                              <td className="month-sub-col">
                                <span className="sub-indent">↳ Month {m.month} (M{m.monthInYear})</span>
                              </td>
                              <td className="text-right font-mono col-opening">{formatIndianRupees(m.openingBalance)}</td>
                              <td className="text-right font-mono col-emi font-semibold">{formatIndianRupees(m.emi)}</td>
                              <td className="text-right font-mono col-principal font-semibold">{formatIndianRupees(m.principal)}</td>
                              <td className="text-right font-mono col-interest font-semibold">{formatIndianRupees(m.interest)}</td>
                              <td className="text-right font-mono col-balance font-bold">{formatIndianRupees(m.closingBalance)}</td>
                              <td />
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="monthly-table-container">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th>Month #</th>
                      <th className="text-right">Opening Balance</th>
                      <th className="text-right">Monthly EMI</th>
                      <th className="text-right">Principal Paid</th>
                      <th className="text-right">Interest Paid</th>
                      <th className="text-right">Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((m) => (
                      <tr key={`full-m-${m.month}`} className={`monthly-data-row ${m.month % 12 === 0 ? 'year-boundary-row' : ''}`}>
                        <td className="font-semibold col-month-name">
                          Month {m.month}
                          {m.month % 12 === 0 && <span className="milestone-badge">Year {m.month / 12} End</span>}
                        </td>
                        <td className="text-right font-mono col-opening">{formatIndianRupees(m.openingBalance)}</td>
                        <td className="text-right font-mono col-emi font-semibold">{formatIndianRupees(m.emi)}</td>
                        <td className="text-right font-mono col-principal font-semibold">{formatIndianRupees(m.principal)}</td>
                        <td className="text-right font-mono col-interest font-semibold">{formatIndianRupees(m.interest)}</td>
                        <td className="text-right font-mono col-balance font-bold">{formatIndianRupees(m.closingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Printable Continuum Report Container (Rendered off-screen for downloads and visible on window.print()) */}
      <div id="printable-assessment-report" ref={printableReportRef} className="print-only-container">
        <AmortizationPdfDocument
          customerInfo={customerInfo}
          salary={salary}
          foirPercent={foirPercent}
          roiPercent={roiPercent}
          tenureMonths={tenureMonths}
          principal={principal}
          monthlyEmi={monthlyEmi}
          totalInterest={totalInterest}
          totalProcessingFees={totalProcessingFees}
          totalPayment={totalPayment}
          yearSummaries={yearSummaries}
          schedule={schedule}
        />
      </div>

      {/* 7. On-Screen Continuum-Style Multi-Page PDF Preview Modal (Mounted via Portal for Full-Screen View) */}
      {previewModalOpen && mounted && createPortal(
        <div className="preview-modal-backdrop" onClick={() => setPreviewModalOpen(false)}>
          <div className="preview-modal-card-continuum" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header-continuum">
              <div className="modal-title-group">
                <FileText size={18} className="text-blue-400" />
                <div>
                  <h4 className="modal-title-text">Amortization PDF Statement Preview</h4>
                  <span className="modal-subtitle-text">Continuum Multi-Page Format • {tenureMonths} Months Full Schedule</span>
                </div>
              </div>

              <div className="modal-actions-group">
                <div className="zoom-pill">
                  <button
                    type="button"
                    className="zoom-btn"
                    onClick={() => setPreviewZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                    title="Zoom Out"
                  >
                    –
                  </button>
                  <span className="zoom-text">{Math.round(previewZoom * 100)}%</span>
                  <button
                    type="button"
                    className="zoom-btn"
                    onClick={() => setPreviewZoom((z) => Math.min(1.2, Number((z + 0.1).toFixed(2))))}
                    title="Zoom In"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="modal-btn-download"
                  title="Download Statement as PDF"
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Download size={15} />
                  )}
                  <span>{downloadStatus || 'Download PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="modal-btn-print"
                  title="Print or Save as PDF"
                >
                  <Printer size={15} />
                  <span>Print / Save as PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="modal-btn-close"
                  aria-label="Close Preview"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="preview-modal-scroll-continuum">
              <div
                className="preview-scale-wrapper"
                style={{ transform: `scale(${previewZoom})`, transformOrigin: 'top center' }}
              >
                <AmortizationPdfDocument
                  customerInfo={customerInfo}
                  salary={salary}
                  foirPercent={foirPercent}
                  roiPercent={roiPercent}
                  tenureMonths={tenureMonths}
                  principal={principal}
                  monthlyEmi={monthlyEmi}
                  totalInterest={totalInterest}
                  totalProcessingFees={totalProcessingFees}
                  totalPayment={totalPayment}
                  yearSummaries={yearSummaries}
                  schedule={schedule}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        .repayment-section-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          margin-top: 0;
        }

        .repayment-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          border-bottom: 1px solid #e2e8f0;
          background: #ffffff;
          flex-wrap: wrap;
          gap: 8px;
        }

        .hdr-left {
          display: flex;
          align-items: center;
          gap: 10px;
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

        .section-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .section-subtitle {
          font-size: 0.72rem;
          color: #64748b;
          margin-top: 1px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .rep-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 0.74rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.16s ease;
          border: 1px solid transparent;
        }

        .rep-btn-preview {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .rep-btn-preview:hover {
          background: #dbeafe;
          border-color: #93c5fd;
          color: #1e40af;
        }

        .rep-btn-excel {
          background: #0284c7;
          border-color: #0369a1;
          color: #ffffff;
        }

        .rep-btn-excel:hover {
          background: #0369a1;
          border-color: #075985;
          color: #ffffff;
          transform: translateY(-1px);
        }

        .rep-btn-download {
          background: #ecfdf5;
          border-color: #a7f3d0;
          color: #047857;
        }

        .rep-btn-download:hover:not(:disabled) {
          background: #d1fae5;
          border-color: #6ee7b7;
          color: #065f46;
        }

        .rep-btn-download:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .rep-btn-print {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #334155;
        }

        .rep-btn-print:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .repayment-content {
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: #fafcff;
        }

        /* 2. Metrics Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 8px;
        }

        .metric-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 10px;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .highlight-box {
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .metric-lbl {
          font-size: 0.68rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .metric-val {
          font-size: 1.02rem;
          font-weight: 800;
        }

        .metric-period {
          font-size: 0.72rem;
          font-weight: 600;
          color: #64748b;
          margin-left: 2px;
        }

        .metric-sub {
          font-size: 0.68rem;
          color: #64748b;
        }

        /* 3. Cost Breakdown Card */
        .cost-breakdown-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
        }

        .breakdown-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .breakdown-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .breakdown-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: #0f172a;
        }

        .badge-soft {
          font-size: 0.7rem;
          font-weight: 600;
          color: #2563eb;
          background: #eff6ff;
          padding: 2px 8px;
          border-radius: 9999px;
          border: 1px solid #bfdbfe;
        }

        .breakdown-body {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 20px;
          align-items: center;
        }

        @media (max-width: 580px) {
          .breakdown-body {
            grid-template-columns: 1fr;
            justify-items: center;
          }
        }

        .mini-donut-wrapper {
          position: relative;
          width: 140px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mini-donut-svg {
          width: 100%;
          height: 100%;
        }

        .mini-donut-center {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .center-amount {
          font-size: 0.85rem;
          font-weight: 800;
          color: #0f172a;
        }

        .center-tag {
          font-size: 0.62rem;
          color: #64748b;
          text-transform: uppercase;
        }

        .breakdown-legend {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }

        .legend-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
        }

        .legend-label-col {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }

        .lbl-text {
          font-size: 0.78rem;
          font-weight: 600;
          color: #334155;
        }

        .legend-val-col {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .val-text {
          font-size: 0.82rem;
          font-weight: 700;
          color: #0f172a;
        }

        .pct-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 9999px;
        }

        /* 4. Table Navigation Tabs */
        .table-nav-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 4px;
        }

        .tab-pills {
          display: inline-flex;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 8px;
          gap: 2px;
        }

        .tab-pill {
          padding: 6px 12px;
          border-radius: 6px;
          border: none;
          background: transparent;
          font-size: 0.78rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab-pill.active {
          background: #ffffff;
          color: #2563eb;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
          font-weight: 700;
        }

        .table-hint {
          font-size: 0.74rem;
        }

        /* 5. Schedule Table */
        .table-responsive,
        .yearly-table-container,
        .monthly-table-container {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
          max-height: 480px;
          overflow-y: auto;
        }

        .schedule-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.78rem;
        }

        .schedule-table thead {
          position: sticky;
          top: 0;
          background: #f1f5f9;
          border-bottom: 2px solid #cbd5e1;
          z-index: 10;
        }

        .schedule-table th {
          padding: 8px 10px;
          text-align: left;
          font-size: 0.72rem;
          font-weight: 700;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .schedule-table td {
          padding: 6px 10px;
          border-bottom: 1px solid #e2e8f0;
          color: #0f172a;
        }

        .yearly-summary-row {
          background: #ffffff;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .yearly-summary-row:hover {
          background: #f8fafc;
        }

        .yearly-summary-row td {
          font-weight: 600;
        }

        .year-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .year-badge {
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.74rem;
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: 700;
          border: 1px solid #bfdbfe;
        }

        .month-range {
          font-size: 0.72rem;
          color: #475569;
          font-weight: 600;
        }

        .expand-btn {
          background: none;
          border: none;
          color: #475569;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .monthly-sub-row {
          background: #f8fafc;
        }

        .monthly-sub-row:hover {
          background: #f1f5f9;
        }

        .month-sub-col {
          padding-left: 20px !important;
          color: #0f172a;
          font-weight: 600;
        }

        .sub-indent {
          color: #334155;
          font-weight: 600;
          margin-right: 4px;
        }

        .monthly-data-row {
          background: #ffffff;
        }

        .monthly-data-row:hover {
          background: #f8fafc;
        }

        .col-month-name {
          color: #0f172a;
          font-weight: 600;
        }

        /* High-contrast accessible cell values */
        .col-opening {
          color: #334155;
          font-weight: 500;
        }

        .col-emi {
          color: #0f172a;
          font-weight: 700;
        }

        .col-principal {
          color: #1d4ed8;
          font-weight: 600;
        }

        .col-interest {
          color: #7c3aed;
          font-weight: 600;
        }

        .col-balance {
          color: #047857;
          font-weight: 700;
        }

        .year-boundary-row {
          background: #eff6ff !important;
          border-bottom: 2px solid #93c5fd;
        }

        .milestone-badge {
          font-size: 0.65rem;
          background: #1d4ed8;
          color: #ffffff;
          padding: 1px 6px;
          border-radius: 4px;
          margin-left: 6px;
        }

        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: monospace; }
        .text-emerald-700 { color: #047857; }
        .text-purple-700 { color: #7e22ce; }
        .text-amber-700 { color: #b45309; }
        .text-blue-800 { color: #1e40af; }

        /* Full Dark Theme Support for RepaymentSchedule */
        :global([data-theme="dark"]) .repayment-section-card,
        :global([data-bs-theme="dark"]) .repayment-section-card,
        :global(.dark) .repayment-section-card {
          background: var(--surface) !important;
          border-color: var(--border) !important;
        }

        :global([data-theme="dark"]) .repayment-header,
        :global([data-bs-theme="dark"]) .repayment-header,
        :global(.dark) .repayment-header {
          background: var(--surface) !important;
          border-color: var(--border) !important;
        }

        :global([data-theme="dark"]) .section-title,
        :global([data-bs-theme="dark"]) .section-title,
        :global(.dark) .section-title {
          color: #f8fafc !important;
        }

        :global([data-theme="dark"]) .section-subtitle,
        :global([data-bs-theme="dark"]) .section-subtitle,
        :global(.dark) .section-subtitle {
          color: #94a3b8 !important;
        }

        :global([data-theme="dark"]) .table-responsive,
        :global([data-theme="dark"]) .yearly-table-container,
        :global([data-theme="dark"]) .monthly-table-container,
        :global([data-bs-theme="dark"]) .table-responsive,
        :global([data-bs-theme="dark"]) .yearly-table-container,
        :global([data-bs-theme="dark"]) .monthly-table-container,
        :global(.dark) .table-responsive,
        :global(.dark) .yearly-table-container,
        :global(.dark) .monthly-table-container {
          background: #0b1120 !important;
          border-color: #1e293b !important;
        }

        :global([data-theme="dark"]) .schedule-table thead,
        :global([data-bs-theme="dark"]) .schedule-table thead,
        :global(.dark) .schedule-table thead {
          background: #111c30 !important;
          border-bottom-color: #1e293b !important;
        }

        :global([data-theme="dark"]) .schedule-table th,
        :global([data-bs-theme="dark"]) .schedule-table th,
        :global(.dark) .schedule-table th {
          color: #cbd5e1 !important;
        }

        :global([data-theme="dark"]) .schedule-table td,
        :global([data-bs-theme="dark"]) .schedule-table td,
        :global(.dark) .schedule-table td {
          border-bottom-color: #1e293b !important;
        }

        :global([data-theme="dark"]) .yearly-summary-row,
        :global([data-bs-theme="dark"]) .yearly-summary-row,
        :global(.dark) .yearly-summary-row {
          background: #152238 !important;
          border-bottom-color: #1e293b !important;
        }

        :global([data-theme="dark"]) .yearly-summary-row:hover,
        :global([data-bs-theme="dark"]) .yearly-summary-row:hover,
        :global(.dark) .yearly-summary-row:hover {
          background: #1a2a46 !important;
        }

        :global([data-theme="dark"]) .year-badge,
        :global([data-bs-theme="dark"]) .year-badge,
        :global(.dark) .year-badge {
          background: #1e3a5f !important;
          color: #93c5fd !important;
          border-color: #2563eb !important;
        }

        :global([data-theme="dark"]) .month-range,
        :global([data-bs-theme="dark"]) .month-range,
        :global(.dark) .month-range {
          color: #94a3b8 !important;
        }

        :global([data-theme="dark"]) .expand-btn,
        :global([data-bs-theme="dark"]) .expand-btn,
        :global(.dark) .expand-btn {
          color: #94a3b8 !important;
        }

        :global([data-theme="dark"]) .monthly-sub-row,
        :global([data-bs-theme="dark"]) .monthly-sub-row,
        :global(.dark) .monthly-sub-row {
          background: #0b1120 !important;
          border-bottom-color: #162032 !important;
        }

        :global([data-theme="dark"]) .monthly-sub-row:hover,
        :global([data-bs-theme="dark"]) .monthly-sub-row:hover,
        :global(.dark) .monthly-sub-row:hover {
          background: #111a2c !important;
        }

        :global([data-theme="dark"]) .month-sub-col,
        :global([data-bs-theme="dark"]) .month-sub-col,
        :global(.dark) .month-sub-col {
          color: #f1f5f9 !important;
        }

        :global([data-theme="dark"]) .sub-indent,
        :global([data-bs-theme="dark"]) .sub-indent,
        :global(.dark) .sub-indent {
          color: #94a3b8 !important;
        }

        :global([data-theme="dark"]) .monthly-data-row,
        :global([data-bs-theme="dark"]) .monthly-data-row,
        :global(.dark) .monthly-data-row {
          background: #0b1120 !important;
        }

        :global([data-theme="dark"]) .monthly-data-row:hover,
        :global([data-bs-theme="dark"]) .monthly-data-row:hover,
        :global(.dark) .monthly-data-row:hover {
          background: #111a2c !important;
        }

        :global([data-theme="dark"]) .col-month-name,
        :global([data-bs-theme="dark"]) .col-month-name,
        :global(.dark) .col-month-name {
          color: #f8fafc !important;
        }

        :global([data-theme="dark"]) .col-opening,
        :global([data-bs-theme="dark"]) .col-opening,
        :global(.dark) .col-opening {
          color: #cbd5e1 !important;
        }

        :global([data-theme="dark"]) .col-emi,
        :global([data-bs-theme="dark"]) .col-emi,
        :global(.dark) .col-emi {
          color: #ffffff !important;
        }

        :global([data-theme="dark"]) .col-principal,
        :global([data-bs-theme="dark"]) .col-principal,
        :global(.dark) .col-principal {
          color: #60a5fa !important;
        }

        :global([data-theme="dark"]) .col-interest,
        :global([data-bs-theme="dark"]) .col-interest,
        :global(.dark) .col-interest {
          color: #c084fc !important;
        }

        :global([data-theme="dark"]) .col-balance,
        :global([data-bs-theme="dark"]) .col-balance,
        :global(.dark) .col-balance {
          color: #34d399 !important;
        }

        :global([data-theme="dark"]) .year-boundary-row,
        :global([data-bs-theme="dark"]) .year-boundary-row,
        :global(.dark) .year-boundary-row {
          background: #112340 !important;
          border-bottom-color: #1e3a5f !important;
        }

        :global([data-theme="dark"]) .rep-btn-print,
        :global([data-bs-theme="dark"]) .rep-btn-print,
        :global(.dark) .rep-btn-print {
          background: var(--surface-2) !important;
          border-color: var(--border) !important;
          color: var(--ink-soft) !important;
        }

        :global([data-theme="dark"]) .rep-btn-print:hover,
        :global([data-bs-theme="dark"]) .rep-btn-print:hover,
        :global(.dark) .rep-btn-print:hover {
          background: #334155 !important;
          border-color: #60a5fa !important;
          color: #ffffff !important;
        }

        :global([data-theme="dark"]) .rep-btn-preview,
        :global([data-bs-theme="dark"]) .rep-btn-preview,
        :global(.dark) .rep-btn-preview {
          background: rgba(37, 99, 235, 0.15) !important;
          border-color: rgba(59, 130, 246, 0.4) !important;
          color: #93c5fd !important;
        }

        :global([data-theme="dark"]) .rep-btn-preview:hover,
        :global([data-bs-theme="dark"]) .rep-btn-preview:hover,
        :global(.dark) .rep-btn-preview:hover {
          background: rgba(37, 99, 235, 0.3) !important;
          border-color: #60a5fa !important;
          color: #ffffff !important;
        }

        :global([data-theme="dark"]) .rep-btn-download,
        :global([data-bs-theme="dark"]) .rep-btn-download,
        :global(.dark) .rep-btn-download {
          background: rgba(16, 185, 129, 0.15) !important;
          border-color: rgba(16, 185, 129, 0.4) !important;
          color: #6ee7b7 !important;
        }

        :global([data-theme="dark"]) .rep-btn-download:hover:not(:disabled),
        :global([data-bs-theme="dark"]) .rep-btn-download:hover:not(:disabled),
        :global(.dark) .rep-btn-download:hover:not(:disabled) {
          background: rgba(16, 185, 129, 0.3) !important;
          border-color: #34d399 !important;
          color: #ffffff !important;
        }

        /* Preview Modal */
        .preview-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }

        .preview-modal-card-continuum {
          background: #0f172a;
          border-radius: 14px;
          max-width: 980px;
          width: 100%;
          height: 94vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .preview-modal-header-continuum {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: #1e293b;
          border-bottom: 1px solid #334155;
          flex-wrap: wrap;
          gap: 12px;
        }

        .modal-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .modal-title-text {
          font-size: 0.95rem;
          font-weight: 700;
          color: #f8fafc;
          margin: 0;
        }

        .modal-subtitle-text {
          font-size: 0.72rem;
          color: #94a3b8;
          display: block;
        }

        .modal-actions-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .zoom-pill {
          display: flex;
          align-items: center;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 2px 4px;
          gap: 6px;
        }

        .zoom-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: #cbd5e1;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.15s ease;
        }

        .zoom-btn:hover {
          background: #334155;
          color: #ffffff;
        }

        .zoom-text {
          font-size: 0.75rem;
          font-weight: 600;
          color: #cbd5e1;
          min-width: 40px;
          text-align: center;
          font-family: monospace;
        }

        .modal-btn-download {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #10b981;
          border: 1px solid #059669;
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .modal-btn-download:hover:not(:disabled) {
          background: #059669;
          border-color: #047857;
        }

        .modal-btn-download:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .modal-btn-print {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #0284c7;
          border: 1px solid #0284c7;
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .modal-btn-print:hover {
          background: #0369a1;
          border-color: #0369a1;
        }

        .modal-btn-close {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid #334155;
          color: #94a3b8;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.15s ease;
        }

        .modal-btn-close:hover {
          background: #ef4444;
          border-color: #ef4444;
          color: #ffffff;
        }

        .preview-modal-scroll-continuum {
          flex: 1;
          overflow-y: auto;
          overflow-x: auto;
          padding: 24px;
          background: #0b1120;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }

        .preview-scale-wrapper {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Print Container Rules */
        .print-only-container {
          position: fixed;
          left: 0;
          top: 0;
          width: 210mm;
          z-index: -9999;
          pointer-events: none;
          opacity: 1;
          visibility: visible;
        }

        @media print {
          .repayment-header,
          .repayment-content,
          .preview-modal-backdrop,
          :global(.topbar-wrapper),
          :global(.site-header),
          :global(header),
          :global(nav),
          :global(footer),
          :global(.site-footer),
          :global(.incraax-footer),
          :global(.calculator-header-card),
          :global(.validation-alert-box),
          :global(.customer-info-section),
          :global(.loan-details-section),
          :global(.calculation-benchmarks-section),
          :global(.eligibility-summary-card),
          :global(.floating-toast) {
            display: none !important;
          }

          :global(html),
          :global(body) {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          :global(.eligibility-calculator-view-root),
          :global(.calculator-layout-wrapper),
          :global(.calculator-container),
          :global(.eligibility-intelligence-section),
          :global(.intelligence-grid),
          :global(.intelligence-col),
          .repayment-section-card {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          .print-only-container {
            display: block !important;
            position: static !important;
            width: 210mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            z-index: auto !important;
            pointer-events: auto !important;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </section>
  );
};
