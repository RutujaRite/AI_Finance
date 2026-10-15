/**
 * Dedicated Company Search Management Page (Admin Only)
 * Standalone page accessible at /admin/company-search
 * - Upload company categorization lists (CSV/Excel)
 * - Ingest and manage corporate employer records in PostgreSQL
 * - Download original uploaded company spreadsheets
 * - Delete company lists with cascaded record removal
 * - Uses: /api/auth/verify, /api/bank/files, /api/bank/files/[id], /api/bank/files/[id]/download
 */

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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

  if (authLoading || !user) {
    return (
      <main
        style={{
          padding: 48,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          gap: 12,
          background: "#f8fafc",
        }}
      >
        <div className="spinner-border text-primary" style={{ width: 36, height: 36 }} role="status"></div>
        <p style={{ color: "#64748b", fontWeight: 500, fontSize: "0.9rem" }}>
          Verifying administrator access...
        </p>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <AdminHeader
        user={user}
        title="Company Search"
        description="Manage company categorization spreadsheets, corporate master lists, and employer verification files."
        breadcrumbs={[{ label: "Company Search" }]}
      />

      {/* 2. MAIN CONTAINER */}
      <main className="cw-admin-container">
        {/* Metric Cards Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
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
              <Building2 style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                {totalCompanyRecords > 0 ? totalCompanyRecords.toLocaleString() : "533,000+"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Company Records Ingested</div>
            </div>
          </div>

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
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                {files.length}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Spreadsheet Files</div>
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
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                CSV / XLSX
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Supported Formats</div>
            </div>
          </div>
        </div>

        {/* Action Message Alert */}
        {fileMessage && (
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "10px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: fileMessage.includes("✓") || fileMessage.includes("success") ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${fileMessage.includes("✓") || fileMessage.includes("success") ? "#a7f3d0" : "#fecaca"}`,
              color: fileMessage.includes("✓") || fileMessage.includes("success") ? "#065f46" : "#b91c1c",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {fileMessage.includes("✓") || fileMessage.includes("success") ? (
                <CheckCircle2 style={{ width: 18, height: 18, flexShrink: 0 }} />
              ) : (
                <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
              )}
              <span>{fileMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setFileMessage("")}
              style={{ border: "none", background: "none", cursor: "pointer", color: "currentColor", fontSize: "1rem" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Drag & Drop Upload Card */}
        <div
          className="cw-card"
          style={{
            padding: "32px 24px",
            textAlign: "center",
            marginBottom: "24px",
            cursor: "pointer",
            background: isDragOver ? "#eff6ff" : "#ffffff",
            borderColor: isDragOver ? "#2563eb" : "#cbd5e1",
            borderStyle: "dashed",
            borderWidth: 2,
          }}
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

          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#eff6ff",
              border: "1px solid #dbeafe",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
            }}
          >
            <UploadCloud style={{ width: 24, height: 24 }} />
          </div>

          <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
            {uploading ? "Ingesting company spreadsheet..." : "Upload Company Data Spreadsheet"}
          </h3>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
            Drag &amp; drop a CSV or Excel file here, or click to browse. Max file size: 50 MB.
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div
          className="cw-card"
          style={{
            padding: "14px 18px",
            marginBottom: "18px",
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
              <span>Spreadsheets:</span>
              <strong style={{ marginLeft: 4 }}>{filteredFiles.length}</strong>
            </span>

            <ModernSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search spreadsheets..."
              width={280}
            />

            <select
              className="cw-select"
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

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {(searchQuery || selectedBank !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedBank("all");
                }}
                className="cw-btn-secondary"
              >
                Reset Filters
              </button>
            )}

            <button
              type="button"
              className="cw-btn-secondary"
              onClick={loadFiles}
              disabled={loadingFiles}
            >
              <RotateCw style={{ width: 14, height: 14 }} className={loadingFiles ? "animate-spin text-blue-600" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Uploaded Spreadsheets Table */}
        <div className="cw-card">
          <div className="cw-table-container">
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
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", color: "#1e293b", fontWeight: 600 }}>No Spreadsheets Found</h4>
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
                                background: "#ecfdf5",
                                border: "1px solid #d1fae5",
                                color: "#059669",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <FileSpreadsheet style={{ width: 16, height: 16 }} />
                            </div>
                            <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.875rem" }}>{f.file_name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Landmark style={{ width: 15, height: 15, color: "#64748b" }} />
                            <span style={{ fontWeight: 600, color: "#334155" }}>{f.bank_name || "Corporate Master"}</span>
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
                              className="cw-action-btn"
                              title="Delete spreadsheet"
                              aria-label={`Delete ${f.file_name}`}
                              style={{ color: "#dc2626" }}
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
        </div>
      </main>
    </div>
  );
}
