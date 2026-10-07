// components/agent-studio/OverviewSection.tsx
"use client";

import React from "react";
import { Agent, UserSubscriptionState } from "@/lib/agent-studio/types";

interface OverviewSectionProps {
  agent: Agent;
  subscription: UserSubscriptionState;
  onTestAgent: () => void;
  onSaveChanges: () => void;
  saving?: boolean;
  onNavigateToTab: (tab: any) => void;
}

export default function OverviewSection({
  agent,
  subscription,
  onTestAgent,
  onSaveChanges,
  saving = false,
  onNavigateToTab,
}: OverviewSectionProps) {
  const currentUsage = subscription.messagesUsed;
  const maxUsage = subscription.maxMessages;
  const percentage = Math.min(100, Math.round((currentUsage / maxUsage) * 100));

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fadeIn">
      {/* Top Hero Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {agent.name}
            </h2>
            {agent.status === "active" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                Draft
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 font-normal">
            {agent.description || "AI assistant for loan policy and customer assistance."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={onTestAgent}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 transition"
          >
            <i className="bi bi-play-circle text-sm text-indigo-600" />
            <span>Test Agent</span>
          </button>
          <button
            onClick={onSaveChanges}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm hover:shadow disabled:opacity-60"
          >
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat text-sm animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <i className="bi bi-check2 text-sm" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid: Small Usage Card + Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Small Usage Card (As specifically requested in prompt #4) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {subscription.plan === "basic" ? "Free Trial" : "Plan Usage"}
              </span>
              <span className="text-xs font-medium text-slate-400 capitalize">
                {subscription.plan}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-800 mb-1">
              {currentUsage} / {maxUsage} <span className="text-xs font-normal text-slate-500">test messages used</span>
            </div>

            {/* Soft progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden my-3">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Knowledge tokens</span>
            <span className="font-semibold text-slate-700">
              {agent.usage.knowledgeTokens.toLocaleString()} tokens used
            </span>
          </div>
        </div>

        {/* Quick Config Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Configuration Summary
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Response Style</span>
                <span className="font-semibold text-slate-800 capitalize bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                  {agent.responseStyle}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Conversations Mode</span>
                <span className="font-semibold text-emerald-600">
                  {agent.modes.conversations ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Welcome Message</span>
                <span className="font-semibold text-slate-800">
                  {agent.welcomeMessage.enabled ? "Active" : "Off"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateToTab("setup")}
            className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition"
          >
            <span>Edit Setup</span>
            <i className="bi bi-chevron-right text-[10px]" />
          </button>
        </div>

        {/* Knowledge & Capabilities Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Capabilities & Grounding
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Knowledge Documents</span>
                <span className="font-semibold text-slate-800">
                  {agent.knowledge.length} file{agent.knowledge.length === 1 ? "" : "s"} processed
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Qualification Fields</span>
                <span className="font-semibold text-slate-800">
                  {agent.qualification.leadFields.filter((f) => f.enabled).length} active fields
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Active Tools</span>
                <span className="font-semibold text-indigo-600">
                  {Object.values(agent.capabilities).filter(Boolean).length} capabilities
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateToTab("capabilities")}
            className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition"
          >
            <span>Manage Capabilities</span>
            <i className="bi bi-chevron-right text-[10px]" />
          </button>
        </div>
      </div>

      {/* Quick Start Guidance Banner (Clean, soft, helpful) */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-white rounded-2xl border border-indigo-100/70 p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white text-indigo-600 shadow-xs flex items-center justify-center shrink-0 border border-indigo-100">
            <i className="bi bi-lightbulb text-lg" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-slate-800 mb-1">
              Next Step: Customize or Test Your Agent
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Configure your agent instructions in Setup, review lead qualification rules, upload custom policy documents, or jump directly into the playground to test live interactions.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onNavigateToTab("setup")}
                className="text-xs font-medium px-3 py-1.5 bg-white text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition shadow-xs"
              >
                Configure Instructions
              </button>
              <button
                onClick={() => onNavigateToTab("qualification")}
                className="text-xs font-medium px-3 py-1.5 bg-white text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition shadow-xs"
              >
                Review Qualification
              </button>
              <button
                onClick={onTestAgent}
                className="text-xs font-semibold px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-xs"
              >
                Test in Playground
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
