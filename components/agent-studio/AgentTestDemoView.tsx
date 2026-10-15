// components/agent-studio/AgentTestDemoView.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Bot,
  RotateCcw,
  Paperclip,
  Smile,
  Send,
  FileText,
  Info,
  Sliders,
  ChevronRight,
  CheckCheck,
  ChevronDown,
  User,
  History,
  Workflow,
  Sparkles,
  ShieldCheck,
  Zap,
  Search,
  X,
  Cpu,
  Clock,
  Activity,
} from "lucide-react";
import { Agent } from "@/lib/agent-studio/types";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
  read?: boolean;
  isSimulated?: boolean;
  sources?: string[];
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    modelName?: string;
  };
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    role: "assistant",
    text: "Hello! I'm CreditWise Assistant 👋\n\nI can help you with loan eligibility, available banks, understand your company category, and provide useful information from our knowledge base.\n\nYou can ask me anything related to loans, policies, or upload documents for personalized assistance.",
    time: "10:24 AM",
  },
  {
    id: "msg-2",
    role: "user",
    text: "Hi, I want to check my personal loan eligibility. I work at TCS and my current salary is 80,000 per month.",
    time: "10:26 AM",
    read: true,
  },
  {
    id: "msg-3",
    role: "assistant",
    text: "Great! I can help you with that. To check your loan eligibility, I'll need a few more details:\n\n1. Your current employer (Company name)\n2. CIBIL credit score\n3. Employment type (Permanent / Contract)\n4. Your age\n5. Existing EMI (if any)\n\nWould you like to share these details now, or do you want to upload a document (e.g., salary slip) for faster processing?",
    time: "10:26 AM",
  },
];

interface AgentTestDemoViewProps {
  agent: Agent;
  agents?: Agent[];
  onSelectAgent?: (agentId: string) => void;
  onNavigateToInstructions: () => void;
  onToast: (msg: string, type?: "success" | "info" | "warning") => void;
  onCreateAgentClick?: () => void;
  onActivateAgent?: (agentId: string) => Promise<void>;
}

