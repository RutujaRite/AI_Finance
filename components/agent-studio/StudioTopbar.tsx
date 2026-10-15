// components/agent-studio/StudioTopbar.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Menu, User, LogOut, ArrowLeft, Shield, LayoutDashboard } from "lucide-react";

interface StudioTopbarProps {
  user?: any;
  onToggleMobileNav?: () => void;
}

export default function StudioTopbar({
  user,
  onToggleMobileNav,
}: StudioTopbarProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userName =
    user?.name ||
    user?.username ||
    (user?.email ? user.email.split("@")[0] : "Rutuja Rite");

  // Initials: e.g. "RR"
  const initials = "RR";

  return (
    <header className="as-topbar">
      <div className="flex items-center gap-3">
        {onToggleMobileNav && (
          <button
            onClick={onToggleMobileNav}
            className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:border-slate-400 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <span className="text-slate-300 hidden md:inline">/</span>
        <span className="text-xs font-medium text-slate-500 hidden md:inline">Studio Control Center</span>
      </div>

      <div className="flex items-center gap-3">
        {/* CallNow Live Engine Status Pill */}
        <div className="hidden sm:inline-flex">
          <span className="cn-status-pill success">Live Engine Online</span>
        </div>

      {/* Right User Badge matching screenshot */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 p-1 rounded-full hover:bg-slate-50 transition cursor-pointer"
        >
          {/* Dark Navy Avatar with White "RR" */}
          <div className="w-8 h-8 rounded-full bg-[#0b1528] text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-xs">
            {initials}
          </div>
          <span className="text-sm font-semibold text-slate-800 hidden sm:inline-block">
            {userName}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-300 py-1.5 z-50 text-sm animate-fadeIn">
            <div className="px-4 py-2 border-b border-slate-200">
              <div className="font-semibold text-slate-900 text-sm">{userName}</div>
              <div className="text-xs text-slate-500 truncate">
                {user?.email || "rutujarite@gmail.com"}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold">
                <Shield className="w-3 h-3" />
                Admin Workspace
              </div>
            </div>

            <Link
              href="/admin"
              className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 text-xs font-medium"
              onClick={() => setDropdownOpen(false)}
            >
              <LayoutDashboard className="w-4 h-4 text-slate-400" />
              <span>Admin Dashboard</span>
            </Link>

            <Link
              href="/home?section=assistant"
              className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 text-xs font-medium"
              onClick={() => setDropdownOpen(false)}
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              <span>Back to AI Assistant</span>
            </Link>

            <button
              onClick={async () => {
                setDropdownOpen(false)
                try {
                  await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
                  localStorage.removeItem("finai_user")
                  sessionStorage.clear()
                } catch (e) {}
                router.push("/?logout=true")
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-rose-600 hover:bg-rose-50 text-xs font-medium border-t border-slate-200 text-left"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
      </div>
    </header>
  );
}
