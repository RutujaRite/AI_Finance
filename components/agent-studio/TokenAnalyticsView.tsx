// components/agent-studio/TokenAnalyticsView.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Zap,
  TrendingUp,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Bot,
  Sliders,
  Filter,
  Search,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

interface TokenSummary {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCalls: number;
  budgetTokens: number;
  alertThresholdPercent: number;
  budgetUsedPercent: number;
}

interface ModelBreakdown {
  modelName: string;
  totalTokens: number;
  count: number;
}

interface AgentBreakdown {
  agentId: string;
  agentName: string;
  totalTokens: number;
  count: number;
}

interface TokenLogItem {
  id: number;
  agentId: string;
  agentName: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  source: string;
  createdAt: string;
}

interface TokenAnalyticsViewProps {
  onToast: (msg: string, type?: "success" | "info" | "warning") => void;
}

export default function TokenAnalyticsView({ onToast }: TokenAnalyticsViewProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<TokenSummary>({
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalCalls: 0,
    budgetTokens: 1000000,
    alertThresholdPercent: 80,
    budgetUsedPercent: 0,
  });
  const [byModel, setByModel] = useState<ModelBreakdown[]>([]);
  const [byAgent, setByAgent] = useState<AgentBreakdown[]>([]);
  const [recentLogs, setRecentLogs] = useState<TokenLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Budget settings modal state
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [newBudget, setNewBudget] = useState(1000000);
  const [newThreshold, setNewThreshold] = useState(80);
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  // Clear confirmation
  const [isClearing, setIsClearing] = useState(false);

  async function fetchTokenData() {
    try {
      setRefreshing(true);
      const res = await fetch("/api/agents/tokens");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSummary(data.summary);
          setByModel(data.byModel || []);
          setByAgent(data.byAgent || []);
          setRecentLogs(data.recentLogs || []);
          setNewBudget(data.summary?.budgetTokens || 1000000);
          setNewThreshold(data.summary?.alertThresholdPercent || 80);
        }
      }
    } catch (err) {
      console.error("Failed to load token analytics:", err);
      onToast("Failed to load token usage data", "warning");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchTokenData();
  }, []);

  async function handleSaveBudget() {
    try {
      setIsSavingBudget(true);
      const res = await fetch("/api/agents/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetTokens: newBudget,
          alertThresholdPercent: newThreshold,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onToast("Token budget settings updated successfully", "success");
        setIsBudgetModalOpen(false);
        fetchTokenData();
      } else {
        onToast(data.error || "Failed to update budget settings", "warning");
      }
    } catch (err: any) {
      onToast("Error saving budget: " + err.message, "warning");
    } finally {
      setIsSavingBudget(false);
    }
  }

  async function handleClearLogs() {
    if (!confirm("Are you sure you want to clear all token usage history logs? This action cannot be undone.")) {
      return;
    }
    try {
      setIsClearing(true);
      const res = await fetch("/api/agents/tokens", { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        onToast("Token usage logs cleared successfully", "info");
        fetchTokenData();
      } else {
        onToast(data.error || "Failed to clear logs", "warning");
      }
    } catch (err: any) {
      onToast("Error clearing logs: " + err.message, "warning");
    } finally {
      setIsClearing(false);
    }
  }

  const filteredLogs = recentLogs.filter((log) => {
    const matchesSearch =
      searchQuery === "" ||
      log.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = sourceFilter === "all" || log.source.toLowerCase() === sourceFilter.toLowerCase();
    return matchesSearch && matchesSource;
  });

  const isAlertThresholdReached = summary.budgetUsedPercent >= summary.alertThresholdPercent;

  return (
    <div className="flex-1 bg-[#F8FAFC] min-h-screen p-6 md:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* CallNow Style Page Header */}
        <div className="cn-page-header">
          <div className="flex items-center gap-3">
            <div className="cn-metric-card-icon purple w-10 h-10 rounded-xl shadow-xs">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="cn-page-header-title">AI Token Usage &amp; Analytics</h1>
              <p className="cn-page-header-subtitle">
                Real-time tracking of LLM token consumption, prompt vs completion breakdowns, and budget limits.
              </p>
            </div>
          </div>

          <div className="cn-page-header-actions">
            <button
              onClick={() => setIsBudgetModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-xs transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>Configure Budget</span>
            </button>

            <button
              onClick={handleClearLogs}
              disabled={isClearing || recentLogs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-semibold text-red-600 bg-white hover:bg-red-50 shadow-xs transition cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>

            <button
              onClick={fetchTokenData}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Alert Banner if Near/Over Budget */}
        {isAlertThresholdReached && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Token Usage Alert:</strong> You have consumed{" "}
              {summary.budgetUsedPercent}% of your monthly token budget ({summary.totalTokens.toLocaleString()} /{" "}
              {summary.budgetTokens.toLocaleString()} tokens). Consider adjusting your budget threshold or optimizing prompt sizes.
            </div>
          </div>
        )}

        {/* CallNow 4-Card KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total Tokens */}
          <div className="cn-metric-card">
            <div className="cn-metric-card-icon purple">
              <Zap className="w-5 h-5" />
            </div>
            <div className="cn-metric-card-body">
              <div className="cn-metric-card-label">Total Tokens</div>
              <div className="cn-metric-card-value">
                {summary.totalTokens.toLocaleString()}
              </div>
              <div className="cn-metric-card-trend up">
                <span className="font-bold">{summary.totalCalls}</span>
                <span>calls executed</span>
              </div>
            </div>
          </div>

          {/* Card 2: Prompt Tokens */}
          <div className="cn-metric-card">
            <div className="cn-metric-card-icon info">
              <Layers className="w-5 h-5" />
            </div>
            <div className="cn-metric-card-body">
              <div className="cn-metric-card-label">Prompt Tokens</div>
              <div className="cn-metric-card-value">
                {summary.promptTokens.toLocaleString()}
              </div>
              <div className="cn-metric-card-trend flat">
                <span>
                  {summary.totalTokens > 0
                    ? `${Math.round((summary.promptTokens / summary.totalTokens) * 100)}% volume`
                    : "0%"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Completion Tokens */}
          <div className="cn-metric-card">
            <div className="cn-metric-card-icon success">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="cn-metric-card-body">
              <div className="cn-metric-card-label">Completion Tokens</div>
              <div className="cn-metric-card-value">
                {summary.completionTokens.toLocaleString()}
              </div>
              <div className="cn-metric-card-trend up">
                <span>
                  {summary.totalTokens > 0
                    ? `${Math.round((summary.completionTokens / summary.totalTokens) * 100)}% volume`
                    : "0%"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Monthly Budget Consumption */}
          <div className="cn-metric-card">
            <div className={`cn-metric-card-icon ${isAlertThresholdReached ? "warning" : "success"}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="cn-metric-card-body">
              <div className="cn-metric-card-label">Budget Consumed</div>
              <div className="cn-metric-card-value">
                {summary.budgetUsedPercent}%
              </div>
              <div className="cn-metric-card-sub">
                Limit: {summary.budgetTokens.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Budget Progress Bar Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">Monthly Token Budget Consumption</span>
            <span className="text-slate-500 font-medium">
              {summary.totalTokens.toLocaleString()} / {summary.budgetTokens.toLocaleString()} Tokens ({summary.budgetUsedPercent}%)
            </span>
          </div>

          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                summary.budgetUsedPercent >= 90
                  ? "bg-red-500"
                  : summary.budgetUsedPercent >= summary.alertThresholdPercent
                  ? "bg-amber-500"
                  : "bg-blue-600"
              }`}
              style={{ width: `${Math.min(100, Math.max(3, summary.budgetUsedPercent))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>0 tokens</span>
            <span className="text-amber-600 font-medium">Alert threshold: {summary.alertThresholdPercent}%</span>
            <span>{summary.budgetTokens.toLocaleString()} tokens</span>
          </div>
        </div>

        {/* 2-Column Breakdown: By Model & By Agent */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Usage by Model */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm font-bold text-slate-900">Usage by AI Model</h2>
              </div>
              <span className="text-xs text-slate-400">{byModel.length} models used</span>
            </div>

            {byModel.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No model usage recorded yet. Test an agent in the playground to begin logging.
              </div>
            ) : (
              <div className="space-y-3">
                {byModel.map((item, idx) => {
                  const pct = summary.totalTokens > 0 ? Math.round((item.totalTokens / summary.totalTokens) * 100) : 0;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={item.modelName}>
                          {item.modelName}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {item.totalTokens.toLocaleString()} tokens ({item.count} calls • {pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Usage by Agent */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Usage by AI Agent</h2>
              </div>
              <span className="text-xs text-slate-400">{byAgent.length} active agents</span>
            </div>

            {byAgent.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No agent usage recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {byAgent.map((item, idx) => {
                  const pct = summary.totalTokens > 0 ? Math.round((item.totalTokens / summary.totalTokens) * 100) : 0;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={item.agentName}>
                          {item.agentName}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {item.totalTokens.toLocaleString()} tokens ({item.count} calls • {pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Real-Time Audit Log Table */}
        <div className="cn-table-wrapper">
          {/* Table Header & Controls */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Token Activity Log</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Audit trail of recent LLM execution tokens across chat and studio playground.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 shadow-xs w-40"
                />
              </div>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 shadow-xs cursor-pointer text-slate-700"
              >
                <option value="all">All Sources</option>
                <option value="chat">Main Chat</option>
                <option value="playground">Playground</option>
              </select>
            </div>
          </div>

          {/* Table Body */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Model</th>
                  <th className="py-3 px-4 text-right">Prompt</th>
                  <th className="py-3 px-4 text-right">Completion</th>
                  <th className="py-3 px-4 text-right">Total Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      No matching token activity logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {log.agentName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`cn-status-pill ${
                            log.source === "playground" ? "purple" : "info"
                          }`}
                        >
                          <span className="cn-status-dot" />
                          {log.source === "playground" ? "Playground" : "Main Chat"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px] truncate max-w-[180px]" title={log.modelName}>
                        {log.modelName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 text-[11px]">
                        {log.promptTokens.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 text-[11px]">
                        {log.completionTokens.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-[11px]">
                        {log.totalTokens.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal for Configuring Budget */}
        {isBudgetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-5 animate-scaleUp">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Token Budget &amp; Alerts</h3>
                </div>
                <button
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Monthly Token Budget
                  </label>
                  <input
                    type="number"
                    value={newBudget}
                    onChange={(e) => setNewBudget(parseInt(e.target.value) || 1000)}
                    min={1000}
                    step={50000}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Total tokens allocated per month across all agents and users.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alert Threshold Percentage ({newThreshold}%)
                  </label>
                  <input
                    type="range"
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(parseInt(e.target.value) || 80)}
                    min={50}
                    max={100}
                    step={5}
                    className="w-full cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Trigger an in-studio warning when consumption reaches this percentage.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBudget}
                  disabled={isSavingBudget}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSavingBudget ? "Saving..." : "Save Budget"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
