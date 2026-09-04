/**
 * Modern CreditWise AI Policies Page
 * Displays bank policy rules, categories, status, and bank policy documents.
 */

"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"

export default function PoliciesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [policies, setPolicies] = useState<any[]>([])
  const [policyFiles, setPolicyFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [activeTab, setActiveTab] = useState<"rules" | "files">("rules")
  
  // Replace File State
  const [replacingFileId, setReplacingFileId] = useState<number | null>(null)
  const [replaceMessage, setReplaceMessage] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Filters
  const [searchBank, setSearchBank] = useState("")
  const [filterLoanType, setFilterLoanType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchFileQuery, setSearchFileQuery] = useState("")

  // Viewer Modal State
  const [activeViewerFile, setActiveViewerFile] = useState<any | null>(null)
  const [loadingFileContent, setLoadingFileContent] = useState(false)
  const [modalSearch, setModalSearch] = useState("")
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    checkAuth()
    loadPolicies()
    loadPolicyFiles()
  }, [])

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/verify")
      if (!res.ok) {
        router.replace("/login")
        return
      }
      const data = await res.json()
      if (data.success) setUser(data.user)
    } catch (e) {
      router.replace("/login")
    }
  }

  async function loadPolicies() {
    setLoading(true)
    try {
      const res = await fetch("/api/policies")
      const data = await res.json()
      setPolicies(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("Failed to load policies", e)
      setPolicies([])
    } finally {
      setLoading(false)
    }
  }

  async function loadPolicyFiles() {
    setLoadingFiles(true)
    try {
      const res = await fetch("/api/policies/extracted-files")
      const data = await res.json()
      if (data.success) {
        setPolicyFiles(data.files || [])
      }
    } catch (e) {
      console.error("Failed to load policy files", e)
      setPolicyFiles([])
    } finally {
      setLoadingFiles(false)
    }
  }

  async function handleOpenViewer(fileId: number, fallbackData?: any) {
    setLoadingFileContent(true)
    setModalSearch("")
    setCopySuccess(false)
    try {
      const res = await fetch(`/api/policies/extracted-files/${fileId}`)
      const data = await res.json()
      if (data.success && data.file) {
        setActiveViewerFile(data.file)
      } else if (fallbackData) {
        setActiveViewerFile(fallbackData)
      }
    } catch (e) {
      if (fallbackData) setActiveViewerFile(fallbackData)
    } finally {
      setLoadingFileContent(false)
    }
  }

  function triggerReplace(fileId: number) {
    setReplacingFileId(fileId)
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  async function handleFileReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !replacingFileId) return

    setReplaceMessage(`Replacing file with ${file.name}...`)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/policies/extracted-files/${replacingFileId}/replace`, {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (data.success) {
        setReplaceMessage(`✓ File replaced successfully with ${file.name}`)
        loadPolicyFiles()
      } else {
        setReplaceMessage(`✕ Failed to replace file: ${data.error}`)
      }
    } catch (err) {
      setReplaceMessage("✕ Failed to replace file")
    } finally {
      setReplacingFileId(null)
      if (e.target) e.target.value = ""
      setTimeout(() => setReplaceMessage(""), 4000)
    }
  }

  function handleCopyText() {
    if (!activeViewerFile?.extracted_text) return
    navigator.clipboard.writeText(activeViewerFile.extracted_text)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  function handleDownloadText(fileName: string, text: string) {
    const element = document.createElement("a")
    const file = new Blob([text], { type: "text/plain" })
    element.href = URL.createObjectURL(file)
    element.download = fileName || "policy-document.txt"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  // Filtered Policies calculation
  const filteredPolicies = policies.filter((pol) => {
    const bankName = (pol.bank_name || pol.bank_code || "").toLowerCase()
    const matchesBank = bankName.includes(searchBank.toLowerCase().trim())
    const matchesType = filterLoanType === "all" || (pol.loan_type || "").toLowerCase() === filterLoanType.toLowerCase()
    const matchesStatus = filterStatus === "all" || (pol.status || "draft").toLowerCase() === filterStatus.toLowerCase()
    return matchesBank && matchesType && matchesStatus
  })

  // Filtered Policy Files
  const filteredPolicyFiles = policyFiles.filter((file) => {
    const q = searchFileQuery.toLowerCase().trim()
    if (!q) return true
    const bName = (file.bank_name || "").toLowerCase()
    const fName = (file.file_name || "").toLowerCase()
    const snippet = (file.snippet || "").toLowerCase()
    return bName.includes(q) || fName.includes(q) || snippet.includes(q)
  })

  if (!user) return <main style={{ padding: 24, textAlign: "center" }}>Loading policy workspace...</main>

  return (
    <main className="home-body">
      {/* Hidden File Input for Replace */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf,.csv,.docx,.doc"
        style={{ display: "none" }}
        onChange={handleFileReplace}
      />

      {/* App Topbar */}
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
          <a href="/emi" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
            EMI Calculator
          </a>
          <a href="/admin" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Admin
          </a>
          <a href="/bank-managers" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a2 2 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Bank Manager
          </a>
          <a href="/policies" className="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Policies
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

      {/* Main Page Layout */}
      <main className="policies-page animate-fade-in">
        {/* Replace Toast Notification */}
        {replaceMessage && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 20px",
              borderRadius: "var(--radius-md)",
              background: replaceMessage.includes("✓") ? "rgba(34, 197, 94, 0.15)" : "rgba(99, 102, 241, 0.15)",
              border: `1px solid ${replaceMessage.includes("✓") ? "rgba(34, 197, 94, 0.4)" : "rgba(99, 102, 241, 0.4)"}`,
              color: replaceMessage.includes("✓") ? "#4ade80" : "#a5b4fc",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            {replaceMessage}
          </div>
        )}

        {/* Header */}
        <div className="policies-header">
          <div>
            <h2 className="policies-title">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#polGradient)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="polGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a5b4fc" />
                  </linearGradient>
                </defs>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Bank Policy Guidelines & Documents
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: 4 }}>
              View, download, or replace bank policy documents and underwriting rules.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="badge-tag success">{policies.length} Policy Rules</span>
            <span className="badge-tag warning" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", borderColor: "rgba(99, 102, 241, 0.4)" }}>
              {policyFiles.length} Policy Documents
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button
            type="button"
            className={`btn ${activeTab === "rules" ? "btn-gradient" : "btn-secondary"}`}
            style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => setActiveTab("rules")}
          >
            📋 Underwriting Policy Rules ({policies.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "files" ? "btn-gradient" : "btn-secondary"}`}
            style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => setActiveTab("files")}
          >
            📄 Bank Policy Documents ({policyFiles.length})
          </button>
        </div>

        {activeTab === "rules" ? (
          <>
            {/* Filter Card */}
            <div className="policy-filter-card">
              <div className="policy-filter-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>Search Bank</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ICICI, HDFC, SBI..."
                    value={searchBank}
                    onChange={(e) => setSearchBank(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>Loan Type</label>
                  <select
                    className="form-input"
                    value={filterLoanType}
                    onChange={(e) => setFilterLoanType(e.target.value)}
                  >
                    <option value="all">All Loan Types</option>
                    <option value="Personal Loan">Personal Loan</option>
                    <option value="Home Loan">Home Loan</option>
                    <option value="Auto Loan">Auto Loan</option>
                    <option value="Business Loan">Business Loan</option>
                    <option value="Education Loan">Education Loan</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>Policy Status</label>
                  <select
                    className="form-input"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="review">In Review</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>

                <button
                  className="btn btn-gradient"
                  style={{ height: 42, padding: "0 16px" }}
                  onClick={loadPolicies}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Refresh List"}
                </button>
              </div>
            </div>

            {/* TABLE VIEW ONLY */}
            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                Loading policy rules and database records...
              </div>
            ) : filteredPolicies.length === 0 ? (
              <div className="glass-card" style={{ padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>📋</div>
                <h3 style={{ color: "#fff", marginBottom: 6 }}>No Matching Policies Found</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Try adjusting your search criteria or bank name filter.
                </p>
              </div>
            ) : (
              <div className="policy-table-container">
                <table className="policy-table">
                  <thead>
                    <tr>
                      <th>Bank Name</th>
                      <th>Loan Category</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPolicies.map((policy: any, idx: number) => {
                      const status = (policy.status || "active").toLowerCase()
                      return (
                        <tr key={policy.id || idx}>
                          <td style={{ fontWeight: 700, color: "#fff" }}>{policy.bank_name || policy.bank_code || "Partner Bank"}</td>
                          <td style={{ color: "#a5b4fc" }}>{policy.loan_type || "General Policy"}</td>
                          <td>
                            <span className={`status-pill ${status}`}>
                              ● {status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {policy.attachment_extracted_text ? (
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: "6px 14px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                                onClick={() => setActiveViewerFile({
                                  file_name: policy.attachment_file_name || `${policy.bank_name}_Policy.txt`,
                                  bank_name: policy.bank_name,
                                  extracted_text: policy.attachment_extracted_text,
                                })}
                              >
                                👁 View
                              </button>
                            ) : policy.attachment_file_path ? (
                              <div style={{ display: "inline-flex", gap: 8 }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                                  onClick={() => window.open(policy.attachment_file_path, "_blank")}
                                >
                                  👁 View
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>No document attached</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* POLICY DOCUMENTS TAB */
          <>
            <div className="policy-filter-card">
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by Bank Name or File Name (e.g., HDFC, ICICI, Master_Policy)..."
                    value={searchFileQuery}
                    onChange={(e) => setSearchFileQuery(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-gradient"
                  style={{ height: 42, padding: "0 20px" }}
                  onClick={loadPolicyFiles}
                  disabled={loadingFiles}
                >
                  {loadingFiles ? "Loading..." : "Refresh Files"}
                </button>
              </div>
            </div>

            {loadingFiles ? (
              <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                Fetching bank policy documents...
              </div>
            ) : filteredPolicyFiles.length === 0 ? (
              <div className="glass-card" style={{ padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>📄</div>
                <h3 style={{ color: "#fff", marginBottom: 6 }}>No Policy Documents Found</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Try searching for another bank name.
                </p>
              </div>
            ) : (
              <div className="policy-table-container">
                <table className="policy-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Bank Name</th>
                      <th>File Name</th>
                      <th style={{ width: 140 }}>Size</th>
                      <th style={{ width: 280, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPolicyFiles.map((file: any, idx: number) => {
                      const kbSize = file.text_length ? (file.text_length / 1024).toFixed(1) + " KB" : "0 KB"
                      return (
                        <tr key={file.id}>
                          <td style={{ color: "var(--text-muted)", fontWeight: 700 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 700, color: "#fff" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: "1.2rem" }}>🏦</span>
                              <span>{file.bank_name}</span>
                            </div>
                          </td>
                          <td style={{ color: "#a5b4fc", fontFamily: "monospace", fontSize: "0.9rem" }}>
                            {file.file_name}
                          </td>
                          <td>
                            <span className="badge-tag warning">{kbSize}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 8 }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: "6px 14px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                                onClick={() => handleOpenViewer(file.id, file)}
                              >
                                👁 View
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                onClick={async () => {
                                  const res = await fetch(`/api/policies/extracted-files/${file.id}`)
                                  const data = await res.json()
                                  if (data.success && data.file?.extracted_text) {
                                    handleDownloadText(file.file_name, data.file.extracted_text)
                                  }
                                }}
                              >
                                ⬇ Download
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: "6px 12px", fontSize: "0.8rem", border: "1px solid rgba(245, 158, 11, 0.4)", color: "#fbbf24" }}
                                onClick={() => triggerReplace(file.id)}
                              >
                                🔄 Replace
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* POLICY DOCUMENT VIEWER MODAL */}
      {activeViewerFile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(12px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setActiveViewerFile(null)}
        >
          <div
            className="glass-card"
            style={{
              width: "100%",
              maxWidth: 960,
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid var(--border-highlight)",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(99, 102, 241, 0.08)",
              }}
            >
              <div>
                <h3 style={{ fontSize: "1.25rem", color: "#fff", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  📄 {activeViewerFile.file_name || "Policy Document"}
                </h3>
                <p style={{ color: "#a5b4fc", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                  Bank: <strong>{activeViewerFile.bank_name || "Partner Bank"}</strong>
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                  onClick={handleCopyText}
                >
                  {copySuccess ? "✓ Copied!" : "📋 Copy Text"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                  onClick={() => handleDownloadText(activeViewerFile.file_name, activeViewerFile.extracted_text || "")}
                >
                  ⬇ Download
                </button>
                <button
                  type="button"
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "none",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 32,
                    height: 32,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                  onClick={() => setActiveViewerFile(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Search Bar */}
            <div style={{ padding: "12px 24px", background: "rgba(0, 0, 0, 0.2)", borderBottom: "1px solid var(--border-color)" }}>
              <input
                type="text"
                className="form-input"
                placeholder="🔍 Search inside document..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                style={{ fontSize: "0.85rem", padding: "8px 14px" }}
              />
            </div>

            {/* Modal Document Reader */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 24,
                background: "#0b0f19",
                color: "#e2e8f0",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "0.875rem",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {loadingFileContent ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  Loading policy document content...
                </div>
              ) : !activeViewerFile.extracted_text ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  No document content available for this policy file.
                </div>
              ) : (
                activeViewerFile.extracted_text
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
