/**
 * Admin page — bank document management and user list.
 * Uses: /api/auth/verify, /api/bank/files, /api/admin/users
 * Admin-only: upload/download/delete PDFs/CSVs and manage all registered users.
 */

"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [files, setFiles] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)

  // Search filter states
  const [fileSearch, setFileSearch] = useState("")
  const [userSearch, setUserSearch] = useState("")

  useEffect(() => {
    checkAuth()
    loadFiles()
    loadUsers()
  }, [])

  async function checkAuth() {
    const res = await fetch("/api/auth/verify")
    if (!res.ok) {
      router.replace("/login")
      return
    }
    const data = await res.json()
    if (data.success) {
      if (data.user.role !== "admin") {
        router.replace("/home")
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
    } catch (e) {
      console.error("Failed to load files", e)
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin/users")
      const data = await res.json()
      setUsers(data.users || [])
    } catch (e) {
      console.error("Failed to load users", e)
    }
  }

  async function uploadSelectedFile(file: File) {
    if (!file) return

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Please select a valid PDF or CSV file")
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

      const res = await fetch("/api/bank/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        setMessage("File uploaded successfully!")
        loadFiles()
      } else {
        setMessage("Upload failed: " + (data.error || "Unknown error"))
      }
    } catch (err) {
      setMessage("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadSelectedFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadSelectedFile(file)
  }

  async function deleteFile(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return
    try {
      const res = await fetch(`/api/bank/files/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setMessage("File deleted successfully")
        loadFiles()
      } else {
        setMessage("Delete failed: " + (data.error || "Unknown error"))
      }
    } catch (err) {
      setMessage("Delete failed")
    }
  }

  function formatSize(bytes?: number) {
    if (!bytes) return "0 KB"
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return "Unknown date"
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  function getUserInitials(name?: string, email?: string) {
    const text = (name || email || "U").trim()
    const parts = text.split(" ")
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return text.slice(0, 2).toUpperCase()
  }

  const filteredFiles = files.filter(f => 
    String(f.file_name || "").toLowerCase().includes(fileSearch.toLowerCase().trim())
  )

  const filteredUsers = users.filter(u => 
    String(u.name || "").toLowerCase().includes(userSearch.toLowerCase().trim()) ||
    String(u.email || "").toLowerCase().includes(userSearch.toLowerCase().trim()) ||
    String(u.role || "").toLowerCase().includes(userSearch.toLowerCase().trim())
  )

  if (!user) return <main style={{ padding: 24, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>Loading Admin Workspace...</main>

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
          <a href="/emi" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
            EMI Calculator
          </a>
          <a href="/admin" className="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Admin Workspace
          </a>
          <a href="/bank-managers" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a2 2 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Bank Manager
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

      <main className="admin-page" style={{ padding: "24px 36px" }}>
        <div className="admin-header">
          <h2>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            Admin Workspace & Document Repository
          </h2>
          <span style={{ fontSize: "0.95rem", color: "#94a3b8" }}>Upload bank policy documents, inspect file assets, and manage registered system accounts</span>
        </div>

        {/* Overview Summary Metric Cards */}
        <div className="summary-grid" id="summaryGrid">
          <div className="summary-item">
            <div className="summary-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>📁</span> Total Uploaded Files
            </div>
            <div className="summary-value" style={{ color: "#60a5fa" }}>{files.length}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>💾</span> Total Storage Used
            </div>
            <div className="summary-value" style={{ color: "#34d399" }}>{formatSize(files.reduce((sum, f) => sum + (f.file_size || 0), 0))}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🕒</span> Latest Activity
            </div>
            <div className="summary-value" style={{ fontSize: "1.1rem", color: "#a5b4fc" }}>
              {files.length > 0 ? formatDate(files[0].uploaded_at) : "No uploads yet"}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>👥</span> Registered Accounts
            </div>
            <div className="summary-value" style={{ color: "#f472b6" }}>{users.length}</div>
          </div>
        </div>

        {/* Top Grid: Drag & Drop Upload + File Manager */}
        <div className="admin-grid">
          {/* Upload Form Card */}
          <div className="form-card" style={{ background: "rgba(17, 24, 39, 0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", padding: "24px" }}>
            <div className="form-card-title" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload Bank Document
            </div>
            <div className="field-group">
              <label className="field-label" style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "8px", display: "block" }}>Select Bank PDF or Policy CSV</label>
              <div 
                className="drop-zone"
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: isDragOver ? "2px dashed #6366f1" : "2px dashed rgba(99, 102, 241, 0.35)",
                  background: isDragOver ? "rgba(99, 102, 241, 0.12)" : "rgba(99, 102, 241, 0.03)",
                  borderRadius: "14px",
                  padding: "36px 20px",
                  textAlign: "center",
                  transition: "all 0.25s ease",
                  cursor: "pointer",
                }}
                onClick={() => document.getElementById("pdfInput")?.click()}
              >
                <div className="drop-zone-icon" style={{ fontSize: "3rem", marginBottom: "8px" }}>☁️</div>
                <h4 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#fff" }}>Drag & Drop PDF/CSV File</h4>
                <p style={{ fontSize: "0.82rem", color: "#9ca3af", margin: "4px 0 16px 0" }}>Maximum supported file size: 50 MB</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ display: "inline-flex", width: "auto", padding: "10px 20px", borderRadius: "8px", background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", fontWeight: 600, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)" }}
                >
                  📁 Browse Computer
                </button>
                <input
                  type="file"
                  id="pdfInput"
                  accept=".pdf,.csv,application/pdf,text/csv"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </div>

              {uploading && (
                <div className="upload-progress active" style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className="chat-typing-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#818cf8" }}></div>
                  Uploading file to system repository...
                </div>
              )}

              {message && (
                <div 
                  className="upload-progress" 
                  style={{
                    marginTop: "14px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    background: message.toLowerCase().includes("success") ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: message.toLowerCase().includes("success") ? "#34d399" : "#f87171",
                    border: message.toLowerCase().includes("success") ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  {message}
                </div>
              )}
            </div>
          </div>

          {/* Uploaded Documents List Card */}
          <div className="result-card" style={{ background: "rgba(17, 24, 39, 0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Uploaded Documents
                <span style={{ fontSize: "0.78rem", padding: "2px 10px", borderRadius: "999px", background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                  {filteredFiles.length} {filteredFiles.length === 1 ? "File" : "Files"}
                </span>
              </h3>

              {/* File Search Input */}
              <div style={{ position: "relative", minWidth: "220px" }}>
                <input
                  type="text"
                  placeholder="🔍 Search documents..."
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 34px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
                />
                <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", opacity: 0.6 }}>🔍</span>
              </div>
            </div>

            <div className="files-table-wrap" style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <table className="files-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "rgba(99, 102, 241, 0.12)", color: "#e2e8f0" }}>
                    <th style={{ padding: "12px 14px", width: "45px", textAlign: "center" }}>#</th>
                    <th style={{ padding: "12px 14px", textAlign: "left" }}>File Details</th>
                    <th style={{ padding: "12px 14px", width: "100px", textAlign: "left" }}>Format</th>
                    <th style={{ padding: "12px 14px", width: "110px", textAlign: "left" }}>Size</th>
                    <th style={{ padding: "12px 14px", width: "160px", textAlign: "left" }}>Uploaded At</th>
                    <th style={{ padding: "12px 14px", width: "160px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "32px", textAlign: "center" }}>
                        <div className="empty-state">
                          <div className="empty-state-icon" style={{ fontSize: "2.2rem", marginBottom: "8px" }}>📁</div>
                          <h3 style={{ fontSize: "1rem", color: "#fff" }}>No files match search query</h3>
                          <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>Try searching with a different term or upload a new file</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFiles.map((file, idx) => {
                      const isCsv = file.file_name.toLowerCase().endsWith(".csv")
                      return (
                        <tr key={file.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)", transition: "background 0.15s ease" }}>
                          <td style={{ textAlign: "center", fontWeight: 600, color: "#64748b", padding: "12px 14px" }}>{idx + 1}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ fontSize: "22px" }}>{isCsv ? "📊" : "📄"}</span>
                              <span style={{ fontWeight: 600, color: "#f8fafc" }} title={file.file_name}>{file.file_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span 
                              style={{ 
                                padding: "3px 8px", 
                                borderRadius: "6px", 
                                fontSize: "0.72rem", 
                                fontWeight: 700, 
                                background: isCsv ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)", 
                                color: isCsv ? "#34d399" : "#fb7185",
                                border: isCsv ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(244, 63, 94, 0.3)" 
                              }}
                            >
                              {isCsv ? "CSV DATA" : "PDF DOC"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", color: "#cbd5e1" }}>{formatSize(file.file_size)}</td>
                          <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: "0.82rem" }}>{formatDate(file.uploaded_at)}</td>
                          <td style={{ padding: "12px 14px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                              <a 
                                href={`/api/bank/files/${file.id}/download`} 
                                className="action-btn" 
                                title="Download File" 
                                target="_blank"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  background: "rgba(99, 102, 241, 0.15)",
                                  color: "#a5b4fc",
                                  border: "1px solid rgba(99, 102, 241, 0.3)",
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  textDecoration: "none"
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Download
                              </a>
                              <button 
                                className="action-btn danger" 
                                title="Delete File" 
                                onClick={() => deleteFile(file.id, file.file_name)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "#f87171",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  cursor: "pointer"
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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

        {/* Bottom Card: Registered User Management Table */}
        <div className="result-card" style={{ marginTop: "32px", background: "rgba(17, 24, 39, 0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Registered User Accounts
              <span style={{ fontSize: "0.78rem", padding: "2px 10px", borderRadius: "999px", background: "rgba(244, 114, 182, 0.15)", color: "#f472b6", border: "1px solid rgba(244, 114, 182, 0.3)" }}>
                Showing {filteredUsers.length} of {users.length} Users
              </span>
            </h3>

            {/* User Search Input */}
            <div style={{ position: "relative", minWidth: "260px" }}>
              <input
                type="text"
                placeholder="🔍 Search users by name, email or role..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 34px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "0.85rem",
                  outline: "none"
                }}
              />
              <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", opacity: 0.6 }}>🔍</span>
            </div>
          </div>

          <div className="files-table-wrap" style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <table className="files-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "rgba(244, 114, 182, 0.12)", color: "#f1f5f9" }}>
                  <th style={{ padding: "12px 14px", width: "50px", textAlign: "center" }}>User ID</th>
                  <th style={{ padding: "12px 14px", textAlign: "left" }}>Account Name</th>
                  <th style={{ padding: "12px 14px", textAlign: "left" }}>Email Address</th>
                  <th style={{ padding: "12px 14px", width: "110px", textAlign: "center" }}>Role</th>
                  <th style={{ padding: "12px 14px", width: "110px", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "12px 14px", width: "160px", textAlign: "left" }}>Joined Date</th>
                  <th style={{ padding: "12px 14px", width: "160px", textAlign: "left" }}>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "32px", textAlign: "center" }}>
                      <div className="empty-state">
                        <div className="empty-state-icon" style={{ fontSize: "2.2rem", marginBottom: "8px" }}>👥</div>
                        <h3 style={{ fontSize: "1rem", color: "#fff" }}>No users match search query</h3>
                        <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>Try searching with a different name or email</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isAdmin = u.role === "admin"
                    const isActive = u.status === "active" || !u.status
                    const initials = getUserInitials(u.name, u.email)

                    return (
                      <tr key={u.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)", transition: "background 0.15s ease" }}>
                        <td style={{ textAlign: "center", fontWeight: 700, color: "#64748b", padding: "12px 14px" }}>#{u.id}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div 
                              style={{ 
                                width: "32px", 
                                height: "32px", 
                                borderRadius: "50%", 
                                background: isAdmin ? "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" : "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)", 
                                color: "#fff", 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                fontWeight: 700, 
                                fontSize: "0.75rem",
                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
                              }}
                            >
                              {initials}
                            </div>
                            <span style={{ fontWeight: 600, color: "#f8fafc" }}>{u.name || "System User"}</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#cbd5e1" }}>{u.email}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <span 
                            style={{ 
                              padding: "4px 12px", 
                              borderRadius: "999px", 
                              fontSize: "0.75rem", 
                              fontWeight: 700, 
                              background: isAdmin ? "rgba(99, 102, 241, 0.2)" : "rgba(148, 163, 184, 0.12)", 
                              color: isAdmin ? "#a5b4fc" : "#cbd5e1",
                              border: isAdmin ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid rgba(148, 163, 184, 0.25)"
                            }}
                          >
                            {isAdmin ? "👑 ADMIN" : "USER"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <span 
                            style={{ 
                              padding: "4px 12px", 
                              borderRadius: "999px", 
                              fontSize: "0.75rem", 
                              fontWeight: 700, 
                              background: isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", 
                              color: isActive ? "#34d399" : "#f87171",
                              border: isActive ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)"
                            }}
                          >
                            {isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: "0.82rem" }}>{formatDate(u.created_at)}</td>
                        <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: "0.82rem" }}>
                          {u.last_login ? formatDate(u.last_login) : <span style={{ color: "#64748b" }}>Never</span>}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </main>
  )
}
