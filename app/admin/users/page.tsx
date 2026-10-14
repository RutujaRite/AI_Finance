/**
 * CreditWise AI — Admin Users Management Page (Admin Only)
 * Complete Create, Read, Update, and Delete (CRUD) operations for system accounts.
 * Connects directly to PostgreSQL /api/admin/users with role-based access control.
 */

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";

interface UserAccount {
  id: number;
  name?: string | null;
  email: string;
  role: string;
  status?: string | null;
  created_at?: string | null;
  last_login?: string | null;
}

export default function AllUsersAdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "USER">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states for Create
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
    status: "active",
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states for Edit
  const [editUser, setEditUser] = useState<UserAccount | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
    status: "active",
  });
  const [editError, setEditError] = useState<string | null>(null);

  // User targeted for Deletion
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
      } else {
        setErrorMsg(data.error || "Failed to load registered users");
      }
    } catch {
      setErrorMsg("Network error connecting to user service");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function checkAdminAuth() {
      try {
        const res = await fetch("/api/auth/verify", { credentials: "include" });
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
          loadUsers();
        } else {
          router.replace("/?auth=login&from=/admin/users");
        }
      } catch {
        router.replace("/?auth=login&from=/admin/users");
      }
    }

    checkAdminAuth();
  }, [router, loadUsers]);

  // Helpers
  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Never";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getUserInitials(name?: string | null, email?: string) {
    const text = (name || email || "U").trim();
    const parts = text.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return text.slice(0, 2).toUpperCase();
  }

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(u.name || "").toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q) ||
        String(u.role || "").toLowerCase().includes(q) ||
        String(u.id).includes(q);

      const roleStr = String(u.role || "").toLowerCase();
      const matchesRole =
        roleFilter === "ALL" ||
        (roleFilter === "ADMIN" && roleStr === "admin") ||
        (roleFilter === "USER" && roleStr !== "admin");

      const statusStr = String(u.status || "active").toLowerCase();
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && statusStr === "active") ||
        (statusFilter === "INACTIVE" && statusStr === "inactive");

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  // Real-time Overview Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => String(u.role || "").toLowerCase() === "admin").length;
    const standard = total - admins;
    const active = users.filter((u) => (u.status || "active") === "active").length;
    const inactive = total - active;
    return { total, admins, standard, active, inactive };
  }, [users]);

  // =========================================================================
  // CREATE USER ACTION
  // =========================================================================
  function openAddModal() {
    setCreateForm({
      name: "",
      email: "",
      password: "",
      role: "user",
      status: "active",
    });
    setCreateError(null);
    setShowAddModal(true);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (!createForm.email.trim()) {
      setCreateError("Email is required");
      return;
    }
    if (!createForm.password || createForm.password.length < 6) {
      setCreateError("Password must be at least 6 characters long");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddModal(false);
        setSuccessMsg(`User ${createForm.email} was created successfully!`);
        setTimeout(() => setSuccessMsg(null), 5000);
        await loadUsers();
      } else {
        setCreateError(data.error || "Failed to create user account");
      }
    } catch {
      setCreateError("Network error while creating account");
    } finally {
      setSubmitting(false);
    }
  }

  // =========================================================================
  // UPDATE USER ACTION
  // =========================================================================
  function openEditModal(target: UserAccount) {
    setEditUser(target);
    setEditForm({
      name: target.name || "",
      email: target.email,
      password: "", // blank unless resetting
      role: String(target.role || "").toLowerCase() === "admin" ? "admin" : "user",
      status: target.status === "inactive" ? "inactive" : "active",
    });
    setEditError(null);
    setShowEditModal(true);
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditError(null);

    if (!editForm.email.trim()) {
      setEditError("Email is required");
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      setEditError("New password must be at least 6 characters long");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        id: editUser.id,
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowEditModal(false);
        setSuccessMsg(`Account #${editUser.id} (${editForm.email}) updated successfully!`);
        setTimeout(() => setSuccessMsg(null), 5000);
        await loadUsers();
      } else {
        setEditError(data.error || "Failed to update account details");
      }
    } catch {
      setEditError("Network error updating user account");
    } finally {
      setSubmitting(false);
    }
  }

  // =========================================================================
  // DELETE USER ACTION
  // =========================================================================
  function openDeleteModal(target: UserAccount) {
    setUserToDelete(target);
    setDeleteError(null);
    setShowDeleteModal(true);
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;
    setDeleteError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/users?id=${userToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowDeleteModal(false);
        setSuccessMsg(`Account ${userToDelete.email} was deleted successfully.`);
        setTimeout(() => setSuccessMsg(null), 5000);
        await loadUsers();
      } else {
        setDeleteError(data.error || "Failed to delete user account");
      }
    } catch {
      setDeleteError("Network error during deletion request");
    } finally {
      setSubmitting(false);
    }
  }

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
      <AdminHeader
        user={currentUser}
        title="User Management"
        description="Complete CRUD operations, account provisioning, administrator roles, and access activity."
        breadcrumbs={[{ label: "User Management" }]}
      />

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
        {/* Alerts Banner */}
        {successMsg && (
          <div className="alert alert-success animate-fade-in" style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", padding: "12px 18px", borderRadius: "10px" }}>
            <i className="bi bi-check-circle-fill" style={{ fontSize: "1.1rem" }} />
            <span style={{ fontWeight: 500 }}>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="alert alert-danger animate-fade-in" style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", padding: "12px 18px", borderRadius: "10px" }}>
            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: "1.1rem" }} />
            <span style={{ fontWeight: 500 }}>{errorMsg}</span>
          </div>
        )}

        {/* Page Header Bar */}
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
                    Admin User Management
                  </h1>
                  <span className="badge badge-primary" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                    RBAC Directory
                  </span>
                </div>
              </div>
            </div>
            <p className="page-subtitle" style={{ margin: "4px 0 0 0", color: "var(--ink-soft, #64748b)", fontSize: "0.85rem" }}>
              Complete CRUD operations, account provisioning, administrator roles, and access activity
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => router.push("/admin")}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: 600 }}
            >
              <i className="bi bi-grid-fill" /> Dashboard
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
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openAddModal}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, padding: "6px 14px" }}
            >
              <i className="bi bi-person-plus-fill" /> Add User
            </button>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {/* Card 1: Total Users */}
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "10px", background: "rgba(37, 99, 235, 0.1)", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
              <i className="bi bi-people-fill" />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--ink-muted, #64748b)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Total Accounts
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink, #0f172a)", lineHeight: 1.2 }}>
                {stats.total.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Card 2: Admins */}
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
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

          {/* Card 3: Standard DSA Agents */}
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
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
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
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

              {/* Status filter buttons */}
              <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: "8px", padding: "2px" }}>
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "none",
                    background: statusFilter === "ALL" ? "#ffffff" : "transparent",
                    color: statusFilter === "ALL" ? "var(--ink, #0f172a)" : "#64748b",
                    cursor: "pointer",
                    boxShadow: statusFilter === "ALL" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  Status: All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("ACTIVE")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "none",
                    background: statusFilter === "ACTIVE" ? "#ffffff" : "transparent",
                    color: statusFilter === "ACTIVE" ? "#16a34a" : "#64748b",
                    cursor: "pointer",
                    boxShadow: statusFilter === "ACTIVE" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  Active ({stats.active})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("INACTIVE")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "none",
                    background: statusFilter === "INACTIVE" ? "#ffffff" : "transparent",
                    color: statusFilter === "INACTIVE" ? "#dc2626" : "#64748b",
                    cursor: "pointer",
                    boxShadow: statusFilter === "INACTIVE" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  Inactive ({stats.inactive})
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
                placeholder="Search by name, email or ID..."
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
                  <th style={{ width: "150px", padding: "12px 14px" }}>Joined Date</th>
                  <th style={{ width: "150px", padding: "12px 14px" }}>Last Login</th>
                  <th style={{ width: "130px", textAlign: "center", padding: "12px 14px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "48px 20px", textAlign: "center" }}>
                      <div className="spinner-border text-primary" style={{ width: 28, height: 28 }} role="status" />
                      <p style={{ marginTop: 8, color: "var(--ink-muted)", fontSize: "0.82rem" }}>Loading user directory...</p>
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "48px 20px", textAlign: "center" }}>
                      <div style={{ color: "var(--ink-muted, #94a3b8)" }}>
                        <i className="bi bi-person-x" style={{ fontSize: "2.4rem", opacity: 0.5, display: "block", marginBottom: "8px" }} />
                        <p style={{ margin: "0 0 4px 0", fontWeight: 600, color: "var(--ink, #0f172a)" }}>No accounts match query</p>
                        <small>Try clearing or adjusting search filter keywords</small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const isAdmin = String(u.role || "").toLowerCase() === "admin";
                    const isActive = (u.status || "active") === "active";
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
                              background: isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                              color: isActive ? "#059669" : "#dc2626",
                            }}
                          >
                            {isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.8rem", padding: "12px 14px" }}>
                          {formatDate(u.created_at)}
                        </td>
                        <td style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.8rem", padding: "12px 14px" }}>
                          {formatDate(u.last_login)}
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 14px" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => openEditModal(u)}
                              title="Edit User"
                              style={{ padding: "4px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                            >
                              <i className="bi bi-pencil" /> Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => openDeleteModal(u)}
                              title="Delete User"
                              style={{ padding: "4px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredUsers.length > pageSize && (
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#ffffff",
                fontSize: "0.82rem",
                color: "var(--ink-muted, #64748b)",
              }}
            >
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} accounts
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                >
                  <i className="bi bi-chevron-left" /> Previous
                </button>

                <span style={{ fontWeight: 600, padding: "0 8px", color: "var(--ink, #0f172a)" }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                >
                  Next <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* =================================================================== */}
      {/* ADD USER MODAL */}
      {/* =================================================================== */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "#ffffff",
              borderRadius: "14px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <i className="bi bi-person-plus-fill" style={{ color: "var(--accent, #2563eb)", fontSize: "1.2rem" }} />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                  Create New User Account
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", color: "#64748b", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ padding: "20px" }}>
              {createError && (
                <div className="alert alert-danger" style={{ marginBottom: "16px", fontSize: "0.82rem", padding: "10px 14px" }}>
                  <i className="bi bi-exclamation-triangle" style={{ marginRight: "6px" }} />
                  {createError}
                </div>
              )}

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink, #0f172a)", marginBottom: "4px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rahul Sharma"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  style={{ fontSize: "0.85rem", borderRadius: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink, #0f172a)", marginBottom: "4px" }}>
                  Email Address <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="e.g. rahul@example.com"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  style={{ fontSize: "0.85rem", borderRadius: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink, #0f172a)", marginBottom: "4px" }}>
                  Password <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  style={{ fontSize: "0.85rem", borderRadius: "8px" }}
                />
                <small style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.75rem" }}>
                  Passwords are encrypted using bcrypt salt hashing before storage.
                </small>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink, #0f172a)", marginBottom: "4px" }}>
                    Role
                  </label>
                  <select
                    className="form-select"
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    style={{ fontSize: "0.85rem", borderRadius: "8px" }}
                  >
                    <option value="user">DSA Agent (Standard)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink, #0f172a)", marginBottom: "4px" }}>
                    Status
                  </label>
                  <select
                    className="form-select"
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                    style={{ fontSize: "0.85rem", borderRadius: "8px" }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  style={{ minWidth: "100px", fontWeight: 600 }}
                >
                  {submitting ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* EDIT USER MODAL */}
      {/* =================================================================== */}
      {showEditModal && editUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "#ffffff",
              borderRadius: "14px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <i className="bi bi-pencil-square" style={{ color: "var(--accent, #2563eb)", fontSize: "1.2rem" }} />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                  Edit User #{editUser.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", color: "#64748b", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateUser} style={{ padding: "20px" }}>
              {editError && (
                <div className="alert alert-danger" style={{ marginBottom: "16px", fontSize: "0.82rem", padding: "10px 14px" }}>
                  <i className="bi bi-exclamation-triangle" style={{ marginRight: "6px" }} />
                  {editError}
                </div>
              )}

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink, #0f172a)", marginBottom: "4px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Account name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ fontSize: "0.85rem", borderRadius: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink, #0f172a)", marginBottom: "4px" }}>
                  Email Address <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  style={{ fontSize: "0.85rem", borderRadius: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink, #0f172a)", marginBottom: "4px" }}>
                  Reset Password <span style={{ fontWeight: 400, color: "var(--ink-muted)" }}>(Optional)</span>
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Leave empty to keep existing password"
                  minLength={6}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  style={{ fontSize: "0.85rem", borderRadius: "8px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink, #0f172a)", marginBottom: "4px" }}>
                    Role
                  </label>
                  <select
                    className="form-select"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    style={{ fontSize: "0.85rem", borderRadius: "8px" }}
                  >
                    <option value="user">DSA Agent</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink, #0f172a)", marginBottom: "4px" }}>
                    Status
                  </label>
                  <select
                    className="form-select"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    style={{ fontSize: "0.85rem", borderRadius: "8px" }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowEditModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  style={{ minWidth: "100px", fontWeight: 600 }}
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* =================================================================== */}
      {showDeleteModal && userToDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "#ffffff",
              borderRadius: "14px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "#fef2f2",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <i className="bi bi-trash-fill" />
              </div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#991b1b" }}>
                Confirm Account Deletion
              </h3>
            </div>

            <div style={{ padding: "20px" }}>
              {deleteError && (
                <div className="alert alert-danger" style={{ marginBottom: "16px", fontSize: "0.82rem", padding: "10px 14px" }}>
                  <i className="bi bi-exclamation-triangle" style={{ marginRight: "6px" }} />
                  {deleteError}
                </div>
              )}

              <p style={{ margin: "0 0 14px 0", fontSize: "0.88rem", color: "var(--ink, #0f172a)" }}>
                Are you sure you want to permanently delete this user account?
              </p>

              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  marginBottom: "16px",
                  fontSize: "0.82rem",
                }}
              >
                <div><strong>User ID:</strong> #{userToDelete.id}</div>
                <div><strong>Name:</strong> {userToDelete.name || "N/A"}</div>
                <div><strong>Email:</strong> {userToDelete.email}</div>
                <div><strong>Role:</strong> {userToDelete.role.toUpperCase()}</div>
              </div>

              <p style={{ margin: "0 0 20px 0", fontSize: "0.78rem", color: "#dc2626" }}>
                <i className="bi bi-info-circle-fill" style={{ marginRight: "4px" }} />
                This action is permanent and cannot be undone. Associated foreign key references will be safely nullified.
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteUser}
                  disabled={submitting}
                  style={{ fontWeight: 600, minWidth: "130px" }}
                >
                  {submitting ? "Deleting..." : "Confirm Deletion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
