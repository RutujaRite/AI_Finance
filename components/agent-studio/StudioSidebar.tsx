// components/agent-studio/StudioSidebar.tsx
"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  Layers,
  MessageSquare,
  Settings,
  ArrowLeft,
  X,
} from "lucide-react";

export type StudioNavTab = "instructions" | "knowledge" | "demo" | "settings";

interface StudioSidebarProps {
  activeTab: StudioNavTab;
  onSelectTab: (tab: StudioNavTab) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  agentName?: string;
  version?: string;
}

export default function StudioSidebar({
  activeTab,
  onSelectTab,
  mobileOpen = false,
  onCloseMobile,
  agentName = "CreditWise Assistant",
  version = "v1.0.0",
}: StudioSidebarProps) {
  const navItems = [
    {
      id: "instructions" as StudioNavTab,
      label: "AI Instructions",
      icon: FileText,
    },
    {
      id: "knowledge" as StudioNavTab,
      label: "Knowledge Base",
      icon: Layers,
    },
    {
      id: "demo" as StudioNavTab,
      label: "Agent Test / Demo",
      icon: MessageSquare,
    },
    {
      id: "settings" as StudioNavTab,
      label: "Settings",
      icon: Settings,
    },
  ];

  const content = (
    <div className="flex flex-col justify-between h-full bg-white as-soft-sidebar p-4 select-none border-r border-slate-200">
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-5 pt-1 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {/* Soft Robot Brand Icon */}
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="3"
                  y="6"
                  width="18"
                  height="14"
                  rx="4"
                  stroke="#2563eb"
                  strokeWidth="2"
                />
                <circle cx="8.5" cy="12.5" r="1.5" fill="#2563eb" />
                <circle cx="15.5" cy="12.5" r="1.5" fill="#2563eb" />
                <path
                  d="M12 2V6"
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="2" r="1" fill="#2563eb" />
                <path
                  d="M1 11H3M21 11H23"
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <div className="text-slate-900 font-bold text-base leading-tight">
                AI Agent Studio
              </div>
              <div className="text-slate-500 text-xs font-normal mt-0.5">
                Build • Configure • Deploy
              </div>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden text-slate-400 hover:text-slate-700 p-1 rounded-md"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="mt-5 space-y-1.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? "bg-blue-50/90 text-blue-600 border border-blue-200/80 font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-blue-600" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area */}
      <div className="space-y-3">
        {/* Agent Online Card with Soft Styling */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-700">
              Agent Online
            </span>
          </div>
          <div className="text-xs font-medium text-slate-900 mt-1.5 truncate">
            {agentName}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            {version}
          </div>
        </div>

        {/* Exit back to dashboard */}
        <Link
          href="/home?section=assistant"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50/80 border border-transparent hover:border-blue-100 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to AI Assistant</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar: 240px wide */}
      <aside className="as-sidebar-desktop shrink-0 select-none">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative w-[260px] h-full shadow-2xl z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
