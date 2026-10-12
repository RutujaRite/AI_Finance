// components/agent-studio/AiInstructionsView.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  User,
  FileText,
  BookOpen,
  Zap,
  Save,
  CheckCircle,
  Eye,
  ArrowRight,
  Sparkles,
  X,
  Lightbulb,
  UploadCloud,
  Upload,
  Check,
  Trash2,
  Paperclip,
  Bot,
  ChevronDown,
  Plus,
} from "lucide-react";
import { Agent } from "@/lib/agent-studio/types";

interface AgentDocItem {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedOn: string;
}

interface AiInstructionsViewProps {
  agent: Agent;
  agents?: Agent[];
  onSelectAgent?: (agentId: string) => void;
  onUpdateAgent: (updates: Partial<Agent>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  onNavigateToKnowledge: () => void;
  onToast: (msg: string, type?: "success" | "info" | "warning") => void;
  onCreateAgentClick?: () => void;
  onActivateAgent?: (agentId: string) => Promise<void>;
  onDeactivateAgent?: (agentId: string) => Promise<void>;
  onDeleteAgentClick?: (agentId: string) => void;
}

export default function AiInstructionsView({
  agent,
  agents = [],
  onSelectAgent,
  onUpdateAgent,
  onSave,
  saving,
  onNavigateToKnowledge,
  onToast,
  onCreateAgentClick,
  onActivateAgent,
  onDeactivateAgent,
  onDeleteAgentClick,
}: AiInstructionsViewProps) {
  const [isDraft, setIsDraft] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [agentDocs, setAgentDocs] = useState<AgentDocItem[]>([]);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
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

  // Form states based on agent object
  const agentName = agent.name || "CreditWise Assistant";
  const conversationTone =
    agent.instructions?.tone || "Professional and friendly";
  const responseStyle =
    agent.responseStyle === "detailed"
      ? "Detailed and explanatory"
      : "Clear, helpful, concise";

  const defaultPrompt =
    "You are a helpful AI assistant. Understand the user's message before responding. Follow the configured business instructions. Use the connected knowledge base for supported answers. If information is missing, ask a clear follow-up question. Do not invent facts. Keep responses friendly, accurate, and easy to understand.";

  const instructionsText =
    agent.instructions?.advancedPrompt && agent.instructions.advancedPrompt.length > 100
      ? agent.instructions.advancedPrompt
      : defaultPrompt;

  const isLiveMode = agent.operationalMode !== "task_focused"; // Live AI vs Demo

  // Fetch documents specifically for this agent (supports PDF, DOCX, XLSX, CSV, TXT)
  useEffect(() => {
    async function loadAgentKnowledge() {
      try {
        const res = await fetch(`/api/agents/${agent.id}/knowledge`);
        if (res.ok) {
          const data = await res.json();
          if (data.documents && Array.isArray(data.documents)) {
            const mapped: AgentDocItem[] = data.documents
              .map((d: any) => ({
                id: d.id,
                name: d.name,
                type: (d.fileType || "PDF").toUpperCase(),
                size: d.fileSize || "1.2 MB",
                uploadedOn: new Date(d.uploadedAt || Date.now()).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              }));
            setAgentDocs(mapped);
          }
        }
      } catch (err) {
        console.warn("Failed to load agent knowledge documents:", err);
      }
    }
    loadAgentKnowledge();
  }, [agent.id]);

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
    let mapped: "concise" | "balanced" | "detailed" = "balanced";
    if (style.includes("concise") || style.includes("Clear")) mapped = "concise";
    else if (style.includes("Detailed")) mapped = "detailed";
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

  function handleSetRuntimeMode(mode: "live" | "demo") {
    setIsDraft(true);
    onUpdateAgent({
      operationalMode: mode === "live" ? "standard" : "task_focused",
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

  // Handle Document Upload specifically for this Agent
  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];

    const ext = file.name.split(".").pop()?.toUpperCase() || "PDF";
    const allowed = ["PDF", "DOCX", "DOC", "TXT", "XLSX", "XLS", "CSV", "JSON"];
    if (!allowed.includes(ext)) {
      onToast("Unsupported format. Allowed: PDF, DOCX, XLSX, CSV, TXT", "warning");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onToast("File exceeds max 10MB limit", "warning");
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
        const newDoc: AgentDocItem = {
          id: data.document?.id || `doc-${Date.now()}`,
          name: file.name,
          type: ext,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          uploadedOn: new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        };
        setAgentDocs((prev) => [newDoc, ...prev]);
        onToast(`Uploaded "${file.name}" to ${agentName}`, "success");
      } else {
        const fallbackDoc: AgentDocItem = {
          id: `doc-${Date.now()}`,
          name: file.name,
          type: ext,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          uploadedOn: new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        };
        setAgentDocs((prev) => [fallbackDoc, ...prev]);
        onToast(`Attached "${file.name}" to ${agentName}`, "success");
      }
    } catch (err) {
      console.error("Upload error:", err);
      onToast("Failed to upload document", "warning");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteDoc(docId: string, docName: string) {
    if (confirm(`Remove "${docName}" from ${agentName}?`)) {
      setAgentDocs((prev) => prev.filter((d) => d.id !== docId));
      try {
        await fetch(`/api/agents/${agent.id}/knowledge?docId=${docId}`, {
          method: "DELETE",
        });
      } catch {}
      onToast(`Removed "${docName}"`, "info");
    }
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Action Bar (Draft indicator + Save button) */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Configure AI Instructions
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Define how your AI assistant responds, behaves, and uses its knowledge.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Select Agent Dropdown */}
            <div className="relative" ref={agentDropdownRef}>
              <button
                type="button"
                onClick={() => setIsAgentDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 hover:border-blue-300 rounded-lg bg-white shadow-xs text-xs font-semibold text-slate-800 transition cursor-pointer"
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
                <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Select Agent to Configure</span>
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
                              setIsDraft(false);
                              onToast(`Configuring instructions for ${aDisplayName}`, "info");
                            }
                            setIsAgentDropdownOpen(false);
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
                                {ag.status || "draft"} • {ag.instructions?.agentRole || "AI Assistant"}
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

            {/* Activate / Active Status Badge & Actions */}
            {agent.isActiveForUser || agent.status === "active" ? (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active in Assistant</span>
                </span>
                {onDeactivateAgent && (
                  <button
                    type="button"
                    onClick={() => onDeactivateAgent(agent.id)}
                    className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                    title="Deactivate and revert to standard assistant"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            ) : (
              onActivateAgent && (
                <button
                  type="button"
                  onClick={() => onActivateAgent(agent.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                  title="Activate this agent to steer conversations in the AI Assistant"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Activate for AI Assistant</span>
                </button>
              )
            )}

            {/* Draft status indicator */}
            <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isDraft ? "bg-amber-400" : "bg-emerald-500"
                }`}
              />
              <span className={isDraft ? "text-amber-600" : "text-emerald-700"}>
                {isDraft ? "Unsaved Changes" : "Saved"}
              </span>
            </div>

            {/* Delete Agent Button */}
            {onDeleteAgentClick && (
              <button
                type="button"
                onClick={() => onDeleteAgentClick(agent.id)}
                className="flex items-center gap-1 px-2.5 py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                title="Delete agent and its knowledge base"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            {/* Save Instructions Button */}
            <button
              onClick={handleSaveClick}
              disabled={saving}
              style={{ backgroundColor: "#2563EB" }}
              className="flex items-center gap-2 px-4 py-2 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Instructions"}</span>
            </button>
          </div>
        </div>

        {/* Section 1: Agent Identity Card (AI Model Blue Ribbon Style) */}
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
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1e3a8a" }}>
                  Agent Identity &amp; Persona
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: 500 }}>
                  Assistant naming, conversation tone, and response output style
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
              Active Persona
            </span>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Field 1: Agent Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="CreditWise Assistant"
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* Field 2: Conversation Tone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Conversation Tone
                </label>
                <select
                  value={conversationTone}
                  onChange={(e) => handleToneChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="Professional and friendly">
                    Professional and friendly
                  </option>
                  <option value="Warm and consultative">
                    Warm and consultative
                  </option>
                  <option value="Formal and direct">Formal and direct</option>
                  <option value="Empathetic and concise">
                    Empathetic and concise
                  </option>
                </select>
              </div>

              {/* Field 3: Response Style */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Response Style
                </label>
                <select
                  value={responseStyle}
                  onChange={(e) => handleStyleChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="Clear, helpful, concise">
                    Clear, helpful, concise
                  </option>
                  <option value="Detailed and explanatory">
                    Detailed and explanatory
                  </option>
                  <option value="Bullet-point summary">
                    Bullet-point summary
                  </option>
                  <option value="Step-by-step guidance">
                    Step-by-step guidance
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Instructions for the AI Agent Card (AI Model Purple Ribbon Style) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #ddd6fe",
            boxShadow: "0 4px 20px -2px rgba(139, 92, 246, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Header ribbon */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(124, 58, 237, 0.04) 100%)",
              padding: "16px 20px",
              borderBottom: "1px solid #ede9fe",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  background: "#7c3aed",
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
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#4c1d95" }}>
                  Instructions for the AI Agent
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#a78bfa", fontWeight: 500 }}>
                  Master instruction prompt, financial verification rules, and conversational logic
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
                background: "#f3e8ff",
                color: "#7c3aed",
                border: "1px solid #ddd6fe",
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              Prompt Engine
            </span>
          </div>

          <div className="p-6">
            <div>
              <textarea
                rows={6}
                value={instructionsText}
                onChange={(e) => handleInstructionsChange(e.target.value)}
                placeholder="Enter instructions for the AI assistant..."
                className="w-full p-3.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-purple-500 leading-relaxed resize-y shadow-xs"
              />

              <div className="flex items-center justify-between mt-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={applySuggestedInstruction}
                  className="flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-semibold transition cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Suggested instruction</span>
                </button>

                <span className="text-slate-400 font-mono text-[11px]">
                  {instructionsText.length}/2000
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: UPLOAD DOCUMENTS SECTION (AI Model Emerald Ribbon Style) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #bbf7d0",
            boxShadow: "0 4px 20px -2px rgba(16, 185, 129, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Header ribbon */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.04) 100%)",
              padding: "16px 20px",
              borderBottom: "1px solid #d1fae5",
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
                  background: "#059669",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <UploadCloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#064e3b" }}>
                  Upload Documents for {agentName}
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#34d399", fontWeight: 500 }}>
                  Ground agent responses with bank guidelines, loan policies, and category PDFs
                </span>
              </div>
            </div>

            <button
              onClick={onNavigateToKnowledge}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 rounded-lg transition cursor-pointer shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>View in Knowledge Base</span>
              <ArrowRight className="w-3 h-3 text-emerald-600" />
            </button>
          </div>

          <div className="p-6">
            {/* Upload Drop Area */}
            <div className="p-5 border border-dashed border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40 rounded-xl transition">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.docx,.doc,.txt,.xlsx,.xls"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      Upload documents to knowledge base
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Drag and drop your files here or select from computer
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    style={{ backgroundColor: "#059669" }}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-white" />
                    <span>{isUploading ? "Uploading..." : "Choose Files"}</span>
                  </button>
                </div>
              </div>

              {/* Supported formats note */}
              <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center gap-1.5 text-xs text-slate-600">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px]">
                  Supported formats: PDF, DOCX, TXT, XLSX (Max 10MB per file)
                </span>
              </div>
            </div>

            {/* Uploaded Documents List for This Agent */}
            {agentDocs.length > 0 && (
              <div className="mt-5 space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Uploaded Knowledge for this Agent ({agentDocs.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {agentDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-200 transition"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="as-badge as-badge-pdf text-[10px] py-0 px-1.5">
                          {doc.type}
                        </span>
                        <span className="text-xs font-medium text-slate-800 truncate" title={doc.name}>
                          {doc.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400">{doc.size}</span>
                        <button
                          onClick={() => handleDeleteDoc(doc.id, doc.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title="Remove document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Agent Runtime Mode Card (AI Model Amber Ribbon Style) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #fed7aa",
            boxShadow: "0 4px 20px -2px rgba(245, 158, 11, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Header ribbon */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.04) 100%)",
              padding: "16px 20px",
              borderBottom: "1px solid #ffedd5",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  background: "#d97706",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#7c2d12" }}>
                  Agent Runtime Engine Mode
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#fb923c", fontWeight: 500 }}>
                  Toggle live LLM reasoning versus fixed demonstration conversation
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
                background: isLiveMode ? "#dcfce7" : "#ffedd5",
                color: isLiveMode ? "#15803d" : "#c2410c",
                border: `1px solid ${isLiveMode ? "#bbf7d0" : "#fed7aa"}`,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: isLiveMode ? "#22c55e" : "#ea580c" }}></span>
              {isLiveMode ? "Live Engine" : "Demo Mode"}
            </span>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Live AI Assistant */}
              <div
                onClick={() => handleSetRuntimeMode("live")}
                className={`as-runtime-card flex items-start gap-3.5 ${
                  isLiveMode ? "selected" : ""
                }`}
              >
                <div className="mt-0.5">
                  <span
                    style={
                      isLiveMode
                        ? { borderColor: "#2563EB", backgroundColor: "#2563EB" }
                        : { borderColor: "#cbd5e1", backgroundColor: "#ffffff" }
                    }
                    className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                  >
                    {isLiveMode && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Live AI Assistant
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Uses the LLM and connected knowledge base to generate responses
                  </div>
                </div>
              </div>

              {/* Option 2: Fixed Demo */}
              <div
                onClick={() => handleSetRuntimeMode("demo")}
                className={`as-runtime-card flex items-start gap-3.5 ${
                  !isLiveMode ? "selected" : ""
                }`}
              >
                <div className="mt-0.5">
                  <span
                    style={
                      !isLiveMode
                        ? { borderColor: "#2563EB", backgroundColor: "#2563EB" }
                        : { borderColor: "#cbd5e1", backgroundColor: "#ffffff" }
                    }
                    className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                  >
                    {!isLiveMode && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Fixed Demo
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Runs a predefined demonstration conversation.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Status Bar matching screenshot 3 */}
        <div className="flex items-center justify-between pt-2 pb-6">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Changes are saved when you click Save Instructions</span>
          </div>

          <button
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>Preview Instructions</span>
          </button>
        </div>
      </div>

      {/* Preview Instructions Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Agent Instruction Preview
                </h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              <div>
                <span className="font-semibold text-slate-700">Identity:</span>{" "}
                <span className="text-slate-900 font-medium">{agentName}</span>{" "}
                ({conversationTone}, {responseStyle})
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">
                  Compiled System Prompt:
                </span>
                <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                  {`You are ${agentName}. Tone: ${conversationTone}. Style: ${responseStyle}.\n\nCore Instructions:\n${instructionsText}\n\nGrounding Rule:\nAlways ground loan policies against verified knowledge base documents. If criteria are missing, ask friendly clarifying questions.`}
                </pre>
              </div>

              <div>
                <span className="font-semibold text-slate-700">Connected Knowledge:</span>{" "}
                <span className="text-slate-900">
                  {agentDocs.length} document(s) attached
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-700">Runtime:</span>{" "}
                <span className="text-slate-900">
                  {isLiveMode ? "Live AI Assistant (LLM + RAG)" : "Fixed Demo Mode"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
