/**
 * CreditWise AI — Admin Users Management Page (Admin Only)
 * Complete Create, Read, Update, and Delete (CRUD) operations for system accounts.
 * Connects directly to PostgreSQL /api/admin/users with role-based access control.
 */

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import ModernSearchBar from "@/components/ui/ModernSearchBar";
import ModernStatusBadge from "@/components/ui/ModernStatusBadge";
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  Pencil,
  Trash2,
  Plus,
  RotateCw,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
} from "lucide-react";

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

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Check Admin Authentication
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
        } else {
          router.replace("/?auth=login&from=/admin/users");
        }
      } catch {
        router.replace("/?auth=login&from=/admin/users");
      }
    }
    checkAdminAuth();
  }, [router]);

  // Load All Users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setErrorMsg(data.error || "Failed to retrieve user directory");
      }
    } catch {
      setErrorMsg("Network error connecting to user service");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadUsers();
    }
  }, [currentUser, loadUsers]);

  // Filtered users calculation
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

  // Create User
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

  // Update User
  function openEditModal(target: UserAccount) {
    setEditUser(target);
    setEditForm({
      name: target.name || "",
      email: target.email,
      password: "",
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

  // Delete User
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

  function getUserInitials(name?: string | null, email?: string): string {
    if (name && name.trim()) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.trim().slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "US";
  }

  function formatDate(d?: string | null): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  }

  if (!currentUser) {
    return (
      <main style={{ padding: 48, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", gap: 12, background: "#f8fafc" }}>
        <div className="spinner-border text-primary" style={{ width: 36, height: 36 }} role="status"></div>
        <p style={{ color: "#64748b", fontWeight: 500, fontSize: "0.875rem" }}>Verifying administrator access...</p>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc", width: "100%", fontFamily: "'Inter', sans-serif" }}>
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <AdminHeader
        user={currentUser}
        title="User Management"
        description="Manage administrator and agent user credentials, roles, and account access."
        breadcrumbs={[{ label: "User Management" }]}
      />

      <main className="cw-admin-container" style={{ flex: 1 }}>
        {/* Alerts Banner */}
        {successMsg && (
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "10px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
            }}
          >
            <CheckCircle2 style={{ width: 18, height: 18, flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "10px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
            }}
          >
            <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Overview Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div className="cw-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#eff6ff", border: "1px solid #dbeafe", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Total Accounts
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                {stats.total}
              </div>
            </div>
          </div>

          <div className="cw-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f5f3ff", border: "1px solid #ede9fe", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Administrators
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                {stats.admins}
              </div>
            </div>
          </div>

          <div className="cw-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ecfdf5", border: "1px solid #d1fae5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCheck style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Active Users
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                {stats.active}
              </div>
            </div>
          </div>

          <div className="cw-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserX style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Inactive
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                {stats.inactive}
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div
          className="cw-card"
          style={{
            padding: "14px 18px",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <ModernSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, email or ID..."
              width={280}
            />

            {/* Role Filter Pills */}
            <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 3, border: "1px solid #cbd5e1" }}>
              <button
                type="button"
                onClick={() => setRoleFilter("ALL")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: roleFilter === "ALL" ? "1px solid #cbd5e1" : "1px solid transparent",
                  background: roleFilter === "ALL" ? "#ffffff" : "transparent",
                  color: roleFilter === "ALL" ? "#2563eb" : "#64748b",
                  cursor: "pointer",
                  boxShadow: roleFilter === "ALL" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                All Roles
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("ADMIN")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: roleFilter === "ADMIN" ? "1px solid #cbd5e1" : "1px solid transparent",
                  background: roleFilter === "ADMIN" ? "#ffffff" : "transparent",
                  color: roleFilter === "ADMIN" ? "#7c3aed" : "#64748b",
                  cursor: "pointer",
                  boxShadow: roleFilter === "ADMIN" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                Admins ({stats.admins})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("USER")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: roleFilter === "USER" ? "1px solid #cbd5e1" : "1px solid transparent",
                  background: roleFilter === "USER" ? "#ffffff" : "transparent",
                  color: roleFilter === "USER" ? "#059669" : "#64748b",
                  cursor: "pointer",
                  boxShadow: roleFilter === "USER" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                DSA Agents ({stats.standard})
              </button>
            </div>

            {/* Status Filter Pills */}
            <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 3, border: "1px solid #cbd5e1" }}>
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: statusFilter === "ALL" ? "1px solid #cbd5e1" : "1px solid transparent",
                  background: statusFilter === "ALL" ? "#ffffff" : "transparent",
                  color: statusFilter === "ALL" ? "#0f172a" : "#64748b",
                  cursor: "pointer",
                  boxShadow: statusFilter === "ALL" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ACTIVE")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: statusFilter === "ACTIVE" ? "1px solid #cbd5e1" : "1px solid transparent",
                  background: statusFilter === "ACTIVE" ? "#ffffff" : "transparent",
                  color: statusFilter === "ACTIVE" ? "#16a34a" : "#64748b",
                  cursor: "pointer",
                  boxShadow: statusFilter === "ACTIVE" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("INACTIVE")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: statusFilter === "INACTIVE" ? "1px solid #cbd5e1" : "1px solid transparent",
                  background: statusFilter === "INACTIVE" ? "#ffffff" : "transparent",
                  color: statusFilter === "INACTIVE" ? "#dc2626" : "#64748b",
                  cursor: "pointer",
                  boxShadow: statusFilter === "INACTIVE" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                Inactive
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="cw-btn-secondary"
              onClick={loadUsers}
              disabled={loading}
              title="Refresh directory"
            >
              <RotateCw style={{ width: 14, height: 14 }} className={loading ? "animate-spin text-blue-600" : ""} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="cw-btn-primary"
              onClick={openAddModal}
            >
              <Plus style={{ width: 15, height: 15 }} />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Users Table Card */}
        <div className="cw-card">
          <div className="cw-table-container">
            <table className="cw-table">
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: "center" }}>ID</th>
                  <th style={{ minWidth: 200, textAlign: "left" }}>Account Name</th>
                  <th style={{ minWidth: 220, textAlign: "left" }}>Email Address</th>
                  <th style={{ width: 130, textAlign: "center" }}>Role</th>
                  <th style={{ width: 130, textAlign: "center" }}>Status</th>
                  <th style={{ width: 130, textAlign: "center" }}>Joined Date</th>
                  <th style={{ width: 130, textAlign: "center" }}>Last Login</th>
                  <th style={{ width: 120, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                      <RotateCw style={{ width: 24, height: 24, margin: "0 auto 8px" }} className="animate-spin text-blue-600" />
                      <p style={{ margin: 0, fontSize: "0.875rem" }}>Loading user directory...</p>
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                      <Users style={{ width: 36, height: 36, color: "#94a3b8", margin: "0 auto 8px" }} />
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", color: "#0f172a", fontWeight: 600 }}>No Accounts Match Query</h4>
                      <p style={{ margin: 0, fontSize: "0.8125rem" }}>Try adjusting your search criteria or resetting filters.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const isAdmin = String(u.role || "").toLowerCase() === "admin";
                    const initials = getUserInitials(u.name, u.email);

                    return (
                      <tr key={u.id}>
                        <td style={{ textAlign: "center", fontWeight: 600, color: "#94a3b8", fontSize: "0.8125rem" }}>
                          #{u.id}
                        </td>
                        <td style={{ textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: isAdmin ? "#f5f3ff" : "#eff6ff",
                                border: `1px solid ${isAdmin ? "#ddd6fe" : "#bfdbfe"}`,
                                color: isAdmin ? "#7c3aed" : "#2563eb",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "0.75rem",
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.875rem" }}>
                              {u.name || "System User"}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: "left", color: "#475569", fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}>
                          {u.email}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`cw-badge ${isAdmin ? "cw-badge-warning" : "cw-badge-info"}`}>
                            {isAdmin ? "Admin" : "DSA Agent"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <ModernStatusBadge status={u.status} />
                        </td>
                        <td style={{ textAlign: "center", color: "#64748b", fontSize: "0.8125rem" }}>
                          {formatDate(u.created_at)}
                        </td>
                        <td style={{ textAlign: "center", color: "#64748b", fontSize: "0.8125rem" }}>
                          {formatDate(u.last_login)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <button
                              type="button"
                              className="cw-action-btn"
                              onClick={() => openEditModal(u)}
                              title="Edit user"
                              aria-label={`Edit ${u.email}`}
                            >
                              <Pencil style={{ width: 14, height: 14 }} />
                            </button>
                            <button
                              type="button"
                              className="cw-action-btn"
                              onClick={() => openDeleteModal(u)}
                              title="Delete user"
                              aria-label={`Delete ${u.email}`}
                              style={{ color: "#dc2626" }}
                            >
                              <Trash2 style={{ width: 14, height: 14 }} />
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
          {filteredUsers.length > 0 && (
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                fontSize: "0.8125rem",
                color: "#64748b",
              }}
            >
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} accounts
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  type="button"
                  className="cw-btn-secondary"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                >
                  <ChevronLeft style={{ width: 14, height: 14 }} />
                  <span>Previous</span>
                </button>

                <span style={{ fontWeight: 600, padding: "0 8px", color: "#0f172a" }}>
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  className="cw-btn-secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                >
                  <span>Next</span>
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(3px)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="cw-card"
            style={{ width: "100%", maxWidth: 480, overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cw-card-header">
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                Create New User Account
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", color: "#64748b", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ padding: 22 }}>
              {createError && (
                <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "0.8125rem" }}>
                  {createError}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="cw-input"
                  placeholder="e.g. Rahul Sharma"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  className="cw-input"
                  placeholder="e.g. rahul@example.com"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Password *
                </label>
                <input
                  type="password"
                  className="cw-input"
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Role
                  </label>
                  <select
                    className="cw-select"
                    style={{ width: "100%" }}
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  >
                    <option value="user">DSA Agent (User)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Status
                  </label>
                  <select
                    className="cw-select"
                    style={{ width: "100%" }}
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="cw-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cw-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && editUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(3px)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="cw-card"
            style={{ width: "100%", maxWidth: 480, overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cw-card-header">
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                Edit Account #{editUser.id}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", color: "#64748b", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateUser} style={{ padding: 22 }}>
              {editError && (
                <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "0.8125rem" }}>
                  {editError}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="cw-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  className="cw-input"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Reset Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  className="cw-input"
                  placeholder="Enter new password (optional)"
                  minLength={6}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Role
                  </label>
                  <select
                    className="cw-select"
                    style={{ width: "100%" }}
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="user">DSA Agent (User)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Status
                  </label>
                  <select
                    className="cw-select"
                    style={{ width: "100%" }}
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="cw-btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cw-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {showDeleteModal && userToDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(3px)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="cw-card"
            style={{ width: "100%", maxWidth: 440, padding: 24, textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#fef2f2",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px auto",
              }}
            >
              <Trash2 style={{ width: 22, height: 22 }} />
            </div>

            <h3 style={{ margin: "0 0 6px 0", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              Delete Account?
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.875rem", color: "#64748b" }}>
              Are you sure you want to delete user account <strong>{userToDelete.email}</strong>? This action cannot be undone.
            </p>

            {deleteError && (
              <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: "0.8125rem" }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
              <button
                type="button"
                className="cw-btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cw-btn-danger"
                onClick={handleDeleteUser}
                disabled={submitting}
              >
                {submitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
