"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  CheckCircle2,
  KeyRound,
  RotateCw,
  AlertCircle,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme =
        (localStorage.getItem("theme") as "light" | "dark") ||
        (localStorage.getItem("finai-theme") as "light" | "dark") ||
        "light";
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
      document.documentElement.setAttribute("data-bs-theme", savedTheme);
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", next);
      localStorage.setItem("finai-theme", next);
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.setAttribute("data-bs-theme", next);
    }
  };

  const handleRequestReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setSubmittedEmail(email.trim());
        setSuccessMessage(
          data.message ||
            "If an account exists with this email address, a 6-digit verification code has been sent."
        );
        setResendCooldown(60);
      } else {
        setError(data?.error || "Unable to send verification code. Please try again.");
      }
    } catch {
      setError("Network connection error. Please verify your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          theme === "dark"
            ? "radial-gradient(circle at 15% 15%, rgba(13, 148, 136, 0.12) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(37, 99, 235, 0.12) 0%, transparent 45%), #070d18"
            : "radial-gradient(circle at 15% 15%, rgba(13, 148, 136, 0.08) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(37, 99, 235, 0.08) 0%, transparent 45%), #f8fafc",
        color: theme === "dark" ? "#f1f5f9" : "#0f172a",
        position: "relative",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Top Navbar */}
      <header
        style={{
          height: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0d9488, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 4px 12px rgba(13, 148, 136, 0.3)",
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div
              style={{
                fontSize: "1.125rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              CreditWise<span style={{ color: "#2563eb" }}>AI</span>
            </div>
            <div
              style={{
                fontSize: "0.6875rem",
                color: theme === "dark" ? "#94a3b8" : "#64748b",
                fontWeight: 500,
              }}
            >
              Account Recovery
            </div>
          </div>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              border:
                theme === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.1)"
                  : "1px solid #e2e8f0",
              background:
                theme === "dark" ? "rgba(255, 255, 255, 0.05)" : "#ffffff",
              color: theme === "dark" ? "#f1f5f9" : "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              border:
                theme === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.12)"
                  : "1px solid #cbd5e1",
              background:
                theme === "dark" ? "rgba(255, 255, 255, 0.04)" : "#ffffff",
              color: "inherit",
              textDecoration: "none",
              fontSize: "0.8125rem",
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={14} />
            <span>Back to Login</span>
          </Link>
        </div>
      </header>

      {/* Main Content Card Container */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1.5rem",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "460px",
            background:
              theme === "dark"
                ? "rgba(17, 27, 46, 0.9)"
                : "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border:
              theme === "dark"
                ? "1px solid rgba(255, 255, 255, 0.08)"
                : "1px solid rgba(226, 232, 240, 0.9)",
            borderRadius: "20px",
            padding: "2.5rem 2rem",
            boxShadow:
              theme === "dark"
                ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 25px rgba(37, 99, 235, 0.1)"
                : "0 25px 50px -12px rgba(15, 23, 42, 0.08), 0 0 25px rgba(13, 148, 136, 0.06)",
          }}
        >
          {/* Icon Badge */}
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background:
                theme === "dark"
                  ? "rgba(37, 99, 235, 0.15)"
                  : "rgba(37, 99, 235, 0.1)",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1.25rem",
              border: "1px solid rgba(37, 99, 235, 0.2)",
            }}
          >
            <KeyRound size={24} />
          </div>

          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: "0 0 6px",
            }}
          >
            Reset Your Password
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: theme === "dark" ? "#94a3b8" : "#64748b",
              lineHeight: 1.5,
              margin: "0 0 1.5rem",
            }}
          >
            Enter your registered email address below. We'll send you a secure 6-digit verification code to reset your password.
          </p>

          {error && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                background: "rgba(220, 38, 38, 0.1)",
                border: "1px solid rgba(220, 38, 38, 0.25)",
                color: "#dc2626",
                fontSize: "0.8125rem",
                fontWeight: 500,
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMessage ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  background:
                    theme === "dark"
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  color: "#059669",
                  fontSize: "0.875rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, marginBottom: "4px" }}>
                  <CheckCircle2 size={18} />
                  <span>Verification Code Sent</span>
                </div>
                <div style={{ color: theme === "dark" ? "#cbd5e1" : "#475569", fontSize: "0.8125rem", lineHeight: 1.5 }}>
                  {successMessage}
                </div>
                <div style={{ marginTop: "8px", fontWeight: 600, color: "#2563eb", fontSize: "0.8125rem" }}>
                  Code sent to: {submittedEmail}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push(`/reset-password?email=${encodeURIComponent(submittedEmail)}`)
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #0d9488 0%, #2563eb 100%)",
                  color: "#ffffff",
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(13, 148, 136, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <span>Enter Verification Code</span>
                <ArrowRight size={16} />
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => handleRequestReset()}
                  disabled={loading || resendCooldown > 0}
                  style={{
                    background: "none",
                    border: "none",
                    color: resendCooldown > 0 ? (theme === "dark" ? "#64748b" : "#94a3b8") : "#2563eb",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: resendCooldown > 0 ? "default" : "pointer",
                    padding: 0,
                  }}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSuccessMessage("");
                    setEmail("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: theme === "dark" ? "#94a3b8" : "#64748b",
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Change email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRequestReset} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: theme === "dark" ? "#cbd5e1" : "#334155",
                  }}
                >
                  Email Address
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Mail
                    size={17}
                    style={{
                      position: "absolute",
                      left: "14px",
                      color: theme === "dark" ? "#64748b" : "#94a3b8",
                    }}
                  />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 14px 11px 40px",
                      borderRadius: "10px",
                      border:
                        theme === "dark"
                          ? "1px solid rgba(255, 255, 255, 0.1)"
                          : "1px solid #cbd5e1",
                      background:
                        theme === "dark"
                          ? "rgba(255, 255, 255, 0.03)"
                          : "#f8fafc",
                      color: "inherit",
                      fontSize: "0.875rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "6px",
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #0d9488 0%, #2563eb 100%)",
                  color: "#ffffff",
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: loading ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(13, 148, 136, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  opacity: loading ? 0.75 : 1,
                }}
              >
                {loading ? (
                  <>
                    <RotateCw className="animate-spin" size={16} />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div style={{ textAlign: "center", marginTop: "12px" }}>
                <Link
                  href="/login"
                  style={{
                    color: theme === "dark" ? "#94a3b8" : "#64748b",
                    fontSize: "0.8125rem",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Remember your password? <span style={{ color: "#2563eb" }}>Sign in</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
