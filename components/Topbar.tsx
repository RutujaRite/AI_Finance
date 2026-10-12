/**
 * Shared application topbar styled with Modern FinTech Design System.
 *
 * Renders the brand, responsive navigation menu (Home, AI Assistant,
 * EMI Calculator, Bank Policy, Bank Manager, and Admin if admin),
 * role badge, dark/light theme toggle, and elevated user profile menu with working Logout.
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

export type DashboardSection = "assistant" | "emi" | "eligibility" | "policies"

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
  const nextPathname = usePathname() || ""
  const effectivePath = pathname || nextPathname || ""
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [profileOpen, setProfileOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [activeAdminToolId, setActiveAdminToolId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const current =
        (document.documentElement.getAttribute("data-theme") as "light" | "dark") ||
        (document.documentElement.getAttribute("data-bs-theme") as "light" | "dark") ||
        "light"
      setTheme(current)
    }

    const closeDropdown = () => {
      setProfileOpen(false)
      setAdminMenuOpen(false)
    }
    window.addEventListener("click", closeDropdown)
    return () => window.removeEventListener("click", closeDropdown)
  }, [])

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", nextTheme)
      document.documentElement.setAttribute("data-bs-theme", nextTheme)
      try {
        localStorage.setItem("theme", nextTheme)
        localStorage.setItem("finai-theme", nextTheme)
      } catch (e) {}
    }
  }

  async function handleLogout(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } catch (err) {
      console.warn("Logout error:", err)
    }
    try {
      localStorage.removeItem("emi_chat_state_v2")
      localStorage.removeItem("finai_user")
      sessionStorage.clear()
    } catch (e) {}
    router.push("/?logout=true")
  }

  const [currentUser, setCurrentUser] = useState<any>(user)

  useEffect(() => {
    if (user) {
      setCurrentUser(user)
    } else if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("finai_user")
        if (stored) setCurrentUser(JSON.parse(stored))
      } catch {}
    }
  }, [user])

  const activeUser = user || currentUser

  const isAdmin =
    String(activeUser?.role || "").trim().toLowerCase() === "admin" ||
    activeUser?.is_admin === true ||
    String(activeUser?.email || "").toLowerCase() === "admin@gmail.com" ||
    String(activeUser?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
    String(activeUser?.email || "").toLowerCase().startsWith("admin")

  const coreNavItems: Array<{
    id: string
    label: string
    section?: DashboardSection
    href: string
    iconClass: string
    badge?: string
    onClick?: (e: React.MouseEvent) => void
  }> = [
    {
      id: "assistant",
      label: "AI Copilot",
      section: "assistant",
      href: "/home?section=assistant",
      iconClass: "bi bi-chat-dots",
      badge: "AI",
    },
    {
      id: "emi",
      label: "EMI Calculator",
      section: "emi",
      href: "/home?section=emi",
      iconClass: "bi bi-calculator",
    },
    {
      id: "eligibility",
      label: "Eligibility Calculator",
      section: "eligibility",
      href: "/home?section=eligibility",
      iconClass: "bi bi-shield-check",
    },
  ]

  const ADMIN_TOOL_LIST: Array<{
    id: string
    label: string
    shortLabel?: string
    href: string
    iconClass: string
    description: string
    badge?: string
  }> = [
    {
      id: "company-data",
      label: "Company Data",
      shortLabel: "Company Data",
      href: "/admin",
      iconClass: "bi bi-building-gear",
      description: "Bank company categories & employer lists",
      badge: "Data",
    },
    {
      id: "policies",
      label: "Bank Policy",
      shortLabel: "Bank Policy",
      href: "/policies",
      iconClass: "bi bi-file-earmark-text",
      description: "Bank guidelines & credit cutoffs",
      badge: "Rules",
    },
    {
      id: "bank-managers",
      label: "Location & Contact Bank Manager",
      shortLabel: "Location & Contact",
      href: "/bank-managers",
      iconClass: "bi bi-person-badge",
      description: "Branch locations & official manager contacts",
      badge: "Contacts",
    },
    {
      id: "models",
      label: "AI Model",
      shortLabel: "AI Model",
      href: "/admin/models",
      iconClass: "bi bi-cpu",
      description: "STT, LLM & Voice dynamic engines",
      badge: "AI",
    },
    {
      id: "agent-studio",
      label: "AI Agent Studio",
      shortLabel: "Agent Studio",
      href: "/agent-studio",
      iconClass: "bi bi-robot",
      description: "Persona, instructions & RAG demo",
      badge: "Studio",
    },
    {
      id: "navigation",
      label: "Admin Navigation Suite",
      shortLabel: "Navigation",
      href: "/admin/navigation",
      iconClass: "bi bi-compass",
      description: "Portal sitemap & quick jump links",
      badge: "Suite",
    },
    {
      id: "users",
      label: "Users Management",
      shortLabel: "Users Admin",
      href: "/admin/users",
      iconClass: "bi bi-people",
      description: "System accounts & user privileges",
      badge: "Admin",
    },
  ]

  // Detect which admin tool matches the current route
  useEffect(() => {
    const matched = ADMIN_TOOL_LIST.find((tool) => {
      if (tool.href === "/admin") {
        return effectivePath === "/admin"
      }
      return effectivePath === tool.href || effectivePath.startsWith(tool.href)
    })

    if (matched) {
      setActiveAdminToolId(matched.id)
      try {
        localStorage.setItem("creditwise_active_admin_tool", matched.id)
      } catch {}
    } else {
      try {
        const saved = localStorage.getItem("creditwise_active_admin_tool")
        if (saved && ADMIN_TOOL_LIST.some((t) => t.id === saved)) {
          setActiveAdminToolId(saved)
        }
      } catch {}
    }
  }, [effectivePath])

  const activeAdminTool = ADMIN_TOOL_LIST.find((tool) => tool.id === activeAdminToolId) || null

  const isCurrentAdminToolRoute = Boolean(
    activeAdminTool &&
    (activeAdminTool.href === "/admin"
      ? effectivePath === "/admin"
      : effectivePath === activeAdminTool.href || effectivePath.startsWith(activeAdminTool.href))
  )

  const isAdminRouteActive = ADMIN_TOOL_LIST.some((tool) => {
    if (tool.href === "/admin") return effectivePath === "/admin"
    return effectivePath === tool.href || effectivePath.startsWith(tool.href)
  })

  const handleSelectAdminTool = (tool: (typeof ADMIN_TOOL_LIST)[number]) => {
    setAdminMenuOpen(false)
    setActiveAdminToolId(tool.id)
    try {
      localStorage.setItem("creditwise_active_admin_tool", tool.id)
    } catch {}
    router.push(tool.href)
  }

  const handleCloseAdminTool = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveAdminToolId(null)
    try {
      localStorage.removeItem("creditwise_active_admin_tool")
    } catch {}
    if (isAdminRouteActive) {
      if (onSectionChange) {
        onSectionChange("assistant")
        try {
          window.history.pushState(null, "", "/home?section=assistant")
        } catch {}
      } else {
        router.push("/home?section=assistant")
      }
    }
  }

  const userInitial = (activeUser?.name || activeUser?.email || "U").charAt(0).toUpperCase()
  const displayName = activeUser?.name || activeUser?.email?.split("@")[0] || "Account"
  const displayRole = isAdmin ? "Administrator" : "DSA Agent"

  return (
    <>
      <header className="app-topbar">
      {/* Brand & Sidebar Toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {onToggleSidebar && activeSection === "assistant" && (
          <button
            className={`chat-sidebar-toggle ${sidebarOpen ? "open" : "closed"}`}
            id="chatSidebarToggle"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            type="button"
            title={sidebarOpen ? "Close sidebar (Ctrl+Shift+S)" : "Open sidebar (Ctrl+Shift+S)"}
          >
            <i className="bi bi-layout-sidebar-inset" style={{ fontSize: "1.125rem", lineHeight: 1 }} />
          </button>
        )}

        <a
          className="brand"
          href="/home?section=assistant"
          onClick={(e) => {
            if (onSectionChange) {
              e.preventDefault()
              onSectionChange("assistant")
            } else {
              e.preventDefault()
              router.push("/home?section=assistant")
            }
          }}
          style={{ textDecoration: "none" }}
        >
          <span className="brand-mark">
            <i className="bi bi-shield-check" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="brand-text">CreditWise<span style={{ color: "var(--accent)" }}>AI</span></span>
              {isAdmin && (
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(139, 92, 246, 0.15)",
                    color: "#8b5cf6",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                  }}
                >
                  Admin
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.6875rem", color: "var(--ink-muted)", fontWeight: 500, letterSpacing: "0.01em" }}>
              {isAdminRouteActive ? "Admin Management Suite" : "Financial Intelligence"}
            </span>
          </div>
        </a>
      </div>

      {/* Main Desktop Navigation Items */}
      <nav className="nav-menu" aria-label="Main navigation">
        {/* Core items: AI Copilot, EMI Calculator, Eligibility Calculator — ALWAYS CONSTANT */}
        {coreNavItems.map((item) => {
          const isSectionActive =
            !isAdminRouteActive &&
            (onSectionChange && item.section
              ? activeSection === item.section
              : effectivePath === "/home" || effectivePath === "/"
                ? (item.id === "assistant" && (!activeSection || activeSection === "assistant")) ||
                  activeSection === item.section
                : false)

          const handleCoreClick = (e: React.MouseEvent) => {
            e.preventDefault()
            if (item.onClick) {
              item.onClick(e)
            } else if (onSectionChange && item.section && (effectivePath === "/home" || effectivePath === "/")) {
              onSectionChange(item.section)
              try {
                window.history.pushState(null, "", item.href)
              } catch {}
            } else {
              router.push(item.href)
            }
          }

          return (
            <a
              key={item.id}
              href={item.href}
              className={`nav-item ${isSectionActive ? "active" : ""}`}
              onClick={handleCoreClick}
              style={{
                fontWeight: isSectionActive ? 600 : 500,
              }}
            >
              <i className={item.iconClass} />
              <span>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: "4px",
                    background: isSectionActive ? "var(--accent)" : "var(--surface-2)",
                    color: isSectionActive ? "#ffffff" : "var(--ink-muted)",
                    marginLeft: "4px",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </a>
          )
        })}

        {/* Admin Navigation: Dynamic Active Admin Tool Tab + Admin Tool Dropdown */}
        {isAdmin && (
          <>
            {/*
              DYNAMIC ACTIVE ADMIN TOOL TAB:
              Opened immediately to the LEFT of the Admin Tool tab.
              When another admin tool is clicked from the list, it REPLACES this tab!
            */}
            {activeAdminTool && activeAdminTool.id !== 'company-data' && (
              <div
                key={activeAdminTool.id}
                className="admin-active-tab-wrapper animate-fade-in"
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                <a
                  href={activeAdminTool.href}
                  className={`nav-item ${isCurrentAdminToolRoute ? "active" : ""}`}
                  onClick={(e) => {
                    e.preventDefault()
                    router.push(activeAdminTool.href)
                  }}
                  title={`Active Tool: ${activeAdminTool.label}`}
                  style={{
                    fontWeight: 600,
                    border: isCurrentAdminToolRoute
                      ? "1px solid rgba(139, 92, 246, 0.45)"
                      : "1px solid rgba(139, 92, 246, 0.2)",
                    background: isCurrentAdminToolRoute
                      ? "rgba(139, 92, 246, 0.14)"
                      : "var(--surface-2)",
                    color: isCurrentAdminToolRoute ? "#8b5cf6" : "var(--ink)",
                    paddingRight: "0.45rem",
                    gap: "6px",
                  }}
                >
                  <i className={activeAdminTool.iconClass} style={{ color: "#8b5cf6" }} />
                  <span>{activeAdminTool.label}</span>
                  {activeAdminTool.badge && (
                    <span
                      style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: "4px",
                        background: "rgba(139, 92, 246, 0.2)",
                        color: "#8b5cf6",
                        marginLeft: "2px",
                      }}
                    >
                      {activeAdminTool.badge}
                    </span>
                  )}
                  {/* Close Tab Button */}
                  <button
                    type="button"
                    onClick={handleCloseAdminTool}
                    title={`Close ${activeAdminTool.label} tab`}
                    aria-label={`Close ${activeAdminTool.label} tab`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(139, 92, 246, 0.18)",
                      color: "#8b5cf6",
                      cursor: "pointer",
                      marginLeft: "4px",
                      fontSize: "0.75rem",
                      lineHeight: 1,
                      padding: 0,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"
                      e.currentTarget.style.color = "#ef4444"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(139, 92, 246, 0.18)"
                      e.currentTarget.style.color = "#8b5cf6"
                    }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.85rem", lineHeight: 1 }} />
                  </button>
                </a>
              </div>
            )}

            <a
              href="/admin"
              id="adminPanelNavBtn"
              className={`nav-item ${isAdminRouteActive ? "active" : ""}`}
              onClick={(e) => {
                e.preventDefault()
                router.push("/admin")
              }}
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 600,
                background: isAdminRouteActive ? "rgba(139, 92, 246, 0.15)" : "transparent",
                color: isAdminRouteActive ? "#8b5cf6" : "var(--ink)",
                borderColor: isAdminRouteActive ? "rgba(139, 92, 246, 0.35)" : "transparent",
              }}
              title="Open Admin Panel (/admin)"
            >
              <i className="bi bi-shield-lock" style={{ color: "#8b5cf6" }} />
              <span>Admin Panel</span>
            </a>
          </>
        )}
      </nav>

      {/* Topbar Right Controls: Theme + Profile */}
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
        <div
          className="profile-menu"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            setProfileOpen((prev) => !prev)
          }}
          style={{ position: "relative" }}
        >
          <div className="profile-avatar">{userInitial}</div>
          <div style={{ display: "flex", flexDirection: "column", textAlign: "left", lineHeight: 1.15 }}>
            <span className="profile-menu-label" style={{ fontWeight: 600 }}>{displayName}</span>
            <span style={{ fontSize: "0.6875rem", color: "var(--ink-muted)" }}>{displayRole}</span>
          </div>
          <i className={`bi bi-chevron-down caret ${profileOpen ? "open" : ""}`} style={{ fontSize: "0.75rem", transition: "transform 0.2s ease" }} />

          {/* Elevated Dropdown */}
          <div
            className={`profile-dropdown ${profileOpen ? "open" : ""}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: profileOpen ? "block" : "none",
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: "220px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "8px",
              boxShadow: "var(--shadow-xl)",
              zIndex: 1050,
            }}
          >
            {/* User Mini Banner */}
            <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid var(--border)", marginBottom: "6px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--ink)" }}>{displayName}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeUser?.email || "user@creditwise.ai"}
              </div>
              <span
                style={{
                  display: "inline-block",
                  marginTop: "6px",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  background: isAdmin ? "rgba(139, 92, 246, 0.12)" : "rgba(37, 99, 235, 0.1)",
                  color: isAdmin ? "#8b5cf6" : "#2563eb",
                }}
              >
                {isAdmin ? "👑 Administrator" : "💼 DSA Agent"}
              </span>
            </div>

            <a
              href="/profile"
              onClick={(e) => {
                e.preventDefault()
                setProfileOpen(false)
                router.push("/profile")
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "0.8125rem",
                color: "var(--ink)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              <i className="bi bi-person-gear" style={{ color: "var(--accent)" }} /> Profile &amp; Settings
            </a>

            {isAdmin && (
              <a
                href="/admin/users"
                onClick={(e) => {
                  e.preventDefault()
                  setProfileOpen(false)
                  router.push("/admin/users")
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  color: "var(--ink)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                <i className="bi bi-people" style={{ color: "var(--accent)" }} /> All Users Admin
              </a>
            )}

            <div style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />
            <button
              type="button"
              onClick={handleLogout}
              className="logout-btn"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "0.8125rem",
                color: "#dc2626",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              <i className="bi bi-box-arrow-right" /> Secure Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    {/* Top Navigation Section of all admin tools (Rendered across all admin pages) */}
    {isAdmin && isAdminRouteActive && (
      <nav
        className="admin-tools-topbar animate-fade-in"
        aria-label="Admin Tools Navigation"
        style={{
          position: "sticky",
          top: "64px",
          zIndex: 1019,
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.45rem 1.5rem",
          gap: "0.75rem",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            overflowX: "auto",
            scrollbarWidth: "none",
            flexWrap: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "0.25rem 0.65rem",
              borderRadius: "6px",
              background: "rgba(139, 92, 246, 0.1)",
              color: "#8b5cf6",
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginRight: "0.4rem",
              flexShrink: 0,
            }}
          >
            <i className="bi bi-shield-lock-fill" />
            <span>Admin Suite</span>
          </div>

          {ADMIN_TOOL_LIST.map((tool) => {
            const isActive =
              tool.href === "/admin"
                ? effectivePath === "/admin"
                : effectivePath === tool.href || effectivePath.startsWith(tool.href)

            return (
              <a
                key={tool.id}
                href={tool.href}
                className={`admin-subnav-pill ${isActive ? "active" : ""}`}
                onClick={(e) => {
                  e.preventDefault()
                  setActiveAdminToolId(tool.id)
                  try {
                    localStorage.setItem("creditwise_active_admin_tool", tool.id)
                  } catch {}
                  router.push(tool.href)
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.35rem 0.8rem",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  fontWeight: isActive ? 600 : 500,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                  background: isActive ? "rgba(139, 92, 246, 0.14)" : "transparent",
                  color: isActive ? "#8b5cf6" : "var(--ink-soft)",
                  border: isActive ? "1px solid rgba(139, 92, 246, 0.35)" : "1px solid transparent",
                  boxShadow: isActive ? "0 1px 3px rgba(139, 92, 246, 0.12)" : "none",
                }}
              >
                <i
                  className={tool.iconClass}
                  style={{
                    fontSize: "0.875rem",
                    color: isActive ? "#8b5cf6" : "var(--ink-muted)",
                  }}
                />
                <span>{tool.label}</span>
                {tool.badge && (
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: "4px",
                      background: isActive ? "rgba(139, 92, 246, 0.2)" : "var(--surface-2)",
                      color: isActive ? "#8b5cf6" : "var(--ink-muted)",
                    }}
                  >
                    {tool.badge}
                  </span>
                )}
              </a>
            )
          })}
        </div>

        {/* Quick return to AI Copilot workspace */}
        <a
          href="/home?section=assistant"
          onClick={(e) => {
            e.preventDefault()
            if (onSectionChange) {
              onSectionChange("assistant")
            } else {
              router.push("/home?section=assistant")
            }
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--ink-muted)",
            textDecoration: "none",
            padding: "0.3rem 0.65rem",
            borderRadius: "6px",
            background: "var(--surface-2)",
            flexShrink: 0,
            border: "1px solid var(--border)",
          }}
          title="Return to AI Copilot Workspace"
        >
          <i className="bi bi-arrow-left" />
          <span>AI Copilot</span>
        </a>
      </nav>
    )}
  </>
)
}