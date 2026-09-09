/**
 * Simple UI verification script for the AI assistant home page.
 * Run: node scripts/verify-home-ui.js
 */

const fs = require("fs")
const path = require("path")

const homePagePath = path.join(__dirname, "..", "app", "home", "page.tsx")
const stylePath = path.join(__dirname, "..", "public", "style.css")

let errors = 0
let warnings = 0

function check(description, condition) {
  if (condition) {
    console.log(`✅ ${description}`)
  } else {
    console.log(`❌ ${description}`)
    errors++
  }
}

function warn(description) {
  console.log(`⚠️  ${description}`)
  warnings++
}

console.log("🔍 Verifying AI Assistant UI...\n")

// Check home page exists
check("home/page.tsx exists", fs.existsSync(homePagePath))

if (fs.existsSync(homePagePath)) {
  const home = fs.readFileSync(homePagePath, "utf8")

  // Sidebar toggle
  check("Sidebar toggle button exists", home.includes('className="chat-sidebar-toggle"'))
  check("Sidebar toggle has aria-label", home.includes('aria-label="Toggle sidebar"'))
  check("Sidebar toggle uses setSidebarOpen", home.includes("setSidebarOpen"))

  // Textarea improvements
  check("Textarea has ref", home.includes("ref={textareaRef}"))
  check("Textarea auto-resize on change", home.includes("adjustTextarea()"))
  check("Enter key sends message", home.includes('e.key === "Enter"'))
  check("Shift+Enter prevented", home.includes("!e.shiftKey"))

  // Code blocks
  check("enhanceCodeBlocks is called", home.includes("enhanceCodeBlocks(messagesRef)"))

  // Retry functionality
  check("isErrorMessage helper exists", home.includes("isErrorMessage"))
  check("retryMessage helper exists", home.includes("retryMessage"))
  check("Retry button renders for errors", home.includes("message-retry-btn"))
  check("Error messages store retry_content", home.includes("retry_content"))

  // Bank manager cards
  check("renderBankManagerCard uses manager-grid", home.includes("manager-grid"))
  check("renderBankManagerCard uses manager-card", home.includes("manager-card"))
  check("renderBankManagerCard uses manager-avatar", home.includes("manager-avatar"))

  // Welcome screen
  check("Welcome screen has suggestions", home.includes("chat-suggestions"))
  check("Welcome screen has multiple suggestion chips", home.includes("chat-suggestion"))

  // Loading states
  check("Send button disabled when loading", home.includes("disabled={loading"))
  check("Typing indicator exists", home.includes("chat-typing-indicator"))
}

// Check CSS exists
check("style.css exists", fs.existsSync(stylePath))

if (fs.existsSync(stylePath)) {
  const css = fs.readFileSync(stylePath, "utf8")

  check("CSS has chat-sidebar-toggle", css.includes(".chat-sidebar-toggle"))
  check("CSS has message-retry-btn", css.includes(".message-retry-btn"))
  check("CSS has manager-grid", css.includes(".manager-grid"))
  check("CSS has manager-card", css.includes(".manager-card"))
  check("CSS has manager-avatar", css.includes(".manager-avatar"))
  check("CSS has mobile sidebar toggle display", css.includes(".chat-sidebar-toggle") && css.includes("display: none"))
  check("CSS has mobile sidebar open state", css.includes(".chat-sidebar.open"))
  check("CSS has manager-card hover effect", css.includes(".manager-card:hover"))
}

console.log(`\n${errors > 0 ? "❌" : "✅"} Verification complete: ${errors} errors, ${warnings} warnings`)

if (errors > 0) {
  process.exit(1)
}
