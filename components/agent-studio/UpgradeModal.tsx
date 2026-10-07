// components/agent-studio/UpgradeModal.tsx
"use client";

import React from "react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewPlans: () => void;
  title?: string;
  subtitle?: string;
  actionText?: string;
}

export default function UpgradeModal({
  isOpen,
  onClose,
  onViewPlans,
  title = "You've reached your free testing limit.",
  subtitle = "Your AI agent is saved and ready. Upgrade your plan to continue testing with more messages.",
  actionText = "View Plans",
}: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/25 backdrop-blur-[2px] animate-fadeIn">
      <div
        className="w-full max-w-md bg-white rounded-2xl p-6 border border-slate-100 shadow-xl relative"
        style={{
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03)",
        }}
      >
        {/* Soft Close Icon */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition"
          aria-label="Close"
        >
          <i className="bi bi-x-lg text-sm" />
        </button>

        {/* Soft Icon Badge */}
        <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 border border-purple-100">
          <i className="bi bi-stars text-xl" />
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          {title}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          {subtitle}
        </p>

        {/* Clean Soft Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              onClose();
              onViewPlans();
            }}
            className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition shadow-sm hover:shadow"
          >
            {actionText}
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-sm font-medium rounded-xl border border-slate-200 transition"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
