// components/agent-studio/InbuiltSafetyGuardrails.tsx
"use client";

import React from "react";
import {
  ShieldCheck,
  Lock,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Save,
  Check,
  Sparkles,
} from "lucide-react";

export interface GuardrailSettings {
  piiMasking: boolean;
  promptInjectionDefense: boolean;
  strictKnowledgeGrounding: boolean;
}

export interface InbuiltSafetyGuardrailsProps {
  settings: GuardrailSettings;
  onToggle: (key: keyof GuardrailSettings, value: boolean) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  syncStatusText?: string;
}

export default function InbuiltSafetyGuardrails({
  settings,
  onToggle,
  onSave,
  isSaving,
  syncStatusText = "Policy guardrails active & synchronized",
}: InbuiltSafetyGuardrailsProps) {
  const activeCount = [
    settings.piiMasking,
    settings.promptInjectionDefense,
    settings.strictKnowledgeGrounding,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-200 hover:border-indigo-400 hover:shadow-md">
      {/* 1. Header Ribbon */}
      <div className="bg-gradient-to-r from-indigo-50/90 via-slate-50 to-blue-50/70 px-5 py-4 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-base font-bold text-slate-800">
                Inbuilt Safety &amp; Guardrails
              </h2>
            </div>
            <span className="text-xs text-indigo-600 font-medium">
              Enterprise-grade safety, privacy compliance &amp; anti-hallucination protocols
            </span>
          </div>
        </div>

        {/* Top Status Banner with Active Protection Badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Protection</span>
          </span>
        </div>
      </div>

      {/* 2. Top Status Overview Banner */}
      <div className="p-6 pb-2">
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <div className="font-bold text-slate-800">
                {activeCount} of 3 Guardrail Protections Enabled
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                Incoming queries and model completions are filtered through real-time deterministic filters.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Real-time Enforcement</span>
          </div>
        </div>
      </div>

      {/* 3. Safety Controls List with Interactive Toggles */}
      <div className="p-6 pt-3 space-y-4">
        {/* a) Automatic PII Masking */}
        <div className="p-4 rounded-xl border border-slate-200/80 hover:border-indigo-300 transition-all duration-200 bg-white hover:bg-slate-50/40 flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
              <Lock className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">
                  Automatic PII Masking
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Privacy
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                Redacts sensitive identifiers (government IDs, account details, card numbers, phone numbers) before prompt submission.
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={settings.piiMasking}
            onClick={() => onToggle("piiMasking", !settings.piiMasking)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
              settings.piiMasking ? "bg-indigo-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                settings.piiMasking ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* b) Prompt Injection & Jailbreak Defense */}
        <div className="p-4 rounded-xl border border-slate-200/80 hover:border-indigo-300 transition-all duration-200 bg-white hover:bg-slate-50/40 flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">
                  Prompt Injection &amp; Jailbreak Defense
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                  Security
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                Mitigates system prompt overrides, qualification rule bypasses, and unauthorized instructions.
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={settings.promptInjectionDefense}
            onClick={() =>
              onToggle(
                "promptInjectionDefense",
                !settings.promptInjectionDefense
              )
            }
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
              settings.promptInjectionDefense ? "bg-indigo-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                settings.promptInjectionDefense ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* c) Strict Knowledge Base Grounding */}
        <div className="p-4 rounded-xl border border-slate-200/80 hover:border-indigo-300 transition-all duration-200 bg-white hover:bg-slate-50/40 flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">
                  Strict Knowledge Base Grounding
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                  Grounding
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                Forces output grounding strictly to indexed policy documents with fallback logic for uncertain context.
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={settings.strictKnowledgeGrounding}
            onClick={() =>
              onToggle(
                "strictKnowledgeGrounding",
                !settings.strictKnowledgeGrounding
              )
            }
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
              settings.strictKnowledgeGrounding ? "bg-indigo-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                settings.strictKnowledgeGrounding ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 4. Sticky / Contained Card Footer */}
      <div className="bg-slate-50 px-6 py-4 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium text-slate-700">{syncStatusText}</span>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 text-white" />
              <span>Save Guardrail Rules</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
