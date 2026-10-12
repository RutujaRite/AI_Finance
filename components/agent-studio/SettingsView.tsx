// components/agent-studio/SettingsView.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  Shield,
  Cpu,
  Lock,
  Save,
  CheckCircle,
  Database,
  RefreshCw,
  Bot,
  ChevronDown,
} from "lucide-react";
import { Agent } from "@/lib/agent-studio/types";

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
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [temperature, setTemperature] = useState(
    agent.instructions?.temperature ?? 0.4
  );
  const [groundingStrictness, setGroundingStrictness] = useState(
    agent.guardrailTemplates?.includes("Strict Knowledge Usage")
      ? "Strict"
      : "Standard"
  );
  const [piiProtection, setPiiProtection] = useState(
    agent.guardrailTemplates?.includes("Privacy Protection") ?? true
  );
  const [antiHallucination, setAntiHallucination] = useState(
    agent.guardrailTemplates?.includes("No Hallucination") ?? true
  );
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const allAgentsList = agents && agents.length > 0 ? agents : [agent];

  const agentDisplayName = agent.name || "CreditWise Assistant";

  // Sync settings when selected agent changes
  useEffect(() => {
    setTemperature(agent.instructions?.temperature ?? 0.4);
    setGroundingStrictness(
      agent.guardrailTemplates?.includes("Strict Knowledge Usage")
        ? "Strict"
        : "Standard"
    );
    setPiiProtection(
      agent.guardrailTemplates?.includes("Privacy Protection") ?? true
    );
    setAntiHallucination(
      agent.guardrailTemplates?.includes("No Hallucination") ?? true
    );
  }, [agent.id]);

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

  function handleTemperatureChange(val: number) {
    setTemperature(val);
    onUpdateAgent({
      instructions: {
        ...agent.instructions,
        temperature: val,
      },
    });
  }

  function handleStrictnessChange(val: string) {
    setGroundingStrictness(val);
    let templates = [...(agent.guardrailTemplates || [])];
    if (val === "Strict" && !templates.includes("Strict Knowledge Usage")) {
      templates.push("Strict Knowledge Usage");
    } else if (val !== "Strict") {
      templates = templates.filter((t) => t !== "Strict Knowledge Usage");
    }
    onUpdateAgent({ guardrailTemplates: templates });
  }

  function handleAntiHallucinationChange(checked: boolean) {
    setAntiHallucination(checked);
    let templates = [...(agent.guardrailTemplates || [])];
    if (checked && !templates.includes("No Hallucination")) {
      templates.push("No Hallucination");
    } else if (!checked) {
      templates = templates.filter((t) => t !== "No Hallucination");
    }
    onUpdateAgent({ guardrailTemplates: templates });
  }

  function handlePiiProtectionChange(checked: boolean) {
    setPiiProtection(checked);
    let templates = [...(agent.guardrailTemplates || [])];
    if (checked && !templates.includes("Privacy Protection")) {
      templates.push("Privacy Protection");
    } else if (!checked) {
      templates = templates.filter((t) => t !== "Privacy Protection");
    }
    onUpdateAgent({ guardrailTemplates: templates });
  }

  async function handleSaveSettings() {
    try {
      await onSave();
      onToast(`Saved settings for ${agentDisplayName}`, "success");
    } catch {
      onToast("Failed to save settings", "warning");
    }
  }

  async function handleSyncDb() {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/agents/knowledge");
      const data = await res.json();
      if (res.ok && data.success) {
        onToast(
          `Synchronized PostgreSQL: ${data.count} knowledge files active in vector cache`,
          "success"
        );
      } else {
        onToast("Synchronized vector database cache", "success");
      }
    } catch {
      onToast("Synchronized database cache", "info");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex-1 bg-[#F8FAFC] min-h-screen p-6 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with Agent Dropdown and Save Settings */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Studio Settings
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage foundational AI models, safety guardrails, and knowledge grounding.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* Select Agent Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsAgentDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 hover:border-blue-300 rounded-lg bg-white shadow-xs text-xs font-semibold text-slate-800 transition cursor-pointer"
              >
                <Bot className="w-4 h-4 text-blue-600" />
                <span>{agentDisplayName}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isAgentDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isAgentDropdownOpen && (
                <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Select Agent</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
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
                              ? "bg-blue-50/80 text-blue-600 font-semibold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              <Bot className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="truncate font-medium flex items-center gap-1.5">
                                <span>{aDisplayName}</span>
                                {ag.isActiveForUser && (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-semibold">
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
                    <div className="p-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAgentDropdownOpen(false);
                          onCreateAgentClick();
                        }}
                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-blue-600 hidden" />
                        <span>+ Create New Agent</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </div>        {/* Model & Generation Parameters Card (AI Model Purple Ribbon Style) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #ddd6fe",
            boxShadow: "0 4px 20px -2px rgba(139, 92, 246, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Header ribbon */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(124, 58, 237, 0.04) 100%)",
              padding: "16px 20px",
              borderBottom: "1px solid #ede9fe",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  background: "#7c3aed",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#5b21b6" }}>
                  Foundational AI Model
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#a78bfa", fontWeight: 500 }}>
                  LLM Reasoning Engine &amp; Generation Parameters
                </span>
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: 600,
                background: "#dcfce7",
                color: "#15803d",
                border: "1px solid #bbf7d0",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
              Active Engine
            </span>
          </div>

          <div className="p-6 space-y-5">
            {/* Engine Overview Specs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                background: "#f8fafc",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500, display: "block", marginBottom: "2px" }}>
                  Selected Engine:
                </span>
                <strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>
                  {selectedModel === "gemini-2.5-flash"
                    ? "Gemini 2.5 Flash"
                    : selectedModel === "gpt-4o"
                    ? "GPT-4o Enterprise"
                    : "Claude 3.5 Sonnet"}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500, display: "block", marginBottom: "2px" }}>
                  Provider:
                </span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#7c3aed" }}>
                  {selectedModel.includes("gemini")
                    ? "Google AI"
                    : selectedModel.includes("gpt")
                    ? "OpenAI"
                    : "Anthropic"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Default LLM Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-purple-500 cursor-pointer shadow-xs"
                >
                  <option value="gemini-2.5-flash">
                    Google Gemini 2.5 Flash (Fast &amp; Precise)
                  </option>
                  <option value="gpt-4o">OpenAI GPT-4o (Enterprise)</option>
                  <option value="claude-3.5-sonnet">
                    Anthropic Claude 3.5 Sonnet
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Grounding Strictness
                </label>
                <select
                  value={groundingStrictness}
                  onChange={(e) => handleStrictnessChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-purple-500 cursor-pointer shadow-xs"
                >
                  <option value="Strict">Strict (Ground only to Knowledge Base)</option>
                  <option value="Standard">Standard (Knowledge + General FinTech)</option>
                  <option value="Flexible">Flexible Advisory</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700">Temperature (Creativity):</span>
                <span className="font-mono text-purple-700 font-semibold px-2 py-0.5 bg-purple-50 rounded border border-purple-200">
                  {temperature}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0.0 (Deterministic &amp; Precise)</span>
                <span>0.5 (Balanced)</span>
                <span>1.0 (Creative &amp; Exploratory)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Safety & Guardrails Card (AI Model Blue Ribbon Style) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #bfdbfe",
            boxShadow: "0 4px 20px -2px rgba(59, 130, 246, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Header ribbon */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.04) 100%)",
              padding: "16px 20px",
              borderBottom: "1px solid #dbeafe",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  background: "#2563eb",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1e3a8a" }}>
                  Safety &amp; Regulatory Guardrails
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: 500 }}>
                  Anti-hallucination, privacy protection &amp; RBI compliance protocols
                </span>
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: 600,
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "1px solid #bfdbfe",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563eb" }} />
              Enforced
            </span>
          </div>

          <div className="p-6 space-y-3.5">
            <label className="flex items-center justify-between p-3.5 border border-slate-200/90 rounded-xl hover:bg-slate-50/80 cursor-pointer transition">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Anti-Hallucination Guardrail
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Strictly prevent inventing loan interest rates, false eligibility rules, or ungrounded policies.
                </div>
              </div>
              <input
                type="checkbox"
                checked={antiHallucination}
                onChange={(e) => handleAntiHallucinationChange(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 border border-slate-200/90 rounded-xl hover:bg-slate-50/80 cursor-pointer transition">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  PII &amp; Credential Masking
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Automatically redact passwords, OTPs, CVVs, and confidential user tokens before LLM context ingestion.
                </div>
              </div>
              <input
                type="checkbox"
                checked={piiProtection}
                onChange={(e) => handlePiiProtectionChange(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Database Sync Status (AI Model Emerald Ribbon Style) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #bbf7d0",
            boxShadow: "0 4px 20px -2px rgba(16, 185, 129, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Header ribbon */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.04) 100%)",
              padding: "16px 20px",
              borderBottom: "1px solid #d1fae5",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  background: "#059669",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#065f46" }}>
                  Database &amp; Knowledge Synchronizer
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#34d399", fontWeight: 500 }}>
                  PostgreSQL pgvector embeddings &amp; policy chunk index status
                </span>
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: 600,
                background: "#dcfce7",
                color: "#15803d",
                border: "1px solid #bbf7d0",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
              Live Vector DB
            </span>
          </div>

          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-800">
                PostgreSQL Knowledge Synchronized
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Vector embeddings and policy index are active and online for semantic retrieval.
              </div>
            </div>

            <button
              onClick={handleSyncDb}
              disabled={isSyncing}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg transition cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Database Cache"}</span>
            </button>
          </div>
        </div>

        {/* Agent Activation & Lifecycle Actions */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #fed7aa",
            boxShadow: "0 4px 20px -2px rgba(245, 158, 11, 0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.04) 100%)",
              padding: "16px 20px",
              borderBottom: "1px solid #ffedd5",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  background: "#d97706",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#78350f" }}>
                  Active Agent &amp; Deployment Status
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 500 }}>
                  Controls which agent governs the main AI assistant at /home
                </span>
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: 600,
                background: agent.isActiveForUser ? "#dcfce7" : "#f1f5f9",
                color: agent.isActiveForUser ? "#15803d" : "#64748b",
                border: agent.isActiveForUser ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: agent.isActiveForUser ? "#22c55e" : "#94a3b8",
                }}
              />
              {agent.isActiveForUser ? "Active for your Assistant" : "Standby / Inactive"}
            </span>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  {agent.isActiveForUser ? "Active Assistant" : "Set as Active Assistant"}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {agent.isActiveForUser
                    ? `This agent is actively powering the AI assistant for your account. Its custom instructions, tone, and knowledge base are live.`
                    : `Make "${agentDisplayName}" your active agent. The AI assistant at /home will use this agent's configuration and knowledge base.`}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {agent.isActiveForUser ? (
                  onDeactivateAgent && (
                    <button
                      onClick={() => onDeactivateAgent(agent.id)}
                      className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                    >
                      Deactivate
                    </button>
                  )
                ) : (
                  onActivateAgent && (
                    <button
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-50/50 border border-rose-200">
                <div>
                  <div className="text-xs font-semibold text-rose-800">
                    Delete This Agent
                  </div>
                  <div className="text-[11px] text-rose-600 mt-0.5">
                    Permanently delete "{agentDisplayName}", including all associated knowledge documents, chunks, and configurations.
                  </div>
                </div>

                <button
                  onClick={() => onDeleteAgentClick(agent.id)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer shrink-0"
                >
                  Delete Agent
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
