"use client";

import React from "react";

export type StatusVariant = "active" | "inactive" | "pending" | "review" | "draft" | "success" | "error" | "info";

interface ModernStatusBadgeProps {
  status?: string | null;
  variant?: StatusVariant;
  label?: string;
  showDot?: boolean;
}

export default function ModernStatusBadge({
  status,
  variant,
  label,
  showDot = true,
}: ModernStatusBadgeProps) {
  const normalized = (variant || status || "active").toLowerCase().trim();

  let badgeClass = "cw-badge-neutral";
  let displayLabel = label || status || "Active";
  let dotColor = "#64748b";

  if (normalized === "active" || normalized === "success" || normalized === "operational") {
    badgeClass = "cw-badge-success";
    dotColor = "#16a34a";
    displayLabel = label || "Active";
  } else if (normalized === "inactive" || normalized === "disabled") {
    badgeClass = "cw-badge-neutral";
    dotColor = "#94a3b8";
    displayLabel = label || "Inactive";
  } else if (normalized === "pending" || normalized === "review" || normalized === "warning") {
    badgeClass = "cw-badge-warning";
    dotColor = "#d97706";
    displayLabel = label || (normalized === "review" ? "In Review" : "Pending");
  } else if (normalized === "error" || normalized === "rejected" || normalized === "failed") {
    badgeClass = "cw-badge-danger";
    dotColor = "#dc2626";
    displayLabel = label || "Failed";
  } else if (normalized === "info" || normalized === "draft") {
    badgeClass = "cw-badge-info";
    dotColor = "#2563eb";
    displayLabel = label || "Draft";
  }

  return (
    <span className={`cw-badge ${badgeClass}`}>
      {showDot && (
        <span
          className="cw-dot-pulse"
          style={{
            background: dotColor,
          }}
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}
