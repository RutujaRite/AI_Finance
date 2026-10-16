"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  CheckCircle2,
  KeyRound,
  RotateCw,
  AlertCircle,
  Hash,
} from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }

    const codeParam = searchParams.get("code");
    if (codeParam) {
      setCode(codeParam.replace(/\D/g, "").slice(0, 6));
    }

    if (typeof window !== "undefined") {
      const savedTheme =
        (localStorage.getItem("theme") as "light" | "dark") ||
        (localStorage.getItem("finai-theme") as "light" | "dark") ||
        "light";
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
      document.documentElement.setAttribute("data-bs-theme", savedTheme);
    }
  }, [searchParams]);

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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please provide your registered email address.");
      return;
    }

    const cleanCode = code.trim().replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setError("Please enter the 6-digit numeric verification code.");
      return;
    }

    if (password.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("New password and confirmation password do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: cleanCode,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setSuccess(true);
        // Redirect to login with success indicator
        setTimeout(() => {
          router.push("/login?reset=success");
        }, 1500);
      } else {
        setError(data?.error || "Failed to reset password. Please check your verification code.");
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
              Security Center
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

      {/* Main Form Container */}
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
            maxWidth: "480px",
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
          {/* Badge */}
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background:
                theme === "dark"
                  ? "rgba(13, 148, 136, 0.15)"
                  : "rgba(13, 148, 136, 0.1)",
              color: "#0d9488",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1.25rem",
              border: "1px solid rgba(13, 148, 136, 0.2)",
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
            Set New Password
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: theme === "dark" ? "#94a3b8" : "#64748b",
              lineHeight: 1.5,
              margin: "0 0 1.5rem",
            }}
          >
            Enter the 6-digit code sent to your email and choose your new password.
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

          {success ? (
            <div
              style={{
                padding: "20px",
                borderRadius: "12px",
                background:
                  theme === "dark"
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                color: "#059669",
                textAlign: "center",
              }}
            >
              <CheckCircle2 size={36} style={{ margin: "0 auto 12px", display: "block" }} />
              <div style={{ fontWeight: 800, fontSize: "1.0625rem", marginBottom: "4px" }}>
                Password Reset Successfully!
              </div>
              <div style={{ color: theme === "dark" ? "#cbd5e1" : "#475569", fontSize: "0.8125rem" }}>
                Your password has been updated. Redirecting you to the sign in page...
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Registered Email */}
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
                  Registered Email Address
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

              {/* 6-Digit Verification Code */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: theme === "dark" ? "#cbd5e1" : "#334155",
                    }}
                  >
                    6-Digit Verification Code
                  </label>
                  <Link
                    href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                    style={{
                      fontSize: "0.75rem",
                      color: "#2563eb",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    Request new code
                  </Link>
                </div>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Hash
                    size={17}
                    style={{
                      position: "absolute",
                      left: "14px",
                      color: theme === "dark" ? "#64748b" : "#94a3b8",
                    }}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                      fontSize: "1rem",
                      letterSpacing: "4px",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* New Password */}
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
                  New Password
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Lock
                    size={17}
                    style={{
                      position: "absolute",
                      left: "14px",
                      color: theme === "dark" ? "#64748b" : "#94a3b8",
                    }}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 40px 11px 40px",
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
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      background: "none",
                      border: "none",
                      color: theme === "dark" ? "#64748b" : "#94a3b8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
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
                  Confirm New Password
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Lock
                    size={17}
                    style={{
                      position: "absolute",
                      left: "14px",
                      color: theme === "dark" ? "#64748b" : "#94a3b8",
                    }}
                  />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 40px 11px 40px",
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
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      background: "none",
                      border: "none",
                      color: theme === "dark" ? "#64748b" : "#94a3b8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "8px",
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
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div style={{ textAlign: "center", marginTop: "8px" }}>
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RotateCw className="animate-spin" size={24} style={{ color: "#2563eb" }} />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
