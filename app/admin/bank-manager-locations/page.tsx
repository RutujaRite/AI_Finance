"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import AdminHeader from "@/components/admin/AdminHeader";
import {
  Users,
  FileSpreadsheet,
  UploadCloud,
  Download,
  Trash2,
  Building2,
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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Building,
  UserCheck,
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
  "Cholamandalam Investment & Finance",
  "Fibe (EarlySalary)",
  "Finnable Credit",
  "L&T Finance",
  "Piramal Finance",
  "Poonawalla Fincorp",
  "SMFG India Credit",
  "TATA Capital",
  "Utkarsh Small Finance Bank",
  "Multi-Bank Master",
];

export default function BankManagerLocationsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Authentication & Profile state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Active Tab: 1 = Manager Directory, 2 = Upload & Spreadsheets
  const [activeTab, setActiveTab] = useState<"directory" | "upload">("directory");

  // Notifications Toast
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const showNotification = (text: string, type: "success" | "error" | "info" = "info") => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  // ==========================================
  // TAB 1: MANAGERS DIRECTORY STATE
  // ==========================================
  const [managers, setManagers] = useState<any[]>([]);
  const [managersTotal, setManagersTotal] = useState(0);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersPage, setManagersPage] = useState(1);
  const [managersLimit, setRecordsLimit] = useState(25);
  const [managersSearchQuery, setManagersSearchQuery] = useState("");
  const [managersBankFilter, setManagersBankFilter] = useState("all");
  const [managersCityFilter, setManagersCityFilter] = useState("all");
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  // Modals for Single Manager Record CRUD
  const [viewManager, setViewManager] = useState<any | null>(null);
  const [editManager, setEditManager] = useState<any | null>(null);
  const [deleteManagerTarget, setDeleteManagerTarget] = useState<any | null>(null);
  const [isAddManagerModalOpen, setIsAddManagerModalOpen] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State for Add / Edit
  const [formBankName, setFormBankName] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("Branch Manager");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formBranch, setFormBranch] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formEmployeeCode, setFormEmployeeCode] = useState("");

  // ==========================================
  // TAB 2: UPLOAD & SPREADSHEETS STATE
  // ==========================================
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesSearchQuery, setFilesSearchQuery] = useState("");
  const [filesBankFilter, setFilesBankFilter] = useState("all");

  // Bank selection gating for upload
  const [selectedUploadBank, setSelectedUploadBank] = useState<string>("");
  const [customUploadBank, setCustomUploadBank] = useState<string>("");
  const [isCustomBankMode, setIsCustomBankMode] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [deleteFileTarget, setDeleteFileTarget] = useState<any | null>(null);

  // Compute effective bank name for upload
  const effectiveUploadBank = useMemo(() => {
    if (isCustomBankMode) {
      return customUploadBank.trim();
    }
    return selectedUploadBank.trim();
  }, [isCustomBankMode, customUploadBank, selectedUploadBank]);

  const isUploadUnlocked = effectiveUploadBank.length > 0;

  // Check Authentication
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/verify", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const isAdmin =
              String(data.user?.role || "").trim().toLowerCase() === "admin" ||
              data.user?.is_admin === true ||
              String(data.user?.email || "").toLowerCase() === "admin@gmail.com" ||
              String(data.user?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
              String(data.user?.email || "").toLowerCase().startsWith("admin");

            if (!isAdmin) {
              router.replace("/home?section=assistant");
              return;
            }
            setUser(data.user);
          } else {
            router.replace("/?auth=login&from=/admin/bank-manager-locations");
          }
        } else {
          router.replace("/?auth=login&from=/admin/bank-manager-locations");
        }
      } catch {
        router.replace("/?auth=login&from=/admin/bank-manager-locations");
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  // Load Manager Records (Tab 1)
  const loadManagers = useCallback(async () => {
    setManagersLoading(true);
    try {
      const params = new URLSearchParams();
      if (managersSearchQuery.trim()) params.set("q", managersSearchQuery.trim());
      if (managersBankFilter !== "all") params.set("bank", managersBankFilter);
      if (managersCityFilter !== "all") params.set("city", managersCityFilter);
      params.set("page", managersPage.toString());
      params.set("limit", managersLimit.toString());

      const res = await fetch(`/api/bank-managers?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setManagers(Array.isArray(data.managers) ? data.managers : []);
        setManagersTotal(data.total || 0);
        if (Array.isArray(data.availableBanks) && data.availableBanks.length > 0) {
          setAvailableBanks(data.availableBanks);
        }
        if (Array.isArray(data.availableCities) && data.availableCities.length > 0) {
          setAvailableCities(data.availableCities);
        }
      } else {
        setManagers([]);
        setManagersTotal(0);
      }
    } catch (e) {
      console.warn("Failed to load bank managers:", e);
      setManagers([]);
    } finally {
      setManagersLoading(false);
    }
  }, [managersSearchQuery, managersBankFilter, managersCityFilter, managersPage, managersLimit]);

  // Load Spreadsheets Files (Tab 2)
  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch("/api/bank-managers/files", { credentials: "include" });
      const data = await res.json();
      const filesList = Array.isArray(data.files) ? data.files : [];
      setFiles(filesList);
    } catch (e) {
      console.warn("Failed to load bank manager spreadsheets:", e);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  // Fetch initial data when authenticated
  useEffect(() => {
    if (user) {
      loadFiles();
      loadManagers();
    }
  }, [user, loadFiles, loadManagers]);

  // Unique Banks List from Files for Tab 2 filter
  const fileBankOptions = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => {
      if (f.bank_name) set.add(f.bank_name);
    });
    return Array.from(set).sort();
  }, [files]);

  // Filtered files for Tab 2 table
  const filteredFiles = useMemo(() => {
    const q = filesSearchQuery.toLowerCase().trim();
    return files.filter((f) => {
      const matchesSearch =
        !q ||
        (f.file_name && f.file_name.toLowerCase().includes(q)) ||
        (f.bank_name && f.bank_name.toLowerCase().includes(q));
      const matchesBank = filesBankFilter === "all" || f.bank_name === filesBankFilter;
      return matchesSearch && matchesBank;
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
      showNotification(
        "Policy documents are not accepted here. Please upload spreadsheets (.csv, .xlsx, .xls).",
        "error"
      );
      return;
    }

    if (![".csv", ".xlsx", ".xls"].includes(ext)) {
      showNotification("Please select a valid spreadsheet file (.csv, .xlsx, .xls)", "error");
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

      const res = await fetch("/api/bank-managers/files", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showNotification(
          `Spreadsheet "${file.name}" uploaded successfully for "${effectiveUploadBank}"! Added ${data.insertedCount || 0} managers.`,
          "success"
        );
        loadFiles();
        loadManagers();
      } else {
        showNotification(`Upload failed: ${data.error || "Server rejection"}`, "error");
      }
    } catch {
      showNotification("Upload failed due to network error", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Delete Spreadsheet File (Tab 2)
  async function confirmDeleteFile() {
    if (!deleteFileTarget) return;
    const fileId = deleteFileTarget.id;
    const fileName = deleteFileTarget.file_name;
    setDeleteFileTarget(null);

    try {
      const res = await fetch(`/api/bank-managers/files?id=${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showNotification(`File "${fileName}" deleted successfully.`, "info");
        loadFiles();
        loadManagers();
      } else {
        showNotification(`Delete failed: ${data.error || "Unknown error"}`, "error");
      }
    } catch {
      showNotification("Delete failed due to network error", "error");
    }
  }

  // Create Single Manager Record (Tab 1)
  async function handleCreateManager(e: React.FormEvent) {
    e.preventDefault();
    if (!formBankName.trim() || !formName.trim()) {
      showNotification("Bank Name and Manager Name are required.", "error");
      return;
    }

    setIsActionSubmitting(true);
    try {
      const res = await fetch("/api/bank-managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bank_name: formBankName.trim(),
          name: formName.trim(),
          role: formRole.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim(),
          branch: formBranch.trim(),
          location: formLocation.trim() || `${formBranch.trim()} Branch`,
          city: formCity.trim(),
          state: formState.trim(),
          employee_code: formEmployeeCode.trim(),
          status: "active",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Manager "${formName}" created successfully!`, "success");
        setIsAddManagerModalOpen(false);
        loadManagers();
      } else {
        showNotification(data.error || "Failed to create manager record.", "error");
      }
    } catch {
      showNotification("Network error while creating manager record.", "error");
    } finally {
      setIsActionSubmitting(false);
    }
  }

  // Update Single Manager Record (Tab 1)
  async function handleUpdateManager(e: React.FormEvent) {
    e.preventDefault();
    if (!editManager || !formBankName.trim() || !formName.trim()) {
      showNotification("Bank Name and Manager Name are required.", "error");
      return;
    }

    setIsActionSubmitting(true);
    try {
      const res = await fetch("/api/bank-managers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: editManager.id,
          bank_name: formBankName.trim(),
          name: formName.trim(),
          role: formRole.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim(),
          branch: formBranch.trim(),
          location: formLocation.trim() || `${formBranch.trim()} Branch`,
          city: formCity.trim(),
          state: formState.trim(),
          employee_code: formEmployeeCode.trim(),
          status: "active",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Manager "${formName}" updated successfully!`, "success");
        setEditManager(null);
        loadManagers();
      } else {
        showNotification(data.error || "Failed to update manager record.", "error");
      }
    } catch {
      showNotification("Network error while updating manager record.", "error");
    } finally {
      setIsActionSubmitting(false);
    }
  }

  // Delete Single Manager Record (Tab 1)
  async function confirmDeleteManager() {
    if (!deleteManagerTarget) return;
    const targetId = deleteManagerTarget.id;
    const targetName = deleteManagerTarget.name;
    setDeleteManagerTarget(null);

    try {
      const res = await fetch(`/api/bank-managers?id=${targetId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Manager "${targetName}" deleted successfully.`, "info");
        loadManagers();
      } else {
        showNotification(data.error || "Failed to delete manager record.", "error");
      }
    } catch {
      showNotification("Network error while deleting manager record.", "error");
    }
  }

  // Download entire filtered Managers Directory to Excel
  const exportManagersToExcel = () => {
    if (managers.length === 0) return;

    const exportData = managers.map((m, idx) => ({
      "Sr No": (managersPage - 1) * managersLimit + idx + 1,
      "Manager Name": m.name || "N/A",
      "Bank / Lender": m.bank_name || "N/A",
      "Designation / Role": m.role || "Branch Manager",
      "Branch Name": m.branch || "N/A",
      "Location / Address": m.location || "N/A",
      "City": m.city || "N/A",
      "State": m.state || "N/A",
      "Phone / Mobile": m.phone || "N/A",
      "Official Email": m.email || "N/A",
      "Employee Code": m.employee_code || "N/A",
      "Status": m.status || "active",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bank Managers & Locations");

    const maxProps = [
      "Sr No",
      "Manager Name",
      "Bank / Lender",
      "Designation / Role",
      "Branch Name",
      "Location / Address",
      "City",
      "State",
      "Phone / Mobile",
      "Official Email",
      "Employee Code",
    ];
    worksheet["!cols"] = maxProps.map((key) => {
      let maxLen = key.length;
      exportData.forEach((row: any) => {
        const val = String(row[key] ?? "");
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
    });

    const filename = `Bank_Managers_and_Locations_Page_${managersPage}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Download Single Manager Record Card as Excel
  const downloadSingleManagerRecord = (m: any) => {
    if (!m) return;
    const exportData = [
      { Field: "Manager Name", Value: m.name || "N/A" },
      { Field: "Bank / Lender", Value: m.bank_name || "N/A" },
      { Field: "Role / Designation", Value: m.role || "Branch Manager" },
      { Field: "Branch Name", Value: m.branch || "N/A" },
      { Field: "Branch / Employee Code", Value: m.employee_code || "N/A" },
      { Field: "Location / Address", Value: m.location || "N/A" },
      { Field: "City", Value: m.city || "N/A" },
      { Field: "State", Value: m.state || "N/A" },
      { Field: "Phone / Contact", Value: m.phone || "N/A" },
      { Field: "Official Email", Value: m.email || "N/A" },
      { Field: "Verification Status", Value: m.status || "active" },
      { Field: "Exported At", Value: new Date().toLocaleString("en-IN") },
    ];

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Manager Card");
    worksheet["!cols"] = [{ wch: 25 }, { wch: 50 }];

    const safeName = (m.name || "Bank_Manager").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const filename = `${safeName}_Contact_Card.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Export Tab 2 Spreadsheets to Excel
  const exportManagerFilesToExcel = () => {
    if (filteredFiles.length === 0) return;

    const exportData = filteredFiles.map((f, idx) => ({
      "Sr No": idx + 1,
      "File Name": f.file_name || "N/A",
      "Bank / Lender": f.bank_name || "N/A",
      "Contacts Count": Number(f.record_count) || 0,
      "Upload Date": f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString("en-IN") : "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Spreadsheet Files");

    const filename = `Bank_Manager_Spreadsheets_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-12 text-center">
        <RotateCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Loading Bank Manager and Locations workspace...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-200">
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <AdminHeader
        user={user}
        title="Bank Manager and Locations"
        description="Verified branch escalation contacts, regional managers, and bank location spreadsheets."
        breadcrumbs={[{ label: "Bank Manager and Locations" }]}
      />

      {/* 2. MAIN CONTAINER */}
      <main className="cw-admin-container py-6">
        {/* Toast Notification */}
        {notification && (
          <div
            className={`p-4 rounded-xl mb-6 flex items-center gap-3 text-sm font-medium transition-all shadow-sm ${
              notification.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : notification.type === "error"
                ? "bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                : "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
            }`}
          >
            {notification.type === "success" ? (
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : notification.type === "error" ? (
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
            ) : (
              <Building2 className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />
            )}
            <span>{notification.text}</span>
          </div>
        )}

        {/* 3. SEGMENTED 2-TAB PILL SWITCHER HEADER CARD (Matches Screenshot) */}
        <div className="bp-header-card mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bp-icon-badge">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
                  Bank Manager and Locations
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 m-0">
                  Manage official bank escalation contacts and branch directory spreadsheets
                </p>
              </div>
            </div>

            {/* Pill Group Switcher */}
            <div className="bp-tab-pill-group">
              <button
                type="button"
                onClick={() => setActiveTab("directory")}
                className={`bp-tab-pill ${activeTab === "directory" ? "active" : ""}`}
                aria-selected={activeTab === "directory"}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Manager Directory</span>
                <span className="bp-tab-pill-count">{managersTotal}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`bp-tab-pill ${activeTab === "upload" ? "active" : ""}`}
                aria-selected={activeTab === "upload"}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Upload & Spreadsheets</span>
                <span className="bp-tab-pill-count">{files.length}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: MANAGER & LOCATION DIRECTORY */}
        {/* ========================================================================= */}
        {activeTab === "directory" && (
          <div className="space-y-6">
            {/* 4 Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="cw-stat-card p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Total Managers
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {managersTotal.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Verified contacts in database
                </div>
              </div>

              <div className="cw-stat-card p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Banks Covered
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {availableBanks.length || PRESET_PARTNER_BANKS.length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Partner banking institutions
                </div>
              </div>

              <div className="cw-stat-card p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Cities Covered
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {availableCities.length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Unique branch locations
                </div>
              </div>

              <div className="cw-stat-card p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Spreadsheets
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {files.length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Uploaded contact rosters
                </div>
              </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                {/* Search */}
                <div className="relative min-w-[220px] max-w-sm flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={managersSearchQuery}
                    onChange={(e) => {
                      setManagersSearchQuery(e.target.value);
                      setManagersPage(1);
                    }}
                    placeholder="Search by name, branch, phone, city..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  {managersSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setManagersSearchQuery("");
                        setManagersPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bank Filter */}
                <select
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  value={managersBankFilter}
                  onChange={(e) => {
                    setManagersBankFilter(e.target.value);
                    setManagersPage(1);
                  }}
                >
                  <option value="all">All Banks ({availableBanks.length || PRESET_PARTNER_BANKS.length})</option>
                  {(availableBanks.length > 0 ? availableBanks : PRESET_PARTNER_BANKS).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                {/* City Filter */}
                <select
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  value={managersCityFilter}
                  onChange={(e) => {
                    setManagersCityFilter(e.target.value);
                    setManagersPage(1);
                  }}
                >
                  <option value="all">All Cities ({availableCities.length})</option>
                  {availableCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {(managersSearchQuery || managersBankFilter !== "all" || managersCityFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setManagersSearchQuery("");
                      setManagersBankFilter("all");
                      setManagersCityFilter("all");
                      setManagersPage(1);
                    }}
                    className="cw-btn-secondary text-xs"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Action Buttons: Download List & + Add Manager */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="cw-btn-secondary text-xs"
                  onClick={exportManagersToExcel}
                  disabled={managers.length === 0}
                  title="Download current filtered list to Excel"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Download List</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormBankName(PRESET_PARTNER_BANKS[0]);
                    setFormName("");
                    setFormRole("Branch Manager");
                    setFormPhone("");
                    setFormEmail("");
                    setFormBranch("");
                    setFormLocation("");
                    setFormCity("");
                    setFormState("");
                    setFormEmployeeCode("");
                    setIsAddManagerModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  title="Add single bank manager record manually"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Manager</span>
                </button>
              </div>
            </div>

            {/* Manager Directory Table Card */}
            <div className="cw-card shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Manager Name & Role</th>
                      <th className="py-3 px-4">Bank / Lender</th>
                      <th className="py-3 px-4">Branch & Code</th>
                      <th className="py-3 px-4">City / Location</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {managersLoading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <RotateCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-600" />
                          <p className="text-sm">Loading manager records...</p>
                        </td>
                      </tr>
                    ) : managers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                            No Manager Records Found
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            {managersSearchQuery || managersBankFilter !== "all" || managersCityFilter !== "all"
                              ? "Try adjusting your search criteria or resetting filters."
                              : "Upload a manager spreadsheet in Tab 2 or click '+ Add Manager' above."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      managers.map((m, idx) => {
                        const serialNum = (managersPage - 1) * managersLimit + idx + 1;
                        return (
                          <tr
                            key={m.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                          >
                            <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                              {serialNum}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {m.name}
                                </span>
                                {m.role && (
                                  <span className="block text-[11px] text-blue-600 dark:text-blue-400">
                                    {m.role}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{m.bank_name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              <div>{m.branch || "General Branch"}</div>
                              {m.employee_code && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Code: {m.employee_code}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                <span>{m.city || m.location || "Branch Location"}</span>
                              </div>
                              {m.state && (
                                <span className="text-[10px] text-slate-400 ml-4.5">{m.state}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              {m.phone && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <a
                                    href={`tel:${m.phone}`}
                                    className="hover:underline text-slate-800 dark:text-slate-200"
                                  >
                                    {m.phone}
                                  </a>
                                </div>
                              )}
                              {m.email && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  <Mail className="w-3 h-3 text-sky-500" />
                                  <a
                                    href={`mailto:${m.email}`}
                                    className="hover:underline truncate max-w-[140px]"
                                  >
                                    {m.email}
                                  </a>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setViewManager(m)}
                                  className="cw-action-btn text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                  title="View details"
                                  aria-label={`View details of ${m.name}`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditManager(m);
                                    setFormBankName(m.bank_name || PRESET_PARTNER_BANKS[0]);
                                    setFormName(m.name || "");
                                    setFormRole(m.role || "Branch Manager");
                                    setFormPhone(m.phone || "");
                                    setFormEmail(m.email || "");
                                    setFormBranch(m.branch || "");
                                    setFormLocation(m.location || "");
                                    setFormCity(m.city || "");
                                    setFormState(m.state || "");
                                    setFormEmployeeCode(m.employee_code || "");
                                  }}
                                  className="cw-action-btn text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                  title="Edit manager record"
                                  aria-label={`Edit ${m.name}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => downloadSingleManagerRecord(m)}
                                  className="cw-action-btn text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                                  title="Download manager contact card"
                                  aria-label={`Download contact card for ${m.name}`}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeleteManagerTarget(m)}
                                  className="cw-action-btn text-red-600 hover:text-red-700 dark:text-red-400"
                                  title="Delete manager record"
                                  aria-label={`Delete ${m.name}`}
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
                {managersLoading ? (
                  <div className="p-8 text-center text-slate-500">
                    <RotateCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-600" />
                    <p className="text-sm">Loading manager records...</p>
                  </div>
                ) : managers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      No Records Found
                    </h4>
                  </div>
                ) : (
                  managers.map((m, idx) => (
                    <div key={m.id} className="p-4 bg-white dark:bg-slate-900 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm m-0">
                            {m.name}
                          </h4>
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            {m.role || "Branch Manager"}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <Landmark className="w-3 h-3" />
                            <span>{m.bank_name}</span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">
                          #{(managersPage - 1) * managersLimit + idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span>
                          {m.branch ? `${m.branch}, ` : ""}
                          {m.city || m.location || "Branch Location"}
                        </span>
                      </div>

                      {m.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                          <Phone className="w-3 h-3" />
                          <span>{m.phone}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setViewManager(m)}
                          className="cw-action-btn"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditManager(m);
                            setFormBankName(m.bank_name || PRESET_PARTNER_BANKS[0]);
                            setFormName(m.name || "");
                            setFormRole(m.role || "Branch Manager");
                            setFormPhone(m.phone || "");
                            setFormEmail(m.email || "");
                            setFormBranch(m.branch || "");
                            setFormLocation(m.location || "");
                            setFormCity(m.city || "");
                            setFormState(m.state || "");
                            setFormEmployeeCode(m.employee_code || "");
                          }}
                          className="cw-action-btn text-blue-600"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadSingleManagerRecord(m)}
                          className="cw-action-btn text-emerald-600"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteManagerTarget(m)}
                          className="cw-action-btn text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
                    {managers.length > 0 ? (managersPage - 1) * managersLimit + 1 : 0}
                  </strong>
                  <span>to</span>
                  <strong className="text-slate-900 dark:text-white">
                    {Math.min(managersPage * managersLimit, managersTotal)}
                  </strong>
                  <span>of</span>
                  <strong className="text-slate-900 dark:text-white">
                    {managersTotal.toLocaleString()}
                  </strong>
                  <span>managers</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span>Per page:</span>
                    <select
                      value={managersLimit}
                      onChange={(e) => {
                        setRecordsLimit(parseInt(e.target.value, 10));
                        setManagersPage(1);
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
                      disabled={managersPage <= 1 || managersLoading}
                      onClick={() => setManagersPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-medium">
                      Page {managersPage} of {Math.max(1, Math.ceil(managersTotal / managersLimit))}
                    </span>
                    <button
                      type="button"
                      disabled={
                        managersPage >= Math.ceil(managersTotal / managersLimit) || managersLoading
                      }
                      onClick={() => setManagersPage((p) => p + 1)}
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

        {/* ========================================================================= */}
        {/* TAB 2: UPLOAD & SPREADSHEETS */}
        {/* ========================================================================= */}
        {activeTab === "upload" && (
          <div className="space-y-6">
            {/* Step 1 & 2: Bank Selection and Gated Upload Dropzone */}
            <div className="cw-card shadow-sm border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 rounded-xl">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                    Upload Manager Spreadsheet
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
                    Step 1: Choose or enter the target Bank / Lender, then upload the Excel/CSV contact list.
                  </p>
                </div>
              </div>

              {/* Step 1: Bank Selection Controls */}
              <div className="mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Step 1: Select Bank / Lender Name <span className="text-red-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  {/* Bank Select Dropdown */}
                  <div>
                    <select
                      value={isCustomBankMode ? "__CUSTOM__" : selectedUploadBank}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__CUSTOM__") {
                          setIsCustomBankMode(true);
                        } else {
                          setIsCustomBankMode(false);
                          setSelectedUploadBank(val);
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
                  {isCustomBankMode && (
                    <div className="relative">
                      <input
                        type="text"
                        value={customUploadBank}
                        onChange={(e) => setCustomUploadBank(e.target.value)}
                        placeholder="Type custom Bank or NBFC name..."
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-500 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* Status Indicator */}
                <div className="mt-2.5 flex items-center gap-2 text-xs">
                  {isUploadUnlocked ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Ready to upload for: <strong>{effectiveUploadBank}</strong></span>
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
                  if (isUploadUnlocked) setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (isUploadUnlocked && e.dataTransfer.files?.[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  !isUploadUnlocked
                    ? "border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40 opacity-60 cursor-not-allowed"
                    : isDragOver
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 cursor-copy"
                    : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-900/60 cursor-pointer"
                }`}
                onClick={() => {
                  if (isUploadUnlocked && fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  className="hidden"
                  disabled={!isUploadUnlocked || uploading}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="max-w-md mx-auto flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                      !isUploadUnlocked
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400"
                        : "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {uploading ? (
                      <RotateCw className="w-6 h-6 animate-spin" />
                    ) : !isUploadUnlocked ? (
                      <Lock className="w-6 h-6" />
                    ) : (
                      <UploadCloud className="w-6 h-6" />
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    {uploading
                      ? "Uploading & Parsing Spreadsheets..."
                      : !isUploadUnlocked
                      ? "File Upload Locked"
                      : "Drag & Drop or Click to Upload"}
                  </h4>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {!isUploadUnlocked
                      ? "Please select or type a Bank Name in Step 1 above to enable file upload."
                      : `Selected Bank: "${effectiveUploadBank}". Accepts .xlsx, .xls, .csv files up to 50 MB.`}
                  </p>

                  {isUploadUnlocked && !uploading && (
                    <button
                      type="button"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Choose Spreadsheet File
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Spreadsheets File History Table */}
            <div className="cw-card shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                    Uploaded Spreadsheets ({files.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Search inside files */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={filesSearchQuery}
                      onChange={(e) => setFilesSearchQuery(e.target.value)}
                      placeholder="Search files..."
                      className="pl-8 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Filter files by bank */}
                  <select
                    value={filesBankFilter}
                    onChange={(e) => setFilesBankFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="all">All Banks ({fileBankOptions.length})</option>
                    {fileBankOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={exportManagerFilesToExcel}
                    className="cw-btn-secondary text-xs"
                    title="Export file history to Excel"
                  >
                    <Download className="w-3 h-3 text-emerald-600" />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              {/* Spreadsheets Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Spreadsheet File Name</th>
                      <th className="py-3 px-4">Bank / Institution</th>
                      <th className="py-3 px-4">Contacts Count</th>
                      <th className="py-3 px-4">Upload Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {loadingFiles ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          <RotateCw className="w-5 h-5 mx-auto mb-2 animate-spin text-blue-600" />
                          <p className="text-xs">Loading spreadsheet records...</p>
                        </td>
                      </tr>
                    ) : filteredFiles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                            No Spreadsheets Found
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Upload an Excel or CSV file in Step 2 above to ingest bank contacts.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredFiles.map((f, idx) => (
                        <tr
                          key={f.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {f.file_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {f.bank_name || "Official Bank"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            <strong>{Number(f.record_count) || 0}</strong> contacts
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                            {f.uploaded_at
                              ? new Date(f.uploaded_at).toLocaleDateString("en-IN")
                              : "N/A"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {f.file_path && (
                                <a
                                  href={f.file_path}
                                  download
                                  className="cw-action-btn text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                                  title="Download Original File"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeleteFileTarget(f)}
                                className="cw-action-btn text-red-600 hover:text-red-700 dark:text-red-400"
                                title="Delete Spreadsheet"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW MANAGER DETAILS */}
      {/* ========================================================================= */}
      {viewManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl max-w-lg w-full p-6 text-left relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setViewManager(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">
                  {viewManager.name}
                </h3>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {viewManager.role || "Branch Manager"}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                    Bank / Institution
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">
                    {viewManager.bank_name}
                  </span>
                </div>
                <Landmark className="w-5 h-5 text-slate-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                    Branch Name
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {viewManager.branch || "General Branch"}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                    Branch / Employee Code
                  </span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {viewManager.employee_code || "Not Specified"}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                  Location & City
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {viewManager.location || viewManager.city || "Branch Location"}
                  {viewManager.state ? `, ${viewManager.state}` : ""}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                      Phone Number
                    </span>
                    <a
                      href={`tel:${viewManager.phone}`}
                      className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {viewManager.phone || "Not Specified"}
                    </a>
                  </div>
                  {viewManager.phone && (
                    <button
                      type="button"
                      onClick={() => handleCopy(viewManager.phone, "phone")}
                      className="p-1 text-slate-400 hover:text-slate-600"
                      title="Copy Phone"
                    >
                      {copiedField === "phone" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                      Official Email
                    </span>
                    <a
                      href={`mailto:${viewManager.email}`}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-[150px]"
                    >
                      {viewManager.email || "Not Specified"}
                    </a>
                  </div>
                  {viewManager.email && (
                    <button
                      type="button"
                      onClick={() => handleCopy(viewManager.email, "email")}
                      className="p-1 text-slate-400 hover:text-slate-600"
                      title="Copy Email"
                    >
                      {copiedField === "email" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => downloadSingleManagerRecord(viewManager)}
                className="cw-btn-secondary text-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download Card</span>
              </button>
              <button
                type="button"
                onClick={() => setViewManager(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD SINGLE MANAGER */}
      {/* ========================================================================= */}
      {isAddManagerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl max-w-lg w-full p-6 text-left relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsAddManagerModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">
                  Add Bank Manager & Location
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 m-0">
                  Manually create a single branch manager contact record
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateManager} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Bank / Institution <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formBankName}
                  onChange={(e) => setFormBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank, ICICI Bank, Kotak..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Manager Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Full name of manager"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Role / Designation
                  </label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="e.g. Branch Manager, RSM"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="manager@bank.com"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    placeholder="e.g. MG Road Branch"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Branch / Employee Code
                  </label>
                  <input
                    type="text"
                    value={formEmployeeCode}
                    onChange={(e) => setFormEmployeeCode(e.target.value)}
                    placeholder="e.g. HDFC-1049"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="e.g. Mumbai, Pune, Bangalore"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Detailed Location / Branch Address
                </label>
                <textarea
                  rows={2}
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="Full address, landmarks, premises..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddManagerModalOpen(false)}
                  className="cw-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {isActionSubmitting ? "Creating..." : "Create Manager"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT MANAGER */}
      {/* ========================================================================= */}
      {editManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl max-w-lg w-full p-6 text-left relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setEditManager(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">
                  Edit Bank Manager
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 m-0">
                  Update record #{editManager.id}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateManager} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Bank / Institution <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formBankName}
                  onChange={(e) => setFormBankName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Manager Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Role / Designation
                  </label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Branch / Employee Code
                  </label>
                  <input
                    type="text"
                    value={formEmployeeCode}
                    onChange={(e) => setFormEmployeeCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Detailed Location / Branch Address
                </label>
                <textarea
                  rows={2}
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setEditManager(null)}
                  className="cw-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {isActionSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {deleteManagerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Delete Manager Record?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Are you sure you want to delete <strong>{deleteManagerTarget.name}</strong> (
              {deleteManagerTarget.bank_name})? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteManagerTarget(null)}
                className="cw-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteManager}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE SPREADSHEET CONFIRMATION */}
      {deleteFileTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Delete Spreadsheet File?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Are you sure you want to delete <strong>{deleteFileTarget.file_name}</strong>?
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteFileTarget(null)}
                className="cw-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteFile}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
