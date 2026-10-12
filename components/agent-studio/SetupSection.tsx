// components/agent-studio/SetupSection.tsx
"use client";

import React from "react";
import { Agent, UserSubscriptionState } from "@/lib/agent-studio/types";
import { StudioTab } from "./Sidebar";

interface SetupSectionProps {
  agent: Agent;
  onChange: (updated: Partial<Agent>) => void;
  onSaveChanges: () => void;
  saving?: boolean;
  subscription?: UserSubscriptionState;
  onUpgrade?: () => void;
  onKnowledgeUpdated?: () => void;
  onNavigateToTab?: (tab: StudioTab) => void;
  onDeleteAgent?: (id: string, name: string) => void;
  canDelete?: boolean;
}

export default function SetupSection({
  agent,
  onChange,
  onSaveChanges,
  saving = false,
  onNavigateToTab,
  onDeleteAgent,
  canDelete = false,
}: SetupSectionProps) {
  const isAgentActive = agent.status === "active";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-fadeIn font-sans text-slate-800">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Agent Setup & Status
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview and general operational status for {agent.name}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onDeleteAgent && canDelete && (
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    `Are you sure you want to delete "${agent.name}"? This action cannot be undone.`
                  )
                ) {
                  onDeleteAgent(agent.id, agent.name);
                }
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition border border-red-200"
            >
              Delete Agent
            </button>
          )}

          <button
            onClick={onSaveChanges}
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition duration-150 disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Setup</span>
            )}
          </button>
        </div>
      </div>

      {/* Main Agent Identity Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl shrink-0">
              🤖
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{agent.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ID: <span className="font-mono text-slate-600">{agent.id}</span>
              </p>
            </div>
          </div>

          {/* Active / Draft Status Badge & Toggle */}
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                isAgentActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {isAgentActive ? "● Active" : "○ Draft"}
            </span>

            <button
              type="button"
              onClick={() =>
                onChange({ status: isAgentActive ? "draft" : "active" })
              }
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline ml-1"
            >
              Toggle
            </button>
          </div>
        </div>

        {/* Quick Config Banner to AI Instructions */}
        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-blue-900">
              Configure Instructions, Knowledge & Guardrails
            </h4>
            <p className="text-xs text-blue-700 mt-0.5">
              Edit the agent name, operational mode, goal, upload documents, and define guardrails in the dedicated section.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab?.("instructions")}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 shadow-xs transition"
          >
            Open AI Instructions →
          </button>
        </div>
      </div>
    </div>
  );
}
