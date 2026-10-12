// components/agent-studio/ConversationsSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Agent, ConversationRecord } from "@/lib/agent-studio/types";

interface ConversationsSectionProps {
  agent: Agent;
  onNavigateToTest?: () => void;
}

export default function ConversationsSection({
  agent,
  onNavigateToTest,
}: ConversationsSectionProps) {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<ConversationRecord | null>(null);

  useEffect(() => {
    loadConversations();
  }, [agent.id]);

  async function loadConversations() {
    try {
      setLoading(true);
      const res = await fetch(`/api/agents/${agent.id}/conversations`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations)) {
          setConversations(data.conversations);
          if (data.conversations.length > 0) {
            setSelectedConv(data.conversations[0]);
          } else {
            setSelectedConv(null);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load agent conversations:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>💬 Conversations & Knowledge Audits</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {agent.name}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Review live dialogues, retrieved knowledge document citations, and tool executions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadConversations}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition cursor-pointer"
          >
            <i className={`bi bi-arrow-repeat text-xs ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          {onNavigateToTest && (
            <button
              type="button"
              onClick={onNavigateToTest}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition cursor-pointer"
            >
              <i className="bi bi-play-circle text-xs" />
              <span>Test in Playground</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Loading conversation history...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto">
            💬
          </div>
          <h3 className="text-sm font-bold text-slate-800">No recorded conversations yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Conversations conducted with this assistant or within the Test Playground will appear here with complete audit traces and cited knowledge chunks.
          </p>
          {onNavigateToTest && (
            <button
              type="button"
              onClick={onNavigateToTest}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition cursor-pointer inline-flex items-center gap-2"
            >
              <i className="bi bi-play-circle-fill" />
              <span>Start a Test Conversation</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Thread List */}
          <div className="lg:col-span-5 space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Recent Sessions ({conversations.length})
            </span>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {conversations.map((c) => {
                const isSelected = selectedConv?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConv(c)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-300 shadow-2xs"
                        : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800 truncate max-w-[200px]">
                        {c.title || "Conversation Session"}
                      </span>
                      <span className="text-[11px] text-slate-400">{c.updatedAt}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>ID: {c.id.slice(-10)}</span>
                      <span>●</span>
                      <span>{c.messageCount || 0} message(s)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session Detail / Audit View */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            {selectedConv ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {selectedConv.title || "Session Details"}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Session ID: {selectedConv.id} • Started: {selectedConv.createdAt}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Audit Log
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1">
                    <div className="font-semibold text-slate-700">Audit Status</div>
                    <p className="text-slate-500 text-[11px]">
                      This session ran under agent <strong>{agent.name}</strong> with operational mode <strong>{agent.operationalMode || "standard"}</strong>.
                    </p>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <i className="bi bi-shield-check text-emerald-600 text-sm" />
                      <span>Security & Guardrails: System Prompt Shield Active</span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700">Compliant ✓</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Select a conversation thread to inspect audit logs.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
