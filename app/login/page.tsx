/**
 * Login page — CallNow CRM Design System
 * Email/password authentication form with JWT auth.
 */

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      })
      const data = await res.json()
      if (data.success) {
        router.push("/home")
      } else {
        setError(data.error || "Login failed")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <i className="bi bi-wallet2" />
          </span>
          <span className="brand-text">CreditWise AI</span>
        </div>

        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Enter your credentials to access your financial intelligence workspace</p>

        {error && (
          <div className="alert alert-danger" role="alert">
            <i className="bi bi-exclamation-triangle" style={{ marginRight: "0.375rem" }} />
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-inline" />
                Signing in...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right" />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="login-demo">
          <strong>Demo credentials:</strong> admin@gmail.com / 12345
        </div>

        <div className="auth-footer">
          Don&apos;t have an account? <a href="/register">Create one</a>
        </div>
      </div>
    </main>
  )
}
