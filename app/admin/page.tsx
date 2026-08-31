/**
 * Admin page — bank document management and user list.
 * Uses: /api/auth/verify, /api/bank/files, /api/admin/users
 * Admin-only: upload/download/delete PDFs and view all users.
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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
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
          <a href="/emi" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
            EMI Calculator
          </a>
          <a href="/admin" className="nav-item active">
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

      <main className="admin-page">
        <div className="admin-header">
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            Bank Documents Management
          </h2>
          <span style={{ fontSize: "14px", opacity: 0.8 }}>Upload, manage, and download bank PDF files</span>
        </div>

        <div className="summary-grid" id="summaryGrid">
          <div className="summary-item">
            <div className="summary-label">Total Documents</div>
            <div className="summary-value">{files.length}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total Size</div>
            <div className="summary-value">{formatSize(files.reduce((sum, f) => sum + (f.file_size || 0), 0))}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Last Uploaded</div>
            <div className="summary-value">{files.length > 0 ? files[0].uploaded_at : "Never"}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total Users</div>
            <div className="summary-value">{users.length}</div>
          </div>
        </div>

        <div className="admin-grid">
          <div className="form-card">
            <div className="form-card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload New PDF
            </div>
            <div className="field-group">
              <label className="field-label">Select Bank PDF</label>
              <div className="drop-zone">
                <div className="drop-zone-icon">📄</div>
                <h4>Drag & Drop PDF Here</h4>
                <p>or click to browse from your computer</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => document.getElementById("pdfInput")?.click()}
                  style={{ display: "inline-flex", width: "auto" }}
                >
                  Choose File
                </button>
                <input
                  type="file"
                  id="pdfInput"
                  accept=".pdf,.csv,application/pdf,text/csv"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </div>
              <div className={`upload-progress ${uploading ? "active" : ""}`}>{uploading ? "Uploading..." : ""}</div>
              {message && <div className={`upload-progress ${message.includes("success") || message.includes("successfully") ? "success" : message.includes("failed") || message.includes("error") ? "error" : ""}`}>{message}</div>}
            </div>
          </div>

          <div className="result-card">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Uploaded Documents
            </h3>
            <div className="files-table-wrap">
              <table className="files-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>File Name</th>
                    <th style={{ width: "120px" }}>Size</th>
                    <th style={{ width: "160px" }}>Uploaded</th>
                    <th style={{ width: "140px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.length === 0 ? (
                    <tr id="emptyRow">
                      <td colSpan={5}>
                        <div className="empty-state">
                          <div className="empty-state-icon">📁</div>
                          <h3>No documents uploaded</h3>
                          <p>Upload your first bank PDF using the form on the left</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    files.map((file, idx) => (
                      <tr key={file.id}>
                        <td style={{ textAlign: "center", fontWeight: 700, color: "var(--text-muted)" }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "20px" }}>{file.file_name.toLowerCase().endsWith(".csv") ? "📊" : "📄"}</span>
                            <span className="file-name-cell" title={file.file_name}>{file.file_name}</span>
                          </div>
                        </td>
                        <td>{formatSize(file.file_size)}</td>
                        <td>{formatDate(file.uploaded_at)}</td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <a href={`/api/bank/files/${file.id}/download`} className="action-btn" title="Download" target="_blank">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              Download
                            </a>
                            <button className="action-btn danger" title="Delete" onClick={() => deleteFile(file.id, file.file_name)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="result-card" style={{ marginTop: "28px" }}>
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            All Users
          </h3>
          <div className="files-table-wrap">
            <table className="files-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th style={{ width: "100px" }}>Role</th>
                  <th style={{ width: "100px" }}>Status</th>
                  <th style={{ width: "160px" }}>Created At</th>
                  <th style={{ width: "160px" }}>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr id="usersEmptyRow">
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <h3>No users found</h3>
                        <p>User list will appear here</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user, idx) => (
                    <tr key={user.id}>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "var(--text-muted)" }}>{user.id}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "18px" }}>👤</span>
                          <span style={{ fontWeight: 600 }}>{user.name || "N/A"}</span>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600, background: user.role === "admin" ? "var(--primary-light)" : "var(--border-light)", color: user.role === "admin" ? "var(--primary)" : "var(--text-secondary)" }}>
                          {user.role || "user"}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600, background: user.status === "active" ? "#D1FAE5" : "#FEE2E2", color: user.status === "active" ? "#065F46" : "#DC2626" }}>
                          {user.status || "active"}
                        </span>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>{user.last_login ? formatDate(user.last_login) : <span style={{ color: "var(--text-muted)" }}>Never</span>}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </main>
  )
}
