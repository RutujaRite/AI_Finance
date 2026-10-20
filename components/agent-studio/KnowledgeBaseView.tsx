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
  Pencil,
  Loader2,
} from "lucide-react";
import { Agent, isKnowledgeBaseAgent } from "@/lib/agent-studio/types";

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
  source?: string;
  is_policy_file?: boolean;
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
  const [editDoc, setEditDoc] = useState<KnowledgeDocItem | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [editAgentId, setEditAgentId] = useState("");
  const [editRawText, setEditRawText] = useState("");
  const [loadingEditDoc, setLoadingEditDoc] = useState(false);
  const [savingEditDoc, setSavingEditDoc] = useState(false);
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
  const isCurrentAgentKnowledge = isKnowledgeBaseAgent(agent);

  // Fetch all knowledge documents across all agents from RAG chunks / database
  async function fetchDocs() {
    try {
      const res = await fetch("/api/agents/knowledge");
      if (res.ok) {
        const data = await res.json();
        if (data.documents && Array.isArray(data.documents)) {
          const mapped: KnowledgeDocItem[] = data.documents.map((d: any) => ({
            id: d.id,
            agentId: d.agentId || d.agent_id,
            agentName: d.agentName || d.agent_name || "CreditWise Assistant",
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
            source: d.source || "knowledge_agent_passed",
            is_policy_file: d.is_policy_file ?? (d.name?.toLowerCase().includes("policy") || d.category === "Bank Policy"),
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
    if (!isKnowledgeBaseAgent(agent)) {
      onToast("This agent is configured as a conversational assistant. Document-level policy retrieval is handled independently by designated Knowledge Base agents.", "warning");
      return;
    }

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

  // Global policy filenames to strictly suppress from conversational agents
  const GLOBAL_POLICY_FILES = [
    "akte_bank_policy.pdf",
    "hdfc_bank_terms.pdf",
    "policy_notes.txt",
    "master_bank_policy.pdf",
  ];

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    // If active agent is conversational/greeting:
    if (!isCurrentAgentKnowledge) {
      const isDocForThisAgent = doc.agentId === agent.id;
      const isPassedByAgent = doc.source === "knowledge_agent_passed";
      const isGlobalPolicy =
        doc.is_policy_file === true ||
        doc.category === "Bank Policy" ||
        GLOBAL_POLICY_FILES.some((p) => doc.name.toLowerCase().includes(p));

      // Strict scoping: files.filter(file => file.agent_id === currentAgent.id && file.source === 'knowledge_agent_passed')
      // and completely suppress global policy documents
      if (!isDocForThisAgent || !isPassedByAgent || isGlobalPolicy) {
        return false;
      }
    } else {
      // For Knowledge Base agents:
      if (selectedAgentFilter !== "All Agents") {
        if (doc.agentName !== selectedAgentFilter && doc.agentId !== selectedAgentFilter) {
          return false;
        }
      }
    }

    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.agentName || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  function handleDeleteDoc(docId: string, docName: string) {
    if (confirm(`Remove "${docName}" from knowledge base?`)) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      fetch(`/api/agents/knowledge?docId=${docId}`, { method: "DELETE" }).catch(() => {});
      onToast(`Removed "${docName}"`, "info");
    }
  }

  async function handleOpenEditModal(doc: KnowledgeDocItem) {
    setEditDoc(doc);
    setEditDocName(doc.name);
    setEditAgentId(doc.agentId || agent.id);
    setEditRawText(doc.contentSnippet || "");
    setLoadingEditDoc(true);
    try {
      const res = await fetch(`/api/agent-studio/documents/${doc.id}`);
      const data = await res.json();
      if (res.ok && data.success && data.rawText !== undefined) {
        setEditRawText(data.rawText);
      }
    } catch (err) {
      console.error("Failed to fetch full document text:", err);
    } finally {
      setLoadingEditDoc(false);
    }
  }

  async function handleSaveEditDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!editDoc) return;
    if (!editDocName.trim()) {
      onToast("Document title cannot be empty", "warning");
      return;
    }
    setSavingEditDoc(true);
    try {
      const res = await fetch(`/api/agent-studio/documents/${editDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDocName.trim(),
          agentId: editAgentId,
          rawText: editRawText,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onToast(`Document "${editDocName}" updated and re-indexed.`, "success");
        setEditDoc(null);
        await fetchDocs();
      } else {
        onToast(data.error || "Failed to update document", "warning");
      }
    } catch {
      onToast("Error updating document", "warning");
    } finally {
      setSavingEditDoc(false);
    }
  }

  return (
    <div className="w-full min-h-full bg-slate-50 dark:bg-slate-950 flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Navigation Bar: Back to AI Agent Configuration */}
        <div className="flex items-center justify-between pb-1">
          <button
            onClick={onNavigateToInstructions}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition shadow-xs cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform group-hover:-translate-x-0.5" />
            <span>← Back to AI Agent Configuration</span>
          </button>

          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
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

            {/* Direct Upload Document button - only for Knowledge Base agents */}
            {isKnowledgeBaseAgent(agent) && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5 text-white" />
                <span>{isUploading ? "Uploading..." : "Upload Document"}</span>
              </button>
            )}

            {onNavigateToInstructions && (
              <button
                onClick={onNavigateToInstructions}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>AI Instructions</span>
              </button>
            )}

            {/* Active Agent Dropdown */}
            <div className="relative" ref={agentMenuRef}>
              <button
                type="button"
                onClick={() => setIsAgentMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100/70 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-600 dark:text-blue-400 transition cursor-pointer shadow-xs"
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
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span>Switch Active Agent</span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
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
                              ? "bg-blue-50/80 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-semibold"
                              : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
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
                    <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80">
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

        {/* Knowledge Scope & Grounding Behavior Card / Informational state for Conversational Assistant */}
        {!isKnowledgeBaseAgent(agent) ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 p-6 rounded-2xl border border-blue-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs transition-all duration-200 hover:border-blue-500 hover:shadow-md">
            <div className="flex items-start gap-4 max-w-2xl flex-1">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-[#12336B] dark:text-white tracking-tight">
                    Conversational Assistant Mode
                  </h3>
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    General / Greeting
                  </span>
                </div>
                <p className="text-xs text-[#526B91] dark:text-slate-400 mt-1.5 leading-relaxed">
                  This agent is configured as a conversational assistant. Document-level policy retrieval is handled independently by designated Knowledge Base agents.
                </p>
              </div>
            </div>

            {onSelectAgent && (
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const knowledgeAgent = allAgentsList.find((a) => isKnowledgeBaseAgent(a) && a.id !== agent.id);
                    if (knowledgeAgent) {
                      onSelectAgent(knowledgeAgent.id);
                      onToast(`Switched to Knowledge Base Agent "${knowledgeAgent.name}"`, "info");
                    } else {
                      onToast("No dedicated Knowledge Base agent found.", "warning");
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs whitespace-nowrap rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs hover:shadow-md transition cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Switch to Dedicated Knowledge Agent</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Global Bank Policy Access:
                  </h3>
                  <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Enabled
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                  {agentDisplayName} prioritizes its own uploaded documents below, while also cross-referencing official master bank policies (Axis, HDFC, ICICI, Bandhan, etc.) during multi-lender evaluations.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Grounding Strictness:</span>
              <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold rounded-lg">
                {agent.guardrailTemplates?.includes("Strict Knowledge Usage") ? "Strict (No Hallucination)" : "Standard (Hybrid)"}
              </span>
            </div>
          </div>
        )}

        {/* Uploaded Knowledge Base Table - Full Width (AI Model Blue Ribbon Style) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-200 hover:border-blue-500 hover:shadow-md">
          {/* Header ribbon */}
          <div
            className="border-b border-blue-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3 p-4 sm:px-5"
            style={{
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.04) 100%)",
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
                <h2 className="m-0 text-base font-bold text-[#1e3a8a] dark:text-blue-200">
                  Uploaded Knowledge Base Documents
                </h2>
                <span className="text-xs font-medium text-blue-500 dark:text-blue-400">
                  Indexed bank policy guidelines, semantic embeddings, and agent chunk associations
                </span>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {filteredDocuments.length} Indexed Documents
            </span>
          </div>

          <div className="p-5 sm:p-6">
            {/* Header with Search, Agent Dropdown, and Category Dropdown */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
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
                  className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-48 shadow-xs"
                />
              </div>

              {/* Agent Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedAgentFilter}
                  onChange={(e) => setSelectedAgentFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
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
                <tr className="text-slate-400 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 font-semibold text-[11px]">
                  <th className="py-3 px-3">File Name</th>
                  <th className="py-3 px-2">Respective Agent</th>
                  <th className="py-3 px-2">Type</th>
                  <th className="py-3 px-2">Provenance</th>
                  <th className="py-3 px-2">Size / Chunks</th>
                  <th className="py-3 px-2">Uploaded On</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-500 dark:text-slate-400">
                      {!isCurrentAgentKnowledge ? (
                        <div className="max-w-md mx-auto space-y-1.5 py-4">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            No document-level knowledge files indexed for this conversational assistant.
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-400">
                            Document-level policy retrieval is handled independently by designated Knowledge Base agents.
                          </p>
                        </div>
                      ) : (
                        "No documents found matching criteria."
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      {/* File Name */}
                      <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
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
                            className="truncate max-w-[170px] sm:max-w-[210px] font-medium text-slate-800 dark:text-slate-200"
                            title={doc.name}
                          >
                            {doc.name}
                          </span>
                        </div>
                      </td>

                      {/* Respective Agent */}
                      <td className="py-3 px-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 text-blue-600 dark:text-blue-400">
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

                      {/* Provenance Badge */}
                      <td className="py-3 px-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
                          <CheckCircle2 className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                          Source: Passed by Agent
                        </span>
                      </td>

                      {/* Size / RAG Chunks */}
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-300">
                        <div className="flex flex-col leading-tight">
                          <span>{doc.size}</span>
                          {doc.chunkCount && doc.chunkCount > 0 ? (
                            <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">
                              {doc.chunkCount} {doc.chunkCount === 1 ? "chunk" : "chunks"}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Uploaded On */}
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
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
                            onClick={() => handleOpenEditModal(doc)}
                            className="p-1 hover:text-amber-600 rounded transition cursor-pointer"
                            title="Edit document details / text content"
                          >
                            <Pencil className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-xs">
                  {previewDoc.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
                <span>Type: <strong className="text-slate-800 dark:text-slate-200">{previewDoc.type}</strong></span>
                <span>Size: <strong className="text-slate-800 dark:text-slate-200">{previewDoc.size}</strong></span>
                {previewDoc.agentName && (
                  <span>Agent: <strong className="text-slate-800 dark:text-slate-200">{previewDoc.agentName}</strong></span>
                )}
              </div>

              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Extracted Content / Summary:
                </span>
                <p className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-xs">
                  {previewDoc.contentSnippet || "No snippet available."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Edit Modal */}
      {editDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Edit Document Details &amp; Content
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update document name, re-assign agent, or edit text content to re-index chunks.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditDoc(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDoc} className="mt-4 flex flex-col flex-1 min-h-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    File Name / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editDocName}
                    onChange={(e) => setEditDocName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
                    placeholder="Document title or filename..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Respective Agent
                  </label>
                  <select
                    value={editAgentId}
                    onChange={(e) => setEditAgentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
                  >
                    {allAgentsList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name || "Default Agent"} {a.id === agent.id ? "(Current Agent)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-1.5 shrink-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Document Content (Raw Text / Criteria)
                  </label>
                  {loadingEditDoc ? (
                    <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading full text...
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 dark:text-slate-400">
                      {editRawText.length.toLocaleString()} characters
                    </span>
                  )}
                </div>
                <textarea
                  value={editRawText}
                  onChange={(e) => setEditRawText(e.target.value)}
                  placeholder="Enter or modify the raw text or policy criteria here..."
                  disabled={loadingEditDoc}
                  className="w-full flex-1 min-h-[260px] p-3 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-1.5 shrink-0">
                  Saving modifications will automatically re-segment text into RAG chunks and refresh vector embeddings in PostgreSQL.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditDoc(null)}
                  disabled={savingEditDoc}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditDoc || loadingEditDoc || !editDocName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEditDoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {savingEditDoc ? "Saving & Re-indexing..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
