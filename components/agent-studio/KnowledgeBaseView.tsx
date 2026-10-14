// components/agent-studio/KnowledgeBaseView.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  FileText,
  Search,
  Eye,
  Trash2,
  Upload,
  X,
  Bot,
  ChevronDown,
  RefreshCw,
  Plus,
  BookOpen,
  ShieldCheck,
  Globe,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { Agent } from "@/lib/agent-studio/types";

interface KnowledgeDocItem {
  id: string;
  name: string;
  type: "PDF" | "TXT" | "XLSX" | "DOCX" | "CSV";
  category?: string;
  size: string;
  uploadedOn: string;
  status: "Processed" | "Processing" | "Failed";
  contentSnippet?: string;
  agentId?: string;
  agentName?: string;
  chunkCount?: number;
}

const SEED_DOCUMENTS: KnowledgeDocItem[] = [];

interface KnowledgeBaseViewProps {
  agent: Agent;
  agents?: Agent[];
  onSelectAgent?: (agentId: string) => void;
  onNavigateToDemo: () => void;
  onNavigateToInstructions?: () => void;
  onToast: (msg: string, type?: "success" | "info" | "warning") => void;
  onCreateAgentClick?: () => void;
  onActivateAgent?: (agentId: string) => Promise<void>;
  onDeactivateAgent?: (agentId: string) => Promise<void>;
  onDeleteAgentClick?: (agentId: string) => void;
}

