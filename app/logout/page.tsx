"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" })
      .finally(() => {
        try {
          localStorage.removeItem("emi_chat_state_v2")
        } catch (e) {}
        router.replace("/login")
      })
  }, [router])

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--ink-soft)" }}>
      Logging out...
    </div>
  )
}
