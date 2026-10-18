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
            AI Agent Configuration
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
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
              className="ml-1 text-blue-600 hover:text-blue-700 font-semibold text-xs transition"
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
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100/80 border-blue-200 shadow-2xs"
          }`}
        >
          <i className={`bi bi-play-circle text-sm ${activeTab === "test" ? "text-white" : "text-blue-600"}`} />
          <span>Test Agent</span>
        </button>

        {/* Save Changes Button */}
        <button
          onClick={onSaveChanges}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm hover:shadow disabled:opacity-60"
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
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
          A
        </div>
      </div>
    </header>
  );
}
