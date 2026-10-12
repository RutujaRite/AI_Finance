'use client';

import React, { useState, useMemo } from 'react';
import { 
  PieChart as PieChartIcon, 
  Wallet, 
  Coins, 
  HelpCircle, 
  ShieldCheck, 
  Percent, 
  TrendingUp,
  Info
} from 'lucide-react';
import { EligibilityResult } from '@/lib/eligibility/eligibilityTypes';
import { formatIndianRupees, formatLakhsCrores } from '@/lib/eligibility/calculateEligibility';

interface EligibilityPieChartProps {
  salary: number;
  foirPercent: number;
  roiPercent: number;
  tenureMonths: number;
  tableObligations?: number;
  result: EligibilityResult;
}

type ChartMode = 'income' | 'repayment';

interface SliceItem {
  id: string;
  label: string;
  value: number;
  percent: number;
  color: string;
  secondaryColor: string;
  description: string;
}

export const EligibilityPieChart: React.FC<EligibilityPieChartProps> = ({
  salary,
  foirPercent,
  roiPercent,
  tenureMonths,
  tableObligations = 0,
  result,
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>('income');
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(null);

  // Mode 1: Monthly Income Allocation (FOIR Capacity vs Living Expenses)
  const incomeSlices = useMemo<SliceItem[]>(() => {
    const total = Math.max(0, salary);
    if (total === 0) return [];

    const foirEmi = Math.min(total, result.foirAllowedEmi);
    const livingBuffer = Math.max(0, total - foirEmi);

    const foirPct = Number(((foirEmi / total) * 100).toFixed(1));
    const livingPct = Number(((livingBuffer / total) * 100).toFixed(1));

    return [
      {
        id: 'foir-capacity',
        label: 'Permissible Loan EMI',
        value: foirEmi,
        percent: foirPct,
        color: '#10b981', // Emerald
        secondaryColor: '#34d399',
        description: `${foirPercent}% Institutional FOIR borrowing capacity`,
      },
      {
        id: 'living-expenses',
        label: 'Disposable / Living Buffer',
        value: livingBuffer,
        percent: livingPct,
        color: '#3b82f6', // Modern Blue
        secondaryColor: '#60a5fa',
        description: 'Remaining uncommitted monthly salary for living & savings',
      },
    ];
  }, [salary, result.foirAllowedEmi, foirPercent]);

  // Mode 2: Loan Repayment Breakdown (Principal Borrowed vs Total Interest)
  const repaymentSlices = useMemo<SliceItem[]>(() => {
    const principal = Math.max(0, result.foirEligibility);
    const monthlyEmi = Math.max(0, result.foirAllowedEmi);
    const totalRepayment = monthlyEmi * (tenureMonths || 1);
    const totalInterest = Math.max(0, totalRepayment - principal);

    const total = principal + totalInterest;
    if (total === 0) return [];

    const principalPct = Number(((principal / total) * 100).toFixed(1));
    const interestPct = Number(((totalInterest / total) * 100).toFixed(1));

    return [
      {
        id: 'principal',
        label: 'Principal Loan Amount',
        value: principal,
        percent: principalPct,
        color: '#2563eb', // Royal Blue
        secondaryColor: '#3b82f6',
        description: 'Net institutional borrowing sanction amount',
      },
      {
        id: 'interest',
        label: 'Total Interest Payable',
        value: totalInterest,
        percent: interestPct,
        color: '#8b5cf6', // Violet
        secondaryColor: '#a78bfa',
        description: `Cumulative interest cost @ ${roiPercent}% p.a. over ${tenureMonths}m`,
      },
    ];
  }, [result.foirEligibility, result.foirAllowedEmi, tenureMonths, roiPercent]);

  const activeSlices = chartMode === 'income' ? incomeSlices : repaymentSlices;
  const totalValue = activeSlices.reduce((acc, s) => acc + s.value, 0);

  // SVG Geometry for Donut
  const cx = 110;
  const cy = 110;
  const radius = 88;
  const innerRadius = 56;

  // Compute SVG arc paths
  const sliceArcs = useMemo(() => {
    if (totalValue <= 0 || activeSlices.length === 0) return [];

    let accumulatedPercent = 0;

    return activeSlices.map((slice) => {
      const startPercent = accumulatedPercent;
      const sliceFraction = slice.value / totalValue;
      const endPercent = accumulatedPercent + sliceFraction;
      accumulatedPercent = endPercent;

      // Handle 100% single slice case
      if (sliceFraction >= 0.999) {
        const path = `
          M ${cx} ${cy - radius}
          A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius}
          Z
          M ${cx} ${cy - innerRadius}
          A ${innerRadius} ${innerRadius} 0 1 0 ${cx - 0.01} ${cy - innerRadius}
          Z
        `;
        return { slice, path, isFull: true };
      }

      // Convert angles (start at 12 o'clock = -PI/2)
      const startAngle = startPercent * 2 * Math.PI - Math.PI / 2;
      const endAngle = endPercent * 2 * Math.PI - Math.PI / 2;

      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);

      const x3 = cx + innerRadius * Math.cos(endAngle);
      const y3 = cy + innerRadius * Math.sin(endAngle);
      const x4 = cx + innerRadius * Math.cos(startAngle);
      const y4 = cy + innerRadius * Math.sin(startAngle);

      const largeArcFlag = sliceFraction > 0.5 ? 1 : 0;

      const path = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
        'Z'
      ].join(' ');

      return { slice, path, isFull: false };
    });
  }, [activeSlices, totalValue]);

  // Center display values
  const centerTitle = useMemo(() => {
    if (hoveredSliceId) {
      const found = activeSlices.find((s) => s.id === hoveredSliceId);
      if (found) return found.percent + '%';
    }
    return formatIndianRupees(totalValue);
  }, [hoveredSliceId, activeSlices, totalValue]);

  const centerSubtitle = useMemo(() => {
    if (hoveredSliceId) {
      const found = activeSlices.find((s) => s.id === hoveredSliceId);
      if (found) return found.label;
    }
    return chartMode === 'income' ? 'Monthly Salary' : 'Total Repayment';
  }, [hoveredSliceId, activeSlices, chartMode]);

  return (
    <div className="card pie-chart-box">
      {/* Card Header with Mode Switcher */}
      <div className="chart-header">
        <div className="chart-hdr-left">
          <div className="icon-wrapper">
            <PieChartIcon size={18} />
          </div>
          <div>
            <h3 className="section-title">Visual Allocation Breakdown</h3>
            <p className="section-subtitle">
              Graphical distribution of capacity & amortization components
            </p>
          </div>
        </div>

        {/* Mode Toggle Pills */}
        <div className="mode-toggle-group">
          <button
            type="button"
            className={`mode-btn ${chartMode === 'income' ? 'active' : ''}`}
            onClick={() => {
              setChartMode('income');
              setHoveredSliceId(null);
            }}
          >
            <Wallet size={13} />
            <span>Income Allocation</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${chartMode === 'repayment' ? 'active' : ''}`}
            onClick={() => {
              setChartMode('repayment');
              setHoveredSliceId(null);
            }}
          >
            <Coins size={13} />
            <span>Loan Amortization</span>
          </button>
        </div>
      </div>

      <div className="chart-body">
        {totalValue <= 0 ? (
          <div className="empty-state">
            <Info size={28} className="text-slate-400" />
            <p>Please enter a monthly salary to view graphical allocation.</p>
          </div>
        ) : (
          <div className="chart-layout-grid">
            {/* Donut Chart Visual */}
            <div className="donut-wrapper">
              <svg 
                viewBox="0 0 220 220" 
                className="donut-svg"
                role="img"
                aria-label="Allocation Pie Chart"
              >
                <defs>
                  {activeSlices.map((s) => (
                    <linearGradient key={`grad-${s.id}`} id={`grad-${s.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={s.color} />
                      <stop offset="100%" stopColor={s.secondaryColor} />
                    </linearGradient>
                  ))}
                  <filter id="slice-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                  </filter>
                </defs>

                {sliceArcs.map(({ slice, path }) => {
                  const isHovered = hoveredSliceId === slice.id;
                  return (
                    <path
                      key={slice.id}
                      d={path}
                      fill={`url(#grad-${slice.id})`}
                      filter={isHovered ? 'url(#slice-shadow)' : undefined}
                      className={`donut-slice ${isHovered ? 'slice-active' : ''}`}
                      onMouseEnter={() => setHoveredSliceId(slice.id)}
                      onMouseLeave={() => setHoveredSliceId(null)}
                      style={{
                        transformOrigin: '110px 110px',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  );
                })}

                {/* Donut Hole Inner Circle for clean contrast */}
                <circle 
                  cx={cx} 
                  cy={cy} 
                  r={innerRadius - 1} 
                  fill="#ffffff" 
                  className="donut-hole"
                />
              </svg>

              {/* Center Donut Text */}
              <div className="donut-center-content">
                <div className="center-title font-mono">{centerTitle}</div>
                <div className="center-subtitle">{centerSubtitle}</div>
              </div>
            </div>

            {/* Interactive Legend & Metric Breakdown */}
            <div className="legend-column">
              <div className="legend-items">
                {activeSlices.map((item) => {
                  const isHovered = hoveredSliceId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`legend-card ${isHovered ? 'legend-card-active' : ''}`}
                      onMouseEnter={() => setHoveredSliceId(item.id)}
                      onMouseLeave={() => setHoveredSliceId(null)}
                    >
                      <div className="legend-card-header">
                        <div className="label-with-dot">
                          <span 
                            className="color-dot" 
                            style={{ backgroundColor: item.color }} 
                          />
                          <span className="item-label">{item.label}</span>
                        </div>
                        <span 
                          className="percent-badge font-mono"
                          style={{ color: item.color, backgroundColor: `${item.color}15` }}
                        >
                          {item.percent}%
                        </span>
                      </div>

                      <div className="legend-value-row">
                        <span className="item-val font-mono">{formatIndianRupees(item.value)}</span>
                        {chartMode === 'repayment' && (
                          <span className="item-lakhs text-slate-500">
                            ({formatLakhsCrores(item.value)})
                          </span>
                        )}
                      </div>

                      <p className="item-desc">{item.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Contextual insight pill */}
              <div className="chart-insight-strip">
                <ShieldCheck size={14} className="text-emerald-600 flex-shrink-0" />
                <span className="insight-text">
                  {chartMode === 'income' ? (
                    <>
                      <strong>{foirPercent}% FOIR limit</strong> allocates{' '}
                      <strong>{formatIndianRupees(result.foirAllowedEmi)}/mo</strong> for loan repayments, preserving{' '}
                      <strong>{formatIndianRupees(Math.max(0, salary - result.foirAllowedEmi))}/mo</strong> for household living.
                    </>
                  ) : (
                    <>
                      Over <strong>{tenureMonths} months</strong> @ <strong>{roiPercent}% ROI</strong>, principal constitutes{' '}
                      <strong>{activeSlices[0]?.percent || 0}%</strong> of the repayment obligation.
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .pie-chart-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          margin-top: 16px;
        }

        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #ffffff;
          flex-wrap: wrap;
          gap: 12px;
        }

        .chart-hdr-left {
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

        .section-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .section-subtitle {
          font-size: 0.78rem;
          color: #64748b;
          margin-top: 2px;
        }

        .mode-toggle-group {
          display: inline-flex;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          gap: 2px;
        }

        .mode-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.76rem;
          font-weight: 600;
          color: #64748b;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.16s ease;
        }

        .mode-btn:hover {
          color: #0f172a;
        }

        .mode-btn.active {
          background: #ffffff;
          color: #2563eb;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          font-weight: 700;
        }

        .chart-body {
          padding: 20px;
          background: #fafcff;
        }

        .empty-state {
          padding: 36px 20px;
          text-align: center;
          color: #64748b;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          font-size: 0.86rem;
        }

        .chart-layout-grid {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 24px;
          align-items: center;
        }

        @media (max-width: 680px) {
          .chart-layout-grid {
            grid-template-columns: 1fr;
            justify-items: center;
          }
        }

        .donut-wrapper {
          position: relative;
          width: 220px;
          height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .donut-svg {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 2px 6px rgba(15, 23, 42, 0.06));
        }

        .donut-slice {
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .donut-slice:hover,
        .slice-active {
          transform: scale(1.035);
          opacity: 0.96;
        }

        .donut-center-content {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          text-align: center;
          width: 100px;
        }

        .center-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.15;
          letter-spacing: -0.01em;
        }

        .center-subtitle {
          font-size: 0.68rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-top: 3px;
        }

        .legend-column {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }

        .legend-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .legend-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .legend-card:hover,
        .legend-card-active {
          border-color: #93c5fd;
          box-shadow: 0 2px 8px -1px rgba(37, 99, 235, 0.12);
          transform: translateY(-1px);
        }

        .legend-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .label-with-dot {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .color-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .item-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: #1e293b;
        }

        .percent-badge {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 9999px;
        }

        .legend-value-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .item-val {
          font-size: 0.98rem;
          font-weight: 800;
          color: #0f172a;
        }

        .item-lakhs {
          font-size: 0.76rem;
        }

        .item-desc {
          font-size: 0.72rem;
          color: #64748b;
          margin-top: 3px;
          line-height: 1.35;
        }

        .chart-insight-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 0.74rem;
          color: #166534;
          line-height: 1.45;
        }

        .font-mono {
          font-family: monospace;
        }
      `}</style>
    </div>
  );
};
