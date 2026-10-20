"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import AdminHeader from "@/components/admin/AdminHeader";
import ModernSearchBar from "@/components/ui/ModernSearchBar";
import {
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  Download,
  Trash2,
  UploadCloud,
  RotateCw,
  Landmark,
  AlertCircle,
  Eye,
  Edit2,
  Plus,
  Lock,
  Unlock,
  Copy,
  Check,
  X,
  Search,
  Filter,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

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
  "Cholamandalam",
  "Fibe (EarlySalary)",
  "Finnable Credit",
  "L&T Finance",
  "Piramal Finance",
  "Poonawalla Fincorp",
  "SMFG India Credit",
  "TATA Capital",
  "Utkarsh Small Finance Bank",
  "Corporate Master",
  "Multi-Bank Master",
];

interface CompanyRecordItem {
  id: number;
  company_name: string;
  bank_name: string;
  company_category: string;
  other_info?: string;
  sr_no?: string;
  file_id?: number;
}

export default function CompanySearchPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Tab State: "records" (Tab 1) | "upload" (Tab 2)
  const [activeTab, setActiveTab] = useState<"records" | "upload">("records");

  // Global Notification / Toast message
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  const showNotification = (msg: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.msg === msg ? null : prev));
    }, 4500);
  };

  // ==========================================
  // TAB 1: COMPANY RECORDS DIRECTORY STATES
  // ==========================================
  const [records, setRecords] = useState<CompanyRecordItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsLimit, setRecordsLimit] = useState(25);
  const [recordsTotalPages, setRecordsTotalPages] = useState(1);
  const [recordsSearchQuery, setRecordsSearchQuery] = useState("");
  const [recordsBankFilter, setRecordsBankFilter] = useState("all");
  const [recordsCategoryFilter, setRecordsCategoryFilter] = useState("all");
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Modals for Tab 1 Actions
  const [viewRecord, setViewRecord] = useState<CompanyRecordItem | null>(null);
  const [editRecord, setEditRecord] = useState<CompanyRecordItem | null>(null);
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<CompanyRecordItem | null>(null);
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form states for Create / Edit
  const [formCompanyName, setFormCompanyName] = useState("");
  const [formBankName, setFormBankName] = useState("");
  const [formCategory, setFormCategory] = useState("Approved");
  const [formOtherInfo, setFormOtherInfo] = useState("");

  // ==========================================
  // TAB 2: UPLOAD & SPREADSHEETS STATES
  // ==========================================
  const [files, setFiles] = useState<any[]>([]);
  const [totalCompanyRecords, setTotalCompanyRecords] = useState<number>(0);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Tab 2 Bank Name Gate & Selection
  const [uploadSelectedBank, setUploadSelectedBank] = useState<string>("");
  const [uploadCustomBank, setUploadCustomBank] = useState<string>("");

  // Tab 2 Spreadsheets Search & Filter
  const [filesSearchQuery, setFilesSearchQuery] = useState("");
  const [filesBankFilter, setFilesBankFilter] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Computed Effective Bank for Upload
  const effectiveUploadBank = useMemo(() => {
    if (uploadSelectedBank === "__CUSTOM__") {
      return uploadCustomBank.trim();
    }
    return uploadSelectedBank.trim();
  }, [uploadSelectedBank, uploadCustomBank]);

  const isUploadUnlocked = effectiveUploadBank.length > 0;

  // 1. Authentication Check
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/verify", { credentials: "include" });
        if (!res.ok) {
          router.replace("/?auth=login&from=/admin/company-search");
          return;
        }
        const data = await res.json();
        if (data.success) {
          const isAdminUser =
            String(data.user?.role || "").trim().toLowerCase() === "admin" ||
            data.user?.is_admin === true ||
            String(data.user?.email || "").toLowerCase() === "admin@gmail.com" ||
            String(data.user?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
            String(data.user?.email || "").toLowerCase().startsWith("admin");

          if (!isAdminUser) {
            router.replace("/home?section=assistant");
            return;
          }
          setUser(data.user);
        } else {
          router.replace("/?auth=login&from=/admin/company-search");
        }
      } catch {
        router.replace("/?auth=login&from=/admin/company-search");
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  // 2. Load Company Records (Tab 1)
  const loadCompanyRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const params = new URLSearchParams();
      if (recordsSearchQuery.trim()) params.set("q", recordsSearchQuery.trim());
      if (recordsBankFilter && recordsBankFilter !== "all") params.set("bank", recordsBankFilter);
      if (recordsCategoryFilter && recordsCategoryFilter !== "all") params.set("category", recordsCategoryFilter);
      params.set("page", String(recordsPage));
      params.set("limit", String(recordsLimit));

      const res = await fetch(`/api/admin/company-records?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecords(data.records || []);
        setRecordsTotal(data.total || 0);
        setRecordsTotalPages(data.totalPages || 1);
        if (Array.isArray(data.availableBanks) && data.availableBanks.length > 0) {
          setAvailableBanks(data.availableBanks);
        }
        if (Array.isArray(data.availableCategories) && data.availableCategories.length > 0) {
          setAvailableCategories(data.availableCategories);
        }
      } else {
        setRecords([]);
      }
    } catch (e) {
      console.warn("Failed to load company records:", e);
    } finally {
      setRecordsLoading(false);
    }
  }, [recordsSearchQuery, recordsBankFilter, recordsCategoryFilter, recordsPage, recordsLimit]);

  // 3. Load Spreadsheets Files List (Tab 2)
  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch("/api/bank/files", { credentials: "include" });
      const data = await res.json();
      const filesList = Array.isArray(data.files) ? data.files : [];
      setFiles(filesList);

      if (typeof data.totalCompanyRecords === "number") {
        setTotalCompanyRecords(data.totalCompanyRecords);
      } else {
        const count = filesList.reduce(
          (sum: number, f: any) => sum + (Number(f.record_count) || 0),
          0
        );
        setTotalCompanyRecords(count);
      }
    } catch (e) {
      console.warn("Failed to load company spreadsheets:", e);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  // Fetch initial data when authenticated
  useEffect(() => {
    if (user) {
      loadFiles();
      loadCompanyRecords();
    }
  }, [user, loadFiles, loadCompanyRecords]);

  // Unique Banks List from Files for Tab 2 filter
  const fileBankOptions = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => {
      const b = (f.bank_name || "").trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [files]);

  // Filtered Spreadsheets for Tab 2
  const filteredFiles = useMemo(() => {
    const q = filesSearchQuery.toLowerCase().trim();
    return files.filter((f) => {
      const matchesBank =
        filesBankFilter === "all" ||
        (f.bank_name || "").toLowerCase() === filesBankFilter.toLowerCase();
      const matchesQuery =
        !q ||
        (f.file_name || "").toLowerCase().includes(q) ||
        (f.bank_name || "").toLowerCase().includes(q);
      return matchesBank && matchesQuery;
    });
  }, [files, filesSearchQuery, filesBankFilter]);

  // Upload Spreadsheet Handler (Tab 2)
  async function handleFileUpload(file: File) {
    if (!file) return;

    if (!isUploadUnlocked) {
      showNotification("Please select or enter a Bank / Lender name before uploading.", "error");
      return;
    }

    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    // Reject policy files strictly
    if ([".pdf", ".docx", ".doc", ".txt", ".rtf", ".odt"].includes(ext)) {
      showNotification("Policy documents are not accepted in Company Data. Please upload spreadsheets (.csv, .xlsx, .xls).", "error");
      return;
    }

    if (![".csv", ".xlsx", ".xls"].includes(ext)) {
      showNotification("Please select a valid Company Data spreadsheet (.csv, .xlsx, .xls)", "error");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showNotification("File size exceeds 50 MB limit", "error");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bank_name", effectiveUploadBank);

      const res = await fetch("/api/bank/files", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showNotification(
          `Spreadsheet "${file.name}" uploaded successfully for "${effectiveUploadBank}"! Ingested ${data.file?.record_count || data.record_count || 0} company records.`,
          "success"
        );
        loadFiles();
        loadCompanyRecords();
      } else {
        showNotification(`Upload failed: ${data.error || "Unknown error"}`, "error");
      }
    } catch {
      showNotification("Upload failed due to network error", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // Delete Spreadsheet File Handler (Tab 2)
  async function handleDeleteFile(fileId: number, fileName: string) {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This will remove all associated company records from the database.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/bank/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showNotification(`File "${fileName}" deleted successfully.`, "info");
        loadFiles();
        loadCompanyRecords();
      } else {
        showNotification(`Delete failed: ${data.error || "Unknown error"}`, "error");
      }
    } catch {
      showNotification("Delete failed due to network error", "error");
    }
  }

  // Create Single Company Record (Tab 1)
  async function handleCreateRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!formCompanyName.trim()) {
      showNotification("Company name is required.", "error");
      return;
    }

    setIsActionSubmitting(true);
    try {
      const res = await fetch("/api/admin/company-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          company_name: formCompanyName.trim(),
          bank_name: formBankName.trim() || "Corporate Master",
          company_category: formCategory.trim() || "Approved",
          other_info: formOtherInfo.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Created company record for "${formCompanyName}"`, "success");
        setIsAddRecordModalOpen(false);
        setFormCompanyName("");
        setFormBankName("");
        setFormCategory("Approved");
        setFormOtherInfo("");
        loadCompanyRecords();
        loadFiles();
      } else {
        showNotification(data.error || "Failed to create company record", "error");
      }
    } catch {
      showNotification("Network error creating company record", "error");
    } finally {
      setIsActionSubmitting(false);
    }
  }

  // Edit Single Company Record (Tab 1)
  async function handleUpdateRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!editRecord || !formCompanyName.trim()) return;

    setIsActionSubmitting(true);
    try {
      const res = await fetch("/api/admin/company-records", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: editRecord.id,
          company_name: formCompanyName.trim(),
          bank_name: formBankName.trim() || "Corporate Master",
          company_category: formCategory.trim() || "Approved",
          other_info: formOtherInfo.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Updated record for "${formCompanyName}"`, "success");
        setEditRecord(null);
        loadCompanyRecords();
      } else {
        showNotification(data.error || "Failed to update record", "error");
      }
    } catch {
      showNotification("Network error updating record", "error");
    } finally {
      setIsActionSubmitting(false);
    }
  }

  // Delete Single Company Record (Tab 1)
  async function handleDeleteRecordConfirm() {
    if (!deleteRecordTarget) return;

    setIsActionSubmitting(true);
    try {
      const res = await fetch(`/api/admin/company-records?id=${deleteRecordTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Deleted "${deleteRecordTarget.company_name}"`, "info");
        setDeleteRecordTarget(null);
        loadCompanyRecords();
        loadFiles();
      } else {
        showNotification(data.error || "Failed to delete record", "error");
      }
    } catch {
      showNotification("Network error deleting record", "error");
    } finally {
      setIsActionSubmitting(false);
    }
  }

  // Copy helper
  const handleCopyText = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Export Tab 1 Company Records to Excel
  const exportCompanyRecordsToExcel = () => {
    if (records.length === 0) return;

    const exportData = records.map((r, idx) => ({
      "Sr No": (recordsPage - 1) * recordsLimit + idx + 1,
      "Company Name": r.company_name || "N/A",
      "Bank / Lender": r.bank_name || "Corporate Master",
      "Category Tier": r.company_category || "Approved",
      "Other Information / Remarks": r.other_info || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Company Records");

    const maxProps = ["Sr No", "Company Name", "Bank / Lender", "Category Tier", "Other Information / Remarks"];
    worksheet["!cols"] = maxProps.map((key) => {
      let maxLen = key.length;
      exportData.forEach((row: any) => {
        const val = String(row[key] ?? "");
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
    });

    const filename = `Company_Records_Page_${recordsPage}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Export Tab 2 Spreadsheets to Excel
  const exportCompanyFilesToExcel = () => {
    if (filteredFiles.length === 0) return;

    const exportData = filteredFiles.map((f, idx) => ({
      "Sr No": idx + 1,
      "File Name": f.file_name || "N/A",
      "Bank / Lender": f.bank_name || "Corporate Master",
      "Ingested Records": Number(f.record_count) || 0,
      "Upload Date": f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString("en-IN") : "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Spreadsheet Files");

    const filename = `Company_Spreadsheets_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Category Badge Styler
  const renderCategoryBadge = (cat: string) => {
    const c = (cat || "").toLowerCase();
    let badgeClass = "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    if (c.includes("diamond") || c.includes("super")) {
      badgeClass = "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    } else if (c.includes("cat a") || c.includes("tier 1") || c.includes("elite")) {
      badgeClass = "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    } else if (c.includes("cat b") || c.includes("tier 2")) {
      badgeClass = "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    } else if (c.includes("cat c") || c.includes("tier 3") || c.includes("unlisted")) {
      badgeClass = "bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800";
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
        <Layers className="w-3 h-3 opacity-70" />
        {cat || "Approved"}
      </span>
    );
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-12 text-center">
        <RotateCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          Verifying administrator access...
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-200">
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <AdminHeader
        user={user}
        title="Company Search"
        description="Search corporate categorization records, view company underwriting tiers, and upload lender master spreadsheets."
        breadcrumbs={[{ label: "Company Search" }]}
      />

      {/* 2. MAIN CONTAINER */}
      <main className="cw-admin-container py-6 space-y-6">
        {/* Global Notification Banner */}
        {notification && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between text-sm font-medium transition-all shadow-sm ${
              notification.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : notification.type === "error"
                ? "bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                : "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : notification.type === "error" ? (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />
              )}
              <span>{notification.msg}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="border-0 bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* 2-TAB SEGMENTED PILL BAR (MATCHING SCREENSHOT) */}
        <div className="bp-header-card">
          <div className="bp-header-left">
            <div className="bp-icon-badge" title="Company Search Directory" aria-label="Company Search">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>

            {/* Sub-tab Pill Switcher */}
            <div className="bp-tab-pill-group" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "records"}
                className={`bp-tab-pill ${activeTab === "records" ? "active" : ""}`}
                onClick={() => setActiveTab("records")}
              >
                <Building2 className="w-4 h-4" />
                <span>Company Records</span>
                <span className="bp-tab-pill-count">
                  {recordsTotal > 0 ? recordsTotal.toLocaleString() : totalCompanyRecords > 0 ? totalCompanyRecords.toLocaleString() : "533K+"}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "upload"}
                className={`bp-tab-pill ${activeTab === "upload" ? "active" : ""}`}
                onClick={() => setActiveTab("upload")}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Upload &amp; Spreadsheets</span>
                <span className="bp-tab-pill-count">{files.length}</span>
              </button>
            </div>
          </div>

          <div className="bp-header-right flex items-center gap-2.5">
            <button
              type="button"
              className="cw-btn-secondary"
              onClick={activeTab === "records" ? loadCompanyRecords : loadFiles}
              disabled={activeTab === "records" ? recordsLoading : loadingFiles}
              title="Refresh Current View"
            >
              <RotateCw className={`w-3.5 h-3.5 ${(activeTab === "records" ? recordsLoading : loadingFiles) ? "animate-spin text-blue-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: COMPANY RECORDS DIRECTORY                         */}
        {/* ========================================================= */}
        {activeTab === "records" && (
          <div className="space-y-6">
            {/* Metric KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="cw-card p-4 sm:p-5 flex items-center gap-3.5 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {recordsTotal > 0 ? recordsTotal.toLocaleString() : "533,316+"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Companies Ingested</div>
                </div>
              </div>

              <div className="cw-card p-4 sm:p-5 flex items-center gap-3.5 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {availableBanks.length > 0 ? availableBanks.length : PRESET_PARTNER_BANKS.length}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mapped Partner Lenders</div>
                </div>
              </div>

              <div className="cw-card p-4 sm:p-5 flex items-center gap-3.5 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {availableCategories.length > 0 ? availableCategories.length : "12"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Category Tiers Available</div>
                </div>
              </div>

              <div className="cw-card p-4 sm:p-5 flex items-center gap-3.5 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {files.length}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Source Spreadsheets</div>
                </div>
              </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="cw-card p-4 flex items-center justify-between flex-wrap gap-3 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 flex-wrap flex-1 min-w-[280px]">
                <span className="cw-badge cw-badge-info text-xs py-1.5 px-3">
                  <span>Results:</span>
                  <strong className="ml-1">{recordsTotal.toLocaleString()}</strong>
                </span>

                <div className="relative flex-1 max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={recordsSearchQuery}
                    onChange={(e) => {
                      setRecordsSearchQuery(e.target.value);
                      setRecordsPage(1);
                    }}
                    placeholder="Search company name or remarks..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  className="cw-select text-xs py-1.5 px-2.5 max-w-[200px]"
                  value={recordsBankFilter}
                  onChange={(e) => {
                    setRecordsBankFilter(e.target.value);
                    setRecordsPage(1);
                  }}
                >
                  <option value="all">All Banks ({availableBanks.length})</option>
                  {availableBanks.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                <select
                  className="cw-select text-xs py-1.5 px-2.5 max-w-[180px]"
                  value={recordsCategoryFilter}
                  onChange={(e) => {
                    setRecordsCategoryFilter(e.target.value);
                    setRecordsPage(1);
                  }}
                >
                  <option value="all">All Categories ({availableCategories.length})</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {(recordsSearchQuery || recordsBankFilter !== "all" || recordsCategoryFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecordsSearchQuery("");
                      setRecordsBankFilter("all");
                      setRecordsCategoryFilter("all");
                      setRecordsPage(1);
                    }}
                    className="cw-btn-secondary text-xs"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="cw-btn-secondary text-xs"
                  onClick={exportCompanyRecordsToExcel}
                  disabled={records.length === 0}
                  title="Export current page to Excel"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Page</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormCompanyName("");
                    setFormBankName(PRESET_PARTNER_BANKS[0]);
                    setFormCategory("Approved");
                    setFormOtherInfo("");
                    setIsAddRecordModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  title="Add single company record manually"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Company</span>
                </button>
              </div>
            </div>

            {/* Company Records Table Card */}
            <div className="cw-card shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="hidden md:block cw-table-container border-0">
                <table className="cw-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60, textAlign: "center" }}>#</th>
                      <th style={{ minWidth: 260, textAlign: "left" }}>Company Name</th>
                      <th style={{ width: 200, textAlign: "left" }}>Bank / Lender</th>
                      <th style={{ width: 160, textAlign: "center" }}>Category Tier</th>
                      <th style={{ minWidth: 180, textAlign: "left" }}>Other Information / Remarks</th>
                      <th style={{ width: 140, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordsLoading ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                          <RotateCw style={{ width: 24, height: 24, margin: "0 auto 8px" }} className="animate-spin text-blue-600" />
                          <p style={{ margin: 0, fontSize: "0.875rem" }}>Loading company records...</p>
                        </td>
                      </tr>
                    ) : records.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                          <Building2 style={{ width: 36, height: 36, color: "#94a3b8", margin: "0 auto 8px" }} />
                          <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", fontWeight: 600 }} className="text-slate-900 dark:text-white">
                            No Company Records Found
                          </h4>
                          <p style={{ margin: 0, fontSize: "0.8125rem" }}>
                            {recordsSearchQuery ? "No records match your search criteria." : "Click '+ Add Company' or upload a spreadsheet in Tab 2 to ingest records."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      records.map((r, idx) => {
                        const rowNumber = (recordsPage - 1) * recordsLimit + idx + 1;
                        return (
                          <tr key={r.id}>
                            <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: 600, fontSize: "0.8125rem" }}>
                              {rowNumber}
                            </td>
                            <td style={{ textAlign: "left" }}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                  <Building2 className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white text-sm">{r.company_name}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: "left" }}>
                              <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                                <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{r.bank_name || "Corporate Master"}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {renderCategoryBadge(r.company_category)}
                            </td>
                            <td style={{ textAlign: "left" }}>
                              <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1" title={r.other_info || "—"}>
                                {r.other_info || "—"}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setViewRecord(r)}
                                  className="cw-action-btn"
                                  title="View company details"
                                  aria-label={`View details of ${r.company_name}`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditRecord(r);
                                    setFormCompanyName(r.company_name);
                                    setFormBankName(r.bank_name || "Corporate Master");
                                    setFormCategory(r.company_category || "Approved");
                                    setFormOtherInfo(r.other_info || "");
                                  }}
                                  className="cw-action-btn text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                  title="Edit company record"
                                  aria-label={`Edit ${r.company_name}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeleteRecordTarget(r)}
                                  className="cw-action-btn text-red-600 hover:text-red-700 dark:text-red-400"
                                  title="Delete company record"
                                  aria-label={`Delete ${r.company_name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

              {/* Mobile Card List (Visible <= 768px) */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {recordsLoading ? (
                  <div className="p-8 text-center text-slate-500">
                    <RotateCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-600" />
                    <p className="text-sm">Loading company records...</p>
                  </div>
                ) : records.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No Records Found</h4>
                  </div>
                ) : (
                  records.map((r, idx) => (
                    <div key={r.id} className="p-4 bg-white dark:bg-slate-900 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">{r.company_name}</h4>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <Landmark className="w-3 h-3" />
                            <span>{r.bank_name || "Corporate Master"}</span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">
                          #{(recordsPage - 1) * recordsLimit + idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>{renderCategoryBadge(r.company_category)}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewRecord(r)}
                            className="cw-action-btn"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditRecord(r);
                              setFormCompanyName(r.company_name);
                              setFormBankName(r.bank_name || "Corporate Master");
                              setFormCategory(r.company_category || "Approved");
                              setFormOtherInfo(r.other_info || "");
                            }}
                            className="cw-action-btn text-blue-600"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteRecordTarget(r)}
                            className="cw-action-btn text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Table Footer with Server-Side Pagination */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Showing</span>
                  <strong className="text-slate-900 dark:text-white">
                    {records.length > 0 ? (recordsPage - 1) * recordsLimit + 1 : 0}
                  </strong>
                  <span>to</span>
                  <strong className="text-slate-900 dark:text-white">
                    {Math.min(recordsPage * recordsLimit, recordsTotal)}
                  </strong>
                  <span>of</span>
                  <strong className="text-slate-900 dark:text-white">{recordsTotal.toLocaleString()}</strong>
                  <span>records</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span>Per page:</span>
                    <select
                      value={recordsLimit}
                      onChange={(e) => {
                        setRecordsLimit(parseInt(e.target.value, 10));
                        setRecordsPage(1);
                      }}
                      className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-xs"
                    >
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={recordsPage <= 1 || recordsLoading}
                      onClick={() => setRecordsPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="px-2 font-semibold text-slate-800 dark:text-slate-200">
                      Page {recordsPage} of {recordsTotalPages}
                    </span>

                    <button
                      type="button"
                      disabled={recordsPage >= recordsTotalPages || recordsLoading}
                      onClick={() => setRecordsPage((p) => Math.min(recordsTotalPages, p + 1))}
                      className="p-1.5 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: UPLOAD & SPREADSHEETS                             */}
        {/* ========================================================= */}
        {activeTab === "upload" && (
          <div className="space-y-6">
            {/* Bank Selection & Gating Control Card */}
            <div className="cw-card p-5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      Step 1: Select Bank / Lender Destination
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Specify which lender or catalog this company list belongs to. File upload unlocks only after a bank is selected.
                    </p>
                  </div>
                </div>

                {isUploadUnlocked ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    <Unlock className="w-3.5 h-3.5" />
                    Upload Unlocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                    Upload Locked
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Choose Bank / Lender Name *
                  </label>
                  <select
                    value={uploadSelectedBank}
                    onChange={(e) => {
                      setUploadSelectedBank(e.target.value);
                      if (e.target.value !== "__CUSTOM__") {
                        setUploadCustomBank("");
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Please Select Bank / Lender --</option>
                    {PRESET_PARTNER_BANKS.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Custom Bank / Manual Entry...</option>
                  </select>
                </div>

                {uploadSelectedBank === "__CUSTOM__" && (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Type Custom Bank / NBFC Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Federal Bank, Navi, Tata Motors Finance..."
                      value={uploadCustomBank}
                      onChange={(e) => setUploadCustomBank(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-blue-400 dark:border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Drag & Drop Upload Card (Unlocked only if bank chosen) */}
            <div
              className={`cw-card p-6 sm:p-8 text-center transition-all shadow-sm border-2 border-dashed ${
                !isUploadUnlocked
                  ? "bg-slate-100/60 dark:bg-slate-900/40 border-slate-300 dark:border-slate-800 opacity-75 cursor-not-allowed"
                  : isDragOver
                  ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 dark:border-blue-400 cursor-pointer"
                  : "bg-white dark:bg-slate-900 border-blue-300 dark:border-blue-800 hover:border-blue-500 cursor-pointer"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                if (isUploadUnlocked) setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (!isUploadUnlocked) {
                  showNotification("Please select or enter a Bank / Lender name above to enable spreadsheet upload.", "error");
                  return;
                }
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
              onClick={() => {
                if (!isUploadUnlocked) {
                  showNotification("Please select or enter a Bank / Lender name above to enable spreadsheet upload.", "error");
                  return;
                }
                if (fileInputRef.current) fileInputRef.current.click();
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: "none" }}
                disabled={!isUploadUnlocked}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />

              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors ${
                  !isUploadUnlocked
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400"
                    : "bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                }`}
              >
                {!isUploadUnlocked ? <Lock className="w-7 h-7" /> : <UploadCloud className="w-7 h-7" />}
              </div>

              <h3 className="m-0 mb-1 text-base font-bold text-slate-900 dark:text-white">
                {uploading
                  ? `Ingesting company records for ${effectiveUploadBank}...`
                  : isUploadUnlocked
                  ? `Upload Company Data for "${effectiveUploadBank}"`
                  : "Upload Locked: Select Bank / Lender Name Above"}
              </h3>

              <p className="m-0 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {isUploadUnlocked
                  ? "Drag & drop a CSV or Excel spreadsheet here, or click to browse. Max size: 50 MB. Records will be mapped to the selected bank."
                  : "To prevent unmapped company data, you must choose or type a Bank/Lender destination in Step 1 first."}
              </p>
            </div>

            {/* Step 3: Spreadsheets Files History Table */}
            <div className="space-y-4">
              <div className="cw-card p-4 flex items-center justify-between flex-wrap gap-3 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="cw-badge cw-badge-info text-xs py-1.5 px-3">
                    <span>Spreadsheets:</span>
                    <strong className="ml-1">{filteredFiles.length}</strong>
                  </span>

                  <ModernSearchBar
                    value={filesSearchQuery}
                    onChange={setFilesSearchQuery}
                    placeholder="Search spreadsheets..."
                    width={260}
                  />

                  <select
                    className="cw-select text-xs py-1.5 px-2.5"
                    value={filesBankFilter}
                    onChange={(e) => setFilesBankFilter(e.target.value)}
                  >
                    <option value="all">All Banks ({fileBankOptions.length})</option>
                    {fileBankOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {(filesSearchQuery || filesBankFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilesSearchQuery("");
                        setFilesBankFilter("all");
                      }}
                      className="cw-btn-secondary text-xs"
                    >
                      Reset
                    </button>
                  )}

                  <button
                    type="button"
                    className="cw-btn-secondary"
                    onClick={exportCompanyFilesToExcel}
                    disabled={filteredFiles.length === 0}
                    title="Export spreadsheets list"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Export Excel</span>
                  </button>
                </div>
              </div>

              {/* Uploaded Spreadsheets Container */}
              <div className="cw-card shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="hidden md:block cw-table-container border-0">
                  <table className="cw-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60, textAlign: "center" }}>#</th>
                        <th style={{ minWidth: 260, textAlign: "left" }}>File Name</th>
                        <th style={{ width: 220, textAlign: "left" }}>Bank / Lender</th>
                        <th style={{ width: 160, textAlign: "center" }}>Ingested Records</th>
                        <th style={{ width: 140, textAlign: "center" }}>Uploaded Date</th>
                        <th style={{ width: 130, textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingFiles ? (
                        <tr>
                          <td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                            <RotateCw style={{ width: 24, height: 24, margin: "0 auto 8px" }} className="animate-spin text-blue-600" />
                            <p style={{ margin: 0, fontSize: "0.875rem" }}>Loading company spreadsheets...</p>
                          </td>
                        </tr>
                      ) : filteredFiles.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                            <FileSpreadsheet style={{ width: 36, height: 36, color: "#94a3b8", margin: "0 auto 8px" }} />
                            <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", fontWeight: 600 }} className="text-slate-900 dark:text-white">
                              No Spreadsheets Found
                            </h4>
                            <p style={{ margin: 0, fontSize: "0.8125rem" }}>
                              {filesSearchQuery ? "No spreadsheets match your search." : "Select a bank above to upload your first company spreadsheet."}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredFiles.map((f, idx) => {
                          const rowNumber = idx + 1;
                          return (
                            <tr key={f.id || idx}>
                              <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: 600, fontSize: "0.8125rem" }}>
                                {rowNumber}
                              </td>
                              <td style={{ textAlign: "left" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <div
                                    style={{
                                      width: 30,
                                      height: 30,
                                      borderRadius: 8,
                                      background: "rgba(5, 150, 105, 0.1)",
                                      border: "1px solid rgba(5, 150, 105, 0.2)",
                                      color: "#059669",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <FileSpreadsheet style={{ width: 16, height: 16 }} />
                                  </div>
                                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{f.file_name}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: "left" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <Landmark style={{ width: 15, height: 15, color: "#64748b" }} />
                                  <span style={{ fontWeight: 600 }}>{f.bank_name || "Corporate Master"}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <span className="cw-badge cw-badge-info">
                                  {(Number(f.record_count) || 0).toLocaleString()} records
                                </span>
                              </td>
                              <td style={{ textAlign: "center", color: "#64748b", fontSize: "0.8125rem" }}>
                                {f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : "—"}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                  <a
                                    href={`/api/bank/files/${f.id}/download`}
                                    className="cw-action-btn"
                                    title="Download original spreadsheet"
                                    aria-label={`Download ${f.file_name}`}
                                    style={{ textDecoration: "none" }}
                                  >
                                    <Download style={{ width: 14, height: 14 }} />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFile(f.id, f.file_name)}
                                    className="cw-action-btn text-red-600 hover:text-red-700"
                                    title="Delete spreadsheet"
                                    aria-label={`Delete ${f.file_name}`}
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

                {/* Adaptive Mobile Card List for Tab 2 */}
                <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                  {loadingFiles ? (
                    <div className="p-8 text-center text-slate-500">
                      <RotateCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-600" />
                      <p className="text-sm">Loading company spreadsheets...</p>
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No Spreadsheets Found</h4>
                    </div>
                  ) : (
                    filteredFiles.map((f, idx) => (
                      <div key={f.id || idx} className="p-4 bg-white dark:bg-slate-900 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                              <FileSpreadsheet className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-white text-sm break-all">
                                {f.file_name}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                <Landmark className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-medium truncate">{f.bank_name || "Corporate Master"}</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-slate-400 shrink-0">#{idx + 1}</span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="cw-badge cw-badge-info text-[11px]">
                              {(Number(f.record_count) || 0).toLocaleString()} records
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/bank/files/${f.id}/download`}
                              className="cw-action-btn"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteFile(f.id, f.file_name)}
                              className="cw-action-btn text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL 1: VIEW COMPANY DETAILS                             */}
      {/* ========================================================= */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Company Details</h3>
                  <span className="text-xs text-slate-400">Record ID: #{viewRecord.id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 my-5 text-sm">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Company / Employer Name
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-base">{viewRecord.company_name}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(viewRecord.company_name, "company")}
                    className="text-slate-400 hover:text-blue-600 p-1"
                    title="Copy Company Name"
                  >
                    {copiedField === "company" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Bank / Lender
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {viewRecord.bank_name || "Corporate Master"}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Category Tier
                  </span>
                  <div>{renderCategoryBadge(viewRecord.company_category)}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Other Information / Underwriting Remarks
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
                  {viewRecord.other_info || "No additional remarks or notes recorded for this employer."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const recordToEdit = viewRecord;
                  setViewRecord(null);
                  setEditRecord(recordToEdit);
                  setFormCompanyName(recordToEdit.company_name);
                  setFormBankName(recordToEdit.bank_name || "Corporate Master");
                  setFormCategory(recordToEdit.company_category || "Approved");
                  setFormOtherInfo(recordToEdit.other_info || "");
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Edit Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD NEW COMPANY RECORD                           */}
      {/* ========================================================= */}
      {isAddRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Add Single Company Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddRecordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Company / Employer Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tata Consultancy Services, Infosys Limited"
                  value={formCompanyName}
                  onChange={(e) => setFormCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Bank / Lender
                  </label>
                  <input
                    type="text"
                    list="add-bank-options"
                    placeholder="e.g. HDFC Bank, ICICI Bank..."
                    value={formBankName}
                    onChange={(e) => setFormBankName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <datalist id="add-bank-options">
                    {PRESET_PARTNER_BANKS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Category Tier
                  </label>
                  <input
                    type="text"
                    list="add-category-options"
                    placeholder="e.g. CAT A, Diamond, Super CAT A..."
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <datalist id="add-category-options">
                    <option value="CAT A" />
                    <option value="Super CAT A" />
                    <option value="Diamond" />
                    <option value="CAT B" />
                    <option value="CAT C" />
                    <option value="Approved" />
                    <option value="Govt / PSU" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Other Information / Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="Add underwriting eligibility notes, CIN number, or specific guidelines..."
                  value={formOtherInfo}
                  onChange={(e) => setFormOtherInfo(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddRecordModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isActionSubmitting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: EDIT COMPANY RECORD                              */}
      {/* ========================================================= */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Edit Company Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRecord} className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Company / Employer Name *
                </label>
                <input
                  type="text"
                  value={formCompanyName}
                  onChange={(e) => setFormCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Bank / Lender
                  </label>
                  <input
                    type="text"
                    list="edit-bank-options"
                    value={formBankName}
                    onChange={(e) => setFormBankName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <datalist id="edit-bank-options">
                    {PRESET_PARTNER_BANKS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Category Tier
                  </label>
                  <input
                    type="text"
                    list="edit-category-options"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <datalist id="edit-category-options">
                    <option value="CAT A" />
                    <option value="Super CAT A" />
                    <option value="Diamond" />
                    <option value="CAT B" />
                    <option value="CAT C" />
                    <option value="Approved" />
                    <option value="Govt / PSU" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Other Information / Remarks
                </label>
                <textarea
                  rows={3}
                  value={formOtherInfo}
                  onChange={(e) => setFormOtherInfo(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isActionSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: DELETE COMPANY RECORD CONFIRMATION               */}
      {/* ========================================================= */}
      {deleteRecordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white animate-scaleIn">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Delete Company Record</h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-slate-900 dark:text-white">"{deleteRecordTarget.company_name}"</strong> ({deleteRecordTarget.bank_name || "Corporate Master"})? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteRecordTarget(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRecordConfirm}
                disabled={isActionSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {isActionSubmitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
