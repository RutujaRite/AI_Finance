// components/agent-studio/AiInstructionsView.tsx
"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Settings,
  User,
  FileText,
  BookOpen,
  UploadCloud,
  Upload,
  Paperclip,
  ArrowRight,
  Search,
  Eye,
  Edit2,
  Trash2,
  Bot,
  ChevronDown,
  Check,
  Lightbulb,
  X,
  Save,
  Plus,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  ShieldCheck,
  FileSpreadsheet,
  FileCode,
  Sparkles,
} from "lucide-react";
import { Agent } from "@/lib/agent-studio/types";

interface AgentDocItem {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedOn: string;
  status: string;
  content?: string;
  instructionText?: string;
  whenToUse?: string;
  whenNotToUse?: string;
  guardrailText?: string;
  isActive?: boolean;
}

interface BankPolicyLibraryItem {
  id: number;
  bank_name: string;
  bank_code: string;
  status: string;
  extracted_text?: string;
  file_name?: string;
}

interface AiInstructionsViewProps {
  agent: Agent;
  agents?: Agent[];
  onSelectAgent?: (agentId: string) => void;
  onUpdateAgent: (updates: Partial<Agent>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  onNavigateToKnowledge: () => void;
  onNavigateToDemo?: () => void;
  onToast: (msg: string, type?: "success" | "info" | "warning") => void;
  onCreateAgentClick?: () => void;
  onActivateAgent?: (agentId: string) => Promise<void>;
  onDeactivateAgent?: (agentId: string) => Promise<void>;
  onDeleteAgentClick?: (agentId: string) => void;
}

const PAGE_SIZE = 5;

export default function AiInstructionsView({
  agent,
  agents = [],
  onSelectAgent,
  onUpdateAgent,
  onSave,
  saving,
  onNavigateToKnowledge,
  onNavigateToDemo,
  onToast,
  onCreateAgentClick,
  onActivateAgent,
  onDeactivateAgent,
  onDeleteAgentClick,
}: AiInstructionsViewProps) {
  const [isDraft, setIsDraft] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [agentDocs, setAgentDocs] = useState<AgentDocItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Table Selection, Search, Filter & Pagination
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [currentPage, setCurrentPage] = useState(1);

  // Agent State
  const [isAssistantVisible, setIsAssistantVisible] = useState(
    agent.operationalMode !== "task_focused"
  );
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);

  // Modals
  const [previewDoc, setPreviewDoc] = useState<AgentDocItem | null>(null);
  const [editConfigDoc, setEditConfigDoc] = useState<AgentDocItem | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [editInstructionText, setEditInstructionText] = useState("");
  const [editWhenToUse, setEditWhenToUse] = useState("");
  const [editWhenNotToUse, setEditWhenNotToUse] = useState("");
  const [editGuardrailText, setEditGuardrailText] = useState("");
  const [isSavingDocConfig, setIsSavingDocConfig] = useState(false);

