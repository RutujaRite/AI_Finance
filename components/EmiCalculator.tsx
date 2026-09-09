/**
 * EMI Calculator component — matches reference layout at 1200px x 700px.
 * Loan parameters, monthly EMI hero banner, summary cards, payment distribution ratio,
 * and amortization schedule.
 */

"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Topbar from "./Topbar"

export default function EmiCalculator({
  user: propUser,
  embedded = false,
}: {
  user?: any
  embedded?: boolean
}) {
  const router = useRouter()
  const [user, setUser] = useState<any>(propUser || null)
  const [loanType, setLoanType] = useState("Personal Loan")
  const [principal, setPrincipal] = useState(500000)
  const [rate, setRate] = useState(9.5)
  const [fee, setFee] = useState(0.5)
  const [term, setTerm] = useState(60)
  const [termUnit, setTermUnit] = useState<"months" | "years">("months")
  const [emi, setEmi] = useState(0)
  const [totalInterest, setTotalInterest] = useState(0)
  const [totalPayment, setTotalPayment] = useState(0)
  const [processingFee, setProcessingFee] = useState(0)
  const [schedule, setSchedule] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (propUser) {
      setUser(propUser)
    } else {
      checkAuth()
    }
  }, [propUser])

  useEffect(() => {
    compute()
  }, [principal, rate, fee, term, termUnit])

  async function checkAuth() {
    const res = await fetch("/api/auth/verify")
    if (!res.ok) {
      router.replace("/login")
    } else {
      const data = await res.json()
      if (data.success) setUser(data.user)
    }
  }

  function compute() {
    const p = principal
    const annualRate = rate
    const feePercent = fee
    let months = term
    if (termUnit === "years") months = term * 12
    const r = annualRate / 12 / 100
    let monthlyEmi = 0
    if (r > 0) {
      monthlyEmi = (p * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
    } else if (months > 0) {
      monthlyEmi = p / months
    }
    const total = monthlyEmi * months
    const interest = total - p
    const feeAmount = p * (feePercent / 100)

    setEmi(monthlyEmi)
    setTotalInterest(interest)
    setTotalPayment(total)
    setProcessingFee(feeAmount)

    const rows: any[] = []
    let balance = p
    for (let m = 1; m <= months; m++) {
      const interestPortion = balance * r
      const principalPortion = monthlyEmi - interestPortion
      balance = Math.max(0, balance - principalPortion)
      rows.push({
        month: m,
        emi: monthlyEmi,
        principal: principalPortion,
        interest: interestPortion,
        balance,
      })
    }
    setSchedule(rows)
  }

  async function saveCalculation() {
    if (!emi || term <= 0) {
      alert("Please enter valid loan details")
      return
    }
    setSaving(true)
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
      }
      const res = await fetch("/api/emi/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        alert("Calculation saved")
      } else {
        alert("Save failed")
      }
    } catch (e) {
      alert("Save failed")
    } finally {
      setSaving(false)
    }
  }

  function printSchedule() {
    const data = computeAndRender()
    const printWindow = window.open("", "emi-print-preview", "width=1100,height=800")
    if (!printWindow) {
      alert("Please allow pop-ups to print the schedule.")
      return
    }

    const details = [
      ["Loan Amount Disbursed", "₹" + formatWholeMoney(data.principal)],
      ["Current Interest (%)", Number(data.annualRate).toFixed(2)],
      ["Moratorium Interest Capitalized", "NA"],
      ["Frequency", "Monthly"],
      ["Loan Type", data.loanType],
      ["Tenure (Months)", data.termMonths],
    ]
    const detailMarkup = details
      .map(
        (item) =>
          `<div class="detail-item"><span class="detail-label">${item[0]}</span><span class="detail-colon">:</span><span class="detail-value">${item[1]}</span></div>`
      )
      .join("")
    const scheduleRows = document.getElementById("scheduleBody")?.innerHTML || ""
    const documentHtml =
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Loan Amortization Schedule</title><style>' +
      '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#3e3e45;font-family:Arial,sans-serif;background:#fff}.print-page{max-width:1120px;margin:0 auto;padding:18px 22px}.print-title{margin:0 0 22px;color:#4F46E5;font-size:25px;font-weight:500;text-align:center}.loan-details{margin-bottom:28px;border:2px solid #4F46E5}.loan-details-heading{margin:-16px auto 12px;width:max-content;padding:0 22px;color:#4F46E5;background:#fff;font-size:20px;text-align:center}.details-grid{display:grid;grid-template-columns:1fr 1fr}.detail-item{display:grid;grid-template-columns:235px 28px 1fr;min-height:72px;padding:16px;border-bottom:2px dotted #777;align-items:start;font-size:18px}.detail-item:nth-child(odd){border-right:2px solid #4F46E5}.detail-item:nth-last-child(-n+2){border-bottom:0}.detail-label{color:#4F46E5;line-height:1.32}.detail-value{font-size:18px;line-height:1.32}.schedule-title{margin:0 0 12px;color:#4F46E5;font-size:22px}.schedule-table{width:100%;border-collapse:collapse;font-size:13px}.schedule-table th{padding:10px;color:#fff;background:#4F46E5;text-align:right}.schedule-table th:first-child,.schedule-table td:first-child{text-align:center}.schedule-table td{padding:9px;border-bottom:1px solid #d9dce7;text-align:right}.schedule-table tbody tr:nth-child(even){background:#f5f3ff}@media print{.print-page{padding:0}.loan-details{break-inside:avoid}.schedule-table thead{display:table-header-group}}</style></head><body><main class="print-page"><h1 class="print-title">Loan Amortization Schedule</h1><section class="loan-details"><div class="loan-details-heading">Loan Details</div><div class="details-grid">' +
      detailMarkup +
      '</div></section><h2 class="schedule-title">Amortization Schedule</h2><table class="schedule-table"><thead><tr><th>Month</th><th>EMI (₹)</th><th>Principal (₹)</th><th>Interest (₹)</th><th>Balance (₹)</th></tr></thead><tbody>' +
      scheduleRows +
      "</tbody></table></main></body></html>"

    printWindow.document.open()
    printWindow.document.write(documentHtml)
    printWindow.document.close()
    printWindow.focus()
    printWindow.onload = () => printWindow.print()
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
    }
  }

  function formatMoney(value: number, decimals: number = 2) {
    return Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  function formatWholeMoney(value: number) {
    return Number(value).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    })
  }

  const principalRatio = totalPayment > 0 ? (principal / totalPayment) * 100 : 0
  const interestRatio = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0

  if (!user) return <main style={{ padding: 24, textAlign: "center", color: "var(--ink-soft)" }}>Loading...</main>

  return (
    <>
      {!embedded && <Topbar user={user} pathname="/home" />}
      <div
        className="emi-page-wrapper animate-fade-in"
        style={embedded ? { flex: 1, overflow: "auto", height: "calc(100vh - var(--topbar-height))", width: "100%" } : undefined}
      >
        <div className="emi-fixed-container">
          {/* Page Header */}
          <div className="page-header">
            <div>
              <h1 className="page-header-title">
                <i className="bi bi-calculator" style={{ color: "var(--accent)", marginRight: "0.5rem" }} />
                EMI Calculator
              </h1>
              <p className="page-header-subtitle">
                Interactive loan simulation, principal vs interest distribution, and month-by-month amortization schedule
              </p>
            </div>
            <div className="page-header-actions">
              <span className="badge bg-primary">Smart Financial Planning</span>
            </div>
          </div>

          {/* Main Grid */}
          <div className="emi-grid">
            {/* Controls Panel (Left) */}
            <div className="card emi-params-card">
              <div className="emi-params-title">
                <i className="bi bi-sliders2" style={{ color: "var(--accent)" }} />
                Loan Parameters
              </div>

              {/* Field 1: Loan Type */}
              <div className="emi-field-group">
                <label className="form-label" htmlFor="loanType">
                  Loan Type
                </label>
                <select
                  id="loanType"
                  className="form-select"
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
              <div className="emi-field-group">
                <div className="emi-field-label-row">
                  <label className="form-label" htmlFor="loanAmount">Loan Amount (₹)</label>
                  <span className="emi-field-label-value">₹{formatWholeMoney(principal)}</span>
                </div>
                <div className="emi-control-row">
                  <input
                    id="loanAmountRange"
                    type="range"
                    min="50000"
                    max="10000000"
                    step="50000"
                    value={principal}
                    onChange={(e) => setPrincipal(Number(e.target.value))}
                    className="emi-slider"
                  />
                  <input
                    id="loanAmount"
                    type="number"
                    className="form-control emi-number-input"
                    value={principal}
                    min="50000"
                    step="50000"
                    onChange={(e) => setPrincipal(Number(e.target.value))}
                  />
                </div>
                <div className="emi-preset-pills">
                  {[100000, 200000, 500000, 1000000, 2000000, 5000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className={`emi-preset-pill ${principal === amt ? "active" : ""}`}
                      onClick={() => setPrincipal(amt)}
                    >
                      ₹{amt >= 100000 ? `${amt / 100000}L` : amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 3: Annual Interest Rate */}
              <div className="emi-field-group">
                <div className="emi-field-label-row">
                  <label className="form-label" htmlFor="rate">Annual Interest Rate (%)</label>
                  <span className="emi-field-label-value">{rate}%</span>
                </div>
                <div className="emi-control-row">
                  <input
                    id="rateRange"
                    type="range"
                    min="5"
                    max="24"
                    step="0.25"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="emi-slider"
                  />
                  <input
                    id="rate"
                    type="number"
                    className="form-control emi-number-input"
                    value={rate}
                    step="0.25"
                    onChange={(e) => setRate(Number(e.target.value))}
                  />
                </div>
                <div className="emi-preset-pills">
                  {[8.5, 9.5, 10.5, 12.0, 14.0].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`emi-preset-pill ${rate === r ? "active" : ""}`}
                      onClick={() => setRate(r)}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 4: Loan Tenure */}
              <div className="emi-field-group">
                <div className="emi-field-label-row">
                  <label className="form-label" htmlFor="term">Loan Tenure</label>
                  <span className="emi-field-label-value">
                    {term} {termUnit}
                  </span>
                </div>
                <div className="emi-control-row">
                  <input
                    id="termRange"
                    type="range"
                    min="1"
                    max={termUnit === "years" ? 30 : 360}
                    step="1"
                    value={term}
                    onChange={(e) => setTerm(Number(e.target.value))}
                    className="emi-slider"
                  />
                  <input
                    id="term"
                    type="number"
                    className="form-control emi-number-input"
                    value={term}
                    step="1"
                    onChange={(e) => setTerm(Number(e.target.value))}
                  />
                  <select
                    id="monthsOrYears"
                    className="form-select"
                    style={{ width: "110px" }}
                    value={termUnit}
                    onChange={(e) => {
                      const unit = e.target.value as "months" | "years"
                      setTermUnit(unit)
                      setTerm(unit === "years" ? 5 : 60)
                    }}
                  >
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
                <div className="emi-preset-pills">
                  {termUnit === "years"
                    ? [1, 2, 3, 4, 5, 7].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          className={`emi-preset-pill ${term === yr ? "active" : ""}`}
                          onClick={() => setTerm(yr)}
                        >
                          {yr} {yr === 1 ? "Year" : "Years"}
                        </button>
                      ))
                    : [12, 24, 36, 48, 60, 84].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`emi-preset-pill ${term === m ? "active" : ""}`}
                          onClick={() => setTerm(m)}
                        >
                          {m} Mos
                        </button>
                      ))}
                </div>
              </div>

              {/* Field 5: Processing Fee */}
              <div className="emi-field-group">
                <div className="emi-field-label-row">
                  <label className="form-label" htmlFor="fee">Processing Fee (%)</label>
                  <span className="emi-field-label-value">{fee}%</span>
                </div>
                <div className="emi-control-row">
                  <input
                    id="feeRange"
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={fee}
                    onChange={(e) => setFee(Number(e.target.value))}
                    className="emi-slider"
                  />
                  <input
                    id="fee"
                    type="number"
                    className="form-control emi-number-input"
                    value={fee}
                    step="0.1"
                    onChange={(e) => setFee(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Results Dashboard (Right) */}
            <div className="emi-results-column">
              {/* Prominent Monthly EMI Hero Banner */}
              <div className="card emi-hero-card">
                <div>
                  <div className="emi-hero-label">Estimated Monthly EMI</div>
                  <div className="emi-hero-amount">₹{formatMoney(emi, 2)}</div>
                </div>
                <div className="metric-card-icon" style={{ width: 48, height: 48, fontSize: "1.5rem" }}>
                  <i className="bi bi-wallet-fill" />
                </div>
              </div>

              {/* Summary Cards Grid */}
              <div className="emi-kpi-grid">
                <div className="card emi-kpi-card">
                  <div className="emi-kpi-label">Principal Amount</div>
                  <div className="emi-kpi-value">₹{formatWholeMoney(principal)}</div>
                </div>
                <div className="card emi-kpi-card">
                  <div className="emi-kpi-label">Total Interest</div>
                  <div className="emi-kpi-value" style={{ color: "var(--purple)" }}>
                    ₹{formatMoney(totalInterest, 2)}
                  </div>
                </div>
                <div className="card emi-kpi-card">
                  <div className="emi-kpi-label">Total Payable</div>
                  <div className="emi-kpi-value" style={{ color: "var(--success)" }}>
                    ₹{formatMoney(totalPayment, 2)}
                  </div>
                </div>
              </div>

              {/* Payment Ratio Visual Breakdown Bar */}
              <div className="card emi-breakdown-card">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", fontWeight: 600 }}>
                  <span>Payment Distribution Ratio</span>
                  <span style={{ color: "var(--ink-soft)", fontWeight: 500, fontSize: "0.75rem" }}>
                    Principal: {principalRatio.toFixed(1)}% | Interest: {interestRatio.toFixed(1)}%
                  </span>
                </div>
                <div className="emi-bar-container">
                  <div className="emi-bar-principal" style={{ width: `${principalRatio}%` }} />
                  <div className="emi-bar-interest" style={{ width: `${interestRatio}%` }} />
                </div>
                <div className="emi-legend-row">
                  <div className="emi-legend-item">
                    <span className="emi-legend-dot" style={{ background: "var(--accent)" }} />
                    <span>Principal Loan (₹{formatWholeMoney(principal)})</span>
                  </div>
                  <div className="emi-legend-item">
                    <span className="emi-legend-dot" style={{ background: "var(--purple)" }} />
                    <span>Total Interest (₹{formatMoney(totalInterest, 2)})</span>
                  </div>
                </div>
              </div>

              {/* Actions Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                  Upfront Processing Fee: <strong>₹{formatWholeMoney(processingFee)}</strong>
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary btn-sm" type="button" onClick={saveCalculation} disabled={saving}>
                    {saving ? "Saving..." : <><i className="bi bi-bookmark-check" /> Save Calculation</>}
                  </button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={printSchedule}>
                    <i className="bi bi-printer" /> Print Schedule
                  </button>
                </div>
              </div>

              {/* Amortization Schedule Table */}
              <div className="card emi-schedule-card">
                <div className="emi-schedule-header">
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--ink)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <i className="bi bi-calendar3" style={{ color: "var(--accent)" }} />
                    Amortization Schedule ({schedule.length} Months)
                  </div>
                </div>
                <div className="table-wrapper" style={{ maxHeight: "360px" }}>
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th style={{ width: "65px" }}>Month</th>
                        <th>EMI (₹)</th>
                        <th>Principal (₹)</th>
                        <th>Interest (₹)</th>
                        <th>Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody id="scheduleBody">
                      {schedule.map((row) => (
                        <tr key={row.month}>
                          <td style={{ fontWeight: 600, color: "var(--accent)" }}>#{row.month}</td>
                          <td>₹{formatMoney(row.emi, 2)}</td>
                          <td style={{ color: "var(--success)" }}>₹{formatMoney(row.principal, 2)}</td>
                          <td style={{ color: "var(--purple)" }}>₹{formatMoney(row.interest, 2)}</td>
                          <td style={{ fontWeight: 600 }}>₹{formatMoney(row.balance, 2)}</td>
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
  )
}
