/**
 * Login page — email/password form with JWT auth.
 * Uses: /api/auth/login, /api/auth/verify
 */

"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const check = async () => {
      const res = await fetch("/api/auth/verify", { method: "GET", credentials: "include" })
      if (res.ok) router.replace("/home")
    }
    check()
  }, [router])

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
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-logo">◆</div>

        <div className="login-header">
          <h1>Welcome back</h1>
          <p>Sign in to access your account and continue your journey</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="login-demo">
          <strong>Demo:</strong> admin@gmail.com / 12345
        </div>

        <div className="login-footer">
          Don&apos;t have an account? <a href="/register">Create one</a>
        </div>
      </div>
    </main>
  )
}
