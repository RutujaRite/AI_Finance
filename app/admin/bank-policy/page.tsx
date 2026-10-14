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
      <main
        style={{
          padding: 48,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          gap: 12,
          background: "#f8fafc",
        }}
      >
        <div className="spinner-border text-primary" style={{ width: 36, height: 36 }} role="status"></div>
        <p style={{ color: "#64748b", fontWeight: 500, fontSize: "0.9rem" }}>
          Verifying administrator access...
        </p>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      {/* 1. TOP HEADER & BREADCRUMBS (NO SIDEBAR) */}
      <AdminHeader
        user={user}
        title="Bank Policy"
        description="Underwriting policy guidelines, credit cutoffs, lender RAG knowledge base, and official policy documents."
        breadcrumbs={[{ label: "Bank Policy" }]}
      />

      {/* 2. MAIN BANK POLICY MODULE CONTENT */}
      <main
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "20px 28px 60px 28px",
          boxSizing: "border-box",
        }}
      >
        <PoliciesView embedded={true} user={user} />
      </main>
    </div>
  );
}
