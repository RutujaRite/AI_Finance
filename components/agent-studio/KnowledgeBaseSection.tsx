// components/agent-studio/KnowledgeBaseSection.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Agent,
  UserSubscriptionState,
  KnowledgeDocumentRecord,
} from "@/lib/agent-studio/types";

interface KnowledgeBaseSectionProps {
  agent: Agent;
  subscription: UserSubscriptionState;
  onUpgrade?: () => void;
  onKnowledgeUpdated?: () => void;
  onNavigateToInstructions?: () => void;
}

export default function KnowledgeBaseSection({
  agent,
  subscription,
  onUpgrade,
  onKnowledgeUpdated,
  onNavigateToInstructions,
}: KnowledgeBaseSectionProps) {
  const [documents, setDocuments] = useState<KnowledgeDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modals state
  const [selectedDocForConfig, setSelectedDocForConfig] =
    useState<KnowledgeDocumentRecord | null>(null);
  const [configInstructionText, setConfigInstructionText] = useState("");
  const [configWhenToUse, setConfigWhenToUse] = useState("");
  const [configWhenNotToUse, setConfigWhenNotToUse] = useState("");
  const [configGuardrailText, setConfigGuardrailText] = useState("");
  const [configIsActive, setConfigIsActive] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // View Preview Modal state
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Polling for processing status transitions
  useEffect(() => {
    loadDocuments();
    const interval = setInterval(() => {
      // Poll if any document is not completed or failed
      loadDocuments(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [agent.id]);

  async function loadDocuments(silent = false) {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/agents/${agent.id}/knowledge`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.documents)) {
          setDocuments(data.documents);
        }
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    if (!file) return;
    setUploadError(null);

    if (documents.length >= subscription.maxKnowledgeFiles) {
      setUploadError(
        `Your ${subscription.plan.toUpperCase()} plan limit of ${subscription.maxKnowledgeFiles} knowledge file(s) has been reached. Please upgrade to add more.`
      );
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setUploadError(data.error || "Failed to upload document");
        return;
      }

      await loadDocuments();
      if (onKnowledgeUpdated) onKnowledgeUpdated();
    } catch (err: any) {
      setUploadError(err.message || "Network error uploading file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Are you sure you want to remove this document from the agent knowledge base?")) {
      return;
    }

    try {
      const res = await fetch(`/api/agents/${agent.id}/knowledge?docId=${docId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await loadDocuments();
        if (onKnowledgeUpdated) onKnowledgeUpdated();
      } else {
        alert(data.error || "Failed to delete document");
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  async function handleRetry(docId: string) {
    try {
      const res = await fetch(`/api/agents/${agent.id}/knowledge/${docId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await loadDocuments();
      } else {
        alert(data.error || "Retry failed");
      }
    } catch (err) {
      console.error("Retry error:", err);
    }
  }

  async function handleToggleActive(doc: KnowledgeDocumentRecord) {
    try {
      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: doc.id,
          isActive: !doc.isActive,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await loadDocuments();
        if (onKnowledgeUpdated) onKnowledgeUpdated();
      }
    } catch (err) {
      console.error("Toggle active error:", err);
    }
  }

  function openConfigureModal(doc: KnowledgeDocumentRecord) {
    setSelectedDocForConfig(doc);
    setConfigInstructionText(doc.instruction?.instructionText || "");
    setConfigWhenToUse(doc.instruction?.whenToUse || "");
    setConfigWhenNotToUse(doc.instruction?.whenNotToUse || "");
    setConfigGuardrailText(doc.guardrail?.guardrailText || "");
    setConfigIsActive(doc.isActive !== false);
  }

  async function handleSaveConfiguration() {
    if (!selectedDocForConfig) return;
    try {
      setSavingConfig(true);
      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocForConfig.id,
          instructionText: configInstructionText,
          whenToUse: configWhenToUse,
          whenNotToUse: configWhenNotToUse,
          guardrailText: configGuardrailText,
          isActive: configIsActive,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await loadDocuments();
        setSelectedDocForConfig(null);
        if (onKnowledgeUpdated) onKnowledgeUpdated();
      } else {
        alert(data.error || "Failed to save document configuration");
      }
    } catch (err) {
      console.error("Save config error:", err);
    } finally {
      setSavingConfig(false);
    }
  }

  async function openPreviewModal(doc: KnowledgeDocumentRecord) {
    try {
      setPreviewLoading(true);
      setPreviewDoc(null);
      const res = await fetch(`/api/agents/${agent.id}/knowledge/${doc.id}/preview`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPreviewDoc(data);
        }
      }
    } catch (err) {
      console.error("Preview error:", err);
    } finally {
      setPreviewLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const s = (status || "COMPLETED").toUpperCase();
    if (s === "COMPLETED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Processed
        </span>
      );
    }
    if (s === "FAILED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 animate-pulse">
        <i className="bi bi-arrow-repeat animate-spin text-[10px]" />
        {s}
      </span>
    );
  }

  const isAtLimit = documents.length >= subscription.maxKnowledgeFiles;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fadeIn font-sans">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold text-xs">
              <i className="bi bi-folder2-open text-sm" />
            </span>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              Knowledge Base
            </h2>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
              RAG Storage
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Upload policies, guidelines, and sheets to provide your agent with verified document intelligence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
            {documents.length} / {subscription.maxKnowledgeFiles} Documents
          </span>
          {isAtLimit && onUpgrade && (
            <button
              onClick={onUpgrade}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition"
            >
              Upgrade Limit
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAtLimit || uploading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-60"
          >
            <i className="bi bi-cloud-arrow-up text-sm" />
            <span>Upload Knowledge</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {uploadError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill text-red-500" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600">
            <i className="bi bi-x text-sm" />
          </button>
        </div>
      )}

      {/* 2. Drag & Drop Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => {
          if (!isAtLimit && !uploading) {
            fileInputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5 ${
          dragActive
            ? "border-indigo-500 bg-indigo-50/50"
            : isAtLimit
            ? "border-slate-200 bg-slate-50/60 cursor-not-allowed opacity-75"
            : "border-slate-200 hover:border-indigo-400 bg-slate-50/40 hover:bg-white"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.json"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
          disabled={isAtLimit || uploading}
          className="hidden"
        />

        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition ${
            uploading
              ? "bg-indigo-100 text-indigo-600 animate-pulse"
              : "bg-indigo-50 text-indigo-600 border border-indigo-100"
          }`}
        >
          {uploading ? (
            <i className="bi bi-arrow-repeat animate-spin" />
          ) : (
            <i className="bi bi-cloud-arrow-up" />
          )}
        </div>

        <div>
          <div className="text-xs font-bold text-slate-800">
            {uploading
              ? "Processing document pipeline (Extracting, Chunking, Indexing)..."
              : isAtLimit
              ? "Plan Limit Reached"
              : "Drop documents here or click to browse"}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Supported formats: PDF, DOC, DOCX, TXT, CSV, XLS, XLSX, JSON (Max 50MB)
          </p>
        </div>
      </div>

      {/* 3. Uploaded Documents List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Connected Documents ({documents.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Each document has independent instructions, guardrails, and indexing status.
            </p>
          </div>
          {onNavigateToInstructions && (
            <button
              onClick={onNavigateToInstructions}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>View in AI Instructions</span>
              <i className="bi bi-arrow-right text-[10px]" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <i className="bi bi-arrow-repeat animate-spin text-sm" />
            <span>Loading knowledge documents...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <i className="bi bi-file-earmark-text text-3xl text-slate-300 block" />
            <p className="font-semibold text-slate-700">No documents uploaded yet</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Upload loan policy circulars or FAQ sheets to provide verified intelligence to your agent.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const ext = doc.fileType?.toLowerCase();
              const isPdf = ext === "pdf";
              const isWord = ext === "docx" || ext === "doc";
              const isSheet = ext === "xlsx" || ext === "xls" || ext === "csv";

              return (
                <div
                  key={doc.id}
                  className={`p-4 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    doc.isActive === false
                      ? "bg-slate-50/50 border-slate-200 opacity-70"
                      : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                  }`}
                >
                  {/* File Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 font-bold ${
                        isPdf
                          ? "bg-red-50 text-red-600 border border-red-100"
                          : isWord
                          ? "bg-blue-50 text-blue-600 border border-blue-100"
                          : isSheet
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      <i
                        className={
                          isPdf
                            ? "bi bi-file-earmark-pdf"
                            : isWord
                            ? "bi bi-file-earmark-word"
                            : isSheet
                            ? "bi bi-file-earmark-spreadsheet"
                            : "bi bi-file-earmark-text"
                        }
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {doc.name}
                        </span>
                        {getStatusBadge(doc.status)}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(doc)}
                          title={doc.isActive !== false ? "Click to deactivate" : "Click to activate"}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                            doc.isActive !== false
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {doc.isActive !== false ? "Active" : "Inactive"}
                        </button>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                        <span>Type: {doc.fileType?.toUpperCase()}</span>
                        <span>•</span>
                        <span>Size: {doc.fileSize}</span>
                        <span>•</span>
                        <span>
                          Chunks: <strong>{doc.chunkCount || 0}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Vector Status:{" "}
                          <strong
                            className={
                              doc.vectorStatus === "Indexed"
                                ? "text-indigo-600"
                                : "text-slate-600"
                            }
                          >
                            {doc.vectorStatus || "Pending"}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>Uploaded: {doc.uploadedAt}</span>
                      </div>

                      {/* Failure reason and quick retry */}
                      {doc.status === "FAILED" && (
                        <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                          <span>
                            <strong>Failure Reason:</strong> {doc.statusMessage || "Extraction or embedding error."}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRetry(doc.id)}
                            className="font-bold text-red-800 underline hover:text-red-950 ml-2"
                          >
                            Retry Processing
                          </button>
                        </div>
                      )}

                      {/* Configured instruction summary snippet */}
                      {doc.instruction?.instructionText && (
                        <div className="mt-2 text-[11px] text-indigo-700 bg-indigo-50/60 border border-indigo-100/70 px-2.5 py-1 rounded-lg line-clamp-1">
                          <strong className="text-indigo-900">Instruction:</strong>{" "}
                          {doc.instruction.instructionText}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => openPreviewModal(doc)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
                      title="View extracted text and chunks"
                    >
                      <i className="bi bi-eye mr-1" />
                      View
                    </button>

                    <button
                      onClick={() => openConfigureModal(doc)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition"
                      title="Configure document-specific instructions & guardrails"
                    >
                      <i className="bi bi-sliders mr-1" />
                      Configure
                    </button>

                    {doc.status === "FAILED" && (
                      <button
                        onClick={() => handleRetry(doc.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition"
                        title="Retry document processing"
                      >
                        <i className="bi bi-arrow-repeat mr-1" />
                        Retry
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 rounded-xl text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
                      title="Delete document"
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Document Configuration Modal (Section 5) */}
      {selectedDocForConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Document Configuration
                </h3>
                <p className="text-xs text-slate-500">
                  File: <strong className="text-slate-700">{selectedDocForConfig.name}</strong> •{" "}
                  Status: {selectedDocForConfig.vectorStatus}
                </p>
              </div>
              <button
                onClick={() => setSelectedDocForConfig(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            {/* Document Active Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-800">Active in Knowledge Base</div>
                <div className="text-[11px] text-slate-500">
                  When active, the agent retrieves context from this document.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfigIsActive(!configIsActive)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  configIsActive ? "bg-indigo-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    configIsActive ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Knowledge Instructions */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Document-Specific Instructions
                </label>
                <span className="text-[11px] text-slate-400 font-normal">
                  How the AI Agent should use this document
                </span>
              </div>
              <textarea
                rows={4}
                value={configInstructionText}
                onChange={(e) => setConfigInstructionText(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition leading-relaxed resize-y"
                placeholder="Example: Use this document when the user asks about personal loan eligibility, required documents, loan conditions, or personal loan policies. Do not use this document for education loan questions."
              />
            </div>

            {/* When to use vs When NOT to use (Section 10 Knowledge Selection) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  When to use (Keywords / Topics)
                </label>
                <input
                  type="text"
                  value={configWhenToUse}
                  onChange={(e) => setConfigWhenToUse(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. personal loan, salaried, cibil"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  When NOT to use
                </label>
                <input
                  type="text"
                  value={configWhenNotToUse}
                  onChange={(e) => setConfigWhenNotToUse(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. education loan, home loan"
                />
              </div>
            </div>

            {/* Document-Specific Guardrails (Section 7) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Document-Specific Guardrails
              </label>
              <textarea
                rows={3}
                value={configGuardrailText}
                onChange={(e) => setConfigGuardrailText(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition leading-relaxed resize-y"
                placeholder="Example: Only use this document for personal-loan-related questions. Do not assume missing policy information. If the answer is not available in this document, clearly state that."
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedDocForConfig(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfiguration}
                disabled={savingConfig}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-60 flex items-center gap-1.5"
              >
                {savingConfig ? (
                  <>
                    <i className="bi bi-arrow-repeat animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2" />
                    <span>Save Instruction</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Document Preview Modal (View extracted text and chunks) */}
      {(previewDoc || previewLoading) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleIn max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Document Preview &amp; Extracted Chunks
                </h3>
                <p className="text-xs text-slate-500">
                  {previewDoc?.document?.name || "Loading..."} •{" "}
                  {previewDoc?.chunks?.length || 0} Chunks Indexed
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {previewLoading ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <i className="bi bi-arrow-repeat animate-spin text-sm" />
                  <span>Loading document chunks...</span>
                </div>
              ) : previewDoc?.chunks?.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  No text chunks available yet. Document may still be processing.
                </p>
              ) : (
                previewDoc?.chunks?.map((chunk: any, idx: number) => (
                  <div
                    key={chunk.id || idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>Chunk #{idx + 1}</span>
                      <span>{chunk.charCount || chunk.content?.length || 0} characters</span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                      {chunk.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
