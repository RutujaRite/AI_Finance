/**
 * Admin page — Company Data & Employer Directory Management.
 * Uses: /api/auth/verify, /api/bank/files, /api/bank/files/[id], /api/bank/files/[id]/download
 * Admin-only: upload company categorization lists (CSV/Excel), download company lists,
 * delete company lists with cascaded record removal, and monitor database company stats.
 * CallNow CRM Design System compliant
 */

"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Topbar from "../../components/Topbar"

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [files, setFiles] = useState<any[]>([])
  const [totalCompanyRecords, setTotalCompanyRecords] = useState<number>(0)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedModel, setSelectedModel] = useState("liquid/lfm-2.5-embedding-350m:free")

  // Search filter states
  const [fileSearch, setFileSearch] = useState("")

  useEffect(() => {
    checkAuth()
    loadFiles()
  }, [])

  async function checkAuth() {
    const res = await fetch("/api/auth/verify")
    if (!res.ok) {
      router.replace("/?auth=login&from=/admin")
      return
    }
    const data = await res.json()
    if (data.success) {
      const isAdminUser =
        String(data.user?.role || "").trim().toLowerCase() === "admin" ||
        data.user?.is_admin === true ||
        String(data.user?.email || "").toLowerCase() === "admin@gmail.com" ||
        String(data.user?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
        String(data.user?.email || "").toLowerCase().startsWith("admin")

      if (!isAdminUser) {
        router.replace("/home?section=assistant")
        return
      }
      setUser(data.user)
    }
  }

  async function loadFiles() {
    try {
      const res = await fetch("/api/bank/files")
      const data = await res.json()
      setFiles(data.files || [])
      if (typeof data.totalCompanyRecords === "number") {
        setTotalCompanyRecords(data.totalCompanyRecords)
      } else {
        const count = (data.files || []).reduce((sum: number, f: any) => sum + (Number(f.record_count) || 0), 0)
        setTotalCompanyRecords(count)
      }
    } catch (e) {
      console.error("Failed to load company files", e)
    }
  }

  async function uploadSelectedFile(file: File) {
    if (!file) return

    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()

    // STRICT CHECK: Reject policy files
    if ([".pdf", ".docx", ".doc", ".txt", ".rtf", ".odt"].includes(ext)) {
      setMessage("Policy documents are not accepted in Company Data. Please upload bank policy documents in the Bank Policy section (/policies).")
      return
    }

    if (![".csv", ".xlsx", ".xls"].includes(ext)) {
      setMessage("Please select a valid Company Data spreadsheet (.csv, .xlsx, .xls)")
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setMessage("File size must be less than 50 MB")
      return
    }

    setUploading(true)
    setMessage("")
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/bank/files", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message || "File uploaded and company records ingested successfully!")
        loadFiles()
      } else {
        setMessage("Upload failed: " + (data.error || "Unknown error"))
      }
    } catch (err: any) {
      setMessage("Upload failed: " + (err?.message || "Network error"))
    } finally {
      setUploading(false)
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadSelectedFile(file)
    // reset input so selecting the same file triggers change
    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadSelectedFile(file)
  }

  async function deleteFile(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis will remove the file and all associated company categorization records from the database.`)) {
      return
    }

    try {
      const res = await fetch(`/api/bank/files/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message || "File deleted successfully")
        loadFiles()
      } else {
        setMessage("Delete failed: " + (data.error || "Unknown error"))
      }
    } catch (err) {
      setMessage("Delete failed")
    }
  }

  function formatSize(bytes?: number | string) {
    const num = Number(bytes) || 0
    if (num <= 0) return "0 KB"
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(num) / Math.log(1024))
    return Math.round((num / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return "Unknown date"
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  const filteredFiles = files.filter(f => 
    String(f.file_name || "").toLowerCase().includes(fileSearch.toLowerCase().trim())
  )

  if (!user) {
    return (
      <main style={{ padding: 48, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", gap: 12 }}>
        <div className="spinner-border text-primary" style={{ width: 36, height: 36 }} role="status"></div>
        <p style={{ color: "var(--bs-secondary-color)", fontWeight: 500 }}>Verifying admin authorization...</p>
      </main>
    )
  }

  return (
    <div className="home-body admin-fullpage-layout" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", width: "100%" }}>
      <Topbar
        user={user}
        pathname="/admin"
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />

      <main
        className="admin-workspace-fullwidth animate-fade-in"
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "100%",
          padding: "28px 36px 64px 36px",
          boxSizing: "border-box",
        }}
      >
        {/* Page Header */}
        <div className="page-header" style={{ marginBottom: "28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h1 className="page-title" style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
                <i className="bi bi-building-gear" style={{ color: "var(--accent)" }} />
                Company Data &amp; Employer Directory
              </h1>
              <span className="badge badge-primary">Admin Only</span>
            </div>
            <p className="page-subtitle" style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.875rem" }}>
              Upload and manage corporate company categorization records (CSV/Excel) across partner banks
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => router.push("/policies")}
              title="Manage Bank Policies"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <i className="bi bi-file-earmark-ruled" /> Bank Policies
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => router.push("/home?section=assistant")}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <i className="bi bi-arrow-left" /> Back to AI Copilot
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => router.push("/admin/models")}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontWeight: 600 }}
            >
              <i className="bi bi-cpu" /> AI Models
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                loadFiles()
              }}
              title="Refresh data"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--color-primary-blue)" }}>
              <i className="bi bi-folder2-open"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Company Files</span>
              <span className="stat-value">{files.length}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
              <i className="bi bi-buildings"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Ingested Companies</span>
              <span className="stat-value">
                {totalCompanyRecords > 0 ? totalCompanyRecords.toLocaleString() : "0"}
              </span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(34, 197, 94, 0.1)", color: "var(--bs-success)" }}>
              <i className="bi bi-hdd-network"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Storage</span>
              <span className="stat-value">{formatSize(files.reduce((sum, f) => sum + (Number(f.file_size) || 0), 0))}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--bs-warning)" }}>
              <i className="bi bi-clock-history"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Latest Activity</span>
              <span className="stat-value" style={{ fontSize: "1rem" }}>
                {files.length > 0 ? formatDate(files[0].uploaded_at) : "No uploads yet"}
              </span>
            </div>
          </div>
        </div>

        {/* Top Section: Upload Card + File Repository Table */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 390px) 1fr", gap: "24px", alignItems: "start", marginBottom: "32px" }}>
          {/* Upload Form Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <i className="bi bi-file-earmark-spreadsheet" style={{ color: "var(--accent)" }}></i>
                Upload Company Data
              </h2>
            </div>
            <div className="card-body">
              <label className="form-label">Supported Spreadsheets (.csv, .xlsx, .xls)</label>
              <div 
                className="drop-zone"
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: isDragOver ? "2px dashed var(--accent)" : "2px dashed var(--bs-border-color)",
                  background: isDragOver ? "rgba(94, 106, 210, 0.08)" : "var(--bs-tertiary-bg)",
                  borderRadius: "var(--border-radius-md)",
                  padding: "32px 20px",
                  textAlign: "center",
                  transition: "var(--transition-fast)",
                  cursor: "pointer",
                }}
                onClick={() => document.getElementById("adminFileInput")?.click()}
              >
                <div style={{ fontSize: "2.5rem", color: "var(--accent)", marginBottom: "8px" }}>
                  <i className="bi bi-file-earmark-spreadsheet-fill"></i>
                </div>
                <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--bs-heading-color)", margin: "0 0 4px 0" }}>
                  Drag &amp; Drop CSV or Excel File
                </h4>
                <p style={{ fontSize: "0.82rem", color: "var(--bs-secondary-color)", margin: "0 0 16px 0" }}>
                  Columns: Company Name, Category, Bank Name (Max: 50 MB)
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: "auto" }}
                >
                  <i className="bi bi-folder2-open"></i>
                  Browse Company Files
                </button>
                <input
                  type="file"
                  id="adminFileInput"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </div>

              {/* Helpful Policy Redirection Notice */}
              <div style={{
                marginTop: "12px",
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
                fontSize: "0.82rem",
                color: "var(--bs-body-color)",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px"
              }}>
                <i className="bi bi-info-circle-fill" style={{ color: "var(--accent)", marginTop: "2px", flexShrink: 0 }} />
                <span>
                  <strong>Looking for Bank Policy guidelines?</strong> Policy documents (PDF/TXT) belong in{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/policies")}
                    style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}
                  >
                    Bank Policy
                  </button>
                  . This section is strictly for company categorization lists.
                </span>
              </div>

              {uploading && (
                <div style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "var(--border-radius-sm)", background: "rgba(94, 106, 210, 0.1)", color: "var(--accent)", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  Processing and ingesting company records into database...
                </div>
              )}

              {message && (
                <div 
                  className={`alert ${message.toLowerCase().includes("success") ? "alert-success" : "alert-danger"}`}
                  style={{ marginTop: "14px", padding: "10px 14px", fontSize: "0.875rem" }}
                >
                  <i className={`bi ${message.toLowerCase().includes("success") ? "bi-check-circle" : "bi-exclamation-triangle"}`}></i>
                  <span>{message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Uploaded Documents List Card */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  <i className="bi bi-building-check" style={{ color: "var(--bs-success)" }}></i>
                  Uploaded Company Lists
                </h2>
                <span className="badge badge-neutral">
                  {filteredFiles.length} {filteredFiles.length === 1 ? "File" : "Files"}
                </span>
              </div>

              {/* Search Filter */}
              <div style={{ position: "relative", minWidth: "220px" }}>
                <i className="bi bi-search" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--bs-secondary-color)", fontSize: "0.85rem" }}></i>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search company files..."
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  style={{ paddingLeft: "34px", fontSize: "0.85rem" }}
                />
              </div>
            </div>

            <div className="table-wrapper">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th style={{ width: "45px", textAlign: "center" }}>#</th>
                    <th>File Details</th>
                    <th style={{ width: "100px" }}>Format</th>
                    <th style={{ width: "130px" }}>Records</th>
                    <th style={{ width: "100px" }}>Size</th>
                    <th style={{ width: "150px" }}>Uploaded</th>
                    <th style={{ width: "170px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "48px 20px", textAlign: "center" }}>
                        <div style={{ color: "var(--bs-secondary-color)" }}>
                          <i className="bi bi-folder-x" style={{ fontSize: "2.4rem", opacity: 0.5, display: "block", marginBottom: "8px" }}></i>
                          <p style={{ margin: "0 0 4px 0", fontWeight: 600, color: "var(--bs-heading-color)" }}>No company files match search query</p>
                          <small>Try searching with another keyword or drag a new company CSV/Excel file</small>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFiles.map((file, idx) => {
                      const isCsv = file.file_name.toLowerCase().endsWith(".csv")
                      const isExcel = file.file_name.toLowerCase().endsWith(".xlsx") || file.file_name.toLowerCase().endsWith(".xls")
                      const recordCount = Number(file.record_count) || 0

                      return (
                        <tr key={file.id}>
                          <td style={{ textAlign: "center", color: "var(--bs-secondary-color)", fontWeight: 500 }}>{idx + 1}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <i className={`bi ${isCsv ? "bi-filetype-csv" : isExcel ? "bi-filetype-xlsx" : "bi-file-earmark-spreadsheet"}`} style={{ fontSize: "1.3rem", color: "var(--bs-success)" }}></i>
                              <div>
                                <span style={{ fontWeight: 600, color: "var(--bs-heading-color)", display: "block" }} title={file.file_name}>
                                  {file.file_name}
                                </span>
                                {file.uploaded_by_name && (
                                  <small style={{ color: "var(--bs-secondary-color)", fontSize: "0.75rem" }}>
                                    by {file.uploaded_by_name}
                                  </small>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${isCsv ? "badge-success" : isExcel ? "badge-primary" : "badge-neutral"}`}>
                              {isCsv ? "CSV DATA" : isExcel ? "EXCEL" : "DATA"}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: recordCount > 0 ? "var(--bs-heading-color)" : "var(--bs-secondary-color)", fontSize: "0.85rem" }}>
                              {recordCount > 0 ? `${recordCount.toLocaleString()} cos.` : "—"}
                            </span>
                          </td>
                          <td style={{ color: "var(--bs-body-color)", fontSize: "0.85rem" }}>{formatSize(file.file_size)}</td>
                          <td style={{ color: "var(--bs-secondary-color)", fontSize: "0.82rem" }}>{formatDate(file.uploaded_at)}</td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <a 
                                href={`/api/bank/files/${file.id}/download`} 
                                download={file.file_name}
                                className="btn btn-outline-secondary" 
                                title="Download Company Data" 
                                style={{ padding: "4px 10px", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              >
                                <i className="bi bi-download"></i>
                                Download
                              </a>
                              <button 
                                type="button"
                                className="btn btn-outline-danger" 
                                title="Delete Company Data" 
                                onClick={() => deleteFile(file.id, file.file_name)}
                                style={{ padding: "4px 10px", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              >
                                <i className="bi bi-trash"></i>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
