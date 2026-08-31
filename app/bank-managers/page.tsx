/**
 * Bank Managers page — search managers and import Excel/CSV files.
 * Uses: /api/auth/verify, /api/bank-managers/search, /api/bank-managers/files
 * Imports via lib/importManagers (ported from Python import_managers.py).
 */

"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function BankManagersPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [managers, setManagers] = useState<any[]>([])
  const [searchBank, setSearchBank] = useState("")
  const [searchCity, setSearchCity] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [files, setFiles] = useState<any[]>([])

  useEffect(() => {
    checkAuth()
    loadManagers()
    loadFiles()
  }, [])

  async function checkAuth() {
    const res = await fetch("/api/auth/verify")
    if (!res.ok) {
      router.replace("/login")
      return
    }
    const data = await res.json()
    if (data.success) setUser(data.user)
  }

  async function loadManagers() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchBank) params.set("bank_name", searchBank)
      if (searchCity) params.set("location", searchCity)
      const res = await fetch(`/api/bank-managers/search?${params.toString()}`)
      const data = await res.json()
      setManagers(data.managers || [])
    } catch (e) {
      console.error("Failed to load managers", e)
    } finally {
      setLoading(false)
    }
  }

  async function loadFiles() {
    try {
      const res = await fetch("/api/bank-managers/files")
      const data = await res.json()
      setFiles(data.files || [])
    } catch (e) {
      console.error("Failed to load files", e)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadManagers()
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.toLowerCase().split(".").pop()
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      setMessage("Only Excel and CSV files are allowed")
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
      formData.append("bank_name", searchBank || "General")

      const res = await fetch("/api/bank-managers/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        setMessage("File uploaded and imported successfully!")
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

  async function deleteFile(id: number, bankName: string) {
    if (!confirm(`Delete all managers for ${bankName} and the uploaded file?`)) return
    try {
      const res = await fetch(`/api/bank-managers/files/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setMessage("Deleted successfully")
        loadFiles()
        loadManagers()
      } else {
        setMessage("Delete failed")
      }
    } catch (err) {
      setMessage("Delete failed")
    }
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

      <main className="admin-page">
        <div className="admin-header">
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            Bank Managers
          </h2>
          <span style={{ fontSize: "14px", opacity: 0.8 }}>Search and import bank manager data</span>
        </div>

        <div className="admin-grid">
          <div className="form-card">
            <div className="form-card-title">Search Managers</div>
            <form onSubmit={handleSearch}>
              <div className="field-group">
                <label className="field-label">Bank Name</label>
                <input className="form-input" value={searchBank} onChange={(e) => setSearchBank(e.target.value)} placeholder="e.g. SBI, HDFC, ICICI" />
              </div>
              <div className="field-group">
                <label className="field-label">City / Location</label>
                <input className="form-input" value={searchCity} onChange={(e) => setSearchCity(e.target.value)} placeholder="e.g. Mumbai, Pune" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </button>
            </form>

            <div style={{ marginTop: "24px" }}>
              <div className="form-card-title">Import Managers</div>
              <div className="field-group">
                <label className="field-label">Upload Excel/CSV</label>
                <div className="drop-zone">
                  <div className="drop-zone-icon">📊</div>
                  <h4>Upload Excel or CSV</h4>
                  <p>Import bank manager contacts</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => document.getElementById("managerFileInput")?.click()}
                    style={{ display: "inline-flex", width: "auto" }}
                  >
                    Choose File
                  </button>
                  <input
                    type="file"
                    id="managerFileInput"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                </div>
                <div className={`upload-progress ${uploading ? "active" : ""}`}>{uploading ? "Uploading..." : ""}</div>
                {message && <div className={`upload-progress ${message.includes("success") ? "success" : message.includes("failed") ? "error" : ""}`}>{message}</div>}
              </div>
            </div>
          </div>

          <div className="result-card">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Manager Results ({managers.length})
            </h3>
            <div className="files-table-wrap">
              <table className="files-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Bank</th>
                    <th>Designation</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Location</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <div className="empty-state-icon">👥</div>
                          <h3>No managers found</h3>
                          <p>Search for bank managers above</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    managers.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.manager_name || "-"}</td>
                        <td>{m.bank_name || "-"}</td>
                        <td>{m.designation || "-"}</td>
                        <td>{m.mobile_no || "-"}</td>
                        <td>{m.email_id || "-"}</td>
                        <td>{m.location_city || "-"}</td>
                        <td>{m.state || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {files.length > 0 && (
              <div style={{ marginTop: "28px" }}>
                <h3>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Uploaded Files
                </h3>
                <div className="files-table-wrap">
                  <table className="files-table">
                    <thead>
                      <tr>
                        <th>Bank</th>
                        <th>File Name</th>
                        <th>Uploaded At</th>
                        <th style={{ textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((f) => (
                        <tr key={f.id}>
                          <td>{f.bank_name}</td>
                          <td>{f.file_name}</td>
                          <td>{formatDate(f.uploaded_at)}</td>
                          <td style={{ textAlign: "center" }}>
                            <button className="action-btn danger" onClick={() => deleteFile(f.id, f.bank_name)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </main>
  )
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleString()
}
