/**
 * Admin Navigation Management Page (Admin Only)
 * Centralized route directory, role access control verification, and application navigation map.
 * CallNow CRM Design System compliant
 */

"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Topbar from "@/components/Topbar"

interface NavRouteItem {
  id: string
  path: string
  label: string
  category: "Admin Suite" | "Financial Calculators" | "AI Intelligence" | "Banking Policies" | "User Portals"
  roles: string[]
  icon: string
  status: "Active" | "Protected" | "Public"
  description: string
  badge?: string
}

const SYSTEM_ROUTES: NavRouteItem[] = [
  {
    id: "agent-studio",
    path: "/agent-studio",
    label: "AI Agent Studio",
    category: "Admin Suite",
    roles: ["Admin"],
    icon: "bi bi-robot",
    status: "Protected",
    description: "Multi-agent persona builder, business instructions, live demo & RAG knowledge manager",
    badge: "Studio",
  },
  {
    id: "admin-models",
    path: "/admin/models",
    label: "AI Models Routing",
    category: "Admin Suite",
    roles: ["Admin"],
    icon: "bi bi-cpu",
    status: "Protected",
    description: "Speech-to-Text, LLM Reasoning, and Voice Synthesis dynamic provider engine configurations",
  },
  {
    id: "admin-company-data",
    path: "/admin",
    label: "Company Data",
    category: "Admin Suite",
    roles: ["Admin"],
    icon: "bi bi-building-gear",
    status: "Protected",
    description: "Employer categorization master file, upload bank documents & registered user management",
  },
  {
    id: "admin-navigation",
    path: "/admin/navigation",
    label: "Admin Navigation",
    category: "Admin Suite",
    roles: ["Admin"],
    icon: "bi bi-compass",
    status: "Protected",
    description: "Centralized route management, access permissions directory & application navigation topology",
  },
  {
    id: "copilot",
    path: "/home?section=assistant",
    label: "AI Copilot Workspace",
    category: "AI Intelligence",
    roles: ["Admin", "DSA Agent"],
    icon: "bi bi-chat-dots",
    status: "Active",
    description: "Interactive conversational underwriting assistant with multi-bank policy evaluation",
    badge: "AI",
  },
  {
    id: "emi-calculator",
    path: "/home?section=emi",
    label: "EMI Calculator",
    category: "Financial Calculators",
    roles: ["Admin", "DSA Agent", "Public"],
    icon: "bi bi-calculator",
    status: "Active",
    description: "Loan parameters, monthly EMI hero banner, payment distribution ratio & amortization schedule",
  },
  {
    id: "eligibility-calculator",
    path: "/home?section=eligibility",
    label: "Eligibility Calculator",
    category: "Financial Calculators",
    roles: ["Admin", "DSA Agent", "Public"],
    icon: "bi bi-shield-check",
    status: "Active",
    description: "Banking FOIR present value underwriting model, existing loan portfolio & amortization breakdown",
    badge: "New",
  },
  {
    id: "bank-policies",
    path: "/home?section=policies",
    label: "Bank Policy",
    category: "Banking Policies",
    roles: ["Admin", "DSA Agent"],
    icon: "bi bi-file-earmark-text",
    status: "Active",
    description: "Comprehensive partner bank lending guidelines, salary cutoffs, and policy document queries",
  },
  {
    id: "bank-managers",
    path: "/bank-managers",
    label: "Location & Contact Bank Manager",
    category: "Banking Policies",
    roles: ["Admin", "DSA Agent"],
    icon: "bi bi-people",
    status: "Active",
    description: "Branch locations & official manager contacts, escalation points & partner bank relationship managers",
  },
  {
    id: "emi-pdf-engine",
    path: "/emi-pdf",
    label: "EMI PDF Generator",
    category: "Financial Calculators",
    roles: ["Admin", "DSA Agent", "Public"],
    icon: "bi bi-file-earmark-pdf",
    status: "Active",
    description: "Standalone high-resolution client EMI proposal export and amortization schedule previewer",
  },
  {
    id: "profile",
    path: "/profile",
    label: "Profile & Account Settings",
    category: "User Portals",
    roles: ["Admin", "DSA Agent"],
    icon: "bi bi-person-gear",
    status: "Active",
    description: "Manage personal account profile, password, preferences and active workspace settings",
  },
  {
    id: "landing",
    path: "/",
    label: "Public Landing Platform",
    category: "User Portals",
    roles: ["Public"],
    icon: "bi bi-house",
    status: "Public",
    description: "CreditWise AI public marketing landing, feature showcases, customer testimonials & calculator preview",
  },
]

