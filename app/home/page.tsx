"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Topbar, { DashboardSection } from "../../components/Topbar"
import EmiCalculator from "../../components/EmiCalculator"
import PoliciesView from "../../components/PoliciesView"

declare const marked: any
declare const hljs: any

const AVAILABLE_MODELS = [
  { id: "liquid/lfm-2.5-embedding-350m:free", name: "LFM 2.5", desc: "Fast & efficient", icon: "⚡" },
  { id: "gpt-4o", name: "GPT-4o", desc: "Most capable", icon: "🧠" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5", desc: "Balanced", icon: "🎯" },
]

export default function HomePage() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<DashboardSection>("home")
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
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
  const messagesByConvRef = useRef<Record<string, any[]>>({})
  const activeConvIdRef = useRef<string | null>(null)

  const STORAGE_KEY = "emi_chat_state_v2"

  const isAdmin =
    String(user?.role || "").trim().toLowerCase() === "admin" ||
    user?.is_admin === true ||
    String(user?.email || "").toLowerCase() === "admin@gmail.com" ||
    String(user?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
    String(user?.email || "").toLowerCase().startsWith("admin")

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

    if (typeof window !== "undefined") {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false)
      }
      const params = new URLSearchParams(window.location.search)
      const sec = params.get("section") as DashboardSection | null
      if (sec && ["home", "assistant", "emi", "policies"].includes(sec)) {
        setActiveSection(sec)
      }
    }
  }, [])

  useEffect(() => {
    function handlePopState() {
      if (typeof window === "undefined") return
      const params = new URLSearchParams(window.location.search)
      const sec = params.get("section") as DashboardSection | null
      if (sec && ["home", "assistant", "emi", "policies"].includes(sec)) {
        setActiveSection(sec)
      } else {
        setActiveSection("home")
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        setSidebarOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (activeSection === "assistant") {
        document.documentElement.classList.add("chat-page-active")
        document.body.classList.add("chat-page-active")
      } else {
        document.documentElement.classList.remove("chat-page-active")
        document.body.classList.remove("chat-page-active")
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("chat-page-active")
        document.body.classList.remove("chat-page-active")
      }
    }
  }, [activeSection])

  function handleSectionChange(section: DashboardSection) {
    setActiveSection(section)
    if (typeof window !== "undefined") {
      const url = section === "home" ? "/home" : `/home?section=${section}`
      window.history.pushState({ section }, "", url)
    }
  }

  function handleLaunchPrompt(promptText: string) {
    handleSectionChange("assistant")
    sendMessage(promptText)
  }

  useEffect(() => {
    if (!initializedRef.current) return
    if (!user) return
    saveState()
  }, [messages, conversations, activeConversationId, selectedModel, messageActions, user])

  useEffect(() => {
    if (!initializedRef.current) return
    if (!user) return
    const activeId = activeConvIdRef.current || activeConversationId
    if (activeId && messagesByConvRef.current[activeId] === undefined) {
      let cancelled = false
      loadConversationMessages(activeId).then((msgs) => {
        if (cancelled) return
        messagesByConvRef.current[activeId] = msgs
        setMessages(msgs)
      })
      return () => {
        cancelled = true
      }
    }
  }, [activeConversationId, user])

  useEffect(() => {
    if (messagesRef) {
      messagesRef.scrollTop = messagesRef.scrollHeight
      enhanceCodeBlocks(messagesRef)
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
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
      const seen = new Set<string>()
      const uniqueConvs = (Array.isArray(parsed.conversations) ? parsed.conversations : [])
        .filter((c: any) => {
          if (!c || !c.id) return false
          if (c.id === "default_session") return false
          if (seen.has(c.id)) return false
          seen.add(c.id)
          return true
        })
      const savedByConv = parsed.messagesByConv && typeof parsed.messagesByConv === "object"
        ? parsed.messagesByConv
        : {}
      for (const id of Object.keys(savedByConv)) {
        messagesByConvRef.current[id] = Array.isArray(savedByConv[id]) ? savedByConv[id] : []
      }
      setConversations(uniqueConvs)
      const activeId = parsed.activeConversationId || null
      setActiveConversationId(activeId)
      activeConvIdRef.current = activeId
      const activeMsgs = activeId && messagesByConvRef.current[activeId]
        ? messagesByConvRef.current[activeId]
        : (Array.isArray(parsed.messages) ? parsed.messages : [])
      setMessages(activeMsgs)
      if (parsed.selectedModel) setSelectedModel(parsed.selectedModel)
      if (parsed.messageActions) setMessageActions(parsed.messageActions)
    } catch (e) {
      console.error("Failed to load chat state", e)
    }
  }

  function saveState() {
    try {
      const activeId = activeConvIdRef.current || activeConversationId
      if (activeId && messagesByConvRef.current[activeId] === undefined) {
        messagesByConvRef.current[activeId] = messages
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages,
          messagesByConv: messagesByConvRef.current,
          conversations,
          activeConversationId: activeId,
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
      if (Array.isArray(data.conversations)) {
        setConversations((prev) => {
          const map = new Map<string, any>()
          for (const c of data.conversations) {
            if (c?.id) map.set(String(c.id), c)
          }
          for (const c of prev) {
            if (c?.id && !map.has(String(c.id))) {
              map.set(String(c.id), c)
            }
          }
          return Array.from(map.values())
        })
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
          const partialMatch = candidates.find((c: any) => c.toLowerCase().includes(userInput.toLowerCase()))
          if (partialMatch) {
            resolvedText = partialMatch
          }
        }
      }
    }

    const currentConvId = activeConvIdRef.current || activeConversationId
    if (currentConvId && messagesByConvRef.current[currentConvId] === undefined) {
      messagesByConvRef.current[currentConvId] = messages
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
        body: JSON.stringify({ message: resolvedText, conversation_id: currentConvId, model: selectedModel }),
        credentials: "include",
      })
      const data = await res.json()
      if (data.success) {
        const returnedConvId = data.conversation_id ? String(data.conversation_id) : null
        const effectiveConvId = returnedConvId || currentConvId

        if (returnedConvId && returnedConvId !== currentConvId) {
          activeConvIdRef.current = returnedConvId
          setActiveConversationId(returnedConvId)
        }

        const convTitle = data.title || "Loan Assistant"
        setConversations((prev) => {
          const targetId = effectiveConvId || "default"
          const idx = prev.findIndex((c) => String(c.id) === targetId)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], title: convTitle }
            return updated
          }
          return [
            {
              id: targetId,
              title: convTitle,
              pinned: false,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]
        })

        if (data.ai_message) {
          setMessages((prev) => [...prev, data.ai_message])
        }
        if (effectiveConvId) {
          messagesByConvRef.current[effectiveConvId] = [
            ...messages,
            userMessage,
            ...(data.ai_message ? [data.ai_message] : []),
          ]
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

  async function loadConversationMessages(conversationId: string) {
    if (!conversationId) return []
    const cached = messagesByConvRef.current[conversationId]
    if (cached) return cached
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
        credentials: "include",
      })
      const data = await res.json()
      const msgs = Array.isArray(data.messages) ? data.messages : []
      messagesByConvRef.current[conversationId] = msgs
      return msgs
    } catch (e) {
      console.error("Failed to load conversation messages", e)
      return []
    }
  }

  async function selectConversation(conversationId: string) {
    // Persist the currently active conversation's messages before switching.
    if (activeConvIdRef.current && messagesByConvRef.current[activeConvIdRef.current] === undefined) {
      messagesByConvRef.current[activeConvIdRef.current] = messages
    }
    const msgs = await loadConversationMessages(conversationId)
    messagesByConvRef.current[conversationId] = msgs
    activeConvIdRef.current = conversationId
    setMessages(msgs)
    setActiveConversationId(conversationId)
    setSidebarOpen(false)
  }

  async function newConversation() {
    if (activeConvIdRef.current && messagesByConvRef.current[activeConvIdRef.current] === undefined) {
      messagesByConvRef.current[activeConvIdRef.current] = messages
    }
    setMessages([])
    setActiveConversationId(null)
    activeConvIdRef.current = null
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
    const diff = now.getTime() - date.getTime()
    if (diff < 86400000) return "Today"
    if (diff < 172800000) return "Yesterday"
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  function getConversationSectionKey(value: string) {
    const date = new Date(value)
    if (isNaN(date.getTime())) return "Older"
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 86400000) return "Today"
    if (diff < 172800000) return "Yesterday"
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime()
    if (date.getTime() >= startOfYear) return "This Year"
    return "Older"
  }

  function groupConversationsBySection(list: any[]) {
    const sections: { key: string; title: string; items: any[] }[] = []
    const order = ["Today", "Yesterday", "This Year", "Older"]
    const map = new Map<string, any[]>()
    for (const key of order) map.set(key, [])
    for (const c of list) {
      const key = getConversationSectionKey(c.createdAt)
      map.get(key)!.push(c)
    }
    for (const key of order) {
      const items = map.get(key) || []
      if (items.length > 0) sections.push({ key, title: key, items })
    }
    return sections
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
    const managers = Array.isArray(data) ? data : (data && Array.isArray(data.managers) ? data.managers : [])
    if (!managers || managers.length === 0) {
      return ""
    }

    let html = `<div class="manager-inline-list" style="margin-top: 4px; display: flex; flex-direction: column; gap: 4px;">`
    managers.forEach((m: any) => {
      const name = escapeHtml(m.name || m.manager_name || "Manager")
      const bank = escapeHtml(m.bank_name || "Partner Bank")
      const designation = escapeHtml(m.role || m.designation || m.branch || "Branch Official")
      const phone = escapeHtml(m.phone || m.mobile_no || m.mobile_number || "-")
      const rawEmail = m.email || m.email_id || ""
      const email = rawEmail && !rawEmail.includes("example.com") ? escapeHtml(rawEmail) : "-"
      const rawLoc = (m.location || m.location_city || "Branch").replace(/\n/g, ", ")
      const location = escapeHtml(rawLoc)

      html += `<div class="manager-inline-item" style="padding: 4px 8px; background: var(--surface-2); border-radius: 6px; font-size: 0.8125rem; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
        <strong>${name}</strong> <span style="color: var(--ink-soft);">(${bank} — ${designation})</span>
        ${phone !== "-" ? `<span>📞 ${phone}</span>` : ""}
        ${email !== "-" ? `<span>✉️ ${email}</span>` : ""}
        ${location !== "-" ? `<span>📍 ${location}</span>` : ""}
      </div>`
    })
    html += `</div>`
    return html
  }

  function renderMessageContent(message: any) {
    const isUser = message.role === "user"
    if (isUser) {
      return escapeHtml(message.content)
    }

    const companyData = message.company_data

    // Disambiguation step (multiple candidate companies found)
    if (companyData && companyData.needs_disambiguation && Array.isArray(companyData.candidates)) {
      let html = renderMarkdown(message.content)
      const candidates = companyData.candidates.filter(Boolean)
      if (candidates.length > 0) {
        html += `<div class="disambiguation-candidates" style="display: flex; flex-direction: column; gap: 6px; margin: 8px 0;">`
        candidates.forEach((candidate: string, index: number) => {
          const escapedCandidate = escapeHtml(candidate)
          html += `<button class="disambiguation-candidate" data-candidate="${escapedCandidate}" style="cursor: pointer; text-align: left; padding: 6px 12px; background: rgba(16, 163, 127, 0.1); border: 1px solid rgba(16, 163, 127, 0.3); border-radius: 6px; color: #10a37f; font-weight: 500; font-size: 0.8125rem; transition: all 0.15s ease; width: 100%;"><strong>${index + 1}.</strong> ${escapedCandidate}</button>`
        })
        html += `</div>`
      }
      return html
    }

    // Single company selected / returned: Render tabular format ONCE
    if (companyData && !companyData.needs_disambiguation) {
      let html = renderCompanyTables(companyData)

      // If message.content has additional prompt text outside the company markdown block (e.g. wizard confirmation prompt)
      if (message.content) {
        const cleanedContent = message.content
          .replace(/### 🏢 Corporate Intelligence:[\s\S]*?(?=⚠️|✅|$)/gi, "")
          .trim()

        if (cleanedContent) {
          html += `<div style="margin-top: 16px;">${renderMarkdown(cleanedContent)}</div>`
        }
      }

      return html
    }

    let html = renderMarkdown(message.content)

    const bankData = message.bank_data
    if (bankData && (!message.content || message.content.trim().length === 0)) {
      html += renderBankManagerCard(bankData)
    }

    return html
  }

  function renderCompanyTables(companyData: any) {
    const basic = (companyData.basic_info || companyData.basicInfo) && typeof (companyData.basic_info || companyData.basicInfo) === "object"
      ? (companyData.basic_info || companyData.basicInfo) : {}
    const financial = (companyData.financial_info || companyData.financialInfo) && typeof (companyData.financial_info || companyData.financialInfo) === "object"
      ? (companyData.financial_info || companyData.financialInfo) : {}
    const bankRecords = Array.isArray(companyData.bank_records) 
      ? companyData.bank_records 
      : (Array.isArray(companyData.bankRecords) ? companyData.bankRecords : [])
    const compName = companyData.company_name || basic.company_name || "Company"

    let html = `<div class="company-tables">`

    // 1. Overview Paragraph Box
    const rawOverview = typeof companyData.overview === "string" ? companyData.overview : ""
    const overviewText = rawOverview.replace(/### 🏢 Corporate Intelligence:[\s\S]*?(?=📌|📊|🏦|$)/gi, "").trim()

    if (overviewText) {
      html += `<div class="company-intro-box" style="margin-bottom: 0.35rem; padding: 0.3rem 0.5rem; border-left: 2px solid var(--accent); background: var(--surface-2); border-radius: 0 4px 4px 0; font-size: 0.8125rem; line-height: 1.4;">`
      html += `<div style="font-weight: 600; font-size: 0.8125rem; color: var(--accent); margin-bottom: 0.1rem;"><i class="bi bi-building"></i> ${escapeHtml(compName)} Overview</div>`
      html += renderMarkdown(overviewText)
      html += `</div>`
    }

    // 2. Basic Information Table
    html += `<div style="margin-bottom: 0.35rem;">`
    html += `<div style="font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.15rem; color: var(--ink);"><i class="bi bi-info-circle"></i> Basic Information</div>`
    html += `<table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin: 0;"><tbody>`
    html += renderTableRow("Corporate Name", compName)
    html += renderTableRow("CIN Number", basic.cin || "-")
    html += renderTableRow("Registered Address", basic.address || "-")
    html += renderTableRow("Official Website", basic.website || "-")
    html += renderTableRow("Industry / Sector", basic.industry || "-")
    html += renderTableRow("Country of Incorporation", basic.country || "-")
    html += renderTableRow("Incorporation Date", basic.incorporation_date || "-")
    html += renderTableRow("Listing Status", basic.listing_status || "-")
    html += `</tbody></table></div>`

    // 3. Bank Records Table
    const seenBanks = new Set<string>()
    const uniqueBankRecords = bankRecords.filter((r: any) => {
      const bName = String(r?.bank_name || "").trim().toLowerCase()
      if (!bName || seenBanks.has(bName)) return false
      seenBanks.add(bName)
      return true
    })

    if (uniqueBankRecords.length > 0) {
      html += `<div style="margin-bottom: 0.35rem;">`
      html += `<div style="font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.15rem; color: var(--ink);"><i class="bi bi-bank"></i> Bank Ratings (${uniqueBankRecords.length} Partner Banks)</div>`
      html += `<table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin: 0;">`
      html += `<thead><tr><th style="width: 35px; padding: 2px 4px;">#</th><th style="padding: 2px 4px;">Bank</th><th style="padding: 2px 4px;">Rating</th><th style="padding: 2px 4px;">Remarks</th></tr></thead><tbody>`
      uniqueBankRecords.forEach((r: any, idx: number) => {
        html += `<tr>`
        html += `<td style="color: var(--ink-muted); padding: 2px 4px;">${idx + 1}</td>`
        html += `<td style="padding: 2px 4px;"><strong>${escapeHtml(r.bank_name || "-")}</strong></td>`
        html += `<td style="padding: 2px 4px;"><span class="badge bg-success" style="font-size: 0.68rem; padding: 1px 4px;">${escapeHtml(r.company_category || r.category || "Approved")}</span></td>`
        html += `<td style="color: var(--ink-soft); padding: 2px 4px;">${escapeHtml(r.other_info || r.remarks || "Corporate Partner")}</td>`
        html += `</tr>`
      })
      html += `</tbody></table></div>`
    } else {
      html += `<div style="margin-bottom: 0.35rem;">`
      html += `<div style="font-size: 0.78125rem; color: var(--ink-muted);"><i class="bi bi-exclamation-triangle"></i> Not listed in uploaded bank records. Standard corporate rules apply.</div>`
      html += `</div>`
    }

    // 4. Financial Information Table
    html += `<div style="margin-bottom: 0.35rem;">`
    html += `<div style="font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.15rem; color: var(--ink);"><i class="bi bi-bar-chart"></i> Financial Profile</div>`
    html += `<table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin: 0;"><tbody>`
    html += renderTableRow("Workforce", financial.employees || "-")
    html += renderTableRow("Turnover / Revenue", financial.turnover || "-")
    html += renderTableRow("Profit Status", financial.profit_status || "-")
    html += renderTableRow("Last AGM", financial.last_agm || "-")
    html += renderTableRow("Trend", financial.profit_history || "-")
    html += `</tbody></table></div>`

    html += `</div>`
    return html
  }

  function renderTableRow(label: string, value: string) {
    const escapedValue = escapeHtml(value)
    return `<tr><td style="font-weight: 500; color: var(--ink-soft); width: 35%; padding: 2px 6px; font-size: 0.8125rem;">${escapeHtml(label)}</td><td style="color: var(--ink); font-weight: 600; padding: 2px 6px; font-size: 0.8125rem;">${escapedValue}</td></tr>`
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
          <i className="bi bi-hand-thumbs-up" />
        </button>
        <button
          className={`message-action-btn ${actions.disliked ? "active-dislike" : ""}`}
          onClick={() => toggleDislike(message.id)}
          title="Bad response"
        >
          <i className="bi bi-hand-thumbs-down" />
        </button>
        {isErrorMessage(message) && (
          <button
            className="message-action-btn"
            onClick={() => retryMessage(message.retry_content || message.content.replace(/^Error:\s*/, ""))}
            title="Retry"
          >
            <i className="bi bi-arrow-clockwise" /> Retry
          </button>
        )}
      </div>
    )
  }

  if (!user) return <main style={{ padding: 24, textAlign: "center", color: "var(--ink-soft)" }}>Loading...</main>

  return (
    <main className={`home-body ${activeSection === "assistant" ? "chat-page" : ""}`}>
      <Topbar
        user={user}
        pathname="/home"
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        sidebarOpen={sidebarOpen}
      />

      {activeSection === "home" && (
        <div className="dashboard-home-view animate-fade-in">
          {/* CallNow Hero Banner */}
          <div className="home-hero-banner hero">
            <div className="home-hero-badge">
              <i className="bi bi-stars" /> Financial &amp; Loan Intelligence Platform
            </div>
            <h1 className="hero-title">
              Welcome back, {user.name || user.email?.split("@")[0] || "User"}
            </h1>
            <p className="hero-subtitle">
              Your centralized workspace for AI loan evaluation, live bank policy rules, employer verification, and real-time EMI simulations.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSectionChange("assistant")}
              >
                <i className="bi bi-chat-dots" /> Launch AI Assistant
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSectionChange("emi")}
              >
                <i className="bi bi-calculator" /> Open EMI Calculator
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSectionChange("policies")}
              >
                <i className="bi bi-file-earmark-text" /> View Bank Policies
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => router.push("/admin")}
                >
                  <i className="bi bi-shield-lock" /> Admin Workspace
                </button>
              )}
            </div>
          </div>

          {/* KPI Stat Cards Grid */}
          <div className="home-stats-grid">
            <div className="stat-card">
              <div className="stat-card-icon">
                <i className="bi bi-bank" />
              </div>
              <div>
                <div className="stat-card-value">20+ Banks</div>
                <div className="stat-card-label">HDFC, ICICI, SBI, Axis &amp; more</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">
                <i className="bi bi-buildings" />
              </div>
              <div>
                <div className="stat-card-value">339K+</div>
                <div className="stat-card-label">Employer Category Listings</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">
                <i className="bi bi-file-earmark-check" />
              </div>
              <div>
                <div className="stat-card-value">Live Policies</div>
                <div className="stat-card-label">CIBIL, FOIR, Age &amp; Salary rules</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">
                <i className="bi bi-lightning-charge" />
              </div>
              <div>
                <div className="stat-card-value">Instant Math</div>
                <div className="stat-card-label">Real-time amortization schedule</div>
              </div>
            </div>
          </div>

          <div className="home-cards-section-title">
            <span>Explore Dashboard Tools</span>
          </div>

          <div className="home-cards-grid">
            <div className="card home-feature-card">
              <div>
                <div className="home-feature-card-header">
                  <div className="home-feature-icon">
                    <i className="bi bi-robot" />
                  </div>
                  <span className="badge bg-primary">AI Powered</span>
                </div>
                <h3 className="home-feature-title">AI Loan Assistant</h3>
                <p className="home-feature-desc">
                  Ask natural language questions about loan eligibility, employer ratings, interest rates, and required documentation.
                </p>
                <div className="home-prompt-chips">
                  <button
                    type="button"
                    className="home-prompt-chip"
                    onClick={() => handleLaunchPrompt("Calculate EMI for a home loan of 500000 at 9.5% for 60 months")}
                  >
                    <i className="bi bi-chat-quote" style={{ marginRight: "0.25rem", color: "var(--accent)" }} />
                    Calculate EMI for 5L home loan at 9.5%
                  </button>
                  <button
                    type="button"
                    className="home-prompt-chip"
                    onClick={() => handleLaunchPrompt("Tell me about loan processing fees")}
                  >
                    <i className="bi bi-chat-quote" style={{ marginRight: "0.25rem", color: "var(--accent)" }} />
                    Loan processing fees &amp; charges
                  </button>
                  <button
                    type="button"
                    className="home-prompt-chip"
                    onClick={() => handleLaunchPrompt("Check ICICI manager details in Pune")}
                  >
                    <i className="bi bi-chat-quote" style={{ marginRight: "0.25rem", color: "var(--accent)" }} />
                    Find ICICI manager details in Pune
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary"
                style={{ width: "100%" }}
                onClick={() => handleSectionChange("assistant")}
              >
                Chat with Assistant <i className="bi bi-arrow-right" />
              </button>
            </div>

            <div className="card home-feature-card">
              <div>
                <div className="home-feature-card-header">
                  <div className="home-feature-icon">
                    <i className="bi bi-calculator" />
                  </div>
                  <span className="badge bg-primary">Interactive</span>
                </div>
                <h3 className="home-feature-title">EMI Calculator</h3>
                <p className="home-feature-desc">
                  Calculate accurate monthly EMI, principal vs interest breakdown, and export or print complete amortization tables.
                </p>
                <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: "var(--radius)", marginBottom: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "var(--ink-soft)", marginBottom: "4px" }}>
                    <span>Default Example</span>
                    <span style={{ fontWeight: 700, color: "var(--accent)" }}>₹10,501 / mo</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                    ₹5,00,000 at 9.5% for 60 months
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary"
                style={{ width: "100%" }}
                onClick={() => handleSectionChange("emi")}
              >
                Open EMI Calculator <i className="bi bi-arrow-right" />
              </button>
            </div>

            <div className="card home-feature-card">
              <div>
                <div className="home-feature-card-header">
                  <div className="home-feature-icon">
                    <i className="bi bi-file-earmark-text" />
                  </div>
                  <span className="badge bg-primary">Bank Rules</span>
                </div>
                <h3 className="home-feature-title">Bank Policy Guidelines</h3>
                <p className="home-feature-desc">
                  Explore underwriting policy guidelines, FOIR multipliers, minimum salary requirements, and view official bank documents.
                </p>
                <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: "var(--radius)", marginBottom: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "var(--ink-soft)", marginBottom: "4px" }}>
                    <span>Bank Coverage</span>
                    <span style={{ fontWeight: 700, color: "var(--accent)" }}>HDFC, ICICI, SBI, Axis</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                    CIBIL, FOIR, multipliers &amp; policy attachments
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary"
                style={{ width: "100%" }}
                onClick={() => handleSectionChange("policies")}
              >
                View Bank Policies <i className="bi bi-arrow-right" />
              </button>
            </div>

            <div className="card home-feature-card">
              <div>
                <div className="home-feature-card-header">
                  <div className="home-feature-icon">
                    <i className="bi bi-people" />
                  </div>
                  <span className="badge bg-primary">Directory</span>
                </div>
                <h3 className="home-feature-title">Bank Managers</h3>
                <p className="home-feature-desc">
                  Locate verified branch managers, regional credit officers, and loan executives in your target city.
                </p>
                <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: "var(--radius)", marginBottom: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "var(--ink-soft)", marginBottom: "4px" }}>
                    <span>City Coverage</span>
                    <span style={{ fontWeight: 700, color: "var(--warning)" }}>Pan-India</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                    Phone, email, and branch addresses
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary"
                style={{ width: "100%" }}
                onClick={() => router.push("/bank-managers")}
              >
                Search Bank Managers <i className="bi bi-arrow-right" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-layout" style={{ display: activeSection === "assistant" ? "flex" : "none" }}>
        <div
          className={`chat-sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`chat-sidebar ${sidebarOpen ? "open" : "closed"}`} id="chatSidebar">
          <div className="chat-sidebar-header">
            <button className="chat-new-chat-btn" id="chatNewConversation" onClick={newConversation}>
              <i className="bi bi-plus-lg" /> New Chat
            </button>
          </div>
          <div className="chat-list" id="chatConversationList">
            {filteredConversations().length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--ink-muted)", fontSize: "12px" }}>
                No conversations yet
              </div>
            ) : (
              groupConversationsBySection(filteredConversations()).map((section) => (
                <div key={section.key} className="chat-history-section">
                  <div className="chat-history-section-header">
                    <span className="chat-history-section-title">{section.title}</span>
                    <span className="badge">{section.items.length}</span>
                  </div>
                  {section.items.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`chat-conversation-item ${conversation.id === activeConversationId ? "active" : ""}`}
                      onClick={() => {
                        selectConversation(conversation.id)
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
                          {conversation.pinned && <i className="bi bi-pin-fill" style={{ color: "var(--accent)", marginRight: "0.25rem" }} />}
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
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "var(--ink-muted)" }}
                          title={conversation.pinned ? "Unpin" : "Pin"}
                        >
                          <i className={conversation.pinned ? "bi bi-pin-fill" : "bi bi-pin"} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteConversation(conversation.id)
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "var(--danger)" }}
                          title="Delete"
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
          <div className="chat-search-box">
            <div style={{ position: "relative", width: "100%" }}>
              <i className="bi bi-search" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "0.75rem", color: "var(--ink-muted)" }} />
              <input
                type="text"
                className="chat-search-input"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "28px" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}
                  title="Clear search"
                >
                  <i className="bi bi-x-circle-fill" />
                </button>
              )}
            </div>
          </div>
          <div className="chat-sidebar-footer">
            {isAdmin && (
              <button
                type="button"
                className="chat-sidebar-admin-btn"
                onClick={() => router.push("/admin")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--ink)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginBottom: "0.5rem",
                }}
                title="Open Admin Workspace in full page"
              >
                <i className="bi bi-shield-lock" style={{ color: "var(--accent)" }} />
                <span>Admin Workspace</span>
                <i className="bi bi-box-arrow-up-right" style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--ink-muted)" }} />
              </button>
            )}
            <div className="chat-sidebar-profile" onClick={() => router.push("/profile")}>
              <div className="chat-avatar-sm">{(user.name || user.email || "U").charAt(0).toUpperCase()}</div>
              <div className="chat-sidebar-profile-info">
                <div className="chat-sidebar-profile-name">{user.name || "User"}</div>
                <div className="chat-sidebar-profile-email">{user.email || ""}</div>
              </div>
            </div>
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
              <i className="bi bi-trash3" style={{ marginRight: "0.25rem" }} /> Clear History
            </button>
          </div>
        </aside>

        <main className="chat-main">
          <div
            className="chat-messages"
            id="chatMessages"
            ref={(el) => setMessagesRef(el)}
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
                  <div className="chat-welcome-icon" style={{ color: "var(--accent)" }}>
                    <i className="bi bi-stars" />
                  </div>
                  <h2>What can I help with today?</h2>
                  <div className="chat-prompt-chips">
                    <button type="button" className="chat-prompt-chip" onClick={() => sendMessage("Calculate EMI for a home loan of 500000 at 9.5% for 60 months")}>
                      <i className="bi bi-calculator" style={{ color: "var(--accent)" }} /> Calculate 5L EMI at 9.5%
                    </button>
                    <button type="button" className="chat-prompt-chip" onClick={() => sendMessage("Tell me about loan processing fees")}>
                      <i className="bi bi-cash-coin" style={{ color: "var(--warning)" }} /> Loan processing fees
                    </button>
                    <button type="button" className="chat-prompt-chip" onClick={() => sendMessage("I want a personal loan")}>
                      <i className="bi bi-check2-circle" style={{ color: "var(--success)" }} /> Check loan eligibility
                    </button>
                    <button type="button" className="chat-prompt-chip" onClick={() => sendMessage("Give me ICICI manager details in Pune")}>
                      <i className="bi bi-bank2" style={{ color: "var(--info)" }} /> ICICI bank manager in Pune
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "user"
                  return (
                    <div key={message.id} className={`chat-message ${message.role}`} data-message-id={message.id}>
                      <div className="chat-avatar">{isUser ? "U" : <i className="bi bi-cpu" />}</div>
                      <div className="chat-message-content">
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
                                <i className="bi bi-copy" /> Copy
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
                  <div className="chat-avatar"><i className="bi bi-cpu" /></div>
                  <div className="chat-bubble typing-bubble">
                    <div className="chat-typing-indicator">
                      <div className="chat-typing-dot"></div>
                      <div className="chat-typing-dot"></div>
                      <div className="chat-typing-dot"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="chat-composer">
            <form className="chat-composer-form" onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} autoComplete="off">
              <button type="button" className="chat-attachment-btn" title="Attach file" onClick={() => {}}>
                <i className="bi bi-paperclip" style={{ fontSize: "1rem" }} />
              </button>
              <div className="chat-input-wrap">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  placeholder="Message AI Assistant..."
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
                  <i className="bi bi-arrow-up" style={{ fontSize: "0.9375rem" }} />
                )}
              </button>
            </form>
            <div className="chat-disclaimer" style={{ textAlign: "center", fontSize: "0.6875rem", color: "var(--ink-muted)", marginTop: "4px", width: "100%", display: "block" }}>
              AI can make mistakes. Please verify important loan and policy details.
            </div>
          </div>
        </main>
      </div>

      {activeSection === "emi" && (
        <EmiCalculator user={user} embedded={true} />
      )}

      {activeSection === "policies" && (
        <PoliciesView user={user} embedded={true} />
      )}

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
