'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, ArrowUp, Zap, Sparkles } from 'lucide-react';

interface AutoScrollTourWidgetProps {
  isAutoScrolling: boolean;
  onToggleAutoScroll: () => void;
  scrollSpeed: '1x' | '2x';
  onToggleSpeed: () => void;
  scrollProgress: number;
}

export const AutoScrollTourWidget: React.FC<AutoScrollTourWidgetProps> = ({
  isAutoScrolling,
  onToggleAutoScroll,
  scrollSpeed,
  onToggleSpeed,
  scrollProgress,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show widget after scrolling down slightly or when auto-scrolling is active
    const handleScroll = () => {
      if (window.scrollY > 120 || isAutoScrolling) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isAutoScrolling]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className="auto-scroll-tour-widget animate-fade-in"
      style={{
        opacity: visible || isAutoScrolling ? 1 : 0,
        pointerEvents: visible || isAutoScrolling ? 'auto' : 'none',
        transform: visible || isAutoScrolling ? 'translateY(0)' : 'translateY(16px)',
      }}
      role="region"
      aria-label="Auto-scroll tour controller"
    >
      {/* Primary Auto-Scroll Play/Pause button */}
      <button
        type="button"
        onClick={onToggleAutoScroll}
        className={`tour-pill-btn ${isAutoScrolling ? 'tour-pill-active' : 'tour-pill-play'}`}
        title={isAutoScrolling ? 'Pause automatic scroll down' : 'Start automatic scroll down tour'}
      >
        {isAutoScrolling ? (
          <>
            <Pause size={13} fill="currentColor" />
            <span>Pause Tour</span>
          </>
        ) : (
          <>
            <Play size={13} fill="currentColor" />
            <span>Auto-Scroll Tour</span>
          </>
        )}
      </button>

      {/* Speed multiplier toggle */}
      {isAutoScrolling && (
        <button
          type="button"
          onClick={onToggleSpeed}
          className="tour-speed-toggle"
          title="Toggle auto-scroll speed"
        >
          {scrollSpeed}
        </button>
      )}

      {/* Scroll percentage chip */}
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
          padding: '0 4px',
          minWidth: '32px',
          textAlign: 'center',
        }}
      >
        {Math.round(scrollProgress)}%
      </span>

      {/* Back to top button */}
      <button
        type="button"
        onClick={scrollToTop}
        className="tour-back-to-top"
        title="Scroll smoothly back to top"
        aria-label="Back to top"
      >
        <ArrowUp size={14} />
      </button>
    </div>
  );
};
