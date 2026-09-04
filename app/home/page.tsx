"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"

declare const marked: any
declare const hljs: any

const AVAILABLE_MODELS = [
  { id: "liquid/lfm-2.5-embedding-350m:free", name: "LFM 2.5", desc: "Fast & efficient", icon: "⚡" },
  { id: "gpt-4o", name: "GPT-4o", desc: "Most capable", icon: "🧠" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5", desc: "Balanced", icon: "🎯" },
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
          const partialMatch = candidates.find((c: any) => c.toLowerCase().includes(userInput.toLowerCase()))
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
    const diff = now.getTime() - date.getTime()
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
    const managers = Array.isArray(data) ? data : (data && Array.isArray(data.managers) ? data.managers : [])
    if (!managers || managers.length === 0) {
      return ""
    }

    let html = `<div class="result-card" style="margin-top: 16px;">`
    html += `<div class="result-card-body">`
    html += `<div class="manager-grid">`
    managers.forEach((m: any) => {
      const name = escapeHtml(m.name || m.manager_name || "Manager")
      const bank = escapeHtml(m.bank_name || "Partner Bank")
      const designation = escapeHtml(m.role || m.designation || m.branch || "Branch Official")
      const phone = escapeHtml(m.phone || m.mobile_no || m.mobile_number || "-")
      const rawEmail = m.email || m.email_id || ""
      const email = rawEmail && !rawEmail.includes("example.com") ? escapeHtml(rawEmail) : "-"
      const rawLoc = (m.location || m.location_city || "Branch").replace(/\n/g, ", ")
      const location = escapeHtml(rawLoc)
      const state = escapeHtml(m.state || "")
      const isActive = !m.status || String(m.status).toLowerCase() === "active"

      html += `<div class="manager-card">
        <div class="manager-card-header">
          <div class="manager-avatar">${name.charAt(0).toUpperCase()}</div>
          <div class="manager-info">
            <div class="manager-name">${name}</div>
            <div class="manager-bank">${bank}</div>
          </div>
          ${isActive ? '<span class="result-badge">Active</span>' : ""}
        </div>
        <div class="manager-details">
          ${designation !== "-" ? `<div class="manager-detail"><span class="detail-icon">💼</span><strong>Role:</strong> ${designation}</div>` : ""}
          ${phone !== "-" ? `<div class="manager-detail"><span class="detail-icon">📱</span><strong>Phone:</strong> ${phone}</div>` : ""}
          ${email !== "-" ? `<div class="manager-detail"><span class="detail-icon">✉️</span><strong>Email:</strong> ${email}</div>` : ""}
          ${location !== "-" ? `<div class="manager-detail"><span class="detail-icon">📍</span><strong>Location:</strong> ${location}${state && state !== "-" ? ", " + state : ""}</div>` : ""}
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

    const companyData = message.company_data

    // Disambiguation step (multiple candidate companies found)
    if (companyData && companyData.needs_disambiguation && Array.isArray(companyData.candidates)) {
      let html = renderMarkdown(message.content)
      const candidates = companyData.candidates.filter(Boolean)
      if (candidates.length > 0) {
        html += `<div class="disambiguation-candidates" style="display: flex; flex-direction: column; gap: 8px; margin: 12px 0;">`
        candidates.forEach((candidate: string, index: number) => {
          const escapedCandidate = escapeHtml(candidate)
          html += `<button class="disambiguation-candidate" data-candidate="${escapedCandidate}" style="cursor: pointer; text-align: left; padding: 10px 16px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 8px; color: #a5b4fc; font-weight: 500; font-size: 0.9rem; transition: all 0.2s ease; width: 100%;"><strong>${index + 1}.</strong> ${escapedCandidate}</button>`
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
      html += `<div class="company-intro-box" style="margin-bottom: 20px; padding: 16px 20px; background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; border-radius: 8px; line-height: 1.6; font-size: 0.95rem; color: #e2e8f0;">`
      html += `<div style="font-weight: 600; font-size: 1rem; margin-bottom: 6px; color: #60a5fa;">🏢 ${escapeHtml(compName)} — Overview</div>`
      html += renderMarkdown(overviewText)
      html += `</div>`
    }

    // 2. Basic Information Table
    html += `<div class="company-table-section" style="margin-bottom: 20px;">`
    html += `<div class="company-table-title" style="font-weight: 600; font-size: 1.05rem; margin-bottom: 10px; color: #f8fafc; display: flex; align-items: center; gap: 8px;">📌 Basic Information</div>`
    html += `<div class="company-table-wrapper" style="overflow-x: auto; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;"><table class="company-table" style="width: 100%; border-collapse: collapse;"><tbody>`
    html += renderTableRow("Corporate Name", compName)
    html += renderTableRow("CIN Number", basic.cin || "-")
    html += renderTableRow("Registered Address", basic.address || "-")
    html += renderTableRow("Official Website", basic.website || "-")
    html += renderTableRow("Industry / Sector", basic.industry || "-")
    html += renderTableRow("Country of Incorporation", basic.country || "-")
    html += renderTableRow("Incorporation Date", basic.incorporation_date || "-")
    html += renderTableRow("Listing Status", basic.listing_status || "-")
    html += `</tbody></table></div></div>`

    // 3. Bank Records Table (UNIQUE BANK NAME DISPLAYED ONLY ONCE)
    const seenBanks = new Set<string>()
    const uniqueBankRecords = bankRecords.filter((r: any) => {
      const bName = String(r?.bank_name || "").trim().toLowerCase()
      if (!bName || seenBanks.has(bName)) return false
      seenBanks.add(bName)
      return true
    })

    if (uniqueBankRecords.length > 0) {
      html += `<div class="company-table-section" style="margin-bottom: 20px;">`
      html += `<div class="company-table-title" style="font-weight: 600; font-size: 1.05rem; margin-bottom: 10px; color: #f8fafc; display: flex; align-items: center; gap: 8px;">🏦 Master Bank Category Ratings (${uniqueBankRecords.length} Partner Banks)</div>`
      html += `<div class="company-table-wrapper" style="overflow-x: auto; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;"><table class="company-table company-table-bank" style="width: 100%; border-collapse: collapse;">`
      html += `<thead><tr style="background: rgba(255, 255, 255, 0.05); text-align: left;"><th style="padding: 10px 14px; width: 70px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">Sr No</th><th style="padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">Bank Name</th><th style="padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">Category Rating</th><th style="padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">Remarks / Info</th></tr></thead><tbody>`
      uniqueBankRecords.forEach((r: any, idx: number) => {
        const bgStyle = idx % 2 === 0 ? "background: rgba(255, 255, 255, 0.02);" : "background: transparent;"
        html += `<tr style="${bgStyle}">`
        html += `<td style="padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #94a3b8;">${idx + 1}</td>`
        html += `<td style="padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);"><strong style="color: #60a5fa;">${escapeHtml(r.bank_name || "-")}</strong></td>`
        html += `<td style="padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);"><span class="result-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 10px; border-radius: 4px; font-size: 0.85rem; font-weight: 500;">${escapeHtml(r.company_category || r.category || "Approved")}</span></td>`
        html += `<td style="padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #cbd5e1;">${escapeHtml(r.other_info || r.remarks || "Corporate Partner")}</td>`
        html += `</tr>`
      })
      html += `</tbody></table></div></div>`
    } else {
      html += `<div class="company-table-section" style="margin-bottom: 20px;">`
      html += `<div class="company-table-title" style="font-weight: 600; font-size: 1.05rem; margin-bottom: 10px; color: #f8fafc;">🏦 Bank Records</div>`
      html += `<div style="padding: 14px 18px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; color: #fbbf24; font-size: 0.92rem; line-height: 1.5;">`
      html += `ℹ️ <strong>Bank Listing Note:</strong> <em>${escapeHtml(compName)}</em> is not currently listed in our uploaded partner bank records. Standard corporate loan application rules apply.`
      html += `</div></div>`
    }

    // 4. Financial Information Table
    html += `<div class="company-table-section">`
    html += `<div class="company-table-title" style="font-weight: 600; font-size: 1.05rem; margin-bottom: 10px; color: #f8fafc; display: flex; align-items: center; gap: 8px;">📊 Financial & Operational Profile</div>`
    html += `<div class="company-table-wrapper" style="overflow-x: auto; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;"><table class="company-table" style="width: 100%; border-collapse: collapse;"><tbody>`
    html += renderTableRow("Total Workforce / Employees", financial.employees || "-")
    html += renderTableRow("Annual Turnover / Revenue", financial.turnover || "-")
    html += renderTableRow("Net Profit / Loss Status", financial.profit_status || "-")
    html += renderTableRow("Last AGM Date", financial.last_agm || "-")
    html += renderTableRow("Profitability History & Trend", financial.profit_history || "-")
    html += `</tbody></table></div></div>`

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
          <a href="/policies" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Policies
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
            <div className="chat-disclaimer" style={{ textAlign: "center", fontSize: "0.72rem", color: "rgba(156, 163, 175, 0.65)", marginTop: "8px", width: "100%", display: "block" }}>
              AI can make mistakes. Please verify important information.
            </div>
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
