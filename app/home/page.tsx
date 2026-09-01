"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"

const AVAILABLE_MODELS = [
  { id: "liquid/lfm-2.5-embedding-350m:free", name: "LFM 2.5", desc: "Fast & efficient", icon: "⚡" },
  { id: "gpt-4o", name: "GPT-4o", desc: "Most capable", icon: "🧠" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5", desc: "Balanced", icon: "🎯" },
  { id: "gemini-pro", name: "Gemini Pro", desc: "Google AI", icon: "💎" },
]

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [messageActions, setMessageActions] = useState<Record<string, { liked: boolean; disliked: boolean }>>({})
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [messagesRef, setMessagesRef] = useState<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const modelSelectorRef = useRef<HTMLDivElement | null>(null)
  const initializedRef = useRef(false)

  const STORAGE_KEY = "emi_chat_state_v2"

  const adjustTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 200) + "px"
  }

  useEffect(() => {
    adjustTextarea()
  }, [input])

  useEffect(() => {
    checkAuth()
    loadState()
    loadConversations()
    initializedRef.current = true
  }, [])

  useEffect(() => {
    if (!initializedRef.current) return
    if (!user) return
    saveState()
  }, [messages, conversations, activeConversationId, selectedModel, messageActions, user])

  useEffect(() => {
    if (messagesRef) {
      messagesRef.scrollTop = messagesRef.scrollHeight
      enhanceCodeBlocks(messagesRef)
    }
  }, [messages, messagesRef])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false)
      }
      if (contextMenu && !(e.target as HTMLElement).closest(".conversation-context-menu")) {
        setContextMenu(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [contextMenu])

  async function checkAuth() {
    const res = await fetch("/api/auth/verify", { credentials: "include" })
    if (!res.ok) {
      router.replace("/login")
    } else {
      const data = await res.json()
      if (data.success) setUser(data.user)
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      setMessages(Array.isArray(parsed.messages) ? parsed.messages : [])
      setConversations(Array.isArray(parsed.conversations) ? parsed.conversations : [])
      setActiveConversationId(parsed.activeConversationId || null)
      if (parsed.selectedModel) setSelectedModel(parsed.selectedModel)
      if (parsed.messageActions) setMessageActions(parsed.messageActions)
    } catch (e) {
      console.error("Failed to load chat state", e)
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages,
          conversations,
          activeConversationId,
          selectedModel,
          messageActions,
        })
      )
    } catch (e) {
      console.error("Failed to save chat state", e)
    }
  }

  async function loadConversations() {
    try {
      const res = await fetch("/api/conversations", { credentials: "include" })
      const data = await res.json()
      const hasLocal = Boolean(localStorage.getItem(STORAGE_KEY))
      if (data.conversations && data.conversations.length > 0 && !hasLocal) {
        setConversations(data.conversations)
      }
    } catch (e) {
      console.error("Failed to load conversations", e)
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    let resolvedText = text.trim()

    const lastAiMessage = [...messages].reverse().find((m) => m.role === "ai")
    if (lastAiMessage) {
      const lastAiData = lastAiMessage.company_data
      if (lastAiData && lastAiData.needs_disambiguation && Array.isArray(lastAiData.candidates)) {
        const candidates = lastAiData.candidates.filter(Boolean)
        const userInput = text.trim()
        if (/^\d+$/.test(userInput)) {
          const index = parseInt(userInput, 10) - 1
          if (index >= 0 && index < candidates.length) {
            resolvedText = candidates[index]
          }
        } else {
          const partialMatch = candidates.find((c) => c.toLowerCase().includes(userInput.toLowerCase()))
          if (partialMatch) {
            resolvedText = partialMatch
          }
        }
      }
    }

    const userMessage = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      role: "user" as const,
      content: resolvedText,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: resolvedText, conversation_id: activeConversationId, model: selectedModel }),
        credentials: "include",
      })
      const data = await res.json()
      if (data.success) {
        if (data.title && !activeConversationId) {
          const conversation = {
            id: data.conversation_id || Date.now().toString(36),
            title: data.title,
            pinned: false,
            createdAt: new Date().toISOString(),
          }
          setConversations((prev) => [conversation, ...prev])
          setActiveConversationId(conversation.id)
          fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(conversation),
            credentials: "include",
          }).catch(() => {})
        }
        if (data.ai_message) {
          setMessages((prev) => [...prev, data.ai_message])
        }
      } else {
        throw new Error(data.error || "Failed to send message")
      }
    } catch (error) {
      console.error("Send message error:", error)
      const errorMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: "ai" as const,
        content: "Error: " + (error instanceof Error ? error.message : "Please try again."),
        retry_content: resolvedText,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  async function newConversation() {
    setMessages([])
    setActiveConversationId(null)
  }

  async function deleteConversation(id: string) {
    if (!confirm("Clear this conversation?")) return
    await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" })
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeConversationId === id) {
      setMessages([])
      setActiveConversationId(null)
    }
    setContextMenu(null)
  }

  async function togglePinConversation(id: string, pinned: boolean) {
    await fetch(`/api/conversations/${encodeURIComponent(id)}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
      credentials: "include",
    })
    setConversations((prev) =>
      (prev.map((c) => (c.id === id ? { ...c, pinned } : c)))
    )
    setContextMenu(null)
  }

  async function renameConversation(id: string, newTitle: string) {
    await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
      credentials: "include",
    })
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)))
    setContextMenu(null)
  }

  function filteredConversations() {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter((c) => c.title.toLowerCase().includes(q))
  }

  function formatTime(value: string) {
    if (!value) return ""
    const date = new Date(value)
    if (isNaN(date.getTime())) return ""
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  function formatDate(value: string) {
    if (!value) return ""
    const date = new Date(value)
    if (isNaN(date.getTime())) return ""
    const now = new Date()
    const diff = now - date
    if (diff < 86400000) return "Today"
    if (diff < 172800000) return "Yesterday"
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  function escapeHtml(value: string) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
  }

  function isErrorMessage(message: any) {
    return message.role === "ai" && String(message.content || "").startsWith("Error:")
  }

  function retryMessage(content: string) {
    sendMessage(content)
  }

  function toggleLike(messageId: string) {
    setMessageActions((prev) => {
      const current = prev[messageId] || { liked: false, disliked: false }
      return { ...prev, [messageId]: { liked: !current.liked, disliked: false } }
    })
  }

  function toggleDislike(messageId: string) {
    setMessageActions((prev) => {
      const current = prev[messageId] || { liked: false, disliked: false }
      return { ...prev, [messageId]: { liked: false, disliked: !current.disliked } }
    })
  }

  function getSelectedModelName() {
    const model = AVAILABLE_MODELS.find((m) => m.id === selectedModel)
    return model ? model.name : "Model"
  }

  function renderMarkdown(source: string) {
    if (typeof marked !== "undefined" && marked.parse) {
      try {
        const html = marked.parse(source || "", { gfm: true, breaks: false })
        return html
      } catch (e) {
        console.error("Markdown parse error", e)
      }
    }
    return escapeHtml(source || "").replace(/\n/g, "<br>")
  }

  function enhanceCodeBlocks(container: HTMLElement) {
    const blocks = container.querySelectorAll("pre code")
    blocks.forEach((codeEl) => {
      const pre = codeEl.parentElement
      if (!pre || pre.tagName !== "PRE") return
      if (pre.closest(".chat-code-block")) return

      const wrapper = document.createElement("div")
      wrapper.className = "chat-code-block"

      const header = document.createElement("div")
      header.className = "chat-code-header"

      const langLabel = document.createElement("span")
      langLabel.className = "chat-code-lang"
      const langClass = Array.from(codeEl.classList).find((c) => c.startsWith("language-"))
      langLabel.textContent = langClass ? langClass.replace("language-", "") : "CODE"

      const copyBtn = document.createElement("button")
      copyBtn.className = "chat-code-copy"
      copyBtn.textContent = "Copy"
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(codeEl.textContent || "")
          copyBtn.textContent = "Copied!"
          copyBtn.classList.add("copied")
          setTimeout(() => {
            copyBtn.textContent = "Copy"
            copyBtn.classList.remove("copied")
          }, 2000)
        } catch (e) {
          copyBtn.textContent = "Failed"
          setTimeout(() => {
            copyBtn.textContent = "Copy"
          }, 2000)
        }
      })

      header.appendChild(langLabel)
      header.appendChild(copyBtn)

      pre.parentNode?.insertBefore(wrapper, pre)
      wrapper.appendChild(header)
      wrapper.appendChild(pre)

      if (typeof hljs !== "undefined") {
        try {
          hljs.highlightElement(codeEl)
        } catch (e) {
          // ignore
        }
      }
    })
  }

  function renderBankManagerCard(data: any) {
    if (!data || !Array.isArray(data.managers) || data.managers.length === 0) {
      return `<div class="no-results">No matching bank manager record was found in our database. Please check the bank name or location and try again.</div>`
    }

    const managers = data.managers
    let html = `<div class="result-card">`
    html += `<div class="result-card-header">🏦 ${escapeHtml(String(data.count))} Manager${data.count === 1 ? "" : "s"} Found</div>`
    html += `<div class="result-card-body">`
    html += `<div class="manager-grid">`
    managers.forEach((m: any) => {
      const name = escapeHtml(m.manager_name || m.name || "Unknown")
      const bank = escapeHtml(m.bank_name || "-")
      const designation = escapeHtml(m.designation || m.role || m.branch_name || "-")
      const phone = escapeHtml(m.mobile_no || m.phone || "-")
      const email = escapeHtml(m.email_id || m.email || "-")
      const location = escapeHtml(m.location_city || m.location || "-")
      const state = escapeHtml(m.state || "-")
      const isActive = m.status && String(m.status).toLowerCase() === "active"

      html += `<div class="manager-card">
        <div class="manager-card-header">
          <div class="manager-avatar">${name.charAt(0)}</div>
          <div class="manager-info">
            <div class="manager-name">${name}</div>
            <div class="manager-bank">${bank}</div>
          </div>
          ${isActive ? '<span class="result-badge">Active</span>' : ""}
        </div>
        <div class="manager-details">
          ${designation !== "-" ? `<div class="manager-detail"><span class="detail-icon">💼</span>${designation}</div>` : ""}
          ${phone !== "-" ? `<div class="manager-detail"><span class="detail-icon">📱</span>${phone}</div>` : ""}
          ${email !== "-" ? `<div class="manager-detail"><span class="detail-icon">✉️</span>${email}</div>` : ""}
          ${location !== "-" ? `<div class="manager-detail"><span class="detail-icon">📍</span>${location}${state !== "-" ? ", " + state : ""}</div>` : ""}
        </div>
      </div>`
    })
    html += `</div></div></div>`
    return html
  }

   function renderMessageContent(message: any) {
    const isUser = message.role === "user"
    if (isUser) {
      return escapeHtml(message.content)
    }

    let html = renderMarkdown(message.content)

    const companyData = message.company_data
    if (companyData && companyData.needs_disambiguation && Array.isArray(companyData.candidates)) {
      const candidates = companyData.candidates.filter(Boolean)
      if (candidates.length > 0) {
        html += `<div class="disambiguation-candidates">`
        candidates.forEach((candidate: string, index: number) => {
          const escapedCandidate = escapeHtml(candidate)
          html += `<button class="disambiguation-candidate" data-candidate="${escapedCandidate}">${escapedCandidate}</button>`
        })
        html += `</div>`
      }
    }

    if (companyData && !companyData.needs_disambiguation) {
      html += renderCompanyTables(companyData)
    }

    const bankData = message.bank_data
    if (bankData) {
      html += renderBankManagerCard(bankData)
    }

    return html
  }

  function renderCompanyTables(companyData: any) {
    const basic = companyData.basic_info && typeof companyData.basic_info === "object" ? companyData.basic_info : {}
    const financial = companyData.financial_info && typeof companyData.financial_info === "object" ? companyData.financial_info : {}
    const bankRecords = Array.isArray(companyData.bank_records) ? companyData.bank_records : []

    let html = `<div class="company-tables">`

    html += `<div class="company-table-section">`
    html += `<div class="company-table-title">Basic Information</div>`
    html += `<table class="company-table"><tbody>`
    html += renderTableRow("Company Name", companyData.company_name || "-")
    html += renderTableRow("Industry", basic.industry || "-")
    html += renderTableRow("Country", basic.country || "-")
    html += renderTableRow("Incorporation Date", basic.incorporation_date || "-")
    html += renderTableRow("Listing Status", basic.listing_status || "-")
    html += renderTableRow("CIN", basic.cin || "-")
    html += renderTableRow("Address", basic.address || "-")
    html += renderTableRow("Website", basic.website || "-")
    html += `</tbody></table></div>`

    html += `<div class="company-table-section">`
    html += `<div class="company-table-title">Financial Information</div>`
    html += `<table class="company-table"><tbody>`
    html += renderTableRow("Employees", financial.employees || "-")
    html += renderTableRow("Turnover", financial.turnover || "-")
    html += renderTableRow("Profit Status", financial.profit_status || "-")
    html += renderTableRow("Last AGM", financial.last_agm || "-")
    html += renderTableRow("Profit History", financial.profit_history || "-")
    html += `</tbody></table></div>`

    if (bankRecords.length > 0) {
      const seen = new Set<string>()
      const uniqueRecords = bankRecords.filter((r: any) => {
        const key = String(r?.bank_name || "").trim().toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })

      html += `<div class="company-table-section">`
      html += `<div class="company-table-title">Bank Records</div>`
      html += `<div class="company-table-wrapper"><table class="company-table company-table-bank">`
      html += `<thead><tr><th>Bank Name</th><th>Sr No</th><th>Category</th><th>Other Info</th></tr></thead><tbody>`
      uniqueRecords.forEach((r: any, idx: number) => {
        const bgClass = idx % 2 === 0 ? "even" : "odd"
        html += `<tr class="${bgClass}">`
        html += `<td>${escapeHtml(r.bank_name || "-")}</td>`
        html += `<td>${escapeHtml(r.sr_no || "-")}</td>`
        html += `<td>${escapeHtml(r.company_category || "-")}</td>`
        html += `<td>${escapeHtml(r.other_info || "-")}</td>`
        html += `</tr>`
      })
      html += `</tbody></table></div></div>`
    }

    html += `</div>`
    return html
  }

  function renderTableRow(label: string, value: string) {
    const escapedValue = escapeHtml(value)
    return `<tr><td class="company-table-label">${escapeHtml(label)}</td><td class="company-table-value">${escapedValue}</td></tr>`
  }

  function renderMessageActions(message: any) {
    if (message.role !== "ai") return null
    const actions = messageActions[message.id] || { liked: false, disliked: false }
    return (
      <div className="message-actions">
        <button
          className={`message-action-btn ${actions.liked ? "active-like" : ""}`}
          onClick={() => toggleLike(message.id)}
          title="Good response"
        >
          👍
        </button>
        <button
          className={`message-action-btn ${actions.disliked ? "active-dislike" : ""}`}
          onClick={() => toggleDislike(message.id)}
          title="Bad response"
        >
          👎
        </button>
        {isErrorMessage(message) && (
          <button
            className="message-action-btn"
            onClick={() => retryMessage(message.retry_content || message.content.replace(/^Error:\s*/, ""))}
            title="Retry"
          >
            🔄 Retry
          </button>
        )}
      </div>
    )
  }

  if (!user) return <main style={{ padding: 24 }}>Loading...</main>

  return (
    <main className="home-body">
      <header className="topbar app-topbar">
        <button className="chat-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <a className="brand" href="/home">
          <span className="brand-mark">◆</span>
          <span className="brand-text">AI ASSISTANT</span>
        </a>
        <div className="model-selector-wrapper" ref={modelSelectorRef}>
          <button
            className="model-selector"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
          >
            <span className="model-selector-icon">◆</span>
            {getSelectedModelName()}
            <span className="model-selector-caret">▾</span>
          </button>
          <div className={`model-dropdown ${modelDropdownOpen ? "open" : ""}`}>
            {AVAILABLE_MODELS.map((model) => (
              <button
                key={model.id}
                className={`model-dropdown-item ${selectedModel === model.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedModel(model.id)
                  setModelDropdownOpen(false)
                }}
              >
                <span className="model-dropdown-item-icon">{model.icon}</span>
                <div className="model-dropdown-item-info">
                  <div className="model-dropdown-item-name">{model.name}</div>
                  <div className="model-dropdown-item-desc">{model.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <nav className="nav-menu" aria-label="Main navigation">
          <a href="/home" className="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </a>
          <a href="/emi" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
            EMI Calculator
          </a>
          <a href="/admin" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Admin
          </a>
          <a href="/bank-managers" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a2 2 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Bank Manager
          </a>
          <div className="nav-item profile-menu" role="link" tabIndex={0} onClick={() => router.push("/profile")}>
            <span className="profile-menu-label">{user.name || user.email}</span>
            <span className="caret">▾</span>
            <div className="profile-dropdown">
              <a href="/profile">Profile</a>
              <a href="/logout">Logout</a>
            </div>
          </div>
        </nav>
      </header>

      <div className="chat-layout">
        <div
          className={`chat-sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`chat-sidebar ${sidebarOpen ? "open" : ""}`} id="chatSidebar">
          <div className="chat-sidebar-header">
            <button className="chat-new-chat-btn" id="chatNewConversation" onClick={newConversation}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              New Chat
            </button>
          </div>
          <div className="chat-search-box">
            <input
              type="text"
              className="chat-search-input"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="chat-list" id="chatConversationList">
            {filteredConversations().length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--chat-text-muted)", fontSize: "13px" }}>
                No conversations yet
              </div>
            ) : (
              filteredConversations().map((conversation) => (
                <div
                  key={conversation.id}
                  className={`chat-conversation-item ${conversation.id === activeConversationId ? "active" : ""}`}
                  onClick={() => {
                    setActiveConversationId(conversation.id)
                    setSidebarOpen(false)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ id: conversation.id, x: e.clientX, y: e.clientY })
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="chat-conversation-title">
                      {conversation.pinned ? "📌 " : ""}
                      {conversation.title}
                    </div>
                    <div className="chat-conversation-meta">{formatDate(conversation.createdAt)}</div>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePinConversation(conversation.id, !conversation.pinned)
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px" }}
                    >
                      {conversation.pinned ? "📌" : "📍"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteConversation(conversation.id)
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#ef4444" }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="chat-sidebar-footer">
            <button
              id="clearHistoryBtn"
              onClick={() => {
                if (confirm("Clear all chat history?")) {
                  setMessages([])
                  setConversations([])
                  setActiveConversationId(null)
                  localStorage.removeItem(STORAGE_KEY)
                }
              }}
            >
              Clear History
            </button>
          </div>
        </aside>

        <main className="chat-main">
          <div
            className="chat-messages"
            id="chatMessages"
            onClick={(e) => {
              const target = e.target as HTMLElement | null
              if (!target) return
              const candidateBtn = target.closest(".disambiguation-candidate")
              if (!candidateBtn) return
              const candidate = candidateBtn.getAttribute("data-candidate")
              if (candidate) {
                sendMessage(candidate)
              }
            }}
          >
            <div id="chatMessagesInner">
              {messages.length === 0 ? (
                <div className="chat-welcome" id="chatWelcomeMessage">
                  <div className="chat-welcome-icon">💬</div>
                  <h2>Hello! How can I help you today?</h2>
                  <p>Ask me anything about loans, EMI calculations, bank managers, or your account.</p>
                  <div className="chat-welcome-grid">
                    <button className="chat-welcome-card" onClick={() => sendMessage("Calculate EMI for a home loan of 500000 at 9.5% for 60 months")}>
                      <div className="chat-welcome-card-icon">🧮</div>
                      <div className="chat-welcome-card-title">Calculate EMI</div>
                      <div className="chat-welcome-card-desc">Get instant EMI calculations for home, personal, or car loans.</div>
                    </button>
                    <button className="chat-welcome-card" onClick={() => sendMessage("Tell me about loan processing fees")}>
                      <div className="chat-welcome-card-icon">💰</div>
                      <div className="chat-welcome-card-title">Processing Fees</div>
                      <div className="chat-welcome-card-desc">Learn about loan processing fees and charges.</div>
                    </button>
                    <button className="chat-welcome-card" onClick={() => sendMessage("How can I update my profile?")}>
                      <div className="chat-welcome-card-icon">👤</div>
                      <div className="chat-welcome-card-title">Profile Help</div>
                      <div className="chat-welcome-card-desc">Get assistance with profile settings and account management.</div>
                    </button>
                    <button className="chat-welcome-card" onClick={() => sendMessage("Give me ICICI manager details in Pune")}>
                      <div className="chat-welcome-card-icon">🏦</div>
                      <div className="chat-welcome-card-title">Bank Managers</div>
                      <div className="chat-welcome-card-desc">Find bank manager contact details by location.</div>
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "user"
                  return (
                    <div key={message.id} className={`chat-message ${message.role}`} data-message-id={message.id}>
                      <div className="chat-avatar">{isUser ? "U" : "AI"}</div>
                      <div>
                        <div
                          className="chat-bubble"
                          dangerouslySetInnerHTML={{ __html: renderMessageContent(message) }}
                        />
                        <div className="message-meta">
                          <span>{formatTime(message.timestamp)}</span>
                          {!isUser && (
                            <>
                              <button
                                className="message-copy-btn"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(message.content || "")
                                  } catch (e) {
                                    // ignore
                                  }
                                }}
                              >
                                Copy
                              </button>
                              {renderMessageActions(message)}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              {loading && (
                <div className="chat-message ai" id="aiTypingIndicator">
                  <div className="chat-avatar">AI</div>
                  <div className="chat-bubble typing-bubble">
                    <div className="chat-typing-indicator">
                      <div className="chat-typing-dot"></div>
                      <div className="chat-typing-dot"></div>
                      <div className="chat-typing-dot"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={(el) => setMessagesRef(el)} />
            </div>
          </div>

          <div className="chat-composer">
            <form className="chat-composer-form" onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} autoComplete="off">
              <button type="button" className="chat-attachment-btn" title="Attach file" onClick={() => {}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>
              <div className="chat-input-wrap">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  placeholder="Message AI ASSISTANT..."
                  rows={1}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); adjustTextarea() }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage(input)
                    }
                  }}
                />
              </div>
              <button className="chat-send-btn" type="submit" title="Send message" disabled={loading || !input.trim()}>
                {loading ? (
                  <div className="chat-typing-indicator">
                    <div className="chat-typing-dot"></div>
                    <div className="chat-typing-dot"></div>
                    <div className="chat-typing-dot"></div>
                  </div>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                )}
              </button>
            </form>
            <div className="chat-disclaimer">AI can make mistakes. Please verify important information.</div>
          </div>
        </main>
      </div>

      {/* Conversation context menu */}
      {contextMenu && (
        <div
          className="conversation-context-menu visible"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="conversation-context-item"
            onClick={() => {
              const conv = conversations.find((c) => c.id === contextMenu.id)
              if (conv) {
                const newTitle = prompt("Rename conversation:", conv.title)
                if (newTitle && newTitle.trim()) {
                  renameConversation(contextMenu.id, newTitle.trim())
                }
              }
            }}
          >
            ✏️ Rename
          </button>
          <button
            className="conversation-context-item"
            onClick={() => togglePinConversation(contextMenu.id, !conversations.find((c) => c.id === contextMenu.id)?.pinned)}
          >
            📌 {conversations.find((c) => c.id === contextMenu.id)?.pinned ? "Unpin" : "Pin"}
          </button>
          <div className="conversation-context-divider" />
          <button
            className="conversation-context-item danger"
            onClick={() => deleteConversation(contextMenu.id)}
          >
            🗑 Delete
          </button>
        </div>
      )}
    </main>
  )
}
