"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sun,
  Moon,
  CheckCircle2,
  Building2,
  Bot,
  Zap,
} from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    // Sync theme
    if (typeof window !== "undefined") {
      const savedTheme =
        (localStorage.getItem("theme") as "light" | "dark") ||
        (localStorage.getItem("finai-theme") as "light" | "dark") ||
        "light"
      setTheme(savedTheme)
      document.documentElement.setAttribute("data-theme", savedTheme)
      document.documentElement.setAttribute("data-bs-theme", savedTheme)
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", next)
      localStorage.setItem("finai-theme", next)
      document.documentElement.setAttribute("data-theme", next)
      document.documentElement.setAttribute("data-bs-theme", next)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      })

      const data = await res.json().catch(() => null)

      if (res.ok && data?.success && data?.user) {
        try {
          localStorage.setItem("finai_user", JSON.stringify(data.user))
        } catch {}

        const params =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null
        const from = params?.get("from")

        const isAdmin =
          String(data.user?.role || "").trim().toLowerCase() === "admin" ||
          data.user?.is_admin === true ||
          String(data.user?.email || "").toLowerCase() === "admin@gmail.com" ||
          String(data.user?.email || "").toLowerCase().startsWith("admin")

        if (from) {
          router.replace(from)
        } else if (isAdmin) {
          router.replace("/admin")
        } else {
          router.replace("/home")
        }
        return
      }

      setError(data?.error || "Invalid email or password. Please try again.")
    } catch {
      setError("Network connection error. Please verify your internet connection.")
    } finally {
      setLoading(false)
    }
  }

  const handle1ClickDemo = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail)
    setPassword(demoPass)
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demoEmail, password: demoPass }),
        credentials: "include",
      })

      const data = await res.json().catch(() => null)

      if (res.ok && data?.success && data?.user) {
        try {
          localStorage.setItem("finai_user", JSON.stringify(data.user))
        } catch {}

        const params =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null
        const from = params?.get("from")

        const isAdmin =
          String(data.user?.role || "").trim().toLowerCase() === "admin" ||
          data.user?.is_admin === true ||
          String(data.user?.email || "").toLowerCase() === "admin@gmail.com" ||
          String(data.user?.email || "").toLowerCase().startsWith("admin")

        if (from) {
          router.replace(from)
        } else if (isAdmin) {
          router.replace("/admin")
        } else {
          router.replace("/home")
        }
        return
      }

      setError(data?.error || "Demo login failed")
    } catch {
      setError("Network connection error.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background:
          theme === "dark"
            ? "radial-gradient(ellipse at 20% 20%, #11223e 0%, #0b1220 50%, #070b14 100%)"
            : "radial-gradient(ellipse at 20% 20%, #f0fdfa 0%, #f8fafc 50%, #eef2f6 100%)",
        color: theme === "dark" ? "#f8fafc" : "#0f172a",
        fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
        position: "relative",
      }}
    >
      {/* Top Navbar Bar: Brand + Theme Toggle + Back to Home */}
      <header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
          zIndex: 10,
        }}
      >
        <a
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
              Financial Intelligence
            </div>
          </div>
        </a>

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

          <a
            href="/"
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: theme === "dark" ? "#94a3b8" : "#475569",
              textDecoration: "none",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border:
                theme === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid #e2e8f0",
              background:
                theme === "dark" ? "rgba(255, 255, 255, 0.03)" : "#ffffff",
            }}
          >
            Back to Home
          </a>
        </div>
      </header>

      {/* Main Container */}
      <div
        style={{
          flex: 1,
          display: "flex",
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
          padding: "100px 24px 40px",
          alignItems: "center",
          justifyContent: "center",
          gap: "60px",
        }}
      >
        {/* Left Side: Brand Value Proposition & Trust Metrics (Hidden on small mobile) */}
        <div
          style={{
            flex: "1 1 500px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
          className="desktop-auth-hero"
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "9999px",
              background:
                theme === "dark"
                  ? "rgba(13, 148, 136, 0.15)"
                  : "rgba(13, 148, 136, 0.1)",
              border: "1px solid rgba(13, 148, 136, 0.3)",
              color: "#0d9488",
              fontSize: "0.8125rem",
              fontWeight: 600,
              width: "fit-content",
            }}
          >
            <Sparkles size={15} />
            <span>AI Loan Underwriting Suite v2.5</span>
          </div>

          <h1
            style={{
              fontSize: "2.75rem",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Smarter Lending, <br />
            <span
              style={{
                background: "linear-gradient(135deg, #0d9488 0%, #2563eb 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Zero Guesswork.
            </span>
          </h1>

          <p
            style={{
              fontSize: "1rem",
              color: theme === "dark" ? "#94a3b8" : "#475569",
              lineHeight: 1.6,
              maxWidth: "460px",
              margin: 0,
            }}
          >
            Sign in to access real-time multi-bank policy evaluations, instant EMI amortization calculators, employer categorization, and full administrator controls.
          </p>

          {/* Feature Pillars */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background:
                    theme === "dark"
                      ? "rgba(37, 99, 235, 0.15)"
                      : "rgba(37, 99, 235, 0.1)",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bot size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                  Conversational RAG Engine
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: theme === "dark" ? "#94a3b8" : "#64748b",
                  }}
                >
                  Query 24+ master bank policy files instantly with exact citations.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background:
                    theme === "dark"
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(16, 185, 129, 0.1)",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building2 size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                  339,000+ Employer Database
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: theme === "dark" ? "#94a3b8" : "#64748b",
                  }}
                >
                  Instant company CAT A/B/Govt tier matching with underwriting multipliers.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Glassmorphic Auth Card */}
        <div
          style={{
            flex: "0 1 440px",
            width: "100%",
            maxWidth: "440px",
            background:
              theme === "dark"
                ? "rgba(17, 27, 46, 0.88)"
                : "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border:
              theme === "dark"
                ? "1px solid rgba(255, 255, 255, 0.08)"
                : "1px solid rgba(226, 232, 240, 0.9)",
            borderRadius: "20px",
            padding: "2.25rem 2rem",
            boxShadow:
              theme === "dark"
                ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 25px rgba(37, 99, 235, 0.1)"
                : "0 25px 50px -12px rgba(15, 23, 42, 0.08), 0 0 25px rgba(13, 148, 136, 0.06)",
          }}
        >
          {/* Card Header & Switcher */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                background:
                  theme === "dark"
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(15, 23, 42, 0.05)",
                padding: "4px",
                borderRadius: "12px",
                marginBottom: "1.25rem",
              }}
            >
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  border: "none",
                  background:
                    theme === "dark" ? "rgba(255, 255, 255, 0.12)" : "#ffffff",
                  color: theme === "dark" ? "#ffffff" : "#0f172a",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                  cursor: "pointer",
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => router.push("/register")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  border: "none",
                  background: "transparent",
                  color: theme === "dark" ? "#94a3b8" : "#64748b",
                  cursor: "pointer",
                }}
              >
                Create Account
              </button>
            </div>

            <h2
              style={{
                fontSize: "1.375rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                margin: "0 0 4px",
              }}
            >
              Welcome Back
            </h2>
            <p
              style={{
                fontSize: "0.84rem",
                color: theme === "dark" ? "#94a3b8" : "#64748b",
                margin: 0,
              }}
            >
              Sign in to manage loans, calculate EMIs, or review policies
            </p>
          </div>

          {/* 1-Click Fast Demo Logins */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: theme === "dark" ? "#94a3b8" : "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Zap size={13} style={{ color: "#d97706" }} />
              <span>Instant 1-Click Test Access</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handle1ClickDemo("admin@gmail.com", "12345")}
                disabled={loading}
                style={{
                  padding: "8px 10px",
                  borderRadius: "10px",
                  border:
                    theme === "dark"
                      ? "1px solid rgba(13, 148, 136, 0.3)"
                      : "1px solid rgba(13, 148, 136, 0.4)",
                  background:
                    theme === "dark"
                      ? "rgba(13, 148, 136, 0.1)"
                      : "rgba(13, 148, 136, 0.06)",
                  color: "#0d9488",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>👑 Admin Access</span>
              </button>

              <button
                type="button"
                onClick={() => handle1ClickDemo("user@gmail.com", "12345")}
                disabled={loading}
                style={{
                  padding: "8px 10px",
                  borderRadius: "10px",
                  border:
                    theme === "dark"
                      ? "1px solid rgba(37, 99, 235, 0.3)"
                      : "1px solid rgba(37, 99, 235, 0.4)",
                  background:
                    theme === "dark"
                      ? "rgba(37, 99, 235, 0.1)"
                      : "rgba(37, 99, 235, 0.06)",
                  color: "#2563eb",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>💼 DSA Agent</span>
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              margin: "16px 0",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                background:
                  theme === "dark"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(226, 232, 240, 0.9)",
              }}
            />
            <span
              style={{
                fontSize: "0.75rem",
                color: theme === "dark" ? "#64748b" : "#94a3b8",
                fontWeight: 600,
              }}
            >
              OR WITH EMAIL
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                background:
                  theme === "dark"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(226, 232, 240, 0.9)",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(220, 38, 38, 0.1)",
                border: "1px solid rgba(220, 38, 38, 0.25)",
                color: "#dc2626",
                fontSize: "0.8125rem",
                fontWeight: 500,
                marginBottom: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
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
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
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
                    transition: "border-color 0.15s ease",
                  }}
                />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <label
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: theme === "dark" ? "#cbd5e1" : "#334155",
                  }}
                >
                  Password
                </label>
              </div>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
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
                  placeholder="Enter your password"
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
                    transition: "border-color 0.15s ease",
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

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "10px",
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
                  <span
                    style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid #ffffff",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Platform</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div
            style={{
              marginTop: "1.5rem",
              textAlign: "center",
              fontSize: "0.8125rem",
              color: theme === "dark" ? "#94a3b8" : "#64748b",
            }}
          >
            Don't have an account yet?{" "}
            <a
              href="/register"
              style={{
                color: "#2563eb",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Create Account
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
