(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/home/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>HomePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
const AVAILABLE_MODELS = [
    {
        id: "liquid/lfm-2.5-embedding-350m:free",
        name: "LFM 2.5",
        desc: "Fast & efficient",
        icon: "⚡"
    },
    {
        id: "gpt-4o",
        name: "GPT-4o",
        desc: "Most capable",
        icon: "🧠"
    },
    {
        id: "claude-3.5-sonnet",
        name: "Claude 3.5",
        desc: "Balanced",
        icon: "🎯"
    },
    {
        id: "gemini-pro",
        name: "Gemini Pro",
        desc: "Google AI",
        icon: "💎"
    }
];
function HomePage() {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [messages, setMessages] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [input, setInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [sidebarOpen, setSidebarOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [conversations, setConversations] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [activeConversationId, setActiveConversationId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [searchQuery, setSearchQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [selectedModel, setSelectedModel] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(AVAILABLE_MODELS[0].id);
    const [modelDropdownOpen, setModelDropdownOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [contextMenu, setContextMenu] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [messageActions, setMessageActions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const messagesEndRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [messagesRef, setMessagesRef] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const textareaRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const modelSelectorRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const initializedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const STORAGE_KEY = "emi_chat_state_v2";
    const adjustTextarea = ()=>{
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 200) + "px";
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "HomePage.useEffect": ()=>{
            adjustTextarea();
        }
    }["HomePage.useEffect"], [
        input
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "HomePage.useEffect": ()=>{
            checkAuth();
            loadState();
            loadConversations();
            initializedRef.current = true;
        }
    }["HomePage.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "HomePage.useEffect": ()=>{
            if (!initializedRef.current) return;
            if (!user) return;
            saveState();
        }
    }["HomePage.useEffect"], [
        messages,
        conversations,
        activeConversationId,
        selectedModel,
        messageActions,
        user
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "HomePage.useEffect": ()=>{
            if (messagesRef) {
                messagesRef.scrollTop = messagesRef.scrollHeight;
                enhanceCodeBlocks(messagesRef);
            }
        }
    }["HomePage.useEffect"], [
        messages,
        messagesRef
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "HomePage.useEffect": ()=>{
            function handleClickOutside(e) {
                if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target)) {
                    setModelDropdownOpen(false);
                }
                if (contextMenu && !e.target.closest(".conversation-context-menu")) {
                    setContextMenu(null);
                }
            }
            document.addEventListener("mousedown", handleClickOutside);
            return ({
                "HomePage.useEffect": ()=>document.removeEventListener("mousedown", handleClickOutside)
            })["HomePage.useEffect"];
        }
    }["HomePage.useEffect"], [
        contextMenu
    ]);
    async function checkAuth() {
        const res = await fetch("/api/auth/verify", {
            credentials: "include"
        });
        if (!res.ok) {
            router.replace("/login");
        } else {
            const data = await res.json();
            if (data.success) setUser(data.user);
        }
    }
    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            setMessages(Array.isArray(parsed.messages) ? parsed.messages : []);
            setConversations(Array.isArray(parsed.conversations) ? parsed.conversations : []);
            setActiveConversationId(parsed.activeConversationId || null);
            if (parsed.selectedModel) setSelectedModel(parsed.selectedModel);
            if (parsed.messageActions) setMessageActions(parsed.messageActions);
        } catch (e) {
            console.error("Failed to load chat state", e);
        }
    }
    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                messages,
                conversations,
                activeConversationId,
                selectedModel,
                messageActions
            }));
        } catch (e) {
            console.error("Failed to save chat state", e);
        }
    }
    async function loadConversations() {
        try {
            const res = await fetch("/api/conversations", {
                credentials: "include"
            });
            const data = await res.json();
            const hasLocal = Boolean(localStorage.getItem(STORAGE_KEY));
            if (data.conversations && data.conversations.length > 0 && !hasLocal) {
                setConversations(data.conversations);
            }
        } catch (e) {
            console.error("Failed to load conversations", e);
        }
    }
    async function sendMessage(text) {
        if (!text.trim() || loading) return;
        const userMessage = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            role: "user",
            content: text.trim(),
            timestamp: new Date().toISOString()
        };
        setMessages((prev)=>[
                ...prev,
                userMessage
            ]);
        setInput("");
        setLoading(true);
        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: text,
                    conversation_id: activeConversationId,
                    model: selectedModel
                }),
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                if (data.title && !activeConversationId) {
                    const conversation = {
                        id: data.conversation_id || Date.now().toString(36),
                        title: data.title,
                        pinned: false,
                        createdAt: new Date().toISOString()
                    };
                    setConversations((prev)=>[
                            conversation,
                            ...prev
                        ]);
                    setActiveConversationId(conversation.id);
                    fetch("/api/conversations", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(conversation),
                        credentials: "include"
                    }).catch(()=>{});
                }
                if (data.ai_message) {
                    setMessages((prev)=>[
                            ...prev,
                            data.ai_message
                        ]);
                }
            } else {
                throw new Error(data.error || "Failed to send message");
            }
        } catch (error) {
            console.error("Send message error:", error);
            const errorMessage = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
                role: "ai",
                content: "Error: " + (error instanceof Error ? error.message : "Please try again."),
                retry_content: text.trim(),
                timestamp: new Date().toISOString()
            };
            setMessages((prev)=>[
                    ...prev,
                    errorMessage
                ]);
        } finally{
            setLoading(false);
        }
    }
    async function newConversation() {
        setMessages([]);
        setActiveConversationId(null);
    }
    async function deleteConversation(id) {
        if (!confirm("Clear this conversation?")) return;
        await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
            method: "DELETE",
            credentials: "include"
        });
        setConversations((prev)=>prev.filter((c)=>c.id !== id));
        if (activeConversationId === id) {
            setMessages([]);
            setActiveConversationId(null);
        }
        setContextMenu(null);
    }
    async function togglePinConversation(id, pinned) {
        await fetch(`/api/conversations/${encodeURIComponent(id)}/pin`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                pinned
            }),
            credentials: "include"
        });
        setConversations((prev)=>prev.map((c)=>c.id === id ? {
                    ...c,
                    pinned
                } : c));
        setContextMenu(null);
    }
    async function renameConversation(id, newTitle) {
        await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: newTitle
            }),
            credentials: "include"
        });
        setConversations((prev)=>prev.map((c)=>c.id === id ? {
                    ...c,
                    title: newTitle
                } : c));
        setContextMenu(null);
    }
    function filteredConversations() {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter((c)=>c.title.toLowerCase().includes(q));
    }
    function formatTime(value) {
        if (!value) return "";
        const date = new Date(value);
        if (isNaN(date.getTime())) return "";
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }
    function formatDate(value) {
        if (!value) return "";
        const date = new Date(value);
        if (isNaN(date.getTime())) return "";
        const now = new Date();
        const diff = now - date;
        if (diff < 86400000) return "Today";
        if (diff < 172800000) return "Yesterday";
        return date.toLocaleDateString([], {
            month: "short",
            day: "numeric"
        });
    }
    function escapeHtml(value) {
        return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function isErrorMessage(message) {
        return message.role === "ai" && String(message.content || "").startsWith("Error:");
    }
    function retryMessage(content) {
        sendMessage(content);
    }
    function toggleLike(messageId) {
        setMessageActions((prev)=>{
            const current = prev[messageId] || {
                liked: false,
                disliked: false
            };
            return {
                ...prev,
                [messageId]: {
                    liked: !current.liked,
                    disliked: false
                }
            };
        });
    }
    function toggleDislike(messageId) {
        setMessageActions((prev)=>{
            const current = prev[messageId] || {
                liked: false,
                disliked: false
            };
            return {
                ...prev,
                [messageId]: {
                    liked: false,
                    disliked: !current.disliked
                }
            };
        });
    }
    function getSelectedModelName() {
        const model = AVAILABLE_MODELS.find((m)=>m.id === selectedModel);
        return model ? model.name : "Model";
    }
    function renderMarkdown(source) {
        if (typeof marked !== "undefined" && marked.parse) {
            try {
                const html = marked.parse(source || "", {
                    gfm: true,
                    breaks: false
                });
                return html;
            } catch (e) {
                console.error("Markdown parse error", e);
            }
        }
        return escapeHtml(source || "").replace(/\n/g, "<br>");
    }
    function enhanceCodeBlocks(container) {
        const blocks = container.querySelectorAll("pre code");
        blocks.forEach((codeEl)=>{
            const pre = codeEl.parentElement;
            if (!pre || pre.tagName !== "PRE") return;
            if (pre.closest(".chat-code-block")) return;
            const wrapper = document.createElement("div");
            wrapper.className = "chat-code-block";
            const header = document.createElement("div");
            header.className = "chat-code-header";
            const langLabel = document.createElement("span");
            langLabel.className = "chat-code-lang";
            const langClass = Array.from(codeEl.classList).find((c)=>c.startsWith("language-"));
            langLabel.textContent = langClass ? langClass.replace("language-", "") : "CODE";
            const copyBtn = document.createElement("button");
            copyBtn.className = "chat-code-copy";
            copyBtn.textContent = "Copy";
            copyBtn.addEventListener("click", async ()=>{
                try {
                    await navigator.clipboard.writeText(codeEl.textContent || "");
                    copyBtn.textContent = "Copied!";
                    copyBtn.classList.add("copied");
                    setTimeout(()=>{
                        copyBtn.textContent = "Copy";
                        copyBtn.classList.remove("copied");
                    }, 2000);
                } catch (e) {
                    copyBtn.textContent = "Failed";
                    setTimeout(()=>{
                        copyBtn.textContent = "Copy";
                    }, 2000);
                }
            });
            header.appendChild(langLabel);
            header.appendChild(copyBtn);
            pre.parentNode?.insertBefore(wrapper, pre);
            wrapper.appendChild(header);
            wrapper.appendChild(pre);
            if (typeof hljs !== "undefined") {
                try {
                    hljs.highlightElement(codeEl);
                } catch (e) {
                // ignore
                }
            }
        });
    }
    function renderBankManagerCard(data) {
        if (!data || !Array.isArray(data.managers) || data.managers.length === 0) {
            return `<div class="no-results">No matching bank manager record was found in our database. Please check the bank name or location and try again.</div>`;
        }
        const managers = data.managers;
        let html = `<div class="result-card">`;
        html += `<div class="result-card-header">🏦 ${escapeHtml(String(data.count))} Manager${data.count === 1 ? "" : "s"} Found</div>`;
        html += `<div class="result-card-body">`;
        html += `<div class="manager-grid">`;
        managers.forEach((m)=>{
            const name = escapeHtml(m.manager_name || m.name || "Unknown");
            const bank = escapeHtml(m.bank_name || "-");
            const designation = escapeHtml(m.designation || m.role || m.branch_name || "-");
            const phone = escapeHtml(m.mobile_no || m.phone || "-");
            const email = escapeHtml(m.email_id || m.email || "-");
            const location = escapeHtml(m.location_city || m.location || "-");
            const state = escapeHtml(m.state || "-");
            const isActive = m.status && String(m.status).toLowerCase() === "active";
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
      </div>`;
        });
        html += `</div></div></div>`;
        return html;
    }
    function renderCompanyCard(data, query) {
        if (!data && !query) return "";
        const safeData = data && typeof data === "object" ? data : {};
        const basic = safeData.basic_info && typeof safeData.basic_info === "object" ? safeData.basic_info : null;
        const financial = safeData.financial_info && typeof safeData.financial_info === "object" ? safeData.financial_info : null;
        const bankRecords = Array.isArray(safeData.bank_records) ? safeData.bank_records : [];
        const seen = new Set();
        const uniqueBankRecords = bankRecords.filter((r)=>{
            const key = String(r?.bank_name || "").trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        let html = `<div class="result-card">`;
        if (query) {
            html += `<div class="result-card-header">🏢 ${escapeHtml(String(query))}</div>`;
        }
        html += `<div style="padding: 16px 18px; line-height: 1.6; font-size: 14px; color: var(--chat-text-secondary); border-bottom: 1px solid var(--chat-border);">`;
        html += renderMarkdown(safeData.overview || "Company information retrieved from our records.");
        html += `</div>`;
        html += `<div style="padding: 16px 18px;">`;
        html += `<div style="font-weight: 700; color: var(--chat-text); margin-bottom: 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Basic Information</div>`;
        html += `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">`;
        html += `<tbody>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 160px; vertical-align: top;">CIN</td><td style="padding: 8px 12px; color: var(--chat-text);">${escapeHtml(basic?.cin || "-")}</td></tr>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 160px; vertical-align: top;">Incorporation Date</td><td style="padding: 8px 12px; color: var(--chat-text);">${escapeHtml(basic?.incorporation_date || "-")}</td></tr>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 160px; vertical-align: top;">Listing Status</td><td style="padding: 8px 12px; color: var(--chat-text);">${escapeHtml(basic?.listing_status || "-")}</td></tr>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 160px; vertical-align: top;">Country</td><td style="padding: 8px 12px; color: var(--chat-text);">${escapeHtml(basic?.country || "-")}</td></tr>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 160px; vertical-align: top;">Address</td><td style="padding: 8px 12px; color: var(--chat-text);">${escapeHtml(basic?.address || "-")}</td></tr>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 160px; vertical-align: top;">Website</td><td style="padding: 8px 12px; color: var(--chat-text);">${basic?.website ? `<a href="${escapeHtml(basic.website)}" target="_blank" rel="noreferrer" style="color: #6366f1; text-decoration: none;">${escapeHtml(basic.website)}</a>` : "-"}</td></tr>`;
        html += `</tbody></table></div>`;
        html += `<div style="padding: 0 18px 16px;">`;
        html += `<div style="font-weight: 700; color: var(--chat-text); margin-bottom: 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Financial Information</div>`;
        html += `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">`;
        html += `<tbody>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 180px; vertical-align: top;">Employees</td><td style="padding: 8px 12px; color: var(--chat-text);">${escapeHtml(financial?.employees || "-")}</td></tr>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 180px; vertical-align: top;">Last Annual Meeting</td><td style="padding: 8px 12px; color: var(--chat-text);">${escapeHtml(financial?.last_agm || "-")}</td></tr>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 180px; vertical-align: top;">Turnover</td><td style="padding: 8px 12px; color: var(--chat-text);">${escapeHtml(financial?.turnover || "-")}</td></tr>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 180px; vertical-align: top;">Profit Status</td><td style="padding: 8px 12px; color: var(--chat-text);">${escapeHtml(financial?.profit_status || "-")}</td></tr>`;
        html += `<tr><td style="padding: 8px 12px; color: var(--chat-text-muted); font-weight: 600; width: 180px; vertical-align: top;">Profitability Track Record</td><td style="padding: 8px 12px; color: var(--chat-text);">${escapeHtml(financial?.profit_history || "-")}</td></tr>`;
        html += `</tbody></table></div>`;
        if (bankRecords.length) {
            html += `<div style="padding: 0 18px 16px;">`;
            html += `<div style="font-weight: 700; color: var(--chat-text); margin-bottom: 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Bank Records</div>`;
            html += `<div style="overflow-x: auto; border-radius: 10px; border: 1px solid var(--chat-border); overflow: hidden;">`;
            html += `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">`;
            html += `<thead><tr>`;
            html += `<th style="text-align: left; padding: 10px 12px; background: rgba(99, 102, 241, 0.25); color: var(--chat-text); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--chat-border);">Bank</th>`;
            html += `<th style="text-align: left; padding: 10px 12px; background: rgba(99, 102, 241, 0.25); color: var(--chat-text); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--chat-border);">Sr No</th>`;
            html += `<th style="text-align: left; padding: 10px 12px; background: rgba(99, 102, 241, 0.25); color: var(--chat-text); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--chat-border);">Category</th>`;
            html += `<th style="text-align: left; padding: 10px 12px; background: rgba(99, 102, 241, 0.25); color: var(--chat-text); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--chat-border);">Info</th>`;
            html += `</tr></thead><tbody>`;
            uniqueBankRecords.forEach((r, idx)=>{
                const bgColor = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)";
                html += `<tr style="background: ${bgColor};">`;
                html += `<td style="padding: 10px 12px; color: var(--chat-text); border-bottom: 1px solid var(--chat-border); font-weight: 600;">${escapeHtml(r.bank_name || "-")}</td>`;
                html += `<td style="padding: 10px 12px; color: var(--chat-text-secondary); border-bottom: 1px solid var(--chat-border);">${escapeHtml(r.sr_no || "-")}</td>`;
                html += `<td style="padding: 10px 12px; color: var(--chat-text-secondary); border-bottom: 1px solid var(--chat-border);">${escapeHtml(r.company_category || "-")}</td>`;
                html += `<td style="padding: 10px 12px; color: var(--chat-text-secondary); border-bottom: 1px solid var(--chat-border);">${escapeHtml(r.other_info || "-")}</td>`;
                html += `</tr>`;
            });
            html += `</tbody></table></div></div>`;
        }
        html += `</div>`;
        return html;
    }
    function renderMessageContent(message) {
        const isUser = message.role === "user";
        if (isUser) {
            return escapeHtml(message.content);
        }
        let html = renderMarkdown(message.content);
        const companyData = message.company_data;
        const companyQuery = message.company_query;
        if (companyData || companyQuery) {
            const cardHtml = renderCompanyCard(companyData, companyQuery);
            if (cardHtml) {
                html += cardHtml;
            }
        }
        const bankData = message.bank_data;
        if (bankData) {
            html += renderBankManagerCard(bankData);
        }
        return html;
    }
    function renderMessageActions(message) {
        if (message.role !== "ai") return null;
        const actions = messageActions[message.id] || {
            liked: false,
            disliked: false
        };
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "message-actions",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    className: `message-action-btn ${actions.liked ? "active-like" : ""}`,
                    onClick: ()=>toggleLike(message.id),
                    title: "Good response",
                    children: "👍"
                }, void 0, false, {
                    fileName: "[project]/app/home/page.tsx",
                    lineNumber: 502,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    className: `message-action-btn ${actions.disliked ? "active-dislike" : ""}`,
                    onClick: ()=>toggleDislike(message.id),
                    title: "Bad response",
                    children: "👎"
                }, void 0, false, {
                    fileName: "[project]/app/home/page.tsx",
                    lineNumber: 509,
                    columnNumber: 9
                }, this),
                isErrorMessage(message) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    className: "message-action-btn",
                    onClick: ()=>retryMessage(message.retry_content || message.content.replace(/^Error:\s*/, "")),
                    title: "Retry",
                    children: "🔄 Retry"
                }, void 0, false, {
                    fileName: "[project]/app/home/page.tsx",
                    lineNumber: 517,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/home/page.tsx",
            lineNumber: 501,
            columnNumber: 7
        }, this);
    }
    if (!user) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        style: {
            padding: 24
        },
        children: "Loading..."
    }, void 0, false, {
        fileName: "[project]/app/home/page.tsx",
        lineNumber: 529,
        columnNumber: 21
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "home-body",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "topbar app-topbar",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "chat-sidebar-toggle",
                        onClick: ()=>setSidebarOpen(!sidebarOpen),
                        "aria-label": "Toggle sidebar",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                            width: "20",
                            height: "20",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "2",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                    x1: "3",
                                    y1: "12",
                                    x2: "21",
                                    y2: "12"
                                }, void 0, false, {
                                    fileName: "[project]/app/home/page.tsx",
                                    lineNumber: 535,
                                    columnNumber: 154
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                    x1: "3",
                                    y1: "6",
                                    x2: "21",
                                    y2: "6"
                                }, void 0, false, {
                                    fileName: "[project]/app/home/page.tsx",
                                    lineNumber: 535,
                                    columnNumber: 192
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                    x1: "3",
                                    y1: "18",
                                    x2: "21",
                                    y2: "18"
                                }, void 0, false, {
                                    fileName: "[project]/app/home/page.tsx",
                                    lineNumber: 535,
                                    columnNumber: 228
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/home/page.tsx",
                            lineNumber: 535,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 534,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        className: "brand",
                        href: "/home",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "brand-mark",
                                children: "◆"
                            }, void 0, false, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 538,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "brand-text",
                                children: "AI ASSISTANT"
                            }, void 0, false, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 539,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 537,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "model-selector-wrapper",
                        ref: modelSelectorRef,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: "model-selector",
                                onClick: ()=>setModelDropdownOpen(!modelDropdownOpen),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "model-selector-icon",
                                        children: "◆"
                                    }, void 0, false, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 546,
                                        columnNumber: 13
                                    }, this),
                                    getSelectedModelName(),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "model-selector-caret",
                                        children: "▾"
                                    }, void 0, false, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 548,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 542,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `model-dropdown ${modelDropdownOpen ? "open" : ""}`,
                                children: AVAILABLE_MODELS.map((model)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        className: `model-dropdown-item ${selectedModel === model.id ? "active" : ""}`,
                                        onClick: ()=>{
                                            setSelectedModel(model.id);
                                            setModelDropdownOpen(false);
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "model-dropdown-item-icon",
                                                children: model.icon
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 560,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "model-dropdown-item-info",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "model-dropdown-item-name",
                                                        children: model.name
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/home/page.tsx",
                                                        lineNumber: 562,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "model-dropdown-item-desc",
                                                        children: model.desc
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/home/page.tsx",
                                                        lineNumber: 563,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 561,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, model.id, true, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 552,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 550,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 541,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                        className: "nav-menu",
                        "aria-label": "Main navigation",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "/home",
                                className: "nav-item active",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        width: "18",
                                        height: "18",
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "currentColor",
                                        strokeWidth: "2",
                                        strokeLinecap: "round",
                                        strokeLinejoin: "round",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 571,
                                                columnNumber: 156
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
                                                points: "9 22 9 12 15 12 15 22"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 571,
                                                columnNumber: 214
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 571,
                                        columnNumber: 13
                                    }, this),
                                    "Home"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 570,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "/emi",
                                className: "nav-item",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        width: "18",
                                        height: "18",
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "currentColor",
                                        strokeWidth: "2",
                                        strokeLinecap: "round",
                                        strokeLinejoin: "round",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                                                width: "16",
                                                height: "16",
                                                x: "4",
                                                y: "4",
                                                rx: "2"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 575,
                                                columnNumber: 156
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                d: "M12 12h.01"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 575,
                                                columnNumber: 205
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 575,
                                        columnNumber: 13
                                    }, this),
                                    "EMI Calculator"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 574,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "/admin",
                                className: "nav-item",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        width: "18",
                                        height: "18",
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "currentColor",
                                        strokeWidth: "2",
                                        strokeLinecap: "round",
                                        strokeLinejoin: "round",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                                        }, void 0, false, {
                                            fileName: "[project]/app/home/page.tsx",
                                            lineNumber: 579,
                                            columnNumber: 156
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 579,
                                        columnNumber: 13
                                    }, this),
                                    "Admin"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 578,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "/bank-managers",
                                className: "nav-item",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        width: "18",
                                        height: "18",
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "currentColor",
                                        strokeWidth: "2",
                                        strokeLinecap: "round",
                                        strokeLinejoin: "round",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                d: "M17 21v-2a4 4 0 0 0-4-4H5a2 2 0 0 0-4 4v2"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 583,
                                                columnNumber: 156
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                                cx: "9",
                                                cy: "7",
                                                r: "4"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 583,
                                                columnNumber: 209
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                d: "M23 21v-2a4 4 0 0 0-3-3.87"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 583,
                                                columnNumber: 238
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                d: "M16 3.13a4 4 0 0 1 0 7.75"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 583,
                                                columnNumber: 276
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 583,
                                        columnNumber: 13
                                    }, this),
                                    "Bank Manager"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 582,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "nav-item profile-menu",
                                role: "link",
                                tabIndex: 0,
                                onClick: ()=>router.push("/profile"),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "profile-menu-label",
                                        children: user.name || user.email
                                    }, void 0, false, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 587,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "caret",
                                        children: "▾"
                                    }, void 0, false, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 588,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "profile-dropdown",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: "/profile",
                                                children: "Profile"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 590,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: "/logout",
                                                children: "Logout"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 591,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 589,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 586,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 569,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/home/page.tsx",
                lineNumber: 533,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "chat-layout",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: `chat-sidebar-overlay ${sidebarOpen ? "visible" : ""}`,
                        onClick: ()=>setSidebarOpen(false)
                    }, void 0, false, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 598,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                        className: `chat-sidebar ${sidebarOpen ? "open" : ""}`,
                        id: "chatSidebar",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "chat-sidebar-header",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "chat-new-chat-btn",
                                    id: "chatNewConversation",
                                    onClick: newConversation,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                            width: "18",
                                            height: "18",
                                            viewBox: "0 0 24 24",
                                            fill: "none",
                                            stroke: "currentColor",
                                            strokeWidth: "2",
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                d: "M12 5v14M5 12h14"
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 605,
                                                columnNumber: 158
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/home/page.tsx",
                                            lineNumber: 605,
                                            columnNumber: 15
                                        }, this),
                                        "New Chat"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/home/page.tsx",
                                    lineNumber: 604,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 603,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "chat-search-box",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "text",
                                    className: "chat-search-input",
                                    placeholder: "Search conversations...",
                                    value: searchQuery,
                                    onChange: (e)=>setSearchQuery(e.target.value)
                                }, void 0, false, {
                                    fileName: "[project]/app/home/page.tsx",
                                    lineNumber: 610,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 609,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "chat-list",
                                id: "chatConversationList",
                                children: filteredConversations().length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        padding: "20px",
                                        textAlign: "center",
                                        color: "var(--chat-text-muted)",
                                        fontSize: "13px"
                                    },
                                    children: "No conversations yet"
                                }, void 0, false, {
                                    fileName: "[project]/app/home/page.tsx",
                                    lineNumber: 620,
                                    columnNumber: 15
                                }, this) : filteredConversations().map((conversation)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: `chat-conversation-item ${conversation.id === activeConversationId ? "active" : ""}`,
                                        onClick: ()=>{
                                            setActiveConversationId(conversation.id);
                                            setSidebarOpen(false);
                                        },
                                        onContextMenu: (e)=>{
                                            e.preventDefault();
                                            setContextMenu({
                                                id: conversation.id,
                                                x: e.clientX,
                                                y: e.clientY
                                            });
                                        },
                                        role: "button",
                                        tabIndex: 0,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    flex: 1,
                                                    minWidth: 0
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "chat-conversation-title",
                                                        children: [
                                                            conversation.pinned ? "📌 " : "",
                                                            conversation.title
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/home/page.tsx",
                                                        lineNumber: 640,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "chat-conversation-meta",
                                                        children: formatDate(conversation.createdAt)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/home/page.tsx",
                                                        lineNumber: 644,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 639,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    display: "flex",
                                                    gap: "4px"
                                                },
                                                onClick: (e)=>e.stopPropagation(),
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: (e)=>{
                                                            e.stopPropagation();
                                                            togglePinConversation(conversation.id, !conversation.pinned);
                                                        },
                                                        style: {
                                                            background: "none",
                                                            border: "none",
                                                            cursor: "pointer",
                                                            fontSize: "12px"
                                                        },
                                                        children: conversation.pinned ? "📌" : "📍"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/home/page.tsx",
                                                        lineNumber: 647,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: (e)=>{
                                                            e.stopPropagation();
                                                            deleteConversation(conversation.id);
                                                        },
                                                        style: {
                                                            background: "none",
                                                            border: "none",
                                                            cursor: "pointer",
                                                            fontSize: "12px",
                                                            color: "#ef4444"
                                                        },
                                                        children: "🗑"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/home/page.tsx",
                                                        lineNumber: 657,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 646,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, conversation.id, true, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 625,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 618,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "chat-sidebar-footer",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    id: "clearHistoryBtn",
                                    onClick: ()=>{
                                        if (confirm("Clear all chat history?")) {
                                            setMessages([]);
                                            setConversations([]);
                                            setActiveConversationId(null);
                                            localStorage.removeItem(STORAGE_KEY);
                                        }
                                    },
                                    children: "Clear History"
                                }, void 0, false, {
                                    fileName: "[project]/app/home/page.tsx",
                                    lineNumber: 673,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 672,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 602,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                        className: "chat-main",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "chat-messages",
                                id: "chatMessages",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    id: "chatMessagesInner",
                                    children: [
                                        messages.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "chat-welcome",
                                            id: "chatWelcomeMessage",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "chat-welcome-icon",
                                                    children: "💬"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/home/page.tsx",
                                                    lineNumber: 694,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                    children: "Hello! How can I help you today?"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/home/page.tsx",
                                                    lineNumber: 695,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    children: "Ask me anything about loans, EMI calculations, bank managers, or your account."
                                                }, void 0, false, {
                                                    fileName: "[project]/app/home/page.tsx",
                                                    lineNumber: 696,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "chat-welcome-grid",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            className: "chat-welcome-card",
                                                            onClick: ()=>sendMessage("Calculate EMI for a home loan of 500000 at 9.5% for 60 months"),
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-icon",
                                                                    children: "🧮"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 699,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-title",
                                                                    children: "Calculate EMI"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 700,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-desc",
                                                                    children: "Get instant EMI calculations for home, personal, or car loans."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 701,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/home/page.tsx",
                                                            lineNumber: 698,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            className: "chat-welcome-card",
                                                            onClick: ()=>sendMessage("Tell me about loan processing fees"),
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-icon",
                                                                    children: "💰"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 704,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-title",
                                                                    children: "Processing Fees"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 705,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-desc",
                                                                    children: "Learn about loan processing fees and charges."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 706,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/home/page.tsx",
                                                            lineNumber: 703,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            className: "chat-welcome-card",
                                                            onClick: ()=>sendMessage("How can I update my profile?"),
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-icon",
                                                                    children: "👤"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 709,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-title",
                                                                    children: "Profile Help"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 710,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-desc",
                                                                    children: "Get assistance with profile settings and account management."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 711,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/home/page.tsx",
                                                            lineNumber: 708,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            className: "chat-welcome-card",
                                                            onClick: ()=>sendMessage("Give me ICICI manager details in Pune"),
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-icon",
                                                                    children: "🏦"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 714,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-title",
                                                                    children: "Bank Managers"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 715,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "chat-welcome-card-desc",
                                                                    children: "Find bank manager contact details by location."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/home/page.tsx",
                                                                    lineNumber: 716,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/home/page.tsx",
                                                            lineNumber: 713,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/home/page.tsx",
                                                    lineNumber: 697,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/home/page.tsx",
                                            lineNumber: 693,
                                            columnNumber: 17
                                        }, this) : messages.map((message)=>{
                                            const isUser = message.role === "user";
                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: `chat-message ${message.role}`,
                                                "data-message-id": message.id,
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "chat-avatar",
                                                        children: isUser ? "U" : "AI"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/home/page.tsx",
                                                        lineNumber: 725,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "chat-bubble",
                                                                dangerouslySetInnerHTML: {
                                                                    __html: renderMessageContent(message)
                                                                }
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/home/page.tsx",
                                                                lineNumber: 727,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "message-meta",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        children: formatTime(message.timestamp)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/home/page.tsx",
                                                                        lineNumber: 732,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    !isUser && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                                className: "message-copy-btn",
                                                                                onClick: async ()=>{
                                                                                    try {
                                                                                        await navigator.clipboard.writeText(message.content || "");
                                                                                    } catch (e) {
                                                                                    // ignore
                                                                                    }
                                                                                },
                                                                                children: "Copy"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/home/page.tsx",
                                                                                lineNumber: 735,
                                                                                columnNumber: 31
                                                                            }, this),
                                                                            renderMessageActions(message)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/home/page.tsx",
                                                                        lineNumber: 734,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/home/page.tsx",
                                                                lineNumber: 731,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/home/page.tsx",
                                                        lineNumber: 726,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, message.id, true, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 724,
                                                columnNumber: 21
                                            }, this);
                                        }),
                                        loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "chat-message ai",
                                            id: "aiTypingIndicator",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "chat-avatar",
                                                    children: "AI"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/home/page.tsx",
                                                    lineNumber: 758,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "chat-bubble typing-bubble",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "chat-typing-indicator",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "chat-typing-dot"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/home/page.tsx",
                                                                lineNumber: 761,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "chat-typing-dot"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/home/page.tsx",
                                                                lineNumber: 762,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "chat-typing-dot"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/home/page.tsx",
                                                                lineNumber: 763,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/home/page.tsx",
                                                        lineNumber: 760,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/home/page.tsx",
                                                    lineNumber: 759,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/home/page.tsx",
                                            lineNumber: 757,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            ref: (el)=>setMessagesRef(el)
                                        }, void 0, false, {
                                            fileName: "[project]/app/home/page.tsx",
                                            lineNumber: 768,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/home/page.tsx",
                                    lineNumber: 691,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 690,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "chat-composer",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                        className: "chat-composer-form",
                                        onSubmit: (e)=>{
                                            e.preventDefault();
                                            sendMessage(input);
                                        },
                                        autoComplete: "off",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                className: "chat-attachment-btn",
                                                title: "Attach file",
                                                onClick: ()=>{},
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                    width: "20",
                                                    height: "20",
                                                    viewBox: "0 0 24 24",
                                                    fill: "none",
                                                    stroke: "currentColor",
                                                    strokeWidth: "2",
                                                    strokeLinecap: "round",
                                                    strokeLinejoin: "round",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                        d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/home/page.tsx",
                                                        lineNumber: 775,
                                                        columnNumber: 160
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/home/page.tsx",
                                                    lineNumber: 775,
                                                    columnNumber: 17
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 774,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "chat-input-wrap",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                    ref: textareaRef,
                                                    className: "chat-input",
                                                    placeholder: "Message AI ASSISTANT...",
                                                    rows: 1,
                                                    value: input,
                                                    onChange: (e)=>{
                                                        setInput(e.target.value);
                                                        adjustTextarea();
                                                    },
                                                    onKeyDown: (e)=>{
                                                        if (e.key === "Enter" && !e.shiftKey) {
                                                            e.preventDefault();
                                                            sendMessage(input);
                                                        }
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/app/home/page.tsx",
                                                    lineNumber: 778,
                                                    columnNumber: 17
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 777,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                className: "chat-send-btn",
                                                type: "submit",
                                                title: "Send message",
                                                disabled: loading || !input.trim(),
                                                children: loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "chat-typing-indicator",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "chat-typing-dot"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/home/page.tsx",
                                                            lineNumber: 796,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "chat-typing-dot"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/home/page.tsx",
                                                            lineNumber: 797,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "chat-typing-dot"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/home/page.tsx",
                                                            lineNumber: 798,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/home/page.tsx",
                                                    lineNumber: 795,
                                                    columnNumber: 19
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                    width: "20",
                                                    height: "20",
                                                    viewBox: "0 0 24 24",
                                                    fill: "none",
                                                    stroke: "currentColor",
                                                    strokeWidth: "2",
                                                    strokeLinecap: "round",
                                                    strokeLinejoin: "round",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                                            x1: "22",
                                                            y1: "2",
                                                            x2: "11",
                                                            y2: "13"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/home/page.tsx",
                                                            lineNumber: 802,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("polygon", {
                                                            points: "22 2 15 22 11 13 2 9 22 2"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/home/page.tsx",
                                                            lineNumber: 803,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/home/page.tsx",
                                                    lineNumber: 801,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/home/page.tsx",
                                                lineNumber: 793,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 773,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "chat-disclaimer",
                                        children: "AI can make mistakes. Please verify important information."
                                    }, void 0, false, {
                                        fileName: "[project]/app/home/page.tsx",
                                        lineNumber: 808,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/home/page.tsx",
                                lineNumber: 772,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 689,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/home/page.tsx",
                lineNumber: 597,
                columnNumber: 7
            }, this),
            contextMenu && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "conversation-context-menu visible",
                style: {
                    left: contextMenu.x,
                    top: contextMenu.y
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "conversation-context-item",
                        onClick: ()=>{
                            const conv = conversations.find((c)=>c.id === contextMenu.id);
                            if (conv) {
                                const newTitle = prompt("Rename conversation:", conv.title);
                                if (newTitle && newTitle.trim()) {
                                    renameConversation(contextMenu.id, newTitle.trim());
                                }
                            }
                        },
                        children: "✏️ Rename"
                    }, void 0, false, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 819,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "conversation-context-item",
                        onClick: ()=>togglePinConversation(contextMenu.id, !conversations.find((c)=>c.id === contextMenu.id)?.pinned),
                        children: [
                            "📌 ",
                            conversations.find((c)=>c.id === contextMenu.id)?.pinned ? "Unpin" : "Pin"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 833,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "conversation-context-divider"
                    }, void 0, false, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 839,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "conversation-context-item danger",
                        onClick: ()=>deleteConversation(contextMenu.id),
                        children: "🗑 Delete"
                    }, void 0, false, {
                        fileName: "[project]/app/home/page.tsx",
                        lineNumber: 840,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/home/page.tsx",
                lineNumber: 815,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/home/page.tsx",
        lineNumber: 532,
        columnNumber: 5
    }, this);
}
_s(HomePage, "tn9w4Pu2tVXbJ8i8N2dpAmYclNE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = HomePage;
var _c;
__turbopack_context__.k.register(_c, "HomePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_home_page_tsx_07h83r0._.js.map