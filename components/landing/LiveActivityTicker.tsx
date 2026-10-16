'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, Zap, TrendingUp, CheckCircle2, Building2 } from 'lucide-react';

interface LiveEvent {
  id: string;
  icon: string;
  bank: string;
  detail: string;
  timeAgo: string;
  color: string;
}

const LIVE_EVENTS: LiveEvent[] = [
  {
    id: 'evt-1',
    icon: 'Zap',
    bank: 'SBI Benchmark',
    detail: '₹18,50,000 personal loan matched at 8.25% APR',
    timeAgo: 'Just now',
    color: '#2b5ea9',
  },
  {
    id: 'evt-2',
    icon: 'Building2',
    bank: 'HDFC Bank',
    detail: 'Super CAT Employer policy verified (TCS • Pune)',
    timeAgo: '1m ago',
    color: '#004c8f',
  },
  {
    id: 'evt-3',
    icon: 'TrendingUp',
    bank: 'ICICI Bank',
    detail: 'Debt-to-Income (DTI) 28% passed instant pre-screen',
    timeAgo: '2m ago',
    color: '#f58220',
  },
  {
    id: 'evt-4',
    icon: 'ShieldCheck',
    bank: 'Tata Capital',
    detail: '65% FOIR limit unlocked with 765 CIBIL score',
    timeAgo: '3m ago',
    color: '#00549f',
  },
  {
    id: 'evt-5',
    icon: 'Sparkles',
    bank: 'Bajaj Finserv',
    detail: '₹35,00,000 eligibility computed via AI Multiplier',
    timeAgo: '4m ago',
    color: '#0072bc',
  },
];

export const LiveActivityTicker: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % LIVE_EVENTS.length);
        setAnimating(false);
      }, 350);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  const currentEvent = LIVE_EVENTS[currentIndex];

  return (
    <aside
      className="live-activity-floating-toast"
      aria-label="Live loan prediction notifications"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 1030,
        maxWidth: '360px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '10px 14px',
        boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.16), 0 0 16px rgba(13, 148, 136, 0.1)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      {/* Live radar pip */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: currentEvent.color,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 800,
          }}
        >
          <Zap size={15} fill="currentColor" />
        </div>
        <span
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 0 2px var(--bg-surface)',
          }}
        />
      </div>

      {/* Rotating content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(6px)' : 'translateY(0)',
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <span
            style={{
              fontSize: '0.675rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--teal-600)',
            }}
          >
            ● LIVE MATCH • {currentEvent.bank}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {currentEvent.timeAgo}
          </span>
        </div>
        <p
          style={{
            margin: '2px 0 0 0',
            fontSize: '0.76rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={currentEvent.detail}
        >
          {currentEvent.detail}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss live activity notifications"
        style={{
          color: 'var(--text-muted)',
          padding: '2px',
          borderRadius: '4px',
          lineHeight: 1,
          fontSize: '0.8rem',
          opacity: 0.6,
        }}
        title="Dismiss"
      >
        ×
      </button>
    </aside>
  );
};
