/**
 * Bank Manager Files Management Page
 * Allows users to upload bank manager spreadsheet files (Excel/CSV)
 * and view, download, or delete uploaded files.
 * Also displays the Bank Manager Directory in tabular format.
 */

"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Topbar from "../../components/Topbar"

export default function BankManagerFilesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [bankName, setBankName] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [files, setFiles] = useState<any[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(true)
  const [selectedModel, setSelectedModel] = useState("liquid/lfm-2.5-embedding-350m:free")

  // Directory tab state
  const [activeTab, setActiveTab] = useState<"directory" | "files">("directory")
  const [managers, setManagers] = useState<any[]>([])
  const [loadingManagers, setLoadingManagers] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterBank, setFilterBank] = useState("all")
  const [filterRole, setFilterRole] = useState("all")

  useEffect(() => {
    checkAuth()
    fetchFiles()
    fetchManagers()
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

  async function fetchManagers() {
    setLoadingManagers(true)
    try {
      const res = await fetch("/api/bank-managers", { credentials: "include" })
      const data = await res.json()
      setManagers(Array.isArray(data.managers) ? data.managers : [])
    } catch (e) {
      console.error("Error fetching managers", e)
      setManagers([])
    } finally {
      setLoadingManagers(false)
    }
  }

  const bankOptions = useMemo(() => {
    const set = new Set<string>()
    managers.forEach((m) => {
      const b = (m.bank_name || "").trim()
      if (b) set.add(b)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [managers])

  const roleOptions = useMemo(() => {
    const set = new Set<string>()
    managers.forEach((m) => {
      const r = (m.role || "").trim()
      if (r) set.add(r)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [managers])

  const filteredManagers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return managers.filter((m) => {
      const matchesBank = filterBank === "all" || (m.bank_name || "").toLowerCase() === filterBank.toLowerCase()
      const matchesRole = filterRole === "all" || (m.role || "").toLowerCase() === filterRole.toLowerCase()
      const matchesQuery =
        !q ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.bank_name || "").toLowerCase().includes(q) ||
        (m.location || "").toLowerCase().includes(q) ||
        (m.city || "").toLowerCase().includes(q) ||
        (m.state || "").toLowerCase().includes(q) ||
        (m.phone || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q)
      return matchesBank && matchesRole && matchesQuery
    })
  }, [managers, searchQuery, filterBank, filterRole])

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
      <Topbar
        user={user}
        pathname="/bank-managers"
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />

      {/* Main Page Body */}
      <main className="bm-page animate-fade-in">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-header-title">
              <i className="bi bi-people" style={{ color: "var(--accent)", marginRight: "0.5rem" }} />
              Bank Manager Directory &amp; Files
            </h1>
            <p className="page-header-subtitle">
              Locate verified bank managers across branches, search by city/bank, or upload manager contact spreadsheets.
            </p>
          </div>
          <div className="page-header-actions">
            <span className="badge bg-primary">{managers.length} Managers</span>
            <span className="badge bg-purple">{files.length} Files</span>
          </div>
        </div>

        {/* Tab Switcher (CallNow Section 13) */}
        <div className="nav-tabs" style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className={`nav-link ${activeTab === "directory" ? "active" : ""}`}
            onClick={() => setActiveTab("directory")}
          >
            <i className="bi bi-person-lines-fill" /> Bank Manager Directory ({managers.length})
          </button>
          <button
            type="button"
            className={`nav-link ${activeTab === "files" ? "active" : ""}`}
            onClick={() => setActiveTab("files")}
          >
            <i className="bi bi-file-earmark-spreadsheet" /> Upload &amp; Files ({files.length})
          </button>
        </div>

        {/* TAB 1: Bank Manager Directory */}
        {activeTab === "directory" && (
          <div>
            {/* Search and Filters Card */}
            <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr)) auto", gap: "1rem", alignItems: "flex-end" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Search Directory</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by name, bank, city, phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Filter Bank</label>
                  <select
                    className="form-select"
                    value={filterBank}
                    onChange={(e) => setFilterBank(e.target.value)}
                  >
                    <option value="all">All Partner Banks</option>
                    {bankOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Filter Role</label>
                  <select
                    className="form-select"
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                  >
                    <option value="all">All Roles</option>
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ height: "35px" }}
                  onClick={() => {
                    setSearchQuery("")
                    setFilterBank("all")
                    setFilterRole("all")
                  }}
                >
                  <i className="bi bi-x-circle" /> Reset
                </button>
              </div>
            </div>

            {/* Managers Table */}
            {loadingManagers ? (
              <div style={{ textAlign: "center", padding: 60, color: "var(--ink-muted)" }}>
                Loading bank manager directory...
              </div>
            ) : filteredManagers.length === 0 ? (
              <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
                <i className="bi bi-person-x" style={{ fontSize: "2.5rem", color: "var(--ink-muted)", marginBottom: "0.5rem" }} />
                <h3 style={{ fontSize: "1.125rem", color: "var(--ink)", marginBottom: "0.25rem" }}>No Managers Found</h3>
                <p style={{ color: "var(--ink-soft)", fontSize: "0.8125rem" }}>
                  Try changing your search terms or upload a new manager contact spreadsheet.
                </p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Bank Name</th>
                      <th>Manager Name</th>
                      <th>Role / Designation</th>
                      <th>Location / Branch</th>
                      <th>Phone</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredManagers.map((m: any, idx: number) => (
                      <tr key={m.id || idx}>
                        <td style={{ color: "var(--ink-muted)" }}>{idx + 1}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                            <i className="bi bi-bank" style={{ color: "var(--accent)", marginRight: "0.375rem" }} />
                            {m.bank_name || "-"}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--ink)" }}>{m.name || "-"}</td>
                        <td>
                          <span className="badge bg-purple">{m.role || "Branch Manager"}</span>
                        </td>
                        <td style={{ color: "var(--ink-soft)" }}>
                          <i className="bi bi-geo-alt" style={{ marginRight: "0.25rem", color: "var(--ink-muted)" }} />
                          {m.city || m.location || m.state || "-"}
                        </td>
                        <td>
                          {m.phone ? (
                            <a href={`tel:${m.phone}`} style={{ color: "var(--accent)", fontWeight: 500 }}>
                              <i className="bi bi-telephone" style={{ marginRight: "0.25rem" }} />
                              {m.phone}
                            </a>
                          ) : (
                            <span style={{ color: "var(--ink-muted)" }}>-</span>
                          )}
                        </td>
                        <td>
                          {m.email ? (
                            <a href={`mailto:${m.email}`} style={{ color: "var(--ink-soft)" }}>
                              <i className="bi bi-envelope" style={{ marginRight: "0.25rem" }} />
                              {m.email}
                            </a>
                          ) : (
                            <span style={{ color: "var(--ink-muted)" }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Upload & Files */}
        {activeTab === "files" && (
          <div>
            {/* Section 1: File Upload Form Card */}
            <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--ink)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <i className="bi bi-cloud-arrow-up" style={{ color: "var(--accent)", fontSize: "1.25rem" }} />
                Upload Bank Manager Spreadsheet File
              </div>

              {uploadMsg && (
                <div
                  className={`alert ${uploadMsg.type === "success" ? "alert-success" : "alert-danger"}`}
                  style={{ marginBottom: "1rem" }}
                >
                  <i className={`bi ${uploadMsg.type === "success" ? "bi-check-circle" : "bi-exclamation-triangle"}`} style={{ marginRight: "0.375rem" }} />
                  {uploadMsg.text}
                </div>
              )}

              <form onSubmit={handleUploadSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Bank Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank, Axis Bank..."
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    disabled={isUploading}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Spreadsheet File (.xlsx, .xls, .csv) *</label>
                  <input
                    id="bankFileInput"
                    type="file"
                    className="form-control"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    disabled={isUploading}
                    required
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: 4, display: "block" }}>
                    Accepted formats: Microsoft Excel (.xlsx, .xls) or CSV (.csv). Max file size: 50MB.
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}
                  disabled={isUploading || !bankName.trim() || !selectedFile}
                >
                  {isUploading ? (
                    <>
                      <span className="spinner-inline" /> Uploading &amp; Processing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-upload" /> Upload File
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Section 2: Uploaded Files Directory List */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--ink)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <i className="bi bi-folder2-open" style={{ color: "var(--accent)" }} />
                  Uploaded Manager Files
                </div>
                <span className="badge">{files.length} Files</span>
              </div>

              {isLoadingFiles ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--ink-muted)" }}>
                  Loading uploaded files...
                </div>
              ) : files.length > 0 ? (
                <div className="table-wrapper">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Bank Name</th>
                        <th>File Name</th>
                        <th>Size</th>
                        <th>Uploaded Date</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file, idx) => (
                        <tr key={file.id}>
                          <td style={{ color: "var(--ink-muted)" }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600, color: "var(--ink)" }}>{file.bank_name}</td>
                          <td style={{ color: "var(--accent)", fontFamily: "monospace", fontSize: "0.8125rem" }}>
                            <i className="bi bi-file-earmark-spreadsheet" style={{ marginRight: "0.375rem" }} />
                            {file.file_name}
                          </td>
                          <td>
                            <span className="badge">{formatFileSize(file.file_size)}</span>
                          </td>
                          <td style={{ color: "var(--ink-soft)" }}>
                            {new Date(file.uploaded_at).toLocaleDateString()}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "0.375rem" }}>
                              {file.file_path && (
                                <a
                                  href={file.file_path}
                                  download
                                  className="btn btn-secondary btn-sm"
                                >
                                  <i className="bi bi-download" /> Download
                                </a>
                              )}
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleDeleteFile(file.id, file.file_name)}
                              >
                                <i className="bi bi-trash3" /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--ink-muted)" }}>
                  <i className="bi bi-folder-x" style={{ fontSize: "2.5rem", marginBottom: "0.5rem", display: "block" }} />
                  <h4 style={{ color: "var(--ink)", fontSize: "1rem", marginBottom: 4 }}>No Files Uploaded Yet</h4>
                  <p style={{ fontSize: "0.8125rem", color: "var(--ink-soft)" }}>
                    Use the upload form above to attach an Excel or CSV file containing bank manager details.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </main>
  )
}
