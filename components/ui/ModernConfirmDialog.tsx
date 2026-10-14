"use client";

import React, { useEffect } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

export interface ModernConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  itemTitle?: string;
  itemSubtitle?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export default function ModernConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemTitle,
  itemSubtitle,
  confirmText = "Delete",
  cancelText = "Cancel",
  isLoading = false,
}: ModernConfirmDialogProps) {
  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden transform transition-all animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-gradient-to-r from-rose-50/60 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100/80 text-rose-600 flex items-center justify-center shrink-0 shadow-xs border border-rose-200/60">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                This action requires your confirmation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3.5">
          <p className="text-xs text-slate-600 leading-relaxed">
            {description}
          </p>

          {/* Optional item target card */}
          {(itemTitle || itemSubtitle) && (
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-0.5">
              {itemTitle && (
                <div className="text-xs font-bold text-slate-800 break-words">
                  {itemTitle}
                </div>
              )}
              {itemSubtitle && (
                <div className="text-[11px] text-slate-500">
                  {itemSubtitle}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50 active:scale-95 shadow-xs"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 border border-rose-700 rounded-xl transition cursor-pointer disabled:opacity-60 active:scale-95 shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
