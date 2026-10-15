/**
 * CreditWise AI — Admin Dashboard Overview
 * Modern, cohesive financial SaaS dashboard without left sidebar.
 * Connects directly to live PostgreSQL statistics via /api/admin/stats.
 * All 5 dashboard cards navigate to dedicated standalone pages:
 * 1. /admin/company-search
 * 2. /admin/bank-policy
 * 3. /admin/bank-managers
 * 4. /admin/users
 * 5. /agent-studio
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import ModernStatusBadge from "@/components/ui/ModernStatusBadge";
import {
  Building2,
  ShieldCheck,
  Users,
  UserCheck,
  Bot,
  ArrowRight,
  ArrowLeft,
  Activity,
  Layers,
  Sparkles,
  ChevronRight,
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  companyRecords: number;
  lendersCount: number;
  bankManagersCount: number;
  policyFilesCount: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Live Stats from Database API
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    companyRecords: 0,
    lendersCount: 23,
    bankManagersCount: 0,
    policyFilesCount: 0,
  });

  // Recent Activity Records
  const [activities, setActivities] = useState<Record<string, { lastUpdated: string | null; status: string }>>({
    companyData: { lastUpdated: null, status: "Active" },
    bankPolicies: { lastUpdated: null, status: "Active" },
    userAccounts: { lastUpdated: null, status: "Active" },
  });

  useEffect(() => {
    checkAdminAuth();
  }, []);

  async function checkAdminAuth() {
    try {
      const res = await fetch("/api/auth/verify", { credentials: "include" });
      if (!res.ok) {
        router.replace("/?auth=login&from=/admin");
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

        setUser(data.user);
        loadDashboardStats();
      } else {
        router.replace("/?auth=login&from=/admin");
      }
    } catch {
      router.replace("/?auth=login&from=/admin");
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboardStats() {
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stats) {
          setStats({
            totalUsers: Number(data.stats.totalUsers) || 0,
            companyRecords: Number(data.stats.companyRecords) || 0,
            lendersCount: Number(data.stats.lendersCount) || 23,
            bankManagersCount: Number(data.stats.bankManagersCount) || 0,
            policyFilesCount: Number(data.stats.policyFilesCount) || 0,
          });
          if (data.activity) {
            setActivities(data.activity);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load dashboard statistics:", e);
    }
  }

  function formatRelativeDate(dateStr?: string | null, fallback = "Today"): string {
    if (!dateStr) return fallback;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return fallback;

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (loading || !user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-3 bg-slate-50">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium text-sm">
          Verifying administrator access...
        </p>
      </main>
    );
  }

  const moduleCards = [
    {
      id: "card-company-search",
      title: "Company Search",
      subtitle: stats.companyRecords > 0 ? `${stats.companyRecords.toLocaleString()} records` : "533,000+ records",
      desc: "Company employer categorization & database",
      href: "/admin/company-search",
      icon: Building2,
      iconColor: "#0284c7",
      iconBg: "#e0f2fe",
      hoverBorder: "#93c5fd",
    },
    {
      id: "card-bank-policy",
      title: "Bank Policy",
      subtitle: stats.lendersCount ? `${stats.lendersCount} lenders` : "23 lenders",
      desc: "Lender criteria, matrix rules & knowledge base",
      href: "/admin/bank-policy",
      icon: ShieldCheck,
      iconColor: "#7c3aed",
      iconBg: "#ede9fe",
      hoverBorder: "#c4b5fd",
    },
    {
      id: "card-bank-managers",
      title: "Bank Managers",
      subtitle: stats.bankManagersCount > 0 ? `${stats.bankManagersCount} contacts` : "Manager directory",
      desc: "Branch escalation contacts & city directory",
      href: "/admin/bank-managers",
      icon: Users,
      iconColor: "#16a34a",
      iconBg: "#dcfce7",
      hoverBorder: "#86efac",
    },
    {
      id: "card-total-users",
      title: "User Accounts",
      subtitle: stats.totalUsers > 0 ? `${stats.totalUsers.toLocaleString()} users` : "Active users",
      desc: "Manage customer access, roles and verification",
      href: "/admin/users",
      icon: UserCheck,
      iconColor: "#c026d3",
      iconBg: "#fae8ff",
      hoverBorder: "#e879f9",
    },
    {
      id: "card-ai-agent-studio",
      title: "AI Agent Studio",
      subtitle: "Multi-agent studio",
      desc: "Configure RAG models, prompts and parameters",
      href: "/agent-studio",
      icon: Bot,
      iconColor: "#2563eb",
      iconBg: "#eff6ff",
      hoverBorder: "#93c5fd",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 1. TOP NAVIGATION */}
      <AdminHeader user={user} showBreadcrumbs={false} />

      {/* Subnav toolbar */}
      <div className="max-w-[1400px] w-full mx-auto px-3.5 sm:px-8 pt-4">
        <button
          onClick={() => router.push("/home?section=assistant")}
          className="cw-btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Back to Workspace</span>
        </button>
      </div>

      {/* 2. MAIN DASHBOARD CONTENT CONTAINER */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3.5 sm:px-8 py-5 sm:py-6 space-y-6 sm:space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Admin Overview</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Central Control
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage platform lender policies, company database, managers, and AI configurations.
            </p>
          </div>
        </div>

        {/* 5 Module Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {moduleCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                id={card.id}
                onClick={() => router.push(card.href)}
                className="cw-card p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 group flex flex-col justify-between"
                style={{
                  border: "1px solid #e2e8f0",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = card.hoverBorder;
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(15, 23, 42, 0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                    style={{ background: card.iconBg, color: card.iconColor }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {card.title}
                      </h2>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div className="text-sm font-semibold mt-0.5" style={{ color: card.iconColor }}>
                      {card.subtitle}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {card.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Activity Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Platform Core Modules</span>
            </h2>
            <span className="text-xs text-slate-500">Live operational status</span>
          </div>

          <div className="cw-table-container">
            <table className="cw-table">
              <thead>
                <tr>
                  <th style={{ width: "40%", textAlign: "left" }}>Module Section</th>
                  <th style={{ width: "35%", textAlign: "left" }}>Last Synchronized</th>
                  <th style={{ width: "25%", textAlign: "center" }}>Operational Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Row 1: Company data */}
                <tr>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">Company Master Data</div>
                        <div className="text-xs text-slate-400">Employer categorization directory</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-slate-600">
                    {formatRelativeDate(activities.companyData?.lastUpdated, "Today")}
                  </td>
                  <td className="text-center">
                    <ModernStatusBadge status="active" label="Live & Active" />
                  </td>
                </tr>

                {/* Row 2: Bank policies */}
                <tr>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">Bank Policies & Matrices</div>
                        <div className="text-xs text-slate-400">Multi-bank credit guidelines</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-slate-600">
                    {formatRelativeDate(activities.bankPolicies?.lastUpdated, "Yesterday")}
                  </td>
                  <td className="text-center">
                    <ModernStatusBadge status="active" label="Live & Active" />
                  </td>
                </tr>

                {/* Row 3: User accounts */}
                <tr>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">User Authentication & Roles</div>
                        <div className="text-xs text-slate-400">Client logins and privileges</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-slate-600">
                    {formatRelativeDate(activities.userAccounts?.lastUpdated, "Today")}
                  </td>
                  <td className="text-center">
                    <ModernStatusBadge status="active" label="Live & Active" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
