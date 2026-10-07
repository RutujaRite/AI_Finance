"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import PoliciesView from "@/components/PoliciesView"

export default function PoliciesPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/verify", { credentials: "include" })
        if (!res.ok) {
          router.replace("/login")
          return
        }
        const data = await res.json()
        if (data.success) {
          const isAdmin =
            String(data.user?.role || "").trim().toLowerCase() === "admin" ||
            data.user?.is_admin === true ||
            String(data.user?.email || "").toLowerCase() === "admin@gmail.com" ||
            String(data.user?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
            String(data.user?.email || "").toLowerCase().startsWith("admin")

          if (!isAdmin) {
            router.replace("/home?section=assistant")
            return
          }
          setUser(data.user)
          setAuthorized(true)
        } else {
          router.replace("/login")
        }
      } catch (e) {
        router.replace("/login")
      }
    }
    checkAuth()
  }, [router])

  if (!authorized) {
    return null
  }

  return <PoliciesView embedded={false} user={user} />
}

