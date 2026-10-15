/**
 * Dedicated Contact and Location Bank Manager Page (Admin Only)
 * Standalone page accessible at /admin/bank-managers
 * Upload and manage bank manager spreadsheets, branch contact files, and official Excel/CSV lists.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";

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
          text: `✓ File "${selectedFile.name}" uploaded successfully! Added ${data.insertedCount || 0} managers.`,
        });
        setBankName("");
        setSelectedFile(null);
        const fileInput = document.getElementById("bmFileInput") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        fetchFiles();
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
        setUploadMsg({ type: "success", text: `✓ File "${filename}" deleted successfully.` });
        fetchFiles();
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
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
      <main style={{ padding: 48, textAlign: "center", minHeight: "100vh", background: "#f8fafc" }}>
        <div className="spinner-border text-primary" role="status" />
        <p style={{ color: "#64748b", marginTop: 12 }}>Loading Contact and Location Bank Manager workspace...</p>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      {/* 1. TOP HEADER & BREADCRUMBS (NO SIDEBAR) */}
      <AdminHeader
        user={user}
        title="Contact and Location Bank Manager"
        description="Official contact spreadsheet uploads, branch manager directories, and verified lender contacts."
        breadcrumbs={[{ label: "Contact and Location Bank Manager" }]}
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
        {/* Upload Message Toast */}
        {uploadMsg && (
          <div
            className={`alert ${uploadMsg.type === "success" ? "alert-success" : "alert-danger"}`}
            style={{ borderRadius: "10px", marginBottom: "20px" }}
          >
            {uploadMsg.text}
          </div>
        )}

        {/* Upload Form Card */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "20px 24px",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <form onSubmit={handleUploadSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "18px",
                alignItems: "flex-end",
              }}
            >
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#334155", marginBottom: "6px" }}>
                  Bank Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. HDFC Bank, Axis Bank, ICICI Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  style={{ height: "42px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#334155", marginBottom: "6px" }}>
                  Spreadsheet File (.xlsx, .xls, .csv)
                </label>
                <input
                  id="bmFileInput"
                  type="file"
                  className="form-control"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{ height: "42px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isUploading}
                  style={{
                    height: "42px",
                    width: "100%",
                    padding: "0 22px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    background: "#2563eb",
                    borderColor: "#2563eb",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {isUploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-cloud-arrow-up-fill" />
                      Upload &amp; Parse
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Filter Card */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "280px" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "420px" }}>
              <i
                className="bi bi-search"
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Search by filename or bank name..."
                value={searchFileQuery}
                onChange={(e) => setSearchFileQuery(e.target.value)}
                style={{
                  paddingLeft: "38px",
                  height: "40px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.875rem",
                }}
              />
            </div>
            <span
              style={{
                background: "#eff6ff",
                color: "#2563eb",
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "0.8rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                border: "1px solid #dbeafe",
              }}
            >
              {files.length} {files.length === 1 ? "File Available" : "Files Available"}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-light"
            onClick={fetchFiles}
            disabled={isLoadingFiles}
            style={{
              height: "40px",
              padding: "0 16px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {isLoadingFiles ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-arrow-clockwise" />}
            Refresh
          </button>
        </div>

        {/* Files List Table */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 600, color: "#475569" }}>
                  File Name
                </th>
                <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 600, color: "#475569" }}>
                  Bank
                </th>
                <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 600, color: "#475569" }}>
                  Records
                </th>
                <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 600, color: "#475569" }}>
                  Size
                </th>
                <th style={{ textAlign: "right", padding: "14px 20px", fontWeight: 600, color: "#475569", minWidth: "180px" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoadingFiles ? (
                <tr>
                  <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                    <div className="spinner-border text-primary" role="status" />
                    <p style={{ marginTop: 8, fontSize: "0.85rem" }}>Loading manager spreadsheets...</p>
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                    <i className="bi bi-folder-x" style={{ fontSize: "2rem", color: "#94a3b8", display: "block", marginBottom: 8 }} />
                    <strong style={{ display: "block", color: "#1e293b", marginBottom: 4 }}>No Manager Spreadsheets Found</strong>
                    {searchFileQuery ? "No files match your search query." : "No manager spreadsheets uploaded yet."}
                  </td>
                </tr>
              ) : (
                filteredFiles.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 20px", fontWeight: 600, color: "#0f172a" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <i className="bi bi-file-earmark-spreadsheet" style={{ color: "#2563eb", fontSize: "1.1rem" }} />
                        <span>{f.file_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", color: "#334155" }}>
                      <span
                        style={{
                          background: "#f1f5f9",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontWeight: 500,
                          fontSize: "0.82rem",
                        }}
                      >
                        {f.bank_name}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", color: "#16a34a", fontWeight: 600 }}>
                      {f.record_count || "—"}
                    </td>
                    <td style={{ padding: "14px 20px", color: "#64748b" }}>{formatFileSize(f.file_size)}</td>
                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px", alignItems: "center", justifyContent: "flex-end" }}>
                        {f.file_path && (
                          <a
                            href={f.file_path}
                            download={f.file_name}
                            className="btn btn-sm btn-light"
                            style={{
                              color: "#2563eb",
                              border: "1px solid #dbeafe",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.8rem",
                              fontWeight: 500,
                            }}
                            title={`Download ${f.file_name}`}
                          >
                            <i className="bi bi-download" /> Download
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(f.id, f.file_name)}
                          className="btn btn-sm btn-light"
                          style={{
                            color: "#dc2626",
                            border: "1px solid #fee2e2",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "0.8rem",
                          }}
                          title={`Delete ${f.file_name}`}
                        >
                          <i className="bi bi-trash" /> Delete
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
