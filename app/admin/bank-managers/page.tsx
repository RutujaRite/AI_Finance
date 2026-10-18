/**
 * Dedicated Contact and Location Bank Manager Page (Admin Only)
 * Standalone page accessible at /admin/bank-managers
 * Upload and manage bank manager spreadsheets, branch contact files, and official Excel/CSV lists.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import AdminHeader from "@/components/admin/AdminHeader";
import ModernSearchBar from "@/components/ui/ModernSearchBar";
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  Trash2,
  RotateCw,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from "lucide-react";

export default function BankManagersDedicatedPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bankName, setBankName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [searchFileQuery, setSearchFileQuery] = useState("");

  useEffect(() => {
    checkAuth();
    fetchFiles();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/verify", { credentials: "include" });
      if (res.ok) {
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
        }
      } else {
        router.replace("/?auth=login&from=/admin/bank-managers");
      }
    } catch {
      router.replace("/?auth=login&from=/admin/bank-managers");
    }
  }

  async function fetchFiles() {
    setIsLoadingFiles(true);
    try {
      const res = await fetch("/api/bank-managers/files");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.files)) {
          setFiles(data.files);
        }
      }
    } catch (e) {
      console.error("Error fetching files", e);
    } finally {
      setIsLoadingFiles(false);
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim()) {
      setUploadMsg({ type: "error", text: "Please enter the Bank Name." });
      return;
    }
    if (!selectedFile) {
      setUploadMsg({ type: "error", text: "Please select an Excel (.xlsx, .xls) or CSV (.csv) file." });
      return;
    }

    setIsUploading(true);
    setUploadMsg(null);

    try {
      const formData = new FormData();
      formData.append("bank_name", bankName.trim());
      formData.append("file", selectedFile);

      const res = await fetch("/api/bank-managers/files", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUploadMsg({
          type: "success",
          text: `File "${selectedFile.name}" uploaded successfully! Added ${data.insertedCount || 0} managers.`,
        });
        setBankName("");
        setSelectedFile(null);
        const fileInput = document.getElementById("bmFileInput") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        fetchFiles();
        setTimeout(() => setUploadMsg(null), 5000);
      } else {
        setUploadMsg({ type: "error", text: data.error || "Failed to upload file." });
      }
    } catch {
      setUploadMsg({ type: "error", text: "A network error occurred while uploading." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (id: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/bank-managers/files?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadMsg({ type: "success", text: `File "${filename}" deleted successfully.` });
        fetchFiles();
        setTimeout(() => setUploadMsg(null), 5000);
      } else {
        setUploadMsg({ type: "error", text: data.error || "Failed to delete file." });
      }
    } catch {
      setUploadMsg({ type: "error", text: "Network error while deleting file." });
    }
  };

  function formatFileSize(bytes: number) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  const filteredFiles = useMemo(() => {
    const q = searchFileQuery.toLowerCase().trim();
    if (!q) return files;
    return files.filter(
      (f) =>
        (f.file_name || "").toLowerCase().includes(q) ||
        (f.bank_name || "").toLowerCase().includes(q)
    );
  }, [files, searchFileQuery]);

  // Export File Directory to Excel
  const exportFilesToExcel = () => {
    if (filteredFiles.length === 0) return;

    const exportData = filteredFiles.map((file, idx) => ({
      "Sr No": idx + 1,
      "Bank Name": file.bank_name || "N/A",
      "File Name": file.file_name || "N/A",
      "Contacts Count": file.record_count || 0,
      "File Size (Bytes)": file.file_size_bytes || 0,
      "Formatted Size": formatFileSize(file.file_size_bytes),
      "Created At": file.created_at ? new Date(file.created_at).toLocaleString("en-IN") : "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bank Managers Directory");

    // Auto-fit column widths
    const maxProps = ["Sr No", "Bank Name", "File Name", "Contacts Count", "File Size (Bytes)", "Formatted Size", "Created At"];
    worksheet["!cols"] = maxProps.map((key) => {
      let maxLen = key.length;
      exportData.forEach((row: any) => {
        const val = String(row[key] ?? "");
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
    });

    const filename = `Bank_Managers_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-12 text-center">
        <RotateCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">Loading Contact and Location Bank Manager workspace...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-200">
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <AdminHeader
        user={user}
        title="Contact and Location Bank Manager"
        description="Official contact spreadsheet uploads, branch manager directories, and verified lender contacts."
        breadcrumbs={[{ label: "Bank Managers" }]}
      />

      {/* 2. MAIN CONTAINER */}
      <main className="cw-admin-container py-6">
        {/* Upload Message Toast */}
        {uploadMsg && (
          <div
            className={`p-4 rounded-xl mb-5 flex items-center gap-3 text-sm font-medium transition-all ${
              uploadMsg.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
            }`}
          >
            {uploadMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span>{uploadMsg.text}</span>
          </div>
        )}

        {/* Upload Form Card */}
        <div className="cw-card mb-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="cw-card-header border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="m-0 text-sm font-bold text-slate-900 dark:text-white">
                  Upload Manager Spreadsheet
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Upload official Excel or CSV spreadsheets containing bank manager branch listings.
                </span>
              </div>
            </div>
          </div>

          <div className="cw-card-body p-4 sm:p-6">
            <form onSubmit={handleUploadSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                <div>
                  <label className="block font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    className="cw-input h-10 w-full"
                    placeholder="e.g. HDFC Bank, Axis Bank, ICICI Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
                    Spreadsheet File (.xlsx, .xls, .csv)
                  </label>
                  <input
                    id="bmFileInput"
                    type="file"
                    className="cw-input h-10 w-full py-1.5 px-3 text-xs"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="cw-btn-primary h-10 w-full md:w-auto px-5 flex items-center justify-center gap-2"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>Upload &amp; Parse</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Toolbar Card */}
        <div className="cw-card p-4 mb-5 flex items-center justify-between flex-wrap gap-3 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="cw-badge cw-badge-info text-xs py-1.5 px-3">
              <span>Total Spreadsheets:</span>
              <strong className="ml-1">{files.length}</strong>
            </span>

            <ModernSearchBar
              value={searchFileQuery}
              onChange={setSearchFileQuery}
              placeholder="Search by bank or filename..."
              width={280}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cw-btn-secondary"
              onClick={exportFilesToExcel}
              disabled={filteredFiles.length === 0}
              title="Export bank managers directory to Excel spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              className="cw-btn-secondary"
              onClick={fetchFiles}
              disabled={isLoadingFiles}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingFiles ? "animate-spin text-blue-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Files List Container */}
        <div className="cw-card shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Desktop Table: Hidden on Mobile */}
          <div className="hidden md:block cw-table-container border-0">
            <table className="cw-table">
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: "center" }}>#</th>
                  <th style={{ minWidth: 260, textAlign: "left" }}>File Name</th>
                  <th style={{ width: 220, textAlign: "left" }}>Bank Name</th>
                  <th style={{ width: 140, textAlign: "center" }}>Records</th>
                  <th style={{ width: 120, textAlign: "center" }}>Size</th>
                  <th style={{ width: 140, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingFiles ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                      <RotateCw style={{ width: 24, height: 24, margin: "0 auto 8px" }} className="animate-spin text-blue-600" />
                      <p style={{ margin: 0, fontSize: "0.875rem" }}>Loading manager spreadsheets...</p>
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
                        {searchFileQuery ? "No spreadsheets match your search." : "No bank manager spreadsheets uploaded yet."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((file, idx) => {
                    const rowNumber = idx + 1;
                    return (
                      <tr key={file.id || idx}>
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
                            <span style={{ fontWeight: 600, fontSize: "0.875rem" }} title={file.file_name}>
                              {file.file_name}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Building2 style={{ width: 15, height: 15, color: "#64748b" }} />
                            <span style={{ fontWeight: 600 }}>{file.bank_name || "Lender File"}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="cw-badge cw-badge-info">
                            {file.record_count ? `${file.record_count.toLocaleString()} contacts` : "Ingested"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center", color: "#64748b", fontSize: "0.8125rem", fontFamily: "ui-monospace, monospace" }}>
                          {formatFileSize(file.file_size_bytes)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <a
                              href={`/api/bank-managers/files?id=${file.id}&download=true`}
                              download={file.file_name}
                              className="cw-action-btn"
                              title="Download spreadsheet"
                              aria-label={`Download ${file.file_name}`}
                              style={{ textDecoration: "none" }}
                            >
                              <Download style={{ width: 14, height: 14 }} />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteFile(file.id, file.file_name)}
                              className="cw-action-btn text-red-600 hover:text-red-700"
                              title="Delete file"
                              aria-label={`Delete ${file.file_name}`}
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
            {isLoadingFiles ? (
              <div className="p-8 text-center text-slate-500">
                <RotateCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-600" />
                <p className="text-sm">Loading manager spreadsheets...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No Spreadsheets Found</h4>
                <p className="text-xs text-slate-500">
                  {searchFileQuery ? "No spreadsheets match your search." : "No spreadsheets uploaded yet."}
                </p>
              </div>
            ) : (
              filteredFiles.map((file, idx) => (
                <div key={file.id || idx} className="p-4 bg-white dark:bg-slate-900 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm break-all">
                          {file.file_name}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium truncate">{file.bank_name || "Lender File"}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 shrink-0">#{idx + 1}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="cw-badge cw-badge-info text-[11px]">
                        {file.record_count ? `${file.record_count.toLocaleString()} contacts` : "Ingested"}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {formatFileSize(file.file_size_bytes)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/bank-managers/files?id=${file.id}&download=true`}
                        download={file.file_name}
                        className="cw-action-btn"
                        title="Download file"
                        aria-label={`Download ${file.file_name}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file.id, file.file_name)}
                        className="cw-action-btn text-red-600 hover:text-red-700"
                        title="Delete file"
                        aria-label={`Delete ${file.file_name}`}
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
