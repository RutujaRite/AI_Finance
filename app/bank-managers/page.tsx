/**
 * Bank Manager Files Management Page
 * Allows users to upload bank manager spreadsheet files (Excel/CSV)
 * and view, download, or delete uploaded files.
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function BankManagerFilesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [bankName, setBankName] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [files, setFiles] = useState<any[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(true)

  useEffect(() => {
    checkAuth()
    fetchFiles()
  }, [])

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/verify")
      if (res.ok) {
        const data = await res.json()
        if (data.success) setUser(data.user)
      } else {
        router.replace("/login")
      }
    } catch (e) {
      router.replace("/login")
    }
  }

  async function fetchFiles() {
    setIsLoadingFiles(true)
    try {
      const res = await fetch("/api/bank-managers/files")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.files)) {
          setFiles(data.files)
        }
      }
    } catch (e) {
      console.error("Error fetching files", e)
    } finally {
      setIsLoadingFiles(false)
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankName.trim()) {
      setUploadMsg({ type: "error", text: "Please enter the Bank Name." })
      return
    }
    if (!selectedFile) {
      setUploadMsg({ type: "error", text: "Please select an Excel (.xlsx, .xls) or CSV (.csv) file." })
      return
    }

    setIsUploading(true)
    setUploadMsg(null)

    try {
      const formData = new FormData()
      formData.append("bank_name", bankName.trim())
      formData.append("file", selectedFile)

      const res = await fetch("/api/bank-managers/files", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (data.success) {
        setUploadMsg({ type: "success", text: `File "${selectedFile.name}" uploaded successfully!` })
        setBankName("")
        setSelectedFile(null)
        // Reset file input element
        const fileInput = document.getElementById("bankFileInput") as HTMLInputElement
        if (fileInput) fileInput.value = ""
        fetchFiles()
      } else {
        setUploadMsg({ type: "error", text: data.error || "File upload failed." })
      }
    } catch (err) {
      setUploadMsg({ type: "error", text: "Error uploading file." })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteFile = async (id: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return
    try {
      const res = await fetch(`/api/bank-managers/files?id=${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        fetchFiles()
      } else {
        alert(data.error || "Delete failed.")
      }
    } catch (e) {
      alert("Error deleting file.")
    }
  }

  function formatFileSize(bytes: number) {
    if (!bytes || bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (!user) return <main style={{ padding: 24, textAlign: "center" }}>Loading...</main>

  return (
    <main className="home-body">
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
          <a href="/bank-managers" className="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a2 2 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Bank Manager Files
          </a>
          <a href="/policies" className="nav-item">
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

      {/* Main Page Body */}
      <main className="bm-page animate-fade-in" style={{ maxWidth: 1040 }}>
        {/* Title Header */}
        <div className="bm-header">
          <div>
            <h2 className="bm-title">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#bmFileGradient)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="bmFileGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a5b4fc" />
                  </linearGradient>
                </defs>
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Bank Manager Files
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: 4 }}>
              Upload Excel/CSV spreadsheet files containing bank manager contacts and location details.
            </p>
          </div>
        </div>

        {/* Section 1: File Upload Form Card */}
        <div className="glass-card" style={{ padding: 32, marginBottom: 32 }}>
          <h3 className="card-title" style={{ fontSize: "1.2rem", color: "#fff", marginBottom: 20 }}>
            📁 Upload Bank Manager Spreadsheet File
          </h3>

          {uploadMsg && (
            <div
              className={uploadMsg.type === "success" ? "badge-tag success" : "alert-error"}
              style={{ width: "100%", padding: 12, marginBottom: 20, fontSize: "0.9rem" }}
            >
              {uploadMsg.type === "success" ? `✓ ${uploadMsg.text}` : `⚠️ ${uploadMsg.text}`}
            </div>
          )}

          <form onSubmit={handleUploadSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="field-label">Bank Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank, Axis Bank..."
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={isUploading}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="field-label">Spreadsheet File (.xlsx, .xls, .csv) *</label>
              <input
                id="bankFileInput"
                type="file"
                className="form-input"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={isUploading}
                required
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 6, display: "block" }}>
                Accepted formats: Microsoft Excel (.xlsx, .xls) or Comma Separated Values (.csv). Max file size: 50MB.
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-gradient"
              style={{ width: "100%", padding: 14, fontSize: "1rem", marginTop: 8 }}
              disabled={isUploading || !bankName.trim() || !selectedFile}
            >
              {isUploading ? "Uploading & Processing..." : "Upload File"}
            </button>
          </form>
        </div>

        {/* Section 2: Uploaded Files Directory List */}
        <div className="glass-card" style={{ padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 className="card-title" style={{ fontSize: "1.2rem", color: "#fff", margin: 0, border: "none" }}>
              📋 Uploaded Manager Files Directory
            </h3>
            <span className="badge-tag">{files.length} Files</span>
          </div>

          {isLoadingFiles ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
              Loading uploaded files...
            </div>
          ) : files.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {files.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    padding: "16px 20px",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--radius-md)",
                        background: "rgba(99, 102, 241, 0.15)",
                        border: "1px solid var(--border-highlight)",
                        color: "#a5b4fc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.2rem",
                        flexShrink: 0,
                      }}
                    >
                      📄
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: "1rem" }}>{file.file_name}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
                        Bank: <strong style={{ color: "#a5b4fc" }}>{file.bank_name}</strong> | Size: {formatFileSize(file.file_size)} | Uploaded: {new Date(file.uploaded_at).toLocaleDateString()} {file.uploaded_by_name ? `by ${file.uploaded_by_name}` : ""}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {file.file_path && (
                      <a
                        href={file.file_path}
                        download
                        className="btn btn-secondary"
                        style={{ padding: "8px 14px", fontSize: "0.8rem", textDecoration: "none" }}
                      >
                        ⬇ Download
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(file.id, file.file_name)}
                      style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                        color: "#fca5a5",
                        padding: "8px 14px",
                        borderRadius: "var(--radius-md)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📁</div>
              <h4 style={{ color: "#fff", fontSize: "1.1rem", marginBottom: 6 }}>No Files Uploaded Yet</h4>
              <p style={{ fontSize: "0.85rem" }}>
                Use the upload form above to attach an Excel or CSV file containing bank manager details.
              </p>
            </div>
          )}
        </div>
      </main>
    </main>
  )
}
