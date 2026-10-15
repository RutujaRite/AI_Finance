/**
 * Location & Contact Directory Page (Admin Only)
 * Dedicated standalone page accessible at /admin/location-contact
 * Official partner bank branch locations, branch managers, escalation contacts, and relationship managers.
 * Uses: /api/auth/verify, /api/bank-managers
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import {
  Users,
  Building2,
  MapPin,
  Search,
  Phone,
  Mail,
  RotateCcw,
} from "lucide-react";

interface BankManager {
  id: number;
  bank_name: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  location: string;
  city?: string;
  district?: string;
  state?: string;
  branch?: string;
}

export default function LocationContactPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [managers, setManagers] = useState<BankManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBank, setFilterBank] = useState("all");
  const [filterRole, setFilterRole] = useState("all");

  useEffect(() => {
    checkAuth();
    fetchManagers();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/verify", { credentials: "include" });
      if (res.ok) {
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
          setUser(data.user);
        }
      } else {
        router.replace("/?auth=login&from=/admin/location-contact");
      }
    } catch {
      router.replace("/?auth=login&from=/admin/location-contact");
    }
  }

  async function fetchManagers() {
    setLoading(true);
    try {
      const res = await fetch("/api/bank-managers", { credentials: "include" });
      const data = await res.json();
      setManagers(Array.isArray(data.managers) ? data.managers : []);
    } catch (e) {
      console.error("Error fetching location contacts", e);
      setManagers([]);
    } finally {
      setLoading(false);
    }
  }

  const bankOptions = useMemo(() => {
    const set = new Set<string>();
    managers.forEach((m) => {
      const b = (m.bank_name || "").trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [managers]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    managers.forEach((m) => {
      const r = (m.role || "").trim();
      if (r) set.add(r);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [managers]);

  const uniqueLocationsCount = useMemo(() => {
    const set = new Set<string>();
    managers.forEach((m) => {
      const loc = (m.city || m.location || m.district || "").trim();
      if (loc) set.add(loc.toLowerCase());
    });
    return set.size;
  }, [managers]);

  const filteredManagers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return managers.filter((m) => {
      const matchesBank = filterBank === "all" || (m.bank_name || "").toLowerCase() === filterBank.toLowerCase();
      const matchesRole = filterRole === "all" || (m.role || "").toLowerCase() === filterRole.toLowerCase();
      const matchesQuery =
        !q ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.bank_name || "").toLowerCase().includes(q) ||
        (m.location || "").toLowerCase().includes(q) ||
        (m.city || "").toLowerCase().includes(q) ||
        (m.district || "").toLowerCase().includes(q) ||
        (m.state || "").toLowerCase().includes(q) ||
        (m.branch || "").toLowerCase().includes(q) ||
        (m.phone || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q);
      return matchesBank && matchesRole && matchesQuery;
    });
  }, [managers, searchQuery, filterBank, filterRole]);

  if (!user) {
    return (
      <main style={{ padding: 48, textAlign: "center", minHeight: "100vh", background: "#f8fafc" }}>
        <div className="spinner-border text-primary" style={{ width: 36, height: 36 }} role="status"></div>
        <p style={{ color: "#64748b", marginTop: 12 }}>Verifying admin authorization...</p>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      {/* 1. TOP HEADER & BREADCRUMBS (NO SIDEBAR) */}
      <AdminHeader
        user={user}
        title="Location & Contact"
        description="Official partner bank branch locations, sales managers, and escalation contacts across India."
        breadcrumbs={[{ label: "Location & Contact" }]}
      />

      {/* 2. MAIN CONTAINER */}
      <main
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "24px 28px 60px 28px",
          boxSizing: "border-box",
        }}
      >
        {/* Metric Cards Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            className="cw-card"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "#ffffff",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "10px",
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>{managers.length}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--ink-soft, #64748b)" }}>Total Officials</div>
            </div>
          </div>

          <div
            className="cw-card"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "#ffffff",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "10px",
                background: "#f5f3ff",
                color: "#7c3aed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>{bankOptions.length}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--ink-soft, #64748b)" }}>Partner Banks</div>
            </div>
          </div>

          <div
            className="cw-card"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "#ffffff",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "10px",
                background: "#ecfdf5",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <MapPin size={20} />
            </div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>{uniqueLocationsCount}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--ink-soft, #64748b)" }}>Cities &amp; Branches</div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          className="cw-card"
          style={{
            background: "#ffffff",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 220px 220px auto",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative" }}>
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ink-soft, #64748b)",
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Search by city, branch location, officer name, phone, or bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: "38px",
                  height: "38px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #e2e8f0)",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div>
              <select
                className="form-select"
                value={filterBank}
                onChange={(e) => setFilterBank(e.target.value)}
                style={{ height: "38px", borderRadius: "8px", border: "1px solid var(--border, #e2e8f0)", fontSize: "0.85rem" }}
              >
                <option value="all">All Banks ({bankOptions.length})</option>
                {bankOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                className="form-select"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                style={{ height: "38px", borderRadius: "8px", border: "1px solid var(--border, #e2e8f0)", fontSize: "0.85rem" }}
              >
                <option value="all">All Roles ({roleOptions.length})</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || filterBank !== "all" || filterRole !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterBank("all");
                  setFilterRole("all");
                }}
                className="btn btn-secondary btn-sm"
                style={{ height: "38px", borderRadius: "8px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <RotateCcw size={13} />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Directory Records Table */}
        <div
          className="cw-card"
          style={{
            background: "#ffffff",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
                <th style={{ textAlign: "left", padding: "12px 20px", fontWeight: 600, color: "var(--ink-soft, #64748b)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Official Name
                </th>
                <th style={{ textAlign: "left", padding: "12px 20px", fontWeight: 600, color: "var(--ink-soft, #64748b)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Bank
                </th>
                <th style={{ textAlign: "left", padding: "12px 20px", fontWeight: 600, color: "var(--ink-soft, #64748b)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Role / Designation
                </th>
                <th style={{ textAlign: "left", padding: "12px 20px", fontWeight: 600, color: "var(--ink-soft, #64748b)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Branch / Location
                </th>
                <th style={{ textAlign: "left", padding: "12px 20px", fontWeight: 600, color: "var(--ink-soft, #64748b)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Contact Details
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "var(--ink-soft, #64748b)" }}>
                    <div className="spinner-border text-primary" role="status" style={{ width: 28, height: 28 }} />
                  </td>
                </tr>
              ) : filteredManagers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "var(--ink-soft, #64748b)" }}>
                    No contacts found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredManagers.slice(0, 100).map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--border, #e2e8f0)" }}>
                    <td style={{ padding: "12px 20px" }}>
                      <div style={{ fontWeight: 600, color: "var(--ink, #0f172a)" }}>{m.name || "—"}</div>
                    </td>
                    <td style={{ padding: "12px 20px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "#eff6ff",
                          color: "#2563eb",
                          fontWeight: 600,
                          fontSize: "0.78rem",
                        }}
                      >
                        <Building2 size={12} />
                        {m.bank_name || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 20px", color: "var(--ink, #0f172a)" }}>{m.role || "Branch Official"}</td>
                    <td style={{ padding: "12px 20px", color: "var(--ink-soft, #64748b)" }}>
                      {m.branch || m.location || m.city
                        ? `${m.branch ? `${m.branch}, ` : ""}${m.city || m.location || ""}`
                        : "—"}
                    </td>
                    <td style={{ padding: "12px 20px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "0.78rem" }}>
                        {m.phone && (
                          <a href={`tel:${m.phone}`} style={{ color: "#2563eb", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Phone size={11} />
                            {m.phone}
                          </a>
                        )}
                        {m.email && (
                          <a href={`mailto:${m.email}`} style={{ color: "var(--ink-soft, #64748b)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Mail size={11} />
                            {m.email}
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
