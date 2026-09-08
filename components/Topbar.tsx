/**
 * Shared application topbar styled with the CallNow CRM Design System.
 *
 * Renders the brand (AI Assistant), right-aligned navigation menu (Home, AI Assistant,
 * EMI Calculator, Bank Policy, Bank Manager, and Admin if admin), theme toggle,
 * and user profile menu with working Logout.
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export type DashboardSection = "home" | "assistant" | "emi" | "policies"

export default function Topbar({
  user,
  pathname = "",
  selectedModel,
  onModelChange,
  activeSection,
  onSectionChange,
  onToggleSidebar,
  sidebarOpen = true,
}: {
  user: any
  pathname?: string
  selectedModel?: string
  onModelChange?: (id: string) => void
  activeSection?: DashboardSection
  onSectionChange?: (section: DashboardSection) => void
  onToggleSidebar?: () => void
  sidebarOpen?: boolean
}) {
  const router = useRouter()
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const current = (document.documentElement.getAttribute("data-bs-theme") as "light" | "dark") || "light"
      setTheme(current)
    }
  }, [])

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-bs-theme", nextTheme)
      try {
        localStorage.setItem("theme", nextTheme)
      } catch (e) {}
    }
  }

  async function handleLogout(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch (err) {
      console.error("Logout error:", err)
    }
    try {
      localStorage.removeItem("emi_chat_state_v2")
    } catch (e) {}
    router.replace("/login")
  }

  const navItems: Array<{
    id: string
    label: string
    section?: DashboardSection
    href: string
    iconClass: string
    adminOnly?: boolean
  }> = [
    {
      id: "home",
      label: "Home",
      section: "home",
      href: "/home",
      iconClass: "bi bi-grid-1x2",
    },
    {
      id: "assistant",
      label: "AI Assistant",
      section: "assistant",
      href: "/home?section=assistant",
      iconClass: "bi bi-chat-dots",
    },
    {
      id: "emi",
      label: "EMI Calculator",
      section: "emi",
      href: "/home?section=emi",
      iconClass: "bi bi-calculator",
    },
    {
      id: "policies",
      label: "Bank Policy",
      section: "policies",
      href: "/home?section=policies",
      iconClass: "bi bi-file-earmark-text",
    },
    {
      id: "bank-managers",
      label: "Bank Manager",
      href: "/bank-managers",
      iconClass: "bi bi-people",
    },
    {
      id: "admin",
      label: "Admin",
      href: "/admin",
      adminOnly: true,
      iconClass: "bi bi-shield-lock",
    },
  ]

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && user?.role !== "admin") return false
    return true
  })

  const userInitial = (user?.name || user?.email || "U").charAt(0).toUpperCase()
  const displayName = user?.name || user?.email?.split("@")[0] || "Account"

  return (
    <header className="app-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {onToggleSidebar && activeSection === "assistant" && (
          <button
            className={`chat-sidebar-toggle ${sidebarOpen ? "open" : "closed"}`}
            id="chatSidebarToggle"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            type="button"
            title={sidebarOpen ? "Close sidebar (Ctrl+Shift+S)" : "Open sidebar (Ctrl+Shift+S)"}
          >
            <i className="bi bi-list" style={{ fontSize: "1.25rem", lineHeight: 1 }} />
          </button>
        )}
        <a
          className="brand"
          href="/home"
          onClick={(e) => {
            if (onSectionChange) {
              e.preventDefault()
              onSectionChange("home")
            }
          }}
        >
          <span className="brand-mark">
            <i className="bi bi-robot" />
          </span>
          <span className="brand-text">AI Assistant</span>
        </a>
      </div>

      <nav className="nav-menu" aria-label="Main navigation">
        {visibleNavItems.map((item) => {
          const isSectionActive =
            onSectionChange && item.section
              ? activeSection === item.section
              : pathname === item.href || (pathname === "/home" && item.section === "home" && !activeSection)

          if (onSectionChange && item.section) {
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isSectionActive ? "active" : ""}`}
                onClick={() => onSectionChange(item.section!)}
              >
                <i className={item.iconClass} />
                <span>{item.label}</span>
              </button>
            )
          }

          return (
            <a
              key={item.id}
              href={item.href}
              className={`nav-item ${isSectionActive ? "active" : ""}`}
            >
              <i className={item.iconClass} />
              <span>{item.label}</span>
            </a>
          )
        })}
      </nav>

      <div className="topbar-actions">
        {/* Dark / Light theme toggle */}
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label="Toggle dark/light theme"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <i className={theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill"} />
        </button>

        {/* Profile menu */}
        <div className="profile-menu" role="button" tabIndex={0} onClick={() => router.push("/profile")}>
          <div className="profile-avatar">{userInitial}</div>
          <span className="profile-menu-label">{displayName}</span>
          <i className="bi bi-chevron-down caret" />
          <div className="profile-dropdown" onClick={(e) => e.stopPropagation()}>
            <a href="/profile">
              <i className="bi bi-person" /> Profile
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="logout-btn"
            >
              <i className="bi bi-box-arrow-right" /> Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}