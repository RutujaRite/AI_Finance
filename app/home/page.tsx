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

  async function handleDownloadPdf(buttonOrId?: HTMLElement | string | null, maybeMsgId?: string | null) {
    let buttonEl: HTMLElement | null = null
    let messageId: string | null = null

    if (typeof buttonOrId === "string") {
      messageId = buttonOrId
    } else if (buttonOrId && buttonOrId instanceof HTMLElement) {
      buttonEl = buttonOrId
      messageId = maybeMsgId || buttonEl.getAttribute("data-message-id") || null
    } else if (maybeMsgId) {
      messageId = maybeMsgId
    }

    // 1. Locate the card element in the DOM
    let card: HTMLElement | null = buttonEl ? (buttonEl.closest(".eligibility-dashboard, .eligibility-card") as HTMLElement | null) : null
    if (!card && messageId) {
      const btn = document.querySelector(`.btn-download-report[data-message-id="${messageId}"]`)
      if (btn) {
        card = btn.closest(".eligibility-dashboard, .eligibility-card") as HTMLElement | null
        if (!buttonEl && btn instanceof HTMLElement) buttonEl = btn
      }
      if (!card) {
        const el = document.querySelector(`[data-message-id="${messageId}"].eligibility-dashboard, [data-message-id="${messageId}"] .eligibility-dashboard, [data-message-id="${messageId}"] .eligibility-card`) as HTMLElement | null
        if (el) card = el
      }
    }
    if (!card) {
      const allCards = document.querySelectorAll(".eligibility-dashboard, .eligibility-card")
      if (allCards.length > 0) {
        card = allCards[allCards.length - 1] as HTMLElement
        if (!buttonEl) {
          const btn = card.querySelector(".btn-download-report") as HTMLElement | null
          if (btn) buttonEl = btn
        }
      }
    }

    // 2. Extract the actual rendered report content from the visible DOM card
    let renderedReportHtml = ""
    let isSuccess = true

    if (card) {
      isSuccess = !card.classList.contains("eligibility-card-warning") && !card.classList.contains("eligibility-card-error")
      const bodyEl = card.querySelector(".eligibility-card-body") as HTMLElement | null
      if (bodyEl && bodyEl.innerHTML.trim().length > 20) {
        renderedReportHtml = bodyEl.innerHTML
      } else if (card.classList.contains("eligibility-dashboard")) {
        const clone = card.cloneNode(true) as HTMLElement
        const dlBtn = clone.querySelector(".btn-download-report")
        if (dlBtn) dlBtn.remove()
        renderedReportHtml = clone.innerHTML
      }
    }

    // Fallback to message content if DOM body is not yet populated
    if (!renderedReportHtml) {
      let targetMsg = messageId ? messages.find((m) => m.id === messageId) : null
      if (!targetMsg) {
        targetMsg = [...messages].reverse().find((m) => detectEligibilityResult(m.content))
      }
      if (targetMsg && targetMsg.content) {
        const info = detectEligibilityResult(targetMsg.content)
        isSuccess = info?.isSuccess ?? true
        renderedReportHtml = renderMarkdown(targetMsg.content)
      }
    }

    if (!renderedReportHtml) {
      alert("No eligibility assessment report found to export.")
      return
    }

    // Visual feedback on button
    const originalBtnText = buttonEl?.innerHTML
    if (buttonEl) {
      buttonEl.innerHTML = `<i class="bi bi-hourglass-split"></i> Generating PDF...`
      ;(buttonEl as HTMLButtonElement).disabled = true
    }

    const resetBtn = () => {
      if (buttonEl && originalBtnText) {
        buttonEl.innerHTML = originalBtnText
        ;(buttonEl as HTMLButtonElement).disabled = false
      }
    }

    const todayStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    const refId = "CW-EVAL-" + Math.floor(100000 + Math.random() * 900000)

    // Scrub any internal/database/debug artifacts
    const cleanReportHtml = renderedReportHtml
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/NOT_DEFINED/gi, "Standard Bank Policy")
      .replace(/NEEDS_REVIEW/gi, "Bank Underwriting Review")

    // Dedicated, self-contained PDF HTML template with explicit inline styles (PDF-safe)
    const reportHtmlDoc = `
      <div id="creditwise-pdf-root" style="width: 760px; padding: 28px 32px; background: #ffffff !important; color: #0f172a !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; font-size: 13px; box-sizing: border-box;">
        <style>
          #creditwise-pdf-root, #creditwise-pdf-root * { box-sizing: border-box; }
          #creditwise-pdf-root h2 { font-size: 17px !important; color: #0f172a !important; font-weight: 700 !important; margin: 0 0 12px 0 !important; padding-bottom: 6px !important; border-bottom: 1.5px solid #e2e8f0 !important; }
          #creditwise-pdf-root h3 { font-size: 14px !important; color: #1e293b !important; font-weight: 700 !important; margin: 16px 0 8px 0 !important; }
          #creditwise-pdf-root h4 { font-size: 13px !important; color: #334155 !important; font-weight: 600 !important; margin: 12px 0 6px 0 !important; }
          #creditwise-pdf-root p { margin: 6px 0 10px 0 !important; line-height: 1.5 !important; color: #334155 !important; }
          #creditwise-pdf-root table { width: 100% !important; border-collapse: collapse !important; margin: 10px 0 14px 0 !important; font-size: 11.5px !important; background: #ffffff !important; border: 1px solid #cbd5e1 !important; border-radius: 4px !important; }
          #creditwise-pdf-root th { background: #f8fafc !important; color: #0f172a !important; font-weight: 700 !important; padding: 7px 10px !important; border: 1px solid #cbd5e1 !important; text-align: left !important; }
          #creditwise-pdf-root td { padding: 6px 10px !important; border: 1px solid #e2e8f0 !important; color: #334155 !important; background: #ffffff !important; }
          #creditwise-pdf-root tr:nth-child(even) td { background: #f8fafc !important; }
          #creditwise-pdf-root .callout-card { border-radius: 6px !important; padding: 10px 14px !important; margin: 12px 0 !important; font-size: 12px !important; }
          #creditwise-pdf-root .callout-success { background: #f0fdf4 !important; border: 1px solid #86efac !important; border-left: 4px solid #10b981 !important; color: #14532d !important; }
          #creditwise-pdf-root .callout-warning { background: #fef2f2 !important; border: 1px solid #fca5a5 !important; border-left: 4px solid #ef4444 !important; color: #7f1d1d !important; }
          #creditwise-pdf-root .callout-title { font-weight: 700 !important; font-size: 12px !important; margin-bottom: 4px !important; display: flex !important; align-items: center !important; gap: 4px !important; }
          #creditwise-pdf-root ul, #creditwise-pdf-root ol { margin: 8px 0 !important; padding-left: 22px !important; line-height: 1.5 !important; }
          #creditwise-pdf-root li { margin-bottom: 4px !important; color: #334155 !important; }
          #creditwise-pdf-root hr { margin: 14px 0 !important; border: 0 !important; border-top: 1px solid #e2e8f0 !important; }
          #creditwise-pdf-root .eligibility-dashboard { display: flex !important; flex-direction: column !important; gap: 12px !important; margin: 0 !important; width: 100% !important; }
          #creditwise-pdf-root .eligibility-dashboard-banner { display: none !important; }
          #creditwise-pdf-root .applicant-summary-card,
          #creditwise-pdf-root .top-recommended-bank-card,
          #creditwise-pdf-root .eligible-banks-table-card,
          #creditwise-pdf-root .eligibility-next-step-card {
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px !important;
            padding: 10px 14px !important;
            margin: 10px 0 !important;
            background: #ffffff !important;
          }
          #creditwise-pdf-root .applicant-summary-header,
          #creditwise-pdf-root .top-bank-header,
          #creditwise-pdf-root .table-card-header,
          #creditwise-pdf-root .next-step-title {
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            margin-bottom: 8px !important;
          }
          #creditwise-pdf-root .applicant-summary-grid {
            display: flex !important;
            gap: 16px !important;
          }
          #creditwise-pdf-root .applicant-summary-col {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 5px !important;
          }
          #creditwise-pdf-root .applicant-summary-col.right-col {
            border-left: 1px solid #e2e8f0 !important;
            padding-left: 14px !important;
          }
          #creditwise-pdf-root .applicant-summary-item {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 11px !important;
          }
          #creditwise-pdf-root .applicant-summary-label { color: #64748b !important; }
          #creditwise-pdf-root .applicant-summary-val { color: #0f172a !important; font-weight: 700 !important; }
          #creditwise-pdf-root .top-recommended-split {
            display: flex !important;
            gap: 16px !important;
          }
          #creditwise-pdf-root .top-recommended-left { flex: 1.2 !important; }
          #creditwise-pdf-root .top-recommended-right { flex: 0.8 !important; border-left: 1px solid #e2e8f0 !important; padding-left: 14px !important; }
          #creditwise-pdf-root .top-bank-box { display: flex !important; align-items: center !important; gap: 10px !important; }
          #creditwise-pdf-root .top-bank-badge { background: #0b2545 !important; color: #ffffff !important; padding: 4px 6px !important; border-radius: 4px !important; font-size: 8.5px !important; font-weight: 800 !important; text-align: center !important; }
          #creditwise-pdf-root .top-bank-name { font-size: 13px !important; font-weight: 700 !important; color: #0f172a !important; }
          #creditwise-pdf-root .badge-best-match { background: #dcfce7 !important; color: #15803d !important; font-size: 9.5px !important; padding: 1px 5px !important; border-radius: 3px !important; font-weight: 600 !important; }
          #creditwise-pdf-root .top-bank-emi { font-size: 11px !important; color: #475569 !important; }
          #creditwise-pdf-root .top-bank-emi strong { color: #0f172a !important; font-weight: 700 !important; }
          #creditwise-pdf-root .top-bank-why-item { font-size: 10.5px !important; color: #334155 !important; margin-bottom: 3px !important; }
          #creditwise-pdf-root .eligibility-table { width: 100% !important; border-collapse: collapse !important; font-size: 10.5px !important; margin: 0 !important; }
          #creditwise-pdf-root .eligibility-table th { background: #f0fdfa !important; color: #0f766e !important; padding: 5px 7px !important; border: 1px solid #cbd5e1 !important; font-size: 10px !important; }
          #creditwise-pdf-root .eligibility-table td { padding: 5px 7px !important; border: 1px solid #e2e8f0 !important; color: #334155 !important; }
          #creditwise-pdf-root .status-pill-eligible { background: #dcfce7 !important; color: #166534 !important; padding: 1px 5px !important; border-radius: 3px !important; font-size: 9.5px !important; font-weight: 600 !important; }
          #creditwise-pdf-root .eligibility-next-step-card { background: #f0f9ff !important; border: 1px solid #bae6fd !important; }
        </style>

        <!-- Executive Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #5e6ad2; padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <div style="font-size: 24px; font-weight: 800; color: #5e6ad2; letter-spacing: -0.5px;">CreditWise AI</div>
            <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 3px;">Financial Intelligence Platform — Personal Loan Assessment</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #475569;">
            <div>Ref: <strong style="color: #0f172a;">${refId}</strong></div>
            <div>Date: <strong>${todayStr}</strong></div>
            <div style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 10.5px; font-weight: 700; margin-top: 5px; background: ${isSuccess ? "#dcfce7" : "#fee2e2"}; color: ${isSuccess ? "#15803d" : "#b91c1c"}; border: 1px solid ${isSuccess ? "#86efac" : "#fca5a5"};">
              ${isSuccess ? "✓ Criteria Met (Eligible)" : "⚠️ Policy Criteria Not Met"}
            </div>
          </div>
        </div>

        <!-- Rendered Report Content from DOM -->
        <div class="pdf-rendered-body" style="color: #334155; font-size: 12.5px; line-height: 1.55;">
          ${cleanReportHtml}
        </div>

        <!-- Regulatory Notice & Disclaimer -->
        <div style="margin-top: 24px; padding: 10px 14px; background: #f8fafc; border-left: 3.5px solid #94a3b8; border-radius: 4px; font-size: 10px; color: #64748b; line-height: 1.45;">
          <strong>Confidentiality & Underwriting Notice:</strong> This evaluation is generated by CreditWise AI strictly against official partner bank Master Policy guidelines. Loan sanction, applicable ROI, and final disbursement are subject to formal bank underwriting, KYC authentication, document submission, and credit bureau verification.
        </div>
        <div style="margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9.5px; color: #94a3b8; display: flex; justify-content: space-between;">
          <div>CreditWise AI — Official Partner Bank Advisory Report</div>
          <div>Confidential — For Applicant Reference Only</div>
        </div>
      </div>
    `

    let container: HTMLElement | null = null
    const originalScrollX = window.scrollX || window.pageXOffset || 0
    const originalScrollY = window.scrollY || window.pageYOffset || 0

    try {
      // 1. Create dedicated, visible PDF-safe rendering container in DOM
      container = document.createElement("div")
      container.id = "creditwise-pdf-dedicated-stage"
      container.style.position = "absolute"
      container.style.top = "0px"
      container.style.left = "0px"
      container.style.width = "780px"
      container.style.minHeight = "500px"
      container.style.backgroundColor = "#ffffff"
      container.style.zIndex = "999999"
      container.style.visibility = "visible"
      container.style.opacity = "1"
      container.style.pointerEvents = "none"
      container.innerHTML = reportHtmlDoc
      document.body.appendChild(container)

      // Scroll to origin to eliminate coordinate offsets in html2canvas
      window.scrollTo(0, 0)

      // 2. Ensure the element is actually rendered and has non-zero dimensions
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 150)))
      )

      const renderedWidth = container.offsetWidth || container.scrollWidth || 780
      const renderedHeight = container.offsetHeight || container.scrollHeight || 600

      if (renderedWidth === 0 || renderedHeight === 0) {
        throw new Error("PDF container rendered with zero dimensions")
      }

      // 3. Dynamically import html2canvas and jsPDF (client-side safe)
      const html2canvasModule = await import("html2canvas")
      const html2canvas = html2canvasModule.default || html2canvasModule
      const { jsPDF } = await import("jspdf")

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: renderedWidth,
        height: renderedHeight,
        windowWidth: 800,
      })

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("html2canvas returned an empty canvas")
      }

      // 4. Construct PDF and paginate if necessary
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })

      const pageWidthMm = 210
      const pageHeightMm = 297
      const marginMm = 12
      const contentWidthMm = pageWidthMm - marginMm * 2 // 186 mm
      const contentHeightMm = (canvas.height * contentWidthMm) / canvas.width

      if (contentHeightMm <= pageHeightMm - marginMm * 2) {
        // Fits entirely on a single page
        const imgData = canvas.toDataURL("image/jpeg", 0.95)
        pdf.addImage(imgData, "JPEG", marginMm, marginMm, contentWidthMm, contentHeightMm)
      } else {
        // Multi-page slicing
        const usablePageHeightMm = pageHeightMm - marginMm * 2
        const usablePageHeightPx = Math.floor((usablePageHeightMm * canvas.width) / contentWidthMm)

        let sourceY = 0
        let isFirstPage = true

        while (sourceY < canvas.height) {
          const sliceHeight = Math.min(usablePageHeightPx, canvas.height - sourceY)

          const sliceCanvas = document.createElement("canvas")
          sliceCanvas.width = canvas.width
          sliceCanvas.height = sliceHeight
          const sliceCtx = sliceCanvas.getContext("2d")
          if (sliceCtx) {
            sliceCtx.fillStyle = "#ffffff"
            sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
            sliceCtx.drawImage(
              canvas,
              0, sourceY, canvas.width, sliceHeight,
              0, 0, canvas.width, sliceHeight
            )
          }

          const sliceImgData = sliceCanvas.toDataURL("image/jpeg", 0.95)
          const sliceHeightMm = (sliceHeight * contentWidthMm) / canvas.width

          if (!isFirstPage) {
            pdf.addPage()
          }
          pdf.addImage(sliceImgData, "JPEG", marginMm, marginMm, contentWidthMm, sliceHeightMm)

          isFirstPage = false
          sourceY += sliceHeight
        }
      }

      pdf.save(`CreditWise_Loan_Eligibility_Report_${Date.now()}.pdf`)
    } catch (err) {
      console.error("Client-side PDF generation error, using print fallback:", err)
      openPrintFallback(reportHtmlDoc)
    } finally {
      if (container && container.parentNode) {
        container.remove()
      }
      window.scrollTo(originalScrollX, originalScrollY)
      resetBtn()
    }
  }

  function openPrintFallback(htmlDoc: string) {
    const printWin = window.open("", "eligibility-report-preview", "width=900,height=800")
    if (!printWin) {
      alert("Please allow pop-ups to download or print the PDF report.")
      return
    }
    printWin.document.open()
    printWin.document.write(`<!DOCTYPE html><html><head><title>CreditWise Loan Eligibility Report</title><meta charset="utf-8"></head><body style="margin:0; background:#ffffff;">${htmlDoc}</body></html>`)
    printWin.document.close()
    printWin.focus()
    setTimeout(() => {
      printWin.print()
    }, 400)
  }

  function detectEligibilityResult(content: string) {
    if (!content || typeof content !== "string") return null

    // Check if message is a structured eligibility evaluation report
    const hasTable = content.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |")
    const hasApplicantSummary = content.includes("Applicant Summary")
    const isEligibilityAssessment =
      (hasTable && hasApplicantSummary) ||
      ((content.includes("Personal Loan Eligibility Assessment") ||
        content.includes("Personal Loan Eligibility Result:") ||
        content.includes("Assessment Outcome: No Partner Banks Currently Eligible")) &&
       (hasApplicantSummary || hasTable))

    // Also detect natural conversational ineligibility messages or early definitive policy rejections
    const isConversationalIneligibility =
      /(?:currently\s+not\s+eligible|not\s+eligible\s+for\s+(?:a\s+)?(?:personal\s+)?loan|policies\s+(?:do\s+not|may\s+not)\s+support|do\s+not\s+meet\s+(?:the\s+)?(?:eligibility|criteria)|ineligible\s+for\s+personal\s+loans?|statutory\s+age\s+criteria)/i.test(content) &&
      !/(?:\?|please\s+provide|what\s+is\s+your|could\s+you\s+share)/i.test(content)

    if (!isEligibilityAssessment && !isConversationalIneligibility) return null

    // Check if it's a warning / error / ineligible result
    const isWarningOrError =
      isConversationalIneligibility ||
      content.includes("No Partner Banks Currently Eligible") ||
      content.includes("Policy Criteria Not Met") ||
      content.includes("❌ NOT ELIGIBLE") ||
      content.includes("❌ Not Eligible") ||
      content.includes("Key Policy Constraints Identified") ||
      content.includes("Assessment Outcome: No Partner Banks Currently Eligible") ||
      content.includes("Input Required / Conditionally Eligible") ||
      /\b(?:not\s+eligible|currently\s+not\s+eligible|ineligible|0\s+partner\s+banks?)\b/i.test(content)

    const hasEligibleTableRows =
      hasTable && /\|\s*\*\*[^*]+\*\*\s*\|\s*✅\s*Eligible/i.test(content)

    // isSuccess is strictly true ONLY when qualifying partner banks are present and no ineligibility flags exist
    const isSuccess = hasEligibleTableRows && !isWarningOrError

    return {
      isEligibility: true,
      isSuccess,
    }
  }

  function renderMarkdown(source: string) {
    if (typeof marked !== "undefined" && marked.parse) {
      try {
        let html = marked.parse(source || "", { gfm: true, breaks: false })

        // 1. Transform [!TIP] and [!SUCCESS] blockquotes to light-green callout cards
        html = html.replace(
          /<blockquote>([\s\S]*?\[!(?:TIP|SUCCESS)\][\s\S]*?)<\/blockquote>/gi,
          (_match: string, inner: string) => {
            const cleanText = inner
              .replace(/<p>\s*\[!(?:TIP|SUCCESS)\](?:\s*<br\s*\/?>)?\s*/gi, "<p>")
              .replace(/\[!(?:TIP|SUCCESS)\]/gi, "")
              .trim()
            return `<div class="callout-card callout-success"><div class="callout-title"><i class="bi bi-lightbulb-fill"></i> Recommendation / Eligible Match</div>${cleanText}</div>`
          }
        )

        // 2. Transform [!WARNING], [!CAUTION], [!DANGER] blockquotes to light-red callout cards
        html = html.replace(
          /<blockquote>([\s\S]*?\[!(?:WARNING|CAUTION|DANGER)\][\s\S]*?)<\/blockquote>/gi,
          (_match: string, inner: string) => {
            const cleanText = inner
              .replace(/<p>\s*\[!(?:WARNING|CAUTION|DANGER)\](?:\s*<br\s*\/?>)?\s*/gi, "<p>")
              .replace(/\[!(?:WARNING|CAUTION|DANGER)\]/gi, "")
              .trim()
            return `<div class="callout-card callout-warning"><div class="callout-title"><i class="bi bi-exclamation-triangle-fill"></i> Policy Notice / Criteria Not Met</div>${cleanText}</div>`
          }
        )

        // 3. Transform [!NOTE], [!IMPORTANT], [!INFO] blockquotes
        html = html.replace(
          /<blockquote>([\s\S]*?\[!(?:NOTE|IMPORTANT|INFO)\][\s\S]*?)<\/blockquote>/gi,
          (_match: string, inner: string) => {
            const cleanText = inner
              .replace(/<p>\s*\[!(?:NOTE|IMPORTANT|INFO)\](?:\s*<br\s*\/?>)?\s*/gi, "<p>")
              .replace(/\[!(?:NOTE|IMPORTANT|INFO)\]/gi, "")
              .trim()
            return `<div class="callout-card callout-info"><div class="callout-title"><i class="bi bi-info-circle-fill"></i> Policy Detail</div>${cleanText}</div>`
          }
        )

        // Wrap any standard tables in a responsive horizontal-scroll container
        html = html.replace(/<table(\s[^>]*)?>/gi, (match: string) => `<div class="table-responsive-wrapper">${match}`)
        html = html.replace(/<\/table>/gi, "</table></div>")

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

  function renderEligibilityDashboard(content: string, messageId: string): string | null {
    try {
      if (!content || !content.includes("Applicant Summary")) {
        return null
      }

      // 1. Parse Applicant Summary items
      const extractField = (pattern: RegExp) => {
        const match = content.match(pattern)
        return match ? match[1].trim() : ""
      }

      const employer = extractField(/\|\s*(?:\*\*)?Employer(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i)
      const salary = extractField(/\|\s*(?:\*\*)?Monthly Take-Home Salary(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i)
      const cibil = extractField(/\|\s*(?:\*\*)?CIBIL Credit Score(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i)
      const loanAmount = extractField(/\|\s*(?:\*\*)?Requested Loan Amount(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i)
      const tenure = extractField(/\|\s*(?:\*\*)?Repayment Tenure(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i)
      const existingEmi = extractField(/\|\s*(?:\*\*)?Existing Monthly EMIs(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i)
      const age = extractField(/\|\s*(?:\*\*)?Applicant Age(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i)

      // 2. Parse Top Recommended Bank
      let topBankName = ""
      const recMatch = content.match(/###\s*🏆\s*(?:Top Recommended Bank|Eligible Partner Bank):\s*\*\*([^*]+)\*\*/i)
      if (recMatch) {
        topBankName = recMatch[1].trim()
      } else {
        const nameMatch = content.match(/-\s*\*\*Bank Name\*\*:\s*\*\*([^*]+)\*\*/i)
        if (nameMatch) topBankName = nameMatch[1].trim()
      }

      let topBankEmi = ""
      const emiMatch =
        content.match(/Estimated Monthly EMI(?:\*\*)?:\s*(?:\*\*)?(₹[\d,]+)/i) ||
        content.match(/with an estimated monthly EMI of\s*(?:\*\*)?(₹[\d,]+)/i)
      if (emiMatch) {
        topBankEmi = emiMatch[1].trim()
      }

      // Compact bank badge text generator (e.g., "BAJAJ MARKETS", "ICICI BANK", "HDFC BANK")
      const getBadgeText = (name: string) => {
        if (!name) return "PARTNER<br>BANK"
        const clean = name.replace(/\([^)]*\)/g, "").trim()
        const upper = clean.toUpperCase()
        const words = upper.split(/\s+/).filter(Boolean)
        if (words.length <= 1) return words[0] || "BANK"
        if (words.length === 2) return `${words[0]}<br>${words[1]}`
        return `${words[0]}<br>${words[1]}`
      }

      // 3. Parse Eligible Partner Banks Table
      const tableRows: Array<{
        bank: string
        status: string
        cibil: string
        tenure: string
        emi: string
      }> = []

      const lines = content.split(/\r?\n/)
      let inTable = false
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |")) {
          inTable = true
          continue
        }
        if (inTable) {
          if (line.startsWith("| :---") || line.startsWith("|:---") || line.includes("---")) {
            continue
          }
          if (line.startsWith("|") && line.endsWith("|")) {
            const rawParts = line.slice(1, -1).split("|").map((p) => p.trim())
            if (rawParts.length >= 5) {
              const bank = rawParts[0].replace(/\*\*/g, "").trim()
              const status = rawParts[1].replace(/[✅✓\s*]/g, "").trim() || "Eligible"
              const cibilVal = rawParts[2].replace(/\*\*/g, "").trim()
              const tenureVal = rawParts[3].replace(/\*\*/g, "").trim()
              const emiVal = rawParts[4].replace(/\*\*/g, "").trim()
              tableRows.push({
                bank,
                status,
                cibil: cibilVal,
                tenure: tenureVal,
                emi: emiVal,
              })
            }
          } else if (line.length > 0) {
            inTable = false
          }
        }
      }

      if (tableRows.length === 0) {
        return null // Fallback to standard rendering if table rows could not be parsed
      }

      if (!topBankName && tableRows.length > 0) {
        topBankName = tableRows[0].bank
      }
      if (!topBankEmi && tableRows.length > 0) {
        topBankEmi = tableRows[0].emi
      }

      // 4. Parse Next Step
      let nextStepText = `Reply with your chosen bank (for example, "${topBankName || "Bajaj Markets"}") and city to connect with an official branch representative!`
      const nextStepMatch = content.match(/Next Step\*\*:\s*([^\n\r]+)/i)
      if (nextStepMatch) {
        nextStepText = nextStepMatch[1].replace(/\*\*/g, "").trim()
      }

      const msgId = escapeHtml(String(messageId || ""))
      const bankCount = tableRows.length
      const badgeText = getBadgeText(topBankName)

      return `
        <div class="eligibility-dashboard eligibility-card eligibility-card-success" data-message-id="${msgId}">
          <!-- 1. Header Confirmation Banner -->
          <div class="eligibility-dashboard-banner eligibility-card-banner">
            <div class="eligibility-dashboard-banner-left eligibility-card-banner-left">
              <div class="eligibility-dashboard-banner-icon">
                <i class="bi bi-check-circle-fill"></i>
              </div>
              <div>
                <div class="eligibility-dashboard-banner-title">
                  Eligibility Confirmed — ${bankCount} Partner Bank${bankCount === 1 ? "" : "s"} Found
                </div>
                <div class="eligibility-dashboard-banner-sub">
                  Based on your profile, we've found ${bankCount} partner bank${bankCount === 1 ? "" : "s"} that meet your eligibility criteria for a personal loan.
                </div>
              </div>
            </div>
            <button type="button" class="btn-download-report" data-message-id="${msgId}" title="Download Official Eligibility PDF Report">
              <i class="bi bi-download"></i> Download Report
            </button>
          </div>

          <!-- 2. Applicant Summary Card -->
          <div class="applicant-summary-card">
            <div class="applicant-summary-header">
              <i class="bi bi-person-fill"></i>
              <span>Applicant Summary</span>
            </div>
            <div class="applicant-summary-grid">
              <div class="applicant-summary-col">
                ${employer ? `
                <div class="applicant-summary-item">
                  <span class="applicant-summary-label">Employer</span>
                  <span class="applicant-summary-val">${escapeHtml(employer)}</span>
                </div>` : ""}
                <div class="applicant-summary-item">
                  <span class="applicant-summary-label">Monthly Take-Home Salary</span>
                  <span class="applicant-summary-val">${escapeHtml(salary || "-")}</span>
                </div>
                <div class="applicant-summary-item">
                  <span class="applicant-summary-label">CIBIL Credit Score</span>
                  <span class="applicant-summary-val">${escapeHtml(cibil || "-")}</span>
                </div>
                <div class="applicant-summary-item">
                  <span class="applicant-summary-label">Requested Loan Amount</span>
                  <span class="applicant-summary-val">${escapeHtml(loanAmount || "-")}</span>
                </div>
              </div>
              <div class="applicant-summary-col right-col">
                <div class="applicant-summary-item">
                  <span class="applicant-summary-label">Repayment Tenure</span>
                  <span class="applicant-summary-val">${escapeHtml(tenure || "-")}</span>
                </div>
                <div class="applicant-summary-item">
                  <span class="applicant-summary-label">Existing Monthly EMIs</span>
                  <span class="applicant-summary-val">${escapeHtml(existingEmi || "-")}</span>
                </div>
                <div class="applicant-summary-item">
                  <span class="applicant-summary-label">Applicant Age</span>
                  <span class="applicant-summary-val">${escapeHtml(age || "-")}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Top Recommended Bank Card -->
          ${topBankName ? `
          <div class="top-recommended-bank-card">
            <div class="top-recommended-split">
              <div class="top-recommended-left">
                <div class="top-bank-header">
                  <i class="bi bi-trophy-fill"></i>
                  <span>Top Recommended Bank</span>
                </div>
                <div class="top-bank-box">
                  <div class="top-bank-badge">
                    ${badgeText}
                  </div>
                  <div class="top-bank-details">
                    <div class="top-bank-title-row">
                      <span class="top-bank-name">${escapeHtml(topBankName)}</span>
                      <span class="badge-best-match">#1 Best Match</span>
                    </div>
                    <div class="top-bank-emi">
                      Estimated Monthly EMI: <strong>${escapeHtml(topBankEmi)}</strong> / month
                    </div>
                  </div>
                </div>
              </div>
              <div class="top-recommended-right">
                <div class="top-bank-why-title">Why this bank?</div>
                <div class="top-bank-why-list">
                  <div class="top-bank-why-item">
                    <i class="bi bi-check2"></i>
                    <span>Best match based on your profile</span>
                  </div>
                  <div class="top-bank-why-item">
                    <i class="bi bi-check2"></i>
                    <span>Meets all policy criteria</span>
                  </div>
                </div>
              </div>
            </div>
          </div>` : ""}

          <!-- 4. Eligible Partner Banks (X) Table Card -->
          <div class="eligible-banks-table-card">
            <div class="table-card-header">
              <i class="bi bi-bank2"></i>
              <span>Eligible Partner Banks (${tableRows.length})</span>
            </div>
            <div class="table-responsive-wrapper">
              <table class="eligibility-table">
                <thead>
                  <tr>
                    <th class="col-index">#</th>
                    <th class="col-bank">Bank</th>
                    <th class="col-status">Status</th>
                    <th class="col-cibil">CIBIL</th>
                    <th class="col-tenure">Tenure</th>
                    <th class="col-emi">Est. EMI</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows.map((r, i) => `
                    <tr>
                      <td class="col-index">${i + 1}</td>
                      <td class="col-bank">${escapeHtml(r.bank)}</td>
                      <td class="col-status">
                        <span class="status-pill-eligible">
                          <i class="bi bi-check-circle-fill"></i> Eligible
                        </span>
                      </td>
                      <td class="col-cibil">${escapeHtml(r.cibil)}</td>
                      <td class="col-tenure">${escapeHtml(r.tenure)}</td>
                      <td class="col-emi">${escapeHtml(r.emi)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 5. Next Step Card -->
          <div class="eligibility-next-step-card">
            <div class="next-step-icon">
              <i class="bi bi-chat-dots-fill"></i>
            </div>
            <div class="next-step-body">
              <div class="next-step-title">Next Step</div>
              <div class="next-step-desc">${escapeHtml(nextStepText)}</div>
            </div>
          </div>
        </div>
      `
    } catch (e) {
      console.error("Error rendering eligibility dashboard:", e)
      return null
    }
  }

  function renderMessageContent(message: any) {
    const isUser = message.role === "user"
    if (isUser) {
      return escapeHtml(message.content)
    }

    if (isErrorMessage(message)) {
      return `<div class="eligibility-card eligibility-card-error">
        <div class="eligibility-card-banner">
          <i class="bi bi-exclamation-octagon-fill"></i>
          <span>Notice / System Error</span>
        </div>
        <div class="eligibility-card-body">
          ${renderMarkdown(message.content)}
        </div>
      </div>`
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

    const eligibilityInfo = detectEligibilityResult(message.content)
    let html = renderMarkdown(message.content)

    if (eligibilityInfo) {
      const msgId = escapeHtml(String(message.id || ""))
      const downloadBtnHtml = `<button type="button" class="btn-download-report" data-message-id="${msgId}" title="Download Official Eligibility PDF Report"><i class="bi bi-file-earmark-pdf-fill"></i> Download Report</button>`

      if (eligibilityInfo.isSuccess) {
        const dashboardHtml = renderEligibilityDashboard(message.content, msgId)
        if (dashboardHtml) {
          html = dashboardHtml
        } else {
          // Strictly gate success banner on having qualifying partner banks
          const hasEligibleRows =
            message.content.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |") &&
            /\|\s*\*\*[^*]+\*\*\s*\|\s*✅\s*Eligible/i.test(message.content)
          if (hasEligibleRows) {
            html = `<div class="eligibility-card eligibility-card-success">
              <div class="eligibility-card-banner">
                <div class="eligibility-card-banner-left">
                  <i class="bi bi-shield-check"></i>
                  <span>Eligibility Confirmed — Qualifying Partner Banks Found</span>
                </div>
                ${downloadBtnHtml}
              </div>
              <div class="eligibility-card-body">
                ${html}
              </div>
            </div>`
          } else {
            // NOT_ELIGIBLE must NEVER display "Eligibility Confirmed — Qualifying Partner Banks Found"
            html = `<div class="eligibility-card eligibility-card-warning">
              <div class="eligibility-card-banner">
                <div class="eligibility-card-banner-left">
                  <i class="bi bi-exclamation-triangle-fill"></i>
                  <span>Eligibility Assessment — Policy Criteria Not Met</span>
                </div>
                ${downloadBtnHtml}
              </div>
              <div class="eligibility-card-body">
                ${html}
              </div>
            </div>`
          }
        }
      } else {
        // Warning / Error / Ineligible result: Light-Red Background Card
        html = `<div class="eligibility-card eligibility-card-warning">
          <div class="eligibility-card-banner">
            <div class="eligibility-card-banner-left">
              <i class="bi bi-exclamation-triangle-fill"></i>
              <span>Eligibility Assessment — Policy Criteria Not Met</span>
            </div>
            ${downloadBtnHtml}
          </div>
          <div class="eligibility-card-body">
            ${html}
          </div>
        </div>`
      }
    }

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
              if (candidateBtn) {
                const candidate = candidateBtn.getAttribute("data-candidate")
                if (candidate) {
                  sendMessage(candidate)
                }
              }
              const downloadBtn = target.closest(".btn-download-report") as HTMLElement | null
              if (downloadBtn) {
                const messageId = downloadBtn.getAttribute("data-message-id")
                handleDownloadPdf(downloadBtn, messageId)
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