export default function AdminNavigationPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL")

  useEffect(() => {
    checkAdminAuth()
  }, [])

  async function checkAdminAuth() {
    try {
      const res = await fetch("/api/auth/verify")
      if (!res.ok) {
        router.replace("/?auth=login&from=/admin/navigation")
        return
      }
      const data = await res.json()
      if (data.success) {
        const isAdminUser =
          String(data.user?.role || "").trim().toLowerCase() === "admin" ||
          data.user?.is_admin === true ||
          String(data.user?.email || "").toLowerCase() === "admin@gmail.com" ||
          String(data.user?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
          String(data.user?.email || "").toLowerCase().startsWith("admin")

        if (!isAdminUser) {
          router.replace("/home?section=assistant")
          return
        }
        setUser(data.user)
      } else {
        router.replace("/?auth=login&from=/admin/navigation")
      }
    } catch (e) {
      router.replace("/?auth=login&from=/admin/navigation")
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>()
    SYSTEM_ROUTES.forEach((r) => set.add(r.category))
    return ["ALL", ...Array.from(set)]
  }, [])

  const filteredRoutes = useMemo(() => {
    return SYSTEM_ROUTES.filter((r) => {
      const matchesSearch =
        r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCat = categoryFilter === "ALL" || r.category === categoryFilter
      return matchesSearch && matchesCat
    })
  }, [searchQuery, categoryFilter])

  const stats = useMemo(() => {
    const total = SYSTEM_ROUTES.length
    const adminOnly = SYSTEM_ROUTES.filter((r) => r.category === "Admin Suite").length
    const calculators = SYSTEM_ROUTES.filter((r) => r.category === "Financial Calculators").length
    const publicAccessible = SYSTEM_ROUTES.filter((r) => r.roles.includes("Public")).length
    return { total, adminOnly, calculators, publicAccessible }
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg, #f8fafc)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner-border text-primary" role="status" style={{ width: 36, height: 36 }} />
          <div style={{ marginTop: 12, fontSize: "0.875rem", color: "var(--ink-muted)" }}>
            Authenticating Administrator Privileges...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: "var(--bg, #f8fafc)", minHeight: "100vh" }}>
      <Topbar user={user} pathname="/admin/navigation" />

      <main style={{ maxWidth: 1380, margin: "0 auto", padding: "1.5rem" }}>
        {/* Header Suite Banner */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "1.25rem 1.75rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(2, 132, 199, 0.18) 100%)",
                border: "1px solid rgba(14, 165, 233, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0284c7",
                fontSize: "1.4rem",
              }}
            >
              <i className="bi bi-compass" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                  Admin Navigation Suite
                </h1>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(14, 165, 233, 0.1)",
                    color: "#0284c7",
                    border: "1px solid rgba(14, 165, 233, 0.25)",
                  }}
                >
                  Topology &amp; RBAC Directory
                </span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)", margin: "4px 0 0" }}>
                Comprehensive route catalog, role-based access permissions, and application navigation architecture.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => router.push("/admin")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <i className="bi bi-building-gear" />
              <span>Company Data</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => router.push("/agent-studio")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <i className="bi bi-robot" />
              <span>Agent Studio</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.15rem" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", color: "var(--ink-muted)" }}>
              Registered Routes
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--ink)", marginTop: 4 }}>
              {stats.total}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: 2 }}>
              Active Next.js endpoints &amp; sections
            </div>
          </div>

          <div className="card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.15rem" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", color: "var(--ink-muted)" }}>
              Admin-Only Modules
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>
              {stats.adminOnly}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: 2 }}>
              Restricted to authorized admins
            </div>
          </div>

          <div className="card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.15rem" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", color: "var(--ink-muted)" }}>
              Financial Calculators
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#10b981", marginTop: 4 }}>
              {stats.calculators}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: 2 }}>
              EMI, Eligibility &amp; PDF engines
            </div>
          </div>

          <div className="card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.15rem" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", color: "var(--ink-muted)" }}>
              Public &amp; DSA Access
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f59e0b", marginTop: 4 }}>
              {stats.publicAccessible}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: 2 }}>
              Available without full admin privileges
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div
          className="card"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          {/* Category Chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: categoryFilter === cat ? "var(--accent)" : "var(--border)",
                  background: categoryFilter === cat ? "var(--surface-2)" : "transparent",
                  color: categoryFilter === cat ? "var(--accent)" : "var(--ink-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {cat === "ALL" ? "All Categories" : cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div style={{ position: "relative", minWidth: 260 }}>
            <i
              className="bi bi-search"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)", fontSize: "0.8125rem" }}
            />
            <input
              type="text"
              placeholder="Search routes, labels, descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control"
              style={{ paddingLeft: 34, fontSize: "0.8125rem", borderRadius: 8 }}
            />
          </div>
        </div>

        {/* Route Directory Table */}
        <div className="card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
              <i className="bi bi-diagram-3" style={{ color: "var(--accent)" }} />
              Route &amp; Permission Access Directory ({filteredRoutes.length})
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
              Click any route to launch
            </span>
          </div>

          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table className="table table-hover" style={{ width: "100%", fontSize: "0.8125rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", borderBottom: "2px solid var(--border)" }}>
                  <th style={{ padding: "10px 14px", width: "220px" }}>Navigation Module</th>
                  <th style={{ padding: "10px 14px", width: "190px" }}>Route Path</th>
                  <th style={{ padding: "10px 14px", width: "150px" }}>Category</th>
                  <th style={{ padding: "10px 14px", width: "160px" }}>Allowed Roles</th>
                  <th style={{ padding: "10px 14px" }}>Description</th>
                  <th style={{ padding: "10px 14px", width: "100px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-muted)" }}>
                      No routes match the selected search query or category filter.
                    </td>
                  </tr>
                ) : (
                  filteredRoutes.map((route) => (
                    <tr key={route.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: "var(--surface-2)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.95rem",
                              color: "var(--accent)",
                              flexShrink: 0,
                            }}
                          >
                            <i className={route.icon} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--ink)" }}>{route.label}</div>
                            {route.badge && (
                              <span
                                style={{
                                  fontSize: "0.625rem",
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(37, 99, 235, 0.12)",
                                  color: "var(--accent)",
                                }}
                              >
                                {route.badge}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <code
                          style={{
                            fontSize: "0.75rem",
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "var(--surface-2)",
                            color: "var(--ink)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {route.path}
                        </code>
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background:
                              route.category === "Admin Suite"
                                ? "rgba(139, 92, 246, 0.12)"
                                : route.category === "Financial Calculators"
                                ? "rgba(16, 185, 129, 0.12)"
                                : "rgba(37, 99, 235, 0.1)",
                            color:
                              route.category === "Admin Suite"
                                ? "#7c3aed"
                                : route.category === "Financial Calculators"
                                ? "#059669"
                                : "var(--accent)",
                          }}
                        >
                          {route.category}
                        </span>
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {route.roles.map((role) => (
                            <span
                              key={role}
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: role === "Admin" ? "rgba(239, 68, 68, 0.1)" : "var(--surface-2)",
                                color: role === "Admin" ? "#dc2626" : "var(--ink)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td style={{ padding: "10px 14px", color: "var(--ink-muted)", fontSize: "0.75rem" }}>
                        {route.description}
                      </td>

                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => router.push(route.path)}
                          style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                        >
                          Open <i className="bi bi-arrow-up-right" style={{ fontSize: "0.65rem", marginLeft: 2 }} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
