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
            style={{
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "10px",
                background: "rgba(79, 70, 229, 0.1)",
                color: "#4f46e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              <i className="bi bi-person-lines-fill" />
            </div>
            <div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>{managers.length}</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Total Officials</div>
            </div>
          </div>

          <div
            style={{
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "10px",
                background: "rgba(37, 99, 235, 0.1)",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              <i className="bi bi-bank" />
            </div>
            <div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>{bankOptions.length}</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Partner Banks</div>
            </div>
          </div>

          <div
            style={{
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "10px",
                background: "rgba(16, 185, 129, 0.1)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              <i className="bi bi-geo-alt-fill" />
            </div>
            <div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>{uniqueLocationsCount}</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Cities &amp; Branches</div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "20px 24px",
            marginBottom: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 220px 220px auto",
              gap: "14px",
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative" }}>
              <i
                className="bi bi-search"
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Search by city, branch location, officer name, phone, or bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: "40px",
                  height: "44px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <div>
              <select
                className="form-select"
                value={filterBank}
                onChange={(e) => setFilterBank(e.target.value)}
                style={{ height: "44px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
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
                style={{ height: "44px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
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
                className="btn btn-light"
                style={{ height: "44px", borderRadius: "10px", border: "1px solid #cbd5e1", color: "#64748b" }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Directory Records Table */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 600, color: "#475569" }}>
                  Official Name
                </th>
                <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 600, color: "#475569" }}>
                  Bank
                </th>
                <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 600, color: "#475569" }}>
                  Role / Designation
                </th>
                <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 600, color: "#475569" }}>
                  Branch / Location
                </th>
                <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 600, color: "#475569" }}>
                  Contact Details
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    <div className="spinner-border text-primary" role="status" />
                  </td>
                </tr>
              ) : filteredManagers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    No contacts found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredManagers.slice(0, 100).map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{m.name || "—"}</div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: "#f1f5f9",
                          color: "#1e293b",
                          fontWeight: 600,
                          fontSize: "0.78rem",
                        }}
                      >
                        <i className="bi bi-bank" style={{ color: "#4f46e5" }} />
                        {m.bank_name || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", color: "#475569" }}>{m.role || "Branch Official"}</td>
                    <td style={{ padding: "14px 20px", color: "#64748b" }}>
                      {m.branch || m.location || m.city
                        ? `${m.branch ? `${m.branch}, ` : ""}${m.city || m.location || ""}`
                        : "—"}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.8rem" }}>
                        {m.phone && (
                          <a href={`tel:${m.phone}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                            <i className="bi bi-telephone-fill" style={{ marginRight: 4, fontSize: "0.72rem" }} />
                            {m.phone}
                          </a>
                        )}
                        {m.email && (
                          <a href={`mailto:${m.email}`} style={{ color: "#64748b", textDecoration: "none" }}>
                            <i className="bi bi-envelope-fill" style={{ marginRight: 4, fontSize: "0.72rem" }} />
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
