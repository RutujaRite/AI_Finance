"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ShieldCheck,
  Calculator,
  Sparkles,
  SquarePen,
  MessageSquare,
  Coins,
  CheckCircle2,
  Building2,
  Paperclip,
  ArrowUp,
  Zap,
  ChevronRight,
  Star,
  Shield,
  Sun,
  Moon,
  Bell,
  ChevronDown,
  Menu,
  X,
  LayoutDashboard,
  Check,
  Copy,
  Trash2,
  Bot,
  User as UserIcon,
  LogOut,
  Settings,
  HelpCircle,
  ExternalLink,
  Lock,
} from "lucide-react";
import {
  LoanEligibilitySheetCard,
  BankEligibilityRow,
  RecommendedBankData,
} from "@/components/eligibility/LoanEligibilitySheetCard";

// Dynamically import heavy calculators for embedded tabs
const EmiCalculator = dynamic(() => import("@/components/EmiCalculator"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading EMI Calculator...</span>
      </div>
    </div>
  ),
});

const EligibilityCalculatorView = dynamic(
  () => import("@/components/EligibilityCalculatorView"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading Eligibility Calculator...</span>
        </div>
      </div>
    ),
  }
);

export type DashboardTab = "assistant" | "emi" | "eligibility" | "admin";

interface ConversationItem {
  id: string;
  title: string;
  timestamp: string;
  dateStr?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "ai" | "assistant";
  content: string;
  timestamp: string;
}

const DEFAULT_CONVERSATIONS: ConversationItem[] = [
  {
    id: "conv-1",
    title: "Loan eligibility check",
    timestamp: "Oct 20",
    dateStr: "Oct 20",
  },
  {
    id: "conv-2",
    title: "Personal loan details",
    timestamp: "Oct 19",
    dateStr: "Oct 19",
  },
  {
    id: "conv-3",
    title: "Company information",
    timestamp: "Oct 18",
    dateStr: "Oct 18",
  },
  {
    id: "conv-4",
    title: "Bank policy query",
    timestamp: "Oct 16",
    dateStr: "Oct 16",
  },
  {
    id: "conv-5",
    title: "FOIR calculation",
    timestamp: "Oct 14",
    dateStr: "Oct 14",
  },
  {
    id: "conv-6",
    title: "HDFC vs ICICI comparison",
    timestamp: "Oct 10",
    dateStr: "Oct 10",
  },
  {
    id: "conv-7",
    title: "CIBIL cutoff scores",
    timestamp: "Oct 05",
    dateStr: "Oct 05",
  },
];

