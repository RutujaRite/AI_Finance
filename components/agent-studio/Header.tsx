// components/agent-studio/Header.tsx
"use client";

import React from "react";
import { UserSubscriptionState, Agent } from "@/lib/agent-studio/types";

interface HeaderProps {
  currentAgent: Agent | null;
  subscription: UserSubscriptionState;
  onTestAgent: () => void;
  onSaveChanges: () => void;
  saving?: boolean;
  onUpgrade: () => void;
  activeTab: string;
}

export default function Header({
  currentAgent,
  subscription,
  onTestAgent,
  onSaveChanges,
  saving = false,
  onUpgrade,
  activeTab,
}: HeaderProps) {
  const planLabel =
    subscription.plan === "pro"
      ? "Pro Plan"
      : subscription.plan === "business"
      ? "Business Plan"
      : "Basic Plan";

  return (
    <header className="w-full bg-white border-b border-slate-100 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
      {/* Brand & Subtitle */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            AI Agent Studio
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100/60">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Beta
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 font-normal">
          Build, customize and test AI assistants.
        </p>
      </div>

      {/* Right Actions & Plan badge */}
      <div className="flex items-center gap-3">
        {/* Current Plan Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
          <span className="text-slate-400">Current plan:</span>
          <span className="font-semibold text-slate-800 capitalize">
            {planLabel}
          </span>
          {subscription.plan === "basic" && (
            <button
              onClick={onUpgrade}
              className="ml-1 text-indigo-600 hover:text-indigo-700 font-semibold text-xs transition"
            >
              Upgrade
            </button>
          )}
        </div>

        {/* Test Agent Button */}
        <button
          onClick={onTestAgent}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition ${
            activeTab === "test"
              ? "bg-slate-100 text-slate-800 border-slate-300"
              : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
          }`}
        >
          <i className="bi bi-play-circle text-sm text-indigo-600" />
          <span>Test Agent</span>
        </button>

        {/* Save Changes Button */}
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

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
          A
        </div>
      </div>
    </header>
  );
}
