/**
 * Dedicated Bank Policy Management Page (Admin Only)
 * Standalone page accessible at /admin/bank-policy
 * Underwriting policies, minimum salary rules, cutoffs, RAG documents, and vector integration.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import PoliciesView from "@/components/PoliciesView";

export default function BankPolicyDedicatedPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/verify", { credentials: "include" });
        if (!res.ok) {
          router.replace("/?auth=login&from=/admin/bank-policy");
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
        } else {
          router.replace("/?auth=login&from=/admin/bank-policy");
        }
      } catch {
        router.replace("/?auth=login&from=/admin/bank-policy");
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-12 text-center">
        <div className="spinner-border text-primary" style={{ width: 36, height: 36 }} role="status"></div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-3">
          Verifying administrator access...
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-200">
      {/* 1. TOP HEADER & BREADCRUMBS (NO SIDEBAR) */}
      <AdminHeader
        user={user}
        title="Bank Policy"
        description="Official bank master policy documents, spreadsheet uploads, and lender RAG knowledge base."
        breadcrumbs={[{ label: "Bank Policy" }]}
      />

      {/* 2. MAIN BANK POLICY MODULE CONTENT */}
      <main className="cw-admin-container py-6">
        <PoliciesView embedded={true} user={user} />
      </main>
    </div>
  );
}
