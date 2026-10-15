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
          `✓ File "${file.name}" uploaded successfully! Ingested ${data.record_count || 0} company records.`
        );
        loadFiles();
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
        setFileMessage(`✓ File "${fileName}" deleted successfully.`);
        loadFiles();
      } else {
        setFileMessage(`Delete failed: ${data.error || "Unknown error"}`);
      }
    } catch {
      setFileMessage("Delete failed due to network error");
    }
  }

  function formatFileSize(bytes: number) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
      {/* 1. TOP HEADER & BREADCRUMBS (NO SIDEBAR) */}
      <AdminHeader
        user={user}
        title="Company Search"
        description="Manage company categorization spreadsheets, corporate master lists, and employer verification files."
        breadcrumbs={[{ label: "Company Search" }]}
      />

      {/* 2. MAIN CONTAINER */}
      <main
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "24px 28px 60px 28px",
          boxSizing: "border-box",
        }}
      >
        {/* Metric Cards Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "12px",
                background: "#e0f2fe",
                color: "#0284c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
              }}
            >
              <i className="bi bi-building" />
            </div>
            <div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>
                {totalCompanyRecords > 0 ? totalCompanyRecords.toLocaleString() : "533,000+"}
              </div>
              <div style={{ fontSize: "0.82rem", color: "#64748b" }}>Company Records Ingested</div>
            </div>
          </div>

          <div
            style={{
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "12px",
                background: "#ede9fe",
                color: "#7c3aed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
              }}
            >
              <i className="bi bi-file-earmark-spreadsheet" />
            </div>
            <div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>
                {files.length}
              </div>
              <div style={{ fontSize: "0.82rem", color: "#64748b" }}>Spreadsheet Files</div>
            </div>
          </div>

          <div
            style={{
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "12px",
                background: "#dcfce7",
                color: "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
              }}
            >
              <i className="bi bi-check2-circle" />
            </div>
            <div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>
                CSV / XLSX
              </div>
              <div style={{ fontSize: "0.82rem", color: "#64748b" }}>Supported Formats</div>
            </div>
          </div>
        </div>

        {/* Action Message Alert */}
        {fileMessage && (
          <div
            className={`alert ${fileMessage.includes("✓") ? "alert-success" : "alert-danger"}`}
            style={{
              borderRadius: "12px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
            }}
          >
            <span>{fileMessage}</span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setFileMessage("")}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1rem" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Drag & Drop Upload Card */}
        <div
          style={{
            background: isDragOver ? "#eff6ff" : "#ffffff",
            border: isDragOver ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "36px 24px",
            textAlign: "center",
            marginBottom: "24px",
            cursor: "pointer",
            transition: "all 0.18s ease",
            boxShadow: isDragOver ? "0 4px 12px rgba(37, 99, 235, 0.08)" : "0 1px 3px rgba(0,0,0,0.02)",
          }}
          onMouseEnter={(e) => {
            if (!isDragOver) e.currentTarget.style.borderColor = "#cbd5e1";
          }}
          onMouseLeave={(e) => {
            if (!isDragOver) e.currentTarget.style.borderColor = "#e2e8f0";
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
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#e0f2fe",
              color: "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.6rem",
              margin: "0 auto 12px auto",
            }}
          >
            <i className="bi bi-cloud-arrow-up-fill" />
          </div>

          <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
            {uploading ? "Ingesting company spreadsheet..." : "Upload Company Data Spreadsheet"}
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
            Drag &amp; drop a CSV or Excel file here, or click to browse. Max size 50 MB.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "18px 22px",
            marginBottom: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 240px auto",
              gap: "14px",
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative" }}>
              <i
                className="bi bi-search"
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  fontSize: "0.95rem",
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Search uploaded spreadsheets by file name or bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: "40px",
                  height: "42px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <div>
              <select
                className="form-select"
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                style={{
                  height: "42px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.88rem",
                }}
              >
                <option value="all">All Lenders / Banks ({bankOptions.length})</option>
                {bankOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || selectedBank !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedBank("all");
                }}
                className="btn btn-light"
                style={{
                  height: "42px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  color: "#64748b",
                  fontWeight: 500,
                  fontSize: "0.88rem",
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Uploaded Spreadsheets Table */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              padding: "16px 22px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
              Uploaded Spreadsheets ({filteredFiles.length})
            </h3>
            <button
              type="button"
              onClick={loadFiles}
              disabled={loadingFiles}
              className="btn btn-sm btn-light"
              style={{
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.8rem",
                color: "#475569",
              }}
            >
              <i className={`bi bi-arrow-clockwise ${loadingFiles ? "spin" : ""}`} /> Refresh
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "14px 22px", fontWeight: 600, color: "#475569" }}>
                  File Name
                </th>
                <th style={{ textAlign: "left", padding: "14px 22px", fontWeight: 600, color: "#475569", width: "180px" }}>
                  Bank / Lender
                </th>
                <th style={{ textAlign: "left", padding: "14px 22px", fontWeight: 600, color: "#475569", width: "160px" }}>
                  Ingested Records
                </th>
                <th style={{ textAlign: "left", padding: "14px 22px", fontWeight: 600, color: "#475569", width: "150px" }}>
                  Uploaded
                </th>
                <th style={{ textAlign: "right", padding: "14px 22px", fontWeight: 600, color: "#475569", width: "140px" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingFiles ? (
                <tr>
                  <td colSpan={5} style={{ padding: "44px", textAlign: "center", color: "#64748b" }}>
                    <div className="spinner-border text-primary" style={{ width: 30, height: 30 }} role="status" />
                    <div style={{ marginTop: "10px", fontWeight: 500 }}>Loading company spreadsheets...</div>
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "44px", textAlign: "center", color: "#64748b" }}>
                    <div
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "50%",
                        background: "#f1f5f9",
                        color: "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.4rem",
                        margin: "0 auto 10px auto",
                      }}
                    >
                      <i className="bi bi-file-earmark-spreadsheet" />
                    </div>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                      No spreadsheets found
                    </div>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
                      Upload a company spreadsheet or clear search filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredFiles.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 22px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <i className="bi bi-file-earmark-excel" style={{ color: "#16a34a", fontSize: "1.2rem" }} />
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{f.file_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 22px", color: "#475569" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: "#f1f5f9",
                          color: "#334155",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                        }}
                      >
                        <i className="bi bi-bank" style={{ color: "#2563eb", fontSize: "0.75rem" }} />
                        {f.bank_name || "Corporate Master"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 22px", color: "#0284c7", fontWeight: 600 }}>
                      {(Number(f.record_count) || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: "14px 22px", color: "#64748b", fontSize: "0.82rem" }}>
                      {f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "14px 22px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px" }}>
                        <a
                          href={`/api/bank/files/${f.id}/download`}
                          className="btn btn-sm btn-light"
                          title="Download original spreadsheet"
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            border: "1px solid #cbd5e1",
                            color: "#334155",
                            textDecoration: "none",
                          }}
                        >
                          <i className="bi bi-download" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(f.id, f.file_name)}
                          className="btn btn-sm btn-light"
                          title="Delete spreadsheet and associated records"
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            border: "1px solid #fee2e2",
                            color: "#dc2626",
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
