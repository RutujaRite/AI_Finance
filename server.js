const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const pool = require("./db");

const app = express();
const PORT = 3000;
const profilePhotoDirectory = path.join(__dirname, "public", "uploads", "profile-photos");
const profilePhotoUrlPrefix = "/uploads/profile-photos/";
const maxProfilePhotoBytes = 3 * 1024 * 1024;
const bankUploadStorage = multer({ dest: path.join(__dirname, "public", "uploads", "bank-pdfs") });
const bankUpload = bankUploadStorage.single("file");

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, function(char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char;
  });
}

function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  return false;
}

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await fs.promises.mkdir(profilePhotoDirectory, { recursive: true });

    // Core users table (create if missing)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    // Add optional profile columns safely (won't drop any data)
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS mobile VARCHAR(30),
      ADD COLUMN IF NOT EXISTS dob DATE,
      ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
      ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
      ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS monthly_income NUMERIC,
      ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30),
      ADD COLUMN IF NOT EXISTS residence_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS pan VARCHAR(20),
      ADD COLUMN IF NOT EXISTS aadhar VARCHAR(30),
      ADD COLUMN IF NOT EXISTS profile_photo_path VARCHAR(255);
    `);

    // Table to save EMI calculations per user
    await client.query(`
      CREATE TABLE IF NOT EXISTS emi_calculations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        loan_type VARCHAR(100),
        loan_amount NUMERIC,
        annual_rate NUMERIC,
        processing_fee_percent NUMERIC,
        term_months INTEGER,
        months_or_years VARCHAR(10),
        monthly_emi NUMERIC,
        total_interest NUMERIC,
        total_payment NUMERIC,
        processing_fee_amount NUMERIC,
        schedule JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const existingAdmin = await client.query(
      "SELECT * FROM users WHERE email = $1",
      ["admin@gmail.com"]
    );

    if (existingAdmin.rowCount === 0) {
      await client.query(
        "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
        ["Admin", "admin@gmail.com", "1234"]
      );
    }
  } finally {
    client.release();
  }
}

app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

app.get("/", (req, res) => {
  const error = req.query.error;
  const success = req.query.success;
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login - AI Assistant</title>
      <link rel="stylesheet" href="style.css">
    </head>
    <body class="login-page">
      <div class="login-card">
        <div class="login-logo">◆</div>
        
        <div class="login-header">
          <h1>Welcome back</h1>
          <p>Sign in to access your account and continue your journey</p>
        </div>

        ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
        ${success ? `<div class="alert alert-success">${escapeHtml(success)}</div>` : ''}

        <form action="/login" method="POST">
          <div class="form-group">
            <label for="email">Email address</label>
            <input type="email" id="email" name="email" class="form-input" placeholder="you@example.com" required autofocus>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" class="form-input" placeholder="Enter your password" required>
          </div>

          <button type="submit" class="btn btn-primary">Sign In</button>
        </form>

        <div class="login-demo">
          <strong>Demo:</strong> admin@gmail.com / 1234
        </div>

        <div class="login-footer">
          Don't have an account? <a href="/register">Create one</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Middleware to check if user is logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/");
  }
  next();
}

