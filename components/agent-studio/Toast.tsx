// components/agent-studio/Toast.tsx
"use client";

import React, { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "info" | "warning";
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = "success",
  onClose,
  duration = 3200,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgStyles =
    type === "success"
      ? "bg-white text-slate-800 border-emerald-200 shadow-sm"
      : type === "warning"
      ? "bg-white text-slate-800 border-amber-200 shadow-sm"
      : "bg-white text-slate-800 border-blue-200 shadow-sm";

  const iconClass =
    type === "success"
      ? "bi bi-check-circle-fill text-emerald-500"
      : type === "warning"
      ? "bi bi-exclamation-triangle-fill text-amber-500"
      : "bi bi-info-circle-fill text-blue-500";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border ${bgStyles} transition-all duration-300 transform translate-y-0 opacity-100 shadow-lg`}
      style={{
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
      }}
    >
      <i className={`${iconClass} text-lg`} />
      <span className="text-sm font-medium text-slate-700">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
      >
        <i className="bi bi-x text-base" />
      </button>
    </div>
  );
}
