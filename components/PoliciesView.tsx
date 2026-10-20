/**
 * Modern CreditWise AI Policies Page
 * Displays bank policy rules, categories, status, and bank policy documents.
 */

"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import Topbar from "./Topbar"
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
  Filter,
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
import ModernTableActionBtn, { ModernDeleteActionBtn } from "@/components/ui/ModernTableActionBtn"

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
  const [selectedFileBank, setSelectedFileBank] = useState("all")
  const [isFileDragOver, setIsFileDragOver] = useState(false)

  // Pagination State (Step 6: 15 per page)
  const [currentPage, setCurrentPage] = useState(1)
  const [filePage, setFilePage] = useState(1)
  const PAGE_SIZE = 15

  useEffect(() => {
    setCurrentPage(1)
  }, [searchBank, filterLoanType, filterStatus])

  useEffect(() => {
    setFilePage(1)
  }, [searchFileQuery, selectedFileBank])

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

  // Upload Policy Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadBankId, setUploadBankId] = useState<number>(0)
  const [uploadBankName, setUploadBankName] = useState<string>("")
  const [isCustomUploadBank, setIsCustomUploadBank] = useState<boolean>(false)
  const [customUploadBankName, setCustomUploadBankName] = useState<string>("")
  const [uploadLoanType, setUploadLoanType] = useState<string>("Personal Loan")
  const [uploadPolicyVersion, setUploadPolicyVersion] = useState<string>("V1")
  const [uploadEmployment, setUploadEmployment] = useState<string>("Salaried")
  const [uploadDescription, setUploadDescription] = useState<string>("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null)

  // View Guidelines Details Modal State (Tab 1)
  const [viewGuidelinesPolicy, setViewGuidelinesPolicy] = useState<any | null>(null)

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
        loadPolicies()
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

  // Delete Policy Text File Confirmation (Deletes text file only, keeps bank database record)
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
          `✓ Deleted master policy file (${fileName}) for ${deleteConfirmPolicy.bank_name}. Bank remains in the list.`,
          "success"
        )
        setDeleteConfirmPolicy(null)
        setEditModalOpen(false)
        loadPolicies()
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

  // Upload Policy File Handler
  function handleOpenUploadModal() {
    setUploadBankId(0)
    setUploadBankName("")
    setUploadLoanType("Personal Loan")
    setUploadPolicyVersion("V1")
    setUploadEmployment("Salaried")
    setUploadDescription("")
    setUploadFile(null)
    setUploadModalOpen(true)
  }

  function handleUploadFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
  }

  async function handleUploadPolicy(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!uploadFile) {
      showToast("Please select a file to upload", "error")
      return
    }
    const finalBank = isCustomUploadBank ? customUploadBankName.trim() : uploadBankName.trim()
    if (!finalBank) {
      showToast("Please select or enter a bank name", "error")
      return
    }
    if (!uploadLoanType) {
      showToast("Please select a loan type", "error")
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("bank_name", finalBank)
      if (!isCustomUploadBank && uploadBankId) {
        formData.append("bank_id", String(uploadBankId))
      }
      formData.append("loan_type", uploadLoanType)
      formData.append("policy_version", uploadPolicyVersion)
      formData.append("employment_type", uploadEmployment)
      formData.append("description", uploadDescription)

      const res = await fetch("/api/policies", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (data.success) {
        showToast(`✓ ${data.message}`, "success")
        setUploadModalOpen(false)
        loadPolicies()
        loadPolicyFiles()
      } else {
        showToast(`✕ Failed to upload: ${data.error || "Unknown error"}`, "error")
      }
    } catch (err) {
      console.error("Failed to upload policy file", err)
      showToast("✕ Failed to upload policy file", "error")
    } finally {
      setIsUploading(false)
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

  // Dynamic pagination calculation (Step 6 - 15 items per page)
  const totalFiltered = filteredPolicies.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = totalFiltered === 0 ? 0 : (validCurrentPage - 1) * PAGE_SIZE
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalFiltered)
  const paginatedPolicies = filteredPolicies.slice(startIndex, endIndex)

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

  // Export Bank Policies to Excel
  const exportPoliciesToExcel = () => {
    if (filteredPolicies.length === 0) return

    const exportData = filteredPolicies.map((p: any, idx: number) => ({
      "Sr No": idx + 1,
      "Bank / Lender": p.bank_name || p.bank_code || "N/A",
      "Loan Type": p.loan_type || "Personal Loan",
      "Employment": p.employment_type || "Salaried",
      "Min CIBIL": p.min_cibil ?? "N/A",
      "Max CIBIL": p.max_cibil ?? "N/A",
      "Min Salary (₹)": p.min_salary ?? "N/A",
      "Min Age": p.min_age ?? "N/A",
      "Max Age": p.max_age ?? "N/A",
      "Min Loan Amount (₹)": p.min_loan_amount ?? "N/A",
      "Max Loan Amount (₹)": p.max_loan_amount ?? "N/A",
      "Min Tenure (Months)": p.min_tenure_months ?? "N/A",
      "Max Tenure (Months)": p.max_tenure_months ?? "N/A",
      "FOIR %": p.foir_percent ? `${p.foir_percent}%` : "N/A",
      "ROI %": p.roi ? `${p.roi}%` : "N/A",
      "Processing Fee %": p.processing_fee_percent ? `${p.processing_fee_percent}%` : "N/A",
      "Status": p.status || "Active",
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bank Policies")

    const filename = `Bank_Master_Policies_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(workbook, filename)
  }

  // Download single bank policy guidelines
  const downloadSinglePolicy = (p: any) => {
    if (!p) return
    const exportData = [
      { Field: "Bank / Lender", Value: p.bank_name || p.bank_code || "N/A" },
      { Field: "Loan Type", Value: p.loan_type || "Personal Loan" },
      { Field: "Employment Type", Value: p.employment_type || "Salaried" },
      { Field: "Min CIBIL Score", Value: p.min_cibil ?? "Not specified" },
      { Field: "Max CIBIL Score", Value: p.max_cibil ?? "Not specified" },
      { Field: "Min Salary Required (₹)", Value: p.min_salary ? `₹${Number(p.min_salary).toLocaleString("en-IN")}` : "Not specified" },
      { Field: "Min Age", Value: p.min_age ? `${p.min_age} years` : "Not specified" },
      { Field: "Max Age", Value: p.max_age ? `${p.max_age} years` : "Not specified" },
      { Field: "Min Loan Amount (₹)", Value: p.min_loan_amount ? `₹${Number(p.min_loan_amount).toLocaleString("en-IN")}` : "Not specified" },
      { Field: "Max Loan Amount (₹)", Value: p.max_loan_amount ? `₹${Number(p.max_loan_amount).toLocaleString("en-IN")}` : "Not specified" },
      { Field: "Min Tenure (Months)", Value: p.min_tenure_months ? `${p.min_tenure_months} months` : "Not specified" },
      { Field: "Max Tenure (Months)", Value: p.max_tenure_months ? `${p.max_tenure_months} months` : "Not specified" },
      { Field: "FOIR %", Value: p.foir_percent ? `${p.foir_percent}%` : "Not specified" },
      { Field: "Rate of Interest (ROI %)", Value: p.roi ? `${p.roi}%` : "Not specified" },
      { Field: "Processing Fee %", Value: p.processing_fee_percent ? `${p.processing_fee_percent}%` : "Not specified" },
      { Field: "Policy Status", Value: p.status || "Active" },
      { Field: "Exported At", Value: new Date().toLocaleString("en-IN") },
    ]

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Policy Guidelines")
    worksheet["!cols"] = [{ wch: 30 }, { wch: 50 }]

    const safeName = (p.bank_name || p.bank_code || "Bank_Policy").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30)
    const filename = `${safeName}_Policy_Guidelines.xlsx`
    XLSX.writeFile(workbook, filename)
  }

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

  // Unique bank options for edit modal
  const allBankOptions = Array.from(
    new Map(
      policies.map((p) => [p.bank_name, { id: p.bank_id || p.id, name: p.bank_name }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  function renderCategoryBadge(category?: string) {
    const cat = category || "General Policy"
    const lower = cat.toLowerCase()
    if (lower.includes("personal")) {
      return <span className="bp-cat-badge bp-cat-personal">{cat}</span>
    }
    if (lower.includes("home")) {
      return <span className="bp-cat-badge bp-cat-home">{cat}</span>
    }
    return <span className="bp-cat-badge bp-cat-default">{cat}</span>
  }

  function renderStatusBadge(status?: string) {
    const st = (status || "active").toLowerCase()
    const isActive = st === "active"
    return (
      <span className={`bp-status-badge ${isActive ? "bp-status-active" : "bp-status-inactive"}`}>
        <span className={`bp-status-dot ${isActive ? "dot-active" : "dot-inactive"}`} />
        {st === "review" ? "In Review" : st.charAt(0).toUpperCase() + st.slice(1)}
      </span>
    )
  }

  if (!user) return <main style={{ padding: 24, textAlign: "center" }}>Loading policy workspace...</main>

  return (
    <>
      <style>{`
        .bp-container {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 auto;
          box-sizing: border-box;
          font-family: inherit;
        }
        .bp-header-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          padding: 12px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .bp-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .bp-icon-badge {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          flex-shrink: 0;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08);
        }
        .bp-tab-pill-group {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
          gap: 4px;
          border: 1px solid #cbd5e1;
        }
        .bp-tab-pill {
          padding: 6px 14px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #334155;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .bp-tab-pill:hover:not(.active) {
          border-color: #94a3b8;
          background: #f8fafc;
          color: #0f172a;
        }
        .bp-tab-pill.active {
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 600;
          border-color: #93c5fd;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08);
        }
        .bp-tab-pill-count {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 1px 7px;
          border-radius: 9999px;
          background: #f1f5f9;
          color: #475569;
        }
        .bp-tab-pill.active .bp-tab-pill-count {
          background: #eff6ff;
          color: #2563eb;
        }
        .bp-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .bp-refresh-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          color: #334155;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }
        .bp-refresh-btn:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }
        .bp-refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .bp-toolbar-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }
        .bp-count-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
          color: #64748b;
          font-weight: 500;
        }
        .bp-count-number {
          font-weight: 700;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 2px 10px;
          border-radius: 9999px;
          border: 1px solid #dbeafe;
          font-size: 0.8125rem;
        }
        .bp-toolbar-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .bp-search-box {
          position: relative;
          width: 240px;
        }
        .bp-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }
        .bp-search-input {
          width: 100%;
          height: 36px;
          padding: 0 12px 0 32px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          font-size: 0.8125rem;
          color: #0f172a;
          outline: none;
          transition: all 0.15s ease;
          box-sizing: border-box;
        }
        .bp-search-input:hover {
          border-color: #94a3b8;
        }
        .bp-search-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .bp-filter-select {
          height: 36px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          font-size: 0.8125rem;
          color: #334155;
          outline: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .bp-filter-select:hover {
          border-color: #94a3b8;
        }
        .bp-filter-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .bp-table-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .bp-table-scroll {
          width: 100%;
          overflow-x: auto;
        }
        .bp-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .bp-table thead {
          background: #f1f5f9;
          border-bottom: 1px solid #cbd5e1;
        }
        .bp-table th {
          padding: 13px 18px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
          vertical-align: middle;
        }
        .bp-table th.bp-th-center {
          text-align: center;
        }
        .bp-table th.bp-th-left {
          text-align: left;
        }
        .bp-table tbody tr {
          border-bottom: 1px solid #e2e8f0;
          transition: background-color 0.15s ease;
          height: 56px;
        }
        .bp-table tbody tr:hover {
          background-color: rgba(239, 246, 255, 0.5);
        }
        .bp-table tbody tr:last-child {
          border-bottom: none;
        }
        .bp-table td {
          padding: 12px 18px;
          font-size: 0.875rem;
          color: #334155;
          vertical-align: middle;
        }
        .bp-td-center {
          text-align: center;
        }
        .bp-td-left {
          text-align: left;
        }
        .bp-index-cell {
          color: #94a3b8;
          font-weight: 600;
          font-size: 0.8125rem;
          text-align: center;
        }
        .bp-bank-cell {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .bp-bank-logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          flex-shrink: 0;
        }
        .bp-bank-name {
          font-weight: 600;
          color: #0f172a;
          font-size: 0.875rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bp-cat-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 3px 12px;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .bp-cat-personal {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }
        .bp-cat-home {
          background: #faf5ff;
          color: #7e22ce;
          border: 1px solid #e9d5ff;
        }
        .bp-cat-default {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #cbd5e1;
        }
        .bp-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 3px 12px;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .bp-status-active {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
        .bp-status-inactive {
          background: #f8fafc;
          color: #64748b;
          border: 1px solid #cbd5e1;
        }
        .bp-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .dot-active {
          background: #16a34a;
        }
        .dot-inactive {
          background: #94a3b8;
        }
        .bp-actions-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 0 auto;
        }
        .bp-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          color: #64748b;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }
        .bp-action-btn:hover {
          border-color: #94a3b8;
        }
        .bp-btn-view:hover {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #2563eb;
        }
        .bp-btn-edit:hover {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #2563eb;
        }
        .bp-btn-delete:hover {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }
        .bp-footer {
          padding: 12px 20px;
          border-top: 1px solid #cbd5e1;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .bp-footer-range {
          font-size: 0.8125rem;
          color: #64748b;
          font-weight: 500;
        }
        .bp-pagination {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .bp-page-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 32px;
          padding: 0 10px;
          border-radius: 7px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          font-size: 0.75rem;
          font-weight: 500;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .bp-page-btn:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }
        .bp-page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .bp-page-indicator {
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
          padding: 0 8px;
        }

        /* Comprehensive Dark Theme Overrides */
        .dark .bp-header-card,
        [data-theme="dark"] .bp-header-card,
        [data-bs-theme="dark"] .bp-header-card {
          background: #0f172a !important;
          border-color: #1e293b !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4) !important;
        }
        .dark .bp-icon-badge,
        [data-theme="dark"] .bp-icon-badge,
        [data-bs-theme="dark"] .bp-icon-badge {
          background: rgba(37, 99, 235, 0.15) !important;
          border-color: rgba(37, 99, 235, 0.3) !important;
          color: #60a5fa !important;
        }
        .dark .bp-tab-pill-group,
        [data-theme="dark"] .bp-tab-pill-group,
        [data-bs-theme="dark"] .bp-tab-pill-group {
          background: #1e293b !important;
          border-color: #334155 !important;
        }
        .dark .bp-tab-pill,
        [data-theme="dark"] .bp-tab-pill,
        [data-bs-theme="dark"] .bp-tab-pill {
          background: #0f172a !important;
          border-color: #334155 !important;
          color: #94a3b8 !important;
        }
        .dark .bp-tab-pill:hover:not(.active),
        [data-theme="dark"] .bp-tab-pill:hover:not(.active),
        [data-bs-theme="dark"] .bp-tab-pill:hover:not(.active) {
          border-color: #475569 !important;
          background: #1e293b !important;
          color: #f8fafc !important;
        }
        .dark .bp-tab-pill.active,
        [data-theme="dark"] .bp-tab-pill.active,
        [data-bs-theme="dark"] .bp-tab-pill.active {
          background: rgba(37, 99, 235, 0.2) !important;
          color: #60a5fa !important;
          border-color: #3b82f6 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2) !important;
        }
        .dark .bp-tab-pill-count,
        [data-theme="dark"] .bp-tab-pill-count,
        [data-bs-theme="dark"] .bp-tab-pill-count {
          background: #1e293b !important;
          color: #94a3b8 !important;
        }
        .dark .bp-tab-pill.active .bp-tab-pill-count,
        [data-theme="dark"] .bp-tab-pill.active .bp-tab-pill-count,
        [data-bs-theme="dark"] .bp-tab-pill.active .bp-tab-pill-count {
          background: rgba(37, 99, 235, 0.35) !important;
          color: #93c5fd !important;
        }
        .dark .bp-refresh-btn,
        [data-theme="dark"] .bp-refresh-btn,
        [data-bs-theme="dark"] .bp-refresh-btn {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #cbd5e1 !important;
        }
        .dark .bp-refresh-btn:hover:not(:disabled),
        [data-theme="dark"] .bp-refresh-btn:hover:not(:disabled),
        [data-bs-theme="dark"] .bp-refresh-btn:hover:not(:disabled) {
          background: #334155 !important;
          border-color: #475569 !important;
          color: #ffffff !important;
        }
        .dark .bp-toolbar-card,
        [data-theme="dark"] .bp-toolbar-card,
        [data-bs-theme="dark"] .bp-toolbar-card,
        .dark .bp-table-card,
        [data-theme="dark"] .bp-table-card,
        [data-bs-theme="dark"] .bp-table-card {
          background: #0f172a !important;
          border-color: #1e293b !important;
          color: #f8fafc !important;
        }
        .dark .bp-search-input,
        [data-theme="dark"] .bp-search-input,
        [data-bs-theme="dark"] .bp-search-input {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #f8fafc !important;
        }
        .dark .bp-search-input:hover,
        [data-theme="dark"] .bp-search-input:hover,
        [data-bs-theme="dark"] .bp-search-input:hover {
          border-color: #475569 !important;
        }
        .dark .bp-filter-select,
        [data-theme="dark"] .bp-filter-select,
        [data-bs-theme="dark"] .bp-filter-select {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #f8fafc !important;
        }
        .dark .bp-filter-select:hover,
        [data-theme="dark"] .bp-filter-select:hover,
        [data-bs-theme="dark"] .bp-filter-select:hover {
          border-color: #475569 !important;
        }
        .dark .bp-table thead,
        [data-theme="dark"] .bp-table thead,
        [data-bs-theme="dark"] .bp-table thead {
          background: #1e293b !important;
          border-bottom-color: #334155 !important;
        }
        .dark .bp-table th,
        [data-theme="dark"] .bp-table th,
        [data-bs-theme="dark"] .bp-table th {
          color: #94a3b8 !important;
        }
        .dark .bp-table tbody tr,
        [data-theme="dark"] .bp-table tbody tr,
        [data-bs-theme="dark"] .bp-table tbody tr {
          border-bottom-color: #1e293b !important;
        }
        .dark .bp-table tbody tr:hover,
        [data-theme="dark"] .bp-table tbody tr:hover,
        [data-bs-theme="dark"] .bp-table tbody tr:hover {
          background-color: rgba(30, 41, 59, 0.6) !important;
        }
        .dark .bp-table td,
        [data-theme="dark"] .bp-table td,
        [data-bs-theme="dark"] .bp-table td {
          color: #cbd5e1 !important;
        }
        .dark .bp-bank-name,
        [data-theme="dark"] .bp-bank-name,
        [data-bs-theme="dark"] .bp-bank-name {
          color: #f8fafc !important;
        }
        .dark .bp-bank-logo-icon,
        [data-theme="dark"] .bp-bank-logo-icon,
        [data-bs-theme="dark"] .bp-bank-logo-icon {
          background: rgba(37, 99, 235, 0.15) !important;
          border-color: rgba(37, 99, 235, 0.3) !important;
          color: #60a5fa !important;
        }
        .dark .bp-action-btn,
        [data-theme="dark"] .bp-action-btn,
        [data-bs-theme="dark"] .bp-action-btn {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #94a3b8 !important;
        }
        .dark .bp-action-btn:hover,
        [data-theme="dark"] .bp-action-btn:hover,
        [data-bs-theme="dark"] .bp-action-btn:hover {
          border-color: #475569 !important;
          color: #f8fafc !important;
        }
        .dark .bp-btn-view:hover,
        [data-theme="dark"] .bp-btn-view:hover,
        [data-bs-theme="dark"] .bp-btn-view:hover,
        .dark .bp-btn-edit:hover,
        [data-theme="dark"] .bp-btn-edit:hover,
        [data-bs-theme="dark"] .bp-btn-edit:hover {
          background: rgba(37, 99, 235, 0.2) !important;
          border-color: rgba(37, 99, 235, 0.4) !important;
          color: #60a5fa !important;
        }
        .dark .bp-btn-delete:hover,
        [data-theme="dark"] .bp-btn-delete:hover,
        [data-bs-theme="dark"] .bp-btn-delete:hover {
          background: rgba(239, 68, 68, 0.2) !important;
          border-color: rgba(239, 68, 68, 0.4) !important;
          color: #f87171 !important;
        }
        .dark .bp-footer,
        [data-theme="dark"] .bp-footer,
        [data-bs-theme="dark"] .bp-footer {
          background: #0f172a !important;
          border-top-color: #1e293b !important;
        }
        .dark .bp-footer-range,
        [data-theme="dark"] .bp-footer-range,
        [data-bs-theme="dark"] .bp-footer-range {
          color: #94a3b8 !important;
        }
        .dark .bp-page-btn,
        [data-theme="dark"] .bp-page-btn,
        [data-bs-theme="dark"] .bp-page-btn {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #cbd5e1 !important;
        }
        .dark .bp-page-btn:hover:not(:disabled),
        [data-theme="dark"] .bp-page-btn:hover:not(:disabled),
        [data-bs-theme="dark"] .bp-page-btn:hover:not(:disabled) {
          background: #334155 !important;
          border-color: #475569 !important;
          color: #ffffff !important;
        }
        .dark .bp-page-indicator,
        [data-theme="dark"] .bp-page-indicator,
        [data-bs-theme="dark"] .bp-page-indicator {
          color: #cbd5e1 !important;
        }
        .dark .bp-count-number,
        [data-theme="dark"] .bp-count-number,
        [data-bs-theme="dark"] .bp-count-number {
          background: rgba(37, 99, 235, 0.2) !important;
          border-color: rgba(37, 99, 235, 0.35) !important;
          color: #93c5fd !important;
        }
        .dark .cw-card,
        [data-theme="dark"] .cw-card,
        [data-bs-theme="dark"] .cw-card {
          background: #0f172a !important;
          border-color: #1e293b !important;
          color: #f8fafc !important;
        }
        .dark .cw-table thead th,
        [data-theme="dark"] .cw-table thead th,
        [data-bs-theme="dark"] .cw-table thead th {
          background: #1e293b !important;
          border-bottom-color: #334155 !important;
          color: #94a3b8 !important;
        }
        .dark .cw-table tbody tr,
        [data-theme="dark"] .cw-table tbody tr,
        [data-bs-theme="dark"] .cw-table tbody tr {
          border-bottom-color: #1e293b !important;
        }
        .dark .cw-table tbody tr:hover,
        [data-theme="dark"] .cw-table tbody tr:hover,
        [data-bs-theme="dark"] .cw-table tbody tr:hover {
          background-color: rgba(30, 41, 59, 0.6) !important;
        }
        .dark .cw-table tbody td,
        [data-theme="dark"] .cw-table tbody td,
        [data-bs-theme="dark"] .cw-table tbody td {
          color: #cbd5e1 !important;
        }
        .dark .cw-action-btn,
        [data-theme="dark"] .cw-action-btn,
        [data-bs-theme="dark"] .cw-action-btn {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #94a3b8 !important;
        }
        .dark .cw-action-btn:hover,
        [data-theme="dark"] .cw-action-btn:hover,
        [data-bs-theme="dark"] .cw-action-btn:hover {
          border-color: #475569 !important;
          color: #f8fafc !important;
        }
        .dark .cw-btn-secondary,
        [data-theme="dark"] .cw-btn-secondary,
        [data-bs-theme="dark"] .cw-btn-secondary {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #cbd5e1 !important;
        }
        .dark .cw-btn-secondary:hover:not(:disabled),
        [data-theme="dark"] .cw-btn-secondary:hover:not(:disabled),
        [data-bs-theme="dark"] .cw-btn-secondary:hover:not(:disabled) {
          background: #334155 !important;
          border-color: #475569 !important;
          color: #ffffff !important;
        }
        .dark .cw-select,
        [data-theme="dark"] .cw-select,
        [data-bs-theme="dark"] .cw-select {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #f8fafc !important;
        }
        .dark .cw-modal-content,
        [data-theme="dark"] .cw-modal-content,
        [data-bs-theme="dark"] .cw-modal-content {
          background: #0f172a !important;
          border-color: #1e293b !important;
          color: #f8fafc !important;
        }
        .dark .cw-input,
        [data-theme="dark"] .cw-input,
        [data-bs-theme="dark"] .cw-input {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #f8fafc !important;
        }

        @media (max-width: 768px) {
          .bp-header-card {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 12px 14px !important;
            gap: 12px !important;
          }
          .bp-header-left {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100% !important;
            gap: 10px !important;
          }
          .bp-tab-pill-group {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
          }
          .bp-tab-pill {
            justify-content: center !important;
          }
          .bp-header-right {
            width: 100% !important;
            display: flex !important;
            justify-content: space-between !important;
            gap: 8px !important;
          }
          .bp-refresh-btn {
            flex: 1 !important;
            justify-content: center !important;
          }
          .bp-toolbar-card {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 12px 14px !important;
            gap: 10px !important;
          }
          .bp-toolbar-controls {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100% !important;
            gap: 8px !important;
          }
          .bp-search-box {
            width: 100% !important;
          }
          .bp-filter-select {
            width: 100% !important;
          }
          .bp-table-scroll {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .bp-table {
            min-width: 700px !important;
          }
          .bp-footer {
            flex-direction: column !important;
            align-items: center !important;
            gap: 10px !important;
          }
          .bp-pagination {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>

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
        className="animate-fade-in bp-container"
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto",
          padding: embedded ? "0 0 2rem 0" : "1.5rem 2rem",
          boxSizing: "border-box",
        }}
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

        {/* Compact Header (Step 3) */}
        <div className="bp-header-card">
          <div className="bp-header-left">
            <div
              className="bp-icon-badge"
              title="Bank Policies"
              aria-label="Bank Policies"
            >
              <Building2 className="w-5 h-5" />
            </div>

            {/* Sub-tab Pill Switcher */}
            <div className="bp-tab-pill-group" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "rules"}
                  className={`bp-tab-pill ${activeTab === "rules" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("rules")
                    setCurrentPage(1)
                  }}
                >
                  <Landmark className="w-4 h-4" />
                  <span>Bank Policy Guidelines</span>
                  <span className="bp-tab-pill-count">{policies.length}</span>
                </button>
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
            </div>
          </div>

          <div className="bp-header-right">
            <button
              type="button"
              className="bp-refresh-btn"
              onClick={activeTab === "rules" ? loadPolicies : loadPolicyFiles}
              disabled={loading || loadingFiles}
              title="Refresh Bank Policies"
              aria-label="Refresh Bank Policies"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading || loadingFiles ? "animate-spin text-blue-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {activeTab === "rules" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
            {/* Metric Cards Row matching Company Search */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
                marginBottom: "4px",
              }}
            >
              {/* Card 1: Partner Banks */}
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
                    {policies.length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Partner Lenders</div>
                </div>
              </div>

              {/* Card 2: Active Policies */}
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
                    {policies.filter((p) => String(p.status || "active").toLowerCase() === "active").length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Active Guidelines</div>
                </div>
              </div>

              {/* Card 3: In Review / Draft */}
              <div className="cw-card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "#fffbeb",
                    border: "1px solid #fef3c7",
                    color: "#d97706",
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
                    {policies.filter((p) => {
                      const s = String(p.status || "").toLowerCase();
                      return s === "review" || s === "draft";
                    }).length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Review / Draft Rules</div>
                </div>
              </div>

              {/* Card 4: Loan Categories */}
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
                  <Building2 style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white" style={{ fontSize: "1.35rem", fontWeight: 800 }}>
                    {Array.from(new Set(policies.map((p) => p.loan_type || "Personal Loan"))).length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Loan Categories</div>
                </div>
              </div>
            </div>

            {/* Search & Filter Toolbar Card matching Company Search */}
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
                  <span>Partner Banks:</span>
                  <strong style={{ marginLeft: 4 }}>{filteredPolicies.length}</strong>
                </span>

                <ModernSearchBar
                  value={searchBank}
                  onChange={setSearchBank}
                  placeholder="Search partner banks..."
                  width={260}
                />

                <select
                  className="cw-select"
                  value={filterLoanType}
                  onChange={(e) => setFilterLoanType(e.target.value)}
                  style={{ height: 38 }}
                >
                  <option value="all">All Categories</option>
                  <option value="Personal Loan">Personal Loan</option>
                  <option value="Home Loan">Home Loan</option>
                  <option value="Auto Loan">Auto Loan</option>
                  <option value="Business Loan">Business Loan</option>
                  <option value="Education Loan">Education Loan</option>
                </select>

                <select
                  className="cw-select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ height: 38 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="review">In Review</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {(searchBank || filterLoanType !== "all" || filterStatus !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchBank("")
                      setFilterLoanType("all")
                      setFilterStatus("all")
                    }}
                    className="cw-btn-secondary"
                  >
                    Reset Filters
                  </button>
                )}

                <button
                  type="button"
                  className="cw-btn-secondary"
                  onClick={exportPoliciesToExcel}
                  disabled={filteredPolicies.length === 0}
                  title="Download current filtered list to Excel"
                >
                  <Download style={{ width: 14, height: 14 }} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Download List</span>
                </button>

                <button
                  type="button"
                  className="cw-btn-secondary"
                  onClick={loadPolicies}
                  disabled={loading}
                >
                  <RotateCcw style={{ width: 14, height: 14 }} className={loading ? "animate-spin text-blue-600" : ""} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  className="cw-btn-primary"
                  onClick={() => setUploadModalOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <UploadCloud style={{ width: 15, height: 15 }} />
                  <span>Upload / Add Policy</span>
                </button>
              </div>
            </div>

            {/* Bank Policy Guidelines Table Container matching Image 3 */}
            <div className="cw-card shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Card Header matching Image 3 */}
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
                  <span>Bank Master Policies</span>
                  <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500 }}>
                    ({filteredPolicies.length})
                  </span>
                </h3>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    className="cw-btn-secondary"
                    onClick={loadPolicies}
                    disabled={loading}
                    title="Refresh Bank Policies"
                  >
                    <RotateCcw style={{ width: 14, height: 14 }} className={loading ? "animate-spin text-blue-600" : ""} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Desktop Table: Hidden on Mobile */}
              <div className="hidden md:block cw-table-container border-0">
                <table className="cw-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50, textAlign: "center" }}>#</th>
                      <th style={{ minWidth: 200, textAlign: "left" }}>Bank / Lender</th>
                      <th style={{ width: 170, textAlign: "center" }}>Loan Type &amp; Category</th>
                      <th style={{ width: 130, textAlign: "center" }}>Min Salary</th>
                      <th style={{ width: 110, textAlign: "center" }}>CIBIL Cutoff</th>
                      <th style={{ width: 120, textAlign: "center" }}>Age Limits</th>
                      <th style={{ width: 180, textAlign: "center" }}>Loan Amount &amp; Tenure</th>
                      <th style={{ width: 120, textAlign: "center" }}>Status</th>
                      <th style={{ width: 150, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                          <RotateCcw style={{ width: 24, height: 24, margin: "0 auto 8px" }} className="animate-spin text-blue-600" />
                          <p style={{ margin: 0, fontSize: "0.875rem" }}>Loading bank policy guidelines...</p>
                        </td>
                      </tr>
                    ) : filteredPolicies.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                          <Landmark style={{ width: 36, height: 36, color: "#94a3b8", margin: "0 auto 8px" }} />
                          <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", fontWeight: 600 }} className="text-slate-900 dark:text-white">
                            No Matching Policies Found
                          </h4>
                          <p style={{ margin: 0, fontSize: "0.8125rem" }}>
                            {searchBank || filterLoanType !== "all" || filterStatus !== "all"
                              ? "Try adjusting your search criteria or resetting filters."
                              : "Upload or add a bank policy to get started."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedPolicies.map((policy: any, idx: number) => {
                        const rowNumber = startIndex + idx + 1;
                        const bankName = policy.bank_name || policy.bank_code || "Partner Bank";

                        return (
                          <tr key={policy.bank_id || policy.id || idx}>
                            <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: 600, fontSize: "0.8125rem" }}>
                              {rowNumber}
                            </td>
                            <td style={{ textAlign: "left" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div className="bp-bank-logo-icon">
                                  <Landmark style={{ width: 15, height: 15 }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div className="font-semibold text-slate-900 dark:text-white text-xs truncate max-w-[180px]">
                                    {bankName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                    {policy.bank_code || "BANK"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span className="bp-cat-badge bp-cat-personal">
                                {policy.loan_type || "Personal Loan"}
                              </span>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {policy.employment_type || "Salaried"}
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span className="font-semibold text-slate-900 dark:text-white text-xs">
                                {policy.min_salary ? `₹${Number(policy.min_salary).toLocaleString("en-IN")}/mo` : "₹25,000/mo"}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {policy.min_cibil || 700}+
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                {policy.min_age || 21}–{policy.max_age || 60} yrs
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                                {formatCurrency(policy.min_loan_amount || 50000)} – {formatCurrency(policy.max_loan_amount || 4000000)}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {policy.min_tenure_months || 12}–{policy.max_tenure_months || 60} mos
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {renderStatusBadge(policy.status)}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="cw-action-btn"
                                  title="View Underwriting Guidelines Details"
                                  aria-label={`View Guidelines for ${bankName}`}
                                  onClick={() => setViewGuidelinesPolicy(policy)}
                                >
                                  <Eye style={{ width: 14, height: 14 }} />
                                </button>
                                <button
                                  type="button"
                                  className="cw-action-btn cw-action-primary"
                                  title="Edit Policy Guidelines & Criteria"
                                  aria-label={`Edit Guidelines for ${bankName}`}
                                  onClick={() => handleOpenEdit(policy)}
                                >
                                  <Pencil style={{ width: 14, height: 14 }} />
                                </button>
                                <button
                                  type="button"
                                  className="cw-action-btn"
                                  title="Download Policy Guidelines Sheet"
                                  aria-label={`Download Guidelines for ${bankName}`}
                                  onClick={() => downloadSinglePolicy(policy)}
                                >
                                  <Download style={{ width: 14, height: 14 }} className="text-emerald-600 dark:text-emerald-400" />
                                </button>
                                <button
                                  type="button"
                                  className="cw-action-btn cw-action-delete"
                                  title="Delete Policy"
                                  aria-label={`Delete Policy for ${bankName}`}
                                  onClick={() => handleOpenDelete(policy)}
                                >
                                  <Trash2 style={{ width: 14, height: 14 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Adaptive Mobile Card List for Rules Tab */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <div className="p-8 text-center text-slate-500">
                    <RotateCcw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-600" />
                    <p className="text-sm">Loading bank policies...</p>
                  </div>
                ) : filteredPolicies.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Landmark className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No Matching Policies</h4>
                    <p className="text-xs text-slate-500">Try adjusting your search criteria.</p>
                  </div>
                ) : (
                  paginatedPolicies.map((policy: any, idx: number) => {
                    const bankName = policy.bank_name || policy.bank_code || "Partner Bank";

                    return (
                      <div key={policy.bank_id || policy.id || idx} className="p-4 bg-white dark:bg-slate-900 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                              <Landmark className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white text-sm">
                                {bankName}
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {policy.loan_type || "Personal Loan"} ({policy.employment_type || "Salaried"})
                              </span>
                            </div>
                          </div>
                          {renderStatusBadge(policy.status)}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Min Salary</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {policy.min_salary ? `₹${Number(policy.min_salary).toLocaleString("en-IN")}/mo` : "₹25,000/mo"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">CIBIL Cutoff</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {policy.min_cibil || 700}+
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Age Limits</span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {policy.min_age || 21}–{policy.max_age || 60} yrs
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Max Loan</span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {formatCurrency(policy.max_loan_amount || 4000000)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            className="cw-action-btn"
                            title="View Underwriting Guidelines Details"
                            aria-label={`View Guidelines for ${bankName}`}
                            onClick={() => setViewGuidelinesPolicy(policy)}
                          >
                            <Eye style={{ width: 14, height: 14 }} />
                          </button>
                          <button
                            type="button"
                            className="cw-action-btn cw-action-primary"
                            title="Edit Policy Guidelines & Criteria"
                            aria-label={`Edit Guidelines for ${bankName}`}
                            onClick={() => handleOpenEdit(policy)}
                          >
                            <Pencil style={{ width: 14, height: 14 }} />
                          </button>
                          <button
                            type="button"
                            className="cw-action-btn"
                            title="Download Policy Guidelines"
                            aria-label={`Download Guidelines for ${bankName}`}
                            onClick={() => downloadSinglePolicy(policy)}
                          >
                            <Download style={{ width: 14, height: 14 }} className="text-emerald-600 dark:text-emerald-400" />
                          </button>
                          <button
                            type="button"
                            className="cw-action-btn cw-action-delete"
                            title="Delete Policy"
                            aria-label={`Delete Policy for ${bankName}`}
                            onClick={() => handleOpenDelete(policy)}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Table Footer with Pagination */}
              {!loading && filteredPolicies.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 20px",
                    borderTop: "1px solid #e2e8f0",
                    fontSize: "0.8125rem",
                    color: "#64748b",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    Showing <strong>{totalFiltered === 0 ? 0 : startIndex + 1}</strong> to{" "}
                    <strong>{endIndex}</strong> of <strong>{totalFiltered}</strong> partner banks
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      className="cw-btn-secondary"
                      disabled={validCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      style={{ padding: "4px 10px", fontSize: "0.75rem", height: "auto" }}
                    >
                      <ChevronLeft style={{ width: 14, height: 14 }} />
                      <span>Prev</span>
                    </button>
                    <span style={{ padding: "0 6px", fontWeight: 600, color: "#334155" }}>
                      Page {validCurrentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="cw-btn-secondary"
                      disabled={validCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      style={{ padding: "4px 10px", fontSize: "0.75rem", height: "auto" }}
                    >
                      <span>Next</span>
                      <ChevronRight style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* POLICY MASTER FILES TAB - Modern Financial SaaS Layout matching Company Search */
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

            {/* Step 1 & Step 2: Upload Card with Bank Gate */}
            <div className="cw-card p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
              {/* Step 1: Bank Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Step 1: Select Partner Bank / Lender (Required before uploading)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <select
                      value={tab2IsCustomBank ? "__CUSTOM__" : tab2SelectedBank}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__CUSTOM__") {
                          setTab2IsCustomBank(true);
                        } else {
                          setTab2IsCustomBank(false);
                          setTab2SelectedBank(val);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-500 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* Status Indicator */}
                <div className="mt-2.5 flex items-center gap-2 text-xs">
                  {isTab2UploadUnlocked ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Ready to upload master file for: <strong>{tab2EffectiveBank}</strong></span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Select or type a Bank Name to unlock file upload</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Upload Dropzone (Gated) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (isTab2UploadUnlocked) setTab2IsDragOver(true);
                }}
                onDragLeave={() => setTab2IsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setTab2IsDragOver(false);
                  if (isTab2UploadUnlocked && e.dataTransfer.files?.[0]) {
                    handleTab2FileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  !isTab2UploadUnlocked
                    ? "border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40 opacity-60 cursor-not-allowed"
                    : tab2IsDragOver
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 cursor-copy"
                    : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-900/60 cursor-pointer"
                }`}
                onClick={() => {
                  if (isTab2UploadUnlocked && tab2FileInputRef.current) {
                    tab2FileInputRef.current.click();
                  }
                }}
              >
                <input
                  ref={tab2FileInputRef}
                  type="file"
                  accept=".txt, .pdf, .docx, .xlsx, .csv"
                  className="hidden"
                  disabled={!isTab2UploadUnlocked || tab2Uploading}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleTab2FileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="max-w-md mx-auto flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                      !isTab2UploadUnlocked
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400"
                        : "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {tab2Uploading ? (
                      <RotateCcw className="w-6 h-6 animate-spin text-blue-600" />
                    ) : !isTab2UploadUnlocked ? (
                      <Lock className="w-6 h-6" />
                    ) : (
                      <UploadCloud className="w-6 h-6" />
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    {tab2Uploading
                      ? "Uploading & Registering Master Policy..."
                      : !isTab2UploadUnlocked
                      ? "File Upload Locked"
                      : "Drag & Drop or Click to Upload Policy File"}
                  </h4>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {!isTab2UploadUnlocked
                      ? "Please select or type a Bank Name in Step 1 above to enable policy file upload."
                      : `Selected Bank: "${tab2EffectiveBank}". Accepts .txt, .pdf, .docx, .xlsx, .csv files up to 50 MB.`}
                  </p>

                  {isTab2UploadUnlocked && !tab2Uploading && (
                    <button
                      type="button"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Choose Policy Document
                    </button>
                  )}
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
                  onClick={handleOpenUploadModal}
                  disabled={isUploading}
                >
                  <UploadCloud style={{ width: 14, height: 14 }} />
                  <span>Upload Policy</span>
                </button>
              </div>
            </div>

            {/* Policy Master Files Table Container matching Image 3 */}
            <div className="cw-card shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Card Header matching Image 3 */}
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
                  <span>Policy Master Files</span>
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
                          <p style={{ margin: 0, fontSize: "0.875rem" }}>Loading policy spreadsheets &amp; documents...</p>
                        </td>
                      </tr>
                    ) : filteredPolicyFiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                          <FileSpreadsheet style={{ width: 36, height: 36, color: "#94a3b8", margin: "0 auto 8px" }} />
                          <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", fontWeight: 600 }} className="text-slate-900 dark:text-white">
                            No Policy Documents Found
                          </h4>
                          <p style={{ margin: 0, fontSize: "0.8125rem" }}>
                            {searchFileQuery || selectedFileBank !== "all"
                              ? "No policy files match your search criteria."
                              : "Upload a bank policy spreadsheet or document to get started."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedFiles.map((file: any, idx: number) => {
                        const rowNumber = startFileIndex + idx + 1
                        const kbSize = file.file_size_bytes
                          ? file.file_size_bytes > 1024 * 1024
                            ? (file.file_size_bytes / (1024 * 1024)).toFixed(1) + " MB"
                            : (file.file_size_bytes / 1024).toFixed(1) + " KB"
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
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    background: "rgba(37, 99, 235, 0.1)",
                                    border: "1px solid rgba(37, 99, 235, 0.2)",
                                    color: "#2563eb",
                                    padding: "4px 12px",
                                    borderRadius: "9999px",
                                    fontSize: "0.8125rem",
                                    fontWeight: 600,
                                  }}
                                >
                                  <Landmark style={{ width: 14, height: 14, color: "#2563eb", flexShrink: 0 }} />
                                  <span>{file.bank_name || "Partner Lender"}</span>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: "left" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    background: isSpreadsheet ? "rgba(5, 150, 105, 0.1)" : "rgba(37, 99, 235, 0.1)",
                                    border: `1px solid ${isSpreadsheet ? "rgba(5, 150, 105, 0.2)" : "rgba(37, 99, 235, 0.2)"}`,
                                    color: isSpreadsheet ? "#059669" : "#2563eb",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {isSpreadsheet ? (
                                    <FileSpreadsheet style={{ width: 16, height: 16 }} />
                                  ) : (
                                    <FileText style={{ width: 16, height: 16 }} />
                                  )}
                                </div>
                                <span style={{ fontWeight: 600, fontSize: "0.875rem" }} title={file.file_name}>
                                  {file.file_name}
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span style={{ fontWeight: 700, color: "#2563eb", fontSize: "0.84rem" }}>
                                {kbSize}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                <button
                                  type="button"
                                  className="cw-action-btn"
                                  title="View Document"
                                  aria-label={`View ${file.file_name}`}
                                  onClick={() => handleOpenViewer(file.id, file)}
                                >
                                  <Eye style={{ width: 14, height: 14 }} />
                                </button>
                                <button
                                  type="button"
                                  className="cw-action-btn cw-action-primary"
                                  title="Edit Master Policy"
                                  aria-label={`Edit ${file.file_name}`}
                                  onClick={() => handleOpenEditorFile(file)}
                                >
                                  <Pencil style={{ width: 14, height: 14 }} />
                                </button>
                                <button
                                  type="button"
                                  className="cw-action-btn"
                                  title="Download File"
                                  aria-label={`Download ${file.file_name}`}
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
                                  aria-label={`Delete ${file.file_name}`}
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

              {/* Adaptive Mobile Card List for Documents Tab */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {loadingFiles ? (
                  <div className="p-8 text-center text-slate-500">
                    <RotateCcw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-600" />
                    <p className="text-sm">Loading policy files...</p>
                  </div>
                ) : filteredPolicyFiles.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No Policy Documents Found</h4>
                    <p className="text-xs text-slate-500">Try adjusting your search criteria.</p>
                  </div>
                ) : (
                  paginatedFiles.map((file: any, idx: number) => {
                    const kbSize = file.file_size_bytes
                      ? file.file_size_bytes > 1024 * 1024
                        ? (file.file_size_bytes / (1024 * 1024)).toFixed(1) + " MB"
                        : (file.file_size_bytes / 1024).toFixed(1) + " KB"
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
              <div className="bp-footer" style={{ borderTop: "1px solid #f1f5f9", padding: "12px 20px" }}>
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
        )}
      </div>

      {/* =========================================================================
          VIEW POLICY GUIDELINES DETAILS MODAL (Tab 1 Underwriting Criteria)
          ========================================================================= */}
      {viewGuidelinesPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in" onClick={() => setViewGuidelinesPolicy(null)}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl max-w-2xl w-full p-6 text-left relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setViewGuidelinesPolicy(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">
                  {viewGuidelinesPolicy.bank_name || viewGuidelinesPolicy.bank_code}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold font-mono">
                    {viewGuidelinesPolicy.bank_code || "BANK"}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {viewGuidelinesPolicy.loan_type || "Personal Loan"} ({viewGuidelinesPolicy.employment_type || "Salaried"})
                  </span>
                </div>
              </div>
            </div>

            {/* Key Underwriting Parameters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                  Minimum Monthly Salary
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-base">
                  {viewGuidelinesPolicy.min_salary ? `₹${Number(viewGuidelinesPolicy.min_salary).toLocaleString("en-IN")}` : "₹25,000"} / mo
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                  CIBIL Score Cutoff
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-base">
                  {viewGuidelinesPolicy.min_cibil || 700}+ (Max: {viewGuidelinesPolicy.max_cibil || 900})
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                  Eligible Age Limits
                </span>
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  {viewGuidelinesPolicy.min_age || 21} to {viewGuidelinesPolicy.max_age || 60} Years
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                  Loan Amount Range
                </span>
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  {formatCurrency(viewGuidelinesPolicy.min_loan_amount || 50000)} – {formatCurrency(viewGuidelinesPolicy.max_loan_amount || 4000000)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                  Tenure Range (Months)
                </span>
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  {viewGuidelinesPolicy.min_tenure_months || 12} to {viewGuidelinesPolicy.max_tenure_months || 60} Months
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                  Rate of Interest (ROI) &amp; FOIR
                </span>
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  {viewGuidelinesPolicy.roi || "10.49%"} | FOIR: {viewGuidelinesPolicy.foir_percent || 50}%
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => downloadSinglePolicy(viewGuidelinesPolicy)}
                className="cw-btn-secondary text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Download Excel</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = viewGuidelinesPolicy;
                  setViewGuidelinesPolicy(null);
                  handleOpenEdit(p);
                }}
                className="cw-btn-primary text-xs flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Guidelines</span>
              </button>
              <button
                type="button"
                onClick={() => setViewGuidelinesPolicy(null)}
                className="cw-btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
          MODERN DELETE CONFIRMATION MODAL
          ========================================================================= */}
      <ModernConfirmDialog
        isOpen={!!deleteConfirmPolicy}
        onClose={() => !isDeletingPolicy && setDeleteConfirmPolicy(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Master Policy File?"
        description="Are you sure you want to delete this master policy file? The bank database record will remain active in the system, but the associated policy document will be permanently removed."
        itemTitle={deleteConfirmPolicy ? (deleteConfirmPolicy.file_name || deleteConfirmPolicy.attachment_file_name || "Master Policy Document") : undefined}
        itemSubtitle={deleteConfirmPolicy ? `Bank: ${deleteConfirmPolicy.bank_name || "Partner Bank"}` : undefined}
        confirmText="Confirm Delete"
        isLoading={isDeletingPolicy}
      />

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

      {/* =========================================================================
          UPLOAD POLICY FILE MODAL
          ========================================================================= */}
      {uploadModalOpen && (
        <div className="modal-backdrop" onClick={() => !isUploading && setUploadModalOpen(false)}>
          <div className="edit-policy-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="edit-policy-header">
              <div className="edit-policy-title-area">
                <div className="edit-policy-icon-badge">
                  <i className="bi bi-upload" />
                </div>
                <div>
                  <h2 className="edit-policy-title">Upload Policy File</h2>
                  <p className="edit-policy-subtitle">
                    Upload a new bank policy document with loan type classification.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => !isUploading && setUploadModalOpen(false)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg" style={{ fontSize: "1.1rem" }} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleUploadPolicy} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div className="edit-policy-body" style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                  {/* Bank Selection */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Bank <span style={{ color: "var(--danger)" }}>*</span></label>
                    <div className="policy-select-wrap">
                      <i className="bi bi-bank policy-select-icon" />
                      <select
                        className="form-select policy-select-has-icon"
                        value={isCustomUploadBank ? "__CUSTOM__" : uploadBankName}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === "__CUSTOM__") {
                            setIsCustomUploadBank(true)
                          } else {
                            setIsCustomUploadBank(false)
                            setUploadBankName(val)
                            const matched = allBankOptions.find((b) => b.name === val)
                            if (matched) setUploadBankId(matched.id)
                          }
                        }}
                        required
                      >
                        <option value="">Select a bank...</option>
                        {allBankOptions.length > 0 ? (
                          allBankOptions.map((b) => (
                            <option key={b.name} value={b.name}>
                              {b.name}
                            </option>
                          ))
                        ) : (
                          <option value={uploadBankName}>{uploadBankName}</option>
                        )}
                        <option value="__CUSTOM__">+ Custom Bank / Manual Entry...</option>
                      </select>
                    </div>

                    {isCustomUploadBank && (
                      <div style={{ marginTop: "10px" }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Type custom Bank or Lender name..."
                          value={customUploadBankName}
                          onChange={(e) => setCustomUploadBankName(e.target.value)}
                          required
                          autoFocus
                          style={{ fontSize: "0.875rem" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Loan Type */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Loan Type <span style={{ color: "var(--danger)" }}>*</span></label>
                    <select
                      className="form-select"
                      value={uploadLoanType}
                      onChange={(e) => setUploadLoanType(e.target.value)}
                      required
                    >
                      <option value="Personal Loan">Personal Loan</option>
                      <option value="Home Loan">Home Loan</option>
                      <option value="Auto Loan">Auto Loan</option>
                      <option value="Business Loan">Business Loan</option>
                      <option value="Education Loan">Education Loan</option>
                    </select>
                  </div>

                  {/* Policy Version */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Policy Version</label>
                    <select
                      className="form-select"
                      value={uploadPolicyVersion}
                      onChange={(e) => setUploadPolicyVersion(e.target.value)}
                    >
                      <option value="V1">V1 (Initial)</option>
                      <option value="V2">V2 (Updated)</option>
                      <option value="V3">V3 (Latest)</option>
                    </select>
                  </div>

                  {/* Employment Type */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Employment Type</label>
                    <select
                      className="form-select"
                      value={uploadEmployment}
                      onChange={(e) => setUploadEmployment(e.target.value)}
                    >
                      <option value="Salaried">Salaried</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Business Owner">Business Owner</option>
                      <option value="Professional">Professional</option>
                    </select>
                  </div>

                  {/* File Upload */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Policy File <span style={{ color: "var(--danger)" }}>*</span></label>
                    <div className="file-upload-area" style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius-md)", padding: "1.5rem", textAlign: "center", background: "var(--surface-2)" }}>
                      <input
                        ref={uploadFileInputRef}
                        type="file"
                        accept=".txt,.pdf,.docx,.csv"
                        style={{ display: "none" }}
                        onChange={handleUploadFileSelected}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={() => uploadFileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <i className="bi bi-file-earmark-arrow-up" style={{ marginRight: "0.5rem" }} />
                        {uploadFile ? `Selected: ${uploadFile.name}` : "Choose File (.txt, .pdf, .docx, .csv)"}
                      </button>
                      {uploadFile && (
                        <p style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--ink-soft)" }}>
                          Size: {(uploadFile.size / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="policy-field-group">
                    <label className="policy-field-label">Description (Optional)</label>
                    <textarea
                      className="form-control"
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="Add any notes about this policy file..."
                      rows={3}
                    />
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div className="edit-policy-footer">
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", justifyContent: "flex-end", width: "100%" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => !isUploading && setUploadModalOpen(false)}
                    disabled={isUploading}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={isUploading || !uploadFile || !uploadBankId || !uploadLoanType}
                    style={{ background: "var(--success)", color: "#ffffff", border: "none", minWidth: 150 }}
                  >
                    {isUploading ? (
                      <>
                        <span className="spinner-inline" /> Uploading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-upload" style={{ marginRight: "0.25rem" }} /> Upload Policy
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
