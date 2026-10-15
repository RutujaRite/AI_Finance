/**
 * EMI Calculator component — Modern FinTech layout.
 * Loan parameters, monthly EMI hero banner, summary cards, payment distribution ratio,
 * and amortization schedule. Preserves 100% of mathematical computation and save API.
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
  IndianRupee,
  Sparkles,
  ArrowRight,
  ShieldCheck,
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

  async function saveCalculation() {
    if (!emi || term <= 0) {
      alert("Please enter valid loan details");
      return;
    }
    setSaving(true);
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
      };
      const res = await fetch("/api/emi/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        alert("Calculation successfully saved to your profile!");
      } else {
        alert("Save failed. Please try again.");
      }
    } catch (e) {
      alert("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function printSchedule() {
    const data = computeAndRender();
    const printWindow = window.open("", "emi-print-preview", "width=1100,height=800");
    if (!printWindow) {
      alert("Please allow pop-ups to print the schedule.");
      return;
    }

    const details = [
      ["Loan Amount Disbursed", "₹" + formatWholeMoney(data.principal)],
      ["Current Interest (%)", Number(data.annualRate).toFixed(2)],
      ["Moratorium Interest Capitalized", "NA"],
      ["Frequency", "Monthly"],
      ["Loan Type", data.loanType],
      ["Tenure (Months)", data.termMonths],
    ];
    const detailMarkup = details
      .map(
        (item) =>
          `<div class="detail-item"><span class="detail-label">${item[0]}</span><span class="detail-colon">:</span><span class="detail-value">${item[1]}</span></div>`
      )
      .join("");
    const scheduleRows = document.getElementById("scheduleBody")?.innerHTML || "";
    const documentHtml =
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Loan Amortization Schedule</title><style>' +
      '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#0F172A;font-family:Arial,sans-serif;background:#fff}.print-page{max-width:1120px;margin:0 auto;padding:18px 22px}.print-title{margin:0 0 22px;color:#2563EB;font-size:25px;font-weight:700;text-align:center}.loan-details{margin-bottom:28px;border:2px solid #2563EB;border-radius:8px}.loan-details-heading{margin:-16px auto 12px;width:max-content;padding:0 22px;color:#2563EB;background:#fff;font-size:20px;text-align:center;font-weight:600}.details-grid{display:grid;grid-template-columns:1fr 1fr}.detail-item{display:grid;grid-template-columns:235px 28px 1fr;min-height:72px;padding:16px;border-bottom:1px solid #E2E8F0;align-items:start;font-size:16px}.detail-item:nth-child(odd){border-right:1px solid #E2E8F0}.detail-item:nth-last-child(-n+2){border-bottom:0}.detail-label{color:#475569;line-height:1.32}.detail-value{font-size:16px;line-height:1.32;font-weight:600}.schedule-title{margin:0 0 12px;color:#0F172A;font-size:20px;font-weight:700}.schedule-table{width:100%;border-collapse:collapse;font-size:13px}.schedule-table th{padding:10px;color:#fff;background:#2563EB;text-align:right}.schedule-table th:first-child,.schedule-table td:first-child{text-align:center}.schedule-table td{padding:9px;border-bottom:1px solid #E2E8F0;text-align:right}.schedule-table tbody tr:nth-child(even){background:#F8FAFC}@media print{.print-page{padding:0}.loan-details{break-inside:avoid}.schedule-table thead{display:table-header-group}}</style></head><body><main class="print-page"><h1 class="print-title">Loan Amortization Schedule</h1><section class="loan-details"><div class="loan-details-heading">Loan Details</div><div class="details-grid">' +
      detailMarkup +
      '</div></section><h2 class="schedule-title">Amortization Schedule</h2><table class="schedule-table"><thead><tr><th>Month</th><th>EMI (₹)</th><th>Principal (₹)</th><th>Interest (₹)</th><th>Balance (₹)</th></tr></thead><tbody>' +
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
      <main className="flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-sm font-medium">Loading EMI Calculator...</span>
      </main>
    );
  }

  return (
    <>
      {!embedded && <Topbar user={user} pathname="/home" />}
      <div
        className="w-full bg-slate-50 font-sans animate-fade-in"
        style={embedded ? { flex: 1, overflow: "auto" } : { minHeight: "calc(100vh - 64px)" }}
      >
        <div className="max-w-[1400px] mx-auto px-3.5 sm:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <Calculator className="w-6 h-6 text-blue-600" />
                <span>EMI & Amortization Calculator</span>
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Simulate monthly installments, interest distribution ratio, and complete loan amortization schedule.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Smart Simulator</span>
              </span>
            </div>
          </div>

          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Loan Parameters (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              <div className="cw-card p-5 space-y-5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Loan Parameters</span>
                </div>

                {/* Field 1: Loan Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700" htmlFor="loanType">
                    Loan Type
                  </label>
                  <select
                    id="loanType"
                    className="cw-select"
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value)}
                  >
                    <option>Personal Loan</option>
                    <option>Home Loan</option>
                    <option>Auto / Vehicle Loan</option>
                    <option>Education Loan</option>
                    <option>Business Loan</option>
                  </select>
                </div>

                {/* Field 2: Loan Amount */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <label className="text-slate-700" htmlFor="loanAmount">
                      Loan Amount (₹)
                    </label>
                    <span className="text-blue-600 font-bold text-sm">
                      ₹{formatWholeMoney(principal)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="loanAmountRange"
                      type="range"
                      min="50000"
                      max="10000000"
                      step="50000"
                      value={principal}
                      onChange={(e) => setPrincipal(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      id="loanAmount"
                      type="number"
                      className="cw-input w-28 text-right font-medium text-xs py-1.5"
                      value={principal}
                      min="50000"
                      step="50000"
                      onChange={(e) => setPrincipal(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[100000, 200000, 500000, 1000000, 2000000, 5000000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={`text-[11px] px-2.5 py-1 rounded-md font-medium border transition-colors cursor-pointer ${
                          principal === amt
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                        onClick={() => setPrincipal(amt)}
                      >
                        ₹{amt >= 100000 ? `${amt / 100000}L` : amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 3: Annual Interest Rate */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <label className="text-slate-700" htmlFor="rate">
                      Annual Interest Rate (%)
                    </label>
                    <span className="text-blue-600 font-bold text-sm">{rate}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="rateRange"
                      type="range"
                      min="5"
                      max="24"
                      step="0.25"
                      value={rate}
                      onChange={(e) => setRate(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      id="rate"
                      type="number"
                      className="cw-input w-24 text-right font-medium text-xs py-1.5"
                      value={rate}
                      step="0.25"
                      onChange={(e) => setRate(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[8.5, 9.5, 10.5, 12.0, 14.0].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`text-[11px] px-2.5 py-1 rounded-md font-medium border transition-colors cursor-pointer ${
                          rate === r
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                        onClick={() => setRate(r)}
                      >
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 4: Loan Tenure */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <label className="text-slate-700" htmlFor="term">
                      Loan Tenure
                    </label>
                    <span className="text-blue-600 font-bold text-sm">
                      {term} {termUnit}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="termRange"
                      type="range"
                      min="1"
                      max={termUnit === "years" ? 30 : 360}
                      step="1"
                      value={term}
                      onChange={(e) => setTerm(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      id="term"
                      type="number"
                      className="cw-input w-20 text-right font-medium text-xs py-1.5"
                      value={term}
                      step="1"
                      onChange={(e) => setTerm(Number(e.target.value))}
                    />
                    <select
                      id="monthsOrYears"
                      className="cw-select w-24 text-xs py-1.5"
                      value={termUnit}
                      onChange={(e) => {
                        const unit = e.target.value as "months" | "years";
                        setTermUnit(unit);
                        setTerm(unit === "years" ? 5 : 60);
                      }}
                    >
                      <option value="months">Mo</option>
                      <option value="years">Yr</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {termUnit === "years"
                      ? [1, 2, 3, 4, 5, 7].map((yr) => (
                          <button
                            key={yr}
                            type="button"
                            className={`text-[11px] px-2.5 py-1 rounded-md font-medium border transition-colors cursor-pointer ${
                              term === yr
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                            onClick={() => setTerm(yr)}
                          >
                            {yr} {yr === 1 ? "Yr" : "Yrs"}
                          </button>
                        ))
                      : [12, 24, 36, 48, 60, 84].map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`text-[11px] px-2.5 py-1 rounded-md font-medium border transition-colors cursor-pointer ${
                              term === m
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                            onClick={() => setTerm(m)}
                          >
                            {m} Mo
                          </button>
                        ))}
                  </div>
                </div>

                {/* Field 5: Processing Fee */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <label className="text-slate-700" htmlFor="fee">
                      Processing Fee (%)
                    </label>
                    <span className="text-slate-600 font-semibold text-xs">{fee}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="feeRange"
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={fee}
                      onChange={(e) => setFee(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      id="fee"
                      type="number"
                      className="cw-input w-20 text-right font-medium text-xs py-1.5"
                      value={fee}
                      step="0.1"
                      onChange={(e) => setFee(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Calculation Results & Amortization (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Hero Monthly EMI Banner */}
              <div className="cw-card p-4 sm:p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between shadow-md">
                <div>
                  <div className="text-[11px] sm:text-xs uppercase font-semibold tracking-wider text-blue-100">
                    Estimated Monthly EMI
                  </div>
                  <div className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-1">
                    ₹{formatMoney(emi, 2)}
                  </div>
                  <div className="text-[11px] sm:text-xs text-blue-100 mt-1">
                    for {term} {termUnit} at {rate}% per annum
                  </div>
                </div>
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
              </div>

              {/* 3 KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="cw-card p-4">
                  <div className="text-xs font-medium text-slate-500">Principal Loan</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    ₹{formatWholeMoney(principal)}
                  </div>
                </div>
                <div className="cw-card p-4">
                  <div className="text-xs font-medium text-slate-500">Total Interest</div>
                  <div className="text-lg font-bold text-purple-600 mt-1">
                    ₹{formatMoney(totalInterest, 2)}
                  </div>
                </div>
                <div className="cw-card p-4">
                  <div className="text-xs font-medium text-slate-500">Total Payable</div>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    ₹{formatMoney(totalPayment, 2)}
                  </div>
                </div>
              </div>

              {/* Payment Distribution Ratio Progress Bar */}
              <div className="cw-card p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-800 flex items-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5 text-blue-600" />
                    <span>Payment Distribution Ratio</span>
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Principal: {principalRatio.toFixed(1)}% | Interest: {interestRatio.toFixed(1)}%
                  </span>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${principalRatio}%` }}
                  />
                  <div
                    className="bg-purple-500 h-full transition-all duration-300"
                    style={{ width: `${interestRatio}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span>Principal (₹{formatWholeMoney(principal)})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span>Interest (₹{formatMoney(totalInterest, 2)})</span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <span className="text-xs text-slate-500">
                  Upfront Processing Fee:{" "}
                  <strong className="text-slate-800">₹{formatWholeMoney(processingFee)}</strong>
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    className="cw-btn-primary flex-1 sm:flex-initial text-xs py-2 px-3 inline-flex items-center justify-center gap-1.5"
                    type="button"
                    onClick={saveCalculation}
                    disabled={saving}
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>{saving ? "Saving..." : "Save Calculation"}</span>
                  </button>
                  <button
                    className="cw-btn-secondary flex-1 sm:flex-initial text-xs py-2 px-3 inline-flex items-center justify-center gap-1.5"
                    type="button"
                    onClick={printSchedule}
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Print Schedule</span>
                  </button>
                </div>
              </div>

              {/* Amortization Schedule Table */}
              <div className="cw-card p-0 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Amortization Schedule ({schedule.length} Months)</span>
                  </div>
                  <span className="text-xs text-slate-400">Detailed breakdown</span>
                </div>
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="cw-table">
                    <thead>
                      <tr>
                        <th style={{ width: "65px", textAlign: "center" }}>Month</th>
                        <th style={{ textAlign: "right" }}>EMI (₹)</th>
                        <th style={{ textAlign: "right" }}>Principal (₹)</th>
                        <th style={{ textAlign: "right" }}>Interest (₹)</th>
                        <th style={{ textAlign: "right" }}>Remaining Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody id="scheduleBody">
                      {schedule.map((row) => (
                        <tr key={row.month}>
                          <td className="text-center font-bold text-blue-600">#{row.month}</td>
                          <td className="text-right font-medium">₹{formatMoney(row.emi, 2)}</td>
                          <td className="text-right text-emerald-600 font-medium">
                            ₹{formatMoney(row.principal, 2)}
                          </td>
                          <td className="text-right text-purple-600 font-medium">
                            ₹{formatMoney(row.interest, 2)}
                          </td>
                          <td className="text-right font-semibold text-slate-900">
                            ₹{formatMoney(row.balance, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
