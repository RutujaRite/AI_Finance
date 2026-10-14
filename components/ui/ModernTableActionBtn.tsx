"use client";

import React from "react";
import { Trash2 } from "lucide-react";

export interface ModernTableActionBtnProps {
  icon?: React.ReactNode;
  variant?: "neutral" | "primary" | "danger" | "success" | "warning";
  tooltip?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}

export default function ModernTableActionBtn({
  icon,
  variant = "neutral",
  tooltip,
  onClick,
  disabled = false,
  className = "",
  title,
  children,
}: ModernTableActionBtnProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-blue-50/80 hover:bg-blue-100/90 text-blue-600 hover:text-blue-700 border-blue-200/70";
      case "danger":
        return "bg-rose-50/80 hover:bg-rose-100/90 text-rose-600 hover:text-rose-700 border-rose-200/70";
      case "success":
        return "bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-600 hover:text-emerald-700 border-emerald-200/70";
      case "warning":
        return "bg-amber-50/80 hover:bg-amber-100/90 text-amber-600 hover:text-amber-700 border-amber-200/70";
      case "neutral":
      default:
        return "bg-slate-50/80 hover:bg-slate-100 text-slate-600 hover:text-slate-800 border-slate-200/70";
    }
  };

  const displayTitle = tooltip || title;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={displayTitle}
      aria-label={displayTitle}
      className={`inline-flex items-center justify-center gap-1.5 p-1.5 rounded-lg border text-xs font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-xs ${getVariantStyles()} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export interface ModernDeleteActionBtnProps {
  tooltip?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}

export function ModernDeleteActionBtn({
  tooltip = "Delete item",
  onClick,
  disabled = false,
  className = "",
  title,
  children,
}: ModernDeleteActionBtnProps) {
  return (
    <ModernTableActionBtn
      icon={<Trash2 className="w-3.5 h-3.5" />}
      variant="danger"
      tooltip={tooltip || title}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </ModernTableActionBtn>
  );
}
