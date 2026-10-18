"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
} from "lucide-react";

export default function CompanySearchPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Files & Record States
  const [files, setFiles] = useState<any[]>([]);
  const [totalCompanyRecords, setTotalCompanyRecords] = useState<number>(0);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileMessage, setFileMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Search & Filter for Uploaded Files
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBank, setSelectedBank] = useState("all");

  // 1. Check Authentication
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

  // 2. Load Files List and Total Company Count
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

  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [user, loadFiles]);

  // 3. Unique Banks List for Filter Dropdown
  const bankOptions = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => {
      const b = (f.bank_name || "").trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [files]);

  // 4. Filtered Files List
  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return files.filter((f) => {
      const matchesBank =
        selectedBank === "all" ||
        (f.bank_name || "").toLowerCase() === selectedBank.toLowerCase();
      const matchesQuery =
        !q ||
        (f.file_name || "").toLowerCase().includes(q) ||
        (f.bank_name || "").toLowerCase().includes(q);
      return matchesBank && matchesQuery;
    });
  }, [files, searchQuery, selectedBank]);

  // 5. File Upload Handling
  async function handleFileUpload(file: File) {
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    // STRICT CHECK: Reject policy files
    if ([".pdf", ".docx", ".doc", ".txt", ".rtf", ".odt"].includes(ext)) {
      setFileMessage(
        "Policy documents are not accepted in Company Data. Please upload bank policy documents in the Bank Policy section (/admin/bank-policy)."
      );
      return;
    }

    if (![".csv", ".xlsx", ".xls"].includes(ext)) {
      setFileMessage("Please select a valid Company Data spreadsheet (.csv, .xlsx, .xls)");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setFileMessage("File size must be less than 50 MB");
      return;
    }

    setUploading(true);
    setFileMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bank_name", "Corporate Master");

      const res = await fetch("/api/bank/files", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFileMessage(
          `File "${file.name}" uploaded successfully! Ingested ${data.record_count || 0} company records.`
        );
        loadFiles();
        setTimeout(() => setFileMessage(""), 5000);
      } else {
        setFileMessage(`Upload failed: ${data.error || "Unknown error"}`);
      }
    } catch {
      setFileMessage("Upload failed due to network error");
    } finally {
      setUploading(false);
    }
  }

  // 6. Delete File Handling with cascaded records removal
  async function handleDeleteFile(fileId: number, fileName: string) {
    if (
      !confirm(
        `Are you sure you want to delete "${fileName}"? This will remove all associated company records from the database.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/bank/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFileMessage(`File "${fileName}" deleted successfully.`);
        loadFiles();
        setTimeout(() => setFileMessage(""), 5000);
      } else {
        setFileMessage(`Delete failed: ${data.error || "Unknown error"}`);
      }
    } catch {
      setFileMessage("Delete failed due to network error");
    }
  }

  // 7. Export Company Files List to Excel
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Company Files");

    const maxProps = ["Sr No", "File Name", "Bank / Lender", "Ingested Records", "Upload Date"];
    worksheet["!cols"] = maxProps.map((key) => {
      let maxLen = key.length;
      exportData.forEach((row: any) => {
        const val = String(row[key] ?? "");
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
    });

    const filename = `Company_Spreadsheets_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
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
        description="Manage company categorization spreadsheets, corporate master lists, and employer verification files."
        breadcrumbs={[{ label: "Company Search" }]}
      />

      {/* 2. MAIN CONTAINER */}
      <main className="cw-admin-container py-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="cw-card p-4 sm:p-5 flex items-center gap-3.5 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                {totalCompanyRecords > 0 ? totalCompanyRecords.toLocaleString() : "533,000+"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Company Records Ingested</div>
            </div>
          </div>

          <div className="cw-card p-4 sm:p-5 flex items-center gap-3.5 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                {files.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Spreadsheet Files</div>
            </div>
          </div>

          <div className="cw-card p-4 sm:p-5 flex items-center gap-3.5 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                CSV / XLSX
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Supported Formats</div>
            </div>
          </div>
        </div>

        {/* Action Message Alert */}
        {fileMessage && (
          <div
            className={`p-4 rounded-xl mb-5 flex items-center justify-between text-sm font-medium transition-all ${
              fileMessage.includes("✓") || fileMessage.includes("success")
                ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {fileMessage.includes("✓") || fileMessage.includes("success") ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
              )}
              <span>{fileMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setFileMessage("")}
              className="border-0 bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-base"
            >
              ✕
            </button>
          </div>
        )}

        {/* Drag & Drop Upload Card */}
        <div
          className={`cw-card p-6 sm:p-8 text-center mb-6 cursor-pointer border-2 border-dashed transition-all shadow-sm ${
            isDragOver
              ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 dark:border-blue-400"
              : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFileUpload(file);
          }}
          onClick={() => {
            const el = document.getElementById("company-file-upload-input");
            if (el) el.click();
          }}
        >
          <input
            id="company-file-upload-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />

          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h3 className="m-0 mb-1 text-base font-bold text-slate-900 dark:text-white">
            {uploading ? "Ingesting company spreadsheet..." : "Upload Company Data Spreadsheet"}
          </h3>
          <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
            Drag &amp; drop a CSV or Excel file here, or click to browse. Max file size: 50 MB.
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="cw-card p-4 mb-5 flex items-center justify-between flex-wrap gap-3 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="cw-badge cw-badge-info text-xs py-1.5 px-3">
              <span>Spreadsheets:</span>
              <strong className="ml-1">{filteredFiles.length}</strong>
            </span>

            <ModernSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search spreadsheets..."
              width={260}
            />

            <select
              className="cw-select text-xs py-1.5 px-2.5"
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
            >
              <option value="all">All Lenders / Banks ({bankOptions.length})</option>
              {bankOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {(searchQuery || selectedBank !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedBank("all");
                }}
                className="cw-btn-secondary text-xs"
              >
                Reset Filters
              </button>
            )}

            <button
              type="button"
              className="cw-btn-secondary"
              onClick={exportCompanyFilesToExcel}
              disabled={filteredFiles.length === 0}
              title="Export company spreadsheets directory to Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              className="cw-btn-secondary"
              onClick={loadFiles}
              disabled={loadingFiles}
            >
              <RotateCw className={`w-3.5 h-3.5 ${loadingFiles ? "animate-spin text-blue-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Uploaded Spreadsheets Container */}
        <div className="cw-card shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Desktop Table: Hidden on Mobile */}
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
                        {searchQuery ? "No spreadsheets match your search." : "Upload a company spreadsheet to ingest employer records."}
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

          {/* Adaptive Mobile Card List (Visible on screens <= 768px) */}
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
                <p className="text-xs text-slate-500">
                  {searchQuery ? "No spreadsheets match your search." : "No spreadsheets uploaded yet."}
                </p>
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
                      <span className="text-[11px] text-slate-500">
                        {f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : "—"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/bank/files/${f.id}/download`}
                        className="cw-action-btn"
                        title="Download file"
                        aria-label={`Download ${f.file_name}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(f.id, f.file_name)}
                        className="cw-action-btn text-red-600 hover:text-red-700"
                        title="Delete file"
                        aria-label={`Delete ${f.file_name}`}
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
      </main>
    </div>
  );
}
