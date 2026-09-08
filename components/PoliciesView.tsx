/**
 * Modern CreditWise AI Policies Page
 * Displays bank policy rules, categories, status, and bank policy documents.
 */

"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Topbar from "./Topbar"

export default function PoliciesView({
  user: propUser,
  embedded = false,
}: {
  user?: any
  embedded?: boolean
}) {
  const router = useRouter()
  const [user, setUser] = useState<any>(propUser || null)
  const [policies, setPolicies] = useState<any[]>([])
  const [policyFiles, setPolicyFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [activeTab, setActiveTab] = useState<"rules" | "files">("rules")
  const [selectedModel, setSelectedModel] = useState("liquid/lfm-2.5-embedding-350m:free")
  
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
    if (propUser) {
      setUser(propUser)
    } else {
      checkAuth()
    }
    loadPolicies()
    loadPolicyFiles()
  }, [propUser])

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

  function highlightMatch(text: string, query: string) {
    if (!query || !query.trim()) return text
    try {
      const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(`(${escaped})`, "gi")
      const parts = text.split(regex)
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ background: "#f59e0b", color: "#000", padding: "1px 4px", borderRadius: 3, fontWeight: 700 }}>
            {part}
          </mark>
        ) : (
          part
        )
      )
    } catch {
      return text
    }
  }

  // Filtered Policies calculation
  const filteredPolicies = policies.filter((pol) => {
    const bankName = (pol.bank_name || pol.bank_code || "").toLowerCase()
    const matchesBank = bankName.includes(searchBank.toLowerCase().trim())
    const matchesType =
      filterLoanType === "all" ||
      (pol.loan_type || "").toLowerCase() === filterLoanType.toLowerCase() ||
      (pol.loan_type || "").toLowerCase().includes(filterLoanType.toLowerCase()) ||
      (Array.isArray(pol.supported_loan_types) &&
        pol.supported_loan_types.some((t: string) =>
          t.toLowerCase().includes(filterLoanType.toLowerCase())
        ))
    const matchesStatus =
      filterStatus === "all" ||
      (pol.status || "active").toLowerCase() === filterStatus.toLowerCase()
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
    <>
      {!embedded && <Topbar user={user} />}
      {/* Hidden File Input for Replace */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf,.csv,.docx,.doc"
        style={{ display: "none" }}
        onChange={handleFileReplace}
      />

      <div
        className="policies-page animate-fade-in"
        style={embedded ? { flex: 1, overflowY: "auto", height: "calc(100vh - 64px)", width: "100%", padding: "24px 32px" } : undefined}
      >
        {/* Replace Toast Notification */}
        {replaceMessage && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 20px",
              borderRadius: "var(--radius-md)",
              background: replaceMessage.includes("✓") ? "rgba(34, 197, 94, 0.15)" : "rgba(16, 163, 127, 0.15)",
              border: `1px solid ${replaceMessage.includes("✓") ? "rgba(34, 197, 94, 0.4)" : "rgba(16, 163, 127, 0.4)"}`,
              color: replaceMessage.includes("✓") ? "#4ade80" : "#6ee7b7",
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
                   <stop offset="0%" stopColor="#10a37f" />
                   <stop offset="100%" stopColor="#34d399" />
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
            <span className="badge-tag success">{policies.length} Banks</span>
            <span className="badge-tag warning" style={{ background: "rgba(16, 163, 127, 0.15)", color: "#6ee7b7", borderColor: "rgba(16, 163, 127, 0.4)" }}>
              {policies.length} Master Policies
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
            📋 Bank Master Policies ({policies.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "files" ? "btn-gradient" : "btn-secondary"}`}
            style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => setActiveTab("files")}
          >
            📄 Policy Master Files ({policyFiles.length})
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
                          <td className="bank-name-cell" style={{ fontWeight: 700, color: "#0f172a" }}>
                            {policy.bank_name || policy.bank_code || "Partner Bank"}
                          </td>
                          <td style={{ color: "#10a37f", fontWeight: 600 }}>{policy.loan_type || "General Policy"}</td>
                          <td>
                            <span className={`status-pill ${status}`}>
                              ● {status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: "6px 14px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                              onClick={() => {
                                if (policy.attachment_extracted_text) {
                                  setActiveViewerFile({
                                    file_name: policy.attachment_file_name || policy.file_name || `${policy.bank_name}_Master_Policy.txt`,
                                    bank_name: policy.bank_name,
                                    extracted_text: policy.attachment_extracted_text,
                                  })
                                } else {
                                  handleOpenViewer(policy.attachment_id || policy.id, policy)
                                }
                              }}
                            >
                              👁 View
                            </button>
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
                          <td className="bank-name-cell" style={{ fontWeight: 700, color: "#0f172a" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: "1.2rem" }}>🏦</span>
                              <span className="bank-name-text" style={{ color: "#0f172a", fontWeight: 700 }}>
                                {file.bank_name}
                              </span>
                            </div>
                          </td>
                          <td style={{ color: "#10a37f", fontFamily: "monospace", fontSize: "0.9rem" }}>
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
      </div>

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
                <p style={{ color: "#10a37f", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
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
            <div style={{ padding: "12px 24px", background: "rgba(0, 0, 0, 0.2)", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="text"
                className="form-input"
                placeholder="🔍 Search inside master policy document..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                style={{ fontSize: "0.85rem", padding: "8px 14px", flex: 1 }}
              />
              {modalSearch && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                  onClick={() => setModalSearch("")}
                >
                  Clear
                </button>
              )}
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
                highlightMatch(activeViewerFile.extracted_text, modalSearch)
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
