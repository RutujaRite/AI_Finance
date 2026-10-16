// components/agent-studio/CreateAgentView.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Save,
  UploadCloud,
  FileText,
  Check,
  MoreVertical,
  Trash2,
  Send,
  Bot,
  AlertCircle,
  Menu,
  Info,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Agent, KnowledgeDocumentRecord, UserSubscriptionState } from "@/lib/agent-studio/types";

interface CreateAgentViewProps {
  currentAgent: Agent;
  subscription: UserSubscriptionState;
  onUpdateAgent: (updates: Partial<Agent>) => void;
  onSaveChanges: () => Promise<void>;
  saving: boolean;
  onToggleMobileNav?: () => void;
  onOpenUpgrade?: () => void;
  onToast?: (message: string, type?: "success" | "info" | "warning") => void;
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  time?: string;
}

export default function CreateAgentView({
  currentAgent,
  subscription,
  onUpdateAgent,
  onSaveChanges,
  saving,
  onToggleMobileNav,
  onOpenUpgrade,
  onToast,
}: CreateAgentViewProps) {
  // 1. Agent Configuration Form State
  const [agentName, setAgentName] = useState<string>(
    currentAgent?.name || "Customer Support Helper"
  );

  // 2. Conversation Tone Options
  const toneOptions = [
    "Friendly and professional",
    "Professional",
    "Friendly and casual",
    "Formal",
    "Technical",
  ] as const;

  const [tone, setTone] = useState<string>(() => {
    const existing = currentAgent?.instructions?.tone || "";
    const matched = toneOptions.find((t) =>
      existing.toLowerCase().includes(t.toLowerCase())
    );
    return matched || "Friendly and professional";
  });

  // 3. Instructions (up to 2000 chars)
  const [instructions, setInstructions] = useState<string>(() => {
    return (
      currentAgent?.instructions?.additionalInstructions ||
      currentAgent?.instructions?.businessDescription ||
      currentAgent?.goal ||
      "For bank-specific values (minimum salary, cut-off CIBIL scores, LTV ratios, interest rates), rely strictly on verified knowledge base files. For general financial definitions or industry acronyms (e.g., FOIR, LTV, CIBIL, EMI), provide clear standard financial definitions while noting that exact percentage thresholds depend on individual lender policy."
    );
  });

  // 4. Agent Mode (Connected assistant vs Demo mode)
  const [agentMode, setAgentMode] = useState<"connected" | "demo">(() => {
    if (currentAgent?.operationalMode === "task_focused" || currentAgent?.modes?.conversations === false) {
      return "demo";
    }
    return "connected";
  });

  // 5. Knowledge Base Documents State
  const [documents, setDocuments] = useState<KnowledgeDocumentRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 6. Agent Preview Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "preview-1",
      role: "assistant",
      text: "Hi! I can help answer questions using your instructions and uploaded documents.",
    },
    {
      id: "preview-2",
      role: "user",
      text: "What is your return policy?",
    },
    {
      id: "preview-3",
      role: "assistant",
      text: "I'll check the available knowledge base and give you a clear answer.",
    },
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [hasTestedChat, setHasTestedChat] = useState<boolean>(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // 7. Save Status Tracking
  const [isSaved, setIsSaved] = useState<boolean>(true);

  // Sync state when currentAgent changes
  useEffect(() => {
    if (currentAgent) {
      setAgentName(currentAgent.name || "Customer Support Helper");
      if (currentAgent.instructions?.tone) {
        const matched = toneOptions.find((t) =>
          currentAgent.instructions.tone.toLowerCase().includes(t.toLowerCase())
        );
        if (matched) setTone(matched);
      }
      if (
        currentAgent.instructions?.additionalInstructions ||
        currentAgent.instructions?.businessDescription
      ) {
        setInstructions(
          currentAgent.instructions.additionalInstructions ||
            currentAgent.instructions.businessDescription ||
            ""
        );
      }
      if (currentAgent.operationalMode) {
        setAgentMode(
          currentAgent.operationalMode === "standard" || currentAgent.modes?.conversations !== false
            ? "connected"
            : "demo"
        );
      }
      loadDocuments(currentAgent.id);
    }
  }, [currentAgent?.id]);

  // Load documents from backend API
  async function loadDocuments(agentId: string) {
    try {
      setLoadingDocs(true);
      const res = await fetch(`/api/agents/${agentId}/knowledge`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.documents)) {
          setDocuments(data.documents);
        }
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  }

  // Handle Form changes and track dirty state
  function handleNameChange(val: string) {
    setAgentName(val);
    setIsSaved(false);
    onUpdateAgent({ name: val });
  }

  function handleToneChange(val: string) {
    setTone(val);
    setIsSaved(false);
    onUpdateAgent({
      instructions: {
        ...currentAgent.instructions,
        tone: val,
      },
    });
  }

  function handleInstructionsChange(val: string) {
    if (val.length <= 10000) {
      setInstructions(val);
      setIsSaved(false);
      onUpdateAgent({
        instructions: {
          ...currentAgent.instructions,
          additionalInstructions: val,
          businessDescription: val,
        },
        goal: val,
      });
    }
  }

  function handleModeChange(mode: "connected" | "demo") {
    setAgentMode(mode);
    setIsSaved(false);
    onUpdateAgent({
      operationalMode: mode === "connected" ? "standard" : "rag_focused",
      modes: {
        ...currentAgent.modes,
        conversations: mode === "connected",
        aiAgentMode: true,
      },
    });
  }

  // Handle Save Agent Action
  async function handleSaveAgent() {
    try {
      onUpdateAgent({
        name: agentName,
        instructions: {
          ...currentAgent.instructions,
          tone,
          additionalInstructions: instructions,
          businessDescription: instructions,
        },
        goal: instructions,
        operationalMode: agentMode === "connected" ? "standard" : "rag_focused",
        modes: {
          ...currentAgent.modes,
          conversations: agentMode === "connected",
          aiAgentMode: true,
        },
      });
      await onSaveChanges();
      setIsSaved(true);
      if (onToast) onToast("✓ Agent configuration saved successfully", "success");
    } catch (err) {
      console.error("Failed to save agent:", err);
    }
  }

  // Handle File Upload (Drag and Drop or Browse)
  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadError(null);

    // Validate size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError("File size exceeds 10MB limit. Please choose a smaller file.");
      return;
    }

    // Validate format: PDF, DOCX, TXT
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "docx", "txt", "doc"].includes(ext)) {
      setUploadError("Unsupported format. Please upload PDF, DOCX, or TXT files.");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/agents/${currentAgent.id}/knowledge`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.document) {
          setDocuments((prev) => [data.document, ...prev]);
        } else {
          await loadDocuments(currentAgent.id);
        }
        setIsSaved(false);
        if (onToast) onToast(`✓ Uploaded "${file.name}" successfully`, "success");
      } else {
        if (data.limitReached && onOpenUpgrade) {
          onOpenUpgrade();
        } else {
          setUploadError(data.error || "Failed to upload document.");
        }
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError("Network error uploading document. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Handle File Delete
  async function handleDeleteDocument(docId: string) {
    try {
      const res = await fetch(
        `/api/agents/${currentAgent.id}/knowledge?docId=${encodeURIComponent(docId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        setActiveMenuDocId(null);
        if (onToast) onToast("Document removed", "info");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to remove document");
      }
    } catch (err) {
      console.error("Delete doc error:", err);
    }
  }

  // Handle Drag & Drop Events
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }

  // Handle Chat Message Submit (real backend test call)
  async function handleSendMessage() {
    const text = chatInput.trim();
    if (!text || sendingMessage) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setSendingMessage(true);
    setHasTestedChat(true);

    try {
      const history = chatMessages.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const res = await fetch(`/api/agents/${currentAgent.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const replyText =
          data.reply ||
          data.message ||
          "I have processed your query based on the active agent configuration.";
        setChatMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: replyText,
          },
        ]);
      } else {
        const fallbackText =
          data.error ||
          "Demo mode: Response simulation based on configured instructions and uploaded knowledge.";
        setChatMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: fallbackText,
          },
        ]);
      }
    } catch (err) {
      console.error("Test chat error:", err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: "I'm ready to help answer questions based on your instructions and uploaded documents.",
        },
      ]);
    } finally {
      setSendingMessage(false);
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }

  function handleResetChat() {
    setChatMessages([
      {
        id: "preview-1",
        role: "assistant",
        text: "Hi! I can help answer questions using your instructions and uploaded documents.",
      },
      {
        id: "preview-2",
        role: "user",
        text: "What is your return policy?",
      },
      {
        id: "preview-3",
        role: "assistant",
        text: "I'll check the available knowledge base and give you a clear answer.",
      },
    ]);
  }

  // Quick Setup Step Completion Checks
  const isStep1Done = Boolean(agentName.trim().length > 0);
  const isStep2Done = Boolean(instructions.trim().length > 0);
  const isStep3Done = Boolean(documents.length > 0);
  const isStep4Done = Boolean(hasTestedChat);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F9FC]">
      {/* 1. TOP HEADER */}
      <header className="w-full bg-white border-b border-[#DFE7F3] px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {onToggleMobileNav && (
            <button
              onClick={onToggleMobileNav}
              className="lg:hidden p-1.5 text-[#7183A3] hover:text-[#101D45] rounded-md transition"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Breadcrumb */}
          <div className="flex items-center text-xs font-medium tracking-tight">
            <span className="text-[#7183A3]">Workspace</span>
            <span className="text-[#7183A3] mx-2">/</span>
            <span className="text-[#101D45] font-semibold">Create agent</span>
          </div>
        </div>

        {/* Right Status & Action */}
        <div className="flex items-center gap-4">
          {/* Draft Saved Status */}
          <div className="flex items-center gap-1.5 text-xs text-[#159B68] font-medium select-none">
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1769FF]" />
                <span className="text-[#7183A3]">Saving changes...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#159B68]" />
                <span>{isSaved ? "Draft saved" : "Unsaved changes"}</span>
              </>
            )}
          </div>

          {/* Save Agent Button */}
          <button
            onClick={handleSaveAgent}
            disabled={saving}
            className="bg-[#1769FF] hover:bg-[#1255d6] text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save agent</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN SCROLLABLE CONTENT */}
      <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto">
        {/* Main Page Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-[26px] font-bold text-[#101D45] tracking-tight">
            Create a new AI agent
          </h1>
          <p className="text-xs md:text-sm text-[#7183A3] mt-1 font-normal">
            Customize how your existing AI assistant behaves using instructions and trusted knowledge.
          </p>
        </div>

        {/* 3. TWO-COLUMN DESKTOP LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ============================================================ */}
          {/* LEFT COLUMN: Agent Configuration & Knowledge Base Cards      */}
          {/* ============================================================ */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* CARD 1: Agent Configuration */}
            <div className="bg-white rounded-xl border border-[#DFE7F3] p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,29,69,0.04)]">
              <h2 className="text-base font-bold text-[#101D45] tracking-tight mb-5">
                Agent configuration
              </h2>

              {/* Field 1: Agent Name */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#101D45] mb-1.5">
                  Agent name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Customer Support Helper"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-[#DFE7F3] text-[#101D45] placeholder-[#7183A3]/70 focus:outline-none focus:border-[#1769FF] focus:ring-1 focus:ring-[#1769FF] transition bg-white"
                />
              </div>

              {/* Field 2: Conversation Tone */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#101D45] mb-1.5">
                  Conversation tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => handleToneChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-[#DFE7F3] text-[#101D45] bg-white focus:outline-none focus:border-[#1769FF] focus:ring-1 focus:ring-[#1769FF] transition cursor-pointer"
                >
                  {toneOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 3: Instructions */}
              <div>
                <label className="block text-xs font-semibold text-[#101D45] mb-0.5">
                  Instructions
                </label>
                <p className="text-[11px] text-[#7183A3] mb-2 font-normal">
                  Describe the role, behavior, boundaries, and response style.
                </p>
                <div className="relative">
                  <textarea
                    rows={10}
                    value={instructions}
                    maxLength={10000}
                    onChange={(e) => handleInstructionsChange(e.target.value)}
                    placeholder="You are a helpful support assistant. Answer clearly, follow the instructions below, and use the knowledge base when relevant."
                    className="w-full px-3.5 py-2.5 font-mono text-sm leading-relaxed rounded-lg border border-[#DFE7F3] text-[#101D45] placeholder-[#7183A3]/70 focus:outline-none focus:border-[#1769FF] focus:ring-1 focus:ring-[#1769FF] transition resize-y min-h-[280px] bg-white"
                  />
                  <div className="text-right text-[11px] text-[#7183A3] mt-1 font-mono">
                    {instructions.length.toLocaleString()} / 10,000
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: Knowledge Base */}
            <div className="bg-white rounded-xl border border-[#DFE7F3] p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,29,69,0.04)]">
              <div className="mb-4">
                <h2 className="text-base font-bold text-[#101D45] tracking-tight">
                  Knowledge base
                </h2>
                <p className="text-xs text-[#7183A3] mt-0.5 font-normal">
                  Upload documents to ground your agent's answers.
                </p>
              </div>

              {/* Large Dashed-Border Upload Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center ${
                  isDragging
                    ? "border-[#1769FF] bg-[#F4F8FF]"
                    : "border-[#DFE7F3] bg-[#F7F9FC]/60 hover:bg-[#F7F9FC]"
                }`}
              >
                {/* Upload Cloud Icon */}
                <div className="w-12 h-12 rounded-full bg-[#EBF2FF] text-[#1769FF] flex items-center justify-center mb-3 shadow-2xs">
                  <UploadCloud className="w-6 h-6" />
                </div>

                {/* Drag & Drop prompt + Blue Button */}
                <p className="text-xs text-[#344563] font-medium mb-3">
                  Drag and drop files here or
                </p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-[#1769FF] hover:bg-[#1255d6] text-white text-xs font-semibold px-4 py-2 rounded-lg transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Indexing document...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload documents</span>
                    </>
                  )}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />

                {/* Format and Size Guidance */}
                <p className="text-[11px] text-[#7183A3] mt-3">
                  Supported formats: PDF, DOCX, TXT
                </p>
                <p className="text-[11px] text-[#7183A3] mt-0.5">
                  Maximum file size: 10MB per file
                </p>

                {uploadError && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>

              {/* Uploaded Documents List */}
              <div className="mt-5">
                {loadingDocs ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#7183A3]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1769FF]" />
                    <span>Loading knowledge documents...</span>
                  </div>
                ) : documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => {
                      const ext = (doc.fileType || "pdf").toLowerCase();
                      const isPdf = ext.includes("pdf");
                      const isDocx = ext.includes("doc");

                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-[#DFE7F3] hover:border-[#CBD5E1] bg-white transition group relative"
                        >
                          {/* File Icon & Info */}
                          <div className="flex items-center gap-3 min-w-0 pr-3">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                isPdf
                                  ? "bg-rose-50 text-rose-600 border border-rose-100"
                                  : isDocx
                                  ? "bg-blue-50 text-blue-600 border border-blue-100"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              <FileText className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#101D45] truncate">
                                {doc.name}
                              </p>
                              <p className="text-[11px] text-[#7183A3]">
                                {ext.toUpperCase()} · {doc.fileSize || "1.0 MB"}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge & Three-Dot Menu */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F7F0] text-[#159B68] border border-[#B3EBD3]">
                              <Check className="w-3 h-3 stroke-[2.5]" />
                              <span>Indexed</span>
                            </span>

                            <div className="relative">
                              <button
                                onClick={() =>
                                  setActiveMenuDocId(
                                    activeMenuDocId === doc.id ? null : doc.id
                                  )
                                }
                                className="p-1 text-[#7183A3] hover:text-[#101D45] hover:bg-[#F7F9FC] rounded transition"
                                aria-label="Document options"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {activeMenuDocId === doc.id && (
                                <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-[#DFE7F3] py-1 z-30">
                                  <button
                                    onClick={() => handleDeleteDocument(doc.id)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete file</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty state */
                  <div className="p-4 rounded-lg bg-[#F7F9FC] border border-[#DFE7F3] text-center">
                    <p className="text-xs text-[#7183A3]">
                      No documents uploaded yet. Upload documents to ground your agent's answers.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* RIGHT COLUMN: Agent Mode, Agent Preview, Quick Setup Cards   */}
          {/* ============================================================ */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* CARD 3: Agent Mode */}
            <div className="bg-white rounded-xl border border-[#DFE7F3] p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,29,69,0.04)]">
              <h2 className="text-base font-bold text-[#101D45] tracking-tight mb-3">
                Agent mode
              </h2>

              {/* Option 1: Connected assistant */}
              <div
                onClick={() => handleModeChange("connected")}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 select-none ${
                  agentMode === "connected"
                    ? "border-[#1769FF] bg-[#F4F8FF]"
                    : "border-[#DFE7F3] bg-white hover:border-[#CBD5E1]"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 shrink-0 transition ${
                    agentMode === "connected"
                      ? "border-2 border-[#1769FF]"
                      : "border border-[#DFE7F3]"
                  }`}
                >
                  {agentMode === "connected" && (
                    <div className="w-2 h-2 rounded-full bg-[#1769FF]" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-xs font-semibold text-[#101D45]">
                    Connected assistant
                  </p>
                  <p className="text-[11px] text-[#7183A3] mt-0.5">
                    Apply instructions to your existing AI assistant.
                  </p>
                  {agentMode === "connected" && (
                    <div className="mt-2 pt-2 border-t border-blue-100 flex items-center gap-1.5 text-[11px] text-[#159B68] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Live assistant integration active</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Option 2: Demo mode */}
              <div
                onClick={() => handleModeChange("demo")}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 select-none mt-3 ${
                  agentMode === "demo"
                    ? "border-[#1769FF] bg-[#F4F8FF]"
                    : "border-[#DFE7F3] bg-white hover:border-[#CBD5E1]"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 shrink-0 transition ${
                    agentMode === "demo"
                      ? "border-2 border-[#1769FF]"
                      : "border border-[#DFE7F3]"
                  }`}
                >
                  {agentMode === "demo" && (
                    <div className="w-2 h-2 rounded-full bg-[#1769FF]" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-xs font-semibold text-[#101D45]">
                    Demo mode
                  </p>
                  <p className="text-[11px] text-[#7183A3] mt-0.5">
                    Test a sample agent without changing the live assistant.
                  </p>
                  {agentMode === "demo" && (
                    <div className="mt-2 pt-2 border-t border-blue-100 flex items-center gap-1.5 text-[11px] text-[#7183A3]">
                      <Info className="w-3.5 h-3.5 shrink-0 text-[#1769FF]" />
                      <span>Isolated preview mode — live assistant unchanged</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CARD 4: Agent Preview */}
            <div className="bg-white rounded-xl border border-[#DFE7F3] p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,29,69,0.04)] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-[#101D45] tracking-tight">
                  Agent preview
                </h2>
                <button
                  onClick={handleResetChat}
                  title="Reset conversation preview"
                  className="p-1 text-[#7183A3] hover:text-[#101D45] rounded transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chat Container */}
              <div
                ref={chatScrollRef}
                className="bg-[#F7F9FC] border border-[#DFE7F3] rounded-xl p-3.5 min-h-[250px] max-h-[300px] overflow-y-auto space-y-3"
              >
                {chatMessages.map((msg) => {
                  const isAssistant = msg.role === "assistant";
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${
                        isAssistant ? "justify-start" : "justify-end"
                      }`}
                    >
                      {isAssistant && (
                        <div className="w-6 h-6 rounded-full bg-[#1769FF] text-white flex items-center justify-center shrink-0 text-xs mt-0.5">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div
                        className={`text-xs px-3.5 py-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                          isAssistant
                            ? "bg-white border border-[#DFE7F3] text-[#101D45] rounded-tl-xs shadow-2xs"
                            : "bg-[#1769FF] text-white rounded-tr-xs shadow-2xs ml-auto"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}

                {sendingMessage && (
                  <div className="flex items-start gap-2 justify-start">
                    <div className="w-6 h-6 rounded-full bg-[#1769FF] text-white flex items-center justify-center shrink-0 text-xs mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-white border border-[#DFE7F3] text-[#7183A3] rounded-2xl rounded-tl-xs px-3 py-2 text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1769FF] animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1769FF] animate-bounce delay-100" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1769FF] animate-bounce delay-200" />
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#DFE7F3]">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  placeholder="Type a message to test..."
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#DFE7F3] bg-white text-[#101D45] placeholder-[#7183A3] focus:outline-none focus:border-[#1769FF] transition"
                />

                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !chatInput.trim()}
                  className="w-8 h-8 rounded-lg bg-[#1769FF] hover:bg-[#1255d6] text-white flex items-center justify-center transition shrink-0 cursor-pointer disabled:opacity-50"
                  aria-label="Send test message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* CARD 5: Quick Setup */}
            <div className="bg-white rounded-xl border border-[#DFE7F3] p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,29,69,0.04)]">
              <h2 className="text-base font-bold text-[#101D45] tracking-tight mb-4">
                Quick setup
              </h2>

              <div className="space-y-3">
                {/* Step 1: Name your agent */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition ${
                      isStep1Done
                        ? "bg-[#159B68] text-white"
                        : "bg-[#EBF2FF] text-[#1769FF]"
                    }`}
                  >
                    {isStep1Done ? <Check className="w-3 h-3 stroke-[3]" /> : "1"}
                  </div>
                  <span
                    className={`text-xs ${
                      isStep1Done
                        ? "text-[#101D45] font-semibold"
                        : "text-[#344563] font-medium"
                    }`}
                  >
                    Name your agent
                  </span>
                </div>

                {/* Step 2: Add instructions */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition ${
                      isStep2Done
                        ? "bg-[#159B68] text-white"
                        : "bg-[#EBF2FF] text-[#1769FF]"
                    }`}
                  >
                    {isStep2Done ? <Check className="w-3 h-3 stroke-[3]" /> : "2"}
                  </div>
                  <span
                    className={`text-xs ${
                      isStep2Done
                        ? "text-[#101D45] font-semibold"
                        : "text-[#344563] font-medium"
                    }`}
                  >
                    Add instructions
                  </span>
                </div>

                {/* Step 3: Upload knowledge */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition ${
                      isStep3Done
                        ? "bg-[#159B68] text-white"
                        : "bg-[#EBF2FF] text-[#1769FF]"
                    }`}
                  >
                    {isStep3Done ? <Check className="w-3 h-3 stroke-[3]" /> : "3"}
                  </div>
                  <span
                    className={`text-xs ${
                      isStep3Done
                        ? "text-[#101D45] font-semibold"
                        : "text-[#344563] font-medium"
                    }`}
                  >
                    Upload knowledge
                  </span>
                </div>

                {/* Step 4: Test the agent */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition ${
                      isStep4Done
                        ? "bg-[#159B68] text-white"
                        : "bg-[#EBF2FF] text-[#1769FF]"
                    }`}
                  >
                    {isStep4Done ? <Check className="w-3 h-3 stroke-[3]" /> : "4"}
                  </div>
                  <span
                    className={`text-xs ${
                      isStep4Done
                        ? "text-[#101D45] font-semibold"
                        : "text-[#344563] font-medium"
                    }`}
                  >
                    Test the agent
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
