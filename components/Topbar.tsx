/**
 * Shared application topbar used by every authenticated page.
 *
 * Renders the brand, the navigation menu (Home, EMI Calculator, Admin,
 * Policies, Bank Manager) and the right-side controls: model selector,
 * theme toggle and the user profile menu.
 *
 * Nav order is fixed so it matches the AI Assistant home page exactly.
 * The active page is highlighted by passing the current pathname.
 */

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const AVAILABLE_MODELS = [
  { id: "liquid/lfm-2.5-embedding-350m:free", name: "LFM 2.5", desc: "Fast & efficient", icon: "⚡" },
  { id: "gpt-4o", name: "GPT-4o", desc: "Most capable", icon: "🧠" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5", desc: "Balanced", icon: "🎯" },
]

const NAV_ITEMS = [
  { href: "/home", label: "Home" },
  { href: "/emi", label: "EMI Calculator" },
  { href: "/admin", label: "Admin" },
  { href: "/policies", label: "Policies" },
  { href: "/bank-managers", label: "Bank Manager" },
]

export default function Topbar({
  user,
  pathname,
  selectedModel,
  onModelChange,
  theme,
  onThemeToggle,
}: {
  user: any
  pathname: string
  selectedModel: string
  onModelChange: (id: string) => void
  theme: "light" | "dark"
  onThemeToggle: () => void
}) {
  const router = useRouter()
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  function getSelectedModelName() {
    const model = AVAILABLE_MODELS.find((m) => m.id === selectedModel)
    return model ? model.name : "Model"
  }

  return (
    <header className="topbar app-topbar">
      <a className="brand" href="/home">
        <span className="brand-mark">◆</span>
        <span className="brand-text">AI ASSISTANT</span>
      </a>
      <nav className="nav-menu" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <a key={item.href} href={item.href} className={`nav-item ${isActive ? "active" : ""}`}>
              {item.label}
            </a>
          )
        })}
      </nav>
      <div className="model-selector-wrapper" ref={undefined}>
        <button
          className="model-selector"
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
      <button
        className="theme-toggle"
        onClick={onThemeToggle}
        title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        aria-label="Toggle theme"
      >
        {theme === "light" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        )}
      </button>
      <div className="profile-menu" role="link" tabIndex={0} onClick={() => router.push("/profile")}>
        <span className="profile-menu-label">{user?.name || user?.email}</span>
        <span className="caret">▾</span>
        <div className="profile-dropdown">
          <a href="/profile">Profile</a>
          <a href="/logout">Logout</a>
        </div>
      </div>
    </header>
  )
}