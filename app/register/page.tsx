/**
 * Register page — CallNow CRM Design System
 * New user registration form.
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const check = async () => {
      const res = await fetch("/api/auth/verify", { credentials: "include" })
      if (res.ok) router.replace("/home")
    }
    check()
  }, [router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    if (password !== confirm) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
        credentials: "include",
      })
      const data = await res.json()
      if (data.success) {
        router.push("/home")
      } else {
        setError(data.error || "Registration failed")
      }
    } catch (e) {
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

        <h1 className="login-title">Create Account</h1>
        <p className="login-subtitle">Join CreditWise AI to manage loans, bank policies, and financial intelligence</p>

        {error && (
          <div className="alert alert-danger" role="alert">
            <i className="bi bi-exclamation-triangle" style={{ marginRight: "0.375rem" }} />
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              className="form-control"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

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
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              type="password"
              className="form-control"
              placeholder="Confirm your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
                Creating Account...
              </>
            ) : (
              <>
                <i className="bi bi-person-plus" />
                Create Account
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <a href="/login">Sign in</a>
        </div>
      </div>
    </main>
  )
}