app.get("/home", requireLogin, (req, res) => {
  const userName = req.session.userName || "Guest";
  const userEmail = req.session.userEmail || "user@example.com";
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>AI Assistant</title>
      <link rel="stylesheet" href="style.css" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        .chat-sidebar-header { padding: 20px 16px 12px; border-bottom: 1px solid var(--border-light); }
        .chat-new-chat-btn {
          width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius);
          background: var(--surface); color: var(--text); cursor: pointer; font-size: 14px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: var(--transition); font-family: inherit;
        }
        .chat-new-chat-btn:hover { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
        .chat-search-box { padding: 12px 16px; border-bottom: 1px solid var(--border-light); }
        .chat-search-input {
          width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius);
          background: var(--bg); color: var(--text); font-size: 13px; outline: none;
          transition: var(--transition); font-family: inherit;
        }
        .chat-search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.1); background: var(--surface); }
        .chat-conversation-item {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 12px; border-radius: var(--radius); cursor: pointer; font-size: 13px;
          color: var(--text); border: none; background: transparent; width: 100%;
          text-align: left; margin-bottom: 4px; transition: var(--transition); font-family: inherit;
        }
        .chat-conversation-item:hover { background: var(--border-light); }
        .chat-conversation-item.active { background: var(--primary-light); }
        .chat-conversation-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-conversation-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .chat-sidebar-footer { padding: 16px; border-top: 1px solid var(--border-light); font-size: 12px; color: var(--text-muted); text-align: center; }
        
        .chat-message { display: flex; gap: 14px; max-width: 800px; animation: messageIn 0.3s ease; }
        @keyframes messageIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .chat-message.user { align-self: flex-end; flex-direction: row-reverse; }
        .chat-message.ai { align-self: flex-start; }
        .chat-avatar {
          width: 36px; height: 36px; border-radius: var(--radius); display: grid; place-items: center;
          font-size: 14px; font-weight: 700; color: white; flex-shrink: 0;
        }
        .chat-message.user .chat-avatar { background: linear-gradient(135deg, var(--primary), var(--accent)); }
        .chat-message.ai .chat-avatar { background: linear-gradient(135deg, var(--accent), #EC4899); }
        .chat-bubble {
          padding: 14px 18px; border-radius: var(--radius-lg); max-width: 70%; line-height: 1.6; font-size: 15px;
        }
        .chat-message.user .chat-bubble {
          background: linear-gradient(135deg, var(--primary), var(--accent)); color: white;
          border-bottom-right-radius: 4px;
        }
        .chat-message.ai .chat-bubble {
          background: var(--surface); color: var(--text); border: 1px solid var(--border);
          border-bottom-left-radius: 4px; box-shadow: var(--shadow-sm);
        }
        
        .chat-code-block {
          position: relative; margin: 14px 0; border-radius: var(--radius); background: #1e293b;
          border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: var(--shadow-md);
        }
        .chat-code-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px; background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08);
          color: var(--text-muted); font-size: 12px;
        }
        .chat-code-lang { text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; font-size: 11px; }
        .chat-code-copy {
          padding: 4px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm);
          background: var(--surface); color: var(--text-secondary); cursor: pointer;
          font-size: 11px; font-weight: 600; transition: var(--transition);
        }
        .chat-code-copy:hover { background: var(--border-light); color: var(--text); }
        .chat-code-copy.copied { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
        
        .chat-welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center; }
        .chat-welcome-icon {
          width: 80px; height: 80px; background: linear-gradient(135deg, var(--primary), var(--accent));
          border-radius: var(--radius-lg); display: grid; place-items: center; font-size: 40px;
          margin-bottom: 24px; box-shadow: 0 12px 32px rgba(79,70,229,0.3);
        }
        .chat-welcome h2 { font-size: 28px; font-weight: 800; color: var(--text); margin-bottom: 12px; }
        .chat-welcome p { font-size: 16px; color: var(--text-secondary); max-width: 500px; line-height: 1.6; margin-bottom: 32px; }
        .chat-suggestions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: 600px; }
        .chat-suggestion {
          padding: 10px 18px; background: var(--surface); border: 1px solid var(--border); border-radius: 100px;
          font-size: 13px; font-weight: 500; color: var(--text-secondary); cursor: pointer;
          transition: var(--transition); font-family: inherit;
        }
        .chat-suggestion:hover { background: var(--primary-light); border-color: var(--primary); color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow); }
        
        .chat-company-card {
          margin-top: 16px; padding: 20px; border-radius: var(--radius); background: var(--surface);
          border: 1px solid var(--border); box-shadow: var(--shadow-sm);
        }
        .chat-company-title { font-weight: 700; color: var(--text); margin-bottom: 14px; font-size: 15px; }
        .chat-company-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
        .chat-company-label { font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; }
        .chat-company-value { font-size: 13px; color: var(--text); font-weight: 600; margin-top: 4px; }
        
        .chat-input-wrap { flex: 1; position: relative; border: 2px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); transition: var(--transition); }
        .chat-input-wrap:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
        .chat-input {
          width: 100%; padding: 14px 18px; border: none; border-radius: var(--radius-lg); background: transparent;
          font: inherit; font-size: 15px; color: var(--text); outline: none; resize: none;
          max-height: 200px; min-height: 52px; font-family: 'Inter', sans-serif;
        }
        .chat-input::placeholder { color: var(--text-muted); }
        .chat-send-btn {
          width: 52px; height: 52px; border-radius: var(--radius-lg); border: none; color: white;
          background: linear-gradient(135deg, var(--primary), var(--accent)); cursor: pointer;
          display: grid; place-items: center; transition: var(--transition); flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(79,70,229,0.3);
        }
        .chat-send-btn:hover:not(:disabled) { transform: translateY(-2px) scale(1.05); box-shadow: 0 8px 20px rgba(79,70,229,0.4); }
        .chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .chat-disclaimer { text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 10px; font-weight: 500; }
      </style>
    </head>
    <body class="home-body">
      <header class="topbar app-topbar">
        <a class="brand" href="/home">
          <span class="brand-mark">◆</span>
          <span class="brand-text">AI ASSISTANT</span>
        </a>
        <nav class="nav-menu" aria-label="Main navigation">
          <a href="/home" class="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </a>
          <a href="/emi" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
            EMI Calculator
          </a>
          <a href="/admin" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Admin
          </a>
          <div class="nav-item profile-menu" role="link" tabindex="0" onclick="window.location='/profile'">
            <span class="profile-menu-label">${userName}</span>
            <span class="caret">▾</span>
            <div class="profile-dropdown">
              <a href="/profile">Profile</a>
              <a href="/logout">Logout</a>
            </div>
          </div>
        </nav>
      </header>

      <div class="chat-layout">
        <aside class="chat-sidebar" id="chatSidebar">
          <div class="chat-sidebar-header">
            <button class="chat-new-chat-btn" id="chatNewConversation">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              New Chat
            </button>
          </div>
          <div class="chat-search-box">
            <input type="text" class="chat-search-input" id="chatSearchInput" placeholder="Search conversations..." />
          </div>
          <div class="chat-list" id="chatConversationList"></div>
          <div class="chat-sidebar-footer">
            <button id="clearHistoryBtn" style="background:none;border:none;color:inherit;cursor:pointer;font:inherit;opacity:.8;">Clear History</button>
          </div>
        </aside>

        <main class="chat-main">
          <div class="chat-messages" id="chatMessages">
            <div id="chatMessagesInner">
              <div class="chat-welcome" id="chatWelcomeMessage">
                <div class="chat-welcome-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                    <circle cx="12" cy="12" r="3" fill="rgba(248,250,252,0.45)" stroke="none"/>
                  </svg>
                </div>
                <h2>Hello! How can I help you today?</h2>
                <p>Ask me anything about loans, EMI calculations, or your account.</p>
                <div class="chat-suggestions">
                  <button class="chat-suggestion" onclick="useSuggestion('Calculate EMI for a home loan of 500000 at 9.5% for 60 months')">Calculate EMI</button>
                  <button class="chat-suggestion" onclick="useSuggestion('Tell me about loan processing fees')">Processing Fees</button>
                  <button class="chat-suggestion" onclick="useSuggestion('How can I update my profile?')">Profile Help</button>
                  <button class="chat-suggestion" onclick="useSuggestion('Search company information for IBM')">Company Search</button>
                </div>
              </div>
            </div>
          </div>

          <div class="chat-composer">
            <form class="chat-composer-form" id="chatForm" autocomplete="off">
              <div class="chat-input-wrap">
                <textarea class="chat-input" id="chatInput" placeholder="Message AI ASSISTANT..." rows="1"></textarea>
              </div>
              <button class="chat-send-btn" id="chatSend" type="submit" title="Send message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
            <div class="chat-disclaimer">AI can make mistakes. Please verify important information.</div>
          </div>
        </main>
      </div>

      <script>
        (function() {
          const STORAGE_KEY = 'emi_chat_state_v2';
          const messagesInner = document.getElementById('chatMessagesInner');
          const welcomeMessage = document.getElementById('chatWelcomeMessage');
          const conversationListEl = document.getElementById('chatConversationList');
          const searchInput = document.getElementById('chatSearchInput');
          const form = document.getElementById('chatForm');
          const input = document.getElementById('chatInput');
          const sendBtn = document.getElementById('chatSend');

          const API_BASE = '/api';

          function getToken() { return ''; }

          function clearAuthAndRedirect() { window.location.assign('/'); }

          function request(path, options) {
            const url = API_BASE + path;
            const defaults = { headers: { 'Content-Type': 'application/json' } };
            const merged = Object.assign({}, defaults, options || {});
            if (merged.body && typeof merged.body === 'object' && !(merged.body instanceof FormData)) {
              merged.body = JSON.stringify(merged.body);
            }
            return fetch(url, merged).then(async (response) => {
              const contentType = response.headers.get('content-type') || '';
              const isJson = contentType.includes('application/json');
              const data = isJson ? await response.json() : null;
              if (!response.ok) {
                const message = (data && (data.error || data.detail || data.message)) || 'Request failed';
                const error = new Error(message);
                error.status = response.status;
                error.body = data;
                throw error;
              }
              return data;
            });
          }

          const api = {
            chat: {
              send: (message, conversationId) => request('/chat', { method: 'POST', body: { message, conversation_id: conversationId } }),
              listConversations: () => request('/conversations'),
              getConversation: (conversationId) => request('/conversations/' + encodeURIComponent(conversationId)),
              deleteConversation: (conversationId) => request('/conversations/' + encodeURIComponent(conversationId), { method: 'DELETE' }),
              pinConversation: (conversationId, pinned) => request('/conversations/' + encodeURIComponent(conversationId) + '/pin', { method: 'POST', body: { pinned } }),
            },
            company: {
              search: (companyName) => request('/company/search', { method: 'POST', body: { company_name: companyName } }),
              getData: (companyName) => request('/company/' + encodeURIComponent(companyName)),
              listMatches: (query) => request('/company/list?q=' + encodeURIComponent(query)),
            },
            bank: {
              listFiles: () => request('/bank/files'),
              uploadFile: (formData) => request('/bank/upload', { method: 'POST', body: formData, headers: {} }),
              deleteFile: (fileId) => request('/bank/files/' + encodeURIComponent(String(fileId)), { method: 'DELETE' }),
            },
          };

          const state = {
            messages: [],
            conversations: [],
            activeConversationId: null,
            isLoading: false,
            isSidebarOpen: false,
            error: undefined,
            searchQuery: '',
          };

          function loadState() {
            try {
              const raw = localStorage.getItem(STORAGE_KEY);
              if (!raw) return;
              const parsed = JSON.parse(raw);
              state.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
              state.conversations = Array.isArray(parsed.conversations) ? parsed.conversations : [];
              state.activeConversationId = parsed.activeConversationId || null;
            } catch (e) {
              console.error('Failed to load chat state', e);
            }
          }

          function saveState() {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify({
                messages: state.messages,
                conversations: state.conversations,
                activeConversationId: state.activeConversationId,
              }));
            } catch (e) {
              console.error('Failed to save chat state', e);
            }
          }

          function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
          function now() { return new Date().toISOString(); }

          function activeConversation() {
            if (!state.activeConversationId) return null;
            return state.conversations.find(c => c.id === state.activeConversationId) || null;
          }

          function escapeHtml(value) {
            return String(value || '').replace(/[&<>"']/g, function(char) {
              return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char;
            });
          }

          function formatTime(value) {
            if (!value) return '';
            const date = new Date(String(value));
            if (isNaN(date.getTime())) return '';
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }

          function formatDate(value) {
            if (!value) return '';
            const date = new Date(String(value));
            if (isNaN(date.getTime())) return '';
            const now = new Date();
            const diff = now - date;
            if (diff < 86400000) return 'Today';
            if (diff < 172800000) return 'Yesterday';
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }

          function renderMarkdown(source) {
            if (typeof marked !== 'undefined' && marked.parse) {
              try {
                const html = marked.parse(source || '', { gfm: true, breaks: false });
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html;
                enhanceCodeBlocks(wrapper);
                return wrapper.innerHTML;
              } catch (e) {
                console.error('Markdown parse error', e);
              }
            }
            return escapeHtml(source || '').replace(/\\n/g, '<br>');
          }

          function enhanceCodeBlocks(container) {
            const blocks = container.querySelectorAll('pre code');
            blocks.forEach((codeEl) => {
              const pre = codeEl.parentElement;
              if (!pre || pre.tagName !== 'PRE') return;

              const wrapper = document.createElement('div');
              wrapper.className = 'chat-code-block';

              const header = document.createElement('div');
              header.className = 'chat-code-header';

              const langLabel = document.createElement('span');
              langLabel.className = 'chat-code-lang';
              const langClass = Array.from(codeEl.classList).find((c) => c.startsWith('language-'));
              langLabel.textContent = langClass ? langClass.replace('language-', '') : 'CODE';

              const copyBtn = document.createElement('button');
              copyBtn.className = 'chat-code-copy';
              copyBtn.textContent = 'Copy';
              copyBtn.addEventListener('click', async () => {
                try {
                  await navigator.clipboard.writeText(codeEl.textContent || '');
                  copyBtn.textContent = 'Copied!';
                  copyBtn.classList.add('copied');
                  setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 2000);
                } catch (e) {
                  copyBtn.textContent = 'Failed';
                  setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
                }
              });

              header.appendChild(langLabel);
              header.appendChild(copyBtn);

              pre.parentNode.insertBefore(wrapper, pre);
              wrapper.appendChild(header);
              wrapper.appendChild(pre);

              if (typeof hljs !== 'undefined') {
                try { hljs.highlightElement(codeEl); } catch (e) { /* ignore */ }
              }
            });
          }

          function renderCompanyCard(data, query) {
            if (!data && !query) return '';
            let html = '<div class="chat-company-card">';
            if (query) {
              html += '<div class="chat-company-title">🏢 ' + escapeHtml(String(query)) + '</div>';
            }
            if (data && typeof data === 'object') {
              const bankRecords = Array.isArray(data.bank_records) ? data.bank_records : [];
              if (bankRecords.length) {
                html += '<div style="margin:16px 0 10px;font-weight:700;color:#0f172a;">Bank Records</div>';
                html += '<table style="width:100%;border-collapse:collapse;font-size:13px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">';
                html += '<thead><tr style="background:linear-gradient(135deg,#4f46e5,#ec4899);color:white;">';
                html += '<th style="text-align:left;padding:12px 14px;font-weight:700;font-size:12px;letter-spacing:0.4px;text-transform:uppercase;">Bank Name</th>';
                html += '<th style="text-align:left;padding:12px 14px;font-weight:700;font-size:12px;letter-spacing:0.4px;text-transform:uppercase;">SR No</th>';
                html += '<th style="text-align:left;padding:12px 14px;font-weight:700;font-size:12px;letter-spacing:0.4px;text-transform:uppercase;">Category</th>';
                html += '<th style="text-align:left;padding:12px 14px;font-weight:700;font-size:12px;letter-spacing:0.4px;text-transform:uppercase;">Other Info</th>';
                html += '</tr></thead>';
                html += '<tbody>';
                bankRecords.forEach((r, idx) => {
                  const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                  html += '<tr style="background:' + bg + ';transition:background 0.15s;">' +
                    '<td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600;">' + escapeHtml(r.bank_name || '-') + '</td>' +
                    '<td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#334155;">' + escapeHtml(r.sr_no || '-') + '</td>' +
                    '<td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#334155;"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#eef2ff;color:#4f46e5;font-size:12px;font-weight:600;">' + escapeHtml(r.company_category || '-') + '</span></td>' +
                    '<td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px;line-height:1.5;">' + escapeHtml(r.other_info || '-') + '</td></tr>';
                });
                html += '</tbody></table>';
              }
            }
            html += '</div>';
            return html;
          }

          function renderMessage(message) {
            const isUser = message.role === 'user';
            const div = document.createElement('div');
            div.className = 'chat-message ' + message.role;
            div.setAttribute('data-message-id', message.id);

            const avatar = document.createElement('div');
            avatar.className = 'chat-avatar';
            avatar.textContent = isUser ? 'U' : 'AI';

            const content = document.createElement('div');
            content.className = 'chat-bubble';

            if (isUser) {
              content.textContent = message.content;
            } else {
              content.innerHTML = renderMarkdown(message.content);

              const companyData = message.company_data;
              const companyQuery = message.company_query;
              if (companyData || companyQuery) {
                const cardHtml = renderCompanyCard(companyData, companyQuery);
                if (cardHtml) {
                  const cardWrap = document.createElement('div');
                  cardWrap.innerHTML = cardHtml;
                  content.appendChild(cardWrap);
                }
              }
            }

            div.appendChild(avatar);
            div.appendChild(content);
            return div;
          }

          function renderMessages() {
            messagesInner.innerHTML = '';
            if (state.messages.length === 0) {
              const welcome = document.getElementById('chatWelcomeMessage');
              if (welcome) messagesInner.appendChild(welcome);
              return;
            }
            state.messages.forEach((message) => {
              messagesInner.appendChild(renderMessage(message));
            });
            scrollToBottom();
          }

          function appendMessage(message) {
            const welcome = document.getElementById('chatWelcomeMessage');
            if (welcome) welcome.remove();
            messagesInner.appendChild(renderMessage(message));
            scrollToBottom();
          }

          function scrollToBottom() {
            const container = document.getElementById('chatMessages');
            if (container) container.scrollTop = container.scrollHeight;
          }

          function setLoading(loading) {
            state.isLoading = loading;
            sendBtn.disabled = loading;
            if (loading) {
              sendBtn.innerHTML = '<div class="chat-typing-indicator"><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div></div>';
            } else {
              sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
            }
          }

          async function sendMessage(message) {
            if (!message.trim() || state.isLoading) return;
            const userMessage = { id: uid(), role: 'user', content: message.trim(), timestamp: now() };
            state.messages.push(userMessage);
            appendMessage(userMessage);
            saveState();
            input.value = '';
            input.style.height = 'auto';
            setLoading(true);

            try {
              const data = await api.chat.send(message, state.activeConversationId);
              if (data.success) {
                if (data.title && !state.activeConversationId) {
                  const conversation = { id: data.conversation_id || uid(), title: data.title, pinned: false, createdAt: now() };
                  state.conversations.unshift(conversation);
                  state.activeConversationId = conversation.id;
                }
                const aiMessage = data.ai_message;
                if (aiMessage) {
                  state.messages.push(aiMessage);
                  appendMessage(aiMessage);
                  saveState();
                  renderConversationList();
                }
              } else {
                throw new Error(data.error || 'Failed to send message');
              }
            } catch (error) {
              console.error('Send message error:', error);
              const errorMessage = { id: uid(), role: 'ai', content: 'Sorry, I encountered an error. Please try again.', timestamp: now() };
              state.messages.push(errorMessage);
              appendMessage(errorMessage);
              saveState();
            } finally {
              setLoading(false);
            }
          }

          function renderConversationList() {
            conversationListEl.innerHTML = '';
            if (state.conversations.length === 0) {
              conversationListEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No conversations yet</div>';
              return;
            }
            state.conversations.forEach((conversation) => {
              const item = document.createElement('button');
              item.className = 'chat-conversation-item' + (conversation.id === state.activeConversationId ? ' active' : '');
              item.innerHTML = '<div><div class="chat-conversation-title">' + escapeHtml(conversation.title) + '</div><div class="chat-conversation-meta">' + formatDate(conversation.createdAt) + '</div></div>';
              item.addEventListener('click', () => {
                state.activeConversationId = conversation.id;
                saveState();
                renderConversationList();
                renderMessages();
              });
              conversationListEl.appendChild(item);
            });
          }

          window.useSuggestion = function(text) {
            input.value = text;
            sendMessage(text);
          };

          form.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage(input.value);
          });

          input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 200) + 'px';
          });

          document.getElementById('chatNewConversation').addEventListener('click', () => {
            state.messages = [];
            state.activeConversationId = null;
            saveState();
            renderMessages();
            renderConversationList();
          });

          document.getElementById('clearHistoryBtn').addEventListener('click', () => {
            if (confirm('Clear all chat history?')) {
              state.messages = [];
              state.conversations = [];
              state.activeConversationId = null;
              localStorage.removeItem(STORAGE_KEY);
              renderMessages();
              renderConversationList();
            }
          });

          const chatToggle = document.getElementById('chatToggleSidebar');
          if (chatToggle) {
            chatToggle.addEventListener('click', () => {
              document.getElementById('chatSidebar').classList.toggle('open');
            });
          }

          loadState();
          renderConversationList();
        })();
      </script>
    </body>
    </html>
  `);
});

app.get("/admin", requireLogin, (req, res) => {
  const userName = req.session.userName || "Guest";
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin - Bank Documents</title>
      <link rel="stylesheet" href="style.css">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        .admin-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 28px; background: linear-gradient(135deg, var(--primary), var(--accent));
          border-radius: var(--radius-lg); color: white; margin-bottom: 28px;
          box-shadow: var(--shadow-md);
        }
        .admin-header h2 { font-size: 22px; font-weight: 800; display: flex; align-items: center; gap: 12px; }
        .admin-grid { display: grid; grid-template-columns: 400px 1fr; gap: 28px; align-items: start; }
        .form-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: 24px; box-shadow: var(--shadow-sm);
        }
        .form-card-title {
          font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 20px;
          padding-bottom: 14px; border-bottom: 1px solid var(--border-light);
          display: flex; align-items: center; gap: 10px;
        }
        .field-group { margin-bottom: 18px; }
        .field-label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: var(--text); letter-spacing: 0.3px; }
        .drop-zone {
          border: 2px dashed var(--border); border-radius: var(--radius); padding: 32px 20px;
          text-align: center; transition: var(--transition); cursor: pointer;
          background: var(--bg);
        }
        .drop-zone:hover, .drop-zone.dragover { border-color: var(--primary); background: var(--primary-light); }
        .drop-zone-icon { font-size: 40px; margin-bottom: 12px; }
        .drop-zone h4 { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
        .drop-zone p { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }
        .drop-zone input[type="file"] { display: none; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .summary-item {
          padding: 20px 16px; border-radius: var(--radius); color: white; text-align: center;
          position: relative; overflow: hidden;
        }
        .summary-item:nth-child(1) { background: linear-gradient(135deg, #6366F1, #8B5CF6); box-shadow: 0 8px 24px rgba(99,102,241,0.3); }
        .summary-item:nth-child(2) { background: linear-gradient(135deg, #EC4899, #F43F5E); box-shadow: 0 8px 24px rgba(236,72,153,0.3); }
        .summary-item:nth-child(3) { background: linear-gradient(135deg, #06B6D4, #10B981); box-shadow: 0 8px 24px rgba(6,182,212,0.3); }
  .summary-item:nth-child(4) { background: linear-gradient(135deg, #F59E0B, #EF4444); box-shadow: 0 8px 24px rgba(245,158,11,0.3); }
        .summary-item:nth-child(4) { background: linear-gradient(135deg, #F59E0B, #EF4444); box-shadow: 0 8px 24px rgba(245,158,11,0.3); }
        .summary-label { font-size: 11px; font-weight: 700; opacity: 0.9; margin-bottom: 6px; letter-spacing: 0.5px; text-transform: uppercase; }
        .summary-value { font-size: 24px; font-weight: 800; position: relative; z-index: 1; }
        .result-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: 24px; box-shadow: var(--shadow-sm);
        }
        .result-card h3 {
          font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 16px;
          padding-bottom: 14px; border-bottom: 1px solid var(--border-light);
          display: flex; align-items: center; gap: 10px;
        }
        .files-table-wrap { max-height: 420px; overflow-y: auto; border-radius: var(--radius); border: 1px solid var(--border); }
        .files-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .files-table thead { position: sticky; top: 0; }
        .files-table thead th {
          padding: 14px 16px; background: linear-gradient(135deg, var(--primary), var(--accent));
          color: white; text-align: left; font-size: 12px; font-weight: 700;
          letter-spacing: 0.5px; text-transform: uppercase;
        }
        .files-table tbody td { padding: 12px 16px; color: var(--text); background: var(--surface); border-bottom: 1px solid var(--border-light); }
        .files-table tbody tr:nth-child(even) { background: var(--border-light); }
        .files-table tbody tr:hover { background: var(--primary-light); }
        .file-name-cell { font-weight: 600; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .action-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 8px 14px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: var(--transition); border: 1px solid var(--border);
          background: var(--surface); color: var(--text-secondary); text-decoration: none;
        }
        .action-btn:hover { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
        .action-btn.danger:hover { background: #FEE2E2; border-color: #EF4444; color: #EF4444; }
        .upload-progress {
          margin-top: 16px; padding: 12px 16px; background: var(--primary-light);
          border-radius: var(--radius); font-size: 14px; color: var(--primary);
          display: none;
        }
        .upload-progress.active { display: block; }
        .upload-progress.error { background: #FEE2E2; color: #DC2626; }
        .upload-progress.success { background: #D1FAE5; color: #065F46; }
        .empty-state {
          text-align: center; padding: 60px 20px; color: var(--text-muted);
        }
        .empty-state-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
        .empty-state h3 { font-size: 18px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
        .empty-state p { font-size: 14px; }
        @media (max-width: 1024px) {
          .admin-grid { grid-template-columns: 1fr; }
          .summary-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .admin-header { flex-direction: column; gap: 12px; text-align: center; }
          .files-table-wrap { overflow-x: auto; }
        }
      </style>
    </head>
    <body class="home-body">
      <header class="topbar app-topbar">
        <a class="brand" href="/home">
          <span class="brand-mark">◆</span>
          <span class="brand-text">AI ASSISTANT</span>
        </a>
        <nav class="nav-menu" aria-label="Main navigation">
          <a href="/home" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </a>
          <a href="/emi" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
            EMI Calculator
          </a>
          <a href="/admin" class="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Admin
          </a>
          <div class="nav-item profile-menu" role="link" tabindex="0" onclick="window.location='/profile'">
            <span class="profile-menu-label">${userName}</span>
            <span class="caret">▾</span>
            <div class="profile-dropdown">
              <a href="/profile">Profile</a>
              <a href="/logout">Logout</a>
            </div>
          </div>
        </nav>
      </header>

      <main class="admin-page">
        <div class="admin-header">
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            Bank Documents Management
          </h2>
          <span style="font-size:14px;opacity:0.8;">Upload, manage, and download bank PDF files</span>
        </div>

        <div class="summary-grid" id="summaryGrid">
          <div class="summary-item">
            <div class="summary-label">Total Documents</div>
            <div class="summary-value" id="totalDocs">0</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Size</div>
            <div class="summary-value" id="totalSize">0 KB</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Last Uploaded</div>
            <div class="summary-value" id="lastUploaded">Never</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Users</div>
            <div class="summary-value" id="totalUsers">0</div>
          </div>
        </div>

        <div class="admin-grid">
          <div class="form-card">
            <div class="form-card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload New PDF
            </div>
            <div class="field-group">
              <label class="field-label">Select Bank PDF</label>
              <div class="drop-zone" id="dropZone">
                <div class="drop-zone-icon">📄</div>
                <h4>Drag & Drop PDF Here</h4>
                <p>or click to browse from your computer</p>
                <button type="button" class="btn btn-primary" id="browseBtn" style="display:inline-flex;width:auto;">Choose File</button>
                <input type="file" id="pdfInput" accept=".pdf,.csv,application/pdf,text/csv" />
              </div>
              <div class="upload-progress" id="uploadProgress"></div>
            </div>
          </div>

          <div class="result-card">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Uploaded Documents
            </h3>
            <div class="files-table-wrap">
              <table class="files-table">
                <thead>
                  <tr>
                    <th style="width:40px">#</th>
                    <th>File Name</th>
                    <th style="width:120px">Size</th>
                    <th style="width:160px">Uploaded</th>
                    <th style="width:140px;text-align:center">Actions</th>
                  </tr>
                </thead>
                <tbody id="filesTableBody">
                  <tr id="emptyRow">
                    <td colspan="5">
                      <div class="empty-state">
                        <div class="empty-state-icon">📁</div>
                        <h3>No documents uploaded</h3>
                        <p>Upload your first bank PDF using the form on the left</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="result-card" style="margin-top:28px;">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            All Users
          </h3>
          <div class="files-table-wrap">
            <table class="files-table">
              <thead>
                <tr>
                  <th style="width:40px">#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th style="width:100px">Role</th>
                  <th style="width:100px">Status</th>
                  <th style="width:160px">Created At</th>
                  <th style="width:160px">Last Login</th>
                </tr>
              </thead>
              <tbody id="usersTableBody">
                <tr id="usersEmptyRow">
                  <td colspan="7">
                    <div class="empty-state">
                      <div class="empty-state-icon">👥</div>
                      <h3>No users found</h3>
                      <p>User list will appear here</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <script>
        const pdfInput = document.getElementById('pdfInput');
        const uploadProgress = document.getElementById('uploadProgress');
        const filesTableBody = document.getElementById('filesTableBody');
        const usersTableBody = document.getElementById('usersTableBody');
        const dropZone = document.getElementById('dropZone');
        const browseBtn = document.getElementById('browseBtn');

        function showProgress(message, type) {
          uploadProgress.textContent = message;
          uploadProgress.className = 'upload-progress ' + (type || '');
          if (type) uploadProgress.classList.add('active');
          setTimeout(() => { uploadProgress.className = 'upload-progress'; }, 3000);
        }

        async function loadFiles() {
          try {
            const res = await fetch('/api/bank/files');
            const data = await res.json();
            renderFiles(data.files || []);
            updateSummary(data.files || []);
          } catch (err) {
            console.error('Failed to load files', err);
          }
        }

        async function loadUsers() {
          try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            renderUsers(data.users || []);
            updateUserSummary(data.users || []);
          } catch (err) {
            console.error('Failed to load users', err);
          }
        }

        function updateSummary(files) {
          const totalDocs = files.length;
          const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0);
          const lastUploaded = files.length > 0 ? files[0].uploaded_at : null;
          document.getElementById('totalDocs').textContent = totalDocs;
          document.getElementById('totalSize').textContent = formatSize(totalSize);
          document.getElementById('lastUploaded').textContent = lastUploaded ? formatDateShort(lastUploaded) : 'Never';
        }

        function updateUserSummary(users) {
          document.getElementById('totalUsers').textContent = users.length;
        }

        function formatSize(bytes) {
          if (!bytes) return '0 KB';
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(1024));
          return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        }

        function formatDateShort(dateStr) {
          if (!dateStr) return 'Never';
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        function formatDate(dateStr) {
          if (!dateStr) return 'Unknown date';
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        function renderFiles(files) {
          filesTableBody.innerHTML = '';
          if (!files.length) {
            filesTableBody.innerHTML = '<tr id="emptyRow"><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📁</div><h3>No documents uploaded</h3><p>Upload your first bank PDF using the form on the left</p></div></td></tr>';
            return;
          }
          files.forEach((file, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td style="text-align:center;font-weight:700;color:var(--text-muted)">' + (idx + 1) + '</td><td><div style="display:flex;align-items:center;gap:10px"><span style="font-size:20px">${file.file_name.toLowerCase().endsWith('.csv') ? '📊' : '📄'}</span><span class="file-name-cell" title="' + escapeHtml(file.file_name || '') + '">' + escapeHtml(file.file_name || 'Untitled') + '</span></div></td><td>' + formatSize(file.file_size) + '</td><td>' + formatDate(file.uploaded_at) + '</td><td style="text-align:center"><div style="display:flex;gap:8px;justify-content:center"><a href="/api/bank/files/' + file.id + '/download" class="action-btn" title="Download" target="_blank"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</a><button class="action-btn danger" title="Delete" onclick="deleteFile(' + file.id + ', '' + escapeHtml(file.file_name || '').replace(/'/g, "\'") + '')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Delete</button></div></td>';
            filesTableBody.appendChild(tr);
          });
        }

        function renderUsers(users) {
          usersTableBody.innerHTML = '';
          if (!users.length) {
            usersTableBody.innerHTML = '<tr id="usersEmptyRow"><td colspan="7"><div class="empty-state"><div class="empty-state-icon">👥</div><h3>No users found</h3><p>User list will appear here</p></div></td></tr>';
            return;
          }
          users.forEach((user, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td style="text-align:center;font-weight:700;color:var(--text-muted)">' + user.id + '</td><td><div style="display:flex;align-items:center;gap:10px"><span style="font-size:18px">👤</span><span style="font-weight:600">' + escapeHtml(user.name || 'N/A') + '</span></div></td><td>' + escapeHtml(user.email || '') + '</td><td><span style="display:inline-block;padding:4px 10px;border-radius:100px;font-size:12px;font-weight:600;background:' + (user.role === 'admin' ? 'var(--primary-light)' : 'var(--border-light)') + ';color:' + (user.role === 'admin' ? 'var(--primary)' : 'var(--text-secondary)') + '">' + escapeHtml(user.role || 'user') + '</span></td><td><span style="display:inline-block;padding:4px 10px;border-radius:100px;font-size:12px;font-weight:600;background:' + (user.status === 'active' ? '#D1FAE5' : '#FEE2E2') + ';color:' + (user.status === 'active' ? '#065F46' : '#DC2626') + '">' + escapeHtml(user.status || 'active') + '</span></td><td>' + formatDate(user.created_at) + '</td><td>' + (user.last_login ? formatDate(user.last_login) : '<span style="color:var(--text-muted)">Never</span>') + '</td>';
            usersTableBody.appendChild(tr);
          });
        }

        function escapeHtml(value) {
          return String(value || '').replace(/[&<>"']/g, function(char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char;
          });
        }

        async function deleteFile(id, name) {
          if (!confirm('Are you sure you want to delete "' + name + '"?')) return;
          try {
            const res = await fetch('/api/bank/files/' + id, { method: 'DELETE', credentials: 'same-origin' });
            const data = await res.json();
            if (data.success) {
              showProgress('File deleted successfully', 'success');
              loadFiles();
            } else {
              showProgress('Delete failed: ' + (data.error || 'Unknown error'), 'error');
            }
          } catch (err) {
            showProgress('Delete failed', 'error');
          }
        }

        if (browseBtn) {
          browseBtn.addEventListener('click', () => pdfInput.click());
        }

        if (pdfInput) {
          pdfInput.addEventListener('change', async () => {
            const file = pdfInput.files && pdfInput.files[0];
            if (!file) return;
            if (file.type !== 'application/pdf' && file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
              showProgress('Please select a valid PDF or CSV file', 'error');
              pdfInput.value = '';
              return;
            }
            if (file.size > 50 * 1024 * 1024) {
              showProgress('File size must be less than 50 MB', 'error');
              pdfInput.value = '';
              return;
            }
            const formData = new FormData();
            formData.append('file', file);
            showProgress('Uploading ' + file.name + '...');
            try {
              const res = await fetch('/api/bank/upload', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
              });
              const data = await res.json();
              if (data.success) {
                showProgress('File uploaded successfully!', 'success');
                pdfInput.value = '';
                loadFiles();
              } else {
                showProgress('Upload failed: ' + (data.error || 'Unknown error'), 'error');
              }
            } catch (err) {
              showProgress('Upload failed', 'error');
            }
          });
        }

        dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => {
          dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropZone.classList.remove('dragover');
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            pdfInput.files = files;
            pdfInput.dispatchEvent(new Event('change'));
          }
        });

        loadFiles();
        loadUsers();
      </script>
    </body>
    </html>
  `);
});app.get("/emi", requireLogin, (req, res) => {
  console.log('Route /emi requested by userId=' + (req.session && req.session.userId));
  const userName = req.session.userName || "Guest";

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>EMI Calculator</title>
      <link rel="stylesheet" href="style.css" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        .emi-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 28px; background: linear-gradient(135deg, var(--primary), var(--accent));
          border-radius: var(--radius-lg); color: white; margin-bottom: 28px;
          box-shadow: var(--shadow-md);
        }
        .emi-header h2 { font-size: 22px; font-weight: 800; display: flex; align-items: center; gap: 12px; }
        .emi-grid { display: grid; grid-template-columns: 420px 1fr; gap: 28px; align-items: start; }
        
        .form-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: 24px; box-shadow: var(--shadow-sm);
        }
        .form-card-title {
          font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 20px;
          padding-bottom: 14px; border-bottom: 1px solid var(--border-light);
          display: flex; align-items: center; gap: 10px;
        }
        .field-group { margin-bottom: 18px; }
        .field-group:last-child { margin-bottom: 0; }
        .field-label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: var(--text); letter-spacing: 0.3px; }
        .field-control { display: flex; align-items: center; gap: 12px; }
        .field-control input[type="range"] { flex: 1; }
        .field-control .value-input { width: 130px; text-align: center; font-weight: 700; }
        
        input[type="range"] {
          -webkit-appearance: none; appearance: none; height: 6px; background: var(--border);
          border-radius: 3px; outline: none; width: 100%;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%;
          background: var(--primary); cursor: pointer; box-shadow: 0 2px 8px rgba(79,70,229,0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%; background: var(--primary);
          cursor: pointer; border: none; box-shadow: 0 2px 8px rgba(79,70,229,0.3);
        }
        
        .result-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: 24px; box-shadow: var(--shadow-sm);
        }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .summary-item {
          padding: 24px 20px; border-radius: var(--radius); color: white; text-align: center;
          position: relative; overflow: hidden;
        }
        .summary-item:nth-child(1) { background: linear-gradient(135deg, #6366F1, #8B5CF6); box-shadow: 0 8px 24px rgba(99,102,241,0.3); }
        .summary-item:nth-child(2) { background: linear-gradient(135deg, #EC4899, #F43F5E); box-shadow: 0 8px 24px rgba(236,72,153,0.3); }
        .summary-item:nth-child(3) { background: linear-gradient(135deg, #06B6D4, #10B981); box-shadow: 0 8px 24px rgba(6,182,212,0.3); }
  .summary-item:nth-child(4) { background: linear-gradient(135deg, #F59E0B, #EF4444); box-shadow: 0 8px 24px rgba(245,158,11,0.3); }
        .summary-label { font-size: 12px; font-weight: 700; opacity: 0.9; margin-bottom: 8px; letter-spacing: 0.5px; }
        .summary-value { font-size: 28px; font-weight: 800; position: relative; z-index: 1; }
        
        .actions-bar {
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
          gap: 12px; margin-bottom: 24px;
        }
        .fee-pill {
          display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px;
          background: linear-gradient(135deg, var(--accent-light), var(--primary-light));
          border: 1px solid rgba(124,58,237,0.1); border-radius: 100px;
          font-size: 14px; font-weight: 600; color: var(--text);
        }
        .fee-pill strong { color: var(--primary); font-weight: 700; }
        .btn-group { display: flex; gap: 12px; }
        
        .schedule-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: 24px; box-shadow: var(--shadow-sm);
        }
        .schedule-card h3 { font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
        .schedule-table-wrap { max-height: 420px; overflow-y: auto; border-radius: var(--radius); border: 1px solid var(--border); }
        .schedule-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .schedule-table thead { position: sticky; top: 0; }
        .schedule-table thead th {
          padding: 14px 16px; background: linear-gradient(135deg, var(--primary), var(--accent));
          color: white; text-align: right; font-size: 12px; font-weight: 700;
          letter-spacing: 0.5px; text-transform: uppercase;
        }
        .schedule-table thead th:first-child { text-align: center; }
        .schedule-table tbody td { padding: 12px 16px; color: var(--text); background: var(--surface); border-bottom: 1px solid var(--border-light); text-align: right; }
        .schedule-table tbody td:first-child { text-align: center; font-weight: 600; }
        .schedule-table tbody tr:nth-child(even) { background: var(--border-light); }
        .schedule-table tbody tr:hover { background: var(--primary-light); }
        
        @media (max-width: 1024px) {
          .emi-grid { grid-template-columns: 1fr; }
          .summary-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body class="home-body">
      <header class="topbar app-topbar">
        <a class="brand" href="/home"><span class="brand-mark">◆</span> <span class="brand-text">AI ASSISTANT</span></a>
        <nav class="nav-menu" aria-label="Main navigation">
          <a href="/home" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </a>
          <a href="/emi" class="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
            EMI Calculator
          </a>
          <div class="nav-item profile-menu" role="link" tabindex="0" onclick="window.location='/profile'">
            <span class="profile-menu-label">${userName}</span>
            <span class="caret">▾</span>
            <div class="profile-dropdown">
              <a href="/profile">Profile</a>
              <a href="/logout">Logout</a>
            </div>
          </div>
        </nav>
      </header>

      <main class="emi-page">
        <div class="emi-header">
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="16" height="16" x="4" y="4" rx="2"/>
              <path d="M12 12h.01"/>
            </svg>
            EMI Calculator
          </h2>
        </div>

        <div class="emi-grid">
          <div class="form-card">
            <div class="form-card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Loan Details
            </div>

            <div class="field-group">
              <label class="field-label">Loan Type</label>
              <select id="loanType" class="form-input">
                <option>Personal</option>
                <option>Home</option>
                <option>Auto</option>
                <option>Education</option>
              </select>
            </div>

            <div class="field-group">
              <label class="field-label">Loan Amount (₹)</label>
              <div class="field-control">
                <input id="loanAmountRange" type="range" min="10000" max="10000000" step="10000" value="500000">
                <input id="loanAmount" type="number" class="form-input value-input" value="500000" min="10000" step="10000">
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Annual Interest Rate (%)</label>
              <div class="field-control">
                <input id="rateRange" type="range" min="0" max="25" step="0.01" value="9.5">
                <input id="rate" type="number" class="form-input value-input" value="9.5" step="0.01">
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Processing Fee (%)</label>
              <div class="field-control">
                <input id="feeRange" type="range" min="0" max="5" step="0.1" value="0.5">
                <input id="fee" type="number" class="form-input value-input" value="0.5" step="0.1">
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Loan Term</label>
              <div class="field-control">
                <input id="termRange" type="range" min="1" max="360" step="1" value="60">
                <input id="term" type="number" class="form-input value-input" value="60" step="1">
                <select id="monthsOrYears" class="form-input" style="width:auto">
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          </div>

          <div class="result-card">
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">MONTHLY EMI</div>
                <div class="summary-value" id="emiValue">₹0</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">TOTAL INTEREST</div>
                <div class="summary-value" id="interestValue">₹0</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">TOTAL PAYMENT</div>
                <div class="summary-value" id="totalValue">₹0</div>
              </div>
            </div>

            <div class="actions-bar">
              <span class="fee-pill">
                Processing Fee: <strong id="processingFeeAmount">₹0</strong>
              </span>
              <div class="btn-group">
                <button class="btn btn-gradient" id="saveBtn" type="button">Save</button>
                <button class="btn btn-secondary" id="printBtn" type="button">Print Schedule</button>
              </div>
            </div>

            <div class="schedule-card">
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                Amortization Schedule
              </h3>
              <div class="schedule-table-wrap">
                <table class="schedule-table">
                  <thead>
                    <tr>
                      <th style="text-align:left; width:80px">Month</th>
                      <th>EMI (₹)</th>
                      <th>Principal (₹)</th>
                      <th>Interest (₹)</th>
                      <th>Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody id="scheduleBody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      <script>
        function setRangeBackground(r) {
          const min = Number(r.min) || 0;
          const max = Number(r.max) || 100;
          const val = Number(r.value) || 0;
          const pct = Math.round(((val - min) / (max - min)) * 100);
          r.style.background = 'linear-gradient(90deg,#4F46E5 ' + pct + '%, #E2E8F0 ' + pct + '%)';
        }

        function bindRange(rangeId, inputId) {
          const r = document.getElementById(rangeId);
          const i = document.getElementById(inputId);
          r.addEventListener('input', () => { i.value = r.value; setRangeBackground(r); computeAndRender(); });
          i.addEventListener('input', () => { r.value = i.value; setRangeBackground(r); computeAndRender(); });
          setRangeBackground(r);
        }

        bindRange('loanAmountRange', 'loanAmount');
        bindRange('rateRange', 'rate');
        bindRange('feeRange', 'fee');
        bindRange('termRange', 'term');

        const monthsOrYearsEl = document.getElementById('monthsOrYears');
        if (monthsOrYearsEl) monthsOrYearsEl.addEventListener('change', computeAndRender);
        const printBtnEl = document.getElementById('printBtn');
        if (printBtnEl) printBtnEl.addEventListener('click', printSchedule);
        const saveBtnEl = document.getElementById('saveBtn');
        if (saveBtnEl) saveBtnEl.addEventListener('click', saveCalculation);

        function computeAndRender() {
          const loanType = document.getElementById('loanType').value;
          const principal = Number(document.getElementById('loanAmount').value) || 0;
          const annualRate = Number(document.getElementById('rate').value) || 0;
          const feePercent = Number(document.getElementById('fee').value) || 0;
          let term = Number(document.getElementById('term').value) || 0;
          const monthsOrYears = document.getElementById('monthsOrYears').value;

          if (monthsOrYears === 'years') term = term * 12;

          const monthlyRate = annualRate / 12 / 100;
          const emi = monthlyRate > 0
            ? (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1)
            : (term>0? principal/term : 0);

          const totalPayment = emi * term;
          const totalInterest = totalPayment - principal;
          const processingFeeAmount = principal * (feePercent/100);

          document.getElementById('emiValue').textContent = '₹' + formatMoney(emi);
          document.getElementById('interestValue').textContent = '₹' + formatMoney(totalInterest);
          document.getElementById('totalValue').textContent = '₹' + formatMoney(totalPayment);
          document.getElementById('processingFeeAmount').textContent = '₹' + formatMoney(processingFeeAmount);

          const tbody = document.getElementById('scheduleBody');
          tbody.innerHTML = '';

          let balance = principal;
          for (let m = 1; m <= term; m++) {
            const interest = balance * monthlyRate;
            const principalPortion = emi - interest;
            balance = Math.max(0, balance - principalPortion);

            const tr = document.createElement('tr');
            tr.innerHTML = '<td style="text-align:left">' + m + '</td>' +
                           '<td>₹' + formatMoney(emi) + '</td>' +
                           '<td>₹' + formatMoney(principalPortion) + '</td>' +
                           '<td>₹' + formatMoney(interest) + '</td>' +
                           '<td>₹' + formatMoney(balance) + '</td>';
            tbody.appendChild(tr);
          }

          return {
            loanType, principal, annualRate, feePercent, termMonths: term, monthsOrYears,
            emi, totalInterest, totalPayment, processingFeeAmount,
            schedule: Array.from(tbody.querySelectorAll('tr')).map((row, idx) => {
              const cols = row.querySelectorAll('td');
              return {
                month: Number(cols[0].textContent),
                emi: cols[1].textContent.replace(/[₹,\\s]/g, ''),
                principal: cols[2].textContent.replace(/[₹,\\s]/g, ''),
                interest: cols[3].textContent.replace(/[₹,\\s]/g, ''),
                balance: cols[4].textContent.replace(/[₹,\\s]/g, '')
              };
            })
          };
        }

        function formatMoney(value) {
          return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
        }

        function escapeHtml(value) {
          return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
          })[char]);
        }

        function printSchedule() {
          const data = computeAndRender();
          const printWindow = window.open('', 'emi-print-preview', 'width=1100,height=800');
          if (!printWindow) {
            alert('Please allow pop-ups to print the schedule.');
            return;
          }

          const details = [
            ['Loan Amount Disbursed', '₹' + formatMoney(data.principal)],
            ['Current Interest (%)', Number(data.annualRate).toFixed(2)],
            ['Moratorium Interest Capitalized', 'NA'],
            ['Frequency', 'Monthly'],
            ['Loan Type', data.loanType + ' Loan'],
            ['Tenure (Months)', data.termMonths]
          ];
          const detailMarkup = details.map(item =>
            '<div class="detail-item"><span class="detail-label">' + escapeHtml(item[0]) + '</span><span class="detail-colon">:</span><span class="detail-value">' + escapeHtml(item[1]) + '</span></div>'
          ).join('');
          const scheduleRows = document.getElementById('scheduleBody').innerHTML;
          const documentHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Loan Amortization Schedule</title><style>' +
            '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#3e3e45;font-family:Arial,sans-serif;background:#fff}.print-page{max-width:1120px;margin:0 auto;padding:18px 22px}.print-title{margin:0 0 22px;color:#4F46E5;font-size:25px;font-weight:500;text-align:center}.loan-details{margin-bottom:28px;border:2px solid #4F46E5}.loan-details-heading{margin:-16px auto 12px;width:max-content;padding:0 22px;color:#4F46E5;background:#fff;font-size:20px;text-align:center}.details-grid{display:grid;grid-template-columns:1fr 1fr}.detail-item{display:grid;grid-template-columns:235px 28px 1fr;min-height:72px;padding:16px;border-bottom:2px dotted #777;align-items:start;font-size:18px}.detail-item:nth-child(odd){border-right:2px solid #4F46E5}.detail-item:nth-last-child(-n+2){border-bottom:0}.detail-label{color:#4F46E5;line-height:1.32}.detail-value{font-size:18px;line-height:1.32}.schedule-title{margin:0 0 12px;color:#4F46E5;font-size:22px}.schedule-table{width:100%;border-collapse:collapse;font-size:13px}.schedule-table th{padding:10px;color:#fff;background:#4F46E5;text-align:right}.schedule-table th:first-child,.schedule-table td:first-child{text-align:center}.schedule-table td{padding:9px;border-bottom:1px solid #d9dce7;text-align:right}.schedule-table tbody tr:nth-child(even){background:#f5f3ff}@media print{.print-page{padding:0}.loan-details{break-inside:avoid}.schedule-table thead{display:table-header-group}}</style></head><body><main class="print-page"><h1 class="print-title">Loan Amortization Schedule</h1><section class="loan-details"><div class="loan-details-heading">Loan Details</div><div class="details-grid">' + detailMarkup + '</div></section><h2 class="schedule-title">Amortization Schedule</h2><table class="schedule-table"><thead><tr><th>Month</th><th>EMI (₹)</th><th>Principal (₹)</th><th>Interest (₹)</th><th>Balance (₹)</th></tr></thead><tbody>' + scheduleRows + '</tbody></table></main></body></html>';

          printWindow.document.open();
          printWindow.document.write(documentHtml);
          printWindow.document.close();
          printWindow.focus();
          printWindow.onload = () => printWindow.print();
        }

        function saveCalculation() {
          const data = computeAndRender();
          if (!data || !data.termMonths || data.termMonths <= 0) { alert('Please enter a valid term'); return; }

          fetch('/emi/save', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })
          .then(r => r.json())
          .then(j => {
            if (j.success) alert('Calculation saved'); else alert('Save failed');
          })
          .catch(err => { console.error(err); alert('Save failed'); });
        }

        computeAndRender();
      </script>
    </body>
    </html>
  `);
});

app.get("/profile", requireLogin, async (req, res) => {
  console.log('Route /profile requested by userId=' + (req.session && req.session.userId));
  const userId = req.session.userId;

  try {
    const result = await pool.query(
      `SELECT id, name, email, mobile, dob, gender, address, city, pincode, occupation, employment_type, monthly_income, marital_status, residence_type, pan, aadhar, status, role, last_login
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.redirect('/logout');
    }

    const user = result.rows[0];
    const dobVal = user.dob
      ? (user.dob instanceof Date ? user.dob.toISOString().slice(0, 10) : String(user.dob).slice(0, 10))
      : '';
    const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
    const initials = (user.name || user.email || 'U').split(/\s|@/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const profilePhotoUrl = typeof user.profile_photo_path === 'string' && /^\/uploads\/profile-photos\/[a-zA-Z0-9.-]+$/.test(user.profile_photo_path)
      ? user.profile_photo_path
      : '';
    const avatarContent = profilePhotoUrl
      ? `<img class="profile-photo" src="${profilePhotoUrl}" alt="Profile photo">`
      : `<span class="avatar-initials">${initials}</span>`;
    const removePhotoButton = profilePhotoUrl
      ? `<button type="button" class="avatar-remove" id="removeProfilePhotoBtn" aria-label="Remove profile photo" title="Remove profile photo">×</button>`
      : '';

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My Account</title>
        <link rel="stylesheet" href="style.css">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          .profile-header {
            background: linear-gradient(135deg, var(--primary), var(--accent));
            border-radius: var(--radius-lg); padding: 40px; margin-bottom: 24px;
            color: white; box-shadow: var(--shadow-md);
          }
          .profile-header h1 { font-size: 32px; font-weight: 800; margin-bottom: 8px; }
          .profile-header p { opacity: 0.9; font-size: 16px; }
          
          .profile-card {
            background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
            padding: 28px; margin-bottom: 20px; box-shadow: var(--shadow-sm);
          }
          .profile-card-title {
            font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 24px;
            padding-bottom: 16px; border-bottom: 1px solid var(--border-light);
            display: flex; align-items: center; gap: 10px;
          }
          .profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
          .profile-field { display: flex; flex-direction: column; gap: 6px; }
          .profile-field label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
          .profile-field input, .profile-field select {
            padding: 12px 14px; border: 2px solid var(--border); border-radius: var(--radius);
            font-size: 14px; font-family: inherit; color: var(--text); background: var(--surface);
            transition: var(--transition); outline: none;
          }
          .profile-field input:focus, .profile-field select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
          
          .profile-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-light); }
          .profile-msg {
            display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px;
            border-radius: var(--radius); font-size: 14px; font-weight: 600;
          }
          .profile-msg.success { background: #D1FAE5; color: #065F46; }
          .profile-msg.error { background: #FEE2E2; color: #991B1B; }
          
          .avatar-circle {
            position: relative; display: grid; place-items: center; width: 90px; height: 90px;
            border-radius: 50%; color: white; background: linear-gradient(135deg, #7651ec, #956ff7);
            font-size: 38px; font-weight: 500; box-shadow: 0 12px 25px rgba(112,69,223,0.22);
          }
          .avatar-camera {
            position: absolute; right: -7px; bottom: 10px; display: grid; place-items: center;
            width: 40px; height: 40px; border: 3px solid white; border-radius: 50%;
            background: var(--primary); font-size: 20px; cursor: pointer; z-index: 1;
          }
          .avatar-camera input { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }
          .avatar-remove {
            position: absolute; top: -6px; right: -6px; display: grid; place-items: center;
            width: 24px; height: 24px; border: 2px solid white; border-radius: 50%;
            color: white; background: #EF4444; font-size: 20px; line-height: 1; cursor: pointer; z-index: 2;
          }
          .profile-photo { display: block; width: 100%; height: 100%; border-radius: inherit; object-fit: cover; }
          
          .profile-header-card {
            display: grid; grid-template-columns: 320px 1fr; gap: 20px; align-items: center;
            padding: 25px 30px; border: 1px solid rgba(222,217,238,0.8); border-radius: 16px;
            background: rgba(255,255,255,0.92); box-shadow: var(--shadow);
          }
          .avatar-section { display: flex; align-items: center; gap: 36px; }
          .name-block .name { font-size: 22px; font-weight: 800; color: var(--text); margin-bottom: 6px; }
          .role-bubble {
            display: inline-block; padding: 4px 12px; background: var(--primary-light); color: var(--primary);
            border-radius: 100px; font-size: 12px; font-weight: 600;
          }
          .status { font-size: 13px; color: var(--text-secondary); margin-top: 8px; display: flex; align-items: center; gap: 6px; }
          .status::before { content: ''; width: 8px; height: 8px; background: var(--success); border-radius: 50%; }
          
          .info-blocks { display: grid; grid-template-columns: repeat(4,1fr); }
          .info-item {
            display: flex; flex-direction: column; align-items: center; min-width: 0;
            min-height: 105px; padding: 0 16px; text-align: center;
          }
          .info-item + .info-item { border-left: 1px solid var(--border); }
          .info-icon {
            display: grid; place-items: center; width: 50px; height: 50px; margin-bottom: 10px;
            border-radius: 50%; font-size: 21px; font-weight: 700;
          }
          .email-icon { color: #7049e4; background: #f2edff; }
          .phone-icon { color: #2876ef; background: #edf5ff; }
          .role-icon { color: #39a74c; background: #edfaed; }
          .login-icon { color: #f37837; background: #fff2e8; }
          .info-item .label { color: var(--text-muted); font-size: 13px; font-weight: 700; }
          .info-item .value {
            max-width: 100%; margin-top: 5px; overflow: hidden; color: var(--text);
            font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap;
          }
          
          .section-icon {
            display: grid; place-items: center; width: 36px; height: 36px; border-radius: 8px;
            color: var(--primary); background: var(--primary-light); font-size: 19px;
          }
          
          .profile-hint {
            margin: 20px -30px -21px; padding: 15px;
            color: var(--primary); background: linear-gradient(90deg, var(--primary-light), var(--accent-light));
            font-size: 14px; font-weight: 600; text-align: center;
          }
          
          @media (max-width: 1024px) {
            .profile-header-card { grid-template-columns: 1fr; }
            .info-blocks { max-width: 900px; width: 100%; }
          }
          @media (max-width: 720px) {
            .profile-header { padding: 24px; }
            .profile-header h1 { font-size: 24px; }
            .profile-header-card { padding: 24px; }
            .avatar-section { gap: 18px; }
            .info-blocks, .profile-grid { grid-template-columns: 1fr; }
            .info-item + .info-item { margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border); border-left: 0; }
          }
        </style>
      </head>
      <body class="home-body">
        <header class="topbar app-topbar">
          <a class="brand" href="/home"><span class="brand-mark">◆</span> <span class="brand-text">AI ASSISTANT</span></a>
          <nav class="nav-menu" aria-label="Main navigation">
            <a href="/home" class="nav-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Home
            </a>
            <a href="/emi" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
            EMI Calculator
          </a>
          <a href="/admin" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Admin
          </a>
            <div class="nav-item profile-menu active">
              <span class="profile-menu-label">♙ My Account</span>
              <span class="caret">▾</span>
              <div class="profile-dropdown">
                <a href="/profile">Profile</a>
                <a href="/logout">Logout</a>
              </div>
            </div>
          </nav>
          <a class="logout-link" href="/logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </a>
        </header>

        <main class="profile-page">
          <div class="profile-container">
            <div class="profile-header">
              <h1>My Account</h1>
              <p>Manage your profile information and account settings.</p>
            </div>

            <section class="profile-header-card">
              <div class="avatar-section">
                <div class="avatar-circle" id="profileAvatar">
                  ${avatarContent}${removePhotoButton}
                  <label class="avatar-camera" for="profilePhotoInput" title="Change profile photo">
                    <input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </label>
                </div>
                <div class="name-block">
                  <div class="name">${user.name || user.email}</div>
                  <span class="role-bubble">${user.role || 'User'}</span>
                  <div class="status">Active Account</div>
                </div>
              </div>
              <div class="info-blocks">
                <div class="info-item">
                  <span class="info-icon email-icon">✉</span>
                  <span class="label">Email</span>
                  <span class="value">${user.email || '-'}</span>
                </div>
                <div class="info-item">
                  <span class="info-icon phone-icon">⌕</span>
                  <span class="label">Mobile</span>
                  <span class="value">${user.mobile || '-'}</span>
                </div>
                <div class="info-item">
                  <span class="info-icon role-icon">♧</span>
                  <span class="label">Role</span>
                  <span class="value">${user.role || 'User'}</span>
                </div>
                <div class="info-item">
                  <span class="info-icon login-icon">□</span>
                  <span class="label">Last Login</span>
                  <span class="value">${lastLogin}</span>
                </div>
              </div>
            </section>

            <!-- Personal Information -->
            <div class="profile-card">
              <div class="profile-card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Personal Information
              </div>

              <div class="profile-grid">
                <div class="profile-field">
                  <label>Full Name</label>
                  <input type="text" id="name" value="${user.name || ''}" />
                </div>
                <div class="profile-field">
                  <label>Email</label>
                  <input type="email" id="email" value="${user.email || ''}" />
                </div>
                <div class="profile-field">
                  <label>Mobile Number</label>
                  <input type="text" id="mobile" value="${user.mobile || ''}" />
                </div>
                <div class="profile-field">
                  <label>Date of Birth</label>
                  <input type="date" id="dob" value="${dobVal}" />
                </div>
                <div class="profile-field">
                  <label>Gender</label>
                  <select id="gender">
                    <option value="">Select</option>
                    <option value="Male" ${user.gender==='Male'?'selected':''}>Male</option>
                    <option value="Female" ${user.gender==='Female'?'selected':''}>Female</option>
                    <option value="Other" ${user.gender==='Other'?'selected':''}>Other</option>
                  </select>
                </div>
                <div class="profile-field">
                  <label>Address</label>
                  <input type="text" id="address" value="${user.address || ''}" />
                </div>
                <div class="profile-field">
                  <label>City</label>
                  <input type="text" id="city" value="${user.city || ''}" />
                </div>
                <div class="profile-field">
                  <label>Pincode</label>
                  <input type="text" id="pincode" value="${user.pincode || ''}" />
                </div>
              </div>

              <div class="profile-actions">
                <button class="btn btn-primary" id="saveProfileBtn" type="button">Save Changes</button>
                <span id="profileMsg" class="profile-msg" style="margin-left:12px;display:none"></span>
              </div>
            </div>

            <!-- Loan / Employment -->
            <div class="profile-card">
              <div class="profile-card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                Loan / Employment Information
              </div>

              <div class="profile-grid">
                <div class="profile-field">
                  <label>Occupation</label>
                  <input type="text" id="occupation" value="${user.occupation || ''}" />
                </div>
                <div class="profile-field">
                  <label>Employment Type</label>
                  <select id="employment_type">
                    <option value="">Select</option>
                    <option value="Salaried" ${user.employment_type==='Salaried'?'selected':''}>Salaried</option>
                    <option value="Self-Employed" ${user.employment_type==='Self-Employed'?'selected':''}>Self-Employed</option>
                    <option value="Student" ${user.employment_type==='Student'?'selected':''}>Student</option>
                    <option value="Other" ${user.employment_type==='Other'?'selected':''}>Other</option>
                  </select>
                </div>
                <div class="profile-field">
                  <label>Monthly Income (₹)</label>
                  <input type="number" id="monthly_income" value="${user.monthly_income || ''}" />
                </div>
                <div class="profile-field">
                  <label>Marital Status</label>
                  <select id="marital_status">
                    <option value="">Select</option>
                    <option value="Single" ${user.marital_status==='Single'?'selected':''}>Single</option>
                    <option value="Married" ${user.marital_status==='Married'?'selected':''}>Married</option>
                    <option value="Other" ${user.marital_status==='Other'?'selected':''}>Other</option>
                  </select>
                </div>
                <div class="profile-field">
                  <label>Residence Type</label>
                  <select id="residence_type">
                    <option value="">Select</option>
                    <option value="Owned" ${user.residence_type==='Owned'?'selected':''}>Owned</option>
                    <option value="Rented" ${user.residence_type==='Rented'?'selected':''}>Rented</option>
                    <option value="Other" ${user.residence_type==='Other'?'selected':''}>Other</option>
                  </select>
                </div>
                <div class="profile-field">
                  <label>PAN</label>
                  <input type="text" id="pan" value="${user.pan || ''}" />
                </div>
                <div class="profile-field">
                  <label>Aadhar</label>
                  <input type="text" id="aadhar" value="${user.aadhar || ''}" />
                </div>
              </div>
            </div>

            <!-- Security / Change Password -->
            <div class="profile-card">
              <div class="profile-card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Security / Change Password
              </div>

              <div class="profile-grid">
                <div class="profile-field">
                  <label>New Password</label>
                  <input type="password" id="newPassword" placeholder="Enter new password" />
                </div>
                <div class="profile-field">
                  <label>Confirm Password</label>
                  <input type="password" id="confirmPassword" placeholder="Confirm new password" />
                </div>
              </div>

              <div class="profile-actions">
                <button class="btn btn-primary" id="updatePasswordBtn" type="button">Update Password</button>
                <span id="passMsg" class="profile-msg" style="margin-left:12px;display:none"></span>
              </div>

              <div class="profile-hint">Keep your information up to date for a better loan experience.</div>
            </div>
          </div>
        </main>

        <script>
          const profilePhotoInput = document.getElementById('profilePhotoInput');
          const removeProfilePhotoBtn = document.getElementById('removeProfilePhotoBtn');

          async function handleProfilePhotoResponse(res) {
            let data = null;
            try { data = await res.json(); } catch (err) { throw new Error(err.message || 'Request failed.'); }
            if (!res.ok || !data || !data.success) throw new Error((data && data.error) || 'Request failed.');
            return data;
          }

          if (profilePhotoInput) {
            profilePhotoInput.addEventListener('change', async () => {
              const file = profilePhotoInput.files && profilePhotoInput.files[0];
              if (!file) return;
              const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
              if (!allowedTypes.includes(file.type) || file.size > 3 * 1024 * 1024) {
                alert('Choose a JPG, PNG, or WebP image smaller than 3 MB.');
                profilePhotoInput.value = '';
                return;
              }
              const reader = new FileReader();
              reader.onload = async () => {
                try {
                  const res = await fetch('/profile/photo', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: reader.result })
                  });
                  await handleProfilePhotoResponse(res);
                  window.location.reload();
                } catch (err) {
                  console.error(err);
                  alert(err.message || 'Could not upload your profile photo.');
                  profilePhotoInput.value = '';
                }
              };
              reader.readAsDataURL(file);
            });
          }

          if (removeProfilePhotoBtn) {
            removeProfilePhotoBtn.addEventListener('click', async () => {
              try {
                const res = await fetch('/profile/photo', { method: 'DELETE', credentials: 'same-origin' });
                await handleProfilePhotoResponse(res);
                window.location.reload();
              } catch (err) { console.error(err); alert(err.message || 'Could not remove the profile photo.'); }
            });
          }

          function showMsg(el, text, type) {
            el.textContent = text;
            el.className = 'profile-msg ' + type;
            el.style.display = 'inline-flex';
            setTimeout(() => { el.style.display = 'none'; }, 3000);
          }

          document.getElementById('saveProfileBtn').addEventListener('click', async () => {
            const payload = {
              name: document.getElementById('name').value,
              email: document.getElementById('email').value,
              mobile: document.getElementById('mobile').value,
              dob: document.getElementById('dob').value,
              gender: document.getElementById('gender').value,
              address: document.getElementById('address').value,
              city: document.getElementById('city').value,
              pincode: document.getElementById('pincode').value,
              occupation: document.getElementById('occupation') ? document.getElementById('occupation').value : null,
              employment_type: document.getElementById('employment_type') ? document.getElementById('employment_type').value : null,
              monthly_income: document.getElementById('monthly_income') ? document.getElementById('monthly_income').value : null,
              marital_status: document.getElementById('marital_status') ? document.getElementById('marital_status').value : null,
              residence_type: document.getElementById('residence_type') ? document.getElementById('residence_type').value : null,
              pan: document.getElementById('pan') ? document.getElementById('pan').value : null,
              aadhar: document.getElementById('aadhar') ? document.getElementById('aadhar').value : null
            };
            const el = document.getElementById('profileMsg');
            try {
              const res = await fetch('/profile/update', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const j = await res.json();
              if (j.success) { showMsg(el, 'Saved successfully', 'success'); }
              else { showMsg(el, j.error || 'Save failed', 'error'); }
            } catch (err) { showMsg(el, 'Save failed', 'error'); }
          });

          document.getElementById('updatePasswordBtn').addEventListener('click', async () => {
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const el = document.getElementById('passMsg');
            if (!newPassword || newPassword.length < 4) { showMsg(el, 'Password too short', 'error'); return; }
            if (newPassword !== confirmPassword) { showMsg(el, 'Passwords do not match', 'error'); return; }

            try {
              const res = await fetch('/profile/change-password', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword })
              });
              const j = await res.json();
              if (j.success) { showMsg(el, 'Password updated', 'success'); document.getElementById('newPassword').value = ''; document.getElementById('confirmPassword').value = ''; }
              else { showMsg(el, j.error || 'Update failed', 'error'); }
            } catch (err) { showMsg(el, 'Update failed', 'error'); }
          });

          function addPasswordToggle(inputId) {
            const inp = document.getElementById(inputId);
            if (!inp) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'pw-wrapper';
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            wrapper.style.width = '100%';
            const originalParent = inp.parentElement;
            originalParent.replaceChild(wrapper, inp);
            wrapper.appendChild(inp);
            inp.style.paddingRight = '48px';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toggle-btn';
            btn.setAttribute('aria-label', 'Toggle password visibility');
            const eyeSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
            const eyeOffSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.97 10.97 0 0 1 12 19c-6 0-10-7-10-7 .9-1.55 2.22-3.33 3.8-4.8"/><path d="M1 1l22 22"/></svg>';
            btn.innerHTML = eyeSvg;
            btn.addEventListener('click', () => {
              if (inp.type === 'password') { inp.type = 'text'; btn.innerHTML = eyeOffSvg; }
              else { inp.type = 'password'; btn.innerHTML = eyeSvg; }
            });
            wrapper.appendChild(btn);
          }
          addPasswordToggle('newPassword');
          addPasswordToggle('confirmPassword');
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Profile error', err);
    return res.status(500).send('Server error');
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send("Logout failed");
    }
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

app.get("/register", (req, res) => {
  const error = req.query.error;
  if (!error) {
    return res.sendFile(path.join(__dirname, "public", "register.html"));
  }
  fs.readFile(path.join(__dirname, "public", "register.html"), "utf8", (err, data) => {
    if (err) return res.status(500).send("Failed to load registration page");
    const injected = data.replace(
      '<div class="login-header">',
      `<div class="alert alert-error">${escapeHtml(error)}</div><div class="login-header">`
    );
    res.send(injected);
  });
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rowCount > 0) {
      return res.redirect("/register?error=This email is already registered. Please use a different email or try logging in.");
    }

    await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, password]
    );

    return res.redirect("/?success=Account created successfully. You can now sign in.");
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).send("Registration failed. Please try again.");
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND password = $2",
      [email, password]
    );

    if (result.rowCount > 0) {
      const user = result.rows[0];
      req.session.userId = user.id;
      req.session.userName = user.name || email.split("@")[0];
      req.session.userEmail = user.email;

      // Update last_login timestamp for the user
      try {
        await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
      } catch (err) {
        console.error('Failed to update last_login:', err);
      }

      return res.redirect("/home");
    }

    return res.redirect("/?error=Invalid email or password. Please check your credentials and try again.");
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).send("Login failed. Please try again.");
  }
});

