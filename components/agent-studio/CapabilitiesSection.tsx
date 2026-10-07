// components/agent-studio/CapabilitiesSection.tsx
"use client";

import React from "react";
import { Agent, CapabilityKey } from "@/lib/agent-studio/types";

interface CapabilitiesSectionProps {
  agent: Agent;
  onChange: (updated: Partial<Agent>) => void;
  onSaveChanges: () => void;
  saving?: boolean;
}

interface CapabilityMeta {
  key: CapabilityKey;
  title: string;
  description: string;
  icon: string;
  available: boolean;
}

const CAPABILITIES_LIST: CapabilityMeta[] = [
  {
    key: "answer_questions",
    title: "Answer Questions",
    description: "Provide helpful conversational replies to applicant FAQs and policy queries.",
    icon: "bi bi-chat-text",
    available: true,
  },
  {
    key: "search_knowledge",
    title: "Search Knowledge",
    description: "Semantic search across uploaded bank policy guidelines and PDF documentation.",
    icon: "bi bi-search",
    available: true,
  },
  {
    key: "collect_customer_data",
    title: "Collect Customer Data",
    description: "Extract and store applicant profile details (salary, employer, age, CIBIL).",
    icon: "bi bi-person-lines-fill",
    available: true,
  },
  {
    key: "collect_documents",
    title: "Collect Documents",
    description: "Prompt and track submission of KYC proofs, salary slips, and bank statements.",
    icon: "bi bi-folder-check",
    available: true,
  },
  {
    key: "calculate_emi",
    title: "Calculate EMI",
    description: "Deterministic loan calculation with principal, interest rate, and tenure breakdown.",
    icon: "bi bi-calculator",
    available: true,
  },
  {
    key: "check_eligibility",
    title: "Check Eligibility",
    description: "Multi-bank eligibility matrix evaluation against 23+ lender master policies.",
    icon: "bi bi-patch-check",
    available: true,
  },
  {
    key: "create_lead",
    title: "Create Lead",
    description: "Generate verified loan leads ready for loan officers and branch managers.",
    icon: "bi bi-person-plus",
    available: true,
  },
  {
    key: "human_handoff",
    title: "Human Handoff",
    description: "Transfer live conversation to branch personnel or human relationship managers.",
    icon: "bi bi-headset",
    available: false, // Coming soon as specified
  },
];

export default function CapabilitiesSection({
  agent,
  onChange,
  onSaveChanges,
  saving = false,
}: CapabilitiesSectionProps) {
  function handleToggle(key: CapabilityKey, available: boolean) {
    if (!available) return; // Do not allow enabling if not supported
    const nextVal = !agent.capabilities[key];
    onChange({
      capabilities: {
        ...agent.capabilities,
        [key]: nextVal,
      },
    });
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fadeIn">
      {/* Header bar with Save Changes */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Agent Capabilities
          </h2>
          <p className="text-xs text-slate-500">
            Enable or disable autonomous tools and workflows your assistant can execute.
          </p>
        </div>
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

      {/* Capabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CAPABILITIES_LIST.map((item) => {
          const isEnabled = item.available && Boolean(agent.capabilities[item.key]);

          return (
            <div
              key={item.key}
              className={`p-5 rounded-2xl border transition flex flex-col justify-between ${
                !item.available
                  ? "bg-slate-50/50 border-slate-200/60 opacity-80"
                  : isEnabled
                  ? "bg-white border-indigo-100 shadow-2xs ring-1 ring-indigo-500/10"
                  : "bg-white border-slate-200/80 shadow-2xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${
                        !item.available
                          ? "bg-slate-100 text-slate-400"
                          : isEnabled
                          ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <i className={item.icon} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        {item.title}
                      </h4>
                      {!item.available && (
                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Toggle switch */}
                  {item.available ? (
                    <button
                      type="button"
                      onClick={() => handleToggle(item.key, item.available)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? "bg-indigo-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Off</span>
                  )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Status</span>
                <span
                  className={`font-medium ${
                    !item.available
                      ? "text-purple-600"
                      : isEnabled
                      ? "text-emerald-600 font-semibold"
                      : "text-slate-400"
                  }`}
                >
                  {!item.available ? "Coming Soon" : isEnabled ? "Active" : "Disabled"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
