/**
 * EMI Calculator page — loan amount, rate, term, processing fee inputs.
 * Uses: /api/auth/verify, /api/emi/save
 * Computes amortization schedule client-side and supports print/save.
 */

"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function EmiPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loanType, setLoanType] = useState("Personal")
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
    checkAuth()
  }, [])

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
      ["Loan Amount Disbursed", "₹" + formatMoney(data.principal)],
      ["Current Interest (%)", Number(data.annualRate).toFixed(2)],
      ["Moratorium Interest Capitalized", "NA"],
      ["Frequency", "Monthly"],
      ["Loan Type", data.loanType + " Loan"],
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

  function formatMoney(value: number) {
    return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })
  }

  if (!user) return <main style={{ padding: 24 }}>Loading...</main>

  return (
    <main className="home-body">
      <header className="topbar app-topbar">
        <a className="brand" href="/home">
          <span className="brand-mark">◆</span>
          <span className="brand-text">AI ASSISTANT</span>
        </a>
        <nav className="nav-menu" aria-label="Main navigation">
          <a href="/home" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </a>
          <a href="/emi" className="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
            EMI Calculator
          </a>
          <a href="/admin" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Admin
          </a>
          <div className="nav-item profile-menu" role="link" tabIndex={0} onClick={() => router.push("/profile")}>
            <span className="profile-menu-label">{user.name || user.email}</span>
            <span className="caret">▾</span>
            <div className="profile-dropdown">
              <a href="/profile">Profile</a>
              <a href="/logout">Logout</a>
            </div>
          </div>
        </nav>
      </header>

      <main className="emi-page">
        <div className="emi-header">
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="16" height="16" x="4" y="4" rx="2"/>
              <path d="M12 12h.01"/>
            </svg>
            EMI Calculator
          </h2>
        </div>

        <div className="emi-grid">
          <div className="form-card">
            <div className="form-card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0-2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Loan Details
            </div>

            <div className="field-group">
              <label className="field-label">Loan Type</label>
              <select id="loanType" className="form-input" value={loanType} onChange={(e) => setLoanType(e.target.value)}>
                <option>Personal</option>
                <option>Home</option>
                <option>Auto</option>
                <option>Education</option>
              </select>
            </div>

            <div className="field-group">
              <label className="field-label">Loan Amount (₹)</label>
              <div className="field-control">
                <input
                  id="loanAmountRange"
                  type="range"
                  min="10000"
                  max="10000000"
                  step="10000"
                  value={principal}
                  onChange={(e) => setPrincipal(Number(e.target.value))}
                />
                <input
                  id="loanAmount"
                  type="number"
                  className="form-input value-input"
                  value={principal}
                  min="10000"
                  step="10000"
                  onChange={(e) => setPrincipal(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Annual Interest Rate (%)</label>
              <div className="field-control">
                <input
                  id="rateRange"
                  type="range"
                  min="0"
                  max="25"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                />
                <input
                  id="rate"
                  type="number"
                  className="form-input value-input"
                  value={rate}
                  step="0.01"
                  onChange={(e) => setRate(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Processing Fee (%)</label>
              <div className="field-control">
                <input
                  id="feeRange"
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={fee}
                  onChange={(e) => setFee(Number(e.target.value))}
                />
                <input
                  id="fee"
                  type="number"
                  className="form-input value-input"
                  value={fee}
                  step="0.1"
                  onChange={(e) => setFee(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Loan Term</label>
              <div className="field-control">
                <input
                  id="termRange"
                  type="range"
                  min="1"
                  max="360"
                  step="1"
                  value={term}
                  onChange={(e) => setTerm(Number(e.target.value))}
                />
                <input
                  id="term"
                  type="number"
                  className="form-input value-input"
                  value={term}
                  step="1"
                  onChange={(e) => setTerm(Number(e.target.value))}
                />
                <select
                  id="monthsOrYears"
                  className="form-input"
                  style={{ width: "auto" }}
                  value={termUnit}
                  onChange={(e) => setTermUnit(e.target.value as any)}
                >
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          </div>

          <div className="result-card">
            <div className="summary-grid">
              <div className="summary-item">
                <div className="summary-label">MONTHLY EMI</div>
                <div className="summary-value">₹{formatMoney(emi)}</div>
              </div>
              <div className="summary-item">
                <div className="summary-label">TOTAL INTEREST</div>
                <div className="summary-value">₹{formatMoney(totalInterest)}</div>
              </div>
              <div className="summary-item">
                <div className="summary-label">TOTAL PAYMENT</div>
                <div className="summary-value">₹{formatMoney(totalPayment)}</div>
              </div>
            </div>

            <div className="actions-bar">
              <span className="fee-pill">
                Processing Fee: <strong>₹{formatMoney(processingFee)}</strong>
              </span>
              <div className="btn-group">
                <button className="btn btn-gradient" type="button" onClick={saveCalculation} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={printSchedule}>
                  Print Schedule
                </button>
              </div>
            </div>

            <div className="schedule-card">
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                Amortization Schedule
              </h3>
              <div className="schedule-table-wrap">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", width: "80px" }}>Month</th>
                      <th>EMI (₹)</th>
                      <th>Principal (₹)</th>
                      <th>Interest (₹)</th>
                      <th>Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody id="scheduleBody">
                    {schedule.map((row) => (
                      <tr key={row.month}>
                        <td style={{ textAlign: "left" }}>{row.month}</td>
                        <td>₹{formatMoney(row.emi)}</td>
                        <td>₹{formatMoney(row.principal)}</td>
                        <td>₹{formatMoney(row.interest)}</td>
                        <td>₹{formatMoney(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </main>
  )
}