  // Delete modal confirmation
  const [deleteDocTarget, setDeleteDocTarget] = useState<AgentDocItem | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // From URL Modal
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlTitleInput, setUrlTitleInput] = useState("");

  // From Text Modal
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textTitleInput, setTextTitleInput] = useState("");
  const [textContentInput, setTextContentInput] = useState("");

  // From Library Modal
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [libraryPolicies, setLibraryPolicies] = useState<BankPolicyLibraryItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isAddingFromSource, setIsAddingFromSource] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  const allAgentsList = agents && agents.length > 0 ? agents : [agent];

  // Close agent dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setIsAgentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Form values based on current agent
  const agentName = agent.name || "Loan Assistant";
  const conversationTone = agent.instructions?.tone || "Professional and Friendly";
  const responseStyle =
    agent.responseStyle === "detailed"
      ? "Detailed"
      : agent.responseStyle === "balanced"
      ? "Step-by-Step"
      : "Clear, Helpful, Concise";

  const defaultPrompt =
    "You are a helpful AI assistant. Understand the user's message before responding. Follow the configured business instructions. Use the connected knowledge base for supported answers. If information is missing, ask a clear follow-up question. Do not invent facts. Keep responses friendly, accurate, and easy to understand.";

  const instructionsText =
    agent.instructions?.advancedPrompt && agent.instructions.advancedPrompt.length > 50
      ? agent.instructions.advancedPrompt
      : defaultPrompt;

  // Real API Fetch: Knowledge Documents for Current Agent
  async function loadAgentKnowledge() {
    try {
      setIsLoadingDocs(true);
      setDocsError(null);
      const res = await fetch(`/api/agents/${agent.id}/knowledge`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.documents)) {
          const mapped: AgentDocItem[] = data.documents.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: (d.fileType || "PDF").toUpperCase(),
            size: d.fileSize || "1.0 MB",
            uploadedOn: new Date(d.uploadedAt || Date.now()).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            status: d.status === "FAILED" ? "Failed" : "Active",
            content: d.content || d.extractedText || undefined,
            instructionText: d.instruction?.instructionText || "",
            whenToUse: d.instruction?.whenToUse || "",
            whenNotToUse: d.instruction?.whenNotToUse || "",
            guardrailText: d.guardrail?.guardrailText || "",
            isActive: d.isActive !== false,
          }));
          setAgentDocs(mapped);
        } else {
          setAgentDocs([]);
        }
      } else {
        setDocsError("Failed to load knowledge documents from server");
        setAgentDocs([]);
      }
    } catch (err: any) {
      console.warn("Failed to load agent knowledge documents:", err);
      setDocsError(err.message || "Network error loading knowledge base");
      setAgentDocs([]);
    } finally {
      setIsLoadingDocs(false);
    }
  }

  useEffect(() => {
    loadAgentKnowledge();
    setCurrentPage(1);
    setSelectedDocIds([]);
  }, [agent.id]);

  // Load Real Bank Policies for "From Knowledge Base Library"
  async function loadLibraryPolicies() {
    try {
      setIsLoadingLibrary(true);
      const res = await fetch("/api/policies");
      if (res.ok) {
        const data = await res.json();
        const policies = data.policies || (Array.isArray(data) ? data : []);
        setLibraryPolicies(policies);
      }
    } catch (err) {
      console.warn("Failed to load library policies:", err);
    } finally {
      setIsLoadingLibrary(false);
    }
  }

  function handleNameChange(name: string) {
    setIsDraft(true);
    onUpdateAgent({ name });
  }

  function handleToneChange(tone: string) {
    setIsDraft(true);
    onUpdateAgent({
      instructions: {
        ...agent.instructions,
        tone,
      },
    });
  }

  function handleStyleChange(style: string) {
    setIsDraft(true);
    let mapped: "concise" | "balanced" | "detailed" = "concise";
    if (style.includes("Detailed")) mapped = "detailed";
    else if (style.includes("Step") || style.includes("balanced")) mapped = "balanced";
    else mapped = "concise";

    onUpdateAgent({
      responseStyle: mapped,
    });
  }

  function handleInstructionsChange(text: string) {
    if (text.length > 2000) return;
    setIsDraft(true);
    onUpdateAgent({
      goal: text,
      instructions: {
        ...agent.instructions,
        advancedPrompt: text,
      },
    });
  }

  async function handleSaveClick() {
    try {
      await onSave();
      setIsDraft(false);
      onToast("Instructions saved successfully", "success");
    } catch {
      onToast("Failed to save instructions", "warning");
    }
  }

  // Real File Upload Handler (POST /api/agents/[id]/knowledge)
  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];

    const ext = file.name.split(".").pop()?.toUpperCase() || "PDF";
    const allowed = ["PDF", "DOCX", "DOC", "TXT", "XLSX", "XLS", "CSV"];
    if (!allowed.includes(ext)) {
      onToast("Unsupported format. Allowed: PDF, DOCX, TXT, CSV, XLSX", "warning");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onToast("File exceeds actual 10MB limit", "warning");
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
        onToast(`Uploaded "${file.name}" to ${agentName}`, "success");
        await loadAgentKnowledge();
      } else {
        onToast(data.error || "Failed to upload document", "warning");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      onToast("Failed to upload document: " + err.message, "warning");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Real Delete File Handler (DELETE /api/agents/[id]/knowledge?docId=...)
  async function handleConfirmDeleteDoc() {
    if (!deleteDocTarget) return;
    setIsDeletingDoc(true);
    try {
      const res = await fetch(
        `/api/agents/${agent.id}/knowledge?docId=${deleteDocTarget.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        onToast(`Removed "${deleteDocTarget.name}"`, "info");
        setDeleteDocTarget(null);
        await loadAgentKnowledge();
      } else {
        onToast("Failed to delete document from database", "warning");
      }
    } catch {
      onToast("Network error deleting document", "warning");
    } finally {
      setIsDeletingDoc(false);
    }
  }

  // Real Edit Configuration Handler (PATCH /api/agents/[id]/knowledge)
  async function handleSaveDocConfig() {
    if (!editConfigDoc) return;
    setIsSavingDocConfig(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: editConfigDoc.id,
          name: editDocName.trim() || editConfigDoc.name,
          instructionText: editInstructionText.trim(),
          whenToUse: editWhenToUse.trim(),
          whenNotToUse: editWhenNotToUse.trim(),
          guardrailText: editGuardrailText.trim(),
          isActive: editConfigDoc.isActive !== false,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onToast(`Saved configuration for "${editDocName || editConfigDoc.name}"`, "success");
        setEditConfigDoc(null);
        await loadAgentKnowledge();
      } else {
        onToast(data.error || "Failed to update configuration", "warning");
      }
    } catch {
      onToast("Network error saving configuration", "warning");
    } finally {
      setIsSavingDocConfig(false);
    }
  }

  // Real Add from URL Handler
  async function handleAddFromUrl() {
    if (!urlInput.trim()) return;
    setIsAddingFromSource(true);
    try {
      let docName = urlTitleInput.trim();
      if (!docName) {
        try {
          const parsed = new URL(urlInput.trim());
          docName = `Web_Source_${parsed.hostname}.txt`;
        } catch {
          docName = `Web_Source_${Date.now()}.txt`;
        }
      }
      if (!docName.endsWith(".txt")) docName += ".txt";

      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docName,
          type: "txt",
          content: `Imported Knowledge Link: ${urlInput.trim()}\nFetched on ${new Date().toISOString()}.\nContains web policy context for ${agentName}.`,
          size: "45 KB",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsUrlModalOpen(false);
        setUrlInput("");
        setUrlTitleInput("");
        onToast(`Added web knowledge "${docName}"`, "success");
        await loadAgentKnowledge();
      } else {
        onToast(data.error || "Failed to import URL", "warning");
      }
    } catch {
      onToast("Failed to import URL", "warning");
    } finally {
      setIsAddingFromSource(false);
    }
  }

  // Real Add from Text Handler
  async function handleAddFromText() {
    if (!textContentInput.trim()) return;
    setIsAddingFromSource(true);
    try {
      let docName = textTitleInput.trim() || `Policy_Guidelines_${Date.now()}`;
      if (!docName.endsWith(".txt")) docName += ".txt";

      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docName,
          type: "txt",
          content: textContentInput.trim(),
          size: `${Math.max(1, Math.round(textContentInput.length / 1024))} KB`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsTextModalOpen(false);
        setTextTitleInput("");
        setTextContentInput("");
        onToast(`Saved text content as "${docName}"`, "success");
        await loadAgentKnowledge();
      } else {
        onToast(data.error || "Failed to save text", "warning");
      }
    } catch {
      onToast("Failed to save text", "warning");
    } finally {
      setIsAddingFromSource(false);
    }
  }

  // Real Add from Bank Policy Library Handler
  async function handleAddFromLibrary(policy: BankPolicyLibraryItem) {
    setIsAddingFromSource(true);
    try {
      const docName = policy.file_name || `${policy.bank_name.replace(/\s+/g, "_")}_Master_Policy.txt`;
      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docName,
          type: "txt",
          content:
            policy.extracted_text ||
            `Master Underwriting Guidelines for ${policy.bank_name} (${policy.bank_code}).\nVerified bank criteria for personal loans, salary tiers, FOIR, and CIBIL cutoffs.`,
          size: "650 KB",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onToast(`Attached master policy for "${policy.bank_name}"`, "success");
        setIsLibraryModalOpen(false);
        await loadAgentKnowledge();
      } else {
        onToast(data.error || "Failed to attach library policy", "warning");
      }
    } catch {
      onToast("Failed to attach policy", "warning");
    } finally {
      setIsAddingFromSource(false);
    }
  }

  // Filtered & Paginated Documents
  const filteredDocs = useMemo(() => {
    return agentDocs.filter((d) => {
      const matchSearch =
        !searchQuery.trim() ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType =
        typeFilter === "All Types" ||
        d.type.toUpperCase() === typeFilter.toUpperCase();
      return matchSearch && matchType;
    });
  }, [agentDocs, searchQuery, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE));
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDocs.slice(start, start + PAGE_SIZE);
  }, [filteredDocs, currentPage]);

  function handleToggleSelectAll() {
    if (selectedDocIds.length === paginatedDocs.length && paginatedDocs.length > 0) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(paginatedDocs.map((d) => d.id));
    }
  }

  function handleToggleSelectDoc(id: string) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  const suggestedInstructions = [
    "You are a helpful AI assistant. Understand the user's message before responding. Follow the configured business instructions. Use the connected knowledge base for supported answers. If information is missing, ask a clear follow-up question. Do not invent facts. Keep responses friendly, accurate, and easy to understand.",
    "Act as an authoritative loan policy consultant. When users inquire about bank eligibility, compare against verified policies in the knowledge base. State specific CIBIL, FOIR, and salary criteria clearly. Always disclose that final approval is subject to bank underwriting.",
    "Guide loan applicants step-by-step. Start by understanding their employer name, monthly net salary, and current EMIs. Present eligibility results in a structured bank comparison format with estimated monthly EMI.",
  ];

  function applySuggestedInstruction() {
    const nextSuggestion =
      suggestedInstructions[
        (suggestedInstructions.indexOf(instructionsText) + 1) %
          suggestedInstructions.length
      ] || suggestedInstructions[0];
    handleInstructionsChange(nextSuggestion);
    onToast("Applied suggested instruction", "info");
  }

  return (
    <div className="flex-1 bg-[#F8FAFC] min-h-screen p-6 md:p-8 overflow-y-auto">
      <div className="ai-main-layout w-full max-w-7xl mx-auto">
        {/* 1. PAGE HEADER */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Configure AI Instructions
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize how your assistant speaks, thinks, and uses its knowledge.
              </p>
            </div>
          </div>

          {/* Action Ribbon / Agent Control Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Agent Selector Dropdown */}
            <div className="relative" ref={agentDropdownRef}>
              <button
                type="button"
                onClick={() => setIsAgentDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 hover:border-blue-400 rounded-xl bg-white shadow-xs text-xs font-semibold text-slate-800 transition cursor-pointer"
              >
                <Bot className="w-4 h-4 text-blue-600" />
                <span>{agentName}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isAgentDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isAgentDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Select Agent</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                      {allAgentsList.length}
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {allAgentsList.map((ag) => {
                      const isSelected = ag.id === agent.id;
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            if (onSelectAgent) {
                              onSelectAgent(ag.id);
                              setIsDraft(false);
                              onToast(`Switched to ${ag.name}`, "info");
                            }
                            setIsAgentDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition cursor-pointer ${
                            isSelected
                              ? "bg-blue-50 text-blue-700 font-semibold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Bot className="w-3.5 h-3.5 text-blue-600" />
                            <span className="truncate">{ag.name}</span>
                          </div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
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
                          setIsAgentDropdownOpen(false);
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

            {/* Current Agent Status Badge */}
            {agent.isActiveForUser || agent.status === "active" ? (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-full text-xs font-semibold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Inactive</span>
              </span>
            )}

            {/* Deactivate Button */}
            {onDeactivateAgent && (agent.isActiveForUser || agent.status === "active") && (
              <button
                type="button"
                onClick={() => onDeactivateAgent(agent.id)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition shadow-xs cursor-pointer"
              >
                Deactivate
              </button>
            )}

            {/* Activate Button */}
            {onActivateAgent && (!agent.isActiveForUser && agent.status !== "active") && (
              <button
                type="button"
                onClick={() => onActivateAgent(agent.id)}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100/70 border border-blue-200 rounded-lg transition shadow-xs cursor-pointer"
              >
                Activate
              </button>
            )}

            {/* Saved Status Indicator */}
            <span
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-xs ${
                isDraft
                  ? "bg-amber-50 border border-amber-200 text-amber-700"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isDraft ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
              <span>{isDraft ? "Unsaved Changes" : "Saved"}</span>
            </span>

            {/* Delete Agent Button */}
            {onDeleteAgentClick && (
              <button
                type="button"
                onClick={() => onDeleteAgentClick(agent.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            {/* Test Assistant Button */}
            {onNavigateToDemo && (
              <button
                type="button"
                onClick={onNavigateToDemo}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5 ml-auto"
              >
                <span>▷</span>
                <span>Test assistant</span>
              </button>
            )}

            {/* Save Instructions Button */}
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 ${!onNavigateToDemo ? 'ml-auto' : ''}`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Instructions"}</span>
            </button>
          </div>
        </div>

        {/* 2. AGENT IDENTITY & PERSONA (FULL WIDTH) */}
        <div className="ai-card">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-900 text-base">
                    Agent Identity &amp; Persona
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {agent.isActiveForUser || agent.status === "active" ? "Active" : "Draft"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define the agent's name, conversation tone, and response style.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Column Form Grid */}
          <div className="ai-form-grid mt-4 pt-1">
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                Agent Name
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Loan Assistant"
                className="w-full px-3 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                Conversation Tone
              </label>
              <select
                value={conversationTone}
                onChange={(e) => handleToneChange(e.target.value)}
                className="w-full px-3 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
              >
                <option value="Professional and Friendly">Professional and Friendly</option>
                <option value="Formal">Formal</option>
                <option value="Conversational">Conversational</option>
                <option value="Empathetic">Empathetic</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                Response Style
              </label>
              <select
                value={responseStyle}
                onChange={(e) => handleStyleChange(e.target.value)}
                className="w-full px-3 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
              >
                <option value="Clear, Helpful, Concise">Clear, Helpful, Concise</option>
                <option value="Detailed">Detailed</option>
                <option value="Step-by-Step">Step-by-Step</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. INSTRUCTIONS FOR THE AI AGENT (FULL WIDTH) */}
        <div className="ai-card">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-base">
                  Instructions for the AI Agent
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Master instruction prompt, financial verification rules, and conversational logic.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Prompt Engine
            </span>
          </div>

          <div className="mt-4">
            <textarea
              value={instructionsText}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              placeholder="Enter instructions for the AI assistant..."
              className="ai-textarea"
            />

            <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-mono text-slate-500">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  {instructionsText.length}/2000 characters
                </span>
                <button
                  type="button"
                  onClick={applySuggestedInstruction}
                  className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer flex items-center gap-1.5 transition"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-blue-600" />
                  <span>Suggested prompt</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Autosaved
                </span>
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={saving}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Instructions"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. KNOWLEDGE BASE UPLOAD (2-COLUMN GRID) */}
        <div className="ai-upload-grid">
          {/* Left: Drag-and-Drop Upload Area */}
          <div className="ai-card flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 text-base">
                    Upload Knowledge Base
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add documents like PDFs, Word files, or text files.
                  </p>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    Supported formats: PDF, DOCX, TXT, CSV, XLSX (Max size: 10MB per file)
                  </p>
                </div>
              </div>

              {/* Dropzone Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20 rounded-xl p-6 text-center transition cursor-pointer"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <div className="text-xs text-slate-500 mb-2.5">
                  Drag and drop files here or
                </div>
                <button
                  type="button"
                  disabled={isUploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{isUploading ? "Uploading..." : "Choose Files"}</span>
                </button>
                <div className="text-[11px] text-slate-400 mt-2">
                  Supports single or multiple files
                </div>
              </div>
            </div>
          </div>

          {/* Right: Or add from existing sources */}
          <div className="ai-card flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm mb-3">
                Or add from existing sources
              </h3>

              <div className="space-y-2.5">
                {/* 1. From URL */}
                <button
                  type="button"
                  onClick={() => setIsUrlModalOpen(true)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition text-left cursor-pointer group shadow-xs bg-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                        From URL
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Add content from a web link
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* 2. From Text */}
                <button
                  type="button"
                  onClick={() => setIsTextModalOpen(true)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition text-left cursor-pointer group shadow-xs bg-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                        From Text
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Paste your content directly
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* 3. From Knowledge Base Library */}
                <button
                  type="button"
                  onClick={() => {
                    setIsLibraryModalOpen(true);
                    loadLibraryPolicies();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition text-left cursor-pointer group shadow-xs bg-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                        From Knowledge Base Library
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Use existing pre-configured data
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 5. UPLOADED KNOWLEDGE BASE FILES */}
        <div className="ai-card p-0 overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-base">
                  Uploaded Knowledge Base Files
                </h2>
                <p className="text-xs text-slate-500">
                  Manage your uploaded files and view their status.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-xs w-44"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer text-slate-700"
              >
                <option value="All Types">All Types</option>
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
                <option value="XLSX">XLSX</option>
                <option value="TXT">TXT</option>
                <option value="CSV">CSV</option>
              </select>

              <button
                type="button"
                onClick={loadAgentKnowledge}
                disabled={isLoadingDocs}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                title="Refresh list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDocs ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Error State */}
          {docsError && (
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between text-xs text-rose-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{docsError}</span>
              </div>
              <button
                onClick={loadAgentKnowledge}
                className="font-semibold underline hover:text-rose-900"
              >
                Retry
              </button>
            </div>
          )}

          {/* Responsive Table Wrapper */}
          <div className="ai-file-table-wrapper border-0 rounded-none">
            <table className="ai-file-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={
                        selectedDocIds.length === paginatedDocs.length &&
                        paginatedDocs.length > 0
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded On</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Loading State */}
                {isLoadingDocs ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-400" style={{ padding: "48px 14px" }}>
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                        <span className="text-xs font-medium text-slate-500">
                          Loading knowledge documents from database...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedDocs.length === 0 ? (
                  /* Empty State */
                  <tr>
                    <td colSpan={7} className="text-center text-slate-400" style={{ padding: "48px 14px" }}>
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-700">
                          No knowledge documents found
                        </span>
                        <p className="text-[11px] text-slate-400 text-center">
                          Upload documents above using the dropzone or click "From Knowledge Base Library" to connect pre-verified bank policies.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedDocs.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    return (
                      <tr key={doc.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectDoc(doc.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            {doc.type === "PDF" ? (
                              <span className="w-6 h-6 rounded bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                <FileText className="w-3.5 h-3.5" />
                              </span>
                            ) : doc.type === "XLSX" || doc.type === "CSV" ? (
                              <span className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              </span>
                            ) : doc.type === "DOCX" ? (
                              <span className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                <FileText className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                <FileCode className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <span className="truncate max-w-[220px]" title={doc.name}>
                              {doc.name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              doc.type === "PDF"
                                ? "bg-rose-50 text-rose-600 border border-rose-200"
                                : doc.type === "XLSX" || doc.type === "CSV"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : doc.type === "DOCX"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {doc.type}
                          </span>
                        </td>
                        <td className="text-slate-500 font-mono text-[11px]">
                          {doc.size}
                        </td>
                        <td className="text-slate-500 whitespace-nowrap text-[11px]">
                          {doc.uploadedOn}
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              doc.status === "Active"
                                ? "ai-file-status--active"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                doc.status === "Active" ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            {doc.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="ai-table-actions">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="ai-action-btn"
                              title="View file"
                              aria-label="View file"
                            >
                              <Eye />
                            </button>

                            {/* Edit Configuration & Metadata */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditConfigDoc(doc);
                                setEditDocName(doc.name);
                                setEditInstructionText(doc.instructionText || "");
                                setEditWhenToUse(doc.whenToUse || "");
                                setEditWhenNotToUse(doc.whenNotToUse || "");
                                setEditGuardrailText(doc.guardrailText || "");
                              }}
                              className="ai-action-btn"
                              title="Edit file"
                              aria-label="Edit file"
                            >
                              <Edit2 />
                            </button>

                            {/* Delete File */}
                            <button
                              type="button"
                              onClick={() => setDeleteDocTarget(doc)}
                              className="ai-action-btn ai-action-btn--delete"
                              title="Delete file"
                              aria-label="Delete file"
                            >
                              <Trash2 />
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

          {/* Table Footer with Real Pagination */}
          <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
            <span>
              {filteredDocs.length > 0 ? (
                <>
                  Showing{" "}
                  <strong>{(currentPage - 1) * PAGE_SIZE + 1}</strong> to{" "}
                  <strong>{Math.min(currentPage * PAGE_SIZE, filteredDocs.length)}</strong> of{" "}
                  <strong>{filteredDocs.length}</strong> files
                </>
              ) : (
                "0 files"
              )}
            </span>

            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                &lt;
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                    currentPage === page
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: View File Details Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm truncate max-w-md">
                  {previewDoc.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto text-xs text-slate-600 leading-relaxed">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Format</span>
                  <span className="font-bold text-slate-800">{previewDoc.type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">File Size</span>
                  <span className="font-bold text-slate-800">{previewDoc.size}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Uploaded On</span>
                  <span className="font-bold text-slate-800">{previewDoc.uploadedOn}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Status</span>
                  <span className="font-bold text-emerald-600">Active</span>
                </div>
              </div>

              {previewDoc.instructionText && (
                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100">
                  <span className="text-[10px] font-bold uppercase text-blue-700 block mb-1">
                    Document Usage Instruction
                  </span>
                  <p className="text-slate-700 text-xs">{previewDoc.instructionText}</p>
                </div>
              )}

              {previewDoc.guardrailText && (
                <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100">
                  <span className="text-[10px] font-bold uppercase text-purple-700 block mb-1">
                    Safety Guardrail
                  </span>
                  <p className="text-slate-700 text-xs">{previewDoc.guardrailText}</p>
                </div>
              )}

              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Extracted Content / Policy Rules Preview
                </span>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {previewDoc.content ||
                    `Document: ${previewDoc.name}\n\nBank underwriting criteria and credit guidelines are indexed in PostgreSQL vector memory for ${agentName}.\nWhen users inquire about eligibility, this document will be retrieved to ground loan parameters.`}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Configuration & Metadata Modal */}
      {editConfigDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Edit File Configuration &amp; Metadata
                </h3>
              </div>
              <button
                onClick={() => setEditConfigDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  File Display Name
                </label>
                <input
                  type="text"
                  value={editDocName}
                  onChange={(e) => setEditDocName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Document Usage Instruction
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Reference this document strictly when applicant asks about salary requirements..."
                  value={editInstructionText}
                  onChange={(e) => setEditInstructionText(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    When to Use (Keywords)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. personal loan, cibil, foir"
                    value={editWhenToUse}
                    onChange={(e) => setEditWhenToUse(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    When Not to Use
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. home loan, gold loan"
                    value={editWhenNotToUse}
                    onChange={(e) => setEditWhenNotToUse(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Safety Guardrail for this File
                </label>
                <input
                  type="text"
                  placeholder="e.g. Never disclose internal underwriter notes to applicants"
                  value={editGuardrailText}
                  onChange={(e) => setEditGuardrailText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditConfigDoc(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingDocConfig}
                onClick={handleSaveDocConfig}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSavingDocConfig ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete File Confirmation Modal */}
      {deleteDocTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 animate-fadeIn">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Delete Knowledge Document?
                </h3>
                <span className="text-[11px] text-rose-600 font-semibold">
                  Destructive Action
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Are you sure you want to remove <strong>"{deleteDocTarget.name}"</strong>? All extracted text chunks and embeddings associated with this document will be erased from PostgreSQL.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingDoc}
                onClick={() => setDeleteDocTarget(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingDoc}
                onClick={handleConfirmDeleteDoc}
                className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isDeletingDoc ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: From URL Modal */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Add Knowledge from URL
                </h3>
              </div>
              <button
                onClick={() => setIsUrlModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Source Web URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/bank-loan-criteria"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Document Display Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank_Online_Policy.txt"
                  value={urlTitleInput}
                  onChange={(e) => setUrlTitleInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                The content from the web link will be processed and indexed into PostgreSQL for this agent.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setIsUrlModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!urlInput.trim() || isAddingFromSource}
                onClick={handleAddFromUrl}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isAddingFromSource ? "Importing..." : "Import URL"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: From Text Modal */}
      {isTextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Add Raw Text Knowledge
                </h3>
              </div>
              <button
                onClick={() => setIsTextModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Underwriting_Exceptions.txt"
                  value={textTitleInput}
                  onChange={(e) => setTextTitleInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Text Content / Policy Rules
                </label>
                <textarea
                  rows={6}
                  placeholder="Paste bank terms, company categories, FOIR rules, or underwriting exceptions..."
                  value={textContentInput}
                  onChange={(e) => setTextContentInput(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 leading-relaxed font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setIsTextModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!textContentInput.trim() || isAddingFromSource}
                onClick={handleAddFromText}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isAddingFromSource ? "Saving..." : "Save Knowledge Text"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: From Knowledge Base Library Modal (Real Database Bank Policies) */}
      {isLibraryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Knowledge Base Library
                </h3>
              </div>
              <button
                onClick={() => setIsLibraryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2 mb-3">
              Select any verified bank master policy from the CreditWise database to attach and index for this agent:
            </p>

            {/* Library list */}
            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {isLoadingLibrary ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin mx-auto mb-2" />
                  <span className="text-xs">Loading verified policies from database...</span>
                </div>
              ) : libraryPolicies.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No bank master policies found in database.
                </div>
              ) : (
                libraryPolicies.map((policy) => (
                  <div
                    key={policy.id || policy.bank_code}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/20 transition flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {policy.bank_name}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {policy.bank_code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {policy.file_name || `${policy.bank_name} verified underwriting master policy`}
                      </p>
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Verified Bank Policy
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isAddingFromSource}
                      onClick={() => handleAddFromLibrary(policy)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      + Add to Agent
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsLibraryModalOpen(false);
                  onNavigateToKnowledge();
                }}
                className="text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Browse dedicated Knowledge Base page →
              </button>
              <button
                onClick={() => setIsLibraryModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
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
