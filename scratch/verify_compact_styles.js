const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "..", "app", "home", "page.tsx"), "utf8");

let passed = true;
function assert(name, condition) {
  if (condition) {
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ FAILED: ${name}`);
    passed = false;
  }
}

console.log("--- Verifying Compact Inline ChatGPT AI Assistant Redesign ---");

// 1. Readable body text in 14-16px range
assert("Chat bubble has 14-16px font-size (0.9375rem / 15px)", css.includes("font-size: 0.9375rem; /* 15px readable body text */"));
assert("Chat input has 14-16px font-size (0.9375rem / 15px)", css.includes("font-size: 0.9375rem; /* 15px body text */"));

// 2. Tighter line-height
assert("Chat bubble has tighter line-height (1.45)", css.includes("line-height: 1.45;"));
assert("Chat input has tighter line-height (1.4)", css.includes("line-height: 1.4;"));

// 3. Simple inline messages: NO oversized card wrappers on AI messages
assert("AI message has transparent background (no card box)", css.includes(".chat-message.ai .chat-bubble {\n    background: transparent;\n    border: none;\n    box-shadow: none;"));
assert("User message has compact pill bubble", css.includes(".chat-message.user .chat-bubble"));
assert("AI message bubble width expands up to 98%", css.includes("max-width: 98%;"));

// 4. No oversized welcome cards: replaced by compact prompt chips
assert("Welcome screen uses compact prompt chips", page.includes("chat-prompt-chips") && page.includes("chat-prompt-chip"));
assert("CSS has compact chat-prompt-chip styles", css.includes(".chat-prompt-chip"));
assert("No oversized chat-welcome-card in page.tsx", !page.includes("chat-welcome-card"));

// 5. No oversized headings in messages
assert("Bubble h1-h4 scaled down to 0.88rem-1.05rem", css.includes(".chat-bubble h1 { font-size: 1.05rem; }") && css.includes(".chat-bubble h4 { font-size: 0.88rem; }"));

// 6. Compact padding & spacing throughout
assert("Chat messages container has compact padding (0.5rem 1rem)", css.includes(".chat-messages {\n    flex: 1;\n    overflow-y: auto;\n    padding: 0.5rem 1rem;"));
assert("Chat messages inner gap is 0.5rem", css.includes("gap: 0.5rem;"));
assert("Chat avatar is 24px (compact)", css.includes("width: 24px;\n    height: 24px;"));
assert("Chat composer has compact vertical padding (0.35rem)", css.includes(".chat-composer {\n    border-top: 1px solid var(--border);\n    background: var(--surface);\n    padding: 0.35rem 1rem 0.4rem 1rem;"));
assert("Chat send button is compact (28px)", css.includes(".chat-send-btn {\n    width: 28px;\n    height: 28px;"));

// 7. Compact inline tables & lists
assert("Tables have compact cell padding (0.2rem 0.45rem)", css.includes(".chat-bubble th,\n.chat-bubble td,\n.chat-page .table th,\n.chat-page .table td {\n    padding: 0.2rem 0.45rem;"));
assert("Bank managers render as compact inline list", page.includes("manager-inline-list"));

// 8. Untouched other dashboard tabs
assert("Home Dashboard untouched", css.includes(".dashboard-home-view"));
assert("EMI Calculator untouched", css.includes(".emi-page-wrapper"));
assert("Policies View untouched", css.includes(".policies-page"));

console.log("\nSummary:", passed ? "ALL CHECKS PASSED ✅" : "SOME CHECKS FAILED ❌");
process.exit(passed ? 0 : 1);
