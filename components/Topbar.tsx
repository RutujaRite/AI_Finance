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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [activeAdminToolId, setActiveAdminToolId] = useState<string | null>(null)

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (mobileDrawerOpen) {
        document.body.style.overflow = "hidden"
      } else {
        document.body.style.overflow = ""
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = ""
      }
    }
  }, [mobileDrawerOpen])

  // Close drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [effectivePath])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const syncTheme = () => {
        const saved =
          (localStorage.getItem("theme") as "light" | "dark") ||
          (localStorage.getItem("finai-theme") as "light" | "dark") ||
          (document.documentElement.getAttribute("data-theme") as "light" | "dark") ||
          (document.documentElement.getAttribute("data-bs-theme") as "light" | "dark") ||
          "light"
        setTheme(saved)
        document.documentElement.setAttribute("data-theme", saved)
        document.documentElement.setAttribute("data-bs-theme", saved)
        if (saved === "dark") {
          document.documentElement.classList.add("dark")
        } else {
          document.documentElement.classList.remove("dark")
        }
      }
      syncTheme()
      window.addEventListener("theme-change", syncTheme)
      window.addEventListener("storage", syncTheme)
    }

    const closeDropdown = () => {
      setProfileOpen(false)
      setAdminMenuOpen(false)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileDrawerOpen(false)
        setProfileOpen(false)
        setAdminMenuOpen(false)
      }
    }

    window.addEventListener("click", closeDropdown)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("click", closeDropdown)
      window.removeEventListener("keydown", handleKeyDown)
      if (typeof window !== "undefined") {
        window.removeEventListener("theme-change", () => {})
        window.removeEventListener("storage", () => {})
      }
    }
  }, [])

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", nextTheme)
      document.documentElement.setAttribute("data-bs-theme", nextTheme)
      if (nextTheme === "dark") {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
      try {
        localStorage.setItem("theme", nextTheme)
        localStorage.setItem("finai-theme", nextTheme)
        localStorage.setItem("creditwise_theme", nextTheme)
        document.cookie = `theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`
      } catch (e) {}
      window.dispatchEvent(new CustomEvent("theme-change", { detail: { theme: nextTheme } }))
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
      label: "AI Assistant",
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
      id: "dashboard",
      label: "Admin Dashboard",
      shortLabel: "Dashboard",
      href: "/admin",
      iconClass: "bi bi-grid-fill",
      description: "Platform data, cards & activity center",
      badge: "Admin",
    },
    {
      id: "company-data",
      label: "Company Search",
      shortLabel: "Company Search",
      href: "/admin/company-search",
      iconClass: "bi bi-building",
      description: "Bank company categories & employer lists",
      badge: "Data",
    },
    {
      id: "policies",
      label: "Bank Policy",
      shortLabel: "Bank Policy",
      href: "/admin/bank-policy",
      iconClass: "bi bi-shield-check",
      description: "Bank guidelines & credit cutoffs",
      badge: "Rules",
    },
    {
      id: "bank-managers",
      label: "Bank Manager and Locations",
      shortLabel: "Manager & Locations",
      href: "/admin/bank-manager-locations",
      iconClass: "bi bi-people",
      description: "Branch locations & official manager contacts",
      badge: "Contacts",
    },
    {
      id: "models",
      label: "AI Model",
      shortLabel: "AI Model",
      href: "/admin/ai-model",
      iconClass: "bi bi-cpu",
      description: "STT, LLM & Voice dynamic engines",
      badge: "AI",
    },
    {
      id: "agent-studio",
      label: "AI Agent Configuration",
      shortLabel: "Agent Config",
      href: "/agent-studio",
      iconClass: "bi bi-robot",
      description: "Persona, instructions & RAG demo",
      badge: "Config",
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
      <header className="app-topbar yt-topbar">
      {/* 1. Left Group: YouTube-style Hamburger Button + Brand with Badge */}
      <div className="yt-topbar-left" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Hamburger Menu on the FAR LEFT */}
        <button
          type="button"
          className="yt-hamburger-btn cw-touch-target"
          onClick={() => {
            if (activeSection === "assistant" && onToggleSidebar && typeof window !== "undefined" && window.innerWidth > 900) {
              onToggleSidebar()
            } else {
              setMobileDrawerOpen(true)
            }
          }}
          aria-label="Navigation Menu"
          title="Navigation menu"
        >
          <i className="bi bi-list" style={{ fontSize: "1.35rem", lineHeight: 1 }} />
        </button>

        {/* Brand Logo with IN / Admin badge */}
        <a
          className="brand yt-brand"
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
          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}
        >
          <span className="brand-mark yt-brand-mark">
            <i className="bi bi-shield-check" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span className="brand-text">CreditWise<span style={{ color: "var(--accent)" }}>AI</span></span>
              <span
                className="yt-country-badge"
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  background: isAdmin ? "rgba(139, 92, 246, 0.15)" : "rgba(37, 99, 235, 0.12)",
                  color: isAdmin ? "#8b5cf6" : "#2563eb",
                  border: isAdmin ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid rgba(37, 99, 235, 0.25)",
                }}
              >
                {isAdmin ? "Admin" : "IN"}
              </span>
            </div>
            <span className="yt-brand-sub" style={{ fontSize: "0.6875rem", color: "var(--ink-muted)", fontWeight: 500, letterSpacing: "0.01em" }}>
              {isAdminRouteActive ? "Admin Suite" : "Financial Intelligence"}
            </span>
          </div>
        </a>
      </div>

      {/* Main Desktop Navigation Items */}
      <nav className="nav-menu" aria-label="Main navigation">
        {/* Core items: AI Assistant, EMI Calculator, Eligibility Calculator — ALWAYS CONSTANT */}
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

        {/* Admin Dashboard: Immediately beside Eligibility Calculator (Admin only) */}
        {isAdmin && (
          <a
            href="/admin"
            id="adminDashboardNavBtn"
            className={`nav-item ${effectivePath === "/admin" ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault()
              router.push("/admin")
            }}
            style={{
              fontWeight: effectivePath === "/admin" ? 600 : 500,
            }}
            title="Open Admin Dashboard (/admin)"
          >
            <i className="bi bi-grid-fill" />
            <span>Admin Dashboard</span>
          </a>
        )}
      </nav>

      {/* Topbar Right Controls: YouTube-style "+ Create" Pill + Theme + Circular Profile Avatar on FAR RIGHT */}
      <div className="topbar-actions yt-topbar-right" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* YouTube-style "+ Create" / "+ New" Pill Button */}
        <button
          type="button"
          className="yt-create-pill-btn"
          onClick={() => {
            if (activeSection === "assistant") {
              const newChatBtn = document.getElementById("newChatBtn")
              if (newChatBtn) newChatBtn.click()
              else router.push("/home?section=assistant&new=true")
            } else if (activeSection === "eligibility") {
              // Trigger add new loan row
              const addRowBtn = document.querySelector(".tbl-btn-add") as HTMLButtonElement | null
              if (addRowBtn) addRowBtn.click()
            } else if (activeSection === "emi") {
              router.push("/home?section=emi")
            } else {
              router.push("/home?section=assistant")
            }
          }}
          title={
            activeSection === "assistant"
              ? "New Chat"
              : activeSection === "eligibility"
              ? "Add Loan Row"
              : "Quick Action"
          }
        >
          <i className="bi bi-plus" style={{ fontSize: "1.15rem", lineHeight: 1 }} />
          <span className="yt-create-label">
            {activeSection === "assistant" ? "New Chat" : activeSection === "eligibility" ? "Add Loan" : "Create"}
          </span>
        </button>

        {/* Dark / Light theme toggle */}
        <button
          type="button"
          className="theme-toggle-btn yt-theme-btn"
          onClick={toggleTheme}
          aria-label="Toggle dark/light theme"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <i className={theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill"} />
        </button>

        {/* YouTube-style Circular Profile Avatar on the FAR RIGHT */}
        <div
          className="yt-profile-avatar-wrapper"
          style={{ position: "relative" }}
        >
          <button
            type="button"
            className="yt-avatar-circle-btn"
            onClick={(e) => {
              e.stopPropagation()
              setProfileOpen((prev) => !prev)
            }}
            aria-label="User Account Menu"
            title={`${displayName} (${displayRole})`}
          >
            <div className="profile-avatar yt-profile-avatar">{userInitial}</div>
          </button>

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

    {/* Off-canvas mobile navigation drawer backdrop */}
    <div
      className={`cw-drawer-backdrop ${mobileDrawerOpen ? "open" : ""}`}
      onClick={() => setMobileDrawerOpen(false)}
      aria-hidden={!mobileDrawerOpen}
    />

    {/* Off-canvas mobile navigation drawer */}
    <aside
      className={`cw-mobile-drawer ${mobileDrawerOpen ? "open" : ""}`}
      aria-label="Mobile Navigation Menu"
      aria-hidden={!mobileDrawerOpen}
    >
      {/* Drawer Header */}
      <div className="cw-drawer-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="brand-mark">
            <i className="bi bi-shield-check" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="brand-text">CreditWise<span style={{ color: "var(--accent)" }}>AI</span></span>
              {isAdmin && (
                <span
                  style={{
                    fontSize: "0.5625rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "1px 5px",
                    borderRadius: "4px",
                    background: "rgba(139, 92, 246, 0.15)",
                    color: "#8b5cf6",
                  }}
                >
                  Admin
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.6875rem", color: "var(--ink-muted)" }}>
              Financial Intelligence
            </span>
          </div>
        </div>
        <button
          type="button"
          className="cw-drawer-close-btn cw-touch-target"
          onClick={() => setMobileDrawerOpen(false)}
          aria-label="Close menu"
        >
          <i className="bi bi-x-lg" />
        </button>
      </div>

      {/* Drawer Body Links */}
      <div style={{ flex: 1, padding: "0.5rem 0", overflowY: "auto" }}>
        <div className="cw-drawer-section-title">Workspace</div>
        {coreNavItems.map((item) => {
          const isSectionActive =
            !isAdminRouteActive &&
            (onSectionChange && item.section
              ? activeSection === item.section
              : effectivePath === "/home" || effectivePath === "/"
                ? (item.id === "assistant" && (!activeSection || activeSection === "assistant")) ||
                  activeSection === item.section
                : false)

          const handleMobileItemClick = (e: React.MouseEvent) => {
            e.preventDefault()
            setMobileDrawerOpen(false)
            if (item.onClick) {
              item.onClick(e)
            } else if (onSectionChange && item.section && (effectivePath === "/home" || effectivePath === "/")) {
              onSectionChange(item.section)
            } else {
              router.push(item.href)
            }
          }

          return (
            <a
              key={`mobile-${item.id}`}
              href={item.href}
              className={`cw-drawer-link ${isSectionActive ? "active" : ""}`}
              onClick={handleMobileItemClick}
            >
              <i className={item.iconClass} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: isSectionActive ? "var(--accent)" : "var(--surface-2)",
                    color: isSectionActive ? "#ffffff" : "var(--ink-muted)",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </a>
          )
        })}

        {isAdmin && (
          <>
            <div className="cw-drawer-section-title" style={{ marginTop: "0.75rem" }}>
              Admin Suite
            </div>
            {ADMIN_TOOL_LIST.map((tool) => {
              const isActive =
                tool.href === "/admin"
                  ? effectivePath === "/admin"
                  : effectivePath === tool.href || effectivePath.startsWith(tool.href)

              const handleMobileAdminClick = (e: React.MouseEvent) => {
                e.preventDefault()
                setMobileDrawerOpen(false)
                setActiveAdminToolId(tool.id)
                try {
                  localStorage.setItem("creditwise_active_admin_tool", tool.id)
                } catch {}
                router.push(tool.href)
              }

              return (
                <a
                  key={`mobile-admin-${tool.id}`}
                  href={tool.href}
                  className={`cw-drawer-link ${isActive ? "active" : ""}`}
                  onClick={handleMobileAdminClick}
                >
                  <i className={tool.iconClass} style={{ color: isActive ? "#8b5cf6" : undefined }} />
                  <span style={{ flex: 1 }}>{tool.label}</span>
                  {tool.badge && (
                    <span
                      style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        padding: "2px 6px",
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
          </>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="cw-drawer-footer">
        {/* Theme switch in drawer */}
        <button
          type="button"
          onClick={toggleTheme}
          className="cw-drawer-link"
          style={{
            width: "100%",
            borderRadius: "8px",
            padding: "0.6rem 0.85rem",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            marginBottom: "0.75rem",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <i className={theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill"} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </div>
          <span style={{ fontSize: "0.6875rem", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            {theme}
          </span>
        </button>

        {/* User profile card in drawer */}
        <div
          style={{
            padding: "10px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="profile-avatar" style={{ width: "34px", height: "34px", fontSize: "0.875rem" }}>
              {userInitial}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {displayName}
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {activeUser?.email || "user@creditwise.ai"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => {
              setMobileDrawerOpen(false)
              router.push("/profile")
            }}
            className="cw-touch-target"
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--ink)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <i className="bi bi-person-gear" style={{ marginRight: "6px" }} /> Settings
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="cw-touch-target"
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#dc2626",
              background: "rgba(220, 38, 38, 0.08)",
              border: "1px solid rgba(220, 38, 38, 0.2)",
              cursor: "pointer",
            }}
          >
            <i className="bi bi-box-arrow-right" style={{ marginRight: "6px" }} /> Logout
          </button>
        </div>
      </div>
    </aside>

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

        {/* Quick return to AI Assistant workspace */}
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
          title="Return to AI Assistant Workspace"
        >
          <i className="bi bi-arrow-left" />
          <span>AI Assistant</span>
        </a>
      </nav>
    )}
  </>
)
}