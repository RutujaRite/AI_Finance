"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  LayoutGrid,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  Home,
  LayoutDashboard,
  ArrowLeft,
  LogOut,
  Bot,
  Users,
  MessageSquare,
  Calculator,
  FileText,
  Menu,
  X,
  Building,
  Cpu,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminHeaderProps {
  user?: any;
  title?: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  showBreadcrumbs?: boolean;
  showBackToWorkspace?: boolean;
}

export default function AdminHeader({
  user,
  title,
  description,
  breadcrumbs = [],
  actions,
  showBreadcrumbs = true,
  showBackToWorkspace = false,
}: AdminHeaderProps) {
  const router = useRouter();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync theme state on mount & listen to changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTheme = () => {
      const isDarkMode =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "dark" ||
        document.documentElement.getAttribute("data-bs-theme") === "dark" ||
        localStorage.getItem("theme") === "dark" ||
        localStorage.getItem("creditwise_theme") === "dark" ||
        localStorage.getItem("finai-theme") === "dark";
      setIsDark(isDarkMode);
    };

    syncTheme();
    window.addEventListener("theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  function handleToggleTheme() {
    const nextDark = !isDark;
    setIsDark(nextDark);
    const mode = nextDark ? "dark" : "light";
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", mode);
      document.documentElement.setAttribute("data-bs-theme", mode);
      if (nextDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      try {
        document.cookie = `theme=${mode}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
    }
    try {
      localStorage.setItem("theme", mode);
      localStorage.setItem("creditwise_theme", mode);
      localStorage.setItem("finai-theme", mode);
    } catch {}
    window.dispatchEvent(new CustomEvent("theme-change", { detail: { theme: mode } }));
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setProfileDropdownOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    try {
      localStorage.removeItem("emi_chat_state_v2");
      localStorage.removeItem("finai_user");
      sessionStorage.clear();
    } catch {}
    router.push("/?logout=true");
  }

  const userName =
    user?.name ||
    user?.username ||
    (user?.email ? user.email.split("@")[0] : "Administrator");

  const userInitial = userName.charAt(0).toUpperCase() || "A";

  return (
    <>
      {/* 1. TOP NAVIGATION BAR */}
      <header className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6 border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 sticky top-0 z-30 font-sans shadow-2xs transition-colors">
        {/* Left: Hamburger + Brand Group */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* YouTube-style Hamburger Button on far left (Visible on mobile/tablet) */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden p-1.5 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Open Admin Navigation Menu"
            title="Admin Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/admin" className="flex items-center gap-2 sm:gap-2.5 no-underline group" title="CreditWise Admin Overview">
            {/* Logo Icon */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>

            {/* Brand text & Badge */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight">
                  CreditWise AI
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase">
                  Admin
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                Financial SaaS Management Suite
              </span>
            </div>
          </Link>

          {/* Quick Nav directly to Main App Workspace (Desktop only) */}
          <nav className="hidden lg:flex items-center gap-1 ml-4 pl-4 border-l border-slate-200 dark:border-slate-800 text-xs">
            <Link
              href="/home"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              title="Application Dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/home?section=assistant"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors no-underline"
              title="AI Assistant"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>AI Assistant</span>
            </Link>
            <Link
              href="/home?section=emi"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors no-underline"
              title="EMI Calculator"
            >
              <Calculator className="w-3.5 h-3.5 text-slate-400" />
              <span>EMI Calc</span>
            </Link>
            <Link
              href="/home?section=eligibility"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors no-underline"
              title="Eligibility Calculator"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Eligibility</span>
            </Link>
          </nav>
        </div>

        {/* Right: Actions Group (Theme Toggle & User Profile only) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Theme Toggle Button (Sun/Moon) */}
          <button
            type="button"
            onClick={handleToggleTheme}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle dark mode"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-spin-once" />
            ) : (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
            )}
          </button>

          {/* YouTube-style Circular Admin Profile Avatar on FAR RIGHT */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold ring-2 ring-slate-200 dark:ring-slate-700 hover:ring-blue-400 transition-all cursor-pointer shadow-xs shrink-0"
              aria-label="User profile menu"
              title={`${userName} (Administrator)`}
            >
              {userInitial}
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 shadow-xl py-1.5 z-50 text-xs font-sans animate-fade-in">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-white text-sm">
                    {userName}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs truncate mt-0.5">
                    {user?.email || "admin@creditwise.ai"}
                  </div>
                  <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-semibold">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Admin Workspace</span>
                  </div>
                </div>

                {/* Return directly to Dashboard */}
                <div className="py-1 border-b border-slate-100 dark:border-slate-800 bg-blue-50/40 dark:bg-blue-950/20">
                  <Link
                    href="/home"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 text-xs font-semibold no-underline transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Dashboard Workspace</span>
                    <span className="ml-auto text-[10px] font-medium bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">Main App</span>
                  </Link>
                </div>

                {/* Core App Navigation Shortcuts */}
                <div className="py-1 border-b border-slate-100 dark:border-slate-800">
                  <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Main Application</div>
                  <Link
                    href="/home?section=assistant"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium no-underline transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>AI Assistant Workspace</span>
                  </Link>

                  <Link
                    href="/home?section=emi"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium no-underline transition-colors"
                  >
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    <span>EMI Calculator</span>
                  </Link>

                  <Link
                    href="/home?section=eligibility"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium no-underline transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Eligibility Calculator</span>
                  </Link>

                  <Link
                    href="/home?section=policies"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium no-underline transition-colors"
                  >
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>Bank Policies</span>
                  </Link>
                </div>

                {/* Admin Management Shortcuts */}
                <div className="py-1">
                  <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Admin Suite</div>
                  <Link
                    href="/admin"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium no-underline transition-colors"
                  >
                    <LayoutGrid className="w-4 h-4 text-blue-600" />
                    <span>Admin Dashboard</span>
                  </Link>

                  <Link
                    href="/admin/users"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium no-underline transition-colors"
                  >
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>User Accounts</span>
                  </Link>

                  <Link
                    href="/agent-studio"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium no-underline transition-colors"
                  >
                    <Bot className="w-4 h-4 text-sky-600" />
                    <span>AI Agent Configuration</span>
                  </Link>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-2 flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold cursor-pointer text-left border-0 bg-transparent transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. BREADCRUMBS & PAGE HEADER SECTION (Optional / Sub-pages) */}
      {showBreadcrumbs && (title || breadcrumbs.length > 0) && (
        <section className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-4 sm:px-8 py-3.5 sm:py-4 font-sans shadow-xs transition-colors">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              {/* Breadcrumb Navigation: Dashboard > Admin Overview > Subpage */}
              <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                <Link
                  href="/home"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold inline-flex items-center gap-1 hover:underline no-underline"
                  title="Return to Application Dashboard"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Dashboard</span>
                </Link>

                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />

                <Link
                  href="/admin"
                  className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium inline-flex items-center gap-1 hover:underline no-underline"
                  title="Admin Dashboard Overview"
                >
                  <LayoutGrid className="w-3 h-3 text-slate-500" />
                  <span>Admin Overview</span>
                </Link>

                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />

                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="text-blue-600 dark:text-blue-400 font-medium hover:underline no-underline truncate max-w-[160px]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[180px]">{crumb.label}</span>
                    )}
                    {idx < breadcrumbs.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </React.Fragment>
                ))}

                {breadcrumbs.length === 0 && title && (
                  <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[200px]">{title}</span>
                )}
              </nav>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Dedicated Back Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined" && window.history.length > 1) {
                      router.back();
                    } else {
                      router.push("/admin");
                    }
                  }}
                  title="Go Back"
                  aria-label="Navigate back"
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                {title && (
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight m-0">
                    {title}
                  </h1>
                )}
              </div>
              {description && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 sm:ml-8 m-0 leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-2 shrink-0">

              {/* Back to Admin Overview */}
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 shadow-2xs rounded-lg transition-all no-underline cursor-pointer"
                title="Return to Admin Overview"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Admin Overview</span>
              </Link>

              {actions}
            </div>
          </div>
        </section>
      )}

      {/* Off-canvas mobile navigation drawer backdrop */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 transition-opacity"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Off-canvas mobile navigation drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[280px] sm:w-[320px] max-w-[85vw] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 z-50 shadow-2xl flex flex-col transition-transform duration-250 ease-out font-sans ${
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">CreditWise AI</div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">Admin Management</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Quick Theme Toggle Card inside Drawer */}
          <div className="px-1">
            <button
              type="button"
              onClick={handleToggleTheme}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2">
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
                <span>{isDark ? "Dark Theme Active" : "Light Theme Active"}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
                Toggle
              </span>
            </button>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1.5">Admin Management Tools</div>
            <div className="space-y-0.5">
              <Link
                href="/admin"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <LayoutGrid className="w-4 h-4 text-blue-600" />
                <span>Admin Dashboard</span>
              </Link>
              <Link
                href="/admin/bank-policy"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Bank Policy Guidelines</span>
              </Link>
              <Link
                href="/admin/company-search"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <Building className="w-4 h-4 text-emerald-600" />
                <span>Company Categorization</span>
              </Link>
              <Link
                href="/admin/bank-managers"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <Users className="w-4 h-4 text-amber-600" />
                <span>Official Bank Managers</span>
              </Link>
              <Link
                href="/admin/ai-model"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>AI Model Settings</span>
              </Link>
              <Link
                href="/agent-studio"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <Bot className="w-4 h-4 text-pink-600" />
                <span>AI Agent Configuration</span>
              </Link>
              <Link
                href="/admin/users"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <Users className="w-4 h-4 text-cyan-600" />
                <span>Users Management</span>
              </Link>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1.5">Main App Navigation</div>
            <div className="space-y-0.5">
              <Link
                href="/home"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/home?section=assistant"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <MessageSquare className="w-4 h-4 text-slate-400" />
                <span>AI Loan Assistant</span>
              </Link>
              <Link
                href="/home?section=emi"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <Calculator className="w-4 h-4 text-slate-400" />
                <span>EMI Calculator</span>
              </Link>
              <Link
                href="/home?section=eligibility"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors no-underline"
              >
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span>Eligibility Calculator</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Drawer Footer with Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {userInitial}
            </div>
            <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{userName}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
