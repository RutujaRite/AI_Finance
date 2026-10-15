// components/agent-studio/StudioSidebar.tsx
"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  MessageSquare,
  Settings,
  ArrowLeft,
  X,
  Sliders,
  BookOpen,
  Activity,
  Cpu,
  Bot,
} from "lucide-react";

export type StudioNavTab = "instructions" | "knowledge" | "demo" | "tokens" | "models" | "settings";

interface StudioSidebarProps {
  activeTab: StudioNavTab;
  onSelectTab: (tab: StudioNavTab) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  agentName?: string;
  version?: string;
}

interface NavItem {
  id: StudioNavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export default function StudioSidebar({
  activeTab,
  onSelectTab,
  mobileOpen = false,
  onCloseMobile,
  agentName = "CreditWise Assistant",
  version = "v1.0.0",
}: StudioSidebarProps) {
  const workspaceNav: NavItem[] = [
    {
      id: "instructions" as StudioNavTab,
      label: "AI Instructions",
      icon: FileText,
      badge: "Core",
    },
    {
      id: "knowledge" as StudioNavTab,
      label: "Knowledge Base",
      icon: BookOpen,
      badge: "Docs",
    },
    {
      id: "demo" as StudioNavTab,
      label: "Agent Test / Demo",
      icon: MessageSquare,
      badge: "Live",
    },
  ];

  const configNav: NavItem[] = [
    {
      id: "tokens" as StudioNavTab,
      label: "Token Analytics",
      icon: Activity,
    },
    {
      id: "models" as StudioNavTab,
      label: "Model Configuration",
      icon: Cpu,
    },
    {
      id: "settings" as StudioNavTab,
      label: "Settings",
      icon: Settings,
    },
  ];

  const renderNavGroup = (items: NavItem[]) => (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive = activeTab === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => {
              onSelectTab(item.id);
              if (onCloseMobile) onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.99] ${
              isActive
                ? "bg-blue-50 border border-blue-300 text-blue-700 font-semibold shadow-2xs"
                : "bg-white border border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all hover:translate-x-0.5"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? "text-blue-600" : "text-slate-500"
                }`}
              />
              <span className="truncate">{item.label}</span>
            </div>
            {item.badge && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                  isActive
                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const content = (
    <div className="flex flex-col justify-between h-full bg-white as-soft-sidebar p-4 select-none border-r border-slate-300">
      <div>
        {/* CallNow Style Brand Header */}
        <div className="flex items-center justify-between pb-4 pt-1 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {/* Brand Mark */}
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0 font-bold text-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-900 font-bold text-sm leading-tight tracking-tight">
                AI Agent Studio
              </div>
              <div className="text-slate-400 text-[11px] font-medium mt-0.5">
                CreditWise Architecture
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

        {/* Section 1: Studio Workspace */}
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">STUDIO WORKSPACE</div>
          {renderNavGroup(workspaceNav)}
        </div>

        {/* Section 2: Configuration & Metrics */}
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">CONFIGURATION &amp; METRICS</div>
          {renderNavGroup(configNav)}
        </div>
      </div>

      {/* Bottom Area */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        {/* Agent Online Card with CallNow Status Pill */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="cn-status-pill success">Online</span>
            <span className="text-[10px] text-slate-400 font-mono">{version}</span>
          </div>
          <div className="text-xs font-semibold text-slate-900 mt-2 truncate">
            {agentName}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Ready for inference
          </div>
        </div>

        {/* Exit back to AI Assistant pinned to bottom-left */}
        <Link
          href="/home?section=assistant"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-200 transition shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
          <span>Exit to AI Assistant</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar: 240px wide */}
      <aside className="as-sidebar-desktop shrink-0 select-none bg-white border-r border-slate-300 w-64 hidden lg:block">
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
