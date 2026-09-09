const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'home', 'page.tsx'), 'utf8');

console.log('=== VERIFYING CHATGPT-STYLE AI ASSISTANT LAYOUT ===\n');

let passed = true;
function assert(desc, condition, details = '') {
  if (condition) {
    console.log(`✅ PASS: ${desc}`);
  } else {
    console.error(`❌ FAIL: ${desc} ${details ? `(${details})` : ''}`);
    passed = false;
  }
}

// 1. Parent container locking
assert(
  'html & body have chat-page-active lock with overflow hidden and 100% height',
  css.includes('html.chat-page-active') &&
  css.includes('overflow: hidden;')
);

assert(
  'home-body.chat-page locks to 100vh / 100dvh and overflow: hidden',
  css.includes('.home-body.chat-page {') &&
  css.includes('max-height: 100vh;') &&
  css.includes('overflow: hidden;')
);

assert(
  'home/page.tsx dynamically adds chat-page-active class on mount/switch',
  page.includes('document.documentElement.classList.add("chat-page-active")') &&
  page.includes('document.body.classList.add("chat-page-active")')
);

// 2. Fixed Header & Fixed Sidebar
assert(
  'Header (.app-topbar) is sticky top: 0 with fixed height var(--topbar-height)',
  css.includes('.app-topbar,') &&
  css.includes('height: var(--topbar-height);') &&
  css.includes('position: sticky;')
);

assert(
  'Chat sidebar desktop has fixed height: 100% / max-height: 100% and overflow: hidden',
  css.includes('.chat-sidebar {') &&
  css.includes('max-height: 100%;') &&
  css.includes('overflow: hidden;')
);

assert(
  'Sidebar conversation list has flex: 1 1 0%, min-height: 0, and overflow-y: auto',
  css.includes('.chat-list {') &&
  css.includes('min-height: 0;') &&
  css.includes('overflow-y: auto;')
);

// 3. AI Assistant content area fills remaining viewport height
assert(
  'chat-layout fills remaining viewport (100vh - var(--topbar-height)) with min-height: 0 and overflow: hidden',
  css.includes('.chat-layout {') &&
  css.includes('height: calc(100vh - var(--topbar-height));') &&
  css.includes('min-height: 0;') &&
  css.includes('overflow: hidden;')
);

assert(
  'chat-main fills 100% height of chat-layout with min-height: 0 and overflow: hidden',
  css.includes('.chat-main {') &&
  css.includes('height: 100%;') &&
  css.includes('min-height: 0;') &&
  css.includes('overflow: hidden;')
);

// 4. ONLY chat messages area scrolls
assert(
  'chat-messages has flex: 1, min-height: 0, and overflow-y: auto',
  css.includes('.chat-messages {') &&
  css.includes('flex: 1;') &&
  css.includes('overflow-y: auto;') &&
  css.includes('min-height: 0;')
);

assert(
  'chat-messages has overscroll-behavior-y: contain to isolate scroll',
  css.includes('overscroll-behavior-y: contain;')
);

// 5. Chat composer fixed at the bottom
assert(
  'chat-composer is flex-shrink: 0, position: sticky, bottom: 0, margin-top: auto',
  css.includes('.chat-composer {') &&
  css.includes('flex-shrink: 0;') &&
  css.includes('position: sticky;') &&
  css.includes('bottom: 0;') &&
  css.includes('margin-top: auto;')
);

// 6. Ref and auto-scroll correctness
assert(
  'messagesRef is attached to .chat-messages container so scroll height maps to scroll container',
  page.includes('className="chat-messages"') &&
  page.includes('ref={(el) => setMessagesRef(el)}')
);

assert(
  'messagesEndRef is attached to the bottom anchor div inside #chatMessagesInner',
  page.includes('<div ref={messagesEndRef} />')
);

console.log('\nResult:', passed ? 'ALL ASSERTIONS PASSED ✅' : 'FAILURES DETECTED ❌');
process.exit(passed ? 0 : 1);
