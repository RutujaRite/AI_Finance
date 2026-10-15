"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Progress bar percentage (0 to 100)
  const [progress, setProgress] = useState(0);
  // Whether loading is active
  const [isNavigating, setIsNavigating] = useState(false);
  // Whether to show the centered modal (only if switching takes > 120ms)
  const [showModal, setShowModal] = useState(false);
  // Target destination hint if known
  const [destinationHint, setDestinationHint] = useState<string>("");

  const modalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxSafetyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStartTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clears all timers safely
  const clearAllTimers = useCallback(() => {
    if (pendingStartTimerRef.current) {
      clearTimeout(pendingStartTimerRef.current);
      pendingStartTimerRef.current = null;
    }
    if (modalTimerRef.current) {
      clearTimeout(modalTimerRef.current);
      modalTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (maxSafetyTimerRef.current) {
      clearTimeout(maxSafetyTimerRef.current);
      maxSafetyTimerRef.current = null;
    }
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
  }, []);

  // Completes and smoothly dismisses the loader
  const stopLoading = useCallback(() => {
    if (pendingStartTimerRef.current) {
      clearTimeout(pendingStartTimerRef.current);
      pendingStartTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (modalTimerRef.current) {
      clearTimeout(modalTimerRef.current);
      modalTimerRef.current = null;
    }

    // Complete top bar to 100% only if it was navigating
    setProgress((prev) => (prev > 0 ? 100 : 0));

    // Smooth fade-out transition
    finishTimeoutRef.current = setTimeout(() => {
      setIsNavigating(false);
      setShowModal(false);
      setProgress(0);
      setDestinationHint("");
      clearAllTimers();
    }, 240);
  }, [clearAllTimers]);

  // Starts the loading animation safely outside of React's useInsertionEffect
  const startLoading = useCallback((hint?: string) => {
    clearAllTimers();

    // In Next.js 15 / React 19, pushState / replaceState runs inside useInsertionEffect.
    // Scheduling state updates synchronously inside useInsertionEffect throws:
    // "useInsertionEffect must not schedule updates."
    // We defer state updates to the next macrotask via setTimeout so React is never in an effect phase.
    pendingStartTimerRef.current = setTimeout(() => {
      pendingStartTimerRef.current = null;
      setIsNavigating(true);
      setProgress(18);
      if (hint) {
        setDestinationHint(hint);
      }

      // Step 1: Smoothly advance top progress bar while waiting
      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev < 40) return prev + 12;
          if (prev < 75) return prev + 6;
          if (prev < 90) return prev + 1.5;
          return prev;
        });
      }, 180);

      // Step 2: If page switching takes more than 120ms, reveal the centered loading badge/icon
      modalTimerRef.current = setTimeout(() => {
        setShowModal(true);
      }, 120);

      // Step 3: Absolute safety timeout — auto dismiss after 7 seconds
      maxSafetyTimerRef.current = setTimeout(() => {
        stopLoading();
      }, 7000);
    }, 0);
  }, [clearAllTimers, stopLoading]);

  // Route change completion listener (when pathname or searchParams change)
  useEffect(() => {
    stopLoading();
  }, [pathname, searchParams, stopLoading]);

  // Setup click, history, popstate, and fetch listeners
  useEffect(() => {
    // 1. Capture clicks on links & navigation elements
    const handleDocumentClick = (e: MouseEvent) => {
      // Don't intercept clicks with modifier keys
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return; // Only primary mouse button

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (anchor) {
        if (anchor.target === "_blank") return;
        if (anchor.hasAttribute("download")) return;

        const href = anchor.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
          return;
        }

        try {
          const targetUrl = new URL(href, window.location.origin);
          // Check if internal navigation to a different path or query
          if (targetUrl.origin === window.location.origin) {
            const currentPathWithSearch = window.location.pathname + window.location.search;
            const targetPathWithSearch = targetUrl.pathname + targetUrl.search;

            if (currentPathWithSearch !== targetPathWithSearch) {
              const label = anchor.getAttribute("title") || anchor.innerText?.trim() || targetUrl.pathname;
              startLoading(label.slice(0, 30));
            }
          }
        } catch {}
        return;
      }

      // Check buttons or elements with data-href or role="link"
      const navItem = target.closest("[data-href], [data-navigate], .nav-item");
      if (navItem) {
        const customHref = navItem.getAttribute("data-href") || navItem.getAttribute("data-navigate");
        if (customHref && customHref.startsWith("/")) {
          if (customHref !== (window.location.pathname + window.location.search)) {
            startLoading(customHref);
          }
        }
      }
    };

    // 2. Monkey-patch window.history.pushState and replaceState to detect programmatic navigation
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (data: any, unused: string, url?: string | URL | null) {
      const result = originalPushState.apply(this, arguments as any);
      if (url) {
        try {
          const targetUrl = new URL(url.toString(), window.location.origin);
          const currentPathWithSearch = window.location.pathname + window.location.search;
          const targetPathWithSearch = targetUrl.pathname + targetUrl.search;

          if (targetUrl.origin === window.location.origin && currentPathWithSearch !== targetPathWithSearch) {
            startLoading(targetUrl.pathname);
          }
        } catch {}
      }
      return result;
    };

    window.history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
      const result = originalReplaceState.apply(this, arguments as any);
      if (url) {
        try {
          const targetUrl = new URL(url.toString(), window.location.origin);
          const currentPathWithSearch = window.location.pathname + window.location.search;
          const targetPathWithSearch = targetUrl.pathname + targetUrl.search;

          if (targetUrl.origin === window.location.origin && currentPathWithSearch !== targetPathWithSearch) {
            startLoading(targetUrl.pathname);
          }
        } catch {}
      }
      return result;
    };

    // 3. Browser Back / Forward navigation
    const handlePopState = () => {
      startLoading("Navigating...");
    };

    // 4. Custom events for direct programmatic control
    const handleCustomStart = (e: Event) => {
      const customEvent = e as CustomEvent;
      startLoading(customEvent.detail?.destination || "Loading...");
    };
    const handleCustomStop = () => {
      stopLoading();
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("creditwise:route-start", handleCustomStart);
    window.addEventListener("creditwise:route-end", handleCustomStop);

    return () => {
      document.removeEventListener("click", handleDocumentClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("creditwise:route-start", handleCustomStart);
      window.removeEventListener("creditwise:route-end", handleCustomStop);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      clearAllTimers();
    };
  }, [startLoading, stopLoading, clearAllTimers]);

  if (!isNavigating && progress === 0) {
    return null;
  }

  return (
    <>
      {/* 1. Luminous Top Gradient Progress Bar */}
      <div
        id="creditwise-top-progress-bar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "3.5px",
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
            boxShadow: "0 0 12px rgba(37, 99, 235, 0.8), 0 0 6px rgba(20, 184, 166, 0.6)",
            transition: progress === 100 ? "width 180ms ease-out, opacity 220ms ease-out" : "width 220ms cubic-bezier(0.4, 0, 0.2, 1)",
            opacity: progress === 100 ? 0 : 1,
            borderRadius: "0 3px 3px 0",
          }}
        />
      </div>

      {/* 2. Glassmorphic Centered Loading Icon & Indicator (Shown when page switching takes time) */}
      {showModal && (
        <div
          id="creditwise-route-loading-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 999998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(11, 18, 32, 0.42)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            animation: "creditwiseFadeIn 200ms ease-out forwards",
            pointerEvents: "auto",
          }}
        >
          <div
            id="creditwise-route-loading-card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "28px 36px",
              borderRadius: "22px",
              background: "rgba(255, 255, 255, 0.92)",
              color: "#0F172A",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              boxShadow: "0 20px 45px rgba(15, 23, 42, 0.22), 0 0 35px rgba(37, 99, 235, 0.15)",
              minWidth: "240px",
              maxWidth: "320px",
              textAlign: "center",
              transform: "scale(1)",
              animation: "creditwiseScaleUp 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
            className="creditwise-loader-card"
          >
            {/* Animated Dual-Ring Loading Icon */}
            <div
              style={{
                position: "relative",
                width: "68px",
                height: "68px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Outer rotating gradient ring */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "3.5px solid transparent",
                  borderTopColor: "#2563EB",
                  borderRightColor: "#14B8A6",
                  animation: "creditwiseSpin 1.1s linear infinite",
                }}
              />
              {/* Inner reverse pulsing ring */}
              <div
                style={{
                  position: "absolute",
                  inset: "7px",
                  borderRadius: "50%",
                  border: "2px dashed rgba(37, 99, 235, 0.45)",
                  animation: "creditwiseSpinReverse 1.8s linear infinite",
                }}
              />
              {/* Center pulsing CreditWise brand badge */}
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                  animation: "creditwisePulse 1.6s ease-in-out infinite",
                }}
              >
                <i
                  className="bi bi-shield-check"
                  style={{
                    color: "#FFFFFF",
                    fontSize: "19px",
                  }}
                />
              </div>
            </div>

            {/* Title & Subtitle */}
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "#0F172A",
                marginBottom: "4px",
                fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
              }}
            >
              Loading Page
            </div>

            <div
              style={{
                fontSize: "12.5px",
                color: "#64748B",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
              }}
            >
              <span>{destinationHint ? `Opening ${destinationHint}` : "Switching view, please wait"}</span>
              <span className="creditwise-loading-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Component Keyframe Animations */}
      <style jsx global>{`
        @keyframes creditwiseSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes creditwiseSpinReverse {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
        @keyframes creditwisePulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
          }
          50% {
            transform: scale(1.06);
            box-shadow: 0 6px 18px rgba(37, 99, 235, 0.55);
          }
        }
        @keyframes creditwiseFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes creditwiseScaleUp {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .creditwise-loading-dots span {
          animation: creditwiseBlink 1.4s infinite both;
          font-weight: 700;
        }
        .creditwise-loading-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .creditwise-loading-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes creditwiseBlink {
          0%, 80%, 100% {
            opacity: 0;
          }
          40% {
            opacity: 1;
          }
        }

        /* Dark Mode Theme Adjustment */
        [data-bs-theme="dark"] .creditwise-loader-card,
        [data-theme="dark"] .creditwise-loader-card {
          background: rgba(19, 35, 58, 0.92) !important;
          color: #F8FAFC !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.5), 0 0 35px rgba(37, 99, 235, 0.25) !important;
        }
        [data-bs-theme="dark"] .creditwise-loader-card div:nth-child(2),
        [data-theme="dark"] .creditwise-loader-card div:nth-child(2) {
          color: #F8FAFC !important;
        }
        [data-bs-theme="dark"] .creditwise-loader-card div:nth-child(3),
        [data-theme="dark"] .creditwise-loader-card div:nth-child(3) {
          color: #94A3B8 !important;
        }
      `}</style>
    </>
  );
}
