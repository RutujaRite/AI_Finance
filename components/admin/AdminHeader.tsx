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
}

export default function AdminHeader({
  user,
  title,
  description,
  breadcrumbs = [],
  actions,
  showBreadcrumbs = true,
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
      <header className="h-16 bg-white border-b border-slate-200 px-3.5 sm:px-8 flex items-center justify-between sticky top-0 z-40 shadow-xs font-sans">
        {/* Left: CreditWise AI Brand Logo & Admin Badge */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/admin" className="flex items-center gap-2 sm:gap-2.5 no-underline group">
            {/* Logo Icon */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>

            {/* Brand text */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  CreditWise <span className="text-blue-600">AI</span>
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
                  Admin
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
                Financial SaaS Management Suite
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Search, Notifications, Profile Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Quick Return to Dashboard if on a sub-page */}
          {title && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 sm:gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold no-underline transition-colors"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden xs:inline">Overview</span>
            </Link>
          )}

          {/* Search Icon button */}
          <button
            type="button"
            onClick={() => router.push("/admin/company-search")}
            title="Company Search"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Notification Bell with red dot */}
          <div className="relative">
            <button
              type="button"
              title="Notifications"
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
            </button>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
          </div>

          {/* Admin Profile Dropdown Capsule */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-full py-1 pl-1 pr-1.5 sm:pr-2.5 transition-colors cursor-pointer"
            >
              {/* Circular Avatar */}
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                {userInitial}
              </div>

              {/* Text label */}
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  {userName}
                </span>
                <span className="text-[10px] text-slate-500">Administrator</span>
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  profileDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 text-xs font-sans animate-fade-in">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <div className="font-semibold text-slate-900 text-sm">
                    {userName}
                  </div>
                  <div className="text-slate-500 text-[11px] truncate mt-0.5">
                    {user?.email || "admin@creditwise.ai"}
                  </div>
                  <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Admin Workspace</span>
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/admin"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 text-xs font-medium no-underline"
                  >
                    <LayoutGrid className="w-4 h-4 text-blue-600" />
                    <span>Admin Dashboard</span>
                  </Link>

                  <Link
                    href="/home?section=assistant"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 text-xs font-medium no-underline"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>AI Assistant Workspace</span>
                  </Link>

                  <Link
                    href="/admin/users"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 text-xs font-medium no-underline"
                  >
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>User Accounts</span>
                  </Link>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-2 flex items-center gap-2.5 text-xs text-red-600 hover:bg-red-50 font-semibold cursor-pointer text-left"
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
        <section className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 sm:py-4 font-sans">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-3">
            {/* Left: Breadcrumb Navigation & Title */}
            <div className="min-w-0 flex-1">
              {/* Breadcrumb links */}
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

              {/* Title & Subtitle */}
              {title && (
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight m-0">
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-xs sm:text-sm text-slate-500 mt-1 m-0">
                  {description}
                </p>
              )}
            </div>

            {/* Right: Actions / Back to Dashboard */}
            <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto mt-1 sm:mt-0 justify-between sm:justify-end">
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="cw-btn-secondary text-xs py-1.5 sm:py-2 px-2.5 sm:px-3 inline-flex items-center gap-1.5"
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
