// components/agent-studio/Sidebar.tsx
"use client";

import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  PlayCircle,
  Settings,
  ArrowLeft,
  X,
} from "lucide-react";
import { UserSubscriptionState } from "@/lib/agent-studio/types";

export type StudioTab =
  | "overview"
  | "assistant"
  | "knowledge"
  | "demo"
  | "settings"
  | "dashboard"
  | "instructions"
  | "capabilities"
  | "conversations"
  | "test"
  | "plans";

interface SidebarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  subscription?: UserSubscriptionState;
  onUpgrade?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "assistant", label: "AI Assistant", icon: Bot },
    { id: "knowledge", label: "", icon: BookOpen },
    { id: "demo", label: "Agent Demo", icon: PlayCircle },
    { id: "settings", label: "Settings", icon: Settings },
  ] as const;

  const isItemActive = (id: string) => {
    if (id === "assistant") {
      return (
        activeTab === "assistant" ||
        activeTab === "instructions" ||
        activeTab === "conversations"
      );
    }
    if (id === "overview") {
      return activeTab === "overview" || activeTab === "dashboard";
    }
    if (id === "knowledge") {
      return activeTab === "knowledge";
    }
    if (id === "demo") {
      return activeTab === "demo" || activeTab === "test";
    }
    if (id === "settings") {
      return activeTab === "settings" || activeTab === "capabilities" || activeTab === "plans";
    }
    return activeTab === id;
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full bg-white text-[#344563]">
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DFE7F3]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1769FF] text-white flex items-center justify-center shadow-xs shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <span className="font-bold text-[#101D45] text-base tracking-tight">
              Agent Studio
            </span>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden text-[#7183A3] hover:text-[#101D45] p-1 rounded-md"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const active = isItemActive(item.id);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                aria-label={item.label ? undefined : "Knowledge Base"}
                onClick={() => {
                  onSelectTab(item.id as StudioTab);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer text-left ${
                  active
                    ? "bg-[#EBF2FF] text-[#1769FF] font-semibold"
                    : "text-[#7183A3] hover:text-[#101D45] hover:bg-[#F7F9FC]"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? "text-[#1769FF]" : "text-[#7183A3]"
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Exit link */}
      <div className="p-3 border-t border-[#DFE7F3] bg-[#F7F9FC]/70">
        <Link
          href="/home?section=assistant"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#7183A3] hover:text-[#101D45] hover:bg-white transition font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to AI Assistant</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar: 225px wide */}
      <aside className="hidden lg:block w-[225px] h-screen sticky top-0 shrink-0 select-none z-20 border-r border-[#DFE7F3]">
        {sidebarContent}
      </aside>

      {/* Mobile Off-canvas Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-[225px] max-w-[80vw] h-full shadow-xl z-10">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