// API endpoints: profile update, change password, save EMI calculation

app.post('/profile/update', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  console.log('POST /profile/update userId=', userId, 'payload=', req.body);
  const { name, email, mobile, dob, gender, address, city, pincode } = req.body;
  try {
    await pool.query(
      `UPDATE users SET name=$1, email=$2, mobile=$3, dob=$4, gender=$5, address=$6, city=$7, pincode=$8, occupation=$9, employment_type=$10, monthly_income=$11, marital_status=$12, residence_type=$13, pan=$14, aadhar=$15 WHERE id=$16`,
      [name || null, email || null, mobile || null, dob || null, gender || null, address || null, city || null, pincode || null, req.body.occupation || null, req.body.employment_type || null, req.body.monthly_income || null, req.body.marital_status || null, req.body.residence_type || null, req.body.pan || null, req.body.aadhar || null, userId]
    );
    // update session name/email to reflect changes
    req.session.userName = name || req.session.userName;
    req.session.userEmail = email || req.session.userEmail;
    console.log('Profile updated for userId=', userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Profile update error', err);
    return res.json({ success: false, error: 'Update failed' });
  }
});

app.post('/profile/photo', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const imageData = req.body && req.body.image;
  const match = typeof imageData === 'string'
    ? imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/)
    : null;

  if (!match) {
    return res.status(400).json({ success: false, error: 'Use a JPG, PNG, or WebP image.' });
  }

  const mimeType = match[1];
  const imageBuffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!imageBuffer.length || imageBuffer.length > maxProfilePhotoBytes || !hasValidImageSignature(imageBuffer, mimeType)) {
    return res.status(400).json({ success: false, error: 'The selected image is invalid or exceeds 3 MB.' });
  }

  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
  const fileName = `${userId}-${crypto.randomBytes(20).toString('hex')}.${extension}`;
  const filePath = path.join(profilePhotoDirectory, fileName);
  const publicPath = `${profilePhotoUrlPrefix}${fileName}`;

  try {
    const existing = await pool.query('SELECT profile_photo_path FROM users WHERE id = $1', [userId]);
    const currentPath = existing.rows[0] && typeof existing.rows[0].profile_photo_path === 'string'
      ? existing.rows[0].profile_photo_path
      : '';
    if (currentPath && currentPath.startsWith(profilePhotoUrlPrefix)) {
      const currentFile = path.join(__dirname, 'public', currentPath.replace(/^\//, ''));
      await fs.promises.unlink(currentFile).catch(() => {});
    }

    await fs.promises.writeFile(filePath, imageBuffer, { flag: 'wx', mode: 0o600 });
    const update = await pool.query(
      'UPDATE users SET profile_photo_path = $1 WHERE id = $2',
      [publicPath, userId]
    );

    if (update.rowCount !== 1) {
      await fs.promises.unlink(filePath).catch(() => {});
      return res.status(404).json({ success: false, error: 'User account was not found.' });
    }

    return res.json({ success: true, photoPath: publicPath });
  } catch (err) {
    console.error('Profile photo upload error', err);
    await fs.promises.unlink(filePath).catch(() => {});
    return res.status(500).json({ success: false, error: 'Could not save the profile photo.' });
  }
});

