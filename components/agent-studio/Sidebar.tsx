// components/agent-studio/Sidebar.tsx
"use client";

import React from "react";
import { Agent, UserSubscriptionState } from "@/lib/agent-studio/types";

export type StudioTab = "overview" | "setup" | "qualification" | "capabilities" | "test" | "plans";

interface SidebarProps {
  agents: Agent[];
  currentAgentId: string;
  onSelectAgent: (id: string) => void;
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  onCreateNew: () => void;
  subscription: UserSubscriptionState;
  onUpgrade: () => void;
}

export default function Sidebar({
  agents,
  currentAgentId,
  onSelectAgent,
  activeTab,
  onSelectTab,
  onCreateNew,
  subscription,
  onUpgrade,
}: SidebarProps) {
  const navItems: Array<{ id: StudioTab; label: string; icon: string }> = [
    { id: "overview", label: "Overview", icon: "bi bi-grid" },
    { id: "setup", label: "Setup", icon: "bi bi-sliders" },
    { id: "qualification", label: "Qualification", icon: "bi bi-card-checklist" },
    { id: "capabilities", label: "Capabilities", icon: "bi bi-lightning-charge" },
    { id: "test", label: "Test", icon: "bi bi-play-circle" },
    { id: "plans", label: "Plans", icon: "bi bi-stars" },
  ];

  const currentUsage = subscription.messagesUsed;
  const maxUsage = subscription.maxMessages;
  const percentage = Math.min(100, Math.round((currentUsage / maxUsage) * 100));
  const remaining = Math.max(0, maxUsage - currentUsage);
  const isAtLimit = currentUsage >= maxUsage;
  const isNearLimit = remaining === 1;

  return (
    <aside className="w-64 bg-slate-50/70 border-r border-slate-200/80 flex flex-col justify-between h-[calc(100vh-65px)] sticky top-[65px] select-none">
      <div className="p-4 space-y-6 overflow-y-auto">
        {/* Your AI Agents header */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Your AI Agents
            </span>
            <button
              onClick={onCreateNew}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 px-2.5 py-1 rounded-lg transition shadow-xs"
              title="Create New Agent"
            >
              <i className="bi bi-plus-lg text-xs" />
              <span>Create New</span>
            </button>
          </div>

          {/* Agents List */}
          <div className="space-y-1">
            {agents.map((agent) => {
              const isSelected = agent.id === currentAgentId;
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition flex items-center justify-between border ${
                    isSelected
                      ? "bg-white text-slate-800 border-indigo-200 shadow-sm"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-800 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-sm">🤖</span>
                    <span className="truncate font-semibold">{agent.name}</span>
                  </div>
                  <div>
                    {agent.status === "active" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        Draft
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Studio Navigation */}
        <div>
          <div className="px-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Navigation
          </div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2.5 ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <i
                    className={`${item.icon} text-sm ${
                      isActive ? "text-indigo-600" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.id === "plans" && subscription.plan === "basic" && (
                    <span className="ml-auto text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-semibold">
                      Upgrade
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Soft Usage & Plan Card */}
      <div className="p-4 border-t border-slate-200/70 bg-white/60">
        <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-700 capitalize">
              {subscription.plan === "pro"
                ? "Pro Plan"
                : subscription.plan === "business"
                ? "Business Plan"
                : "Basic Plan"}
            </span>
            {subscription.plan === "basic" ? (
              <button
                onClick={onUpgrade}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition"
              >
                Upgrade
              </button>
            ) : (
              <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                Active
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-500 mb-2">
            {currentUsage} of {maxUsage} test messages used
          </div>

          {/* Soft progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isAtLimit
                  ? "bg-amber-400"
                  : isNearLimit
                  ? "bg-amber-400"
                  : "bg-indigo-500"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {isNearLimit && !isAtLimit && (
            <p className="text-[11px] text-amber-600 font-medium">
              1 test message remaining.
            </p>
          )}

          {isAtLimit && (
            <div className="pt-1">
              <p className="text-[11px] text-slate-500 mb-1.5">Limit reached.</p>
              <button
                onClick={onUpgrade}
                className="w-full py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
              >
                Upgrade to Pro
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
