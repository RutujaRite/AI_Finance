"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, LogIn, ArrowRight, CheckCircle2, Lock } from "lucide-react"

export default function LogoutPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<"clearing" | "done">("clearing")
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    // Detect theme
    if (typeof window !== "undefined") {
      const activeTheme =
        (document.documentElement.getAttribute("data-theme") as "light" | "dark") ||
        (document.documentElement.getAttribute("data-bs-theme") as "light" | "dark") ||
        "light"
      setTheme(activeTheme)
    }

    // Perform secure logout
    const logoutPromise = fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch((err) => console.warn("Logout request:", err))

    // Clear local storage items safely
    try {
      localStorage.removeItem("emi_chat_state_v2")
      localStorage.removeItem("finai_user")
      sessionStorage.clear()
    } catch (e) {
      console.warn("Storage clear notice:", e)
    }

    const timer = setTimeout(() => {
      setPhase("done")
    }, 400)

    const redirectTimer = setTimeout(() => {
      router.replace("/")
    }, 900)

    return () => {
      clearTimeout(timer)
      clearTimeout(redirectTimer)
    }
  }, [router])

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background:
          theme === "dark"
            ? "radial-gradient(circle at 50% 30%, #13233a 0%, #0b1220 70%, #070b14 100%)"
            : "radial-gradient(circle at 50% 30%, #f0fdfa 0%, #f8fafc 50%, #f1f5f9 100%)",
        fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
        color: theme === "dark" ? "#f8fafc" : "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: theme === "dark" ? "rgba(17, 27, 46, 0.85)" : "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(226, 232, 240, 0.8)",
          borderRadius: "20px",
          padding: "2.5rem 2rem",
          boxShadow:
            theme === "dark"
              ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(20, 184, 166, 0.1)"
              : "0 25px 50px -12px rgba(15, 23, 42, 0.08), 0 0 30px rgba(13, 148, 136, 0.08)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient Top Glow Line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #0d9488, #2563eb, #0f766e)",
          }}
        />

        {/* Central Animated Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background:
              phase === "done"
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(13, 148, 136, 0.25))"
                : "linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(15, 118, 110, 0.25))",
            border:
              phase === "done"
                ? "2px solid rgba(16, 185, 129, 0.4)"
                : "2px solid rgba(37, 99, 235, 0.3)",
            color: phase === "done" ? "#10b981" : "#2563eb",
            marginBottom: "1.5rem",
            boxShadow:
              phase === "done"
                ? "0 0 30px rgba(16, 185, 129, 0.25)"
                : "0 0 30px rgba(37, 99, 235, 0.2)",
            transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {phase === "clearing" ? (
            <Lock size={36} style={{ animation: "pulse 1.5s infinite" }} />
          ) : (
            <ShieldCheck size={40} />
          )}
        </div>

        {/* Heading & Subtitle */}
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: "0.5rem",
            color: theme === "dark" ? "#ffffff" : "#0f172a",
          }}
        >
          {phase === "clearing" ? "Signing Out Securely..." : "Signed Out Successfully"}
        </h1>

        <p
          style={{
            fontSize: "0.875rem",
            color: theme === "dark" ? "#94a3b8" : "#64748b",
            lineHeight: 1.6,
            marginBottom: "1.75rem",
          }}
        >
          {phase === "clearing"
            ? "Purging encrypted authentication tokens and clearing local session workspace..."
            : "Your session has been terminated safely. Financial data on this browser is secured."}
        </p>

        {/* Status Chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "9999px",
            background:
              phase === "done"
                ? theme === "dark"
                  ? "rgba(16, 185, 129, 0.12)"
                  : "rgba(16, 185, 129, 0.1)"
                : theme === "dark"
                ? "rgba(37, 99, 235, 0.12)"
                : "rgba(37, 99, 235, 0.08)",
            color: phase === "done" ? "#10b981" : "#2563eb",
            fontSize: "0.78rem",
            fontWeight: 600,
            marginBottom: "2rem",
          }}
        >
          {phase === "done" ? (
            <>
              <CheckCircle2 size={14} />
              <span>Session Cleared • Returning to Landing Page...</span>
            </>
          ) : (
            <>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#2563eb",
                  animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
                }}
              />
              <span>Closing SSL Session Connections</span>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.25rem",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0d9488 0%, #2563eb 100%)",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              boxShadow: "0 4px 14px rgba(13, 148, 136, 0.3)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <LogIn size={16} />
            <span>Go to Landing Page Now</span>
            <ArrowRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              padding: "0.65rem 1.25rem",
              borderRadius: "10px",
              background: "transparent",
              color: theme === "dark" ? "#cbd5e1" : "#475569",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
              border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                theme === "dark" ? "rgba(255, 255, 255, 0.05)" : "#f1f5f9"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
            }}
          >
            Return to Homepage
          </button>
        </div>
      </div>
    </div>
  )
}