app.delete('/profile/photo', requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const result = await pool.query('SELECT profile_photo_path FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User account was not found.' });
    }

    const currentPath = result.rows[0].profile_photo_path;
    if (currentPath && currentPath.startsWith(profilePhotoUrlPrefix)) {
      const fileName = currentPath.replace(profilePhotoUrlPrefix, '');
      const filePath = path.join(profilePhotoDirectory, fileName);
      await fs.promises.unlink(filePath).catch(() => {});
    }

    await pool.query('UPDATE users SET profile_photo_path = NULL WHERE id = $1', [userId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Profile photo delete error', err);
    return res.status(500).json({ success: false, error: 'Could not delete the profile photo.' });
  }
});

app.post('/profile/change-password', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  console.log('POST /profile/change-password userId=', userId);
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.json({ success: false, error: 'Invalid password' });
  try {
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newPassword, userId]);
    console.log('Password updated for userId=', userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Change password error', err);
    return res.json({ success: false, error: 'Change failed' });
  }
});

app.post('/emi/save', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  console.log('POST /emi/save userId=', userId);
  try {
    const { loanType, principal, annualRate, feePercent, termMonths, monthsOrYears, emi, totalInterest, totalPayment, processingFeeAmount, schedule } = req.body;
    console.log('emi save payload', { loanType, principal, annualRate, feePercent, termMonths });
    await pool.query(
      `INSERT INTO emi_calculations (user_id, loan_type, loan_amount, annual_rate, processing_fee_percent, term_months, months_or_years, monthly_emi, total_interest, total_payment, processing_fee_amount, schedule)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [userId, loanType || null, principal || 0, annualRate || 0, feePercent || 0, termMonths || 0, monthsOrYears || null, emi || 0, totalInterest || 0, totalPayment || 0, processingFeeAmount || 0, schedule ? JSON.stringify(schedule) : null]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('EMI save error', err);
    return res.json({ success: false, error: 'Save failed' });
  }
});

app.get('/admin', requireLogin, async (req, res) => {
  const userName = req.session.userName || 'Guest';
  
  try {
    const result = await pool.query(`
      SELECT bf.id, bf.file_name, bf.file_path, bf.file_size, bf.uploaded_at
      FROM bank_uploaded_files bf
      ORDER BY bf.uploaded_at DESC
    `);
    
    const files = result.rows.map(row => ({
      id: row.id,
      file_name: row.file_name,
      file_path: row.file_path,
      file_size: row.file_size,
      uploaded_at: row.uploaded_at
    }));
    
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin - Bank Documents</title>
        <link rel="stylesheet" href="style.css">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          .admin-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 20px 28px; background: linear-gradient(135deg, var(--primary), var(--accent));
            border-radius: var(--radius-lg); color: white; margin-bottom: 28px;
            box-shadow: var(--shadow-md);
          }
          .admin-header h2 { font-size: 22px; font-weight: 800; display: flex; align-items: center; gap: 12px; }
          .admin-grid { display: grid; grid-template-columns: 400px 1fr; gap: 28px; align-items: start; }
          .form-card {
            background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
            padding: 24px; box-shadow: var(--shadow-sm);
          }
          .form-card-title {
            font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 20px;
            padding-bottom: 14px; border-bottom: 1px solid var(--border-light);
            display: flex; align-items: center; gap: 10px;
          }
          .field-group { margin-bottom: 18px; }
          .field-label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: var(--text); letter-spacing: 0.3px; }
          .drop-zone {
            border: 2px dashed var(--border); border-radius: var(--radius); padding: 32px 20px;
            text-align: center; transition: var(--transition); cursor: pointer;
            background: var(--bg);
          }
          .drop-zone:hover, .drop-zone.dragover { border-color: var(--primary); background: var(--primary-light); }
          .drop-zone-icon { font-size: 40px; margin-bottom: 12px; }
          .drop-zone h4 { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
          .drop-zone p { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }
          .drop-zone input[type="file"] { display: none; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
          .summary-item {
            padding: 20px 16px; border-radius: var(--radius); color: white; text-align: center;
            position: relative; overflow: hidden;
          }
          .summary-item:nth-child(1) { background: linear-gradient(135deg, #6366F1, #8B5CF6); box-shadow: 0 8px 24px rgba(99,102,241,0.3); }
          .summary-item:nth-child(2) { background: linear-gradient(135deg, #EC4899, #F43F5E); box-shadow: 0 8px 24px rgba(236,72,153,0.3); }
          .summary-item:nth-child(3) { background: linear-gradient(135deg, #06B6D4, #10B981); box-shadow: 0 8px 24px rgba(6,182,212,0.3); }
  .summary-item:nth-child(4) { background: linear-gradient(135deg, #F59E0B, #EF4444); box-shadow: 0 8px 24px rgba(245,158,11,0.3); }
          .summary-item:nth-child(4) { background: linear-gradient(135deg, #F59E0B, #EF4444); box-shadow: 0 8px 24px rgba(245,158,11,0.3); }
          .summary-label { font-size: 11px; font-weight: 700; opacity: 0.9; margin-bottom: 6px; letter-spacing: 0.5px; text-transform: uppercase; }
          .summary-value { font-size: 24px; font-weight: 800; position: relative; z-index: 1; }
          .result-card {
            background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
            padding: 24px; box-shadow: var(--shadow-sm);
          }
          .result-card h3 {
            font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 16px;
            padding-bottom: 14px; border-bottom: 1px solid var(--border-light);
            display: flex; align-items: center; gap: 10px;
          }
          .files-table-wrap { max-height: 420px; overflow-y: auto; border-radius: var(--radius); border: 1px solid var(--border); }
          .files-table { width: 100%; border-collapse: collapse; font-size: 14px; }
          .files-table thead { position: sticky; top: 0; }
          .files-table thead th {
            padding: 14px 16px; background: linear-gradient(135deg, var(--primary), var(--accent));
            color: white; text-align: left; font-size: 12px; font-weight: 700;
            letter-spacing: 0.5px; text-transform: uppercase;
          }
          .files-table tbody td { padding: 12px 16px; color: var(--text); background: var(--surface); border-bottom: 1px solid var(--border-light); }
          .files-table tbody tr:nth-child(even) { background: var(--border-light); }
          .files-table tbody tr:hover { background: var(--primary-light); }
          .file-name-cell { font-weight: 600; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .action-btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            padding: 8px 14px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600;
            cursor: pointer; transition: var(--transition); border: 1px solid var(--border);
            background: var(--surface); color: var(--text-secondary); text-decoration: none;
          }
          .action-btn:hover { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
          .action-btn.danger:hover { background: #FEE2E2; border-color: #EF4444; color: #EF4444; }
          .upload-progress {
            margin-top: 16px; padding: 12px 16px; background: var(--primary-light);
            border-radius: var(--radius); font-size: 14px; color: var(--primary);
            display: none;
          }
          .upload-progress.active { display: block; }
          .upload-progress.error { background: #FEE2E2; color: #DC2626; }
          .upload-progress.success { background: #D1FAE5; color: #065F46; }
          .empty-state {
            text-align: center; padding: 60px 20px; color: var(--text-muted);
          }
          .empty-state-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
          .empty-state h3 { font-size: 18px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
          .empty-state p { font-size: 14px; }
          @media (max-width: 1024px) {
            .admin-grid { grid-template-columns: 1fr; }
            .summary-grid { grid-template-columns: 1fr; }
          }
          @media (max-width: 768px) {
            .admin-header { flex-direction: column; gap: 12px; text-align: center; }
            .files-table-wrap { overflow-x: auto; }
          }
        </style>
      </head>
      <body class="home-body">
        <header class="topbar app-topbar">
          <a class="brand" href="/home">
            <span class="brand-mark">◆</span>
            <span class="brand-text">AI ASSISTANT</span>
          </a>
          <nav class="nav-menu" aria-label="Main navigation">
            <a href="/home" class="nav-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Home
            </a>
            <a href="/emi" class="nav-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
              EMI Calculator
            </a>
            <a href="/admin" class="nav-item active">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              Admin
            </a>
            <div class="nav-item profile-menu" role="link" tabindex="0" onclick="window.location='/profile'">
              <span class="profile-menu-label">${userName}</span>
              <span class="caret">▾</span>
              <div class="profile-dropdown">
                <a href="/profile">Profile</a>
                <a href="/logout">Logout</a>
              </div>
            </div>
          </nav>
        </header>

        <main class="admin-page">
          <div class="admin-header">
            <h2>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
              Bank Documents Management
            </h2>
            <span style="font-size:14px;opacity:0.8;">Upload, manage, and download bank PDF files</span>
          </div>

          <div class="summary-grid" id="summaryGrid">
            <div class="summary-item">
              <div class="summary-label">Total Documents</div>
              <div class="summary-value" id="totalDocs">0</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Size</div>
              <div class="summary-value" id="totalSize">0 KB</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Last Uploaded</div>
              <div class="summary-value" id="lastUploaded">Never</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Users</div>
              <div class="summary-value" id="totalUsers">0</div>
            </div>
          </div>

          <div class="admin-grid">
            <div class="form-card">
              <div class="form-card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload New PDF
              </div>
              <div class="field-group">
                <label class="field-label">Select Bank PDF</label>
                <div class="drop-zone" id="dropZone">
                  <div class="drop-zone-icon">📄</div>
                  <h4>Drag & Drop PDF Here</h4>
                  <p>or click to browse from your computer</p>
                  <button type="button" class="btn btn-primary" id="browseBtn" style="display:inline-flex;width:auto;">Choose File</button>
                  <input type="file" id="pdfInput" accept=".pdf,.csv,application/pdf,text/csv" />
                </div>
                <div class="upload-progress" id="uploadProgress"></div>
              </div>
            </div>

            <div class="result-card">
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Uploaded Documents
              </h3>
              <div class="files-table-wrap">
                <table class="files-table">
                  <thead>
                    <tr>
                      <th style="width:40px">#</th>
                      <th>File Name</th>
                      <th style="width:120px">Size</th>
                      <th style="width:160px">Uploaded</th>
                      <th style="width:140px;text-align:center">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="filesTableBody">
                    <tr id="emptyRow">
                      <td colspan="5">
                        <div class="empty-state">
                          <div class="empty-state-icon">📁</div>
                          <h3>No documents uploaded</h3>
                          <p>Upload your first bank PDF using the form on the left</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="result-card" style="margin-top:28px;">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              All Users
            </h3>
            <div class="files-table-wrap">
              <table class="files-table">
                <thead>
                  <tr>
                    <th style="width:40px">#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th style="width:100px">Role</th>
                    <th style="width:100px">Status</th>
                    <th style="width:160px">Created At</th>
                    <th style="width:160px">Last Login</th>
                  </tr>
                </thead>
                <tbody id="usersTableBody">
                  <tr id="usersEmptyRow">
                    <td colspan="7">
                      <div class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <h3>No users found</h3>
                        <p>User list will appear here</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <script>
          const pdfInput = document.getElementById('pdfInput');
          const uploadProgress = document.getElementById('uploadProgress');
          const filesTableBody = document.getElementById('filesTableBody');
          const usersTableBody = document.getElementById('usersTableBody');
          const dropZone = document.getElementById('dropZone');
          const browseBtn = document.getElementById('browseBtn');

          function showProgress(message, type) {
            uploadProgress.textContent = message;
            uploadProgress.className = 'upload-progress ' + (type || '');
            if (type) uploadProgress.classList.add('active');
            setTimeout(() => { uploadProgress.className = 'upload-progress'; }, 3000);
          }

          async function loadFiles() {
            try {
              const res = await fetch('/api/bank/files');
              const data = await res.json();
              renderFiles(data.files || []);
              updateSummary(data.files || []);
            } catch (err) {
              console.error('Failed to load files', err);
            }
          }

          async function loadUsers() {
            try {
              const res = await fetch('/api/admin/users');
              const data = await res.json();
              renderUsers(data.users || []);
              updateUserSummary(data.users || []);
            } catch (err) {
              console.error('Failed to load users', err);
            }
          }

          function updateSummary(files) {
            const totalDocs = files.length;
            const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0);
            const lastUploaded = files.length > 0 ? files[0].uploaded_at : null;
            document.getElementById('totalDocs').textContent = totalDocs;
            document.getElementById('totalSize').textContent = formatSize(totalSize);
            document.getElementById('lastUploaded').textContent = lastUploaded ? formatDateShort(lastUploaded) : 'Never';
          }

          function updateUserSummary(users) {
            document.getElementById('totalUsers').textContent = users.length;
          }

          function formatSize(bytes) {
            if (!bytes) return '0 KB';
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
          }

          function formatDateShort(dateStr) {
            if (!dateStr) return 'Never';
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          }

          function formatDate(dateStr) {
            if (!dateStr) return 'Unknown date';
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          }

          function renderFiles(files) {
            filesTableBody.innerHTML = '';
            if (!files.length) {
              filesTableBody.innerHTML = '<tr id="emptyRow"><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📁</div><h3>No documents uploaded</h3><p>Upload your first bank PDF using the form on the left</p></div></td></tr>';
              return;
            }
            files.forEach((file, idx) => {
              const tr = document.createElement('tr');
              tr.innerHTML = '<td style="text-align:center;font-weight:700;color:var(--text-muted)">' + (idx + 1) + '</td><td><div style="display:flex;align-items:center;gap:10px"><span style="font-size:20px">${file.file_name.toLowerCase().endsWith('.csv') ? '📊' : '📄'}</span><span class="file-name-cell" title="' + escapeHtml(file.file_name || '') + '">' + escapeHtml(file.file_name || 'Untitled') + '</span></div></td><td>' + formatSize(file.file_size) + '</td><td>' + formatDate(file.uploaded_at) + '</td><td style="text-align:center"><div style="display:flex;gap:8px;justify-content:center"><a href="/api/bank/files/' + file.id + '/download" class="action-btn" title="Download" target="_blank"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</a><button class="action-btn danger" title="Delete" onclick="deleteFile(' + file.id + ', '' + escapeHtml(file.file_name || '').replace(/'/g, "\'") + '')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Delete</button></div></td>';
              filesTableBody.appendChild(tr);
            });
          }

          function renderUsers(users) {
            usersTableBody.innerHTML = '';
            if (!users.length) {
              usersTableBody.innerHTML = '<tr id="usersEmptyRow"><td colspan="7"><div class="empty-state"><div class="empty-state-icon">👥</div><h3>No users found</h3><p>User list will appear here</p></div></td></tr>';
              return;
            }
            users.forEach((user) => {
              const tr = document.createElement('tr');
              tr.innerHTML = '<td style="text-align:center;font-weight:700;color:var(--text-muted)">' + user.id + '</td><td><div style="display:flex;align-items:center;gap:10px"><span style="font-size:18px">👤</span><span style="font-weight:600">' + escapeHtml(user.name || 'N/A') + '</span></div></td><td>' + escapeHtml(user.email || '') + '</td><td><span style="display:inline-block;padding:4px 10px;border-radius:100px;font-size:12px;font-weight:600;background:' + (user.role === 'admin' ? 'var(--primary-light)' : 'var(--border-light)') + ';color:' + (user.role === 'admin' ? 'var(--primary)' : 'var(--text-secondary)') + '">' + escapeHtml(user.role || 'user') + '</span></td><td><span style="display:inline-block;padding:4px 10px;border-radius:100px;font-size:12px;font-weight:600;background:' + (user.status === 'active' ? '#D1FAE5' : '#FEE2E2') + ';color:' + (user.status === 'active' ? '#065F46' : '#DC2626') + '">' + escapeHtml(user.status || 'active') + '</span></td><td>' + formatDate(user.created_at) + '</td><td>' + (user.last_login ? formatDate(user.last_login) : '<span style="color:var(--text-muted)">Never</span>') + '</td>';
              usersTableBody.appendChild(tr);
            });
          }

          function escapeHtml(value) {
            return String(value || '').replace(/[&<>"']/g, function(char) {
              return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char;
            });
          }

          async function deleteFile(id, name) {
            if (!confirm('Are you sure you want to delete "' + name + '"?')) return;
            try {
              const res = await fetch('/api/bank/files/' + id, { method: 'DELETE', credentials: 'same-origin' });
              const data = await res.json();
              if (data.success) {
                showProgress('File deleted successfully', 'success');
                loadFiles();
              } else {
                showProgress('Delete failed: ' + (data.error || 'Unknown error'), 'error');
              }
            } catch (err) {
              showProgress('Delete failed', 'error');
            }
          }

          if (browseBtn) {
            browseBtn.addEventListener('click', () => pdfInput.click());
          }

          if (pdfInput) {
            pdfInput.addEventListener('change', async () => {
              const file = pdfInput.files && pdfInput.files[0];
              if (!file) return;
              if (file.type !== 'application/pdf' && file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
                showProgress('Please select a valid PDF or CSV file', 'error');
                pdfInput.value = '';
                return;
              }
              if (file.size > 50 * 1024 * 1024) {
                showProgress('File size must be less than 50 MB', 'error');
                pdfInput.value = '';
                return;
              }
              const formData = new FormData();
              formData.append('file', file);
              showProgress('Uploading ' + file.name + '...');
              try {
                const res = await fetch('/api/bank/upload', {
                  method: 'POST',
                  credentials: 'same-origin',
                  body: formData
                });
                const data = await res.json();
                if (data.success) {
                  showProgress('File uploaded successfully!', 'success');
                  pdfInput.value = '';
                  loadFiles();
                } else {
                  showProgress('Upload failed: ' + (data.error || 'Unknown error'), 'error');
                }
              } catch (err) {
                showProgress('Upload failed', 'error');
              }
            });
          }

          dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
          });
          dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
          });
          dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
              pdfInput.files = files;
              pdfInput.dispatchEvent(new Event('change'));
            }
          });

          loadFiles();
          loadUsers();
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Admin error', err);
    return res.status(500).send('Server error');
  }
});app.get('/api/bank/files', requireLogin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT bf.id, bf.file_name, bf.file_path, bf.file_size, bf.uploaded_by, bf.uploaded_at
      FROM bank_uploaded_files bf
      ORDER BY bf.uploaded_at DESC
    `);
    return res.json({ files: result.rows });
  } catch (err) {
    console.error('List bank files error', err);
    return res.json({ files: [] });
  }
});

