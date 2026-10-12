// components/agent-studio/CreateAgentModal.tsx
"use client";

import React, { useState } from "react";
import { UserSubscriptionState } from "@/lib/agent-studio/types";

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: UserSubscriptionState;
  onCreate: (data: { name: string; description: string; purpose: string }) => Promise<void>;
  onViewPlans: () => void;
}

export default function CreateAgentModal({
  isOpen,
  onClose,
  subscription,
  onCreate,
  onViewPlans,
}: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLimitReached =
    subscription.plan === "basic" && subscription.agentsCount >= subscription.maxAgents;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide an agent name");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        purpose: purpose.trim(),
      });
      setName("");
      setDescription("");
      setPurpose("");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create agent");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/25 backdrop-blur-[2px] animate-fadeIn">
      <div
        className="w-full max-w-lg bg-white rounded-2xl p-6 border border-slate-100 shadow-xl relative"
        style={{
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03)",
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition"
          aria-label="Close"
        >
          <i className="bi bi-x-lg text-sm" />
        </button>

        {isLimitReached ? (
          <div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 border border-purple-100">
              <i className="bi bi-shield-exclamation text-xl" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              You've reached your Basic plan limit.
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Your Basic plan includes 1 AI agent. Upgrade to Pro to create up to 5 AI agents with expanded test messages and custom knowledge bases.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  onClose();
                  onViewPlans();
                }}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition shadow-sm hover:shadow"
              >
                View Plans
              </button>
              <button
                onClick={onClose}
                className="py-2.5 px-4 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-sm font-medium rounded-xl border border-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <i className="bi bi-robot text-lg" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Create your AI Agent</h3>
                <p className="text-xs text-slate-500">Configure the initial identity for your new assistant</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs flex items-center gap-2">
                <i className="bi bi-exclamation-circle" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Customer Support Assistant"
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-sm text-slate-800 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Help customers with product questions, order tracking, and policies..."
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-sm text-slate-800 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Purpose
                </label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={3}
                  placeholder="What should this agent help with? (e.g., Greet visitors, explain FAQs, collect qualification data)"
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-sm text-slate-800 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none transition resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition shadow-sm hover:shadow disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Agent"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-sm font-medium rounded-xl border border-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