export default function CreditWiseDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<DashboardTab>("assistant");

  // User state
  const [user, setUser] = useState<{
    name: string;
    role: string;
    email: string;
  }>({
    name: "Rutuja Rite",
    role: "User",
    email: "rutuja.rite@creditwise.ai",
  });

  // UI state
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(3);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Chat state
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch persisted conversations for authenticated user from PostgreSQL
  async function fetchConversations() {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations)) {
          setConversations(
            data.conversations.map((c: any) => ({
              id: String(c.id),
              title: c.title || "Loan Assistant",
              timestamp: c.updatedAt
                ? new Date(c.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })
                : "Today",
              dateStr: c.updatedAt,
            }))
          );
        }
      }
    } catch (err) {
      console.warn("Could not fetch conversations:", err);
    }
  }

  // Load user profile & conversations on mount, and restore active chat if saved in session
  useEffect(() => {
    fetchConversations();
    try {
      const savedConvId = sessionStorage.getItem("creditwise_active_conv");
      if (savedConvId) {
        handleSelectConversation({ id: savedConvId, title: "Chat", timestamp: "" });
      }
    } catch {}
  }, []);

  // Read section param from URL if present
  useEffect(() => {
    const sec = searchParams?.get("section");
    if (sec === "emi") setActiveTab("emi");
    else if (sec === "eligibility") setActiveTab("eligibility");
    else setActiveTab("assistant");
  }, [searchParams]);

  // Sync theme
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkDark = () =>
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark" ||
      document.documentElement.getAttribute("data-bs-theme") === "dark" ||
      localStorage.getItem("theme") === "dark" ||
      localStorage.getItem("finai-theme") === "dark";

    const applyTheme = (isDark: boolean) => {
      const mode = isDark ? "dark" : "light";
      setTheme(mode);
      document.documentElement.setAttribute("data-theme", mode);
      document.documentElement.setAttribute("data-bs-theme", mode);
      if (mode === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme(checkDark());

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent?.detail?.theme) {
        applyTheme(customEvent.detail.theme === "dark");
      } else {
        applyTheme(checkDark());
      }
    };

    window.addEventListener("theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);

    // Try loading saved user if any
    try {
      const savedUser = localStorage.getItem("finai_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.name) {
          setUser({
            name: parsed.name,
            role: parsed.role || "User",
            email: parsed.email || "rutuja.rite@creditwise.ai",
          });
        }
      }
    } catch {}

    // Responsive initial sidebar collapse for mobile
    if (window.innerWidth < 1024) {
      setLeftSidebarOpen(false);
    }
    if (window.innerWidth < 1280) {
      setRightSidebarOpen(false);
    }

    return () => {
      window.removeEventListener("theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Theme toggle
  function handleToggleTheme() {
    const nextMode = theme === "light" ? "dark" : "light";
    setTheme(nextMode);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", nextMode);
      document.documentElement.setAttribute("data-bs-theme", nextMode);
      if (nextMode === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      try {
        localStorage.setItem("theme", nextMode);
        localStorage.setItem("finai-theme", nextMode);
        document.cookie = `theme=${nextMode}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
      window.dispatchEvent(new CustomEvent("theme-change", { detail: { theme: nextMode } }));
    }
  }

  // Handle auto-expanding input
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }

  // New Chat action
  function handleNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setInputMessage("");
    setAttachedFile(null);
    setSelectedBank(null);
    setSelectedBankId(null);
    try {
      sessionStorage.removeItem("creditwise_active_conv");
    } catch {}
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  // Select conversation from history
  async function handleSelectConversation(conv: { id: string; title?: string; timestamp?: string }) {
    setActiveConversationId(conv.id);
    try {
      sessionStorage.setItem("creditwise_active_conv", conv.id);
    } catch {}

    // Load real messages from database
    try {
      setIsLoading(true);
      const res = await fetch(`/api/conversations/${conv.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.selectedBank) {
            setSelectedBank(data.selectedBank);
          } else {
            setSelectedBank(null);
          }
          if (data.selectedBankId) {
            setSelectedBankId(data.selectedBankId);
          } else {
            setSelectedBankId(null);
          }
          if (Array.isArray(data.messages)) {
            setMessages(
              data.messages.map((m: any) => ({
                id: String(m.id || `msg-${Math.random()}`),
                role: m.role === "user" ? "user" : "ai",
                content: m.content || "",
                timestamp: m.timestamp
                  ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "Earlier",
              }))
            );
          } else {
            setMessages([]);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load conversation messages:", err);
    } finally {
      setIsLoading(false);
    }

    if (window.innerWidth < 1024) {
      setMobileDrawerOpen(false);
    }
  }

  // Delete conversation
  async function handleDeleteConversation(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/conversations/${convId}`, { method: "DELETE" });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeConversationId === convId) {
          handleNewChat();
        }
      }
    } catch (err) {
      console.warn("Failed to delete conversation:", err);
    }
  }

  // Bank selection action callback from LoanEligibilitySheetCard
  function handleBankSelect(bankName: string, bankId?: string) {
    setSelectedBank(bankName);
    if (bankId) setSelectedBankId(bankId);
    handleSendMessage(`I select ${bankName}`, {
      bankSelectionAction: {
        bankName,
        bankId: bankId || bankName.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      },
    });
  }

  // Send message to AI Assistant
  async function handleSendMessage(
    textToSend?: string,
    extraOptions?: {
      bankSelectionAction?: { bankName: string; bankId?: string };
    }
  ) {
    const rawText = (textToSend || inputMessage).trim();
    if ((!rawText && !attachedFile && !extraOptions?.bankSelectionAction) || isLoading) return;

    const userText = attachedFile
      ? `${rawText ? `${rawText}\n\n` : ""}📎 *Attached File: ${attachedFile.name}*`
      : rawText;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setAttachedFile(null);
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          conversation_id: activeConversationId,
          stream: true,
          bankSelectionAction: extraOptions?.bankSelectionAction,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const isSse = res.headers.get("content-type")?.includes("text/event-stream");

      if (isSse && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";
        const aiMsgId = `ai-${Date.now()}`;
        let placeholderCreated = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            const trimmed = block.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr);

              // Capture conversation_id from init or done event
              if (event.conversation_id) {
                const convIdStr = String(event.conversation_id);
                setActiveConversationId(convIdStr);
                try {
                  sessionStorage.setItem("creditwise_active_conv", convIdStr);
                } catch {}
              }

              if (event.type === "token" && event.text) {
                accumulatedText += event.text;
                if (!placeholderCreated) {
                  placeholderCreated = true;
                  setIsLoading(false);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: aiMsgId,
                      role: "ai",
                      content: accumulatedText,
                      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    },
                  ]);
                } else {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMsgId ? { ...msg, content: accumulatedText } : msg
                    )
                  );
                }
              } else if (event.type === "done") {
                if (event.selectedBank !== undefined) {
                  setSelectedBank(event.selectedBank);
                }
                if (event.selectedBankId !== undefined) {
                  setSelectedBankId(event.selectedBankId);
                }
                fetchConversations();
              }
            } catch {}
          }
        }
      } else {
        const data = await res.json();
        if (data.conversation_id) {
          const convIdStr = String(data.conversation_id);
          setActiveConversationId(convIdStr);
          try {
            sessionStorage.setItem("creditwise_active_conv", convIdStr);
          } catch {}
          fetchConversations();
        }

        if (data.selectedBank !== undefined) {
          setSelectedBank(data.selectedBank);
        }
        if (data.selectedBankId !== undefined) {
          setSelectedBankId(data.selectedBankId);
        }

        const reply =
          data.reply ||
          data.response ||
          data.message ||
          "I have processed your financial request. Let me know if you would like to explore specific bank terms or calculate EMI.";

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "ai",
            content: reply,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-err-${Date.now()}`,
            role: "ai",
            content:
              "I encountered a momentary connection issue. Please verify your loan details or try submitting again.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Copy helper
  async function handleCopy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans select-none antialiased">
      {/* =========================================================================
          1. GLOBAL SHELL & TOP NAVIGATION BAR
          ========================================================================= */}
      <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-30 transition-colors">
        {/* Left: Brand + Hamburger */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile drawer hamburger */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand Logo & Title */}
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("assistant");
            }}
            className="flex items-center gap-2.5 no-underline group cursor-pointer"
            title="CreditWise AI — Financial Intelligence"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight leading-tight flex items-center gap-1.5">
                CreditWise<span className="text-blue-600 dark:text-blue-400">AI</span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-none tracking-normal">
                Financial Intelligence
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Navigation Tabs */}
        <nav
          className="hidden md:flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs font-medium"
          aria-label="Dashboard views"
        >
          {/* Tab 1: AI Assistant */}
          <button
            type="button"
            onClick={() => setActiveTab("assistant")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "assistant"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-blue-200/80 dark:border-blue-800/80"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI Assistant</span>
          </button>

          {/* Tab 2: EMI Calculator */}
          <button
            type="button"
            onClick={() => setActiveTab("emi")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "emi"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-blue-200/80 dark:border-blue-800/80"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>EMI Calculator</span>
          </button>

          {/* Tab 3: Eligibility Calculator */}
          <button
            type="button"
            onClick={() => setActiveTab("eligibility")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "eligibility"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-blue-200/80 dark:border-blue-800/80"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Eligibility Calculator</span>
          </button>

          {/* Tab 4: Admin Dashboard */}
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all no-underline cursor-pointer"
            title="Open Admin Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Admin Dashboard</span>
          </Link>
        </nav>

        {/* Right: Theme Toggle + Notifications Bell + User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Light/Dark Theme Toggle (Sun icon) */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme mode"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Notifications Bell with unread badge */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs relative"
              title="Notifications"
              aria-label="Open notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>

            {/* Notifications Popover */}
            {notificationsOpen && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-fade-in text-xs font-sans">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">Notifications</span>
                  <button
                    type="button"
                    onClick={() => setUnreadNotifications(0)}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-64 overflow-y-auto">
                  <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <p className="font-medium text-slate-800 dark:text-slate-200 m-0">HDFC Bank Policy Update</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Updated standard ROI tiers to 9.25% for prime borrowers.</p>
                    <span className="text-[9px] text-slate-400 mt-1 block">15m ago</span>
                  </div>
                  <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <p className="font-medium text-slate-800 dark:text-slate-200 m-0">ICICI Escalation Directory</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Added 12 verified branch manager contacts in Pune zone.</p>
                    <span className="text-[9px] text-slate-400 mt-1 block">2h ago</span>
                  </div>
                  <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <p className="font-medium text-slate-800 dark:text-slate-200 m-0">New EMI Amortization Export</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Printable schedule feature enabled with PDF export.</p>
                    <span className="text-[9px] text-slate-400 mt-1 block">1d ago</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs"
              aria-label="User profile menu"
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                RR
              </div>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {user.name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {user.role}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ml-0.5" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-fade-in text-xs font-sans">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-white">{user.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
                  <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {user.role} Profile
                  </span>
                </div>

                <div className="py-1 border-b border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("assistant");
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <Bot className="w-3.5 h-3.5 text-blue-600" />
                    <span>AI Assistant</span>
                  </button>
                  <Link
                    href="/admin"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left no-underline"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Admin Dashboard</span>
                  </Link>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      try {
                        localStorage.removeItem("emi_chat_state_v2");
                        localStorage.removeItem("finai_user");
                      } catch {}
                      router.push("/?logout=true");
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. MAIN CONTENT AREA (Tab views)
          ========================================================================= */}
      {activeTab === "emi" && (
        <div className="flex-1 overflow-y-auto">
          <EmiCalculator user={user} embedded={true} />
        </div>
      )}

      {activeTab === "eligibility" && (
        <div className="flex-1 overflow-y-auto">
          <EligibilityCalculatorView user={user} embedded={true} />
        </div>
      )}

      {activeTab === "assistant" && (
        <div className="flex-1 flex overflow-hidden relative">
          {/* ---------------------------------------------------------------------
              COLUMN A: LEFT SIDEBAR (Collapsible / Fixed ~270px)
              --------------------------------------------------------------------- */}
          <aside
            className={`${
              leftSidebarOpen ? "w-[270px]" : "w-0 -translate-x-full"
            } transition-all duration-250 ease-in-out shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm flex flex-col justify-between overflow-hidden z-10`}
          >
            <div className="p-3.5 flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Top button: Full-width vibrant blue "New Chat" button with pen/edit icon */}
              <button
                type="button"
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98] transition-all cursor-pointer border-0 shrink-0"
              >
                <SquarePen className="w-4 h-4" />
                <span>New Chat</span>
              </button>

              {/* Chat History Section */}
              <div className="mt-4 flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Chat History
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {conversations.length}
                  </span>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
                  {conversations.length === 0 ? (
                    <div className="py-6 px-2 text-center text-slate-400 dark:text-slate-500 text-xs">
                      <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      <p className="m-0 font-medium">No previous chats</p>
                      <p className="m-0 text-[10px] mt-0.5 opacity-80">Start a new conversation above</p>
                    </div>
                  ) : (
                    conversations.map((conv) => {
                      const isActive = activeConversationId === conv.id;
                      return (
                        <div
                          key={conv.id}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer group ${
                            isActive
                              ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-medium border border-blue-200/80 dark:border-blue-800/80 shadow-2xs"
                              : "hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent"
                          }`}
                          onClick={() => handleSelectConversation(conv)}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <MessageSquare
                              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                                isActive
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs truncate leading-snug m-0">{conv.title}</p>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                                {conv.timestamp}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shrink-0 ml-1"
                            title="Delete Chat"
                            aria-label="Delete chat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Bottom Card: "Need help?" banner card with sparkle icon */}
              <div className="mt-3 p-3 rounded-2xl bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-purple-50/80 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 border border-blue-200/70 dark:border-blue-800/60 shrink-0">
                <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-semibold text-xs mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
                  <span>Need help?</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed m-0">
                  Ask anything about loans, policies, or company details. I&apos;m here to help!
                </p>
              </div>
            </div>
          </aside>

          {/* ---------------------------------------------------------------------
              COLUMN B: CENTER MAIN WORKSPACE (Chat / Assistant View)
              --------------------------------------------------------------------- */}
          <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950/50 relative overflow-hidden">
            {/* Messages Scroll Container */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
              {messages.length === 0 ? (
                <div className="max-w-3xl mx-auto flex flex-col items-center pt-2 sm:pt-6">
                  {/* Welcome banner */}
                  <div className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-6 sm:p-8 shadow-xl shadow-blue-500/15 border border-blue-400/30">
                    {/* Background subtle radial flares */}
                    <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
                      {/* Left: 3D Bot Avatar + Greeting */}
                      <div className="flex items-start gap-4">
                        {/* 3D-styled cute bot avatar graphic */}
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-white/25 to-white/5 backdrop-blur-md border border-white/30 p-2 flex items-center justify-center shadow-inner shrink-0 group">
                          <svg
                            viewBox="0 0 72 72"
                            className="w-full h-full drop-shadow-md transition-transform group-hover:scale-105"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            {/* Antenna */}
                            <path d="M36 6V14" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="36" cy="6" r="3.5" fill="#60A5FA" />
                            <circle cx="36" cy="6" r="2" fill="#FFFFFF" />
                            {/* Head outer */}
                            <rect x="14" y="14" width="44" height="38" rx="14" fill="url(#botHeadGrad)" stroke="#DBEAFE" strokeWidth="2" />
                            {/* Face Screen */}
                            <rect x="20" y="22" width="32" height="22" rx="8" fill="#0F172A" />
                            {/* Eyes (glow cyan) */}
                            <circle cx="28" cy="33" r="3.5" fill="#38BDF8" />
                            <circle cx="29" cy="32" r="1.2" fill="#FFFFFF" />
                            <circle cx="44" cy="33" r="3.5" fill="#38BDF8" />
                            <circle cx="45" cy="32" r="1.2" fill="#FFFFFF" />
                            {/* Smile */}
                            <path d="M32 38C34 40 38 40 40 38" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
                            {/* Ear Nodes */}
                            <rect x="10" y="28" width="4" height="10" rx="2" fill="#93C5FD" />
                            <rect x="58" y="28" width="4" height="10" rx="2" fill="#93C5FD" />
                            {/* Gradients */}
                            <defs>
                              <linearGradient id="botHeadGrad" x1="14" y1="14" x2="58" y2="52" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#FFFFFF" />
                                <stop offset="0.6" stopColor="#E0E7FF" />
                                <stop offset="1" stopColor="#C7D2FE" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>

                        <div className="text-center sm:text-left">
                          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white m-0">
                            Hello {user.name.split(" ")[0]}! 👋 How can I help you today?
                          </h1>
                          <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed mt-2 max-w-md m-0">
                            Get loan eligibility, check bank policies, find company details or ask anything about your financial journey.
                          </p>
                        </div>
                      </div>

                      {/* Right: Decorative vector illustration (document, shield, stacked financial coins) */}
                      <div className="hidden md:flex shrink-0 w-28 h-24 items-center justify-center relative">
                        <svg viewBox="0 0 120 100" fill="none" className="w-full h-full drop-shadow-lg" xmlns="http://www.w3.org/2000/svg">
                          {/* Floating document */}
                          <g transform="rotate(-6 50 40)">
                            <rect x="25" y="15" width="45" height="58" rx="8" fill="white" fillOpacity="0.95" />
                            <line x1="33" y1="26" x2="55" y2="26" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
                            <line x1="33" y1="35" x2="62" y2="35" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                            <line x1="33" y1="42" x2="58" y2="42" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
                            <line x1="33" y1="49" x2="52" y2="49" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
                          </g>

                          {/* Glowing Security Shield */}
                          <g transform="translate(62, 22)">
                            <path d="M18 4L32 10V22C32 30 26 38 18 42C10 38 4 30 4 22V10L18 4Z" fill="#3B82F6" stroke="#DBEAFE" strokeWidth="2" />
                            <path d="M13 22L17 26L24 19" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </g>

                          {/* Stacked Financial Gold Coins */}
                          <g transform="translate(18, 52)">
                            {/* Coin 1 */}
                            <ellipse cx="25" cy="30" rx="18" ry="6" fill="#F59E0B" />
                            <ellipse cx="25" cy="28" rx="18" ry="6" fill="#FBBF24" />
                            <ellipse cx="25" cy="28" rx="14" ry="4.5" fill="#FDE68A" />
                            {/* Coin 2 */}
                            <ellipse cx="25" cy="22" rx="18" ry="6" fill="#F59E0B" />
                            <ellipse cx="25" cy="20" rx="18" ry="6" fill="#FBBF24" />
                            <ellipse cx="25" cy="20" rx="14" ry="4.5" fill="#FDE68A" />
                            {/* Coin 3 */}
                            <ellipse cx="25" cy="14" rx="18" ry="6" fill="#F59E0B" />
                            <ellipse cx="25" cy="12" rx="18" ry="6" fill="#FBBF24" />
                            <ellipse cx="25" cy="12" rx="14" ry="4.5" fill="#FDE68A" />
                          </g>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Quick Prompt Cards (2x2 grid) */}
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-6">
                    {/* Prompt 1 */}
                    <button
                      type="button"
                      onClick={() => handleSendMessage("Calculate EMI for a loan of 500000 at 9.5% for 60 months")}
                      className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all text-left cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Calculator className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors m-0">
                          Calculate 5L EMI at 9.5%
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5 truncate">
                          Quick principal & monthly repayment breakdown
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Prompt 2 */}
                    <button
                      type="button"
                      onClick={() => handleSendMessage("Tell me about loan processing fees across partner banks")}
                      className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md transition-all text-left cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Coins className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors m-0">
                          Loan processing fees
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5 truncate">
                          Compare charges, waiver rules & GST
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Prompt 3 */}
                    <button
                      type="button"
                      onClick={() => handleSendMessage("I want to check my personal loan eligibility")}
                      className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition-all text-left cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors m-0">
                          Check loan eligibility
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5 truncate">
                          Multi-bank policy evaluation & CIBIL criteria
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Prompt 4 */}
                    <button
                      type="button"
                      onClick={() => handleSendMessage("Give me ICICI bank manager details in Pune")}
                      className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-md transition-all text-left cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors m-0">
                          ICICI bank manager in Pune
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5 truncate">
                          Branch escalation contacts & local address
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-4">
                  {messages.map((msg) => {
                    const isUser = msg.role === "user";
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 items-start ${isUser ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                            isUser
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white shadow-xs"
                          }`}
                        >
                          {isUser ? "RR" : <Bot className="w-4 h-4" />}
                        </div>

                        {/* Message Bubble */}
                        {(() => {
                          const hasEligibilityTable =
                            !isUser &&
                            (/\|\s*Bank Name\s*\|\s*Eligibility Status/i.test(msg.content) ||
                              (/\|\s*Bank\s*\|/i.test(msg.content) &&
                                /\|\s*Status\s*\|/i.test(msg.content) &&
                                /\|\s*Action\s*\|/i.test(msg.content)));

                          return (
                            <div
                              className={`${
                                hasEligibilityTable
                                  ? "w-full max-w-full sm:max-w-[96%] lg:max-w-[94%]"
                                  : "max-w-[85%] sm:max-w-[75%]"
                              } flex flex-col ${isUser ? "items-end" : "items-start"}`}
                            >
                              <div
                                className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                                  isUser
                                    ? "bg-blue-600 text-white rounded-tr-xs shadow-xs"
                                    : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200 dark:border-slate-800 shadow-xs"
                                }`}
                              >
                                <div className="w-full font-sans break-words">
                                  {renderMessageContent(msg.content, isUser, selectedBank, handleBankSelect)}
                                </div>
                              </div>

                              {/* Meta & Copy */}
                              <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400 dark:text-slate-500">
                                <span>{msg.timestamp}</span>
                                {!isUser && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(msg.content, msg.id)}
                                    className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                    title="Copy response"
                                  >
                                    {copiedId === msg.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-500" />
                                        <span className="text-emerald-500">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}

                  {isLoading && (
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        <Bot className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-tl-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Bottom Chat Input Dock */}
            <div className="shrink-0 p-3 sm:p-5 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-slate-950 dark:via-slate-950/95 dark:to-transparent z-10">
              <div className="max-w-3xl mx-auto flex flex-col items-center">
                {/* Attached file chip */}
                {attachedFile && (
                  <div className="w-full mb-2 flex items-center gap-2 p-1.5 px-3 rounded-lg bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="truncate flex-1 font-medium">{attachedFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Floating, rounded pill-shaped input dock */}
                <div className="w-full flex items-center gap-2 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-700/80 px-2 sm:px-3 py-1.5 shadow-lg shadow-slate-200/50 dark:shadow-slate-950/50 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setAttachedFile(e.target.files[0]);
                    }}
                  />

                  {/* Paperclip attachment button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Attach document or policy file"
                    aria-label="Attach file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Input field */}
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Message AI Assistant..."
                    className="flex-1 bg-transparent border-0 outline-hidden resize-none text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 py-1.5 max-h-32 min-h-[24px]"
                  />

                  {/* Circular blue send button with arrow icon */}
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={(!inputMessage.trim() && !attachedFile) || isLoading}
                    className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-xs cursor-pointer shrink-0"
                    title="Send message"
                    aria-label="Send message"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>

                {/* Disclaimer footer text below input */}
                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-2 m-0">
                  AI can make mistakes. Please verify important loan and policy details.
                </p>
              </div>
            </div>
          </main>

          {/* ---------------------------------------------------------------------
              COLUMN C: RIGHT SIDEBAR (Widgets & Quick Actions ~290px)
              --------------------------------------------------------------------- */}
          <aside
            className={`${
              rightSidebarOpen ? "w-[290px]" : "w-0 translate-x-full"
            } transition-all duration-250 ease-in-out shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm p-3.5 flex flex-col gap-3.5 overflow-y-auto z-10 hidden xl:flex`}
          >
            {/* Card 1: Quick Actions (Lightning bolt icon) */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-200 mb-2.5">
                <div className="w-5 h-5 rounded-md bg-amber-50 dark:bg-amber-950/80 text-amber-500 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                </div>
                <span>Quick Actions</span>
              </div>

              <div className="space-y-1">
                {/* Row 1: Check Eligibility */}
                <button
                  type="button"
                  onClick={() => setActiveTab("eligibility")}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs text-slate-700 dark:text-slate-300 font-medium group cursor-pointer"
                >
                  <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Check Eligibility
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Row 2: EMI Calculator */}
                <button
                  type="button"
                  onClick={() => setActiveTab("emi")}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs text-slate-700 dark:text-slate-300 font-medium group cursor-pointer"
                >
                  <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    EMI Calculator
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Row 3: Bank Policy Search */}
                <button
                  type="button"
                  onClick={() => handleSendMessage("What are the bank policy criteria for personal loans?")}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs text-slate-700 dark:text-slate-300 font-medium group cursor-pointer"
                >
                  <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Bank Policy Search
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Row 4: Find Bank Manager */}
                <button
                  type="button"
                  onClick={() => handleSendMessage("Show me bank managers and branch escalation contacts in my city")}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs text-slate-700 dark:text-slate-300 font-medium group cursor-pointer"
                >
                  <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Find Bank Manager
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

            {/* Card 2: Popular Queries (Star icon) */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-200 mb-2.5">
                <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-500 flex items-center justify-center">
                  <Star className="w-3.5 h-3.5 fill-current" />
                </div>
                <span>Popular Queries</span>
              </div>

              <div className="space-y-1.5">
                {[
                  { text: "Personal Loan Eligibility", prompt: "Explain personal loan eligibility requirements" },
                  { text: "Home Loan Process", prompt: "What is the step by step home loan approval process?" },
                  { text: "Required Documents", prompt: "What KYC and income documents are required for a loan?" },
                  { text: "CIBIL Score Impact", prompt: "How does CIBIL score affect interest rate and loan amount?" },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="w-full flex items-center gap-2 p-1.5 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="truncate">{item.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card 3: Your Data is Secure */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span className="font-semibold text-xs text-emerald-900 dark:text-emerald-300">
                  Your Data is Secure
                </span>
              </div>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 leading-relaxed m-0">
                We use industry-standard security to protect your information.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* =========================================================================
          4. MOBILE DRAWER NAVIGATION (Responsive off-canvas)
          ========================================================================= */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[80vw] bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col p-4 z-10 text-xs font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white">CreditWise AI</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("assistant");
                  setMobileDrawerOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left ${
                  activeTab === "assistant"
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 font-semibold"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                <Bot className="w-4 h-4" />
                <span>AI Assistant</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("emi");
                  setMobileDrawerOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left ${
                  activeTab === "emi"
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 font-semibold"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>EMI Calculator</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("eligibility");
                  setMobileDrawerOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left ${
                  activeTab === "eligibility"
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 font-semibold"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Eligibility Calculator</span>
              </button>

              <Link
                href="/admin"
                onClick={() => setMobileDrawerOpen(false)}
                className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-700 dark:text-slate-300 no-underline"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Admin Dashboard</span>
              </Link>
            </div>

            <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  RR
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{user.name}</div>
                  <div className="text-[10px] text-slate-400">{user.role}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleTheme}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white"
                title="Toggle Theme"
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Formats inline text with robust bold formatting wherever star (*) characters appear,
 * such as **bold**, *bold*, ***bold***, and inline code `code`.
 */
function formatInlineMarkdown(text: string, isUser: boolean): React.ReactNode {
  if (!text) return null;

  // Split text by bold markers (1-3 asterisks) or inline code
  const parts = text.split(/(\*{1,3}[^*]+?\*{1,3}|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (!part) return null;

    // Check for bold wrapped in asterisks (*, **, ***)
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      const inner = part.replace(/^\*+/, "").replace(/\*+$/, "");
      return (
        <strong
          key={i}
          className={
            isUser
              ? "font-bold text-white underline decoration-white/30"
              : "font-bold text-slate-900 dark:text-white"
          }
        >
          {inner}
        </strong>
      );
    }

    // Check for inline code
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-[11px] border border-slate-200 dark:border-slate-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

/**
 * Parses a Recommended Bank markdown block from dynamic eligibility output.
 */
function parseRecommendedBank(content: string): RecommendedBankData | null {
  const recMatch = content.match(
    /(?:###\s*(?:🌟\s*)?Recommended Bank|RECOMMENDED BANK)([\s\S]*?)(?:---|\n###\s*📋|\n###\s*[A-Z]|\|)/i
  );
  if (!recMatch) return null;
  const block = recMatch[1];

  const nameMatch = block.match(/\*\*([^*]+)\*\*/);
  const bankName = nameMatch ? nameMatch[1].trim() : "";
  if (!bankName) return null;

  const amountMatch = block.match(/Estimated Eligible Amount\*?:\s*([^\n\r]+)/i);
  const amount = amountMatch ? amountMatch[1].replace(/\*\*/g, "").trim() : "Not available";

  const rateMatch = block.match(/Interest Rate\*?:\s*([^\n\r]+)/i);
  const roi = rateMatch ? rateMatch[1].replace(/\*\*/g, "").trim() : "Not available";

  const tenureMatch = block.match(/Tenure\*?:\s*([^\n\r]+)/i);
  const tenure = tenureMatch ? tenureMatch[1].replace(/\*\*/g, "").trim() : undefined;

  const whyMatch = block.match(/Why recommended\*?:\s*([^\n\r]+)/i);
  const reason = whyMatch ? whyMatch[1].replace(/\*\*/g, "").trim() : "";

  const statusMatch = block.match(/Eligibility\*?:\s*([^\n\r]+)/i);
  const status = statusMatch ? statusMatch[1].replace(/✅|\*\*|\*/g, "").trim() : "Eligible";

  return {
    bankName,
    bankId: bankName.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    status: status || "Eligible",
    isEligible: !status.toLowerCase().includes("not eligible"),
    amount,
    roi,
    tenure,
    reason,
  };
}

/**
 * Full message content parser supporting paragraphs, headings, bullet lists,
 * numbered/lettered points, markdown tables, blockquotes, bold formatting,
 * and the rich Loan Eligibility Sheet with recommended bank & individual select actions.
 */
function renderMessageContent(
  content: string,
  isUser: boolean,
  selectedBank?: string | null,
  onSelectBank?: (bankName: string, bankId?: string) => void
): React.ReactNode {
  if (isUser) {
    return (
      <div className="whitespace-pre-line leading-relaxed break-words">
        {formatInlineMarkdown(content, true)}
      </div>
    );
  }

  const hasEligibilityTable =
    /\|\s*Bank Name\s*\|\s*Eligibility Status/i.test(content) ||
    (/\|\s*Bank\s*\|/i.test(content) && /\|\s*Status\s*\|/i.test(content) && /\|\s*Action\s*\|/i.test(content));

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let tableLines: string[] = [];
  let inTable = false;
  let skippingRecommendedBlock = false;

  function flushTable(keyIndex: number) {
    if (tableLines.length === 0) return;

    // Filter out separator lines like |---|---|
    const nonSeparatorRows = tableLines.filter(
      (l) => !l.replace(/\s+/g, "").match(/^\|[-:]+\|[-:|]*$/)
    );
    if (nonSeparatorRows.length === 0) {
      tableLines = [];
      return;
    }

    const headerRow = nonSeparatorRows[0];
    const dataRows = nonSeparatorRows.slice(1);
    const headers = headerRow.split("|").map((c) => c.trim()).filter(Boolean);

    // Check if this table is the Loan Eligibility Sheet
    const isEligibilityTable =
      headers.some((h) => /bank/i.test(h)) &&
      headers.some((h) => /status|eligib/i.test(h)) &&
      (headers.some((h) => /action/i.test(h)) || headers.some((h) => /amount/i.test(h)) || headers.length >= 6);

    if (isEligibilityTable) {
      const parsedRec = parseRecommendedBank(content);
      const banks: BankEligibilityRow[] = dataRows.map((row) => {
        const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
        const bankName = cells[0]?.replace(/\*\*/g, "").trim() || "Unknown Lender";
        const statusRaw = cells[1]?.replace(/\*\*/g, "").trim() || "";
        const isEligible = statusRaw.toLowerCase().includes("eligible") && !statusRaw.toLowerCase().includes("not eligible");
        const amount = cells[2]?.trim() || "—";
        const roi = cells[3]?.trim() || "—";
        const tenure = cells[4]?.trim() || "—";
        const reason = cells[5]?.trim() || "—";

        return {
          bankName,
          bankId: bankName.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          status: isEligible ? "Eligible" : statusRaw.includes("Review") ? "Needs Review" : "Not Eligible",
          isEligible,
          amount,
          roi,
          tenure,
          reason,
        };
      });

      const effectiveRec =
        parsedRec ||
        (banks.find((b) => b.isEligible)
          ? {
              bankName: banks.find((b) => b.isEligible)!.bankName,
              bankId: banks.find((b) => b.isEligible)!.bankId,
              status: "Eligible",
              isEligible: true,
              amount: banks.find((b) => b.isEligible)!.amount,
              roi: banks.find((b) => b.isEligible)!.roi,
              tenure: banks.find((b) => b.isEligible)!.tenure,
              reason: banks.find((b) => b.isEligible)!.reason,
            }
          : null);

      elements.push(
        <LoanEligibilitySheetCard
          key={`eligibility-sheet-${keyIndex}`}
          recommendedBank={effectiveRec}
          banks={banks}
          selectedBank={selectedBank}
          onSelectBank={onSelectBank}
        />
      );
      tableLines = [];
      return;
    }

    elements.push(
      <div
        key={`table-${keyIndex}`}
        className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs"
      >
        <table className="min-w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                  {formatInlineMarkdown(h, false)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {dataRows.map((row, rIdx) => {
              const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
              if (cells.length === 0) return null;
              return (
                <tr key={rIdx} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-colors">
                  {cells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatInlineMarkdown(cell, false)}
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

    // Table detection: line starts and ends with pipe |
    const isPipeRow = trimmed.startsWith("|") && (trimmed.endsWith("|") || trimmed.includes("|"));

    if (isPipeRow) {
      inTable = true;
      skippingRecommendedBlock = false;
      tableLines.push(trimmed);
      return;
    } else if (inTable) {
      flushTable(index);
      inTable = false;
    }

    // If an eligibility table is present, skip the text representation of the recommended block
    // and the "Full Partner Bank Eligibility Sheet" heading since it's displayed inside the card
    if (hasEligibilityTable) {
      if (
        trimmed.startsWith("### 🌟 Recommended Bank") ||
        trimmed.startsWith("### Recommended Bank") ||
        trimmed.startsWith("RECOMMENDED BANK")
      ) {
        skippingRecommendedBlock = true;
        return;
      }
      if (trimmed.startsWith("### 📋 Full Partner Bank Eligibility Sheet")) {
        skippingRecommendedBlock = false;
        return;
      }
      if (skippingRecommendedBlock) {
        if (trimmed === "---" || trimmed.startsWith("### ")) {
          skippingRecommendedBlock = false;
        } else {
          return;
        }
      }
    }

    // Empty lines
    if (!trimmed) {
      elements.push(<div key={`spacer-${index}`} className="h-1.5" />);
      return;
    }

    // Horizontal Rule: --- or ***
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      elements.push(
        <hr key={`hr-${index}`} className="my-3 border-t border-slate-200 dark:border-slate-800" />
      );
      return;
    }

    // Headings: ###, ##, #
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={`h3-${index}`} className="font-bold text-slate-900 dark:text-white mt-3 mb-1 text-sm tracking-tight">
          {formatInlineMarkdown(trimmed.replace(/^###\s+/, ""), false)}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={`h2-${index}`} className="font-bold text-slate-900 dark:text-white mt-3.5 mb-1.5 text-base tracking-tight">
          {formatInlineMarkdown(trimmed.replace(/^##\s+/, ""), false)}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={`h1-${index}`} className="font-extrabold text-slate-900 dark:text-white mt-4 mb-2 text-lg tracking-tight">
          {formatInlineMarkdown(trimmed.replace(/^#\s+/, ""), false)}
        </h2>
      );
      return;
    }

    // Blockquote: > text
    if (trimmed.startsWith("> ")) {
      elements.push(
        <div key={`quote-${index}`} className="my-2 pl-3 border-l-2 border-blue-500 text-slate-600 dark:text-slate-300 italic text-xs leading-relaxed bg-blue-50/30 dark:bg-blue-950/20 py-1 rounded-r-lg">
          {formatInlineMarkdown(trimmed.replace(/^>\s+/, ""), false)}
        </div>
      );
      return;
    }

    // Bullet points: - item, * item, • item
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      const bulletContent = trimmed.replace(/^([-*•])\s+/, "");
      elements.push(
        <div key={`bullet-${index}`} className="flex items-start gap-2 my-0.5 pl-1 text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-2 shrink-0" />
          <div className="flex-1">{formatInlineMarkdown(bulletContent, false)}</div>
        </div>
      );
      return;
    }

    // Numbered or lettered lists like "1. ", "a) ", "b) "
    const listMatch = trimmed.match(/^([a-z]\)|\d+\.)\s+(.+)$/i);
    if (listMatch) {
      elements.push(
        <div key={`numlist-${index}`} className="flex items-start gap-2 my-0.5 pl-1 text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed">
          <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0 min-w-[18px]">{listMatch[1]}</span>
          <div className="flex-1">{formatInlineMarkdown(listMatch[2], false)}</div>
        </div>
      );
      return;
    }

    // Standard paragraph
    elements.push(
      <p key={`p-${index}`} className="my-1 text-slate-700 dark:text-slate-200 leading-relaxed text-xs sm:text-sm m-0">
        {formatInlineMarkdown(trimmed, false)}
      </p>
    );
  });

  if (inTable && tableLines.length > 0) {
    flushTable(lines.length);
  }

  return <div className="space-y-0.5">{elements}</div>;
}