app.post('/api/bank/upload', requireLogin, bankUpload, async (req, res) => {
  const userId = req.session.userId;
  
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file provided' });
  }
  
  const file = req.file;
  const fileName = file.originalname;
  
  if (!fileName.toLowerCase().endsWith('.pdf') && !fileName.toLowerCase().endsWith('.csv')) {
    fs.unlink(file.path).catch(() => {});
    return res.status(400).json({ success: false, error: 'Only PDF and CSV files are allowed' });
  }
  
  const fileId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const ext = path.extname(fileName).toLowerCase() || '.pdf';
  const savedName = fileId + ext;
  const filePath = path.join(__dirname, 'public', 'uploads', 'bank-pdfs', savedName);
  
  try {
    await fs.promises.mkdir(path.join(__dirname, 'public', 'uploads', 'bank-pdfs'), { recursive: true });
    await fs.promises.rename(file.path, filePath);
    
    const result = await pool.query(
      `INSERT INTO bank_uploaded_files (file_name, file_path, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, file_name, uploaded_at`,
      [fileName, '/uploads/bank-pdfs/' + savedName, file.size || 0, userId]
    );
    
    return res.json({
      success: true,
      file: {
        id: result.rows[0].id,
        file_name: result.rows[0].file_name,
        file_path: '/uploads/bank-pdfs/' + savedName,
        file_size: file.size || 0,
        uploaded_by: userId,
        uploaded_at: result.rows[0].uploaded_at
      }
    });
  } catch (err) {
    console.error('Bank file upload error', err);
    try {
      await fs.promises.unlink(filePath);
    } catch (e) {}
    return res.status(500).json({ success: false, error: 'Could not save the file' });
  }
});

