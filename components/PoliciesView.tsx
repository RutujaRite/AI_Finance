/**
 * Modern CreditWise AI Policies Page
 * 2-Tab Layout:
 *  - Tab 1: Policy Master Files (table view, search, bank filter, download list, actions)
 *  - Tab 2: Upload Policy Documents (dedicated 3-step bank-gated upload page)
 */

"use client"

import React, { useEffect, useState, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import {
  Eye,
  Pencil,
  Trash2,
  Building2,
  Landmark,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  FileText,
  Lock,
  Unlock,
  X,
} from "lucide-react"
import ModernSearchBar from "@/components/ui/ModernSearchBar"
import ModernConfirmDialog from "@/components/ui/ModernConfirmDialog"

const PRESET_PARTNER_BANKS = [
  "Axis Bank",
  "Bandhan Bank",
  "HDFC Bank",
  "ICICI Bank",
  "IDFC FIRST Bank",
  "IndusInd Bank",
  "Kotak Mahindra Bank",
  "SBM Bank India",
  "Yes Bank",
  "Aditya Birla Capital",
  "Axis Finance",
  "Bajaj Finserv",
  "Bajaj Markets",
  "Cholamandalam Investment & Finance",
  "Fibe (EarlySalary)",
  "Finnable Credit",
  "Home Loan Services",
  "L&T Finance",
  "Piramal Finance",
  "Poonawalla Fincorp",
  "SMFG India Credit",
  "TATA Capital",
  "Utkarsh Small Finance Bank",
]

function formatCurrency(val?: number | string | null): string {
  if (val == null || val === "" || val === undefined) return "N/A"
  const num = Number(val)
  if (isNaN(num)) return String(val)
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1).replace(/\.0$/, "")} Cr`
  if (num >= 100000) return `₹${(num / 100000).toFixed(1).replace(/\.0$/, "")} L`
  if (num >= 1000) return `₹${(num / 1000).toFixed(0)}k`
  return `₹${num.toLocaleString("en-IN")}`
}

export default function PoliciesView({
  user: propUser,
  embedded = false,
}: {
  user?: any
  embedded?: boolean
}) {
  const router = useRouter()
  const [user, setUser] = useState<any>(propUser || null)
  const [policyFiles, setPolicyFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [activeTab, setActiveTab] = useState<"files" | "upload">("files")

  // Search & Filters for Files Tab
  const [searchFileQuery, setSearchFileQuery] = useState("")
  const [selectedFileBank, setSelectedFileBank] = useState("all")

  // Pagination (15 items per page)
  const [filePage, setFilePage] = useState(1)
  const PAGE_SIZE = 15

  useEffect(() => {
    setFilePage(1)
  }, [searchFileQuery, selectedFileBank])

  // Viewer / Editor Modal State
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

  // Delete Confirmation Modal State
  const [deleteConfirmPolicy, setDeleteConfirmPolicy] = useState<any | null>(null)
  const [isDeletingPolicy, setIsDeletingPolicy] = useState(false)

  // Tab 2: 3-Step Bank-Gated Upload State
  const [tab2SelectedBank, setTab2SelectedBank] = useState<string>("")
  const [tab2IsCustomBank, setTab2IsCustomBank] = useState<boolean>(false)
  const [tab2CustomBankName, setTab2CustomBankName] = useState<string>("")
  const [tab2Uploading, setTab2Uploading] = useState<boolean>(false)
  const [tab2IsDragOver, setTab2IsDragOver] = useState<boolean>(false)
  const tab2FileInputRef = useRef<HTMLInputElement | null>(null)

  const tab2EffectiveBank = useMemo(() => {
    return tab2IsCustomBank ? tab2CustomBankName.trim() : tab2SelectedBank.trim()
  }, [tab2IsCustomBank, tab2CustomBankName, tab2SelectedBank])

  const isTab2UploadUnlocked = useMemo(() => {
    return !!tab2EffectiveBank
  }, [tab2EffectiveBank])

  useEffect(() => {
    if (propUser) {
      setUser(propUser)
      if (!propUser.role) {
        checkAuth()
      }
    } else {
      checkAuth()
    }
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
      if (!res.ok) return
      const data = await res.json()
      if (data.success && data.user) {
        setUser(data.user)
      }
    } catch (e) {
      console.warn("checkAuth error", e)
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

  async function handleTab2FileUpload(file: File) {
    if (!file) return
    if (!isTab2UploadUnlocked) {
      showToast("Please select or enter a Bank / Lender name before uploading.", "error")
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast("File size exceeds 50 MB limit", "error")
      return
    }

    setTab2Uploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("bank_name", tab2EffectiveBank)
      formData.append("loan_type", "Personal Loan")
      formData.append("policy_version", "V1")

      const res = await fetch("/api/policies", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast(`✓ Master policy file for "${tab2EffectiveBank}" uploaded successfully.`, "success")
        loadPolicyFiles()
        setTab2SelectedBank("")
        setTab2IsCustomBank(false)
        setTab2CustomBankName("")
      } else {
        showToast(`✕ Upload failed: ${data.error || "Unknown server error"}`, "error")
      }
    } catch (err) {
      console.error("Tab 2 upload error", err)
      showToast("✕ Network error while uploading policy file", "error")
    } finally {
      setTab2Uploading(false)
    }
  }

  // Open Viewer for policy text file
  function handleOpenViewerFile(policy: any) {
    if (!user?.role) {
      checkAuth()
    }
    const fileName = policy.attachment_file_name || policy.file_name || `${policy.bank_name || "Bank"}_Master_Policy.txt`
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
      handleOpenViewer(policy.attachment_id || policy.file_id || policy.bank_id || policy.id, policy)
    }
  }

  // Open Editor for policy text file
  function handleOpenEditorFile(policy: any) {
    if (!user?.role) {
      checkAuth()
    }
    const fileName = policy.attachment_file_name || policy.file_name || `${policy.bank_name || "Bank"}_Master_Policy.txt`
    const extractedText = policy.attachment_extracted_text || ""
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
    setIsEditingViewerFile(true)
    setModalSearch("")
  }

  // Delete Policy File Confirmation
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
          `✓ Deleted master policy file (${fileName}) for ${deleteConfirmPolicy.bank_name}.`,
          "success"
        )
        setDeleteConfirmPolicy(null)
        loadPolicyFiles()
      } else {
        showToast(`✕ Failed to delete policy file: ${data.error || "Unknown error"}`, "error")
      }
    } catch (err) {
      console.error("Failed to delete policy file", err)
      showToast("✕ Failed to delete policy file", "error")
    } finally {
      setIsDeletingPolicy(false)
    }
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

  // Unique bank options for Policy Files filter dropdown
  const fileBankOptions = useMemo(() => {
    const set = new Set<string>()
    policyFiles.forEach((f) => {
      const b = (f.bank_name || "").trim()
      if (b) set.add(b)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [policyFiles])

  // Filtered Policy Files
  const filteredPolicyFiles = useMemo(() => {
    return policyFiles.filter((file) => {
      const matchesBank =
        selectedFileBank === "all" ||
        (file.bank_name || "").toLowerCase() === selectedFileBank.toLowerCase()

      const q = searchFileQuery.toLowerCase().trim()
      if (!q) return matchesBank

      const bName = (file.bank_name || "").toLowerCase()
      const fName = (file.file_name || "").toLowerCase()
      const snippet = (file.snippet || "").toLowerCase()
      return matchesBank && (bName.includes(q) || fName.includes(q) || snippet.includes(q))
    })
  }, [policyFiles, searchFileQuery, selectedFileBank])

  // Document files pagination
  const totalFilteredFiles = filteredPolicyFiles.length
  const totalFilePages = Math.max(1, Math.ceil(totalFilteredFiles / PAGE_SIZE))
  const validCurrentFilePage = Math.min(Math.max(1, filePage), totalFilePages)
  const startFileIndex = totalFilteredFiles === 0 ? 0 : (validCurrentFilePage - 1) * PAGE_SIZE
  const endFileIndex = Math.min(startFileIndex + PAGE_SIZE, totalFilteredFiles)
  const paginatedFiles = filteredPolicyFiles.slice(startFileIndex, endFileIndex)

  // Export Policy Files to Excel
  const exportPolicyFilesToExcel = () => {
    if (filteredPolicyFiles.length === 0) return

    const exportData = filteredPolicyFiles.map((file: any, idx: number) => ({
      "Sr No": idx + 1,
      "Bank Name": file.bank_name || "N/A",
      "Master Policy File": file.file_name || "N/A",
      "File Size (Bytes)": file.file_size_bytes || 0,
      "Text Length (Chars)": file.text_length || 0,
      "Updated Date": file.updated_at ? new Date(file.updated_at).toLocaleString("en-IN") : "N/A",
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Policy Files")

    const filename = `Policy_Master_Files_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(workbook, filename)
  }

  return (
    <>
      <style>{`
        .bp-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
        }

        .bp-header-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          gap: 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          transition: background-color 0.2s, border-color 0.2s;
        }

        .bp-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .bp-icon-badge {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #2563eb;
          border-radius: 8px;
          border: 1px solid #dbeafe;
          flex-shrink: 0;
        }

        .bp-tab-pill-group {
          display: inline-flex;
          align-items: center;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 10px;
          gap: 3px;
        }

        .bp-tab-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 7px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #64748b;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .bp-tab-pill:hover:not(.active) {
          color: #0f172a;
          background: rgba(255,255,255,0.6);
        }

        .bp-tab-pill.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
        }

        .bp-tab-pill-count {
          padding: 1px 6px;
          border-radius: 9999px;
          font-size: 0.6875rem;
          font-weight: 700;
          background: #e2e8f0;
          color: #475569;
        }

        .bp-tab-pill.active .bp-tab-pill-count {
          background: #eff6ff;
          color: #2563eb;
        }

        .bp-refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .bp-refresh-btn:hover:not(:disabled) {
          background: #f1f5f9;
          color: #0f172a;
        }

        .bp-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: #ffffff;
          border-top: 1px solid #f1f5f9;
          font-size: 0.75rem;
          color: #64748b;
        }

        .bp-pagination {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .bp-page-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          color: #334155;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .bp-page-btn:hover:not(:disabled) {
          background: #f1f5f9;
          color: #0f172a;
        }

        .bp-page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .bp-page-indicator {
          font-weight: 600;
          color: #334155;
          padding: 0 4px;
        }

        .bp-toast-notification {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-radius: 10px;
          font-size: 0.8125rem;
          font-weight: 600;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1);
          animation: bpToastSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .bp-toast-success {
          background: #065f46;
          color: #ffffff;
          border: 1px solid #047857;
        }

        .bp-toast-error {
          background: #991b1b;
          color: #ffffff;
          border: 1px solid #b91c1c;
        }

        @keyframes bpToastSlide {
          from {
            transform: translateY(-16px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Dark Mode Support */
        .dark .bp-header-card,
        [data-theme="dark"] .bp-header-card,
        [data-bs-theme="dark"] .bp-header-card {
          background: #0f172a !important;
          border-color: #334155 !important;
        }

        .dark .bp-tab-pill-group,
        [data-theme="dark"] .bp-tab-pill-group,
        [data-bs-theme="dark"] .bp-tab-pill-group {
          background: #1e293b !important;
        }

        .dark .bp-tab-pill,
        [data-theme="dark"] .bp-tab-pill,
        [data-bs-theme="dark"] .bp-tab-pill {
          color: #94a3b8 !important;
        }

        .dark .bp-tab-pill:hover:not(.active),
        [data-theme="dark"] .bp-tab-pill:hover:not(.active),
        [data-bs-theme="dark"] .bp-tab-pill:hover:not(.active) {
          color: #f8fafc !important;
          background: rgba(255, 255, 255, 0.08) !important;
        }

        .dark .bp-tab-pill.active,
        [data-theme="dark"] .bp-tab-pill.active,
        [data-bs-theme="dark"] .bp-tab-pill.active {
          background: #0f172a !important;
          color: #ffffff !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
        }

        .dark .bp-tab-pill-count,
        [data-theme="dark"] .bp-tab-pill-count,
        [data-bs-theme="dark"] .bp-tab-pill-count {
          background: #334155 !important;
          color: #cbd5e1 !important;
        }

        .dark .bp-tab-pill.active .bp-tab-pill-count,
        [data-theme="dark"] .bp-tab-pill.active .bp-tab-pill-count,
        [data-bs-theme="dark"] .bp-tab-pill.active .bp-tab-pill-count {
          background: rgba(37, 99, 235, 0.25) !important;
          color: #60a5fa !important;
        }

        .dark .bp-refresh-btn,
        [data-theme="dark"] .bp-refresh-btn,
        [data-bs-theme="dark"] .bp-refresh-btn {
          background: #1e293b !important;
          color: #cbd5e1 !important;
          border-color: #334155 !important;
        }

        .dark .bp-footer,
        [data-theme="dark"] .bp-footer,
        [data-bs-theme="dark"] .bp-footer {
          background: #0f172a !important;
          border-color: #1e293b !important;
          color: #94a3b8 !important;
        }

        .dark .bp-page-btn,
        [data-theme="dark"] .bp-page-btn,
        [data-bs-theme="dark"] .bp-page-btn {
          background: #1e293b !important;
          color: #cbd5e1 !important;
          border-color: #334155 !important;
        }

        .dark .bp-page-indicator,
        [data-theme="dark"] .bp-page-indicator,
        [data-bs-theme="dark"] .bp-page-indicator {
          color: #cbd5e1 !important;
        }
      `}</style>

      <div className="bp-container">
        {/* Toast Alert */}
        {actionToast && (
          <div
            className={`bp-toast-notification ${
              actionToast.type === "success" ? "bp-toast-success" : "bp-toast-error"
            }`}
          >
            <span>{actionToast.message}</span>
            <button
              type="button"
              onClick={() => setActionToast(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "0 0 0 6px" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Compact Header Pill Bar */}
        <div className="bp-header-card">
          <div className="bp-header-left">
            <div
              className="bp-icon-badge"
              title="Bank Policy Documents"
              aria-label="Bank Policy Documents"
            >
              <Building2 className="w-5 h-5" />
            </div>

            {/* Sub-tab Pill Switcher */}
            <div className="bp-tab-pill-group" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "files"}
                className={`bp-tab-pill ${activeTab === "files" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("files")
                  setFilePage(1)
                }}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Policy Master Files</span>
                <span className="bp-tab-pill-count">{policyFiles.length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "upload"}
                className={`bp-tab-pill ${activeTab === "upload" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("upload")
                }}
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Policy Documents</span>
              </button>
            </div>
          </div>

          <div className="bp-header-right">
            <button
              type="button"
              className="bp-refresh-btn"
              onClick={loadPolicyFiles}
              disabled={loadingFiles}
              title="Refresh Bank Policy Master Files"
              aria-label="Refresh Bank Policy Master Files"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loadingFiles ? "animate-spin text-blue-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: POLICY MASTER FILES
            ========================================================================= */}
        {activeTab === "files" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
            {/* Metric Cards Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "16px",
                marginBottom: "4px",
              }}
            >
              <div className="cw-card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "#f5f3ff",
                    border: "1px solid #ede9fe",
                    color: "#7c3aed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <FileSpreadsheet style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white" style={{ fontSize: "1.35rem", fontWeight: 800 }}>
                    {policyFiles.length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Policy Files &amp; Spreadsheets</div>
                </div>
              </div>

              <div className="cw-card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "#eff6ff",
                    border: "1px solid #dbeafe",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Landmark style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white" style={{ fontSize: "1.35rem", fontWeight: 800 }}>
                    {fileBankOptions.length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Covered Banks &amp; Lenders</div>
                </div>
              </div>

              <div className="cw-card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "#ecfdf5",
                    border: "1px solid #d1fae5",
                    color: "#059669",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle2 style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white" style={{ fontSize: "1.35rem", fontWeight: 800 }}>
                    PDF / TXT / XLSX
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Supported Master Formats</div>
                </div>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div
              className="cw-card"
              style={{
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span
                  className="cw-badge cw-badge-info"
                  style={{ fontSize: "0.8125rem", padding: "5px 12px" }}
                >
                  <span>Policy Files:</span>
                  <strong style={{ marginLeft: 4 }}>{filteredPolicyFiles.length}</strong>
                </span>

                <ModernSearchBar
                  value={searchFileQuery}
                  onChange={setSearchFileQuery}
                  placeholder="Search policy files..."
                  width={280}
                />

                <select
                  className="cw-select"
                  value={selectedFileBank}
                  onChange={(e) => setSelectedFileBank(e.target.value)}
                >
                  <option value="all">All Lenders / Banks ({fileBankOptions.length})</option>
                  {fileBankOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {(searchFileQuery || selectedFileBank !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchFileQuery("")
                      setSelectedFileBank("all")
                    }}
                    className="cw-btn-secondary"
                  >
                    Reset Filters
                  </button>
                )}

                <button
                  type="button"
                  className="cw-btn-secondary"
                  onClick={exportPolicyFilesToExcel}
                  disabled={filteredPolicyFiles.length === 0}
                  title="Download Policy Files directory to Excel"
                >
                  <Download style={{ width: 14, height: 14 }} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Download List</span>
                </button>

                <button
                  type="button"
                  className="cw-btn-secondary"
                  onClick={loadPolicyFiles}
                  disabled={loadingFiles}
                >
                  <RotateCcw style={{ width: 14, height: 14 }} className={loadingFiles ? "animate-spin text-blue-600" : ""} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  className="cw-btn-primary"
                  onClick={() => setActiveTab("upload")}
                >
                  <UploadCloud style={{ width: 14, height: 14 }} />
                  <span>Upload Policy Document</span>
                </button>
              </div>
            </div>

            {/* Policy Master Files Table Container */}
            <div className="cw-card shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Card Header */}
              <div
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid var(--border)",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <h3
                  className="text-slate-900 dark:text-white"
                  style={{
                    margin: 0,
                    fontSize: "1rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>Policy Master Files Directory</span>
                  <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500 }}>
                    ({filteredPolicyFiles.length})
                  </span>
                </h3>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    className="cw-btn-secondary"
                    onClick={loadPolicyFiles}
                    disabled={loadingFiles}
                    title="Refresh Policy Files"
                  >
                    <RotateCcw style={{ width: 14, height: 14 }} className={loadingFiles ? "animate-spin text-blue-600" : ""} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Desktop Table: Hidden on Mobile */}
              <div className="hidden md:block cw-table-container border-0">
                <table className="cw-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60, textAlign: "center" }}>#</th>
                      <th style={{ width: 220, textAlign: "left" }}>Bank Name</th>
                      <th style={{ minWidth: 260, textAlign: "left" }}>Master Policy File</th>
                      <th style={{ width: 120, textAlign: "center" }}>Size</th>
                      <th style={{ width: 160, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingFiles ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                          <RotateCcw style={{ width: 24, height: 24, margin: "0 auto 8px" }} className="animate-spin text-blue-600" />
                          <p style={{ margin: 0, fontSize: "0.875rem" }}>Loading master policy files...</p>
                        </td>
                      </tr>
                    ) : filteredPolicyFiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                          <FileText style={{ width: 36, height: 36, color: "#94a3b8", margin: "0 auto 8px" }} />
                          <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", fontWeight: 600 }} className="text-slate-900 dark:text-white">
                            No Policy Files Found
                          </h4>
                          <p style={{ margin: 0, fontSize: "0.8125rem" }}>
                            {searchFileQuery || selectedFileBank !== "all"
                              ? "Try adjusting your search criteria or resetting filters."
                              : "Switch to the Upload tab to add bank master policies."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedFiles.map((file: any, idx: number) => {
                        const rowNumber = startFileIndex + idx + 1
                        const kbSize = file.file_size_bytes
                          ? (file.file_size_bytes / 1024).toFixed(1) + " KB"
                          : file.text_length
                          ? (file.text_length / 1024).toFixed(1) + " KB"
                          : "0 KB"

                        const isSpreadsheet =
                          (file.file_name || "").endsWith(".xlsx") ||
                          (file.file_name || "").endsWith(".xls") ||
                          (file.file_name || "").endsWith(".csv")

                        return (
                          <tr key={file.bank_id || file.id || idx}>
                            <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: 600, fontSize: "0.8125rem" }}>
                              {rowNumber}
                            </td>

                            <td style={{ textAlign: "left" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div className="bp-bank-logo-icon">
                                  <Landmark style={{ width: 15, height: 15 }} />
                                </div>
                                <div className="font-semibold text-slate-900 dark:text-white text-xs truncate max-w-[200px]">
                                  {file.bank_name || "Partner Lender"}
                                </div>
                              </div>
                            </td>

                            <td style={{ textAlign: "left" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {isSpreadsheet ? (
                                  <FileSpreadsheet style={{ width: 16, height: 16, color: "#10b981", flexShrink: 0 }} />
                                ) : (
                                  <FileText style={{ width: 16, height: 16, color: "#3b82f6", flexShrink: 0 }} />
                                )}
                                <span className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate max-w-[320px]">
                                  {file.file_name}
                                </span>
                              </div>
                            </td>

                            <td style={{ textAlign: "center" }}>
                              <span className="cw-badge cw-badge-info" style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                                {kbSize}
                              </span>
                            </td>

                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                <button
                                  type="button"
                                  className="cw-action-btn"
                                  title="View Raw Policy Content"
                                  onClick={() => handleOpenViewer(file.id, file)}
                                >
                                  <Eye style={{ width: 14, height: 14 }} />
                                </button>
                                <button
                                  type="button"
                                  className="cw-action-btn cw-action-primary"
                                  title="Edit Policy Document Directly"
                                  onClick={() => handleOpenEditorFile(file)}
                                >
                                  <Pencil style={{ width: 14, height: 14 }} />
                                </button>
                                <button
                                  type="button"
                                  className="cw-action-btn"
                                  title="Download Policy File"
                                  onClick={async () => {
                                    if (file.extracted_text) {
                                      handleDownloadText(file.file_name, file.extracted_text)
                                    } else {
                                      try {
                                        const res = await fetch(`/api/policies/extracted-files/${file.id}`)
                                        const data = await res.json()
                                        if (data.success && data.file?.extracted_text) {
                                          handleDownloadText(file.file_name, data.file.extracted_text)
                                        } else {
                                          showToast("Failed to download file content", "error")
                                        }
                                      } catch {
                                        showToast("Error downloading policy file", "error")
                                      }
                                    }
                                  }}
                                >
                                  <Download style={{ width: 14, height: 14 }} />
                                </button>
                                <button
                                  type="button"
                                  className="cw-action-btn cw-action-delete"
                                  title="Delete Policy File"
                                  onClick={() => handleOpenDelete(file)}
                                >
                                  <Trash2 style={{ width: 14, height: 14 }} />
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

              {/* Mobile Card List: Hidden on Desktop */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {loadingFiles ? (
                  <div className="p-8 text-center text-slate-500">
                    <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="text-xs">Loading master policy files...</p>
                  </div>
                ) : filteredPolicyFiles.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">No Policy Files Found</p>
                    <p className="text-xs mt-1">Try adjusting your filters or upload a new file.</p>
                  </div>
                ) : (
                  paginatedFiles.map((file: any, idx: number) => {
                    const kbSize = file.file_size_bytes
                      ? (file.file_size_bytes / 1024).toFixed(1) + " KB"
                      : file.text_length
                      ? (file.text_length / 1024).toFixed(1) + " KB"
                      : "0 KB"

                    const isSpreadsheet =
                      (file.file_name || "").endsWith(".xlsx") ||
                      (file.file_name || "").endsWith(".xls") ||
                      (file.file_name || "").endsWith(".csv")

                    return (
                      <div key={file.bank_id || file.id || idx} className="p-4 bg-white dark:bg-slate-900 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                isSpreadsheet
                                  ? "bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                                  : "bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                              }`}
                            >
                              {isSpreadsheet ? <FileSpreadsheet className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-white text-sm break-all">
                                {file.file_name}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                <Landmark className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-medium truncate">{file.bank_name || "Partner Lender"}</span>
                              </div>
                            </div>
                          </div>
                          <span className="cw-badge cw-badge-info text-[11px] shrink-0 font-mono">{kbSize}</span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            className="cw-action-btn"
                            title="View Document"
                            onClick={() => handleOpenViewer(file.id, file)}
                          >
                            <Eye style={{ width: 14, height: 14 }} />
                          </button>
                          <button
                            type="button"
                            className="cw-action-btn cw-action-primary"
                            title="Edit Master Policy"
                            onClick={() => handleOpenEditorFile(file)}
                          >
                            <Pencil style={{ width: 14, height: 14 }} />
                          </button>
                          <button
                            type="button"
                            className="cw-action-btn"
                            title="Download File"
                            onClick={async () => {
                              if (file.extracted_text) {
                                handleDownloadText(file.file_name, file.extracted_text)
                              } else {
                                try {
                                  const res = await fetch(`/api/policies/extracted-files/${file.id}`)
                                  const data = await res.json()
                                  if (data.success && data.file?.extracted_text) {
                                    handleDownloadText(file.file_name, data.file.extracted_text)
                                  } else {
                                    showToast("Failed to download file content", "error")
                                  }
                                } catch {
                                  showToast("Error downloading policy file", "error")
                                }
                              }
                            }}
                          >
                            <Download style={{ width: 14, height: 14 }} />
                          </button>
                          <button
                            type="button"
                            className="cw-action-btn cw-action-delete"
                            title="Delete Policy File"
                            onClick={() => handleOpenDelete(file)}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Policy Files Footer & Pagination */}
              <div className="bp-footer">
                <div className="bp-footer-range">
                  Showing {totalFilteredFiles === 0 ? 0 : startFileIndex + 1}–{endFileIndex} of {totalFilteredFiles} files
                </div>
                <div className="bp-pagination">
                  <button
                    type="button"
                    className="bp-page-btn"
                    disabled={validCurrentFilePage <= 1}
                    onClick={() => setFilePage((p) => Math.max(1, p - 1))}
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <span className="bp-page-indicator">
                    Page {validCurrentFilePage} of {totalFilePages}
                  </span>
                  <button
                    type="button"
                    className="bp-page-btn"
                    disabled={validCurrentFilePage >= totalFilePages}
                    onClick={() => setFilePage((p) => Math.min(totalFilePages, p + 1))}
                    aria-label="Next Page"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
              TAB 2: UPLOAD POLICY DOCUMENTS (DEDICATED FULL TAB VIEW)
              ========================================================================= */
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
            {/* Upload Container Card */}
            <div className="cw-card p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-center gap-3.5 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">
                    Upload Bank Policy Documents
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">
                    Select or type a partner bank/lender to unlock file upload. Upload the official master policy document (.pdf, .txt, .docx, .xlsx, .csv).
                  </p>
                </div>
              </div>

              {/* Step 1: Bank Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Step 1: Select Partner Bank / Lender (Required before uploading)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="relative">
                    <select
                      value={tab2IsCustomBank ? "__CUSTOM__" : tab2SelectedBank}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === "__CUSTOM__") {
                          setTab2IsCustomBank(true)
                        } else {
                          setTab2IsCustomBank(false)
                          setTab2SelectedBank(val)
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Choose a Bank / Lender --</option>
                      {PRESET_PARTNER_BANKS.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                      <option value="__CUSTOM__">+ Custom Bank / Manual Entry...</option>
                    </select>
                  </div>

                  {/* Manual Typing Option */}
                  {tab2IsCustomBank && (
                    <div className="relative">
                      <input
                        type="text"
                        value={tab2CustomBankName}
                        onChange={(e) => setTab2CustomBankName(e.target.value)}
                        placeholder="Type custom Bank or Lender name..."
                        className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-500 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* Status Indicator */}
                <div className="mt-3 flex items-center gap-2 text-xs">
                  {isTab2UploadUnlocked ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Unlock className="w-4 h-4" />
                      <span>Ready to upload master file for: <strong>{tab2EffectiveBank}</strong></span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                      <Lock className="w-4 h-4" />
                      <span>Select or type a Bank Name to unlock file upload</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Upload Dropzone (Gated) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Step 2: Upload Policy File
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (isTab2UploadUnlocked) setTab2IsDragOver(true)
                  }}
                  onDragLeave={() => setTab2IsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setTab2IsDragOver(false)
                    if (isTab2UploadUnlocked && e.dataTransfer.files?.[0]) {
                      handleTab2FileUpload(e.dataTransfer.files[0])
                    }
                  }}
                  className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all ${
                    !isTab2UploadUnlocked
                      ? "border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40 opacity-60 cursor-not-allowed"
                      : tab2IsDragOver
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 cursor-copy"
                      : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-900/60 cursor-pointer"
                  }`}
                  onClick={() => {
                    if (isTab2UploadUnlocked && tab2FileInputRef.current) {
                      tab2FileInputRef.current.value = ""
                      tab2FileInputRef.current.click()
                    }
                  }}
                >
                  <input
                    ref={tab2FileInputRef}
                    type="file"
                    accept=".txt,.pdf,.docx,.xlsx,.csv,text/plain,application/pdf"
                    className="hidden"
                    disabled={!isTab2UploadUnlocked || tab2Uploading}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleTab2FileUpload(e.target.files[0])
                        e.target.value = ""
                      }
                    }}
                  />

                  <div className="max-w-md mx-auto flex flex-col items-center">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center mb-3.5 ${
                        !isTab2UploadUnlocked
                          ? "bg-slate-200 dark:bg-slate-800 text-slate-400"
                          : "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {tab2Uploading ? (
                        <RotateCcw className="w-7 h-7 animate-spin text-blue-600" />
                      ) : !isTab2UploadUnlocked ? (
                        <Lock className="w-7 h-7" />
                      ) : (
                        <UploadCloud className="w-7 h-7" />
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                      {tab2Uploading
                        ? "Uploading & Registering Master Policy..."
                        : !isTab2UploadUnlocked
                        ? "File Upload Locked"
                        : "Drag & Drop or Click to Upload Policy File"}
                    </h4>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      {!isTab2UploadUnlocked
                        ? "Please select or type a Bank Name in Step 1 above to enable policy file upload."
                        : `Selected Bank: "${tab2EffectiveBank}". Accepts .txt, .pdf, .docx, .xlsx, .csv files up to 50 MB.`}
                    </p>

                    {isTab2UploadUnlocked && !tab2Uploading && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (tab2FileInputRef.current) {
                            tab2FileInputRef.current.value = ""
                            tab2FileInputRef.current.click()
                          }
                        }}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        Choose Policy Document
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 3: Master Policy Files Directory Preview */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider m-0">
                    Step 3: Master Policy Files Directory ({policyFiles.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab("files")}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    View All in Master Files Tab →
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  <table className="cw-table">
                    <thead>
                      <tr>
                        <th style={{ width: 50, textAlign: "center" }}>#</th>
                        <th style={{ minWidth: 200, textAlign: "left" }}>Bank Name</th>
                        <th style={{ minWidth: 240, textAlign: "left" }}>File Name</th>
                        <th style={{ width: 100, textAlign: "center" }}>Size</th>
                        <th style={{ width: 100, textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policyFiles.slice(0, 5).map((f: any, idx: number) => {
                        const kbSize = f.file_size_bytes
                          ? (f.file_size_bytes / 1024).toFixed(1) + " KB"
                          : f.text_length
                          ? (f.text_length / 1024).toFixed(1) + " KB"
                          : "0 KB"
                        return (
                          <tr key={f.bank_id || f.id || idx}>
                            <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8125rem" }}>
                              {idx + 1}
                            </td>
                            <td style={{ textAlign: "left", fontWeight: 600 }}>
                              {f.bank_name || "Partner Bank"}
                            </td>
                            <td style={{ textAlign: "left", fontFamily: "monospace", fontSize: "0.75rem" }}>
                              {f.file_name}
                            </td>
                            <td style={{ textAlign: "center", fontSize: "0.75rem", fontFamily: "monospace" }}>
                              {kbSize}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                <button
                                  type="button"
                                  className="cw-action-btn"
                                  title="View File"
                                  onClick={() => handleOpenViewer(f.id, f)}
                                >
                                  <Eye style={{ width: 14, height: 14 }} />
                                </button>
                                <button
                                  type="button"
                                  className="cw-action-btn"
                                  title="Download File"
                                  onClick={async () => {
                                    if (f.extracted_text) {
                                      handleDownloadText(f.file_name, f.extracted_text)
                                    } else {
                                      try {
                                        const res = await fetch(`/api/policies/extracted-files/${f.id}`)
                                        const data = await res.json()
                                        if (data.success && data.file?.extracted_text) {
                                          handleDownloadText(f.file_name, data.file.extracted_text)
                                        }
                                      } catch {}
                                    }
                                  }}
                                >
                                  <Download style={{ width: 14, height: 14 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODERN DELETE CONFIRMATION MODAL
          ========================================================================= */}
      <ModernConfirmDialog
        isOpen={!!deleteConfirmPolicy}
        onClose={() => !isDeletingPolicy && setDeleteConfirmPolicy(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Master Policy File?"
        description="Are you sure you want to delete this master policy file? The policy document will be permanently removed from disk."
        itemTitle={deleteConfirmPolicy ? (deleteConfirmPolicy.file_name || deleteConfirmPolicy.attachment_file_name || "Master Policy Document") : undefined}
        itemSubtitle={deleteConfirmPolicy ? `Bank: ${deleteConfirmPolicy.bank_name || "Partner Bank"}` : undefined}
        confirmText="Confirm Delete"
        isLoading={isDeletingPolicy}
      />

      {/* =========================================================================
          POLICY DOCUMENT VIEWER & EDITOR MODAL
          ========================================================================= */}
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
