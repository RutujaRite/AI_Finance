/**
 * Root page — redirects authenticated users to /home and others to /login.
 * Uses: lib/auth (verifyToken via /api/auth/verify)
 */

"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("token="))
      ?.split("=")[1]
    if (token) {
      router.replace("/home")
    } else {
      router.replace("/login")
    }
    setLoading(false)
  }, [router])

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>
  return null
}