app.delete('/api/bank/files/:id', requireLogin, async (req, res) => {
  const fileId = req.params.id;
  
  try {
    const result = await pool.query('SELECT file_path FROM bank_uploaded_files WHERE id = $1', [fileId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    const filePath = result.rows[0].file_path;
    if (filePath && filePath.startsWith('/uploads/bank-pdfs/')) {
      const localFile = path.join(__dirname, 'public', filePath.replace(/^\//, ''));
      try {
        await fs.promises.unlink(localFile);
      } catch (e) {}
    }
    
    await pool.query('DELETE FROM bank_uploaded_files WHERE id = $1', [fileId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete bank file error', err);
    return res.status(500).json({ success: false, error: 'Could not delete the file' });
  }
});

app.get('/api/bank/files/:id/download', requireLogin, async (req, res) => {
  const fileId = req.params.id;
  
  try {
    const result = await pool.query('SELECT file_name, file_path FROM bank_uploaded_files WHERE id = $1', [fileId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    const filePath = result.rows[0].file_path;
    const fileName = result.rows[0].file_name;
    
    if (filePath && filePath.startsWith('/uploads/bank-pdfs/')) {
      const localFile = filePath.replace('/uploads/bank-pdfs/', '');
      const fullPath = path.join(__dirname, 'public', 'uploads', 'bank-pdfs', localFile);
      if (await fs.promises.stat(fullPath).then(() => true).catch(() => false)) {
        res.download(fullPath, fileName);
        return;
      }
    }
    
    return res.status(404).json({ success: false, error: 'File not found on disk' });
  } catch (err) {
    console.error('Download bank file error', err);
    return res.status(500).json({ success: false, error: 'Could not download the file' });
  }
});

app.use(express.static(path.join(__dirname, "public")));

initializeDatabase()
  .then(() => {
    app.listen(PORT, "127.0.0.1", () => {
      console.log("");
      console.log("======================================");
      console.log(" Login Page is running successfully!");
      console.log(" Open: http://localhost:3000");
      console.log(" Database: PostgreSQL");
      console.log("======================================");
    });
  })
  .catch((error) => {
    console.error("Database connection error:", error);
    process.exit(1);
  });
