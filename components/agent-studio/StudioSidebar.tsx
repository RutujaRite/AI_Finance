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
  Home,
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
                ? "bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold shadow-2xs"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all hover:translate-x-0.5"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
                }`}
              />
              <span className="truncate">{item.label}</span>
            </div>
            {item.badge && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                  isActive
                    ? "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
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
    <div className="flex flex-col justify-between h-full bg-white dark:bg-slate-900 as-soft-sidebar p-4 select-none border-r border-slate-300 dark:border-slate-800">
      <div>
        {/* CallNow Style Brand Header */}
        <div className="flex items-center justify-between pb-4 pt-1 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            {/* Brand Mark */}
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0 font-bold text-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-900 dark:text-white font-bold text-sm leading-tight tracking-tight">
                AI Agent Configuration
              </div>
              <div className="text-slate-400 dark:text-slate-500 text-[11px] font-medium mt-0.5">
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
      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        {/* Agent Online Card with CallNow Status Pill */}
        <div className="bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="cn-status-pill success">Online</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{version}</span>
          </div>
          <div className="text-xs font-semibold text-slate-900 dark:text-white mt-2 truncate">
            {agentName}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Ready for inference
          </div>
        </div>

        {/* Return to Homepage & Assistant links */}
        <div className="flex flex-col gap-1.5">
          <Link
            href="/home"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800 transition shadow-2xs no-underline"
            title="Return to Application Homepage"
          >
            <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Return to Homepage</span>
          </Link>
          <Link
            href="/home?section=assistant"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 transition shadow-xs no-underline"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Exit to AI Assistant</span>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar: 240px wide */}
      <aside className="as-sidebar-desktop shrink-0 select-none bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 w-64 hidden lg:block">
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
