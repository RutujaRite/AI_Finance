"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * High-performance, non-blocking top progress bar for cross-page route transitions.
 * - Only displays when a navigation genuinely takes > 200ms (grace period)
 * - Never triggers on browser back/forward (popstate) to ensure instant return
 * - Never blocks clicks or user interactions (pointerEvents: "none")
 * - Zero full-screen blur overlays or artificial delay
 */
export default function RouteLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Progress bar percentage (0 to 100)
  const [progress, setProgress] = useState(0);
  // Whether top loading bar is visible
  const [isVisible, setIsVisible] = useState(false);

  const gracePeriodTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clears all pending timers
  const clearAllTimers = useCallback(() => {
    if (gracePeriodTimerRef.current) {
      clearTimeout(gracePeriodTimerRef.current);
      gracePeriodTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
  }, []);

  // Completes and smoothly dismisses the loading bar
  const stopLoading = useCallback(() => {
    if (gracePeriodTimerRef.current) {
      clearTimeout(gracePeriodTimerRef.current);
      gracePeriodTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }

    setProgress((prev) => {
      // If bar was already showing, complete to 100% and fade out quickly
      if (prev > 0) {
        finishTimeoutRef.current = setTimeout(() => {
          setIsVisible(false);
          setProgress(0);
          clearAllTimers();
        }, 120);
        return 100;
      }
      setIsVisible(false);
      return 0;
    });
  }, [clearAllTimers]);

  // Starts the loading bar only if the navigation takes > 200ms
  const startLoading = useCallback(() => {
    clearAllTimers();

    // Grace period: if page transition finishes within 200ms, bar never shows
    gracePeriodTimerRef.current = setTimeout(() => {
      gracePeriodTimerRef.current = null;
      setIsVisible(true);
      setProgress(24);

      // Increment progress bar smoothly while waiting
      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev < 45) return prev + 10;
          if (prev < 75) return prev + 4;
          if (prev < 88) return prev + 1.2;
          return prev;
        });
      }, 140);

      // Safety timeout: auto dismiss after 5 seconds to prevent stuck bars
      safetyTimeoutRef.current = setTimeout(() => {
        stopLoading();
      }, 5000);
    }, 200);
  }, [clearAllTimers, stopLoading]);

  // Route change completion listener (when pathname or searchParams change)
  useEffect(() => {
    stopLoading();
  }, [pathname, searchParams, stopLoading]);

  // Setup click and custom event listeners (NEVER popstate)
  useEffect(() => {
    // Capture clicks on navigation links targeting different pathnames
    const handleDocumentClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return; // Only left clicks

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (anchor) {
        if (anchor.target === "_blank") return;
        if (anchor.hasAttribute("download")) return;

        const href = anchor.getAttribute("href");
        if (
          !href ||
          href.startsWith("#") ||
          href.startsWith("javascript:") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:")
        ) {
          return;
        }

        try {
          const targetUrl = new URL(href, window.location.origin);
          // Only trigger for internal links leading to a different pathname
          if (
            targetUrl.origin === window.location.origin &&
            targetUrl.pathname !== window.location.pathname
          ) {
            startLoading();
          }
        } catch {}
      }
    };

    // Custom events for programmatic triggers if desired
    const handleCustomStart = () => startLoading();
    const handleCustomStop = () => stopLoading();

    document.addEventListener("click", handleDocumentClick, { capture: true });
    window.addEventListener("creditwise:route-start", handleCustomStart);
    window.addEventListener("creditwise:route-end", handleCustomStop);

    return () => {
      document.removeEventListener("click", handleDocumentClick, { capture: true });
      window.removeEventListener("creditwise:route-start", handleCustomStart);
      window.removeEventListener("creditwise:route-end", handleCustomStop);
      clearAllTimers();
    };
  }, [startLoading, stopLoading, clearAllTimers]);

  // Do not render on public landing page or when inactive
  if (pathname === "/" || (!isVisible && progress === 0)) {
    return null;
  }

  return (
    <div
      id="creditwise-top-progress-bar"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2.5px",
        zIndex: 999999,
        pointerEvents: "none",
        background: "transparent",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #2563EB 0%, #14B8A6 50%, #3B82F6 100%)",
          boxShadow: "0 0 10px rgba(37, 99, 235, 0.7), 0 0 5px rgba(20, 184, 166, 0.5)",
          transition:
            progress === 100
              ? "width 100ms ease-out, opacity 120ms ease-out"
              : "width 160ms cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: progress === 100 ? 0 : 1,
          borderRadius: "0 2px 2px 0",
        }}
      />
    </div>
  );
}
