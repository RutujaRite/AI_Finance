/**
 * EMI Calculator component — Compact, High-Compatibility FinTech layout.
 * Features:
 * 1. Compact viewport-fitting design: fits on all screens without excessive scrolling.
 * 2. Guaranteed-visible high-contrast Estimated Monthly EMI hero banner.
 * 3. Client Name & Mobile Number modal before saving calculation to database.
 * 4. Comprehensive dark mode and light mode theme variable styling.
 * 5. Integrated tab switcher for Analytics vs Month-by-Month Amortization schedule.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "./Topbar";
import {
  Calculator,
  Sliders,
  Wallet,
  PieChart,
  Printer,
  BookmarkCheck,
  Calendar,
  Sparkles,
  User,
  Phone,
  X,
  CheckCircle2,
  RotateCcw,
  ListFilter,
  FileSpreadsheet,
  FolderClock,
  Search,
  Trash2,
  ArrowRightCircle,
  AlertTriangle,
} from "lucide-react";

export default function EmiCalculator({
  user: propUser,
  embedded = false,
}: {
  user?: any;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(propUser || null);
  const [loanType, setLoanType] = useState("Personal Loan");
  const [principal, setPrincipal] = useState(500000);
  const [rate, setRate] = useState(9.5);
  const [fee, setFee] = useState(0.5);
  const [term, setTerm] = useState(60);
  const [termUnit, setTermUnit] = useState<"months" | "years">("months");
  const [emi, setEmi] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [processingFee, setProcessingFee] = useState(0);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Saved Calculations State
  const [savedCalculations, setSavedCalculations] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savedDrawerOpen, setSavedDrawerOpen] = useState(false);
  const [savedSearchQuery, setSavedSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Save Modal State
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [calculationName, setCalculationName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);

  // View tab for right column: 'summary' | 'schedule'
  const [activeTab, setActiveTab] = useState<"summary" | "schedule">("summary");

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
    } else {
      checkAuth();
    }
  }, [propUser]);

  useEffect(() => {
    compute();
  }, [principal, rate, fee, term, termUnit]);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/verify");
      if (!res.ok) {
        router.replace("/?auth=login");
      } else {
        const data = await res.json();
        if (data.success) setUser(data.user);
      }
    } catch {
      router.replace("/?auth=login");
    }
  }

  function handleReset() {
    setLoanType("Personal Loan");
    setPrincipal(500000);
    setRate(9.5);
    setFee(0.5);
    setTerm(60);
    setTermUnit("months");
    setActiveTab("summary");
  }

  function compute() {
    const p = principal;
    const annualRate = rate;
    const feePercent = fee;
    let months = term;
    if (termUnit === "years") months = term * 12;
    const r = annualRate / 12 / 100;
    let monthlyEmi = 0;
    if (r > 0) {
      monthlyEmi = (p * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    } else if (months > 0) {
      monthlyEmi = p / months;
    }
    const total = monthlyEmi * months;
    const interest = total - p;
    const feeAmount = p * (feePercent / 100);

    setEmi(monthlyEmi);
    setTotalInterest(interest);
    setTotalPayment(total);
    setProcessingFee(feeAmount);

    const rows: any[] = [];
    let balance = p;
    for (let m = 1; m <= months; m++) {
      const interestPortion = balance * r;
      const principalPortion = monthlyEmi - interestPortion;
      balance = Math.max(0, balance - principalPortion);
      rows.push({
        month: m,
        emi: monthlyEmi,
        principal: principalPortion,
        interest: interestPortion,
        balance,
      });
    }
    setSchedule(rows);
  }

  async function fetchSavedCalculations() {
    try {
      setLoadingSaved(true);
      const res = await fetch("/api/emi/saved");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.calculations)) {
          setSavedCalculations(data.calculations);
        }
      }
    } catch (e) {
      console.error("Failed to fetch saved calculations", e);
    } finally {
      setLoadingSaved(false);
    }
  }

  useEffect(() => {
    if (user) {
      fetchSavedCalculations();
    }
  }, [user]);

  function openSaveModal() {
    setSaveError("");
    const defaultName = `${loanType} • ₹${formatWholeMoney(principal)} - #${savedCalculations.length + 1}`;
    setCalculationName(defaultName);
    setSaveModalOpen(true);
  }

  async function handleConfirmSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmedName = calculationName.trim() || `${loanType} • ₹${formatWholeMoney(principal)}`;

    setSaving(true);
    setSaveError("");

    try {
      const payload = {
        loanType,
        principal,
        annualRate: rate,
        feePercent: fee,
        termMonths: termUnit === "years" ? term * 12 : term,
        monthsOrYears: termUnit,
        emi,
        totalInterest,
        totalPayment,
        processingFeeAmount: processingFee,
        schedule,
        calculationName: trimmedName,
      };

      const res = await fetch("/api/emi/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setSaveModalOpen(false);
        setCalculationName("");
        await fetchSavedCalculations();
        setSaveSuccessToast(data.message || `Calculation saved as "${trimmedName}"!`);
        setTimeout(() => setSaveSuccessToast(null), 4000);
      } else {
        setSaveError(data?.error || "Failed to save calculation. Please try again.");
      }
    } catch {
      setSaveError("Network connection error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function loadCalculation(calc: any) {
    if (!calc) return;
    setLoanType(calc.loanType || "Personal Loan");
    setPrincipal(Number(calc.principal) || 500000);
    setRate(Number(calc.annualRate) || 9.5);
    setFee(Number(calc.feePercent) || 0.5);
    if (calc.monthsOrYears === "years") {
      setTermUnit("years");
      setTerm(Math.max(1, Math.round((Number(calc.termMonths) || 60) / 12)));
    } else {
      setTermUnit("months");
      setTerm(Number(calc.termMonths) || 60);
    }
    setSavedDrawerOpen(false);
    setSaveSuccessToast(`Loaded "${calc.calculationName}" into calculator`);
    setTimeout(() => setSaveSuccessToast(null), 3000);
  }

  async function handleDeleteSaved(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      setDeletingId(id);
      const res = await fetch(`/api/emi/saved?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setSavedCalculations((prev) => prev.filter((c) => c.id !== id));
        setSaveSuccessToast(`Deleted "${name}"`);
        setTimeout(() => setSaveSuccessToast(null), 3000);
      } else {
        alert(data?.error || "Failed to delete calculation");
      }
    } catch {
      alert("Network error while deleting");
    } finally {
      setDeletingId(null);
    }
  }

  function printSchedule(targetData?: any) {
    const data = targetData || computeAndRender();
    const printWindow = window.open("", "emi-print-preview", "width=1100,height=800");
    if (!printWindow) {
      alert("Please allow pop-ups to print the schedule.");
      return;
    }

    const calcTitle = data.calculationName
      ? `CreditWise Loan Statement • ${data.calculationName}`
      : "CreditWise Loan Amortization Schedule";

    const details = [
      ["Calculation Name", data.calculationName || data.loanType || "EMI Assessment"],
      ["Loan Amount Disbursed", "₹" + formatWholeMoney(data.principal)],
      ["Current Interest (%)", Number(data.annualRate).toFixed(2) + "%"],
      ["Processing Fee", "₹" + formatWholeMoney(data.processingFeeAmount || 0)],
      ["Frequency", "Monthly"],
      ["Loan Type", data.loanType || "Personal Loan"],
      ["Tenure", `${data.termMonths} Months (${(data.termMonths / 12).toFixed(1)} Yrs)`],
      ["Monthly EMI", "₹" + formatMoney(data.emi, 2)],
      ["Total Interest", "₹" + formatMoney(data.totalInterest, 2)],
      ["Total Payment", "₹" + formatMoney(data.totalPayment || (Number(data.principal) + Number(data.totalInterest)), 2)],
    ];

    const detailMarkup = details
      .map(
        (item) =>
          `<div class="detail-item"><span class="detail-label">${item[0]}</span><span class="detail-colon">:</span><span class="detail-value">${item[1]}</span></div>`
      )
      .join("");

    const activeSchedule = Array.isArray(data.schedule) && data.schedule.length > 0 ? data.schedule : schedule;

    const scheduleRows = activeSchedule
      .map(
        (r: any) =>
          `<tr>
            <td style="text-align:center;font-weight:bold;color:#2563EB">#${r.month}</td>
            <td style="text-align:right">₹${formatMoney(r.emi, 2)}</td>
            <td style="text-align:right;color:#059669">₹${formatMoney(r.principal, 2)}</td>
            <td style="text-align:right;color:#7C3AED">₹${formatMoney(r.interest, 2)}</td>
            <td style="text-align:right;font-weight:600">₹${formatMoney(r.balance, 2)}</td>
          </tr>`
      )
      .join("");

    const documentHtml =
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' +
      calcTitle +
      '</title><style>' +
      '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#0F172A;font-family:Arial,sans-serif;background:#fff}.print-page{max-width:1120px;margin:0 auto;padding:18px 22px}.print-title{margin:0 0 16px;color:#2563EB;font-size:24px;font-weight:700;text-align:center}.loan-details{margin-bottom:20px;border:2px solid #2563EB;border-radius:8px}.loan-details-heading{margin:-14px auto 10px;width:max-content;padding:0 16px;color:#2563EB;background:#fff;font-size:16px;text-align:center;font-weight:700}.details-grid{display:grid;grid-template-columns:1fr 1fr}.detail-item{display:grid;grid-template-columns:220px 20px 1fr;padding:10px 14px;border-bottom:1px solid #E2E8F0;align-items:center;font-size:14px}.detail-item:nth-child(odd){border-right:1px solid #E2E8F0}.detail-item:nth-last-child(-n+2){border-bottom:0}.detail-label{color:#475569}.detail-value{font-weight:600}.schedule-title{margin:0 0 10px;color:#0F172A;font-size:18px;font-weight:700}.schedule-table{width:100%;border-collapse:collapse;font-size:12px}.schedule-table th{padding:8px 10px;color:#fff;background:#2563EB;text-align:right}.schedule-table th:first-child{text-align:center}.schedule-table td{padding:7px 10px;border-bottom:1px solid #E2E8F0}.schedule-table tbody tr:nth-child(even){background:#F8FAFC}@media print{.print-page{padding:0}.loan-details{break-inside:avoid}.schedule-table thead{display:table-header-group}}</style></head><body><main class="print-page"><h1 class="print-title">' +
      calcTitle +
      '</h1><section class="loan-details"><div class="loan-details-heading">Loan Assessment Summary</div><div class="details-grid">' +
      detailMarkup +
      '</div></section><h2 class="schedule-title">Month-by-Month Amortization Schedule</h2><table class="schedule-table"><thead><tr><th>Month</th><th>EMI (₹)</th><th>Principal (₹)</th><th>Interest (₹)</th><th>Remaining Balance (₹)</th></tr></thead><tbody>' +
      scheduleRows +
      "</tbody></table></main></body></html>";

    printWindow.document.open();
    printWindow.document.write(documentHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  }

  function computeAndRender() {
    return {
      loanType,
      principal,
      annualRate: rate,
      feePercent: fee,
      termMonths: termUnit === "years" ? term * 12 : term,
      monthsOrYears: termUnit,
      emi,
      totalInterest,
      totalPayment,
      processingFeeAmount: processingFee,
      schedule,
    };
  }

  function formatMoney(value: number, decimals: number = 2) {
    return Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function formatWholeMoney(value: number) {
    return Number(value).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    });
  }

  const principalRatio = totalPayment > 0 ? (principal / totalPayment) * 100 : 0;
  const interestRatio = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0;

  if (!user) {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
          color: "var(--ink-muted)",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid var(--border)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
          Loading EMI Calculator...
        </span>
      </main>
    );
  }

  return (
    <>
      {!embedded && <Topbar user={user} pathname="/home" />}

      {/* Main Fit-to-Screen Container */}
      <div
        className="emi-calc-wrapper animate-fade-in"
        style={{
          width: "100%",
          background: "var(--bg)",
          color: "var(--ink)",
          minHeight: embedded ? "auto" : "calc(100vh - 64px)",
          padding: "12px 16px 24px 16px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          {/* 1. Ultra-Compact Header Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
              paddingBottom: "12px",
              marginBottom: "12px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                }}
              >
                <Calculator size={18} />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: "1.0625rem",
                    fontWeight: 700,
                    margin: 0,
                    lineHeight: 1.2,
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>EMI & Amortization Simulator</span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      background: "rgba(13, 148, 136, 0.12)",
                      color: "var(--accent)",
                      border: "1px solid rgba(13, 148, 136, 0.25)",
                    }}
                  >
                    INR (₹)
                  </span>
                </h1>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--ink-muted)",
                    margin: "2px 0 0 0",
                  }}
                >
                  Real-time debt service, interest ratio & monthly payment schedule
                </p>
              </div>
            </div>

            {/* Header Right Action Group */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setSavedDrawerOpen(true)}
                title="View, download, and manage saved calculations"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 11px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--ink)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <FolderClock size={14} style={{ color: "var(--accent)" }} />
                <span>Saved Calculations</span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: savedCalculations.length >= 10 ? "rgba(239, 68, 68, 0.15)" : "var(--surface-2)",
                    color: savedCalculations.length >= 10 ? "#ef4444" : "var(--accent)",
                    fontWeight: 700,
                    border: "1px solid var(--border)",
                  }}
                >
                  {savedCalculations.length}/10
                </span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                title="Reset values to defaults"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "5px 10px",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  borderRadius: "6px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--ink-muted)",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={openSaveModal}
                title="Record client details and save assessment"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 12px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  background: "var(--accent)",
                  border: "1px solid var(--accent)",
                  color: "#ffffff",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                }}
              >
                <BookmarkCheck size={14} />
                <span>Save Calculation</span>
              </button>

              <button
                type="button"
                onClick={printSchedule}
                title="Print or export A4 statement"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 12px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--ink)",
                  cursor: "pointer",
                }}
              >
                <Printer size={14} />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Success Toast */}
          {saveSuccessToast && (
            <div
              style={{
                marginBottom: "12px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#10b981",
                fontSize: "0.8125rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircle2 size={16} />
              <span>{saveSuccessToast}</span>
            </div>
          )}

          {/* 2. Main Balanced 2-Column Grid (Compact & In-View) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "14px",
              alignItems: "start",
            }}
          >
            {/* Left Column: Loan Parameters (Compact Inputs) */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "8px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  <Sliders size={15} style={{ color: "var(--accent)" }} />
                  <span>Loan Parameters</span>
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--ink-muted)",
                    fontWeight: 500,
                  }}
                >
                  Interactive Inputs
                </span>
              </div>

              {/* Parameter 1: Loan Type */}
              <div>
                <label
                  htmlFor="loanType"
                  style={{
                    display: "block",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "var(--ink-muted)",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  Loan Type
                </label>
                <select
                  id="loanType"
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    outline: "none",
                  }}
                >
                  <option>Personal Loan</option>
                  <option>Home Loan</option>
                  <option>Auto / Vehicle Loan</option>
                  <option>Education Loan</option>
                  <option>Business Loan</option>
                </select>
              </div>

              {/* Parameter 2: Loan Amount */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <label
                    htmlFor="loanAmount"
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--ink-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Loan Amount (₹)
                  </label>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: "var(--accent)",
                      fontFamily: "monospace",
                    }}
                  >
                    ₹{formatWholeMoney(principal)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <input
                    id="loanAmountRange"
                    type="range"
                    min="50000"
                    max="10000000"
                    step="50000"
                    value={principal}
                    onChange={(e) => setPrincipal(Number(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: "var(--accent)",
                      height: "5px",
                      cursor: "pointer",
                    }}
                  />
                  <input
                    id="loanAmount"
                    type="number"
                    min="50000"
                    step="50000"
                    value={principal}
                    onChange={(e) => setPrincipal(Number(e.target.value))}
                    style={{
                      width: "105px",
                      padding: "4px 8px",
                      textAlign: "right",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--ink)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  />
                </div>
                {/* Compact Quick Select Chips */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "4px",
                    marginTop: "6px",
                  }}
                >
                  {[100000, 300000, 500000, 1000000, 2500000, 5000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPrincipal(amt)}
                      style={{
                        padding: "2px 7px",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        borderRadius: "4px",
                        border: "1px solid",
                        borderColor: principal === amt ? "var(--accent)" : "var(--border)",
                        background:
                          principal === amt ? "rgba(13, 148, 136, 0.15)" : "var(--surface-2)",
                        color: principal === amt ? "var(--accent)" : "var(--ink-muted)",
                        cursor: "pointer",
                      }}
                    >
                      ₹{amt >= 100000 ? `${amt / 100000}L` : amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameter 3: Annual Interest Rate */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <label
                    htmlFor="rate"
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--ink-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Annual Interest Rate (%)
                  </label>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: "var(--accent)",
                      fontFamily: "monospace",
                    }}
                  >
                    {rate}% p.a.
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <input
                    id="rateRange"
                    type="range"
                    min="5"
                    max="24"
                    step="0.25"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: "var(--accent)",
                      height: "5px",
                      cursor: "pointer",
                    }}
                  />
                  <input
                    id="rate"
                    type="number"
                    min="5"
                    max="24"
                    step="0.25"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    style={{
                      width: "75px",
                      padding: "4px 8px",
                      textAlign: "right",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--ink)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  />
                </div>
                {/* Quick Chips for ROI */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "4px",
                    marginTop: "6px",
                  }}
                >
                  {[8.5, 9.5, 10.5, 11.75, 13.5, 15.0].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRate(r)}
                      style={{
                        padding: "2px 7px",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        borderRadius: "4px",
                        border: "1px solid",
                        borderColor: rate === r ? "var(--accent)" : "var(--border)",
                        background:
                          rate === r ? "rgba(13, 148, 136, 0.15)" : "var(--surface-2)",
                        color: rate === r ? "var(--accent)" : "var(--ink-muted)",
                        cursor: "pointer",
                      }}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameter 4: Loan Tenure */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <label
                    htmlFor="term"
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--ink-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Loan Tenure
                  </label>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: "var(--accent)",
                      fontFamily: "monospace",
                    }}
                  >
                    {term} {termUnit === "years" ? (term === 1 ? "Year" : "Years") : "Months"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <input
                    id="termRange"
                    type="range"
                    min="1"
                    max={termUnit === "years" ? 30 : 360}
                    step="1"
                    value={term}
                    onChange={(e) => setTerm(Number(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: "var(--accent)",
                      height: "5px",
                      cursor: "pointer",
                    }}
                  />
                  <input
                    id="term"
                    type="number"
                    min="1"
                    step="1"
                    value={term}
                    onChange={(e) => setTerm(Number(e.target.value))}
                    style={{
                      width: "60px",
                      padding: "4px 8px",
                      textAlign: "right",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--ink)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  />
                  <select
                    value={termUnit}
                    onChange={(e) => {
                      const unit = e.target.value as "months" | "years";
                      setTermUnit(unit);
                      setTerm(unit === "years" ? 5 : 60);
                    }}
                    style={{
                      width: "80px",
                      padding: "4px 6px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--ink)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  >
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
                {/* Quick Chips for Tenure */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "4px",
                    marginTop: "6px",
                  }}
                >
                  {termUnit === "years"
                    ? [1, 2, 3, 5, 7, 10, 15, 20].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setTerm(yr)}
                          style={{
                            padding: "2px 7px",
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            borderRadius: "4px",
                            border: "1px solid",
                            borderColor: term === yr ? "var(--accent)" : "var(--border)",
                            background:
                              term === yr ? "rgba(13, 148, 136, 0.15)" : "var(--surface-2)",
                            color: term === yr ? "var(--accent)" : "var(--ink-muted)",
                            cursor: "pointer",
                          }}
                        >
                          {yr}Y
                        </button>
                      ))
                    : [12, 24, 36, 48, 60, 84, 120].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTerm(m)}
                          style={{
                            padding: "2px 7px",
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            borderRadius: "4px",
                            border: "1px solid",
                            borderColor: term === m ? "var(--accent)" : "var(--border)",
                            background:
                              term === m ? "rgba(13, 148, 136, 0.15)" : "var(--surface-2)",
                            color: term === m ? "var(--accent)" : "var(--ink-muted)",
                            cursor: "pointer",
                          }}
                        >
                          {m}M
                        </button>
                      ))}
                </div>
              </div>

              {/* Parameter 5: Processing Fee */}
              <div style={{ paddingTop: "2px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <label
                    htmlFor="fee"
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--ink-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Processing Fee (%)
                  </label>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--ink-muted)",
                    }}
                  >
                    {fee}% (₹{formatWholeMoney(processingFee)})
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <input
                    id="feeRange"
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={fee}
                    onChange={(e) => setFee(Number(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: "var(--accent)",
                      height: "5px",
                      cursor: "pointer",
                    }}
                  />
                  <input
                    id="fee"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={fee}
                    onChange={(e) => setFee(Number(e.target.value))}
                    style={{
                      width: "60px",
                      padding: "4px 8px",
                      textAlign: "right",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--ink)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Hero EMI Card & Results Breakdown */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {/* Guaranteed-Visible Hero Estimated Monthly EMI Card */}
              <div
                className="hero-emi-card-gradient"
                style={{
                  backgroundColor: "#1e3a8a",
                  backgroundImage: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 45%, #2563eb 100%)",
                  color: "#ffffff",
                  borderRadius: "10px",
                  padding: "16px 20px",
                  boxShadow: "0 6px 20px -3px rgba(30, 58, 138, 0.45)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Background decorative glow */}
                <div
                  style={{
                    position: "absolute",
                    right: "-20px",
                    top: "-20px",
                    width: "120px",
                    height: "120px",
                    background: "rgba(255, 255, 255, 0.08)",
                    borderRadius: "50%",
                    pointerEvents: "none",
                  }}
                />

                <div style={{ position: "relative", zIndex: 1 }}>
                  <div
                    className="emi-badge-title"
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#93c5fd",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Sparkles size={12} style={{ color: "#60a5fa" }} />
                    <span className="emi-badge-title">Estimated Monthly EMI</span>
                  </div>

                  <div
                    className="emi-amount-val"
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      margin: "4px 0",
                      color: "#ffffff",
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      lineHeight: 1.1,
                    }}
                  >
                    ₹{formatMoney(emi, 2)}
                    <span
                      className="emi-period-lbl"
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#bfdbfe",
                        marginLeft: "4px",
                      }}
                    >
                      / month
                    </span>
                  </div>

                  <div
                    className="emi-sub-detail"
                    style={{
                      fontSize: "0.75rem",
                      color: "#dbeafe",
                      fontWeight: 500,
                    }}
                  >
                    for {term} {termUnit} at {rate}% per annum • {loanType}
                  </div>
                </div>

                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(6px)",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    flexShrink: 0,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <Wallet size={24} />
                </div>
              </div>

              {/* 3 KPI Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--ink-muted)",
                      fontWeight: 600,
                      display: "block",
                    }}
                  >
                    Principal Loan
                  </span>
                  <span
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "var(--ink)",
                      display: "block",
                      marginTop: "2px",
                      fontFamily: "monospace",
                    }}
                  >
                    ₹{formatWholeMoney(principal)}
                  </span>
                </div>

                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--ink-muted)",
                      fontWeight: 600,
                      display: "block",
                    }}
                  >
                    Total Interest
                  </span>
                  <span
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "#9333ea",
                      display: "block",
                      marginTop: "2px",
                      fontFamily: "monospace",
                    }}
                  >
                    ₹{formatMoney(totalInterest, 2)}
                  </span>
                </div>

                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--ink-muted)",
                      fontWeight: 600,
                      display: "block",
                    }}
                  >
                    Total Payable
                  </span>
                  <span
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "#059669",
                      display: "block",
                      marginTop: "2px",
                      fontFamily: "monospace",
                    }}
                  >
                    ₹{formatMoney(totalPayment, 2)}
                  </span>
                </div>
              </div>

              {/* Compact Ratio Progress Bar */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      color: "var(--ink)",
                    }}
                  >
                    <PieChart size={13} style={{ color: "var(--accent)" }} />
                    <span>Payment Distribution Ratio</span>
                  </span>
                  <span style={{ color: "var(--ink-muted)", fontSize: "0.6875rem" }}>
                    Principal {principalRatio.toFixed(1)}% | Interest {interestRatio.toFixed(1)}%
                  </span>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    borderRadius: "4px",
                    background: "var(--surface-2)",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: `${principalRatio}%`,
                      background: "#2563eb",
                      transition: "width 0.3s ease",
                    }}
                    title={`Principal: ${principalRatio.toFixed(1)}%`}
                  />
                  <div
                    style={{
                      width: `${interestRatio}%`,
                      background: "#9333ea",
                      transition: "width 0.3s ease",
                    }}
                    title={`Interest: ${interestRatio.toFixed(1)}%`}
                  />
                </div>
              </div>

              {/* Tab Switcher & Schedule View Card */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    background: "var(--surface-2)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab("summary")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        borderRadius: "5px",
                        border: "none",
                        background:
                          activeTab === "summary" ? "var(--surface)" : "transparent",
                        color:
                          activeTab === "summary" ? "var(--ink)" : "var(--ink-muted)",
                        boxShadow:
                          activeTab === "summary" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <ListFilter size={12} />
                      <span>Key Breakdown</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("schedule")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        borderRadius: "5px",
                        border: "none",
                        background:
                          activeTab === "schedule" ? "var(--surface)" : "transparent",
                        color:
                          activeTab === "schedule" ? "var(--ink)" : "var(--ink-muted)",
                        boxShadow:
                          activeTab === "schedule" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Calendar size={12} />
                      <span>Amortization Schedule ({schedule.length} Mo)</span>
                    </button>
                  </div>

                  <span
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--ink-muted)",
                      fontWeight: 500,
                    }}
                  >
                    Upfront Fee: ₹{formatWholeMoney(processingFee)}
                  </span>
                </div>

                {/* Tab 1: Key Breakdown Quick View */}
                {activeTab === "summary" && (
                  <div style={{ padding: "12px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px",
                        fontSize: "0.75rem",
                        marginBottom: "10px",
                      }}
                    >
                      <div
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span style={{ color: "var(--ink-muted)", display: "block" }}>
                          Monthly Interest
                        </span>
                        <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                          {(rate / 12).toFixed(3)}% per month
                        </span>
                      </div>
                      <div
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span style={{ color: "var(--ink-muted)", display: "block" }}>
                          Upfront Fee + GST
                        </span>
                        <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                          ₹{formatWholeMoney(processingFee)} (18% GST incl.)
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: "rgba(13, 148, 136, 0.08)",
                        border: "1px solid rgba(13, 148, 136, 0.2)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FileSpreadsheet size={15} style={{ color: "var(--accent)" }} />
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "var(--ink)",
                          }}
                        >
                          Complete Month-by-Month Amortization Ready
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("schedule")}
                        style={{
                          background: "var(--accent)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Open Table →
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 2: Full Month-by-Month Amortization Table */}
                {activeTab === "schedule" && (
                  <div
                    style={{
                      maxHeight: "260px",
                      overflowY: "auto",
                      overflowX: "auto",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.6875rem",
                        color: "var(--ink)",
                      }}
                    >
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "var(--surface-2)",
                          borderBottom: "1px solid var(--border)",
                          zIndex: 2,
                        }}
                      >
                        <tr>
                          <th style={{ padding: "6px 8px", textAlign: "center" }}>Mo</th>
                          <th style={{ padding: "6px 8px", textAlign: "right" }}>EMI (₹)</th>
                          <th style={{ padding: "6px 8px", textAlign: "right" }}>Principal (₹)</th>
                          <th style={{ padding: "6px 8px", textAlign: "right" }}>Interest (₹)</th>
                          <th style={{ padding: "6px 8px", textAlign: "right" }}>Remaining (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.map((row) => (
                          <tr
                            key={row.month}
                            style={{
                              borderBottom: "1px solid var(--border)",
                              height: "28px",
                            }}
                          >
                            <td
                              style={{
                                textAlign: "center",
                                fontWeight: 700,
                                color: "var(--accent)",
                                padding: "4px 8px",
                              }}
                            >
                              #{row.month}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontFamily: "monospace",
                                padding: "4px 8px",
                              }}
                            >
                              ₹{formatMoney(row.emi, 2)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontFamily: "monospace",
                                color: "#059669",
                                padding: "4px 8px",
                              }}
                            >
                              ₹{formatMoney(row.principal, 2)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontFamily: "monospace",
                                color: "#9333ea",
                                padding: "4px 8px",
                              }}
                            >
                              ₹{formatMoney(row.interest, 2)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontFamily: "monospace",
                                fontWeight: 600,
                                padding: "4px 8px",
                              }}
                            >
                              ₹{formatMoney(row.balance, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* 1. Save Calculation Modal */}
      {saveModalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(2px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setSaveModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "var(--surface)",
              color: "var(--ink)",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-xl)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <BookmarkCheck size={18} style={{ color: "var(--accent)" }} />
                <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700 }}>
                  Save EMI Calculation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-muted)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmSave} style={{ padding: "16px 18px" }}>
              {/* Assessment Preview Badge */}
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(13, 148, 136, 0.08)",
                  border: "1px solid rgba(13, 148, 136, 0.2)",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                }}
              >
                <div>
                  <strong style={{ color: "var(--ink)", display: "block" }}>
                    {loanType} • ₹{formatWholeMoney(principal)}
                  </strong>
                  <span style={{ color: "var(--ink-muted)", fontSize: "0.6875rem" }}>
                    {term} {termUnit} @ {rate}% p.a.
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: "var(--ink-muted)", fontSize: "0.6875rem", display: "block" }}>
                    Monthly EMI
                  </span>
                  <strong style={{ color: "var(--accent)", fontSize: "0.875rem" }}>
                    ₹{formatMoney(emi, 2)}
                  </strong>
                </div>
              </div>

              {/* 10/10 Storage Capacity Notice */}
              {savedCalculations.length >= 10 && (
                <div
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    color: "var(--warning, #d97706)",
                    fontSize: "0.75rem",
                    marginBottom: "14px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    lineHeight: 1.45,
                  }}
                >
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong>Storage limit reached (10/10)</strong>
                    <div style={{ fontSize: "0.6875rem", opacity: 0.9, marginTop: "2px" }}>
                      Saving will automatically replace your oldest calculation (
                      <em>{savedCalculations[savedCalculations.length - 1]?.calculationName || "Oldest item"}</em>).
                    </div>
                  </div>
                </div>
              )}

              {saveError && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#ef4444",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    marginBottom: "12px",
                  }}
                >
                  {saveError}
                </div>
              )}

              {/* Calculation Name Input */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  htmlFor="calcNameInput"
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--ink)",
                    marginBottom: "4px",
                  }}
                >
                  Calculation Name / Tag <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <BookmarkCheck
                    size={14}
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--ink-muted)",
                    }}
                  />
                  <input
                    id="calcNameInput"
                    type="text"
                    required
                    placeholder="e.g. Dream Home 50L, Car Loan Option 1"
                    value={calculationName}
                    onChange={(e) => setCalculationName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 30px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--ink)",
                      fontSize: "0.8125rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--ink-muted)",
                    marginTop: "3px",
                    display: "block",
                  }}
                >
                  A unique, recognizable label to identify and reload this calculation later.
                </span>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "8px",
                  paddingTop: "6px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  disabled={saving}
                  style={{
                    padding: "7px 14px",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    borderRadius: "6px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--ink)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "7px 16px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: "6px",
                    background: "var(--accent)",
                    border: "1px solid var(--accent)",
                    color: "#ffffff",
                    cursor: saving ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {saving ? (
                    <>
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          border: "2px solid #ffffff",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <BookmarkCheck size={14} />
                      <span>Confirm & Save</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Saved Calculations Slide-over Drawer */}
      {savedDrawerOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setSavedDrawerOpen(false)}
        >
          <div
            style={{
              width: "min(540px, 100vw)",
              height: "100%",
              background: "var(--surface)",
              color: "var(--ink)",
              borderLeft: "1px solid var(--border)",
              boxShadow: "var(--shadow-xl)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FolderClock size={20} style={{ color: "var(--accent)" }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>
                    Saved Calculations
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                    {savedCalculations.length}/10 stored • Oldest replaced automatically on limit
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSavedDrawerOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-muted)",
                  cursor: "pointer",
                  padding: "6px",
                  display: "flex",
                  borderRadius: "6px",
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search and Storage Bar */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
              <div style={{ position: "relative", marginBottom: "8px" }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--ink-muted)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search saved calculations by name..."
                  value={savedSearchQuery}
                  onChange={(e) => setSavedSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 32px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                    fontSize: "0.8125rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {savedSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSavedSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--ink-muted)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Storage capacity bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--ink-muted)", marginBottom: "4px" }}>
                <span>Storage capacity</span>
                <span style={{ fontWeight: 600, color: savedCalculations.length >= 10 ? "#ef4444" : "var(--ink)" }}>
                  {savedCalculations.length} of 10 slots used
                </span>
              </div>
              <div style={{ width: "100%", height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(savedCalculations.length / 10) * 100}%`,
                    height: "100%",
                    background: savedCalculations.length >= 10 ? "#ef4444" : "var(--accent)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>

            {/* Calculations List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {loadingSaved ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--ink-muted)" }}>
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      border: "2px solid var(--border)",
                      borderTopColor: "var(--accent)",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                      margin: "0 auto 10px auto",
                    }}
                  />
                  <span>Loading calculations...</span>
                </div>
              ) : savedCalculations.filter((c: any) =>
                  (c.calculationName || "").toLowerCase().includes(savedSearchQuery.toLowerCase()) ||
                  (c.loanType || "").toLowerCase().includes(savedSearchQuery.toLowerCase())
                ).length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--ink-muted)" }}>
                  <FolderClock size={36} style={{ margin: "0 auto 12px auto", opacity: 0.4 }} />
                  <p style={{ margin: "0 0 6px 0", fontWeight: 600, color: "var(--ink)", fontSize: "0.9375rem" }}>
                    {savedSearchQuery ? "No matching calculations found" : "No saved calculations yet"}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.75rem", maxWidth: "280px", marginInline: "auto" }}>
                    {savedSearchQuery
                      ? "Try searching with a different term."
                      : "Click 'Save Calculation' in the toolbar to bookmark your EMI assessments here."}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {savedCalculations
                    .filter((c: any) =>
                      (c.calculationName || "").toLowerCase().includes(savedSearchQuery.toLowerCase()) ||
                      (c.loanType || "").toLowerCase().includes(savedSearchQuery.toLowerCase())
                    )
                    .map((calc: any) => (
                      <div
                        key={calc.id}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "10px",
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          transition: "all 0.15s ease",
                          boxShadow: "var(--shadow-xs)",
                        }}
                      >
                        {/* Top Row: Name and Date */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
                              {calc.calculationName}
                            </h4>
                            <span style={{ fontSize: "0.6875rem", color: "var(--ink-muted)" }}>
                              Saved {new Date(calc.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: "12px",
                              background: "rgba(13, 148, 136, 0.1)",
                              color: "var(--accent)",
                              border: "1px solid rgba(13, 148, 136, 0.2)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {calc.loanType}
                          </span>
                        </div>

                        {/* Financial Metrics Grid */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "8px",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            marginBottom: "12px",
                            fontSize: "0.75rem",
                          }}
                        >
                          <div>
                            <span style={{ color: "var(--ink-muted)", fontSize: "0.6875rem", display: "block" }}>
                              Loan Amount
                            </span>
                            <strong style={{ color: "var(--ink)", fontSize: "0.8125rem" }}>
                              ₹{formatWholeMoney(calc.principal)}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: "var(--ink-muted)", fontSize: "0.6875rem", display: "block" }}>
                              Tenure & Rate
                            </span>
                            <strong style={{ color: "var(--ink)", fontSize: "0.8125rem" }}>
                              {calc.termMonths} Mo @ {Number(calc.annualRate).toFixed(1)}%
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: "var(--ink-muted)", fontSize: "0.6875rem", display: "block" }}>
                              Monthly EMI
                            </span>
                            <strong style={{ color: "var(--accent)", fontSize: "0.875rem" }}>
                              ₹{formatMoney(calc.emi, 2)}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: "var(--ink-muted)", fontSize: "0.6875rem", display: "block" }}>
                              Total Interest
                            </span>
                            <strong style={{ color: "var(--ink)", fontSize: "0.8125rem" }}>
                              ₹{formatWholeMoney(calc.totalInterest)}
                            </strong>
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => printSchedule(calc)}
                              title="Download or print repayment schedule statement"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "5px 10px",
                                borderRadius: "6px",
                                background: "var(--accent)",
                                color: "#ffffff",
                                border: "none",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                              }}
                            >
                              <Printer size={13} />
                              <span>Download Statement</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => loadCalculation(calc)}
                              title="Load parameters into active calculator"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "5px 10px",
                                borderRadius: "6px",
                                background: "var(--surface)",
                                color: "var(--ink)",
                                border: "1px solid var(--border)",
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                cursor: "pointer",
                              }}
                            >
                              <ArrowRightCircle size={13} style={{ color: "var(--accent)" }} />
                              <span>Load</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteSaved(calc.id, calc.calculationName)}
                            disabled={deletingId === calc.id}
                            title="Delete saved calculation"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "5px 8px",
                              borderRadius: "6px",
                              background: "transparent",
                              color: "var(--ink-muted)",
                              border: "1px solid transparent",
                              fontSize: "0.75rem",
                              cursor: deletingId === calc.id ? "not-allowed" : "pointer",
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
