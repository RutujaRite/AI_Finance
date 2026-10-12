/**
 * Eligibility Calculator View
 * Merged institutional underwriting engine featuring:
 * - Customer Profile (Name, Contact, PAN, Employer, CIBIL)
 * - Existing Loan Obligations Portfolio with 3 BT cases (BT Takeover, Ongoing Debt, Self Closure)
 * - FOIR Present Value (PV) and Salary Multiplier calculations matching Excel reference
 * - Repayment Schedule with Yearly & Monthly amortization views
 * - Continuum Multi-Page Printable / Downloadable Statement with Donut Chart and geometric vector styling
 */

"use client";

import React, { useState, useEffect } from "react";
import Topbar from "./Topbar";
import { EligibilityCalculator } from "./eligibility/EligibilityCalculator";

interface EligibilityCalculatorViewProps {
  user?: any;
  embedded?: boolean;
}

export default function EligibilityCalculatorView({
  user: propUser,
  embedded = false,
}: EligibilityCalculatorViewProps) {
  const [user, setUser] = useState<any>(propUser || null);

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
    } else {
      checkAuth();
    }
  }, [propUser]);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/verify");
      if (res.ok) {
        const data = await res.json();
        if (data.success) setUser(data.user);
      }
    } catch (e) {
      // offline or guest session
    }
  }

  return (
    <div className={`eligibility-calculator-view-root ${embedded ? "embedded-mode" : "standalone-mode"}`}>
      {!embedded && (
        <Topbar user={user} activeSection="eligibility" pathname="/eligibility" />
      )}
      <EligibilityCalculator user={user} embedded={embedded} />

      <style jsx>{`
        .eligibility-calculator-view-root {
          min-height: 100vh;
          background: #f1f5f9;
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          overscroll-behavior-x: none;
          box-sizing: border-box;
        }
        .embedded-mode {
          min-height: auto;
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          overscroll-behavior-x: none;
        }
        .standalone-mode {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          overscroll-behavior-x: none;
        }

        @media print {
          :global(.topbar-wrapper),
          :global(header),
          :global(nav) {
            display: none !important;
          }
          .eligibility-calculator-view-root {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
