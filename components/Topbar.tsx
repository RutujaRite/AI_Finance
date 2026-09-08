/**
 * Shared application topbar used by every authenticated page.
 *
 * Renders the brand, navigation menu (Home, AI Assistant, EMI Calculator,
 * Bank Policy, Bank Manager, and Admin if admin), model selector,
 * and user profile menu.
 */

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const AVAILABLE_MODELS = [
  { id: "liquid/lfm-2.5-embedding-350m:free", name: "LFM 2.5", desc: "Fast & efficient", icon: "⚡" },
  { id: "gpt-4o", name: "GPT-4o", desc: "Most capable", icon: "🧠" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5", desc: "Balanced", icon: "🎯" },
]

export type DashboardSection = "home" | "assistant" | "emi" | "policies"

export default function Topbar({
  user,
  pathname = "",
  selectedModel,
  onModelChange,
  activeSection,
  onSectionChange,
  onToggleSidebar,
}: {
  user: any
  pathname?: string
  selectedModel?: string
  onModelChange?: (id: string) => void
  activeSection?: DashboardSection
  onSectionChange?: (section: DashboardSection) => void
  onToggleSidebar?: () => void
}) {
  const router = useRouter()
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  function getSelectedModelName() {
    const model = AVAILABLE_MODELS.find((m) => m.id === selectedModel)
    return model ? model.name : "Model"
  }

  const navItems: Array<{
    id: string
    label: string
    section?: DashboardSection
    href: string
    icon: React.ReactNode
    adminOnly?: boolean
  }> = [
    {
      id: "home",
      label: "Home",
      section: "home",
      href: "/home",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: "assistant",
      label: "AI Assistant",
      section: "assistant",
      href: "/home?section=assistant",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: "emi",
      label: "EMI Calculator",
      section: "emi",
      href: "/home?section=emi",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="16" height="16" x="4" y="4" rx="2" />
          <path d="M12 12h.01" />
        </svg>
      ),
    },
    {
      id: "policies",
      label: "Bank Policy",
      section: "policies",
      href: "/home?section=policies",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    },
    {
      id: "bank-managers",
      label: "Bank Manager",
      href: "/bank-managers",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a2 2 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: "admin",
      label: "Admin",
      href: "/admin",
      adminOnly: true,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
  ]

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && user?.role !== "admin") return false
    return true
  })

  return (
    <header className="topbar app-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {onToggleSidebar && activeSection === "assistant" && (
          <button
            className="chat-sidebar-toggle"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
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
          <span className="brand-mark">◆</span>
          <span className="brand-text">AI ASSISTANT</span>
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
                {item.icon}
                {item.label}
              </button>
            )
          }

          return (
            <a
              key={item.id}
              href={item.href}
              className={`nav-item ${isSectionActive ? "active" : ""}`}
            >
              {item.icon}
              {item.label}
            </a>
          )
        })}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {selectedModel && onModelChange && (
          <div className="model-selector-wrapper">
            <button
              className="model-selector"
              type="button"
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            >
              <span className="model-selector-icon">◆</span>
              {getSelectedModelName()}
              <span className="model-selector-caret">▾</span>
            </button>
            <div className={`model-dropdown ${modelDropdownOpen ? "open" : ""}`}>
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className={`model-dropdown-item ${selectedModel === model.id ? "active" : ""}`}
                  onClick={() => {
                    onModelChange(model.id)
                    setModelDropdownOpen(false)
                  }}
                >
                  <span className="model-dropdown-item-icon">{model.icon}</span>
                  <div className="model-dropdown-item-info">
                    <div className="model-dropdown-item-name">{model.name}</div>
                    <div className="model-dropdown-item-desc">{model.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="profile-menu" role="link" tabIndex={0} onClick={() => router.push("/profile")}>
          <span className="profile-menu-label">{user?.name || user?.email || "Account"}</span>
          <span className="caret">▾</span>
          <div className="profile-dropdown">
            <a href="/profile">Profile</a>
            <a href="/logout">Logout</a>
          </div>
        </div>
      </div>
    </header>
  )
}