export default function AgentTestDemoView({
  agent,
  agents = [],
  onSelectAgent,
  onNavigateToInstructions,
  onToast,
  onCreateAgentClick,
  onActivateAgent,
}: AgentTestDemoViewProps) {
  const currentAgentName = agent.name || "CreditWise Assistant";

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: `msg-init-${agent.id}`,
      role: "assistant",
      text:
        agent.welcomeMessage?.text ||
        `Hello! I'm ${currentAgentName} 👋\n\nI can help you with loan eligibility, available banks, and answer queries grounded in our RAG knowledge base.\n\nYou can ask me anything or upload documents for personalized assistance.`,
      time: "10:24 AM",
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "Quick Test" | "Sample Scenarios" | "Conversation History"
  >("Quick Test");
  const [runtimeMode, setRuntimeMode] = useState<"live" | "demo">("live");
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);

  // Search states for Agent Test Demo
  const [panelSearchQuery, setPanelSearchQuery] = useState("");
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const sessionTokens = messages.reduce(
    (acc, m) => acc + (m.tokenUsage?.totalTokens || (m.role === "assistant" ? 112 : 28)),
    0
  );

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allAgentsList = agents && agents.length > 0 ? agents : [agent];

  // Update initial messages when switching agents
  useEffect(() => {
    const welcome =
      agent.welcomeMessage?.text ||
      `Hello! I'm ${currentAgentName} 👋\n\nI am connected to the RAG knowledge base. How can I help you today?`;
    setMessages([
      {
        id: `msg-welcome-${agent.id}`,
        role: "assistant",
        text: welcome,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, [agent.id, currentAgentName]);

  // Handle outside click to close agent dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAgentMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Internal smooth auto-scroll inside the chat container so older messages move up
  // without shifting the outer page or resizing the AI agent card
  const scrollToBottom = (smooth = true) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isSending]);



  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend || inputVal).trim();
    if (!text || isSending) return;

    const userTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      time: userTime,
      read: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputVal("");
    setIsSending(true);

    try {
      if (runtimeMode === "demo") {
        // Deterministic Predefined Demo response mode (no LLM, no production tools)
        setTimeout(() => {
          let demoReply = `[SIMULATED DEMO] Based on stored partner bank policies, with TCS (Super CAT A) and your income profile, you are potentially eligible for loans with HDFC Bank, ICICI Bank, and Axis Finance. Estimated max loan limit: ₹15-20 Lakhs with an estimated EMI of ₹2,150 per lakh.`;
          if (text.toLowerCase().includes("axis")) {
            demoReply = `[SIMULATED DEMO] Axis Bank / Axis Finance Policy Highlights:\n• Min Age: 21 years (Max 60 at maturity)\n• CIBIL Cutoff: 700+\n• Min Net Salary: ₹22,000\n• Tenure: Up to 60 months\n• Max Loan: Up to ₹40 Lakhs.`;
          } else if (text.toLowerCase().includes("foir")) {
            demoReply = `[SIMULATED DEMO] FOIR stands for Fixed Obligation to Income Ratio. It is the percentage of your monthly income that goes towards debt EMIs. Most lenders cap FOIR at 50% to 65% for high-earning applicants.`;
          }

          const botMsg: ChatMessage = {
            id: `bot-${Date.now()}`,
            role: "assistant",
            text: demoReply,
            isSimulated: true,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
          setMessages((prev) => [...prev, botMsg]);
          setIsSending(false);
        }, 600);
      } else {
        // Real Live AI response via `/api/agents/[id]/test`
        const historyForApi = messages.map((m) => ({
          role: m.role,
          content: m.text,
        }));

        const res = await fetch(`/api/agents/${agent.id}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: historyForApi,
          }),
        });

        const data = await res.json();
        const replyText =
          data.reply ||
          data.response ||
          "I have processed your request using the connected knowledge base. Please let me know if you would like me to compare specific lenders or check EMI options.";

        const usedDocs = Array.isArray(data.usedKnowledgeDocuments)
          ? data.usedKnowledgeDocuments
          : data.knowledgeSource && data.knowledgeSource !== "No documents uploaded"
          ? [data.knowledgeSource]
          : [];

        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          text: replyText,
          isSimulated: false,
          sources: usedDocs,
          tokenUsage: data.tokenUsage || undefined,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err) {
      console.error("Test send error:", err);
      const fallbackMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        text: "Connection error: Unable to reach the AI agent service. Please verify your network connection or check the server logs.",
        isSimulated: false,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      if (runtimeMode !== "demo") {
        setIsSending(false);
      }
    }
  }

  function handleResetChat() {
    setMessages(INITIAL_MESSAGES);
    onToast("Chat reset to initial test state", "info");
  }

  function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    onToast(`Attached file "${file.name}" to conversation`, "success");
    handleSendMessage(`[Uploaded File: ${file.name}] Please verify my loan eligibility based on this document.`);
  }

  return (
    <div className="flex-1 bg-[#F8FAFC] p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header matching Screenshot 1 */}
        <div className="flex items-start gap-4 shrink-0">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Agent Test / Demo
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Test how your AI agent responds, uses knowledge base, and handles real conversations. Try different scenarios, upload files, and see the complete response flow.
            </p>
          </div>
        </div>

        {/* 2-Column Layout with Rock-Solid Sizing */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT / CENTER COLUMN: Chat Interface (AI Model Blue Ribbon Style) - Stable fixed height */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px solid #bfdbfe",
              boxShadow: "0 4px 20px -2px rgba(59, 130, 246, 0.08)",
              overflow: "hidden",
              height: "720px",
              maxHeight: "720px",
              minHeight: "720px",
            }}
            className="lg:col-span-8 flex flex-col h-[720px] max-h-[720px] min-h-[720px] shrink-0"
          >
            {/* AI Model Header Ribbon - Locked */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.04) 100%)",
                padding: "14px 20px",
                borderBottom: "1px solid #dbeafe",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              className="shrink-0"
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
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1e3a8a" }}>
                    Live Agent Test Sandbox
                  </h2>
                  <span style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: 500 }}>
                    Interactive conversation test with live grounding and policy checks
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsChatSearchOpen(!isChatSearchOpen);
                    if (isChatSearchOpen) setChatSearchQuery("");
                  }}
                  className={`ai-search-toggle-btn ${isChatSearchOpen ? "active" : ""}`}
                  title="Search messages in conversation (Ctrl+F)"
                  aria-label="Search conversation"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>

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
                  Agent Online
                </span>
              </div>
            </div>

            {/* In-Chat Message Search Bar (Collapsible) */}
            {isChatSearchOpen && (
              <div className="ai-chat-search-panel">
                <div className="ai-chat-search-wrapper">
                  <Search className="ai-chat-search-icon" />
                  <input
                    type="text"
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    placeholder="Search messages in this conversation..."
                    className="ai-chat-search-input"
                    autoFocus
                  />
                  {chatSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setChatSearchQuery("")}
                      className="ai-sandbox-search-clear"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="ai-chat-search-badge">
                    {chatSearchQuery
                      ? `${messages.filter((m) => m.text.toLowerCase().includes(chatSearchQuery.toLowerCase())).length} found`
                      : `${messages.length} messages`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChatSearchOpen(false);
                      setChatSearchQuery("");
                    }}
                    className="ai-chat-search-close"
                    title="Close search (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Top Controls Bar - Locked */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
              <div className="flex items-center gap-3">
                {/* Select Agent Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsAgentMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 hover:border-blue-300 rounded-lg bg-white shadow-xs text-xs font-semibold text-slate-800 transition cursor-pointer"
                  >
                    <Bot className="w-4 h-4 text-blue-600" />
                    <span>{currentAgentName}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isAgentMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu showing all created agents */}
                  {isAgentMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-fadeIn">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                        <span>Select Created Agent</span>
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
                                  onToast(`Switched to testing ${aDisplayName}`, "info");
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
                                  <div className="truncate font-medium flex items-center gap-1.5">
                                    <span>{aDisplayName}</span>
                                    {ag.isActiveForUser && (
                                      <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-semibold">
                                        Active
                                      </span>
                                    )}
                                  </div>
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
                        <div className="p-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAgentMenuOpen(false);
                              onCreateAgentClick();
                            }}
                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            <span>+ Create New Agent</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Agent Ready Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div className="text-xs">
                    <span className="font-semibold text-emerald-800 mr-1.5">
                      Agent Ready
                    </span>
                    <span className="text-slate-500 text-[11px] hidden sm:inline">
                      Using knowledge base • Online
                    </span>
                  </div>
                </div>
              </div>

              {/* Reset Chat Button */}
              <button
                onClick={handleResetChat}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Chat</span>
              </button>
            </div>

            {/* Sandbox Mode Status Banner - Locked */}
            <div
              className={`px-4 py-2 border-b text-xs flex items-center justify-between transition-colors shrink-0 ${
                runtimeMode === "live"
                  ? "bg-blue-50/70 border-blue-100 text-blue-900"
                  : "bg-amber-50/70 border-amber-100 text-amber-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    runtimeMode === "live" ? "bg-blue-600 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span className="font-bold">
                  {runtimeMode === "live" ? "Live LLM Sandbox:" : "Predefined Demo Mode:"}
                </span>
                <span className="text-[11px] text-slate-600 hidden sm:inline">
                  {runtimeMode === "live"
                    ? "Real LLM calls executed with active agent instructions and RAG retrieval."
                    : "Simulated demonstration responses. Real LLM and production tools are not executed."}
                </span>
              </div>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-white border border-slate-200">
                {runtimeMode === "live" ? "Live LLM" : "Simulated Demo"}
              </span>
            </div>

            {/* Chat Messages Scroll Container - Constrained with min-h-0 so outer agent box remains 100% stable */}
            <div
              ref={chatContainerRef}
              className="flex-1 min-h-0 p-5 overflow-y-auto space-y-4 bg-white overscroll-contain"
            >
              {(chatSearchQuery.trim()
                ? messages.filter((m) => m.text.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                : messages
              ).map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-3 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <div
                        style={{ backgroundColor: "#2563EB" }}
                        className="w-8 h-8 rounded-full text-white flex items-center justify-center shrink-0 mb-1 shadow-xs"
                      >
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] break-words ${
                        isUser ? "as-chat-user-bubble" : "as-chat-agent-bubble"
                      }`}
                    >
                      {!isUser && msg.isSimulated && (
                        <div className="mb-2 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800 flex items-center gap-1.5 w-fit shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Predefined Demo Response (Simulated • No LLM Called)</span>
                        </div>
                      )}

                      <div className="leading-relaxed text-xs break-words overflow-hidden">
                        {renderMessageContent(msg.text, isUser)}
                      </div>

                      {!isUser && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                          <span className="font-semibold text-slate-600">Knowledge Sources:</span>
                          {msg.sources.map((src, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 font-medium"
                            >
                              <FileText className="w-3 h-3 text-blue-600" />
                              {src}
                            </span>
                          ))}
                        </div>
                      )}

                      {!isUser && msg.tokenUsage && msg.tokenUsage.totalTokens > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/60 text-[10px] text-emerald-700 font-semibold w-fit">
                          <Zap className="w-3 h-3 text-emerald-600" />
                          <span>
                            {msg.tokenUsage.totalTokens} tokens ({msg.tokenUsage.promptTokens} prompt • {msg.tokenUsage.completionTokens} completion)
                          </span>
                        </div>
                      )}

                      <div
                        className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${
                          isUser ? "text-blue-100" : "text-slate-400"
                        }`}
                      >
                        <span>{msg.time}</span>
                        {isUser && (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                        )}
                      </div>
                    </div>

                    {isUser && (
                      <div
                        style={{ backgroundColor: "#334155" }}
                        className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 mb-1 shadow-xs"
                      >
                        RU
                      </div>
                    )}
                  </div>
                );
              })}

              {isSending && (
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: "#2563EB" }}
                    className="w-8 h-8 rounded-full text-white flex items-center justify-center shrink-0 shadow-xs"
                  >
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="as-chat-agent-bubble py-3 px-4 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce delay-100" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce delay-200" />
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
                onChange={(e) => handleFileUpload(e.target.files)}
              />

            {/* Bottom Message Input Bar - Anchored at Bottom */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="ai-chat-input-container"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="ai-chat-action-btn"
                  title="Attach loan document or policy file"
                  aria-label="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  placeholder="Ask a loan policy question, test eligibility, or type a message..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  className="ai-chat-input-field"
                />

                <button
                  type="button"
                  onClick={() => setInputVal((prev) => prev + " 👋")}
                  className="ai-chat-action-btn"
                  title="Insert emoji"
                  aria-label="Insert emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>

                <button
                  type="submit"
                  disabled={!inputVal.trim() || isSending}
                  className="ai-chat-send-btn"
                  title="Send message (Enter)"
                  aria-label="Send message"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: Quick Test / Scenarios / History Panels - Anchored & Sticky */}
          <div className="lg:col-span-4 space-y-3.5 lg:sticky lg:top-6 lg:self-start">
            {/* Integrated Professional Search Bar */}
            <div className="ai-sandbox-search-container">
              <div className="ai-sandbox-search-inner">
                <Search className="ai-sandbox-search-icon" />
                <input
                  type="text"
                  value={panelSearchQuery}
                  onChange={(e) => setPanelSearchQuery(e.target.value)}
                  placeholder="Search scenarios, policies & prompts..."
                  className="ai-sandbox-search-input"
                />
                {panelSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => setPanelSearchQuery("")}
                    className="ai-sandbox-search-clear"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="ai-sandbox-search-kbd">⌘K</kbd>
                )}
              </div>
            </div>

            {/* Soft Segmented Tab Navigation matching AI Models page */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl overflow-x-auto w-full">
              <button
                onClick={() => setActiveTab("Quick Test")}
                className={`flex-1 text-center py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
                  activeTab === "Quick Test"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/70"
                    : "text-slate-600 hover:text-slate-900 border border-transparent"
                }`}
              >
                Quick Test
              </button>

              <button
                onClick={() => setActiveTab("Sample Scenarios")}
                className={`flex-1 text-center py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
                  activeTab === "Sample Scenarios"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/70"
                    : "text-slate-600 hover:text-slate-900 border border-transparent"
                }`}
              >
                Scenarios
              </button>

              <button
                onClick={() => setActiveTab("Conversation History")}
                className={`flex-1 text-center py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
                  activeTab === "Conversation History"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/70"
                    : "text-slate-600 hover:text-slate-900 border border-transparent"
                }`}
              >
                History
              </button>
            </div>

            {/* TAB 1: Quick Test Content — CallNow 4-Card Telemetry Metric Grid */}
            {activeTab === "Quick Test" && (
              <div className="space-y-4">
                {/* 4 Metric Cards Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Card 1: Active Model */}
                  <div className="cn-metric-card p-3">
                    <div className="cn-metric-card-icon purple w-8 h-8 rounded-lg">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div className="cn-metric-card-body">
                      <div className="cn-metric-card-label text-[10px]">Model</div>
                      <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                        {agent.name && agent.name !== "Loan Eligibility Assistant"
                          ? agent.name
                          : "Nemotron 550B"}
                      </div>
                      <div className="mt-1">
                        <span className="cn-status-pill primary text-[9px] px-1.5 py-0.5">OpenRouter</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Turn Latency */}
                  <div className="cn-metric-card p-3">
                    <div className="cn-metric-card-icon success w-8 h-8 rounded-lg">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="cn-metric-card-body">
                      <div className="cn-metric-card-label text-[10px]">Avg Latency</div>
                      <div className="cn-metric-card-value text-base mt-0.5">0.82s</div>
                      <div className="cn-metric-card-trend up text-[9px] px-1.5 py-0.5 mt-1">
                        <span>Fast Stream</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Session Tokens */}
                  <div className="cn-metric-card p-3">
                    <div className="cn-metric-card-icon warning w-8 h-8 rounded-lg">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="cn-metric-card-body">
                      <div className="cn-metric-card-label text-[10px]">Session Tokens</div>
                      <div className="cn-metric-card-value text-base mt-0.5">
                        {sessionTokens.toLocaleString()}
                      </div>
                      <div className="cn-metric-card-trend flat text-[9px] px-1.5 py-0.5 mt-1">
                        <span>Live Count</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Context Window Meter */}
                  <div className="cn-metric-card p-3">
                    <div className="cn-metric-card-icon info w-8 h-8 rounded-lg">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="cn-metric-card-body">
                      <div className="cn-metric-card-label text-[10px]">Context Window</div>
                      <div className="cn-metric-card-value text-base mt-0.5">128K</div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(5, (sessionTokens / 128000) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration Overview Card */}
                <div className="cn-card p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[11px] text-slate-500 font-medium">Status</span>
                    <span className="cn-status-pill success">Online &amp; Grounded</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[11px] text-slate-500 font-medium">Tone</span>
                    <span className="font-semibold text-slate-800 text-[11px]">
                      {agent.instructions?.tone || "Professional and friendly"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[11px] text-slate-500 font-medium">Response Style</span>
                    <span className="font-semibold text-slate-800 text-[11px]">
                      {agent.responseStyle === "detailed"
                        ? "Detailed & explanatory"
                        : "Clear, helpful, concise"}
                    </span>
                  </div>
                </div>

                {/* Card 3: Agent Runtime Mode (AI Model Amber Ribbon Style) */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid #fed7aa",
                    boxShadow: "0 4px 16px rgba(245, 158, 11, 0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.04) 100%)",
                      padding: "12px 16px",
                      borderBottom: "1px solid #ffedd5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "8px",
                          background: "#d97706",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#7c2d12" }}>
                        Agent Runtime Mode
                      </span>
                    </div>
                    <Info className="w-3.5 h-3.5 text-amber-500" />
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Live AI Option */}
                      <div
                        onClick={() => setRuntimeMode("live")}
                        className={`as-runtime-card ${runtimeMode === "live" ? "selected" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            style={
                              runtimeMode === "live"
                                ? { borderColor: "#2563EB", backgroundColor: "#2563EB" }
                                : { borderColor: "#cbd5e1", backgroundColor: "#ffffff" }
                            }
                            className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
                          >
                            {runtimeMode === "live" && (
                              <span className="w-1 h-1 rounded-full bg-white" />
                            )}
                          </span>
                          <span className="text-xs font-semibold text-slate-900">
                            Live AI Assistant
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Uses LLM + Knowledge Base
                        </p>
                      </div>

                      {/* Fixed Demo Option */}
                      <div
                        onClick={() => setRuntimeMode("demo")}
                        className={`as-runtime-card ${runtimeMode === "demo" ? "selected" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            style={
                              runtimeMode === "demo"
                                ? { borderColor: "#2563EB", backgroundColor: "#2563EB" }
                                : { borderColor: "#cbd5e1", backgroundColor: "#ffffff" }
                            }
                            className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
                          >
                            {runtimeMode === "demo" && (
                              <span className="w-1 h-1 rounded-full bg-white" />
                            )}
                          </span>
                          <span className="text-xs font-semibold text-slate-900">
                            Fixed Demo
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Predefined conversation
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* View Agent Configuration Button matching Screenshot 1 */}
                <button
                  onClick={onNavigateToInstructions}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-blue-100 bg-blue-50/30 hover:bg-blue-50/70 text-blue-600 transition cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span>View Agent Configuration</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-600" />
                </button>
              </div>
            )}

            {/* TAB 2: Sample Scenarios (AI Model Blue Ribbon Style) */}
            {activeTab === "Sample Scenarios" && (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #bfdbfe",
                  boxShadow: "0 4px 16px rgba(59, 130, 246, 0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.04) 100%)",
                    padding: "12px 16px",
                    borderBottom: "1px solid #dbeafe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        background: "#2563eb",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Workflow className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#1e3a8a" }}>
                        Pre-configured Scenarios
                      </h3>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "#60a5fa" }}>
                        Click to simulate test dialogues
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-2.5">
                  {(() => {
                    const scenariosList = [
                      {
                        title: "TCS Salaried Employee Eligibility",
                        salary: "₹80,000 / month",
                        category: "Eligibility",
                        query: "I work at TCS with ₹80,000 salary, CIBIL 760, and no current loans. Which banks give me the lowest rate?",
                      },
                      {
                        title: "Finnable Credit Minimum Net Salary",
                        salary: "₹25,000 / month",
                        category: "Eligibility",
                        query: "What is the minimum in-hand salary required for Finnable personal loans across Tier-1 and Tier-2 cities?",
                      },
                      {
                        title: "EMI Calculation for ₹10 Lakh",
                        salary: "36 Months • 10.5%",
                        category: "EMI",
                        query: "Calculate monthly EMI for ₹10 Lakh personal loan at 10.5% interest rate for 3 years tenure.",
                      },
                      {
                        title: "Debt-to-Income / FOIR Limit Check",
                        salary: "₹60,000 / month",
                        category: "EMI",
                        query: "How much existing EMI can I have if my salary is ₹60,000? Explain FOIR calculation rules.",
                      },
                      {
                        title: "Multi-Bank Policy Comparison",
                        salary: "Axis vs HDFC vs ICICI",
                        category: "Policies",
                        query: "Compare personal loan eligibility and CIBIL cutoffs between Axis Bank, HDFC, and ICICI.",
                      },
                      {
                        title: "Missing Info & Clarification Flow",
                        salary: "₹35,000 / month",
                        category: "Policies",
                        query: "Can I get a loan? (Ask me friendly clarifying questions for missing employer, CIBIL, and EMI details).",
                      },
                    ];

                    const filtered = scenariosList.filter((sc) => {
                      const matchesQuery = !panelSearchQuery.trim() ||
                        sc.title.toLowerCase().includes(panelSearchQuery.toLowerCase()) ||
                        sc.query.toLowerCase().includes(panelSearchQuery.toLowerCase());
                      return matchesQuery;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          No scenarios found matching "{panelSearchQuery}".
                        </div>
                      );
                    }

                    return filtered.map((sc, i) => (
                      <div
                        key={i}
                        onClick={() => handleSendMessage(sc.query)}
                        className="p-3 border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/40 rounded-xl cursor-pointer transition shadow-xs active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-800">
                            {sc.title}
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">
                            {sc.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Sample: {sc.salary}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* TAB 3: Conversation History (AI Model Emerald Ribbon Style) */}
            {activeTab === "Conversation History" && (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #bbf7d0",
                  boxShadow: "0 4px 16px rgba(16, 185, 129, 0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.04) 100%)",
                    padding: "12px 16px",
                    borderBottom: "1px solid #d1fae5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        background: "#059669",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <History className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#065f46" }}>
                        Session History
                      </h3>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "#34d399" }}>
                        Active sandbox records
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="p-3 border border-emerald-200 bg-emerald-50/40 rounded-xl">
                    <div className="text-xs font-semibold text-emerald-900">
                      Active Sandbox Playground
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      {messages.length} messages exchanged in this test run
                    </div>
                  </div>
                  <button
                    onClick={handleResetChat}
                    className="w-full text-center text-xs text-rose-600 hover:text-rose-700 font-medium py-1.5 rounded-lg border border-rose-100 hover:bg-rose-50 transition cursor-pointer"
                  >
                    Clear Sandbox Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Format markdown tables, headers, bullet points, and inline formatting
 * without blowing out bubble dimensions or stretching container sizes.
 */
function renderMessageContent(content: string, isUser: boolean): React.ReactNode {
  if (isUser) {
    return <div className="whitespace-pre-line leading-relaxed break-words">{content}</div>;
  }

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let tableLines: string[] = [];
  let inTable = false;

  function flushTable(keyIndex: number) {
    if (tableLines.length === 0) return;

    const isPipe = tableLines[0].includes("|");
    const headerRow = tableLines[0];
    const dataRows = isPipe ? tableLines.slice(2) : tableLines.slice(1);
    const headers = isPipe
      ? headerRow.split("|").map((c) => c.trim()).filter(Boolean)
      : headerRow.split(",").map((c) => c.trim());

    elements.push(
      <div key={`table-${keyIndex}`} className="my-2.5 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs divide-y divide-slate-200">
          <thead className="bg-slate-50 text-slate-700 font-semibold">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {dataRows.map((row, rIdx) => {
              const cells = isPipe
                ? row.split("|").map((c) => c.trim()).filter(Boolean)
                : row.split(",").map((c) => c.trim());
              if (cells.length === 0) return null;
              return (
                <tr key={rIdx} className="hover:bg-blue-50/30 transition">
                  {cells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-1.5 text-[11px] text-slate-700 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableLines = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Identify table rows (pipe-delimited or CSV table format)
    const isPipeRow = trimmed.startsWith("|") && trimmed.endsWith("|");
    const isCsvHeader = !inTable && (
      (trimmed.startsWith("Company,") || trimmed.startsWith("Lender,")) &&
      trimmed.includes(",")
    );

    if (isPipeRow || (inTable && trimmed.includes("|")) || isCsvHeader || (inTable && trimmed.includes(",") && !trimmed.startsWith("#"))) {
      inTable = true;
      tableLines.push(trimmed);
      return;
    } else if (inTable) {
      flushTable(index);
      inTable = false;
    }

    if (!trimmed) {
      elements.push(<div key={`spacer-${index}`} className="h-1.5" />);
      return;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={`h3-${index}`} className="font-bold text-slate-900 mt-2 mb-1 text-xs">
          {trimmed.replace(/^###\s+/, "")}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h5 key={`h4-${index}`} className="font-semibold text-slate-800 mt-1.5 mb-0.5 text-xs">
          {trimmed.replace(/^####\s+/, "")}
        </h5>
      );
      return;
    }

    if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const bulletText = trimmed.replace(/^([•\-\*]\s+)/, "");
      elements.push(
        <div key={`bullet-${index}`} className="flex items-start gap-1.5 text-slate-700 my-0.5 pl-1">
          <span className="text-blue-500 font-bold shrink-0 leading-tight">•</span>
          <span>{formatInlineMarkdown(bulletText)}</span>
        </div>
      );
      return;
    }

    elements.push(
      <p key={`p-${index}`} className="my-1 text-slate-700 leading-relaxed">
        {formatInlineMarkdown(trimmed)}
      </p>
    );
  });

  if (inTable && tableLines.length > 0) {
    flushTable(lines.length);
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function formatInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className="text-slate-600 italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1 py-0.5 bg-slate-100 text-blue-700 rounded text-[11px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
