"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminHeaderProps {
  user?: any;
  title?: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  showBreadcrumbs?: boolean;
}

export default function AdminHeader({
  user,
  title,
  description,
  breadcrumbs = [],
  actions,
  showBreadcrumbs = true,
}: AdminHeaderProps) {
  const router = useRouter();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setProfileDropdownOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    try {
      localStorage.removeItem("emi_chat_state_v2");
      localStorage.removeItem("finai_user");
      sessionStorage.clear();
    } catch {}
    router.push("/?logout=true");
  }

  const userName =
    user?.name ||
    user?.username ||
    (user?.email ? user.email.split("@")[0] : "Administrator");

  const userInitial = userName.charAt(0).toUpperCase() || "A";

  return (
    <>
      {/* =============================================================== */}
      {/* 1. TOP NAVIGATION BAR */}
      {/* =============================================================== */}
      <header
        style={{
          height: "64px",
          background: "#ffffff",
          borderBottom: "1px solid #eef2f6",
          padding: "0 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        {/* Left: CreditWise AI Brand Logo & Admin Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link
            href="/admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
            }}
          >
            {/* Logo Icon */}
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                flexShrink: 0,
              }}
            >
              <i className="bi bi-shield-check" style={{ fontSize: "1.15rem" }} />
            </div>

            {/* Brand text */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    letterSpacing: "-0.01em",
                  }}
                >
                  CreditWise <span style={{ color: "#2563eb" }}>AI</span>
                </span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "2px 7px",
                    borderRadius: "6px",
                    background: "rgba(37, 99, 235, 0.1)",
                    color: "#2563eb",
                    border: "1px solid rgba(37, 99, 235, 0.25)",
                  }}
                >
                  Admin
                </span>
              </div>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "#64748b",
                  fontWeight: 500,
                }}
              >
                Financial SaaS Management Suite
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Search, Notifications, Profile Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Quick Return to Dashboard if on a sub-page */}
          {title && (
            <Link
              href="/admin"
              className="btn btn-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "0.8rem",
                fontWeight: 600,
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
              }}
            >
              <i className="bi bi-grid-fill" style={{ fontSize: "0.85rem", color: "#2563eb" }} />
              <span>Dashboard</span>
            </Link>
          )}

          {/* Search Icon button */}
          <button
            type="button"
            onClick={() => router.push("/admin/company-search")}
            title="Company Search"
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              color: "#475569",
              fontSize: "0.95rem",
              cursor: "pointer",
              padding: "7px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.color = "#0f172a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.color = "#475569";
            }}
          >
            <i className="bi bi-search" />
          </button>

          {/* Notification Bell with red dot */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              title="Notifications"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                color: "#475569",
                fontSize: "1rem",
                cursor: "pointer",
                padding: "7px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#cbd5e1";
                e.currentTarget.style.color = "#0f172a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.color = "#475569";
              }}
            >
              <i className="bi bi-bell" />
            </button>
            <span
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#ef4444",
                border: "1.5px solid #ffffff",
              }}
            />
          </div>

          {/* Admin Profile Dropdown Capsule */}
          <div style={{ position: "relative" }} ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                cursor: "pointer",
                padding: "4px 10px 4px 6px",
                borderRadius: "20px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#cbd5e1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
              }}
            >
              {/* Circular Avatar */}
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: "#1e293b",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                }}
              >
                {userInitial}
              </div>

              {/* Text label */}
              <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#0f172a",
                    lineHeight: 1.1,
                  }}
                >
                  {userName}
                </span>
                <span style={{ fontSize: "0.68rem", color: "#64748b" }}>Admin</span>
              </div>

              <i
                className={`bi bi-chevron-down ${profileDropdownOpen ? "rotate-180" : ""}`}
                style={{
                  fontSize: "0.75rem",
                  color: "#64748b",
                  marginLeft: "2px",
                  transition: "transform 0.18s ease",
                }}
              />
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: "8px",
                  width: "240px",
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.08)",
                  padding: "6px 0",
                  zIndex: 200,
                  fontSize: "0.85rem",
                }}
              >
                <div style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.88rem" }}>
                    {userName}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                    {user?.email || "admin@gmail.com"}
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      marginTop: "6px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "rgba(37, 99, 235, 0.1)",
                      color: "#2563eb",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                    }}
                  >
                    <i className="bi bi-shield-check" />
                    Admin Workspace
                  </div>
                </div>

                <div style={{ padding: "4px 0" }}>
                  <Link
                    href="/admin"
                    onClick={() => setProfileDropdownOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 16px",
                      color: "#334155",
                      textDecoration: "none",
                      fontSize: "0.83rem",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <i className="bi bi-grid-fill" style={{ color: "#2563eb" }} />
                    Admin Dashboard
                  </Link>

                  <Link
                    href="/home?section=assistant"
                    onClick={() => setProfileDropdownOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 16px",
                      color: "#334155",
                      textDecoration: "none",
                      fontSize: "0.83rem",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <i className="bi bi-chat-dots" style={{ color: "#10b981" }} />
                    AI Assistant Workspace
                  </Link>

                  <Link
                    href="/admin/users"
                    onClick={() => setProfileDropdownOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 16px",
                      color: "#334155",
                      textDecoration: "none",
                      fontSize: "0.83rem",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <i className="bi bi-people" style={{ color: "#8b5cf6" }} />
                    User Accounts
                  </Link>
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "4px" }}>
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      padding: "8px 16px",
                      background: "none",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontSize: "0.83rem",
                      color: "#dc2626",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <i className="bi bi-box-arrow-right" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =============================================================== */}
      {/* 2. BREADCRUMBS & PAGE HEADER SECTION (Optional / Sub-pages) */}
      {/* =============================================================== */}
      {showBreadcrumbs && (title || breadcrumbs.length > 0) && (
        <section
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            padding: "16px 28px",
          }}
        >
          <div
            style={{
              maxWidth: "1400px",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            {/* Left: Breadcrumb Navigation & Title */}
            <div>
              {/* Breadcrumb links */}
              <nav
                aria-label="Breadcrumb"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.8125rem",
                  color: "#64748b",
                  marginBottom: "6px",
                }}
              >
                <Link
                  href="/admin"
                  style={{
                    color: "#2563eb",
                    textDecoration: "none",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <i className="bi bi-house-door-fill" style={{ fontSize: "0.8rem" }} />
                  <span>Admin Dashboard</span>
                </Link>

                <i className="bi bi-chevron-right" style={{ fontSize: "0.68rem", color: "#94a3b8" }} />

                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        style={{
                          color: "#2563eb",
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span style={{ color: "#334155", fontWeight: 600 }}>{crumb.label}</span>
                    )}
                    {idx < breadcrumbs.length - 1 && (
                      <i className="bi bi-chevron-right" style={{ fontSize: "0.68rem", color: "#94a3b8" }} />
                    )}
                  </React.Fragment>
                ))}

                {breadcrumbs.length === 0 && title && (
                  <span style={{ color: "#334155", fontWeight: 600 }}>{title}</span>
                )}
              </nav>

              {/* Title & Subtitle */}
              {title && (
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                  <h1
                    style={{
                      fontSize: "1.45rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: 0,
                      letterSpacing: "-0.015em",
                    }}
                  >
                    {title}
                  </h1>
                </div>
              )}
              {description && (
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#64748b",
                    margin: "3px 0 0 0",
                  }}
                >
                  {description}
                </p>
              )}
            </div>

            {/* Right: Actions / Back to Dashboard */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="btn btn-sm"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#ffffff",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "6px 14px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.borderColor = "#94a3b8";
                  e.currentTarget.style.color = "#0f172a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.color = "#475569";
                }}
              >
                <i className="bi bi-arrow-left" />
                <span>Back to Dashboard</span>
              </button>

              {actions}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
