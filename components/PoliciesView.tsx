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
  
  // Replace File State (for Documents tab)
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
  const [isEditingViewerFile, setIsEditingViewerFile] = useState(false)
  const [viewerFileDraftText, setViewerFileDraftText] = useState("")
  const [isSavingFileContent, setIsSavingFileContent] = useState(false)

  const isAdmin =
    String(user?.role || "").trim().toLowerCase() === "admin" ||
    user?.is_admin === true ||
    String(user?.email || "").toLowerCase() === "admin@gmail.com" ||
    String(user?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
    String(user?.email || "").toLowerCase().startsWith("admin")

  const hasUnsavedChanges = isEditingViewerFile && viewerFileDraftText !== (activeViewerFile?.extracted_text || "")

  // Action Toast Notification
  const [actionToast, setActionToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  // Edit Policy Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editPolicy, setEditPolicy] = useState<any | null>(null)
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)

  // Edit Form Fields
  const [editBankId, setEditBankId] = useState<number>(0)
  const [editBankName, setEditBankName] = useState<string>("")
  const [editPolicyVersion, setEditPolicyVersion] = useState<string>("Current Version")
  const [editLoanType, setEditLoanType] = useState<string>("Personal Loan")
  const [editEmployment, setEditEmployment] = useState<string>("Salaried")
  const [editMinCibil, setEditMinCibil] = useState<number | string>(700)
  const [editMaxCibil, setEditMaxCibil] = useState<number | string>(900)
  const [editMinSalary, setEditMinSalary] = useState<number | string>(30000)
  const [editMaxSalary, setEditMaxSalary] = useState<number | string>(600000)
  const [editMinAge, setEditMinAge] = useState<number | string>(21)
  const [editMaxAge, setEditMaxAge] = useState<number | string>(60)
  const [editMinLoanAmount, setEditMinLoanAmount] = useState<number | string>(200000)
  const [editMaxLoanAmount, setEditMaxLoanAmount] = useState<number | string>(5000000)
  const [editMinTenure, setEditMinTenure] = useState<number | string>(12)
  const [editMaxTenure, setEditMaxTenure] = useState<number | string>(60)
  const [editFoir, setEditFoir] = useState<number | string>(22)
  const [editRoi, setEditRoi] = useState<number | string>(12.5)
  const [editProcessingFee, setEditProcessingFee] = useState<number | string>(1.5)
  const [editStatus, setEditStatus] = useState<string>("Active")
  const [editAttachedFile, setEditAttachedFile] = useState<File | null>(null)
  const [editExistingFileName, setEditExistingFileName] = useState<string>("")
  const [editExistingFileSize, setEditExistingFileSize] = useState<string>("")
  const [isDragging, setIsDragging] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement | null>(null)

  // Delete Confirmation Modal State
  const [deleteConfirmPolicy, setDeleteConfirmPolicy] = useState<any | null>(null)
  const [isDeletingPolicy, setIsDeletingPolicy] = useState(false)

  useEffect(() => {
    if (propUser) {
      setUser(propUser)
      if (!propUser.role) {
        checkAuth()
      }
    } else {
      checkAuth()
    }
    loadPolicies()
    loadPolicyFiles()
  }, [propUser])

  function showToast(message: string, type: "success" | "error" = "success") {
    setActionToast({ message, type })
    setTimeout(() => {
      setActionToast(null)
    }, 4500)
  }

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/verify", { credentials: "include" })
      if (!res.ok) {
        return
      }
      const data = await res.json()
      if (data.success && data.user) {
        setUser(data.user)
      }
    } catch (e) {
      console.warn("checkAuth error", e)
    }
  }

  async function loadPolicies() {
    setLoading(true)
    try {
      const res = await fetch("/api/policies")
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      // Defensive deduplication: strictly one row per bank
      const seen = new Set<string>()
      const unique = list.filter((p: any) => {
        const key = `${p.bank_id}_${String(p.bank_name || p.bank_code || "").toLowerCase().trim()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setPolicies(unique)
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
        const raw = Array.isArray(data.files) ? data.files : []
        // Defensive deduplication: strictly one row per bank
        const seen = new Set<string>()
        const unique = raw.filter((f: any) => {
          const key = `${f.bank_id}_${String(f.bank_name || f.bank_code || "").toLowerCase().trim()}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setPolicyFiles(unique)
      }
    } catch (e) {
      console.error("Failed to load policy files", e)
      setPolicyFiles([])
    } finally {
      setLoadingFiles(false)
    }
  }

  // Edit Modal Open & Pre-fill
  function handleOpenEdit(policy: any) {
    setEditPolicy(policy)
    setEditBankId(policy.bank_id || policy.id)
    setEditBankName(policy.bank_name || policy.bank_code || "Partner Bank")
    setEditPolicyVersion(policy.policy_version || "Current Version")
    setEditLoanType(policy.loan_type || "Personal Loan")
    setEditEmployment(policy.employment_type || "Salaried")
    setEditMinCibil(policy.min_cibil ?? 700)
    setEditMaxCibil(policy.max_cibil ?? 900)
    setEditMinSalary(policy.min_salary ?? 30000)
    setEditMaxSalary(policy.max_salary ?? 600000)
    setEditMinAge(policy.min_age ?? 21)
    setEditMaxAge(policy.max_age ?? 60)
    setEditMinLoanAmount(policy.min_loan_amount ?? 200000)
    setEditMaxLoanAmount(policy.max_loan_amount ?? 5000000)
    setEditMinTenure(policy.min_tenure_months ?? 12)
    setEditMaxTenure(policy.max_tenure_months ?? 60)
    setEditFoir(policy.foir_percent ?? 22)
    setEditRoi(policy.roi ?? 12.5)
    setEditProcessingFee(policy.processing_fee_percent ?? 1.5)
    
    const rawStatus = (policy.status || "active").toLowerCase()
    setEditStatus(
      rawStatus === "active" ? "Active" :
      rawStatus === "review" ? "In Review" :
      rawStatus === "draft" ? "Draft" : "Active"
    )

    const fName = policy.attachment_file_name || policy.file_name || `${policy.bank_name || "Bank"}_Master_Policy.txt`
    setEditExistingFileName(fName)
    const sizeBytes = policy.file_size_bytes || 2500000
    const sizeStr = sizeBytes > 1024 * 1024
      ? (sizeBytes / (1024 * 1024)).toFixed(1) + " MB"
      : (sizeBytes / 1024).toFixed(1) + " KB"
    setEditExistingFileSize(sizeStr)
    setEditAttachedFile(null)

    setEditModalOpen(true)
  }

  // Save Policy Changes
  async function handleSavePolicy(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!editPolicy) return

    setIsSavingPolicy(true)
    try {
      const formData = new FormData()
      formData.append("bank_id", String(editBankId || editPolicy.bank_id))
      formData.append("bank_name", editBankName)
      formData.append("policy_version", editPolicyVersion)
      formData.append("loan_type", editLoanType)
      formData.append("employment_type", editEmployment)
      formData.append("min_cibil", String(editMinCibil))
      formData.append("max_cibil", String(editMaxCibil))
      formData.append("min_salary", String(editMinSalary))
      formData.append("max_salary", String(editMaxSalary))
      formData.append("min_age", String(editMinAge))
      formData.append("max_age", String(editMaxAge))
      formData.append("min_loan_amount", String(editMinLoanAmount))
      formData.append("max_loan_amount", String(editMaxLoanAmount))
      formData.append("min_tenure_months", String(editMinTenure))
      formData.append("max_tenure_months", String(editMaxTenure))
      formData.append("foir_percent", String(editFoir))
      formData.append("roi", String(editRoi))
      formData.append("processing_fee_percent", String(editProcessingFee))
      formData.append("status", editStatus.toLowerCase() === "in review" ? "review" : editStatus.toLowerCase())

      if (editAttachedFile) {
        formData.append("file", editAttachedFile)
      }

      const targetId = editPolicy.bank_id || editPolicy.id
      const res = await fetch(`/api/policies/${targetId}`, {
        method: "PUT",
        body: formData,
      })

      const data = await res.json()
      if (data.success) {
        showToast(`✓ Policy rule for ${editBankName} updated successfully`, "success")
        setEditModalOpen(false)
        loadPolicies()
        loadPolicyFiles()
      } else {
        showToast(`✕ Failed to update policy rule: ${data.error || "Unknown error"}`, "error")
      }
    } catch (err) {
      console.error("Failed to update policy rule", err)
      showToast("✕ Failed to update policy rule", "error")
    } finally {
      setIsSavingPolicy(false)
    }
  }

  // Delete Policy & Associated File Confirmation
  function handleOpenDelete(policy: any) {
    setDeleteConfirmPolicy(policy)
  }

  async function handleConfirmDelete() {
    if (!deleteConfirmPolicy) return

    setIsDeletingPolicy(true)
    try {
      const bankId = deleteConfirmPolicy.bank_id || deleteConfirmPolicy.id
      const fileName = deleteConfirmPolicy.file_name || deleteConfirmPolicy.attachment_file_name || ""

      const res = await fetch(
        `/api/policies/${bankId}?bank_id=${bankId}&file_name=${encodeURIComponent(fileName)}`,
        { method: "DELETE" }
      )

      const data = await res.json()
      if (data.success) {
        showToast(
          `✓ Deleted policy rule for ${deleteConfirmPolicy.bank_name} and associated master text file (${fileName})`,
          "success"
        )
        setDeleteConfirmPolicy(null)
        setEditModalOpen(false)
        loadPolicies()
        loadPolicyFiles()
      } else {
        showToast(`✕ Failed to delete policy: ${data.error || "Unknown error"}`, "error")
      }
    } catch (err) {
      console.error("Failed to delete policy", err)
      showToast("✕ Failed to delete policy rule", "error")
    } finally {
      setIsDeletingPolicy(false)
    }
  }

  // File replacement inside modal
  function handleModalFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditAttachedFile(file)
    setEditExistingFileName(file.name)
    const sizeStr = file.size > 1024 * 1024
      ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
      : (file.size / 1024).toFixed(1) + " KB"
    setEditExistingFileSize(sizeStr)
  }

  // Document viewer modal
  async function handleOpenViewer(fileId: number, fallbackData?: any) {
    if (!user?.role) {
      checkAuth()
    }
    setLoadingFileContent(true)
    setModalSearch("")
    setIsEditingViewerFile(false)
    try {
      const res = await fetch(`/api/policies/extracted-files/${fileId}`)
      const data = await res.json()
      if (data.success && data.file) {
        setActiveViewerFile(data.file)
        setViewerFileDraftText(data.file.extracted_text || "")
      } else if (fallbackData) {
        const fallbackText = fallbackData.extracted_text || fallbackData.attachment_extracted_text || ""
        setActiveViewerFile(fallbackData)
        setViewerFileDraftText(fallbackText)
      }
    } catch (e) {
      if (fallbackData) {
        const fallbackText = fallbackData.extracted_text || fallbackData.attachment_extracted_text || ""
        setActiveViewerFile(fallbackData)
        setViewerFileDraftText(fallbackText)
      }
    } finally {
      setLoadingFileContent(false)
    }
  }

  function handleEnterEdit() {
    if (!isAdmin || !activeViewerFile) return
    setViewerFileDraftText(activeViewerFile.extracted_text || "")
    setIsEditingViewerFile(true)
  }

  function handleCancelEdit() {
    if (hasUnsavedChanges) {
      if (!window.confirm("Discard unsaved changes and return to read-only view?")) {
        return
      }
    }
    setIsEditingViewerFile(false)
    setViewerFileDraftText(activeViewerFile?.extracted_text || "")
  }

  function handleCloseViewer() {
    if (isEditingViewerFile && hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes in the policy editor. Are you sure you want to close?")) {
        return
      }
    }
    setActiveViewerFile(null)
    setIsEditingViewerFile(false)
  }

  async function handleSaveFileContent() {
    if (!activeViewerFile || !isAdmin) return
    setIsSavingFileContent(true)
    try {
      const fileId = activeViewerFile.id || activeViewerFile.file_id || activeViewerFile.bank_id || 1
      const fileName = activeViewerFile.file_name

      const res = await fetch(`/api/policies/extracted-files/${fileId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_name: fileName,
          content: viewerFileDraftText,
        }),
      })

      const data = await res.json()
      if (data.success) {
        const newByteSize = data.file_size_bytes || new Blob([viewerFileDraftText]).size
        const updatedFile = {
          ...activeViewerFile,
          extracted_text: viewerFileDraftText,
          file_size_bytes: newByteSize,
        }
        setActiveViewerFile(updatedFile)
        setIsEditingViewerFile(false)

        // Update policyFiles list
        setPolicyFiles((prev) =>
          prev.map((f) =>
            f.file_name === fileName || f.id === fileId
              ? {
                  ...f,
                  extracted_text: viewerFileDraftText,
                  text_length: viewerFileDraftText.length,
                  file_size_bytes: newByteSize,
                  snippet: viewerFileDraftText.substring(0, 250),
                }
              : f
          )
        )

        // Update policies list
        setPolicies((prev) =>
          prev.map((p) =>
            p.file_name === fileName ||
            p.attachment_file_name === fileName ||
            p.id === fileId ||
            p.bank_id === activeViewerFile.bank_id
              ? {
                  ...p,
                  attachment_extracted_text: viewerFileDraftText,
                  file_size_bytes: newByteSize,
                }
              : p
          )
        )

        showToast(`✓ Master policy file "${fileName}" saved successfully`, "success")
      } else {
        showToast(`✕ Failed to save file: ${data.error || "Unknown error"}`, "error")
      }
    } catch (err: any) {
      console.error("Failed to save policy file content", err)
      showToast("✕ Network error while saving policy file", "error")
    } finally {
      setIsSavingFileContent(false)
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

  function handleDownloadText(fileName: string, text: string) {
    const element = document.createElement("a")
    const file = new Blob([text], { type: "text/plain;charset=utf-8" })
    element.href = URL.createObjectURL(file)
    element.download = fileName || "policy-document.txt"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(element.href)
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

  // Unique bank options for edit modal
  const allBankOptions = Array.from(
    new Map(
      policies.map((p) => [p.bank_name, { id: p.bank_id || p.id, name: p.bank_name }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  if (!user) return <main style={{ padding: 24, textAlign: "center" }}>Loading policy workspace...</main>

  return (
    <>
      {!embedded && <Topbar user={user} />}
      {/* Hidden File Input for Replace in Documents Tab */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf,.csv,.docx,.doc"
        style={{ display: "none" }}
        onChange={handleFileReplace}
      />

      {/* Hidden File Input for Edit Modal */}
      <input
        ref={editFileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        style={{ display: "none" }}
        onChange={handleModalFileSelected}
      />

      <div
        className="policies-page animate-fade-in"
        style={embedded ? { flex: 1, overflowY: "auto", height: "calc(100vh - var(--topbar-height))", width: "100%", padding: "1.5rem 2rem" } : undefined}
      >
        {/* Replace / Action Toast Notification */}
        {actionToast && (
          <div
            className={`alert ${actionToast.type === "success" ? "alert-success" : "alert-danger"}`}
            style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>{actionToast.message}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setActionToast(null)}
              style={{ padding: "0 0.5rem" }}
            >
              ✕
            </button>
          </div>
        )}

        {replaceMessage && (
          <div
            className={`alert ${replaceMessage.includes("✓") ? "alert-success" : "alert-info"}`}
            style={{ marginBottom: "1rem" }}
          >
            {replaceMessage}
          </div>
        )}

        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-header-title">
              <i className="bi bi-file-earmark-text" style={{ color: "var(--accent)", marginRight: "0.5rem" }} />
              Bank Policy Guidelines &amp; Documents
            </h1>
            <p className="page-header-subtitle">
              View and manage underwriting policy rules, FOIR multipliers, minimum salary requirements, and official bank documents.
            </p>
          </div>

          <div className="page-header-actions">
            <span className="badge bg-primary">{policies.length} Banks</span>
            <span className="badge bg-purple">{policyFiles.length} Master Files</span>
          </div>
        </div>

        {/* View Switcher Tabs (CallNow Section 13) */}
        <div className="nav-tabs" style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className={`nav-link ${activeTab === "rules" ? "active" : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            <i className="bi bi-card-checklist" /> Bank Master Policies ({policies.length})
          </button>
          <button
            type="button"
            className={`nav-link ${activeTab === "files" ? "active" : ""}`}
            onClick={() => setActiveTab("files")}
          >
            <i className="bi bi-file-earmark-pdf" /> Policy Master Files ({policyFiles.length})
          </button>
        </div>

        {activeTab === "rules" ? (
          <>
            {/* Filter Card */}
            <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr)) auto", gap: "1rem", alignItems: "flex-end" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Search Bank</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. ICICI, HDFC, SBI..."
                    value={searchBank}
                    onChange={(e) => setSearchBank(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Loan Type</label>
                  <select
                    className="form-select"
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
                  <label className="form-label">Policy Status</label>
                  <select
                    className="form-select"
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
                  className="btn btn-primary"
                  onClick={loadPolicies}
                  disabled={loading}
                  style={{ height: "35px" }}
                >
                  {loading ? <span className="spinner-inline" /> : <i className="bi bi-arrow-clockwise" />}
                  Refresh
                </button>
              </div>
            </div>

            {/* Table View: Exactly One Row Per Bank */}
            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: "var(--ink-muted)" }}>
                Loading bank policy guidelines...
              </div>
            ) : filteredPolicies.length === 0 ? (
              <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
                <i className="bi bi-file-earmark-x" style={{ fontSize: "2.5rem", color: "var(--ink-muted)", marginBottom: "0.5rem" }} />
                <h3 style={{ fontSize: "1.125rem", color: "var(--ink)", marginBottom: "0.25rem" }}>No Matching Policies Found</h3>
                <p style={{ color: "var(--ink-soft)", fontSize: "0.8125rem" }}>
                  Try adjusting your search criteria or bank name filter.
                </p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th style={{ width: 45 }}>#</th>
                      <th>Bank Name</th>
                      <th>Master Policy File</th>
                      <th>Loan Category</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right", minWidth: 220 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPolicies.map((policy: any, idx: number) => {
                      const status = (policy.status || "active").toLowerCase()
                      const masterFileName = policy.attachment_file_name || policy.file_name || `${policy.bank_name}_Master_Policy.txt`
                      return (
                        <tr key={policy.bank_id || policy.id || idx}>
                          <td style={{ color: "var(--ink-muted)", fontWeight: 500 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600, color: "var(--ink)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <i className="bi bi-bank" style={{ color: "var(--accent)" }} />
                              {policy.bank_name || policy.bank_code || "Partner Bank"}
                            </div>
                          </td>
                          <td>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontSize: "0.8125rem",
                                color: "var(--ink)",
                                background: "var(--surface-2)",
                                padding: "0.25rem 0.6rem",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border)",
                                maxWidth: "320px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={masterFileName}
                            >
                              <i className="bi bi-file-earmark-text" style={{ color: "var(--accent)", flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                {masterFileName}
                              </span>
                            </div>
                          </td>
                          <td style={{ color: "var(--accent)", fontWeight: 500 }}>
                            {policy.loan_type || "General Policy"}
                          </td>
                          <td>
                            <span className={`status-pill ${status === "active" ? "success" : "warning"}`}>
                              {status === "review" ? "In Review" : status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "0.375rem", alignItems: "center", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="View Master Document"
                                onClick={() => {
                                  if (!user?.role) {
                                    checkAuth()
                                  }
                                  const fileName = masterFileName
                                  const extractedText = policy.attachment_extracted_text || ""
                                  if (extractedText) {
                                    setActiveViewerFile({
                                      id: policy.attachment_id || policy.file_id || policy.bank_id || policy.id,
                                      file_id: policy.attachment_id || policy.file_id || policy.id,
                                      bank_id: policy.bank_id,
                                      file_name: fileName,
                                      bank_name: policy.bank_name,
                                      extracted_text: extractedText,
                                      file_size_bytes: policy.file_size_bytes || new Blob([extractedText]).size,
                                    })
                                    setViewerFileDraftText(extractedText)
                                    setIsEditingViewerFile(false)
                                    setModalSearch("")
                                  } else {
                                    handleOpenViewer(policy.attachment_id || policy.bank_id || policy.id, policy)
                                  }
                                }}
                              >
                                <i className="bi bi-eye" /> View
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Edit Policy Rule"
                                onClick={() => handleOpenEdit(policy)}
                              >
                                <i className="bi bi-pencil" /> Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                title="Delete Policy Rule & File"
                                onClick={() => handleOpenDelete(policy)}
                              >
                                <i className="bi bi-trash3" /> Delete
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
        ) : (
          /* POLICY DOCUMENTS TAB */
          <>
            <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by Bank Name or File Name (e.g., HDFC, ICICI, Master_Policy)..."
                    value={searchFileQuery}
                    onChange={(e) => setSearchFileQuery(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={loadPolicyFiles}
                  disabled={loadingFiles}
                  style={{ height: "35px" }}
                >
                  {loadingFiles ? <span className="spinner-inline" /> : <i className="bi bi-arrow-clockwise" />}
                  Refresh
                </button>
              </div>
            </div>

            {loadingFiles ? (
              <div style={{ textAlign: "center", padding: 60, color: "var(--ink-muted)" }}>
                Fetching bank policy documents...
              </div>
            ) : filteredPolicyFiles.length === 0 ? (
              <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
                <i className="bi bi-folder-x" style={{ fontSize: "2.5rem", color: "var(--ink-muted)", marginBottom: "0.5rem" }} />
                <h3 style={{ fontSize: "1.125rem", color: "var(--ink)", marginBottom: "0.25rem" }}>No Policy Documents Found</h3>
                <p style={{ color: "var(--ink-soft)", fontSize: "0.8125rem" }}>
                  Try searching for another bank name.
                </p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th style={{ width: 45 }}>#</th>
                      <th>Bank Name</th>
                      <th>Master Policy File</th>
                      <th style={{ width: 110 }}>Size</th>
                      <th style={{ textAlign: "right", minWidth: 260 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPolicyFiles.map((file: any, idx: number) => {
                      const kbSize = file.file_size_bytes
                        ? file.file_size_bytes > 1024 * 1024
                          ? (file.file_size_bytes / (1024 * 1024)).toFixed(1) + " MB"
                          : (file.file_size_bytes / 1024).toFixed(1) + " KB"
                        : file.text_length
                        ? (file.text_length / 1024).toFixed(1) + " KB"
                        : "0 KB"
                      return (
                        <tr key={file.bank_id || file.id || idx}>
                          <td style={{ color: "var(--ink-muted)", fontWeight: 500 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600, color: "var(--ink)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <i className="bi bi-bank" style={{ color: "var(--accent)" }} />
                              {file.bank_name}
                            </div>
                          </td>
                          <td>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontSize: "0.8125rem",
                                color: "var(--ink)",
                                background: "var(--surface-2)",
                                padding: "0.25rem 0.6rem",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border)",
                                maxWidth: "340px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={file.file_name}
                            >
                              <i className="bi bi-file-earmark-text" style={{ color: "var(--accent)", flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                {file.file_name}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="badge">{kbSize}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "0.375rem", alignItems: "center", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="View Master Document"
                                onClick={() => handleOpenViewer(file.id, file)}
                              >
                                <i className="bi bi-eye" /> View
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Edit Policy Rule"
                                onClick={() => handleOpenEdit(file)}
                              >
                                <i className="bi bi-pencil" /> Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                title="Delete Policy Rule & File"
                                onClick={() => handleOpenDelete(file)}
                              >
                                <i className="bi bi-trash3" /> Delete
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Download .txt File"
                                onClick={async () => {
                                  if (file.extracted_text) {
                                    handleDownloadText(file.file_name, file.extracted_text)
                                  } else {
                                    const res = await fetch(`/api/policies/extracted-files/${file.id}`)
                                    const data = await res.json()
                                    if (data.success && data.file?.extracted_text) {
                                      handleDownloadText(file.file_name, data.file.extracted_text)
                                    }
                                  }
                                }}
                              >
                                <i className="bi bi-download" /> Download
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

      {/* =========================================================================
          EDIT POLICY RULE MODAL (Matches User Mockup Precisely)
          ========================================================================= */}
      {editModalOpen && (
        <div className="modal-backdrop" onClick={() => !isSavingPolicy && setEditModalOpen(false)}>
          <div className="edit-policy-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="edit-policy-header">
              <div className="edit-policy-title-area">
                <div className="edit-policy-icon-badge">
                  <i className="bi bi-pencil" />
                </div>
                <div>
                  <h2 className="edit-policy-title">Edit Policy Rule</h2>
                  <p className="edit-policy-subtitle">
                    Update the policy details and upload a new policy file if required.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => !isSavingPolicy && setEditModalOpen(false)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg" style={{ fontSize: "1.1rem" }} />
              </button>
            </div>

            {/* Modal Form Body: 2 Columns */}
            <form onSubmit={handleSavePolicy} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div className="edit-policy-body">
                {/* LEFT COLUMN */}
                <div className="edit-col-left">
                  {/* Bank */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Bank</label>
                    <div className="policy-select-wrap">
                      <i className="bi bi-bank policy-select-icon" />
                      <select
                        className="form-select policy-select-has-icon"
                        value={editBankName}
                        onChange={(e) => {
                          const selectedName = e.target.value
                          setEditBankName(selectedName)
                          const matched = allBankOptions.find((b) => b.name === selectedName)
                          if (matched) setEditBankId(matched.id)
                        }}
                      >
                        {allBankOptions.length > 0 ? (
                          allBankOptions.map((b) => (
                            <option key={b.name} value={b.name}>
                              {b.name}
                            </option>
                          ))
                        ) : (
                          <option value={editBankName}>{editBankName}</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Policy Version */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Policy Version</label>
                    <select
                      className="form-select"
                      value={editPolicyVersion}
                      onChange={(e) => setEditPolicyVersion(e.target.value)}
                    >
                      <option value="Current Version">Current Version</option>
                      <option value="V1">V1 (Initial)</option>
                      <option value="V2">V2 (Updated)</option>
                      <option value="V3">V3 (Latest)</option>
                    </select>
                    <button
                      type="button"
                      className="new-version-btn"
                      onClick={() => {
                        const customV = prompt("Enter new policy version name (e.g. V2, V3):", "V2")
                        if (customV) setEditPolicyVersion(customV)
                      }}
                    >
                      <i className="bi bi-plus" style={{ fontSize: "1.15rem" }} /> New Version
                    </button>
                  </div>

                  {/* Loan Type */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Loan Type</label>
                    <select
                      className="form-select"
                      value={editLoanType}
                      onChange={(e) => setEditLoanType(e.target.value)}
                    >
                      <option value="Personal Loan">Personal Loan</option>
                      <option value="Home Loan">Home Loan</option>
                      <option value="Auto Loan">Auto Loan</option>
                      <option value="Business Loan">Business Loan</option>
                      <option value="Education Loan">Education Loan</option>
                    </select>
                  </div>

                  {/* Employment */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Employment</label>
                    <select
                      className="form-select"
                      value={editEmployment}
                      onChange={(e) => setEditEmployment(e.target.value)}
                    >
                      <option value="Salaried">Salaried</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Business Owner">Business Owner</option>
                      <option value="Professional">Professional</option>
                    </select>
                  </div>

                  {/* Policy File Info Callout Card */}
                  <div className="policy-info-card">
                    <div className="policy-info-icon">i</div>
                    <div>
                      <h4 className="policy-info-title">Policy File</h4>
                      <p className="policy-info-text">
                        You can upload a new policy file to replace the existing one. The new file will be used for this policy rule.
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="edit-col-right">
                  {/* CIBIL Range */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">CIBIL Range</label>
                    <div className="range-input-group">
                      <input
                        type="number"
                        className="form-control range-input"
                        value={editMinCibil}
                        onChange={(e) => setEditMinCibil(e.target.value)}
                        placeholder="700"
                      />
                      <span className="range-separator">to</span>
                      <input
                        type="number"
                        className="form-control range-input"
                        value={editMaxCibil}
                        onChange={(e) => setEditMaxCibil(e.target.value)}
                        placeholder="900"
                      />
                    </div>
                  </div>

                  {/* Salary Range (₹) */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Salary Range (₹)</label>
                    <div className="range-input-group">
                      <div className="range-affix-input">
                        <span className="range-affix-label">Min</span>
                        <input
                          type="number"
                          className="form-control"
                          value={editMinSalary}
                          onChange={(e) => setEditMinSalary(e.target.value)}
                          placeholder="30000"
                        />
                      </div>
                      <span className="range-separator">to</span>
                      <div className="range-affix-input">
                        <span className="range-affix-label">Max</span>
                        <input
                          type="number"
                          className="form-control"
                          value={editMaxSalary}
                          onChange={(e) => setEditMaxSalary(e.target.value)}
                          placeholder="600000"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Age Range */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Age Range</label>
                    <div className="range-input-group">
                      <input
                        type="number"
                        className="form-control range-input"
                        value={editMinAge}
                        onChange={(e) => setEditMinAge(e.target.value)}
                        placeholder="21"
                      />
                      <span className="range-separator">to</span>
                      <input
                        type="number"
                        className="form-control range-input"
                        value={editMaxAge}
                        onChange={(e) => setEditMaxAge(e.target.value)}
                        placeholder="60"
                      />
                    </div>
                  </div>

                  {/* Loan Amount (₹) */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Loan Amount (₹)</label>
                    <div className="range-input-group">
                      <input
                        type="number"
                        className="form-control range-input"
                        value={editMinLoanAmount}
                        onChange={(e) => setEditMinLoanAmount(e.target.value)}
                        placeholder="200000"
                      />
                      <span className="range-separator">to</span>
                      <input
                        type="number"
                        className="form-control range-input"
                        value={editMaxLoanAmount}
                        onChange={(e) => setEditMaxLoanAmount(e.target.value)}
                        placeholder="5000000"
                      />
                    </div>
                  </div>

                  {/* Tenure (months) */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Tenure (months)</label>
                    <div className="range-input-group">
                      <input
                        type="number"
                        className="form-control range-input"
                        value={editMinTenure}
                        onChange={(e) => setEditMinTenure(e.target.value)}
                        placeholder="12"
                      />
                      <span className="range-separator">to</span>
                      <input
                        type="number"
                        className="form-control range-input"
                        value={editMaxTenure}
                        onChange={(e) => setEditMaxTenure(e.target.value)}
                        placeholder="60"
                      />
                    </div>
                  </div>

                  {/* FOIR (%) / ROI (%) / Processing Fee (%) */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">FOIR (%) / ROI (%) / Processing Fee (%)</label>
                    <div className="triplet-grid">
                      <div className="triplet-col">
                        <label>FOIR</label>
                        <input
                          type="number"
                          step="0.1"
                          className="form-control"
                          value={editFoir}
                          onChange={(e) => setEditFoir(e.target.value)}
                          placeholder="22"
                        />
                      </div>
                      <div className="triplet-col">
                        <label>ROI</label>
                        <input
                          type="number"
                          step="0.1"
                          className="form-control"
                          value={editRoi}
                          onChange={(e) => setEditRoi(e.target.value)}
                          placeholder="12.5"
                        />
                      </div>
                      <div className="triplet-col">
                        <label>Processing Fee</label>
                        <input
                          type="number"
                          step="0.1"
                          className="form-control"
                          value={editProcessingFee}
                          onChange={(e) => setEditProcessingFee(e.target.value)}
                          placeholder="1.5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Status</label>
                    <select
                      className="form-select"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <option value="Active">Active</option>
                      <option value="In Review">In Review</option>
                      <option value="Draft">Draft</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  {/* Attach New Policy File (Optional) */}
                  <div className="policy-field-group" style={{ marginBottom: 0 }}>
                    <label className="policy-field-label">
                      Attach New Policy File <span style={{ fontWeight: 400, color: "var(--ink-muted)", fontSize: "0.75rem" }}>(Optional)</span>
                    </label>

                    {/* Drag & drop upload box */}
                    <div
                      className={`file-dropzone-box ${isDragging ? "dragging" : ""}`}
                      onClick={() => editFileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setIsDragging(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        setIsDragging(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDragging(false)
                        const file = e.dataTransfer.files?.[0]
                        if (file) {
                          setEditAttachedFile(file)
                          setEditExistingFileName(file.name)
                          const sizeStr = file.size > 1024 * 1024
                            ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
                            : (file.size / 1024).toFixed(1) + " KB"
                          setEditExistingFileSize(sizeStr)
                        }
                      }}
                    >
                      <p className="file-dropzone-text">
                        <i className="bi bi-paperclip" style={{ marginRight: "0.35rem", fontSize: "1rem" }} />
                        <span className="file-dropzone-link">Click to upload</span> or drag and drop
                      </p>
                      <p className="file-dropzone-sub">PDF, DOC, DOCX (Max 10MB)</p>
                    </div>

                    {/* Attached file preview chip */}
                    {editExistingFileName && (
                      <div className="attached-file-chip">
                        <div className="attached-file-info">
                          <i className="bi bi-file-earmark-pdf-fill attached-file-icon" />
                          <div style={{ minWidth: 0 }}>
                            <div className="attached-file-name" title={editExistingFileName}>
                              {editExistingFileName}
                            </div>
                            <div className="attached-file-size">
                              {editExistingFileSize}
                            </div>
                          </div>
                        </div>

                        <div className="attached-file-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                            onClick={() => editFileInputRef.current?.click()}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "0.25rem 0.5rem" }}
                            onClick={() => {
                              setEditAttachedFile(null)
                              setEditExistingFileName("")
                              setEditExistingFileSize("")
                            }}
                            title="Remove attached file"
                          >
                            <i className="bi bi-x-lg" style={{ fontSize: "0.875rem" }} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="edit-policy-footer">
                <button
                  type="button"
                  className="btn-delete-policy"
                  onClick={() => {
                    handleOpenDelete(editPolicy)
                  }}
                >
                  <i className="bi bi-trash3" /> Delete Policy
                </button>

                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => !isSavingPolicy && setEditModalOpen(false)}
                    disabled={isSavingPolicy}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn-update-rule"
                    disabled={isSavingPolicy}
                  >
                    {isSavingPolicy ? (
                      <span className="spinner-inline" />
                    ) : (
                      <i className="bi bi-floppy" />
                    )}
                    Update Rule
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          DELETE CONFIRMATION MODAL
          ========================================================================= */}
      {deleteConfirmPolicy && (
        <div className="modal-backdrop" onClick={() => !isDeletingPolicy && setDeleteConfirmPolicy(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: 480, padding: 0, overflow: "hidden", borderRadius: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "1.75rem 1.5rem", textAlign: "center" }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: "#fee2e2",
                  color: "#ef4444",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.75rem",
                  marginBottom: "1rem",
                }}
              >
                <i className="bi bi-trash3" />
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>
                Delete Policy Rule?
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--ink-soft)", lineHeight: 1.5, margin: "0 auto 1.5rem", maxWidth: 380 }}>
                Are you sure you want to delete the policy rule for{" "}
                <strong style={{ color: "var(--ink)" }}>{deleteConfirmPolicy.bank_name || "this bank"}</strong> and remove its associated master text file{" "}
                <strong style={{ color: "var(--ink)" }}>({deleteConfirmPolicy.file_name || deleteConfirmPolicy.attachment_file_name || "master document"})</strong>?
                <br />
                <span style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.8125rem", display: "inline-block", marginTop: "0.5rem" }}>
                  This action cannot be undone.
                </span>
              </p>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minWidth: 100 }}
                  onClick={() => setDeleteConfirmPolicy(null)}
                  disabled={isDeletingPolicy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ minWidth: 150, background: "#ef4444", color: "#ffffff", border: "none" }}
                  onClick={handleConfirmDelete}
                  disabled={isDeletingPolicy}
                >
                  {isDeletingPolicy ? <span className="spinner-inline" /> : <i className="bi bi-trash3" style={{ marginRight: "0.375rem" }} />}
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POLICY DOCUMENT VIEWER & EDITOR MODAL */}
      {activeViewerFile && (
        <div className="modal-backdrop" onClick={handleCloseViewer}>
          <div
            className="modal-content"
            style={{ maxWidth: 1040, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <i className="bi bi-file-earmark-text" style={{ color: "var(--accent)" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeViewerFile.file_name || "Policy Document"}
                  </span>
                  {isEditingViewerFile && (
                    <span
                      className="badge"
                      style={{
                        background: "rgba(37, 99, 235, 0.12)",
                        color: "var(--accent)",
                        border: "1px solid rgba(37, 99, 235, 0.3)",
                        fontSize: "0.75rem",
                        padding: "0.2rem 0.5rem",
                        fontWeight: 600,
                      }}
                    >
                      <i className="bi bi-pencil-fill" style={{ marginRight: "0.25rem", fontSize: "0.7rem" }} />
                      Editor Mode (Admin)
                    </span>
                  )}
                </h3>
                <p style={{ color: "var(--ink-soft)", fontSize: "0.75rem", margin: "2px 0 0 0" }}>
                  Bank: <strong>{activeViewerFile.bank_name || "Partner Bank"}</strong>
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.375rem", alignItems: "center", flexShrink: 0 }}>
                {!isEditingViewerFile ? (
                  <>
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        title="Edit Master Policy Document"
                        onClick={handleEnterEdit}
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                      >
                        <i className="bi bi-pencil" /> Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Download Master Document"
                      onClick={() => handleDownloadText(activeViewerFile.file_name, activeViewerFile.extracted_text || "")}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                    >
                      <i className="bi bi-download" /> Download
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleCloseViewer}
                      aria-label="Close modal"
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Download policy text"
                      onClick={() => handleDownloadText(activeViewerFile.file_name, viewerFileDraftText)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                    >
                      <i className="bi bi-download" /> Download
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleCloseViewer}
                      aria-label="Close modal"
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* If in View Mode: Search Bar & Document Reader */}
            {!isEditingViewerFile ? (
              <>
                {/* Modal Search Bar */}
                <div style={{ padding: "0.75rem 1.25rem", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <i className="bi bi-search" style={{ color: "var(--ink-muted)", fontSize: "0.875rem" }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search inside master policy document..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    style={{ flex: 1, fontSize: "0.8125rem" }}
                  />
                  {modalSearch && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setModalSearch("")}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Modal Document Reader */}
                <div
                  className="modal-body"
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: "0.8125rem",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    background: "var(--bg)",
                    color: "var(--ink)",
                    minHeight: 380,
                    maxHeight: "68vh",
                    overflowY: "auto",
                    padding: "1.25rem",
                  }}
                >
                  {loadingFileContent ? (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--ink-muted)" }}>
                      Loading policy document content...
                    </div>
                  ) : !activeViewerFile.extracted_text ? (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--ink-muted)" }}>
                      No document content available for this policy file.
                    </div>
                  ) : (
                    highlightMatch(activeViewerFile.extracted_text, modalSearch)
                  )}
                </div>
              </>
            ) : (
              /* If in Edit Mode: Editor Info Bar, Textarea & Footer */
              <>
                {/* Editor Status Bar */}
                <div
                  style={{
                    padding: "0.625rem 1.25rem",
                    background: "var(--surface-2)",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--ink-soft)" }}>
                    <i className="bi bi-file-earmark-code" style={{ color: "var(--accent)" }} />
                    <span>
                      Editing file: <strong style={{ color: "var(--ink)", fontFamily: "monospace" }}>policy-master-files/{activeViewerFile.file_name}</strong>
                    </span>
                    <span style={{ color: "var(--border)" }}>•</span>
                    <span style={{ color: "var(--ink-muted)" }}>Direct in-place update (no duplicate files created)</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ color: "var(--ink-muted)" }}>
                      {viewerFileDraftText.length.toLocaleString()} chars · {viewerFileDraftText.split("\n").length.toLocaleString()} lines
                    </span>
                    {hasUnsavedChanges ? (
                      <span style={{ color: "#f59e0b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                        Unsaved changes
                      </span>
                    ) : (
                      <span style={{ color: "#10b981", fontWeight: 500 }}>
                        ✓ In sync with disk
                      </span>
                    )}
                  </div>
                </div>

                {/* Text Editor Area */}
                <div style={{ padding: "0.75rem 1.25rem", background: "var(--bg)", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                  <textarea
                    className="form-control"
                    value={viewerFileDraftText}
                    onChange={(e) => setViewerFileDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault()
                        const start = e.currentTarget.selectionStart
                        const end = e.currentTarget.selectionEnd
                        const val = e.currentTarget.value
                        setViewerFileDraftText(val.substring(0, start) + "    " + val.substring(end))
                        setTimeout(() => {
                          if (e.currentTarget) {
                            e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 4
                          }
                        }, 0)
                      }
                    }}
                    spellCheck={false}
                    placeholder="Enter or edit master policy document content here..."
                    style={{
                      width: "100%",
                      height: "56vh",
                      minHeight: 380,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: "0.8125rem",
                      lineHeight: 1.6,
                      background: "var(--surface)",
                      color: "var(--ink)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "0.875rem",
                      resize: "vertical",
                      whiteSpace: "pre-wrap",
                      tabSize: 4,
                    }}
                  />
                </div>

                {/* Editor Action Footer */}
                <div className="modal-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-2)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <i className="bi bi-info-circle" />
                    <span>Saving overwrites <strong>{activeViewerFile.file_name}</strong> on disk. Download will provide this updated file.</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleCancelEdit}
                      disabled={isSavingFileContent}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ background: "var(--accent)", color: "#ffffff", border: "none", minWidth: 125 }}
                      onClick={handleSaveFileContent}
                      disabled={isSavingFileContent}
                    >
                      {isSavingFileContent ? <><span className="spinner-inline" /> Saving...</> : <><i className="bi bi-check-lg" style={{ marginRight: "0.25rem" }} /> Save Changes</>}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
