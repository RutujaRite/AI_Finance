'use client';

import React from 'react';
import { Building2, BarChart3, FileCheck2, Zap, ArrowUpRight } from 'lucide-react';
import { STATS_DATA } from '@/data/mockData';

interface MetricCardsProps {
  onSelectMetric?: (id: string) => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ onSelectMetric }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2':
        return <Building2 size={24} className="metric-icon bank-icon" />;
      case 'BarChart3':
        return <BarChart3 size={24} className="metric-icon chart-icon" />;
      case 'FileCheck2':
        return <FileCheck2 size={24} className="metric-icon policy-icon" />;
      case 'Zap':
        return <Zap size={24} className="metric-icon math-icon" />;
      default:
        return <Zap size={24} className="metric-icon" />;
    }
  };

  return (
    <section className="metrics-section">
      <div className="metrics-grid">
        {STATS_DATA.map((item) => (
          <div 
            key={item.id} 
            className="metric-card"
            onClick={() => onSelectMetric?.(item.id)}
            role="button"
            tabIndex={0}
          >
            <div className="metric-card-top">
              <div className="metric-icon-wrapper">
                {getIcon(item.icon)}
              </div>
              {item.badge && (
                <span className="metric-badge">
                  {item.badge}
                </span>
              )}
            </div>

            <div className="metric-content">
              <div className="metric-number-row">
                <h3 className="metric-number">{item.number}</h3>
                <ArrowUpRight size={16} className="metric-hover-arrow" />
              </div>
              <p className="metric-label">{item.label}</p>
              <p className="metric-sublabel">{item.sublabel}</p>
            </div>

            <div className="metric-bottom-trend">
              <span className="trend-pip" />
              <span>{item.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .metrics-section {
          max-width: 1360px;
          margin: 0 auto;
          padding: 1rem 1.5rem 1.5rem;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }

        .metric-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem 1.35rem;
          box-shadow: var(--shadow-sm);
          position: relative;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .metric-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: transparent;
          transition: background 0.2s ease;
        }

        .metric-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary-200);
        }

        .metric-card:hover::before {
          background: linear-gradient(90deg, #2563eb, #06b6d4);
        }

        .metric-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.9rem;
        }

        .metric-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-color);
          transition: all 0.2s ease;
        }

        .metric-card:hover .metric-icon-wrapper {
          background: var(--primary-50);
          border-color: var(--primary-200);
          transform: scale(1.05);
        }

        .bank-icon { color: #2563eb; }
        .chart-icon { color: #0284c7; }
        .policy-icon { color: #059669; }
        .math-icon { color: #d97706; }

        .metric-badge {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 0.2rem 0.55rem;
          border-radius: var(--radius-full);
          background: var(--bg-subtle);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }

        .metric-content {
          margin-bottom: 0.85rem;
        }

        .metric-number-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
        }

        .metric-number {
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text-primary);
          line-height: 1.1;
        }

        .metric-hover-arrow {
          color: var(--text-muted);
          opacity: 0;
          transform: translate(-3px, 3px);
          transition: all 0.2s ease;
        }

        .metric-card:hover .metric-hover-arrow {
          opacity: 1;
          transform: translate(0, 0);
          color: var(--primary-500);
        }

        .metric-label {
          font-size: 0.775rem;
          font-weight: 600;
          color: var(--text-muted);
          margin-top: 0.35rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .metric-sublabel {
          font-size: 0.825rem;
          color: var(--text-secondary);
          margin-top: 0.2rem;
          font-weight: 500;
        }

        .metric-bottom-trend {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding-top: 0.65rem;
          border-top: 1px solid var(--border-color);
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .trend-pip {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent-emerald);
        }

        @media (max-width: 1080px) {
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 560px) {
          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
};
