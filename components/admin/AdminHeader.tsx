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
  ArrowLeft,
  LogOut,
  Bot,
  Users,
  MessageSquare,
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      <header className="flex items-center justify-between h-16 px-6 border-b border-slate-300 bg-white text-slate-800 sticky top-0 z-30 font-sans shadow-2xs">
        {/* Left: Brand Group */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-3 no-underline group">
            {/* Logo Icon */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>

            {/* Brand text & Badge */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base tracking-tight">
                  CreditWise AI
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  Admin
                </span>
              </div>
              <span className="text-xs text-slate-500 hidden sm:inline">
                Financial SaaS Management Suite
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Actions Group */}
        <div className="flex items-center gap-2.5">
          {/* Back to Workspace button (hidden on root /admin overview page) */}
          {showBackToWorkspace && (
            <button
              type="button"
              onClick={() => router.push("/home?section=assistant")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg transition-all cursor-pointer shadow-2xs"
              title="Return to AI Assistant"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden xs:inline">Back to Workspace</span>
            </button>
          )}

          {/* Quick Return to Dashboard if on a sub-page */}
          {title && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-3 py-1.5 text-xs font-medium no-underline transition-all shadow-2xs"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">Overview</span>
            </Link>
          )}

          {/* Search Icon button - 40x40px hit target */}
          <button
            type="button"
            onClick={() => router.push("/admin/company-search")}
            title="Company Search"
            className="h-10 w-10 rounded-xl text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Notification Bell - 40x40px hit target with indicator dot */}
          <div className="relative">
            <button
              type="button"
              title="Notifications"
              className="h-10 w-10 rounded-xl text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            >
              <Bell className="w-4 h-4" />
            </button>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
          </div>

          {/* Admin Profile Dropdown - 40px height hit target */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="h-10 rounded-xl flex items-center gap-2.5 px-2.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 transition-all cursor-pointer shadow-2xs"
              aria-label="User profile menu"
            >
              {/* Circular Avatar */}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                {userInitial}
              </div>

              {/* Two-line Stack: Name & Role */}
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-sm font-semibold text-slate-800">
                  {userName}
                </span>
                <span className="text-xs text-slate-500">
                  Administrator
                </span>
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                  profileDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl border border-slate-300 shadow-xl py-1.5 z-50 text-xs font-sans animate-fade-in">
                <div className="px-4 py-3 border-b border-slate-200">
                  <div className="font-semibold text-slate-900 text-sm">
                    {userName}
                  </div>
                  <div className="text-slate-500 text-xs truncate mt-0.5">
                    {user?.email || "admin@creditwise.ai"}
                  </div>
                  <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Admin Workspace</span>
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/admin"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium no-underline transition-colors"
                  >
                    <LayoutGrid className="w-4 h-4 text-blue-600" />
                    <span>Admin Dashboard</span>
                  </Link>

                  <Link
                    href="/home?section=assistant"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium no-underline transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>AI Assistant Workspace</span>
                  </Link>

                  <Link
                    href="/admin/users"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium no-underline transition-colors"
                  >
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>User Accounts</span>
                  </Link>

                  <Link
                    href="/agent-studio"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium no-underline transition-colors"
                  >
                    <Bot className="w-4 h-4 text-sky-600" />
                    <span>AI Agent Studio</span>
                  </Link>
                </div>

                <div className="border-t border-slate-200 pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-2 flex items-center gap-2.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold cursor-pointer text-left border-0 bg-transparent transition-colors"
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
        <section className="bg-white border-b border-slate-300 px-6 sm:px-8 py-4 sm:py-5 font-sans shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Breadcrumb Navigation */}
              <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 mb-1.5">
                <Link
                  href="/admin"
                  className="text-blue-600 font-semibold inline-flex items-center gap-1 hover:underline no-underline"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </Link>

                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />

                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="text-blue-600 font-medium hover:underline no-underline truncate max-w-[160px]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-slate-800 font-semibold truncate max-w-[180px]">{crumb.label}</span>
                    )}
                    {idx < breadcrumbs.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </React.Fragment>
                ))}

                {breadcrumbs.length === 0 && title && (
                  <span className="text-slate-800 font-semibold truncate max-w-[200px]">{title}</span>
                )}
              </nav>

              {title && (
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight m-0">
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-xs sm:text-sm text-slate-600 mt-1 m-0 leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 shadow-2xs rounded-lg transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Back to Overview</span>
              </button>

              {actions}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
