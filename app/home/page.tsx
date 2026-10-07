"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Topbar, { DashboardSection } from "../../components/Topbar"
import EmiCalculator from "../../components/EmiCalculator"
import PoliciesView from "../../components/PoliciesView"

declare const marked: any
declare const hljs: any

const AVAILABLE_MODELS = [
  { id: "openrouter/auto", name: "Auto (Best Available)", desc: "Fast & intelligent", icon: "⚡" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Fast & precise", icon: "✨" },
  { id: "openai/gpt-4o", name: "GPT-4o", desc: "Most capable", icon: "🧠" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", desc: "Balanced reasoning", icon: "🎯" },
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
  const [actionMenuConvId, setActionMenuConvId] = useState<string | null>(null)
  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [deleteModalConv, setDeleteModalConv] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [clearHistoryModalOpen, setClearHistoryModalOpen] = useState(false)
  const [messageActions, setMessageActions] = useState<Record<string, { liked: boolean; disliked: boolean }>>({})
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [messagesRef, setMessagesRef] = useState<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const modelSelectorRef = useRef<HTMLDivElement | null>(null)
  const initializedRef = useRef(false)
  const messagesByConvRef = useRef<Record<string, any[]>>({})
  const activeConvIdRef = useRef<string | null>(null)
  const isStreamingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  function stopGeneration() {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch {}
      abortControllerRef.current = null
    }
    isStreamingRef.current = false
    setLoading(false)
  }

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
        if (!isAdmin && (sec === "home" || sec === "policies")) {
          setActiveSection("assistant")
        } else {
          setActiveSection(sec)
        }
      } else {
        setActiveSection(isAdmin ? "home" : "assistant")
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [isAdmin])

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
    if (!isAdmin && (section === "home" || section === "policies")) {
      section = "assistant"
    }
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
    if (isStreamingRef.current) return
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
      if (actionMenuConvId && !(e.target as HTMLElement).closest(".chat-conversation-actions, .chat-action-menu-dropdown")) {
        setActionMenuConvId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [contextMenu, actionMenuConvId])

  async function checkAuth() {
    const res = await fetch("/api/auth/verify", { credentials: "include" })
    if (!res.ok) {
      router.replace("/login")
    } else {
      const data = await res.json()
      if (data.success) {
        setUser(data.user)
        const isUserAdmin =
          String(data.user?.role || "").trim().toLowerCase() === "admin" ||
          data.user?.is_admin === true ||
          String(data.user?.email || "").toLowerCase() === "admin@gmail.com" ||
          String(data.user?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
          String(data.user?.email || "").toLowerCase().startsWith("admin")

        if (!isUserAdmin) {
          setActiveSection((prev) => (prev === "emi" ? "emi" : "assistant"))
        }
      }
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
      const activeMsgs = activeId && Array.isArray(messagesByConvRef.current[activeId])
        ? messagesByConvRef.current[activeId]
        : []
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
      if (activeId) {
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
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login")
        }
        return
      }
      const data = await res.json().catch(() => null)
      if (!data) return
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

  async function sendMessage(text: string, companySelection?: { type: "confirm" | "retry" | "select"; company_id?: string; company_name?: string }) {
    if (!text.trim() || loading) return

    const resolvedText = text.trim()

    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort() } catch {}
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

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
    isStreamingRef.current = true

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: resolvedText,
          conversation_id: currentConvId,
          model: selectedModel,
          company_selection: companySelection,
          stream: true,
        }),
        credentials: "include",
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login")
          return
        }
        let errMsg = `Request failed with status ${res.status}`
        try {
          const errData = await res.json()
          if (errData?.error) errMsg = errData.error
        } catch {}
        throw new Error(errMsg)
      }

      const isSseStream = res.headers.get("content-type")?.includes("text/event-stream")

      if (isSseStream && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        const streamingMsgId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
        let placeholderCreated = false
        let accumulatedText = ""
        let completedAiMessage: any = null
        let streamConvId = currentConvId

        try {
          while (true) {
            if (controller.signal.aborted) {
              try { await reader.cancel() } catch {}
              break
            }
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const blocks = buffer.split("\n\n")
            buffer = blocks.pop() || ""

            for (const block of blocks) {
              const trimmed = block.trim()
              if (!trimmed.startsWith("data:")) continue
              const jsonStr = trimmed.slice(5).trim()
              if (!jsonStr) continue
              try {
                const event = JSON.parse(jsonStr)
                if (event.type === "init") {
                  if (event.conversation_id) {
                    streamConvId = String(event.conversation_id)
                    activeConvIdRef.current = streamConvId
                    messagesByConvRef.current[streamConvId] = [...messages, userMessage]
                  }
                } else if (event.type === "token") {
                  const tokenText = event.text || ""
                  if (!tokenText) continue
                  accumulatedText += tokenText
                  if (!placeholderCreated) {
                    placeholderCreated = true
                    setLoading(false)
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: streamingMsgId,
                        role: "ai" as const,
                        content: accumulatedText,
                        timestamp: new Date().toISOString(),
                      },
                    ])
                  } else {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === streamingMsgId ? { ...m, content: accumulatedText } : m
                      )
                    )
                  }
                } else if (event.type === "done") {
                  isStreamingRef.current = false
                  setLoading(false)
                  const effectiveId = event.conversation_id || streamConvId || currentConvId
                  if (effectiveId) {
                    activeConvIdRef.current = String(effectiveId)
                    setActiveConversationId(String(effectiveId))
                  }
                  const convTitle = event.title || "Loan Assistant"
                  setConversations((prev) => {
                    const targetId = effectiveId || "default"
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

                  completedAiMessage = {
                    ...(event.ai_message || {}),
                    id: streamingMsgId,
                    role: "ai" as const,
                    content: accumulatedText || event.ai_message?.content || "",
                    timestamp: event.ai_message?.timestamp || new Date().toISOString(),
                  }

                  if (!placeholderCreated) {
                    setMessages((prev) => [...prev, completedAiMessage])
                  } else {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === streamingMsgId ? completedAiMessage : m))
                    )
                  }

                  if (effectiveId) {
                    messagesByConvRef.current[effectiveId] = [
                      ...messages,
                      userMessage,
                      completedAiMessage,
                    ]
                  }
                } else if (event.type === "error") {
                  isStreamingRef.current = false
                  setLoading(false)
                  const interruptedContent =
                    (accumulatedText ? `${accumulatedText}\n\n` : "") +
                    "⚠️ Response interrupted. Please try again."
                  if (placeholderCreated) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === streamingMsgId ? { ...m, content: interruptedContent } : m
                      )
                    )
                  } else {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: streamingMsgId,
                        role: "ai" as const,
                        content: interruptedContent,
                        timestamp: new Date().toISOString(),
                      },
                    ])
                  }
                  return
                }
              } catch (pErr) {
                console.warn("SSE event parsing warning:", pErr)
              }
            }
          }
        } catch (streamErr: any) {
          if (controller.signal.aborted || streamErr?.name === "AbortError") {
            isStreamingRef.current = false
            setLoading(false)
            if (accumulatedText && !placeholderCreated) {
              setMessages((prev) => [
                ...prev,
                {
                  id: streamingMsgId,
                  role: "ai" as const,
                  content: accumulatedText,
                  timestamp: new Date().toISOString(),
                },
              ])
            }
            return
          }
          console.error("Stream reading interrupted:", streamErr)
          isStreamingRef.current = false
          setLoading(false)
          const interruptedContent =
            (accumulatedText ? `${accumulatedText}\n\n` : "") +
            "⚠️ Response interrupted. Please try again."
          if (placeholderCreated) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMsgId ? { ...m, content: interruptedContent } : m
              )
            )
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: streamingMsgId,
                role: "ai" as const,
                content: interruptedContent,
                timestamp: new Date().toISOString(),
              },
            ])
          }
        } finally {
          isStreamingRef.current = false
          abortControllerRef.current = null
        }
        return
      }

      const data = await res.json().catch(() => null)
      if (!data) {
        throw new Error("Invalid response received from server")
      }
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
          const fullContent = data.ai_message.content || ""
          const targetMsgId = data.ai_message.id

          if (!fullContent || fullContent.length < 30) {
            setMessages((prev) => [...prev, data.ai_message])
            if (effectiveConvId) {
              messagesByConvRef.current[effectiveConvId] = [
                ...messages,
                userMessage,
                data.ai_message,
              ]
            }
          } else {
            const placeholderMsg = { ...data.ai_message, content: "" }
            setMessages((prev) => [...prev, placeholderMsg])
            setLoading(false)

            const tokens = fullContent.split(/(\s+)/)
            let curr = ""
            let i = 0

            const timer = setInterval(() => {
              const take = Math.min(4, tokens.length - i)
              for (let k = 0; k < take; k++) {
                curr += tokens[i + k] || ""
              }
              i += take

              setMessages((prev) =>
                prev.map((m) => (m.id === targetMsgId ? { ...m, content: curr } : m))
              )

              if (i >= tokens.length) {
                clearInterval(timer)
                setMessages((prev) =>
                  prev.map((m) => (m.id === targetMsgId ? { ...m, content: fullContent } : m))
                )
                if (effectiveConvId) {
                  messagesByConvRef.current[effectiveConvId] = [
                    ...messages,
                    userMessage,
                    data.ai_message,
                  ]
                }
              }
            }, 18)
          }
        }
      } else {
        throw new Error(data.error || "Failed to send message")
      }
    } catch (error: any) {
      if (controller.signal.aborted || error?.name === "AbortError") {
        setLoading(false)
        return
      }
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
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
        credentials: "include",
      })
      if (!res.ok) return []
      const data = await res.json().catch(() => null)
      const msgs = (data && Array.isArray(data.messages)) ? data.messages : []
      messagesByConvRef.current[conversationId] = msgs
      return msgs
    } catch (e) {
      console.error("Failed to load conversation messages", e)
      return messagesByConvRef.current[conversationId] || []
    }
  }

  async function selectConversation(conversationId: string) {
    if (!conversationId) return
    const activeId = activeConvIdRef.current || activeConversationId
    if (conversationId === activeId) return

    // Persist currently active conversation's messages before switching
    if (activeId) {
      messagesByConvRef.current[activeId] = messages
    }

    activeConvIdRef.current = conversationId
    setActiveConversationId(conversationId)
    setMessages(messagesByConvRef.current[conversationId] || [])
    setActionMenuConvId(null)
    setEditingConvId(null)

    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setSidebarOpen(false)
    }

    const msgs = await loadConversationMessages(conversationId)
    if ((activeConvIdRef.current || activeConversationId) === conversationId) {
      setMessages(msgs)
    }
  }

  async function newConversation() {
    const currentId = activeConvIdRef.current || activeConversationId
    if (currentId && messages.length > 0) {
      messagesByConvRef.current[currentId] = messages
    }

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
        credentials: "include",
      })
      if (!res.ok) {
        if (res.status === 401) router.replace("/login")
        return
      }
      const data = await res.json().catch(() => null)
      if (data && data.success && data.conversation) {
        const newId = String(data.conversation.id)
        setConversations((prev) => [data.conversation, ...prev.filter((c) => String(c.id) !== newId)])
        activeConvIdRef.current = newId
        setActiveConversationId(newId)
        setMessages([])
        messagesByConvRef.current[newId] = []
        setInput("")
        setActionMenuConvId(null)
        setEditingConvId(null)
        return
      }
    } catch (e) {
      console.error("Failed to create new conversation via API", e)
    }

    setMessages([])
    setActiveConversationId(null)
    activeConvIdRef.current = null
    setInput("")
    setActionMenuConvId(null)
    setEditingConvId(null)
  }

  function deleteConversation(id: string) {
    const target = conversations.find((c) => String(c.id) === String(id)) || { id, title: "this conversation" }
    setDeleteModalConv(target)
    setActionMenuConvId(null)
    setContextMenu(null)
  }

  async function confirmDeleteConversation() {
    if (!deleteModalConv || isDeleting) return
    const id = String(deleteModalConv.id)
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (data && data.success) {
        setConversations((prev) => prev.filter((c) => String(c.id) !== id))
        delete messagesByConvRef.current[id]

        const currentActive = activeConvIdRef.current || activeConversationId
        const wasActive = currentActive === id

        setDeleteModalConv(null)
        setActionMenuConvId(null)

        if (wasActive) {
          await newConversation()
        }
      } else {
        console.error("Delete conversation failed", data?.error)
      }
    } catch (e) {
      console.error("Error deleting conversation", e)
    } finally {
      setIsDeleting(false)
      setDeleteModalConv(null)
    }
  }

  async function togglePinConversation(id: string, pinned: boolean) {
    await fetch(`/api/conversations/${encodeURIComponent(id)}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
      credentials: "include",
    })
    setConversations((prev) =>
      prev.map((c) => (String(c.id) === String(id) ? { ...c, pinned } : c))
    )
    setContextMenu(null)
    setActionMenuConvId(null)
  }

  async function renameConversation(id: string, newTitle: string) {
    const trimmed = (newTitle || "").trim()
    if (!trimmed) return
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
        credentials: "include",
      })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (data && data.success) {
        setConversations((prev) =>
          prev.map((c) => (String(c.id) === String(id) ? { ...c, title: trimmed } : c))
        )
      }
    } catch (e) {
      console.error("Failed to rename conversation", e)
    }
    setContextMenu(null)
    setActionMenuConvId(null)
  }

  async function handleSaveRename(id: string) {
    const trimmed = editingTitle.trim()
    if (!trimmed) {
      setEditingConvId(null)
      return
    }

    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
        credentials: "include",
      })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (data && data.success) {
        setConversations((prev) =>
          prev.map((c) => (String(c.id) === String(id) ? { ...c, title: trimmed } : c))
        )
      }
    } catch (e) {
      console.error("Failed to rename conversation", e)
    } finally {
      setEditingConvId(null)
      setEditingTitle("")
      setActionMenuConvId(null)
    }
  }

  function filteredConversations() {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter((c) => String(c.title || "").toLowerCase().includes(q))
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
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000

    const t = date.getTime()
    if (t >= startOfToday) return "Today"
    if (t >= startOfYesterday) return "Yesterday"
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  function getConversationSectionKey(value: string): "Today" | "Yesterday" | "Previous 7 Days" | "Older" {
    if (!value) return "Older"
    const date = new Date(value)
    if (isNaN(date.getTime())) return "Older"

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
    const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000

    const t = date.getTime()
    if (t >= startOfToday) return "Today"
    if (t >= startOfYesterday) return "Yesterday"
    if (t >= startOf7Days) return "Previous 7 Days"
    return "Older"
  }

  function groupConversationsBySection(list: any[]) {
    const sections: { key: string; title: string; items: any[] }[] = []
    const order: ("Today" | "Yesterday" | "Previous 7 Days" | "Older")[] = [
      "Today",
      "Yesterday",
      "Previous 7 Days",
      "Older",
    ]
    const map = new Map<string, any[]>()
    for (const key of order) map.set(key, [])
    for (const c of list) {
      const key = getConversationSectionKey(c.updatedAt || c.createdAt)
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
      isSuccess =
        !card.classList.contains("eligibility-card-warning") &&
        !card.classList.contains("eligibility-card-error") &&
        !card.classList.contains("eligibility-dashboard-ineligible") &&
        !card.classList.contains("eligibility-card-ineligible")
      const bodyEl = card.querySelector(".eligibility-card-body") as HTMLElement | null
      if (bodyEl && bodyEl.innerHTML.trim().length > 20) {
        renderedReportHtml = bodyEl.innerHTML
      } else if (card.classList.contains("eligibility-dashboard")) {
        const clone = card.cloneNode(true) as HTMLElement
        const dlBtn = clone.querySelector(".btn-download-report")
        if (dlBtn) dlBtn.remove()
        const csvBtn = clone.querySelector(".btn-download-csv")
        if (csvBtn) csvBtn.remove()
        const actionsGroup = clone.querySelector(".eligibility-actions-group")
        if (actionsGroup) actionsGroup.remove()
        clone
          .querySelectorAll(".btn-select-bank, .btn-table-select-bank, .eligibility-recalculate-card")
          .forEach((el) => el.remove())
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
          #creditwise-pdf-root .policy-constraints-card,
          #creditwise-pdf-root .ineligible-banks-table-card,
          #creditwise-pdf-root .eligibility-guidance-card,
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
          #creditwise-pdf-root .constraints-header,
          #creditwise-pdf-root .guidance-header,
          #creditwise-pdf-root .next-step-title {
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            margin-bottom: 8px !important;
          }
          #creditwise-pdf-root .applicant-summary-tiles-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 7px !important;
            margin-top: 6px !important;
          }
          #creditwise-pdf-root .applicant-summary-tile {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
            padding: 6px 9px !important;
          }
          #creditwise-pdf-root .applicant-summary-tile.ineligible-tile {
            background: #fff5f5 !important;
            border-color: #fecaca !important;
          }
          #creditwise-pdf-root .tile-icon-box {
            font-size: 13px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 24px !important;
            height: 24px !important;
            background: #ffffff !important;
            border-radius: 5px !important;
            border: 1px solid #e2e8f0 !important;
          }
          #creditwise-pdf-root .tile-content {
            display: flex !important;
            flex-direction: column !important;
            min-width: 0 !important;
          }
          #creditwise-pdf-root .summary-tile-label {
            font-size: 9px !important;
            color: #64748b !important;
            text-transform: uppercase !important;
            font-weight: 600 !important;
          }
          #creditwise-pdf-root .summary-tile-val {
            font-size: 11px !important;
            color: #0f172a !important;
            font-weight: 700 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          #creditwise-pdf-root .top-recommended-bank-card.highlight-section {
            border: 1.5px solid #86efac !important;
            background: #fcfdfc !important;
          }
          #creditwise-pdf-root .highlight-star-badge {
            background: #15803d !important;
            color: #ffffff !important;
            font-size: 9px !important;
            font-weight: 700 !important;
            padding: 2px 7px !important;
            border-radius: 4px !important;
          }
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
          #creditwise-pdf-root .policy-constraints-card {
            background: #fef2f2 !important;
            border: 1px solid #fecaca !important;
          }
          #creditwise-pdf-root .constraints-header { color: #991b1b !important; }
          #creditwise-pdf-root .constraint-item {
            display: flex !important;
            gap: 8px !important;
            margin-bottom: 6px !important;
            background: #ffffff !important;
            border: 1px solid #fee2e2 !important;
            border-radius: 6px !important;
            padding: 6px 10px !important;
          }
          #creditwise-pdf-root .constraint-title { font-weight: 700 !important; font-size: 11px !important; color: #991b1b !important; }
          #creditwise-pdf-root .constraint-desc { font-size: 10.5px !important; color: #475569 !important; }
          #creditwise-pdf-root .ineligible-banks-table-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; }
          #creditwise-pdf-root .status-pill-ineligible { background: #fee2e2 !important; color: #991b1b !important; padding: 1px 5px !important; border-radius: 3px !important; font-size: 9.5px !important; font-weight: 600 !important; }
          #creditwise-pdf-root .eligibility-guidance-card { background: #f0f9ff !important; border: 1px solid #bae6fd !important; }
          #creditwise-pdf-root .guidance-header { color: #0369a1 !important; }
          #creditwise-pdf-root .guidance-item {
            display: flex !important;
            gap: 8px !important;
            margin-bottom: 6px !important;
            background: #ffffff !important;
            border: 1px solid #e0f2fe !important;
            border-radius: 6px !important;
            padding: 6px 10px !important;
          }
          #creditwise-pdf-root .guidance-title { font-weight: 700 !important; font-size: 11px !important; color: #0369a1 !important; }
          #creditwise-pdf-root .guidance-desc { font-size: 10.5px !important; color: #475569 !important; }
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

  function handleDownloadCsv(buttonEl?: HTMLElement | null, messageId?: string | null) {
    let targetMsg = messageId ? messages.find((m) => m.id === messageId) : null
    if (!targetMsg) {
      targetMsg = [...messages].reverse().find((m) => detectEligibilityResult(m.content))
    }
    if (!targetMsg || !targetMsg.content) {
      alert("No eligibility sheet found to download.")
      return
    }

    const content = targetMsg.content
    const applicant = extractApplicantSummaryData(content, messages)

    const tableRows: Array<{ bank: string; status: string; cibil: string; tenure: string; emi: string }> = []
    const ineligibleRows: Array<{ lender: string; result: string; reason: string }> = []

    const lines = content.split(/\r?\n/)
    let inEligibleTable = false
    let inComparisonTable = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |")) {
        inEligibleTable = true
        inComparisonTable = false
        continue
      }
      if (
        line.includes("| Lender | Result | Key Reason |") ||
        line.includes("| Bank | Result | Key Reason |") ||
        line.includes("| Bank | Status | Reason |")
      ) {
        inComparisonTable = true
        inEligibleTable = false
        continue
      }

      if (inEligibleTable) {
        if (line.startsWith("| :---") || line.startsWith("|:---") || line.includes("---")) continue
        if (line.startsWith("|") && line.endsWith("|")) {
          const parts = line.slice(1, -1).split("|").map((p: string) => p.trim())
          if (parts.length >= 5) {
            tableRows.push({
              bank: parts[0].replace(/\*\*/g, "").trim(),
              status: parts[1].replace(/[`✅✓]/g, "").trim(),
              cibil: parts[2].replace(/\*\*/g, "").trim(),
              tenure: parts[3].replace(/\*\*/g, "").trim(),
              emi: parts[4].replace(/[*`]/g, "").trim(),
            })
          }
        } else if (line.length > 0) {
          inEligibleTable = false
        }
      } else if (inComparisonTable) {
        if (line.startsWith("| :---") || line.startsWith("|:---") || line.includes("---")) continue
        if (line.startsWith("|") && line.endsWith("|")) {
          const parts = line.slice(1, -1).split("|").map((p: string) => p.trim())
          if (parts.length >= 3) {
            ineligibleRows.push({
              lender: parts[0].replace(/\*\*/g, "").trim(),
              result: parts[1].replace(/[`❌⚠️]/g, "").trim(),
              reason: parts[2].replace(/\*\*/g, "").trim(),
            })
          }
        } else if (line.length > 0) {
          inComparisonTable = false
        }
      }
    }

    const escapeCsv = (val: string) => `"${String(val || "").replace(/"/g, '""')}"`
    const todayStr = new Date().toLocaleDateString("en-IN")
    const refId = "CW-SHEET-" + Math.floor(100000 + Math.random() * 900000)

    const csvLines: string[] = []
    csvLines.push(`Personal Loan Eligibility Assessment Sheet`)
    csvLines.push(`Reference ID,${escapeCsv(refId)},Date,${escapeCsv(todayStr)}`)
    csvLines.push(``)
    csvLines.push(`Applicant Profile Summary`)
    csvLines.push(`Parameter,Value`)
    csvLines.push(`Employer,${escapeCsv(applicant.employer)}`)
    csvLines.push(`Monthly Salary,${escapeCsv(applicant.salary)}`)
    csvLines.push(`CIBIL Credit Score,${escapeCsv(applicant.cibil)}`)
    csvLines.push(`Requested Loan Amount,${escapeCsv(applicant.loanAmount)}`)
    csvLines.push(`Repayment Tenure,${escapeCsv(applicant.tenure)}`)
    csvLines.push(`Existing Monthly EMIs,${escapeCsv(applicant.existingEmi)}`)
    csvLines.push(`Applicant Age,${escapeCsv(applicant.age)}`)
    csvLines.push(``)

    if (tableRows.length > 0) {
      csvLines.push(`Eligible Partner Banks`)
      csvLines.push(`#,Bank Name,Status,Required CIBIL,Tenure,Estimated Monthly EMI`)
      tableRows.forEach((r, idx) => {
        csvLines.push(`${idx + 1},${escapeCsv(r.bank)},${escapeCsv(r.status)},${escapeCsv(r.cibil)},${escapeCsv(r.tenure)},${escapeCsv(r.emi)}`)
      })
    } else if (ineligibleRows.length > 0) {
      csvLines.push(`Evaluated Partner Lenders (Eligibility Not Met)`)
      csvLines.push(`#,Lender,Status,Policy Assessment Reason`)
      ineligibleRows.forEach((r, idx) => {
        csvLines.push(`${idx + 1},${escapeCsv(r.lender)},${escapeCsv(r.result)},${escapeCsv(r.reason)}`)
      })
    } else {
      csvLines.push(`Partner Bank Status`)
      csvLines.push(`Result,"No partner banks currently match the strict underwriting criteria for this profile."`)
    }

    const csvContent = "\uFEFF" + csvLines.join("\r\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Loan_Eligibility_Sheet_${refId}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function detectEligibilityResult(content: string) {
    if (!content || typeof content !== "string") return null

    // Check if message is a structured eligibility evaluation report
    const hasTable =
      content.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |") ||
      content.includes("| Bank | Result | Key Reason |") ||
      content.includes("| Lender | Result | Key Reason |")
    const hasApplicantSummary =
      content.includes("Applicant Summary") ||
      content.includes("Applicant Input Summary") ||
      content.includes("Applicant Profile") ||
      content.includes("Section 2: Input Summary")
    const isEligibilityAssessment =
      (hasTable && (hasApplicantSummary || content.includes("Partner Bank Policy Evaluation Results") || content.includes("Loan Eligibility Assessment Result") || content.includes("Loan Eligibility Across Partner Banks"))) ||
      content.includes("Loan Eligibility Assessment Result") ||
      content.includes("Loan Eligibility Across Partner Banks") ||
      content.includes("Personal Loan Eligibility Assessment") ||
      content.includes("Personal Loan Eligibility Result:") ||
      content.includes("Personal Loan Eligibility Evaluation Complete") ||
      content.includes("Assessment Outcome: No Partner Banks Currently Eligible") ||
      (content.includes("Section 3: Eligibility & FOIR/EMI Calculation") && (hasTable || hasApplicantSummary))

    // Also detect natural conversational ineligibility messages or early definitive policy rejections
    const isConversationalIneligibility =
      /(?:currently\s+not\s+eligible|not\s+eligible\s+for\s+(?:a\s+)?(?:personal\s+)?loan|policies\s+(?:do\s+not|may\s+not)\s+support|do\s+not\s+meet\s+(?:the\s+)?(?:eligibility|criteria)|ineligible\s+for\s+personal\s+loans?|statutory\s+age\s+criteria|none\s+of\s+our\s+partner\s+banks\s+qualify)/i.test(content) &&
      !/(?:\?|please\s+provide|what\s+is\s+your|could\s+you\s+share)/i.test(content)

    if (!isEligibilityAssessment && !isConversationalIneligibility) return null

    // Check if it's a warning / error / ineligible result
    const isWarningOrError =
      isConversationalIneligibility ||
      content.includes("No Partner Banks Currently Eligible") ||
      content.includes("Policy Criteria Not Met") ||
      content.includes("❌ NOT ELIGIBLE") ||
      content.includes("❌ Not Eligible") ||
      content.includes("❌ Loan Eligibility Assessment Result") ||
      content.includes("none of our partner banks qualify") ||
      content.includes("Key Policy Constraints Identified") ||
      content.includes("Assessment Outcome: No Partner Banks Currently Eligible") ||
      content.includes("Input Required / Conditionally Eligible") ||
      /\b(?:not\s+eligible|currently\s+not\s+eligible|ineligible|0\s+partner\s+banks?|0\s+bank\(s\)\s+qualify)\b/i.test(content)

    const hasEligibleTableRows =
      hasTable && /\|\s*\*\*[^*]+\*\*\s*\|\s*`?(?:✅\s*)?(?:ELIGIBLE|Eligible)`?/i.test(content)

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

  function extractApplicantSummaryData(content: string, allMessages?: any[]) {
    const extractField = (...patterns: RegExp[]) => {
      for (const pattern of patterns) {
        const match = content.match(pattern)
        if (match && match[1]) {
          let val = match[1]
            .replace(/\*\*/g, "")
            .replace(/\*\(.*?\)\*/g, "")
            .replace(/\(.*?\)/g, "")
            .replace(/\s*\/ month/i, "")
            .trim()
          if (val && val !== "-" && !/^not\s+(?:provided|specified|available)$/i.test(val)) {
            return val
          }
        }
      }
      return ""
    }

    let employer = extractField(
      /\|\s*(?:\*\*)?Employer(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Employer(?:\s*\/\s*Company)?(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Company(?:\s*Name)?(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i,
      /profile at \*\*([^*]+)\*\*/i
    )
    let salary = extractField(
      /\|\s*(?:\*\*)?(?:Net\s+Take-Home\s*(?:\(NTH\))?\s*)?Salary(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /\|\s*(?:\*\*)?Monthly Take-Home Salary(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?(?:Net\s+Take-Home\s*(?:\(NTH\))?\s*)?Salary(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Monthly(?:\s*Take-Home)?\s*Salary(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Monthly Income(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i
    )
    let cibil = extractField(
      /\|\s*(?:\*\*)?CIBIL(?:\s*Credit)?\s*Score(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?CIBIL(?:\s*Credit)?\s*Score(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Credit Score(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i
    )
    let loanAmount = extractField(
      /\|\s*(?:\*\*)?Requested Loan Amount(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /\|\s*(?:\*\*)?Loan Amount(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Requested Loan Amount(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Loan Amount(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i
    )
    let tenure = extractField(
      /\|\s*(?:\*\*)?Repayment Tenure(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /\|\s*(?:\*\*)?Tenure(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Repayment Tenure(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Tenure(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i
    )
    let existingEmi = extractField(
      /\|\s*(?:\*\*)?(?:Actual\s+)?Existing\s+(?:Monthly\s+)?EMIs?(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /\|\s*(?:\*\*)?Existing Monthly EMIs(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?(?:Actual\s+)?Existing\s+(?:Monthly\s+)?EMIs?(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Existing EMIs?(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i
    )
    let age = extractField(
      /\|\s*(?:\*\*)?Applicant Age(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /\|\s*(?:\*\*)?Age(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Applicant Age(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i,
      /(?:-\s*|\*\s*)?(?:\*\*)?Age(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i
    )

    // Fallback: If any field is missing, search backwards through all messages
    const msgs = allMessages || messages
    if (Array.isArray(msgs) && msgs.length > 0) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i]
        if (!m || !m.content) continue
        const txt = m.content
        if (!employer) {
          const empM =
            txt.match(/\|\s*(?:\*\*)?Employer(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i) ||
            txt.match(/(?:-\s*|\*\s*)?(?:\*\*)?Employer(?:\*\*)?:\s*(?:\*\*)?([^*\r\n|]+)/i)
          if (empM && empM[1] && !/^not\s+provided/i.test(empM[1])) employer = empM[1].replace(/\*\*/g, "").trim()
        }
        if (!salary) {
          const salM =
            txt.match(/\|\s*(?:\*\*)?Monthly Take-Home Salary(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i) ||
            txt.match(/(?:salary|take-home|income)\s*(?:is|of)?\s*(?:₹|Rs\.?)?\s*([\d,]+)/i)
          if (salM && salM[1] && !/^not\s+provided/i.test(salM[1])) {
            const val = salM[1].replace(/\*\*/g, "").trim()
            salary = val.startsWith("₹") ? val : `₹${val}`
          }
        }
        if (!cibil) {
          const cibM =
            txt.match(/\|\s*(?:\*\*)?CIBIL(?:\s*Credit)?\s*Score(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i) ||
            txt.match(/\b(?:cibil|credit score)\s*(?:is|of)?\s*([3-9]\d{2})\b/i)
          if (cibM && cibM[1] && !/^not\s+provided/i.test(cibM[1])) cibil = cibM[1].replace(/\*\*/g, "").trim()
        }
        if (!loanAmount) {
          const loanM =
            txt.match(/\|\s*(?:\*\*)?Requested Loan Amount(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i) ||
            txt.match(/\b(?:loan|amount)\s*(?:of|is)?\s*(?:₹|Rs\.?)?\s*([\d,]+(?:\s*(?:lakh|lac|k))?)/i)
          if (loanM && loanM[1] && !/^not\s+provided/i.test(loanM[1])) {
            const val = loanM[1].replace(/\*\*/g, "").trim()
            loanAmount = val.startsWith("₹") ? val : `₹${val}`
          }
        }
        if (!tenure) {
          const tenM =
            txt.match(/\|\s*(?:\*\*)?Repayment Tenure(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i) ||
            txt.match(/\b(\d+\s*(?:months|years|year|mo))\b/i)
          if (tenM && tenM[1] && !/^not\s+provided/i.test(tenM[1])) tenure = tenM[1].replace(/\*\*/g, "").trim()
        }
        if (!existingEmi) {
          const emiM =
            txt.match(/\|\s*(?:\*\*)?Existing Monthly EMIs(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i) ||
            txt.match(/\b(?:existing\s+)?emi\s*(?:is|of)?\s*(?:₹|Rs\.?)?\s*([\d,]+)/i)
          if (emiM && emiM[1] && !/^not\s+provided/i.test(emiM[1])) {
            const val = emiM[1].replace(/\*\*/g, "").trim()
            existingEmi = val.startsWith("₹") ? val : `₹${val}`
          }
        }
        if (!age) {
          const ageM =
            txt.match(/\|\s*(?:\*\*)?Applicant Age(?:\*\*)?\s*\|\s*(?:\*\*)?([^*|\r\n]+?)(?:\*\*)?\s*\|/i) ||
            txt.match(/\b(?:age|years\s*old)\s*(?:is|of)?\s*(\d{2})\b/i)
          if (ageM && ageM[1] && !/^not\s+provided/i.test(ageM[1])) {
            const val = ageM[1].replace(/\*\*/g, "").trim()
            age = val.includes("year") ? val : `${val} years`
          }
        }
      }
    }

    return { employer, salary, cibil, loanAmount, tenure, existingEmi, age }
  }

  function renderApplicantSummaryCardHtml(applicantData: any, isIneligible: boolean = false): string {
    const { employer, salary, cibil, loanAmount, tenure, existingEmi, age } = applicantData
    const isDarkIneligible = isIneligible ? "ineligible-summary" : ""

    return `
      <div class="applicant-summary-card ${isDarkIneligible}">
        <div class="applicant-summary-header">
          <div class="applicant-summary-header-left">
            <i class="bi bi-person-vcard-fill"></i>
            <span>Applicant Profile & Financial Summary</span>
          </div>
          <span class="applicant-summary-badge">
            <i class="bi bi-shield-lock-fill"></i> Verified Applicant Profile
          </span>
        </div>
        <div class="applicant-summary-grid">
          <div class="applicant-summary-tile">
            <div class="summary-tile-icon icon-employer">
              <i class="bi bi-building"></i>
            </div>
            <div class="summary-tile-content">
              <span class="summary-tile-label">Employer / Company</span>
              <span class="summary-tile-val" title="${escapeHtml(employer || "Not provided")}">${escapeHtml(employer || "Not provided")}</span>
            </div>
          </div>
          <div class="applicant-summary-tile">
            <div class="summary-tile-icon icon-salary">
              <i class="bi bi-cash-stack"></i>
            </div>
            <div class="summary-tile-content">
              <span class="summary-tile-label">Monthly Take-Home</span>
              <span class="summary-tile-val" title="${escapeHtml(salary || "Not provided")}">${escapeHtml(salary || "Not provided")}</span>
            </div>
          </div>
          <div class="applicant-summary-tile">
            <div class="summary-tile-icon icon-cibil">
              <i class="bi bi-speedometer2"></i>
            </div>
            <div class="summary-tile-content">
              <span class="summary-tile-label">CIBIL Credit Score</span>
              <span class="summary-tile-val" title="${escapeHtml(cibil || "Not provided")}">${escapeHtml(cibil || "Not provided")}</span>
            </div>
          </div>
          <div class="applicant-summary-tile">
            <div class="summary-tile-icon icon-loan">
              <i class="bi bi-wallet2"></i>
            </div>
            <div class="summary-tile-content">
              <span class="summary-tile-label">Requested Loan</span>
              <span class="summary-tile-val" title="${escapeHtml(loanAmount || "Not provided")}">${escapeHtml(loanAmount || "Not provided")}</span>
            </div>
          </div>
          <div class="applicant-summary-tile">
            <div class="summary-tile-icon icon-tenure">
              <i class="bi bi-calendar3"></i>
            </div>
            <div class="summary-tile-content">
              <span class="summary-tile-label">Repayment Tenure</span>
              <span class="summary-tile-val" title="${escapeHtml(tenure || "Not provided")}">${escapeHtml(tenure || "Not provided")}</span>
            </div>
          </div>
          <div class="applicant-summary-tile">
            <div class="summary-tile-icon icon-emi">
              <i class="bi bi-credit-card-2-front"></i>
            </div>
            <div class="summary-tile-content">
              <span class="summary-tile-label">Existing EMIs</span>
              <span class="summary-tile-val" title="${escapeHtml(existingEmi || "₹0 / None")}">${escapeHtml(existingEmi || "₹0 / None")}</span>
            </div>
          </div>
          <div class="applicant-summary-tile">
            <div class="summary-tile-icon icon-age">
              <i class="bi bi-person-badge"></i>
            </div>
            <div class="summary-tile-content">
              <span class="summary-tile-label">Applicant Age</span>
              <span class="summary-tile-val" title="${escapeHtml(age || "Not provided")}">${escapeHtml(age || "Not provided")}</span>
            </div>
          </div>
        </div>
      </div>
    `
  }

  function renderEligibilityDashboard(content: string, messageId: string, isSuccessHint?: boolean): string | null {
    try {
      if (!content || typeof content !== "string") {
        return null
      }

      const isEligibilityDoc =
        content.includes("Applicant Summary") ||
        content.includes("Applicant Input Summary") ||
        content.includes("Applicant Profile") ||
        content.includes("Section 2: Input Summary") ||
        content.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |") ||
        content.includes("| Bank | Result | Key Reason |") ||
        content.includes("| Lender | Result | Key Reason |") ||
        content.includes("Personal Loan Eligibility") ||
        content.includes("Loan Eligibility Assessment Result") ||
        content.includes("Loan Eligibility Across Partner Banks") ||
        content.includes("Assessment Outcome") ||
        /(?:not\s+eligible|qualifying\s+partner\s+banks?|eligible\s+partner\s+banks?)/i.test(content)

      if (!isEligibilityDoc) {
        return null
      }

      // 1. Extract ALL collected user information
      const applicantData = extractApplicantSummaryData(content, messages)
      const hasAnyProfileField = Boolean(
        applicantData.salary ||
        applicantData.cibil ||
        applicantData.employer ||
        applicantData.loanAmount ||
        applicantData.tenure ||
        applicantData.existingEmi ||
        applicantData.age
      )

      if (!hasAnyProfileField && !content.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |") && !content.includes("| Lender | Result | Key Reason |")) {
        return null
      }

      // 2. Parse Partner Banks Table
      const tableRows: Array<{
        bank: string
        status: string
        cibil: string
        tenure: string
        emi: string
        isEligible: boolean
        isReview: boolean
      }> = []

      const lines = content.split(/\r?\n/)
      let inTable = false
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (
          line.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |") ||
          line.includes("| Bank | Result | Key Reason |") ||
          line.includes("| Lender | Result | Key Reason |")
        ) {
          inTable = true
          continue
        }
        if (inTable) {
          if (line.startsWith("| :---") || line.startsWith("|:---") || line.includes("---")) {
            continue
          }
          if (line.startsWith("|") && line.endsWith("|")) {
            const rawParts = line.slice(1, -1).split("|").map((p) => p.trim())
            if (rawParts.length >= 3) {
              const bank = rawParts[0].replace(/\*\*/g, "").replace(/🌟.*$/, "").trim()
              const statusRaw = rawParts[1].replace(/\*\*/g, "").trim()
              const isRowEligible =
                /ELIGIBLE|APPROVED|POTENTIALLY ELIGIBLE/i.test(statusRaw) &&
                !/NOT_ELIGIBLE|INELIGIBLE|REJECT/i.test(statusRaw)
              const isReview = /NEEDS_REVIEW|REVIEW|UNDERWRITING/i.test(statusRaw)
              const status = isRowEligible ? "Eligible" : isReview ? "Underwriting Review" : "Not Eligible"
              const cibilVal = (rawParts[2] || "-").replace(/\*\*/g, "").trim()
              const tenureVal = (rawParts[3] || "-").replace(/\*\*/g, "").trim()
              const emiVal = (rawParts[4] || "-").replace(/\*\*/g, "").trim()
              tableRows.push({
                bank,
                status,
                cibil: cibilVal,
                tenure: tenureVal,
                emi: emiVal,
                isEligible: isRowEligible,
                isReview,
              })
            }
          } else if (line.length > 0) {
            inTable = false
          }
        }
      }

      const eligibleRows = tableRows.filter((r) => r.isEligible || r.isReview)
      const ineligibleRows = tableRows.filter((r) => !r.isEligible && !r.isReview)

      // Overall Eligibility:
      // Eligible for at least 1 bank -> GREEN CARD
      // 0 eligible banks -> RED CARD
      const isEligible = eligibleRows.length > 0 && isSuccessHint !== false

      const msgId = escapeHtml(String(messageId || ""))

      const getBadgeText = (name: string) => {
        if (!name) return "PARTNER<br>BANK"
        const clean = name.replace(/\([^)]*\)/g, "").replace(/\b(?:bank|finance|capital|ltd|limited)\b/gi, "").trim()
        const words = clean.split(/\s+/).filter(Boolean)
        if (words.length === 0) return "PARTNER<br>BANK"
        if (words.length === 1) return words[0].toUpperCase()
        return `${words[0].toUpperCase()}<br>${words[1].toUpperCase()}`
      }

      // =========================================================================
      // CASE 1: USER IS ELIGIBLE FOR AT LEAST A SINGLE BANK (GREEN CARD)
      // =========================================================================
      if (isEligible) {
        let topBankName = ""
        const recMatch =
          content.match(/###\s*🏆\s*(?:Top Recommended Bank|Eligible Partner Bank):\s*\*\*([^*]+)\*\*/i) ||
          content.match(/-\s*\*\*Bank Name\*\*:\s*\*\*([^*]+)\*\*/i) ||
          content.match(/\*\*([^*]+)\*\*\s*🌟\s*\*(?:Highly Recommended|Top Match)\*/i)
        if (recMatch) {
          topBankName = recMatch[1].trim()
        } else if (eligibleRows.length > 0) {
          topBankName = eligibleRows[0].bank
        }

        let topBankEmi = ""
        const emiMatch =
          content.match(/Estimated Monthly EMI(?:\*\*)?:\s*(?:\*\*)?(₹[\d,]+)/i) ||
          content.match(/with an estimated monthly EMI of\s*(?:\*\*)?(₹[\d,]+)/i)
        if (emiMatch) {
          topBankEmi = emiMatch[1].trim()
        } else if (eligibleRows.length > 0 && eligibleRows[0].emi && eligibleRows[0].emi !== "-") {
          topBankEmi = eligibleRows[0].emi
        }

        const topRow = eligibleRows.find((r) => r.bank.toLowerCase() === topBankName.toLowerCase()) || eligibleRows[0]
        const topBankTenure = topRow?.tenure && topRow.tenure !== "-" ? topRow.tenure : applicantData.tenure
        const badgeText = getBadgeText(topBankName)
        const bankCount = eligibleRows.length

        let nextStepText = `Reply with your preferred bank (e.g. "${topBankName || "HDFC Bank"}") and city to view verified official branch manager contacts!`
        const nextStepMatch = content.match(/Next Step\*\*:\s*([^\n\r]+)/i)
        if (nextStepMatch) {
          nextStepText = nextStepMatch[1].replace(/\*\*/g, "").trim()
        }

        return `
          <div class="eligibility-dashboard eligibility-card eligibility-card-success" data-message-id="${msgId}">
            <!-- 1. Header Confirmation Banner (Green) -->
            <div class="eligibility-dashboard-banner eligibility-card-banner">
              <div class="eligibility-dashboard-banner-left eligibility-card-banner-left">
                <div class="eligibility-dashboard-banner-icon">
                  <i class="bi bi-shield-check"></i>
                </div>
                <div>
                  <div class="eligibility-dashboard-banner-title">
                    Eligibility Confirmed — ${bankCount} Partner Bank${bankCount === 1 ? "" : "s"} Found
                  </div>
                  <div class="eligibility-dashboard-banner-sub">
                    Based on your profile, we've found ${bankCount} partner bank${bankCount === 1 ? "" : "s"} meeting all personal loan criteria.
                  </div>
                </div>
              </div>
              <div class="eligibility-actions-group">
                <button type="button" class="btn-download-report" data-message-id="${msgId}" title="Download Official Eligibility PDF Report">
                  <i class="bi bi-file-earmark-pdf-fill"></i> Download Report
                </button>
                <button type="button" class="btn-download-csv" data-message-id="${msgId}" title="Download Eligibility Sheet as CSV">
                  <i class="bi bi-file-earmark-spreadsheet-fill"></i> Download Sheet
                </button>
              </div>
            </div>

            <!-- 2. Applicant Profile Summary (Contains ALL collected user's information) -->
            ${renderApplicantSummaryCardHtml(applicantData, false)}

            <!-- 3. Top Recommended Bank (Highlight Section) -->
            ${topBankName ? `
            <div class="top-recommended-bank-card highlight-section">
              <div class="highlight-badge-bar">
                <div class="highlight-star-badge">
                  <i class="bi bi-stars"></i>
                  <span>TOP RECOMMENDED PARTNER BANK</span>
                </div>
                <span class="badge-best-match"><i class="bi bi-award-fill"></i> #1 Best Match for Your Profile</span>
              </div>
              <div class="top-recommended-split">
                <div class="top-recommended-left">
                  <div class="top-bank-box">
                    <div class="top-bank-badge">
                      ${badgeText}
                    </div>
                    <div class="top-bank-details">
                      <div class="top-bank-title-row">
                        <span class="top-bank-name">${escapeHtml(topBankName)}</span>
                        <span class="top-bank-status-pill"><i class="bi bi-patch-check-fill"></i> Pre-Qualified Match</span>
                      </div>
                      <div class="top-bank-emi-card">
                        <span class="top-bank-emi-label">Estimated Monthly EMI</span>
                        <span class="top-bank-emi-amount">${escapeHtml(topBankEmi || "Competitive ROI")} <span class="emi-freq">/ month</span></span>
                        ${topBankTenure ? `<span class="top-bank-emi-sub"><i class="bi bi-clock-history"></i> Tenure: ${escapeHtml(topBankTenure)}</span>` : ""}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="top-recommended-right">
                  <div class="top-bank-why-title"><i class="bi bi-stars"></i> Why is this your top recommendation?</div>
                  <div class="top-bank-why-list">
                    <div class="top-bank-why-item">
                      <i class="bi bi-check2-circle"></i>
                      <span>Meets 100% of policy criteria based on your profile</span>
                    </div>
                    <div class="top-bank-why-item">
                      <i class="bi bi-check2-circle"></i>
                      <span>Optimal debt-to-income (FOIR) & CIBIL alignment</span>
                    </div>
                    <div class="top-bank-why-item">
                      <i class="bi bi-check2-circle"></i>
                      <span>Fastest branch verification & direct manager connect</span>
                    </div>
                  </div>
                  <div class="top-bank-cta-row">
                    <button type="button" class="btn-select-bank" data-bank-name="${escapeHtml(topBankName)}">
                      Proceed with ${escapeHtml(topBankName)} <i class="bi bi-arrow-right"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>` : ""}

            <!-- 4. Eligible Partner Banks Table Card -->
            <div class="eligible-banks-table-card">
              <div class="table-card-header">
                <i class="bi bi-bank2"></i>
                <span>Eligible Partner Banks (${eligibleRows.length})</span>
              </div>
              <div class="table-responsive-wrapper">
                <table class="eligibility-table">
                  <thead>
                    <tr>
                      <th class="col-index">#</th>
                      <th class="col-bank">Bank</th>
                      <th class="col-status">Status</th>
                      <th class="col-cibil">Min. CIBIL</th>
                      <th class="col-tenure">Tenure</th>
                      <th class="col-emi">Est. EMI</th>
                      <th class="col-action">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${eligibleRows.map((r, i) => `
                      <tr>
                        <td class="col-index">${i + 1}</td>
                        <td class="col-bank">${escapeHtml(r.bank)}</td>
                        <td class="col-status">
                          <span class="${r.isReview ? "status-pill-review" : "status-pill-eligible"}">
                            <i class="bi ${r.isReview ? "bi-exclamation-circle-fill" : "bi-check-circle-fill"}"></i>
                            ${escapeHtml(r.status)}
                          </span>
                        </td>
                        <td class="col-cibil">${escapeHtml(r.cibil)}</td>
                        <td class="col-tenure">${escapeHtml(r.tenure)}</td>
                        <td class="col-emi">${escapeHtml(r.emi)}</td>
                        <td class="col-action">
                          <button type="button" class="btn-table-select-bank" data-bank-name="${escapeHtml(r.bank)}">Select</button>
                        </td>
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
      }

      // =========================================================================
      // CASE 2: USER IS NOT ELIGIBLE (RED CARD)
      // =========================================================================
      const policyConstraints: string[] = []
      let inConstraintsBlock = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (/Key Policy (?:Criteria|Constraints)|Policy Criteria Not Met|Rejection Reasons/i.test(trimmed)) {
          inConstraintsBlock = true
          continue
        }
        if (inConstraintsBlock) {
          if (/^#{1,4}\s+|^\s*---\s*$/i.test(trimmed) && !/Key Policy|Criteria Not Met/i.test(trimmed)) {
            inConstraintsBlock = false
            continue
          }
          if (/^[\*\-]\s+\*\*([^*]+)\*\*:\s*(.+)/i.test(trimmed)) {
            const m = trimmed.match(/^[\*\-]\s+\*\*([^*]+)\*\*:\s*(.+)/i)
            if (m) policyConstraints.push(`<strong>${escapeHtml(m[1])}</strong>: ${escapeHtml(m[2])}`)
          } else if (/^[\*\-]\s+(.+)/i.test(trimmed)) {
            const m = trimmed.match(/^[\*\-]\s+(.+)/i)
            if (m) policyConstraints.push(escapeHtml(m[1].replace(/\*\*/g, "")))
          }
        }
      }

      if (policyConstraints.length === 0) {
        const numSal = Number((applicantData.salary || "").replace(/[^\d]/g, "")) || 0
        const numCibil = Number((applicantData.cibil || "").replace(/[^\d]/g, "")) || 0
        const numEmi = Number((applicantData.existingEmi || "").replace(/[^\d]/g, "")) || 0
        if (numCibil > 0 && numCibil < 700) {
          policyConstraints.push(`<strong>Credit Score (CIBIL)</strong>: Current score (${numCibil}) is below the partner bank minimum cutoff of 700+.`)
        }
        if (numSal > 0 && numSal < 25000) {
          policyConstraints.push(`<strong>Minimum Income Threshold</strong>: Monthly net salary (₹${numSal.toLocaleString("en-IN")}) is below the required partner minimum of ₹25,000.`)
        }
        if (numSal > 0 && numEmi > 0 && (numEmi / numSal) > 0.4) {
          policyConstraints.push(`<strong>FOIR Ratio Exceeded</strong>: Existing debt obligations (₹${numEmi.toLocaleString("en-IN")}) exceed the allowable 40–50% Fixed Obligation to Income Ratio.`)
        }
        if (policyConstraints.length === 0) {
          policyConstraints.push(`<strong>Underwriting Policies</strong>: The current combination of requested loan amount, tenure, and financial parameters did not meet partner lender underwriting rules.`)
        }
      }

      const guidanceSteps: string[] = []
      let inGuidanceBlock = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (/How You Can Become Eligible|Actionable Guidance|Recommendations|Steps to Qualify/i.test(trimmed)) {
          inGuidanceBlock = true
          continue
        }
        if (inGuidanceBlock) {
          if (/^#{1,4}\s+|^\s*---\s*$/i.test(trimmed)) {
            inGuidanceBlock = false
            continue
          }
          if (/^[\*\-]\s+\*\*([^*]+)\*\*:\s*(.+)/i.test(trimmed)) {
            const m = trimmed.match(/^[\*\-]\s+\*\*([^*]+)\*\*:\s*(.+)/i)
            if (m) guidanceSteps.push(`<strong>${escapeHtml(m[1])}</strong>: ${escapeHtml(m[2])}`)
          } else if (/^[\*\-]\s+(.+)/i.test(trimmed)) {
            const m = trimmed.match(/^[\*\-]\s+(.+)/i)
            if (m) guidanceSteps.push(escapeHtml(m[1].replace(/\*\*/g, "")))
          }
        }
      }

      if (guidanceSteps.length === 0) {
        guidanceSteps.push(`<strong>Extend Repayment Tenure</strong>: Opting for 48–60 months lowers your monthly EMI and brings debt within acceptable bank FOIR limits.`)
        guidanceSteps.push(`<strong>Apply with a Salaried Co-Applicant</strong>: Adding an earning spouse or family member pools income and qualifies for higher eligibility.`)
        guidanceSteps.push(`<strong>Lower Requested Loan Amount</strong>: Applying for a lower loan amount significantly increases approval probability.`)
        guidanceSteps.push(`<strong>Reduce Existing Debt</strong>: Clearing short-term credit cards or personal loans reduces existing monthly commitments.`)
      }

      return `
        <div class="eligibility-dashboard eligibility-dashboard-ineligible eligibility-card eligibility-card-ineligible eligibility-card-warning" data-message-id="${msgId}">
          <!-- 1. Red Header Banner -->
          <div class="eligibility-dashboard-banner ineligible-banner eligibility-card-banner">
            <div class="eligibility-dashboard-banner-left eligibility-card-banner-left">
              <div class="eligibility-dashboard-banner-icon ineligible-icon">
                <i class="bi bi-x-octagon-fill"></i>
              </div>
              <div>
                <div class="eligibility-dashboard-banner-title ineligible-title">
                  Eligibility Assessment — Policy Criteria Not Met
                </div>
                <div class="eligibility-dashboard-banner-sub ineligible-sub">
                  Based on partner bank policies and your current financial profile, 0 partner banks currently approve this loan request.
                </div>
              </div>
            </div>
            <div class="eligibility-actions-group">
              <button type="button" class="btn-download-report btn-report-ineligible" data-message-id="${msgId}" title="Download Official Eligibility PDF Report">
                <i class="bi bi-file-earmark-pdf-fill"></i> Download Report
              </button>
              <button type="button" class="btn-download-csv btn-csv-ineligible" data-message-id="${msgId}" title="Download Eligibility Sheet as CSV">
                <i class="bi bi-file-earmark-spreadsheet-fill"></i> Download Sheet
              </button>
            </div>
          </div>

          <!-- 2. Applicant Profile Summary (Contains ALL collected user's information) -->
          ${renderApplicantSummaryCardHtml(applicantData, true)}

          <!-- 3. Key Policy Constraints Identified -->
          <div class="policy-constraints-card">
            <div class="constraints-card-header">
              <i class="bi bi-shield-slash-fill"></i>
              <span>Key Policy Constraints Identified</span>
            </div>
            <div class="constraints-list">
              ${policyConstraints.map((c) => `
                <div class="constraint-item">
                  <i class="bi bi-exclamation-circle-fill"></i>
                  <div>${c}</div>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- 4. Bank-wise Breakdown (if evaluated banks were listed) -->
          ${ineligibleRows.length > 0 ? `
          <div class="ineligible-banks-table-card">
            <div class="table-card-header ineligible-table-header">
              <i class="bi bi-bank2"></i>
              <span>Partner Bank Assessment Breakdown (${ineligibleRows.length} Evaluated)</span>
            </div>
            <div class="table-responsive-wrapper">
              <table class="eligibility-table ineligible-table">
                <thead>
                  <tr>
                    <th class="col-index">#</th>
                    <th class="col-bank">Bank</th>
                    <th class="col-status">Status</th>
                    <th class="col-cibil">Min. CIBIL</th>
                    <th class="col-tenure">Max Tenure</th>
                  </tr>
                </thead>
                <tbody>
                  ${ineligibleRows.map((r, i) => `
                    <tr>
                      <td class="col-index">${i + 1}</td>
                      <td class="col-bank">${escapeHtml(r.bank)}</td>
                      <td class="col-status">
                        <span class="status-pill-ineligible">
                          <i class="bi bi-x-circle-fill"></i> Not Eligible
                        </span>
                      </td>
                      <td class="col-cibil">${escapeHtml(r.cibil)}</td>
                      <td class="col-tenure">${escapeHtml(r.tenure)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>` : ""}

          <!-- 5. How You Can Become Eligible / Recovery Guidance -->
          <div class="eligibility-guidance-card">
            <div class="guidance-card-header">
              <i class="bi bi-lightbulb-fill"></i>
              <span>How You Can Become Eligible</span>
            </div>
            <div class="guidance-list">
              ${guidanceSteps.map((g) => `
                <div class="guidance-item">
                  <i class="bi bi-arrow-right-circle-fill"></i>
                  <div>${g}</div>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- 6. Recalculate CTA Section -->
          <div class="eligibility-recalculate-card">
            <div class="recalculate-header">
              <i class="bi bi-arrow-repeat"></i>
              <span>Would you like to recalculate your eligibility with different parameters?</span>
            </div>
            <div class="recalculate-chips">
              <button type="button" class="btn-recalculate-chip" data-prompt="Recalculate eligibility with 60 months tenure">
                <i class="bi bi-clock-history"></i> Try 60 Months Tenure
              </button>
              <button type="button" class="btn-recalculate-chip" data-prompt="Recalculate eligibility with a lower loan amount">
                <i class="bi bi-wallet2"></i> Lower Loan Amount
              </button>
              <button type="button" class="btn-recalculate-chip" data-prompt="Can I apply with a salaried co-applicant?">
                <i class="bi bi-people-fill"></i> Add Co-Applicant
              </button>
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

    // Disambiguation or typo confirmation step (multiple candidate companies found or awaiting user confirmation)
    const hasDisambiguationData = Boolean(
      (companyData && (
        Boolean(companyData.needs_disambiguation) ||
        companyData.company_flow === "COMPANY_CONFIRMATION" ||
        companyData.company_flow === "COMPANY_SELECTION"
      ) && (
        (Array.isArray(companyData.candidates) && companyData.candidates.length > 0) ||
        (Array.isArray(companyData.candidateOptions) && companyData.candidateOptions.length > 0)
      )) ||
      (message.content && (
        message.content.includes('class="disambiguation-candidate"') ||
        /Matching Companies Found/i.test(message.content)
      ))
    );

    if (hasDisambiguationData) {
      let content = message.content || "";
      // Strip raw HTML buttons wrapper from markdown content if present to avoid duplication with React cards
      content = content.replace(/<div class="disambiguation-candidates"[\s\S]*?<\/div>/gi, "").trim();
      const lines = content.split("\n");
      const filteredLines = lines.filter((line: string) => 
        !/^\s*(?:\d+\.|\*|-)\s+(?:\*\*)?[A-Za-z0-9\s&.,'()/-]+(?:\*\*)?/i.test(line) && 
        !/Reply with \*\*\d+\*\*/i.test(line) && 
        !/\*\(Click any company above/i.test(line) &&
        !/^\s*\d+\.\s+None of these/i.test(line)
      );
      content = filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!content) {
        content = "Please select your employer from the matching options below, or enter your exact company name:";
      }
      return renderMarkdown(content);
    }

    // Single company selected / returned: Render tabular format ONCE followed by any eligibility continuation prompt
    if (companyData && !companyData.needs_disambiguation) {
      let html = renderCompanyTables(companyData)

      // If message.content has additional prompt text outside the company markdown block (e.g. eligibility continuation question)
      let trailingPrompt = extractTrailingEligibilityContent(message.content)
      if (!trailingPrompt) {
        trailingPrompt = "Now let's continue with your eligibility assessment.\nWhat is your monthly take-home salary?"
      }
      html += `<div style="margin-top: 16px;">${renderMarkdown(trailingPrompt)}</div>`

      return html
    }

    const eligibilityInfo = detectEligibilityResult(message.content)
    let html = renderMarkdown(message.content)

    if (eligibilityInfo) {
      const msgId = escapeHtml(String(message.id || ""))
      const dashboardHtml = renderEligibilityDashboard(message.content, msgId, eligibilityInfo.isSuccess)

      if (dashboardHtml) {
        html = dashboardHtml
      } else {
        const downloadBtnHtml = `<div class="eligibility-actions-group">
          <button type="button" class="btn-download-report ${!eligibilityInfo.isSuccess ? "btn-report-ineligible" : ""}" data-message-id="${msgId}" title="Download Official Eligibility PDF Report"><i class="bi bi-file-earmark-pdf-fill"></i> Download Report</button>
          <button type="button" class="btn-download-csv ${!eligibilityInfo.isSuccess ? "btn-csv-ineligible" : ""}" data-message-id="${msgId}" title="Download Eligibility Sheet as CSV"><i class="bi bi-file-earmark-spreadsheet-fill"></i> Download Sheet</button>
        </div>`

        const cleanBodyHtml = html
          .replace(/<h[1-3][^>]*>\s*(?:❌\s*)?(?:Loan\s+Eligibility\s+Assessment\s+Result|Eligibility\s+Assessment[^\n<]*|Personal\s+Loan\s+Eligibility\s+Evaluation\s+Complete)\s*<\/h[1-3]>/gi, "")
          .trim()

        if (eligibilityInfo.isSuccess) {
          html = `<div class="eligibility-card eligibility-card-success">
            <div class="eligibility-card-banner">
              <div class="eligibility-card-banner-left">
                <i class="bi bi-shield-check"></i>
                <span>Eligibility Confirmed — Qualifying Partner Banks Found</span>
              </div>
              ${downloadBtnHtml}
            </div>
            <div class="eligibility-card-body">
              ${cleanBodyHtml}
            </div>
          </div>`
        } else {
          html = `<div class="eligibility-card eligibility-card-ineligible eligibility-card-warning">
            <div class="eligibility-card-banner ineligible-banner">
              <div class="eligibility-card-banner-left">
                <i class="bi bi-x-octagon-fill"></i>
                <span>Eligibility Assessment — Policy Criteria Not Met</span>
              </div>
              ${downloadBtnHtml}
            </div>
            <div class="eligibility-card-body">
              ${cleanBodyHtml}
            </div>
          </div>`
        }
      }
    }

    const bankData = message.bank_data
    if (bankData && (!message.content || message.content.trim().length === 0)) {
      html += renderBankManagerCard(bankData)
    }

    return html
  }

  function renderCompanySelection(message: any) {
    const data = message.company_data
    let rawCandidates = (Array.isArray(data?.candidates) && data.candidates.length > 0)
      ? data.candidates.filter(Boolean)
      : (Array.isArray(data?.candidateOptions) && data.candidateOptions.length > 0)
      ? data.candidateOptions.filter(Boolean)
      : []

    // Resilient fallback: If data?.candidates is missing (e.g. past conversation loaded from database
    // where company_data is not stored in assistant_messages, or API returned plain text disambiguation),
    // extract candidates directly from message.content
    if (rawCandidates.length === 0 && message.content) {
      const btnMatches = Array.from(message.content.matchAll(/class="disambiguation-candidate"[^>]*><strong>\d+\.<\/strong>\s*([^<]+)<\/button>/gi));
      if (btnMatches.length > 0) {
        rawCandidates = btnMatches.map((m: any) => m[1].trim());
      } else {
        const listMatches = Array.from(message.content.matchAll(/^\s*\d+\.\s+(?:(?:\*\*([^*]+)\*\*)|([A-Za-z0-9&'., -]+?))(?:\s*\((Category[^)]+)\))?\s*$/gm));
        if (listMatches.length > 0) {
          rawCandidates = listMatches
            .map((m: any) => {
              const name = (m[1] || m[2] || "").trim();
              const cat = (m[3] || "").trim();
              if (/^none\s+of\s+these/i.test(name)) return null;
              return { name, categoryLabel: cat, source: "database" };
            })
            .filter(Boolean);
        }
      }
    }

    if (rawCandidates.length === 0) return null

    const isSelectionFlow =
      data?.company_flow === "COMPANY_SELECTION" ||
      data?.company_flow === "COMPANY_CONFIRMATION" ||
      Boolean(data?.needs_disambiguation) ||
      (message.content && (
        message.content.includes('class="disambiguation-candidate"') ||
        /Matching Companies Found/i.test(message.content)
      ))

    if (!isSelectionFlow) return null

    const candidates = rawCandidates.map((c: any, idx: number) => {
      if (typeof c === "string") {
        return { id: String(idx + 1), name: c, source: "database", categoryLabel: "" }
      }
      return {
        id: String(c.id || idx + 1),
        name: c.name || c.company_name || String(c),
        categoryLabel: c.categoryLabel || c.category || "",
        source: c.source || "database",
      }
    })

    const flow = data?.company_flow || (data?.needs_disambiguation ? "COMPANY_SELECTION" : "COMPANY_SELECTION")
    const rawSuggested = data?.typo_suggestion || candidates[0]
    const suggestedName = typeof rawSuggested === "string" ? rawSuggested : (rawSuggested?.name || rawSuggested?.company_name || candidates[0]?.name || "")

    if (flow === "COMPANY_CONFIRMATION" && data?.company_flow === "COMPANY_CONFIRMATION") {
      return (
        <div className="company-selection-actions">
          <button type="button" className="company-selection-button" onClick={() => sendMessage(`Yes, ${suggestedName}`, { type: "confirm" })}>
            ✅ Yes, {suggestedName}
          </button>
          <button type="button" className="company-selection-button secondary" onClick={() => sendMessage("No, enter again", { type: "retry" })}>
            ❌ No, enter different company
          </button>
        </div>
      )
    }
    return (
      <div className="company-selection-actions company-candidates-container">
        <div className="company-candidates-list">
          {candidates.map((candidate: any, idx: number) => (
            <button
              key={String(candidate.id || idx)}
              type="button"
              className="company-clickable-card"
              onClick={() => sendMessage(candidate.name, { type: "select", company_id: String(candidate.id), company_name: candidate.name })}
            >
              <div className="company-card-left">
                <span className="company-card-icon">🏢</span>
                <div className="company-card-details">
                  <span className="company-card-name">{candidate.name}</span>
                  <span className="company-card-sub">
                    {candidate.categoryLabel || (candidate.source === "database" ? "Verified Partner Employer" : "Active Corporate Entity")}
                  </span>
                </div>
              </div>
              <span className="company-card-arrow">→</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="company-selection-button secondary"
          style={{ marginTop: "0.5rem" }}
          onClick={() => sendMessage("None of these / Unlisted Company", { type: "select", company_id: "unlisted", company_name: "None of these / Unlisted Company" })}
        >
          ❌ None of these / Unlisted Company
        </button>
      </div>
    )
  }

  function extractTrailingEligibilityContent(content: string): string {
    if (!content) return ""

    // 1. Check for standard transition phrase
    const marker = "Now let's continue with your eligibility assessment."
    const markerIdx = content.indexOf(marker)
    if (markerIdx !== -1) {
      return content.slice(markerIdx).trim()
    }

    // 2. Check for standard eligibility questions or prompts
    const questionMatch = content.match(/((?:Got it!|Noted your|Now let's continue|What is your|How much|What repayment|What are your existing|Could you please share|To continue)[\s\S]*)/i)
    if (questionMatch) {
      return questionMatch[1].trim()
    }

    // 3. Fallback: extract any content after the last markdown table row
    const lastTableIdx = content.lastIndexOf("|")
    if (lastTableIdx !== -1) {
      const afterTable = content.slice(lastTableIdx + 1).trim()
      if (afterTable && !afterTable.startsWith("###") && !afterTable.startsWith("####")) {
        return afterTable
      }
    }

    return ""
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
    const isLlp = Boolean(
      basic.llpin ||
      (basic.listing_status && basic.listing_status.includes("LLP")) ||
      /\b(?:llp|limited\s+liability\s+partnership)\b/i.test(compName)
    )

    const cleanDisplayVal = (v: any) => {
      if (!v || v === "Not available" || v === "Not specified" || v === "null" || v === "undefined" || v === "N/A") return "-"
      return String(v).trim()
    }

    // 2. Basic Information Table
    html += `<div style="margin-bottom: 0.35rem;">`
    html += `<div style="font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.15rem; color: var(--ink);"><i class="bi bi-info-circle"></i> Basic Information</div>`
    html += `<table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin: 0;"><tbody>`
    html += renderTableRow("Corporate Name", compName)
    if (isLlp) {
      html += renderTableRow("LLPIN", cleanDisplayVal(basic.llpin))
    } else {
      html += renderTableRow("CIN Number", cleanDisplayVal(basic.cin))
    }
    html += renderTableRow("Registered Address", cleanDisplayVal(basic.address))
    html += renderTableRow("Official Website", cleanDisplayVal(basic.website))
    html += renderTableRow("Industry / Sector", cleanDisplayVal(basic.industry))
    html += renderTableRow("Country of Incorporation", cleanDisplayVal(basic.country || "India"))
    html += renderTableRow("Incorporation Date", cleanDisplayVal(basic.incorporation_date))
    html += renderTableRow("Listing Status", cleanDisplayVal(basic.listing_status))
    html += `</tbody></table></div>`

    // 3. Financial Information Table
    html += `<div style="margin-bottom: 0.35rem;">`
    html += `<div style="font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.15rem; color: var(--ink);"><i class="bi bi-bar-chart"></i> Financial Information</div>`
    html += `<table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin: 0;"><tbody>`
    html += renderTableRow("Workforce / Employees", cleanDisplayVal(financial.employees))
    html += renderTableRow("Turnover / Revenue", cleanDisplayVal(financial.turnover || financial.revenue))
    html += renderTableRow("Profit Status", cleanDisplayVal(financial.profit_status || financial.profit))
    html += renderTableRow("Last AGM Date", cleanDisplayVal(financial.last_agm))
    html += renderTableRow("Performance Trend", cleanDisplayVal(financial.performance_trend || financial.profit_history))
    html += `</tbody></table></div>`

    // 4. Bank / Employer Records Table
    const seenBanks = new Set<string>()
    const uniqueBankRecords = bankRecords.filter((r: any) => {
      const bName = String(r?.bank_name || "").trim().toLowerCase()
      if (!bName || seenBanks.has(bName)) return false
      seenBanks.add(bName)
      return true
    })

    if (uniqueBankRecords.length > 0) {
      html += `<div style="margin-bottom: 0.35rem;">`
      html += `<div style="font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.15rem; color: var(--ink);"><i class="bi bi-bank"></i> Bank / Employer Records (${uniqueBankRecords.length} Partner Banks)</div>`
      html += `<table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin: 0;">`
      html += `<thead><tr><th style="width: 35px; padding: 2px 4px;">#</th><th style="padding: 2px 4px;">Bank</th><th style="padding: 2px 4px;">Rating</th><th style="padding: 2px 4px;">Remarks</th></tr></thead><tbody>`
      uniqueBankRecords.forEach((r: any, idx: number) => {
        html += `<tr>`
        html += `<td style="color: var(--ink-muted); padding: 2px 4px;">${idx + 1}</td>`
        html += `<td style="padding: 2px 4px;"><strong>${escapeHtml(r.bank_name || "Not available")}</strong></td>`
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

      {isAdmin && activeSection === "home" && (
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
                  {section.items.map((conversation) => {
                    const convIdStr = String(conversation.id)
                    const isEditing = editingConvId === convIdStr
                    const isMenuOpen = actionMenuConvId === convIdStr
                    const isActive = convIdStr === (activeConvIdRef.current || activeConversationId)

                    return (
                      <div
                        key={convIdStr}
                        className={`chat-conversation-item ${isActive ? "active" : ""} ${isMenuOpen ? "menu-open" : ""}`}
                        onClick={() => {
                          if (!isEditing) {
                            selectConversation(convIdStr)
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setActionMenuConvId(null)
                          setContextMenu({ id: convIdStr, x: e.clientX, y: e.clientY })
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: "4px" }}>
                          {isEditing ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault()
                                handleSaveRename(convIdStr)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: "flex", alignItems: "center", gap: "4px", width: "100%" }}
                            >
                              <input
                                type="text"
                                autoFocus
                                className="chat-rename-input"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    setEditingConvId(null)
                                  }
                                }}
                                onBlur={() => handleSaveRename(convIdStr)}
                              />
                              <button
                                type="submit"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 0, fontSize: "11px" }}
                                title="Save"
                              >
                                <i className="bi bi-check-lg" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingConvId(null)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", padding: 0, fontSize: "11px" }}
                                title="Cancel"
                              >
                                <i className="bi bi-x-lg" />
                              </button>
                            </form>
                          ) : (
                            <>
                              <div className="chat-conversation-title" title={conversation.title}>
                                {conversation.pinned && <i className="bi bi-pin-fill" style={{ color: "var(--accent)", marginRight: "0.25rem" }} />}
                                {conversation.title || "New Chat"}
                              </div>
                              <div className="chat-conversation-meta">{formatDate(conversation.updatedAt || conversation.createdAt)}</div>
                            </>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="chat-conversation-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`chat-conversation-menu-btn ${isMenuOpen ? "active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setContextMenu(null)
                                setActionMenuConvId((prev) => (prev === convIdStr ? null : convIdStr))
                              }}
                              title="Options"
                              aria-label="Options"
                            >
                              <i className="bi bi-three-dots" />
                            </button>

                            {isMenuOpen && (
                              <div className="chat-action-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="chat-action-menu-item"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActionMenuConvId(null)
                                    setEditingConvId(convIdStr)
                                    setEditingTitle(conversation.title || "")
                                  }}
                                >
                                  <i className="bi bi-pencil" style={{ fontSize: "11px" }} />
                                  <span>Rename</span>
                                </button>
                                <button
                                  type="button"
                                  className="chat-action-menu-item danger"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActionMenuConvId(null)
                                    deleteConversation(convIdStr)
                                  }}
                                >
                                  <i className="bi bi-trash3" style={{ fontSize: "11px" }} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
                setClearHistoryModalOpen(true)
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
              const downloadBtn = target.closest(".btn-download-report") as HTMLElement | null
              if (downloadBtn) {
                const messageId = downloadBtn.getAttribute("data-message-id")
                handleDownloadPdf(downloadBtn, messageId)
              }
              const downloadCsvBtn = target.closest(".btn-download-csv") as HTMLElement | null
              if (downloadCsvBtn) {
                const messageId = downloadCsvBtn.getAttribute("data-message-id")
                handleDownloadCsv(downloadCsvBtn, messageId)
              }
              const bankSelectBtn = target.closest(".btn-select-bank, .btn-table-select-bank") as HTMLElement | null
              if (bankSelectBtn) {
                const bankName = bankSelectBtn.getAttribute("data-bank-name")
                if (bankName) {
                  sendMessage(`I would like to proceed with ${bankName} for my loan application. What are the next steps?`)
                }
              }
              const recalcBtn = target.closest(".btn-recalculate-chip") as HTMLElement | null
              if (recalcBtn) {
                const prompt = recalcBtn.getAttribute("data-prompt")
                if (prompt) {
                  sendMessage(prompt)
                }
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
                          onClick={(e) => {
                            const btn = (e.target as HTMLElement).closest(".disambiguation-candidate") as HTMLElement | null;
                            if (btn) {
                              const candNum = btn.getAttribute("data-candidate");
                              const candText = btn.innerText.replace(/^\d+\.\s*/, "").trim();
                              if (candText) {
                                sendMessage(candText, { type: "select", company_id: candNum || candText, company_name: candText });
                              }
                            }
                          }}
                        />
                        {renderCompanySelection(message)}
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
              {loading ? (
                <button
                  className="chat-send-btn stop-btn"
                  type="button"
                  title="Stop generating"
                  onClick={stopGeneration}
                  style={{ background: "var(--ink, #1e293b)", color: "#fff" }}
                >
                  <i className="bi bi-stop-fill" style={{ fontSize: "1.1rem" }} />
                </button>
              ) : (
                <button className="chat-send-btn" type="submit" title="Send message" disabled={!input.trim()}>
                  <i className="bi bi-arrow-up" style={{ fontSize: "0.9375rem" }} />
                </button>
              )}
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

      {isAdmin && activeSection === "policies" && (
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
              const conv = conversations.find((c) => String(c.id) === String(contextMenu.id))
              setContextMenu(null)
              if (conv) {
                setEditingConvId(String(conv.id))
                setEditingTitle(conv.title || "")
              }
            }}
          >
            ✏️ Rename
          </button>
          <button
            className="conversation-context-item"
            onClick={() => togglePinConversation(contextMenu.id, !conversations.find((c) => String(c.id) === String(contextMenu.id))?.pinned)}
          >
            📌 {conversations.find((c) => String(c.id) === String(contextMenu.id))?.pinned ? "Unpin" : "Pin"}
          </button>
          <div className="conversation-context-divider" />
          <button
            className="conversation-context-item danger"
            onClick={() => {
              const convId = contextMenu.id
              setContextMenu(null)
              deleteConversation(convId)
            }}
          >
            🗑 Delete
          </button>
        </div>
      )}

      {/* Custom Delete Conversation Modal */}
      {deleteModalConv && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 9999 }}
          onClick={() => {
            if (!isDeleting) setDeleteModalConv(null)
          }}
        >
          <div
            className="modal-content"
            style={{ maxWidth: "420px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h5 className="modal-title" style={{ fontSize: "1rem", fontWeight: 600 }}>
                Delete conversation?
              </h5>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModalConv(null)}
                style={{ background: "none", border: "none", cursor: isDeleting ? "not-allowed" : "pointer", color: "var(--ink-muted)", fontSize: "1.1rem", padding: 0 }}
                aria-label="Close"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="modal-body" style={{ color: "var(--ink-soft)", fontSize: "0.875rem", lineHeight: 1.5 }}>
              This conversation will be permanently deleted. This action cannot be undone.
            </div>
            <div className="modal-footer" style={{ borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={isDeleting}
                onClick={() => setDeleteModalConv(null)}
                style={{
                  padding: "0.4rem 0.85rem",
                  fontSize: "0.8125rem",
                  borderRadius: "var(--radius-md)",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={isDeleting}
                onClick={confirmDeleteConversation}
                style={{
                  padding: "0.4rem 0.85rem",
                  fontSize: "0.8125rem",
                  borderRadius: "var(--radius-md)",
                  background: "var(--danger, #dc2626)",
                  color: "#ffffff",
                  border: "none",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  opacity: isDeleting ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Clear History Modal */}
      {clearHistoryModalOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 9999 }}
          onClick={() => setClearHistoryModalOpen(false)}
        >
          <div
            className="modal-content"
            style={{ maxWidth: "420px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h5 className="modal-title" style={{ fontSize: "1rem", fontWeight: 600 }}>
                Clear all chat history?
              </h5>
              <button
                type="button"
                onClick={() => setClearHistoryModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: "1.1rem", padding: 0 }}
                aria-label="Close"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="modal-body" style={{ color: "var(--ink-soft)", fontSize: "0.875rem", lineHeight: 1.5 }}>
              All your conversations and messages will be permanently cleared from this device.
            </div>
            <div className="modal-footer" style={{ borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setClearHistoryModalOpen(false)}
                style={{
                  padding: "0.4rem 0.85rem",
                  fontSize: "0.8125rem",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setMessages([])
                  setConversations([])
                  setActiveConversationId(null)
                  localStorage.removeItem(STORAGE_KEY)
                  setClearHistoryModalOpen(false)
                }}
                style={{
                  padding: "0.4rem 0.85rem",
                  fontSize: "0.8125rem",
                  borderRadius: "var(--radius-md)",
                  background: "var(--danger, #dc2626)",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