export default function KnowledgeBaseView({
  agent,
  agents = [],
  onSelectAgent,
  onNavigateToDemo,
  onNavigateToInstructions,
  onToast,
  onCreateAgentClick,
  onActivateAgent,
  onDeactivateAgent,
  onDeleteAgentClick,
}: KnowledgeBaseViewProps) {
  const [documents, setDocuments] = useState<KnowledgeDocItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentFilter, setSelectedAgentFilter] = useState("All Agents");
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocItem | null>(null);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const agentMenuRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Close agent menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (agentMenuRef.current && !agentMenuRef.current.contains(e.target as Node)) {
        setIsAgentMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allAgentsList = agents && agents.length > 0 ? agents : [agent];
  const agentDisplayName = agent.name || "CreditWise Assistant";

  // Fetch all knowledge documents across all agents from RAG chunks / database
  async function fetchDocs() {
    try {
      const res = await fetch("/api/agents/knowledge");
      if (res.ok) {
        const data = await res.json();
        if (data.documents && Array.isArray(data.documents)) {
          const mapped: KnowledgeDocItem[] = data.documents.map((d: any) => ({
            id: d.id,
            agentId: d.agentId,
            agentName: d.agentName || "CreditWise Assistant",
            name: d.name,
            type: (d.fileType?.toUpperCase() === "DOCX"
              ? "DOCX"
              : d.fileType?.toUpperCase() === "TXT"
              ? "TXT"
              : d.fileType?.toUpperCase() === "XLSX"
              ? "XLSX"
              : d.fileType?.toUpperCase() === "CSV"
              ? "CSV"
              : "PDF") as any,
            category:
              d.category ||
              (d.name.toLowerCase().includes("policy") ? "Bank Policy" : "Agent Knowledge"),
            size: d.fileSize || "1.2 MB",
            uploadedOn: new Date(d.uploadedAt || Date.now()).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            status:
              d.status === "COMPLETED" || d.status === "Processed"
                ? "Processed"
                : (d.status as any) || "Processed",
            chunkCount: d.chunkCount ?? 1,
            contentSnippet: d.rawText
              ? d.rawText.substring(0, 320)
              : "Indexed and stored in RAG knowledge chunks for AI agent retrieval.",
          }));

          setDocuments(mapped);
        }
      }
    } catch (err) {
      console.error("Failed to fetch all knowledge docs:", err);
    }
  }

  useEffect(() => {
    fetchDocs();
  }, [agent.id]);

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split(".").pop()?.toUpperCase() || "PDF";
    const allowed = ["PDF", "DOCX", "DOC", "TXT", "XLSX", "XLS", "CSV", "JSON"];
    if (!allowed.includes(ext)) {
      onToast("Unsupported format. Allowed: PDF, DOCX, XLSX, CSV, TXT", "warning");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      onToast("File exceeds maximum 15MB limit", "warning");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onToast(`Uploaded and indexed "${file.name}" for ${agentDisplayName}`, "success");
        await fetchDocs();
      } else {
        onToast(data.error || "Failed to upload document", "warning");
      }
    } catch (err) {
      onToast("Error uploading document to knowledge base", "warning");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleReindexDoc(docId: string, docName: string) {
    try {
      onToast(`Re-indexing "${docName}"...`, "info");
      const res = await fetch(`/api/agents/${agent.id}/knowledge/${docId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onToast(`Re-indexing initiated for "${docName}"`, "success");
        setTimeout(fetchDocs, 1200);
      } else {
        onToast(data.error || "Re-indexing failed", "warning");
      }
    } catch {
      onToast("Re-indexing request failed", "warning");
    }
  }

  // Unique agent names for dropdown filter
  const availableAgentNames = Array.from(
    new Set([
      ...documents.map((d) => d.agentName).filter(Boolean),
      ...agents.map((a) => a.name),
    ])
  ) as string[];

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.agentName || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAgent =
      selectedAgentFilter === "All Agents" || doc.agentName === selectedAgentFilter;
    return matchesSearch && matchesAgent;
  });

  function handleDeleteDoc(docId: string, docName: string) {
    if (confirm(`Remove "${docName}" from knowledge base?`)) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      fetch(`/api/agents/knowledge?docId=${docId}`, { method: "DELETE" }).catch(() => {});
      onToast(`Removed "${docName}"`, "info");
    }
  }

  return (
    <div className="flex-1 bg-[#F8FAFC] min-h-screen p-6 md:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Navigation Bar: Back to AI Agent Studio */}
        <div className="flex items-center justify-between pb-1">
          <button
            onClick={onNavigateToInstructions}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/60 text-xs font-semibold text-slate-700 hover:text-blue-600 transition shadow-xs cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-transform group-hover:-translate-x-0.5" />
            <span>← Back to AI Agent Studio</span>
          </button>

          <span className="text-xs font-medium text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/60">
            Dedicated Knowledge Base View
          </span>
        </div>

        {/* Page Header */}
        <div className="cn-page-header">
          <div>
            <h1 className="cn-page-header-title">
              Knowledge Base
            </h1>
            <p className="cn-page-header-subtitle">
              View and inspect all uploaded knowledge base files, bank policies, and RAG chunks indexed across your created agents.
            </p>
          </div>

          {/* Actions & Indicator badges */}
          <div className="cn-page-header-actions">
            {/* Hidden File Input for direct document uploads */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />

            {/* Direct Upload Document button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-white" />
              <span>{isUploading ? "Uploading..." : "Upload Document"}</span>
            </button>

            {onNavigateToInstructions && (
              <button
                onClick={onNavigateToInstructions}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>AI Instructions</span>
              </button>
            )}

            {/* Active Agent Dropdown */}
            <div className="relative" ref={agentMenuRef}>
              <button
                type="button"
                onClick={() => setIsAgentMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100/70 border border-blue-200 text-xs font-semibold text-blue-600 transition cursor-pointer shadow-xs"
              >
                <Bot className="w-4 h-4" />
                <span>Active Agent: {agentDisplayName}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    isAgentMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isAgentMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Switch Active Agent</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                      {allAgentsList.length} agents
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {allAgentsList.map((ag) => {
                      const isSelected = ag.id === agent.id;
                      const aDisplayName = ag.name;
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            if (onSelectAgent) {
                              onSelectAgent(ag.id);
                              onToast(`Switched active agent to ${aDisplayName}`, "info");
                            }
                            setIsAgentMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition cursor-pointer ${
                            isSelected
                              ? "bg-blue-50/80 text-blue-600 font-semibold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              <Bot className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="truncate font-medium">{aDisplayName}</div>
                              <div className="text-[10px] text-slate-400 capitalize">
                                {ag.status || "active"} • {ag.instructions?.agentRole || "AI Assistant"}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {onCreateAgentClick && (
                    <div className="p-2 border-t border-slate-100 bg-slate-50/80">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAgentMenuOpen(false);
                          onCreateAgentClick();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create New Agent</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Knowledge Scope & Grounding Behavior Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900">
                  Global Bank Policy Access:
                </h3>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Enabled
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-xl">
                {agentDisplayName} prioritizes its own uploaded documents below, while also cross-referencing official master bank policies (Axis, HDFC, ICICI, Bandhan, etc.) during multi-lender evaluations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="text-[11px] font-semibold text-slate-500">Grounding Strictness:</span>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg">
              {agent.guardrailTemplates?.includes("Strict Knowledge Usage") ? "Strict (No Hallucination)" : "Standard (Hybrid)"}
            </span>
          </div>
        </div>

        {/* Uploaded Knowledge Base Table - Full Width (AI Model Blue Ribbon Style) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #bfdbfe",
            boxShadow: "0 4px 20px -2px rgba(59, 130, 246, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Header ribbon */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.04) 100%)",
              padding: "16px 20px",
              borderBottom: "1px solid #dbeafe",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  background: "#2563eb",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1e3a8a" }}>
                  Uploaded Knowledge Base Documents
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: 500 }}>
                  Indexed bank policy guidelines, semantic embeddings, and agent chunk associations
                </span>
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: 600,
                background: "#dcfce7",
                color: "#15803d",
                border: "1px solid #bbf7d0",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }}></span>
              {filteredDocuments.length} Indexed Documents
            </span>
          </div>

          <div className="p-5 sm:p-6">
            {/* Header with Search, Agent Dropdown, and Category Dropdown */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="text-xs font-semibold text-slate-700">
                Filter &amp; Query Indexed Documents
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
              {/* Search documents & agents */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search file or agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-44 sm:w-48 shadow-xs"
                />
              </div>

              {/* Agent Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedAgentFilter}
                  onChange={(e) => setSelectedAgentFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="All Agents">All Agents ({documents.length})</option>
                  {availableAgentNames.map((aName) => (
                    <option key={aName} value={aName}>
                      {aName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 font-semibold text-[11px]">
                  <th className="py-3 px-3">File Name</th>
                  <th className="py-3 px-2">Respective Agent</th>
                  <th className="py-3 px-2">Type</th>
                  <th className="py-3 px-2">Size / Chunks</th>
                  <th className="py-3 px-2">Uploaded On</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No documents found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition">
                      {/* File Name */}
                      <td className="py-3 px-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              doc.type === "PDF"
                                ? "text-rose-500"
                                : doc.type === "DOCX"
                                ? "text-blue-600"
                                : doc.type === "XLSX"
                                ? "text-emerald-600"
                                : "text-amber-500"
                            }
                          >
                            <FileText className="w-4 h-4" />
                          </span>
                          <span
                            className="truncate max-w-[170px] sm:max-w-[210px] font-medium text-slate-800"
                            title={doc.name}
                          >
                            {doc.name}
                          </span>
                        </div>
                      </td>

                      {/* Respective Agent */}
                      <td className="py-3 px-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200/80 text-blue-600">
                          <Bot className="w-3.5 h-3.5 shrink-0" />
                          <span
                            className="font-semibold text-[11px] truncate max-w-[130px]"
                            title={doc.agentName}
                          >
                            {doc.agentName || "CreditWise Assistant"}
                          </span>
                        </div>
                      </td>

                      {/* Type Pill */}
                      <td className="py-3 px-2">
                        <span
                          className={`as-badge ${
                            doc.type === "PDF"
                              ? "as-badge-pdf"
                              : doc.type === "DOCX"
                              ? "as-badge-docx"
                              : doc.type === "XLSX"
                              ? "as-badge-xlsx"
                              : "as-badge-txt"
                          }`}
                        >
                          {doc.type}
                        </span>
                      </td>

                      {/* Size / RAG Chunks */}
                      <td className="py-3 px-2 text-slate-600">
                        <div className="flex flex-col leading-tight">
                          <span>{doc.size}</span>
                          {doc.chunkCount && doc.chunkCount > 0 ? (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {doc.chunkCount} {doc.chunkCount === 1 ? "chunk" : "chunks"}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Uploaded On */}
                      <td className="py-3 px-2 text-slate-600 whitespace-nowrap">
                        {doc.uploadedOn}
                      </td>

                      {/* Status Pill */}
                      <td className="py-3 px-2">
                        <span
                          className={`cn-status-pill ${
                            doc.status === "Processed"
                              ? "success"
                              : doc.status === "Processing"
                              ? "warning"
                              : "danger"
                          }`}
                        >
                          <span className="cn-status-dot" />
                          {doc.status}
                        </span>
                      </td>

                      {/* Actions: View Preview, Delete */}
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-400">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1 hover:text-blue-600 rounded transition cursor-pointer"
                            title="View document content"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleReindexDoc(doc.id, doc.name)}
                            className="p-1 hover:text-emerald-600 rounded transition cursor-pointer"
                            title="Re-index document chunks & embeddings"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id, doc.name)}
                            className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer active:scale-95"
                            title="Remove document"
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

          {/* Table Footer with Pagination */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {filteredDocuments.length} of {documents.length} documents
            </span>
            <div className="flex items-center gap-1.5">
              <button className="w-6 h-6 rounded flex items-center justify-center border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30">
                &lt;
              </button>
              <button className="w-6 h-6 rounded flex items-center justify-center bg-blue-600 text-white font-medium text-xs">
                1
              </button>
              <button className="w-6 h-6 rounded flex items-center justify-center border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30">
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm truncate max-w-xs">
                  {previewDoc.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center gap-4 text-slate-500">
                <span>Type: <strong className="text-slate-800">{previewDoc.type}</strong></span>
                <span>Size: <strong className="text-slate-800">{previewDoc.size}</strong></span>
                {previewDoc.agentName && (
                  <span>Agent: <strong className="text-slate-800">{previewDoc.agentName}</strong></span>
                )}
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">
                  Extracted Content / Summary:
                </span>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 whitespace-pre-wrap leading-relaxed text-xs">
                  {previewDoc.contentSnippet || "No snippet available."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
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
