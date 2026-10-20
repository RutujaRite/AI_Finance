// components/agent-studio/SettingsView.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  ChevronDown,
  Save,
  Trash2,
} from "lucide-react";
import { Agent } from "@/lib/agent-studio/types";
import DatabaseConfigurationCard from "./DatabaseConfigurationCard";

export { DatabaseConfigurationCard };

interface SettingsViewProps {
  agent: Agent;
  agents?: Agent[];
  onSelectAgent?: (agentId: string) => void;
  onUpdateAgent: (updates: Partial<Agent>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  onToast: (msg: string, type?: "success" | "info" | "warning") => void;
  onCreateAgentClick?: () => void;
  onActivateAgent?: (agentId: string) => Promise<void>;
  onDeactivateAgent?: (agentId: string) => Promise<void>;
  onDeleteAgentClick?: (agentId: string) => void;
}

export default function SettingsView({
  agent,
  agents = [],
  onSelectAgent,
  onUpdateAgent,
  onSave,
  saving,
  onToast,
  onCreateAgentClick,
  onActivateAgent,
  onDeactivateAgent,
  onDeleteAgentClick,
}: SettingsViewProps) {
  const [activeSettingsSection, setActiveSettingsSection] = useState<
    "all" | "database" | "lifecycle"
  >("database");
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const allAgentsList = agents && agents.length > 0 ? agents : [agent];
  const agentDisplayName = agent.name || "CreditWise Assistant";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAgentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSaveSettings() {
    try {
      await onSave();
      onToast(`Saved settings for ${agentDisplayName}`, "success");
    } catch {
      onToast("Failed to save settings", "warning");
    }
  }

  return (
    <div className="w-full flex-1 bg-slate-50 dark:bg-slate-950 min-h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header with Agent Dropdown and Save Settings */}
        <div className="cn-page-header">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Configuration Settings
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure persistent vector stores, database connections, and deployment lifecycle.
            </p>
          </div>

          <div className="cn-page-header-actions">
            {/* Select Agent Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsAgentDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3.5 py-2 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-lg bg-white dark:bg-slate-900 shadow-2xs text-xs font-semibold text-slate-800 dark:text-slate-100 transition-all cursor-pointer"
              >
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{agentDisplayName}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isAgentDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isAgentDropdownOpen && (
                <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span>Select Agent</span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                      {allAgentsList.length} agents
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {allAgentsList.map((ag) => {
                      const isSelected = ag.id === agent.id;
                      const aDisplayName = ag.name;
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            if (onSelectAgent) {
                              onSelectAgent(ag.id);
                              onToast(`Switched settings to ${aDisplayName}`, "info");
                            }
                            setIsAgentDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition cursor-pointer ${
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              <Bot className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="truncate font-medium flex items-center gap-1.5">
                                <span>{aDisplayName}</span>
                                {ag.isActiveForUser && (
                                  <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1 py-0.2 rounded font-semibold">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 capitalize">
                                {ag.status || "active"} •{" "}
                                {ag.instructions?.agentRole || "AI Assistant"}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {onCreateAgentClick && (
                    <div className="p-1 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAgentDropdownOpen(false);
                          onCreateAgentClick();
                        }}
                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      >
                        <span>+ Create New Agent</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </div>

        {/* 1. Consolidated Pill-Style Toggle Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
          {[
            { id: "all", label: "All Settings" },
            { id: "database", label: "Database & Storage" },
            { id: "lifecycle", label: "Agent Lifecycle" },
          ].map((tab) => {
            const isActive = activeSettingsSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSettingsSection(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 2. Primary Database Configuration & Connection Status Card */}
        {(activeSettingsSection === "all" || activeSettingsSection === "database") && (
          <DatabaseConfigurationCard onToast={onToast} />
        )}

        {/* 3. Active Agent & Deployment Status Card (Preserved Intact) */}
        {(activeSettingsSection === "all" || activeSettingsSection === "lifecycle") && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5">
            <div className="bg-gradient-to-r from-amber-50/80 to-orange-50/50 dark:from-slate-900 dark:via-slate-800/80 dark:to-slate-900 px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="m-0 text-base font-bold text-slate-900 dark:text-white">
                    Active Agent &amp; Deployment Status
                  </h2>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Controls which agent governs the main AI assistant at /home
                  </span>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  agent.isActiveForUser
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    agent.isActiveForUser ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                {agent.isActiveForUser ? "Active for your Assistant" : "Standby / Inactive"}
              </span>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {agent.isActiveForUser ? "Active Assistant" : "Set as Active Assistant"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {agent.isActiveForUser
                      ? `This agent is actively powering the AI assistant for your account. Its custom instructions, tone, and knowledge base are live.`
                      : `Make "${agentDisplayName}" your active agent. The AI assistant at /home will use this agent's configuration and knowledge base.`}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {agent.isActiveForUser ? (
                    onDeactivateAgent && (
                      <button
                        type="button"
                        onClick={() => onDeactivateAgent(agent.id)}
                        className="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer"
                      >
                        Deactivate
                      </button>
                    )
                  ) : (
                    onActivateAgent && (
                      <button
                        type="button"
                        onClick={() => onActivateAgent(agent.id)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                      >
                        Activate for AI Assistant
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Danger Zone: Delete Agent */}
              {onDeleteAgentClick && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60">
                  <div>
                    <div className="text-xs font-bold text-rose-800 dark:text-rose-300">
                      Delete This Agent
                    </div>
                    <div className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                      Permanently delete "{agentDisplayName}", including all associated knowledge documents, chunks, and configurations.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteAgentClick(agent.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 border border-rose-200/80 dark:border-rose-800 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Delete Agent</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
