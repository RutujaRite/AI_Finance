"use client";

import React from "react";
import { Search, X } from "lucide-react";

interface ModernSearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  width?: string | number;
  className?: string;
}

export default function ModernSearchBar({
  value,
  onChange,
  placeholder = "Search records...",
  ariaLabel = "Search input",
  width = 260,
  className = "",
}: ModernSearchBarProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: typeof width === "number" ? `${width}px` : width,
        display: "inline-block",
      }}
    >
      <Search
        style={{
          position: "absolute",
          left: 11,
          top: "50%",
          transform: "translateY(-50%)",
          width: 15,
          height: 15,
          color: "#94a3b8",
          pointerEvents: "none",
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="cw-input"
        style={{
          paddingLeft: 34,
          paddingRight: value ? 32 : 12,
          height: 38,
          fontSize: "0.8125rem",
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}
