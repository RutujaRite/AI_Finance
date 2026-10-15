/**
 * Dedicated Contact and Location Bank Manager Page (Admin Only)
 * Standalone page accessible at /admin/bank-managers
 * Upload and manage bank manager spreadsheets, branch contact files, and official Excel/CSV lists.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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

  if (!user) {
    return (
      <main style={{ padding: 48, textAlign: "center", minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner-border text-primary" role="status" />
        <p style={{ color: "#64748b", marginTop: 12, fontSize: "0.875rem" }}>Loading Contact and Location Bank Manager workspace...</p>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <AdminHeader
        user={user}
        title="Contact and Location Bank Manager"
        description="Official contact spreadsheet uploads, branch manager directories, and verified lender contacts."
        breadcrumbs={[{ label: "Bank Managers" }]}
      />

      {/* 2. MAIN CONTAINER */}
      <main className="cw-admin-container">
        {/* Upload Message Toast */}
        {uploadMsg && (
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "10px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: uploadMsg.type === "success" ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${uploadMsg.type === "success" ? "#a7f3d0" : "#fecaca"}`,
              color: uploadMsg.type === "success" ? "#065f46" : "#b91c1c",
            }}
          >
            {uploadMsg.type === "success" ? <CheckCircle2 style={{ width: 18, height: 18, flexShrink: 0 }} /> : <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />}
            <span>{uploadMsg.text}</span>
          </div>
        )}

        {/* Upload Form Card */}
        <div className="cw-card" style={{ marginBottom: "24px" }}>
          <div className="cw-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#eff6ff",
                  border: "1px solid #dbeafe",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UploadCloud style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>
                  Upload Manager Spreadsheet
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Upload official Excel or CSV spreadsheets containing bank manager branch listings.
                </span>
              </div>
            </div>
          </div>

          <div className="cw-card-body">
            <form onSubmit={handleUploadSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr auto",
                  gap: "16px",
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.8125rem", color: "#334155", marginBottom: "6px" }}>
                    Bank Name
                  </label>
                  <input
                    type="text"
                    className="cw-input"
                    placeholder="e.g. HDFC Bank, Axis Bank, ICICI Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    style={{ height: 40 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.8125rem", color: "#334155", marginBottom: "6px" }}>
                    Spreadsheet File (.xlsx, .xls, .csv)
                  </label>
                  <input
                    id="bmFileInput"
                    type="file"
                    className="cw-input"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    style={{ height: 40, padding: "6px 10px" }}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="cw-btn-primary"
                    disabled={isUploading}
                    style={{ height: 40, padding: "0 22px" }}
                  >
                    {isUploading ? (
                      <>
                        <RotateCw style={{ width: 16, height: 16 }} className="animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud style={{ width: 16, height: 16 }} />
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
              <span>Total Spreadsheets:</span>
              <strong style={{ marginLeft: 4 }}>{files.length}</strong>
            </span>

            <ModernSearchBar
              value={searchFileQuery}
              onChange={setSearchFileQuery}
              placeholder="Search by bank or filename..."
              width={300}
            />
          </div>

          <button
            type="button"
            className="cw-btn-secondary"
            onClick={fetchFiles}
            disabled={isLoadingFiles}
          >
            <RotateCw style={{ width: 14, height: 14 }} className={isLoadingFiles ? "animate-spin text-blue-600" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Files List Table */}
        <div className="cw-card">
          <div className="cw-table-container">
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
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", color: "#1e293b", fontWeight: 600 }}>No Spreadsheets Found</h4>
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
                            <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.875rem" }} title={file.file_name}>
                              {file.file_name}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Building2 style={{ width: 15, height: 15, color: "#64748b" }} />
                            <span style={{ fontWeight: 600, color: "#334155" }}>{file.bank_name || "Lender File"}</span>
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
                              className="cw-action-btn"
                              title="Delete file"
                              aria-label={`Delete ${file.file_name}`}
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
