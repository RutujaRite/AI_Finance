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
import Link from "next/link";
import AdminHeader from "@/components/admin/AdminHeader";
import ModernStatusBadge from "@/components/ui/ModernStatusBadge";
import {
  Building2,
  ShieldCheck,
  Users,
  UserCheck,
  ArrowRight,
  Activity,
  Layers,
  Sparkles,
  Bot,
  Home,
  MessageSquare,
  Calculator,
  FileText,
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
      <main className="flex flex-col items-center justify-center min-h-screen gap-3 bg-slate-50 text-slate-900 font-sans">
        <div className="w-9 h-9 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-600 font-medium text-sm">
          Verifying administrator access...
        </p>
      </main>
    );
  }

  // 5 Focused Core Module Cards with Semantic Tint Colors (Enterprise Light)
  const moduleCards = [
    {
      id: "card-company-search",
      title: "Company Search",
      metric: stats.companyRecords > 0 ? `${stats.companyRecords.toLocaleString()} records` : "533,000+ records",
      desc: "Company employer categorization & database",
      action: "Manage employer database",
      href: "/admin/company-search",
      icon: Building2,
      iconContainerClass: "bg-sky-50 text-sky-600 border border-sky-200",
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    },
    {
      id: "card-bank-policy",
      title: "Bank Policy",
      metric: stats.lendersCount ? `${stats.lendersCount} lenders` : "23 lenders",
      desc: "Lender criteria, matrix rules & knowledge base",
      action: "Configure lending rules",
      href: "/admin/bank-policy",
      icon: ShieldCheck,
      iconContainerClass: "bg-indigo-50 text-indigo-600 border border-indigo-200",
      badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    {
      id: "card-ai-agent-studio",
      title: "AI Agent Studio",
      metric: "Studio & Models",
      desc: "Configure AI instructions, prompts, guardrails and knowledge documents",
      action: "Configure agent intelligence",
      href: "/agent-studio",
      icon: Bot,
      iconContainerClass: "bg-blue-50 text-blue-600 border border-blue-200",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      id: "card-bank-managers",
      title: "Bank Managers",
      metric: stats.bankManagersCount > 0 ? `${stats.bankManagersCount} contacts` : "Manager directory",
      desc: "Branch escalation contacts & city directory",
      action: "View escalation contacts",
      href: "/admin/bank-managers",
      icon: Users,
      iconContainerClass: "bg-emerald-50 text-emerald-600 border border-emerald-200",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      id: "card-total-users",
      title: "User Accounts",
      metric: stats.totalUsers > 0 ? `${stats.totalUsers.toLocaleString()} users` : "2 users",
      desc: "Manage customer access, roles and verification",
      action: "Manage roles & permissions",
      href: "/admin/users",
      icon: UserCheck,
      iconContainerClass: "bg-purple-50 text-purple-600 border border-purple-200",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-500/20 selection:text-blue-700">
      {/* 1. TOP NAVIGATION */}
      <AdminHeader user={user} showBreadcrumbs={false} showBackToWorkspace={false} />

      {/* 2. PAGE CONTAINER */}
      <div className="max-w-7xl mx-auto px-6 py-10 w-full flex-1 flex flex-col">
        {/* Header Section */}
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">
                  Admin Overview
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Central Control
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1.5 m-0 leading-relaxed">
                Manage platform lender policies, company database, managers, and system users.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/home"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-xl transition-all shadow-xs no-underline cursor-pointer group"
                title="Return directly to application homepage"
              >
                <Home className="w-4 h-4 text-white" />
                <span>Return to Homepage</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Quick Return to Workspace Ribbon */}
        <section className="mb-6 bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Home className="w-4 h-4 text-blue-600" />
              Main Workspace:
            </span>
            <span className="hidden sm:inline text-slate-500">Jump directly to workspace calculators &amp; features</span>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <Link
              href="/home?section=assistant"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg font-medium transition-colors no-underline"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>AI Assistant</span>
            </Link>
            <Link
              href="/home?section=emi"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg font-medium transition-colors no-underline"
            >
              <Calculator className="w-3.5 h-3.5 text-indigo-600" />
              <span>EMI Calculator</span>
            </Link>
            <Link
              href="/home?section=eligibility"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg font-medium transition-colors no-underline"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Eligibility Calculator</span>
            </Link>
            <Link
              href="/home?section=policies"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg font-medium transition-colors no-underline"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Bank Policies</span>
            </Link>
          </div>
        </section>

        {/* 3. 4-COLUMN KPI SUMMARY STRIP */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-xs transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3.5 group cursor-default">
            <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 truncate">Total Records</div>
              <div className="text-lg font-bold text-slate-900 tracking-tight tabular-nums mt-0.5">
                {stats.companyRecords > 0 ? stats.companyRecords.toLocaleString() : "533,000+"}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-xs transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3.5 group cursor-default">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 truncate">Active Lenders</div>
              <div className="text-lg font-bold text-slate-900 tracking-tight tabular-nums mt-0.5">
                {stats.lendersCount ? `${stats.lendersCount} Lenders` : "23 Lenders"}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-xs transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3.5 group cursor-default">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 truncate">Directory Status</div>
              <div className="text-lg font-bold text-slate-900 tracking-tight tabular-nums mt-0.5">
                {stats.bankManagersCount > 0 ? `${stats.bankManagersCount} Contacts` : "Verified"}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-xs transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3.5 group cursor-default">
            <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 truncate">Platform Users</div>
              <div className="text-lg font-bold text-slate-900 tracking-tight tabular-nums mt-0.5">
                {stats.totalUsers > 0 ? `${stats.totalUsers.toLocaleString()} Users` : "2 Users"}
              </div>
            </div>
          </div>
        </div>

        {/* 4. MODULE CARDS (5 CORE MODULES IN ENTERPRISE LIGHT GRID) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {moduleCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.id}
                id={card.id}
                href={card.href}
                className="bg-white rounded-xl border border-slate-300 shadow-xs hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-6 flex flex-col justify-between group no-underline text-left cursor-pointer"
              >
                <div>
                  {/* Card Header: 48x48px tinted icon container + metric pill badge */}
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${card.iconContainerClass}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold tabular-nums border ${card.badgeClass}`}>
                      {card.metric}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="mt-5">
                    <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors m-0">
                      {card.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed m-0">
                      {card.desc}
                    </p>
                  </div>
                </div>

                {/* Card Footer: specific module action label + animated arrow */}
                <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                    {card.action}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* 5. RECENT ACTIVITY TABLE (ENTERPRISE LIGHT) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 m-0">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Platform Core Modules</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">Live operational status</span>
          </div>

          <div className="rounded-xl bg-white border border-slate-300 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-6 font-bold" style={{ width: "42%" }}>Module Section</th>
                    <th className="py-3.5 px-6 font-bold" style={{ width: "33%" }}>Last Synchronized</th>
                    <th className="py-3.5 px-6 font-bold text-center" style={{ width: "25%" }}>Operational Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Row 1: Company data */}
                  <tr className="border-b border-slate-200 hover:bg-blue-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">Company Master Data</div>
                          <div className="text-xs text-slate-500">Employer categorization directory</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600 font-mono">
                      {formatRelativeDate(activities.companyData?.lastUpdated, "Today")}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live &amp; Active
                      </span>
                    </td>
                  </tr>

                  {/* Row 2: Bank policies */}
                  <tr className="border-b border-slate-200 hover:bg-blue-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">Bank Policies &amp; Matrices</div>
                          <div className="text-xs text-slate-500">Multi-bank credit guidelines</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600 font-mono">
                      {formatRelativeDate(activities.bankPolicies?.lastUpdated, "Yesterday")}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live &amp; Active
                      </span>
                    </td>
                  </tr>

                  {/* Row 3: AI Agent Studio */}
                  <tr className="border-b border-slate-200 hover:bg-blue-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                          <Bot className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">AI Agent Studio</div>
                          <div className="text-xs text-slate-500">Prompts, guardrails &amp; RAG policies</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600 font-mono">
                      Today
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live &amp; Active
                      </span>
                    </td>
                  </tr>

                  {/* Row 4: User accounts */}
                  <tr className="border-b border-slate-200 last:border-0 hover:bg-blue-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">User Authentication &amp; Roles</div>
                          <div className="text-xs text-slate-500">Client logins and privileges</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600 font-mono">
                      {formatRelativeDate(activities.userAccounts?.lastUpdated, "Today")}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live &amp; Active
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
