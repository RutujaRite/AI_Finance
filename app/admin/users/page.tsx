/**
 * All Users Admin Page
 * Dedicated admin view for registered user accounts, roles, and access activity.
 * Accessed via Admin Profile dropdown ("All Users Admin").
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Topbar from "../../../components/Topbar";

interface UserAccount {
  id: number | string;
  name?: string;
  email: string;
  role: string;
  status?: string;
  created_at?: string;
  last_login?: string;
}

export default function AllUsersAdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "USER">("ALL");

  useEffect(() => {
    checkAdminAuth();
    loadUsers();
  }, []);

  async function checkAdminAuth() {
    try {
      const res = await fetch("/api/auth/verify");
      if (!res.ok) {
        router.replace("/?auth=login&from=/admin/users");
        return;
      }
      const data = await res.json();
      if (data.success) {
        const isAdminUser =
          String(data.user?.role || "").trim().toLowerCase() === "admin" ||
          data.user?.is_admin === true ||
          String(data.user?.email || "").toLowerCase() === "admin@gmail.com" ||
          String(data.user?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
          String(data.user?.email || "").toLowerCase().startsWith("admin");

        if (!isAdminUser) {
          router.replace("/home?section=assistant");
          return;
        }
        setCurrentUser(data.user);
      }
    } catch {
      router.replace("/?auth=login&from=/admin/users");
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error("Failed to load users", e);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getUserInitials(name?: string, email?: string) {
    const text = (name || email || "U").trim();
    const parts = text.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return text.slice(0, 2).toUpperCase();
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(u.name || "").toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q) ||
        String(u.role || "").toLowerCase().includes(q);

      const roleStr = String(u.role || "").toLowerCase();
      const matchesRole =
        roleFilter === "ALL" ||
        (roleFilter === "ADMIN" && roleStr === "admin") ||
        (roleFilter === "USER" && roleStr !== "admin");

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => String(u.role || "").toLowerCase() === "admin").length;
    const standard = total - admins;
    const active = users.filter((u) => u.status === "active" || !u.status).length;
    return { total, admins, standard, active };
  }, [users]);

  if (!currentUser) {
    return (
      <main style={{ padding: 48, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", gap: 12 }}>
        <div className="spinner-border text-primary" style={{ width: 36, height: 36 }} role="status"></div>
        <p style={{ color: "var(--bs-secondary-color)", fontWeight: 500 }}>Verifying administrator access...</p>
      </main>
    );
  }

  return (
    <div className="home-body admin-fullpage-layout" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #f8fafc)", width: "100%" }}>
      <Topbar user={currentUser} pathname="/admin/users" />

      <main
        className="admin-workspace-fullwidth animate-fade-in"
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "1360px",
          margin: "0 auto",
          padding: "28px 24px 64px 24px",
          boxSizing: "border-box",
        }}
      >
        {/* Header Bar */}
        <div className="page-header" style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(59, 130, 246, 0.18) 100%)",
                  border: "1px solid rgba(37, 99, 235, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent, #2563eb)",
                  fontSize: "1.25rem",
                }}
              >
                <i className="bi bi-people" />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h1 className="page-title" style={{ margin: 0, fontSize: "1.45rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                    All Users Admin
                  </h1>
                  <span className="badge badge-primary" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                    Directory
                  </span>
                </div>
              </div>
            </div>
            <p className="page-subtitle" style={{ margin: "4px 0 0 0", color: "var(--ink-soft, #64748b)", fontSize: "0.85rem" }}>
              Complete listing of registered system accounts, administrator privileges, and login histories
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => router.push("/admin")}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <i className="bi bi-building-gear" /> Company Data
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadUsers}
              disabled={loading}
              title="Refresh directory"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <i className={`bi bi-arrow-clockwise ${loading ? "spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {/* Card 1: Total Users */}
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "12px" }}>
            <div style={{ width: 44, height: 44, borderRadius: "10px", background: "rgba(37, 99, 235, 0.1)", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
              <i className="bi bi-people-fill" />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--ink-muted, #64748b)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Total Accounts
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink, #0f172a)", lineHeight: 1.2 }}>
                {stats.total}
              </div>
            </div>
          </div>

          {/* Card 2: Admins */}
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "12px" }}>
            <div style={{ width: 44, height: 44, borderRadius: "10px", background: "rgba(139, 92, 246, 0.12)", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
              <i className="bi bi-shield-lock-fill" />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--ink-muted, #64748b)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Administrators
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#7c3aed", lineHeight: 1.2 }}>
                {stats.admins}
              </div>
            </div>
          </div>

          {/* Card 3: Standard Users */}
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "12px" }}>
            <div style={{ width: 44, height: 44, borderRadius: "10px", background: "rgba(16, 185, 129, 0.1)", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
              <i className="bi bi-person-check-fill" />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--ink-muted, #64748b)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Standard DSA Agents
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669", lineHeight: 1.2 }}>
                {stats.standard}
              </div>
            </div>
          </div>

          {/* Card 4: Active Accounts */}
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "12px" }}>
            <div style={{ width: 44, height: 44, borderRadius: "10px", background: "rgba(245, 158, 11, 0.1)", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
              <i className="bi bi-activity" />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--ink-muted, #64748b)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Active Accounts
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#d97706", lineHeight: 1.2 }}>
                {stats.active}
              </div>
            </div>
          </div>
        </div>

        {/* Users Table Card */}
        <div className="card" style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)" }}>
          {/* Controls Bar */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              background: "#ffffff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                Registered Accounts ({filteredUsers.length})
              </span>

              {/* Role filter buttons */}
              <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: "8px", padding: "2px" }}>
                <button
                  type="button"
                  onClick={() => setRoleFilter("ALL")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "none",
                    background: roleFilter === "ALL" ? "#ffffff" : "transparent",
                    color: roleFilter === "ALL" ? "var(--accent, #2563eb)" : "#64748b",
                    cursor: "pointer",
                    boxShadow: roleFilter === "ALL" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  All ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter("ADMIN")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "none",
                    background: roleFilter === "ADMIN" ? "#ffffff" : "transparent",
                    color: roleFilter === "ADMIN" ? "#7c3aed" : "#64748b",
                    cursor: "pointer",
                    boxShadow: roleFilter === "ADMIN" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  Admins ({stats.admins})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter("USER")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "none",
                    background: roleFilter === "USER" ? "#ffffff" : "transparent",
                    color: roleFilter === "USER" ? "#059669" : "#64748b",
                    cursor: "pointer",
                    boxShadow: roleFilter === "USER" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  DSA Agents ({stats.standard})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div style={{ position: "relative", minWidth: "260px" }}>
              <i
                className="bi bi-search"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ink-muted, #94a3b8)",
                  fontSize: "0.85rem",
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Search by name, email or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "34px", fontSize: "0.82rem", borderRadius: "8px" }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive" style={{ overflowX: "auto" }}>
            <table className="table table-hover" style={{ width: "100%", margin: 0, fontSize: "0.8125rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
                  <th style={{ width: "65px", textAlign: "center", padding: "12px 14px" }}>User ID</th>
                  <th style={{ padding: "12px 14px" }}>Account Name</th>
                  <th style={{ padding: "12px 14px" }}>Email Address</th>
                  <th style={{ width: "120px", textAlign: "center", padding: "12px 14px" }}>Role</th>
                  <th style={{ width: "110px", textAlign: "center", padding: "12px 14px" }}>Status</th>
                  <th style={{ width: "160px", padding: "12px 14px" }}>Joined Date</th>
                  <th style={{ width: "160px", padding: "12px 14px" }}>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px 20px", textAlign: "center" }}>
                      <div className="spinner-border text-primary" style={{ width: 28, height: 28 }} role="status" />
                      <p style={{ marginTop: 8, color: "var(--ink-muted)", fontSize: "0.82rem" }}>Loading user directory...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px 20px", textAlign: "center" }}>
                      <div style={{ color: "var(--ink-muted, #94a3b8)" }}>
                        <i className="bi bi-person-x" style={{ fontSize: "2.4rem", opacity: 0.5, display: "block", marginBottom: "8px" }} />
                        <p style={{ margin: "0 0 4px 0", fontWeight: 600, color: "var(--ink, #0f172a)" }}>No accounts match query</p>
                        <small>Try clearing or adjusting search filter keywords</small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isAdmin = String(u.role || "").toLowerCase() === "admin";
                    const isActive = u.status === "active" || !u.status;
                    const initials = getUserInitials(u.name, u.email);

                    return (
                      <tr key={u.id} style={{ borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                        <td style={{ textAlign: "center", fontWeight: 600, color: "var(--ink-muted)", padding: "12px 14px" }}>
                          #{u.id}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                background: isAdmin ? "rgba(139, 92, 246, 0.15)" : "rgba(37, 99, 235, 0.12)",
                                color: isAdmin ? "#7c3aed" : "#2563eb",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "0.75rem",
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <span style={{ fontWeight: 600, color: "var(--ink, #0f172a)", display: "block" }}>
                                {u.name || "System User"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: "var(--ink-soft, #475569)", fontFamily: "monospace", padding: "12px 14px" }}>
                          {u.email}
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 14px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              background: isAdmin ? "rgba(139, 92, 246, 0.12)" : "rgba(37, 99, 235, 0.08)",
                              color: isAdmin ? "#7c3aed" : "#2563eb",
                              border: isAdmin ? "1px solid rgba(139, 92, 246, 0.25)" : "1px solid rgba(37, 99, 235, 0.2)",
                            }}
                          >
                            {isAdmin ? "👑 ADMIN" : "DSA AGENT"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 14px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              background: isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(148, 163, 184, 0.15)",
                              color: isActive ? "#059669" : "#64748b",
                            }}
                          >
                            {isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.8rem", padding: "12px 14px" }}>
                          {formatDate(u.created_at)}
                        </td>
                        <td style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.8rem", padding: "12px 14px" }}>
                          {u.last_login ? formatDate(u.last_login) : <span style={{ opacity: 0.6 }}>Never</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
