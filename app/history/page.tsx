/**
 * History page.
 *
 * Dedicated, full-screen conversation history view. Clicking "History" in the
 * chat sidebar navigates here instead of reloading the AI assistant home/chat
 * screen.
 *
 * Loads ALL previous chat conversations for the currently logged-in user from
 * the database (assistant_conversations + assistant_messages), newest first,
 * and renders each one with its title, latest message preview and date/time.
 *
 * Clicking any conversation item opens that exact conversation and restores its
 * complete message history in the chat UI (no duplicate conversations are
 * created).
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Topbar from "../../components/Topbar"

export default function HistoryPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [selectedModel, setSelectedModel] = useState("liquid/lfm-2.5-embedding-350m:free")

  useEffect(() => {
    async function init() {
      const res = await fetch("/api/auth/verify", { credentials: "include" })
      if (!res.ok) {
        router.replace("/login")
        return
      }
      const data = await res.json()
      if (data.success) {
        setUser(data.user)
        await loadConversations()
      }
      setLoading(false)
    }
    init()
  }, [router])

  async function loadConversations() {
    try {
      const res = await fetch("/api/conversations", { credentials: "include" })
      const data = await res.json()
      if (data.success && Array.isArray(data.conversations)) {
        setConversations(data.conversations)
      }
    } catch (e) {
      console.error("Failed to load conversations", e)
    }
  }

  function formatDate(value: string) {
    if (!value) return ""
    const date = new Date(value)
    if (isNaN(date.getTime())) return ""
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 86400000) return "Today"
    if (diff < 172800000) return "Yesterday"
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
  }

  function formatTime(value: string) {
    if (!value) return ""
    const date = new Date(value)
    if (isNaN(date.getTime())) return ""
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  function truncate(text: string, max: number) {
    if (!text) return ""
    const t = text.replace(/\s+/g, " ").trim()
    return t.length > max ? t.slice(0, max - 1) + "…" : t
  }

  function openConversation(conv: any) {
    router.push(`/home?conversation=${encodeURIComponent(conv.id)}`)
  }

  return (
    <main className={`home-body ${theme === "dark" ? "dark" : ""}`}>
      <Topbar
        user={user}
        pathname="/history"
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      />

      <div className="history-page">
        <div className="history-header">
          <div>
            <h1 className="history-title">Chat History</h1>
            <p className="history-subtitle">
              {loading ? "Loading your conversations..." : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="history-empty">
            <div className="history-empty-icon">⏳</div>
            <p>Loading your conversation history...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">💬</div>
            <h3>No conversations yet</h3>
            <p>Start a new conversation to see it here.</p>
            <button className="history-empty-btn" onClick={() => router.push("/home")}>
              Go to AI Assistant
            </button>
          </div>
        ) : (
          <div className="history-list">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="history-card"
                onClick={() => openConversation(conv)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    openConversation(conv)
                  }
                }}
              >
                <div className="history-card-main">
                  <div className="history-card-title-row">
                    <h3 className="history-card-title">
                      {conv.pinned ? "📌 " : ""}
                      {conv.title || "New Conversation"}
                    </h3>
                    <span className="history-card-time">
                      {formatDate(conv.updatedAt || conv.createdAt)}
                    </span>
                  </div>
                  {conv.preview ? (
                    <div className="history-card-preview">{truncate(conv.preview, 120)}</div>
                  ) : null}
                  <div className="history-card-meta">
                    <span>{formatTime(conv.updatedAt || conv.createdAt)}</span>
                    {typeof conv.messageCount === "number" ? (
                      <>
                        <span>·</span>
                        <span>{conv.messageCount} message{conv.messageCount === 1 ? "" : "s"}</span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span className="history-card-id">ID: {conv.id}</span>
                  </div>
                </div>
                <div className="history-card-actions">
                  <button
                    type="button"
                    className="history-card-open"
                    onClick={(e) => {
                      e.stopPropagation()
                      openConversation(conv)
                    }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="history-card-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete conversation "${conv.title || "New Conversation"}"?`)) {
                        fetch(`/api/conversations/${encodeURIComponent(conv.id)}`, {
                          method: "DELETE",
                          credentials: "include",
                        }).then(() => loadConversations())
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}