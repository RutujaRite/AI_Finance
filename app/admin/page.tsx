/**
 * Admin page — bank document management and user list.
 * Uses: /api/auth/verify, /api/bank/files, /api/admin/users
 * Admin-only: upload/download/delete PDFs/CSVs and manage all registered users.
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
  const [users, setUsers] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedModel, setSelectedModel] = useState("liquid/lfm-2.5-embedding-350m:free")

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

  if (!user) {
    return (
      <main style={{ padding: 48, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", gap: 12 }}>
        <div className="spinner-border text-primary" style={{ width: 36, height: 36 }} role="status"></div>
        <p style={{ color: "var(--bs-secondary-color)", fontWeight: 500 }}>Verifying admin authorization...</p>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <Topbar
        user={user}
        pathname="/admin"
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />

      <main className="content-container" style={{ padding: "28px 32px 56px 32px" }}>
        {/* Page Header */}
        <div className="page-header" style={{ marginBottom: "28px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h1 className="page-title" style={{ margin: 0 }}>Admin Workspace & Document Repository</h1>
              <span className="badge badge-primary">Admin Only</span>
            </div>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Upload bank policy documents, inspect indexed file assets, and manage registered system accounts
            </p>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(94, 106, 210, 0.1)", color: "var(--accent)" }}>
              <i className="bi bi-file-earmark-text"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Documents</span>
              <span className="stat-value">{files.length}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(34, 197, 94, 0.1)", color: "var(--bs-success)" }}>
              <i className="bi bi-hdd-network"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Storage</span>
              <span className="stat-value">{formatSize(files.reduce((sum, f) => sum + (f.file_size || 0), 0))}</span>
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

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "rgba(236, 72, 153, 0.1)", color: "#ec4899" }}>
              <i className="bi bi-people-fill"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Registered Accounts</span>
              <span className="stat-value">{users.length}</span>
            </div>
          </div>
        </div>

        {/* Top Section: Upload Card + File Repository Table */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 380px) 1fr", gap: "24px", alignItems: "start", marginBottom: "32px" }}>
          {/* Upload Form Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <i className="bi bi-cloud-arrow-up" style={{ color: "var(--accent)" }}></i>
                Upload Policy Document
              </h2>
            </div>
            <div className="card-body">
              <label className="form-label">Supported Bank Documents (PDF, CSV)</label>
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
                  <i className="bi bi-cloud-arrow-up-fill"></i>
                </div>
                <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--bs-heading-color)", margin: "0 0 4px 0" }}>
                  Drag & Drop PDF or CSV
                </h4>
                <p style={{ fontSize: "0.82rem", color: "var(--bs-secondary-color)", margin: "0 0 16px 0" }}>
                  Maximum file size: 50 MB
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: "auto" }}
                >
                  <i className="bi bi-folder2-open"></i>
                  Browse Local Files
                </button>
                <input
                  type="file"
                  id="adminFileInput"
                  accept=".pdf,.csv,application/pdf,text/csv"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </div>

              {uploading && (
                <div style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "var(--border-radius-sm)", background: "rgba(94, 106, 210, 0.1)", color: "var(--accent)", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  Processing and indexing file to knowledge repository...
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
                  <i className="bi bi-file-earmark-richtext" style={{ color: "var(--bs-success)" }}></i>
                  Uploaded Documents
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
                  placeholder="Search documents..."
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
                    <th style={{ width: "110px" }}>Format</th>
                    <th style={{ width: "110px" }}>Size</th>
                    <th style={{ width: "160px" }}>Uploaded</th>
                    <th style={{ width: "150px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "48px 20px", textAlign: "center" }}>
                        <div style={{ color: "var(--bs-secondary-color)" }}>
                          <i className="bi bi-folder-x" style={{ fontSize: "2.4rem", opacity: 0.5, display: "block", marginBottom: "8px" }}></i>
                          <p style={{ margin: "0 0 4px 0", fontWeight: 600, color: "var(--bs-heading-color)" }}>No files match search query</p>
                          <small>Try searching with another keyword or drag a new file</small>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFiles.map((file, idx) => {
                      const isCsv = file.file_name.toLowerCase().endsWith(".csv")
                      return (
                        <tr key={file.id}>
                          <td style={{ textAlign: "center", color: "var(--bs-secondary-color)", fontWeight: 500 }}>{idx + 1}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <i className={`bi ${isCsv ? "bi-filetype-csv" : "bi-file-earmark-pdf"}`} style={{ fontSize: "1.3rem", color: isCsv ? "var(--bs-success)" : "var(--bs-danger)" }}></i>
                              <span style={{ fontWeight: 600, color: "var(--bs-heading-color)" }} title={file.file_name}>
                                {file.file_name}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${isCsv ? "badge-success" : "badge-danger"}`}>
                              {isCsv ? "CSV DATA" : "PDF DOC"}
                            </span>
                          </td>
                          <td style={{ color: "var(--bs-body-color)" }}>{formatSize(file.file_size)}</td>
                          <td style={{ color: "var(--bs-secondary-color)", fontSize: "0.82rem" }}>{formatDate(file.uploaded_at)}</td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <a 
                                href={`/api/bank/files/${file.id}/download`} 
                                className="btn btn-outline-secondary" 
                                title="Download File" 
                                target="_blank"
                                style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                              >
                                <i className="bi bi-download"></i>
                                Download
                              </a>
                              <button 
                                className="btn btn-outline-danger" 
                                title="Delete File" 
                                onClick={() => deleteFile(file.id, file.file_name)}
                                style={{ padding: "4px 10px", fontSize: "0.78rem" }}
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

        {/* Bottom Section: Registered User Management Table */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 className="card-title" style={{ margin: 0 }}>
                <i className="bi bi-people" style={{ color: "var(--accent)" }}></i>
                Registered User Accounts
              </h2>
              <span className="badge badge-neutral">
                Showing {filteredUsers.length} of {users.length} Users
              </span>
            </div>

            {/* User Search Input */}
            <div style={{ position: "relative", minWidth: "260px" }}>
              <i className="bi bi-search" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--bs-secondary-color)", fontSize: "0.85rem" }}></i>
              <input
                type="text"
                className="form-control"
                placeholder="Search users by name, email or role..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ paddingLeft: "34px", fontSize: "0.85rem" }}
              />
            </div>
          </div>

          <div className="table-wrapper">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th style={{ width: "65px", textAlign: "center" }}>User ID</th>
                  <th>Account Name</th>
                  <th>Email Address</th>
                  <th style={{ width: "110px", textAlign: "center" }}>Role</th>
                  <th style={{ width: "110px", textAlign: "center" }}>Status</th>
                  <th style={{ width: "160px" }}>Joined Date</th>
                  <th style={{ width: "160px" }}>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px 20px", textAlign: "center" }}>
                      <div style={{ color: "var(--bs-secondary-color)" }}>
                        <i className="bi bi-person-x" style={{ fontSize: "2.4rem", opacity: 0.5, display: "block", marginBottom: "8px" }}></i>
                        <p style={{ margin: "0 0 4px 0", fontWeight: 600, color: "var(--bs-heading-color)" }}>No accounts match query</p>
                        <small>Try searching with another name or email</small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isAdmin = u.role === "admin"
                    const isActive = u.status === "active" || !u.status
                    const initials = getUserInitials(u.name, u.email)

                    return (
                      <tr key={u.id}>
                        <td style={{ textAlign: "center", fontWeight: 600, color: "var(--bs-secondary-color)" }}>#{u.id}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div 
                              style={{ 
                                width: "32px", 
                                height: "32px", 
                                borderRadius: "50%", 
                                background: isAdmin ? "var(--accent)" : "rgba(94, 106, 210, 0.15)", 
                                color: isAdmin ? "#fff" : "var(--accent)", 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                fontWeight: 700, 
                                fontSize: "0.75rem",
                              }}
                            >
                              {initials}
                            </div>
                            <span style={{ fontWeight: 600, color: "var(--bs-heading-color)" }}>{u.name || "System User"}</span>
                          </div>
                        </td>
                        <td style={{ color: "var(--bs-body-color)" }}>{u.email}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`badge ${isAdmin ? "badge-primary" : "badge-neutral"}`}>
                            {isAdmin ? "👑 ADMIN" : "USER"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`badge ${isActive ? "badge-success" : "badge-neutral"}`}>
                            {isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td style={{ color: "var(--bs-secondary-color)", fontSize: "0.82rem" }}>{formatDate(u.created_at)}</td>
                        <td style={{ color: "var(--bs-secondary-color)", fontSize: "0.82rem" }}>
                          {u.last_login ? formatDate(u.last_login) : <span style={{ color: "var(--bs-secondary-color)", opacity: 0.6 }}>Never</span>}
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
    </div>
  )
}
